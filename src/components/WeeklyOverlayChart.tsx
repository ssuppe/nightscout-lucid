import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { GlucoseUnit } from '../utils/nightscout';
import type { NightscoutEntry } from '../utils/nightscout';

interface WeeklyOverlayChartProps {
  entries: NightscoutEntry[];
  units: GlucoseUnit;
  selectedDays: number[];
  eventFilter: 'all' | 'highs' | 'lows';
  weekLabel: string;
}

export const WeeklyOverlayChart: React.FC<WeeklyOverlayChartProps> = ({
  entries,
  units,
  selectedDays,
  eventFilter,
  weekLabel
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // Group week's entries by calendar day (local timezone) to find which match the filters
  const getFilteredEntries = () => {
    const dayGroups: Record<string, NightscoutEntry[]> = {};
    entries.forEach(e => {
      const dateStr = new Date(e.date).toDateString();
      if (!dayGroups[dateStr]) {
        dayGroups[dateStr] = [];
      }
      dayGroups[dateStr].push(e);
    });

    const filtered: NightscoutEntry[] = [];
    Object.keys(dayGroups).forEach(dayKey => {
      const dayEntries = dayGroups[dayKey];
      if (dayEntries.length === 0) return;

      const dateObj = new Date(dayEntries[0].date);
      const dayOfWeek = dateObj.getDay();

      if (!selectedDays.includes(dayOfWeek)) return;

      const hasLow = dayEntries.some(e => e.sgv < 70);
      const hasHigh = dayEntries.some(e => e.sgv > 180);

      const matchesEvent = 
        eventFilter === 'all' ||
        (eventFilter === 'lows' && hasLow) ||
        (eventFilter === 'highs' && hasHigh);

      if (matchesEvent) {
        filtered.push(...dayEntries);
      }
    });
    return filtered;
  };

  const filteredEntries = getFilteredEntries();
  const isMgdl = units === GlucoseUnit.MGDL;

  let avgStr = '-';
  let tirStr = '-';
  let sdStr = '-';

  if (filteredEntries.length > 0) {
    const sum = filteredEntries.reduce((acc, e) => acc + e.sgv, 0);
    const mean = sum / filteredEntries.length;
    const meanConverted = isMgdl ? mean : mean / 18.018;
    // Force 1 decimal place for mmol/L, integer for mg/dL
    avgStr = `${meanConverted.toFixed(isMgdl ? 0 : 1)} ${units}`;

    const inRange = filteredEntries.filter(e => e.sgv >= 70 && e.sgv <= 180).length;
    const tirPct = Math.round((inRange / filteredEntries.length) * 100);
    tirStr = `${tirPct}%`;

    const sqDiffs = filteredEntries.map(e => Math.pow(e.sgv - mean, 2));
    const variance = sqDiffs.reduce((acc, v) => acc + v, 0) / filteredEntries.length;
    const stdDev = Math.sqrt(variance);
    const stdDevConverted = isMgdl ? stdDev : stdDev / 18.018;
    sdStr = `± ${stdDevConverted.toFixed(isMgdl ? 0 : 1)} ${units}`;
  }

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;
    const targetMin = isMgdl ? 70 : 3.9;
    const targetMax = isMgdl ? 180 : 10.0;
    const conversion = (val: number) => isMgdl ? val : val / 18.018;

    // Group week's entries by calendar day (local timezone)
    const dayGroups: Record<string, NightscoutEntry[]> = {};
    entries.forEach(e => {
      const dateStr = new Date(e.date).toDateString();
      if (!dayGroups[dateStr]) {
        dayGroups[dateStr] = [];
      }
      dayGroups[dateStr].push(e);
    });

    // Prepare line series for each matching day
    const seriesList: echarts.SeriesOption[] = [];
    const dayColors = [
      '#3b82f6', // Sun - blue
      '#ef4444', // Mon - red
      '#f59e0b', // Tue - amber
      '#10b981', // Wed - emerald
      '#8b5cf6', // Thu - violet
      '#ec4899', // Fri - pink
      '#06b6d4'  // Sat - cyan
    ];

    let allSgvs: number[] = [];

    Object.keys(dayGroups).forEach(dayKey => {
      const dayEntries = dayGroups[dayKey];
      if (dayEntries.length === 0) return;

      const dateObj = new Date(dayEntries[0].date);
      const dayOfWeek = dateObj.getDay();

      // 1. Filter by selected days
      if (!selectedDays.includes(dayOfWeek)) return;

      // 2. Filter by events (Lows: sgv < 70, Highs: sgv > 180)
      const hasLow = dayEntries.some(e => e.sgv < 70);
      const hasHigh = dayEntries.some(e => e.sgv > 180);

      const matchesEvent = 
        eventFilter === 'all' ||
        (eventFilter === 'lows' && hasLow) ||
        (eventFilter === 'highs' && hasHigh);

      if (!matchesEvent) return;

      // Sort points chronologically by hour decimal
      const dayPoints = dayEntries
        .map(e => {
          const d = new Date(e.date);
          const hourVal = d.getHours() + d.getMinutes() / 60;
          const convVal = conversion(e.sgv);
          allSgvs.push(convVal);
          return [hourVal, convVal];
        })
        .sort((a, b) => a[0] - b[0]);

      const formattedLabel = dateObj.toLocaleDateString(undefined, { 
        weekday: 'short', 
        month: 'short', 
        day: 'numeric' 
      });

      seriesList.push({
        name: formattedLabel,
        type: 'line',
        data: dayPoints,
        color: dayColors[dayOfWeek],
        showSymbol: false,
        smooth: true,
        lineStyle: {
          width: 1.8,
          opacity: 0.75
        },
        emphasis: {
          lineStyle: {
            width: 3.5,
            opacity: 1
          }
        }
      });
    });



    // Target range area config
    const targetAreaSeries: echarts.SeriesOption = {
      type: 'line',
      markArea: {
        silent: true,
        itemStyle: {
          color: 'rgba(114, 177, 0, 0.03)'
        },
        data: [
          [
            { yAxis: targetMin },
            { yAxis: targetMax }
          ]
        ]
      },
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: {
          color: 'rgba(114, 177, 0, 0.15)',
          type: 'dashed'
        },
        data: [
          { yAxis: targetMin },
          { yAxis: targetMax }
        ]
      }
    };

    const option: echarts.EChartsOption = {
      title: {
        show: false
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: '#94a3b8',
            type: 'dashed'
          }
        },
        formatter: (params: any) => {
          if (!params || params.length === 0) return '';
          const timeVal = params[0].value[0];
          const hr = Math.floor(timeVal);
          const mn = Math.round((timeVal - hr) * 60);
          const timeStr = `${hr.toString().padStart(2, '0')}:${mn.toString().padStart(2, '0')}`;
          
          let html = `
            <div style="font-family: sans-serif; font-size: 11px; padding: 4px;">
              <div style="font-weight: bold; margin-bottom: 6px; color: #1e293b;">Time: ${timeStr}</div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
          `;
          
          params.forEach((p: any) => {
            if (p.seriesName === '') return;
            html += `
              <div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="display: flex; items-center gap: 6px;">
                  <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background-color: ${p.color}; margin-top: 3px;"></span>
                  <span style="color: #475569;">${p.seriesName}:</span>
                </span>
                <span style="font-weight: bold; color: #1e293b;">${p.value[1].toFixed(isMgdl ? 0 : 1)} ${units}</span>
              </div>
            `;
          });
          
          html += `</div></div>`;
          return html;
        }
      },
      grid: {
        left: '4%',
        right: '4%',
        bottom: '10%',
        top: '8%',
        containLabel: true
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: 24,
        axisLine: {
          lineStyle: {
            color: '#cbd5e1'
          }
        },
        axisLabel: {
          color: '#64748b',
          fontSize: 9,
          formatter: (value: number) => {
            if (value === 0) return '12 AM';
            if (value === 6) return '6 AM';
            if (value === 12) return '12 PM';
            if (value === 18) return '6 PM';
            if (value === 24) return '12 AM';
            return '';
          }
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#f1f5f9',
            type: 'dashed'
          }
        }
      },
      yAxis: {
        type: 'value',
        min: (value) => {
          const minVal = Math.min(value.min, targetMin);
          const cushion = isMgdl ? 15 : 0.8;
          return Math.max(isMgdl ? 40 : 2.0, Math.floor(minVal - cushion));
        },
        max: (value) => {
          const maxVal = Math.max(value.max, targetMax);
          const cushion = isMgdl ? 25 : 1.5;
          return Math.ceil(maxVal + cushion);
        },
        axisLabel: {
          color: '#64748b',
          fontSize: 9
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#f1f5f9'
          }
        }
      },
      legend: {
        show: true,
        bottom: '0%',
        left: 'center',
        type: 'scroll',
        itemWidth: 10,
        itemHeight: 10,
        textStyle: {
          fontSize: 9,
          color: '#64748b'
        }
      },
      series: [targetAreaSeries, ...seriesList]
    };

    chart.setOption(option, { notMerge: true });

    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [entries, units, selectedDays, eventFilter, weekLabel, isMgdl]);

  return (
    <div className="w-full text-left">
      {/* Dexcom Clarity Styled Weekly Statistics Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-slate-100 pb-3 mb-4 gap-2">
        <h4 className="text-sm font-extrabold text-slate-800">{weekLabel}</h4>
        
        {filteredEntries.length > 0 ? (
          <div className="flex items-center gap-4 text-xs font-bold text-slate-500">
            <div>
              <span>Avg: </span>
              <span className="text-slate-800 font-black">{avgStr}</span>
            </div>
            <div className="w-px h-3 bg-slate-200" />
            <div>
              <span>TIR: </span>
              <span className="text-[#72B100] font-black">{tirStr}</span>
            </div>
            <div className="w-px h-3 bg-slate-200" />
            <div>
              <span>SD: </span>
              <span className="text-slate-800 font-black">{sdStr}</span>
            </div>
          </div>
        ) : (
          <span className="text-xs text-slate-400 font-semibold italic">No matching data</span>
        )}
      </div>

      <div ref={chartRef} className="h-80 w-full" />
    </div>
  );
};
