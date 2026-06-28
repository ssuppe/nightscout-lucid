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

  it('calculates and displays weekly stats correctly in mg/dL', () => {
    const { getByText } = render(
      <WeeklyOverlayChart
        entries={mockEntries}
        units={GlucoseUnit.MGDL}
        selectedDays={[0, 1, 2, 3, 4, 5, 6]}
        eventFilter="all"
        weekLabel="Week 1"
      />
    );
    // Mean of 120 and 150 is 135 mg/dL.
    expect(getByText('Avg:')).toBeInTheDocument();
    expect(getByText('135 mg/dL')).toBeInTheDocument();
    // Both 120 and 150 are in target range (70-180), so TIR is 100%.
    expect(getByText('TIR:')).toBeInTheDocument();
    expect(getByText('100%')).toBeInTheDocument();
    // SD of [120, 150] is sqrt(((120-135)^2 + (150-135)^2)/2) = sqrt((225+225)/2) = sqrt(225) = 15.
    expect(getByText('SD:')).toBeInTheDocument();
    expect(getByText('± 15 mg/dL')).toBeInTheDocument();
  });

  it('calculates and displays weekly stats correctly in mmol/L', () => {
    const { getByText } = render(
      <WeeklyOverlayChart
        entries={mockEntries}
        units={GlucoseUnit.MMOL}
        selectedDays={[0, 1, 2, 3, 4, 5, 6]}
        eventFilter="all"
        weekLabel="Week 1"
      />
    );
    // Mean of 120 and 150 is 135 mg/dL. In mmol/L: 135 / 18.018 = 7.49... -> 7.5 mmol/L.
    expect(getByText('7.5 mmol/L')).toBeInTheDocument();
    // SD is 15 mg/dL. In mmol/L: 15 / 18.018 = 0.83... -> 0.8 mmol/L.
    expect(getByText('± 0.8 mmol/L')).toBeInTheDocument();
  });
});
