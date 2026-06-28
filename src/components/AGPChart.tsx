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
    // Series 1: base_p10 = p10 values
    // Series 2: diff_p90 = p90 - p10 values
    const baseP10 = percentiles.map(b => b.p10);
    const diffP90 = percentiles.map(b => b.p90 - b.p10);

    // Group 2 (25-75): stackName '25-75'
    // Series 3: base_p25 = p25 values
    // Series 4: diff_p75 = p75 - p25 values
    const baseP25 = percentiles.map(b => b.p25);
    const diffP75 = percentiles.map(b => b.p75 - b.p25);

    const medianP50 = percentiles.map(b => b.p50);

    // Setup unit specific bounds
    const isMgdl = units === GlucoseUnit.MGDL;
    const yMin = isMgdl ? 40 : 2.0;
    const yMax = isMgdl ? 350 : 20.0;
    const targetMin = isMgdl ? 70 : 3.9;
    const targetMax = isMgdl ? 180 : 10.0;

    const option: echarts.EChartsOption = {
      title: {
        text: 'Ambulatory Glucose Profile (AGP)',
        subtext: `Target Range: ${targetMin}-${targetMax} ${units}. Grouped by 15-minute intervals.`,
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
        formatter: (params: any) => {
          const time = params[0].axisValue;
          // Find the corresponding bin in our percentiles data
          const bin = percentiles.find(b => b.timeLabel === time);
          if (!bin) return '';

          return `
            <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
              <div style="font-weight: bold; margin-bottom: 4px; color: #1e293b;">Time: ${time}</div>
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                <span style="color: #64748b;">90th Percentile:</span>
                <span style="font-weight: bold;">${bin.p90}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                <span style="color: #1e3a8a;">75th Percentile:</span>
                <span style="font-weight: bold; color: #1e3a8a;">${bin.p75}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                <span style="color: #0f172a; font-weight: bold;">50th (Median):</span>
                <span style="font-weight: bold; color: #72B100;">${bin.p50}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                <span style="color: #1e3a8a;">25th Percentile:</span>
                <span style="font-weight: bold; color: #1e3a8a;">${bin.p25}</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: #64748b;">10th Percentile:</span>
                <span style="font-weight: bold;">${bin.p10}</span>
              </div>
            </div>
          `;
        }
      },
      grid: {
        left: '5%',
        right: '5%',
        bottom: '8%',
        top: '18%',
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
          fontSize: 10,
          interval: 8, // show label every 2 hours (8 * 15min = 120min)
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
              color: 'rgba(114, 177, 0, 0.04)' // soft green
            },
            data: [
              [
                {
                  yAxis: targetMin
                },
                {
                  yAxis: targetMax
                }
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
            color: 'rgba(37, 99, 235, 0.08)' // very light blue
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
            color: 'rgba(29, 78, 216, 0.22)' // darker, translucent blue
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
            color: '#1d4ed8', // bold blue
            width: 3.5
          }
        }
      ]
    };

    chart.setOption(option);

    // Handle resize
    const handleResize = () => {
      chart.resize();
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [percentiles, units]);

  return (
    <div className="w-full">
      {/* Chart container */}
      <div ref={chartRef} className="h-96 w-full" />
    </div>
  );
};
