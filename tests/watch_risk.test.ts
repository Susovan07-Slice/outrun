/**
 * tests/watch_risk.test.ts
 * 
 * Tests for The Watch synoptic weather risk engine and seasonal gating.
 */

import { describe, it, expect } from 'vitest';
import { deriveSeasonalWindow, evaluateForecastRisk } from '../src/analytics/watch.js';

describe('The Watch: Synoptic Forecast Risk & Seasonal Gating', () => {
  it('correctly derives seasonal window from empirical occurrence months', () => {
    const occurrences = [
      { month: 5 }, { month: 5 }, { month: 6 }, { month: 6 },
      { month: 7 }, { month: 7 }, { month: 8 }, { month: 8 },
    ];

    const windowMay = deriveSeasonalWindow(occurrences, 'breeding', 5);
    expect(windowMay.isCurrentMonthActive).toBe(true);
    expect(windowMay.activeMonths).toContain(5);
    expect(windowMay.activeMonths).toContain(8);

    const windowDec = deriveSeasonalWindow(occurrences, 'breeding', 12);
    expect(windowDec.isCurrentMonthActive).toBe(false);
  });

  it('unflags hazards when outside the active seasonal window (seasonal gating)', () => {
    // Current month = 12 (December), species active in months 5-8
    const seasonalWindow = {
      activeMonths: [5, 6, 7, 8],
      currentMonth: 12,
      isCurrentMonthActive: false,
      source: 'documented_season' as const,
    };

    // Even under severe gale conditions, if the bird is not there, no forecast risk should be triggered
    const severeWeather = {
      temperature_2m: 42.0, // severe heat
      wind_speed_10m: 75.0, // severe gale
      precipitation: 25.0,  // severe downpour
    };

    const evaluation = evaluateForecastRisk('falco_amurensis', severeWeather, seasonalWindow);

    expect(evaluation.forecast_risk).toBe(false);
    expect(evaluation.risk_level).toBe('none');
    expect(evaluation.status).toBe('dormant_outside_window');
    expect(evaluation.triggered_hazards).toHaveLength(0);
  });

  it('flags forecast risk when in seasonal window and wind speed exceeds 54 km/h', () => {
    const seasonalWindow = {
      activeMonths: [5, 6, 7, 8],
      currentMonth: 6, // June (Active)
      isCurrentMonthActive: true,
      source: 'documented_season' as const,
    };

    const windyWeather = {
      temperature_2m: 22.0,
      wind_speed_10m: 62.0, // > 54 km/h threshold
      precipitation: 0.0,
    };

    const evaluation = evaluateForecastRisk('ciconia_ciconia', windyWeather, seasonalWindow);

    expect(evaluation.forecast_risk).toBe(true);
    expect(evaluation.risk_level).toBe('moderate');
    expect(evaluation.triggered_hazards).toHaveLength(1);
    expect(evaluation.triggered_hazards[0].hazard).toBe('Gale Wind Mechanical Stress');
    expect(evaluation.triggered_hazards[0].basis).toContain('Liechti 2006');
    expect(evaluation.triggered_hazards[0].rationale).toContain('assumption');
  });

  it('flags thermal stress when temperature exceeds 38°C or drops below -20°C', () => {
    const seasonalWindow = {
      activeMonths: [1, 2, 11, 12],
      currentMonth: 1, // January (Active)
      isCurrentMonthActive: true,
      source: 'documented_season' as const,
    };

    const extremeColdWeather = {
      temperature_2m: -25.0, // < -20°C
      wind_speed_10m: 15.0,
      precipitation: 0.0,
    };

    const evaluation = evaluateForecastRisk('anser_indicus', extremeColdWeather, seasonalWindow);

    expect(evaluation.forecast_risk).toBe(true);
    expect(evaluation.triggered_hazards[0].hazard).toContain('Hypothermia');
    expect(evaluation.triggered_hazards[0].basis).toContain('McKechnie & Wolf 2010');
  });

  it('ensures all evaluated thresholds are cited or explicitly labeled as assumptions', () => {
    const seasonalWindow = {
      activeMonths: [5, 6, 7, 8],
      currentMonth: 6,
      isCurrentMonthActive: true,
      source: 'documented_season' as const,
    };

    const evaluation = evaluateForecastRisk('pandion_haliaetus', {}, seasonalWindow);

    expect(evaluation.all_thresholds.length).toBeGreaterThanOrEqual(3);
    for (const t of evaluation.all_thresholds) {
      expect(t.basis).toMatch(/^cited:/);
      expect(t.rationale).toMatch(/^assumption:/);
    }
  });
});
