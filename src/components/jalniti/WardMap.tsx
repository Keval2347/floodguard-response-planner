import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { BAND_META, WARD, type Depot } from "@/lib/jalniti/data";
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
}

export default function WardMap({
  segments,
  depots,
  assignments,
  routes,
  selectedId,
  onSelect,
  showRoutes,
}: Props) {
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
          return (
            <Polyline
              key={`r-${a.truck}-${a.segment.id}`}
              positions={r.path}
              pathOptions={{
                color: "#1f6f8b",
                weight: active ? 5 : 2.5,
                opacity: active ? 0.95 : 0.5,
                lineCap: "round",
              }}
            >
              <Tooltip sticky>
                {a.truck} → {a.segment.name}
                <br />
                {r.distanceKm} km by road · {Math.round(r.durationMin)} min
              </Tooltip>
            </Polyline>
          );
        })}

      {segments.map((s) => {
        const active = s.id === selectedId;
        return (
          <Polyline
            key={s.id}
            positions={s.path}
            eventHandlers={{ click: () => onSelect(s.id) }}
            pathOptions={{
              color: BAND_META[s.band].color,
              weight: active ? 10 : 6,
              opacity: active ? 1 : 0.85,
              lineCap: "round",
            }}
          >
            <Tooltip sticky>
              <span className="font-medium">{s.name}</span>
              <br />
              risk {(s.risk * 100).toFixed(0)}% · {BAND_META[s.band].label}
            </Tooltip>
          </Polyline>
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
