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
    <div className="overflow-x-auto">
      <table className="w-full min-w-[950px] border-collapse text-left text-xs font-semibold text-slate-700">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            <th className="px-3 py-3">Hour Range</th>
            <th className="px-3 py-3 text-right">Avg Glucose</th>
            <th className="px-3 py-3 text-right">SD (CV)</th>
            <th className="px-3 py-3 text-right text-orange-600">% Very High</th>
            <th className="px-3 py-3 text-right text-amber-600">% High</th>
            <th className="px-3 py-3 text-right text-[#72B100]">% In Range</th>
            <th className="px-3 py-3 text-right text-red-600">% Low</th>
            <th className="px-3 py-3 text-right text-[#9C0006]">% Very Low</th>
            <th className="px-3 py-3 text-right">Readings Count</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {hours.map((hour) => {
            // Filter readings matching this hour of the day
            const hourEntries = entries.filter(e => {
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
                <td className="px-3 py-3 font-bold text-slate-900">{hourLabel}</td>
                <td className="px-3 py-3 text-right font-bold text-slate-800">{meanStr}</td>
                <td className="px-3 py-3 text-right text-slate-500">{sdCvStr}</td>
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
                <td className="px-3 py-3 text-right text-[#9C0006] font-bold">
                  {hasGlucose ? `${veryLowPct}%` : '-'}
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
