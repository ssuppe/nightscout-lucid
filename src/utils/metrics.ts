import { GlucoseUnit } from './nightscout';
import type { NightscoutEntry } from './nightscout';

export interface GlucoseMetrics {
  mean: number;
  stdDev: number;
  cv: number;
  gmi: number;
  timeInVeryHigh: number;
  timeInHigh: number;
  timeInTarget: number;
  timeInLow: number;
  timeInVeryLow: number;
  readingCount: number;
}

const CONVERSION_FACTOR = 18.018;

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function calculateGlucoseMetrics(
  entries: NightscoutEntry[],
  units: GlucoseUnit
): GlucoseMetrics {
  const defaultMetrics: GlucoseMetrics = {
    mean: 0,
    stdDev: 0,
    cv: 0,
    gmi: 0,
    timeInVeryHigh: 0,
    timeInHigh: 0,
    timeInTarget: 0,
    timeInLow: 0,
    timeInVeryLow: 0,
    readingCount: 0,
  };

  if (!entries || entries.length === 0) {
    return defaultMetrics;
  }

  // Filter out entries with invalid or missing SGV
  const validEntries = entries.filter((e) => e.sgv && Number.isFinite(e.sgv));
  const count = validEntries.length;

  if (count === 0) {
    return defaultMetrics;
  }

  // Calculate Mean in mg/dL
  const sum = validEntries.reduce((acc, e) => acc + e.sgv, 0);
  const meanMgdl = sum / count;

  // Calculate Standard Deviation in mg/dL
  const variance = validEntries.reduce((acc, e) => acc + Math.pow(e.sgv - meanMgdl, 2), 0) / count;
  const stdDevMgdl = Math.sqrt(variance);

  // Coefficient of Variation (%) is independent of units (SD/Mean * 100)
  const cv = meanMgdl > 0 ? (stdDevMgdl / meanMgdl) * 100 : 0;

  // Time in ranges (standard thresholds in mg/dL)
  let veryLowCount = 0;
  let lowCount = 0;
  let targetCount = 0;
  let highCount = 0;
  let veryHighCount = 0;

  validEntries.forEach((e) => {
    if (e.sgv < 54) {
      veryLowCount++;
    } else if (e.sgv >= 54 && e.sgv <= 69) {
      lowCount++;
    } else if (e.sgv >= 70 && e.sgv <= 180) {
      targetCount++;
    } else if (e.sgv >= 181 && e.sgv <= 250) {
      highCount++;
    } else {
      veryHighCount++;
    }
  });

  const timeInVeryLow = roundTo((veryLowCount / count) * 100, 0);
  const timeInLow = roundTo((lowCount / count) * 100, 0);
  const timeInTarget = roundTo((targetCount / count) * 100, 0);
  const timeInHigh = roundTo((highCount / count) * 100, 0);
  const timeInVeryHigh = roundTo((veryHighCount / count) * 100, 0);

  // GMI calculation (from mean in mg/dL)
  // GMI (%) = 3.31 + 0.02392 * MeanGlucose(mg/dL)
  const gmi = 3.31 + 0.02392 * meanMgdl;

  // Formatting based on preferred units
  let displayMean = meanMgdl;
  let displayStdDev = stdDevMgdl;

  if (units === GlucoseUnit.MMOL) {
    displayMean = roundTo(meanMgdl / CONVERSION_FACTOR, 1);
    displayStdDev = roundTo(stdDevMgdl / CONVERSION_FACTOR, 1);
  } else {
    displayMean = roundTo(meanMgdl, 0);
    displayStdDev = roundTo(stdDevMgdl, 0);
  }

  return {
    mean: displayMean,
    stdDev: displayStdDev,
    cv: roundTo(cv, 0),
    gmi: roundTo(gmi, 1),
    timeInVeryHigh,
    timeInHigh,
    timeInTarget,
    timeInLow,
    timeInVeryLow,
    readingCount: count,
  };
}
