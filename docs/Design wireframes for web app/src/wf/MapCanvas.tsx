import { Icon, N, tiers, type Tier } from './primitives'

type Road = { d: string; tier: Tier; desilted?: boolean }

const roads: Road[] = [
  { d: 'M0 60 C120 70 220 40 330 70 S520 60 600 50', tier: 'medium' },
  { d: 'M0 150 C140 140 260 160 360 150 S520 140 600 155', tier: 'high' },
  { d: 'M0 250 C100 240 200 270 330 260 S500 250 600 270', tier: 'low' },
  { d: 'M0 340 C160 330 260 350 400 335 S540 330 600 345', tier: 'medium' },
  { d: 'M80 0 C90 120 70 260 100 400', tier: 'low' },
  { d: 'M190 0 C200 100 180 220 210 400', tier: 'critical' },
  { d: 'M300 0 C290 140 320 260 300 400', tier: 'medium' },
  { d: 'M410 0 C420 90 400 200 430 400', tier: 'high', desilted: true },
  { d: 'M60 380 C160 280 260 210 380 110 S520 20 560 0', tier: 'low' },
  { d: 'M0 110 C80 120 140 200 250 210 S380 240 440 300', tier: 'critical' },
  { d: 'M240 400 C260 330 340 300 380 230', tier: 'low' },
]

const hospitals = [
  [130, 95], [250, 60], [350, 110], [160, 200], [270, 230], [360, 290], [120, 310], [230, 360], [330, 30], [60, 200],
]
const depots = [
  [70, 180], [278, 268], [430, 390],
]

/**
 * Grayscale schematic of the ward map. River = hatched band, risk tiers =
 * stroke weight/dash, hospitals = cross markers, depots = filled discs.
 */
export function MapCanvas({
  annotate = true,
  showPopup = false,
  showLegend = false,
  showRoute = false,
  compact = false,
}: {
  annotate?: boolean
  showPopup?: boolean
  showLegend?: boolean
  showRoute?: boolean
  compact?: boolean
}) {
  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f4f4f2]">
      <svg viewBox="0 0 600 400" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
        <defs>
          <pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" y1="0" x2="0" y2="6" stroke="#9aa3ad" strokeWidth="1.2" />
          </pattern>
          <pattern id="blocks" width="22" height="22" patternUnits="userSpaceOnUse">
            <rect x="3" y="3" width="14" height="12" fill="none" stroke="#e2e2de" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width="600" height="400" fill="url(#blocks)" />
        {/* parks */}
        <circle cx="330" cy="190" r="16" fill="#e6e6e2" stroke="#cfcfca" />
        <circle cx="40" cy="245" r="12" fill="#e6e6e2" stroke="#cfcfca" />
        {/* river */}
        <path d="M470 0 C500 80 480 160 520 240 S560 340 540 400 L600 400 L600 0 Z" fill="#e3e7eb" />
        <path d="M490 0 C520 80 500 160 540 240 S580 340 560 400 L600 400 L600 0 Z" fill="url(#hatch)" opacity="0.7" />
        {/* roads */}
        {roads.map((r, i) => {
          const t = tiers[r.tier]
          return (
            <g key={i}>
              <path d={r.d} fill="none" stroke="#fff" strokeWidth={t.width + 3} strokeLinecap="round" />
              <path
                d={r.d}
                fill="none"
                stroke={t.stroke}
                strokeWidth={t.width}
                strokeDasharray={r.desilted ? '2 5' : t.dash}
                strokeLinecap="round"
              />
            </g>
          )
        })}
        {showRoute && (
          <path d="M278 268 C300 240 320 200 300 160 S240 120 200 110" fill="none" stroke="#2563eb" strokeWidth="2.5" strokeDasharray="1 5" strokeLinecap="round" />
        )}
        {/* hospitals */}
        {hospitals.map(([x, y], i) => (
          <g key={i} transform={`translate(${x} ${y})`}>
            <circle r="7" fill="#fff" stroke="#333" strokeWidth="1.3" />
            <path d="M-3.5 0h7M0 -3.5v7" stroke="#333" strokeWidth="1.8" />
          </g>
        ))}
        {/* depots */}
        {depots.map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="8" fill="#333" stroke="#fff" strokeWidth="2.5" />
        ))}
        {/* labels */}
        {!compact && (
          <g fontFamily="Inter, sans-serif" fontSize="9" fill="#777">
            <text x="300" y="22">Usmanpura</text>
            <text x="120" y="135">Navrangpura</text>
            <text x="330" y="320">Ashram Rd</text>
            <text x="510" y="200" transform="rotate(70 510 200)">Sabarmati River</text>
          </g>
        )}
      </svg>

      {/* zoom */}
      <div className="absolute left-2 top-2 flex flex-col overflow-hidden rounded border border-neutral-400 bg-white text-[13px] leading-none text-neutral-700">
        <span className="flex h-6 w-6 items-center justify-center border-b border-neutral-300">+</span>
        <span className="flex h-6 w-6 items-center justify-center">−</span>
      </div>
      {annotate && <N n="M1" className="absolute left-9 top-3" />}

      {/* legend & layers */}
      {showLegend ? (
        <div className="absolute bottom-2 left-2 w-[190px] rounded-md border border-neutral-400 bg-white p-2.5 text-[10px] text-neutral-700">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="flex items-center gap-1 font-semibold text-neutral-900">
              <Icon name="layers" size={12} /> Legend &amp; layers
            </span>
            <Icon name="x" size={11} />
          </div>
          <div className="mb-1 font-mono text-[9px] uppercase tracking-wide text-neutral-400">Risk index</div>
          {(Object.keys(tiers) as Tier[]).map((k) => (
            <div key={k} className="flex items-center gap-2 py-[1px]">
              <svg width="26" height="6">
                <line x1="1" y1="3" x2="25" y2="3" stroke={tiers[k].stroke} strokeWidth={tiers[k].width - 1} strokeDasharray={tiers[k].dash} />
              </svg>
              {tiers[k].label}
            </div>
          ))}
          <div className="flex items-center gap-2 py-[1px]">
            <svg width="26" height="6">
              <line x1="1" y1="3" x2="25" y2="3" stroke="#444" strokeWidth="3" strokeDasharray="2 4" strokeLinecap="round" />
            </svg>
            De-silted segment
          </div>
          <div className="mt-1.5 mb-1 font-mono text-[9px] uppercase tracking-wide text-neutral-400">Layers</div>
          {[
            ['Street risk', true],
            ['Hospitals', true],
            ['Truck depots', true],
            ['Truck routes', false],
            ['Waterways', true],
          ].map(([l, on]) => (
            <label key={l as string} className="flex items-center gap-1.5 py-[1px]">
              <span className={`h-2.5 w-2.5 rounded-[2px] border border-neutral-500 ${on ? 'bg-neutral-700' : 'bg-white'}`} />
              {l}
            </label>
          ))}
        </div>
      ) : (
        <span className="absolute bottom-2 left-2 inline-flex items-center gap-1.5 rounded-md border border-neutral-400 bg-white px-2 py-1 text-[10px] font-medium text-neutral-800">
          <Icon name="layers" size={12} /> Legend &amp; layers
        </span>
      )}
      {annotate && <N n="M5" className={`absolute ${showLegend ? 'bottom-3 left-[200px]' : 'bottom-3 left-[118px]'}`} />}

      {showPopup && (
        <div className="absolute left-[34%] top-[16%] w-[180px] rounded-md border border-neutral-500 bg-white p-2.5 text-[10px] text-neutral-700 shadow-[3px_3px_0_rgba(0,0,0,0.08)]">
          <div className="flex items-start justify-between">
            <span className="text-[11px] font-semibold text-neutral-900">Ashram Road</span>
            <Icon name="x" size={10} />
          </div>
          <div className="mt-0.5 font-mono text-[9px] text-neutral-500">Rank #1 · Risk 1%</div>
          <div className="mt-1.5 grid grid-cols-2 gap-y-0.5">
            <span>To water</span><span className="text-right">333 m</span>
            <span>Slope</span><span className="text-right">1.02%</span>
            <span>Elevation</span><span className="text-right">55.7 m</span>
            <span>Assigned</span><span className="text-right">Truck 3</span>
          </div>
          <div className="mt-2 flex gap-1">
            <span className="flex-1 rounded border border-neutral-400 py-0.5 text-center">Mark de-silted</span>
            <span className="flex-1 rounded border border-neutral-400 py-0.5 text-center">Mark closed</span>
          </div>
          <span className="absolute -bottom-[6px] left-6 h-2.5 w-2.5 rotate-45 border-b border-r border-neutral-500 bg-white" />
        </div>
      )}

      {/* attribution */}
      <span className="absolute bottom-0 right-0 bg-white/85 px-1.5 py-[1px] text-[8px] text-neutral-500">
        Leaflet | © OpenStreetMap contributors · routing by OSRM
      </span>
      {annotate && (
        <>
          <N n="M2" className="absolute left-[33%] top-[36%]" />
          <N n="M3" className="absolute left-[23%] top-[20%]" />
          <N n="M4" className="absolute left-[14%] top-[47%]" />
          <N n="M6" className="absolute right-[44%] bottom-[5px]" />
          <N n="M7" className="absolute right-[6%] top-[30%]" />
        </>
      )}
    </div>
  )
}
