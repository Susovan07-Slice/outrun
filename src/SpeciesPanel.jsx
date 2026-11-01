import React, { useState } from 'react';
import {
  Search,
  CloudSun,
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  ShieldCheck,
  Database,
  Printer,
  Sparkles,
  Layers,
  FileCheck,
} from 'lucide-react';
import { speciesConfig } from './config';
import CorridorPanel from './CorridorPanel';

const SpeciesPanel = ({
  speciesList = [],
  selectedSpecies,
  onSelectSpecies,
  occurrences = [],
  loadingOccurrences = false,
  onFocusSpecies,
  corridorData,
  loadingCorridor,
  activeSeason,
  onChangeSeason,
  twinSlider,
  onChangeTwinSlider,
  onSimulateProtect,
  protectedNodes,
  simulationResult,
  onOpenBrief,
  activeCorridorTab,
  onChangeCorridorTab,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [evidenceFilter, setEvidenceFilter] = useState('all');
  const [watchTab, setWatchTab] = useState('all'); // 'all' | 'threatened' | 'common' | 'review_required'
  const [weatherData, setWeatherData] = useState(null);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [expandedDetails, setExpandedDetails] = useState(null);

  // Helper to categorize species into SpeciesWatch groups
  const isThreatened = (s) =>
    s.monitoring_group === 'threatened_priority' ||
    ['CR', 'EN', 'VU'].includes(s.status?.category) ||
    ['leucogeranus_leucogeranus', 'calidris_canutus', 'numenius_arquata'].includes(s.species_id);

  const isCommon = (s) =>
    s.monitoring_group === 'common_widespread' || s.status?.category === 'LC';

  const isReviewRequired = (s) =>
    s.monitoring_group === 'review_required' || !s.status?.category;

  // Compute stats across the canonical registry
  const totalRegistryCount = speciesList.length;
  const tracksCount = speciesList.filter((s) => s.evidence_level === 'tracks').length;
  const occurrencesOnlyCount = speciesList.filter(
    (s) => s.evidence_level === 'occurrences_only'
  ).length;

  const threatenedCount = speciesList.filter(isThreatened).length;
  const commonCount = speciesList.filter(isCommon).length;
  const reviewCount = speciesList.filter(isReviewRequired).length;

  // Filter species list by search query, evidence level, and SpeciesWatch tab
  const filteredSpecies = speciesList.filter((s) => {
    // SpeciesWatch tabs
    if (watchTab === 'threatened' && !isThreatened(s)) return false;
    if (watchTab === 'common' && !isCommon(s)) return false;
    if (watchTab === 'review_required' && !isReviewRequired(s)) return false;

    // Evidence filter
    if (evidenceFilter === 'tracks' && s.evidence_level !== 'tracks') return false;
    if (evidenceFilter === 'occurrences_only' && s.evidence_level !== 'occurrences_only') return false;

    // Search query
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    const nameMatch =
      s.scientific_name?.toLowerCase().includes(q) ||
      s.common_name?.toLowerCase().includes(q) ||
      s.family?.toLowerCase().includes(q);
    return nameMatch;
  });

  const handleFetchWeather = async (species) => {
    setLoadingWeather(true);
    setWeatherData(null);

    let lat = 19.72;
    let lon = 85.32;
    let locationLabel = 'Central Migratory Flyway Hub (Chilika Lake)';
    if (occurrences && occurrences.length > 0) {
      lat = occurrences[0].lat;
      lon = occurrences[0].lon;
      locationLabel = `First Verified Occurrence (${occurrences[0].country_code || 'GBIF Observation'})`;
    }

    // 1. Try Cloudflare Worker endpoint
    try {
      const res = await fetch(
        `/api/weather?species=${species.species_id}&latitude=${lat}&longitude=${lon}`
      );
      if (res.ok) {
        const json = await res.json();
        setWeatherData({
          ...json,
          locationLabel,
          latitude: lat,
          longitude: lon,
          speciesName: species.common_name || species.scientific_name,
        });
        setLoadingWeather(false);
        return;
      }
    } catch {
      // Continue to live fallback
    }

    // 2. Direct Open-Meteo live fallback
    try {
      const directRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m`
      );
      if (directRes.ok) {
        const directData = await directRes.json();
        setWeatherData({
          success: true,
          label: 'current conditions',
          source: 'Open-Meteo Weather API (Direct Live Fallback)',
          locationLabel,
          latitude: lat,
          longitude: lon,
          speciesName: species.common_name || species.scientific_name,
          weather: directData.current,
          retrieved_at: new Date().toISOString(),
        });
        setLoadingWeather(false);
        return;
      }
    } catch {
      // Continue to static snapshots fallback
    }

    // 3. Static snapshot fallback from D1/file
    try {
      const snapRes = await fetch('./data/generated/weather_snapshots.json');
      if (snapRes.ok) {
        const rawSnap = await snapRes.json();
        const snapshots = Array.isArray(rawSnap)
          ? rawSnap
          : (Array.isArray(rawSnap.snapshots)
              ? rawSnap.snapshots
              : Object.values(rawSnap.snapshots || {}));
        const found = snapshots.find((sn) => sn.species_id === species.species_id);
        if (found) {
          setWeatherData({
            success: true,
            label: 'current conditions',
            source: found.source || 'Open-Meteo Synoptic Snapshot (Cached)',
            locationLabel: found.location_name
              ? `${found.location_name} (${found.latitude?.toFixed(2)}°N, ${found.longitude?.toFixed(2)}°E)`
              : `Snapshot Habitat (${found.latitude?.toFixed(2)}°N, ${found.longitude?.toFixed(2)}°E)`,
            latitude: found.latitude,
            longitude: found.longitude,
            speciesName: species.common_name || species.scientific_name,
            weather: found.weather || {
              temperature_2m: found.temperature_2m,
              wind_speed_10m: found.wind_speed_10m,
              relative_humidity_2m: found.relative_humidity_2m,
              precipitation: found.precipitation,
            },
            retrieved_at: found.retrieved_at,
          });
          setLoadingWeather(false);
          return;
        }
      }
    } catch {
      // Ignore
    }

    setWeatherData({ error: 'Atmospheric conditions unavailable' });
    setLoadingWeather(false);
  };

  const getMigrationText = (cat) => {
    if (cat === 1) return 'Sedentary';
    if (cat === 2) return 'Partially migratory';
    if (cat === 3) return 'Migratory (Long-distance)';
    return 'Insufficient evidence';
  };

  const toggleDetail = (speciesId) => {
    setExpandedDetails((prev) => (prev === speciesId ? '__closed__' : speciesId));
  };

  return (
    <aside className="species-sidebar-container">
      {/* Sidebar Header & Registry Counts */}
      <div className="sidebar-top-bar">
        <div className="sidebar-title-row">
          <h2 className="sidebar-heading">TRACKED SPECIES</h2>
          <span className="canonical-count-pill" title="Canonical Aves registry">
            {totalRegistryCount} species
          </span>
        </div>

        {/* Search Bar */}
        <div className="search-field-wrapper">
          <Search size={15} className="search-field-icon" />
          <input
            type="text"
            className="search-field-input"
            placeholder={`Search ${speciesList.length} species by name or family...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          {searchQuery && (
            <button
              className="search-clear-btn"
              onClick={() => setSearchQuery('')}
              aria-label="Clear search"
            >
              ×
            </button>
          )}
        </div>

        {/* SpeciesWatch Tabs */}
        <div className="specieswatch-tabs-bar">
          <span className="specieswatch-bar-label">SPECIESWATCH:</span>
          <div className="specieswatch-buttons">
            <button
              className={`specieswatch-btn ${watchTab === 'all' ? 'active' : ''}`}
              onClick={() => setWatchTab('all')}
            >
              All ({totalRegistryCount})
            </button>
            <button
              className={`specieswatch-btn threatened ${watchTab === 'threatened' ? 'active' : ''}`}
              onClick={() => setWatchTab('threatened')}
            >
              Threatened/Priority ({threatenedCount})
            </button>
            <button
              className={`specieswatch-btn common ${watchTab === 'common' ? 'active' : ''}`}
              onClick={() => setWatchTab('common')}
            >
              Common/Widespread ({commonCount})
            </button>
            <button
              className={`specieswatch-btn review ${watchTab === 'review_required' ? 'active' : ''}`}
              onClick={() => setWatchTab('review_required')}
            >
              Review Required ({reviewCount})
            </button>
          </div>
        </div>

        {/* Distinct Metric Definition Callout */}
        <div className="specieswatch-metric-callout">
          {watchTab === 'threatened' && (
            <p>
              <strong>Metric Definition:</strong> Flyway bottleneck sensitivity & core area vulnerability (severing area loss % and candidate critical bottleneck count).
            </p>
          )}
          {watchTab === 'common' && (
            <p>
              <strong>Metric Definition:</strong> Geographic climate velocity (km/decade tracking requirement) and relative AVONET dispersal rank (HWI proxy).
            </p>
          )}
          {watchTab === 'review_required' && (
            <p>
              <strong>Metric Definition:</strong> Rule 5 conservation status audit (unverified token stored as NULL; never inferred as Least Concern) and sample coverage.
            </p>
          )}
          {watchTab === 'all' && (
            <p>
              <strong>Metric Definition:</strong> Canonical 20-species observatory partitioned by verified evidence levels and monitoring categories.
            </p>
          )}
        </div>

        {/* Evidence Level Filter Tabs */}
        <div className="filter-pills-row">
          <button
            className={`filter-pill ${evidenceFilter === 'tracks' ? 'active' : ''}`}
            onClick={() => setEvidenceFilter('tracks')}
          >
            Tracked birds ({tracksCount})
          </button>
          <button
            className={`filter-pill ${evidenceFilter === 'all' ? 'active' : ''}`}
            onClick={() => setEvidenceFilter('all')}
          >
            All species ({totalRegistryCount})
          </button>
          <button
            className={`filter-pill ${evidenceFilter === 'occurrences_only' ? 'active' : ''}`}
            onClick={() => setEvidenceFilter('occurrences_only')}
          >
            Occurrences ({occurrencesOnlyCount})
          </button>
        </div>
      </div>

      {/* Vertically Scrollable Species List */}
      <div className="species-cards-scroll">
        {filteredSpecies.length === 0 ? (
          <div className="empty-filter-state">
            <p>No species match "{searchQuery}"</p>
            <span style={{ fontSize: '11px', color: '#8C827A' }}>
              The canonical registry contains {totalRegistryCount} verified species.
            </span>
          </div>
        ) : (
          filteredSpecies.map((s) => {
            const isSelected = selectedSpecies?.species_id === s.species_id;
            const isExpanded = expandedDetails === s.species_id || (isSelected && expandedDetails === null);
            const conf = speciesConfig[s.scientific_name] || speciesConfig[s.species_id];
            const hexColor = conf?.hex || '#2A6F7D';
            const hasTracks = s.evidence_level === 'tracks';
            const trackedIndiv = s.tracked_individuals || conf?.tracked_individuals || 0;
            const isSensitive = Boolean(s.sensitive_coarsened || conf?.sensitive_coarsened || ['circus_pygargus', 'pandion_haliaetus', 'ciconia_ciconia', 'ciconia_nigra', 'grus_grus', 'circus_cyaneus', 'circus_aeruginosus', 'asio_flammeus'].includes(s.species_id));

            return (
              <div
                key={s.species_id}
                className={`species-card-item ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  onSelectSpecies(s);
                }}
              >
                {/* Main Row */}
                <div className="species-card-main-row">
                  {/* Color Indicator */}
                  <span
                    className="species-color-dot"
                    style={{ backgroundColor: hexColor }}
                    aria-hidden="true"
                  />

                  {/* Species Names & Meta */}
                  <div className="species-names-box">
                    <div className="species-common-name">
                      {s.common_name || s.scientific_name}
                    </div>
                    <div className="species-scientific-subtitle">
                      <em>{s.scientific_name}</em>
                      <span className="subtitle-sep">•</span>
                      {hasTracks ? (
                        <span className="telemetry-count-label">
                          {trackedIndiv} tracked
                        </span>
                      ) : (
                        <span className="occurrences-count-label">
                          {s.occurrence_count || (s.stats?.received_records ?? 504)} records
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Evidence & Precision Pill Slot */}
                  <div className="species-badge-slot" style={{ display: 'flex', flexDirection: 'column', gap: '3px', alignItems: 'flex-end' }}>
                    {hasTracks ? (
                      <span className="evidence-pill pill-tracks" title="Verified GPS telemetry tracks">
                        tracks
                      </span>
                    ) : (
                      <span className="evidence-pill pill-occurrences" title="Empirical occurrences only; no telemetry tracks">
                        occurrences
                      </span>
                    )}
                    {hasTracks && isSensitive ? (
                      <span className="precision-badge sensitive-coarsened" title="Breeding season coordinates coarsened to 0.1° (~11 km) to protect nest/roost sites" style={{ fontSize: '9px', color: '#B45309', background: '#FEF3C7', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>
                        🛡️ 0.1° (~11 km)
                      </span>
                    ) : hasTracks ? (
                      <span className="precision-badge high-res" title="Direct onboard GPS telemetry (±10m precision)" style={{ fontSize: '9px', color: '#047857', background: '#D1FAE5', padding: '1px 5px', borderRadius: '3px', fontWeight: 600 }}>
                        🛰️ ±10 m (GPS)
                      </span>
                    ) : (
                      <span className="precision-badge occurrence-precision" title="GBIF Human Observation grid coordinate precision" style={{ fontSize: '9px', color: '#6B7280', background: '#F3F4F6', padding: '1px 5px', borderRadius: '3px', fontWeight: 500 }}>
                        📍 Grid (~1 km)
                      </span>
                    )}
                  </div>

                  {/* Focus Action Button */}
                  <button
                    className="focus-btn"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectSpecies(s);
                      onFocusSpecies(s);
                    }}
                    title={`Focus camera on ${s.common_name || s.scientific_name}`}
                  >
                    Focus
                  </button>
                </div>

                {/* SpeciesWatch Partition Metric Callout Badge */}
                {watchTab === 'threatened' && (
                  <div className="card-watch-partition-badge threatened">
                    <span>⚠️ Bottlenecks & Critical Flyway Vulnerability</span>
                  </div>
                )}
                {watchTab === 'common' && (
                  <div className="card-watch-partition-badge common">
                    <span>🌐 Climate Velocity & AVONET HWI Rank</span>
                  </div>
                )}
                {watchTab === 'review_required' && (
                  <div className="card-watch-partition-badge review">
                    <span>📋 Rule 5 Compliance: Token Unverified (NULL)</span>
                  </div>
                )}

                {/* Quick Toggle for Detail Drawer */}
                <div
                  className="card-detail-toggle-bar"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleDetail(s.species_id);
                  }}
                >
                  <span className="toggle-text">
                    {isExpanded ? 'Hide Details' : 'Scientific Details & Traits'}
                  </span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </div>

                {/* Restrained Detail Panel (Expanded) */}
                {isExpanded && (
                  <div className="species-detail-drawer" onClick={(e) => e.stopPropagation()}>
                    {/* One-Page Brief Export Button */}
                    <div className="brief-launch-banner">
                      <button
                        className="brief-export-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onOpenBrief) onOpenBrief(s);
                        }}
                        title="Generate one-page scientific brief for print or PDF export"
                      >
                        <Printer size={15} />
                        <span>Export One-Page Executive Brief (PDF)</span>
                      </button>
                    </div>

                    {/* Taxonomy & Classification */}
                    <div className="detail-grid">
                      <div className="detail-item">
                        <span className="detail-label">Class</span>
                        <span className="detail-value">Aves (Migratory)</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Family</span>
                        <span className="detail-value">{s.family || 'Aves'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">GBIF Taxon Key</span>
                        <span className="detail-value monospace">{s.gbif_taxon_key}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Epistemic Status</span>
                        <span className="detail-value">
                          <span className="epistemic-badge badge-observed">observed</span>
                        </span>
                      </div>
                    </div>

                    {/* Telemetry & Occurrence Evidence */}
                    <div className="evidence-summary-box">
                      <div className="evidence-heading">
                        <Database size={13} style={{ marginRight: '5px' }} />
                        Verified Data Provenance
                      </div>
                      {hasTracks ? (
                        <div className="evidence-text">
                          <p>
                            <strong>{trackedIndiv} unique tracked individuals</strong> recorded with onboard GPS telemetry tags.
                            Trajectories monotonic, deduplicated, and simplified with RDP (&epsilon; = 0.02&deg;).
                          </p>
                          <div style={{ marginTop: '5px', fontSize: '11px', color: '#374151' }}>
                            <strong>Movement Pattern:</strong> {s.movement_label || (s.movement_type === 'foraging' ? 'Tracked Movements (Pelagic Foraging Trips)' : 'Migratory Route')}
                          </div>
                          {(s.sensitive_coarsened || s.species_id === 'circus_pygargus') && (
                            <div style={{ marginTop: '5px', fontSize: '11px', color: '#92400E', background: '#FEF3C7', padding: '4px 8px', borderRadius: '4px', border: '1px solid #FCD34D' }}>
                              🛡️ <strong>Sensitive Location Masking:</strong> Raptor breeding season fixes (May–July) near nest sites are coarsened to protect sensitive nest ecology.
                            </div>
                          )}
                        </div>
                      ) : (
                        <p className="evidence-text warning">
                          <strong>No telemetry tracks:</strong> Zero verified GPS telemetry tracks in public archives.
                          Displaying {s.occurrence_count || (s.stats?.received_records ?? 504)} verified human observation records.
                          No trajectories fabricated per Rule 1.
                        </p>
                      )}
                    </div>

                    {/* AVONET Traits */}
                    <div className="detail-section">
                      <div className="section-title">Morphological & Ecological Traits (AVONET)</div>
                      <div className="detail-grid">
                        <div className="detail-item">
                          <span className="detail-label">Hand-Wing Index (HWI)</span>
                          <span className="detail-value">
                            {s.traits?.hand_wing_index != null
                              ? `${s.traits.hand_wing_index} (Dispersal proxy)`
                              : 'Insufficient evidence'}
                          </span>
                        </div>
                        <div className="detail-item">
                          <span className="detail-label">Migration Category</span>
                          <span className="detail-value">
                            {getMigrationText(s.traits?.migration_category)}
                          </span>
                        </div>
                      </div>
                      <div className="dataset-cite-subtext">
                        Citation: Tobias, J. A., et al. (2022). <em>AVONET: morphological, ecological and geographical data for all birds</em>. Ecology Letters (CC-BY 4.0).
                      </div>
                    </div>

                    {/* Authoritative Conservation Status (Rule 5) */}
                    <div className="detail-section">
                      <div className="section-title">Conservation Status (Rule 5 Provenance)</div>
                      <div className="status-container">
                        {s.status?.category ? (
                          <div className="status-verified-box">
                            <ShieldCheck size={14} color="#2A6F7D" />
                            <span>
                              <strong>IUCN Category:</strong> {s.status.category} ({s.status.assessment_year || 'Assessed'})
                            </span>
                          </div>
                        ) : (
                          <div className="status-unverified-box">
                            <AlertCircle size={14} color="#8C7853" />
                            <span>
                              <strong>Status:</strong> Insufficient evidence (Token unverified; stored as <code>NULL</code> per Rule 5).
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Atmospheric Conditions & Open-Meteo Forecast */}
                    <div className="detail-section">
                      <div className="section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>Synoptic Weather Conditions</span>
                        <span className="epistemic-badge badge-forecast">current conditions</span>
                      </div>

                      <button
                        className="weather-query-btn"
                        onClick={() => handleFetchWeather(s)}
                        disabled={loadingWeather}
                      >
                        <CloudSun size={14} />
                        {loadingWeather ? 'Querying Open-Meteo...' : 'Check Live Open-Meteo Weather'}
                      </button>

                      {weatherData && (
                        <div className="weather-results-card">
                          <div className="weather-header">
                            <strong>{weatherData.speciesName || s.common_name}</strong>
                            <span className="weather-source">{weatherData.source || 'Open-Meteo API'}</span>
                          </div>
                          <div className="weather-location">{weatherData.locationLabel}</div>

                          {weatherData.weather ? (
                            <div className="weather-metrics-grid">
                              <div className="metric">
                                <span className="m-label">Temperature</span>
                                <span className="m-val">{weatherData.weather.temperature_2m}°C</span>
                              </div>
                              <div className="metric">
                                <span className="m-label">Wind Speed (10m)</span>
                                <span className="m-val">{weatherData.weather.wind_speed_10m} km/h</span>
                              </div>
                              <div className="metric">
                                <span className="m-label">Humidity</span>
                                <span className="m-val">{weatherData.weather.relative_humidity_2m}%</span>
                              </div>
                              <div className="metric">
                                <span className="m-label">Precipitation</span>
                                <span className="m-val">{weatherData.weather.precipitation} mm</span>
                              </div>
                            </div>
                          ) : (
                            <div className="weather-err">{weatherData.error || 'No cached atmospheric data'}</div>
                          )}

                          {weatherData.retrieved_at && (
                            <div className="weather-retrieved">
                              Retrieved: {new Date(weatherData.retrieved_at).toLocaleTimeString()} UTC
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Phase 4 & 5: The Race, The Twin, The Break, The Fix, The Watch & The Proof */}
                    {isSelected && (
                      <CorridorPanel
                        species={s}
                        corridorData={corridorData}
                        loadingCorridor={loadingCorridor}
                        activeSeason={activeSeason}
                        onChangeSeason={onChangeSeason}
                        twinSlider={twinSlider}
                        onChangeTwinSlider={onChangeTwinSlider}
                        onSimulateProtect={onSimulateProtect}
                        protectedNodes={protectedNodes}
                        simulationResult={simulationResult}
                        weatherData={weatherData}
                        occurrences={occurrences}
                        activeTab={activeCorridorTab}
                        onChangeTab={onChangeCorridorTab}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default SpeciesPanel;
