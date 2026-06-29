import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { GlucoseUnit } from '../utils/nightscout';
import type { NightscoutEntry, NightscoutTreatment } from '../utils/nightscout';

interface DailyMiniChartProps {
  entries: NightscoutEntry[];
  treatments: NightscoutTreatment[];
  units: GlucoseUnit;
  dayStart: number;
  /** When true: no axes, no labels, no padding — flush strip-chart mode */
  compact?: boolean;
}

export const DailyMiniChart: React.FC<DailyMiniChartProps> = ({
  entries,
  treatments,
  units,
  dayStart,
  compact = false
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;

    const isMgdl = units === GlucoseUnit.MGDL;
    const targetMin = isMgdl ? 70 : 3.9;
    const targetMax = isMgdl ? 180 : 10.0;
    const conversion = (val: number) => isMgdl ? val : val / 18.018;

    // Convert entries to chart coordinates: [hourOfDay (0-24), glucoseValue]
    const glucosePoints = entries
      .map(e => {
        const d = new Date(e.date);
        const timeVal = d.getHours() + d.getMinutes() / 60;
        return [timeVal, conversion(e.sgv)];
      })
      .sort((a, b) => a[0] - b[0]);

    // Calculate dynamic smart y-axis scale based on data
    const rawSgvs = entries.map(e => conversion(e.sgv));
    const minSgv = rawSgvs.length > 0 ? Math.min(...rawSgvs) : targetMin;
    const maxSgv = rawSgvs.length > 0 ? Math.max(...rawSgvs) : targetMax;
    // In compact mode use a fixed shared y-scale so all cells are comparable
    const fixedYMin = isMgdl ? 40 : 2.2;
    const fixedYMax = isMgdl ? 280 : 15.5;

    const yMin = compact
      ? fixedYMin
      : Math.max(isMgdl ? 40 : 2.0, Math.min(targetMin - (isMgdl ? 15 : 0.8), minSgv - (isMgdl ? 10 : 0.5)));
    const yMax = compact
      ? fixedYMax
      : Math.max(targetMax + (isMgdl ? 25 : 1.5), maxSgv + (isMgdl ? 15 : 0.8));

    const option: echarts.EChartsOption = {
      grid: compact
        ? { left: 0, right: 0, top: 0, bottom: 0, containLabel: false }
        : { left: 32, right: 16, top: 8, bottom: 20 },
      tooltip: compact ? { show: false } : {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: '#94a3b8',
            type: 'dashed'
          }
        },
        formatter: (params: any) => {
          const plist = Array.isArray(params) ? params : [params];
          if (plist.length === 0) return '';

          // Determine display time from the first parameter
          const firstParam = plist[0];
          const timeVal = firstParam.value[0];
          const hour = Math.floor(timeVal);
          const min = Math.round((timeVal - hour) * 60);
          const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;

          let html = `<div style="font-weight: bold; margin-bottom: 4px; font-size: 11px; color: #333;">Time: ${timeStr}</div>`;
          
          plist.forEach((p: any) => {
            if (p.seriesName === 'Glucose') {
              html += `<div style="color: #475569;"><strong>Glucose:</strong> ${p.value[1].toFixed(isMgdl ? 0 : 1)} ${units}</div>`;
            } else if (p.seriesName === 'Carbs' && p.data) {
              const amount = p.data.amount;
              const noteStr = p.data.note ? ` (${p.data.note})` : '';
              html += `<div style="color: #10b981;"><strong>Carbs:</strong> ${amount}g${noteStr}</div>`;
            } else if (p.seriesName === 'Insulin' && p.data) {
              const amount = p.data.amount;
              html += `<div style="color: #3b82f6;"><strong>Insulin:</strong> ${amount} U</div>`;
            }
          });
          return html;
        }
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: 24,
        axisLine: compact ? { show: false } : { lineStyle: { color: '#e2e8f0' } },
        axisLabel: compact ? { show: false } : {
          show: true,
          color: '#94a3b8',
          fontSize: 8,
          formatter: (value: number) => {
            if (value === 0) return '12 AM';
            if (value === 12) return '12 PM';
            if (value === 24) return '12 AM';
            return '';
          }
        },
        splitLine: compact ? { show: false } : {
          show: true,
          lineStyle: {
            color: '#f8fafc',
            type: 'dashed'
          }
        }
      },
      yAxis: {
        type: 'value',
        min: yMin,
        max: yMax,
        axisLine: { show: false },
        axisTick: { show: false },
        axisLabel: compact ? { show: false } : {
          show: true,
          color: '#94a3b8',
          fontSize: 8,
          formatter: (value: number) => {
            if (Math.abs(value - targetMin) < 1 || Math.abs(value - targetMax) < 1) {
              return value.toFixed(isMgdl ? 0 : 1);
            }
            return '';
          }
        },
        splitLine: compact ? { show: false } : {
          show: true,
          lineStyle: {
            color: '#f1f5f9'
          }
        }
      }
    };
    // Convert treatments (only needed in non-compact full view)
    const carbPoints: any[] = [];
    const insulinPoints: any[] = [];
    if (!compact) {
      treatments.forEach(t => {
        const date = t.date || new Date(t.created_at).getTime();
        const d = new Date(date);
        const timeVal = d.getHours() + d.getMinutes() / 60;
        if (t.carbs && t.carbs > 0) {
          carbPoints.push({ value: [timeVal, yMax - (isMgdl ? 15 : 0.8)], amount: t.carbs, note: t.notes || '' });
        }
        if (t.insulin && t.insulin > 0) {
          insulinPoints.push({ value: [timeVal, yMin + (isMgdl ? 8 : 0.4)], amount: t.insulin });
        }
      });
    }

    const baseSeries: echarts.EChartsOption['series'] = [
      // 1. Shaded target range band background
      {
        type: 'line',
        markArea: {
          silent: true,
          itemStyle: { color: compact ? 'rgba(114, 177, 0, 0.06)' : 'rgba(114, 177, 0, 0.03)' },
          data: [[{ yAxis: targetMin }, { yAxis: targetMax }]]
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: 'rgba(114, 177, 0, 0.2)', type: 'solid', width: 0.5 },
          data: [{ yAxis: targetMin }, { yAxis: targetMax }]
        }
      },
      // 2. Glucose Trend Line
      {
        name: 'Glucose',
        type: 'line',
        data: glucosePoints,
        color: '#475569',
        showSymbol: false,
        smooth: true,
        lineStyle: { width: compact ? 1 : 1.5 }
      }
    ];

    const fullSeries: echarts.EChartsOption['series'] = [
      ...baseSeries,
      // 3. Carb points
      {
        name: 'Carbs',
        type: 'scatter',
        data: carbPoints,
        symbol: 'circle',
        symbolSize: 14,
        color: '#10b981',
        label: { show: true, formatter: (p: any) => `${p.data.amount}`, color: '#ffffff', fontSize: 7, fontWeight: 'bold' }
      },
      // 4. Insulin points
      {
        name: 'Insulin',
        type: 'scatter',
        data: insulinPoints,
        symbol: 'triangle',
        symbolSize: 12,
        color: '#3b82f6',
        label: { show: true, position: 'inside', formatter: (p: any) => `${p.data.amount}`, color: '#ffffff', fontSize: 6, fontWeight: 'bold', offset: [0, 2] }
      }
    ];

    option.series = compact ? baseSeries : fullSeries;


    chart.setOption(option);

    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [entries, treatments, units, dayStart, compact]);

  return (
    <div className={compact ? 'absolute inset-0' : 'w-full'}>
      <div ref={chartRef} className={compact ? 'h-full w-full' : 'h-20 w-full'} />
    </div>
  );
};
