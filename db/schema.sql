-- Outrun SQLite / Cloudflare D1 Database Schema
-- Phase 1 & 2: Migratory Birds Occurrence, GPS Tracks, Traits & Provenance Registry

CREATE TABLE IF NOT EXISTS species (
    species_id TEXT PRIMARY KEY,
    gbif_taxon_key INTEGER UNIQUE NOT NULL,
    scientific_name TEXT NOT NULL,
    common_name TEXT,
    family TEXT,
    monitoring_group TEXT CHECK (monitoring_group IN ('threatened_priority', 'common_widespread', 'review_required')) DEFAULT 'review_required',
    evidence_level TEXT CHECK (evidence_level IN ('tracks', 'occurrences_only', 'insufficient')) DEFAULT 'occurrences_only',
    last_checked_at TEXT
);

CREATE TABLE IF NOT EXISTS species_status (
    species_id TEXT PRIMARY KEY REFERENCES species(species_id),
    category TEXT,            -- e.g. CR, EN, VU, NT, LC (NULL until verified with token)
    assessment_year INTEGER,  -- NULL until verified
    source TEXT,             -- e.g. 'IUCN Red List'
    source_url TEXT,
    retrieved_at TEXT
);

CREATE TABLE IF NOT EXISTS species_traits (
    species_id TEXT PRIMARY KEY REFERENCES species(species_id),
    hand_wing_index REAL,     -- Dispersal proxy from AVONET
    migration_category INTEGER, -- 1=sedentary, 2=partially migratory, 3=migratory
    source TEXT,
    source_version TEXT,
    matched BOOLEAN DEFAULT 0
);

CREATE TABLE IF NOT EXISTS occurrences (
    gbif_id TEXT PRIMARY KEY,
    species_id TEXT NOT NULL REFERENCES species(species_id),
    lat REAL NOT NULL,
    lon REAL NOT NULL,
    event_date TEXT,
    month INTEGER NOT NULL,
    dataset_key TEXT,
    license TEXT,
    basis_of_record TEXT,
    country_code TEXT,
    coord_uncertainty_m REAL,
    retrieved_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS datasets (
    dataset_key TEXT PRIMARY KEY,
    title TEXT,
    citation TEXT,
    doi TEXT,
    license TEXT
);

CREATE TABLE IF NOT EXISTS gps_tracks (
    track_id TEXT PRIMARY KEY,
    species_id TEXT NOT NULL REFERENCES species(species_id),
    individual_id TEXT,
    point_count INTEGER NOT NULL,
    dataset_key TEXT REFERENCES datasets(dataset_key),
    geojson_path TEXT,
    retrieved_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weather_snapshots (
    species_id TEXT PRIMARY KEY REFERENCES species(species_id),
    weather_json TEXT NOT NULL,
    retrieved_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS weather_targets (
    species_id TEXT PRIMARY KEY REFERENCES species(species_id),
    coordinates_json TEXT NOT NULL,
    source TEXT NOT NULL,
    updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS climate_grid_snapshots (
    species_id TEXT NOT NULL REFERENCES species(species_id),
    season TEXT NOT NULL CHECK (season IN ('breeding', 'non_breeding')),
    resolution TEXT NOT NULL,
    models TEXT NOT NULL,
    grid_json TEXT NOT NULL,
    retrieved_at TEXT NOT NULL,
    PRIMARY KEY (species_id, season)
);

CREATE TABLE IF NOT EXISTS corridor_snapshots (
    species_id TEXT PRIMARY KEY REFERENCES species(species_id),
    analysis_json TEXT NOT NULL,
    retrieved_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingestion_runs (
    run_id TEXT PRIMARY KEY,
    started_at TEXT NOT NULL,
    finished_at TEXT,
    species_count INTEGER DEFAULT 0,
    record_count INTEGER DEFAULT 0,
    failures_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_occurrences_species_month ON occurrences(species_id, month);
CREATE INDEX IF NOT EXISTS idx_occurrences_species ON occurrences(species_id);
CREATE INDEX IF NOT EXISTS idx_species_monitoring_group ON species(monitoring_group);
CREATE INDEX IF NOT EXISTS idx_species_evidence_level ON species(evidence_level);
CREATE INDEX IF NOT EXISTS idx_gps_tracks_species ON gps_tracks(species_id);
