/**
 * JalNiti — frontend demo data.
 *
 * IMPORTANT (for the report): every number in this file is SYNTHETIC.
 * It exists so the UI can be built and reviewed before the Python backend
 * (OSM + SRTM + IMD -> risk model -> OR-Tools allocation) is running.
 * When `backend/app/api` is live, replace these arrays with fetch() calls;
 * the shapes below are exactly what the API is expected to return.
 */

export type RiskBand = "critical" | "high" | "moderate" | "low";

export interface StreetSegment {
  id: string;
  name: string;
  /** [lat, lon] polyline as returned by the OSM road graph. */
  path: [number, number][];
  /** Metres above sea level, mean of the SRTM 30 m cells under the segment. */
  elevation_m: number;
  /** Percent slope from the DEM. Flat streets pond; steep ones drain. */
  slope_pct: number;
  /** Metres to the nearest waterway/drain (Sabarmati, canals, storm drains). */
  dist_to_water_m: number;
  /** km of road per km^2 around the segment — proxy for impervious surface. */
  road_density: number;
  /** 0-1 baseline probability of waterlogging at the reference rainfall. */
  base_risk: number;
}

export interface Depot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  trucks: number;
}

/** SIMULATED fleet — mirrors backend/config/ward_config.yaml. */
export const DEPOTS: Depot[] = [
  { id: "D1", name: "Navrangpura AMC Ward Office", lat: 23.0365, lon: 72.561, trucks: 4 },
  { id: "D2", name: "Ashram Road depot", lat: 23.0305, lon: 72.572, trucks: 3 },
  { id: "D3", name: "Gujarat University depot", lat: 23.0425, lon: 72.5455, trucks: 3 },
];

export const WARD = {
  name: "Navrangpura",
  city: "Ahmedabad",
  center: [23.0365, 72.5595] as [number, number],
  /** Rainfall (mm/24h) the base_risk numbers were calibrated at. */
  reference_rain_mm: 65,
};

/** Deterministic pseudo-random so the demo looks the same on every reload. */
function seeded(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

const STREET_NAMES = [
  "Ashram Road (Nehru Bridge end)",
  "C.G. Road",
  "Vijay Cross Road",
  "Navrangpura Bus Stand Rd",
  "Swastik Cross Road",
  "Stadium Circle Approach",
  "Gujarat College Road",
  "Law Garden Lane",
  "Netaji Road",
  "Mithakhali Six Roads",
  "University Road",
  "Panjrapole Approach",
  "Commerce Six Roads",
  "Sardar Patel Marg",
  "Bhudarpura Lane",
  "Shreyas Colony Rd",
  "Vasant Vihar Lane",
  "Income Tax Circle Rd",
  "Usmanpura Riverfront Rd",
  "Vadaj Link Road",
  "Old Wadaj Cross",
  "Shahibaug Feeder Rd",
  "Polytechnic Road",
  "Ambawadi Approach",
];

/** Build 24 street segments spread over the ward bounding box. */
export const SEGMENTS: StreetSegment[] = STREET_NAMES.map((name, i) => {
  const rnd = seeded(i * 7919 + 17);
  const lat = 23.0255 + rnd() * 0.026;
  const lon = 72.5405 + rnd() * 0.034;
  const len = 0.0018 + rnd() * 0.0035;
  const angle = rnd() * Math.PI;

  const path: [number, number][] = [
    [lat, lon],
    [lat + Math.sin(angle) * len * 0.6, lon + Math.cos(angle) * len * 0.6],
    [lat + Math.sin(angle) * len, lon + Math.cos(angle) * len],
  ];

  // Riverside + low-lying streets get worse numbers on purpose.
  const dist_to_water_m = Math.round(40 + rnd() * 900);
  const elevation_m = Math.round((48 + rnd() * 12) * 10) / 10;
  const slope_pct = Math.round(rnd() * 3.4 * 100) / 100;
  const road_density = Math.round((6 + rnd() * 14) * 10) / 10;

  // Transparent, hand-written scoring so a reviewer can follow it. The real
  // weights come from the logistic-regression model in backend/app/risk.
  const raw =
    0.42 * (1 - Math.min(dist_to_water_m, 900) / 900) +
    0.30 * (1 - Math.min(slope_pct, 3.4) / 3.4) +
    0.18 * (road_density / 20) +
    0.10 * (1 - (elevation_m - 48) / 12);

  return {
    id: `S${String(i + 1).padStart(2, "0")}`,
    name,
    path,
    elevation_m,
    slope_pct,
    dist_to_water_m,
    road_density,
    base_risk: Math.round(Math.min(0.97, Math.max(0.05, raw)) * 100) / 100,
  };
});

/** Last 12 hours of ward rainfall (mm/h) — IMD nowcast shape. */
export const RAIN_SERIES = Array.from({ length: 12 }, (_, i) => {
  const rnd = seeded(i * 131 + 3);
  return {
    hour: `${String((14 + i) % 24).padStart(2, "0")}:00`,
    mm: Math.round((Math.sin(i / 2.2) * 6 + 7 + rnd() * 4) * 10) / 10,
  };
});

export function bandOf(risk: number): RiskBand {
  if (risk >= 0.75) return "critical";
  if (risk >= 0.55) return "high";
  if (risk >= 0.35) return "moderate";
  return "low";
}

export const BAND_META: Record<RiskBand, { label: string; color: string; token: string }> = {
  critical: { label: "Critical", color: "#b42318", token: "risk-critical" },
  high: { label: "High", color: "#e07000", token: "risk-high" },
  moderate: { label: "Moderate", color: "#c9a227", token: "risk-moderate" },
  low: { label: "Low", color: "#2f8f5b", token: "risk-low" },
};
