/**
 * scripts/precompute/climate-grid.ts
 * 
 * Outrun Phase 3: Open-Meteo Climate Grid Precomputation Pipeline
 * 
 * Requirements:
 * 1. Coarse global grid (~5 degrees) restricted to breeding & non-breeding ranges per species.
 * 2. Fetch ERA5 baseline (2005-2024) and CMIP6 projections (2025-2050, 2 models: EC_Earth3P_HR, MPI_ESM1_2_XR).
 * 3. Print the call weight BEFORE running.
 * 4. Stay within ~3,000 weight/day.
 * 5. Cache responses on disk (in data/generated/climate_cache/).
 * 6. Resume after rate limits without duplicate calls.
 * 7. Store results in data/generated/climate_grid.json and sync to local D1.
 */

import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import {
  OPEN_METEO_LIMITS,
  calculateCallWeight,
  calculateEra5BaselineWeight,
  calculateCmip6ProjectionWeight,
  calculateGridCellTotalWeight,
  maxCellsWithinBudget,
} from './weight.js';
import {
  GridCell,
  extractSpeciesRangeCells,
  extractLatestWeatherTargets,
} from './grid-utils.js';

interface CellClimateData {
  lat: number;
  lon: number;
  era5_mean_temp: number;
  era5_breeding_mean_temp: number;
  era5_nonbreeding_mean_temp: number;
  cmip6_ec_earth3p_hr_mean_temp: number;
  cmip6_mpi_esm1_2_xr_mean_temp: number;
  cmip6_ensemble_mean_temp: number;
  cmip6_breeding_ensemble_temp: number;
  cmip6_nonbreeding_ensemble_temp: number;
  temp_delta: number;
  retrieved_at: string;
}

interface ClimateGridOutput {
  resolution: string;
  models: string[];
  period: {
    baseline: string;
    projection: string;
  };
  labels: {
    baseline: string;
    projection: string;
  };
  generated_at: string;
  total_cells_cached: number;
  species: Record<
    string,
    {
      species_id: string;
      scientific_name: string;
      seasons: {
        breeding: {
          cell_count: number;
          cells: CellClimateData[];
        };
        non_breeding: {
          cell_count: number;
          cells: CellClimateData[];
        };
      };
    }
  >;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Compute average of an array of numbers, ignoring nulls/NaNs
function arrayMean(arr: (number | null | undefined)[]): number {
  const valid = arr.filter((x): x is number => typeof x === 'number' && !isNaN(x));
  if (valid.length === 0) return 0;
  return Number((valid.reduce((sum, val) => sum + val, 0) / valid.length).toFixed(2));
}

// Compute seasonal average from a daily series with date strings
function seasonalMean(
  dates: string[],
  values: (number | null | undefined)[],
  validMonths: number[]
): number {
  const filtered: number[] = [];
  for (let i = 0; i < dates.length; i++) {
    const val = values[i];
    if (typeof val === 'number' && !isNaN(val)) {
      const month = parseInt(dates[i].substring(5, 7), 10);
      if (validMonths.includes(month)) {
        filtered.push(val);
      }
    }
  }
  return arrayMean(filtered);
}

export async function runClimateGridPrecompute(options: {
  maxBudget?: number;
  dryRun?: boolean;
} = {}) {
  const dailyBudget = options.maxBudget ?? OPEN_METEO_LIMITS.PRECOMPUTE_DAILY_BUDGET;
  const isDryRun = options.dryRun ?? false;

  console.log('\n===============================================================');
  console.log('=== Outrun: Open-Meteo Climate Grid Precomputation Pipeline ===');
  console.log('===============================================================\n');

  // Ensure directories exist
  const cacheDir = path.resolve('data', 'generated', 'climate_cache');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const registryPath = path.resolve('data', 'generated', 'registry.json');
  if (!fs.existsSync(registryPath)) {
    throw new Error('data/generated/registry.json not found. Run "npm run ingest" first.');
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  const speciesList = registry.species || [];
  console.log(`Loaded registry with ${speciesList.length} canonical species.`);

  // 1. Extract 5-degree grid cells & latest weather targets for all species
  const speciesRanges: Record<string, ReturnType<typeof extractSpeciesRangeCells>> = {};
  const weatherTargets: Record<string, any> = {};
  const uniqueCellsMap = new Map<string, GridCell>();

  for (const s of speciesList) {
    const occPath = path.resolve('data', 'generated', 'occurrences', `${s.species_id}.json`);
    const trackPath = path.resolve('data', 'generated', 'tracks', `${s.species_id}.geojson`);

    let occurrences: any[] = [];
    if (fs.existsSync(occPath)) {
      occurrences = JSON.parse(fs.readFileSync(occPath, 'utf-8')).occurrences || [];
    }

    let trackFeatures: any[] = [];
    if (fs.existsSync(trackPath)) {
      trackFeatures = JSON.parse(fs.readFileSync(trackPath, 'utf-8')).features || [];
    }

    const range = extractSpeciesRangeCells(s.species_id, s.scientific_name, occurrences, trackFeatures);
    speciesRanges[s.species_id] = range;

    const targets = extractLatestWeatherTargets(s.species_id, occurrences, trackFeatures);
    weatherTargets[s.species_id] = {
      species_id: s.species_id,
      scientific_name: s.scientific_name,
      targets,
      count: targets.length,
      updated_at: new Date().toISOString(),
    };

    for (const cell of range.all_cells) {
      uniqueCellsMap.set(cell.key, cell);
    }
  }

  // Save weather targets for Worker fast lookup
  const targetsPath = path.resolve('data', 'generated', 'weather_targets.json');
  fs.writeFileSync(targetsPath, JSON.stringify(weatherTargets, null, 2), 'utf-8');
  console.log(`✔ Extracted and saved latest weather targets for ${Object.keys(weatherTargets).length} species.`);

  const allUniqueCells = Array.from(uniqueCellsMap.values());
  console.log(`Identified ${allUniqueCells.length} unique 5-degree grid cells across all species ranges.`);

  // 2. Inspect disk cache to determine what is already fetched
  const uncachedCells: GridCell[] = [];
  const cachedCells: GridCell[] = [];

  for (const cell of allUniqueCells) {
    const era5File = path.join(cacheDir, `era5_${cell.lat}_${cell.lon}.json`);
    const cmip6File = path.join(cacheDir, `cmip6_${cell.lat}_${cell.lon}.json`);

    if (fs.existsSync(era5File) && fs.existsSync(cmip6File)) {
      cachedCells.push(cell);
    } else {
      uncachedCells.push(cell);
    }
  }

  console.log(`\n--- Cache & Quota Status ---`);
  console.log(`Already cached on disk: ${cachedCells.length} cells (API Weight: 0)`);
  console.log(`Pending / Uncached cells: ${uncachedCells.length} cells`);

  // 3. Calculate Call Weight BEFORE Running
  const weightPerCell = calculateGridCellTotalWeight(1, OPEN_METEO_LIMITS.DEFAULT_MODELS.length);
  const totalPlannedWeight = Number((uncachedCells.length * weightPerCell).toFixed(2));

  console.log(`\n======================================================`);
  console.log(`=== OPEN-METEO CALL WEIGHT AUDIT (BEFORE EXECUTION) ===`);
  console.log(`======================================================`);
  console.log(`Formula: weight = locations * (days / 14) * (variables / 10)`);
  console.log(`- ERA5 Baseline (2005-2024, 7,305 days, 1 variable): ${calculateEra5BaselineWeight(1)} weight/cell`);
  console.log(`- CMIP6 Projection (2025-2050, 9,496 days, 2 models): ${calculateCmip6ProjectionWeight(1, 2)} weight/cell`);
  console.log(`- Combined Weight Per Grid Cell: ${weightPerCell}`);
  console.log(`- Total Weight Needed for All Pending Cells: ${totalPlannedWeight}`);
  console.log(`- Configured Daily Precompute Budget: ${dailyBudget} weight`);
  console.log(`- Maximum Cells Supported Within Budget Today: ${maxCellsWithinBudget(dailyBudget)} cells`);
  console.log(`======================================================\n`);

  if (isDryRun) {
    console.log(`[Dry Run] Stopping before network queries as requested.`);
    return {
      totalUniqueCells: allUniqueCells.length,
      cachedCount: cachedCells.length,
      uncachedCount: uncachedCells.length,
      weightPerCell,
      totalPlannedWeight,
      dailyBudget,
      cellsWithinBudget: maxCellsWithinBudget(dailyBudget),
    };
  }

  // Determine cells to process in this run according to the daily budget
  const maxCellsToFetch = maxCellsWithinBudget(dailyBudget);
  const cellsToFetch = uncachedCells.slice(0, maxCellsToFetch);

  const budgetUsed = Number((cellsToFetch.length * weightPerCell).toFixed(2));
  console.log(`Executing batch for ${cellsToFetch.length} cells (Planned Weight: ${budgetUsed} / Budget: ${dailyBudget})...`);

  // 4. Fetch pending cells with polite pacing, checkpointing & resume on rate limit
  let completedInRun = 0;
  let rateLimited = false;

  for (let i = 0; i < cellsToFetch.length; i++) {
    const cell = cellsToFetch[i];
    const era5File = path.join(cacheDir, `era5_${cell.lat}_${cell.lon}.json`);
    const cmip6File = path.join(cacheDir, `cmip6_${cell.lat}_${cell.lon}.json`);

    try {
      // A. ERA5 Baseline
      if (!fs.existsSync(era5File)) {
        await sleep(350); // Polite pacing
        const era5Url = `https://archive-api.open-meteo.com/v1/archive?latitude=${cell.lat}&longitude=${cell.lon}&start_date=${OPEN_METEO_LIMITS.ERA5_START_DATE}&end_date=${OPEN_METEO_LIMITS.ERA5_END_DATE}&daily=temperature_2m_mean`;
        
        const res = await fetch(era5Url, {
          headers: { 'User-Agent': 'Outrun/1.0 (Migratory Birds Climate Grid)' },
        });

        if (res.status === 429) {
          console.warn(`[Rate Limit 429] Open-Meteo limit reached while querying ERA5 for ${cell.key}. Saving checkpoint...`);
          rateLimited = true;
          break;
        }

        if (!res.ok) {
          throw new Error(`ERA5 HTTP ${res.status}: ${res.statusText}`);
        }

        const era5Json = await res.json();
        fs.writeFileSync(era5File, JSON.stringify(era5Json), 'utf-8');
      }

      // B. CMIP6 Projection
      if (!fs.existsSync(cmip6File)) {
        await sleep(350); // Polite pacing
        const modelsStr = OPEN_METEO_LIMITS.DEFAULT_MODELS.join(',');
        const cmip6Url = `https://climate-api.open-meteo.com/v1/climate?latitude=${cell.lat}&longitude=${cell.lon}&start_date=${OPEN_METEO_LIMITS.CMIP6_START_DATE}&end_date=${OPEN_METEO_LIMITS.CMIP6_END_DATE}&models=${modelsStr}&daily=temperature_2m_mean`;

        const res = await fetch(cmip6Url, {
          headers: { 'User-Agent': 'Outrun/1.0 (Migratory Birds Climate Grid)' },
        });

        if (res.status === 429) {
          console.warn(`[Rate Limit 429] Open-Meteo limit reached while querying CMIP6 for ${cell.key}. Saving checkpoint...`);
          rateLimited = true;
          break;
        }

        if (!res.ok) {
          throw new Error(`CMIP6 HTTP ${res.status}: ${res.statusText}`);
        }

        const cmip6Json = await res.json();
        fs.writeFileSync(cmip6File, JSON.stringify(cmip6Json), 'utf-8');
      }

      completedInRun++;
      console.log(`✔ [${i + 1}/${cellsToFetch.length}] Cached climate grid cell (${cell.lat}°, ${cell.lon}°)`);
    } catch (err: any) {
      console.error(`✖ Error fetching cell (${cell.lat}, ${cell.lon}): ${err.message}`);
    }
  }

  // Save checkpoint status for resume
  const checkpointPath = path.join(cacheDir, 'checkpoint.json');
  fs.writeFileSync(
    checkpointPath,
    JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        total_unique_cells: allUniqueCells.length,
        cached_cells_count: cachedCells.length + completedInRun,
        remaining_cells_count: uncachedCells.length - completedInRun,
        rate_limited: rateLimited,
      },
      null,
      2
    ),
    'utf-8'
  );

  if (rateLimited) {
    console.warn(`\n[Resume Ready] Pipeline paused due to rate limits. Progress saved in ${checkpointPath}. Resume at any time.`);
  }

  // 5. Build Aggregated Species Climate Grid
  console.log(`\nAggregating climate metrics from disk cache...`);
  const cellDataMap = new Map<string, CellClimateData>();

  for (const cell of allUniqueCells) {
    const era5File = path.join(cacheDir, `era5_${cell.lat}_${cell.lon}.json`);
    const cmip6File = path.join(cacheDir, `cmip6_${cell.lat}_${cell.lon}.json`);

    if (fs.existsSync(era5File) && fs.existsSync(cmip6File)) {
      try {
        const era5Raw = JSON.parse(fs.readFileSync(era5File, 'utf-8'));
        const cmip6Raw = JSON.parse(fs.readFileSync(cmip6File, 'utf-8'));

        const era5Dates = era5Raw.daily?.time || [];
        const era5Temps = era5Raw.daily?.temperature_2m_mean || [];

        const cmip6Dates = cmip6Raw.daily?.time || [];
        const m1Temps = cmip6Raw.daily?.temperature_2m_mean_EC_Earth3P_HR || [];
        const m2Temps = cmip6Raw.daily?.temperature_2m_mean_MPI_ESM1_2_XR || [];

        const era5Mean = arrayMean(era5Temps);
        const era5Breeding = seasonalMean(era5Dates, era5Temps, [5, 6, 7, 8]);
        const era5NonBreeding = seasonalMean(era5Dates, era5Temps, [11, 12, 1, 2]);

        const m1Mean = arrayMean(m1Temps);
        const m2Mean = arrayMean(m2Temps);
        const ensembleMean = Number(((m1Mean + m2Mean) / 2).toFixed(2));

        const m1Breeding = seasonalMean(cmip6Dates, m1Temps, [5, 6, 7, 8]);
        const m2Breeding = seasonalMean(cmip6Dates, m2Temps, [5, 6, 7, 8]);
        const ensembleBreeding = Number(((m1Breeding + m2Breeding) / 2).toFixed(2));

        const m1NonBreeding = seasonalMean(cmip6Dates, m1Temps, [11, 12, 1, 2]);
        const m2NonBreeding = seasonalMean(cmip6Dates, m2Temps, [11, 12, 1, 2]);
        const ensembleNonBreeding = Number(((m1NonBreeding + m2NonBreeding) / 2).toFixed(2));

        const delta = Number((ensembleMean - era5Mean).toFixed(2));

        cellDataMap.set(cell.key, {
          lat: cell.lat,
          lon: cell.lon,
          era5_mean_temp: era5Mean,
          era5_breeding_mean_temp: era5Breeding,
          era5_nonbreeding_mean_temp: era5NonBreeding,
          cmip6_ec_earth3p_hr_mean_temp: m1Mean,
          cmip6_mpi_esm1_2_xr_mean_temp: m2Mean,
          cmip6_ensemble_mean_temp: ensembleMean,
          cmip6_breeding_ensemble_temp: ensembleBreeding,
          cmip6_nonbreeding_ensemble_temp: ensembleNonBreeding,
          temp_delta: delta,
          retrieved_at: new Date().toISOString(),
        });
      } catch (err) {
        // Skip corrupt file
      }
    }
  }

  // 6. Compile Final Structured Output
  const output: ClimateGridOutput = {
    resolution: '5_degrees',
    models: [...OPEN_METEO_LIMITS.DEFAULT_MODELS],
    period: {
      baseline: `${OPEN_METEO_LIMITS.ERA5_START_DATE} to ${OPEN_METEO_LIMITS.ERA5_END_DATE}`,
      projection: `${OPEN_METEO_LIMITS.CMIP6_START_DATE} to ${OPEN_METEO_LIMITS.CMIP6_END_DATE}`,
    },
    labels: {
      baseline: 'observed',
      projection: 'projected',
    },
    generated_at: new Date().toISOString(),
    total_cells_cached: cellDataMap.size,
    species: {},
  };

  for (const s of speciesList) {
    const range = speciesRanges[s.species_id];
    if (!range) continue;

    const breedingData = range.breeding_cells
      .map((c) => cellDataMap.get(c.key))
      .filter((d): d is CellClimateData => Boolean(d));

    const nonBreedingData = range.non_breeding_cells
      .map((c) => cellDataMap.get(c.key))
      .filter((d): d is CellClimateData => Boolean(d));

    output.species[s.species_id] = {
      species_id: s.species_id,
      scientific_name: s.scientific_name,
      seasons: {
        breeding: {
          cell_count: breedingData.length,
          cells: breedingData,
        },
        non_breeding: {
          cell_count: nonBreedingData.length,
          cells: nonBreedingData,
        },
      },
    };
  }

  const outFilePath = path.resolve('data', 'generated', 'climate_grid.json');
  fs.writeFileSync(outFilePath, JSON.stringify(output, null, 2), 'utf-8');
  console.log(`\n✔ Saved climate grid dataset with ${cellDataMap.size} cells to ${outFilePath}`);

  // 7. Sync to D1 climate_grid_snapshots table
  console.log(`\nSyncing climate grid snapshots into local D1 database...`);
  const syncScript = path.resolve('scripts', 'sync_climate_grid_d1.py');
  fs.writeFileSync(
    syncScript,
    `import sqlite3, glob, json

db_files = glob.glob('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')
if not db_files:
    print('No D1 DB found')
    exit(0)

conn = sqlite3.connect(db_files[0])
cur = conn.cursor()

cur.execute('''
CREATE TABLE IF NOT EXISTS climate_grid_snapshots (
    species_id TEXT NOT NULL,
    season TEXT NOT NULL,
    resolution TEXT NOT NULL,
    models TEXT NOT NULL,
    grid_json TEXT NOT NULL,
    retrieved_at TEXT NOT NULL,
    PRIMARY KEY (species_id, season)
)
''')

with open('data/generated/climate_grid.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

inserted = 0
models_str = ",".join(data.get('models', []))
retrieved_at = data.get('generated_at')

for sp_id, sp_info in data.get('species', {}).items():
    for season in ['breeding', 'non_breeding']:
        s_data = sp_info['seasons'][season]
        cur.execute('''
            INSERT OR REPLACE INTO climate_grid_snapshots 
            (species_id, season, resolution, models, grid_json, retrieved_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (sp_id, season, '5_degrees', models_str, json.dumps(s_data), retrieved_at))
        inserted += 1

conn.commit()
print(f'Successfully synced {inserted} climate grid seasonal snapshots into local D1 database.')
`,
    'utf-8'
  );

  try {
    execSync('python "scripts/sync_climate_grid_d1.py"', { stdio: 'inherit' });
    console.log('✔ All seasonal climate grids successfully persisted into local D1.\n');
  } catch (err: any) {
    console.warn(`Warning syncing to D1: ${err.message}`);
  }

  return {
    totalUniqueCells: allUniqueCells.length,
    cachedCount: cachedCells.length + completedInRun,
    remainingCount: uncachedCells.length - completedInRun,
    completedInRun,
    budgetUsed,
    rateLimited,
  };
}

// Direct execution CLI entrypoint
if (process.argv[1] && process.argv[1].endsWith('climate-grid.ts')) {
  runClimateGridPrecompute().catch((err) => {
    console.error('Fatal precompute error:', err);
    process.exit(1);
  });
}
