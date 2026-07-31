/**
 * Regenerates src/lib/jalniti/navrangpura.snapshot.json from the live public
 * datasets (OSM Overpass, SRTM via OpenTopoData, OSRM). Run locally:
 *   bun run scripts/build-snapshot.ts
 * The snapshot is REAL data — it is the offline fallback used whenever the free
 * community endpoints rate-limit (HTTP 429) the deployed app.
 */
import { writeFileSync } from "node:fs";
import { buildWardData } from "../src/lib/jalniti/pipeline.server";

const data = await buildWardData({ allowSnapshot: false });
writeFileSync(
  new URL("../src/lib/jalniti/navrangpura.snapshot.json", import.meta.url),
  JSON.stringify(data, null, 1),
);
console.log("segments:", data.segments.length, "notes:", data.notes);
