import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { HourlyStatsTable } from './HourlyStatsTable';
import { GlucoseUnit } from '../utils/nightscout';

describe('HourlyStatsTable Component', () => {
  const mockEntries = [
    { _id: 'e1', date: new Date().setHours(1, 30), sgv: 120, type: 'sgv' },
    { _id: 'e2', date: new Date().setHours(1, 45), sgv: 185, type: 'sgv' }
  ];
  const mockTreatments = [
    { _id: 't1', date: new Date().setHours(1, 15), created_at: new Date().toISOString(), eventType: 'Meal Bolus', carbs: 60, insulin: 6 }
  ];

  it('renders table headers and matching 24 hour rows', () => {
    render(
      <HourlyStatsTable
        entries={mockEntries}
        treatments={mockTreatments}
        units={GlucoseUnit.MGDL}
      />
    );

    // Headers
    expect(screen.getByText('Hour Range')).toBeInTheDocument();
    expect(screen.getByText('% In Range')).toBeInTheDocument();
    expect(screen.getByText('Total Carbs')).toBeInTheDocument();
    expect(screen.getByText('Total Insulin')).toBeInTheDocument();

    // Data Row (1-2 hour range)
    expect(screen.getByText('01:00 - 02:00 (1-2)')).toBeInTheDocument();
    expect(screen.getByText('60g')).toBeInTheDocument();
  });
});
