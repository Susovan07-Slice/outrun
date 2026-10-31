/**
 * src/analytics/twin.ts
 * 
 * Outrun Phase 4B: THE TWIN
 * Climate-Envelope Suitability & Model Uncertainty Engine
 * 
 * Methodology:
 * 1. Derives 5th and 95th percentiles of baseline temperature (ERA5 2005-2024)
 *    from empirical occurrences and telemetry fixes for each species and season.
 * 2. Evaluates climate suitability score [0.0, 1.0] across the grid for:
 *    - Baseline (ERA5 reanalysis)
 *    - Future Model 1 (EC_Earth3P_HR)
 *    - Future Model 2 (MPI_ESM1_2_XR)
 * 3. Quantifies model spread as uncertainty (|Suitability_M1 - Suitability_M2|).
 * 4. Labels all outputs as "simulated".
 * 5. Honest disclaimer: Climate suitability only; does not model land cover or human infrastructure.
 */

export interface ClimateEnvelope {
  species_id: string;
  season: 'breeding' | 'non_breeding';
  p05: number; // 5th percentile temperature (degC)
  p10: number; // 10th percentile temperature (degC)
  p50: number; // Median temperature (degC)
  p90: number; // 90th percentile temperature (degC)
  p95: number; // 95th percentile temperature (degC)
  sample_size: number;
}

export interface GridSuitabilityCell {
  lat: number;
  lon: number;
  baseline_suitability: number; // [0.0, 1.0] under ERA5 baseline
  future_suitability_m1: number; // [0.0, 1.0] under EC_Earth3P_HR
  future_suitability_m2: number; // [0.0, 1.0] under MPI_ESM1_2_XR
  future_ensemble_suitability: number; // Mean of models
  uncertainty_spread: number; // |M1 - M2|
  is_suitable_baseline: boolean; // suitability >= 0.5
  is_suitable_future: boolean; // future ensemble >= 0.5
  suitability_delta: number; // future_ensemble - baseline
  label: 'simulated';
}

export interface TwinSeasonResult {
  species_id: string;
  season: 'breeding' | 'non_breeding';
  envelope: ClimateEnvelope;
  cells: GridSuitabilityCell[];
  summary: {
    baseline_suitable_cells: number;
    future_suitable_cells: number;
    stable_cells: number;
    gained_cells: number;
    lost_cells: number;
    mean_uncertainty: number;
  };
  models: string[];
  label: 'simulated';
  disclaimer: string;
  retrieved_at: string;
}

/**
 * Calculates a given percentile from an array of numbers.
 */
export function calculatePercentile(values: number[], percentile: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (percentile / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;

  if (lower === upper) return sorted[lower];
  return Number((sorted[lower] * (1 - weight) + sorted[upper] * weight).toFixed(2));
}

/**
 * Derives the empirical 5th to 95th percentile climate envelope for a species.
 */
export function deriveClimateEnvelope(
  speciesId: string,
  season: 'breeding' | 'non_breeding',
  observedTemps: number[]
): ClimateEnvelope {
  const valid = observedTemps.filter((t) => typeof t === 'number' && !isNaN(t));

  if (valid.length === 0) {
    // Insufficient evidence default bounds
    return {
      species_id: speciesId,
      season,
      p05: 10.0,
      p10: 12.0,
      p50: 20.0,
      p90: 28.0,
      p95: 30.0,
      sample_size: 0,
    };
  }

  return {
    species_id: speciesId,
    season,
    p05: calculatePercentile(valid, 5),
    p10: calculatePercentile(valid, 10),
    p50: calculatePercentile(valid, 50),
    p90: calculatePercentile(valid, 90),
    p95: calculatePercentile(valid, 95),
    sample_size: valid.length,
  };
}

/**
 * Scores climate suitability for a temperature against an empirical envelope.
 * Within [p10, p90] -> 1.0 (Optimal core niche)
 * Between [p05, p10] or [p90, p95] -> Linear transition [0.5, 1.0]
 * Outside [p05, p95] -> Smooth decay towards 0.0
 */
export function scoreSuitability(temp: number, envelope: ClimateEnvelope): number {
  const { p05, p10, p90, p95 } = envelope;

  // Optimal core
  if (temp >= p10 && temp <= p90) {
    return 1.0;
  }

  // Lower marginal
  if (temp >= p05 && temp < p10) {
    const range = p10 - p05;
    return range > 0.01 ? Number((0.5 + 0.5 * ((temp - p05) / range)).toFixed(2)) : 0.75;
  }

  // Upper marginal
  if (temp > p90 && temp <= p95) {
    const range = p95 - p90;
    return range > 0.01 ? Number((1.0 - 0.5 * ((temp - p90) / range)).toFixed(2)) : 0.75;
  }

  // Sub-marginal decay
  if (temp < p05) {
    const diff = p05 - temp;
    return Number(Math.max(0, 0.5 * Math.exp(-diff / 3.0)).toFixed(2));
  }

  if (temp > p95) {
    const diff = temp - p95;
    return Number(Math.max(0, 0.5 * Math.exp(-diff / 3.0)).toFixed(2));
  }

  return 0.0;
}

/**
 * Evaluates climate envelope suitability across a species grid for baseline and future projections.
 */
export function evaluateTwinSuitability(
  speciesId: string,
  season: 'breeding' | 'non_breeding',
  envelope: ClimateEnvelope,
  gridCells: Array<{
    lat: number;
    lon: number;
    era5_mean_temp?: number;
    era5_breeding_mean_temp?: number;
    era5_nonbreeding_mean_temp?: number;
    cmip6_ec_earth3p_hr_mean_temp?: number;
    cmip6_mpi_esm1_2_xr_mean_temp?: number;
    cmip6_breeding_ensemble_temp?: number;
    cmip6_nonbreeding_ensemble_temp?: number;
    cmip6_ensemble_mean_temp?: number;
  }>
): TwinSeasonResult {
  const scoredCells: GridSuitabilityCell[] = [];

  for (const cell of gridCells) {
    const baselineT =
      season === 'breeding'
        ? (cell.era5_breeding_mean_temp ?? cell.era5_mean_temp ?? 20.0)
        : (cell.era5_nonbreeding_mean_temp ?? cell.era5_mean_temp ?? 20.0);

    const m1T = cell.cmip6_ec_earth3p_hr_mean_temp ?? (baselineT + 1.2);
    const m2T = cell.cmip6_mpi_esm1_2_xr_mean_temp ?? (baselineT + 1.5);

    const scoreBase = scoreSuitability(baselineT, envelope);
    const scoreM1 = scoreSuitability(m1T, envelope);
    const scoreM2 = scoreSuitability(m2T, envelope);

    const ensembleScore = Number(((scoreM1 + scoreM2) / 2).toFixed(2));
    const uncertainty = Number(Math.abs(scoreM1 - scoreM2).toFixed(2));

    scoredCells.push({
      lat: cell.lat,
      lon: cell.lon,
      baseline_suitability: scoreBase,
      future_suitability_m1: scoreM1,
      future_suitability_m2: scoreM2,
      future_ensemble_suitability: ensembleScore,
      uncertainty_spread: uncertainty,
      is_suitable_baseline: scoreBase >= 0.5,
      is_suitable_future: ensembleScore >= 0.5,
      suitability_delta: Number((ensembleScore - scoreBase).toFixed(2)),
      label: 'simulated',
    });
  }

  // Summary statistics
  const baseSuitable = scoredCells.filter((c) => c.is_suitable_baseline).length;
  const futureSuitable = scoredCells.filter((c) => c.is_suitable_future).length;
  const stable = scoredCells.filter((c) => c.is_suitable_baseline && c.is_suitable_future).length;
  const gained = scoredCells.filter((c) => !c.is_suitable_baseline && c.is_suitable_future).length;
  const lost = scoredCells.filter((c) => c.is_suitable_baseline && !c.is_suitable_future).length;
  const meanUncertainty =
    scoredCells.length > 0
      ? Number(
          (
            scoredCells.reduce((sum, c) => sum + c.uncertainty_spread, 0) / scoredCells.length
          ).toFixed(2)
        )
      : 0;

  return {
    species_id: speciesId,
    season,
    envelope,
    cells: scoredCells,
    summary: {
      baseline_suitable_cells: baseSuitable,
      future_suitable_cells: futureSuitable,
      stable_cells: stable,
      gained_cells: gained,
      lost_cells: lost,
      mean_uncertainty: meanUncertainty,
    },
    models: ['EC_Earth3P_HR', 'MPI_ESM1_2_XR'],
    label: 'simulated',
    disclaimer:
      'Climate-envelope suitability models atmospheric niche compatibility only. It does not account for land cover, human infrastructure, food availability, or wetlands loss.',
    retrieved_at: new Date().toISOString(),
  };
}
