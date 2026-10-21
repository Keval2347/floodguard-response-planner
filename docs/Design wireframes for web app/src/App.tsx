import { useState, type ReactNode } from 'react'
import { Header } from './wf/Header'
import { MapCanvas } from './wf/MapCanvas'
import { CarePanel, DataPanel, HospitalCard, RiskPanel, TrucksPanel, WhatIfPanel } from './wf/Panels'
import { Browser, Icon, N, Tabs, Toggle, tiers, type TabName, type Tier } from './wf/primitives'
import * as K from './wf/keys'

/* ---------------- Document scaffolding ---------------- */
function Figure({ no, title, caption, children, keyRows, aside }: { no: string; title: string; caption: string; children: ReactNode; keyRows?: K.Key; aside?: ReactNode }) {
  return (
    <section className="figure rounded-xl bg-white p-6 shadow-[0_1px_0_rgba(0,0,0,0.06),0_8px_24px_-12px_rgba(0,0,0,0.12)] md:p-8">
      <header className="mb-5 flex flex-wrap items-baseline gap-x-3 border-b border-neutral-200 pb-3">
        <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-[var(--annot)]">Figure {no}</span>
        <h2 className="font-serif text-[22px] font-semibold text-neutral-900">{title}</h2>
      </header>
      <div className={keyRows || aside ? 'grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]' : ''}>
        <div className="min-w-0">{children}</div>
        {(keyRows || aside) && (
          <div>
            {aside}
            {keyRows && <KeyTable rows={keyRows} />}
          </div>
        )}
      </div>
      <p className="mt-5 max-w-3xl font-serif text-[14px] italic leading-relaxed text-neutral-600">
        <span className="not-italic font-semibold text-neutral-800">Fig. {no}.</span> {caption}
      </p>
    </section>
  )
}

function KeyTable({ rows }: { rows: K.Key }) {
  return (
    <table className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-neutral-300 font-mono text-[9.5px] uppercase tracking-wider text-neutral-400">
          <th className="py-1.5 pr-2 font-normal">#</th>
          <th className="py-1.5 font-normal">Element · behaviour</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([n, name, desc]) => (
          <tr key={n} className="border-b border-neutral-100 align-top">
            <td className="py-2 pr-2">
              <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--annot)] px-1 font-mono text-[10px] font-semibold text-white">{n}</span>
            </td>
            <td className="py-2">
              <div className="text-[12.5px] font-semibold text-neutral-900">{name}</div>
              <div className="text-[11.5px] leading-snug text-neutral-500">{desc}</div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

/* Phone-sized panel frame used for each sidebar tab */
function PanelFrame({ tab, children, label }: { tab: TabName; children: ReactNode; label?: string }) {
  return (
    <div className="w-[340px] shrink-0">
      {label && <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-neutral-400">{label}</div>}
      <div className="rounded-lg border border-neutral-400 bg-white">
        <div className="border-b border-neutral-200 p-3">
          <Tabs active={tab} />
        </div>
        <div className="p-3 pl-4">{children}</div>
      </div>
    </div>
  )
}

const panelFor: Record<TabName, ReactNode> = {
  Risk: <RiskPanel annotate={false} />,
  Care: <CarePanel annotate={false} />,
  Trucks: <TrucksPanel annotate={false} />,
  'What-if': <WhatIfPanel annotate={false} />,
  Data: <DataPanel annotate={false} />,
}

function Region({ label, className }: { label: string; className: string }) {
  return (
    <span className={`annot pointer-events-none absolute flex items-start justify-start rounded border-2 border-dashed border-[var(--annot)] ${className}`}>
      <span className="-m-[2px] rounded-br bg-[var(--annot)] px-1.5 py-0.5 font-mono text-[10px] font-semibold text-white">{label}</span>
    </span>
  )
}

/* ---------------- Figures ---------------- */
function Fig1() {
  const [tab, setTab] = useState<TabName>('Risk')
  return (
    <Figure
      no="1"
      title="Overall console layout"
      keyRows={K.layoutKey}
      caption="Three-region desktop layout of the JalNiti Ward Flood Response Console. The tab bar is interactive in this wireframe — select a tab to preview each sidebar view in context."
    >
      <div className="overflow-x-auto">
        <Browser className="min-w-[860px]">
          <div className="relative">
            <Header annotate={false} />
            <div className="grid h-[470px] grid-cols-[1fr_330px]">
              <MapCanvas annotate={false} />
              <div className="flex min-h-0 flex-col border-l border-neutral-300">
                <div className="p-2.5">
                  <Tabs active={tab} onChange={setTab} />
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-3">{panelFor[tab]}</div>
              </div>
            </div>
            <Region label="A" className="inset-x-1 top-1 h-[46px]" />
            <Region label="B" className="bottom-1 left-1 right-[334px] top-[52px]" />
            <Region label="C" className="bottom-1 right-1 top-[52px] w-[326px]" />
            <Region label="D" className="right-[6px] top-[58px] h-[38px] w-[316px]" />
          </div>
        </Browser>
      </div>
    </Figure>
  )
}

function Fig2() {
  return (
    <Figure no="2" title="Title bar & live status header" keyRows={K.headerKey} caption="The header is the operator's at-a-glance status line. Each KPI pairs a small outline icon, an uppercase micro-label and a bold value; the Refresh action sits at the far right.">
      <div className="overflow-x-auto pt-3">
        <div className="min-w-[860px] rounded-lg border border-neutral-400">
          <Header />
        </div>
      </div>
    </Figure>
  )
}

function Fig3() {
  return (
    <Figure no="3" title="Map canvas" keyRows={K.mapKey} caption="Schematic of the ward map. For print the risk colour scale is rendered in grayscale: darker, heavier and dashed strokes denote higher-risk segments; hospitals are cross markers and depots are filled discs.">
      <div className="h-[420px] overflow-hidden rounded-lg border border-neutral-400">
        <MapCanvas />
      </div>
      <TierLegend />
    </Figure>
  )
}

function TierLegend() {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-neutral-600">
      {(Object.keys(tiers) as Tier[]).map((k) => (
        <span key={k} className="flex items-center gap-1.5">
          <svg width="28" height="8">
            <line x1="1" y1="4" x2="27" y2="4" stroke={tiers[k].stroke} strokeWidth={tiers[k].width} strokeDasharray={tiers[k].dash} />
          </svg>
          {tiers[k].label} risk
        </span>
      ))}
      <span className="flex items-center gap-1.5">
        <svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="#fff" stroke="#333" /><path d="M5 8h6M8 5v6" stroke="#333" strokeWidth="1.6" /></svg>Hospital
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="16" height="16"><circle cx="8" cy="8" r="6" fill="#333" /></svg>Depot
      </span>
      <span className="flex items-center gap-1.5">
        <svg width="28" height="8"><line x1="1" y1="4" x2="27" y2="4" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="1 4" strokeLinecap="round" /></svg>Truck route
      </span>
    </div>
  )
}

function Fig3b() {
  return (
    <Figure no="3b" title="Map interaction states (proposed)" caption="Left: the Legend & layers control expanded, combining the risk legend with layer visibility checkboxes. Right: clicking a street opens a detail popover with its metrics and quick actions (mark de-silted / mark closed); the assigned truck's OSRM route is drawn as a dotted line.">
      <div className="grid gap-5 md:grid-cols-2">
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-neutral-400">State A · legend expanded</div>
          <div className="h-[320px] overflow-hidden rounded-lg border border-neutral-400">
            <MapCanvas annotate={false} showLegend compact />
          </div>
        </div>
        <div>
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-neutral-400">State B · segment selected + route</div>
          <div className="h-[320px] overflow-hidden rounded-lg border border-neutral-400">
            <MapCanvas annotate={false} showPopup showRoute compact />
          </div>
        </div>
      </div>
    </Figure>
  )
}

function TabFigure({ no, tab, title, caption, keyRows, children }: { no: string; tab: TabName; title: string; caption: string; keyRows: K.Key; children: ReactNode }) {
  return (
    <Figure no={no} title={title} keyRows={keyRows} caption={caption}>
      <div className="flex justify-center rounded-lg bg-[repeating-linear-gradient(45deg,#fafafa_0_8px,#f3f3f1_8px_16px)] py-6">
        <PanelFrame tab={tab}>{children}</PanelFrame>
      </div>
    </Figure>
  )
}

function Fig9() {
  return (
    <Figure no="9" title="Additional states (proposed)" caption="Populated states not visible in the captured screenshots. Left: the Trucks tab after the optimiser has produced a plan, with a coverage bar, one card per truck and its ordered stops, and an unserved list. Right: a Care card in its 'at risk' variant, using a heavy left rule and outlined badge so it stands out from 'clear' cards." keyRows={K.trucksKey}>
      <div className="flex flex-wrap justify-center gap-6 rounded-lg bg-[repeating-linear-gradient(45deg,#fafafa_0_8px,#f3f3f1_8px_16px)] py-6">
        <PanelFrame tab="Trucks" label="Trucks · plan generated">
          <TrucksPanel populated />
        </PanelFrame>
        <PanelFrame tab="Care" label="Care · hospital at risk">
          <div className="space-y-2">
            <div className="text-[10px] text-neutral-500">1 hospital has a high or critical approach road at 85 mm/24h.</div>
            <HospitalCard name="Super Surgical Hospital, Ahmedabad" road="Ashram Road" n={30} osm="N6978013050" risk />
            <HospitalCard name="Hari Urosurgical Hospital and Andrology Centre" road="Chimanlal Girdharlal Road" n={39} osm="N6972590229" risk={false} />
          </div>
        </PanelFrame>
      </div>
    </Figure>
  )
}

function Fig10() {
  return (
    <Figure
      no="10"
      title="Responsive mobile layout (proposed)"
      caption="On narrow screens the header collapses to the brand and a horizontally scrolling KPI strip; the map fills the upper half and the sidebar becomes a draggable bottom sheet that keeps the same five tabs."
      aside={
        <ul className="space-y-2 text-[12.5px] leading-snug text-neutral-600">
          {[
            ['1', 'Compact title bar with menu and refresh icons.'],
            ['2', 'KPI chips scroll horizontally; same five metrics.'],
            ['3', 'Map keeps zoom and legend controls.'],
            ['4', 'Bottom sheet with grab handle; drag up to read full lists.'],
          ].map(([n, t]) => (
            <li key={n} className="flex gap-2">
              <N n={n} />
              <span>{t}</span>
            </li>
          ))}
        </ul>
      }
    >
      <div className="flex justify-center gap-8">
        <div className="relative h-[600px] w-[300px] overflow-hidden rounded-[28px] border-[6px] border-neutral-800 bg-white">
          <div className="flex items-center gap-2 border-b border-neutral-200 px-3 pb-2 pt-4">
            <span className="flex h-6 w-6 items-center justify-center rounded bg-neutral-800 text-white"><Icon name="waves" size={12} /></span>
            <div className="flex-1 leading-tight">
              <div className="text-[12px] font-bold">JalNiti</div>
              <div className="text-[8.5px] text-neutral-500">Navrangpura · 11:55 pm</div>
            </div>
            <Icon name="refresh" size={14} className="text-neutral-600" />
            <Icon name="menu" size={14} className="text-neutral-600" />
            <N n="1" className="absolute right-2 top-1" />
          </div>
          <div className="relative flex gap-1.5 overflow-hidden border-b border-neutral-200 px-3 py-2">
            {['Dry', '0 mm', '0 streets', '10 trucks', '0%'].map((v) => (
              <span key={v} className="whitespace-nowrap rounded-full border border-neutral-300 px-2 py-0.5 text-[9.5px] text-neutral-700">{v}</span>
            ))}
            <N n="2" className="absolute right-1 top-1" />
          </div>
          <div className="relative h-[230px]">
            <MapCanvas annotate={false} compact />
            <N n="3" className="absolute right-2 top-2" />
          </div>
          <div className="absolute inset-x-0 bottom-0 top-[300px] rounded-t-2xl border-t border-neutral-300 bg-white px-3 pt-1.5 shadow-[0_-6px_16px_rgba(0,0,0,0.08)]">
            <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-neutral-300" />
            <Tabs active="Risk" />
            <div className="mt-2 origin-top-left scale-[0.92]">
              <RiskPanel annotate={false} />
            </div>
            <N n="4" className="absolute right-2 top-1" />
          </div>
        </div>
      </div>
    </Figure>
  )
}

function Fig11() {
  const box = 'rounded-md border border-neutral-400 bg-white px-3 py-2 text-center text-[11.5px]'
  return (
    <Figure no="11" title="Information architecture & data flow" caption="Top: the four external data sources feed the scoring and optimisation engine. Bottom: the console's views. Solid arrows show data flow; the dashed arrow shows that What-if controls re-run the engine and update the map and every other tab.">
      <div className="space-y-3 font-sans">
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {['OpenStreetMap / Overpass', 'NASA SRTM 30 m DEM', 'OSRM router', 'Open-Meteo rainfall'].map((s) => (
            <div key={s} className={`${box} border-dashed`}>
              <Icon name="db" size={12} className="mx-auto mb-1 text-neutral-500" />
              {s}
            </div>
          ))}
        </div>
        <Arrow />
        <div className="mx-auto max-w-xl rounded-md border-2 border-neutral-800 bg-neutral-50 px-4 py-3 text-center">
          <div className="text-[13px] font-semibold">Scoring & optimisation engine</div>
          <div className="text-[11px] text-neutral-500">Risk index (0–100) · hospital approach analysis · truck assignment solver (greedy + local search)</div>
        </div>
        <div className="relative">
          <Arrow />
          <span className="absolute right-[8%] top-0 hidden font-mono text-[10px] text-[var(--annot)] md:block">↑ What-if re-runs engine</span>
        </div>
        <div className="rounded-lg border border-neutral-300 p-3">
          <div className="mb-2 font-mono text-[10px] uppercase tracking-wider text-neutral-400">Ward Flood Response Console</div>
          <div className="grid gap-2 md:grid-cols-[1fr_1fr_2.4fr]">
            <div className={box}><b>Header</b><div className="text-[10px] text-neutral-500">5 KPIs · Refresh</div></div>
            <div className={box}><b>Map</b><div className="text-[10px] text-neutral-500">Segments · hospitals · depots · routes · legend</div></div>
            <div className="rounded-md border border-neutral-400 p-2">
              <div className="mb-1.5 text-center text-[11.5px] font-semibold">Sidebar tabs</div>
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  ['Risk', 'Ranked streets'],
                  ['Care', 'Hospital access'],
                  ['Trucks', 'Assignments'],
                  ['What-if', 'Scenarios'],
                  ['Data', 'Sources'],
                ].map(([t, d]) => (
                  <div key={t} className={`rounded border px-1 py-1.5 text-center text-[10.5px] ${t === 'What-if' ? 'border-dashed border-[var(--annot)]' : 'border-neutral-300'}`}>
                    <b>{t}</b>
                    <div className="text-[9px] text-neutral-500">{d}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </Figure>
  )
}

function Arrow() {
  return (
    <div className="flex justify-center text-neutral-500">
      <svg width="14" height="24"><path d="M7 0v20M2 15l5 6 5-6" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
    </div>
  )
}

const additions = [
  ['Risk', 'Filter / search box and sort control above the ranked list.'],
  ['Map', 'Expanded legend with layer visibility toggles; street detail popover with quick actions; drawn truck routes.'],
  ['Care', '"Approach at risk" card variant for hospitals with high/critical access roads.'],
  ['Trucks', 'Populated plan state: coverage bar, per-truck cards with ordered stops, unserved list.'],
  ['Data', 'Export of ranked streets to CSV / GeoJSON.'],
  ['Layout', 'Responsive mobile layout with KPI chips and bottom sheet.'],
]

/* ---------------- Page ---------------- */
export default function App() {
  const [annot, setAnnot] = useState(true)
  return (
    <div className={`min-h-screen ${annot ? '' : 'hide-annot'}`}>
      <div className="no-print sticky top-0 z-20 border-b border-neutral-300 bg-[#ecebe7]/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1240px] items-center gap-4 px-6 py-2.5 text-[12px] text-neutral-600">
          <span className="font-mono text-[11px] uppercase tracking-wider">JalNiti · wireframes</span>
          <nav className="hidden flex-1 gap-3 md:flex">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11'].map((n) => (
              <a key={n} href={`#fig-${n}`} className="hover:text-neutral-900">Fig {n}</a>
            ))}
          </nav>
          <button type="button" onClick={() => setAnnot((a) => !a)} className="ml-auto flex items-center gap-2">
            <Toggle on={annot} /> Annotations
          </button>
          <button type="button" onClick={() => window.print()} className="rounded-md border border-neutral-400 bg-white px-2.5 py-1 text-neutral-800">
            Print / PDF
          </button>
        </div>
      </div>

      <main className="mx-auto max-w-[1240px] space-y-8 px-6 py-10">
        <section className="grid gap-8 md:grid-cols-[1.4fr_1fr]">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-widest text-[var(--annot)]">Appendix A · Interface wireframes</div>
            <h1 className="mt-2 font-serif text-[44px] font-semibold leading-[1.05] text-neutral-900">
              JalNiti — Ward Flood Response Console
            </h1>
            <p className="mt-4 max-w-xl text-[14.5px] leading-relaxed text-neutral-600">
              Low-fidelity wireframes of a decision-support tool that ranks urban street segments by waterlogging risk, checks hospital
              access, assigns pumping trucks and lets operators test rainfall and de-silting scenarios. Every element from the deployed
              interface is catalogued, numbered and described; proposed additions are marked <i>(added)</i> or <i>(proposed)</i>.
            </p>
          </div>
          <div className="rounded-xl border border-neutral-300 bg-white p-5 text-[12px] text-neutral-600">
            <div className="mb-3 font-mono text-[10px] uppercase tracking-wider text-neutral-400">Notation</div>
            <ul className="space-y-2.5">
              <li className="flex items-center gap-2"><N n="H1" /> Numbered callout → see key beside each figure</li>
              <li className="flex items-center gap-2"><span className="inline-block h-4 w-6 rounded-sm border-2 border-dashed border-[var(--annot)]" /> Layout region (Fig. 1)</li>
              <li className="flex items-center gap-2"><span className="inline-block h-1.5 w-6 rounded bg-neutral-200" /> Placeholder / secondary text</li>
              <li className="flex items-center gap-2"><span className="inline-block h-4 w-1 rounded-sm bg-neutral-900" /> Risk tier encoded in grayscale</li>
            </ul>
            <div className="mt-4 border-t border-neutral-200 pt-3 font-mono text-[10px] text-neutral-400">11 figures · 5 tabs · 60+ catalogued elements</div>
          </div>
        </section>

        <div id="fig-1"><Fig1 /></div>
        <div id="fig-2"><Fig2 /></div>
        <div id="fig-3" className="space-y-8"><Fig3 /><Fig3b /></div>
        <div id="fig-4">
          <TabFigure no="4" tab="Risk" title="Risk tab — ranked street list" keyRows={K.riskKey} caption="Default sidebar view. A method note explains how to interpret the index, followed by the ranked list of street segments with tier bar, metrics and score.">
            <RiskPanel />
          </TabFigure>
        </div>
        <div id="fig-5">
          <TabFigure no="5" tab="Care" title="Care tab — hospital access" keyRows={K.careKey} caption="Hospitals within 600 m of a scored street are assessed by the risk of their worst approach road, so operators can keep access routes to care open.">
            <CarePanel />
          </TabFigure>
        </div>
        <div id="fig-6">
          <TabFigure no="6" tab="Trucks" title="Trucks tab — empty state" keyRows={K.trucksKey.slice(0, 2)} caption="Captured state with no rainfall: the solver produces no assignments, so a single summary card explains why. See Fig. 9 for the populated state.">
            <TrucksPanel />
          </TabFigure>
        </div>
        <div id="fig-7">
          <TabFigure no="7" tab="What-if" title="What-if tab — scenario controls" keyRows={K.whatIfKey} caption="Full scroll of the scenario panel: live rainfall readout, live-vs-scenario impact table, four sliders, the de-silting segment list, a 12-hour rainfall chart and a reset action.">
            <WhatIfPanel />
          </TabFigure>
        </div>
        <div id="fig-8">
          <TabFigure no="8" tab="Data" title="Data tab — provenance & assumptions" keyRows={K.dataKey} caption="Transparency view listing feed freshness, linked open-data sources and modelling assumptions, so results can be audited.">
            <DataPanel />
          </TabFigure>
        </div>
        <div id="fig-9"><Fig9 /></div>
        <div id="fig-10"><Fig10 /></div>
        <div id="fig-11"><Fig11 /></div>

        <section className="figure rounded-xl bg-white p-6 md:p-8">
          <h2 className="font-serif text-[22px] font-semibold text-neutral-900">Table A1. Proposed additions to the captured interface</h2>
          <table className="mt-4 w-full border-collapse text-left text-[13px]">
            <thead>
              <tr className="border-y border-neutral-800 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
                <th className="py-2 pr-6 font-normal">Area</th>
                <th className="py-2 font-normal">Addition</th>
              </tr>
            </thead>
            <tbody>
              {additions.map(([a, d]) => (
                <tr key={a} className="border-b border-neutral-200">
                  <td className="py-2 pr-6 font-semibold text-neutral-900">{a}</td>
                  <td className="py-2 text-neutral-600">{d}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      </main>
    </div>
  )
}
