import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { HourlyGlucoseChart } from './HourlyGlucoseChart';
import { GlucoseUnit } from '../utils/nightscout';
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

describe('HourlyGlucoseChart Component', () => {
  const mockStats = Array.from({ length: 24 }, (_, i) => ({
    hour: i,
    timeLabel: `${i}:00`,
    p15: 90,
    p75: 150,
    mean: 120,
  }));

  it('renders correctly and initializes echarts', () => {
    render(<HourlyGlucoseChart hourlyStats={mockStats} days={14} units={GlucoseUnit.MGDL} />);
    expect(echarts.init).toHaveBeenCalled();
  });
});
