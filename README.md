# OUTRUN

**Global Climate-Pressure and Corridor Platform for MIGRATORY BIRDS ONLY (class Aves)**

> "Others show where birds are. Outrun shows how fast their climate is moving, where their seasonal habitat is shifting, and which habitat link to protect first."

Built with:
- **Frontend**: Vite + React 18 + TypeScript + MapLibre GL JS + Deck.gl TripsLayer
- **Edge Backend**: Cloudflare Worker (TypeScript, Wrangler) with Workers Cache API
- **Database**: Cloudflare D1 (Local SQLite Miniflare database)
- **Data Pipeline**: Node 20 / TypeScript ingestion of real GBIF occurrences & AVONET morphological traits
- **Atmospheric Data**: Open-Meteo live forecast & historical API

---

## Non-Negotiable Rules & Epistemic Framework (`AGENTS.md`)

1. **No Data Fabrication**: Never fabricate, hand-type, or synthesize records, statuses, traits or citations. Fail loudly on API errors.
2. **Strict Provenance**: Every occurrence retains `gbifID`, `decimalLatitude`, `decimalLongitude`, `eventDate`, `datasetKey`, `license`, `basisOfRecord`, `countryCode`, `coordinateUncertaintyInMeters`, `retrieved_at`.
3. **Four Universal Epistemic Labels**:
   - `observed`: Empirical physical observation (GBIF Human Observation)
   - `forecast`: Short-term synoptic / weather forecast (Open-Meteo)
   - `projected`: Mid/long-term climate scenario projections (CMIP6)
   - `simulated`: Flyway corridors, connectivity twin, and agent-based model
4. **Honest Missingness**: Missing evidence displays `"Insufficient evidence"`, never an invented or zero-filled value.
5. **Conservation Status Provenance**: Conservation status comes ONLY from a verified authoritative source (e.g. IUCN Red List API with token). Without it, `status = NULL` and `monitoring_group = 'review_required'`. Absence of threat status never implies "common".
6. **Worker Limits**: Heavy ingestion runs locally, never in the Worker.

---

## Quickstart

### 1. Install Dependencies
```bash
npm install
```

### 2. Run Tests
The Vitest test suite covers deduplication, AVONET trait joining, mocked GBIF failure handling, and the conservation status provenance rule:
```bash
npm test
```

### 3. Run Ingestion Pipeline
Ingests stratified seasonal occurrences across 12 months for the canonical observatory species registry, resolves AVONET traits, attributes institutional datasets, and populates local D1:
```bash
npm run ingest
```

### 4. Run Cloudflare Worker (Local D1)
Starts the Worker on `http://127.0.0.1:8787`:
```bash
npm run wrangler:dev
```

### 5. Run Vite Frontend
Starts the full-screen MapLibre interactive UI on `http://localhost:5173`:
```bash
npm run dev
```

---

## API Endpoints (Cloudflare Worker)

- `GET /api/health` — Worker health and service status
- `GET /api/species` — Species registry with monitoring group, AVONET traits, occurrence count, short flag, and data freshness
- `GET /api/species/:id/occurrences` — Deduplicated real GBIF occurrences with coordinate uncertainty, basis of record, and licence
- `GET /api/weather?latitude=:lat&longitude=:lon` — Live Open-Meteo forecast (temperature, humidity, precipitation, wind speed) labeled `forecast`

---

## Base Project & Attribution
- Route visualizer structure adapted from `github.com/bbecquet/bird-tracking` (MIT Licence).
- Full attribution and sampling bias documentation in `SOURCES.md`.
