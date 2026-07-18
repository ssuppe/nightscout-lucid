import Papa from 'papaparse';
import { format } from 'date-fns';
import { GlucoseUnit } from './nightscout';
import type { NightscoutEntry, NightscoutTreatment } from './nightscout';

const CONVERSION_FACTOR = 18.018;

function roundTo(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

export function generateCSV(
  entries: NightscoutEntry[],
  treatments: NightscoutTreatment[],
  units: GlucoseUnit
): string {
  const glucoseHeader = `Glucose (${units})`;
  const fields = [
    'Timestamp (UTC)',
    'Time (Local)',
    'Type',
    glucoseHeader,
    'Carbs (g)',
    'Insulin (u)',
    'Notes'
  ];

  const glucoseItems = entries
    .filter(e => e.sgv !== null && e.sgv !== undefined && Number.isFinite(e.sgv))
    .map(e => ({
      timestamp: e.date,
      iso: new Date(e.date).toISOString(),
      local: format(new Date(e.date), 'yyyy-MM-dd HH:mm:ss'),
      type: 'Glucose',
      glucose: units === GlucoseUnit.MMOL
        ? String(roundTo(e.sgv / CONVERSION_FACTOR, 1))
        : String(Math.round(e.sgv)),
      carbs: '',
      insulin: '',
      notes: e.direction || '',
    }));

  const treatmentItems = treatments.map(t => {
    const timestamp = t.date || new Date(t.created_at).getTime();
    return {
      timestamp,
      iso: new Date(timestamp).toISOString(),
      local: format(new Date(timestamp), 'yyyy-MM-dd HH:mm:ss'),
      type: t.eventType || 'Treatment',
      glucose: '',
      carbs: t.carbs !== null && t.carbs !== undefined ? String(t.carbs) : '',
      insulin: t.insulin !== null && t.insulin !== undefined ? String(t.insulin) : '',
      notes: t.notes || '',
    };
  });

  const merged = [...glucoseItems, ...treatmentItems];
  merged.sort((a, b) => a.timestamp - b.timestamp);

  const data = merged.map(item => [
    item.iso,
    item.local,
    item.type,
    item.glucose,
    item.carbs,
    item.insulin,
    item.notes
  ]);

  return Papa.unparse({
    fields,
    data
  });
}
