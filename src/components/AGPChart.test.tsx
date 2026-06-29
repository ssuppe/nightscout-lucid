import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render } from '@testing-library/react';
import { AGPChart } from './AGPChart';
import { GlucoseUnit } from '../utils/nightscout';
import * as echarts from 'echarts';

// Capture setOption calls so tests can assert on the chart config
const mockSetOption = vi.fn();
const mockResize = vi.fn();

vi.mock('echarts', () => ({
  init: vi.fn(() => ({
    setOption: mockSetOption,
    resize: mockResize,
    dispose: vi.fn(),
  })),
}));

describe('AGPChart Component', () => {
  const makePercentiles = (p10: number, p25: number, p50: number, p75: number, p90: number) =>
    Array.from({ length: 96 }, (_, i) => {
      const hour = Math.floor(i / 4).toString().padStart(2, '0');
      const min = ((i % 4) * 15).toString().padStart(2, '0');
      return { timeLabel: `${hour}:${min}`, p10, p25, p50, p75, p90 };
    });

  beforeEach(() => {
    mockSetOption.mockClear();
  });

  it('renders correctly and initializes echarts', () => {
    render(<AGPChart percentiles={makePercentiles(80, 95, 120, 145, 160)} units={GlucoseUnit.MGDL} />);
    expect(echarts.init).toHaveBeenCalled();
  });

  it('calls setOption with a series array that includes a median (p50) line series', () => {
    render(<AGPChart percentiles={makePercentiles(80, 95, 120, 145, 160)} units={GlucoseUnit.MGDL} />);

    expect(mockSetOption).toHaveBeenCalled();
    const option = mockSetOption.mock.calls[0][0] as any;

    // Must have a series array
    expect(Array.isArray(option.series)).toBe(true);
    expect(option.series.length).toBeGreaterThan(0);

    // At least one series must contain the p50 values (120) as its data
    const medianSeries = option.series.find(
      (s: any) => Array.isArray(s.data) && s.data.includes(120)
    );
    expect(medianSeries).toBeDefined();
    expect(medianSeries.type).toBe('line');
  });

  it('xAxis has 96 time-label data points (one per 15-min bin)', () => {
    render(<AGPChart percentiles={makePercentiles(80, 95, 120, 145, 160)} units={GlucoseUnit.MGDL} />);

    const option = mockSetOption.mock.calls[0][0] as any;
    expect(option.xAxis.data).toHaveLength(96);
    expect(option.xAxis.data[0]).toBe('00:00');
    expect(option.xAxis.data[48]).toBe('12:00');
  });

  it('empty percentiles array renders without crashing and still calls setOption', () => {
    expect(() =>
      render(<AGPChart percentiles={[]} units={GlucoseUnit.MGDL} />)
    ).not.toThrow();
    expect(mockSetOption).toHaveBeenCalled();
  });
});
