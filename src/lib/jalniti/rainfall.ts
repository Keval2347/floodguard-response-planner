/**
 * Pure helpers for deriving short-duration rainfall intensity.
 * Hourly entries represent one-hour totals; 15-minute entries use mm/bucket.
 */
export interface RainPeaks {
  peak1hMm?: number;
  peak3hMm?: number;
}

function maximumWindowTotal(values: number[], width: number): number | undefined {
  if (values.length === 0) return undefined;
  let max = 0;
  for (let start = 0; start + width <= values.length; start++) {
    const total = values.slice(start, start + width).reduce((sum, value) => sum + value, 0);
    max = Math.max(max, total);
  }
  return Math.round(max * 10) / 10;
}

/** Combine hourly history/near-term forecast with the available 15-minute nowcast. */
export function calculateRainPeaks(hourlyMm: number[], quarterHourMm: number[] = []): RainPeaks {
  const peak1hMm = [maximumWindowTotal(hourlyMm, 1), maximumWindowTotal(quarterHourMm, 4)]
    .filter((value): value is number => value !== undefined)
    .reduce((max, value) => Math.max(max, value), 0);
  const peak3hMm = [maximumWindowTotal(hourlyMm, 3), maximumWindowTotal(quarterHourMm, 12)]
    .filter((value): value is number => value !== undefined)
    .reduce((max, value) => Math.max(max, value), 0);
  return {
    ...(hourlyMm.length || quarterHourMm.length ? { peak1hMm, peak3hMm } : {}),
  };
}