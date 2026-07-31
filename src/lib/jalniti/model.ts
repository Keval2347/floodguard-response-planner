/**
 * Module 1 (risk) + Module 2 (allocation).
 *
 * Both run on REAL data now: the features come from OSM + the SRTM DEM, and
 * every travel time is an OSRM road-network duration (matrix index 0..depots-1
 * = depots, then segments in order), not a straight line at an assumed speed.
 *
 * The Python backend implements the same contract; swapping in FastAPI later
 * only changes where `WardData` is fetched from.
 */

import { WARD, bandOf, type Depot, type StreetSegment, type WardData } from "./data";
import { midOf, type LatLon } from "./geo";

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

export function defaultScenario(ward: WardData | undefined): ScenarioOverrides {
  return {
    rainMm: Math.max(10, Math.round((ward?.forecastMm || WARD.reference_rain_mm) / 5) * 5),
    drainsCleared: [],
    closed: [],
    trucksAvailable: (ward?.depots ?? []).reduce((n, d) => n + d.trucks, 0) || 10,
    shiftMinutes: 240,
  };
}

export interface ScoredSegment extends StreetSegment {
  risk: number;
  band: ReturnType<typeof bandOf>;
  /** Optimizer objective weight: risk x road density x segment length. */
  exposure: number;
  /** Position in the OSRM travel matrix. */
  matrixIndex: number;
  mid: LatLon;
}

/**
 * Rainfall response curve. Gridded rainfall products (IMD 0.25 deg, Open-Meteo
 * ~11 km) cover the whole ward with one value, so rainfall moves every street
 * together; spatial contrast comes from terrain + network features.
 */
export function scoreSegments(ward: WardData, o: ScenarioOverrides): ScoredSegment[] {
  const rainFactor = Math.log1p(o.rainMm) / Math.log1p(WARD.reference_rain_mm);
  const depotCount = ward.depots.length;

  return ward.segments
    .map((s, i) => {
      let risk = s.base_risk * rainFactor;
      // A de-silted drain empirically buys roughly a 30% risk reduction.
      if (o.drainsCleared.includes(s.id)) risk *= 0.7;
      risk = Math.min(0.99, Math.max(0.01, risk));

      return {
        ...s,
        risk: Math.round(risk * 100) / 100,
        band: bandOf(risk),
        exposure: Math.round(risk * s.road_density * (s.length_m / 100) * 12),
        matrixIndex: depotCount + i,
        mid: midOf(s.path),
      };
    })
    .sort((a, b) => b.risk - a.risk);
}

export interface Assignment {
  truck: string;
  depot: Depot;
  segment: ScoredSegment;
  travelMin: number;
  arriveMin: number;
  /** Matrix index the truck departed from — used to draw the real route. */
  fromIndex: number;
  fromPoint: LatLon;
  /** 0 = the leg the truck is driving now, 1+ = the next suggested legs. */
  leg: number;
}

export interface AllocationResult {
  assignments: Assignment[];
  unserved: ScoredSegment[];
  coveredExposure: number;
  totalExposure: number;
}

const SERVICE_MIN = 30; // ASSUMPTION: flat pumping time per segment

/**
 * Greedy stand-in for the OR-Tools CP-SAT model in backend/app/allocation.
 * Highest-exposure segment first, given to whichever free truck reaches it
 * soonest by road. Greedy is NOT optimal — the gap to the real solver is a
 * good result to report.
 */
export function allocate(
  ward: WardData,
  scored: ScoredSegment[],
  o: ScenarioOverrides,
): AllocationResult {
  const M = ward.travelMin;
  const trucks: {
    id: string;
    depot: Depot;
    freeAt: number;
    idx: number;
    point: LatLon;
    legs: number;
  }[] = [];

  let budget = o.trucksAvailable;
  ward.depots.forEach((d, di) => {
    for (let i = 0; i < d.trucks && budget > 0; i++, budget--) {
      trucks.push({
        id: `${d.id}-T${i + 1}`,
        depot: d,
        freeAt: 0,
        idx: di,
        point: [d.lat, d.lon],
        legs: 0,
      });
    }
  });

  const queue = scored
    .filter((s) => !o.closed.includes(s.id) && s.risk >= 0.35)
    .sort((a, b) => b.exposure - a.exposure);

  const assignments: Assignment[] = [];
  const unserved: ScoredSegment[] = [];

  for (const seg of queue) {
    let best: (typeof trucks)[number] | null = null;
    let bestArrive = Infinity;
    let bestTravel = 0;

    for (const t of trucks) {
      const travel = M[t.idx]?.[seg.matrixIndex] ?? Infinity;
      if (!Number.isFinite(travel)) continue;
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
      fromIndex: best.idx,
      fromPoint: best.point,
      leg: best.legs,
    });
    best.legs += 1;
    best.freeAt = bestArrive + SERVICE_MIN;
    best.idx = seg.matrixIndex;
    best.point = seg.mid;
  }

  const coveredExposure = assignments.reduce((n, a) => n + a.segment.exposure, 0);
  const totalExposure = queue.reduce((n, s) => n + s.exposure, 0);

  return { assignments, unserved, coveredExposure, totalExposure };
}

