# Design.md: UI Guidelines (as built, v2)

## 1. Principle
A calm control-room tool for a municipal officer: clear, readable at a glance, and honest about what is real and what is assumed.

## 2. Layout
- A full-height Leaflet map with a side panel.
- The panel has five tabs: **Risk**, **Care** (hospital access), **Trucks**, **What-if**, **Data**.
- A banner appears when the live rainfall feed is stale, with a **Retry now** action.
- Basemap: standard OpenStreetMap tiles, with attribution to OpenStreetMap and OSRM.

## 3. Colours
| Use | Colour |
|---|---|
| Low risk | `#2f8f5b` (green) |
| Moderate risk | `#c9a227` (amber) |
| High risk | `#e07000` (orange) |
| Critical risk | `#b42318` (red) |
| Interface | shadcn slate theme with light and dark tokens in `src/styles.css` |

Always pair colour with a text label, because red and green alone are hard for some users to tell apart.

## 4. Type and components
- Default sans-serif from Tailwind (no custom font is loaded).
- shadcn/ui components: Tabs, Card, Button, Alert, Badge and similar.

## 5. Honest labelling
- Simulated depots and trucks are labelled as simulated.
- The Data tab lists every source and its timestamp.
- Stale or replayed data is announced in the banner and in provenance notes.
- Confidence is shown as measured or indicative.

## 6. Responsiveness check (do before the demo)
Test at phone, tablet and desktop widths. The five tabs, map controls and legend must stay tappable and unclipped.

## 7. Avoid
Decorative animation, dense tables without the map, and any colour that makes "Critical" ambiguous.
