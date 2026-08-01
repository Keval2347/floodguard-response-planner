/**
 * Hospitals layer — real facilities, not sample points.
 *
 * Source: OpenStreetMap (`amenity=hospital`) for the whole Ahmedabad urban
 * bbox (22.90–23.20 N, 72.40–72.75 E), fetched through the Overpass API and
 * committed as a snapshot so the map still works when Overpass rate-limits.
 * Every record keeps its OSM element id, so any entry on screen can be opened
 * on openstreetmap.org and verified — nothing here is generated or guessed.
 */

import { haversineM, type LatLon } from "./geo";
import type { ScoredSegment } from "./model";

export interface Hospital {
  /** OSM element id, prefixed N/W/R — click-through evidence for every marker. */
  id: string;
  name: string;
  lat: number;
  lon: number;
  /** `emergency=yes` in OSM. */
  emergency: boolean;
  /** `beds` tag when the mapper recorded it. */
  beds: number | null;
  operator: string | null;
  healthcare: string;
}

export type AccessStatus = "cut-off" | "at-risk" | "watch" | "clear" | "unknown";

export interface HospitalRisk extends Hospital {
  /** Worst waterlogging risk on any scored approach road within 600 m. */
  accessRisk: number;
  /** Number of scored approach roads considered. */
  approachRoads: number;
  /** Name of the worst approach road, so the tag can say *why*. */
  worstRoad: string | null;
  /** Metres to the ward centre — used to keep the panel focused. */
  distanceToWardM: number;
  status: AccessStatus;
}

const APPROACH_RADIUS_M = 600;

export const STATUS_META: Record<AccessStatus, { label: string; color: string; note: string }> = {
  "cut-off": {
    label: "Access likely cut",
    color: "#b42318",
    note: "A critical-risk road is the only mapped approach — send a pump before the shift starts.",
  },
  "at-risk": {
    label: "Approach at risk",
    color: "#e07000",
    note: "At least one high-risk approach road; keep an alternative route open.",
  },
  watch: { label: "Watch", color: "#c9a227", note: "Moderate risk on an approach road." },
  clear: { label: "Approach clear", color: "#2f8f5b", note: "All mapped approach roads score low." },
  unknown: {
    label: "Outside scored ward",
    color: "#9aa0a6",
    note: "No scored street within 600 m — this facility is outside the modelled ward.",
  },
};

/**
 * Join hospitals to the scored street network.
 *
 * Deliberately conservative: a hospital is only flagged when a *scored, real*
 * OSM road within 600 m carries the risk. Facilities outside the modelled ward
 * are returned as `unknown` rather than being given an invented score.
 */
export function assessHospitals(
  hospitals: Hospital[],
  segments: ScoredSegment[],
  wardCentre: LatLon,
): HospitalRisk[] {
  return hospitals
    .map((h) => {
      const here: LatLon = [h.lat, h.lon];
      let worst = -1;
      let worstRoad: string | null = null;
      let approachRoads = 0;

      for (const s of segments) {
        const d = Math.min(...s.path.map((p) => haversineM(here, p)));
        if (d > APPROACH_RADIUS_M) continue;
        approachRoads += 1;
        if (s.risk > worst) {
          worst = s.risk;
          worstRoad = s.name;
        }
      }

      const accessRisk = worst < 0 ? 0 : worst;
      const status: AccessStatus =
        approachRoads === 0
          ? "unknown"
          : accessRisk >= 0.75
            ? "cut-off"
            : accessRisk >= 0.55
              ? "at-risk"
              : accessRisk >= 0.35
                ? "watch"
                : "clear";

      return {
        ...h,
        accessRisk: Math.round(accessRisk * 100) / 100,
        approachRoads,
        worstRoad,
        distanceToWardM: Math.round(haversineM(here, wardCentre)),
        status,
      };
    })
    .sort(
      (a, b) => b.accessRisk - a.accessRisk || a.distanceToWardM - b.distanceToWardM,
    );
}

/** Facilities the console wants an operator to act on right now. */
export function urgentHospitals(list: HospitalRisk[]): HospitalRisk[] {
  return list.filter((h) => h.status === "cut-off" || h.status === "at-risk");
}
