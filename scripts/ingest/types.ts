export interface SeedSpecies {
  scientific_name: string;
}

export interface GBIFMatchResponse {
  usageKey?: number;
  scientificName?: string;
  canonicalName?: string;
  rank?: string;
  status?: string;
  confidence?: number;
  matchType?: string;
  kingdom?: string;
  phylum?: string;
  order?: string;
  family?: string;
  genus?: string;
  species?: string;
  class?: string;
}

export interface GBIFOccurrence {
  key: number | string;
  decimalLatitude: number;
  decimalLongitude: number;
  eventDate?: string;
  month?: number;
  year?: number;
  datasetKey?: string;
  license?: string;
  basisOfRecord?: string;
  countryCode?: string;
  coordinateUncertaintyInMeters?: number;
  occurrenceStatus?: string;
  hasCoordinate?: boolean;
  hasGeospatialIssue?: boolean;
}

export interface StoredOccurrence {
  gbif_id: string;
  species_id: string;
  lat: number;
  lon: number;
  event_date: string | null;
  month: number;
  dataset_key: string | null;
  license: string | null;
  basis_of_record: string | null;
  country_code: string | null;
  coord_uncertainty_m: number | null;
  retrieved_at: string;
}

export interface SpeciesRecord {
  species_id: string;
  gbif_taxon_key: number;
  scientific_name: string;
  common_name: string | null;
  family: string | null;
  monitoring_group: 'threatened_priority' | 'common_widespread' | 'review_required';
  last_checked_at: string;
  status: {
    category: string | null;
    assessment_year: number | null;
    source: string | null;
    source_url: string | null;
    retrieved_at: string | null;
  } | null;
  traits: {
    hand_wing_index: number | null;
    migration_category: number | null;
    source: string | null;
    source_version: string | null;
    matched: boolean;
  };
  stats: {
    requested_records: number;
    received_records: number;
    short: boolean;
  };
  evidence_level?: 'tracks' | 'occurrences_only';
  tracked_individuals?: number;
  occurrence_count?: number;
}

export interface DatasetMetadata {
  dataset_key: string;
  title: string;
  citation: string;
  license: string;
}

export interface IngestionRunSummary {
  run_id: string;
  started_at: string;
  finished_at: string;
  species_count: number;
  record_count: number;
  failures: Array<{
    species: string;
    stage: string;
    error: string;
  }>;
}
