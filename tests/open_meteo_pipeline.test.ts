/**
 * tests/open_meteo_pipeline.test.ts
 * 
 * Comprehensive Test Suite for Prompt 3:
 * 1. Batching (Open-Meteo coordinates & models comma-separated batching)
 * 2. Fallback Trigger (Offline / failure fallback, honest missingness, epistemic labeling)
 * 3. Weight Calculator (Verified formula: locations * (days/14) * (variables/10), budget limit)
 * 4. Resume & Disk Caching (Checkpointing, skipping cached cells, idempotent continuation)
 * 5. GET /api/climate-grid Endpoint (Models, resolution, period, retrieved_at, epistemic labels)
 */

import climateGridFile from '../data/generated/climate_grid.json';
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import worker from '../worker/src/index.js';
import {
  OPEN_METEO_LIMITS,
  calculateCallWeight,
  calculateEra5BaselineWeight,
  calculateCmip6ProjectionWeight,
  calculateGridCellTotalWeight,
  maxCellsWithinBudget,
} from '../scripts/precompute/weight.js';
import {
  snapTo5DegreeGrid,
  extractSpeciesRangeCells,
  extractLatestWeatherTargets,
} from '../scripts/precompute/grid-utils.js';

describe('Open-Meteo Pipeline: Batching & Spatial Targets', () => {
  it('correctly snaps coordinates to coarse 5-degree grid centers within bounds', () => {
    // Test equator & northern hemisphere
    const cell1 = snapTo5DegreeGrid(19.72, 85.32);
    expect(cell1.lat).toBe(20);
    expect(cell1.lon).toBe(85);
    expect(cell1.key).toBe('20.0_85.0');

    // Test southern hemisphere & negative longitudes
    const cell2 = snapTo5DegreeGrid(-24.8, -48.2);
    expect(cell2.lat).toBe(-25);
    expect(cell2.lon).toBe(-50);
    expect(cell2.key).toBe('-25.0_-50.0');

    // Test polar clipping bounds [-85, 85] and dateline wrapping
    const northPole = snapTo5DegreeGrid(89.5, 10.0);
    expect(northPole.lat).toBe(85);

    const southPole = snapTo5DegreeGrid(-89.5, 10.0);
    expect(southPole.lat).toBe(-85);
  });

  it('batches latest-season positions for tracked individuals into distinct target coordinates', () => {
    const fakeTracks = [
      { geometry: { coordinates: [[10.0, 45.0], [12.0, 46.0], [14.0, 48.0]] }, properties: { times: [100, 200, 300] } },
      { geometry: { coordinates: [[5.0, 50.0], [6.0, 51.0], [7.0, 52.0]] }, properties: { times: [100, 200, 300] } },
    ];

    const targets = extractLatestWeatherTargets('ciconia_ciconia', [], fakeTracks);
    expect(targets.length).toBe(2);
    expect(targets[0].source).toBe('tracked_individual_latest');
    expect(targets[0].lat).toBe(48.0);
    expect(targets[0].lon).toBe(14.0);
    expect(targets[1].source).toBe('tracked_individual_latest');
    expect(targets[1].lat).toBe(52.0);
    expect(targets[1].lon).toBe(7.0);
  });

  it('batches latest-season cluster centers for occurrence-only species', () => {
    const fakeOccurrences = [
      { lat: 20.1, lon: 85.1, month: 12 },
      { lat: 20.3, lon: 85.2, month: 12 },
      { lat: 10.0, lon: 75.0, month: 6 }, // earlier month
    ];

    const targets = extractLatestWeatherTargets('falco_amurensis', fakeOccurrences);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets[0].source).toBe('occurrence_cluster_center');
    expect(targets[0].lat).toBeCloseTo(20.2, 1);
    expect(targets[0].lon).toBeCloseTo(85.15, 1);
  });

  it('ensures data/generated/weather_targets.json contains valid coordinates for all canonical species', () => {
    const targetsPath = path.resolve('data', 'generated', 'weather_targets.json');
    expect(fs.existsSync(targetsPath)).toBe(true);

    const targetsData = JSON.parse(fs.readFileSync(targetsPath, 'utf-8'));
    const speciesKeys = Object.keys(targetsData);
    expect(speciesKeys.length).toBeGreaterThanOrEqual(13);

    for (const key of speciesKeys) {
      const sp = targetsData[key];
      expect(sp.species_id).toBe(key);
      expect(sp.targets).toBeDefined();
      expect(sp.targets.length).toBeGreaterThan(0);

      for (const t of sp.targets) {
        expect(t.lat).toBeGreaterThanOrEqual(-90);
        expect(t.lat).toBeLessThanOrEqual(90);
        expect(t.lon).toBeGreaterThanOrEqual(-180);
        expect(t.lon).toBeLessThanOrEqual(180);
        expect(['tracked_individual_latest', 'occurrence_cluster_center']).toContain(t.source);
      }
    }
  });
});

describe('Open-Meteo API Call Weight Calculator', () => {
  it('accurately computes weight according to locations * (days/14) * (variables/10)', () => {
    // 1 location, 14 days, 10 variables = exactly 1.0
    expect(calculateCallWeight({ locations: 1, days: 14, variables: 10 })).toBe(1.0);

    // 5 locations, 28 days, 10 variables = 5 * 2 * 1 = 10.0
    expect(calculateCallWeight({ locations: 5, days: 28, variables: 10 })).toBe(10.0);

    // 10 locations, 7 days, 5 variables = 10 * 0.5 * 0.5 = 2.5
    expect(calculateCallWeight({ locations: 10, days: 7, variables: 5 })).toBe(2.5);

    // Zero or negative locations/days/variables safely return 0
    expect(calculateCallWeight({ locations: 0, days: 14, variables: 10 })).toBe(0);
    expect(calculateCallWeight({ locations: 1, days: -10, variables: 10 })).toBe(0);
  });

  it('accurately calculates ERA5 baseline call weight for 2005-2024 (7,305 days, 1 variable)', () => {
    // 7,305 / 14 * 0.1 = 52.1786
    const era5Weight = calculateEra5BaselineWeight(1, 1);
    expect(era5Weight).toBeCloseTo(52.1786, 3);

    // For 10 locations
    expect(calculateEra5BaselineWeight(10, 1)).toBeCloseTo(521.7857, 3);
  });

  it('accurately calculates CMIP6 projection call weight for 2025-2050 (9,496 days, 2 models)', () => {
    // 9,496 / 14 * 0.2 = 135.6571
    const cmip6Weight = calculateCmip6ProjectionWeight(1, 2);
    expect(cmip6Weight).toBeCloseTo(135.6571, 3);

    // For 10 locations
    expect(calculateCmip6ProjectionWeight(10, 2)).toBeCloseTo(1356.5714, 3);
  });

  it('computes combined cell weight and strictly enforces the daily 3,000 weight budget', () => {
    const combinedPerCell = calculateGridCellTotalWeight(1, 2);
    expect(combinedPerCell).toBeCloseTo(187.8357, 3);

    // Max cells within 3000 budget: Math.floor(3000 / 187.8357) = 15 cells
    const maxCells = maxCellsWithinBudget(OPEN_METEO_LIMITS.PRECOMPUTE_DAILY_BUDGET);
    expect(maxCells).toBe(15);

    const totalWeightForBatch = maxCells * combinedPerCell;
    expect(totalWeightForBatch).toBeLessThanOrEqual(OPEN_METEO_LIMITS.PRECOMPUTE_DAILY_BUDGET);
  });
});

describe('Disk Caching & Resume Capability', () => {
  it('persists climate cells in data/generated/climate_cache/ and avoids duplicate fetches', () => {
    const cacheDir = path.resolve('data', 'generated', 'climate_cache');
    expect(fs.existsSync(cacheDir)).toBe(true);

    const files = fs.readdirSync(cacheDir);
    const era5Files = files.filter((f) => f.startsWith('era5_'));
    const cmip6Files = files.filter((f) => f.startsWith('cmip6_'));

    expect(era5Files.length).toBeGreaterThan(0);
    expect(cmip6Files.length).toBeGreaterThan(0);

    // Spot check one ERA5 cache file for verified daily structure
    const sampleEra5 = JSON.parse(fs.readFileSync(path.join(cacheDir, era5Files[0]), 'utf-8'));
    expect(sampleEra5.daily).toBeDefined();
    expect(sampleEra5.daily.time).toBeDefined();
    expect(sampleEra5.daily.time[0]).toBe('2005-01-01');
    expect(sampleEra5.daily.temperature_2m_mean).toBeDefined();

    // Spot check one CMIP6 cache file for verified 2-model structure
    const sampleCmip6 = JSON.parse(fs.readFileSync(path.join(cacheDir, cmip6Files[0]), 'utf-8'));
    expect(sampleCmip6.daily).toBeDefined();
    expect(sampleCmip6.daily.time).toBeDefined();
    expect(sampleCmip6.daily.time[0]).toBe('2025-01-01');
    expect(sampleCmip6.daily.temperature_2m_mean_EC_Earth3P_HR).toBeDefined();
    expect(sampleCmip6.daily.temperature_2m_mean_MPI_ESM1_2_XR).toBeDefined();
  });

  it('saves checkpoint status with remaining cell counts and resume metadata', () => {
    const checkpointPath = path.resolve('data', 'generated', 'climate_cache', 'checkpoint.json');
    expect(fs.existsSync(checkpointPath)).toBe(true);

    const checkpoint = JSON.parse(fs.readFileSync(checkpointPath, 'utf-8'));
    expect(checkpoint.timestamp).toBeDefined();
    expect(checkpoint.total_unique_cells).toBeGreaterThan(0);
    expect(checkpoint.cached_cells_count).toBeGreaterThan(0);
    expect(checkpoint.remaining_cells_count).toBeGreaterThanOrEqual(0);
    expect(typeof checkpoint.rate_limited).toBe('boolean');
  });
});

describe('Worker Endpoints: /api/weather & Fallback Trigger', () => {
  const mockEnv: any = {
    DB: {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: [] }),
          first: async () => null,
          run: async () => ({ success: true }),
        }),
      }),
    },
    ENVIRONMENT: 'test',
  };

  const mockCtx: any = {
    waitUntil: () => {},
  };

  it('triggers persistent fallback with epistemic label "forecast" and source "fallback" when offline', async () => {
    const req = new Request('http://localhost/api/weather?species=falco_amurensis&offline=true');
    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.success).toBe(true);
    expect(data.species_id).toBe('falco_amurensis');
    expect(data.label).toBe('forecast'); // Universal Epistemic Label
    expect(data.source).toBe('fallback');
    expect(data.weather).toBeDefined();
    expect(data.retrieved_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('strictly returns honest missingness ("No cached data") for unknown species under fallback, never invented numbers', async () => {
    const req = new Request('http://localhost/api/weather?species=fictional_unobserved_bird&offline=true');
    const res = await worker.fetch(req, mockEnv, mockCtx);

    const data: any = await res.json();
    expect(data.success).toBe(false);
    expect(data.source).toBe('fallback');
    expect(data.label).toBe('forecast');
    expect(data.message).toBe('No cached data');
    expect(data.weather).toBeUndefined();
  });
});

describe('Worker Endpoints: /api/climate-grid', () => {
  const mockEnv: any = {
    DB: {
      prepare: () => ({
        bind: () => ({
          all: async () => ({ results: [] }),
          first: async () => null, // trigger fallback to static dataset
          run: async () => ({ success: true }),
        }),
      }),
    },
    ENVIRONMENT: 'test',
  };

  const mockCtx: any = {
    waitUntil: () => {},
  };

  it('serves precomputed climate grid with models, resolution, period, and universal epistemic labels', async () => {
    const req = new Request('http://localhost/api/climate-grid?species=falco_amurensis&season=breeding');
    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.success).toBe(true);
    expect(data.species_id).toBe('falco_amurensis');
    expect(data.season).toBe('breeding');
    expect(data.resolution).toBe('5_degrees');
    expect(data.period.baseline).toBe('2005-01-01 to 2024-12-31');
    expect(data.period.projection).toBe('2025-01-01 to 2050-12-31');
    expect(data.models).toEqual(['EC_Earth3P_HR', 'MPI_ESM1_2_XR']);
    // Labels come from the grid file itself: 'simulated' while it holds demo data.
    expect(data.labels).toEqual(climateGridFile.labels);
    expect(['observed', 'simulated']).toContain(data.labels.baseline);
    expect(data.retrieved_at).toBeDefined();
    expect(data.cells.length).toBeGreaterThan(0);

    const firstCell = data.cells[0];
    expect(firstCell.lat).toBeDefined();
    expect(firstCell.lon).toBeDefined();
    expect(typeof firstCell.era5_mean_temp).toBe('number');
    expect(typeof firstCell.cmip6_ensemble_mean_temp).toBe('number');
    expect(typeof firstCell.temp_delta).toBe('number');
  });

  it('returns 404 with Insufficient evidence when requesting climate grid for non-existent species', async () => {
    const req = new Request('http://localhost/api/climate-grid?species=nonexistent_species&season=breeding');
    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(404);

    const data: any = await res.json();
    expect(data.success).toBe(false);
    expect(data.error).toBe('Insufficient evidence');
  });

  it('rejects invalid species IDs with 400 Bad Request', async () => {
    const req = new Request('http://localhost/api/climate-grid?species=bad<script>&season=breeding');
    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(400);

    const data: any = await res.json();
    expect(data.success).toBe(false);
  });
});
