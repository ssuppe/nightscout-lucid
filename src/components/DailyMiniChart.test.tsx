import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { DailyMiniChart } from './DailyMiniChart';
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
      dispose: vi.fn(),
    })),
  };
});

describe('DailyMiniChart Component', () => {
  const mockEntries = [
    { _id: 'e1', date: Date.now() - 1000 * 60 * 60, sgv: 120, type: 'sgv' },
    { _id: 'e2', date: Date.now() - 1000 * 60 * 30, sgv: 150, type: 'sgv' }
  ];

  const mockTreatments = [
    { _id: 't1', date: Date.now() - 1000 * 60 * 45, created_at: new Date().toISOString(), eventType: 'Meal Bolus', carbs: 45, insulin: 5 }
  ];

  it('renders correctly and initializes echarts', () => {
    render(
      <DailyMiniChart
        entries={mockEntries}
        treatments={mockTreatments}
        units={GlucoseUnit.MGDL}
        dayStart={new Date().setHours(0, 0, 0, 0)}
      />
    );
    expect(echarts.init).toHaveBeenCalled();
  });
});
