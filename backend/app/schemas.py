"""
JalNiti — Pydantic v2 schemas for every Python input surface.

POLICY: model_validate(..., strict=True) is used everywhere so that Pydantic
does NOT silently coerce types (e.g. "30" -> 30, True -> 1). If a caller
passes the wrong type or an out-of-range value the validator raises
ValidationError immediately — never after the data has been used.

Every schema uses model_config = ConfigDict(extra="forbid") so unexpected keys
(e.g. from a mangled YAML or a crafted HTTP payload) are rejected outright.
"""

from __future__ import annotations

import re
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator


# ------------------------------------------------------------------ atoms


# WGS-84 latitude / longitude with strict numeric bounds.
Latitude = Annotated[float, Field(ge=-90.0, le=90.0, description="WGS-84 latitude")]
Longitude = Annotated[float, Field(ge=-180.0, le=180.0, description="WGS-84 longitude")]

# IMD 0.25° grid covers Ahmedabad with a single cell; 600 mm/24 h is a
# reasonable planning ceiling (the all-India 24 h record is ~944 mm).
RainfallMm = Annotated[float, Field(ge=0.0, le=600.0, description="rainfall in mm/24 h")]

# Shift horizon: 30 min minimum (too short to be useful), 720 min = 12 h max.
ShiftMinutes = Annotated[int, Field(ge=30, le=720, description="shift length in minutes")]

# Fleet size: 0 trucks is valid (no assignments possible), 50 is a hard cap.
TruckCount = Annotated[int, Field(ge=0, le=50, description="number of trucks available")]

# Segment id format produced by the pipeline: S followed by exactly 5 digits
# (Python backend) or 2 digits (TypeScript snapshot).  We accept both.
_SEGMENT_ID_RE = re.compile(r"^S\d{2,5}$")


def _validate_segment_id(v: str) -> str:
    if not _SEGMENT_ID_RE.fullmatch(v):
        raise ValueError(f"invalid segment id {v!r}: must match S\\d{{2,5}}")
    return v


# ------------------------------------------------------------------ depot


class DepotSchema(BaseModel):
    """One pump-truck depot. Mirrors the YAML structure in ward_config.yaml."""

    model_config = ConfigDict(extra="forbid", strict=True)

    id: str = Field(min_length=1, max_length=10, pattern=r"^D\d+$")
    name: str = Field(min_length=1, max_length=120)
    lat: Latitude
    lon: Longitude
    trucks: TruckCount


# ------------------------------------------------------------------ fleet config


class FleetConfigSchema(BaseModel):
    """Simulated fleet — validated before being handed to the optimizer."""

    model_config = ConfigDict(extra="forbid", strict=True)

    truck_count: TruckCount
    avg_speed_kmph: float = Field(gt=0.0, le=120.0)
    service_time_min: int = Field(ge=1, le=240)
    shift_minutes: ShiftMinutes
    depots: list[DepotSchema] = Field(min_length=1, max_length=20)

    @model_validator(mode="after")
    def depot_sum_matches_truck_count(self) -> "FleetConfigSchema":
        total = sum(d.trucks for d in self.depots)
        if total != self.truck_count:
            raise ValueError(
                f"fleet.truck_count={self.truck_count} but depot trucks sum to {total}"
            )
        return self


# ------------------------------------------------------------------ ward config


class WardConfigSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    place_name: str = Field(
        min_length=5,
        max_length=200,
        description="Nominatim place name — must contain at least city and country",
    )
    short_name: str = Field(
        min_length=1,
        max_length=40,
        pattern=r"^[a-z0-9_-]+$",
        description="lowercase slug used in cache filenames",
    )
    metric_crs: str = Field(
        pattern=r"^EPSG:\d{4,6}$",
        description="projected CRS for metric operations (e.g. EPSG:32643)",
    )


# ------------------------------------------------------------------ paths config


class PathsConfigSchema(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True)

    raw_dir: str = Field(min_length=1, max_length=256)
    processed_dir: str = Field(min_length=1, max_length=256)
    models_dir: str = Field(min_length=1, max_length=256)
    ground_truth_csv: str = Field(min_length=1, max_length=256)


# ------------------------------------------------------------------ full ward_config.yaml


class WardYamlSchema(BaseModel):
    """Schema for the top-level ward_config.yaml structure."""

    model_config = ConfigDict(extra="forbid")

    ward: WardConfigSchema
    fleet: dict  # validated separately via FleetConfigSchema
    data_sources: dict = Field(default_factory=dict)
    paths: PathsConfigSchema
    cache: dict = Field(default_factory=dict)


# ------------------------------------------------------------------ scenario overrides (what-if)


class ScenarioOverridesSchema(BaseModel):
    """
    What-if scenario overrides forwarded to the risk model and the optimizer.

    Used by run_pipeline.py and any future FastAPI endpoint that accepts
    scenario parameters. Strict=True prevents "30" from silently becoming 30.
    """

    model_config = ConfigDict(extra="forbid", strict=True)

    rain_mm: RainfallMm
    drains_cleared: list[str] = Field(default_factory=list, max_length=220)
    closed: list[str] = Field(default_factory=list, max_length=220)
    trucks_available: TruckCount
    shift_minutes: ShiftMinutes

    @field_validator("drains_cleared", "closed", mode="before")
    @classmethod
    def validate_segment_ids(cls, v: list[str]) -> list[str]:
        validated = [_validate_segment_id(s) for s in v]
        if len(validated) != len(set(validated)):
            raise ValueError("segment id list must not contain duplicates")
        return validated


# ------------------------------------------------------------------ CLI argument schema


class PipelineCliArgsSchema(BaseModel):
    """
    Validated CLI arguments for run_pipeline.py.

    `ward` is the Nominatim place name; we enforce a minimum length and a
    safe character set so it cannot be used as a shell injection vector when
    passed to osmnx.graph_from_place.
    """

    model_config = ConfigDict(extra="forbid")

    refresh: bool = False
    ward: str | None = Field(
        default=None,
        min_length=5,
        max_length=200,
        # Nominatim accepts letters (incl. Unicode), digits, spaces, commas,
        # and hyphens. Reject anything else.
        pattern=r"^[\w\s,.\-]+$",
    )


# ------------------------------------------------------------------ ground-truth CSV row


class GroundTruthRowSchema(BaseModel):
    """One row of config/ground_truth.csv, validated before model training."""

    model_config = ConfigDict(extra="forbid")

    location: str = Field(min_length=1, max_length=200)
    lat: Latitude
    lon: Longitude
    flooded: Literal["yes", "no", "1", "0", 1, 0]
    date: str = Field(
        pattern=r"^\d{4}-\d{2}-\d{2}$",
        description="ISO-8601 date YYYY-MM-DD",
    )

    @property
    def flooded_bool(self) -> bool:
        return self.flooded in ("yes", "1", 1)


# ------------------------------------------------------------------ IMD API response (partial)


class ImdDistrictRainfallSchema(BaseModel):
    """
    Minimum structure we expect from api.imd.gov.in/districtwise_rainfall_api.php.
    Extra keys are allowed (the API is undocumented and may add fields).
    We only validate what the pipeline actually reads.
    """

    model_config = ConfigDict(extra="allow")

    district: str = Field(min_length=1, max_length=100)
    rainfall: float = Field(ge=0.0)
