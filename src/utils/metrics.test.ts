import { describe, it, expect } from 'vitest';
import { calculateGlucoseMetrics, calculateAGPPercentiles, calculateHourlyTIR, calculate15MinGlucoseStats, deduplicateTreatments } from './metrics';
import { GlucoseUnit } from './nightscout';
import type { NightscoutEntry } from './nightscout';

describe('Glucose Metrics Calculations', () => {
  // Construct mock glucose readings
  // Standard range is 70 to 180.
  const createMockEntries = (values: number[]): NightscoutEntry[] => {
    return values.map((val, idx) => ({
      _id: `id-${idx}`,
      date: Date.now() - idx * 5 * 60 * 1000, // 5 min intervals
      sgv: val,
      type: 'sgv',
      direction: 'Flat',
    }));
  };

  it('handles empty entries list gracefully', () => {
    const metrics = calculateGlucoseMetrics([], GlucoseUnit.MGDL);
    expect(metrics).toEqual({
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
    });
  });

  it('calculates mean, SD, and CV correctly in mg/dL', () => {
    // Mean = 100, SD = 0, CV = 0
    const entries = createMockEntries([100, 100, 100]);
    const metrics = calculateGlucoseMetrics(entries, GlucoseUnit.MGDL);
    expect(metrics.mean).toBe(100);
    expect(metrics.stdDev).toBe(0);
    expect(metrics.cv).toBe(0);
    expect(metrics.readingCount).toBe(3);
  });

  it('calculates Time in Range percentages correctly in mg/dL', () => {
    // 5 values corresponding to the 5 standard categories:
    // Very Low: 50 (<54)
    // Low: 60 (54-69)
    // Target: 100 (70-180)
    // High: 200 (181-250)
    // Very High: 300 (>250)
    const entries = createMockEntries([50, 60, 100, 200, 300]);
    const metrics = calculateGlucoseMetrics(entries, GlucoseUnit.MGDL);

    expect(metrics.timeInVeryLow).toBe(20); // 1/5 = 20%
    expect(metrics.timeInLow).toBe(20);      // 1/5 = 20%
    expect(metrics.timeInTarget).toBe(20);   // 1/5 = 20%
    expect(metrics.timeInHigh).toBe(20);     // 1/5 = 20%
    expect(metrics.timeInVeryHigh).toBe(20); // 1/5 = 20%
  });

  it('TIR percentages always sum to exactly 100 (largest-remainder rounding)', () => {
    // 3 entries: 1 very-low (50), 1 target (100), 1 high (200)
    // Raw floats: veryLow=33.33%, target=33.33%, high=33.33% — naive rounding gives 33+33+33=99
    const entries = createMockEntries([50, 100, 200]);
    const metrics = calculateGlucoseMetrics(entries, GlucoseUnit.MGDL);

    const sum =
      metrics.timeInVeryHigh +
      metrics.timeInHigh +
      metrics.timeInTarget +
      metrics.timeInLow +
      metrics.timeInVeryLow;
    expect(sum).toBe(100);
  });

  it('TIR percentages sum to exactly 100 for a 7-entry dataset (another rounding edge case)', () => {
    // 7 equal entries across 5 buckets: 1 each for vL, L, T, H, vH, plus 2 extra in target
    // counts: vL=1, L=1, T=3, H=1, vH=1 → raw: 14.28, 14.28, 42.85, 14.28, 14.28 — sums vary by rounding
    const entries = createMockEntries([50, 60, 100, 120, 140, 200, 300]);
    const metrics = calculateGlucoseMetrics(entries, GlucoseUnit.MGDL);

    const sum =
      metrics.timeInVeryHigh +
      metrics.timeInHigh +
      metrics.timeInTarget +
      metrics.timeInLow +
      metrics.timeInVeryLow;
    expect(sum).toBe(100);
  });

  it('calculates GMI correctly in mg/dL', () => {
    // Mean is 150. GMI = 3.31 + 0.02392 * 150 = 6.898% (rounds to 6.9%)
    const entries = createMockEntries([150, 150, 150]);
    const metrics = calculateGlucoseMetrics(entries, GlucoseUnit.MGDL);
    expect(metrics.gmi).toBe(6.9);
  });

  it('converts calculations and boundaries correctly when preferred unit is mmol/L', () => {
    // In mmol/L mode, we assume the input values from Nightscout SGV are ALWAYS stored in mg/dL
    // (Nightscout API stores sgv in mg/dL, so the client needs to convert them to mmol/L for display)
    // Let's test standard conversions:
    // 90 mg/dL is 5.0 mmol/L (90 / 18.018)
    // 180 mg/dL is 10.0 mmol/L (180 / 18.018)
    const entries = createMockEntries([90, 180]);
    const metrics = calculateGlucoseMetrics(entries, GlucoseUnit.MMOL);

    // Mean of 90 and 180 is 135 mg/dL. In mmol/L, 135 / 18.018 = 7.49 mmol/L (rounded to 7.5)
    expect(metrics.mean).toBe(7.5);
    // Both 90 and 180 are in target range (70 to 180 mg/dL)
    expect(metrics.timeInTarget).toBe(100);
    // GMI is calculated from the mg/dL mean of 135. GMI = 3.31 + 0.02392 * 135 = 6.539% (rounds to 6.5%)
    expect(metrics.gmi).toBe(6.5);
  });

  describe('AGP Percentiles', () => {
    it('calculates percentiles for a simple dataset correctly in mg/dL', () => {
      const date = new Date();
      date.setHours(12);
      date.setMinutes(0);
      date.setSeconds(0);
      
      const values = [70, 80, 90, 100, 110, 120, 130, 140, 150, 160, 170];
      const entries = values.map((val, idx) => ({
        _id: `id-${idx}`,
        date: date.getTime(),
        sgv: val,
        direction: 'Flat',
        type: 'sgv',
      }));

      const percentiles = calculateAGPPercentiles(entries, GlucoseUnit.MGDL);
      expect(percentiles.length).toBe(96);
      
      const noonBin = percentiles[48]; // index 48 corresponds to 12:00
      expect(noonBin.timeLabel).toBe('12:00');
      expect(noonBin.p50).toBe(120); // Median
      expect(noonBin.p10).toBe(80);  // 10th percentile
      expect(noonBin.p90).toBe(160); // 90th percentile
      expect(noonBin.p25).toBe(95);  // 25th percentile (interpolated)
      expect(noonBin.p75).toBe(145); // 75th percentile (interpolated)
    });

    it('performs circular interpolation/fill for empty bins', () => {
      const date = new Date();
      date.setHours(6);
      date.setMinutes(0);
      
      const entries = [{
        _id: 'id-1',
        date: date.getTime(),
        sgv: 120,
        direction: 'Flat',
        type: 'sgv',
      }];

      const percentiles = calculateAGPPercentiles(entries, GlucoseUnit.MGDL);
      
      expect(percentiles[0].p50).toBe(120);
      expect(percentiles[50].p50).toBe(120);
      expect(percentiles[24].p50).toBe(120);
    });
  });

  describe('Hourly TIR Calculations', () => {
    it('calculates hourly TIR distribution correctly', () => {
      const date = new Date();
      date.setHours(10);
      date.setMinutes(30);

      const values = [50, 60, 100, 200];
      const entries = values.map((val, idx) => ({
        _id: `id-${idx}`,
        date: date.getTime(),
        sgv: val,
        direction: 'Flat',
        type: 'sgv',
      }));

      const hourlyData = calculateHourlyTIR(entries);
      expect(hourlyData.length).toBe(24);

      const hour10 = hourlyData[10];
      expect(hour10.timeLabel).toBe('10 AM');
      expect(hour10.veryLow).toBe(25); // 1/4
      expect(hour10.low).toBe(25);      // 1/4
      expect(hour10.target).toBe(25);   // 1/4
      expect(hour10.high).toBe(25);     // 1/4
      expect(hour10.veryHigh).toBe(0);

      // Empty hours should have noData: true and 0% target
      expect(hourlyData[0].noData).toBe(true);
      expect(hourlyData[0].target).toBe(0);
      expect(hourlyData[0].veryLow).toBe(0);
    });
  });

  describe('15-Min Glucose Stats Calculations', () => {
    it('calculates 15-minute glucose mean, p15, and p75 correctly', () => {
      const date = new Date();
      date.setHours(14); // 2 PM
      date.setMinutes(35); // Bin index 14 * 4 + 2 = 58

      const values = [80, 100, 120, 140, 160];
      const entries = values.map((val, idx) => ({
        _id: `id-${idx}`,
        date: date.getTime(),
        sgv: val,
        direction: 'Flat',
        type: 'sgv',
      }));

      const stats15 = calculate15MinGlucoseStats(entries, GlucoseUnit.MGDL);
      expect(stats15.length).toBe(96);

      const bin58 = stats15[58];
      expect(bin58.timeLabel).toBe('14:30');
      expect(bin58.mean).toBe(120);
      expect(bin58.p15).toBe(92);
      expect(bin58.p75).toBe(140);

      // Other bins default to values copied from bin 58
      expect(stats15[0].mean).toBe(120);
    });
  });

  describe('Deduplicate Treatments', () => {
    it('deduplicates overlapping carb and insulin entries correctly', () => {
      const baseTime = Date.now();
      const treatments = [
        { _id: 't1', date: baseTime, created_at: new Date(baseTime).toISOString(), eventType: 'Meal Bolus', carbs: 45, insulin: 5 },
        { _id: 't2', date: baseTime + 1000, created_at: new Date(baseTime + 1000).toISOString(), eventType: 'Note', carbs: 45, insulin: 0 },
        { _id: 't3', date: baseTime + 500000, created_at: new Date(baseTime + 500000).toISOString(), eventType: 'Carb Correction', carbs: 20, insulin: 0 },
        { _id: 't4', date: baseTime + 500100, created_at: new Date(baseTime + 500100).toISOString(), eventType: 'Meal Bolus', carbs: 0, insulin: 3 }
      ];

      const deduplicated = deduplicateTreatments(treatments);
      expect(deduplicated.length).toBe(2);

      const first = deduplicated[0];
      expect(first.carbs).toBe(45);
      expect(first.insulin).toBe(5);

      const second = deduplicated[1];
      expect(second.carbs).toBe(20);
      expect(second.insulin).toBe(3);
    });
  });
});
