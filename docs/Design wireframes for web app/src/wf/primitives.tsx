import type { ReactNode } from 'react'

/* ---------- Icons (outline, wireframe-weight) ---------- */
const paths: Record<string, ReactNode> = {
  waves: (
    <>
      <path d="M3 8c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M3 13c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
      <path d="M3 18c2-2 4-2 6 0s4 2 6 0 4-2 6 0" />
    </>
  ),
  cloud: (
    <>
      <path d="M7 15a4 4 0 1 1 1-7.9A5 5 0 0 1 18 9a3 3 0 0 1 0 6Z" />
      <path d="M9 18v2M13 18v2M17 18v2" />
    </>
  ),
  gauge: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="M12 17l4-5" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3 2 20h20Z" />
      <path d="M12 10v4M12 17v.5" />
    </>
  ),
  truck: (
    <>
      <path d="M2 6h11v10H2zM13 10h4l3 3v3h-7" />
      <circle cx="6" cy="18" r="2" />
      <circle cx="16" cy="18" r="2" />
    </>
  ),
  pie: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 3v9h9" />
    </>
  ),
  refresh: (
    <>
      <path d="M20 11a8 8 0 0 0-14-4L4 9" />
      <path d="M4 4v5h5M4 13a8 8 0 0 0 14 4l2-2" />
      <path d="M20 20v-5h-5" />
    </>
  ),
  hospital: <path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6Z" />,
  db: (
    <>
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6M12 7.5v.5" />
    </>
  ),
  layers: (
    <>
      <path d="m12 3 9 5-9 5-9-5Z" />
      <path d="m3 13 9 5 9-5" />
    </>
  ),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  pin: (
    <>
      <path d="M12 21s-7-6-7-12a7 7 0 0 1 14 0c0 6-7 12-7 12Z" />
      <circle cx="12" cy="9" r="2.5" />
    </>
  ),
  menu: <path d="M4 7h16M4 12h16M4 17h16" />,
  download: <path d="M12 4v11m-5-5 5 5 5-5M4 20h16" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-4-4" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
}

export function Icon({ name, size = 14, className = '' }: { name: string; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
    >
      {paths[name]}
    </svg>
  )
}

/* ---------- Annotation callout ---------- */
export function N({ n, className = '' }: { n: number | string; className?: string }) {
  return (
    <span
      className={`annot inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--annot)] px-1 font-mono text-[10px] font-semibold leading-none text-white shadow-[0_0_0_2px_white] ${className}`}
    >
      {n}
    </span>
  )
}

/* ---------- Wireframe building blocks ---------- */
export function Bar({ w = '100%', h = 6, dark = false }: { w?: string | number; h?: number; dark?: boolean }) {
  return <span className={`block rounded-sm ${dark ? 'bg-neutral-400' : 'bg-neutral-200'}`} style={{ width: w, height: h }} />
}

export function Lines({ widths }: { widths: (string | number)[] }) {
  return (
    <span className="flex flex-col gap-[5px]">
      {widths.map((w, i) => (
        <Bar key={i} w={w} h={5} />
      ))}
    </span>
  )
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-md border border-neutral-300 bg-white p-3 ${className}`}>{children}</div>
}

export function Badge({ children, filled = false }: { children: ReactNode; filled?: boolean }) {
  return (
    <span
      className={`inline-flex items-center whitespace-nowrap rounded-full border px-2 py-[2px] text-[10px] font-medium ${
        filled ? 'border-neutral-800 bg-neutral-800 text-white' : 'border-neutral-300 bg-neutral-100 text-neutral-700'
      }`}
    >
      {children}
    </span>
  )
}

export function Btn({ children, icon, full = false }: { children: ReactNode; icon?: string; full?: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center gap-1.5 rounded-md border border-neutral-400 bg-white px-3 py-1.5 text-[11px] font-medium text-neutral-800 ${
        full ? 'w-full' : ''
      }`}
    >
      {icon && <Icon name={icon} size={12} />}
      {children}
    </span>
  )
}

export function Toggle({ on = false }: { on?: boolean }) {
  return (
    <span className={`relative inline-block h-[14px] w-[26px] shrink-0 rounded-full border ${on ? 'border-neutral-800 bg-neutral-800' : 'border-neutral-300 bg-neutral-100'}`}>
      <span className={`absolute top-[1px] h-[10px] w-[10px] rounded-full border border-neutral-400 bg-white ${on ? 'left-[13px]' : 'left-[1px]'}`} />
    </span>
  )
}

export function Slider({ pct }: { pct: number }) {
  return (
    <span className="relative my-1.5 block h-[4px] w-full rounded-full bg-neutral-200">
      <span className="absolute left-0 top-0 h-full rounded-full bg-neutral-800" style={{ width: `${pct}%` }} />
      <span
        className="absolute top-1/2 h-[12px] w-[12px] -translate-x-1/2 -translate-y-1/2 rounded-full border-[1.5px] border-neutral-700 bg-white"
        style={{ left: `${pct}%` }}
      />
    </span>
  )
}

/* Risk tier swatch – grayscale encoding used across all figures */
export const tiers = {
  critical: { label: 'Critical', stroke: '#111', width: 5, dash: '' },
  high: { label: 'High', stroke: '#444', width: 4, dash: '6 3' },
  medium: { label: 'Medium', stroke: '#888', width: 3, dash: '' },
  low: { label: 'Low', stroke: '#c4c4c4', width: 3, dash: '' },
} as const
export type Tier = keyof typeof tiers

export function TierBar({ tier }: { tier: Tier }) {
  const t = tiers[tier]
  return <span className="block w-[4px] self-stretch rounded-sm" style={{ background: t.stroke }} />
}

/* Browser window chrome around a wireframe */
export function Browser({ children, url = 'jalniti.app/ward/navrangpura', className = '' }: { children: ReactNode; url?: string; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-lg border border-neutral-400 bg-white ${className}`}>
      <div className="flex items-center gap-2 border-b border-neutral-300 bg-neutral-100 px-3 py-1.5">
        <span className="flex gap-1">
          {[0, 1, 2].map((i) => (
            <span key={i} className="h-2 w-2 rounded-full border border-neutral-400 bg-white" />
          ))}
        </span>
        <span className="ml-2 flex-1 truncate rounded border border-neutral-300 bg-white px-2 py-[1px] font-mono text-[10px] text-neutral-500">{url}</span>
      </div>
      {children}
    </div>
  )
}

export const TABS = ['Risk', 'Care', 'Trucks', 'What-if', 'Data'] as const
export type TabName = (typeof TABS)[number]

export function Tabs({ active, onChange }: { active: TabName; onChange?: (t: TabName) => void }) {
  return (
    <div className="grid grid-cols-5 gap-0.5 rounded-md border border-neutral-200 bg-neutral-100 p-0.5">
      {TABS.map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => onChange?.(t)}
          className={`rounded px-1 py-1 text-[11px] ${
            t === active ? 'border border-neutral-300 bg-white font-semibold text-neutral-900' : 'border border-transparent text-neutral-500 hover:text-neutral-800'
          }`}
        >
          {t}
        </button>
      ))}
    </div>
  )
}
