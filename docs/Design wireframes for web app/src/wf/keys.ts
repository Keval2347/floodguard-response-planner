export type Key = [string, string, string][]

export const layoutKey: Key = [
  ['A', 'Title bar / status header', 'Full-width strip: brand, ward context, live KPIs and global refresh.'],
  ['B', 'Map canvas', 'Interactive Leaflet map (~70% width) showing scored street segments, hospitals and depots.'],
  ['C', 'Analysis sidebar', 'Fixed-width right panel (~30%) with five tabs; content scrolls independently of the map.'],
  ['D', 'Tab bar', 'Segmented control: Risk · Care · Trucks · What-if · Data. Active tab is raised/white.'],
]

export const headerKey: Key = [
  ['H1', 'App logo', 'Square tile with water-waves icon; identifies the JalNiti brand.'],
  ['H2', 'Product title', '"JalNiti · Ward Flood Response Console" — bold brand + descriptive name.'],
  ['H3', 'Context subtitle', 'Ward & city, live data sources (OSM · SRTM · OSRM · rainfall) and last-updated timestamp.'],
  ['H4', 'KPI: Rain right now', 'Current weather state (e.g. "Dry") with freshness label "updated 7s ago".'],
  ['H5', 'KPI: Live 24 h load', 'Accumulated rainfall over the last 24 hours, in mm.'],
  ['H6', 'KPI: Critical + High', 'Number of streets currently in the two highest risk tiers.'],
  ['H7', 'KPI: Trucks', 'Size of the available pumping-truck fleet.'],
  ['H8', 'KPI: Coverage', 'Share of exposed road length covered by the current truck plan.'],
  ['H9', 'Refresh button', 'Outlined button with refresh icon; re-polls all live feeds on demand.'],
]

export const mapKey: Key = [
  ['M1', 'Zoom control', 'Stacked + / − buttons, top-left.'],
  ['M2', 'Street segments', '337 OSM segments drawn as polylines; risk tier encoded by colour (here: weight/darkness/dash).'],
  ['M3', 'Hospital markers', 'Circular pins with a cross; red in production. Clicking opens hospital details.'],
  ['M4', 'Truck depots', 'Filled dark discs marking pumping-truck depots (route origins).'],
  ['M5', 'Legend & layers', 'Bottom-left pill button; expands into the legend and layer toggles (Fig. 3b).'],
  ['M6', 'Attribution', '"Leaflet | © OpenStreetMap contributors · routing by OSRM".'],
  ['M7', 'Basemap features', 'Sabarmati river, parks, neighbourhood labels (Usmanpura, Navrangpura) and road names.'],
]

export const riskKey: Key = [
  ['R1', 'Method summary', 'Explains the 0–100 risk index, current rainfall inputs and how to read scores (relative, not a probability).'],
  ['R2', 'Filter & sort (added)', 'Search box and sort dropdown to find a street quickly among 337 segments.'],
  ['R3', 'Rank number', 'Position in the ranked list (1 = pump first).'],
  ['R4', 'Risk tier bar', 'Vertical colour bar matching the street\u2019s map colour.'],
  ['R5', 'Street name + metrics', 'Bold name; secondary line: distance to water · slope · elevation.'],
  ['R6', 'Risk score', 'Right-aligned percentage. Selecting a row highlights the segment on the map.'],
]

export const careKey: Key = [
  ['C1', 'Hospital summary card', 'Hospital-cross icon, city total (739), data provenance and how many can be assessed (219 within 600 m).'],
  ['C2', 'Status sentence', 'Plain-language summary of hospitals with high/critical approach roads.'],
  ['C3', 'Hospital card', 'One card per assessable hospital, sorted by worst approach risk.'],
  ['C4', 'Approach badge', 'Pill status: "Approach clear" (filled) or "Approach at risk" (outlined, added variant).'],
  ['C5', 'Worst approach line', 'Name of riskiest access road and count of scored approach roads.'],
  ['C6', 'OSM reference link', 'Underlined node ID (e.g. OSM N6978013050) linking to OpenStreetMap.'],
]

export const trucksKey: Key = [
  ['T1', 'Plan summary', '"N assignments · N unserved" heading, coverage of exposed road length within the shift.'],
  ['T2', 'Solver note', 'Explains optimiser outcome (greedy baseline + improving moves).'],
  ['T3', 'Truck card (added)', 'Truck ID with icon, origin depot and time used vs. shift length.'],
  ['T4', 'Shift utilisation', 'Minutes used / available, e.g. 212 / 240 min.'],
  ['T5', 'Ordered stop list', 'Streets in visiting order with 30-min pumping time each; route drawn on map.'],
  ['T6', 'Unserved list (added)', 'Dashed card listing streets the plan could not reach and why.'],
]

export const whatIfKey: Key = [
  ['W1', 'Live rainfall feed', 'Status badge ("No rain now") + rate now, last/next 60 min, last/next 24 h; poll metadata.'],
  ['W2', 'Scenario impact table', 'Live vs. Scenario columns for roads assigned/unserved, exposure covered, at-risk hospitals.'],
  ['W3', 'Rainfall driving the map', 'Toggle "Follow live feed" + 24 h rainfall slider; slider unlocks when toggle is off.'],
  ['W4', 'Peak rainfall intensity', 'Slider for rolling 3-hour peak (mm / 3 h).'],
  ['W5', 'Trucks available', 'Slider 0 – 10 for fleet size ("10 of 10").'],
  ['W6', 'Shift length', 'Slider for working window in minutes (default 240).'],
  ['W7', 'Drain de-silting', 'Section title and 30%-reduction assumption.'],
  ['W8', 'Segment toggle row', 'Switch + street name + risk change "before → after"; also selectable on the map.'],
  ['W9', 'De-silted counter', '"N segments de-silted (dashed on the map)".'],
  ['W10', 'Observed rainfall chart', '12 hourly bars, 12:00 → 23:00 IST, with rolling 1 h / 3 h peaks.'],
  ['W11', 'Reset button', 'Full-width "Reset to the live feed" discards all scenario changes.'],
]

export const dataKey: Key = [
  ['D1', 'Live fetch card', 'Database icon + timestamp of the assembled response and refresh cadence.'],
  ['D2', 'Feed status bullets', 'Per-source counts: OSM ways, SRTM samples, OSRM matrix, rainfall, fallback notices.'],
  ['D3', 'Refresh feeds', 'Full-width secondary button to re-fetch all sources.'],
  ['D4', 'Data source cards', 'Underlined linked title + one-line description: OSM/Overpass, NASA SRTM, OSRM, Open-Meteo.'],
  ['D5', 'Assumptions note', 'Grey info box with info icon listing model assumptions and limitations.'],
  ['D6', 'Export (added)', 'Download ranked streets as CSV / GeoJSON for reporting.'],
]
