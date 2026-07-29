/**
 * Module 1 (risk) + Module 2 (allocation), reimplemented in the browser
 * with the SAME logic the Python backend will use, so the UI is fully
 * interactive before FastAPI exists.
 *
 * When the API is live: delete these functions and fetch
 *   GET  /risk?rain_mm=...
 *   POST /allocate
 * The types below are the contract.
 */

import { DEPOTS, SEGMENTS, WARD, bandOf, type Depot, type StreetSegment } from "./data";

export interface ScenarioOverrides {
  /** Forecast rainfall in mm/24h. Drives the whole risk map. */
  rainMm: number;
  /** Segment ids whose storm drains were de-silted before the monsoon. */
  drainsCleared: string[];
  /** Segment ids closed to traffic (still flood, but not worth pumping). */
  closed: string[];
  /** Trucks actually available today (breakdowns, other wards). */
  trucksAvailable: number;
  /** Minutes of shift the optimizer may plan into. */
  shiftMinutes: number;
}

export const DEFAULT_SCENARIO: ScenarioOverrides = {
  rainMm: WARD.reference_rain_mm,
  drainsCleared: [],
  closed: [],
  trucksAvailable: DEPOTS.reduce((n, d) => n + d.trucks, 0),
  shiftMinutes: 240,
};

export interface ScoredSegment extends StreetSegment {
  risk: number;
  band: ReturnType<typeof bandOf>;
  /** Expected people affected — used as the optimizer's objective weight. */
  exposure: number;
}

/**
 * Rainfall response curve. IMD's gridded product is 0.25 deg (~27 km), so the
 * WHOLE ward sits in one cell: rainfall moves every street up or down
 * together. Spatial contrast comes only from terrain + network features.
 */
export function scoreSegments(o: ScenarioOverrides): ScoredSegment[] {
  const rainFactor = Math.log1p(o.rainMm) / Math.log1p(WARD.reference_rain_mm);

  return SEGMENTS.map((s) => {
    let risk = s.base_risk * rainFactor;
    // A de-silted drain empirically buys roughly a 30% risk reduction.
    if (o.drainsCleared.includes(s.id)) risk *= 0.7;
    risk = Math.min(0.99, Math.max(0.01, risk));

    return {
      ...s,
      risk: Math.round(risk * 100) / 100,
      band: bandOf(risk),
      exposure: Math.round(risk * s.road_density * 120),
    };
  }).sort((a, b) => b.risk - a.risk);
}

export interface Assignment {
  truck: string;
  depot: Depot;
  segment: ScoredSegment;
  travelMin: number;
  arriveMin: number;
}

export interface AllocationResult {
  assignments: Assignment[];
  unserved: ScoredSegment[];
  coveredExposure: number;
  totalExposure: number;
}

const SPEED_KMPH = 25; // ASSUMPTION: monsoon traffic in urban Ahmedabad
const SERVICE_MIN = 30; // ASSUMPTION: flat pumping time per segment

function haversineKm(a: [number, number], b: [number, number]) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const la1 = (a[0] * Math.PI) / 180;
  const la2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(la1) * Math.cos(la2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function midpoint(s: StreetSegment): [number, number] {
  return s.path[1];
}

/**
 * Greedy stand-in for the OR-Tools CP-SAT model in backend/app/allocation.
 * Highest-exposure segment first, given to whichever free truck reaches it
 * soonest. Greedy is NOT optimal — that's the point of the real optimizer,
 * and the gap between the two is a good result to report.
 */
export function allocate(scored: ScoredSegment[], o: ScenarioOverrides): AllocationResult {
  const trucks: { id: string; depot: Depot; freeAt: number; at: [number, number] }[] = [];
  let budget = o.trucksAvailable;
  for (const d of DEPOTS) {
    for (let i = 0; i < d.trucks && budget > 0; i++, budget--) {
      trucks.push({ id: `${d.id}-T${i + 1}`, depot: d, freeAt: 0, at: [d.lat, d.lon] });
    }
  }

  const queue = scored
    .filter((s) => !o.closed.includes(s.id) && s.risk >= 0.35)
    .sort((a, b) => b.exposure - a.exposure);

  const assignments: Assignment[] = [];
  const unserved: ScoredSegment[] = [];

  for (const seg of queue) {
    const target = midpoint(seg);
    let best: (typeof trucks)[number] | null = null;
    let bestArrive = Infinity;
    let bestTravel = 0;

    for (const t of trucks) {
      const travel = (haversineKm(t.at, target) / SPEED_KMPH) * 60;
      const arrive = t.freeAt + travel;
      if (arrive < bestArrive) {
        bestArrive = arrive;
        bestTravel = travel;
        best = t;
      }
    }

    if (!best || bestArrive + SERVICE_MIN > o.shiftMinutes) {
      unserved.push(seg);
      continue;
    }

    assignments.push({
      truck: best.id,
      depot: best.depot,
      segment: seg,
      travelMin: Math.round(bestTravel),
      arriveMin: Math.round(bestArrive),
    });
    best.freeAt = bestArrive + SERVICE_MIN;
    best.at = target;
  }

  const coveredExposure = assignments.reduce((n, a) => n + a.segment.exposure, 0);
  const totalExposure = queue.reduce((n, s) => n + s.exposure, 0);

  return { assignments, unserved, coveredExposure, totalExposure };
}
