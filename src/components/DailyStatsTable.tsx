import React from 'react';
import { GlucoseUnit } from '../utils/nightscout';
import type { NightscoutEntry } from '../utils/nightscout';

interface DailyStatsTableProps {
  days: Date[]; // Kept for interface compatibility
  entries: NightscoutEntry[];
  units: GlucoseUnit;
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

const TimeInRangeResistor: React.FC<{
  veryHigh: number;
  high: number;
  inRange: number;
  low: number;
  veryLow: number;
}> = ({ veryHigh, high, inRange, low, veryLow }) => {
  const total = veryHigh + high + inRange + low + veryLow;
  const factor = total > 0 ? 60 / total : 0.6; // scale to 60px height
  
  const hVeryHigh = veryHigh * factor;
  const hHigh = high * factor;
  const hInRange = inRange * factor;
  const hLow = low * factor;
  const hVeryLow = veryLow * factor;

  const yVeryHigh = 0;
  const yHigh = hVeryHigh;
  const yInRange = yHigh + hHigh;
  const yLow = yInRange + hInRange;
  const yVeryLow = yLow + hLow;

  return (
    <svg height="60" width="30" className="overflow-hidden rounded-[3px] border border-slate-200/60 shadow-sm inline-block">
      <g>
        {hVeryHigh > 0 && <rect x="0" y={yVeryHigh} height={hVeryHigh} width="30" fill="#F29100" />}
        {hHigh > 0 && <rect x="0" y={yHigh} height={hHigh} width="30" fill="#FCD116" />}
        {hInRange > 0 && <rect x="0" y={yInRange} height={hInRange} width="30" fill="#72B100" />}
        {hLow > 0 && <rect x="0" y={yLow} height={hLow} width="30" fill="#F04124" />}
        {hVeryLow > 0 && <rect x="0" y={yVeryLow} height={hVeryLow} width="30" fill="#9C0006" />}
      </g>
    </svg>
  );
};

export const DailyStatsTable: React.FC<DailyStatsTableProps> = ({
  entries,
  units
}) => {
  const isMgdl = units === GlucoseUnit.MGDL;
  const CONVERSION_FACTOR = 18.018;
  const conversion = (val: number) => isMgdl ? val : val / CONVERSION_FACTOR;

  // Weekdays Mon-Sun matching Dexcom Clarity layout
  const weekdayList = [
    { label: 'Mon', value: 1 },
    { label: 'Tue', value: 2 },
    { label: 'Wed', value: 3 },
    { label: 'Thu', value: 4 },
    { label: 'Fri', value: 5 },
    { label: 'Sat', value: 6 },
    { label: 'Sun', value: 0 }
  ];

  const formatPct = (pctCount: number, totalCount: number) => {
    if (pctCount === 0) return '0';
    const pct = Math.round((pctCount / totalCount) * 100);
    if (pct === 0) return '<1';
    return pct.toString();
  };

  // Pre-calculate data for each day-of-week column
  const columnsData = weekdayList.map(({ label, value }) => {
    const dayEntries = entries.filter(e => {
      if (!e.sgv || !Number.isFinite(e.sgv)) return false;
      const d = new Date(e.date);
      return d.getDay() === value;
    });

    const count = dayEntries.length;
    if (count === 0) {
      return {
        label,
        count: 0,
        veryHighPctStr: '0',
        highPctStr: '0',
        inRangePctStr: '0',
        lowPctStr: '0',
        veryLowPctStr: '0',
        veryHighCount: 0,
        highCount: 0,
        inRangeCount: 0,
        lowCount: 0,
        veryLowCount: 0,
        min: '-',
        max: '-',
        mean: '-',
        stdDev: '-',
        q1: '-',
        median: '-',
        q3: '-',
        iqr: '-',
        iqStdDev: '-',
        sdMean: '-',
        cv: '-'
      };
    }

    // Count distributions
    const veryHighCount = dayEntries.filter(e => e.sgv > 250).length;
    const highCount = dayEntries.filter(e => e.sgv > 180 && e.sgv <= 250).length;
    const inRangeCount = dayEntries.filter(e => e.sgv >= 70 && e.sgv <= 180).length;
    const lowCount = dayEntries.filter(e => e.sgv >= 54 && e.sgv < 70).length;
    const veryLowCount = dayEntries.filter(e => e.sgv < 54).length;

    // Percentages (string format matching Clarity, e.g. "<1")
    const veryHighPctStr = formatPct(veryHighCount, count);
    const highPctStr = formatPct(highCount, count);
    const inRangePctStr = formatPct(inRangeCount, count);
    const lowPctStr = formatPct(lowCount, count);
    const veryLowPctStr = formatPct(veryLowCount, count);

    // Glucose values sorted
    const sorted = dayEntries.map(e => conversion(e.sgv)).sort((a, b) => a - b);
    const minVal = sorted[0];
    const maxVal = sorted[sorted.length - 1];

    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const meanVal = sum / count;

    // Standard Deviation
    const sqDiffs = sorted.map(v => Math.pow(v - meanVal, 2));
    const variance = sqDiffs.reduce((acc, v) => acc + v, 0) / count;
    const stdDevVal = Math.sqrt(variance);

    // Percentiles
    const q1Val = getPercentile(sorted, 0.25);
    const medianVal = getPercentile(sorted, 0.5);
    const q3Val = getPercentile(sorted, 0.75);
    const iqrVal = q3Val - q1Val;

    // IQ Std Dev (SD of values between Q1 and Q3)
    const iqValues = sorted.filter(v => v >= q1Val && v <= q3Val);
    let iqStdDevVal = 0;
    if (iqValues.length > 0) {
      const iqMean = iqValues.reduce((acc, v) => acc + v, 0) / iqValues.length;
      const iqSqDiffs = iqValues.map(v => Math.pow(v - iqMean, 2));
      const iqVariance = iqSqDiffs.reduce((acc, v) => acc + v, 0) / iqValues.length;
      iqStdDevVal = Math.sqrt(iqVariance);
    }

    // Standard Error of Mean (SD Mean)
    const sdMeanVal = stdDevVal / Math.sqrt(count);

    // CV %
    const cvVal = meanVal > 0 ? (stdDevVal / meanVal) * 100 : 0;

    const precision = isMgdl ? 0 : 1;
    const format = (val: number) => val.toFixed(precision);

    return {
      label,
      count,
      veryHighPctStr,
      highPctStr,
      inRangePctStr,
      lowPctStr,
      veryLowPctStr,
      veryHighCount,
      highCount,
      inRangeCount,
      lowCount,
      veryLowCount,
      min: format(minVal),
      max: format(maxVal),
      mean: format(meanVal),
      stdDev: format(stdDevVal),
      q1: format(q1Val),
      median: format(medianVal),
      q3: format(q3Val),
      iqr: format(iqrVal),
      iqStdDev: format(iqStdDevVal),
      sdMean: sdMeanVal.toFixed(1),
      cv: Math.round(cvVal).toString()
    };
  });

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white p-6 shadow-sm font-sans text-left">
      <div className="mb-4">
        <h3 className="text-sm font-extrabold text-slate-800">Daily Statistics</h3>
        <p className="text-xs text-slate-400 font-semibold mt-0.5">Aggregated metrics grouped by day of week</p>
      </div>

      <table className="w-full text-xs font-bold text-slate-600 border-collapse min-w-[700px]">
        <thead>
          <tr className="border-b border-slate-200 text-slate-400 font-extrabold text-[10px] uppercase tracking-wider">
            <th className="py-3 text-left font-black w-40 border-r border-slate-200 pr-4">Metric</th>
            {columnsData.map((col, idx) => (
              <th key={idx} className="py-3 text-center w-20 font-black">{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody className="text-slate-700">
          
          {/* TIR Resistor Row */}
          <tr className="border-b border-slate-200">
            <td className="py-4 text-slate-500 font-bold border-r border-slate-200 pr-4">Time in Range</td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-4 text-center">
                {col.count > 0 ? (
                  <TimeInRangeResistor
                    veryHigh={col.veryHighCount}
                    high={col.highCount}
                    inRange={col.inRangeCount}
                    low={col.lowCount}
                    veryLow={col.veryLowCount}
                  />
                ) : (
                  <span className="text-[10px] text-slate-300 italic font-semibold">-</span>
                )}
              </td>
            ))}
          </tr>

          {/* % Very High */}
          <tr>
            <td className="py-2.5 flex items-center gap-2 text-slate-500 font-bold border-r border-slate-200 pr-4">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#F29100] shrink-0" />
              <span>% Very High</span>
            </td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-2.5 text-center text-slate-900 font-black">
                {col.count > 0 ? `${col.veryHighPctStr}%` : '-'}
              </td>
            ))}
          </tr>

          {/* % High */}
          <tr>
            <td className="py-2.5 flex items-center gap-2 text-slate-500 font-bold border-r border-slate-200 pr-4">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#FCD116] shrink-0" />
              <span>% High</span>
            </td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-2.5 text-center text-slate-900 font-black">
                {col.count > 0 ? `${col.highPctStr}%` : '-'}
              </td>
            ))}
          </tr>

          {/* % In Range */}
          <tr className="bg-[#72B100]/5">
            <td className="py-2.5 flex items-center gap-2 text-[#527e00] font-black border-r border-slate-200 pr-4">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#72B100] shrink-0" />
              <span>% In Range</span>
            </td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-2.5 text-center text-[#72B100] font-black text-sm">
                {col.count > 0 ? `${col.inRangePctStr}%` : '-'}
              </td>
            ))}
          </tr>

          {/* % Low */}
          <tr>
            <td className="py-2.5 flex items-center gap-2 text-slate-500 font-bold border-r border-slate-200 pr-4">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#F04124] shrink-0" />
              <span>% Low</span>
            </td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-2.5 text-center text-slate-900 font-black">
                {col.count > 0 ? `${col.lowPctStr}%` : '-'}
              </td>
            ))}
          </tr>

          {/* % Very Low */}
          <tr className="border-b-2 border-slate-400/80">
            <td className="py-2.5 flex items-center gap-2 text-slate-500 font-bold border-r border-slate-200 pr-4">
              <span className="w-2.5 h-2.5 rounded-sm bg-[#9C0006] shrink-0" />
              <span>% Very Low</span>
            </td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-2.5 text-center text-slate-900 font-black">
                {col.count > 0 ? `${col.veryLowPctStr}%` : '-'}
              </td>
            ))}
          </tr>

          {/* # Readings */}
          <tr>
            <td className="py-2.5 text-slate-400 font-bold border-r border-slate-200 pr-4"># Readings</td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-2.5 text-center text-slate-800 font-black">
                {col.count > 0 ? col.count : '-'}
              </td>
            ))}
          </tr>

          {/* Min */}
          <tr>
            <td className="py-2.5 text-slate-400 font-bold border-r border-slate-200 pr-4">Min</td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-2.5 text-center text-slate-800 font-bold">
                {col.min}
              </td>
            ))}
          </tr>

          {/* Max */}
          <tr className="border-b border-slate-200">
            <td className="py-2.5 text-slate-400 font-bold border-r border-slate-200 pr-4">Max</td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-2.5 text-center text-slate-800 font-bold">
                {col.max}
              </td>
            ))}
          </tr>

          {/* Mean */}
          <tr className="bg-slate-50/50">
            <td className="py-2.5 text-slate-800 font-black border-r border-slate-200 pr-4">Mean</td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-2.5 text-center text-slate-900 font-black text-xs">
                {col.mean}
              </td>
            ))}
          </tr>

          {/* Std. Dev. */}
          <tr className="border-b-2 border-slate-400/80">
            <td className="py-2.5 text-slate-400 font-bold border-r border-slate-200 pr-4">Std. Dev.</td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-2.5 text-center text-slate-800 font-bold">
                {col.stdDev}
              </td>
            ))}
          </tr>

          {/* Quartile 25 */}
          <tr>
            <td className="py-2.5 text-slate-400 font-bold border-r border-slate-200 pr-4">Quartile 25</td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-2.5 text-center text-slate-800 font-bold">
                {col.q1}
              </td>
            ))}
          </tr>

          {/* Median */}
          <tr className="bg-slate-50/50">
            <td className="py-2.5 text-slate-800 font-black border-r border-slate-200 pr-4">Median</td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-2.5 text-center text-slate-900 font-black">
                {col.median}
              </td>
            ))}
          </tr>

          {/* Quartile 75 */}
          <tr>
            <td className="py-2.5 text-slate-400 font-bold border-r border-slate-200 pr-4">Quartile 75</td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-2.5 text-center text-slate-800 font-bold">
                {col.q3}
              </td>
            ))}
          </tr>

          {/* IQR */}
          <tr className="border-b border-slate-200">
            <td className="py-2.5 text-slate-400 font-bold border-r border-slate-200 pr-4">IQR</td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-2.5 text-center text-slate-800 font-bold">
                {col.iqr}
              </td>
            ))}
          </tr>

          {/* IQ Std. Dev. */}
          <tr>
            <td className="py-2.5 text-slate-400 font-bold border-r border-slate-200 pr-4">IQ Std. Dev.</td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-2.5 text-center text-slate-800 font-bold">
                {col.iqStdDev}
              </td>
            ))}
          </tr>

          {/* SD Mean */}
          <tr>
            <td className="py-2.5 text-slate-400 font-bold border-r border-slate-200 pr-4">SD Mean</td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-2.5 text-center text-slate-800 font-bold">
                {col.sdMean}
              </td>
            ))}
          </tr>

          {/* %CV */}
          <tr className="border-b border-slate-300">
            <td className="py-2.5 text-slate-400 font-bold border-r border-slate-200 pr-4">%CV</td>
            {columnsData.map((col, idx) => (
              <td key={idx} className="py-2.5 text-center text-slate-800 font-bold">
                {col.cv}
              </td>
            ))}
          </tr>

        </tbody>
      </table>
    </div>
  );
};
