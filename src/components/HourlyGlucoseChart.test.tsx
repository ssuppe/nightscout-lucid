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
  const mockStats = Array.from({ length: 96 }, (_, i) => ({
    binIndex: i,
    timeLabel: `${Math.floor((i * 15) / 60)}:${((i * 15) % 60).toString().padStart(2, '0')}`,
    p15: 90,
    p75: 150,
    mean: 120,
  }));

  it('renders correctly and initializes echarts', () => {
    render(<HourlyGlucoseChart hourlyStats={mockStats} days={14} units={GlucoseUnit.MGDL} />);
    expect(echarts.init).toHaveBeenCalled();
  });
});
