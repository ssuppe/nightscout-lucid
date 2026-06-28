import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { GlucoseUnit } from '../utils/nightscout';
import type { AGPBin } from '../utils/metrics';

interface AGPChartProps {
  percentiles: AGPBin[];
  units: GlucoseUnit;
}

export const AGPChart: React.FC<AGPChartProps> = ({ percentiles, units }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  const isMgdl = units === GlucoseUnit.MGDL;
  const targetMin = isMgdl ? 70 : 3.9;
  const targetMax = isMgdl ? 180 : 10.0;

  useEffect(() => {
    if (!chartRef.current) return;

    // Initialize ECharts
    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;

    // Prepare data
    const timeLabels = percentiles.map(b => b.timeLabel);
    
    // For stacked shading:
    // Group 1 (10-90): stackName '10-90'
    const baseP10 = percentiles.map(b => b.p10);
    const diffP90 = percentiles.map(b => b.p90 - b.p10);

    // Group 2 (25-75): stackName '25-75'
    const baseP25 = percentiles.map(b => b.p25);
    const diffP75 = percentiles.map(b => b.p75 - b.p25);

    const medianP50 = percentiles.map(b => b.p50);

    // Calculate dynamic smart y-axis scale based on data
    const p10Min = percentiles.length > 0 ? Math.min(...percentiles.map(b => b.p10)) : targetMin;
    const p90Max = percentiles.length > 0 ? Math.max(...percentiles.map(b => b.p90)) : targetMax;
    
    // Always include target bounds, and add a cushion
    const yMinLimit = isMgdl ? 40 : 2.0;
    const cushionMin = isMgdl ? 15 : 0.8;
    const cushionMax = isMgdl ? 25 : 1.5;
    
    const yMin = Math.max(yMinLimit, Math.min(targetMin - cushionMin, p10Min - cushionMin));
    const yMax = Math.max(targetMax + cushionMax, p90Max + cushionMax);

    const option: echarts.EChartsOption = {
      title: {
        show: false
      },
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const time = params[0].axisValue;
          const bin = percentiles.find(b => b.timeLabel === time);
          if (!bin) return '';

          // Format value strings based on units (1 decimal place for mmol/L, integer for mg/dL)
          const formatVal = (val: number) => isMgdl ? val.toFixed(0) : val.toFixed(1);

          return `
            <div style="font-family: sans-serif; font-size: 11px; padding: 4px;">
              <div style="font-weight: bold; margin-bottom: 6px; color: #1e293b;">Time: ${time}</div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; justify-content: space-between; gap: 16px;">
                  <span style="color: #64748b;">90th Percentile:</span>
                  <span style="font-weight: bold; color: #1e293b;">${formatVal(bin.p90)} ${units}</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px;">
                  <span style="color: #005eb8;">75th Percentile:</span>
                  <span style="font-weight: bold; color: #005eb8;">${formatVal(bin.p75)} ${units}</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px;">
                  <span style="color: #004b87; font-weight: bold;">50th (Median):</span>
                  <span style="font-weight: bold; color: #004b87;">${formatVal(bin.p50)} ${units}</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px;">
                  <span style="color: #005eb8;">25th Percentile:</span>
                  <span style="font-weight: bold; color: #005eb8;">${formatVal(bin.p25)} ${units}</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px;">
                  <span style="color: #64748b;">10th Percentile:</span>
                  <span style="font-weight: bold; color: #1e293b;">${formatVal(bin.p10)} ${units}</span>
                </div>
              </div>
            </div>
          `;
        }
      },
      grid: {
        left: '4%',
        right: '4%',
        bottom: '8%',
        top: '6%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: timeLabels,
        boundaryGap: false,
        axisLine: {
          lineStyle: {
            color: '#cbd5e1'
          }
        },
        axisLabel: {
          color: '#64748b',
          fontSize: 9,
          interval: 8, // show label every 2 hours
          formatter: (value: string) => value
        },
        splitLine: {
          show: true,
          interval: 8,
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
      series: [
        // 1. Shaded target range background area
        {
          type: 'line',
          markArea: {
            silent: true,
            itemStyle: {
              color: 'rgba(114, 177, 0, 0.02)' // soft green target block
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
              color: '#72B100',
              type: 'dashed',
              width: 1.5
            },
            label: {
              position: 'end',
              fontSize: 9,
              color: '#72B100',
              fontWeight: 'bold',
              formatter: (params) => `${params.value} ${units}`
            },
            data: [
              { yAxis: targetMin },
              { yAxis: targetMax }
            ]
          }
        },
        // 2. Base p10 line (invisible, used to stack p90)
        {
          name: 'p10_base',
          type: 'line',
          data: baseP10,
          stack: '10-90',
          symbol: 'none',
          lineStyle: { opacity: 0 },
          showSymbol: false
        },
        // 3. Shaded 10th - 90th percentile area
        {
          name: '10th - 90th Percentile',
          type: 'line',
          data: diffP90,
          stack: '10-90',
          symbol: 'none',
          showSymbol: false,
          areaStyle: {
            color: 'rgba(0, 94, 184, 0.08)' // light Dexcom blue
          },
          lineStyle: { opacity: 0 }
        },
        // 4. Base p25 line (invisible, used to stack p75)
        {
          name: 'p25_base',
          type: 'line',
          data: baseP25,
          stack: '25-75',
          symbol: 'none',
          lineStyle: { opacity: 0 },
          showSymbol: false
        },
        // 5. Shaded 25th - 75th percentile area
        {
          name: '25th - 75th Percentile',
          type: 'line',
          data: diffP75,
          stack: '25-75',
          symbol: 'none',
          showSymbol: false,
          areaStyle: {
            color: 'rgba(0, 94, 184, 0.28)' // medium Dexcom blue
          },
          lineStyle: { opacity: 0 }
        },
        // 6. Median (50th percentile) line
        {
          name: 'Median (50th Percentile)',
          type: 'line',
          data: medianP50,
          symbol: 'none',
          showSymbol: false,
          lineStyle: {
            color: '#004B87', // bold corporate blue
            width: 3.5
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
  }, [percentiles, units, isMgdl, targetMin, targetMax]);

  return (
    <div className="w-full text-left">
      {/* HTML Title & Header Block */}
      <div className="mb-4">
        <h3 className="text-sm font-extrabold text-slate-800">Ambulatory Glucose Profile (AGP)</h3>
        <p className="text-xs text-slate-400 font-bold mt-0.5">
          Grouped by 15-minute intervals. Target Range: {targetMin} - {targetMax} {units}.
        </p>
      </div>

      {/* Chart container */}
      <div ref={chartRef} className="h-96 w-full" />

      {/* Dexcom Clarity Styled HTML Legend */}
      <div className="mt-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 border-t border-slate-100 pt-4 text-[11px] font-bold text-slate-500">
        <div className="flex items-center gap-2">
          <div className="w-6 h-1 bg-[#004B87] rounded-full" />
          <span>50% Median</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-4 bg-[#005EB8]/30 border border-[#005EB8]/45 rounded-sm" />
          <span>25% - 75% of readings</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-5 h-4 bg-[#005EB8]/10 border border-[#005EB8]/20 rounded-sm" />
          <span>10% - 90% of readings</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-4 bg-[#72B100]/5 border border-dashed border-[#72B100] rounded-sm" />
          <span>Target Range ({targetMin} - {targetMax} {units})</span>
        </div>
      </div>
    </div>
  );
};
