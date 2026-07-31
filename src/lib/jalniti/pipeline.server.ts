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

const OVERPASS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.private.coffee/api/interpreter",
  "https://overpass.osm.ch/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
];

const OSRM = "https://router.project-osrm.org";
const TOPO = "https://api.opentopodata.org/v1";
const METEO = "https://api.open-meteo.com/v1/forecast";

const MAX_SEGMENTS = 42;
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

async function fetchRain() {
  const [lat, lon] = WARD.center;
  const data = await getJson(
    `${METEO}?latitude=${lat}&longitude=${lon}&hourly=precipitation&past_days=2&forecast_days=2&timezone=Asia%2FKolkata`,
  );
  const times: string[] = data.hourly.time;
  const mm: number[] = data.hourly.precipitation;
  const now = Date.now();
  let nowIdx = times.findIndex((t) => new Date(`${t}+05:30`).getTime() > now);
  if (nowIdx < 0) nowIdx = times.length - 1;

  const rainSeries = times
    .slice(Math.max(0, nowIdx - 12), nowIdx)
    .map((t, i) => ({ hour: t.slice(11, 16), mm: Number(mm[Math.max(0, nowIdx - 12) + i] ?? 0) }));

  const observedMm =
    Math.round(mm.slice(Math.max(0, nowIdx - 24), nowIdx).reduce((a, b) => a + (b ?? 0), 0) * 10) /
    10;
  const forecastMm =
    Math.round(mm.slice(nowIdx, nowIdx + 24).reduce((a, b) => a + (b ?? 0), 0) * 10) / 10;

  return { rainSeries, observedMm, forecastMm };
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
export async function buildWardData(opts: { allowSnapshot?: boolean } = {}): Promise<WardData> {
  const { allowSnapshot = true } = opts;
  try {
    return await buildLiveWardData();
  } catch (err) {
    if (!allowSnapshot) throw err;
    const snap = (await import("./navrangpura.snapshot.json", { with: { type: "json" } }))
      .default as unknown as WardData;
    const notes = [
      ...snap.notes,
      `Live refresh unavailable (${(err as Error).message}) — using the cached OSM/SRTM/OSRM capture from ${new Date(snap.fetchedAt).toLocaleString("en-IN")}`,
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
    return { ...snap, ...rain, notes };
  }
}

/** Snapshot capture (scripts/build-snapshot.ts) can pass pre-downloaded OSM ways. */
let injectedWays: OverpassWay[] | null = null;
export function useOsmWays(ways: OverpassWay[]) {
  injectedWays = ways;
}

async function buildLiveWardData(): Promise<WardData> {
  return cached("ward", 3 * 3600_000, async (): Promise<WardData> => {
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

    // --- Real road-network travel times (depots first, then segments).
    const matrixPoints: LatLon[] = [
      ...DEPOTS.map((d) => [d.lat, d.lon] as LatLon),
      ...segments.map((s) => midOf(s.path)),
    ];
    let travelMin: number[][];
    try {
      travelMin = await fetchTravelMatrix(matrixPoints);
      notes.push(`OSRM: ${matrixPoints.length}x${matrixPoints.length} road travel-time matrix`);
    } catch (err) {
      // Straight-line fallback at 25 km/h so the UI still works if OSRM is down.
      travelMin = matrixPoints.map((a) =>
        matrixPoints.map((b) => Math.round((haversineM(a, b) / 1000 / 25) * 60 * 10) / 10),
      );
      notes.push(`OSRM unavailable (${(err as Error).message}) — straight-line times used`);
    }

    let rain = { rainSeries: [] as { hour: string; mm: number }[], observedMm: 0, forecastMm: 0 };
    try {
      rain = await fetchRain();
      notes.push(
        `Rainfall: ${rain.observedMm} mm observed in the last 24 h, ${rain.forecastMm} mm forecast for the next 24 h`,
      );
    } catch (err) {
      notes.push(`Rainfall feed unavailable (${(err as Error).message})`);
    }

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
