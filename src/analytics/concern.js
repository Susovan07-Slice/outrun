/**
 * Why a species is of conservation concern.
 *
 * Two honest parts, never invented threat text:
 * 1. The IUCN listing itself: the official meaning of the category, with a link to the
 *    assessment (which holds the documented threats).
 * 2. Pressures Outrun measures for this species from its own data, each with its
 *    epistemic label: range warming (ERA5 -> CMIP6), share of range cells pushed out of the
 *    species' thermal envelope by 2050, the climate-velocity vs dispersal verdict, and the
 *    flyway bottleneck whose loss would cut off the most habitat.
 */

import { loadClimateGrid } from './twinEnrich';
import { deriveClimateEnvelope, evaluateTwinSuitability } from './twin';
import { plainRaceVerdict } from '../CorridorPanel';

export const THREATENED = ['CR', 'EN', 'VU', 'NT'];

// IUCN Red List category definitions (IUCN 2012, Categories and Criteria v3.1).
export const IUCN_MEANING = {
  CR: 'Critically Endangered: faces an extremely high risk of extinction in the wild.',
  EN: 'Endangered: faces a very high risk of extinction in the wild.',
  VU: 'Vulnerable: faces a high risk of extinction in the wild.',
  NT: 'Near Threatened: close to qualifying for a threatened category, or likely to qualify in the near future.',
  LC: 'Least Concern: does not qualify for a threatened or Near Threatened category.',
};

const SEASON_NAME = { breeding: 'breeding range', non_breeding: 'wintering range' };

let corridorPromise = null;
function loadCorridor() {
  if (!corridorPromise) {
    corridorPromise = fetch('./data/generated/corridor_analysis.json')
      .then((r) => (r.ok ? r.json() : null))
      .catch(() => null);
  }
  return corridorPromise;
}

const median = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.floor(s.length / 2)] : null;
};

function climatePressure(gridSeason, speciesId, season) {
  const cells = gridSeason?.cells || [];
  const baseKey = season === 'breeding' ? 'era5_breeding_mean_temp' : 'era5_nonbreeding_mean_temp';
  const futKey = season === 'breeding' ? 'cmip6_breeding_ensemble_temp' : 'cmip6_nonbreeding_ensemble_temp';
  const base = cells.map((c) => c[baseKey]).filter(Number.isFinite);
  const fut = cells.map((c) => c[futKey]).filter(Number.isFinite);
  if (base.length < 3 || fut.length < 3) return null;
  const envelope = deriveClimateEnvelope(speciesId, season, base);
  const result = evaluateTwinSuitability(speciesId, season, envelope, cells);
  const { baseline_suitable_cells: now, lost_cells: lost } = result.summary;
  return {
    season,
    where: SEASON_NAME[season],
    warming: Number((median(fut) - median(base)).toFixed(1)),
    cells: cells.length,
    lostShare: now > 0 ? lost / now : 0,
  };
}

export async function loadConcern(species) {
  const id = species?.species_id;
  const category = species?.status?.category || null;
  if (!id) return null;

  const [grid, corridor] = await Promise.all([loadClimateGrid(), loadCorridor()]);
  const seasons = grid?.species?.[id]?.seasons || {};
  const analysis = corridor?.species?.[id];
  const pressures = [];

  for (const season of ['breeding', 'non_breeding']) {
    const p = climatePressure(seasons[season], id, season);
    if (!p) continue;
    pressures.push({
      label: 'projected',
      title: `${p.where[0].toUpperCase()}${p.where.slice(1)} warms ${p.warming >= 0 ? '+' : ''}${p.warming}°C by 2050`,
      detail:
        p.lostShare > 0
          ? `${Math.round(p.lostShare * 100)}% of its ${p.where} becomes too warm or too cold for it by 2050.`
          : `Its ${p.where} stays within the temperatures it lives in today.`,
      severity: p.lostShare >= 0.5 ? 'high' : p.lostShare >= 0.2 ? 'medium' : 'low',
    });
  }

  const race = analysis?.race;
  if (race?.verdict) {
    const plain = plainRaceVerdict(race.verdict);
    pressures.push({
      label: 'projected',
      title: plain.title,
      detail: `Suitable climate shifts about ${race.mean_velocity_km_decade} km per decade; its flight ability ranks #${race.hwi_rank} of ${race.hwi_rank_total} species here.`,
      severity: plain.tone === 'danger' ? 'high' : plain.tone === 'warn' ? 'medium' : 'low',
    });
  }

  const links = [
    ...(analysis?.break?.breeding_critical_links || []),
    ...(analysis?.break?.non_breeding_critical_links || []),
  ].sort((a, b) => (b.loss_percent || 0) - (a.loss_percent || 0));
  if (links[0]) {
    const l = links[0];
    pressures.push({
      label: 'simulated',
      title: `Depends on ${l.name}`,
      detail: `Losing this stopover would cut off ${l.loss_percent}% of the habitat it can reach.`,
      severity: l.loss_percent >= 30 ? 'high' : 'medium',
    });
  }

  const order = { high: 0, medium: 1, low: 2 };
  pressures.sort((a, b) => order[a.severity] - order[b.severity]);

  return {
    category,
    atRisk: THREATENED.includes(category),
    meaning: category
      ? IUCN_MEANING[category] || category
      : 'Insufficient evidence: no verified IUCN assessment, so no status is assumed.',
    authority: species.status?.authority,
    year: species.status?.assessment_year,
    source_url: species.status?.source_url,
    pressures,
  };
}
