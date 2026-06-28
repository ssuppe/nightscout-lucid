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

    const allVals = hourlyStats.flatMap(d => [d.p15, d.p75, d.mean]);
    const maxVal = allVals.length > 0 ? Math.max(...allVals, targetMax) : targetMax;
    const minVal = allVals.length > 0 ? Math.min(...allVals, targetMin) : targetMin;

    const cushionMin = isMgdl ? 15 : 0.8;
    const cushionMax = isMgdl ? 25 : 1.5;

    const yMin = Math.max(isMgdl ? 40 : 2.0, Math.floor(minVal - cushionMin));
    const yMax = Math.ceil(maxVal + cushionMax);



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
          const stat = hourlyStats.find(s => s.timeLabel === time);
          if (!stat) return '';

          const precision = isMgdl ? 0 : 1;
          const unitStr = units;

          const p15Val = stat.p15.toFixed(precision);
          const p75Val = stat.p75.toFixed(precision);
          const meanVal = stat.mean.toFixed(precision);

          return `
            <div style="font-family: sans-serif; font-size: 11px; padding: 4px; line-height: 1.6; text-align: left;">
              <div style="font-weight: 800; color: #1e293b; border-b: 1px solid #e2e8f0; padding-bottom: 3px; mb-4">${time}</div>
              <div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: #64748b; font-weight: 600;">Average Glucose:</span>
                <span style="font-weight: 800; color: #1d4ed8;">${meanVal} ${unitStr}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-top: 2px;">
                <span style="color: #64748b; font-weight: 600;">15th - 75th Range:</span>
                <span style="font-weight: 800; color: #475569;">${p15Val} - ${p75Val} ${unitStr}</span>
              </div>
            </div>
          `;
        }
      },
      grid: {
        left: '4%',
        right: '4%',
        top: '6%',
        bottom: '8%',
        containLabel: true
      },
      xAxis: {
        type: 'category',
        data: timeLabels,
        axisLabel: {
          color: '#64748b',
          fontSize: 9,
          interval: 8,
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
