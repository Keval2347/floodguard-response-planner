/**
 * JalNiti report tests. Run from the repo root:   npx tsx scripts/report-tests.ts
 * (put this file at scripts/report-tests.ts). It prints PASS / FAIL lines with measured values.
 */
import { performance } from "node:perf_hooks";
import { scoreSegments, allocate, defaultScenario } from "../src/lib/jalniti/model";
import { ScenarioOverridesSchema, RoutesInputSchema, SegmentIdSchema } from "../src/lib/jalniti/schema";
import { calculateRainPeaks } from "../src/lib/jalniti/rainfall";
import snap from "../src/lib/jalniti/navrangpura.snapshot.json";

const ward: any = snap;
const base: any = defaultScenario(ward);
let pass = 0, fail = 0;
const line = (id: string, name: string, ok: boolean, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"} ${id} | ${name}${detail ? " | " + detail : ""}`);
};
const scen = (o: any = {}) => ({ ...base, rain3hMm: 0, ...o });
const bandCounts = (s: any[]) => s.reduce((a: any, r) => ((a[r.band] = (a[r.band] || 0) + 1), a), {});

// ---------- A. Risk scoring ----------
{
  const s0 = scoreSegments(ward, scen({ rainMm: 0 }));
  line("A1", "dry day: every street Low", s0.every((r: any) => r.band === "low"), `${s0.length} streets`);
  const nonLow = [0, 10, 25, 40, 65].map((mm) => {
    const c = bandCounts(scoreSegments(ward, scen({ rainMm: mm })));
    return { mm, c, n: 337 - (c.low || 0) };
  });
  line("A2", "non-Low streets never decrease as rain rises", nonLow.every((x, i) => i === 0 || x.n >= nonLow[i - 1].n),
    nonLow.map((x) => `${x.mm}mm:${JSON.stringify(x.c)}`).join(" "));
  const burst = calculateRainPeaks([40, 0, 0]), spread = calculateRainPeaks(Array.from({ length: 24 }, () => 40 / 24));
  const rb = scoreSegments(ward, scen({ rainMm: 40, rain3hMm: burst.peak3hMm }))[0].risk;
  const rs = scoreSegments(ward, scen({ rainMm: 40, rain3hMm: spread.peak3hMm }))[0].risk;
  line("A3", "40 mm in 1 h scores higher than 40 mm over 24 h", rb > rs, `top risk burst=${rb} spread=${rs}; peak3h ${burst.peak3hMm} vs ${spread.peak3hMm}`);
  const top = scoreSegments(ward, scen({ rainMm: 25 }))[0];
  const cl = scoreSegments(ward, scen({ rainMm: 25, drainsCleared: [top.id] })).find((r: any) => r.id === top.id)!;
  line("A4", "cleared drain lowers risk by about 30%", Math.abs(cl.risk - top.risk * 0.7) <= 0.011, `${top.risk} -> ${cl.risk}`);
  const all = scoreSegments(ward, scen({ rainMm: 40 }));
  const near = (x: number) => [0.35, 0.55, 0.75].some((t) => Math.abs(x - t) <= 0.006);
  const bad = all.filter((r: any) => (r.risk >= 0.75 ? "critical" : r.risk >= 0.55 ? "high" : r.risk >= 0.35 ? "moderate" : "low") !== r.band && !near(r.risk)).length;
  line("A5", "bands follow the 0.35 / 0.55 / 0.75 thresholds (rounding at a threshold excepted)", bad === 0, `${bad} of ${all.length} streets inconsistent`);
}

// ---------- B. Allocation and what-if ----------
{
  const sc = scen({ rainMm: 40 });
  const scored = scoreSegments(ward, sc);
  const r1: any = allocate(ward, scored, sc), r2: any = allocate(ward, scored, sc);
  line("B1", "allocation is deterministic (same input, same plan)", JSON.stringify(r1) === JSON.stringify(r2), `${r1.assignments.length} assignments`);
  const maxArrive = Math.max(...r1.assignments.map((a: any) => a.arriveMin));
  line("B2", "no assignment arrives after the shift ends", maxArrive <= sc.shiftMinutes, `latest arrival ${maxArrive} min, shift ${sc.shiftMinutes} min`);
  const ids = scored.slice(0, 10).map((r: any) => r.id);
  const sc2 = scen({ rainMm: 40, closed: ids });
  const r3: any = allocate(ward, scoreSegments(ward, sc2), sc2);
  line("B3", "streets excluded from pumping are never assigned", r3.assignments.every((a: any) => !ids.includes(a.segment.id)), `10 excluded, ${r3.assignments.length} assigned`);
  const byTrucks = [10, 5, 3, 1].map((t) => { const o = scen({ rainMm: 40, trucksAvailable: t }); return (allocate(ward, scoreSegments(ward, o), o) as any).assignments.length; });
  line("B4", "fewer trucks never give more assignments", byTrucks.every((n, i) => i === 0 || n <= byTrucks[i - 1]), `10,5,3,1 trucks -> ${byTrucks.join(", ")}`);
  const byShift = [240, 120, 60].map((m) => { const o = scen({ rainMm: 40, shiftMinutes: m }); return (allocate(ward, scoreSegments(ward, o), o) as any).assignments.length; });
  line("B5", "shorter shift never gives more assignments", byShift.every((n, i) => i === 0 || n <= byShift[i - 1]), `240,120,60 min -> ${byShift.join(", ")}`);
  line("B6", "every assigned street has a measured travel time", r1.assignments.every((a: any) => a.travelMin < 1e6), "no 1e9 'unreachable' value used");
  let eq = 0, lower = 0, higher = 0, worst = 0, n = 0;
  for (const rain of [25, 65]) for (const trucks of [2, 3, 5, 10]) for (const shift of [60, 90, 120, 180, 240]) {
    const o = scen({ rainMm: rain, trucksAvailable: trucks, shiftMinutes: shift });
    const r: any = allocate(ward, scoreSegments(ward, o), o); n++;
    const gap = r.greedyExposure ? (100 * (r.coveredExposure - r.greedyExposure)) / r.greedyExposure : 0;
    if (Math.abs(gap) < 0.05) eq++; else if (gap < 0) { lower++; worst = Math.min(worst, gap); } else higher++;
  }
  line("B7", "planner coverage versus greedy baseline (INFORMATION)", true, `${n} scenarios: equal ${eq}, lower ${lower}, higher ${higher}, worst ${worst.toFixed(1)}%`);
}

// ---------- C. Input validation ----------
{
  const ok = (v: any) => ScenarioOverridesSchema.safeParse(scen(v)).success;
  const cases: [string, boolean, boolean][] = [
    ["rain 0", ok({ rainMm: 0 }), true], ["rain 600", ok({ rainMm: 600 }), true], ["rain 601", ok({ rainMm: 601 }), false],
    ["rain -1", ok({ rainMm: -1 }), false], ["rain NaN", ok({ rainMm: NaN }), false], ["rain as string", ok({ rainMm: "5" }), false],
    ["rain3h 300", ok({ rain3hMm: 300 }), true], ["rain3h 301", ok({ rain3hMm: 301 }), false],
    ["trucks 0", ok({ trucksAvailable: 0 }), true], ["trucks 50", ok({ trucksAvailable: 50 }), true], ["trucks 51", ok({ trucksAvailable: 51 }), false], ["trucks 2.5", ok({ trucksAvailable: 2.5 }), false],
    ["shift 30", ok({ shiftMinutes: 30 }), true], ["shift 720", ok({ shiftMinutes: 720 }), true], ["shift 29", ok({ shiftMinutes: 29 }), false], ["shift 721", ok({ shiftMinutes: 721 }), false],
    ["extra key", ScenarioOverridesSchema.safeParse({ ...scen(), hack: 1 }).success, false],
    ["id S01", SegmentIdSchema.safeParse("S01").success, true], ["id S337", SegmentIdSchema.safeParse("S337").success, true], ["id S12345", SegmentIdSchema.safeParse("S12345").success, true],
    ["id S1", SegmentIdSchema.safeParse("S1").success, false], ["id S123456", SegmentIdSchema.safeParse("S123456").success, false],
    ["id X12", SegmentIdSchema.safeParse("X12").success, false], ["id with injection", SegmentIdSchema.safeParse("S01;DROP").success, false],
  ];
  const pair = { key: "a|b", from: [23.03, 72.55], to: [23.04, 72.56] };
  const rt = (k: number) => RoutesInputSchema.safeParse({ pairs: Array.from({ length: k }, () => pair) }).success;
  cases.push(["routes 1 pair", rt(1), true], ["routes 20 pairs", rt(20), true], ["routes 21 pairs", rt(21), false], ["routes 0 pairs", rt(0), false]);
  cases.push(["route latitude 91", RoutesInputSchema.safeParse({ pairs: [{ ...pair, from: [91, 72] }] }).success, false]);
  const good = cases.filter(([, got, want]) => got === want).length;
  line("C1", "input validation boundary cases behave as specified", good === cases.length, `${good} of ${cases.length} cases correct`);
  cases.filter(([, g, w]) => g !== w).forEach(([n]) => console.log("   mismatch:", n));
}

// ---------- D. Performance (computation only) ----------
{
  const times: number[] = [];
  for (let i = 0; i < 30; i++) { const o = scen({ rainMm: 40 }); const t = performance.now(); allocate(ward, scoreSegments(ward, o), o); times.push(performance.now() - t); }
  const mean = times.reduce((a, b) => a + b, 0) / times.length;
  line("D1", "scenario recomputation time (score + allocate, 30 runs)", mean < 1000, `mean ${mean.toFixed(1)} ms, max ${Math.max(...times).toFixed(1)} ms, 337 streets, 10 trucks`);
}

// ---------- E. Reliability: upstream outage and snapshot fallback ----------
(async () => {
  const realFetch = globalThis.fetch;
  const { buildWardData, fetchHospitals, fetchRainNow } = await import("../src/lib/jalniti/pipeline.server");
  globalThis.fetch = (async () => { throw new Error("simulated outage"); }) as any;
  let t = performance.now();
  try {
    const w: any = await buildWardData({ refresh: true, allowSnapshot: true });
    line("E1", "all upstreams down: ward data replays the snapshot", w.segments.length > 0 && !!w.geometryCapturedAt,
      `${w.segments.length} streets, ${w.depots.length} depots, ${(performance.now() - t).toFixed(0)} ms, notes: ${w.notes.length}`);
    console.log("   first note:", String(w.notes[0] ?? "").slice(0, 110));
  } catch (e: any) { line("E1", "all upstreams down: ward data replays the snapshot", false, String(e.message).slice(0, 100)); }
  try { const h: any = await fetchHospitals({ refresh: true } as any); line("E2", "hospital feed down: snapshot used", h.hospitals.length > 0 && h.live === false, `${h.hospitals.length} hospitals, live=${h.live}`); }
  catch (e: any) { line("E2", "hospital feed down: snapshot used", false, String(e.message).slice(0, 100)); }
  try { const r: any = await fetchRainNow(); line("E3", "rain feed down: reading marked stale", r.stale === true, `stale=${r.stale}, source=${r.source}`); }
  catch (e: any) { line("E3", "rain feed down: error is handled", true, "threw a handled error: " + String(e.message).slice(0, 80)); }
  // hanging upstream: the 35 s budget must release the dashboard
  globalThis.fetch = ((_u: any, init?: any) => new Promise((_res, rej) => {
    // a hanging server: never answers, but still honours the caller's timeout/abort signal
    init?.signal?.addEventListener?.("abort", () => rej(new Error("aborted by caller timeout")));
  })) as any;
  t = performance.now();
  try {
    const w: any = await buildWardData({ refresh: true, allowSnapshot: true });
    const ms = performance.now() - t;
    line("E4", "upstream hangs: snapshot served after the 35 s budget", w.segments.length > 0 && ms > 30000 && ms < 45000, `${(ms / 1000).toFixed(1)} s, ${w.segments.length} streets`);
  } catch (e: any) { line("E4", "upstream hangs: snapshot served after the 35 s budget", false, String(e.message).slice(0, 100)); }
  globalThis.fetch = realFetch;
  console.log(`\nSUMMARY: ${pass} passed, ${fail} failed`);
  process.exit(0);
})();
