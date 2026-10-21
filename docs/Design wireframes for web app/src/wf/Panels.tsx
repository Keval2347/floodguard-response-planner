import { Badge, Btn, Card, Icon, N, Slider, Toggle, TierBar, type Tier } from './primitives'

type P = { annotate?: boolean }
const A = ({ on, n, className = '' }: { on?: boolean; n: string; className?: string }) => (on ? <N n={n} className={className} /> : null)

/* ---------------- Risk ---------------- */
const streets: [string, string, string, string, Tier][] = [
  ['Ashram Road', '333 m to water', '1.02% slope', '55.7 m', 'low'],
  ['120 Feet Ring Road', '2187 m to water', '0.63% slope', '52.3 m', 'low'],
  ['Kasturba Gandhi Road', '501 m to water', '0.89% slope', '50 m', 'low'],
  ['Income Tax Flyover', '305 m to water', '0.68% slope', '55.7 m', 'low'],
  ['Chimanlal Girdharlal Road', '1001 m to water', '0.23% slope', '52.3 m', 'low'],
  ['Gandhi Bridge', '58 m to water', '4.51% slope', '44.3 m', 'low'],
]

export function RiskPanel({ annotate = true }: P) {
  return (
    <div className="space-y-2.5">
      <div className="relative text-[10.5px] leading-snug text-neutral-600">
        337 real OSM street segments, ranked by a waterlogging <b className="text-neutral-900">risk index</b> (0–100) at 0 mm/24h and a peak
        of 0 mm/3h. Terrain and network features — distance to water, slope, elevation and road density — shape the relative street
        scores. Read it as "pump this street before that one", never as "this street will flood".
        <A on={annotate} n="R1" className="absolute -right-1 top-0" />
      </div>
      <div className="relative flex items-center gap-1.5">
        <span className="flex flex-1 items-center gap-1.5 rounded-md border border-neutral-300 px-2 py-1 text-[10px] text-neutral-400">
          <Icon name="search" size={11} /> Filter streets…
        </span>
        <span className="rounded-md border border-neutral-300 px-2 py-1 text-[10px] text-neutral-600">Sort: Risk ▾</span>
        <A on={annotate} n="R2" className="absolute -right-1 -top-2" />
      </div>
      <div className="relative divide-y divide-neutral-200 rounded-md border border-neutral-300">
        {streets.map(([name, w, s, e, tier], i) => (
          <div key={i} className={`flex items-stretch gap-2.5 px-2.5 py-1.5 ${i === 0 ? 'bg-neutral-50' : ''}`}>
            <span className="w-3 pt-0.5 font-mono text-[10px] text-neutral-400">{i + 1}</span>
            <TierBar tier={tier} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-[11.5px] font-semibold text-neutral-900">{name}</div>
              <div className="truncate text-[9.5px] text-neutral-500">
                {w} · {s} · {e}
              </div>
            </div>
            <span className="self-center text-[11px] font-semibold text-neutral-900">1%</span>
          </div>
        ))}
        <div className="px-2.5 py-1 text-center text-[9.5px] text-neutral-400">Showing 6 of 337 · scroll for more</div>
        {annotate && (
          <>
            <N n="R3" className="absolute -left-2 top-2" />
            <N n="R4" className="absolute left-[30px] top-[-8px]" />
            <N n="R5" className="absolute left-[38%] -top-2" />
            <N n="R6" className="absolute -right-2 top-3" />
          </>
        )}
      </div>
    </div>
  )
}

/* ---------------- Care ---------------- */
const hospitals: [string, string, number, string, boolean][] = [
  ['Super Surgical Hospital, Ahmedabad', 'Chimanlal Girdharlal Road', 30, 'N6978013050', false],
  ['The Holistic Medical Centre Ayulink Ayurveda Hospital', 'Chimanlal Girdharlal Road', 40, 'N6979940478', false],
  ['Hari Urosurgical Hospital and Andrology Centre', 'Chimanlal Girdharlal Road', 39, 'N6972590229', false],
]

export function HospitalCard({ name, road, n, osm, risk }: { name: string; road: string; n: number; osm: string; risk: boolean }) {
  return (
    <Card className={`py-2 ${risk ? 'border-neutral-700 border-l-[3px]' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11.5px] font-semibold leading-tight text-neutral-900">{name}</span>
        <Badge filled={!risk}>{risk ? 'Approach at risk' : 'Approach clear'}</Badge>
      </div>
      <div className="mt-0.5 text-[10px] text-neutral-500">
        worst approach: {road} · {n} scored approach roads
      </div>
      <div className="mt-0.5 text-[9px] text-neutral-500">
        {risk ? 'Approach is High risk — prioritise for pumping.' : 'All mapped approach roads score low.'}{' '}
        <span className="underline">OSM {osm}</span>
      </div>
    </Card>
  )
}

export function CarePanel({ annotate = true }: P) {
  return (
    <div className="space-y-2.5">
      <Card className="relative">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-neutral-900">
          <Icon name="hospital" size={14} /> 739 hospitals in Ahmedabad
        </div>
        <div className="mt-1 text-[10px] leading-snug text-neutral-500">
          Live hospital data unavailable — using the committed OSM hospital capture (739 facilities, Overpass API — amenity=hospital,
          Ahmedabad bbox). 219 sit within 600 m of a scored street in this ward — only those can be assessed. 0 are tagged on the map
          right now.
        </div>
        <A on={annotate} n="C1" className="absolute -right-2 -top-2" />
      </Card>
      <div className="relative text-[10px] text-neutral-500">
        No hospital currently has a high or critical approach road at 0 mm/24h.
        <A on={annotate} n="C2" className="absolute -right-1 -top-1" />
      </div>
      <div className="relative space-y-2">
        {hospitals.map(([name, road, n, osm, risk]) => (
          <HospitalCard key={osm} name={name} road={road} n={n} osm={osm} risk={risk} />
        ))}
        {annotate && (
          <>
            <N n="C3" className="absolute -left-2 top-2" />
            <N n="C4" className="absolute right-0 -top-2" />
            <N n="C5" className="absolute -left-2 top-[46px]" />
            <N n="C6" className="absolute left-[55%] top-[52px]" />
          </>
        )}
      </div>
    </div>
  )
}

/* ---------------- Trucks ---------------- */
export function TrucksPanel({ annotate = true, populated = false }: P & { populated?: boolean }) {
  if (!populated) {
    return (
      <Card className="relative">
        <div className="text-[12px] font-semibold text-neutral-900">0 assignments · 0 unserved</div>
        <div className="mt-1 text-[10px] leading-snug text-neutral-500">
          Covers 0% of exposed road-length within a 240-minute shift, using OSRM road-network durations.
          <br />
          Solver: no trucks or no qualifying streets. 0 improving moves accepted; greedy baseline covered nothing.
        </div>
        <A on={annotate} n="T1" className="absolute -right-2 -top-2" />
        <A on={annotate} n="T2" className="absolute -right-2 top-[44px]" />
      </Card>
    )
  }
  const trucks = [
    ['Truck 1', 'Depot A · Usmanpura', ['Ashram Road', 'Gandhi Bridge', 'Income Tax Flyover'], '212 / 240 min'],
    ['Truck 2', 'Depot B · Navrangpura', ['Kasturba Gandhi Road', 'CG Road'], '168 / 240 min'],
    ['Truck 3', 'Depot C · Riverfront', ['Sabarmati Riverfront Rd'], '95 / 240 min'],
  ] as const
  return (
    <div className="space-y-2.5">
      <Card className="relative">
        <div className="text-[12px] font-semibold text-neutral-900">7 assignments · 2 unserved</div>
        <div className="mt-1 text-[10px] leading-snug text-neutral-500">
          Covers 68% of exposed road-length within a 240-minute shift. Solver: 14 improving moves accepted over greedy baseline.
        </div>
        <div className="mt-2 flex h-2 overflow-hidden rounded-full bg-neutral-200">
          <span className="w-[68%] bg-neutral-800" />
        </div>
        <A on={annotate} n="T1" className="absolute -right-2 -top-2" />
      </Card>
      <div className="relative space-y-2">
        {trucks.map(([t, depot, stops, time]) => (
          <Card key={t} className="py-2">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-[11.5px] font-semibold text-neutral-900">
                <Icon name="truck" size={13} /> {t}
              </span>
              <span className="font-mono text-[9.5px] text-neutral-500">{time}</span>
            </div>
            <div className="text-[9.5px] text-neutral-500">{depot}</div>
            <ol className="mt-1.5 space-y-0.5 border-l border-dashed border-neutral-400 pl-2.5">
              {stops.map((s, i) => (
                <li key={s} className="relative text-[10px] text-neutral-700">
                  <span className="absolute -left-[14px] top-[4px] h-[7px] w-[7px] rounded-full border border-neutral-600 bg-white" />
                  {i + 1}. {s} <span className="text-neutral-400">· 30 min pump</span>
                </li>
              ))}
            </ol>
          </Card>
        ))}
        {annotate && (
          <>
            <N n="T3" className="absolute -left-2 top-2" />
            <N n="T4" className="absolute -right-2 top-2" />
            <N n="T5" className="absolute -left-2 top-[46px]" />
          </>
        )}
      </div>
      <Card className="relative border-dashed py-2">
        <div className="text-[10.5px] font-semibold text-neutral-900">Unserved (2)</div>
        <div className="text-[9.5px] text-neutral-500">120 Feet Ring Road · Chimanlal Girdharlal Road — exceed shift window</div>
        <A on={annotate} n="T6" className="absolute -right-2 -top-2" />
      </Card>
    </div>
  )
}

/* ---------------- What-if ---------------- */
function Row({ l, v }: { l: string; v: string }) {
  return (
    <div className="flex justify-between text-[10.5px]">
      <span className="text-neutral-500">{l}</span>
      <span className="text-neutral-900">{v}</span>
    </div>
  )
}

function SliderBlock({ title, value, pct, help, n, annotate, toggle }: { title: string; value: string; pct: number; help: string; n: string; annotate?: boolean; toggle?: boolean }) {
  return (
    <div className="relative">
      <div className="flex items-baseline justify-between">
        <span className="text-[11.5px] font-semibold text-neutral-900">{title}</span>
        <span className="text-[10.5px] text-neutral-500">{value}</span>
      </div>
      {toggle && (
        <div className="mt-1 flex items-center gap-1.5 text-[10px] text-neutral-600">
          <Toggle on /> Follow live feed (0 mm / 24 h · 0 mm / 3 h)
        </div>
      )}
      <Slider pct={pct} />
      <div className="text-[9.5px] leading-snug text-neutral-500">{help}</div>
      <A on={annotate} n={n} className="absolute -left-3 top-0" />
    </div>
  )
}

export function WhatIfPanel({ annotate = true }: P) {
  return (
    <div className="space-y-3">
      <Card className="relative">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-neutral-900">Live rainfall feed</span>
          <Badge>No rain now</Badge>
        </div>
        <Row l="Rate now" v="0 mm/h" />
        <Row l="Last 60 min" v="0 mm" />
        <Row l="Next 60 min (nowcast)" v="0 mm" />
        <Row l="Last 24 h observed" v="0 mm" />
        <Row l="Next 24 h forecast" v="0 mm" />
        <div className="mt-1 text-[8.5px] text-neutral-400">Station time 2026-10-20 23:45 IST · polled every 60 s · last poll 12s ago</div>
        <A on={annotate} n="W1" className="absolute -right-2 -top-2" />
      </Card>

      <Card className="relative">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[12px] font-semibold text-neutral-900">Scenario impact</span>
          <Badge>Live baseline</Badge>
        </div>
        <div className="grid grid-cols-[1fr_44px_54px] gap-y-0.5 text-[10.5px]">
          <span className="text-neutral-500">Outcome</span>
          <span className="text-right text-neutral-500">Live</span>
          <span className="text-right text-neutral-500">Scenario</span>
          {[
            ['Roads assigned', '0', '0'],
            ['Roads unserved', '0', '0'],
            ['Exposure covered', '0%', '0%'],
            ['At-risk hospitals', '0', '0'],
          ].map(([a, b, c]) => (
            <span key={a} className="contents">
              <span className="text-neutral-800">{a}</span>
              <span className="text-right text-neutral-600">{b}</span>
              <b className="text-right text-neutral-900">{c}</b>
            </span>
          ))}
        </div>
        <div className="mt-1 text-[8.5px] leading-snug text-neutral-400">
          Truck availability and shift length rebuild the assignments and routes; rainfall and de-silting rebuild road risk and hospital access.
        </div>
        <A on={annotate} n="W2" className="absolute -right-2 -top-2" />
      </Card>

      <SliderBlock annotate={annotate} n="W3" toggle title="Rainfall driving the map" value="0 mm / 24 h · 0 mm / 3 h" pct={0} help="Following the live feed: observed last 24 h + the next hour's nowcast. When the rain stops, the map recolours on the next poll." />
      <SliderBlock annotate={annotate} n="W4" title="Peak rainfall intensity" value="0 mm / 3 h" pct={0} help="Live rolling 3-hour peak from the weather feed: 0 mm." />
      <SliderBlock annotate={annotate} n="W5" title="Trucks available" value="10 of 10" pct={100} help="Fleet size is the project assumption — no Indian municipality publishes a live vehicle feed." />
      <SliderBlock annotate={annotate} n="W6" title="Shift length" value="240 min" pct={44} help="The optimizer only assigns work it can finish inside this window." />

      <div className="relative">
        <div className="text-[11.5px] font-semibold text-neutral-900">Pre-monsoon drain de-silting</div>
        <div className="text-[9.5px] leading-snug text-neutral-500">
          Assumed 30% risk reduction per cleared segment. Click streets on the map or pick from the top-risk list.
        </div>
        <div className="mt-1.5 space-y-0.5">
          {['Sabarmati Riverfront Road', 'Kasturba Gandhi Road', 'RiverFront Road', 'Sabarmati Riverfront Road', 'RiverFront Road'].map((s, i) => (
            <div key={i} className={`flex items-center gap-2 rounded px-1 py-[3px] ${i === 1 ? 'bg-neutral-100' : ''}`}>
              <Toggle on={i === 1} />
              <span className="flex-1 text-[10.5px] text-neutral-800">{s}</span>
              <span className="font-mono text-[9.5px] text-neutral-500">{i === 1 ? '1% → 0.7%' : '1% → 1%'}</span>
            </div>
          ))}
          <div className="px-1 text-[9px] text-neutral-400">… scrollable list of top-risk segments</div>
        </div>
        <div className="mt-1 text-[9.5px] text-neutral-500">1 segment de-silted (dashed on the map)</div>
        <A on={annotate} n="W7" className="absolute -left-3 top-0" />
        <A on={annotate} n="W8" className="absolute -right-1 top-[54px]" />
        <A on={annotate} n="W9" className="absolute -left-3 bottom-0" />
      </div>

      <Card className="relative">
        <div className="text-[11.5px] font-semibold text-neutral-900">Observed rainfall, last 12 h</div>
        <div className="text-[8.5px] text-neutral-400">Rolling peaks · 1 h: 0 mm · 3 h: 0 mm</div>
        <div className="mt-2 flex h-14 items-end gap-1 border-b border-neutral-400">
          {[0, 0, 1, 3, 6, 4, 2, 0, 0, 1, 0, 0].map((v, i) => (
            <span key={i} className="flex-1 rounded-t-[1px] border border-b-0 border-neutral-500 bg-neutral-200" style={{ height: `${Math.max(v * 14, 2)}%` }} />
          ))}
        </div>
        <div className="mt-0.5 flex justify-between font-mono text-[8.5px] text-neutral-400">
          <span>12:00</span>
          <span>→ 23:00 IST</span>
        </div>
        <A on={annotate} n="W10" className="absolute -right-2 -top-2" />
      </Card>

      <div className="relative">
        <Btn full icon="refresh">
          Reset to the live feed
        </Btn>
        <A on={annotate} n="W11" className="absolute -right-2 -top-2" />
      </div>
    </div>
  )
}

/* ---------------- Data ---------------- */
const sources = [
  ['OpenStreetMap / Overpass API', 'Real street centrelines, road classes and mapped waterways for the ward bbox.'],
  ['NASA SRTM 30 m DEM (OpenTopoData)', 'Per-segment elevation and slope, sampled at 3 points per street. GMTED2010 is the documented fallback.'],
  ['OSRM road-network router', 'Depot-to-street travel times and the actual driving routes drawn on the map (no straight lines).'],
  ['Open-Meteo (IMD-compatible obs + forecast)', 'Hourly observed rainfall, 24 h totals, and optional peak rolling 1 h / 3 h totals at the ward centroid.'],
]

export function DataPanel({ annotate = true }: P) {
  return (
    <div className="space-y-2.5">
      <Card className="relative">
        <div className="flex items-center gap-1.5 text-[12px] font-semibold text-neutral-900">
          <Icon name="db" size={13} /> Live fetch
        </div>
        <div className="mt-1 text-[9.5px] leading-snug text-neutral-500">
          Assembled 20 Oct 2026, 11:55 pm IST · street/terrain layer replayed from capture of 16 Sept 2026 · rainfall re-read every 60 s,
          street layer every 30 min
        </div>
        <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[9.5px] leading-snug text-neutral-600">
          <li>OpenStreetMap: 1998 road ways, 4 waterway ways</li>
          <li>Elevation: NASA SRTM 30 m sampled at 1011 points</li>
          <li>OSRM: exact 63×63 travel-time matrix for depots + 60 priority streets</li>
          <li>Rainfall: 5.6 mm observed last 24 h, 1.6 mm forecast next 24 h</li>
          <li>Live refresh unavailable — geometry replayed from capture</li>
        </ul>
        <div className="mt-2">
          <Btn full>Refresh feeds</Btn>
        </div>
        <A on={annotate} n="D1" className="absolute -right-2 -top-2" />
        <A on={annotate} n="D2" className="absolute -left-2 top-[78px]" />
        <A on={annotate} n="D3" className="absolute -right-2 bottom-3" />
      </Card>
      <div className="relative space-y-2">
        {sources.map(([t, d]) => (
          <Card key={t} className="py-2">
            <div className="text-[11px] font-semibold text-neutral-900 underline">{t}</div>
            <div className="text-[9.5px] leading-snug text-neutral-500">{d}</div>
          </Card>
        ))}
        <A on={annotate} n="D4" className="absolute -left-2 top-2" />
      </div>
      <div className="relative flex gap-2 rounded-md border border-neutral-200 bg-neutral-100 p-2.5">
        <Icon name="info" size={13} className="mt-[1px] text-neutral-500" />
        <span className="text-[9.5px] leading-snug text-neutral-600">
          Assumptions: depot truck counts, 30 min pumping time per street, 30% de-silting benefit, and the 30 mm / 3 h intensity reference.
          Closed streets are excluded from pumping targets; OSRM routes do not avoid closed streets. Flooded-road slowdowns are not modelled.
        </span>
        <A on={annotate} n="D5" className="absolute -right-2 -top-2" />
      </div>
      <div className="relative flex gap-2">
        <Btn icon="download">Export CSV</Btn>
        <Btn icon="download">Export GeoJSON</Btn>
        <A on={annotate} n="D6" className="absolute -right-1 -top-2" />
      </div>
    </div>
  )
}

