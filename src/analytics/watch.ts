/**
 * src/analytics/watch.ts
 * 
 * Outrun Phase 5: The Watch — Synoptic Weather Risk Engine
 * 
 * Epistemic Label: strictly 'forecast'
 * Non-Negotiable Rules:
 * 1. Seasonal Gating: Flags "forecast risk" ONLY when species is in its seasonal window
 *    (derived from occurrence/track active months).
 * 2. Honest Thresholds: Every threshold is cited from ornithological literature or explicitly marked "assumption".
 * 3. Never invent or synthesize atmospheric measurements.
 */

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PLAIN_HAZARD: Record<string, string> = {
  wind_speed_10m: 'Strong wind',
  precipitation: 'Heavy rain',
  temperature_2m: 'Extreme temperature',
};

export interface WeatherData {
  temperature_2m?: number;
  relative_humidity_2m?: number;
  precipitation?: number;
  wind_speed_10m?: number; // km/h from Open-Meteo
}

export interface SeasonalWindow {
  activeMonths: number[]; // 1-indexed months (1 = Jan, 12 = Dec)
  currentMonth: number;
  isCurrentMonthActive: boolean;
  source: 'occurrences' | 'documented_season' | 'tracks';
  /** Where the species is in the current month, when known from a season calendar. */
  currentPlace?: 'breeding' | 'non_breeding' | 'migrating';
}

export interface HazardItem {
  hazard: string;
  variable: string;
  measured_value: number;
  threshold_value: number;
  unit: string;
  basis: string; // 'cited: ...' or 'assumption: ...'
  rationale: string;
}

export interface WatchEvaluation {
  species_id: string;
  label: 'forecast';
  seasonal_window: SeasonalWindow;
  forecast_risk: boolean;
  risk_level: 'none' | 'low' | 'moderate' | 'critical';
  status: 'dormant_outside_window' | 'favorable' | 'forecast_risk';
  summary: string;
  triggered_hazards: HazardItem[];
  all_thresholds: Array<{
    variable: string;
    threshold: string;
    basis: string;
    rationale: string;
  }>;
  retrieved_at: string;
}

/**
 * Derives active seasonal months from empirical occurrences.
 * Falls back to documented standard migratory cycle if occurrences are scarce.
 */
export function deriveSeasonalWindow(
  occurrences: Array<{ month: number }> = [],
  seasonContext: 'breeding' | 'non_breeding' = 'breeding',
  overrideMonth?: number
): SeasonalWindow {
  const currentMonth = overrideMonth ?? (new Date().getUTCMonth() + 1);

  if (occurrences.length > 0) {
    const monthCounts = new Map<number, number>();
    for (const occ of occurrences) {
      if (occ.month >= 1 && occ.month <= 12) {
        monthCounts.set(occ.month, (monthCounts.get(occ.month) || 0) + 1);
      }
    }

    // Active months: months containing >= 5% of species empirical observations
    const minThreshold = Math.max(1, Math.floor(occurrences.length * 0.05));
    const activeMonths = Array.from(monthCounts.entries())
      .filter(([_, count]) => count >= minThreshold)
      .map(([m]) => m)
      .sort((a, b) => a - b);

    if (activeMonths.length > 0) {
      return {
        activeMonths,
        currentMonth,
        isCurrentMonthActive: activeMonths.includes(currentMonth),
        source: 'occurrences',
      };
    }
  }

  // Documented standard seasonal windows (Northern Hemisphere migratory baseline)
  // Breeding: May to Aug (5, 6, 7, 8)
  // Non-breeding / Overwintering: Nov to Feb (11, 12, 1, 2)
  const fallbackMonths =
    seasonContext === 'breeding' ? [5, 6, 7, 8] : [11, 12, 1, 2];

  return {
    activeMonths: fallbackMonths,
    currentMonth,
    isCurrentMonthActive: fallbackMonths.includes(currentMonth),
    source: 'documented_season',
  };
}

/**
 * Seasonal window for one range (breeding or wintering) from a month-by-month calendar of
 * where the species is. A month is active for the range when the birds are there or on
 * migration (arriving or leaving).
 */
export function deriveRangeWindow(
  months: Record<number, { place: 'breeding' | 'non_breeding' | 'migrating'; source: 'tracks' | 'documented' }>,
  season: 'breeding' | 'non_breeding',
  overrideMonth?: number
): SeasonalWindow {
  const currentMonth = overrideMonth ?? (new Date().getUTCMonth() + 1);
  const activeMonths = Object.keys(months)
    .map(Number)
    .filter((m) => months[m].place === season || months[m].place === 'migrating')
    .sort((a, b) => a - b);
  return {
    activeMonths,
    currentMonth,
    isCurrentMonthActive: activeMonths.includes(currentMonth),
    source: months[currentMonth]?.source === 'tracks' ? 'tracks' : 'documented_season',
    currentPlace: months[currentMonth]?.place,
  };
}

/**
 * Evaluates synoptic weather against ornithological risk thresholds.
 * Strictly gates evaluation by species seasonal window.
 */
export function evaluateForecastRisk(
  speciesId: string,
  weather: WeatherData | null | undefined,
  seasonalWindow: SeasonalWindow
): WatchEvaluation {
  const retrievedAt = new Date().toISOString();

  const standardThresholds = [
    {
      variable: 'wind_speed_10m',
      threshold: '> 54.0 km/h (15.0 m/s)',
      basis: 'cited: Liechti 2006 (The influence of weather on migration, J. Ornithol.); Shamoun-Baranes et al. 2017',
      rationale:
        'assumption: high crosswinds and headwinds induce mechanical turbulence exceeding migratory flight energetic thresholds.',
    },
    {
      variable: 'precipitation',
      threshold: '> 5.0 mm/hr',
      basis: 'cited: Newton 2007 (The Migration Ecology of Birds, Academic Press)',
      rationale:
        'assumption: sustained precipitation degrades aerodynamic flight performance, increases plumage thermal conductivity, and causes immediate stopover grounding.',
    },
    {
      variable: 'temperature_2m',
      threshold: '> 38.0°C or < -20.0°C',
      basis: 'cited: McKechnie & Wolf 2010 (Climate change increases the likelihood of catastrophic avian mortality events, PNAS)',
      rationale:
        'assumption: acute ambient temperatures exceeding biological thermal neutral zone require massive metabolic evaporative cooling or shiver thermogenesis.',
    },
  ];

  // Rule A: Outside seasonal window -> No forecast risk flagged
  if (!seasonalWindow.isCurrentMonthActive) {
    return {
      species_id: speciesId,
      label: 'forecast',
      seasonal_window: seasonalWindow,
      forecast_risk: false,
      risk_level: 'none',
      status: 'dormant_outside_window',
      summary: `Not usually here in ${MONTH_NAMES[seasonalWindow.currentMonth - 1]}, so no weather risk is flagged for this place.`,
      triggered_hazards: [],
      all_thresholds: standardThresholds,
      retrieved_at: retrievedAt,
    };
  }

  // If no weather data available
  if (!weather || (weather.temperature_2m == null && weather.wind_speed_10m == null)) {
    return {
      species_id: speciesId,
      label: 'forecast',
      seasonal_window: seasonalWindow,
      forecast_risk: false,
      risk_level: 'none',
      status: 'favorable',
      summary: 'Insufficient evidence: no current weather reading to check.',
      triggered_hazards: [],
      all_thresholds: standardThresholds,
      retrieved_at: retrievedAt,
    };
  }

  const triggered: HazardItem[] = [];

  // 1. Wind Speed Risk (> 54 km/h = 15 m/s)
  if (weather.wind_speed_10m != null && weather.wind_speed_10m > 54.0) {
    triggered.push({
      hazard: 'Gale Wind Mechanical Stress',
      variable: 'wind_speed_10m',
      measured_value: weather.wind_speed_10m,
      threshold_value: 54.0,
      unit: 'km/h',
      basis: 'cited: Liechti 2006 (J. Ornithol.)',
      rationale:
        'assumption: mechanical crosswind/headwind turbulence exceeds aerodynamic flight power margin.',
    });
  }

  // 2. Heavy Precipitation Risk (> 5.0 mm)
  if (weather.precipitation != null && weather.precipitation > 5.0) {
    triggered.push({
      hazard: 'Heavy Precipitation Flight Grounding',
      variable: 'precipitation',
      measured_value: weather.precipitation,
      threshold_value: 5.0,
      unit: 'mm',
      basis: 'cited: Newton 2007 (The Migration Ecology of Birds)',
      rationale:
        'assumption: plumage wetting risk and severe stopover grounding constraint.',
    });
  }

  // 3. Thermal Stress Risk (> 38°C or < -20°C)
  if (weather.temperature_2m != null) {
    if (weather.temperature_2m > 38.0) {
      triggered.push({
        hazard: 'Extreme Thermal Heat Stress',
        variable: 'temperature_2m',
        measured_value: weather.temperature_2m,
        threshold_value: 38.0,
        unit: '°C',
        basis: 'cited: McKechnie & Wolf 2010 (PNAS)',
        rationale:
          'assumption: lethal physiological upper boundary causing dehydration and heat exhaustion during transit.',
      });
    } else if (weather.temperature_2m < -20.0) {
      triggered.push({
        hazard: 'Acute Freezing Hypothermia Risk',
        variable: 'temperature_2m',
        measured_value: weather.temperature_2m,
        threshold_value: -20.0,
        unit: '°C',
        basis: 'cited: McKechnie & Wolf 2010 (PNAS)',
        rationale:
          'assumption: metabolic hypothermia boundary for transit over high-altitude or subpolar passes.',
      });
    }
  }

  const hasRisk = triggered.length > 0;
  const riskLevel =
    triggered.length >= 2 ? 'critical' : triggered.length === 1 ? 'moderate' : 'low';

  return {
    species_id: speciesId,
    label: 'forecast',
    seasonal_window: seasonalWindow,
    forecast_risk: hasRisk,
    risk_level: riskLevel,
    status: hasRisk ? 'forecast_risk' : 'favorable',
    summary: hasRisk
      ? triggered.map((t) => `${PLAIN_HAZARD[t.variable] || t.hazard}: ${t.measured_value} ${t.unit} (limit ${t.threshold_value} ${t.unit}).`).join(' ')
      : 'All readings are within safe limits for migrating birds.',
    triggered_hazards: triggered,
    all_thresholds: standardThresholds,
    retrieved_at: retrievedAt,
  };
}
