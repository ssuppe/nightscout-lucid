import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import { GlucoseUnit } from '../utils/nightscout';
import type { HourlyGlucoseStats } from '../utils/metrics';

interface HourlyGlucoseChartProps {
  hourlyStats: HourlyGlucoseStats[];
  days: number;
  units: GlucoseUnit;
}

export const HourlyGlucoseChart: React.FC<HourlyGlucoseChartProps> = ({ 
  hourlyStats, 
  days,
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
    // baseP15: invisible bar up to 15th percentile
    // diffP75: grey bar showing the range between 15th and 75th percentiles
    const baseP15 = hourlyStats.map(d => d.p15);
    const diffP75 = hourlyStats.map(d => d.p75 - d.p15);
    const meanData = hourlyStats.map(d => d.mean);

    const isMgdl = units === GlucoseUnit.MGDL;
    const targetMin = isMgdl ? 70 : 3.9;
    const targetMax = isMgdl ? 180 : 10.0;

    // Smart Y-axis limits based on data range
    const allVals = hourlyStats.flatMap(d => [d.p15, d.p75, d.mean]);
    const minVal = Math.min(...allVals, targetMin);
    const maxVal = Math.max(...allVals, targetMax);
    const cushionMin = isMgdl ? 15 : 0.8;
    const cushionMax = isMgdl ? 25 : 1.5;
    const yMin = Math.max(isMgdl ? 40 : 2.0, minVal - cushionMin);
    const yMax = maxVal + cushionMax;

    const option: echarts.EChartsOption = {
      title: {
        text: 'Hourly Glucose Summary',
        subtext: `This graph shows your data averaged over ${days} days, with the bar charts for each hour of the date range.`,
        left: 'left',
        textStyle: {
          fontSize: 16,
          fontWeight: 'bold',
          color: '#0f172a'
        },
        subtextStyle: {
          fontSize: 11,
          color: '#64748b'
        }
      },
      tooltip: {
        trigger: 'axis',
        axisPointer: {
          type: 'shadow'
        },
        formatter: (params: any) => {
          const time = params[0].axisValue;
          const dataIndex = params[0].dataIndex;
          const d = hourlyStats[dataIndex];
          return `
            <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
              <div style="font-weight: bold; margin-bottom: 6px; color: #1e293b;">Time Slot: ${time}</div>
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                <span style="color: #64748b;">75th Percentile:</span>
                <span style="font-weight: bold;">${d.p75} ${units}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                <span style="color: #1e3a8a; font-weight: bold;">Average (Mean):</span>
                <span style="font-weight: bold; color: #1d4ed8;">${d.mean} ${units}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: #64748b;">15th Percentile:</span>
                <span style="font-weight: bold;">${d.p15} ${units}</span>
              </div>
            </div>
          `;
        }
      },
      legend: {
        bottom: '0%',
        left: 'center',
        itemWidth: 12,
        itemHeight: 12,
        textStyle: {
          fontSize: 10,
          color: '#64748b'
        },
        data: ['15th - 75th Percentile Range', 'Average Glucose']
      },
      grid: {
        left: '4%',
        right: '4%',
        bottom: '12%',
        top: '18%',
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
          interval: 2
        }
      },
      yAxis: {
        type: 'value',
        min: yMin,
        max: yMax,
        axisLabel: {
          color: '#64748b',
          fontSize: 10
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
              color: 'rgba(114, 177, 0, 0.04)'
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
              { yAxis: targetMin, name: 'Target Low' },
              { yAxis: targetMax, name: 'Target High' }
            ]
          }
        },
        // 2. Base invisible stacking series (floating base)
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
          barWidth: '40%'
        },
        // 4. Mean line overlay
        {
          name: 'Average Glucose',
          type: 'line',
          data: meanData,
          color: '#1d4ed8', // bold blue
          symbol: 'circle',
          symbolSize: 6,
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
  }, [hourlyStats, days, units]);

  return (
    <div className="w-full">
      <div ref={chartRef} className="h-96 w-full" />
    </div>
  );
};
