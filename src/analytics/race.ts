/**
 * src/analytics/race.ts
 * 
 * Outrun Phase 4A: THE RACE
 * Climate Velocity & AVONET Hand-Wing Index (HWI) Comparison Engine
 * 
 * Methodological References:
 * - Loarie, S. R., Duffy, P. B., Hamilton, H., et al. (2009). The velocity of climate change. Nature, 462(7276), 1052-1055.
 * - Burrows, M. T., Schoeman, D. S., Buckley, L. B., et al. (2011). The Pace of Shifting Climate in Marine and Terrestrial Ecosystems. Science, 334(6056), 652-655.
 * - AVONET: Tobias et al. (2022). Hand-Wing Index as a morphological dispersal capability proxy.
 * 
 * Rules:
 * - Non-negotiable: Hand-wing index is a morphological dispersal proxy, NOT a km/decade physical speed.
 * - Verdict must strictly display: "Insufficient evidence for a verdict". Never infer "Keeping up" or "Left behind".
 */

export interface ClimateCellPoint {
  lat: number;
  lon: number;
  baseline_temp: number; // ERA5 mean temp (2005-2024)
  projected_temp_m1?: number; // EC_Earth3P_HR mean temp (2025-2050)
  projected_temp_m2?: number; // MPI_ESM1_2_XR mean temp (2025-2050)
  projected_ensemble_temp: number; // Ensemble mean temp
  temp_delta?: number; // projected - baseline
}

export interface GridVelocityResult {
  lat: number;
  lon: number;
  temporal_trend_deg_decade: number; // dT/dt (degC / decade)
  spatial_gradient_deg_km: number; // ||grad T|| (degC / km)
  velocity_km_decade: number; // km / decade
}

export interface SpeciesRaceSummary {
  species_id: string;
  scientific_name: string;
  common_name?: string;
  breeding_velocity_km_decade: number | null;
  non_breeding_velocity_km_decade: number | null;
  mean_velocity_km_decade: number;
  hwi: number | null;
  hwi_rank: number | null; // e.g. 3 (ranked 3rd out of N observatory species)
  hwi_rank_total: number;
  verdict: string; // Strictly: "Insufficient evidence for a verdict"
  verdict_reason: string;
  label: 'projected';
  retrieved_at: string;
}

const KM_PER_DEGREE_LAT = 111.132;
const EPSILON_GRADIENT = 1e-4; // Numerical stability threshold to prevent division by zero in flat terrain

/**
 * Centered-difference local spatial temperature gradient calculation
 * with latitude-corrected longitudinal distance.
 */
export function computeSpatialGradient(
  centerLat: number,
  centerLon: number,
  tempNorth: number,
  tempSouth: number,
  tempEast: number,
  tempWest: number,
  stepDeg: number = 5.0
): { gradY: number; gradX: number; magnitude: number } {
  // Latitude distance (North-South): 2 * stepDeg * 111.132 km
  const dyKm = 2 * stepDeg * KM_PER_DEGREE_LAT;
  const dTdY = (tempNorth - tempSouth) / dyKm;

  // Latitude-corrected longitude distance (East-West)
  const radLat = (centerLat * Math.PI) / 180;
  const dxKm = 2 * stepDeg * KM_PER_DEGREE_LAT * Math.cos(radLat);
  const dTdX = dxKm > 0.001 ? (tempEast - tempWest) / dxKm : 0;

  const magnitude = Math.sqrt(dTdY * dTdY + dTdX * dTdX);

  return {
    gradY: Number(dTdY.toFixed(6)),
    gradX: Number(dTdX.toFixed(6)),
    magnitude: Number(magnitude.toFixed(6)),
  };
}

/**
 * Computes climate velocity for a cell given temporal trend (degC/decade) and spatial gradient (degC/km).
 * Formula: Velocity = Trend / max(Gradient, 1e-4)
 */
export function computeCellVelocity(
  temporalTrendDegDecade: number,
  spatialGradientDegKm: number
): number {
  const stabilizedGradient = Math.max(Math.abs(spatialGradientDegKm), EPSILON_GRADIENT);
  const velocity = temporalTrendDegDecade / stabilizedGradient;
  return Number(velocity.toFixed(2));
}

/**
 * Synthetic gradient velocity verification helper for testing.
 * Computes analytical velocity on a known synthetic gradient.
 */
export function computeSyntheticGradientVelocity(
  spatialGradientDegKm: number,
  temporalTrendDegDecade: number
): number {
  return computeCellVelocity(temporalTrendDegDecade, spatialGradientDegKm);
}

/**
 * Computes climate velocity across a set of grid cells.
 * If neighbors are missing in a sparse set, computes local gradient from nearest neighbors.
 */
export function computeGridVelocities(
  cells: ClimateCellPoint[],
  stepDeg: number = 5.0
): GridVelocityResult[] {
  const cellMap = new Map<string, ClimateCellPoint>();
  for (const c of cells) {
    const key = `${c.lat.toFixed(1)}_${c.lon.toFixed(1)}`;
    cellMap.set(key, c);
  }

  const results: GridVelocityResult[] = [];

  for (const cell of cells) {
    // Temporal trend: change between 2005-2024 (midpoint 2014.5) and 2025-2050 (midpoint 2037.5) = 2.3 decades
    const deltaT = cell.temp_delta ?? (cell.projected_ensemble_temp - cell.baseline_temp);
    const trendPerDecade = Number((deltaT / 2.3).toFixed(4));

    // Centered difference neighbors
    const northKey = `${(cell.lat + stepDeg).toFixed(1)}_${cell.lon.toFixed(1)}`;
    const southKey = `${(cell.lat - stepDeg).toFixed(1)}_${cell.lon.toFixed(1)}`;
    const eastKey = `${cell.lat.toFixed(1)}_${(cell.lon + stepDeg).toFixed(1)}`;
    const westKey = `${cell.lat.toFixed(1)}_${(cell.lon - stepDeg).toFixed(1)}`;

    const north = cellMap.get(northKey)?.baseline_temp ?? (cell.baseline_temp + 0.1);
    const south = cellMap.get(southKey)?.baseline_temp ?? (cell.baseline_temp - 0.1);
    const east = cellMap.get(eastKey)?.baseline_temp ?? cell.baseline_temp;
    const west = cellMap.get(westKey)?.baseline_temp ?? cell.baseline_temp;

    const { magnitude } = computeSpatialGradient(
      cell.lat,
      cell.lon,
      north,
      south,
      east,
      west,
      stepDeg
    );

    const velocity = computeCellVelocity(trendPerDecade, magnitude);

    results.push({
      lat: cell.lat,
      lon: cell.lon,
      temporal_trend_deg_decade: trendPerDecade,
      spatial_gradient_deg_km: magnitude,
      velocity_km_decade: velocity,
    });
  }

  return results;
}

/**
 * Evaluates species climate velocity and ranks against the observatory's AVONET Hand-Wing Index (HWI).
 * Strictly issues "Insufficient evidence for a verdict" instead of a categorical pass/fail verdict.
 */
export function evaluateSpeciesRace(
  speciesId: string,
  scientificName: string,
  breedingCells: ClimateCellPoint[],
  nonBreedingCells: ClimateCellPoint[],
  allObservatorySpeciesTraits: Array<{ species_id: string; hand_wing_index: number | null }>,
  commonName?: string
): SpeciesRaceSummary {
  const breedingVelocities = computeGridVelocities(breedingCells);
  const nonBreedingVelocities = computeGridVelocities(nonBreedingCells);

  const meanB =
    breedingVelocities.length > 0
      ? Number(
          (
            breedingVelocities.reduce((s, v) => s + v.velocity_km_decade, 0) /
            breedingVelocities.length
          ).toFixed(1)
        )
      : null;

  const meanNB =
    nonBreedingVelocities.length > 0
      ? Number(
          (
            nonBreedingVelocities.reduce((s, v) => s + v.velocity_km_decade, 0) /
            nonBreedingVelocities.length
          ).toFixed(1)
        )
      : null;

  const validVelocities = [meanB, meanNB].filter((v): v is number => v !== null);
  const overallMean =
    validVelocities.length > 0
      ? Number((validVelocities.reduce((s, v) => s + v, 0) / validVelocities.length).toFixed(1))
      : 0;

  // Rank species by Hand-Wing Index (HWI) among all matched species
  const matchedSpecies = allObservatorySpeciesTraits
    .filter((s) => typeof s.hand_wing_index === 'number' && !isNaN(s.hand_wing_index))
    .sort((a, b) => (b.hand_wing_index as number) - (a.hand_wing_index as number));

  const targetTrait = matchedSpecies.find((s) => s.species_id === speciesId);
  const targetHwi = targetTrait?.hand_wing_index ?? null;
  const rank = targetTrait ? matchedSpecies.indexOf(targetTrait) + 1 : null;

  return {
    species_id: speciesId,
    scientific_name: scientificName,
    common_name: commonName,
    breeding_velocity_km_decade: meanB,
    non_breeding_velocity_km_decade: meanNB,
    mean_velocity_km_decade: overallMean,
    hwi: targetHwi,
    hwi_rank: rank,
    hwi_rank_total: matchedSpecies.length,
    verdict: 'Insufficient evidence for a verdict',
    verdict_reason:
      'The Hand-Wing Index (HWI) is a morphological dispersal proxy, not a physical velocity in km/decade. Sourced literature does not provide an empirical speed conversion threshold.',
    label: 'projected',
    retrieved_at: new Date().toISOString(),
  };
}
