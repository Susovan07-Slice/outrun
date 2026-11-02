import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import DeckGL from '@deck.gl/react';
import { MapView as DeckMapView, FlyToInterpolator, COORDINATE_SYSTEM } from '@deck.gl/core';
import Map from 'react-map-gl/maplibre';
import { TripsLayer } from '@deck.gl/geo-layers';
import { ScatterplotLayer, PathLayer, BitmapLayer } from '@deck.gl/layers';
import { Plus, Minus, Globe2, Crosshair } from 'lucide-react';
import { ANIMATION_SPEED, speciesColorOf, getGraticules } from './config';
import { unwrapDatelineFeatures } from './dateline';

// Esri World Imagery plus its place-name and road overlays, so satellite view still shows localities.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const esriRaster = (service, maxzoom) => ({
  type: 'raster',
  tiles: [`${ESRI}/${service}/MapServer/tile/{z}/{y}/{x}`],
  tileSize: 256,
  maxzoom,
});
const SATELLITE_STYLE = {
  version: 8,
  sources: {
    imagery: { ...esriRaster('World_Imagery', 19), attribution: 'Imagery © Esri, Maxar, Earthstar Geographics' },
    roads: esriRaster('Reference/World_Transportation', 19),
    places: { ...esriRaster('Reference/World_Boundaries_and_Places', 19), attribution: 'Labels © Esri' },
  },
  layers: [
    { id: 'imagery', type: 'raster', source: 'imagery' },
    { id: 'roads', type: 'raster', source: 'roads', paint: { 'raster-opacity': 0.75 } },
    { id: 'places', type: 'raster', source: 'places' },
  ],
};

// Streets: OpenStreetMap data with roads, place names and building footprints (no API key).
export const BASEMAPS = [
  { id: 'streets', label: 'Streets', style: 'https://tiles.openfreemap.org/styles/liberty' },
  { id: 'satellite', label: 'Satellite', style: SATELLITE_STYLE },
];

const BASEMAP_KEY = 'outrun.basemap';
const readBasemap = () => {
  try {
    const v = window.localStorage.getItem(BASEMAP_KEY);
    return BASEMAPS.some((b) => b.id === v) ? v : 'streets';
  } catch {
    return 'streets';
  }
};

export const GLOBAL_VIEW_STATE = {
  longitude: 20,
  latitude: 24,
  zoom: 1.6,
  minZoom: 0.4,
  maxZoom: 18,
  pitch: 0,
  bearing: 0,
};

// Repeat world copies so the map never shows empty space when panned east/west,
// and routes that cross the antimeridian draw continuously.
const MAP_VIEW = new DeckMapView({ id: 'atlas', repeat: true });

// Plain, predictable navigation: drag to pan, wheel/pinch to zoom toward the cursor,
// double-click to zoom in. No fling after release (the map stops where you let go), and
// rotation is off so a stray right-drag never tilts the map.
const CONTROLLER = {
  dragPan: true,
  inertia: false,
  scrollZoom: { speed: 0.02, smooth: false },
  doubleClickZoom: true,
  touchZoom: true,
  dragRotate: false,
  touchRotate: false,
  keyboard: { zoomSpeed: 1, moveSpeed: 120 },
};

// Web Mercator helpers (world y in [0, 1], top to bottom) and the base tile size deck.gl uses.
const TILE = 512;
const mercY = (lat) => {
  const r = (Math.max(-85, Math.min(85, lat)) * Math.PI) / 180;
  return (1 - Math.log(Math.tan(Math.PI / 4 + r / 2)) / Math.PI) / 2;
};
const latOf = (y) => (Math.atan(Math.sinh(Math.PI * (1 - 2 * y))) * 180) / Math.PI;
const wrap180 = (lon) => ((((lon + 180) % 360) + 360) % 360) - 180;

const fly = (duration = 1200) => ({
  transitionDuration: duration,
  transitionInterpolator: new FlyToInterpolator({ curve: 1.6 }),
});

// Great-circle distance in km between two [lon, lat] points.
function distanceKm(a, b) {
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLon = (b[0] - a[0]) * toRad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a[1] * toRad) * Math.cos(b[1] * toRad) * Math.sin(dLon / 2) ** 2;
  return 12742 * Math.asin(Math.min(1, Math.sqrt(h)));
}

// Telemetry often has gaps of weeks between fixes. Joining them draws long straight lines the bird
// never flew, so break a track wherever consecutive fixes are farther apart than this.
const MAX_GAP_KM = 900;
function splitAtGaps(features) {
  const out = [];
  for (const f of features) {
    const c = f.geometry?.coordinates || [];
    const t = f.properties?.times;
    let start = 0;
    const push = (end) => {
      if (end - start >= 2) {
        out.push({
          ...f,
          geometry: { ...f.geometry, coordinates: c.slice(start, end) },
          properties: { ...f.properties, times: t ? t.slice(start, end) : t },
        });
      }
    };
    for (let i = 1; i < c.length; i++) {
      if (distanceKm(c[i - 1], c[i]) > MAX_GAP_KM) {
        push(i);
        start = i;
      }
    }
    push(c.length);
  }
  return out;
}

// Interpolated head position of one track at a given epoch second (null outside its time span).
function headPosition(coords, times, t) {
  if (!times || times.length < 2 || t < times[0] || t > times[times.length - 1]) return null;
  let lo = 0;
  let hi = times.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (times[mid] <= t) lo = mid;
    else hi = mid;
  }
  const span = times[hi] - times[lo] || 1;
  const k = (t - times[lo]) / span;
  return [coords[lo][0] + (coords[hi][0] - coords[lo][0]) * k, coords[lo][1] + (coords[hi][1] - coords[lo][1]) * k];
}

// ---------- The Twin: connected suitability zones ----------
// Five bands on the legend's fixed scale; the 40% and 70% cuts match the tooltip's
// degraded / marginal / prime labels, and the marginal range is split so differences show.
const SUIT_CLASSES = [
  { max: 0.25, rgb: [185, 28, 28] }, // severely degraded — deep red
  { max: 0.4, rgb: [239, 68, 68] }, // degraded — red
  { max: 0.55, rgb: [249, 115, 22] }, // low marginal — orange
  { max: 0.7, rgb: [234, 179, 8] }, // high marginal — yellow
  { max: Infinity, rgb: [22, 163, 74] }, // prime — green
];
const suitClass = (v) => SUIT_CLASSES.findIndex((c) => v < c.max);

// Smooths station suitability onto a lon/lat grid (Gaussian-weighted), fills the whole station
// area as one connected surface, colours it in three distinct zones and outlines zone borders.
function buildSuitabilityField(cells, t) {
  const pts = cells
    .filter((c) => Number.isFinite(c.lon) && Number.isFinite(c.lat))
    .map((c) => ({ lon: c.lon, lat: c.lat, v: c.baseline_suitability * (1 - t) + c.future_suitability * t, c }));
  if (pts.length === 0) return null;

  // Station spacing sets both the smoothing and how far the filled area reaches,
  // generous enough that neighbouring stations always join into one region.
  const nn = pts.map((p) => {
    let best = Infinity;
    for (const q of pts) {
      if (q === p) continue;
      const d = Math.hypot((q.lon - p.lon) * Math.cos((p.lat * Math.PI) / 180), q.lat - p.lat);
      if (d < best) best = d;
    }
    return best;
  }).filter(Number.isFinite).sort((a, b) => a - b);
  const median = nn.length ? nn[Math.floor(nn.length / 2)] : 1;
  const p90 = nn.length ? nn[Math.floor(nn.length * 0.9)] : 1;
  const sigma = Math.max(0.25, median * 0.7);
  const reach = Math.max(1, Math.min(8, p90 * 1.6, median * 4));

  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const p of pts) {
    minLon = Math.min(minLon, p.lon); maxLon = Math.max(maxLon, p.lon);
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat);
  }
  const midCos = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  minLon -= reach / Math.max(0.2, midCos); maxLon += reach / Math.max(0.2, midCos);
  minLat = Math.max(-84, minLat - reach); maxLat = Math.min(84, maxLat + reach);

  const spanX = (maxLon - minLon) * midCos;
  const spanY = maxLat - minLat;
  const SIZE = 320;
  const W = Math.max(32, Math.round(spanX >= spanY ? SIZE : (SIZE * spanX) / spanY));
  const H = Math.max(32, Math.round(spanY >= spanX ? SIZE : (SIZE * spanY) / spanX));

  const values = new Float32Array(W * H).fill(NaN);
  const nearest = new Int32Array(W * H).fill(-1);
  const edge = new Float32Array(W * H);
  const twoSig2 = 2 * sigma * sigma;
  const twoReach2 = 2 * (reach * 0.55) ** 2;

  for (let y = 0; y < H; y++) {
    const lat = maxLat - ((y + 0.5) / H) * (maxLat - minLat);
    const cosLat = Math.cos((lat * Math.PI) / 180);
    for (let x = 0; x < W; x++) {
      const lon = minLon + ((x + 0.5) / W) * (maxLon - minLon);
      let wSum = 0, vSum = 0, dMin = Infinity, iMin = -1, density = 0;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const dx = (p.lon - lon) * cosLat;
        const dy = p.lat - lat;
        const d2 = dx * dx + dy * dy;
        if (d2 < dMin) { dMin = d2; iMin = i; }
        const w = Math.exp(-d2 / twoSig2) + 1e-9 / (d2 + 1e-6);
        wSum += w;
        vSum += w * p.v;
        density += Math.exp(-d2 / twoReach2);
      }
      // The region is where station density clears a threshold: one smooth outline
      // instead of a union of circles, with a short soft rim.
      if (density < 0.3) continue;
      const i = y * W + x;
      values[i] = vSum / wSum;
      nearest[i] = iMin;
      edge[i] = Math.min(1, (density - 0.3) / 0.25);
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const v = values[i];
      if (!Number.isFinite(v)) continue;
      const k = suitClass(v);
      const right = x + 1 < W ? values[i + 1] : NaN;
      const down = y + 1 < H ? values[i + W] : NaN;
      // Zone border: the class changes to the right or below.
      const border = (Number.isFinite(right) && suitClass(right) !== k) || (Number.isFinite(down) && suitClass(down) !== k);
      const [r, g, b] = SUIT_CLASSES[k].rgb;
      const o = i * 4;
      const shade = border ? 0.55 : 1;
      img.data[o] = Math.round(r * shade);
      img.data[o + 1] = Math.round(g * shade);
      img.data[o + 2] = Math.round(b * shade);
      img.data[o + 3] = Math.round((border ? 235 : 150) * edge[i]);
    }
  }
  ctx.putImageData(img, 0, 0);
  return { image: canvas, bounds: [minLon, minLat, maxLon, maxLat], W, H, values, nearest, pts };
}

const MapView = ({
  time,
  timeRange = [0, 0],
  tripsData = [],
  occurrences = [],
  selectedSpecies,
  corridorData,
  twinSlider = 0.5,
  protectedNodes = new Set(),
  onSimulateProtect,
  activeCorridorTab = 'overview',
  layersOn = { paths: true, trail: true, sightings: false, grid: true },
  padding = { top: 80, bottom: 110, left: 40, right: 40 },
  tracksSimulated = false,
}) => {
  const [viewState, setViewState] = useState(GLOBAL_VIEW_STATE);
  const [hover, setHover] = useState(null);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const [basemap, setBasemap] = useState(readBasemap);
  const basemapStyle = BASEMAPS.find((b) => b.id === basemap)?.style || BASEMAPS[0].style;
  const isSatellite = basemap === 'satellite';
  const wrapRef = useRef(null);

  const spColor = speciesColorOf(selectedSpecies);

  useEffect(() => {
    try {
      window.localStorage.setItem(BASEMAP_KEY, basemap);
    } catch {
      // Storage blocked — the choice just won't persist.
    }
  }, [basemap]);

  useEffect(() => {
    if (!wrapRef.current) return undefined;
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height });
    });
    ro.observe(wrapRef.current);
    return () => ro.disconnect();
  }, []);

  // Whole tracks (one per bird) for start/end markers; gap-split pieces for drawing lines.
  const birdTracks = useMemo(() => unwrapDatelineFeatures(tripsData), [tripsData]);
  const tracks = useMemo(() => splitAtGaps(birdTracks).map((f, i) => ({ ...f, _i: i })), [birdTracks]);
  // Markers only help when there are few birds; with dozens they bury the routes in dots.
  const fewBirds = birdTracks.length <= 12;

  // ---------- One world only ----------
  // Never zoom out past one world width, and stop panning at the world's edges, so no second
  // copy of the map is ever visible. The world's centre (anchor) is 0° by default and moves to
  // a route's centre when fitting, so routes crossing the date line still draw unbroken.
  const anchorRef = useRef(0);
  const minZoom = size.width > 0
    ? Math.max(0, Math.log2(size.width / TILE), Math.log2(size.height / TILE))
    : GLOBAL_VIEW_STATE.minZoom;

  const constrain = useCallback(
    (vs) => {
      if (size.width < 1 || size.height < 1) return vs;
      const zoom = Math.max(minZoom, Math.min(vs.zoom, GLOBAL_VIEW_STATE.maxZoom));
      const worldPx = TILE * 2 ** zoom;
      const halfLon = (size.width / 2 / worldPx) * 360;
      const halfY = size.height / 2 / worldPx;
      const anchor = anchorRef.current;
      const delta = Math.max(-180 + halfLon, Math.min(180 - halfLon, wrap180(vs.longitude - anchor)));
      const y = Math.max(halfY, Math.min(1 - halfY, mercY(vs.latitude)));
      return { ...vs, zoom, minZoom, longitude: anchor + delta, latitude: latOf(y) };
    },
    [size.width, size.height, minZoom]
  );

  // Re-apply the limits when the map is resized.
  useEffect(() => {
    setViewState((prev) => constrain(prev));
  }, [constrain]);

  // Fit the camera to the selected species' tracks (or sightings), respecting the floating panels.
  const fitToSpecies = useCallback(() => {
    let coords = [];
    if (tracks.length > 0) {
      for (const f of tracks) if (f.geometry?.coordinates) coords.push(...f.geometry.coordinates);
    } else if (occurrences.length > 0) {
      coords = occurrences.map((o) => [o.lon, o.lat]);
    }
    if (coords.length === 0 || size.width < 50 || size.height < 50) return;

    let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
    for (const [lon, lat] of coords) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
    }
    const pad = {
      top: Math.min(padding.top, size.height * 0.3),
      bottom: Math.min(padding.bottom, size.height * 0.4),
      left: Math.min(padding.left, size.width * 0.4),
      right: Math.min(padding.right, size.width * 0.4),
    };
    if (size.width - pad.left - pad.right < 120) { pad.left = 20; pad.right = 20; }
    if (size.height - pad.top - pad.bottom < 120) { pad.top = 20; pad.bottom = 20; }

    // Fit by hand in Web Mercator so routes spanning most of the globe still fit;
    // library fitBounds mishandles spans near 360°.
    const availW = size.width - pad.left - pad.right;
    const availH = size.height - pad.top - pad.bottom;
    const spanX = Math.max((maxLon - minLon) / 360, 1e-4);
    const yTop = mercY(maxLat);
    const yBottom = mercY(minLat);
    const spanY = Math.max(yBottom - yTop, 1e-4);
    const zoom = Math.max(
      minZoom,
      Math.min(7, Math.log2(availW / (TILE * spanX)), Math.log2(availH / (TILE * spanY))) - 0.15
    );
    const worldPx = TILE * 2 ** zoom;
    // Centre the route in the open area between panels, not the middle of the screen.
    const centreX = (minLon + maxLon) / 2 / 360 + 0.5 + (pad.right - pad.left) / 2 / worldPx;
    const centreY = Math.max(0.02, Math.min(0.98, (yTop + yBottom) / 2 + (pad.bottom - pad.top) / 2 / worldPx));
    // The one visible world is centred on the route, so a Pacific crossing stays in one piece.
    anchorRef.current = (minLon + maxLon) / 2;
    setViewState((prev) => ({
      ...constrain({ ...prev, longitude: (centreX - 0.5) * 360, latitude: latOf(centreY), zoom }),
      ...fly(1300),
    }));
  }, [tracks, occurrences, size.width, size.height, padding.top, padding.bottom, padding.left, padding.right, minZoom, constrain]);

  // Auto-fit when the species (or its data) changes, or the map frame is resized (panel opened/closed).
  // The first fix identifies the loaded track set, so a species whose data arrives after the
  // selection (with the same track count as the previous one) still triggers a refit.
  const firstFix = tracks[0]?.geometry?.coordinates?.[0]?.join(',') ?? '';
  const fitKey = `${selectedSpecies?.species_id}|${tracks.length}|${firstFix}|${tracks.length ? 0 : occurrences.length}|${Math.round(size.width / 40)}|${Math.round(size.height / 40)}`;
  useEffect(() => {
    fitToSpecies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fitKey]);

  // Clamp user moves; let animated fly-tos run untouched (their targets are already clamped),
  // since rewriting in-between frames would cancel the animation part-way.
  const onViewStateChange = useCallback(
    ({ viewState: vs, interactionState }) => setViewState(interactionState?.inTransition ? vs : constrain(vs)),
    [constrain]
  );

  const zoomBy = useCallback(
    (dz) => setViewState((prev) => ({ ...constrain({ ...prev, zoom: prev.zoom + dz }), transitionDuration: 280 })),
    [constrain]
  );

  const resetView = useCallback(() => {
    anchorRef.current = 0;
    setViewState({ ...constrain({ ...GLOBAL_VIEW_STATE, zoom: 0 }), ...fly(1100) });
  }, [constrain]);

  // ---------- Layers ----------
  const graticuleData = useMemo(() => getGraticules(), []);
  const hoveredTrack = hover?.layer?.id?.startsWith('track-') ? hover.object?._i : null;
  const [r, g, b] = spColor.rgb;

  const twinCells = activeCorridorTab === 'twin' ? corridorData?.twin?.cells : null;
  const twinField = useMemo(
    () => (twinCells?.length ? buildSuitabilityField(twinCells, twinSlider) : null),
    [twinCells, twinSlider]
  );

  const layers = useMemo(() => {
    const out = [];

    if (layersOn.grid) {
      out.push(
        new PathLayer({
          id: 'graticule',
          data: graticuleData,
          getPath: (d) => d.coordinates,
          getColor: isSatellite ? [255, 255, 255, 45] : [60, 70, 90, 35],
          getWidth: 1,
          widthUnits: 'pixels',
        })
      );
    }

    // The Twin — one continuous suitability surface (no station dots)
    if (twinField) {
      out.push(
        new BitmapLayer({
          id: 'twin-field',
          image: twinField.image,
          bounds: twinField.bounds,
          _imageCoordinateSystem: COORDINATE_SYSTEM.LNGLAT,
          opacity: 1,
          pickable: true,
        })
      );
    }

    if (layersOn.sightings && occurrences.length) {
      out.push(
        new ScatterplotLayer({
          id: 'sightings',
          data: occurrences,
          getPosition: (d) => [d.lon, d.lat],
          getFillColor: [r, g, b, 190],
          getLineColor: [255, 255, 255, 240],
          lineWidthMinPixels: 1,
          stroked: true,
          getRadius: 20000,
          radiusMinPixels: 3,
          radiusMaxPixels: 8,
          pickable: true,
        })
      );
    }

    if (layersOn.paths && tracks.length) {
      // Dense species (100 storks) would merge into one blob: thin the glow/route as track count grows.
      const density = Math.min(1, Math.sqrt(10 / tracks.length));
      const casingA = Math.round(110 + 120 * density);
      const routeA = Math.round(150 + 105 * density);
      // 1. White casing so the route reads on streets, light and satellite basemaps alike
      out.push(
        new PathLayer({
          id: 'track-casing',
          data: tracks,
          getPath: (d) => d.geometry.coordinates,
          getColor: (d) => [255, 255, 255, d._i === hoveredTrack ? 255 : casingA],
          getWidth: (d) => (d._i === hoveredTrack ? 9 : 3 + 1.5 * density),
          widthUnits: 'pixels',
          jointRounded: true,
          capRounded: true,
          updateTriggers: { getColor: [hoveredTrack, casingA], getWidth: [hoveredTrack, density] },
        }),
        // 2. Crisp route line (pickable for hover/inspect)
        new PathLayer({
          id: 'track-route',
          data: tracks,
          getPath: (d) => d.geometry.coordinates,
          getColor: (d) => [r, g, b, d._i === hoveredTrack ? 255 : routeA],
          getWidth: (d) => (d._i === hoveredTrack ? 5 : 1.4 + 0.9 * density),
          widthUnits: 'pixels',
          widthMinPixels: 1.2,
          jointRounded: true,
          capRounded: true,
          pickable: true,
          autoHighlight: false,
          updateTriggers: { getColor: [hoveredTrack, r, g, b, routeA], getWidth: [hoveredTrack, density] },
        }),
        // 3. Start rings and end dots
        new ScatterplotLayer({
          id: 'track-ends',
          visible: fewBirds,
          data: birdTracks.flatMap((f) => {
            const c = f.geometry?.coordinates || [];
            return c.length ? [{ p: c[0], start: true }, { p: c[c.length - 1], start: false }] : [];
          }),
          getPosition: (d) => d.p,
          getRadius: 4,
          radiusUnits: 'pixels',
          stroked: true,
          filled: true,
          getFillColor: (d) => (d.start ? [255, 255, 255, 255] : [r, g, b, 255]),
          getLineColor: (d) => (d.start ? [r, g, b, 255] : [255, 255, 255, 255]),
          lineWidthMinPixels: 1.6,
          updateTriggers: { getFillColor: [r, g, b], getLineColor: [r, g, b] },
        })
      );
    }

    if (layersOn.trail && tracks.length) {
      const range = Math.max(1, timeRange[1] - timeRange[0]);
      out.push(
        new TripsLayer({
          id: 'track-trail',
          data: tracks,
          currentTime: time,
          getTimestamps: (d) => d.properties.times,
          getPath: (d) => d.geometry.coordinates,
          trailLength: Math.max(ANIMATION_SPEED * 120, range * 0.08),
          fadeTrail: true,
          getColor: [r, g, b],
          getWidth: 4,
          widthUnits: 'pixels',
          jointRounded: true,
          capRounded: true,
          updateTriggers: { getColor: [r, g, b] },
        })
      );
      const heads = [];
      for (const f of tracks) {
        const p = headPosition(f.geometry.coordinates, f.properties.times, time);
        if (p) heads.push({ p, f });
      }
      out.push(
        new ScatterplotLayer({
          id: 'track-heads-halo',
          visible: fewBirds,
          data: heads,
          getPosition: (d) => d.p,
          getRadius: 10,
          radiusUnits: 'pixels',
          getFillColor: [r, g, b, 70],
          updateTriggers: { getFillColor: [r, g, b] },
        }),
        new ScatterplotLayer({
          id: 'track-heads',
          data: heads,
          getPosition: (d) => d.p,
          getRadius: fewBirds ? 4 : 2.5,
          radiusUnits: 'pixels',
          getFillColor: [255, 255, 255, 255],
          stroked: true,
          getLineColor: [r, g, b, 255],
          lineWidthMinPixels: fewBirds ? 2 : 1,
          updateTriggers: { getLineColor: [r, g, b] },
        })
      );
    }

    // Break & Fix — candidate bottlenecks
    if (activeCorridorTab === 'network' && corridorData?.critical_links?.length) {
      out.push(
        new ScatterplotLayer({
          id: 'bottlenecks',
          data: corridorData.critical_links,
          getPosition: (d) => [d.lon, d.lat],
          getRadius: 50000,
          radiusMinPixels: 8,
          radiusMaxPixels: 20,
          getFillColor: (d) => (protectedNodes.has(d.node_id) ? [30, 142, 79, 150] : [210, 63, 63, 140]),
          getLineColor: (d) => (protectedNodes.has(d.node_id) ? [30, 142, 79, 255] : [210, 63, 63, 255]),
          lineWidthMinPixels: 2.5,
          stroked: true,
          pickable: true,
          onClick: (info) => {
            if (info?.object?.node_id && onSimulateProtect) onSimulateProtect(info.object.node_id);
          },
          updateTriggers: { getFillColor: [...protectedNodes], getLineColor: [...protectedNodes] },
        })
      );
    }

    return out;
  }, [
    layersOn, graticuleData, activeCorridorTab, corridorData, twinField, occurrences, tracks, birdTracks, fewBirds,
    hoveredTrack, r, g, b, time, timeRange, protectedNodes, onSimulateProtect, isSatellite,
  ]);

  const getCursor = useCallback(
    ({ isDragging, isHovering }) => (isDragging ? 'grabbing' : isHovering ? 'pointer' : 'default'),
    []
  );

  const onHover = useCallback((info) => setHover(info && (info.object || info.bitmap) ? info : null), []);

  return (
    <div ref={wrapRef} className="map-canvas" data-basemap={basemap} onMouseLeave={() => setHover(null)}>
      <DeckGL
        views={MAP_VIEW}
        viewState={viewState}
        onViewStateChange={onViewStateChange}
        controller={CONTROLLER}
        layers={layers}
        getCursor={getCursor}
        onHover={onHover}
        pickingRadius={6}
      >
        <Map
          mapStyle={basemapStyle}
          renderWorldCopies
          attributionControl={{ compact: true }}
        />
      </DeckGL>

      <div className="float map-ctl" role="group" aria-label="Map controls">
        <button className="o-iconbtn" data-ripple onClick={() => zoomBy(0.8)} title="Zoom in" aria-label="Zoom in">
          <Plus size={18} strokeWidth={2.2} />
        </button>
        <button className="o-iconbtn" data-ripple onClick={() => zoomBy(-0.8)} title="Zoom out" aria-label="Zoom out">
          <Minus size={18} strokeWidth={2.2} />
        </button>
        <button className="o-iconbtn" data-ripple onClick={fitToSpecies} title="Fit to species routes" aria-label="Fit to species routes">
          <Crosshair size={18} strokeWidth={2.2} />
        </button>
        <button className="o-iconbtn" data-ripple onClick={resetView} title="Whole world" aria-label="Show whole world">
          <Globe2 size={18} strokeWidth={2.2} />
        </button>
      </div>

      <div className="float o-seg basemap-switch" role="tablist" aria-label="Basemap">
        {BASEMAPS.map((b) => (
          <button key={b.id} className="o-seg__btn" role="tab" data-ripple aria-selected={basemap === b.id} onClick={() => setBasemap(b.id)}>
            {b.label}
          </button>
        ))}
      </div>

      {hover && <MapTooltip hover={hover} tracksSimulated={tracksSimulated} twinSlider={twinSlider} twinField={twinField} protectedNodes={protectedNodes} species={selectedSpecies} />}
    </div>
  );
};

const fmtLatLon = (lat, lon) => {
  const la = Number(lat);
  const lo = ((((Number(lon) + 180) % 360) + 360) % 360) - 180;
  return `${Math.abs(la).toFixed(2)}°${la >= 0 ? 'N' : 'S'}, ${Math.abs(lo).toFixed(2)}°${lo >= 0 ? 'E' : 'W'}`;
};

const MapTooltip = ({ hover, tracksSimulated, twinSlider, twinField, protectedNodes, species }) => {
  const { object: o, layer, x, y } = hover;
  const id = layer?.id;
  const style = { left: x + 16, top: y + 16 };

  let body = null;
  if (id === 'bottlenecks') {
    const isProt = protectedNodes.has(o.node_id);
    body = (
      <>
        <div className="map-tooltip__head">
          <span className="o-badge o-badge--simulated">simulated</span>
          <strong>Bottleneck #{o.rank}</strong>
        </div>
        <div>{fmtLatLon(o.lat, o.lon)}</div>
        <div>Severing loss <b>{o.loss_of_reachable_area_km2?.toLocaleString()} km²</b> ({o.loss_percent}%)</div>
        <div>+{o.connected_components_increase} disconnected fragment(s)</div>
        <div className="map-tooltip__foot">
          {isProt ? <span style={{ color: 'var(--success)', fontWeight: 600 }}>Protected in simulation</span> : <span className="map-tooltip__cta">Click to simulate protection</span>}
        </div>
      </>
    );
  } else if (id === 'twin-field') {
    const px = hover.bitmap?.pixel;
    const idx = px && twinField ? Math.floor(px[1]) * twinField.W + Math.floor(px[0]) : -1;
    const v = idx >= 0 ? twinField.values[idx] : NaN;
    if (!Number.isFinite(v)) return null;
    const st = twinField.pts[twinField.nearest[idx]]?.c;
    body = (
      <>
        <div className="map-tooltip__head">
          <span className="o-badge o-badge--simulated">simulated</span>
          <strong>Suitability {Math.round(v * 100)}%</strong>
        </div>
        <div>{v >= 0.7 ? 'Prime' : v >= 0.4 ? 'Marginal' : 'Degraded'} climate envelope here</div>
        {st && (
          <div>Nearest station: ERA5 <b>{Math.round(st.baseline_suitability * 100)}%</b> · CMIP6 2050 <b>{Math.round(st.future_suitability * 100)}%</b>{Number.isFinite(st.model_spread) ? <> · ±{(st.model_spread * 100).toFixed(1)}%</> : null}</div>
        )}
        <div className="map-tooltip__foot">Interpolated between stations; macro-climate envelope only, land cover not modelled.</div>
      </>
    );
  } else if (id === 'track-route') {
    const p = o.properties || {};
    body = (
      <>
        <div className="map-tooltip__head">
          {tracksSimulated ? <span className="o-badge o-badge--simulated">simulated</span> : <span className="o-badge o-badge--observed">observed</span>}
          <strong>{species?.common_name || p.species}</strong>
        </div>
        <div>{tracksSimulated ? 'Simulated corridor track' : 'GPS track'} · <b>{p.point_count || o.geometry?.coordinates?.length}</b> {tracksSimulated ? 'points' : 'fixes'}</div>
        {p.times?.length > 1 && (
          <div>
            {new Date(p.times[0] * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })} →{' '}
            {new Date(p.times[p.times.length - 1] * 1000).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
          </div>
        )}
        <div className="map-tooltip__foot">
          {tracksSimulated
            ? 'Agent-based flyway twin through documented stopovers · not telemetry'
            : `${p.dataset_title || 'GPS telemetry'} · ${p.license?.includes('by-nc') ? 'CC-BY-NC 4.0' : p.license?.includes('zero') ? 'CC0 1.0' : 'CC-BY 4.0'}`}
        </div>
      </>
    );
  } else if (id === 'sightings') {
    body = (
      <>
        <div className="map-tooltip__head">
          <span className="o-badge o-badge--observed">observed</span>
          <strong>GBIF #{o.gbif_id}</strong>
        </div>
        <div>{o.event_date || `Month ${o.month}`}</div>
        <div>{fmtLatLon(o.lat, o.lon)} {o.country_code ? `· ${o.country_code}` : ''}</div>
        <div className="map-tooltip__foot">{o.basis_of_record} · {o.license || 'CC0 / CC-BY'}</div>
      </>
    );
  }
  if (!body) return null;
  return <div className="map-tooltip" style={style}>{body}</div>;
};

export default MapView;
