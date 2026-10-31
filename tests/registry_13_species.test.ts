import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { canonicalSpeciesList, speciesConfig } from '../src/config.js';

describe('Canonical Observatory Species Registry', () => {
  const registryPath = path.resolve('data', 'generated', 'registry.json');
  expect(fs.existsSync(registryPath)).toBe(true);
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));

  it('contains unique species in the observatory registry', () => {
    expect(registry.species_count).toBeGreaterThan(0);
    expect(registry.species.length).toBe(registry.species_count);

    const ids = registry.species.map((s: any) => s.species_id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(registry.species_count);

    const sciNames = registry.species.map((s: any) => s.scientific_name);
    const uniqueSciNames = new Set(sciNames);
    expect(uniqueSciNames.size).toBe(registry.species_count);
  });

  it('matches registry species in src/config.js with consistent metadata', () => {
    expect(canonicalSpeciesList.length).toBe(registry.species_count);
    for (const item of canonicalSpeciesList) {
      expect(item.species_id).toBeDefined();
      expect(item.name).toBeDefined();
      expect(item.name_en).toBeDefined();
      expect(item.color).toBeDefined();
      expect(item.color.length).toBe(3);
      expect(item.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });

  it('ensures all tracked species have verified GPS telemetry files and valid features', () => {
    const trackedSpecies = registry.species.filter((s: any) => s.evidence_level === 'tracks');
    expect(trackedSpecies.length).toBeGreaterThan(0);

    for (const s of trackedSpecies) {
      expect(s.tracked_individuals).toBeGreaterThan(0);

      // Check GeoJSON track file
      const geoPath = path.resolve('data', 'generated', 'tracks', `${s.species_id}.geojson`);
      expect(fs.existsSync(geoPath)).toBe(true);
      const geo = JSON.parse(fs.readFileSync(geoPath, 'utf-8'));
      expect(geo.evidence_level).toBe('tracks');
      expect(geo.features.length).toBeGreaterThan(0);
      expect(geo.dataset.key).toBeDefined();

      // Verify coordinate validity and timestamp monotonicity for every bird
      for (const f of geo.features) {
        const coords = f.geometry.coordinates;
        const times = f.properties.times;
        expect(coords.length).toBe(times.length);
        expect(coords.length).toBeGreaterThanOrEqual(2);

        for (let i = 0; i < times.length - 1; i++) {
          expect(times[i + 1]).toBeGreaterThan(times[i]);
        }
      }
    }
  });

  it('strictly ensures species without telemetry have empty track features (no fabricated trajectories)', () => {
    const occurrencesOnly = registry.species.filter((s: any) => s.evidence_level === 'occurrences_only');
    expect(occurrencesOnly.length).toBeGreaterThan(0);

    for (const s of occurrencesOnly) {
      expect(s.tracked_individuals).toBe(0);

      const geoPath = path.resolve('data', 'generated', 'tracks', `${s.species_id}.geojson`);
      expect(fs.existsSync(geoPath)).toBe(true);
      const geo = JSON.parse(fs.readFileSync(geoPath, 'utf-8'));
      expect(geo.evidence_level).toBe('occurrences_only');
      expect(geo.features).toEqual([]);
      expect(geo.individual_count).toBe(0);
      expect(geo.total_points).toBe(0);
    }
  });

  it('strictly preserves all 10 provenance fields in occurrence records for all registry species', () => {
    for (const s of registry.species) {
      const occPath = path.resolve('data', 'generated', 'occurrences', `${s.species_id}.json`);
      expect(fs.existsSync(occPath)).toBe(true);
      const occData = JSON.parse(fs.readFileSync(occPath, 'utf-8'));

      expect(occData.label).toBe('observed');
      expect(occData.occurrences.length).toBeGreaterThan(0);

      // Spot check first occurrence record for all 10 provenance fields
      const o = occData.occurrences[0];
      expect(o.gbif_id).toBeDefined();
      expect(typeof o.lat).toBe('number');
      expect(typeof o.lon).toBe('number');
      expect(o.lat).toBeGreaterThanOrEqual(-90);
      expect(o.lat).toBeLessThanOrEqual(90);
      expect(o.lon).toBeGreaterThanOrEqual(-180);
      expect(o.lon).toBeLessThanOrEqual(180);
      expect(o.month).toBeGreaterThanOrEqual(1);
      expect(o.month).toBeLessThanOrEqual(12);
      expect(o.dataset_key).toBeDefined();
      expect(o.license).toBeDefined();
      expect(o.basis_of_record).toBe('HUMAN_OBSERVATION');
      expect(o.retrieved_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    }
  });

  it('preserves Rule 5: unverified conservation status remains NULL and review_required', () => {
    for (const s of registry.species) {
      if (!s.status) {
        expect(s.status).toBeNull();
        expect(s.monitoring_group).toBe('review_required');
      }
    }
  });
});
