import { describe, it, expect } from 'vitest';
import { generateCSV } from './csvExport';
import { GlucoseUnit } from './nightscout';
import type { NightscoutEntry, NightscoutTreatment } from './nightscout';

describe('CSV Export Utility', () => {
  const mockEntries: NightscoutEntry[] = [
    {
      _id: 'entry-1',
      date: 1718020000000, // 2024-06-10T11:46:40.000Z
      sgv: 120,
      type: 'sgv',
      direction: 'Flat',
    },
    {
      _id: 'entry-2',
      date: 1718020300000, // 2024-06-10T11:51:40.000Z
      sgv: 125,
      type: 'sgv',
      direction: 'FortyFiveUp',
    },
  ];

  const mockTreatments: NightscoutTreatment[] = [
    {
      _id: 'treatment-1',
      date: 1718020100000, // 2024-06-10T11:48:20.000Z
      created_at: '2024-06-10T11:48:20.000Z',
      eventType: 'Meal Bolus',
      carbs: 45,
      insulin: 5.5,
      notes: 'Lunch, sandwich',
    },
  ];

  it('generates a valid CSV for mg/dL units with headers and records sorted chronologically', () => {
    const csvStr = generateCSV(mockEntries, mockTreatments, GlucoseUnit.MGDL);
    
    // Parse it back or assert substring positions
    const lines = csvStr.split('\n').map(l => l.trim()).filter(Boolean);
    
    expect(lines[0]).toBe('Timestamp (UTC),Time (Local),Type,Glucose (mg/dL),Carbs (g),Insulin (u),Notes');
    
    // Chronological order: entry-1 (1718020000000), treatment-1 (1718020100000), entry-2 (1718020300000)
    expect(lines[1]).toContain('2024-06-10T11:46:40.000Z');
    expect(lines[1]).toContain('Glucose');
    expect(lines[1]).toContain('120');
    expect(lines[1]).toContain('Flat');

    expect(lines[2]).toContain('2024-06-10T11:48:20.000Z');
    expect(lines[2]).toContain('Meal Bolus');
    expect(lines[2]).toContain('45');
    expect(lines[2]).toContain('5.5');
    expect(lines[2]).toContain('"Lunch, sandwich"'); // properly quoted by PapaParse

    expect(lines[3]).toContain('2024-06-10T11:51:40.000Z');
    expect(lines[3]).toContain('Glucose');
    expect(lines[3]).toContain('125');
    expect(lines[3]).toContain('FortyFiveUp');
  });

  it('generates a valid CSV for mmol/L units converting glucose values correctly', () => {
    const csvStr = generateCSV(mockEntries, [], GlucoseUnit.MMOL);
    const lines = csvStr.split('\n').map(l => l.trim()).filter(Boolean);
    
    expect(lines[0]).toBe('Timestamp (UTC),Time (Local),Type,Glucose (mmol/L),Carbs (g),Insulin (u),Notes');
    
    // 120 mg/dL / 18.018 = 6.6599... -> 6.7
    expect(lines[1]).toContain('6.7');
    // 125 mg/dL / 18.018 = 6.9375... -> 6.9
    expect(lines[2]).toContain('6.9');
  });

  it('handles empty inputs gracefully', () => {
    const csvStr = generateCSV([], [], GlucoseUnit.MGDL);
    const lines = csvStr.split('\n').map(l => l.trim()).filter(Boolean);
    expect(lines.length).toBe(1);
    expect(lines[0]).toBe('Timestamp (UTC),Time (Local),Type,Glucose (mg/dL),Carbs (g),Insulin (u),Notes');
  });

  it('filters out entries with null, undefined, or NaN SGVs', () => {
    const invalidEntries: NightscoutEntry[] = [
      { _id: 'e1', date: 1718020000000, sgv: 120, type: 'sgv' },
      { _id: 'e2', date: 1718020100000, sgv: null as any, type: 'sgv' },
      { _id: 'e3', date: 1718020200000, sgv: undefined as any, type: 'sgv' },
      { _id: 'e4', date: 1718020300000, sgv: NaN, type: 'sgv' },
    ];
    const csvStr = generateCSV(invalidEntries, [], GlucoseUnit.MGDL);
    const lines = csvStr.split('\n').map(l => l.trim()).filter(Boolean);
    
    // Header + 1 valid entry = 2 lines
    expect(lines.length).toBe(2);
    expect(lines[1]).toContain('120');
    expect(lines[1]).not.toContain('NaN');
  });

  it('correctly outputs empty fields for incomplete treatment records', () => {
    const incompleteTreatments: NightscoutTreatment[] = [
      {
        _id: 't1',
        date: 1718020000000,
        created_at: '2024-06-10T11:46:40.000Z',
        eventType: 'Correction Bolus',
        insulin: 2.0,
        // carbs is missing/undefined
        // notes is missing/undefined
      },
      {
        _id: 't2',
        created_at: '2024-06-10T11:48:20.000Z',
        eventType: 'Carbs',
        carbs: 15,
        // insulin is null
        insulin: null,
      }
    ];

    const csvStr = generateCSV([], incompleteTreatments, GlucoseUnit.MGDL);
    const lines = csvStr.split('\n').map(l => l.trim()).filter(Boolean);

    expect(lines.length).toBe(3); // Header + 2 treatments

    // Row 1: Correction Bolus (insulin=2.0, carbs="", notes="")
    const row1Fields = lines[1].split(',');
    expect(row1Fields[2]).toBe('Correction Bolus');
    expect(row1Fields[3]).toBe(''); // Glucose
    expect(row1Fields[4]).toBe(''); // Carbs
    expect(row1Fields[5]).toBe('2'); // Insulin
    expect(row1Fields[6]).toBe(''); // Notes

    // Row 2: Carbs (carbs=15, insulin="", notes="")
    const row2Fields = lines[2].split(',');
    expect(row2Fields[2]).toBe('Carbs');
    expect(row2Fields[3]).toBe(''); // Glucose
    expect(row2Fields[4]).toBe('15'); // Carbs
    expect(row2Fields[5]).toBe(''); // Insulin
    expect(row2Fields[6]).toBe(''); // Notes
  });
});
