# JalNiti: Ward Flood Response Console

JalNiti is a ward-level **flood decision-support tool**. It does not forecast floods. It starts from a rainfall signal and turns it into an action plan: which streets are most at risk, where simulated pump trucks should go first, and what changes if the officer changes the assumptions.

Pilot ward: **Navrangpura, Ahmedabad**. Capstone Project I, GLS University (B.Tech CS&E, Semester V).


## What it does

| Module | What you see | How it works |
|---|---|---|
| Risk scoring | Street segments coloured low / moderate / high / critical | Transparent rule-based score from elevation, slope, distance to water, road density and rainfall (not a trained ML model) |
| Resource allocation | Truck routes and a coverage figure compared with a greedy baseline | Team-orienteering routing: value-density insertion, then 2-opt and relocate local search, under travel-time and shift limits. Deterministic |
| What-if simulation | Controls for rainfall, drains cleared, streets excluded from pumping, trucks, shift length | Re-runs scoring and allocation with the changed inputs |
| Hospital access | Hospitals flagged clear / watch / at-risk / cut-off | Hospitals joined to the risk of their approach roads |

## Data sources

| Data | Source |
|---|---|
| Roads and waterways | OpenStreetMap via Overpass (several mirrors) |
| Elevation and slope | SRTM through OpenTopoData (GMTED2010 as fallback) |
| Travel times and routes | OSRM |
| Rainfall | Open-Meteo, with MET Norway as backup |
| Hospitals | OpenStreetMap |

If a public endpoint is rate-limited or down, the app replays a committed snapshot of real data (`src/lib/jalniti/navrangpura.snapshot.json`) and says so on screen. Stale rainfall is flagged, never shown as fresh.

## What is real and what is simulated

- **Real public data:** streets, terrain, rainfall, travel times, hospital records.
- **Simulated assumptions:** depot locations and the number of pump trucks. Live municipal fleet data is not public.
- "Observed" rainfall is model-estimated, not from rain gauges.
- Risk weights are hand-set and have **not** been validated against a labelled flood dataset yet.

## Tech stack

TanStack Start, React and TypeScript, Leaflet maps, Zod input validation, URL allow-list for outbound requests.
The `backend/` folder holds an earlier Python data-pipeline prototype and is not used by the deployed app.

## Run locally

```bash
git clone <this-repository-url>
cd <repository-name>
npm install
npm run dev        # starts the dev server
```

Copy `.env.example` to `.env` if you want to set optional values. No API key is required.
To regenerate the offline snapshot, see `scripts/build-snapshot.ts`.

## Security

Inputs are validated with Zod, outbound requests are limited to approved hosts, and user-facing errors are generic while details are logged on the server. See `SECURITY-REVIEW.md`.

## Authors

Keval Dhorajiya and Anjali Singh. Guide: Dr. Yesha Patel, GLS University.
