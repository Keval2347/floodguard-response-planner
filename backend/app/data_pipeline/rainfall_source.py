"""
Rainfall sources (IMD).

Two very different things, both needed:

  1. HISTORICAL, gridded 0.25 deg x 0.25 deg, 1901-2024, from imdpune.gov.in.
     Used to build training rows: "how much rain fell on the day this street
     was reported flooded?". Parsed with the `imddaily` PyPI helper.

  2. LIVE / NOWCAST, from the public api.imd.gov.in endpoints. Used at
     inference time to produce today's risk map.

CAVEAT the team should state in the report: at 0.25 deg (~27 km) a single IMD
grid cell covers ALL of Ahmedabad. So rainfall is a *ward-wide scalar*, not a
per-street feature. It varies the risk map over time, never across space --
the spatial variation comes entirely from terrain and network features.
"""

from __future__ import annotations

import datetime as dt
from pathlib import Path
from typing import Any

import requests

from app.config import get_config
from app.data_pipeline.cache import cache_path, cached_json, live_ttl, static_ttl, is_fresh


def fetch_historical_rainfall(refresh: bool = False) -> Path | None:
    """
    Download IMD gridded daily rainfall for the configured window and save a
    tidy CSV of (date, rainfall_mm) for the Ahmedabad grid cell.

    Returns the CSV path, or None if imddaily is unavailable / download fails.
    """
    cfg = get_config()
    rain_cfg = cfg.data_sources["rainfall"]
    dest = cache_path("rainfall_history", ".csv")

    if not refresh and is_fresh(dest, static_ttl()):
        print(f"  [cache hit ] {dest.name}")
        return dest

    try:
        import pandas as pd
        from imddaily import get_data
    except ImportError:
        print("  [skip] `imddaily` not installed -- skipping historical rainfall.")
        return None

    # imddaily downloads IMD's binary/NetCDF files into a folder, then exposes
    # them as an xarray dataset. We keep the downloads inside our raw cache.
    scratch = cfg.paths.raw_dir / "imd_raw"
    scratch.mkdir(parents=True, exist_ok=True)

    start = dt.date.fromisoformat(rain_cfg["history_start"])
    end = dt.date.fromisoformat(rain_cfg["history_end"])

    try:
        # 'rain' is imddaily's code for the 0.25 deg gridded rainfall product.
        data = get_data("rain", start, end, str(scratch))
        ds = data.to_xarray()

        # Ward centroid -> nearest IMD grid cell. At 27 km resolution the
        # whole ward falls in one cell; .sel(method="nearest") picks it.
        from app.data_pipeline.osm_source import fetch_boundary

        centroid = fetch_boundary().to_crs("EPSG:4326").geometry.iloc[0].centroid
        cell = ds.sel(lat=centroid.y, lon=centroid.x, method="nearest")

        df = cell.to_dataframe().reset_index()[["time", "rain"]]
        df.columns = ["date", "rainfall_mm"]
        df.to_csv(dest, index=False)
        print(f"  [cached     ] {dest.name} ({len(df)} days)")
        return dest
    except Exception as exc:
        # IMD's servers are frequently down or slow. Don't kill the pipeline.
        print(f"  [warn] historical rainfall download failed: {exc}")
        return None


def fetch_live_rainfall(refresh: bool = False) -> dict[str, Any] | None:
    """
    Current district rainfall + nowcast from api.imd.gov.in.

    ASSUMPTION: these endpoints are open and unauthenticated today. They are
    undocumented and change without notice -- if one 404s, the pipeline logs it
    and continues with `None`, and the risk model falls back to the rainfall
    value passed in by the what-if simulator (module 3).
    """
    cfg = get_config()
    district = cfg.data_sources["rainfall"]["live_district"]

    def _call() -> dict[str, Any]:
        base = cfg.imd_api_base
        out: dict[str, Any] = {
            "district": district,
            "fetched_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        }
        endpoints = {
            "district_rainfall": f"{base}/districtwise_rainfall_api.php",
            "nowcast": f"{base}/nowcastapi.php",
        }
        for key, url in endpoints.items():
            try:
                resp = requests.get(url, timeout=20)
                resp.raise_for_status()
                out[key] = resp.json()
            except Exception as exc:
                out[key] = {"error": str(exc)}
        return out

    try:
        return cached_json("rainfall_live", live_ttl(), _call, refresh)
    except Exception as exc:
        print(f"  [warn] live rainfall unavailable: {exc}")
        return None
