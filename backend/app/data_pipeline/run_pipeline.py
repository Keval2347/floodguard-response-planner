"""
STEP (a) entrypoint -- fetch and cache every external dataset for one ward.

    python -m app.data_pipeline.run_pipeline
    python -m app.data_pipeline.run_pipeline --refresh
    python -m app.data_pipeline.run_pipeline --ward "Vasna, Ahmedabad, Gujarat, India"

Run this from the `backend/` directory with the venv active.

It is intentionally tolerant: if Earth Engine isn't set up yet, or IMD's
server is down, the OSM half still succeeds and the summary tells you exactly
what is missing. You should not be blocked on a GEE registration email.
"""

from __future__ import annotations

import argparse
import dataclasses

from app.config import get_config
from app.data_pipeline import dem_source, osm_source, rainfall_source


def main() -> int:
    parser = argparse.ArgumentParser(description="JalNiti data pipeline (step a)")
    parser.add_argument("--refresh", action="store_true", help="ignore cache, re-fetch everything")
    parser.add_argument("--ward", help="override the ward place_name from ward_config.yaml")
    args = parser.parse_args()

    cfg = get_config()
    if args.ward:
        # dataclasses are frozen, so build a modified copy rather than mutate.
        object.__setattr__(cfg, "ward", dataclasses.replace(cfg.ward, place_name=args.ward))

    print("=" * 68)
    print(f"JalNiti data pipeline  |  ward: {cfg.ward.place_name}")
    print(f"cache dir: {cfg.paths.raw_dir}")
    print("=" * 68)

    summary: dict[str, str] = {}

    print("\n[1/4] Ward boundary + street network (OpenStreetMap / osmnx)")
    boundary = osm_source.fetch_boundary(args.refresh)
    roads = osm_source.fetch_roads(args.refresh)
    summary["boundary"] = f"ok ({len(boundary)} polygon)"
    summary["roads"] = f"ok ({len(roads)} street segments)"

    print("\n[2/4] Waterways and water bodies (OpenStreetMap / osmnx)")
    water = osm_source.fetch_water(args.refresh)
    summary["water"] = f"ok ({len(water)} features)"

    print("\n[3/4] Elevation, SRTM 30 m (Google Earth Engine)")
    dem = dem_source.fetch_dem(args.refresh)
    summary["dem"] = f"ok -> {dem.name}" if dem else "SKIPPED (see message above)"

    print("\n[4/4] Rainfall (IMD historical grid + live nowcast)")
    hist = rainfall_source.fetch_historical_rainfall(args.refresh)
    live = rainfall_source.fetch_live_rainfall(args.refresh)
    summary["rainfall_history"] = f"ok -> {hist.name}" if hist else "SKIPPED"
    summary["rainfall_live"] = "ok" if live else "SKIPPED"

    print("\n" + "=" * 68)
    print("SUMMARY")
    for key, value in summary.items():
        print(f"  {key:<18} {value}")
    print("=" * 68)

    if summary["dem"].startswith("SKIPPED"):
        print(
            "\nNote: step (b) needs the DEM for slope. Finish the Earth Engine\n"
            "setup in backend/README.md before moving on."
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
