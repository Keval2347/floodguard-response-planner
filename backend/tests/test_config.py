"""
Smoke tests for step (a). Run with:  pytest -q

These need no network and no Earth Engine account -- they only check that the
config loads and that the assumptions in ward_config.yaml are self-consistent.
"""

from app.config import get_config


def test_config_loads():
    cfg = get_config()
    assert "Ahmedabad" in cfg.ward.place_name
    assert cfg.ward.metric_crs.startswith("EPSG:")


def test_fleet_assumptions_are_consistent():
    """Depot truck counts must add up to fleet.truck_count."""
    cfg = get_config()
    assert cfg.fleet.truck_count == 10
    assert len(cfg.fleet.depots) == 3
    assert sum(d.trucks for d in cfg.fleet.depots) == cfg.fleet.truck_count


def test_paths_are_created():
    cfg = get_config()
    assert cfg.paths.raw_dir.exists()
    assert cfg.paths.processed_dir.exists()
