# JalNiti — Backend

Municipal flood **decision-support** system for one ward in Ahmedabad.
Not a flood *prediction* system: it starts where Google Flood Hub / IMD stop.

```
Risk known  ->  [1] per-street risk  ->  [2] allocate pump trucks  ->  [3] what-if
```

## Folder structure (whole repo)

```
jalniti/
├── backend/
│   ├── app/
│   │   ├── config.py                 # loads config/ward_config.yaml, all assumptions live there
│   │   ├── data_pipeline/            # STEP (a) -- you are here
│   │   │   ├── cache.py              # disk cache helpers (never re-fetch the same thing)
│   │   │   ├── osm_source.py         # roads + waterways via osmnx
│   │   │   ├── dem_source.py         # SRTM 30m elevation via Google Earth Engine
│   │   │   ├── rainfall_source.py    # IMD historical (imddaily) + live nowcast API
│   │   │   └── run_pipeline.py       # CLI entrypoint: fetch + cache everything
│   │   ├── features/                 # STEP (b) slope, dist-to-water, road density
│   │   ├── risk/                     # STEP (c) sklearn model (module 1)
│   │   ├── allocation/               # STEP (d) OR-Tools optimizer (module 2)
│   │   ├── simulator/                # STEP (e) what-if overrides (module 3)
│   │   ├── db/                       # PostGIS engine + table definitions
│   │   └── api/                      # STEP (f) FastAPI routers
│   ├── config/ward_config.yaml       # ward name, fleet assumptions, paths
│   ├── data/                         # gitignored cache: raw/ + processed/
│   ├── tests/
│   └── requirements.txt
└── frontend/                         # STEP (g) React + Leaflet (built in this Lovable app)
```

Module boundaries map 1:1 to the three project modules. Nothing else gets added:
no traffic rerouting, no hospital alerts, no citizen notifications (future scope).

## Setup

```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env      # then fill in your Earth Engine project id
```

### Google Earth Engine (one-time, free)

1. Register at https://signup.earthengine.google.com/
2. Create / link a Google Cloud project.
3. `earthengine authenticate` (opens a browser, stores a token in `~/.config/earthengine`).
4. Put the GCP project id in `.env` as `EE_PROJECT`.

If you skip this, the pipeline still runs — it just reports the DEM step as
`skipped` instead of crashing, so steps (b)+ can be developed with OSM only.

### PostGIS (needed from step b onward, not for step a)

```bash
docker run --name jalniti-db -e POSTGRES_PASSWORD=jalniti \
  -p 5432:5432 -d postgis/postgis:16-3.4
```

## Run the data pipeline

```bash
python -m app.data_pipeline.run_pipeline            # uses ward from config
python -m app.data_pipeline.run_pipeline --refresh  # ignore cache, re-fetch
python -m app.data_pipeline.run_pipeline --ward "Vasna, Ahmedabad, Gujarat, India"
```

Everything lands in `backend/data/raw/` and is reused on the next run.

## Assumptions flagged in this scaffold

| Assumption | Where | Change it |
| --- | --- | --- |
| Ward = Navrangpura, Ahmedabad | `config/ward_config.yaml` | edit `ward.place_name` |
| 10 pump trucks, 3 depots, 25 km/h | same file | edit `fleet:` |
| Depot coordinates are made up | same file | replace with real AMC depot lat/lons |
| No live municipal fleet feed exists in India | `allocation/` (step d) | simulated, documented |
| Ground truth arrives as a CSV you supply | `config/ground_truth.csv` | RTI / news mining / interviews |
