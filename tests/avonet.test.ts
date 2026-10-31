import { describe, it, expect } from 'vitest';
import { AVONETMatcher } from '../scripts/ingest/avonet.js';
import path from 'node:path';

describe('AVONET Dynamic Header Trait Join', () => {
  it('correctly reads headers dynamically and joins traits for known species', () => {
    const matcher = new AVONETMatcher(path.resolve('data', 'avonet'));
    matcher.load();

    // Falco amurensis (Amur falcon) should be in AVONET
    const falco = matcher.match('Falco amurensis');
    expect(falco.matched).toBe(true);
    expect(falco.hand_wing_index).toBeGreaterThan(0);
    expect(falco.migration_category).toBeDefined();
    expect(falco.source).toContain('AVONET');
  });

  it('marks unknown species as unmatched and logs them without inventing values', () => {
    const matcher = new AVONETMatcher(path.resolve('data', 'avonet'));
    matcher.load();

    const unknown = matcher.match('Fictionalis birdus');
    expect(unknown.matched).toBe(false);
    expect(unknown.hand_wing_index).toBeNull();
    expect(unknown.migration_category).toBeNull();
  });
});
