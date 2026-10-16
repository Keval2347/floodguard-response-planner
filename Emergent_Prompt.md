# Task for Emergent: targeted accuracy and routing improvements to JalNiti

Repository: https://github.com/Keval2347/floodguard-response-planner (branch `main`)
Stack: TanStack Start + React + TypeScript, server functions in `src/lib/jalniti/live.functions.ts`,
data pipeline in `src/lib/jalniti/pipeline.server.ts`, risk + allocation in `src/lib/jalniti/model.ts`,
Zod validation in `src/lib/jalniti/schema.ts`, dashboard in `src/routes/index.tsx`.
Do NOT touch the `backend/` Python folder.

## What JalNiti is (so you understand the intent)
A ward-level flood DECISION-SUPPORT tool for Navrangpura, Ahmedabad. It does not predict floods from scratch.
It takes a rainfall signal, scores street segments for waterlogging risk, plans simulated pump-truck
deployment (deterministic optimizer in `allocate()`), and lets an officer run what-if scenarios.
It is a university capstone, so HONESTY matters more than impressive-looking numbers: anything simulated or
assumed must be labelled as such, and no accuracy claim may be shown unless it was actually computed.

## Already working: DO NOT break or rewrite
- `allocate()` (insertion + 2-opt/relocate local search, greedy baseline comparison). It is deterministic. Leave the algorithm alone.
- Snapshot replay fallback for OSM / SRTM / OSRM / hospitals, and the in-memory cache TTLs.
- Rainfall provider chain (Open-Meteo hosts, then MET Norway) and the stale-reading flags. Keep `stale` / `staleReason` behaviour.
- Security hardening: Zod validation (`parseStrict`), URL allow-list (`ALLOWED_HOSTS`), generic user-facing error messages with
  details logged server-side as `[JalNiti] ...`. Do not weaken any of it. Segment IDs are `S01` to `S337` and the pattern is `^S\d{2,5}$`.
- Existing UI layout, map layers, hospital access assessment.

## Global rules
- Only add a new external host if truly required, and then add it to `ALLOWED_HOSTS`. No paid APIs, no API keys committed.
- Never present synthetic or assumed data as measured. Label assumptions in the UI (Data/legend panel) and in code comments.
- Keep changes small and backwards compatible (existing snapshot JSON must still load; new fields optional with safe defaults).
- Update `docs/` or the Data Dictionary entries for every new field.
- Add tests (use the repo's test setup, or vitest if none) including cases with 3-digit segment IDs such as `S150`, `S337`.
- Run the production build and tests before finishing. Work task by task and summarise after each. Ask me before any large refactor.

## Task 1 (highest priority): validation / backtest harness
Problem: risk weights are hand-set and `backend/config/ground_truth.csv` has only 3 rows, so accuracy cannot be defended.
Do:
1. Move ground truth to a data file the app can read (CSV or JSON) with columns:
   `location, lat, lon, flooded (yes/no), date, source`. I will add more rows myself, so adding rows must need NO code change.
2. For each distinct event date, fetch the real historical hourly rainfall for the ward centre from the Open-Meteo archive API
   (server-side only; add `archive-api.open-meteo.com` to `ALLOWED_HOSTS`; cache results; handle failures with generic errors).
3. For each labelled point, find the nearest scored segment (report points that have no segment within a stated distance, do not guess).
   Run `scoreSegments` with that event's rainfall and report: number of labelled points used, how many `flooded=yes` points fall in the
   High/Critical bands, how many `flooded=no` points are wrongly High/Critical, and ROC-AUC (simple implementation, no heavy library).
4. Expose it as `npm run validate` (prints a table) and a small read-only "Validation" section in the UI that always shows n and the
   limitation text "small sample, indicative only" when n < 30.
5. Do NOT retune weights automatically. If n >= 30 you may add an offline script that fits a logistic regression and prints suggested
   coefficients; applying them is my decision.

Acceptance: running `npm run validate` works with the current 3 rows and with extra rows I add; no fabricated labels.

## Task 2: rainfall INTENSITY, not just the 24 h total
Problem: urban flooding is driven by short intense bursts (mm per 1 to 3 hours), but the risk curve uses only 24 h rainfall, so 40 mm in
one hour and 40 mm spread over a day produce identical risk. Hourly and 15-minute data are already fetched.
Do:
1. In `parseOpenMeteo` (and the IMD / MET Norway paths where possible) compute `peak1hMm` and `peak3hMm` (highest rolling 1 h / 3 h total
   over the observed window plus the next-hours nowcast). Add them as OPTIONAL fields on the rain DTO. Remember Open-Meteo hourly
   precipitation at time T is the total of the PRECEDING hour.
2. Add an optional `rain3hMm` to `ScenarioOverrides` (schema: number 0 to 300, `.strict()` stays) and a matching what-if control.
3. Effective rain index for scoring = the larger of the 24 h curve and a 3 h curve, using a new constant `reference_rain_3h_mm` in
   `data.ts`. Pick a documented placeholder, mark it clearly as an ASSUMPTION to be tuned with the Task 1 backtest, and show it in the UI.
4. A dry day must still be all Low. Old snapshots without the new fields must still work (derive from `rainSeries` or default to 0).

Acceptance: a synthetic test with 40 mm in 1 hour scores higher than 40 mm spread over 24 h; dry input gives all Low.

## Task 3: better terrain features (verify with Task 1, keep only if not worse)
Problem: ward elevation is min-max normalised, SRTM 30 m has metre-scale vertical error, and slope is computed from three samples over
~320 m streets, so slope is largely noise. 26% of streets sit at the 1500 m water-distance cap, so that term saturates for a quarter of them.
Do:
1. Add `rel_elev_m` to `StreetSegment`: segment elevation minus the mean elevation of segments within ~400 m (local low spots).
   Computed from data already fetched, so no new API.
2. Offer a selectable scoring variant (constant) that replaces the absolute-elevation term with `rel_elev_m`. Keep the current formula available.
3. Make `npm run validate` print AUC for both variants side by side. Switch the default only if the new one is not worse, and say so in
   the notes. Regenerate `navrangpura.snapshot.json` so the offline demo contains the new field.
4. Do not change weights or the water-distance cap without validation evidence.

## Task 4: routes must respect closed roads
Problem: `closed` currently only removes a street from the pumping targets (`model.ts`). `fetchRouteGeometry` routes between two points
with no knowledge of closures, so a displayed truck route can pass straight through a road the officer marked closed.
Do:
1. Request OSRM routes with `alternatives=true`. Pass the closed segment IDs (and their paths) with each request.
2. Choose the first alternative that does not intersect any closed segment. If none exists, return the best route flagged with
   `crossesClosed: string[]`, and draw it in a warning style with a tooltip such as "route crosses closed road X".
3. Include the closed-set hash in the cache key. Keep the 20-pair cap and extend the Zod schema strictly (IDs `^S\d{2,5}$`, max 1000).
4. Add a visible note in the Data/legend panel: "Travel times are free-flow OSRM measurements; flooded-road slowdowns are not modelled."
   Do not invent speed penalties.
5. If this proves too complex with the public OSRM server, fall back to renaming the UI control to "Excluded from pumping" so the label
   matches what the code does, and tell me.

Acceptance: closing a street on the planned path changes the drawn route or shows the warning; closing an unrelated street changes nothing.

## Task 5 (optional, only after 1 to 4 pass)
A one-click "Plan for forecast" preset in the what-if panel that sets rainfall from the 24 h forecast total and its peak 3 h value,
clearly labelled as forecast-based. The live map must keep using observed rainfall.

## Deliverable
For each task: files changed, new fields added, tests added, how to run them, and any known limitation. Do not claim improved accuracy
unless `npm run validate` shows it.
