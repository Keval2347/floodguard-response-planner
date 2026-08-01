import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { BAND_META, WARD, type Depot } from "@/lib/jalniti/data";
import { STATUS_META, type HospitalRisk } from "@/lib/jalniti/hospitals";
import type { RoutePath } from "@/lib/jalniti/live.functions";
import type { Assignment, ScoredSegment } from "@/lib/jalniti/model";

interface Props {
  segments: ScoredSegment[];
  depots: Depot[];
  assignments: Assignment[];
  routes: RoutePath[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  showRoutes: boolean;
  /** Segments whose drains were de-silted in the what-if scenario. */
  clearedIds: string[];
  /** Segments closed to traffic — excluded from the plan. */
  closedIds: string[];
  /** Real OSM hospitals, joined to the scored approach roads. */
  hospitals: HospitalRisk[];
  showHospitals: boolean;
}

export default function WardMap({
  segments,
  depots,
  assignments,
  routes,
  selectedId,
  onSelect,
  showRoutes,
  clearedIds,
  closedIds,
  hospitals,
  showHospitals,
}: Props) {
  // Only the worst handful get a permanent label — a tagged map has to stay
  // readable. Everything else is a small dot with a hover tooltip.
  const tagged = new Set(
    hospitals
      .filter((h) => h.status === "cut-off" || h.status === "at-risk")
      .slice(0, 10)
      .map((h) => h.id),
  );

  const routeFor = (a: Assignment) => routes.find((r) => r.key === `${a.truck}|${a.segment.id}`);

  return (
    <MapContainer
      center={WARD.center}
      zoom={14}
      scrollWheelZoom
      className="h-full w-full"
      style={{ background: "#e9e4d8" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors · routing by OSRM'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      {showRoutes &&
        assignments.map((a) => {
          const r = routeFor(a);
          if (!r) return null;
          const active = a.segment.id === selectedId;
          const current = a.leg === 0;
          return (
            <Polyline
              key={`r-${a.truck}-${a.segment.id}`}
              positions={r.path}
              pathOptions={{
                color: current ? "#1f6f8b" : "#7b5ea7",
                weight: active ? 5 : current ? 3 : 2.5,
                opacity: active ? 0.95 : current ? 0.65 : 0.55,
                dashArray: current ? undefined : "2 8",
                lineCap: "round",
              }}
            >
              <Tooltip sticky>
                {a.truck} → {a.segment.name}
                <br />
                {current ? "current leg" : `next suggested leg #${a.leg + 1}`} · {r.distanceKm} km ·{" "}
                {Math.round(r.durationMin)} min
              </Tooltip>
            </Polyline>
          );
        })}

      {segments.map((s) => {
        const active = s.id === selectedId;
        const cleared = clearedIds.includes(s.id);
        const closed = closedIds.includes(s.id);
        return (
          <Polyline
            key={s.id}
            positions={s.path}
            eventHandlers={{ click: () => onSelect(s.id) }}
            pathOptions={{
              color: closed ? "#6b7280" : BAND_META[s.band].color,
              weight: active ? 10 : 6,
              opacity: closed ? 0.55 : active ? 1 : 0.85,
              dashArray: closed ? "6 6" : cleared ? "12 5" : undefined,
              lineCap: "round",
            }}
          >
            <Tooltip sticky>
              <span className="font-medium">{s.name}</span>
              <br />
              risk {(s.risk * 100).toFixed(0)}% · {BAND_META[s.band].label}
              {cleared && (
                <>
                  <br />
                  drain de-silted (−30% risk)
                </>
              )}
              {closed && (
                <>
                  <br />
                  closed to traffic — not pumped
                </>
              )}
            </Tooltip>
          </Polyline>
        );
      })}

      {showHospitals &&
        hospitals.map((h) => {
          const meta = STATUS_META[h.status];
          const urgent = h.status === "cut-off" || h.status === "at-risk";
          return (
            <CircleMarker
              key={h.id}
              center={[h.lat, h.lon]}
              radius={urgent ? 6 : 3}
              pathOptions={{
                color: urgent ? "#7a1710" : "#ffffff",
                weight: urgent ? 2 : 1,
                fillColor: meta.color,
                fillOpacity: urgent ? 1 : 0.75,
              }}
            >
              {tagged.has(h.id) && (
                <Tooltip
                  permanent
                  direction="right"
                  offset={[6, 0]}
                  className="jalniti-hospital-tag"
                >
                  {h.name}
                </Tooltip>
              )}
              <Tooltip direction="top" sticky>
                <span className="font-medium">{h.name}</span>
                <br />
                {meta.label}
                {h.worstRoad ? ` · worst approach: ${h.worstRoad}` : ""}
                <br />
                {h.emergency ? "emergency dept · " : ""}
                {h.beds ? `${h.beds} beds · ` : ""}OSM {h.id}
              </Tooltip>
            </CircleMarker>
          );
        })}

      {depots.map((d) => (
        <CircleMarker
          key={d.id}
          center={[d.lat, d.lon]}
          radius={9}
          pathOptions={{ color: "#10394a", fillColor: "#1f6f8b", fillOpacity: 1, weight: 3 }}
        >
          <Tooltip direction="top">
            {d.name} · {d.trucks} trucks (fleet assumption)
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
