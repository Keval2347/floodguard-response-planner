import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { Droplets, Truck, TriangleAlert, Waves, MapPin, Info, Database, RefreshCw } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { BAND_META, SOURCES, WARD, type WardData } from "@/lib/jalniti/data";
import { getRoutes, getWardData } from "@/lib/jalniti/live.functions";
import { allocate, defaultScenario, scoreSegments, type ScenarioOverrides } from "@/lib/jalniti/model";
import MapPanel from "@/components/jalniti/MapPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JalNiti — Ward Flood Response Console, Navrangpura" },
      {
        name: "description",
        content:
          "Live OSM street geometry, SRTM elevation, OSRM routing and observed rainfall driving per-street waterlogging risk and pump-truck allocation for Navrangpura ward, Ahmedabad.",
      },
      { property: "og:title", content: "JalNiti — Ward Flood Response Console" },
      {
        property: "og:description",
        content:
          "Real-data street-level flood risk, road-routed truck allocation and scenario planning for one Ahmedabad ward.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const fetchWard = useServerFn(getWardData);
  const fetchRoutes = useServerFn(getRoutes);

  const wardQuery = useQuery({
    queryKey: ["ward-data"],
    queryFn: () => fetchWard() as Promise<WardData>,
    staleTime: 30 * 60_000,
    retry: 1,
  });
  const ward = wardQuery.data;

  const [scenario, setScenario] = useState<ScenarioOverrides>(() => defaultScenario(undefined));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRoutes, setShowRoutes] = useState(true);
  const [initialised, setInitialised] = useState(false);

  // Once real data lands, start from the actual forecast + full fleet.
  useEffect(() => {
    if (ward && !initialised) {
      setScenario(defaultScenario(ward));
      setInitialised(true);
    }
  }, [ward, initialised]);

  const scored = useMemo(() => (ward ? scoreSegments(ward, scenario) : []), [ward, scenario]);
  const plan = useMemo(
    () =>
      ward
        ? allocate(ward, scored, scenario)
        : { assignments: [], unserved: [], coveredExposure: 0, totalExposure: 0 },
    [ward, scored, scenario],
  );
  const selected = scored.find((s) => s.id === selectedId) ?? null;

  // Road-following routes for the current assignments (OSRM, server-cached).
  const pairs = useMemo(
    () =>
      plan.assignments.slice(0, 20).map((a) => ({
        key: `${a.truck}|${a.segment.id}`,
        from: a.fromPoint,
        to: a.segment.mid,
      })),
    [plan.assignments],
  );

  const routesQuery = useQuery({
    queryKey: ["routes", pairs.map((p) => `${p.from}-${p.to}`).join("|")],
    queryFn: () => fetchRoutes({ data: { pairs } }),
    enabled: pairs.length > 0 && showRoutes,
    staleTime: 60 * 60_000,
  });
  const routes = (routesQuery.data ?? []).map((r, i) => ({ ...r, key: pairs[i]?.key ?? r.key }));

  const counts = scored.reduce<Record<string, number>>((acc, s) => {
    acc[s.band] = (acc[s.band] ?? 0) + 1;
    return acc;
  }, {});

  const coverage = plan.totalExposure
    ? Math.round((plan.coveredExposure / plan.totalExposure) * 100)
    : 0;

  const fleetTotal = (ward?.depots ?? []).reduce((n, d) => n + d.trucks, 0) || 10;

  const set = (patch: Partial<ScenarioOverrides>) => setScenario((s) => ({ ...s, ...patch }));

  const toggleIn = (key: "drainsCleared" | "closed", id: string) =>
    setScenario((s) => ({
      ...s,
      [key]: s[key].includes(id) ? s[key].filter((x) => x !== id) : [...s[key], id],
    }));

  return (
    <div className="flex h-screen flex-col bg-background text-foreground">
      <header className="flex shrink-0 flex-wrap items-center gap-x-6 gap-y-2 border-b border-border bg-card px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Waves className="size-5" />
          </div>
          <div>
            <h1 className="text-base font-semibold leading-tight tracking-tight">
              JalNiti <span className="text-muted-foreground">· Ward Flood Response Console</span>
            </h1>
            <p className="text-xs text-muted-foreground">
              {WARD.name}, {WARD.city} — live OSM · SRTM · OSRM · rainfall feeds
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-5 text-sm">
          <Stat icon={<Droplets className="size-4" />} label="Scenario rain" value={`${scenario.rainMm} mm`} />
          <Stat
            icon={<TriangleAlert className="size-4" />}
            label="Critical + high"
            value={`${(counts.critical ?? 0) + (counts.high ?? 0)} streets`}
          />
          <Stat icon={<Truck className="size-4" />} label="Trucks" value={`${scenario.trucksAvailable}`} />
          <Stat icon={<MapPin className="size-4" />} label="Coverage" value={`${coverage}%`} />
        </div>
      </header>

      {wardQuery.isError && (
        <div className="flex items-center gap-3 border-b border-destructive/40 bg-destructive/10 px-5 py-2 text-xs text-destructive">
          <TriangleAlert className="size-4 shrink-0" />
          <span className="flex-1">
            Live data fetch failed: {(wardQuery.error as Error).message}. The public OSM / DEM
            endpoints rate-limit; retry in a moment.
          </span>
          <Button size="sm" variant="outline" className="h-7" onClick={() => wardQuery.refetch()}>
            Retry
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[320px] flex-1">
          {wardQuery.isPending ? (
            <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-muted text-sm text-muted-foreground">
              <RefreshCw className="size-5 animate-spin" />
              Fetching real ward data — OSM streets, SRTM elevation, OSRM travel times, rainfall…
            </div>
          ) : (
            <MapPanel
              segments={scored}
              depots={ward?.depots ?? []}
              assignments={plan.assignments}
              routes={routes}
              selectedId={selectedId}
              onSelect={setSelectedId}
              showRoutes={showRoutes}
            />
          )}

          <Card className="absolute bottom-4 left-4 z-[500] gap-2 p-3 text-xs shadow-lg">
            <p className="font-medium">Waterlogging risk</p>
            {(["critical", "high", "moderate", "low"] as const).map((b) => (
              <div key={b} className="flex items-center gap-2">
                <span
                  className="h-1.5 w-6 rounded-full"
                  style={{ backgroundColor: BAND_META[b].color }}
                />
                <span className="text-muted-foreground">
                  {BAND_META[b].label} · {counts[b] ?? 0}
                </span>
              </div>
            ))}
            <Separator className="my-1" />
            <label className="flex items-center gap-2">
              <Switch checked={showRoutes} onCheckedChange={setShowRoutes} />
              <span className="text-muted-foreground">
                Road routes {routesQuery.isFetching ? "(routing…)" : ""}
              </span>
            </label>
          </Card>

          {selected && (
            <Card className="absolute right-4 top-4 z-[500] w-64 gap-1 p-3 text-xs shadow-lg">
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold leading-tight">{selected.name}</p>
                <Button variant="ghost" size="sm" className="-mr-2 -mt-1 h-6 px-2" onClick={() => setSelectedId(null)}>
                  ✕
                </Button>
              </div>
              <RiskBadge band={selected.band} risk={selected.risk} />
              <Row k="Road class (OSM)" v={selected.highway} />
              <Row k="Segment length" v={`${selected.length_m} m`} />
              <Row k="Elevation (SRTM)" v={`${selected.elevation_m} m`} />
              <Row k="Slope" v={`${selected.slope_pct} %`} />
              <Row k="Distance to water" v={`${selected.dist_to_water_m} m`} />
              <Row k="Road density" v={`${selected.road_density} km/km²`} />
              <Row k="Exposure score" v={`${selected.exposure}`} />
              <a
                className="text-[10px] text-muted-foreground underline"
                href={`https://www.openstreetmap.org/way/${selected.osm_id}`}
                target="_blank"
                rel="noreferrer"
              >
                OSM way #{selected.osm_id}
              </a>
              <Separator className="my-1" />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant={scenario.drainsCleared.includes(selected.id) ? "default" : "outline"}
                  className="h-7 flex-1 text-xs"
                  onClick={() => toggleIn("drainsCleared", selected.id)}
                >
                  Drain cleared
                </Button>
                <Button
                  size="sm"
                  variant={scenario.closed.includes(selected.id) ? "destructive" : "outline"}
                  className="h-7 flex-1 text-xs"
                  onClick={() => toggleIn("closed", selected.id)}
                >
                  Close street
                </Button>
              </div>
            </Card>
          )}
        </div>

        <aside className="flex w-full shrink-0 flex-col border-t border-border bg-card lg:w-[400px] lg:border-l lg:border-t-0">
          <Tabs defaultValue="risk" className="flex min-h-0 flex-1 flex-col gap-0">
            <TabsList className="m-3 grid grid-cols-4">
              <TabsTrigger value="risk">Risk</TabsTrigger>
              <TabsTrigger value="plan">Allocation</TabsTrigger>
              <TabsTrigger value="whatif">What-if</TabsTrigger>
              <TabsTrigger value="data">Data</TabsTrigger>
            </TabsList>

            {/* ---- Module 1: per-street risk ---- */}
            <TabsContent value="risk" className="min-h-0 flex-1">
              <ScrollArea className="h-full px-3 pb-4">
                <p className="pb-2 text-xs text-muted-foreground">
                  {scored.length} real OSM street segments, ranked by predicted waterlogging risk at{" "}
                  {scenario.rainMm} mm/24h.
                </p>
                <div className="space-y-1.5">
                  {scored.map((s, i) => (
                    <button
                      key={s.id}
                      onClick={() => setSelectedId(s.id)}
                      className={`flex w-full items-center gap-3 rounded-md border px-3 py-2 text-left transition-colors ${
                        s.id === selectedId
                          ? "border-primary bg-accent"
                          : "border-border hover:bg-accent/60"
                      }`}
                    >
                      <span className="w-5 shrink-0 text-xs tabular-nums text-muted-foreground">
                        {i + 1}
                      </span>
                      <span
                        className="h-8 w-1 shrink-0 rounded-full"
                        style={{ backgroundColor: BAND_META[s.band].color }}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{s.name}</span>
                        <span className="block text-xs text-muted-foreground">
                          {s.dist_to_water_m} m to water · {s.slope_pct}% slope · {s.elevation_m} m
                        </span>
                      </span>
                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {(s.risk * 100).toFixed(0)}%
                      </span>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ---- Module 2: pump-truck allocation ---- */}
            <TabsContent value="plan" className="min-h-0 flex-1">
              <ScrollArea className="h-full px-3 pb-4">
                <Card className="mb-3 gap-1 p-3 text-xs">
                  <p className="text-sm font-medium">
                    {plan.assignments.length} assignments · {plan.unserved.length} unserved
                  </p>
                  <p className="text-muted-foreground">
                    Covers {coverage}% of exposed road-length within a {scenario.shiftMinutes}-minute
                    shift. Travel times are OSRM road-network durations; greedy placeholder for the
                    OR-Tools solver.
                  </p>
                </Card>

                <div className="space-y-1.5">
                  {plan.assignments.map((a) => {
                    const r = routes.find((x) => x.key === `${a.truck}|${a.segment.id}`);
                    return (
                      <div
                        key={`${a.truck}-${a.segment.id}`}
                        className="rounded-md border border-border px-3 py-2"
                        onMouseEnter={() => setSelectedId(a.segment.id)}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold">{a.truck}</span>
                          <Badge variant="secondary" className="text-[10px]">
                            arrive T+{a.arriveMin} min
                          </Badge>
                        </div>
                        <p className="truncate text-sm">{a.segment.name}</p>
                        <p className="text-xs text-muted-foreground">
                          from {a.depot.name} · {a.travelMin} min by road
                          {r ? ` · ${r.distanceKm} km` : ""} · risk{" "}
                          {(a.segment.risk * 100).toFixed(0)}%
                        </p>
                      </div>
                    );
                  })}

                  {plan.unserved.length > 0 && (
                    <>
                      <p className="pt-3 text-xs font-medium text-destructive">
                        Not reachable this shift
                      </p>
                      {plan.unserved.map((s) => (
                        <div
                          key={s.id}
                          className="rounded-md border border-dashed border-border px-3 py-2 text-sm"
                        >
                          <span className="truncate">{s.name}</span>
                          <span className="ml-2 text-xs text-muted-foreground">
                            risk {(s.risk * 100).toFixed(0)}%
                          </span>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ---- Module 3: what-if simulator ---- */}
            <TabsContent value="whatif" className="min-h-0 flex-1">
              <ScrollArea className="h-full px-3 pb-4">
                <div className="space-y-5">
                  <Field
                    label="Rainfall scenario"
                    value={`${scenario.rainMm} mm / 24 h`}
                    hint={
                      ward
                        ? `Live feed: ${ward.observedMm} mm observed in the last 24 h, ${ward.forecastMm} mm forecast for the next 24 h.`
                        : "Loading the live rainfall feed…"
                    }
                  >
                    <Slider
                      min={10}
                      max={200}
                      step={5}
                      value={[scenario.rainMm]}
                      onValueChange={([v]) => set({ rainMm: v })}
                    />
                  </Field>

                  <Field
                    label="Trucks available"
                    value={`${scenario.trucksAvailable} of ${fleetTotal}`}
                    hint="Fleet size is the project assumption — no Indian municipality publishes a live vehicle feed."
                  >
                    <Slider
                      min={0}
                      max={fleetTotal}
                      step={1}
                      value={[scenario.trucksAvailable]}
                      onValueChange={([v]) => set({ trucksAvailable: v })}
                    />
                  </Field>

                  <Field
                    label="Shift length"
                    value={`${scenario.shiftMinutes} min`}
                    hint="The optimizer only assigns work it can finish inside this window."
                  >
                    <Slider
                      min={60}
                      max={480}
                      step={30}
                      value={[scenario.shiftMinutes]}
                      onValueChange={([v]) => set({ shiftMinutes: v })}
                    />
                  </Field>

                  <div>
                    <p className="text-sm font-medium">Pre-monsoon drain de-silting</p>
                    <p className="pb-2 text-xs text-muted-foreground">
                      Assumed 30% risk reduction per cleared segment. Click streets on the map or
                      pick from the top-risk list.
                    </p>
                    <div className="space-y-1">
                      {scored.slice(0, 8).map((s) => (
                        <label
                          key={s.id}
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent/60"
                        >
                          <Switch
                            checked={scenario.drainsCleared.includes(s.id)}
                            onCheckedChange={() => toggleIn("drainsCleared", s.id)}
                          />
                          <span className="min-w-0 flex-1 truncate">{s.name}</span>
                          <span className="text-xs tabular-nums text-muted-foreground">
                            {(s.risk * 100).toFixed(0)}%
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>

                  <Card className="gap-2 p-3">
                    <p className="text-sm font-medium">Observed rainfall, last 12 h</p>
                    {ward && ward.rainSeries.length > 0 ? (
                      <>
                        <div className="flex h-16 items-end gap-1">
                          {ward.rainSeries.map((r) => {
                            const peak = Math.max(1, ...ward.rainSeries.map((x) => x.mm));
                            return (
                              <div key={r.hour} className="flex flex-1 flex-col items-center gap-1">
                                <div
                                  className="w-full rounded-t-sm bg-primary/70"
                                  style={{ height: `${Math.max(2, (r.mm / peak) * 56)}px` }}
                                  title={`${r.hour} — ${r.mm} mm`}
                                />
                              </div>
                            );
                          })}
                        </div>
                        <p className="text-[10px] text-muted-foreground">
                          {ward.rainSeries[0].hour} → {ward.rainSeries[ward.rainSeries.length - 1].hour} IST
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Rainfall feed loading…</p>
                    )}
                  </Card>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => setScenario(defaultScenario(ward))}
                  >
                    Reset to live forecast
                  </Button>
                </div>
              </ScrollArea>
            </TabsContent>

            {/* ---- Provenance ---- */}
            <TabsContent value="data" className="min-h-0 flex-1">
              <ScrollArea className="h-full px-3 pb-4">
                <div className="space-y-3">
                  <Card className="gap-1 p-3 text-xs">
                    <p className="flex items-center gap-2 text-sm font-medium">
                      <Database className="size-4" /> Live fetch
                    </p>
                    {ward ? (
                      <>
                        <p className="text-muted-foreground">
                          {new Date(ward.fetchedAt).toLocaleString()} · cached 3 h server-side
                        </p>
                        <ul className="list-disc pl-4 text-muted-foreground">
                          {ward.notes.map((n) => (
                            <li key={n}>{n}</li>
                          ))}
                        </ul>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Fetching…</p>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      className="mt-2 h-7 w-full text-xs"
                      onClick={() => wardQuery.refetch()}
                    >
                      Refresh feeds
                    </Button>
                  </Card>

                  {SOURCES.map((s) => (
                    <Card key={s.label} className="gap-1 p-3 text-xs">
                      <a
                        className="text-sm font-medium underline underline-offset-2"
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {s.label}
                      </a>
                      <p className="text-muted-foreground">{s.detail}</p>
                    </Card>
                  ))}

                  <p className="flex gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    Remaining assumptions: depot truck counts, 30 min pumping time per street and the
                    30% de-silting benefit. Everything else on this screen is measured data.
                  </p>
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </aside>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground">{icon}</span>
      <span className="leading-tight">
        <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="block text-sm font-semibold tabular-nums">{value}</span>
      </span>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="tabular-nums">{v}</span>
    </div>
  );
}

function RiskBadge({ band, risk }: { band: keyof typeof BAND_META; risk: number }) {
  return (
    <span
      className="my-1 inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-white"
      style={{ backgroundColor: BAND_META[band].color }}
    >
      {BAND_META[band].label} · {(risk * 100).toFixed(0)}%
    </span>
  );
}

function Field({
  label,
  value,
  hint,
  children,
}: {
  label: string;
  value: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-sm tabular-nums text-muted-foreground">{value}</span>
      </div>
      {children}
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
  );
}
