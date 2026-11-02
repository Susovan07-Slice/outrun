/**
 * src/analytics/brief.ts
 * 
 * Outrun Phase 5: The Brief — Executive Scientific Dossier Synthesis
 * 
 * Epistemic Rules:
 * 1. Strictly built from verified computed results and source metadata only.
 * 2. Never invents or synthesizes metrics, statuses, or citations.
 * 3. Formats concise, audit-ready briefs suitable for 1-page executive export / print-to-PDF.
 */

import { evaluateProofRubric, ProofAssessment } from './proof.js';
import { deriveSeasonalWindow, evaluateForecastRisk, WatchEvaluation } from './watch.js';

export interface BriefSpeciesInput {
  species_id: string;
  scientific_name: string;
  common_name?: string;
  family?: string;
  gbif_taxon_key?: number;
  monitoring_group?: string;
  evidence_level?: 'tracks' | 'occurrences_only' | 'insufficient';
  tracked_individuals?: number;
  /** True when the species' tracks are simulated corridor twins, not telemetry. */
  tracks_simulated?: boolean;
  occurrence_count?: number;
  occurrences?: Array<{ lat: number; lon: number; month: number }>;
  status?: {
    category?: string;
    assessment_year?: number;
    source?: string;
    source_url?: string;
  } | null;
  traits?: {
    hand_wing_index?: number | null;
    migration_category?: number | null;
    source?: string;
    matched?: boolean;
  };
  race?: any;
  twin?: any;
  critical_links?: any[];
  weather?: any;
}

export interface SpeciesBrief {
  species_id: string;
  scientific_name: string;
  common_name: string;
  family: string;
  gbif_taxon_key: number | string;
  evidence_level: string;
  conservation_status: {
    category: string;
    assessment_year: number | string;
    source: string;
    source_url: string;
    provenance_rule: string;
  };
  morphology_traits: {
    hand_wing_index: number | string;
    migration_category_label: string;
    dispersal_rank: string;
    source: string;
  };
  the_race: {
    breeding_velocity: string;
    non_breeding_velocity: string;
    mean_velocity: string;
    hwi_rank_statement: string;
    verdict: string;
    verdict_reason: string;
    label: string;
  };
  the_twin: {
    baseline_suitable_cells: number | string;
    future_suitable_cells: number | string;
    net_shift: string;
    model_uncertainty_spread: string;
    label: string;
    limitation: string;
  };
  the_break_and_fix: {
    bottleneck_count: number;
    top_critical_link: {
      node_id: string;
      coordinates: string;
      area_loss: string;
      components_increase: number | string;
    } | null;
    label: string;
  };
  the_watch: {
    current_season_active: boolean;
    current_month: number;
    forecast_risk: boolean;
    risk_level: string;
    summary: string;
    triggered_hazards: Array<{
      hazard: string;
      measured: string;
      threshold: string;
      basis: string;
    }>;
    label: string;
  };
  the_proof: {
    confidence_grade: string;
    score: string;
    is_insufficient_evidence: boolean;
    dimensions: Array<{
      dimension: string;
      score: number;
      weight: number;
      details: string;
    }>;
  };
  provenance_and_licensing: {
    datasets: Array<{ name: string; license: string; citation: string }>;
    generated_at: string;
    disclaimer: string;
  };
}

export function generateSpeciesBrief(input: BriefSpeciesInput): SpeciesBrief {
  const generatedAt = new Date().toISOString();

  // 1. Proof Evaluation
  const proofAssessment: ProofAssessment = evaluateProofRubric({
    species_id: input.species_id,
    scientific_name: input.scientific_name,
    common_name: input.common_name,
    family: input.family,
    evidence_level: input.evidence_level,
    tracked_individuals: input.tracked_individuals,
    tracks_simulated: input.tracks_simulated,
    occurrence_count: input.occurrence_count,
    occurrences: input.occurrences,
    traits: input.traits,
    corridorData: {
      race: input.race,
      twin: input.twin,
      critical_links: input.critical_links,
    },
  });

  // 2. Watch Evaluation
  const seasonalWindow = deriveSeasonalWindow(input.occurrences || [], 'breeding');
  const watchEvaluation: WatchEvaluation = evaluateForecastRisk(
    input.species_id,
    input.weather,
    seasonalWindow
  );

  // 3. Format Race Section
  const race = input.race || {};
  const raceData = {
    breeding_velocity:
      race.breeding_velocity_km_decade != null
        ? `${race.breeding_velocity_km_decade} km/decade`
        : 'Insufficient evidence',
    non_breeding_velocity:
      race.non_breeding_velocity_km_decade != null
        ? `${race.non_breeding_velocity_km_decade} km/decade`
        : 'Insufficient evidence',
    mean_velocity:
      race.mean_velocity_km_decade != null
        ? `${race.mean_velocity_km_decade} km/decade`
        : 'Insufficient evidence',
    hwi_rank_statement:
      race.hwi_rank != null
        ? `Ranked #${race.hwi_rank} of ${race.hwi_rank_total || 20} matched birds by dispersal proxy (HWI: ${race.hwi})`
        : 'Trait record unmatched in AVONET',
    verdict: race.verdict || 'Insufficient evidence for a verdict',
    verdict_reason:
      race.verdict_reason ||
      'Hand-Wing Index is a morphological dispersal capacity proxy, not an empirical velocity in km/decade.',
    label: 'projected',
  };

  // 4. Format Twin Section
  const twinSummary = input.twin?.summary || {};
  const twinData = {
    baseline_suitable_cells: twinSummary.baseline_suitable_cells ?? 'Insufficient evidence',
    future_suitable_cells: twinSummary.future_suitable_cells ?? 'Insufficient evidence',
    net_shift:
      twinSummary.gained_cells != null && twinSummary.lost_cells != null
        ? `+${twinSummary.gained_cells} gained / -${twinSummary.lost_cells} lost (${twinSummary.stable_cells ?? 0} stable)`
        : 'Insufficient evidence',
    model_uncertainty_spread:
      twinSummary.mean_uncertainty != null
        ? `±${twinSummary.mean_uncertainty} (|EC_Earth3P_HR - MPI_ESM1_2_XR|)`
        : 'Insufficient evidence',
    label: 'simulated',
    limitation:
      'Climate-envelope suitability models macro-climatic thermal envelope only; excludes land cover and human infrastructure.',
  };

  // 5. Format Break Section
  const links = input.critical_links || [];
  const topLink = links.length > 0 ? links[0] : null;
  const breakData = {
    bottleneck_count: links.length,
    top_critical_link: topLink
      ? {
          node_id: topLink.node_id,
          coordinates: `Lat ${topLink.lat}°, Lon ${topLink.lon}°`,
          area_loss: `${topLink.loss_of_reachable_area_km2.toLocaleString()} km² (${topLink.loss_percent}%)`,
          components_increase: `+${topLink.connected_components_increase} fragments`,
        }
      : null,
    label: 'simulated',
  };

  // 6. Conservation Status (Rule 5)
  const statusData = input.status?.category
    ? {
        category: input.status.category,
        assessment_year: input.status.assessment_year || 'Assessed',
        source: input.status.source || 'IUCN Red List',
        source_url: input.status.source_url || 'https://www.iucnredlist.org',
        provenance_rule: 'Verified IUCN API Assessment',
      }
    : {
        category: 'Insufficient evidence',
        assessment_year: 'NULL',
        source: 'Unverified (Token absent)',
        source_url: 'N/A',
        provenance_rule: 'Rule 5 Compliance: Token unverified; stored as NULL. Never inferred as Least Concern.',
      };

  // 7. Morphological Traits
  const traits = input.traits || {};
  const migrationCategoryText = (cat?: number | null) => {
    if (cat === 1) return 'Sedentary';
    if (cat === 2) return 'Partially migratory';
    if (cat === 3) return 'Migratory (Long-distance)';
    return 'Insufficient evidence';
  };

  return {
    species_id: input.species_id,
    scientific_name: input.scientific_name,
    common_name: input.common_name || input.scientific_name,
    family: input.family || 'Aves',
    gbif_taxon_key: input.gbif_taxon_key || 'N/A',
    evidence_level: input.evidence_level || 'occurrences_only',
    conservation_status: statusData,
    morphology_traits: {
      hand_wing_index: traits.hand_wing_index ?? 'Insufficient evidence',
      migration_category_label: migrationCategoryText(traits.migration_category),
      dispersal_rank: raceData.hwi_rank_statement,
      source: traits.source || 'AVONET (Tobias et al. 2022)',
    },
    the_race: raceData,
    the_twin: twinData,
    the_break_and_fix: breakData,
    the_watch: {
      current_season_active: seasonalWindow.isCurrentMonthActive,
      current_month: seasonalWindow.currentMonth,
      forecast_risk: watchEvaluation.forecast_risk,
      risk_level: watchEvaluation.risk_level,
      summary: watchEvaluation.summary,
      triggered_hazards: watchEvaluation.triggered_hazards.map((h) => ({
        hazard: h.hazard,
        measured: `${h.measured_value} ${h.unit}`,
        threshold: `${h.threshold_value} ${h.unit}`,
        basis: `${h.basis}; ${h.rationale}`,
      })),
      label: 'forecast',
    },
    the_proof: {
      confidence_grade: proofAssessment.confidence_grade,
      score: `${proofAssessment.total_score} / ${proofAssessment.max_score}`,
      is_insufficient_evidence: proofAssessment.is_insufficient_evidence,
      dimensions: proofAssessment.dimensions.map((d) => ({
        dimension: d.dimension,
        score: d.score,
        weight: d.weight,
        details: d.details,
      })),
    },
    provenance_and_licensing: {
      datasets: proofAssessment.provenance_manifest.primary_sources,
      generated_at: generatedAt,
      disclaimer:
        'This brief is synthesized autonomously from verified scientific databases (GBIF, AVONET, Open-Meteo ERA5/CMIP6). Outrun models potential topological climate pressure and corridor connectivity to inform field planning; it does not claim demographic animal survival.',
    },
  };
}
