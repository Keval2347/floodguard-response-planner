import { useEffect, useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Droplets,
  Truck,
  TriangleAlert,
  Waves,
  MapPin,
  Info,
  Database,
  RefreshCw,
  Cross,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

import { BAND_META, SOURCES, WARD, type WardData } from "@/lib/jalniti/data";
import { getHospitals, getRainNow, getRoutes, getWardData } from "@/lib/jalniti/live.functions";
import { assessHospitals, STATUS_META, urgentHospitals } from "@/lib/jalniti/hospitals";
import {
  allocate,
  defaultScenario,
  scoreSegments,
  type AllocationResult,
  type ScenarioOverrides,
} from "@/lib/jalniti/model";
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

/** Every timestamp on screen is shown in Indian Standard Time. */
function istStamp(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }) + " IST";
}

function Dashboard() {
  const fetchWard = useServerFn(getWardData);
  const fetchRoutes = useServerFn(getRoutes);
  const fetchRain = useServerFn(getRainNow);
  const fetchHospitals = useServerFn(getHospitals);
  const queryClient = useQueryClient();

  const wardQuery = useQuery({
    queryKey: ["ward-data"],
    queryFn: () => fetchWard({ data: {} }) as Promise<WardData>,
    staleTime: 30 * 60_000,
    // Terrain and street geometry barely move, but re-reading every 30 min
    // keeps the console honest about being live rather than a day-old capture.
    refetchInterval: 30 * 60_000,
    refetchIntervalInBackground: true,
    // Opening the app again days later must re-read the feeds, never replay
    // whatever was on screen last time.
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    retry: 1,
  });
  const ward = wardQuery.data;

  /**
   * Real-time weather. Open-Meteo's `current` block is refreshed every ~15 min;
   * we poll it once a minute (even in a background tab) so "is it raining right
   * now" on screen matches what is happening outside.
   */
  const rainQuery = useQuery({
    queryKey: ["rain-now"],
    queryFn: () => fetchRain(),
    refetchInterval: 60_000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
    refetchOnMount: "always",
    staleTime: 30_000,
    retry: 2,
  });
  const rain = rainQuery.data;


  /** Real OSM hospitals for the whole city; the list itself changes rarely. */
  const hospitalQuery = useQuery({
    queryKey: ["hospitals"],
    queryFn: () => fetchHospitals({ data: {} }),
    staleTime: 12 * 3600_000,
  });

  const [showHospitals, setShowHospitals] = useState(true);
  const [scenario, setScenario] = useState<ScenarioOverrides>(() => defaultScenario(undefined));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showRoutes, setShowRoutes] = useState(true);
  const [initialised, setInitialised] = useState(false);
  /** When true the rainfall input tracks the live feed instead of the slider. */
  const [followLive, setFollowLive] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [tick, setTick] = useState(Date.now());

  // Ticking clock so "updated Ns ago" actually counts up on screen.
  useEffect(() => {
    const t = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  /**
   * Calendar-aware freshness: if the IST date rolls over (or the tab was left
   * open / re-opened after a long gap), every feed is re-read from scratch so
   * you never look at yesterday's rainfall or risk map.
   */
  const istDay = (t: number) =>
    new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  useEffect(() => {
    let day = istDay(Date.now());
    const check = () => {
      const today = istDay(Date.now());
      if (today !== day) {
        day = today;
        void queryClient.invalidateQueries({ queryKey: ["rain-now"] });
        void queryClient.invalidateQueries({ queryKey: ["ward-data"] });
      }
    };
    const t = setInterval(check, 60_000);
    document.addEventListener("visibilitychange", check);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", check);
    };
  }, [queryClient]);


  /**
   * Live 24 h rainfall load driving the risk map: what has already fallen in
   * the last 24 h plus what the nowcast expects in the next hour. When the rain
   * stops, this falls back down and the map recolours by itself.
   */
  const liveRainMm = rain
    ? Math.max(0, Math.round((rain.observedMm + rain.next60Mm) * 10) / 10)
    : undefined;

  // Once real data lands, start from the actual observed rainfall + full fleet.
  useEffect(() => {
    if (ward && !initialised) {
      setScenario(defaultScenario(ward));
      setInitialised(true);
    }
  }, [ward, initialised]);

  // Live mode: every poll pushes the measured rainfall into the risk model.
  useEffect(() => {
    if (followLive && liveRainMm !== undefined) {
      setScenario((s) => (s.rainMm === liveRainMm ? s : { ...s, rainMm: liveRainMm }));
    }
  }, [followLive, liveRainMm]);

  const scored = useMemo(() => (ward ? scoreSegments(ward, scenario) : []), [ward, scenario]);
  const plan = useMemo(
    () =>
      ward
        ? allocate(ward, scored, scenario)
        : ({
            assignments: [],
            unserved: [],
            coveredExposure: 0,
            totalExposure: 0,
            greedyExposure: 0,
            improvements: 0,
            method: "waiting for ward data",
          } satisfies AllocationResult),
    [ward, scored, scenario],
  );
  const selected = scored.find((s) => s.id === selectedId) ?? null;

  /**
   * Hospitals joined to the live risk map: a facility is only tagged when a
   * scored OSM road within 600 m is high or critical, so the flag always has a
   * named street behind it.
   */
  const hospitalRisk = useMemo(
    () => assessHospitals(hospitalQuery.data?.hospitals ?? [], scored, WARD.center),
    [hospitalQuery.data, scored],
  );
  const urgent = useMemo(() => urgentHospitals(hospitalRisk), [hospitalRisk]);
  const inWard = useMemo(
    () => hospitalRisk.filter((h) => h.status !== "unknown"),
    [hospitalRisk],
  );
  /**
   * Map markers are deliberately NOT the whole city register. Only facilities
   * whose mapped approach roads are actually flagged by today's rainfall get a
   * marker — everything else would just bury the street colours.
   */
  const mapHospitals = useMemo(() => {
    // Only facilities today's rainfall actually threatens get a marker. When
    // nothing is urgent we fall back to the "watch" tier so the layer is never
    // silently empty — but the full city register stays off the map.
    if (urgent.length) return urgent;
    return hospitalRisk.filter((h) => h.status === "watch").slice(0, 25);
  }, [hospitalRisk, urgent]);


  /**
   * De-silting list, ordered by the *baseline* risk so a street does not jump
   * out from under the cursor the moment you toggle it.
   */
  const desiltCandidates = useMemo(
    () =>
      [...scored]
        .sort((a, b) => b.base_risk - a.base_risk || a.id.localeCompare(b.id))
        .slice(0, 10),
    [scored],
  );

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

  /** Real refresh: bypasses the server-side cache and re-hits every upstream. */
  const refreshFeeds = async () => {
    setRefreshing(true);
    try {
      const fresh = (await fetchWard({ data: { refresh: true } })) as WardData;
      queryClient.setQueryData(["ward-data"], fresh);
      await queryClient.invalidateQueries({ queryKey: ["rain-now"] });
      await queryClient.invalidateQueries({ queryKey: ["routes"] });
    } finally {
      setRefreshing(false);
    }
  };

  const secondsAgo = rain
    ? Math.max(0, Math.round((tick - new Date(rain.fetchedAt).getTime()) / 1000))
    : 0;


  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col overflow-hidden bg-background text-foreground">
      <header className="grid shrink-0 grid-cols-1 items-center gap-x-6 gap-y-2 border-b border-border bg-card px-3 py-2.5 sm:px-5 sm:py-3 lg:grid-cols-[minmax(0,1fr)_auto]">

        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
            <Waves className="size-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold leading-tight tracking-tight sm:text-base">
              JalNiti{" "}
              <span className="hidden text-muted-foreground sm:inline">
                · Ward Flood Response Console
              </span>
            </h1>
            <p className="truncate text-[11px] text-muted-foreground sm:text-xs">
              {WARD.name}, {WARD.city} — live OSM · SRTM · OSRM · rainfall ·{" "}
              {ward ? `updated ${istStamp(ward.fetchedAt)}` : "loading…"}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm lg:justify-end lg:gap-x-5">

          <div className="flex items-center gap-2">
            <span
              className={`size-2 rounded-full ${
                rain?.raining ? "animate-pulse bg-[#1f6f8b]" : "bg-muted-foreground/50"
              }`}
            />
            <span className="leading-tight">
              <span className="block text-[10px] uppercase tracking-wide text-muted-foreground">
                Rain right now
              </span>
              <span className="block text-sm font-semibold tabular-nums">
                {rain
                  ? rain.raining
                    ? `${rain.nowMmPerHr} mm/h`
                    : "Dry"
                  : rainQuery.isError
                    ? "Feed down"
                    : "Checking…"}
                <span className="ml-1 text-[10px] font-normal text-muted-foreground">
                  {rain
                    ? `updated ${secondsAgo}s ago`
                    : rainQuery.isError
                      ? "retrying"
                      : "reading Open-Meteo"}
                </span>
              </span>

            </span>
          </div>
          <Stat
            icon={<Droplets className="size-4" />}
            label={followLive ? "Live 24 h load" : "Scenario rain"}
            value={`${scenario.rainMm} mm`}
          />
          <Stat
            className="hidden sm:flex"
            icon={<TriangleAlert className="size-4" />}
            label="Critical + high"
            value={`${(counts.critical ?? 0) + (counts.high ?? 0)} streets`}
          />
          <Stat
            className="hidden md:flex"
            icon={<Truck className="size-4" />}
            label="Trucks"
            value={`${scenario.trucksAvailable}`}
          />
          <Stat
            className="hidden md:flex"
            icon={<MapPin className="size-4" />}
            label="Coverage"
            value={`${coverage}%`}
          />

          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onClick={refreshFeeds}
            disabled={refreshing}
          >
            <RefreshCw className={`size-3.5 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing" : "Refresh"}
          </Button>
        </div>

      </header>

      {wardQuery.isError && (
        <div className="flex items-center gap-3 border-b border-destructive/40 bg-destructive/10 px-5 py-2 text-xs text-destructive">
          <TriangleAlert className="size-4 shrink-0" />
          <span className="flex-1">
            Live data fetch failed: {(wardQuery.error as Error).message}. The public OSM / DEM
            endpoints rate-limit; retry in a moment.
          </span>
          <Button size="sm" variant="outline" className="h-7" onClick={refreshFeeds}>
            Retry
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden lg:flex-row">
        <div className="relative min-h-[45dvh] flex-1 lg:min-h-0">

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
              clearedIds={scenario.drainsCleared}
              closedIds={scenario.closed}
              hospitals={mapHospitals}
              showHospitals={showHospitals}
            />
          )}

          <Card className="absolute bottom-3 left-3 z-[500] max-h-[min(60%,20rem)] w-[min(15rem,calc(100%-1.5rem))] gap-2 overflow-y-auto p-2.5 text-[11px] shadow-lg sm:bottom-4 sm:left-4 sm:p-3 sm:text-xs">
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
            <p className="text-[10px] text-muted-foreground">
              Green = safe to drive at the current rainfall.
            </p>
            <Separator className="my-1" />
            <label className="flex items-center gap-2">
              <Switch checked={showHospitals} onCheckedChange={setShowHospitals} />
              <span className="text-muted-foreground">
                Hospitals at risk ({mapHospitals.length} of {hospitalRisk.length} mapped) ·{" "}
                {Math.min(10, urgent.length)} labelled
              </span>
            </label>
            <Separator className="my-1" />
            <label className="flex items-center gap-2">
              <Switch checked={showRoutes} onCheckedChange={setShowRoutes} />
              <span className="text-muted-foreground">
                Road routes {routesQuery.isFetching ? "(routing…)" : ""}
              </span>
            </label>
            {showRoutes && (
              <div className="space-y-1 pt-1">
                <div className="flex items-center gap-2">
                  <span className="h-[3px] w-6 rounded-full bg-[#1f6f8b]" />
                  <span className="text-muted-foreground">Current leg</span>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className="h-[3px] w-6 rounded-full"
                    style={{
                      backgroundImage:
                        "repeating-linear-gradient(to right, #7b5ea7 0 3px, transparent 3px 7px)",
                    }}
                  />
                  <span className="text-muted-foreground">Next suggested leg</span>
                </div>
              </div>
            )}
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
            <TabsList className="m-3 grid grid-cols-5">
              <TabsTrigger value="risk">Risk</TabsTrigger>
              <TabsTrigger value="hospitals">Care</TabsTrigger>
              <TabsTrigger value="plan">Allocation</TabsTrigger>
              <TabsTrigger value="whatif">What-if</TabsTrigger>
              <TabsTrigger value="data">Data</TabsTrigger>
            </TabsList>

            {/* ---- Module 1: per-street risk ---- */}
            <TabsContent value="risk" className="min-h-0 flex-1">
              <ScrollArea className="h-full px-3 pb-4">
                <p className="pb-2 text-xs text-muted-foreground">
                  {scored.length} real OSM street segments, ranked by a waterlogging{" "}
                  <strong>risk index</strong> (0–100) at {scenario.rainMm} mm/24h. The index is a
                  weighted score of measured terrain and network features — distance to water,
                  slope, elevation and road density — not a validated probability. Read it as
                  "pump this street before that one", never as "this street will flood".
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

            {/* ---- Hospitals exposed by the current risk map ---- */}
            <TabsContent value="hospitals" className="min-h-0 flex-1">
              {/* Radix sizes the viewport child as a table, which lets long
                  hospital names push past the panel — force block layout. */}
              <ScrollArea className="h-full px-3 pb-4 [&_[data-radix-scroll-area-viewport]>div]:!block">

                <Card className="mb-3 w-full gap-1 overflow-hidden p-3 text-xs break-words">
                  <p className="flex items-center gap-2 text-sm font-medium">
                    <Cross className="size-4" /> {hospitalRisk.length} hospitals in Ahmedabad
                  </p>
                  <p className="text-muted-foreground">
                    {hospitalQuery.data?.note ?? "Loading OpenStreetMap hospital register…"}
                  </p>
                  <p className="text-muted-foreground">
                    {inWard.length} sit within 600 m of a scored street in this ward — only those can
                    be assessed. {urgent.length} are tagged on the map right now.
                  </p>
                </Card>

                {urgent.length === 0 && (
                  <p className="pb-3 text-xs text-muted-foreground">
                    No hospital currently has a high or critical approach road at{" "}
                    {scenario.rainMm} mm/24h.
                  </p>
                )}

                <div className="space-y-1.5">
                  {(urgent.length > 0 ? urgent : inWard.slice(0, 25)).map((h) => (
                    <div
                      key={h.id}
                      className="w-full overflow-hidden rounded-md border border-border px-3 py-2 break-words"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="min-w-0 flex-1 truncate text-sm font-medium">{h.name}</span>
                        <span
                          className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium text-white"
                          style={{ backgroundColor: STATUS_META[h.status].color }}
                        >
                          {STATUS_META[h.status].label}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {h.worstRoad ? `worst approach: ${h.worstRoad} · ` : ""}
                        {h.approachRoads} scored approach road
                        {h.approachRoads === 1 ? "" : "s"}
                        {h.emergency ? " · emergency dept" : ""}
                        {h.beds ? ` · ${h.beds} beds` : ""}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {STATUS_META[h.status].note}{" "}
                        <a
                          className="underline"
                          href={`https://www.openstreetmap.org/${
                            h.id.startsWith("W") ? "way" : h.id.startsWith("R") ? "relation" : "node"
                          }/${h.id.slice(1)}`}
                          target="_blank"
                          rel="noreferrer"
                        >
                          OSM {h.id}
                        </a>
                      </p>
                    </div>
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
                    shift, using OSRM road-network durations.
                  </p>
                  <p className="text-muted-foreground">
                    Solver: {plan.method}. {plan.improvements} improving moves accepted;{" "}
                    {plan.greedyExposure > 0
                      ? `${Math.max(0, Math.round(((plan.coveredExposure - plan.greedyExposure) / plan.greedyExposure) * 100))}% more exposure covered than nearest-truck greedy`
                      : "greedy baseline covered nothing"}
                    .
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
                  <Card className="gap-2 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium">Live rainfall feed</p>
                      <Badge variant={rain?.raining ? "default" : "secondary"} className="text-[10px]">
                        {rain ? (rain.raining ? "Raining now" : "No rain now") : "…"}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted-foreground">
                      <span>Rate now</span>
                      <span className="text-right tabular-nums text-foreground">
                        {rain ? `${rain.nowMmPerHr} mm/h` : "—"}
                      </span>
                      <span>Last 60 min</span>
                      <span className="text-right tabular-nums text-foreground">
                        {rain ? `${rain.last60Mm} mm` : "—"}
                      </span>
                      <span>Next 60 min (nowcast)</span>
                      <span className="text-right tabular-nums text-foreground">
                        {rain ? `${rain.next60Mm} mm` : "—"}
                      </span>
                      <span>Last 24 h observed</span>
                      <span className="text-right tabular-nums text-foreground">
                        {rain ? `${rain.observedMm} mm` : "—"}
                      </span>
                      <span>Next 24 h forecast</span>
                      <span className="text-right tabular-nums text-foreground">
                        {rain ? `${rain.forecastMm} mm` : "—"}
                      </span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Station time {rain?.observedAt || "—"} IST · polled every 60 s · last poll{" "}
                      {secondsAgo}s ago{rainQuery.isFetching ? " · updating…" : ""}
                    </p>
                  </Card>

                  <Field
                    label="Rainfall driving the map"
                    value={`${scenario.rainMm} mm / 24 h`}
                    hint={
                      followLive
                        ? "Following the live feed: observed last 24 h + the next hour's nowcast. When the rain stops, the map recolours on the next poll."
                        : "Manual what-if value. Turn 'Follow live feed' back on to return to measured rainfall."
                    }
                  >
                    <label className="flex items-center gap-2 pb-1 text-xs">
                      <Switch checked={followLive} onCheckedChange={setFollowLive} />
                      <span className="text-muted-foreground">
                        Follow live feed{liveRainMm !== undefined ? ` (${liveRainMm} mm)` : ""}
                      </span>
                    </label>
                    <Slider
                      min={0}
                      max={200}
                      step={1}
                      value={[scenario.rainMm]}
                      onValueChange={([v]) => {
                        setFollowLive(false);
                        set({ rainMm: v });
                      }}
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
                      {desiltCandidates.map((s) => {
                        const on = scenario.drainsCleared.includes(s.id);
                        const before = Math.round(Math.min(0.99, (s.risk / (on ? 0.7 : 1))) * 100);
                        const after = Math.round(s.risk * 100 * (on ? 1 : 0.7));
                        return (
                          <label
                            key={s.id}
                            className={`flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                              on ? "bg-accent" : "hover:bg-accent/60"
                            }`}
                          >
                            <Switch
                              checked={on}
                              onCheckedChange={() => toggleIn("drainsCleared", s.id)}
                            />
                            <span className="min-w-0 flex-1 truncate">{s.name}</span>
                            <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                              {on ? (
                                <>
                                  <span className="line-through">{before}%</span>{" "}
                                  <span className="font-semibold text-foreground">
                                    {Math.round(s.risk * 100)}%
                                  </span>
                                </>
                              ) : (
                                <>
                                  {Math.round(s.risk * 100)}% → {after}%
                                </>
                              )}
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <div className="flex items-center justify-between pt-2 text-xs text-muted-foreground">
                      <span>
                        {scenario.drainsCleared.length} segment
                        {scenario.drainsCleared.length === 1 ? "" : "s"} de-silted (dashed on the map)
                      </span>
                      {scenario.drainsCleared.length > 0 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => set({ drainsCleared: [] })}
                        >
                          Clear all
                        </Button>
                      )}
                    </div>
                  </div>

                  <Card className="gap-2 p-3">
                    <p className="text-sm font-medium">Observed rainfall, last 12 h</p>
                    {rain && rain.rainSeries.length > 0 ? (
                      <>
                        <div className="flex h-16 items-end gap-1">
                          {rain.rainSeries.map((r) => {
                            const peak = Math.max(1, ...rain.rainSeries.map((x) => x.mm));
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
                          {rain.rainSeries[0].hour} → {rain.rainSeries[rain.rainSeries.length - 1].hour} IST
                        </p>
                      </>
                    ) : (
                      <p className="text-xs text-muted-foreground">Rainfall feed loading…</p>
                    )}
                  </Card>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => {
                      setScenario({ ...defaultScenario(ward), rainMm: liveRainMm ?? scenario.rainMm });
                      setFollowLive(true);
                    }}
                  >
                    Reset to the live feed
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
                          This response assembled {istStamp(ward.fetchedAt)}
                          {ward.geometryCapturedAt
                            ? ` · street/terrain layer replayed from the capture of ${istStamp(ward.geometryCapturedAt)} (roads and elevation do not change day to day) · rainfall and risk are today's`
                            : " · fetched live from OSM / SRTM / OSRM"}{" "}
                          · rainfall re-read every 60 s, street layer every 30 min
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
                      onClick={refreshFeeds}
                      disabled={refreshing}
                    >
                      {refreshing ? "Refreshing…" : "Refresh feeds"}
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

function Stat({
  icon,
  label,
  value,
  className = "",
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 items-center gap-2 ${className}`}>
      <span className="shrink-0 text-muted-foreground">{icon}</span>
      <span className="min-w-0 leading-tight">
        <span className="block truncate text-[10px] uppercase tracking-wide text-muted-foreground">
          {label}
        </span>
        <span className="block truncate text-sm font-semibold tabular-nums">{value}</span>
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
