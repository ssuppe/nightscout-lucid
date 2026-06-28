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

    // Dynamic smart Y-axis limits
    const minVal = allSgvs.length > 0 ? Math.min(...allSgvs) : targetMin;
    const maxVal = allSgvs.length > 0 ? Math.max(...allSgvs) : targetMax;
    const cushionMin = isMgdl ? 15 : 0.8;
    const cushionMax = isMgdl ? 25 : 1.5;
    const yMin = Math.max(isMgdl ? 40 : 2.0, Math.min(targetMin - cushionMin, minVal - cushionMin));
    const yMax = Math.max(targetMax + cushionMax, maxVal + cushionMax);

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
        text: weekLabel,
        left: 'left',
        textStyle: {
          fontSize: 14,
          fontWeight: 'bold',
          color: '#1e293b'
        }
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
        top: '15%',
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
        min: yMin,
        max: yMax,
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
  }, [entries, units, selectedDays, eventFilter, weekLabel]);

  return (
    <div className="w-full">
      <div ref={chartRef} className="h-80 w-full" />
    </div>
  );
};
