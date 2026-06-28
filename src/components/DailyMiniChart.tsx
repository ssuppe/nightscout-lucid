import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { GlucoseUnit } from '../utils/nightscout';
import type { NightscoutEntry, NightscoutTreatment } from '../utils/nightscout';

interface DailyMiniChartProps {
  entries: NightscoutEntry[];
  treatments: NightscoutTreatment[];
  units: GlucoseUnit;
  dayStart: number;
}

export const DailyMiniChart: React.FC<DailyMiniChartProps> = ({
  entries,
  treatments,
  units,
  dayStart
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
    const yMin = Math.max(isMgdl ? 40 : 2.0, Math.min(targetMin - (isMgdl ? 15 : 0.8), minSgv - (isMgdl ? 10 : 0.5)));
    const yMax = Math.max(targetMax + (isMgdl ? 25 : 1.5), maxSgv + (isMgdl ? 15 : 0.8));

    // Convert treatments:
    // Carbs plotted near top (y = yMax * 0.9)
    // Insulin plotted near bottom (y = yMin * 1.1)
    const carbPoints: any[] = [];
    const insulinPoints: any[] = [];

    treatments.forEach(t => {
      const date = t.date || new Date(t.created_at).getTime();
      const d = new Date(date);
      const timeVal = d.getHours() + d.getMinutes() / 60;

      if (t.carbs && t.carbs > 0) {
        carbPoints.push({
          value: [timeVal, yMax - (isMgdl ? 15 : 0.8)],
          amount: t.carbs,
          note: t.notes || ''
        });
      }
      if (t.insulin && t.insulin > 0) {
        insulinPoints.push({
          value: [timeVal, yMin + (isMgdl ? 8 : 0.4)],
          amount: t.insulin
        });
      }
    });

    const option: echarts.EChartsOption = {
      grid: {
        left: 32,
        right: 16,
        top: 8,
        bottom: 20
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
          let html = '';
          params.forEach((p: any) => {
            const timeVal = p.value[0];
            const hour = Math.floor(timeVal);
            const min = Math.round((timeVal - hour) * 60);
            const timeStr = `${hour.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
            
            if (p.seriesName === 'Glucose') {
              html += `<div><strong>Time:</strong> ${timeStr}</div>`;
              html += `<div><strong>Glucose:</strong> ${p.value[1].toFixed(isMgdl ? 0 : 1)} ${units}</div>`;
            }
          });
          return html;
        }
      },
      xAxis: {
        type: 'value',
        min: 0,
        max: 24,
        axisLine: {
          lineStyle: {
            color: '#e2e8f0'
          }
        },
        axisLabel: {
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
        splitLine: {
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
        axisLabel: {
          show: true,
          color: '#94a3b8',
          fontSize: 8,
          formatter: (value: number) => {
            // Show labels at target range bounds to keep chart clean
            if (Math.abs(value - targetMin) < 1 || Math.abs(value - targetMax) < 1) {
              return value.toFixed(isMgdl ? 0 : 1);
            }
            return '';
          }
        },
        splitLine: {
          show: true,
          lineStyle: {
            color: '#f1f5f9'
          }
        }
      },
      series: [
        // 1. Shaded target range band background
        {
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
        },
        // 2. Glucose Trend Line
        {
          name: 'Glucose',
          type: 'line',
          data: glucosePoints,
          color: '#475569', // slate grey
          showSymbol: false,
          smooth: true,
          lineStyle: {
            width: 1.5
          }
        },
        // 3. Carb points (top scatter)
        {
          name: 'Carbs',
          type: 'scatter',
          data: carbPoints,
          symbol: 'circle',
          symbolSize: 14,
          color: '#10b981', // green marker
          label: {
            show: true,
            formatter: (p: any) => `${p.data.amount}`,
            color: '#ffffff',
            fontSize: 7,
            fontWeight: 'bold'
          },
          tooltip: {
            formatter: (p: any) => `Carbs: ${p.data.amount}g ${p.data.note ? `(${p.data.note})` : ''}`
          }
        },
        // 4. Insulin points (bottom scatter)
        {
          name: 'Insulin',
          type: 'scatter',
          data: insulinPoints,
          symbol: 'triangle',
          symbolSize: 12,
          color: '#3b82f6', // blue marker
          label: {
            show: true,
            position: 'inside',
            formatter: (p: any) => `${p.data.amount}`,
            color: '#ffffff',
            fontSize: 6,
            fontWeight: 'bold',
            offset: [0, 2]
          },
          tooltip: {
            formatter: (p: any) => `Insulin: ${p.data.amount} U`
          }
        }
      ]
    };

    chart.setOption(option);

    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [entries, treatments, units, dayStart]);

  return (
    <div className="w-full">
      <div ref={chartRef} className="h-20 w-full" />
    </div>
  );
};
