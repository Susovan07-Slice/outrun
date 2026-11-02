# Outrun — Global Climate-Pressure & Corridor Platform for Migratory Birds

## Project Overview
**Outrun** is a global observatory, climate-displacement simulator, and flyway corridor platform built strictly for migratory birds (class *Aves*). It models how climate velocity shifts breeding and wintering envelopes, tracks multi-individual flight paths across the globe, analyzes corridor bottleneck pinch points, simulates ecological protection interventions, and synthesizes 1-page executive scientific dossiers.

- **Live Production URL:** [https://outrun.susovan9812.workers.dev/](https://outrun.susovan9812.workers.dev/)
- **GitHub Repository:** [https://github.com/Susovan07-Slice/outrun.git](https://github.com/Susovan07-Slice/outrun.git)

---

## The 6 Core Platform Layers

1. **The Race (`src/analytics/race.ts`)**: Evaluates local climate displacement velocity (km/decade, from ERA5 baseline to CMIP6 future) against morphological flight efficiency (Hand-Wing Index / HWI from AVONET). Determines whether aerodynamic dispersal outpaces regional climate velocity.
2. **The Twin (`src/analytics/twin.ts`)**: Models dynamic bioclimatic suitability envelopes ($0.0 - 1.0$) across seasonal ranges. Rendered as a GPU-accelerated continuous heat surface (`HeatmapLayer`) that organically contracts and shifts colors from emerald to amber/crimson via the projection horizon slider.
3. **The Break (`src/analytics/breakFix.ts`)**: Analyzes corridor network connectivity using Graphology. Identifies and ranks candidate critical bottleneck links (e.g. Gibraltar, Bosphorus, Momoge, Delaware Bay) by loss of reachable habitat area.
4. **The Fix (`src/analytics/breakFix.ts`)**: Interactive simulation engine. Clicking "Protect" on a critical link simulates habitat restoration, recalculating graph connectivity metrics and reachable area delta.
5. **The Watch (`src/analytics/watch.ts`)**: Near-real-time atmospheric pipeline using Open-Meteo synoptic data (wind vectors, headwind/tailwind components, precipitation, and thermal stress).
6. **The Proof (`src/analytics/proof.ts` & `src/BriefModal.jsx`)**: 6-dimension empirical rubric (GBIF, AVONET, Open-Meteo, CMIP6, Graphology, IUCN) scoring each species, viewable as a print-to-PDF 1-page executive scientific dossier.

---

## Operating Rules & Non-Negotiables (from `AGENTS.md`)

1. **Class *Aves* Only:** Every tracked and evaluated species must belong to class *Aves*.
2. **Strict Occurrence Schema:** Occurrence records preserve all 10 GBIF provenance fields (`gbifID`, `decimalLatitude`, `decimalLongitude`, `eventDate`, `datasetKey`, `license`, `basisOfRecord`, `countryCode`, `coordinateUncertaintyInMeters`, `retrieved_at`).
3. **Universal Epistemic Labeling:** Every metric and overlay is strictly labeled as one of:
   - `observed` (Empirical telemetry or GBIF observations)
   - `forecast` (Short-term synoptic weather)
   - `projected` (Medium/long-term CMIP6 climate models)
   - `simulated` (Agent-based corridor models / twin)
4. **Honest Missingness:** When empirical evidence is missing, display `"Insufficient evidence"` rather than inventing values.
5. **Conservation Status Provenance:** IUCN statuses (`CR`, `EN`, `VU`, `NT`, `LC`) come strictly from verified assessments with source URLs.

---

## Repository Architecture

```text
├── src/
│   ├── App.jsx               # Root application state & layer orchestration
│   ├── MapView.jsx           # Deck.gl map canvas (TripsLayer, HeatmapLayer, ScatterplotLayer)
│   ├── SpeciesPanel.jsx      # Left/Right inspector sidebar with SpeciesWatch tabs
│   ├── CorridorPanel.jsx     # Tabs: The Race, The Twin, Break & Fix, The Watch, The Proof
│   ├── TimeControl.jsx       # Flight animation playback timeline & speed controller
│   ├── BriefModal.jsx        # 1-page executive scientific dossier & PDF exporter
│   ├── config.js             # 20-species canonical registry & cartographic palette
│   └── analytics/            # Scientific calculation engines (race, twin, breakFix, watch, proof, brief)
├── worker/
│   └── src/index.ts          # Cloudflare Worker API router & static asset server
├── scripts/
│   ├── generate_demo_data.py # Demo sample dataset generator (tracks, envelopes, weather)
│   └── ingest/               # GBIF, AVONET & GPS telemetry ingestion batch jobs
├── public/data/generated/    # Bundled static offline datasets (tracks, occurrences, corridor_analysis)
├── data/generated/           # Master generated datasets & caches
├── tests/                    # Vitest unit & integration test suites
└── wrangler.toml             # Cloudflare Worker & Static Assets configuration
```

---

## Development & Deployment Commands

- **Start Local Frontend Dev Server:**
  ```bash
  npm run dev
  ```
  Runs Vite dev server on `http://localhost:5173` (or `--port 5174`).

- **Production Build:**
  ```bash
  npm run build
  ```
  Runs `tsc -b && vite build`, bundling the frontend into `dist/`.

- **Run Automated Test Suite:**
  ```bash
  npm test
  ```
  Runs Vitest test suite (`tests/*.test.ts`).

- **Regenerate Demo Datasets:**
  ```bash
  python scripts/generate_demo_data.py
  ```
  Rebuilds all 20 species' flight tracks, organic bioclimatic envelopes, and corridor graphs into both `data/generated/` and `public/data/generated/`.

- **Deploy to Cloudflare:**
  ```bash
  git push origin main
  ```
  Cloudflare automatically builds and deploys to `https://outrun.susovan9812.workers.dev/`.
