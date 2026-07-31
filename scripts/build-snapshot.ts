/**
 * Regenerates src/lib/jalniti/navrangpura.snapshot.json from the live public
 * datasets (OSM Overpass, SRTM via OpenTopoData, OSRM, Open-Meteo). Run from
 * the repo root:
 *
 *   bash scripts/fetch-osm.sh          # downloads /tmp/roads.json + /tmp/water.json
 *   bun run scripts/build-snapshot.ts  # builds the snapshot from them
 *
 * The snapshot is REAL data, not mock data — it is the offline fallback used
 * whenever the free community endpoints rate-limit (HTTP 429) the deployed app.
 */
import { readFileSync, writeFileSync } from "node:fs";

import { buildWardData, useOsmWays } from "../src/lib/jalniti/pipeline.server";

const read = (p: string) => JSON.parse(readFileSync(p, "utf-8")).elements ?? [];
useOsmWays([...read("/tmp/roads.json"), ...read("/tmp/water.json")]);

const data = await buildWardData({ allowSnapshot: false });
writeFileSync(
  new URL("../src/lib/jalniti/navrangpura.snapshot.json", import.meta.url),
  JSON.stringify(data),
);
console.log("segments:", data.segments.length, "notes:", data.notes);
