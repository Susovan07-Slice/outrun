import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';

describe('Persistent Weather Fallback Mechanism', () => {
  it('persists real live Open-Meteo snapshots in D1 across Worker restarts', () => {
    const raw = execSync('python "scripts/test_weather_persistence.py" get falco_amurensis', {
      encoding: 'utf-8',
    }).trim();

    const snapshot = JSON.parse(raw);
    expect(snapshot.success).toBe(true);
    expect(snapshot.species_id).toBe('falco_amurensis');
    expect(snapshot.weather.temperature_2m).toBeDefined();
    expect(typeof snapshot.weather.temperature_2m).toBe('number');
    expect(snapshot.retrieved_at).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it('strictly returns "No cached data" when no cached response exists, never invented numbers', () => {
    const raw = execSync('python "scripts/test_weather_persistence.py" get fictional_bird', {
      encoding: 'utf-8',
    }).trim();

    const payload = JSON.parse(raw);
    expect(payload.success).toBe(false);
    expect(payload.message).toBe('No cached data');
    expect(payload.source).toBe('fallback');
    expect(payload.weather).toBeUndefined();
  });
});
