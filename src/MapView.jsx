import React, { useEffect, useState, useMemo, useCallback } from 'react';
import DeckGL from '@deck.gl/react';
import Map from 'react-map-gl/maplibre';
import { TripsLayer } from '@deck.gl/geo-layers';
import { ScatterplotLayer, PathLayer } from '@deck.gl/layers';
import { Plus, Minus, Compass } from 'lucide-react';
import { ANIMATION_SPEED, speciesConfig, getGraticules } from './config';
import { ensureDatelineSafeFeatures } from './dateline';

// Initial global world view (natural framing)
export const GLOBAL_VIEW_STATE = {
  longitude: 18.0,
  latitude: 22.0,
  zoom: 1.85,
  minZoom: 1.2,
  maxZoom: 18,
  pitch: 0,
  bearing: 0,
};

const MapView = ({
  time,
  tripsData = [],
  highlightedSpecies,
  occurrences = [],
  selectedSpecies,
  onSelectSpeciesByName,
  corridorData,
  twinSlider = 0.5,
  protectedNodes = new Set(),
  onSimulateProtect,
}) => {
  const [viewState, setViewState] = useState(GLOBAL_VIEW_STATE);
  const [hoverInfo, setHoverInfo] = useState(null);

  // Auto-center camera when a species is selected or occurrences/tracks change
  useEffect(() => {
    if (!selectedSpecies) return;

    let coordsToFit = [];

    // Prioritize tracks coordinates if available
    if (tripsData && tripsData.length > 0) {
      for (const feat of tripsData) {
        if (feat.geometry?.coordinates) {
          coordsToFit.push(...feat.geometry.coordinates);
        }
      }
    } else if (occurrences && occurrences.length > 0) {
      coordsToFit = occurrences.map((o) => [o.lon, o.lat]);
    }

    if (coordsToFit.length === 0) return;

    // Calculate bounding box and center
    let minLon = 180;
    let maxLon = -180;
    let minLat = 90;
    let maxLat = -90;
    let sumLon = 0;
    let sumLat = 0;

    for (const [lon, lat] of coordsToFit) {
      if (lon < minLon) minLon = lon;
      if (lon > maxLon) maxLon = lon;
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      sumLon += lon;
      sumLat += lat;
    }

    const avgLon = sumLon / coordsToFit.length;
    const avgLat = sumLat / coordsToFit.length;

    // Estimate appropriate zoom based on coordinate span
    const spanLon = Math.max(0.1, maxLon - minLon);
    const spanLat = Math.max(0.1, maxLat - minLat);
    const maxSpan = Math.max(spanLon, spanLat);

    let targetZoom = 3.2;
    if (maxSpan > 120) targetZoom = 2.0;
    else if (maxSpan > 60) targetZoom = 2.6;
    else if (maxSpan > 30) targetZoom = 3.4;
    else if (maxSpan > 15) targetZoom = 4.2;
    else targetZoom = 5.0;

    setViewState((prev) => ({
      ...prev,
      longitude: avgLon,
      latitude: avgLat,
      zoom: targetZoom,
      transitionDuration: 900,
    }));
  }, [selectedSpecies?.species_id, tripsData.length, occurrences.length]);

  // Zoom In handler
  const handleZoomIn = useCallback(() => {
    setViewState((prev) => ({
      ...prev,
      zoom: Math.min(prev.zoom + 0.7, 16),
      transitionDuration: 300,
    }));
  }, []);

  // Zoom Out handler
  const handleZoomOut = useCallback(() => {
    setViewState((prev) => ({
      ...prev,
      zoom: Math.max(prev.zoom - 0.7, 1.2),
      transitionDuration: 300,
    }));
  }, []);

  // Reset to Global Extent handler
  const handleResetView = useCallback(() => {
    setViewState({
      ...GLOBAL_VIEW_STATE,
      transitionDuration: 900,
    });
  }, []);

  // 1. Subtle Cartographic Graticules (Parallels & Meridians)
  const graticulesData = useMemo(() => getGraticules(), []);
  const graticuleLayer = useMemo(() => {
    return new PathLayer({
      id: 'world-graticules',
      data: graticulesData,
      getPath: (d) => d.coordinates,
      getColor: [205, 200, 190, 85], // Warm subtle graticule
      getWidth: 1,
      widthMinPixels: 0.75,
      widthUnits: 'pixels',
      pickable: false,
    });
  }, [graticulesData]);

  // 2. Twin Climate Suitability Envelope Layer (ScatterplotLayer grid)
  const twinLayer = useMemo(() => {
    if (!corridorData?.twin?.cells || corridorData.twin.cells.length === 0) return null;

    return new ScatterplotLayer({
      id: 'corridor-twin-envelope',
      data: corridorData.twin.cells,
      getPosition: (d) => [d.lon, d.lat],
      getRadius: 34000,
      radiusMinPixels: 3,
      radiusMaxPixels: 12,
      getFillColor: (d) => {
        // Interpolate suitability based on projection horizon slider (0 = baseline, 1 = CMIP6 future)
        const suit = d.baseline_suitability * (1 - twinSlider) + d.future_suitability * twinSlider;
        if (suit >= 0.7) {
          return [34, 139, 104, Math.round(110 + suit * 100)]; // Deep emerald
        } else if (suit >= 0.4) {
          return [217, 119, 6, Math.round(90 + suit * 100)]; // Ochre / amber
        } else {
          return [185, 28, 28, Math.round(70 + suit * 80)]; // Crimson (marginal/declining)
        }
      },
      getLineColor: [255, 255, 255, 45],
      lineWidthMinPixels: 0.5,
      stroked: true,
      pickable: true,
      parameters: { blend: true },
      onHover: (info) => {
        if (info && info.object) {
          const suit =
            info.object.baseline_suitability * (1 - twinSlider) +
            info.object.future_suitability * twinSlider;
          setHoverInfo({
            ...info,
            isTwinCell: true,
            cell: info.object,
            suitability: suit,
          });
        }
      },
    });
  }, [corridorData?.twin?.cells, twinSlider]);

  // 3. Candidate Critical Links / Bottleneck Pinch-Points Layer (The Break & The Fix)
  const bottleneckLayer = useMemo(() => {
    if (!corridorData?.critical_links || corridorData.critical_links.length === 0) return null;

    return new ScatterplotLayer({
      id: 'corridor-critical-links',
      data: corridorData.critical_links,
      getPosition: (d) => [d.lon, d.lat],
      getRadius: 48000,
      radiusMinPixels: 7,
      radiusMaxPixels: 18,
      getFillColor: (d) => {
        const isProt = protectedNodes.has(d.node_id);
        return isProt ? [16, 185, 129, 150] : [239, 68, 68, 140];
      },
      getLineColor: (d) => {
        const isProt = protectedNodes.has(d.node_id);
        return isProt ? [4, 120, 87, 245] : [220, 38, 38, 245];
      },
      lineWidthMinPixels: 2.2,
      stroked: true,
      pickable: true,
      parameters: { blend: true },
      onHover: (info) => {
        if (info && info.object) {
          setHoverInfo({
            ...info,
            isBottleneck: true,
            link: info.object,
            isProtected: protectedNodes.has(info.object.node_id),
          });
        }
      },
      onClick: (info) => {
        if (info?.object?.node_id && onSimulateProtect) {
          onSimulateProtect(info.object.node_id);
        }
      },
    });
  }, [corridorData?.critical_links, protectedNodes, onSimulateProtect]);

  // 4. Empirical GBIF occurrences: rendered in refined muted style
  const occurrenceLayer = useMemo(() => {
    if (!occurrences || occurrences.length === 0) return null;

    // Get color from selected species or fallback
    const spColor =
      (selectedSpecies && speciesConfig[selectedSpecies.scientific_name]?.color) ||
      [140, 110, 85];

    return new ScatterplotLayer({
      id: 'gbif-occurrences',
      data: occurrences,
      getPosition: (d) => [d.lon, d.lat],
      getFillColor: [spColor[0], spColor[1], spColor[2], 160],
      getLineColor: [50, 45, 40, 200],
      lineWidthMinPixels: 0.75,
      stroked: true,
      getRadius: 22000,
      radiusMinPixels: 3.5,
      radiusMaxPixels: 9,
      pickable: true,
      onHover: (info) => setHoverInfo(info),
    });
  }, [occurrences, selectedSpecies]);

  // 5. Preprocess trips data to be antimeridian / dateline safe
  const safeTripsData = useMemo(() => ensureDatelineSafeFeatures(tripsData), [tripsData]);

  // 6. Verified continuous flight trajectories (PathLayer)
  const pathLayer = useMemo(() => {
    if (!safeTripsData || safeTripsData.length === 0) return null;

    return new PathLayer({
      id: 'bird-track-paths',
      data: safeTripsData,
      getPath: (d) => d.geometry.coordinates,
      getColor: ({ properties }) => {
        const c = speciesConfig[properties.species]?.color || [42, 111, 125];
        const isHighlight =
          highlightedSpecies && properties.species === highlightedSpecies;
        return [c[0], c[1], c[2], isHighlight ? 210 : 130];
      },
      getWidth: (d) =>
        d.properties.species === highlightedSpecies ? 3.0 : 2.0,
      widthMinPixels: 1.5,
      widthUnits: 'pixels',
      jointRounded: true,
      capRounded: true,
      pickable: true,
      onHover: (info) => {
        if (info && info.object) {
          setHoverInfo({
            ...info,
            isTrajectory: true,
          });
        }
      },
      onClick: (info) => {
        if (info?.object?.properties?.species && onSelectSpeciesByName) {
          onSelectSpeciesByName(info.object.properties.species);
        }
      },
      parameters: { blend: true },
    });
  }, [safeTripsData, highlightedSpecies, onSelectSpeciesByName]);

  // 7. Deck.gl TripsLayer for animated pulsing routes along trajectories
  const tripLayer = useMemo(() => {
    if (!safeTripsData || safeTripsData.length === 0) return null;

    return new TripsLayer({
      id: 'birds-trips',
      data: safeTripsData,
      currentTime: time,
      getTimestamps: (d) => d.properties.times,
      trailLength: ANIMATION_SPEED * 120,
      getColor: ({ properties }) => {
        const c = speciesConfig[properties.species]?.color || [42, 111, 125];
        return [c[0], c[1], c[2], 255];
      },
      getPath: (d) => d.geometry.coordinates,
      getWidth: (d) => (d.properties.species === highlightedSpecies ? 5 : 3.5),
      jointRounded: true,
      capRounded: true,
      opacity: 0.95,
      widthUnits: 'pixels',
      shadowEnabled: false,
      parameters: { blend: true },
      updateTriggers: {
        getWidth: highlightedSpecies,
      },
    });
  }, [safeTripsData, time, highlightedSpecies]);

  const layers = useMemo(() => {
    return [
      graticuleLayer,
      twinLayer,
      occurrenceLayer,
      pathLayer,
      tripLayer,
      bottleneckLayer,
    ].filter(Boolean);
  }, [
    graticuleLayer,
    twinLayer,
    occurrenceLayer,
    pathLayer,
    tripLayer,
    bottleneckLayer,
  ]);

  return (
    <div className="map-wrapper" style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={({ viewState }) => setViewState(viewState)}
        controller={{ doubleClickZoom: false, dragRotate: false }}
        layers={layers}
      >
        <Map
          attributionControl={false}
          mapStyle="https://basemaps.cartocdn.com/gl/positron-nolabels-gl-style/style.json"
        />
      </DeckGL>

      {/* Floating Map Navigation & Reset Controls */}
      <div className="map-controls-floating">
        <button
          className="map-control-btn"
          onClick={handleZoomIn}
          title="Zoom in"
          aria-label="Zoom in"
        >
          <Plus size={18} strokeWidth={2.2} />
        </button>
        <button
          className="map-control-btn"
          onClick={handleZoomOut}
          title="Zoom out"
          aria-label="Zoom out"
        >
          <Minus size={18} strokeWidth={2.2} />
        </button>
        <button
          className="map-control-btn reset-btn"
          onClick={handleResetView}
          title="Reset to global world view"
          aria-label="Reset to global view"
        >
          <Compass size={18} strokeWidth={2.2} />
        </button>
      </div>

      {/* Floating Editorial Tooltip */}
      {hoverInfo && hoverInfo.object && (
        <div
          className="map-tooltip"
          style={{
            left: hoverInfo.x + 14,
            top: hoverInfo.y - 14,
          }}
        >
          {hoverInfo.isBottleneck ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span className="epistemic-badge badge-simulated">simulated</span>
                <strong style={{ color: '#1E2229' }}>
                  Critical Bottleneck #{hoverInfo.link.rank}
                </strong>
                {hoverInfo.isProtected && (
                  <span style={{ fontSize: '10px', color: '#047857', background: '#D1FAE5', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>
                    Protected
                  </span>
                )}
              </div>
              <div style={{ fontSize: '11px', color: '#4B5563', lineHeight: '1.45' }}>
                <div><strong>Location:</strong> {hoverInfo.link.lat}°N, {hoverInfo.link.lon}°E</div>
                <div><strong>Severing Loss:</strong> {hoverInfo.link.loss_of_reachable_area_km2.toLocaleString()} km² ({hoverInfo.link.loss_percent}%)</div>
                <div><strong>Fragmentation:</strong> +{hoverInfo.link.connected_components_increase} disconnected component(s)</div>
                <div style={{ marginTop: '5px', paddingTop: '4px', borderTop: '1px solid #E5E0D8', fontSize: '10px', color: '#2563EB', fontWeight: 600 }}>
                  ✦ Click node to simulate corridor protection
                </div>
              </div>
            </div>
          ) : hoverInfo.isTwinCell ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span className="epistemic-badge badge-simulated">simulated</span>
                <strong style={{ color: '#1E2229' }}>
                  Climate Suitability Cell
                </strong>
              </div>
              <div style={{ fontSize: '11px', color: '#4B5563', lineHeight: '1.45' }}>
                <div><strong>Coordinates:</strong> {hoverInfo.cell.lat}°N, {hoverInfo.cell.lon}°E</div>
                <div>
                  <strong>Horizon Suitability:</strong> {Math.round(hoverInfo.suitability * 100)}% ({Math.round(twinSlider * 100)}% future)
                </div>
                <div><strong>ERA5 Baseline:</strong> {Math.round(hoverInfo.cell.baseline_suitability * 100)}%</div>
                <div><strong>CMIP6 Future:</strong> {Math.round(hoverInfo.cell.future_suitability * 100)}%</div>
                <div><strong>Model Spread:</strong> ±{(hoverInfo.cell.model_spread * 100).toFixed(1)}%</div>
                <div style={{ marginTop: '4px', borderTop: '1px solid #E5E0D8', paddingTop: '4px', fontSize: '10px', color: '#9CA3AF' }}>
                  Macro-climate suitability envelope only; unmodeled land cover.
                </div>
              </div>
            </div>
          ) : hoverInfo.isTrajectory ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span className="epistemic-badge badge-observed">observed</span>
                <strong style={{ color: '#1E2229' }}>
                  {hoverInfo.object.properties?.species}
                </strong>
              </div>
              <div style={{ fontSize: '11px', color: '#4B5563' }}>
                <div><strong>{hoverInfo.object.properties?.movement_label || (hoverInfo.object.properties?.movement_type === 'foraging' ? 'Tracked Movements (Pelagic Foraging)' : 'Verified GPS Telemetry Track')}</strong></div>
                <div>Points: {hoverInfo.object.properties?.point_count || hoverInfo.object.geometry?.coordinates?.length}</div>
                <div style={{ marginTop: '4px', fontSize: '10px', color: '#6B7280' }}>
                  Dataset: {hoverInfo.object.properties?.dataset_title || 'PlutoF BirdMap'}
                </div>
                <div style={{ fontSize: '10px', color: '#9CA3AF' }}>
                  Licence: {hoverInfo.object.properties?.license || 'CC-BY-NC 4.0'}
                </div>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span className="epistemic-badge badge-observed">observed</span>
                <strong style={{ color: '#1E2229' }}>
                  GBIF #{hoverInfo.object.gbif_id}
                </strong>
              </div>
              <div style={{ fontSize: '11px', color: '#4B5563', lineHeight: '1.45' }}>
                <div><strong>Date:</strong> {hoverInfo.object.event_date || 'Empirical Record'} (Month {hoverInfo.object.month})</div>
                <div><strong>Coordinates:</strong> {hoverInfo.object.lat.toFixed(3)}°N, {hoverInfo.object.lon.toFixed(3)}°E</div>
                <div><strong>Country:</strong> {hoverInfo.object.country_code || 'Verified Habitat'}</div>
                <div><strong>Basis:</strong> {hoverInfo.object.basis_of_record}</div>
                <div style={{ marginTop: '4px', borderTop: '1px solid #E5E0D8', paddingTop: '4px', fontSize: '10px', color: '#9CA3AF' }}>
                  Licence: {hoverInfo.object.license || 'CC0 / CC-BY'}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default MapView;
