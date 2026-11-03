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
      kind: 'climate',
      data: { season, where: p.where, warming: p.warming, lostShare: p.lostShare },
      label: 'projected',
      title: `${p.where[0].toUpperCase()}${p.where.slice(1)} warms ${p.warming >= 0 ? '+' : ''}${p.warming}°C by 2050`,
      detail:
        p.lostShare > 0
          ? `${Math.round(p.lostShare * 100)}% of it turns too warm or cold by 2050.`
          : 'Stays within the temperatures it lives in today.',
      severity: p.lostShare >= 0.7 ? 'high' : p.lostShare >= 0.4 ? 'medium' : 'low',
    });
  }

  const race = analysis?.race;
  if (race?.verdict) {
    const plain = plainRaceVerdict(race.verdict);
    pressures.push({
      kind: 'race',
      data: { velocity: race.mean_velocity_km_decade, rank: race.hwi_rank, total: race.hwi_rank_total, tone: plain.tone },
      label: 'projected',
      title: plain.title,
      detail: `Climate shifts ${race.mean_velocity_km_decade} km per decade; flight ability #${race.hwi_rank} of ${race.hwi_rank_total}.`,
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
      kind: 'stopover',
      data: { name: l.name, lossPct: l.loss_percent },
      label: 'simulated',
      title: `Depends on ${l.name}`,
      detail: `Losing it cuts off ${l.loss_percent}% of reachable habitat.`,
      severity: l.loss_percent >= 48 ? 'high' : l.loss_percent >= 30 ? 'medium' : 'low',
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

/**
 * Overall climate pressure (0-100) from Outrun's own measurements, separate from the IUCN
 * listing. Weights: range loss 55 (mean share of breeding and wintering range pushed out of
 * the species' temperature range by 2050), keeping pace 25 (no = 25, partly = 12.5, yes = 0)
 * and key stopover 20 (reachable habitat cut off by its loss, scaled from 30% to 55%).
 * High >= 60, Elevated >= 45, otherwise Moderate.
 */
export function pressureLevel(pressures = []) {
  const climate = pressures.filter((p) => p.kind === 'climate');
  const race = pressures.find((p) => p.kind === 'race');
  const stop = pressures.find((p) => p.kind === 'stopover');
  const rangeLoss = climate.length ? climate.reduce((a, p) => a + p.data.lostShare, 0) / climate.length : 0;
  const pace = race ? { danger: 1, warn: 0.5, ok: 0 }[race.data.tone] ?? 0.5 : 0;
  const stopShare = stop ? Math.min(1, Math.max(0, (stop.data.lossPct - 30) / 25)) : 0;
  const parts = {
    range: Math.round(55 * rangeLoss),
    pace: Math.round(25 * pace),
    stopover: Math.round(20 * stopShare),
  };
  const score = parts.range + parts.pace + parts.stopover;
  const level = score >= 60 ? 'high' : score >= 45 ? 'elevated' : 'moderate';
  const high = pressures.filter((p) => p.severity === 'high').length;
  return { level, score, parts, high, total: pressures.length };
}

/**
 * Suggested next steps for a bird research team, each tied to a pressure or data gap
 * measured for this species. These are recommendations, not data.
 * @returns {Array<{ type: 'Protect'|'Monitor'|'Research'|'Partner', title: string, why: string }>}
 */
export function suggestActions(concern, species, { tracksSimulated = false } = {}) {
  if (!concern) return [];
  const actions = [];
  const find = (kind) => concern.pressures.filter((p) => p.kind === kind);

  for (const p of find('stopover')) {
    actions.push({
      type: 'Protect',
      title: `Protect ${p.data.name}`,
      why: `This stopover holds the flyway together: losing it would cut off ${p.data.lossPct}% of the habitat the birds can reach. Work with site managers on protection and disturbance limits, and count birds during every passage to catch declines early.`,
    });
  }

  const worst = find('climate').sort((a, b) => b.data.lostShare - a.data.lostShare)[0];
  if (worst && worst.data.lostShare >= 0.2) {
    const keep = 100 - Math.round(worst.data.lostShare * 100);
    actions.push({
      type: 'Research',
      title: 'Map climate refuges',
      why:
        worst.data.lostShare >= 0.95
          ? `All of its ${worst.data.where} turns too warm or cold by 2050. Survey nearby areas with a suitable future climate that could replace it, and start protecting the best of them.`
          : `Only ${keep}% of its ${worst.data.where} stays within its temperature range in 2050: the green areas in the Twin tab. Survey those areas now and prioritise them for long-term protection.`,
    });
  }

  const race = find('race')[0];
  if (race && race.data.tone !== 'ok') {
    actions.push({
      type: 'Protect',
      title: 'Secure stepping-stone habitat',
      why: `Suitable climate is moving about ${race.data.velocity} km per decade, ${race.data.tone === 'danger' ? 'faster than it can follow' : 'close to the limit of what it can follow'}. Protect wetlands and feeding sites along the direction of the shift so the birds have places to stop as their range moves.`,
    });
  }

  const tracked = species?.evidence_level === 'tracks' ? species.tracked_individuals || 0 : 0;
  if (tracksSimulated || !tracked) {
    actions.push({
      type: 'Monitor',
      title: 'Start GPS tracking',
      why: 'Its routes here are modelled rather than tracked. GPS tags on 20 or more birds across both seasons would confirm the real routes, stopovers and timing.',
    });
  } else if (tracked < 20) {
    actions.push({
      type: 'Monitor',
      title: 'Tag more birds',
      why: `Only ${tracked} birds carry GPS tags, which leaves its routes and timing uncertain. Tagging 20 or more across both seasons would make these estimates much firmer.`,
    });
  } else {
    actions.push({
      type: 'Monitor',
      title: 'Keep long-term tracking',
      why: `${tracked} tracked birds already give solid routes. Following them for several more years would show whether timing and stopovers shift as the climate warms.`,
    });
  }

  actions.push({
    type: 'Monitor',
    title: 'Time field checks to weather',
    why: 'Gales, heavy rain and heat at stopovers are when losses and delays are most likely. Use the Watch tab to time field checks during migration months.',
  });

  if (concern.atRisk) {
    actions.push({
      type: 'Partner',
      title: 'Share with flyway partners',
      why: 'Send tracking and climate results to IUCN assessors and the flyway agreements under the Convention on Migratory Species (CMS). Joint plans matter because these birds cross many borders.',
    });
  } else if (pressureLevel(concern.pressures).level === 'high') {
    actions.push({
      type: 'Partner',
      title: 'Flag for IUCN reassessment',
      why: 'It is listed Least Concern, but its climate pressure score is high. New tracking and climate evidence could support a request for IUCN reassessment.',
    });
  }

  // Five at most, so the list stays readable; the weather check is the first to go.
  const list = actions.length > 5 ? actions.filter((a) => a.title !== 'Time field checks to weather') : actions;
  const rank = { Protect: 0, Research: 1, Monitor: 2, Partner: 3 };
  return list.slice(0, 5).sort((a, b) => rank[a.type] - rank[b.type]);
}
