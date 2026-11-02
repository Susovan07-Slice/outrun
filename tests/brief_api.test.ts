/**
 * tests/brief_api.test.ts
 * 
 * Tests for executive scientific brief synthesis (GET /api/brief).
 */

import { describe, it, expect } from 'vitest';
import { generateSpeciesBrief } from '../src/analytics/brief.js';

describe('Executive Scientific Brief Synthesis', () => {
  it('synthesizes complete executive brief from computed layers and source metadata only', () => {
    const brief = generateSpeciesBrief({
      species_id: 'pandion_haliaetus',
      scientific_name: 'Pandion haliaetus',
      common_name: 'Osprey',
      family: 'Pandionidae',
      gbif_taxon_key: 2480572,
      evidence_level: 'tracks',
      tracked_individuals: 842,
      occurrence_count: 504,
      status: null, // Unverified token
      traits: {
        hand_wing_index: 54.2,
        migration_category: 3,
        matched: true,
      },
      race: {
        breeding_velocity_km_decade: 135.4,
        non_breeding_velocity_km_decade: 162.1,
        mean_velocity_km_decade: 148.8,
        hwi: 54.2,
        hwi_rank: 6,
        hwi_rank_total: 20,
        verdict: 'Insufficient evidence for a verdict',
      },
      twin: {
        summary: {
          baseline_suitable_cells: 42,
          future_suitable_cells: 38,
          gained_cells: 4,
          lost_cells: 8,
          stable_cells: 34,
          mean_uncertainty: 0.08,
        },
      },
      critical_links: [
        {
          node_id: 'cell_45_15',
          lat: 45,
          lon: 15,
          loss_of_reachable_area_km2: 124500,
          loss_percent: 28.5,
          connected_components_increase: 2,
        },
      ],
      weather: {
        temperature_2m: 18.5,
        wind_speed_10m: 24.0,
        relative_humidity_2m: 65,
        precipitation: 0.0,
      },
    });

    expect(brief.species_id).toBe('pandion_haliaetus');
    expect(brief.common_name).toBe('Osprey');

    // Rule 5 honest NULL verification
    expect(brief.conservation_status.category).toBe('Insufficient evidence');
    expect(brief.conservation_status.provenance_rule).toContain('Rule 5');

    // The Race
    expect(brief.the_race.breeding_velocity).toContain('135.4 km/decade');
    expect(brief.the_race.verdict).toBe('Insufficient evidence for a verdict');

    // The Twin
    expect(brief.the_twin.baseline_suitable_cells).toBe(42);
    expect(brief.the_twin.future_suitable_cells).toBe(38);
    expect(brief.the_twin.limitation).toContain('macro-climatic');

    // The Break
    expect(brief.the_break_and_fix.bottleneck_count).toBe(1);
    expect(brief.the_break_and_fix.top_critical_link?.node_id).toBe('cell_45_15');

    // The Watch
    expect(brief.the_watch.label).toBe('forecast');

    // The Proof
    expect(brief.the_proof.score).toBeDefined();
    expect(brief.the_proof.dimensions.length).toBe(5);
  });
});
