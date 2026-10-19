# JalNiti data dictionary

## Rainfall fields

| Field | Units | Meaning | Availability |
| --- | --- | --- | --- |
| `observedMm` | mm / preceding 24 h | Observed/reanalysis accumulation used for the live 24-hour load. | Required in ward and live-rain DTOs. |
| `forecastMm` | mm / next 24 h | Forecast accumulation; shown separately and does not drive the live map. | Required. |
| `peak1hMm` | mm / rolling 1 h | Highest one-hour total across the available recent hourly window and near-term nowcast. | Optional; absent from older snapshots/providers. |
| `peak3hMm` | mm / rolling 3 h | Highest three-hour accumulation across the recent hourly window and near-term nowcast. | Optional; absent from older snapshots/providers. |
| `rainMm` | mm / 24 h | What-if scenario total. | Required scenario input. |
| `rain3hMm` | mm / rolling 3 h | What-if peak-intensity input. If omitted by an older scenario, the model uses the ward's optional peak, then zero. | Optional scenario input, validated from 0 to 300. |

Risk scoring uses the larger of the normalized 24-hour and 3-hour rainfall curves. The 3-hour reference value (30 mm) is an explicit placeholder assumption; it is not calibrated or an accuracy claim and should be revisited with the validation/backtest data.

Hourly provider values represent the total in the preceding hour. Existing snapshots remain valid because all newly introduced peak fields are optional.

## Road closure scenario field

`closed` contains valid street-segment IDs excluded from pump-allocation targets. It does not constrain OSRM route geometry; displayed truck routes may still use those streets.