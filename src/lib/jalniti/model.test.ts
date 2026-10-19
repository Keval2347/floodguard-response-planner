import { describe, expect, it } from "vitest";
import { scoreSegments, defaultScenario, type ScenarioOverrides } from "./model";
import type { StreetSegment, WardData } from "./data";
import { calculateRainPeaks } from "./rainfall";
import { ScenarioOverridesSchema } from "./schema";

const segment = (id: string): StreetSegment => ({
  id,
  name: `Road ${id}`,
  osm_id: Number(id.slice(1)),
  path: [[23.03, 72.55], [23.031, 72.551]],
  length_m: 320,
  elevation_m: 55,
  slope_pct: 1,
  dist_to_water_m: 500,
  road_density: 12,
  base_risk: 0.9,
  highway: "residential",
});

function ward(overrides: Partial<WardData> = {}): WardData {
  return {
    segments: [segment("S150"), segment("S337")],
    depots: [],
    rainSeries: [],
    forecastMm: 90,
    observedMm: 0,
    travelMin: [],
    fetchedAt: "2026-10-13T00:00:00.000Z",
    notes: [],
    ...overrides,
  };
}

function scenario(overrides: Partial<ScenarioOverrides> = {}): ScenarioOverrides {
  return {
    rainMm: 0,
    rain3hMm: 0,
    drainsCleared: [],
    closed: [],
    trucksAvailable: 0,
    shiftMinutes: 240,
    ...overrides,
  };
}

describe("rainfall intensity scoring", () => {
  it("starts dry with zero rainfall even when the forecast is wet", () => {
    const initial = defaultScenario(ward({ observedMm: 0, forecastMm: 90 }));
    expect(initial.rainMm).toBe(0);
    expect(initial.rain3hMm).toBe(0);
    expect(scoreSegments(ward(), initial).every((road) => road.band === "low")).toBe(true);
  });

  it("scores a 40 mm hourly burst above 40 mm spread across 24 hours", () => {
    const burst = calculateRainPeaks([40]);
    const spread = calculateRainPeaks(Array.from({ length: 24 }, () => 40 / 24));
    expect(burst.peak1hMm).toBe(40);
    expect(burst.peak3hMm).toBe(40);
    expect(spread.peak3hMm).toBeLessThan(6);

    const highIntensity = scoreSegments(ward(), scenario({ rainMm: 40, rain3hMm: burst.peak3hMm }));
    const distributed = scoreSegments(ward(), scenario({ rainMm: 40, rain3hMm: spread.peak3hMm }));
    expect(highIntensity[0].risk).toBeGreaterThan(distributed[0].risk);
  });

  it("accepts old ward snapshots and scenarios without optional intensity fields", () => {
    const oldWard = ward();
    delete oldWard.peak1hMm;
    delete oldWard.peak3hMm;
    const oldScenario = scenario();
    delete oldScenario.rain3hMm;
    expect(scoreSegments(oldWard, oldScenario)).toHaveLength(2);
    expect(scoreSegments(oldWard, oldScenario).every((road) => road.band === "low")).toBe(true);
  });

  it("validates the 0–300 mm 3-hour scenario value and 3-digit segment IDs", () => {
    const valid = ScenarioOverridesSchema.safeParse({
      ...scenario({ rain3hMm: 300 }),
      drainsCleared: ["S150", "S337"],
      closed: ["S337"],
    });
    expect(valid.success).toBe(true);
    expect(ScenarioOverridesSchema.safeParse(scenario({ rain3hMm: 301 })).success).toBe(false);
    expect(ScenarioOverridesSchema.safeParse({ ...scenario(), unrecognized: true }).success).toBe(false);
  });
});