"""
Schema validation tests — run with:  pytest -q backend/tests/test_schemas.py

These need no network, no Earth Engine account, and no pipeline data.
They only check that the Pydantic schemas accept valid input and reject
invalid input with a ValidationError (never with a silent coercion or a
misleading AttributeError).

POLICY: every boundary case that is NOT tested here is a gap in the
validation contract. Add a test whenever a new schema field is added.
"""

from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.schemas import (
    DepotSchema,
    FleetConfigSchema,
    GroundTruthRowSchema,
    PipelineCliArgsSchema,
    ScenarioOverridesSchema,
    WardConfigSchema,
)


# ------------------------------------------------------------------ WardConfigSchema


class TestWardConfigSchema:
    VALID = {
        "place_name": "Navrangpura, Ahmedabad, Gujarat, India",
        "short_name": "navrangpura",
        "metric_crs": "EPSG:32643",
    }

    def test_accepts_valid(self):
        WardConfigSchema.model_validate(self.VALID)

    def test_rejects_short_place_name(self):
        with pytest.raises(ValidationError, match="place_name"):
            WardConfigSchema.model_validate({**self.VALID, "place_name": "AB"})

    def test_rejects_invalid_crs(self):
        with pytest.raises(ValidationError, match="metric_crs"):
            WardConfigSchema.model_validate({**self.VALID, "metric_crs": "WGS84"})

    def test_rejects_extra_keys(self):
        with pytest.raises(ValidationError):
            WardConfigSchema.model_validate({**self.VALID, "unknown_field": True})

    def test_rejects_non_slug_short_name(self):
        with pytest.raises(ValidationError, match="short_name"):
            WardConfigSchema.model_validate({**self.VALID, "short_name": "Nav Rang Pura!"})


# ------------------------------------------------------------------ DepotSchema


class TestDepotSchema:
    VALID = {"id": "D1", "name": "Main Depot", "lat": 23.036, "lon": 72.560, "trucks": 4}

    def test_accepts_valid(self):
        DepotSchema.model_validate(self.VALID, strict=True)

    def test_rejects_lat_out_of_range(self):
        with pytest.raises(ValidationError, match="lat"):
            DepotSchema.model_validate({**self.VALID, "lat": 91.0}, strict=True)

    def test_rejects_lon_out_of_range(self):
        with pytest.raises(ValidationError, match="lon"):
            DepotSchema.model_validate({**self.VALID, "lon": -181.0}, strict=True)

    def test_rejects_negative_trucks(self):
        with pytest.raises(ValidationError, match="trucks"):
            DepotSchema.model_validate({**self.VALID, "trucks": -1}, strict=True)

    def test_rejects_too_many_trucks(self):
        with pytest.raises(ValidationError, match="trucks"):
            DepotSchema.model_validate({**self.VALID, "trucks": 51}, strict=True)

    def test_rejects_malformed_id(self):
        with pytest.raises(ValidationError, match="id"):
            DepotSchema.model_validate({**self.VALID, "id": "Depot-1"}, strict=True)

    def test_rejects_string_for_numeric_field(self):
        with pytest.raises(ValidationError):
            DepotSchema.model_validate({**self.VALID, "trucks": "4"}, strict=True)


# ------------------------------------------------------------------ FleetConfigSchema


class TestFleetConfigSchema:
    VALID_DEPOT = {"id": "D1", "name": "Main", "lat": 23.036, "lon": 72.560, "trucks": 10}
    VALID = {
        "truck_count": 10,
        "avg_speed_kmph": 25.0,
        "service_time_min": 30,
        "shift_minutes": 240,
        "depots": [VALID_DEPOT],
    }

    def test_accepts_valid(self):
        FleetConfigSchema.model_validate(self.VALID, strict=True)

    def test_rejects_depot_sum_mismatch(self):
        with pytest.raises(ValidationError, match="depot trucks sum"):
            FleetConfigSchema.model_validate(
                {**self.VALID, "truck_count": 5},
                strict=True,
            )

    def test_rejects_zero_speed(self):
        with pytest.raises(ValidationError, match="avg_speed_kmph"):
            FleetConfigSchema.model_validate({**self.VALID, "avg_speed_kmph": 0.0}, strict=True)

    def test_rejects_shift_too_short(self):
        with pytest.raises(ValidationError, match="shift_minutes"):
            FleetConfigSchema.model_validate({**self.VALID, "shift_minutes": 10}, strict=True)

    def test_rejects_shift_too_long(self):
        with pytest.raises(ValidationError, match="shift_minutes"):
            FleetConfigSchema.model_validate({**self.VALID, "shift_minutes": 721}, strict=True)


# ------------------------------------------------------------------ ScenarioOverridesSchema


class TestScenarioOverridesSchema:
    VALID = {
        "rain_mm": 45.0,
        "drains_cleared": ["S01", "S12"],
        "closed": [],
        "trucks_available": 10,
        "shift_minutes": 240,
    }

    def test_accepts_valid(self):
        ScenarioOverridesSchema.model_validate(self.VALID, strict=True)

    def test_rejects_negative_rain(self):
        with pytest.raises(ValidationError, match="rain_mm"):
            ScenarioOverridesSchema.model_validate({**self.VALID, "rain_mm": -1.0}, strict=True)

    def test_rejects_rain_above_ceiling(self):
        with pytest.raises(ValidationError, match="rain_mm"):
            ScenarioOverridesSchema.model_validate({**self.VALID, "rain_mm": 601.0}, strict=True)

    def test_rejects_invalid_segment_id_in_drains(self):
        with pytest.raises(ValidationError, match="segment id"):
            ScenarioOverridesSchema.model_validate(
                {**self.VALID, "drains_cleared": ["X99", "S01"]},
                strict=True,
            )

    def test_rejects_duplicate_segment_ids(self):
        with pytest.raises(ValidationError, match="duplicate"):
            ScenarioOverridesSchema.model_validate(
                {**self.VALID, "drains_cleared": ["S01", "S01"]},
                strict=True,
            )

    def test_rejects_string_trucks(self):
        with pytest.raises(ValidationError):
            ScenarioOverridesSchema.model_validate(
                {**self.VALID, "trucks_available": "10"},
                strict=True,
            )

    def test_rejects_extra_keys(self):
        with pytest.raises(ValidationError):
            ScenarioOverridesSchema.model_validate(
                {**self.VALID, "unknown": True},
                strict=True,
            )

    def test_rejects_float_for_int_field(self):
        with pytest.raises(ValidationError):
            ScenarioOverridesSchema.model_validate(
                {**self.VALID, "trucks_available": 10.5},
                strict=True,
            )


# ------------------------------------------------------------------ PipelineCliArgsSchema


class TestPipelineCliArgsSchema:
    def test_accepts_defaults(self):
        args = PipelineCliArgsSchema.model_validate({"refresh": False, "ward": None})
        assert args.refresh is False
        assert args.ward is None

    def test_accepts_valid_ward(self):
        args = PipelineCliArgsSchema.model_validate(
            {"refresh": False, "ward": "Vasna, Ahmedabad, Gujarat, India"}
        )
        assert args.ward == "Vasna, Ahmedabad, Gujarat, India"

    def test_rejects_ward_with_shell_characters(self):
        for bad in ["Navrangpura; rm -rf /", "Ward$(evil)", "A\x00B"]:
            with pytest.raises(ValidationError, match="ward"):
                PipelineCliArgsSchema.model_validate({"refresh": False, "ward": bad})

    def test_rejects_too_short_ward(self):
        with pytest.raises(ValidationError, match="ward"):
            PipelineCliArgsSchema.model_validate({"refresh": False, "ward": "AB"})


# ------------------------------------------------------------------ GroundTruthRowSchema


class TestGroundTruthRowSchema:
    VALID = {
        "location": "Stadium Circle underpass",
        "lat": 23.0452,
        "lon": 72.5641,
        "flooded": "yes",
        "date": "2024-08-26",
    }

    def test_accepts_yes_no(self):
        GroundTruthRowSchema.model_validate(self.VALID)
        GroundTruthRowSchema.model_validate({**self.VALID, "flooded": "no"})

    def test_accepts_1_0(self):
        GroundTruthRowSchema.model_validate({**self.VALID, "flooded": "1"})
        GroundTruthRowSchema.model_validate({**self.VALID, "flooded": "0"})

    def test_rejects_invalid_flooded(self):
        with pytest.raises(ValidationError, match="flooded"):
            GroundTruthRowSchema.model_validate({**self.VALID, "flooded": "maybe"})

    def test_rejects_bad_date_format(self):
        with pytest.raises(ValidationError, match="date"):
            GroundTruthRowSchema.model_validate({**self.VALID, "date": "26-08-2024"})

    def test_rejects_lat_out_of_bounds(self):
        with pytest.raises(ValidationError, match="lat"):
            GroundTruthRowSchema.model_validate({**self.VALID, "lat": 95.0})

    def test_flooded_bool_property(self):
        row = GroundTruthRowSchema.model_validate(self.VALID)
        assert row.flooded_bool is True
        row2 = GroundTruthRowSchema.model_validate({**self.VALID, "flooded": "no"})
        assert row2.flooded_bool is False
