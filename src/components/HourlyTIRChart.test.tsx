import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { HourlyTIRChart } from './HourlyTIRChart';
import * as echarts from 'echarts';

const mockSetOption = vi.fn();
const mockResize = vi.fn();

// Mock echarts library
vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: mockSetOption,
    resize: mockResize,
    dispose: vi.fn(),
  })),
}));

describe('HourlyTIRChart Component', () => {
  beforeEach(() => {
    mockSetOption.mockClear();
  });

  const makeHourlyData = () => Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    timeLabel: `${i}:00`,
    veryLow: 5,
    low: 10,
    target: 70,
    high: 10,
    veryHigh: 5,
  }));

  it('renders correctly and initializes echarts', () => {
    render(<HourlyTIRChart hourlyData={makeHourlyData()} days={14} />);
    expect(echarts.init).toHaveBeenCalled();
  });

  it('passes No Data series as 0s when there is data', () => {
    render(<HourlyTIRChart hourlyData={makeHourlyData()} days={14} />);
    expect(mockSetOption).toHaveBeenCalled();
    const option = mockSetOption.mock.calls[0][0] as any;
    const noDataSeries = option.series.find((s: any) => s.name === 'No Data');
    expect(noDataSeries).toBeDefined();
    expect(noDataSeries.data.every((v: number) => v === 0)).toBe(true);
  });

  it('passes No Data series as 100% when noData flag is set', () => {
    const emptyData = makeHourlyData().map(d => ({ ...d, noData: true, veryLow: 0, low: 0, target: 0, high: 0, veryHigh: 0 }));
    render(<HourlyTIRChart hourlyData={emptyData} days={14} />);
    expect(mockSetOption).toHaveBeenCalled();
    const option = mockSetOption.mock.calls[0][0] as any;
    const noDataSeries = option.series.find((s: any) => s.name === 'No Data');
    expect(noDataSeries).toBeDefined();
    expect(noDataSeries.data.every((v: number) => v === 100)).toBe(true);
  });
});
