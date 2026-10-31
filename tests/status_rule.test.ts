import { describe, it, expect } from 'vitest';
import { SpeciesRecord } from '../scripts/ingest/types.js';

describe('Conservation Status Rule 5', () => {
  it('stores status = NULL and monitoring_group = review_required when unverified', () => {
    const unverifiedSpecies: SpeciesRecord = {
      species_id: 'ciconia_ciconia',
      gbif_taxon_key: 2481912,
      scientific_name: 'Ciconia ciconia',
      common_name: 'White Stork',
      family: 'Ciconiidae',
      monitoring_group: 'review_required',
      last_checked_at: new Date().toISOString(),
      status: null, // strictly NULL
      traits: {
        hand_wing_index: 38.5,
        migration_category: 3,
        source: 'AVONET (Tobias et al. 2022)',
        source_version: 'BirdLife 2022',
        matched: true,
      },
      stats: {
        requested_records: 504,
        received_records: 480,
        short: true,
      },
    };

    expect(unverifiedSpecies.status).toBeNull();
    expect(unverifiedSpecies.monitoring_group).toBe('review_required');
    expect(unverifiedSpecies.monitoring_group).not.toBe('common_widespread');
  });

  it('only assigns threatened or common groups when backed by verified source metadata', () => {
    const verifiedThreatened: SpeciesRecord = {
      species_id: 'leucogeranus_leucogeranus',
      gbif_taxon_key: 8092892,
      scientific_name: 'Leucogeranus leucogeranus',
      common_name: 'Siberian Crane',
      family: 'Gruidae',
      monitoring_group: 'threatened_priority',
      last_checked_at: new Date().toISOString(),
      status: {
        category: 'CR',
        assessment_year: 2021,
        source: 'IUCN Red List of Threatened Species',
        source_url: 'https://www.iucnredlist.org/species/22692049/180030167',
        retrieved_at: new Date().toISOString(),
      },
      traits: {
        hand_wing_index: 35.2,
        migration_category: 3,
        source: 'AVONET (Tobias et al. 2022)',
        source_version: 'BirdLife 2022',
        matched: true,
      },
      stats: {
        requested_records: 504,
        received_records: 220,
        short: true,
      },
    };

    expect(verifiedThreatened.status?.source).toBe('IUCN Red List of Threatened Species');
    expect(verifiedThreatened.status?.category).toBe('CR');
    expect(verifiedThreatened.monitoring_group).toBe('threatened_priority');
  });
});
