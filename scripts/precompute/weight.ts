/**
 * Open-Meteo API Call Weight & Rate Limit Calculator
 * 
 * Based on official Open-Meteo Free Tier documentation and limits:
 * - Free-tier limits: 10,000 calls/day, 5,000 calls/hour, 600 calls/minute.
 * - Call Weight Formula: weight = locations * (days / 14) * (variables / 10)
 * 
 * For ERA5 Baseline (2005-01-01 to 2024-12-31):
 * - days = 7,305 days (20 years)
 * - variables = 1 (temperature_2m_mean)
 * - weight per location = 1 * (7305 / 14) * (1 / 10) = 52.1785...
 * 
 * For CMIP6 Projection (2025-01-01 to 2050-12-31, verified end year 2050):
 * - days = 9,496 days (26 years)
 * - variables = 2 models (EC_Earth3P_HR, MPI_ESM1_2_XR)
 * - weight per location = 1 * (9496 / 14) * (2 / 10) = 135.6571...
 */

export interface WeightParams {
  locations: number;
  days: number;
  variables: number;
}

export const OPEN_METEO_LIMITS = {
  DAILY_MAX_WEIGHT: 10000,
  PRECOMPUTE_DAILY_BUDGET: 3000,
  HOURLY_MAX_CALLS: 5000,
  MINUTE_MAX_CALLS: 600,
  ERA5_START_DATE: '2005-01-01',
  ERA5_END_DATE: '2024-12-31',
  ERA5_DAYS: 7305, // 2005 to 2024 inclusive (365*20 + 5 leap days: 2008, 2012, 2016, 2020, 2024)
  CMIP6_START_DATE: '2025-01-01',
  CMIP6_END_DATE: '2050-12-31',
  CMIP6_DAYS: 9496, // 2025 to 2050 inclusive (365*26 + 6 leap days: 2028, 2032, 2036, 2040, 2044, 2048)
  DEFAULT_MODELS: ['EC_Earth3P_HR', 'MPI_ESM1_2_XR'] as const,
};

/**
 * Computes Open-Meteo call weight according to the documented formula:
 * weight = locations * (days / 14) * (variables / 10)
 */
export function calculateCallWeight(params: WeightParams): number {
  const { locations, days, variables } = params;
  if (locations <= 0 || days <= 0 || variables <= 0) {
    return 0;
  }
  return Number((locations * (days / 14) * (variables / 10)).toFixed(4));
}

/**
 * Computes weight for ERA5 baseline historical reanalysis queries
 */
export function calculateEra5BaselineWeight(locations: number, variables: number = 1): number {
  return calculateCallWeight({
    locations,
    days: OPEN_METEO_LIMITS.ERA5_DAYS,
    variables,
  });
}

/**
 * Computes weight for CMIP6 climate model projections queries up to 2050
 */
export function calculateCmip6ProjectionWeight(locations: number, modelsCount: number = 2): number {
  return calculateCallWeight({
    locations,
    days: OPEN_METEO_LIMITS.CMIP6_DAYS,
    variables: modelsCount,
  });
}

/**
 * Computes total weight for both baseline and projection for a given number of grid cell locations
 */
export function calculateGridCellTotalWeight(locations: number, modelsCount: number = 2): number {
  const era5Weight = calculateEra5BaselineWeight(locations, 1);
  const cmip6Weight = calculateCmip6ProjectionWeight(locations, modelsCount);
  return Number((era5Weight + cmip6Weight).toFixed(4));
}

/**
 * Calculates the maximum number of full climate grid cells (ERA5 + CMIP6)
 * that can be processed while staying strictly within a specified daily budget.
 */
export function maxCellsWithinBudget(budget: number = OPEN_METEO_LIMITS.PRECOMPUTE_DAILY_BUDGET): number {
  const weightPerCell = calculateGridCellTotalWeight(1);
  return Math.floor(budget / weightPerCell);
}
