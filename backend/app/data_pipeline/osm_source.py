"""
OpenStreetMap source: the street segments we will score, plus the water
features we measure distance to.

Why OSM? It is the only free, complete, per-street network for an Indian ward.
Fetched with osmnx, which wraps the Overpass API.

IMPORTANT: Overpass is rate-limited and can take 30-60s for a ward. Everything
here is cached to GeoPackage files in backend/data/raw/. Delete those files (or
pass --refresh) to force a re-download.
"""

from __future__ import annotations

from pathlib import Path

import geopandas as gpd
import osmnx as ox

from app.config import get_config
from app.data_pipeline.cache import cached_file, static_ttl

# osmnx has its own on-disk cache for raw Overpass responses. Turning it on
# means even a --refresh of our GeoPackages may reuse the HTTP response.
ox.settings.use_cache = True
ox.settings.log_console = False


def _write_boundary(dest: Path) -> None:
    cfg = get_config()
    gdf = ox.geocode_to_gdf(cfg.ward.place_name)
    gdf.to_file(dest, driver="GPKG")


def _write_roads(dest: Path) -> None:
    cfg = get_config()
    net_type = cfg.data_sources["osm"]["network_type"]

    # graph_from_place gives a routable directed graph (nodes = junctions,
    # edges = street segments). We need BOTH:
    #   - edges  -> the units we score for flood risk (module 1)
    #   - graph  -> travel times between depots and segments (module 2)
    graph = ox.graph_from_place(cfg.ward.place_name, network_type=net_type)

    # Project to metres so lengths/distances are meaningful.
    graph = ox.project_graph(graph, to_crs=cfg.ward.metric_crs)
    nodes, edges = ox.graph_to_gdfs(graph)

    # A stable id per street segment. Everything downstream (features, risk
    # scores, truck assignments, the map) joins on this column.
    edges = edges.reset_index()
    edges["segment_id"] = [f"S{i:05d}" for i in range(len(edges))]

    # OSM columns are often lists (a way can carry several names/highway tags).
    # GeoPackage cannot store lists, so flatten them to strings.
    for col in edges.columns:
        if col == "geometry":
            continue
        edges[col] = edges[col].map(lambda v: ", ".join(map(str, v)) if isinstance(v, list) else v)

    edges.to_file(dest, driver="GPKG", layer="edges")
    nodes.reset_index().to_file(dest, driver="GPKG", layer="nodes")


def _write_water(dest: Path) -> None:
    cfg = get_config()
    tags = cfg.data_sources["osm"]["water_tags"]
    water = ox.features_from_place(cfg.ward.place_name, tags=tags)

    # features_from_place returns points/lines/polygons mixed together; keep
    # everything, we only need distance-to-nearest in step (b).
    water = water.to_crs(cfg.ward.metric_crs)
    water = water[["geometry"]].reset_index(drop=True)
    water.to_file(dest, driver="GPKG")


def fetch_boundary(refresh: bool = False) -> gpd.GeoDataFrame:
    """Ward polygon (WGS84). Used to clip the DEM and to centre the map."""
    p = cached_file("boundary", ".gpkg", static_ttl(), _write_boundary, refresh)
    return gpd.read_file(p)


def fetch_roads(refresh: bool = False) -> gpd.GeoDataFrame:
    """Street segments, projected to the metric CRS, with a `segment_id`."""
    p = cached_file("roads", ".gpkg", static_ttl(), _write_roads, refresh)
    return gpd.read_file(p, layer="edges")


def fetch_water(refresh: bool = False) -> gpd.GeoDataFrame:
    """Rivers, canals, drains and water bodies in / near the ward."""
    p = cached_file("water", ".gpkg", static_ttl(), _write_water, refresh)
    return gpd.read_file(p)
