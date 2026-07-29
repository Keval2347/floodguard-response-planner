import { MapContainer, TileLayer, Polyline, CircleMarker, Tooltip } from "react-leaflet";
import "leaflet/dist/leaflet.css";

import { BAND_META, DEPOTS, WARD } from "@/lib/jalniti/data";
import type { Assignment, ScoredSegment } from "@/lib/jalniti/model";

interface Props {
  segments: ScoredSegment[];
  assignments: Assignment[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  showRoutes: boolean;
}

export default function WardMap({
  segments,
  assignments,
  selectedId,
  onSelect,
  showRoutes,
}: Props) {
  return (
    <MapContainer
      center={WARD.center}
      zoom={14}
      scrollWheelZoom
      className="h-full w-full"
      style={{ background: "#e9e4d8" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
      />

      {showRoutes &&
        assignments.map((a) => (
          <Polyline
            key={`r-${a.truck}-${a.segment.id}`}
            positions={[[a.depot.lat, a.depot.lon], a.segment.path[1]]}
            pathOptions={{
              color: "#1f6f8b",
              weight: 1.5,
              opacity: 0.55,
              dashArray: "5 6",
            }}
          />
        ))}

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

      {DEPOTS.map((d) => (
        <CircleMarker
          key={d.id}
          center={[d.lat, d.lon]}
          radius={9}
          pathOptions={{ color: "#10394a", fillColor: "#1f6f8b", fillOpacity: 1, weight: 3 }}
        >
          <Tooltip direction="top">
            {d.name} · {d.trucks} trucks (simulated)
          </Tooltip>
        </CircleMarker>
      ))}
    </MapContainer>
  );
}
