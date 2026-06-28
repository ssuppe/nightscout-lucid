import { describe, it, expect } from 'vitest';
import { calculateGlucoseMetrics, calculateAGPPercentiles, calculateHourlyTIR, calculateHourlyGlucoseStats } from './metrics';
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

      // Empty hours default to 100% target
      expect(hourlyData[0].target).toBe(100);
      expect(hourlyData[0].veryLow).toBe(0);
    });
  });

  describe('Hourly Glucose Stats Calculations', () => {
    it('calculates hourly glucose mean, p15, and p75 correctly', () => {
      const date = new Date();
      date.setHours(14); // 2 PM
      date.setMinutes(30);

      const values = [80, 100, 120, 140, 160];
      const entries = values.map((val, idx) => ({
        _id: `id-${idx}`,
        date: date.getTime(),
        sgv: val,
        direction: 'Flat',
        type: 'sgv',
      }));

      const hourlyStats = calculateHourlyGlucoseStats(entries, GlucoseUnit.MGDL);
      expect(hourlyStats.length).toBe(24);

      const hour14 = hourlyStats[14];
      expect(hour14.timeLabel).toBe('2 PM');
      expect(hour14.mean).toBe(120);
      expect(hour14.p15).toBe(92);
      expect(hour14.p75).toBe(140);

      // Other hours default to values copied from hour 14
      expect(hourlyStats[0].mean).toBe(120);
    });
  });
});
