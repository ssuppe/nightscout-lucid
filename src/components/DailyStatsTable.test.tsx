import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DailyStatsTable } from './DailyStatsTable';
import { GlucoseUnit } from '../utils/nightscout';

describe('DailyStatsTable Component', () => {
  // Jan 12, 2026 is a Monday
  const mondayTime = new Date('2026-01-12T12:00:00Z').getTime();
  
  const mockEntries = [
    { _id: 'e1', date: mondayTime, sgv: 120, type: 'sgv' },
    { _id: 'e2', date: mondayTime + 60000, sgv: 180, type: 'sgv' }
  ];

  it('renders weekday aggregated table headers and row metrics', () => {
    render(
      <DailyStatsTable
        days={[]}
        entries={mockEntries}
        units={GlucoseUnit.MGDL}
      />
    );

    // Title
    expect(screen.getByText('Daily Statistics')).toBeInTheDocument();

    // Weekdays
    expect(screen.getByText('Mon')).toBeInTheDocument();
    expect(screen.getByText('Tue')).toBeInTheDocument();
    expect(screen.getByText('Sun')).toBeInTheDocument();

    // Row Titles
    expect(screen.getByText('% In Range')).toBeInTheDocument();
    expect(screen.getByText('% Very High')).toBeInTheDocument();
    expect(screen.getByText('% High')).toBeInTheDocument();
    expect(screen.getByText('% Low')).toBeInTheDocument();
    expect(screen.getByText('% Very Low')).toBeInTheDocument();
    expect(screen.getByText('# Readings')).toBeInTheDocument();
    expect(screen.getByText('Min')).toBeInTheDocument();
    expect(screen.getByText('Max')).toBeInTheDocument();
    expect(screen.getByText('Mean')).toBeInTheDocument();
    expect(screen.getByText('Std. Dev.')).toBeInTheDocument();
    expect(screen.getByText('Median')).toBeInTheDocument();
    expect(screen.getByText('%CV')).toBeInTheDocument();

    // Monday values:
    // Min = 120, Max = 180
    // Mean = 150, Median = 150
    // Q1 (25th percentile of [120, 180]) = 135
    // Q3 (75th percentile of [120, 180]) = 165
    // IQR = 165 - 135 = 30
    // Std Dev = 30
    expect(screen.getAllByText('120')).toHaveLength(1); // Min
    expect(screen.getAllByText('180')).toHaveLength(1); // Max
    expect(screen.getAllByText('150')).toHaveLength(2); // Mean and Median
    expect(screen.getAllByText('135')).toHaveLength(1); // Q1
    expect(screen.getAllByText('165')).toHaveLength(1); // Q3
    expect(screen.getAllByText('30')).toHaveLength(2);  // IQR and Std Dev

    // Verify dark row divider borders exist
    const veryLowCell = screen.getByText('% Very Low');
    const veryLowRow = veryLowCell.closest('tr');
    expect(veryLowRow).toHaveClass('border-b-2');

    const stdDevCell = screen.getByText('Std. Dev.');
    const stdDevRow = stdDevCell.closest('tr');
    expect(stdDevRow).toHaveClass('border-b-2');
  });
});
