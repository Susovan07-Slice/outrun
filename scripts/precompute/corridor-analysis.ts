/**
 * scripts/precompute/corridor-analysis.ts
 * 
 * Outrun Phase 4 Precomputation Script:
 * Executes The Race, The Twin, and The Break end-to-end for all observatory species.
 * 
 * Generates data/generated/corridor_analysis.json and syncs to local D1.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { evaluateSpeciesRace, SpeciesRaceSummary } from '../../src/analytics/race.js';
import {
  deriveClimateEnvelope,
  evaluateTwinSuitability,
  TwinSeasonResult,
} from '../../src/analytics/twin.js';
import {
  calculateCellAreaKm2,
  rankCriticalLinks,
  CorridorNode,
  CriticalLinkRank,
} from '../../src/analytics/breakFix.js';

interface FullCorridorAnalysis {
  generated_at: string;
  species: Record<
    string,
    {
      species_id: string;
      scientific_name: string;
      race: SpeciesRaceSummary;
      twin: {
        breeding: TwinSeasonResult;
        non_breeding: TwinSeasonResult;
      };
      break: {
        breeding_critical_links: CriticalLinkRank[];
        non_breeding_critical_links: CriticalLinkRank[];
      };
    }
  >;
}

export async function runCorridorAnalysis() {
  console.log('\n===============================================================');
  console.log('=== Outrun: The Race, The Twin & The Break Analysis Pipeline ===');
  console.log('===============================================================\n');

  const registryPath = path.resolve('data', 'generated', 'registry.json');
  const climateGridPath = path.resolve('data', 'generated', 'climate_grid.json');

  if (!fs.existsSync(registryPath) || !fs.existsSync(climateGridPath)) {
    throw new Error('Required datasets not found. Run ingest and climate precompute first.');
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  const climateGrid = JSON.parse(fs.readFileSync(climateGridPath, 'utf-8'));
  const speciesList = registry.species || [];

  console.log(`Processing ${speciesList.length} species for Race, Twin, and Break...`);

  // Extract AVONET HWI traits for all species in the registry
  const allSpeciesTraits = speciesList.map((s: any) => ({
    species_id: s.species_id,
    hand_wing_index: s.traits?.hand_wing_index ?? null,
  }));

  const analysisOutput: FullCorridorAnalysis = {
    generated_at: new Date().toISOString(),
    species: {},
  };

  for (const s of speciesList) {
    const spClimate = climateGrid.species[s.species_id];
    const bCells = spClimate?.seasons?.breeding?.cells || [];
    const nbCells = spClimate?.seasons?.non_breeding?.cells || [];

    // 1. THE RACE: Climate Velocity & HWI comparison
    const raceSummary = evaluateSpeciesRace(
      s.species_id,
      s.scientific_name,
      bCells.map((c: any) => ({
        lat: c.lat,
        lon: c.lon,
        baseline_temp: c.era5_breeding_mean_temp || c.era5_mean_temp,
        projected_ensemble_temp: c.cmip6_breeding_ensemble_temp || c.cmip6_ensemble_mean_temp,
        temp_delta: c.temp_delta,
      })),
      nbCells.map((c: any) => ({
        lat: c.lat,
        lon: c.lon,
        baseline_temp: c.era5_nonbreeding_mean_temp || c.era5_mean_temp,
        projected_ensemble_temp: c.cmip6_nonbreeding_ensemble_temp || c.cmip6_ensemble_mean_temp,
        temp_delta: c.temp_delta,
      })),
      allSpeciesTraits,
      s.common_name
    );

    // 2. THE TWIN: 5th-95th percentile climate envelope & suitability
    const bBaselineTemps = bCells.map((c: any) => c.era5_breeding_mean_temp || c.era5_mean_temp);
    const nbBaselineTemps = nbCells.map((c: any) => c.era5_nonbreeding_mean_temp || c.era5_mean_temp);

    const bEnvelope = deriveClimateEnvelope(s.species_id, 'breeding', bBaselineTemps);
    const nbEnvelope = deriveClimateEnvelope(s.species_id, 'non_breeding', nbBaselineTemps);

    const bTwin = evaluateTwinSuitability(s.species_id, 'breeding', bEnvelope, bCells);
    const nbTwin = evaluateTwinSuitability(s.species_id, 'non_breeding', nbEnvelope, nbCells);

    // 3. THE BREAK: Graphology network & critical links ranking
    const bNodes: CorridorNode[] = bTwin.cells
      .filter((c) => c.is_suitable_future)
      .map((c) => ({
        id: `cell_${c.lat}_${c.lon}`,
        lat: c.lat,
        lon: c.lon,
        area_km2: calculateCellAreaKm2(c.lat, 5.0),
        suitability: c.future_ensemble_suitability,
        uncertainty: c.uncertainty_spread,
      }));

    const nbNodes: CorridorNode[] = nbTwin.cells
      .filter((c) => c.is_suitable_future)
      .map((c) => ({
        id: `cell_${c.lat}_${c.lon}`,
        lat: c.lat,
        lon: c.lon,
        area_km2: calculateCellAreaKm2(c.lat, 5.0),
        suitability: c.future_ensemble_suitability,
        uncertainty: c.uncertainty_spread,
      }));

    const bCriticalLinks = rankCriticalLinks(bNodes, 1200);
    const nbCriticalLinks = rankCriticalLinks(nbNodes, 1200);

    analysisOutput.species[s.species_id] = {
      species_id: s.species_id,
      scientific_name: s.scientific_name,
      race: raceSummary,
      twin: {
        breeding: bTwin,
        non_breeding: nbTwin,
      },
      break: {
        breeding_critical_links: bCriticalLinks,
        non_breeding_critical_links: nbCriticalLinks,
      },
    };

    console.log(
      `✔ [${s.scientific_name}] Velocity: ${raceSummary.mean_velocity_km_decade} km/dec | HWI Rank: #${raceSummary.hwi_rank}/${raceSummary.hwi_rank_total} | Critical Links: ${bCriticalLinks.length} (B), ${nbCriticalLinks.length} (NB)`
    );
  }

  // Save to file
  const outPath = path.resolve('data', 'generated', 'corridor_analysis.json');
  fs.writeFileSync(outPath, JSON.stringify(analysisOutput, null, 2), 'utf-8');
  console.log(`\n✔ Saved complete corridor analysis dataset to ${outPath}`);

  // Sync to local D1 database
  console.log('\nSyncing corridor snapshots into local D1 database...');
  const syncScript = path.resolve('scripts', 'sync_corridor_d1.py');
  fs.writeFileSync(
    syncScript,
    `import sqlite3, glob, json

db_files = glob.glob('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')
if not db_files:
    print('No local D1 DB file found')
    exit(0)

conn = sqlite3.connect(db_files[0])
cur = conn.cursor()

cur.execute('''
CREATE TABLE IF NOT EXISTS corridor_snapshots (
    species_id TEXT PRIMARY KEY,
    analysis_json TEXT NOT NULL,
    retrieved_at TEXT NOT NULL
)
''')

with open('data/generated/corridor_analysis.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

retrieved_at = data.get('generated_at')
inserted = 0

for sp_id, analysis in data.get('species', {}).items():
    cur.execute('''
        INSERT OR REPLACE INTO corridor_snapshots (species_id, analysis_json, retrieved_at)
        VALUES (?, ?, ?)
    ''', (sp_id, json.dumps(analysis), retrieved_at))
    inserted += 1

conn.commit()
print(f'Successfully stored {inserted} species corridor snapshots into local D1.')
`,
    'utf-8'
  );

  try {
    execSync('python "scripts/sync_corridor_d1.py"', { stdio: 'inherit' });
    console.log('✔ All corridor snapshots persisted to D1.\n');
  } catch (err: any) {
    console.warn(`Warning during D1 sync: ${err.message}`);
  }
}

// CLI execution
if (process.argv[1] && process.argv[1].endsWith('corridor-analysis.ts')) {
  runCorridorAnalysis().catch((err) => {
    console.error('Fatal corridor precompute error:', err);
    process.exit(1);
  });
}
