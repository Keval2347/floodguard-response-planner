import { createServerFn } from "@tanstack/react-start";

import type { WardData } from "./data";
import type { LatLon } from "./geo";

/** Real Navrangpura data: OSM streets, SRTM elevation, OSRM times, rainfall. */
export const getWardData = createServerFn({ method: "GET" }).handler(async (): Promise<WardData> => {
  const { buildWardData } = await import("./pipeline.server");
  return buildWardData();
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
