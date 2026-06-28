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

export interface AGPBin {
  timeLabel: string;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
}

function getPercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) {
    return sorted[lower];
  }
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export function calculateAGPPercentiles(
  entries: NightscoutEntry[],
  units: GlucoseUnit
): AGPBin[] {
  const bins: number[][] = Array.from({ length: 96 }, () => []);

  // Filter and place entries in bins
  const validEntries = entries.filter((e) => e.sgv && Number.isFinite(e.sgv));
  validEntries.forEach((e) => {
    const d = new Date(e.date);
    const mins = d.getHours() * 60 + d.getMinutes();
    const binIdx = Math.floor(mins / 15);
    if (binIdx >= 0 && binIdx < 96) {
      bins[binIdx].push(e.sgv);
    }
  });

  // Calculate raw percentiles
  const rawBins = bins.map((vals, idx) => {
    const sorted = [...vals].sort((a, b) => a - b);
    const hour = Math.floor(idx / 4).toString().padStart(2, '0');
    const min = ((idx % 4) * 15).toString().padStart(2, '0');
    const timeLabel = `${hour}:${min}`;

    if (sorted.length === 0) {
      return { timeLabel, p10: -1, p25: -1, p50: -1, p75: -1, p90: -1 };
    }

    return {
      timeLabel,
      p10: getPercentile(sorted, 0.1),
      p25: getPercentile(sorted, 0.25),
      p50: getPercentile(sorted, 0.5),
      p75: getPercentile(sorted, 0.75),
      p90: getPercentile(sorted, 0.9),
    };
  });

  // Fill empty bins by searching for nearest non-empty bins (circular)
  const filledBins = rawBins.map((bin, idx) => {
    if (bin.p50 !== -1) return bin;

    let foundLeft = -1;
    let foundRight = -1;

    for (let step = 1; step <= 48; step++) {
      const l = (idx - step + 96) % 96;
      const r = (idx + step) % 96;

      if (rawBins[l].p50 !== -1) {
        foundLeft = l;
        break;
      }
      if (rawBins[r].p50 !== -1) {
        foundRight = r;
        break;
      }
    }

    const sourceIdx = foundLeft !== -1 ? foundLeft : (foundRight !== -1 ? foundRight : -1);
    if (sourceIdx === -1) {
      // Default placeholder curve if no data exists anywhere
      return {
        timeLabel: bin.timeLabel,
        p10: 70,
        p25: 90,
        p50: 110,
        p75: 130,
        p90: 150
      };
    }

    return {
      timeLabel: bin.timeLabel,
      p10: rawBins[sourceIdx].p10,
      p25: rawBins[sourceIdx].p25,
      p50: rawBins[sourceIdx].p50,
      p75: rawBins[sourceIdx].p75,
      p90: rawBins[sourceIdx].p90,
    };
  });

  // Convert to units and round
  return filledBins.map((bin) => {
    const convert = (val: number) => {
      if (units === GlucoseUnit.MMOL) {
        return roundTo(val / CONVERSION_FACTOR, 1);
      } else {
        return roundTo(val, 0);
      }
    };

    return {
      timeLabel: bin.timeLabel,
      p10: convert(bin.p10),
      p25: convert(bin.p25),
      p50: convert(bin.p50),
      p75: convert(bin.p75),
      p90: convert(bin.p90),
    };
  });
}

export interface HourlyTIR {
  hour: number;
  timeLabel: string;
  veryLow: number;
  low: number;
  target: number;
  high: number;
  veryHigh: number;
}

export function calculateHourlyTIR(entries: NightscoutEntry[]): HourlyTIR[] {
  const result: HourlyTIR[] = [];
  const validEntries = entries.filter((e) => e.sgv && Number.isFinite(e.sgv));

  for (let hour = 0; hour < 24; hour++) {
    const hourEntries = validEntries.filter((e) => new Date(e.date).getHours() === hour);
    const count = hourEntries.length;

    // Time label format (e.g. "12 AM", "1 AM", ..., "12 PM", "1 PM", ...)
    let timeLabel = '';
    if (hour === 0) timeLabel = '12 AM';
    else if (hour < 12) timeLabel = `${hour} AM`;
    else if (hour === 12) timeLabel = '12 PM';
    else timeLabel = `${hour - 12} PM`;

    if (count === 0) {
      result.push({
        hour,
        timeLabel,
        veryLow: 0,
        low: 0,
        target: 100, // Default to 100% target if no data
        high: 0,
        veryHigh: 0,
      });
      continue;
    }

    let veryLowCount = 0;
    let lowCount = 0;
    let targetCount = 0;
    let highCount = 0;
    let veryHighCount = 0;

    hourEntries.forEach((e) => {
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

    const veryLow = roundTo((veryLowCount / count) * 100, 0);
    const low = roundTo((lowCount / count) * 100, 0);
    const target = roundTo((targetCount / count) * 100, 0);
    const high = roundTo((highCount / count) * 100, 0);
    const veryHigh = roundTo((veryHighCount / count) * 100, 0);

    result.push({
      hour,
      timeLabel,
      veryLow,
      low,
      target,
      high,
      veryHigh,
    });
  }

  return result;
}
