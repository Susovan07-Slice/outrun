/**
 * Fills in the Twin's thermal envelope and suitability summary when the corridor analysis
 * only carries per-cell scores (the bundled offline data does).
 *
 * - Envelope: 5th–95th percentiles of the ERA5 seasonal mean temperature across the species'
 *   own seasonal range cells in climate_grid.json, with the CMIP6 ensemble median for 2050.
 * - Summary: counts over the same twin cells the map draws (score >= 0.5 = suitable).
 * Nothing is invented: if the inputs are missing, the fields stay absent and the UI shows
 * "Insufficient evidence".
 */

const MIN_ENVELOPE_CELLS = 3;
const DISCLAIMER =
  'Climate-envelope suitability models atmospheric niche compatibility only. It does not account for land cover, human infrastructure, food availability, or wetlands loss.';

let gridPromise = null;
export function loadClimateGrid() {
  if (!gridPromise) {
    gridPromise = fetch('./data/generated/climate_grid.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return gridPromise;
}

function percentile(sorted, p) {
  if (sorted.length === 0) return null;
  const idx = (p / 100) * (sorted.length - 1);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  const v = sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
  return Number(v.toFixed(1));
}

function envelopeFromGrid(gridSeason, season) {
  const cells = gridSeason?.cells || [];
  const baseKey = season === 'breeding' ? 'era5_breeding_mean_temp' : 'era5_nonbreeding_mean_temp';
  const futureKey = season === 'breeding' ? 'cmip6_breeding_ensemble_temp' : 'cmip6_nonbreeding_ensemble_temp';
  const base = cells.map((c) => c[baseKey] ?? c.era5_mean_temp).filter(Number.isFinite).sort((a, b) => a - b);
  if (base.length < MIN_ENVELOPE_CELLS) return null;
  const future = cells.map((c) => c[futureKey] ?? c.cmip6_ensemble_mean_temp).filter(Number.isFinite).sort((a, b) => a - b);
  return {
    p05: percentile(base, 5),
    p10: percentile(base, 10),
    p50: percentile(base, 50),
    p90: percentile(base, 90),
    p95: percentile(base, 95),
    future_p50: future.length >= MIN_ENVELOPE_CELLS ? percentile(future, 50) : null,
    sample_size: base.length,
    source: `ERA5 2005–2024 seasonal means across ${base.length} range cells (5° grid)`,
  };
}

function summaryFromCells(twin) {
  const cells = twin?.cells || [];
  if (cells.length === 0) return null;
  const base = (c) => c.baseline_suitability >= 0.5;
  const fut = (c) => (c.future_suitability ?? c.future_ensemble_suitability) >= 0.5;
  const spreads = cells.map((c) => c.uncertainty ?? c.uncertainty_spread).filter(Number.isFinite);
  const meanSpread = Number.isFinite(twin.model_spread_uncertainty)
    ? twin.model_spread_uncertainty
    : spreads.length
      ? spreads.reduce((a, b) => a + b, 0) / spreads.length
      : null;
  return {
    baseline_suitable_cells: cells.filter(base).length,
    future_suitable_cells: cells.filter(fut).length,
    stable_cells: cells.filter((c) => base(c) && fut(c)).length,
    gained_cells: cells.filter((c) => !base(c) && fut(c)).length,
    lost_cells: cells.filter((c) => base(c) && !fut(c)).length,
    total_cells: cells.length,
    mean_uncertainty: meanSpread != null ? Number(meanSpread.toFixed(2)) : null,
  };
}

export async function enrichTwin(twin, speciesId, season) {
  if (!twin) return twin;
  const out = { ...twin };
  if (!out.summary) out.summary = summaryFromCells(twin);
  if (!out.envelope) {
    const grid = await loadClimateGrid();
    out.envelope = envelopeFromGrid(grid?.species?.[speciesId]?.seasons?.[season], season);
  }
  if (!out.disclaimer) out.disclaimer = DISCLAIMER;
  return out;
}
