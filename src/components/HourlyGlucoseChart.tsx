import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { GlucoseUnit } from '../utils/nightscout';
import type { Glucose15MinStats } from '../utils/metrics';

interface HourlyGlucoseChartProps {
  hourlyStats: Glucose15MinStats[];
  units: GlucoseUnit;
}

export const HourlyGlucoseChart: React.FC<HourlyGlucoseChartProps> = ({ 
  hourlyStats, 
  units 
}) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  // 1. Initialize and dispose chart instance on mount/unmount
  useEffect(() => {
    if (!chartRef.current) return;
    
    const chart = echarts.init(chartRef.current);
    chartInstance.current = chart;
    
    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartInstance.current = null;
    };
  }, []);

  // 2. Update option whenever data/options change
  useEffect(() => {
    const chart = chartInstance.current;
    if (!chart) return;

    const timeLabels = hourlyStats.map(d => d.timeLabel);
    
    // Floating bar values (stacked bar):
    const baseP15 = hourlyStats.map(d => d.p15);
    const diffP75 = hourlyStats.map(d => d.p75 - d.p15);
    const meanData = hourlyStats.map(d => d.mean);

    const isMgdl = units === GlucoseUnit.MGDL;
    const targetMin = isMgdl ? 70 : 3.9;
    const targetMax = isMgdl ? 180 : 10.0;

    const allVals = hourlyStats.flatMap(d => [d.p15, d.p75, d.mean]);
    const maxVal = allVals.length > 0 ? Math.max(...allVals, targetMax) : targetMax;
    const minVal = allVals.length > 0 ? Math.min(...allVals, targetMin) : targetMin;

    const cushionMin = isMgdl ? 15 : 0.8;
    const cushionMax = isMgdl ? 25 : 1.5;

    const yMin = Math.max(isMgdl ? 40 : 2.0, Math.floor(minVal - cushionMin));
    const yMax = Math.ceil(maxVal + cushionMax);

    const option: echarts.EChartsOption = {
      animation: false,
      // Title and Legend are rendered in parent component via HTML
      tooltip: {
        trigger: 'axis',
        formatter: (params: any) => {
          const idx = params[0].dataIndex;
          const stat = hourlyStats[idx];
          if (!stat) return '';
          const formatVal = (val: number) => isMgdl ? val.toFixed(0) : val.toFixed(1);
          return `
            <div style="font-family: sans-serif; font-size: 11px; padding: 4px;">
              <div style="font-weight: bold; margin-bottom: 6px; color: #1e293b;">Time: ${stat.timeLabel}</div>
              <div style="display: flex; flex-direction: column; gap: 4px;">
                <div style="display: flex; justify-content: space-between; gap: 16px;">
                  <span style="color: #64748b;">75th Percentile:</span>
                  <span style="font-weight: bold; color: #1e293b;">${formatVal(stat.p75)} ${units}</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px;">
                  <span style="color: #475569; font-weight: bold;">Mean:</span>
                  <span style="font-weight: bold; color: #475569;">${formatVal(stat.mean)} ${units}</span>
                </div>
                <div style="display: flex; justify-content: space-between; gap: 16px;">
                  <span style="color: #64748b;">15th Percentile:</span>
                  <span style="font-weight: bold; color: #1e293b;">${formatVal(stat.p15)} ${units}</span>
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
        axisLine: {
          lineStyle: {
            color: '#cbd5e1'
          }
        },
        axisLabel: {
          color: '#64748b',
          fontSize: 9,
          interval: 8,
          formatter: (value: string) => value
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
              color: 'rgba(114, 177, 0, 0.02)'
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
        // 2. Base p15 (invisible, used to float p75)
        {
          name: 'p15_base',
          type: 'bar',
          stack: 'p15-p75',
          data: baseP15,
          itemStyle: {
            color: 'rgba(0,0,0,0)',
            borderColor: 'rgba(0,0,0,0)'
          },
          emphasis: {
            itemStyle: {
              color: 'rgba(0,0,0,0)',
              borderColor: 'rgba(0,0,0,0)'
            }
          }
        },
        // 3. Floating bar 15th-75th range
        {
          name: '15th - 75th Percentile Range',
          type: 'bar',
          stack: 'p15-p75',
          data: diffP75,
          itemStyle: {
            color: 'rgba(0, 94, 184, 0.15)'
          }
        },
        // 4. Mean line (overlay)
        {
          name: 'Mean',
          type: 'line',
          data: meanData,
          symbol: 'none',
          showSymbol: false,
          lineStyle: {
            color: '#475569',
            width: 2.5
          }
        }
      ]
    };

    chart.setOption(option, { notMerge: true, lazyUpdate: false });
  }, [hourlyStats, units]);

  return (
    <div className="w-full">
      <div ref={chartRef} className="h-80 w-full" />
    </div>
  );
};
