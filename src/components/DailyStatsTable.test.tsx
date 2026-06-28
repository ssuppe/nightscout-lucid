import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DailyStatsTable } from './DailyStatsTable';
import { GlucoseUnit } from '../utils/nightscout';

describe('DailyStatsTable Component', () => {
  const mockEntries = [
    { _id: 'e1', date: Date.now(), sgv: 120, type: 'sgv' },
    { _id: 'e2', date: Date.now() - 1000 * 60 * 10, sgv: 185, type: 'sgv' }
  ];

  it('renders table headers and matching daily rows', () => {
    const days = [new Date()];
    render(
      <DailyStatsTable
        days={days}
        entries={mockEntries}
        units={GlucoseUnit.MGDL}
      />
    );

    // Headers
    expect(screen.getByText('Avg Glucose')).toBeInTheDocument();
    expect(screen.getByText('% In Range')).toBeInTheDocument();
    expect(screen.getByText('% Very High')).toBeInTheDocument();
    expect(screen.getByText('% High')).toBeInTheDocument();
    expect(screen.getByText('% Low')).toBeInTheDocument();
    expect(screen.getByText('% Very Low')).toBeInTheDocument();

    // Data Row
    expect(screen.getByText('153 mg/dL')).toBeInTheDocument();
  });
});
