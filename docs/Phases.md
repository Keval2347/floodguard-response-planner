# Phases.md: Development Phases and Status (v2)

| Phase | Work | Status |
|---|---|---|
| 0 | Data validation scripts (`jalniti_data_fetch_*.py`): confirm every source returns real data | Done (Jul to Sep) |
| 1 | Scope, UML, data dictionary, PRD and architecture | Done |
| 2 | Data pipeline: OSM, SRTM, OSRM, rainfall, snapshot replay, caching | Done |
| 3 | Risk scoring: features, `base_risk`, rain factor, bands, confidence | Done |
| 4 | Resource allocation: greedy baseline, insertion, 2-opt and relocate | Done |
| 5 | What-if simulator and dashboard (Risk, Care, Trucks, What-if, Data) | Done |
| 6 | Hospital access assessment and OSRM route display | Done |
| 7 | Rainfall baseline fix (2 Oct), security hardening (6 Oct), Semgrep fixes (15 Oct), secrets scan and lint audit (19 Oct) | Done |
| 8 | Report and final presentation | In progress |
| 9 | Rain intensity (1 h / 3 h) and closed-road labelling (Lovable plan, 13 Oct) | Planned |
| 10 | Validation backtest on labelled flood events, relative-elevation feature | Planned |
| 11 | Production path: trained classifier, OR-Tools, FastAPI + PostGIS | Future work |

## Exit rule for each phase
Do not start the next phase until the current one runs end to end with real or clearly labelled data.

## Freeze before submission
Freeze the repo commit, then regenerate the UML, state diagram, data dictionary and screenshots from that commit.
