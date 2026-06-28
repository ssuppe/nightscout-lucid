import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { HourlyTIRChart } from './HourlyTIRChart';
import * as echarts from 'echarts';

// Mock echarts library
vi.mock('echarts', () => {
  const mockSetOption = vi.fn();
  const mockResize = vi.fn();
  
  return {
    init: vi.fn(() => ({
      setOption: mockSetOption,
      resize: mockResize,
    })),
  };
});

describe('HourlyTIRChart Component', () => {
  const mockHourlyData = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    timeLabel: `${i}:00`,
    veryLow: 5,
    low: 10,
    target: 70,
    high: 10,
    veryHigh: 5,
  }));

  it('renders correctly and initializes echarts', () => {
    render(<HourlyTIRChart hourlyData={mockHourlyData} days={14} />);
    expect(echarts.init).toHaveBeenCalled();
  });
});
