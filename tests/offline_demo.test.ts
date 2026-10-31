/**
 * tests/offline_demo.test.ts
 * 
 * Verifies demo readiness and 100% offline fallback operation across all Outrun layers.
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { generateSpeciesBrief } from '../src/analytics/brief.js';

describe('Demo Readiness: Offline Fallbacks & Zero External Network Dependency', () => {
  it('ensures static precomputed weather snapshots are bundled and valid', () => {
    const filePath = path.resolve(process.cwd(), 'data/generated/weather_snapshots.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);

    for (const snap of data) {
      expect(snap.species_id).toBeDefined();
      expect(snap.weather).toBeDefined();
      expect(snap.weather.temperature_2m).toBeTypeOf('number');
      expect(snap.retrieved_at).toBeDefined();
    }
  });

  it('ensures static precomputed climate grid dataset is bundled and valid', () => {
    const filePath = path.resolve(process.cwd(), 'data/generated/climate_grid.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(data.species).toBeDefined();
    expect(Object.keys(data.species).length).toBeGreaterThan(0);

    // Verify first species has breeding cells
    const firstSpecies = Object.values(data.species)[0] as any;
    expect(firstSpecies.seasons.breeding.cells.length).toBeGreaterThan(0);
    expect(firstSpecies.seasons.breeding.cells[0].era5_breeding_mean_temp).toBeTypeOf('number');
  });

  it('ensures static precomputed corridor analysis is bundled and valid', () => {
    const filePath = path.resolve(process.cwd(), 'data/generated/corridor_analysis.json');
    expect(fs.existsSync(filePath)).toBe(true);

    const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    expect(data.species).toBeDefined();

    const speciesKeys = Object.keys(data.species);
    expect(speciesKeys.length).toBeGreaterThanOrEqual(13);

    for (const k of speciesKeys) {
      const sp = data.species[k];
      expect(sp.race).toBeDefined();
      expect(sp.race.verdict).toBe('Insufficient evidence for a verdict');
      expect(sp.twin).toBeDefined();
    }
  });

  it('ensures executive brief can synthesize entirely from offline assets', () => {
    const registryPath = path.resolve(process.cwd(), 'data/generated/registry.json');
    const corridorPath = path.resolve(process.cwd(), 'data/generated/corridor_analysis.json');
    const weatherPath = path.resolve(process.cwd(), 'data/generated/weather_snapshots.json');

    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
    const corridor = JSON.parse(fs.readFileSync(corridorPath, 'utf-8'));
    const weatherSnaps = JSON.parse(fs.readFileSync(weatherPath, 'utf-8'));

    const testSpecies = registry.species[0];
    const spCorridor = corridor.species[testSpecies.species_id];
    const spWeather = weatherSnaps.find((w: any) => w.species_id === testSpecies.species_id);

    const brief = generateSpeciesBrief({
      species_id: testSpecies.species_id,
      scientific_name: testSpecies.scientific_name,
      common_name: testSpecies.common_name,
      family: testSpecies.family,
      gbif_taxon_key: testSpecies.gbif_taxon_key,
      evidence_level: testSpecies.evidence_level,
      tracked_individuals: testSpecies.tracked_individuals,
      occurrence_count: testSpecies.occurrence_count,
      traits: testSpecies.traits,
      race: spCorridor?.race,
      twin: spCorridor?.twin?.breeding,
      critical_links: spCorridor?.break?.breeding_critical_links || [],
      weather: spWeather?.weather,
    });

    expect(brief.species_id).toBe(testSpecies.species_id);
    expect(brief.the_proof.confidence_grade).toBeDefined();
    expect(brief.the_watch.label).toBe('forecast');
  });

  it('verifies DEMO.md contains the 3-minute script and all honest limitations', () => {
    const demoPath = path.resolve(process.cwd(), 'DEMO.md');
    expect(fs.existsSync(demoPath)).toBe(true);

    const demoContent = fs.readFileSync(demoPath, 'utf-8');
    expect(demoContent).toContain('Three-Minute Live Demo Script');
    expect(demoContent).toContain('Hook (20 seconds)');
    expect(demoContent).toContain('World View (30 seconds)');
    expect(demoContent).toContain('The Race (30 seconds)');
    expect(demoContent).toContain('The Twin & The Break (40 seconds)');
    expect(demoContent).toContain('The Fix & Executive Brief (30 seconds)');
    expect(demoContent).toContain('Honest Limitations');
    expect(demoContent).toContain('Insufficient evidence for a verdict');
  });
});
