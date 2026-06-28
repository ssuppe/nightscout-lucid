import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AGPChart } from './AGPChart';
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

describe('AGPChart Component', () => {
  const mockPercentiles = Array.from({ length: 96 }, (_, i) => {
    const hour = Math.floor(i / 4).toString().padStart(2, '0');
    const min = ((i % 4) * 15).toString().padStart(2, '0');
    return {
      timeLabel: `${hour}:${min}`,
      p10: 80,
      p25: 95,
      p50: 120,
      p75: 145,
      p90: 160,
    };
  });

  it('renders correctly and initializes echarts', () => {
    render(<AGPChart percentiles={mockPercentiles} units={GlucoseUnit.MGDL} />);
    expect(echarts.init).toHaveBeenCalled();
  });
});
