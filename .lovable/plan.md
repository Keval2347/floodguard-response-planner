# JalNiti rainfall and closure-label corrections

## Scope
Implement only the selected items from the attached prompt, in the requested order. Preserve the existing optimizer, snapshot fallback, provider chain, stale flags, validation, and UI layout.

## Build steps
1. Remove the dry-day rainfall floor in `defaultScenario`; missing/dry rainfall starts at 0 rather than a reference storm.
2. Add optional peak 1-hour and 3-hour rainfall signals, with rolling-window computation for Open-Meteo and MET Norway and safe optional handling for IMD/older snapshots. Add `rain3hMm` to strict scenario validation, use the stronger of the 24-hour and 3-hour normalized curves, surface a 3-hour what-if control, and label the placeholder 3-hour reference as an assumption.
3. Follow the prompt's documented fallback for route closures: rename the UI control so it says streets are excluded from pumping, not that truck routes avoid them. Do not change routing logic.
4. Add focused tests for dry input, intense versus spread rainfall, optional old data, and strict scenario bounds; run tests and the required production build.

## Deferred by request
Validation/backtest harness (Task 1), relative-elevation scoring (Task 3), and forecast preset (Task 5) are not part of this pass.

## Technical details
Keep all new rainfall fields optional for compatibility. Use no new paid service, API key, or external host. Keep server-only provider requests inside the existing server pipeline; no backend/Python changes.
