/**
 * JalNiti — real-world data pipeline (server side only).
 *
 * This is the TypeScript twin of backend/app/data_pipeline. It pulls the SAME
 * public datasets the Python pipeline uses, so the dashboard shows real
 * Navrangpura data without waiting for FastAPI + PostGIS to be deployed.
 *
 *   streets + waterways  ->  OpenStreetMap via the Overpass API
 *   elevation + slope    ->  NASA SRTM 30 m DEM via OpenTopoData
 *                            (GMTED2010 used automatically if SRTM is busy)
 *   travel times/routes  ->  OSRM, routed over the real road network
 *   rainfall             ->  Open-Meteo observed + forecast at the ward centroid
 *
 * Everything is cached in-process (see TTLs below) so a reload does not
 * re-hit the free community endpoints, matching the caching rule in the brief.
 */

import { haversineM, midOf, pathLengthM, type LatLon } from "./geo";
import { DEPOTS, WARD, type StreetSegment, type WardData } from "./data";
import snapshot from "./navrangpura.snapshot.json";
import hospitalSnapshot from "./hospitals.snapshot.json";
import type { Hospital } from "./hospitals";

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const OSRM = "https://router.project-osrm.org";
const TOPO = "https://api.opentopodata.org/v1";
const METEO = "https://api.open-meteo.com/v1/forecast";

/**
 * How many street pieces the ward map scores. Kept high so the whole drivable
 * network is coloured — safe streets show green, exactly like a real ward map,
 * instead of a handful of sampled lines.
 */
const MAX_SEGMENTS = 220;
/** Only the worst streets need an exact OSRM matrix row (public /table caps ~100 coords). */
const PLANNING_SEGMENTS = 60;
const SEGMENT_TARGET_M = 450;

/* ------------------------------------------------------------------ cache */

interface Entry<T> {
  value: T;
  expires: number;
}
const store = new Map<string, Entry<unknown>>();

async function cached<T>(key: string, ttlMs: number, fn: () => Promise<T>): Promise<T> {
  const hit = store.get(key);
  if (hit && hit.expires > Date.now()) return hit.value as T;
  const value = await fn();
  store.set(key, { value, expires: Date.now() + ttlMs });
  return value;
}

async function getJson(url: string, init?: RequestInit, timeoutMs = 45000) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...init, signal: ctrl.signal });
    if (!res.ok) throw new Error(`${url} -> HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/* --------------------------------------------------------------- overpass */

interface OverpassWay {
  id: number;
  tags?: Record<string, string>;
  geometry?: { lat: number; lon: number }[];
}

/**
 * Roads and waterways are asked for separately: the free Overpass instances
 * regularly answer 504 to a combined query for this bbox. Each query is retried
 * across mirrors, and the whole result is cached for 3 h.
 */
const ROADS_QUERY = (bbox: string) =>
  `[out:json][timeout:90];way["highway"~"^(trunk|primary|secondary|tertiary|residential)$"](${bbox});out geom;`;
const WATER_QUERY = (bbox: string) =>
  `[out:json][timeout:90];(way["waterway"](${bbox});way["natural"="water"](${bbox}););out geom;`;

async function overpass(query: string, attempts = 8): Promise<OverpassWay[]> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const endpoint = OVERPASS[i % OVERPASS.length];
    try {
      const data = await getJson(endpoint, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: `data=${encodeURIComponent(query)}`,
      });
      const els = data.elements;
      if (Array.isArray(els) && els.length > 0) return els as OverpassWay[];
      throw new Error(`Overpass returned no elements (${endpoint})`);
    } catch (err) {
      lastErr = err;
      await new Promise((r) => setTimeout(r, 4000 + 2000 * i));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error("Overpass unavailable");
}

async function fetchOsm(): Promise<OverpassWay[]> {
  const bbox = WARD.bbox.join(",");
  const roads = await overpass(ROADS_QUERY(bbox));
  let waters: OverpassWay[] = [];
  try {
    waters = await overpass(WATER_QUERY(bbox), 4);
  } catch {
    /* the ward still scores without the waterway layer; noted in the UI */
  }
  return [...roads, ...waters];
}


/* ------------------------------------------------------------------- DEM */

/** Sample elevations in batches; OpenTopoData allows 100 locations per call. */
async function fetchElevations(points: LatLon[]): Promise<{ values: number[]; source: string }> {
  const datasets = ["srtm30m", "gmted2010"];
  for (const ds of datasets) {
    try {
      const out: number[] = [];
      for (let i = 0; i < points.length; i += 100) {
        const chunk = points.slice(i, i + 100);
        const body = `locations=${chunk.map(([la, lo]) => `${la.toFixed(5)},${lo.toFixed(5)}`).join("|")}`;
        const data = await getJson(`${TOPO}/${ds}`, {
          method: "POST",
          headers: { "content-type": "application/x-www-form-urlencoded" },
          body,
        });
        if (data.status !== "OK") throw new Error(`${ds}: ${data.error ?? data.status}`);
        for (const r of data.results) out.push(Number(r.elevation ?? 0));
        if (i + 100 < points.length) await new Promise((r) => setTimeout(r, 1100)); // rate limit
      }
      return { values: out, source: ds === "srtm30m" ? "NASA SRTM 30 m" : "GMTED2010" };
    } catch {
      /* try the next dataset */
    }
  }
  throw new Error("No DEM endpoint answered");
}

/* --------------------------------------------------------------- weather */

export interface RainNow {
  /** Rain rate right now, mm/h (Open-Meteo `current.precipitation`). */
  nowMmPerHr: number;
  /** True only if it is actually raining at this minute. */
  raining: boolean;
  /** Rain measured in the last 60 minutes, mm (15-min buckets). */
  last60Mm: number;
  /** Nowcast for the next 60 minutes, mm (15-min buckets). */
  next60Mm: number;
  /** Observed total, last 24 h. */
  observedMm: number;
  /** Forecast total, next 24 h. */
  forecastMm: number;
  /** Hourly observed rainfall for the last 12 h. */
  rainSeries: { hour: string; mm: number }[];
  /** 15-minute nowcast buckets for the next 2 h. */
  nowcast: { time: string; mm: number }[];
  /** Station/model timestamp of the `current` block, IST. */
  observedAt: string;
  /** When this server actually called the weather API. */
  fetchedAt: string;
  /** True when the weather API failed and this is the last good reading. */
  stale?: boolean;
  /** Why the last call failed, shown verbatim in the UI. */
  staleReason?: string;
}

/** Last successful reading, kept so a single failed poll never blanks the UI. */
let lastGoodRain: RainNow | undefined;

const METEO_HOSTS = ["https://api.open-meteo.com/v1/forecast", "https://api.open-meteo.com/v1/gfs"];

/**
 * Real-time rainfall for the ward centroid.
 *
 * Uses Open-Meteo's `current` block (updated every ~15 min from the same
 * radar/observation assimilation IMD feeds into) plus the 15-minute nowcast,
 * so "is it raining right now" is answered by an observation, not by a 24 h
 * forecast total. Cached for only 60 s so the dashboard can poll it live.
 *
 * If every attempt fails we return the last good reading marked `stale` with
 * the real error text, instead of leaving the dashboard with empty dashes.
 */
export async function fetchRainNow(): Promise<RainNow> {
  return cached("rain-now", 60_000, async () => {
    const [lat, lon] = WARD.center;
    const query =
      `?latitude=${lat}&longitude=${lon}` +
      `&current=precipitation,rain` +
      `&minutely_15=precipitation` +
      `&hourly=precipitation&past_days=2&forecast_days=2&timezone=Asia%2FKolkata`;

    let data: any;
    let lastErr: unknown;
    for (let attempt = 0; attempt < 4 && !data; attempt++) {
      const host = METEO_HOSTS[attempt % METEO_HOSTS.length];
      try {
        data = await getJson(host + query, undefined, 12000);
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 400 * (attempt + 1)));
      }
    }
    if (!data) {
      const reason = lastErr instanceof Error ? lastErr.message : String(lastErr);
      if (lastGoodRain) {
        return { ...lastGoodRain, stale: true, staleReason: reason };
      }
      throw new Error(`Open-Meteo unreachable: ${reason}`);
    }


    const times: string[] = data.hourly.time;
    const mm: number[] = data.hourly.precipitation;
    const now = Date.now();
    const ist = (t: string) => new Date(`${t}+05:30`).getTime();
    let nowIdx = times.findIndex((t) => ist(t) > now);
    if (nowIdx < 0) nowIdx = times.length - 1;
    const from = Math.max(0, nowIdx - 12);

    const rainSeries = times
      .slice(from, nowIdx)
      .map((t, i) => ({ hour: t.slice(11, 16), mm: Number(mm[from + i] ?? 0) }));

    const sum = (xs: (number | null)[]) =>
      Math.round(xs.reduce((a: number, b) => a + (b ?? 0), 0) * 10) / 10;

    const observedMm = sum(mm.slice(Math.max(0, nowIdx - 24), nowIdx));
    const forecastMm = sum(mm.slice(nowIdx, nowIdx + 24));

    // 15-minute buckets around "now" → the last hour and the next hour.
    const qTimes: string[] = data.minutely_15?.time ?? [];
    const qMm: number[] = data.minutely_15?.precipitation ?? [];
    let qIdx = qTimes.findIndex((t) => ist(t) > now);
    if (qIdx < 0) qIdx = qTimes.length;
    const last60Mm = sum(qMm.slice(Math.max(0, qIdx - 4), qIdx));
    const next60Mm = sum(qMm.slice(qIdx, qIdx + 4));
    const nowcast = qTimes
      .slice(qIdx, qIdx + 8)
      .map((t, i) => ({ time: t.slice(11, 16), mm: Number(qMm[qIdx + i] ?? 0) }));

    const nowMmPerHr = Math.round(Number(data.current?.precipitation ?? 0) * 10) / 10;

    const reading: RainNow = {
      nowMmPerHr,
      raining: nowMmPerHr > 0 || last60Mm > 0.1,
      last60Mm,
      next60Mm,
      observedMm,
      forecastMm,
      rainSeries,
      nowcast,
      observedAt: String(data.current?.time ?? "").replace("T", " "),
      fetchedAt: new Date().toISOString(),
    };
    lastGoodRain = reading;
    return reading;
  });

}

async function fetchRain() {
  const r = await fetchRainNow();
  return { rainSeries: r.rainSeries, observedMm: r.observedMm, forecastMm: r.forecastMm };
}


/* ------------------------------------------------------------------ OSRM */

/** Real road-network duration matrix (minutes) between every pair of points. */
async function fetchTravelMatrix(points: LatLon[]): Promise<number[][]> {
  const coords = points.map(([la, lo]) => `${lo.toFixed(6)},${la.toFixed(6)}`).join(";");
  const data = await getJson(`${OSRM}/table/v1/driving/${coords}?annotations=duration`);
  if (data.code !== "Ok") throw new Error(`OSRM table: ${data.code}`);
  return (data.durations as (number | null)[][]).map((row) =>
    row.map((s) => (s == null ? Number.POSITIVE_INFINITY : Math.round((s / 60) * 10) / 10)),
  );
}

/** The actual driving path between two points, as [lat, lon] vertices. */
export async function fetchRouteGeometry(from: LatLon, to: LatLon) {
  const key = `route:${from.join(",")}->${to.join(",")}`;
  return cached(key, 24 * 3600_000, async () => {
    const c = `${from[1].toFixed(6)},${from[0].toFixed(6)};${to[1].toFixed(6)},${to[0].toFixed(6)}`;
    const data = await getJson(`${OSRM}/route/v1/driving/${c}?overview=full&geometries=geojson`);
    if (data.code !== "Ok" || !data.routes?.length) throw new Error(`OSRM route: ${data.code}`);
    const r = data.routes[0];
    return {
      path: (r.geometry.coordinates as [number, number][]).map(
        ([lo, la]) => [la, lo] as [number, number],
      ),
      distanceKm: Math.round((r.distance / 1000) * 10) / 10,
      durationMin: Math.round((r.duration / 60) * 10) / 10,
    };
  });
}

/* ------------------------------------------------------------ processing */

function splitWay(geom: LatLon[]): LatLon[][] {
  const total = pathLengthM(geom);
  const parts = Math.max(1, Math.round(total / SEGMENT_TARGET_M));
  if (parts === 1) return [geom];
  const per = total / parts;
  const out: LatLon[][] = [];
  let current: LatLon[] = [geom[0]];
  let acc = 0;
  for (let i = 1; i < geom.length; i++) {
    current.push(geom[i]);
    acc += haversineM(geom[i - 1], geom[i]);
    if (acc >= per && out.length < parts - 1) {
      out.push(current);
      current = [geom[i]];
      acc = 0;
    }
  }
  if (current.length > 1) out.push(current);
  return out;
}

/** km of road per km^2 within a 300 m disc, straight from the OSM geometry. */
function roadDensity(centre: LatLon, roadEdges: { a: LatLon; b: LatLon; len: number }[]) {
  const R = 300;
  let metres = 0;
  for (const e of roadEdges) {
    if (haversineM(centre, e.a) <= R) metres += e.len;
  }
  const areaKm2 = Math.PI * (R / 1000) ** 2;
  return Math.round((metres / 1000 / areaKm2) * 10) / 10;
}

/**
 * Real ward data.
 *
 * The free community endpoints (Overpass, OpenTopoData) rate-limit shared
 * cloud IPs with HTTP 429, which used to leave the dashboard stuck on
 * "Fetching…". So: try live first, and if any upstream refuses, fall back to
 * the committed snapshot — which is itself REAL data captured from the same
 * endpoints by scripts/build-snapshot.ts. Rainfall is always refreshed live
 * (Open-Meteo has no such limit), so the snapshot never shows stale weather.
 */
export async function buildWardData(
  opts: { allowSnapshot?: boolean; refresh?: boolean } = {},
): Promise<WardData> {
  const { allowSnapshot = true, refresh = false } = opts;
  if (refresh) {
    // "Refresh feeds" must actually re-hit the upstreams, not replay the
    // 3 h in-process cache.
    store.delete("ward");
    store.delete("rain-now");
  }
  try {

    // Hard budget: never leave the dashboard spinning on a rate-limited mirror.
    return await Promise.race([
      buildLiveWardData(),
      new Promise<WardData>((_, rej) =>
        setTimeout(() => rej(new Error("live upstreams did not answer within 35 s")), 35000),
      ),
    ]);
  } catch (err) {
    if (!allowSnapshot) throw err;
    const snap = snapshot as unknown as WardData;
    const notes = [
      ...snap.notes,
      `Live refresh unavailable (${(err as Error).message}) — street geometry and terrain replayed from the OSM/SRTM/OSRM capture of ${new Date(snap.fetchedAt).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST (roads and elevation do not change day to day)`,
    ];
    let rain = {
      rainSeries: snap.rainSeries,
      observedMm: snap.observedMm,
      forecastMm: snap.forecastMm,
    };
    try {
      rain = await fetchRain();
      notes.push(
        `Rainfall refreshed live: ${rain.observedMm} mm observed in the last 24 h, ${rain.forecastMm} mm forecast for the next 24 h`,
      );
    } catch {
      notes.push("Rainfall feed unavailable — snapshot rainfall shown");
    }
    return {
      ...snap,
      ...rain,
      // This response was assembled now, from today's rainfall — only the
      // geometry layer is replayed, so stamp both separately.
      fetchedAt: new Date().toISOString(),
      geometryCapturedAt: snap.fetchedAt,
      notes,
    };
  }
}

/** Snapshot capture (scripts/build-snapshot.ts) can pass pre-downloaded OSM ways. */
let injectedWays: OverpassWay[] | null = null;
export function useOsmWays(ways: OverpassWay[]) {
  injectedWays = ways;
}

async function buildLiveWardData(): Promise<WardData> {
  return cached("ward", 45 * 60_000, async (): Promise<WardData> => {
    const notes: string[] = [];
    const ways = injectedWays ?? (await fetchOsm());


    const roads = ways.filter((w) => w.tags?.highway && (w.geometry?.length ?? 0) > 1);
    const waters = ways.filter(
      (w) => (w.tags?.waterway || w.tags?.natural === "water") && (w.geometry?.length ?? 0) > 1,
    );

    notes.push(`OpenStreetMap: ${roads.length} road ways, ${waters.length} waterway ways`);

    const roadEdges: { a: LatLon; b: LatLon; len: number }[] = [];
    for (const w of roads) {
      const g = w.geometry!.map((p) => [p.lat, p.lon] as LatLon);
      for (let i = 1; i < g.length; i++) {
        roadEdges.push({ a: g[i - 1], b: g[i], len: haversineM(g[i - 1], g[i]) });
      }
    }

    const waterPoints: LatLon[] = waters.flatMap((w) =>
      w.geometry!.map((p) => [p.lat, p.lon] as LatLon),
    );

    // Named, drivable roads become candidate segments; unnamed service roads
    // still count towards road density above.
    const candidates: { name: string; osm_id: number; highway: string; path: LatLon[] }[] = [];
    for (const w of roads) {
      const name = w.tags?.name;
      if (!name) continue;
      const g = w.geometry!.map((p) => [p.lat, p.lon] as LatLon);
      for (const piece of splitWay(g)) {
        if (pathLengthM(piece) < 120) continue;
        candidates.push({ name, osm_id: w.id, highway: w.tags!.highway, path: piece });
      }
    }

    const classRank: Record<string, number> = {
      trunk: 0,
      primary: 1,
      secondary: 2,
      tertiary: 3,
      unclassified: 4,
      residential: 5,
    };
    candidates.sort(
      (a, b) =>
        (classRank[a.highway] ?? 9) - (classRank[b.highway] ?? 9) ||
        pathLengthM(b.path) - pathLengthM(a.path),
    );

    // Keep at most one long piece per street name first, then fill up.
    const chosen: typeof candidates = [];
    const seen = new Set<string>();
    for (const c of candidates) {
      if (chosen.length >= MAX_SEGMENTS) break;
      if (seen.has(c.name)) continue;
      seen.add(c.name);
      chosen.push(c);
    }
    for (const c of candidates) {
      if (chosen.length >= MAX_SEGMENTS) break;
      if (chosen.includes(c)) continue;
      chosen.push(c);
    }

    // --- DEM: 3 samples per segment (start / middle / end).
    const samples: LatLon[] = [];
    for (const c of chosen) {
      samples.push(c.path[0], midOf(c.path), c.path[c.path.length - 1]);
    }
    const dem = await fetchElevations(samples);
    notes.push(`Elevation: ${dem.source} sampled at ${samples.length} points`);

    const segments: StreetSegment[] = chosen.map((c, i) => {
      const [e0, e1, e2] = [dem.values[i * 3], dem.values[i * 3 + 1], dem.values[i * 3 + 2]];
      const length_m = Math.round(pathLengthM(c.path));
      const drop = Math.max(Math.abs(e0 - e1), Math.abs(e1 - e2), Math.abs(e0 - e2));
      const slope_pct = Math.round((drop / Math.max(length_m, 1)) * 100 * 100) / 100;
      const centre = midOf(c.path);
      const dist_to_water_m = waterPoints.length
        ? Math.round(Math.min(...waterPoints.map((p) => haversineM(centre, p))))
        : 1500;
      const elevation_m = Math.round(((e0 + e1 + e2) / 3) * 10) / 10;
      const density = roadDensity(centre, roadEdges);
      return {
        id: `S${String(i + 1).padStart(2, "0")}`,
        name: c.name,
        osm_id: c.osm_id,
        highway: c.highway,
        path: c.path,
        length_m,
        elevation_m,
        slope_pct,
        dist_to_water_m,
        road_density: density,
        base_risk: 0, // filled below, once the ward's own min/max are known
      };
    });

    // --- Transparent, reviewable scoring on REAL features. The weights are the
    // same ones the Python logistic-regression baseline starts from; each term
    // is min-max normalised across this ward so the map is comparable.
    const range = (get: (s: StreetSegment) => number) => {
      const v = segments.map(get);
      const lo = Math.min(...v);
      const hi = Math.max(...v);
      return (x: number) => (hi - lo < 1e-9 ? 0.5 : (x - lo) / (hi - lo));
    };
    const nElev = range((s) => s.elevation_m);
    const nSlope = range((s) => Math.min(s.slope_pct, 4));
    const nWater = range((s) => Math.min(s.dist_to_water_m, 1500));
    const nDens = range((s) => s.road_density);

    for (const s of segments) {
      const raw =
        0.34 * (1 - nWater(Math.min(s.dist_to_water_m, 1500))) +
        0.28 * (1 - nSlope(Math.min(s.slope_pct, 4))) +
        0.22 * (1 - nElev(s.elevation_m)) +
        0.16 * nDens(s.road_density);
      s.base_risk = Math.round(Math.min(0.97, Math.max(0.05, raw)) * 100) / 100;
    }

    // --- Travel times (depots first, then segments). Only OSRM measurements
    // are eligible for allocation. Unmeasured pairs stay unreachable rather
    // than being filled with an assumed speed or straight-line prediction.
    const matrixPoints: LatLon[] = [
      ...DEPOTS.map((d) => [d.lat, d.lon] as LatLon),
      ...segments.map((s) => midOf(s.path)),
    ];
    const travelMin: number[][] = matrixPoints.map((_, row) =>
      matrixPoints.map((__, col) => (row === col ? 0 : 1_000_000_000)),
    );

    const planIdx = segments
      .map((s, i) => ({ i: DEPOTS.length + i, risk: s.base_risk }))
      .sort((a, b) => b.risk - a.risk)
      .slice(0, PLANNING_SEGMENTS)
      .map((x) => x.i);
    const exactIdx = [...DEPOTS.map((_, i) => i), ...planIdx];
    const sub = await fetchTravelMatrix(exactIdx.map((i) => matrixPoints[i]));
    exactIdx.forEach((ri, r) => {
      exactIdx.forEach((ci, c) => {
        travelMin[ri][ci] = sub[r][c];
      });
    });
    notes.push(
      `OSRM: exact ${exactIdx.length}x${exactIdx.length} road travel-time matrix for the depots + ${planIdx.length} priority streets; ${segments.length - planIdx.length} remaining streets are map-only and never assigned using estimated travel times`,
    );


    const rain = await fetchRain();
    notes.push(
      `Rainfall: ${rain.observedMm} mm observed in the last 24 h, ${rain.forecastMm} mm forecast for the next 24 h`,
    );

    return {
      segments,
      depots: DEPOTS,
      rainSeries: rain.rainSeries,
      forecastMm: rain.forecastMm,
      observedMm: rain.observedMm,
      travelMin,
      fetchedAt: new Date().toISOString(),
      notes,
    };
  });
}

/* ------------------------------------------------------------- hospitals */

/**
 * Every mapped hospital in Ahmedabad, from OpenStreetMap.
 *
 * Overpass query: `amenity=hospital` (node/way/relation) over the Ahmedabad
 * urban bbox. Ways/relations are reduced to their centroid by `out center`.
 * Cached 24 h in-process; if Overpass refuses (429/504) we fall back to the
 * committed capture in hospitals.snapshot.json, which was produced by the very
 * same query — so the list is always real OSM data with real element ids.
 */
const HOSPITAL_BBOX = "22.90,72.40,23.20,72.75";
const HOSPITAL_QUERY = `[out:json][timeout:120];(node["amenity"="hospital"](${HOSPITAL_BBOX});way["amenity"="hospital"](${HOSPITAL_BBOX});relation["amenity"="hospital"](${HOSPITAL_BBOX}););out center tags;`;

export interface HospitalsPayload {
  hospitals: Hospital[];
  fetchedAt: string;
  live: boolean;
  note: string;
}

export async function fetchHospitals(
  refresh = false,
  allowSnapshot = true,
): Promise<HospitalsPayload> {
  if (refresh) store.delete("hospitals");
  return cached("hospitals", 24 * 3600_000, async (): Promise<HospitalsPayload> => {
    try {
      const els = (await overpass(HOSPITAL_QUERY, 3)) as (OverpassWay & {
        lat?: number;
        lon?: number;
        center?: { lat: number; lon: number };
        type?: string;
      })[];
      const seen = new Set<string>();
      const hospitals: Hospital[] = [];
      for (const e of els) {
        const t = e.tags ?? {};
        const name = t.name ?? t["name:en"];
        const lat = e.lat ?? e.center?.lat;
        const lon = e.lon ?? e.center?.lon;
        if (!name || lat == null || lon == null) continue;
        const key = `${name.toLowerCase()}|${lat.toFixed(4)}|${lon.toFixed(4)}`;
        if (seen.has(key)) continue;
        seen.add(key);
        hospitals.push({
          id: `${(e.type ?? "n")[0].toUpperCase()}${e.id}`,
          name,
          lat: Number(lat.toFixed(6)),
          lon: Number(lon.toFixed(6)),
          emergency: t.emergency === "yes",
          beds: /^\d+$/.test(t.beds ?? "") ? Number(t.beds) : null,
          operator: t.operator ?? t["operator:type"] ?? null,
          healthcare: t.healthcare ?? "hospital",
        });
      }
      hospitals.sort((a, b) => a.name.localeCompare(b.name));
      return {
        hospitals,
        fetchedAt: new Date().toISOString(),
        live: true,
        note: `OpenStreetMap Overpass: ${hospitals.length} mapped hospitals across Ahmedabad (amenity=hospital)`,
      };
    } catch (err) {
      if (!allowSnapshot) throw err;
      const snap = hospitalSnapshot as { fetchedAt: string; source: string; hospitals: Hospital[] };
      return {
        hospitals: snap.hospitals,
        fetchedAt: snap.fetchedAt,
        live: false,
        note: `Overpass unavailable (${(err as Error).message}) — using the committed OSM hospital capture (${snap.hospitals.length} facilities, ${snap.source})`,
      };
    }
  });
}
