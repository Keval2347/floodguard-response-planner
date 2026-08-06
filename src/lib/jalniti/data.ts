/**
 * JalNiti — shared types, ward constants and data-source provenance.
 *
 * NOTE: there is no synthetic street data in this project any more.
 * Every street, elevation, waterway, travel time and rainfall value shown in
 * the UI is fetched at runtime from the public datasets listed in `SOURCES`
 * (see src/lib/jalniti/pipeline.server.ts for the exact requests).
 * The only remaining assumptions are the municipal fleet numbers, which no
 * Indian city publishes as open data — they are flagged as such in the UI.
 */

export type RiskBand = "critical" | "high" | "moderate" | "low";

export interface StreetSegment {
  id: string;
  name: string;
  /** OSM way id the segment was cut from. */
  osm_id: number;
  /** [lat, lon] polyline, real OSM road geometry. */
  path: [number, number][];
  length_m: number;
  /** Metres above sea level (SRTM 30 m via OpenTopoData). */
  elevation_m: number;
  /** Percent slope along the segment, from the DEM samples. */
  slope_pct: number;
  /** Metres to the nearest mapped waterway/drain in OSM. */
  dist_to_water_m: number;
  /** km of road per km^2 within 300 m — proxy for impervious surface. */
  road_density: number;
  /** 0-1 baseline probability of waterlogging at the reference rainfall. */
  base_risk: number;
  /** OSM highway class, kept for transparency in the detail panel. */
  highway: string;
}

export interface Depot {
  id: string;
  name: string;
  lat: number;
  lon: number;
  trucks: number;
}

export interface RainPoint {
  hour: string;
  mm: number;
}

export interface WardData {
  segments: StreetSegment[];
  depots: Depot[];
  /** Observed hourly rainfall, last 12 h (Open-Meteo reanalysis/obs blend). */
  rainSeries: RainPoint[];
  /** Forecast rainfall total for the next 24 h, mm. */
  forecastMm: number;
  /** Observed rainfall total in the last 24 h, mm. */
  observedMm: number;
  /**
   * Real road-network travel times in minutes from OSRM.
   * Index space: 0..depots.length-1 are depots, then segments in order.
   */
  travelMin: number[][];
  fetchedAt: string;
  /** When the street/terrain layer itself was captured (snapshot replay). */
  geometryCapturedAt?: string;
  /** Which upstreams answered, for the provenance panel. */
  notes: string[];
}

/**
 * ASSUMPTION (documented, unavoidable): AMC does not publish a live pump-truck
 * feed or depot register. Depot coordinates are real municipal/PWD locations in
 * Navrangpura; the truck counts are the project's stated fleet assumption
 * (10 trucks / 3 depots) and mirror backend/config/ward_config.yaml.
 */
export const DEPOTS: Depot[] = [
  { id: "D1", name: "Navrangpura AMC Ward Office", lat: 23.0365, lon: 72.561, trucks: 4 },
  { id: "D2", name: "Ashram Road depot", lat: 23.0305, lon: 72.572, trucks: 3 },
  { id: "D3", name: "Gujarat University depot", lat: 23.0425, lon: 72.5455, trucks: 3 },
];

export const WARD = {
  name: "Navrangpura",
  city: "Ahmedabad",
  center: [23.0365, 72.5595] as [number, number],
  /** Bounding box actually queried from OSM: south, west, north, east. */
  bbox: [23.0225, 72.5375, 23.0565, 72.5805] as [number, number, number, number],
  /** Rainfall (mm/24h) the risk curve is calibrated at — IMD heavy-rain threshold. */
  reference_rain_mm: 65,
};

export interface SourceRef {
  label: string;
  detail: string;
  url: string;
}

/** Shown in the UI so the report can cite exactly what was used. */
export const SOURCES: SourceRef[] = [
  {
    label: "OpenStreetMap / Overpass API",
    detail: "Real street centrelines, road classes and mapped waterways for the ward bbox.",
    url: "https://overpass-api.de/",
  },
  {
    label: "NASA SRTM 30 m DEM (OpenTopoData)",
    detail:
      "Per-segment elevation and slope, sampled at 3 points per street. GMTED2010 is the documented fallback.",
    url: "https://portal.opentopography.org/raster?opentopoID=OTSRTM.082015.4326.1",
  },
  {
    label: "OSRM road-network router",
    detail:
      "Depot-to-street travel times and the actual driving routes drawn on the map (no straight lines).",
    url: "https://project-osrm.org/",
  },
  {
    label: "Open-Meteo (IMD-compatible obs + forecast)",
    detail:
      "Hourly observed rainfall for the last 12 h and the 24 h forecast total at the ward centroid. IMD Ahmedabad publishes HTML pages only, no machine-readable feed.",
    url: "https://open-meteo.com/",
  },
];

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
