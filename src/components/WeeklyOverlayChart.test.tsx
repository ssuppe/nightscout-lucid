import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { WeeklyOverlayChart } from './WeeklyOverlayChart';
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

describe('WeeklyOverlayChart Component', () => {
  const mockEntries = [
    { _id: 'e1', date: Date.now() - 1000 * 60 * 60, sgv: 120, type: 'sgv' },
    { _id: 'e2', date: Date.now() - 1000 * 60 * 30, sgv: 150, type: 'sgv' }
  ];

  it('renders correctly and initializes echarts', () => {
    render(
      <WeeklyOverlayChart
        entries={mockEntries}
        units={GlucoseUnit.MGDL}
        selectedDays={[0, 1, 2, 3, 4, 5, 6]}
        eventFilter="all"
        weekLabel="Week 1"
      />
    );
    expect(echarts.init).toHaveBeenCalled();
  });
});
