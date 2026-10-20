# Rules.md: Development Rules (as built, v2)

For every contributor, human or AI tool. Paste this file to any AI assistant before it touches the code.

## 1. Scope
- Keep to the modules in PRD.md: data pipeline, risk scoring, allocation, what-if, hospital access.
- New ideas go in a "future work" list, not into the build.
- Do not touch the `backend/` Python prototype unless the task says so.

## 2. Stack (use what is already there)
| Purpose | Use | Do not add |
|---|---|---|
| App | TanStack Start, React, TypeScript | Another framework |
| UI | Tailwind, shadcn/ui, Leaflet | A second map or UI library |
| Validation | Zod (`schema.ts`) | Unchecked inputs |
| Scoring and allocation | Pure functions in `model.ts` | Hidden state, randomness |
| Tests | The repo's test setup, or vitest if none | Untested logic changes |

## 3. Data honesty
- Simulated values (depots, trucks) must be labelled as simulated in the UI and in comments.
- Stale data must set the `stale` flag and show the warning banner. Never show it as fresh.
- "Observed" rainfall is model-estimated. Say so.
- Do not state accuracy unless it was computed from labelled data. Currently it has not been.
- Only measured OSRM times may be used for allocation. Do not invent speeds.

## 4. Security
- Keep Zod validation on every server function and on `ScenarioOverrides`.
- Segment IDs are `S` followed by 2 to 5 digits (`^S\d{2,5}$`). Test with 3-digit IDs such as `S150`.
- Add a new outbound host only to the allow-list in `schema.ts`, and only if truly needed.
- User-facing errors stay generic. Log details with the `[JalNiti]` tag.
- Never commit secrets. Use `.env` (see `.env.example`).

## 5. Errors and fallbacks
- Every external call needs a timeout and a clear fallback (next mirror, snapshot, or flagged stale).
- One failed source must not crash the dashboard.

## 6. Git
- Never force-push or rewrite pushed history (the repo is connected to Lovable).
- Keep the branch working, because commits sync back to Lovable.
- Do not commit scratch files (patches, prompts) to the repo root.
- Commit code and its docs together, and freeze report diagrams against one commit.

## 7. Docs must match code
When a field, function or rule changes, update Data_Dictionary.md, the UML diagrams and PRD.md in the same change.

## 8. When unsure
Choose the simpler, more explainable and more honestly labelled option.
