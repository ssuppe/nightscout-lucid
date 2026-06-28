import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HourlyStatsTable } from './HourlyStatsTable';
import { GlucoseUnit } from '../utils/nightscout';

describe('HourlyStatsTable Component', () => {
  // Mock entries for 1:30 AM (hour 1) and 1:45 AM (hour 1)
  const baseTime = new Date('2026-01-12T00:00:00Z').getTime();
  const mockEntries = [
    { _id: 'e1', date: baseTime + 1.5 * 60 * 60 * 1000, sgv: 120, type: 'sgv' }, // 01:30
    { _id: 'e2', date: baseTime + 1.75 * 60 * 60 * 1000, sgv: 180, type: 'sgv' } // 01:45
  ];

  it('renders table headers, 24 hour rows divided into two tables, and correct dividers', () => {
    render(
      <HourlyStatsTable
        entries={mockEntries}
        units={GlucoseUnit.MGDL}
      />
    );

    // Titles of AM/PM tables
    expect(screen.getByText('Hourly Statistics (00:00 - 12:00)')).toBeInTheDocument();
    expect(screen.getByText('Hourly Statistics (12:00 - 24:00)')).toBeInTheDocument();

    // Column Headers AM
    expect(screen.getByText('00-01')).toBeInTheDocument();
    expect(screen.getByText('01-02')).toBeInTheDocument();
    expect(screen.getByText('11-12')).toBeInTheDocument();

    // Column Headers PM
    expect(screen.getByText('12-13')).toBeInTheDocument();
    expect(screen.getByText('23-00')).toBeInTheDocument();

    // Row Titles (each rendered twice - once per table)
    expect(screen.getAllByText('% In Range')).toHaveLength(2);
    expect(screen.getAllByText('% Very High')).toHaveLength(2);
    expect(screen.getAllByText('% High')).toHaveLength(2);
    expect(screen.getAllByText('% Low')).toHaveLength(2);
    expect(screen.getAllByText('% Very Low')).toHaveLength(2);
    expect(screen.getAllByText('# Readings')).toHaveLength(2);
    expect(screen.getAllByText('Min')).toHaveLength(2);
    expect(screen.getAllByText('Max')).toHaveLength(2);
    expect(screen.getAllByText('Mean')).toHaveLength(2);
    expect(screen.getAllByText('Std. Dev.')).toHaveLength(2);
    expect(screen.getAllByText('Median')).toHaveLength(2);
    expect(screen.getAllByText('%CV')).toHaveLength(2);

    // Verify row borders on first table
    const maxCells = screen.getAllByText('Max');
    expect(maxCells[0].closest('tr')).toHaveClass('border-b');

    const iqrCells = screen.getAllByText('IQR');
    expect(iqrCells[0].closest('tr')).toHaveClass('border-b');

    const stdDevCells = screen.getAllByText('Std. Dev.');
    expect(stdDevCells[0].closest('tr')).toHaveClass('border-b-2');

    // Verify vertical divider on the first column
    const metricHeaders = screen.getAllByText('Metric');
    expect(metricHeaders[0]).toHaveClass('border-r');
    expect(maxCells[0]).toHaveClass('border-r');
  });
});
