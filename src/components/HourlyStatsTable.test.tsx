import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HourlyStatsTable } from './HourlyStatsTable';
import { GlucoseUnit } from '../utils/nightscout';

describe('HourlyStatsTable Component', () => {
  const mockEntries = [
    { _id: 'e1', date: new Date().setHours(1, 30), sgv: 120, type: 'sgv' },
    { _id: 'e2', date: new Date().setHours(1, 45), sgv: 185, type: 'sgv' }
  ];

  it('renders table headers and matching 24 hour rows', () => {
    render(
      <HourlyStatsTable
        entries={mockEntries}
        units={GlucoseUnit.MGDL}
      />
    );

    // Headers
    expect(screen.getByText('Hour Range')).toBeInTheDocument();
    expect(screen.getByText('% In Range')).toBeInTheDocument();
    expect(screen.getByText('% Very High')).toBeInTheDocument();
    expect(screen.getByText('% High')).toBeInTheDocument();
    expect(screen.getByText('% Low')).toBeInTheDocument();
    expect(screen.getByText('% Very Low')).toBeInTheDocument();

    // Data Row (1-2 hour range)
    expect(screen.getByText('01:00 - 02:00 (1-2)')).toBeInTheDocument();
  });
});
