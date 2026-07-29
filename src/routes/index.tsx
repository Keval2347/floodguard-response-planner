import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Droplets, Truck, TriangleAlert, Waves, MapPin, Info } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { BAND_META, DEPOTS, RAIN_SERIES, WARD } from "@/lib/jalniti/data";
import { DEFAULT_SCENARIO, allocate, scoreSegments, type ScenarioOverrides } from "@/lib/jalniti/model";
import MapPanel from "@/components/jalniti/MapPanel";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "JalNiti — Ward Flood Response Console, Navrangpura" },
      {
        name: "description",
        content:
          "Per-street waterlogging risk, pump-truck allocation and what-if planning for Navrangpura ward, Ahmedabad.",
      },
      { property: "og:title", content: "JalNiti — Ward Flood Response Console" },
      {
        property: "og:description",
        content:
          "Street-level flood risk, truck allocation and scenario planning for one Ahmedabad ward.",
      },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [scenario, setScenario] = useState<ScenarioOverrides>(DEFAULT_SCENARIO);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRoutes, setShowRoutes] = useState(true);

  const scored = useMemo(() => scoreSegments(scenario), [scenario]);
  const plan = useMemo(() => allocate(scored, scenario), [scored, scenario]);
  const selected = scored.find((s) => s.id === selectedId) ?? null;

  const counts = scored.reduce<Record<string, number>>((acc, s) => {
    acc[s.band] = (acc[s.band] ?? 0) + 1;
    return acc;
  }, {});

  const coverage = plan.totalExposure
    ? Math.round((plan.coveredExposure / plan.totalExposure) * 100)
    : 0;

  const set = (patch: Partial<ScenarioOverrides>) =>
    setScenario((s) => ({ ...s, ...patch }));

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
              {WARD.name}, {WARD.city} — decision support, not flood prediction
            </p>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-5 text-sm">
          <Stat icon={<Droplets className="size-4" />} label="Forecast rain" value={`${scenario.rainMm} mm`} />
          <Stat
            icon={<TriangleAlert className="size-4" />}
            label="Critical + high"
            value={`${(counts.critical ?? 0) + (counts.high ?? 0)} streets`}
          />
          <Stat icon={<Truck className="size-4" />} label="Trucks" value={`${scenario.trucksAvailable}`} />
          <Stat icon={<MapPin className="size-4" />} label="Coverage" value={`${coverage}%`} />
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <div className="relative min-h-[320px] flex-1">
          <MapPanel
            segments={scored}
            assignments={plan.assignments}
            selectedId={selectedId}
            onSelect={setSelectedId}
            showRoutes={showRoutes}
          />

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
              <span className="text-muted-foreground">Show truck routes</span>
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
              <Row k="Elevation" v={`${selected.elevation_m} m`} />
              <Row k="Slope" v={`${selected.slope_pct} %`} />
              <Row k="Distance to water" v={`${selected.dist_to_water_m} m`} />
              <Row k="Road density" v={`${selected.road_density} km/km²`} />
              <Row k="Exposure score" v={`${selected.exposure}`} />
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
            <TabsList className="m-3 grid grid-cols-3">
              <TabsTrigger value="risk">Risk</TabsTrigger>
              <TabsTrigger value="plan">Allocation</TabsTrigger>
              <TabsTrigger value="whatif">What-if</TabsTrigger>
            </TabsList>

            {/* ---- Module 1: per-street risk ---- */}
            <TabsContent value="risk" className="min-h-0 flex-1">
              <ScrollArea className="h-full px-3 pb-4">
                <p className="pb-2 text-xs text-muted-foreground">
                  {scored.length} street segments, ranked by predicted waterlogging risk at{" "}
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
                          {s.dist_to_water_m} m to water · {s.slope_pct}% slope
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
                    Covers {coverage}% of exposed population within a {scenario.shiftMinutes}-minute
                    shift. Greedy placeholder for the OR-Tools solver.
                  </p>
                </Card>

                <div className="space-y-1.5">
                  {plan.assignments.map((a) => (
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
                        from {a.depot.name} · {a.travelMin} min travel · risk{" "}
                        {(a.segment.risk * 100).toFixed(0)}%
                      </p>
                    </div>
                  ))}

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
                    label="Forecast rainfall"
                    value={`${scenario.rainMm} mm / 24 h`}
                    hint="IMD's grid is ~27 km, so the whole ward shares one rainfall value."
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
                    value={`${scenario.trucksAvailable} of ${DEPOTS.reduce((n, d) => n + d.trucks, 0)}`}
                    hint="Simulated fleet — no Indian municipality publishes a live feed."
                  >
                    <Slider
                      min={0}
                      max={DEPOTS.reduce((n, d) => n + d.trucks, 0)}
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
                    <p className="text-sm font-medium">Rainfall, last 12 h (IMD nowcast)</p>
                    <div className="flex h-16 items-end gap-1">
                      {RAIN_SERIES.map((r) => (
                        <div key={r.hour} className="flex flex-1 flex-col items-center gap-1">
                          <div
                            className="w-full rounded-t-sm bg-primary/70"
                            style={{ height: `${(r.mm / 14) * 56}px` }}
                            title={`${r.hour} — ${r.mm} mm`}
                          />
                        </div>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {RAIN_SERIES[0].hour} → {RAIN_SERIES[RAIN_SERIES.length - 1].hour}
                    </p>
                  </Card>

                  <Button variant="outline" className="w-full" onClick={() => setScenario(DEFAULT_SCENARIO)}>
                    Reset scenario
                  </Button>

                  <p className="flex gap-2 rounded-md bg-muted p-3 text-xs text-muted-foreground">
                    <Info className="mt-0.5 size-4 shrink-0" />
                    All figures on this screen are synthetic demo data. The React UI calls the same
                    logic the Python backend implements, so wiring FastAPI in later only swaps the
                    data source.
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
