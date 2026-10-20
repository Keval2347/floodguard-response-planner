# PRD.md: Product Requirements Document (as built, v2)

Synced with repository commit `a722a3a` (16 Oct 2026). Anything marked **Planned** is not in the code yet.

## 1. Project
**JalNiti**: an AI-assisted municipal flood decision-support system for one ward.
Pilot ward: **Navrangpura, Ahmedabad**. Live app: https://floodguard-response-planner.lovable.app

## 2. Summary
JalNiti does not forecast floods. It starts from a rainfall signal and turns it into an action plan: which streets are
most at risk, where simulated pump trucks should go first, and what changes when the officer changes the assumptions.
"AI-assisted" means data-driven scoring and algorithmic optimization supporting a human decision-maker. It does not mean
a trained machine-learning model.

## 3. Problem
- Urban flooding costs India an estimated USD 4 billion a year (World Bank, as reported by ThePrint and Daily Pioneer).
- In July 2026 Ahmedabad averaged 163.24 mm of rain in a day. News reports say AMC listed 148 priority waterlogging locations
  while about 40 mobile pumps were spread across its seven zones.
- Existing tools (Google Flood Hub, FloodWatch India, NRSC/Bhuvan) forecast or map floods. None of those we reviewed plans
  pump-truck deployment at street level or lets an officer test "what if" changes.

## 4. What JalNiti is not
- Not a flood predictor and not a replacement for IMD or Google Flood Hub.
- Not city-wide: one ward only.
- It does not control real pumps. It gives recommendations to a human.

## 5. Users
| User | Need |
|---|---|
| Municipal flood-control officer (primary) | Ranked risky streets and a pump-truck plan |
| Disaster-management planner | A what-if tool to stress-test plans before a storm |
| Faculty / evaluators | A working, honest demonstration with traceable data |

## 6. Objectives
1. Build a ward-level data pipeline from public sources with snapshot fallback.
2. Score every street segment with a transparent rule-based risk score and band.
3. Plan simulated pump-truck deployment as a routing problem and compare it with a greedy baseline.
4. Provide a what-if simulator.
5. Assess hospital access through approach-road risk.
6. Show provenance and warn when data is stale or simulated.

## 7. Modules and status
| Module | Description | Status |
|---|---|---|
| Data pipeline | Overpass, OpenTopoData, OSRM, Open-Meteo/MET Norway, snapshot replay, caching | Implemented |
| Risk scoring | `scoreSegments()`: rule-based score, band and confidence | Implemented (baseline formula) |
| Resource allocation | `allocate()`: insertion plus 2-opt and relocate local search, greedy baseline | Implemented (hand-coded, deterministic) |
| What-if simulator | Rain, drains cleared, excluded streets, trucks, shift length | Implemented |
| Hospital access | `assessHospitals()`: clear / watch / at-risk / cut-off / unknown | Implemented |
| Security hardening | Zod validation, URL allow-list, generic errors | Implemented |
| Validation against flood records | Backtest on labelled events | **Not done** (ground truth has 3 rows) |
| Rain intensity (1 h / 3 h) in risk | Peak-rainfall driver | **Planned** (`.lovable/plan`) |
| "Closed" label / route avoidance | Rename to "Excluded from pumping" or avoid closed roads in routes | **Planned** |
| Trained classifier, OR-Tools, FastAPI + PostGIS | Production path | **Planned** (`backend/` is a prototype, not deployed) |

## 8. Functional requirements
- FR1: Load ward data (segments, depots, rainfall, travel matrix) within a 35 s budget, else replay the committed snapshot.
- FR2: Give each street a risk (0 to 1), a band (low, moderate, high, critical) and a confidence (measured or indicative).
- FR3: Allocate trucks to the top 60 planning streets within travel-time and shift limits, and report the greedy baseline.
- FR4: What-if controls: `rainMm` (24 h), `drainsCleared`, `closed` (excluded from pumping), `trucksAvailable`, `shiftMinutes`.
- FR5: Classify each hospital's access status.
- FR6: Map layers: risk, hospitals (Care), trucks, what-if, data.
- FR7: Show provenance notes, stale-feed warnings and a Refresh feeds action.
- FR8: Validate every server input and hide internal error details from users.

## 9. Non-functional requirements
- Explainable: simple formulas that can be written on a board.
- Free: public data and open-source libraries only.
- Fast: cached ward data (45 min), rain (2 min), hospitals (24 h); allocation is deterministic.
- Honest: simulated or assumed values are labelled, and stale data is never shown as fresh.
- Secure: strict input schemas, host allow-list, no secrets in the repo.

## 10. Data sources
| Data | Source |
|---|---|
| Roads, waterways, hospitals | OpenStreetMap via Overpass |
| Elevation | SRTM via OpenTopoData (GMTED2010 fallback) |
| Travel times, routes | OSRM |
| Rainfall | Open-Meteo (MET Norway backup) |

## 11. Assumptions and known limitations
- Depots and trucks are **simulated**: 3 depots, 10 trucks.
- Only the 60 highest base-risk streets get exact OSRM travel times. Other streets are map-only.
- OSRM times are free-flow. Flood slowdowns are not modelled.
- "Observed" rainfall is model-estimated, from one point for the whole ward.
- Risk weights (water 0.34, slope 0.28, elevation 0.22, road density 0.16) are hand-set and not validated.
- `closed` streets are only excluded from pumping targets. Drawn routes do not avoid them yet.
- Risk uses the 24 h rainfall total, not short-burst intensity.

## 12. Future work
Validation backtest, rain intensity, relative-elevation feature, route avoidance, trained classifier, FastAPI + PostGIS.

## 13. Success criteria
A live demo for one ward using real public data, an optimized plan reported against a greedy baseline, a what-if change
that visibly changes the plan, and clear labels for everything simulated.
