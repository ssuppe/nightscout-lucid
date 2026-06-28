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

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;

    const timeLabels = hourlyStats.map(d => d.timeLabel);
    
    // Floating bar values (stacked bar):
    const baseP15 = hourlyStats.map(d => d.p15);
    const diffP75 = hourlyStats.map(d => d.p75 - d.p15);
    const meanData = hourlyStats.map(d => d.mean);

    const isMgdl = units === GlucoseUnit.MGDL;
    const targetMin = isMgdl ? 70 : 3.9;
    const targetMax = isMgdl ? 180 : 10.0;



    const option: echarts.EChartsOption = {
      // Title and Legend are rendered in parent component via HTML
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'line',
          lineStyle: {
            color: '#94a3b8',
            width: 1,
            type: 'dashed'
          }
        },
        formatter: (params: any) => {
          const time = params[0].axisValue;
          const dataIndex = params[0].dataIndex;
          const d = hourlyStats[dataIndex];
          return `
            <div style="font-family: Inter, sans-serif; font-size: 11px; padding: 6px; line-height: 1.4;">
              <div style="font-weight: 800; margin-bottom: 4px; color: #1e293b;">Time Slot: ${time}</div>
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                <span style="color: #64748b;">75th Percentile:</span>
                <span style="font-weight: 700; color: #334155;">${d.p75.toFixed(1)} ${units}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                <span style="color: #2563eb; font-weight: 700;">Average (Mean):</span>
                <span style="font-weight: 800; color: #1d4ed8;">${d.mean.toFixed(1)} ${units}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: #64748b;">15th Percentile:</span>
                <span style="font-weight: 700; color: #334155;">${d.p15.toFixed(1)} ${units}</span>
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
          fontSize: 10,
          fontWeight: 'bold',
          // Show label every 3 hours (12 intervals of 15 min)
          interval: (index: number) => index % 12 === 0
        },
        splitLine: {
          show: true,
          interval: (index: number) => index % 12 === 0,
          lineStyle: {
            color: '#e2e8f0',
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
          fontSize: 10,
          fontWeight: 'bold'
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
              color: '#72B100',
              type: 'solid',
              width: 1.5
            },
            label: {
              position: 'end',
              fontSize: 10,
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
        // 2. Base invisible stacking series
        {
          name: 'p15_base',
          type: 'bar',
          stack: 'HourlyGlucose',
          data: baseP15,
          itemStyle: {
            color: 'none'
          },
          emphasis: {
            itemStyle: {
              color: 'none'
            }
          }
        },
        // 3. Shaded grey range bar (75th - 15th)
        {
          name: '15th - 75th Percentile Range',
          type: 'bar',
          stack: 'HourlyGlucose',
          data: diffP75,
          color: '#cbd5e1', // soft grey
          barWidth: '70%',
          itemStyle: {
            borderRadius: [2, 2, 2, 2]
          }
        },
        // 4. Mean line overlay
        {
          name: 'Average Glucose',
          type: 'line',
          data: meanData,
          color: '#1d4ed8', // bold blue
          symbol: 'circle',
          symbolSize: 5,
          lineStyle: {
            width: 2
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
  }, [hourlyStats, units]);

  return (
    <div className="w-full">
      <div ref={chartRef} className="h-80 w-full" />
    </div>
  );
};
