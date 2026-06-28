import React from 'react';
import { GlucoseUnit } from '../utils/nightscout';
import type { NightscoutEntry } from '../utils/nightscout';

interface HourlyStatsTableProps {
  entries: NightscoutEntry[];
  units: GlucoseUnit;
}

export const HourlyStatsTable: React.FC<HourlyStatsTableProps> = ({
  entries,
  units
}) => {
  const isMgdl = units === GlucoseUnit.MGDL;
  const conversion = (val: number) => isMgdl ? val : val / 18.018;

  // Generate 24 hour blocks
  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="overflow-x-auto border border-slate-200 rounded-xl bg-white p-6 shadow-sm font-sans text-left">
      <div className="mb-4">
        <h3 className="text-sm font-extrabold text-slate-800">Hourly Statistics</h3>
        <p className="text-xs text-slate-400 font-semibold mt-0.5">Aggregated metrics grouped by hour of day</p>
      </div>

      <table className="w-full text-xs font-bold text-slate-600 border-collapse min-w-[900px]">
        <thead>
          <tr className="border-b border-slate-200 text-slate-400 font-extrabold text-[10px] uppercase tracking-wider">
            <th className="py-3 text-left font-black w-40 border-r border-slate-200 pr-4">Hour Range</th>
            <th className="py-3 text-right font-black w-24">Avg Glucose</th>
            <th className="py-3 text-right font-black w-28 border-r border-slate-200 pr-4">SD (CV)</th>
            <th className="py-3 text-right text-orange-600 font-black w-24">% Very High</th>
            <th className="py-3 text-right text-amber-600 font-black w-24">% High</th>
            <th className="py-3 text-right text-[#72B100] font-black w-24">% In Range</th>
            <th className="py-3 text-right text-red-600 font-black w-24">% Low</th>
            <th className="py-3 text-right text-[#9C0006] font-black w-28 border-r border-slate-200 pr-4">% Very Low</th>
            <th className="py-3 text-right font-black w-28">Readings Count</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 text-slate-700">
          {hours.map((hour) => {
            const hourEntries = entries.filter(e => {
              if (!e.sgv || !Number.isFinite(e.sgv)) return false;
              const d = new Date(e.date);
              return d.getHours() === hour;
            });

            let meanStr = '-';
            let sdCvStr = '-';
            let veryHighPct = 0;
            let highPct = 0;
            let inRangePct = 0;
            let lowPct = 0;
            let veryLowPct = 0;
            const hasGlucose = hourEntries.length > 0;

            if (hasGlucose) {
              const sum = hourEntries.reduce((acc, e) => acc + e.sgv, 0);
              const meanVal = sum / hourEntries.length;
              meanStr = `${conversion(meanVal).toFixed(isMgdl ? 0 : 1)} ${units}`;

              const squareDiffs = hourEntries.map(e => Math.pow(e.sgv - meanVal, 2));
              const avgSquareDiff = squareDiffs.reduce((acc, val) => acc + val, 0) / hourEntries.length;
              const sdVal = Math.sqrt(avgSquareDiff);
              const cvVal = (sdVal / meanVal) * 100;

              sdCvStr = `±${conversion(sdVal).toFixed(isMgdl ? 0 : 1)} (${cvVal.toFixed(0)}%)`;

              const veryHighCount = hourEntries.filter(e => e.sgv > 250).length;
              const highCount = hourEntries.filter(e => e.sgv > 180 && e.sgv <= 250).length;
              const inRangeCount = hourEntries.filter(e => e.sgv >= 70 && e.sgv <= 180).length;
              const lowCount = hourEntries.filter(e => e.sgv >= 54 && e.sgv < 70).length;
              const veryLowCount = hourEntries.filter(e => e.sgv < 54).length;

              veryHighPct = Math.round((veryHighCount / hourEntries.length) * 100);
              highPct = Math.round((highCount / hourEntries.length) * 100);
              inRangePct = Math.round((inRangeCount / hourEntries.length) * 100);
              lowPct = Math.round((lowCount / hourEntries.length) * 100);
              veryLowPct = Math.round((veryLowCount / hourEntries.length) * 100);
            }

            const nextHour = (hour + 1) % 24;
            const hourLabel = `${hour.toString().padStart(2, '0')}:00 - ${nextHour.toString().padStart(2, '0')}:00 (${hour}-${hour + 1})`;

            return (
              <tr key={hour} className="hover:bg-slate-50/50 transition">
                <td className="px-3 py-3 font-bold text-slate-900 border-r border-slate-200 pr-4">{hourLabel}</td>
                <td className="px-3 py-3 text-right font-bold text-slate-800">{meanStr}</td>
                <td className="px-3 py-3 text-right text-slate-500 border-r border-slate-200 pr-4">{sdCvStr}</td>
                <td className="px-3 py-3 text-right text-orange-600 font-bold">
                  {hasGlucose ? `${veryHighPct}%` : '-'}
                </td>
                <td className="px-3 py-3 text-right text-amber-600 font-bold">
                  {hasGlucose ? `${highPct}%` : '-'}
                </td>
                <td className="px-3 py-3 text-right text-[#72B100] font-extrabold">
                  {hasGlucose ? `${inRangePct}%` : '-'}
                </td>
                <td className="px-3 py-3 text-right text-red-600 font-bold">
                  {hasGlucose ? `${lowPct}%` : '-'}
                </td>
                <td className="px-3 py-3 text-right text-[#9C0006] font-bold border-r border-slate-200 pr-4">
                  {hasGlucose ? (veryLowPct === 0 && hourEntries.filter(e => e.sgv < 54).length > 0 ? '<1%' : `${veryLowPct}%`) : '-'}
                </td>
                <td className="px-3 py-3 text-right text-slate-500">{hourEntries.length}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
