import { describe, it, expect } from 'vitest';
import { simulateStopoverProtection } from '../src/analytics/breakFix';

const links = [
  { node_id: 'a', loss_percent: 50, connected_components_increase: 2 },
  { node_id: 'b', loss_percent: 40, connected_components_increase: 1 },
  { node_id: 'c', loss_percent: 20, connected_components_increase: 1 },
];
const run = (ids: string[]) => simulateStopoverProtection('sp', 'breeding', 100000, links, ids);

describe('simulateStopoverProtection', () => {
  it('starts from all stopovers lost, compounding losses', () => {
    const r = run([]);
    expect(r.baseline.reachable_suitable_area_km2).toBe(24000); // 100000 * 0.5 * 0.6 * 0.8
    expect(r.baseline.connected_components).toBe(5);
    expect(r.difference.reachable_area_delta_km2).toBe(0);
  });

  it('gains grow with each stopover protected and cap at the flyway total', () => {
    const one = run(['a']).result.reachable_suitable_area_km2;
    const two = run(['a', 'b']).result.reachable_suitable_area_km2;
    const all = run(['a', 'b', 'c']);
    expect(one).toBe(48000);
    expect(two).toBe(80000);
    expect(all.result.reachable_suitable_area_km2).toBe(100000);
    expect(all.result.connected_components).toBe(1);
  });

  it('ignores ids that are not key stopovers', () => {
    expect(run(['zzz']).difference.reachable_area_delta_km2).toBe(0);
  });
});
