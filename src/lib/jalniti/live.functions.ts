import { createServerFn } from "@tanstack/react-start";

import type { WardData } from "./data";
import type { LatLon } from "./geo";
import type { Hospital } from "./hospitals";
import {
  parseStrict,
  RefreshInputSchema,
  RoutesInputSchema,
  type RefreshInput,
  type RoutesInput,
} from "./schema";

/** Real Navrangpura data: OSM streets, SRTM elevation, OSRM times, rainfall. */
export const getWardData = createServerFn({ method: "POST" })
  .validator((raw: unknown): RefreshInput => {
    // Strict: extra keys are rejected by the schema (.strict()); `refresh` must
    // be an actual boolean — we do NOT coerce "true" / 1 / null.
    return parseStrict(RefreshInputSchema, raw ?? {}, "getWardData input");
  })
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
  /** True when the weather API failed and this is the last good reading. */
  stale?: boolean;
  /** A stable, user-safe explanation when the last reading is stale. */
  staleReason?: string;
}

/**
 * Live rainfall only — small and fast, so the dashboard can poll it every
 * minute without re-running the whole OSM/DEM/OSRM pipeline.
 *
 * GET carries no body, so there is nothing to validate; the handler is still
 * wrapped with error normalisation for consistency.
 */
export const getRainNow = createServerFn({ method: "GET" }).handler(
  async (): Promise<RainNowDTO> => {
    const { fetchRainNow } = await import("./pipeline.server");
    try {
      return await fetchRainNow();
    } catch (error) {
      console.error("[JalNiti] live rainfall request failed", error);
      throw new Error("Live rainfall data is temporarily unavailable.");
    }
  },
);

export interface RoutePath {
  key: string;
  path: [number, number][];
  distanceKm: number;
  durationMin: number;
}

/** Road-following driving routes for the current truck assignments. */
export const getRoutes = createServerFn({ method: "POST" })
  .validator((raw: unknown): RoutesInput => {
    // Strict: coordinate ranges, key length/character set, and array size cap
    // (≤ 20 pairs) are all enforced — we never truncate silently.
    return parseStrict(RoutesInputSchema, raw, "getRoutes input");
  })
  .handler(async ({ data }): Promise<RoutePath[]> => {
    const { fetchRouteGeometry } = await import("./pipeline.server");
    const out: RoutePath[] = [];
    for (const p of data.pairs) {
      try {
        const r = await fetchRouteGeometry(p.from as LatLon, p.to as LatLon);
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
  .validator((raw: unknown): RefreshInput => {
    return parseStrict(RefreshInputSchema, raw ?? {}, "getHospitals input");
  })
  .handler(async ({ data }): Promise<HospitalsDTO> => {
    const { fetchHospitals } = await import("./pipeline.server");
    return fetchHospitals(data.refresh, true);
  });
