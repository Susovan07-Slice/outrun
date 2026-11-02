/**
 * Drives the loading screen defined in index.html (#boot), which is visible from the first
 * paint, before this bundle has even downloaded. The app reports real readiness steps; the
 * screen draws in its flight line as each one completes and fades out once every step the
 * current page needs is done.
 *
 * Steps follow the real requests the app makes on start-up, so on the deployed site they
 * track the Worker API: registry (GET /api/species), occurrences (the first species' GBIF
 * sightings), corridor (GET /api/corridor: race, twin, stopovers), tracks (flight paths),
 * map (basemap style loaded and first frame drawn), plus fonts. Each request reports done
 * whether it succeeded or fell back to the bundled offline data; the screen then says which
 * source answered. Pages without a map skip 'map'. A safety timeout always reveals the app,
 * so a slow API or tile server can never trap it.
 */

const LABELS = {
  fonts: 'Loading typefaces',
  registry: 'Contacting the observatory API',
  occurrences: 'Fetching GBIF sightings',
  corridor: 'Fetching climate & corridor analysis',
  tracks: 'Loading flight paths',
  map: 'Drawing the map',
};
const ORDER = ['fonts', 'registry', 'occurrences', 'corridor', 'tracks', 'map'];
const SOURCE_TEXT = {
  live: '● Live API connected',
  offline: '○ Live API unavailable: using offline cache',
};
const MIN_VISIBLE_MS = 700; // avoid a flash on fast loads
const SAFETY_MS = 15000;
const ENTER_MS = 2000; // longest entrance animation, delays included

const done = new Set();
const skipped = new Set();
let finished = false;

const el = (id) => document.getElementById(id);

function render() {
  const needed = ORDER.filter((s) => !skipped.has(s));
  const complete = needed.filter((s) => done.has(s)).length;
  // The bundle itself counts as the first slice, so the ring moves as soon as JS runs.
  const pct = Math.round(((complete + 1) / (needed.length + 1)) * 100);
  const next = needed.find((s) => !done.has(s));

  const ring = el('boot-ring');
  if (ring) ring.style.strokeDashoffset = String(100 - pct);
  const pctEl = el('boot-pct');
  if (pctEl) pctEl.textContent = `${pct}%`;
  const step = el('boot-step');
  if (step) step.textContent = next ? `${LABELS[next]}…` : 'Ready';
  const boot = el('boot');
  if (boot) boot.setAttribute('aria-valuenow', String(pct));

  if (!next) finish();
}

function finish() {
  if (finished) return;
  finished = true;
  const boot = el('boot');
  if (!boot) return;
  const wait = Math.max(0, MIN_VISIBLE_MS - performance.now());
  setTimeout(() => {
    boot.classList.add('is-done');
    const root = document.documentElement;
    root.classList.remove('is-booting');
    // Panels play their entrance as the loading screen fades (see .app-enter in index.css).
    root.classList.add('app-enter');
    setTimeout(() => root.classList.remove('app-enter'), ENTER_MS);
    boot.addEventListener('transitionend', () => boot.remove(), { once: true });
    setTimeout(() => boot.remove(), 900);
  }, wait);
}

export function markReady(step) {
  if (finished || done.has(step)) return;
  done.add(step);
  render();
}

export function setBootSource(source) {
  const src = el('boot-src');
  if (!src || finished) return;
  src.textContent = SOURCE_TEXT[source] || '';
  src.classList.toggle('is-live', source === 'live');
}

export function skipStep(step) {
  if (finished || skipped.has(step)) return;
  skipped.add(step);
  render();
}

if (typeof document !== 'undefined') {
  render();
  (document.fonts?.ready || Promise.resolve()).then(() => markReady('fonts'));
  setTimeout(finish, SAFETY_MS);
}
