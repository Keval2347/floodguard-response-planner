import { createServerFn } from "@tanstack/react-start";

import type { WardData } from "./data";
import type { LatLon } from "./geo";
import type { Hospital } from "./hospitals";

/** Real Navrangpura data: OSM streets, SRTM elevation, OSRM times, rainfall. */
export const getWardData = createServerFn({ method: "POST" })
  .inputValidator((input?: { refresh?: boolean }) => ({ refresh: Boolean(input?.refresh) }))
  .handler(async ({ data }): Promise<WardData> => {
    const { buildWardData } = await import("./pipeline.server");
    // Snapshot replay is REAL captured OSM/SRTM/OSRM data (never synthetic),
    // and every response carries a note saying which layer was replayed.
    return buildWardData({ refresh: data.refresh, allowSnapshot: true });
  });

export interface RainNowDTO {
  nowMmPerHr: number;
  raining: boolean;
  last60Mm: number;
  next60Mm: number;
  observedMm: number;
  forecastMm: number;
  rainSeries: { hour: string; mm: number }[];
  nowcast: { time: string; mm: number }[];
  observedAt: string;
  fetchedAt: string;
}

/**
 * Live rainfall only — small and fast, so the dashboard can poll it every
 * minute without re-running the whole OSM/DEM/OSRM pipeline.
 */
export const getRainNow = createServerFn({ method: "GET" }).handler(async (): Promise<RainNowDTO> => {
  const { fetchRainNow } = await import("./pipeline.server");
  return fetchRainNow();
});

export interface RoutePath {
  key: string;
  path: [number, number][];
  distanceKm: number;
  durationMin: number;
}

/** Road-following driving routes for the current truck assignments. */
export const getRoutes = createServerFn({ method: "POST" })
  .inputValidator((input: { pairs: { key: string; from: LatLon; to: LatLon }[] }) => {
    if (!Array.isArray(input?.pairs)) throw new Error("pairs required");
    return { pairs: input.pairs.slice(0, 20) };
  })
  .handler(async ({ data }): Promise<RoutePath[]> => {
    const { fetchRouteGeometry } = await import("./pipeline.server");
    const out: RoutePath[] = [];
    for (const p of data.pairs) {
      try {
        const r = await fetchRouteGeometry(p.from, p.to);
        out.push({ key: p.key, ...r });
      } catch {
        /* skip this leg; the map just won't draw it */
      }
    }
    return out;
  });

export interface HospitalsDTO {
  hospitals: Hospital[];
  fetchedAt: string;
  live: boolean;
  note: string;
}

/**
 * Every mapped hospital in Ahmedabad, straight from OpenStreetMap.
 * Cached 24 h server-side — the list changes rarely, the risk join does not.
 */
export const getHospitals = createServerFn({ method: "POST" })
  .inputValidator((input?: { refresh?: boolean }) => ({ refresh: Boolean(input?.refresh) }))
  .handler(async ({ data }): Promise<HospitalsDTO> => {
    const { fetchHospitals } = await import("./pipeline.server");
    return fetchHospitals(data.refresh, true);
  });
