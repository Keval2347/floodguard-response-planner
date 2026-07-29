"""
Elevation source: SRTM 30 m DEM via Google Earth Engine.

    ee.Image("USGS/SRTMGL1_003")  ->  band "elevation" (metres above sea level)

Water flows downhill, so elevation (and the slope derived from it in step b)
is the single most predictive terrain feature for urban waterlogging.

SETUP REQUIRED (free, one-time):
    1. Register at https://signup.earthengine.google.com/
    2. Link a Google Cloud project.
    3. Run `earthengine authenticate` in this venv.
    4. Put the GCP project id in backend/.env as EE_PROJECT.

If EE is not configured, fetch_dem() returns None and prints why, instead of
crashing -- so you can keep developing the OSM half of the pipeline.
"""

from __future__ import annotations

import urllib.request
from pathlib import Path

from app.config import get_config
from app.data_pipeline.cache import cached_file, static_ttl

_EE_READY = False


def _init_ee() -> bool:
    """Initialise Earth Engine once. Returns False if unavailable."""
    global _EE_READY
    if _EE_READY:
        return True

    cfg = get_config()
    if not cfg.ee_project:
        print("  [skip] EE_PROJECT not set in backend/.env -- skipping DEM.")
        return False
    try:
        import ee

        ee.Initialize(project=cfg.ee_project)
        _EE_READY = True
        return True
    except ImportError:
        print("  [skip] earthengine-api not installed -- skipping DEM.")
    except Exception as exc:  # not authenticated, no network, bad project id
        print(f"  [skip] Earth Engine init failed ({exc}). Run `earthengine authenticate`.")
    return False


def _write_dem(dest: Path) -> None:
    """
    Download the ward's DEM as a GeoTIFF.

    We use getDownloadURL rather than an Export-to-Drive task because a single
    ward is tiny (a few hundred KB) and this keeps the pipeline synchronous.
    Earth Engine caps direct downloads at ~32 MB -- fine at ward scale, would
    break for a whole city.
    """
    import ee

    from app.data_pipeline.osm_source import fetch_boundary

    cfg = get_config()
    dem_cfg = cfg.data_sources["dem"]

    # Ward polygon in WGS84, buffered so slope at the boundary is computed
    # from real neighbours rather than nodata.
    boundary = fetch_boundary().to_crs(cfg.ward.metric_crs)
    buffered = boundary.buffer(dem_cfg["buffer_m"]).to_crs("EPSG:4326")
    minx, miny, maxx, maxy = buffered.total_bounds
    region = ee.Geometry.Rectangle([minx, miny, maxx, maxy])

    image = ee.Image(dem_cfg["ee_image_id"]).select(dem_cfg["band"]).clip(region)
    url = image.getDownloadURL(
        {
            "scale": dem_cfg["scale_m"],
            "region": region,
            "format": "GEO_TIFF",
            "crs": "EPSG:4326",
        }
    )
    urllib.request.urlretrieve(url, dest)


def fetch_dem(refresh: bool = False) -> Path | None:
    """Path to the cached ward DEM GeoTIFF, or None if EE is unavailable."""
    if not _init_ee():
        return None
    return cached_file("dem", ".tif", static_ttl(), _write_dem, refresh)
