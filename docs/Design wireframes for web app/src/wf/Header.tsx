import { Btn, Icon, N } from './primitives'

const kpis = [
  { icon: 'cloud', label: 'Rain right now', value: 'Dry', sub: 'updated 7s ago', n: 'H4' },
  { icon: 'gauge', label: 'Live 24 h load', value: '0 mm', n: 'H5' },
  { icon: 'alert', label: 'Critical + High', value: '0 streets', n: 'H6' },
  { icon: 'truck', label: 'Trucks', value: '10', n: 'H7' },
  { icon: 'pie', label: 'Coverage', value: '0%', n: 'H8' },
]

export function Header({ annotate = true }: { annotate?: boolean }) {
  return (
    <div className="relative flex items-center gap-3 border-b border-neutral-300 bg-white px-3 py-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-md border border-neutral-800 bg-neutral-800 text-white">
        <Icon name="waves" size={16} />
      </span>
      {annotate && <N n="H1" className="absolute left-1 top-0" />}
      <div className="min-w-0 flex-1">
        <div className="relative flex items-center gap-1 text-[13px] text-neutral-900">
          <b>JalNiti</b>
          <span className="text-neutral-400">·</span>
          <span>Ward Flood Response Console</span>
          {annotate && <N n="H2" className="ml-1" />}
        </div>
        <div className="flex items-center gap-1 truncate text-[10px] text-neutral-500">
          Navrangpura, Ahmedabad — live OSM · SRTM · OSRM · rainfall · updated 20 Oct 2026, 11:55 pm IST
          {annotate && <N n="H3" className="ml-1" />}
        </div>
      </div>
      <div className="flex items-stretch divide-x divide-neutral-200">
        {kpis.map((k) => (
          <div key={k.label} className="relative flex items-start gap-1.5 px-3">
            <Icon name={k.icon} size={13} className="mt-[1px] text-neutral-500" />
            <div className="leading-tight">
              <div className="font-mono text-[8px] uppercase tracking-wider text-neutral-400">{k.label}</div>
              <div className="text-[12px] font-semibold text-neutral-900">
                {k.value} {k.sub && <span className="text-[9px] font-normal text-neutral-400">{k.sub}</span>}
              </div>
            </div>
            {annotate && <N n={k.n} className="absolute -top-2 right-0" />}
          </div>
        ))}
      </div>
      <div className="relative">
        <Btn icon="refresh">Refresh</Btn>
        {annotate && <N n="H9" className="absolute -right-2 -top-2" />}
      </div>
    </div>
  )
}
