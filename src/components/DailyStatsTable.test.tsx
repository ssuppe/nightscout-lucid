import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DailyStatsTable } from './DailyStatsTable';
import { GlucoseUnit } from '../utils/nightscout';

describe('DailyStatsTable Component', () => {
  const mockEntries = [
    { _id: 'e1', date: Date.now(), sgv: 120, type: 'sgv' },
    { _id: 'e2', date: Date.now() - 1000 * 60 * 10, sgv: 185, type: 'sgv' }
  ];
  const mockTreatments = [
    { _id: 't1', date: Date.now(), created_at: new Date().toISOString(), eventType: 'Meal Bolus', carbs: 60, insulin: 6 }
  ];

  it('renders table headers and matching daily rows', () => {
    const days = [new Date()];
    render(
      <DailyStatsTable
        days={days}
        entries={mockEntries}
        treatments={mockTreatments}
        units={GlucoseUnit.MGDL}
      />
    );

    // Headers
    expect(screen.getByText('Avg Glucose')).toBeInTheDocument();
    expect(screen.getByText('In Range (%)')).toBeInTheDocument();
    expect(screen.getByText('Carbs')).toBeInTheDocument();
    expect(screen.getByText('Insulin')).toBeInTheDocument();

    // Data Row
    expect(screen.getByText('60g')).toBeInTheDocument();
    expect(screen.getByText('6.0 U')).toBeInTheDocument();
  });
});
