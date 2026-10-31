import { describe, it, expect } from 'vitest';
import { StoredOccurrence } from '../scripts/ingest/types.js';

describe('Occurrence Deduplication Rule', () => {
  it('strictly deduplicates occurrences by gbifID across multiple query windows', () => {
    const rawOccurrences = [
      { key: '1001', decimalLatitude: 45.2, decimalLongitude: 12.1, month: 5 },
      { key: '1002', decimalLatitude: 46.1, decimalLongitude: 13.0, month: 5 },
      { key: '1001', decimalLatitude: 45.2, decimalLongitude: 12.1, month: 6 }, // Duplicate key from overlapping month
      { key: '1003', decimalLatitude: 50.0, decimalLongitude: 8.5, month: 6 },
    ];

    const dedupedMap = new Map<string, StoredOccurrence>();
    for (const o of rawOccurrences) {
      const gbifId = String(o.key);
      if (!dedupedMap.has(gbifId)) {
        dedupedMap.set(gbifId, {
          gbif_id: gbifId,
          species_id: 'test_bird',
          lat: o.decimalLatitude,
          lon: o.decimalLongitude,
          event_date: '2022-05-10',
          month: o.month,
          dataset_key: 'd1',
          license: 'CC-BY-4.0',
          basis_of_record: 'HUMAN_OBSERVATION',
          country_code: 'IT',
          coord_uncertainty_m: 100,
          retrieved_at: new Date().toISOString(),
        });
      }
    }

    const result = Array.from(dedupedMap.values());
    expect(result.length).toBe(3);
    expect(result.map((r) => r.gbif_id)).toEqual(['1001', '1002', '1003']);
  });
});
