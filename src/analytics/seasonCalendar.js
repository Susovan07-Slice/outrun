/**
 * Where a species is in each month of the year: its breeding range, its wintering range, or on
 * migration between them.
 *
 * - Ranges: centres of the species' breeding and non-breeding cells in climate_grid.json.
 * - Months covered by real GPS telemetry: from the track fixes logged in that month, by which
 *   range centre each fix is closer to (>= 70% in one range = there; otherwise on migration).
 * - Other months (and all months for simulated tracks): the documented seasonal cycle the app
 *   uses elsewhere (breeding May–Aug, non-breeding Nov–Feb), shifted six months for species
 *   that breed in the southern hemisphere.
 * GBIF sightings are not used here: they follow where observers are, not where the birds are.
 */

import { loadClimateGrid } from './twinEnrich';

const MIN_FIXES = 20;
const SHARE = 0.7;
const DOC_BREEDING = [5, 6, 7, 8];
const DOC_NON_BREEDING = [11, 12, 1, 2];

const RANGE_NAME = { breeding: 'breeding range', non_breeding: 'wintering range' };
export const rangeName = (season) => RANGE_NAME[season] || 'range';

function centre(cells = []) {
  if (!cells.length) return null;
  return {
    lat: cells.reduce((a, c) => a + c.lat, 0) / cells.length,
    lon: cells.reduce((a, c) => a + c.lon, 0) / cells.length,
  };
}

function angularDistance(a, b) {
  const r = Math.PI / 180;
  const cos =
    Math.sin(a.lat * r) * Math.sin(b.lat * r) + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.cos((a.lon - b.lon) * r);
  return Math.acos(Math.max(-1, Math.min(1, cos)));
}

export function documentedPlace(month, southernBreeder = false) {
  const m = southernBreeder ? ((month + 5) % 12) + 1 : month;
  if (DOC_BREEDING.includes(m)) return 'breeding';
  if (DOC_NON_BREEDING.includes(m)) return 'non_breeding';
  return 'migrating';
}

/**
 * Month -> place from track fixes. Pure, so it can be tested without fetching.
 * @param tracks GeoJSON FeatureCollection with properties.times (unix s or ms) per vertex
 */
export function buildSeasonCalendar(ranges, tracks, southernBreeder = false) {
  const counts = {};
  if (ranges.breeding && ranges.non_breeding) {
    for (const f of tracks?.features || []) {
      const coords = f.geometry?.coordinates || [];
      const times = f.properties?.times || f.properties?.timestamps || [];
      for (let i = 0; i < Math.min(coords.length, times.length); i++) {
        const t = times[i] > 1e11 ? times[i] : times[i] * 1000;
        const month = new Date(t).getUTCMonth() + 1;
        const p = { lat: coords[i][1], lon: coords[i][0] };
        const inBreeding = angularDistance(p, ranges.breeding) < angularDistance(p, ranges.non_breeding);
        counts[month] = counts[month] || [0, 0];
        counts[month][inBreeding ? 0 : 1] += 1;
      }
    }
  }

  const months = {};
  for (let m = 1; m <= 12; m++) {
    const [b, n] = counts[m] || [0, 0];
    if (b + n >= MIN_FIXES) {
      const share = b / (b + n);
      months[m] = { place: share >= SHARE ? 'breeding' : share <= 1 - SHARE ? 'non_breeding' : 'migrating', source: 'tracks' };
    } else {
      months[m] = { place: documentedPlace(m, southernBreeder), source: 'documented' };
    }
  }
  return months;
}

const trackCache = new Map();
function loadTracks(speciesId) {
  if (!trackCache.has(speciesId)) {
    trackCache.set(
      speciesId,
      fetch(`./data/generated/tracks/${speciesId}.geojson`)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null)
    );
  }
  return trackCache.get(speciesId);
}

export async function loadSeasonCalendar(speciesId, { tracksSimulated = false } = {}) {
  if (!speciesId) return null;
  const grid = await loadClimateGrid();
  const seasons = grid?.species?.[speciesId]?.seasons || {};
  const ranges = { breeding: centre(seasons.breeding?.cells), non_breeding: centre(seasons.non_breeding?.cells) };
  const southernBreeder = ranges.breeding && ranges.non_breeding ? ranges.breeding.lat < ranges.non_breeding.lat : false;
  // Simulated tracks are drawn from the documented cycle, so they add no evidence of timing.
  const tracks = tracksSimulated ? null : await loadTracks(speciesId);
  return { ranges, months: buildSeasonCalendar(ranges, tracks, southernBreeder) };
}
