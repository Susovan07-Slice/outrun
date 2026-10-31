/**
 * tests/proof_rubric.test.ts
 * 
 * Tests for The Proof 4-factor rubric-based confidence assessment engine.
 */

import { describe, it, expect } from 'vitest';
import { evaluateProofRubric } from '../src/analytics/proof.js';

describe('The Proof: 4-Factor Confidence Rubric (METHODS.md Section 6)', () => {
  it('awards Grade A (High) for tracked species with robust temporal span and verified traits', () => {
    const trackedRecord = {
      species_id: 'pandion_haliaetus',
      scientific_name: 'Pandion haliaetus',
      common_name: 'Osprey',
      family: 'Pandionidae',
      evidence_level: 'tracks' as const,
      tracked_individuals: 842,
      traits: {
        hand_wing_index: 54.2,
        migration_category: 3,
        matched: true,
      },
      corridorData: {
        twin: {
          summary: {
            mean_uncertainty: 0.08, // <= 0.15 (High agreement)
          },
        },
      },
    };

    const assessment = evaluateProofRubric(trackedRecord);

    expect(assessment.total_score).toBeGreaterThanOrEqual(8);
    expect(assessment.confidence_grade).toBe('Grade A (High)');
    expect(assessment.is_insufficient_evidence).toBe(false);
    expect(assessment.dimensions).toHaveLength(4);
  });

  it('awards Grade B (Moderate) for species with robust occurrences (>=500) but without GPS tracks', () => {
    const occurrenceOnlyRecord = {
      species_id: 'falco_amurensis',
      scientific_name: 'Falco amurensis',
      evidence_level: 'occurrences_only' as const,
      tracked_individuals: 0,
      occurrence_count: 504,
      occurrences: [
        { month: 5 }, { month: 6 }, { month: 7 }, { month: 8 },
      ],
      traits: {
        hand_wing_index: 52.9,
        migration_category: 3,
        matched: true,
      },
      corridorData: {
        twin: {
          summary: {
            mean_uncertainty: 0.22, // 0.15 < spread <= 0.30 (Moderate agreement)
          },
        },
      },
    };

    const assessment = evaluateProofRubric(occurrenceOnlyRecord);

    expect(assessment.total_score).toBeGreaterThanOrEqual(5);
    expect(assessment.total_score).toBeLessThan(8);
    expect(assessment.confidence_grade).toBe('Grade B (Moderate)');
  });

  it('enforces Insufficient Evidence when data records and traits are missing', () => {
    const barrenRecord = {
      species_id: 'unknown_bird',
      scientific_name: 'Unknown bird',
      evidence_level: 'insufficient' as const,
      tracked_individuals: 0,
      occurrence_count: 0,
      occurrences: [],
      traits: {
        hand_wing_index: null,
        migration_category: null,
        matched: false,
      },
    };

    const assessment = evaluateProofRubric(barrenRecord);

    expect(assessment.total_score).toBeLessThan(3);
    expect(assessment.confidence_grade).toBe('Insufficient evidence');
    expect(assessment.is_insufficient_evidence).toBe(true);
  });

  it('includes complete provenance manifest and transparent limitations', () => {
    const assessment = evaluateProofRubric({
      species_id: 'ciconia_ciconia',
      scientific_name: 'Ciconia ciconia',
    });

    expect(assessment.provenance_manifest.primary_sources.length).toBeGreaterThanOrEqual(4);
    expect(assessment.methodological_assumptions.length).toBeGreaterThanOrEqual(3);
    expect(assessment.honest_limitations.length).toBeGreaterThanOrEqual(3);
  });
});
