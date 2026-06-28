import React, { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import type { HourlyTIR } from '../utils/metrics';

interface HourlyTIRChartProps {
  hourlyData: HourlyTIR[];
  days: number;
}

export const HourlyTIRChart: React.FC<HourlyTIRChartProps> = ({ hourlyData, days }) => {
  const chartRef = useRef<HTMLDivElement>(null);
  const chartInstance = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!chartRef.current) return;

    if (!chartInstance.current) {
      chartInstance.current = echarts.init(chartRef.current);
    }

    const chart = chartInstance.current;

    const timeLabels = hourlyData.map(d => d.timeLabel);
    const veryLowData = hourlyData.map(d => d.veryLow);
    const lowData = hourlyData.map(d => d.low);
    const targetData = hourlyData.map(d => d.target);
    const highData = hourlyData.map(d => d.high);
    const veryHighData = hourlyData.map(d => d.veryHigh);

    const option: echarts.EChartsOption = {
      title: {
        text: 'Time in Range by Hour of Day',
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
          const d = hourlyData[dataIndex];
          return `
            <div style="font-family: sans-serif; font-size: 12px; padding: 4px;">
              <div style="font-weight: bold; margin-bottom: 6px; color: #1e293b;">Time Slot: ${time}</div>
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                <span style="color: #F29100; font-weight: bold;">Very High:</span>
                <span style="font-weight: bold;">${d.veryHigh}%</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                <span style="color: #FCD116; font-weight: bold;">High:</span>
                <span style="font-weight: bold;">${d.high}%</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                <span style="color: #72B100; font-weight: bold;">In Range:</span>
                <span style="font-weight: bold; color: #72B100;">${d.target}%</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px; margin-bottom: 2px;">
                <span style="color: #F04124; font-weight: bold;">Low:</span>
                <span style="font-weight: bold;">${d.low}%</span>
              </div>
              <div style="display: flex; justify-content: space-between; gap: 16px;">
                <span style="color: #9C0006; font-weight: bold;">Very Low:</span>
                <span style="font-weight: bold;">${d.veryLow}%</span>
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
        data: ['Very High', 'High', 'In Range', 'Low', 'Very Low']
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
          interval: 2 // show every 3rd hour label to avoid crowding
        }
      },
      yAxis: {
        type: 'value',
        min: 0,
        max: 100,
        axisLabel: {
          formatter: '{value}%',
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
        {
          name: 'Very Low',
          type: 'bar',
          stack: 'TIR',
          color: '#9C0006', // crimson
          emphasis: { focus: 'series' },
          data: veryLowData
        },
        {
          name: 'Low',
          type: 'bar',
          stack: 'TIR',
          color: '#F04124', // red
          emphasis: { focus: 'series' },
          data: lowData
        },
        {
          name: 'In Range',
          type: 'bar',
          stack: 'TIR',
          color: '#72B100', // lime green
          emphasis: { focus: 'series' },
          data: targetData
        },
        {
          name: 'High',
          type: 'bar',
          stack: 'TIR',
          color: '#FCD116', // yellow
          emphasis: { focus: 'series' },
          data: highData
        },
        {
          name: 'Very High',
          type: 'bar',
          stack: 'TIR',
          color: '#F29100', // orange
          emphasis: { focus: 'series' },
          data: veryHighData
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
  }, [hourlyData, days]);

  return (
    <div className="w-full">
      <div ref={chartRef} className="h-96 w-full" />
    </div>
  );
};
