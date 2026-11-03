/**
 * tests/race_twin_break.test.ts
 * 
 * Comprehensive Test Suite for Prompt 4:
 * 1. The Race: Climate velocity on a synthetic gradient with an analytical known answer,
 *    latitude-corrected centered differences, AVONET HWI ranking, and honest verdict.
 * 2. The Twin: 5th-95th percentile climate envelope derivation, baseline vs future suitability,
 *    model spread uncertainty, and epistemic labeling ("simulated").
 * 3. The Break: Graphology network construction, bottleneck sensitivity analysis,
 *    and candidate critical link ranking.
 * 4. The Fix: POST /api/simulate endpoint execution, metric delta verification,
 *    and non-negotiable rule enforcement (never claim animals saved).
 */

import { describe, it, expect } from 'vitest';
import worker from '../worker/src/index.js';
import {
  computeSpatialGradient,
  computeCellVelocity,
  computeSyntheticGradientVelocity,
  evaluateSpeciesRace,
} from '../src/analytics/race.js';
import {
  calculatePercentile,
  deriveClimateEnvelope,
  scoreSuitability,
  evaluateTwinSuitability,
} from '../src/analytics/twin.js';
import {
  haversineDistanceKm,
  calculateCellAreaKm2,
  buildCorridorGraph,
  computeConnectivityMetrics,
  rankCriticalLinks,
  simulateNodeProtection,
  CorridorNode,
} from '../src/analytics/breakFix.js';

describe('The Race: Climate Velocity on Synthetic & Real Gradients', () => {
  it('accurately calculates velocity on a synthetic gradient with a known analytical answer', () => {
    // Known analytical case:
    // Spatial gradient: 0.01 degC/km
    // Temporal trend: 0.20 degC/decade
    // Theoretical Velocity = Trend / Gradient = 0.20 / 0.01 = 20.0 km/decade
    const syntheticGradient = 0.01;
    const syntheticTrend = 0.2;
    const velocity = computeSyntheticGradientVelocity(syntheticGradient, syntheticTrend);

    expect(velocity).toBe(20.0);
  });

  it('correctly calculates centered-difference spatial gradient with latitude correction', () => {
    // 5-degree step centered difference at equator (lat = 0)
    // dy = 2 * 5 * 111.132 = 1111.32 km
    // dx = 2 * 5 * 111.132 * cos(0) = 1111.32 km
    const tempNorth = 25.0;
    const tempSouth = 15.0; // deltaY = 10 degC
    const tempEast = 20.0;
    const tempWest = 20.0; // deltaX = 0 degC

    const { gradY, gradX, magnitude } = computeSpatialGradient(
      0.0,
      0.0,
      tempNorth,
      tempSouth,
      tempEast,
      tempWest,
      5.0
    );

    const expectedGradY = 10.0 / (2 * 5 * 111.132);
    expect(gradY).toBeCloseTo(expectedGradY, 4);
    expect(gradX).toBe(0.0);
    expect(magnitude).toBeCloseTo(expectedGradY, 4);

    // Test velocity with 0.5 degC/decade trend
    const vel = computeCellVelocity(0.5, magnitude);
    const expectedVel = 0.5 / expectedGradY;
    expect(vel).toBeCloseTo(expectedVel, 1);
  });

  it('ranks species by AVONET HWI and strictly issues "Insufficient evidence for a verdict"', () => {
    const mockObservatoryTraits = [
      { species_id: 'sterna_paradisaea', hand_wing_index: 75.4 },
      { species_id: 'ciconia_ciconia', hand_wing_index: 38.2 },
      { species_id: 'falco_amurensis', hand_wing_index: 52.1 },
    ];

    const race = evaluateSpeciesRace(
      'falco_amurensis',
      'Falco amurensis',
      [{ lat: -25, lon: 30, baseline_temp: 18.0, projected_ensemble_temp: 20.0, temp_delta: 2.0 }],
      [{ lat: -25, lon: 25, baseline_temp: 20.0, projected_ensemble_temp: 21.5, temp_delta: 1.5 }],
      mockObservatoryTraits
    );

    expect(race.species_id).toBe('falco_amurensis');
    expect(race.hwi).toBe(52.1);
    expect(race.hwi_rank).toBe(2); // Ranked 2nd among the 3 species
    expect(race.hwi_rank_total).toBe(3);

    // Rule: Strict honest missingness (No Keeping up / Left behind verdict)
    expect(race.verdict).toBe('Insufficient evidence for a verdict');
    expect(race.label).toBe('projected');
    expect(race.verdict_reason).toContain('dispersal proxy');
  });
});

describe('The Twin: Climate-Envelope Suitability & Uncertainty', () => {
  it('correctly calculates empirical 5th to 95th percentiles of baseline climate', () => {
    // Array of 100 values from 1 to 100
    const values = Array.from({ length: 100 }, (_, i) => i + 1);

    expect(calculatePercentile(values, 5)).toBeCloseTo(5.95, 1);
    expect(calculatePercentile(values, 50)).toBe(50.5);
    expect(calculatePercentile(values, 95)).toBeCloseTo(95.05, 1);

    const envelope = deriveClimateEnvelope('test_bird', 'breeding', values);
    expect(envelope.p05).toBeCloseTo(5.95, 1);
    expect(envelope.p95).toBeCloseTo(95.05, 1);
    expect(envelope.sample_size).toBe(100);
  });

  it('scores optimal suitability (1.0) within core niche and decays outside', () => {
    const envelope = {
      species_id: 'test_bird',
      season: 'breeding' as const,
      p05: 15.0,
      p10: 18.0,
      p50: 22.0,
      p90: 26.0,
      p95: 29.0,
      sample_size: 50,
    };

    // Within optimal core [18, 26]
    expect(scoreSuitability(22.0, envelope)).toBe(1.0);
    expect(scoreSuitability(18.0, envelope)).toBe(1.0);
    expect(scoreSuitability(26.0, envelope)).toBe(1.0);

    // Marginal transitions
    const lowerMarginal = scoreSuitability(16.5, envelope);
    expect(lowerMarginal).toBeGreaterThan(0.5);
    expect(lowerMarginal).toBeLessThan(1.0);

    // Sub-marginal outside envelope [15, 29]
    const freezing = scoreSuitability(10.0, envelope);
    expect(freezing).toBeLessThan(0.5);

    const extremeHeat = scoreSuitability(35.0, envelope);
    expect(extremeHeat).toBeLessThan(0.5);
  });

  it('quantifies model spread as uncertainty and applies epistemic label "simulated"', () => {
    const envelope = {
      species_id: 'ciconia_ciconia',
      season: 'breeding' as const,
      p05: 15.0,
      p10: 18.0,
      p50: 22.0,
      p90: 26.0,
      p95: 29.0,
      sample_size: 40,
    };

    const gridCells = [
      {
        lat: 50.0,
        lon: 15.0,
        era5_breeding_mean_temp: 21.0, // Optimal baseline
        cmip6_ec_earth3p_hr_mean_temp: 23.0, // Optimal in model 1
        cmip6_mpi_esm1_2_xr_mean_temp: 28.0, // Marginal in model 2
      },
    ];

    const result = evaluateTwinSuitability('ciconia_ciconia', 'breeding', envelope, gridCells);
    expect(result.label).toBe('simulated');
    expect(result.models).toEqual(['EC_Earth3P_HR', 'MPI_ESM1_2_XR']);
    expect(result.cells.length).toBe(1);

    const cell = result.cells[0];
    expect(cell.baseline_suitability).toBe(1.0);
    expect(cell.future_suitability_m1).toBe(1.0);
    expect(cell.future_suitability_m2).toBeLessThan(1.0);
    expect(cell.uncertainty_spread).toBeGreaterThan(0);
    expect(cell.label).toBe('simulated');
    expect(result.disclaimer).toContain('Climate-envelope suitability models atmospheric niche compatibility only');
  });
});

describe('The Break: Graphology Corridor & Bottleneck Ranking', () => {
  it('calculates latitude-corrected area and Haversine distance accurately', () => {
    // Equator cell area: ~5 deg * 111.132 km = ~555.66 km; 555.66 * 555.66 ≈ 308,758 km2
    const equatorArea = calculateCellAreaKm2(0.0, 5.0);
    expect(equatorArea).toBeGreaterThan(300000);
    expect(equatorArea).toBeLessThan(320000);

    // 60 degrees North: cos(60) = 0.5, so area should be approximately half of equator
    const polarArea = calculateCellAreaKm2(60.0, 5.0);
    expect(polarArea).toBeCloseTo(equatorArea / 2, -3);

    // Distance between London (51.5, -0.1) and Paris (48.85, 2.35) ≈ 344 km
    const dist = haversineDistanceKm(51.5, -0.1, 48.85, 2.35);
    expect(dist).toBeGreaterThan(330);
    expect(dist).toBeLessThan(360);
  });

  it('ranks bottleneck bridge node as #1 critical link in a known synthetic topology', () => {
    // Synthetic topology:
    // Cluster A: Node 1 (0, 0), Node 2 (0, 4) - distance ~444 km (connected)
    // Bridge: Node 3 (0, 9) - distance to Node 2 is ~555 km (connected)
    // Cluster B: Node 4 (0, 14), Node 5 (0, 18) - distance ~444 km, distance to Node 3 is ~555 km
    // Max flight step: 600 km.
    // Node 3 is the ONLY bridge connecting Cluster A to Cluster B. Removing Node 3 splits network into 2 components!
    const syntheticNodes: CorridorNode[] = [
      { id: 'node_1', lat: 0, lon: 0, area_km2: 300000, suitability: 1.0, uncertainty: 0.1 },
      { id: 'node_2', lat: 0, lon: 4, area_km2: 300000, suitability: 1.0, uncertainty: 0.1 },
      { id: 'bridge_node_3', lat: 0, lon: 9, area_km2: 300000, suitability: 1.0, uncertainty: 0.1 },
      { id: 'node_4', lat: 0, lon: 14, area_km2: 300000, suitability: 1.0, uncertainty: 0.1 },
      { id: 'node_5', lat: 0, lon: 18, area_km2: 300000, suitability: 1.0, uncertainty: 0.1 },
    ];

    const graph = buildCorridorGraph(syntheticNodes, 600);
    expect(graph.order).toBe(5);
    const initialMetrics = computeConnectivityMetrics(graph);
    expect(initialMetrics.connected_components).toBe(1); // 1 single connected corridor

    const rankings = rankCriticalLinks(syntheticNodes, 600);
    expect(rankings.length).toBe(5);

    // Bridge node 3 MUST be ranked #1 candidate critical link
    expect(rankings[0].node_id).toBe('bridge_node_3');
    expect(rankings[0].rank).toBe(1);
    expect(rankings[0].connected_components_increase).toBe(1); // Splits into 2 components
    expect(rankings[0].loss_of_reachable_area_km2).toBeGreaterThan(600000);
  });
});

describe('The Fix & Worker API Endpoints: /api/corridor & POST /api/simulate', () => {
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

  it('serves corridor analysis via GET /api/corridor with Race, Twin, and Break results', async () => {
    const req = new Request('http://localhost/api/corridor?species=ciconia_ciconia&season=breeding');
    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);

    const data: any = await res.json();
    expect(data.success).toBe(true);
    expect(data.species_id).toBe('ciconia_ciconia');
    expect(data.race).toBeDefined();
    expect(data.race.verdict).toBe('Insufficient evidence for a verdict');
    expect(data.twin).toBeDefined();
    expect(data.labels.race).toBe('simulated');
    expect(data.labels.twin).toBe('simulated');
    expect(data.labels.critical_links).toBe('simulated');
  });

  it('executes simulation via POST /api/simulate, returns consistent diff, and never claims animals saved', async () => {
    const req = new Request('http://localhost/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        species: 'falco_amurensis',
        season: 'non_breeding',
        protected_node_id: 'cell_-25_30',
        action: 'protect',
      }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(200);

    const sim: any = await res.json();
    expect(sim.success).toBe(true);
    expect(sim.species_id).toBe('falco_amurensis');
    expect(sim.season).toBe('non_breeding');
    expect(sim.label).toBe('simulated');
    expect(sim.baseline).toBeDefined();
    expect(sim.result).toBeDefined();
    expect(sim.difference).toBeDefined();

    // Verify non-negotiable rule: assumptions transparently state no claims of animals saved
    expect(sim.assumptions).toBeDefined();
    const joinedAssumptions = sim.assumptions.join(' ');
    expect(joinedAssumptions.toLowerCase()).toContain('not');
    expect(joinedAssumptions.toLowerCase()).toContain('claim');
  });

  it('rejects POST /api/simulate with invalid species with 400 Bad Request', async () => {
    const req = new Request('http://localhost/api/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        species: 'illegal;species--name',
      }),
    });

    const res = await worker.fetch(req, mockEnv, mockCtx);
    expect(res.status).toBe(400);
  });
});
