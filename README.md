# Flood Response Planner

JalNiti — Build Prompt for AI Coding Assistant

Context

This is a Semester 5 B.Tech Capstone Project (India), built by a 2-3 person student team over one semester (~15 weeks, ~40 supervised hours). The team is learning FastAPI, PostGIS, and OR-Tools as they go — code should be clean, well-commented, and educational, not over-engineered. Prioritize working incremental milestones over premature polish.

What JalNiti Is (and isn't)

JalNiti is a municipal flood decision-support system for one ward/locality in Ahmedabad, Gujarat. It is explicitly NOT a flood-prediction system — Google Flood Hub and IMD already do city/region-scale flood forecasting. JalNiti's job starts AFTER a flood risk is known: it turns that risk into an actionable resource deployment plan for a municipal corporation.

Elevator pitch to keep in mind while building: "Google Flood Hub tells you WHERE flooding is likely. JalNiti tells you WHAT TO DO about it — which street segments are highest risk, and how to allocate limited pump-truck resources across them, with a what-if simulator for testing scenarios."

Scope — exactly 3 modules, nothing more

Do not add traffic rerouting, hospital/school alerts, or citizen notification features — these are explicitly FUTURE SCOPE, not part of this build. Keep the system to these three:

    1. Risk Classification Layer — predicts a per-street-segment flood risk score for one chosen ward, using real public data (see Data Sources below).

    2. Resource Allocation Optimizer — given risk scores and a SIMULATED pump-truck fleet (documented as an assumption — live municipal fleet data isn't publicly available in India), recommends which trucks go where first. This is a genuine optimization problem, not a machine-learning problem — use a real solver.

    3. What-If Scenario Simulator — lets a user change an input (e.g., "Truck 2 is delayed by 20 minutes," "rainfall is 30% higher than forecast") and re-runs modules 1+2 to show the updated plan. This is the project's key differentiator.

Data Sources (all verified real and accessible — use these exactly)

    • Elevation: SRTM 30m DEM via Google Earth Engine — ee.Image("USGS/SRTMGL1_003"), band name elevation. Requires free Earth Engine registration + a linked GCP project.

    • Roads/water network: OpenStreetMap via the osmnx Python library (ox.graph_from_place(), ox.features_from_place()). Cache results locally — do not re-fetch from the live Overpass API on every run, it's slow and rate-limited.

    • Rainfall (historical): IMD gridded rainfall, 0.25°×0.25°, 1901-2024, from imdpune.gov.in (NetCDF/binary format). There's a PyPI helper package imddaily for parsing this.

    • Rainfall (live/nowcast): IMD public API at api.imd.gov.in (e.g. district rainfall, district nowcast endpoints).

    • Ground truth for validation: NO reliable public bulk dataset of historical waterlogging complaints exists in India (verified — municipal grievance portals are individual-complaint lookup tools, not open datasets). Ground truth will come from: (a) an RTI request to the municipal corporation (may not resolve in time), (b) local news archive mining for reported flooded streets/areas, (c) manual small-scale resident interviews for the one chosen ward. Build the pipeline to accept ground truth from a simple CSV (street/location + flooded: yes/no + date) so any of these sources can feed it.

    • Also worth checking: NRSC/Bhuvan's "Bhuvan-Flood" layer (bhuvan.nrsc.gov.in) for any historic flood event data covering Gujarat — free registration required.

Tech Stack (use exactly this — team is deliberately learning these)

    • Backend: FastAPI (Python)

    • Database: PostgreSQL + PostGIS extension (for geospatial queries)

    • ML (risk classification): scikit-learn (Logistic Regression or Random Forest) or XGBoost — NOT deep learning. Dataset will be small (ward-scale, dozens-hundreds of points), so simple, explainable models are the correct choice, not a limitation.

    • Optimization (resource allocation): Google OR-Tools — use linear programming or constraint programming, NOT a hand-rolled heuristic or greedy algorithm.

    • Geospatial processing: geopandas, rasterio, shapely, osmnx

    • Frontend: React + Leaflet.js (lightweight map rendering, color-coded risk overlay)

    • Version control: Git/GitHub from day one

What I need from you

    1. Propose a clean project folder structure (backend/frontend separation, clear module boundaries matching the 3 modules above).

    2. Build incrementally, in this order, confirming each stage works before moving on: a. Data pipeline (fetch + cache OSM + DEM + rainfall for one configurable ward name) b. Feature engineering (slope from elevation, distance-to-water, road density per street segment) c. Risk classification model (trainable on a CSV of ground-truth labels I'll provide; must run even with a very small/synthetic dataset for now) d. Resource allocation optimizer (OR-Tools, operating on simulated truck fleet data — accept a simple config for number of trucks, depot locations, speeds) e. What-if simulator (parameter override on top of a+b+c+d) f. FastAPI endpoints exposing all of the above g. React + Leaflet frontend consuming those endpoints

    3. Comment code clearly enough that a learning student can understand and modify it, not just run it as a black box.

    4. Flag any assumption you make explicitly (e.g., "I'm assuming 5 depot locations for the simulated fleet — adjust as needed") rather than silently picking values.

    5. Keep performance in mind — cache external API calls to disk, don't re-fetch the same data on every run.

What NOT to do

    • Don't build features beyond the 3 modules listed above.

    • Don't use deep learning for the risk model — dataset is too small, and simple models are more defensible to evaluators here.

    • Don't assume live municipal fleet/drain-sensor data is available — it isn't, simulate it and say so clearly in code comments.

    • Don't over-architect (no microservices, no Kubernetes, no unnecessary complexity) — this is a semester capstone, not a production system.

Start with step 1 (project structure + data pipeline) and confirm it works before moving to the next step.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://floodguard-response-planner.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/b7f58749-330a-4908-8f2b-047461ed63fe).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
