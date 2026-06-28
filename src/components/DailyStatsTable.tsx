import React from 'react';
import { GlucoseUnit } from '../utils/nightscout';
import type { NightscoutEntry, NightscoutTreatment } from '../utils/nightscout';

interface DailyStatsTableProps {
  days: Date[];
  entries: NightscoutEntry[];
  treatments: NightscoutTreatment[];
  units: GlucoseUnit;
}

export const DailyStatsTable: React.FC<DailyStatsTableProps> = ({
  days,
  entries,
  treatments,
  units
}) => {
  const isMgdl = units === GlucoseUnit.MGDL;
  const conversion = (val: number) => isMgdl ? val : val / 18.018;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[950px] border-collapse text-left text-xs font-semibold text-slate-700">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
            <th className="px-3 py-3">Date</th>
            <th className="px-3 py-3 text-right">Avg Glucose</th>
            <th className="px-3 py-3 text-right">SD (CV)</th>
            <th className="px-3 py-3 text-right text-[#F29100]">% Very High</th>
            <th className="px-3 py-3 text-right text-[#FCD116]">% High</th>
            <th className="px-3 py-3 text-right text-[#72B100]">% In Range</th>
            <th className="px-3 py-3 text-right text-[#F04124]">% Low</th>
            <th className="px-3 py-3 text-right text-[#9C0006]">% Very Low</th>
            <th className="px-3 py-3 text-right">Carbs</th>
            <th className="px-3 py-3 text-right">Insulin</th>
            <th className="px-3 py-3 text-right">Readings (Wear %)</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {days.map((dayDate, idx) => {
            const normalized = new Date(dayDate);
            normalized.setHours(0, 0, 0, 0);
            const start = normalized.getTime();
            const end = start + 24 * 60 * 60 * 1000 - 1;

            const dayEntries = entries.filter(e => e.date >= start && e.date <= end);
            const dayTreatments = treatments.filter(t => {
              const date = t.date || new Date(t.created_at).getTime();
              return date >= start && date <= end;
            });

            // Calculate metrics for this day
            let meanStr = '-';
            let sdCvStr = '-';
            let veryHighPct = 0;
            let highPct = 0;
            let inRangePct = 0;
            let lowPct = 0;
            let veryLowPct = 0;
            let hasGlucose = dayEntries.length > 0;

            if (hasGlucose) {
              const sum = dayEntries.reduce((acc, e) => acc + e.sgv, 0);
              const meanVal = sum / dayEntries.length;
              meanStr = `${conversion(meanVal).toFixed(isMgdl ? 0 : 1)} ${units}`;

              // Standard deviation
              const squareDiffs = dayEntries.map(e => Math.pow(e.sgv - meanVal, 2));
              const avgSquareDiff = squareDiffs.reduce((acc, val) => acc + val, 0) / dayEntries.length;
              const sdVal = Math.sqrt(avgSquareDiff);
              const cvVal = (sdVal / meanVal) * 100;

              sdCvStr = `±${conversion(sdVal).toFixed(isMgdl ? 0 : 1)} (${cvVal.toFixed(0)}%)`;

              // TIR splits
              const veryHighCount = dayEntries.filter(e => e.sgv > 250).length;
              const highCount = dayEntries.filter(e => e.sgv > 180 && e.sgv <= 250).length;
              const inRangeCount = dayEntries.filter(e => e.sgv >= 70 && e.sgv <= 180).length;
              const lowCount = dayEntries.filter(e => e.sgv >= 54 && e.sgv < 70).length;
              const veryLowCount = dayEntries.filter(e => e.sgv < 54).length;

              veryHighPct = Math.round((veryHighCount / dayEntries.length) * 100);
              highPct = Math.round((highCount / dayEntries.length) * 100);
              inRangePct = Math.round((inRangeCount / dayEntries.length) * 100);
              lowPct = Math.round((lowCount / dayEntries.length) * 100);
              veryLowPct = Math.round((veryLowCount / dayEntries.length) * 100);
            }

            const dayCarbs = dayTreatments.reduce((acc, t) => acc + (t.carbs || 0), 0);
            const dayInsulin = dayTreatments.reduce((acc, t) => acc + (t.insulin || 0), 0);
            const wearPct = Math.min(100, Math.round((dayEntries.length / 288) * 100));

            const formattedDate = dayDate.toLocaleDateString(undefined, {
              weekday: 'short',
              month: 'short',
              day: 'numeric'
            });

            return (
              <tr key={idx} className="hover:bg-slate-50/50 transition">
                <td className="px-3 py-3 font-bold text-slate-900">{formattedDate}</td>
                <td className="px-3 py-3 text-right font-bold text-slate-800">{meanStr}</td>
                <td className="px-3 py-3 text-right text-slate-500">{sdCvStr}</td>
                <td className="px-3 py-3 text-right text-[#F29100] font-bold">
                  {hasGlucose ? `${veryHighPct}%` : '-'}
                </td>
                <td className="px-3 py-3 text-right text-[#FCD116] font-bold">
                  {hasGlucose ? `${highPct}%` : '-'}
                </td>
                <td className="px-3 py-3 text-right text-[#72B100] font-extrabold">
                  {hasGlucose ? `${inRangePct}%` : '-'}
                </td>
                <td className="px-3 py-3 text-right text-[#F04124] font-bold">
                  {hasGlucose ? `${lowPct}%` : '-'}
                </td>
                <td className="px-3 py-3 text-right text-[#9C0006] font-bold">
                  {hasGlucose ? `${veryLowPct}%` : '-'}
                </td>
                <td className="px-3 py-3 text-right text-emerald-600 font-bold">
                  {dayCarbs > 0 ? `${dayCarbs}g` : '-'}
                </td>
                <td className="px-3 py-3 text-right text-blue-600 font-bold">
                  {dayInsulin > 0 ? `${dayInsulin.toFixed(1)} U` : '-'}
                </td>
                <td className="px-3 py-3 text-right text-slate-500">
                  {dayEntries.length} <span className="text-[10px] text-slate-400">({wearPct}%)</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
