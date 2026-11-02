import { describe, it, expect } from 'vitest';
import { buildSeasonCalendar, documentedPlace } from '../src/analytics/seasonCalendar.js';
import { deriveRangeWindow, evaluateForecastRisk } from '../src/analytics/watch';

const ranges = { breeding: { lat: 65, lon: -20 }, non_breeding: { lat: -70, lon: -40 } };

// 30 fixes per month: Greenland May–Aug, Antarctic Nov–Feb, split between them otherwise.
function tracks() {
  const coords: number[][] = [];
  const times: number[] = [];
  for (let m = 0; m < 12; m++) {
    for (let i = 0; i < 30; i++) {
      const north = [4, 5, 6, 7].includes(m) || (![10, 11, 0, 1].includes(m) && i % 2 === 0);
      coords.push(north ? [-20, 65] : [-40, -70]);
      times.push(Date.UTC(2025, m, 1 + i % 27) / 1000);
    }
  }
  return { features: [{ geometry: { coordinates: coords }, properties: { times } }] };
}

describe('season calendar', () => {
  it('places each month from GPS fixes', () => {
    const months = buildSeasonCalendar(ranges, tracks());
    expect(months[6]).toEqual({ place: 'breeding', source: 'tracks' });
    expect(months[11]).toEqual({ place: 'non_breeding', source: 'tracks' });
    expect(months[9].place).toBe('migrating');
  });

  it('falls back to the documented cycle without tracks, flipped for southern breeders', () => {
    const months = buildSeasonCalendar(ranges, null);
    expect(months[11]).toEqual({ place: 'non_breeding', source: 'documented' });
    expect(documentedPlace(11, true)).toBe('breeding');
  });
});

describe('Watch gating by range', () => {
  const months = buildSeasonCalendar(ranges, tracks());

  it('Arctic Tern in November: breeding range is out of season, wintering range is in', () => {
    const greenland = deriveRangeWindow(months, 'breeding', 11);
    expect(greenland.isCurrentMonthActive).toBe(false);
    expect(greenland.currentPlace).toBe('non_breeding');
    expect(deriveRangeWindow(months, 'non_breeding', 11).isCurrentMonthActive).toBe(true);
  });

  it('does not flag weather risk where the bird is not, and flags it where it is', () => {
    const gale = { wind_speed_10m: 80, temperature_2m: 2, precipitation: 0 };
    const out = evaluateForecastRisk('sterna_paradisaea', gale, deriveRangeWindow(months, 'breeding', 11));
    expect(out.forecast_risk).toBe(false);
    expect(out.summary).toContain('Not usually here in November');
    const inn = evaluateForecastRisk('sterna_paradisaea', gale, deriveRangeWindow(months, 'non_breeding', 11));
    expect(inn.forecast_risk).toBe(true);
    expect(inn.summary).toContain('Strong wind: 80 km/h (limit 54 km/h)');
  });
});
