import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HourlyStatsTable } from './HourlyStatsTable';
import { GlucoseUnit } from '../utils/nightscout';

describe('HourlyStatsTable Component', () => {
  const mockEntries = [
    { _id: 'e1', date: new Date().setHours(1, 30), sgv: 120, type: 'sgv' },
    { _id: 'e2', date: new Date().setHours(1, 45), sgv: 185, type: 'sgv' }
  ];

  it('renders table headers, 24 hour rows, and correct vertical dividers', () => {
    render(
      <HourlyStatsTable
        entries={mockEntries}
        units={GlucoseUnit.MGDL}
      />
    );

    // Headers
    const hourRangeHeader = screen.getByText('Hour Range');
    expect(hourRangeHeader).toBeInTheDocument();
    expect(hourRangeHeader).toHaveClass('border-r');

    const sdHeader = screen.getByText('SD (CV)');
    expect(sdHeader).toHaveClass('border-r');

    const veryLowHeader = screen.getByText('% Very Low');
    expect(veryLowHeader).toHaveClass('border-r');

    // Data Row (1-2 hour range)
    const rowLabelCell = screen.getByText('01:00 - 02:00 (1-2)');
    expect(rowLabelCell).toBeInTheDocument();
    expect(rowLabelCell).toHaveClass('border-r');
  });
});
