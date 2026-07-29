"""
Configuration loading for JalNiti.

Why a YAML file plus a .env instead of constants in code?
  - YAML  -> tunable assumptions a reviewer can read (ward, fleet, thresholds).
  - .env  -> secrets and machine-specific paths that must NOT be committed.

Usage anywhere in the backend:

    from app.config import get_config
    cfg = get_config()
    print(cfg.ward.place_name)
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

# backend/app/config.py -> parents[1] is backend/
BACKEND_DIR = Path(__file__).resolve().parents[1]
CONFIG_PATH = BACKEND_DIR / "config" / "ward_config.yaml"

# Load backend/.env into os.environ if it exists (no-op otherwise).
load_dotenv(BACKEND_DIR / ".env")


@dataclass(frozen=True)
class WardConfig:
    place_name: str
    short_name: str
    metric_crs: str


@dataclass(frozen=True)
class Depot:
    """One simulated pump-truck depot. See ward_config.yaml for the caveat."""

    id: str
    name: str
    lat: float
    lon: float
    trucks: int


@dataclass(frozen=True)
class FleetConfig:
    """SIMULATED fleet. No live municipal fleet data is public in India."""

    truck_count: int
    avg_speed_kmph: float
    service_time_min: int
    shift_minutes: int
    depots: list[Depot]

    def __post_init__(self) -> None:
        # Cheap sanity check so a config typo fails loudly and early rather
        # than producing a silently wrong optimization result later.
        total = sum(d.trucks for d in self.depots)
        if total != self.truck_count:
            raise ValueError(
                f"fleet.truck_count={self.truck_count} but depots sum to {total}. "
                "Fix config/ward_config.yaml."
            )


@dataclass(frozen=True)
class Paths:
    """All paths are resolved to absolute so scripts work from any cwd."""

    raw_dir: Path
    processed_dir: Path
    models_dir: Path
    ground_truth_csv: Path

    def ensure(self) -> None:
        for p in (self.raw_dir, self.processed_dir, self.models_dir):
            p.mkdir(parents=True, exist_ok=True)


@dataclass(frozen=True)
class Config:
    ward: WardConfig
    fleet: FleetConfig
    paths: Paths
    data_sources: dict[str, Any] = field(default_factory=dict)
    cache: dict[str, Any] = field(default_factory=dict)

    # --- secrets / environment (never stored in YAML) ---
    @property
    def ee_project(self) -> str | None:
        return os.getenv("EE_PROJECT") or None

    @property
    def database_url(self) -> str:
        return os.getenv(
            "DATABASE_URL",
            "postgresql+psycopg://postgres:jalniti@localhost:5432/postgres",
        )

    @property
    def imd_api_base(self) -> str:
        return os.getenv("IMD_API_BASE", "https://api.imd.gov.in").rstrip("/")


@lru_cache(maxsize=1)
def get_config(path: Path | None = None) -> Config:
    """Read ward_config.yaml once and cache it for the process lifetime."""
    raw = yaml.safe_load((path or CONFIG_PATH).read_text(encoding="utf-8"))

    ward = WardConfig(**raw["ward"])

    fleet_raw = dict(raw["fleet"])
    depots = [Depot(**d) for d in fleet_raw.pop("depots")]
    fleet = FleetConfig(depots=depots, **fleet_raw)

    p = raw["paths"]
    paths = Paths(
        raw_dir=BACKEND_DIR / p["raw_dir"],
        processed_dir=BACKEND_DIR / p["processed_dir"],
        models_dir=BACKEND_DIR / p["models_dir"],
        ground_truth_csv=BACKEND_DIR / p["ground_truth_csv"],
    )
    paths.ensure()

    return Config(
        ward=ward,
        fleet=fleet,
        paths=paths,
        data_sources=raw.get("data_sources", {}),
        cache=raw.get("cache", {}),
    )
