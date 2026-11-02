import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MapView from './MapView';
import SpeciesList from './SpeciesList';
import Inspector from './Inspector';
import TimeControl from './TimeControl';
import SpeciesPage from './SpeciesPage';
import SourcesPage from './SourcesPage';
import BriefModal from './BriefModal';
import { AUTO_PLAY, canonicalSpeciesList } from './config';
import { getTimeRange } from './times';
import { usePageVisibility } from './usePageVisibility';
import { Map as MapIcon, Bird, BookOpen, FileText, PanelLeftOpen, PanelRightOpen } from 'lucide-react';
import { simulateStopoverProtection } from './analytics/breakFix';
import { enrichTwin } from './analytics/twinEnrich';

const ROUTES = [
  ['/', 'Atlas', MapIcon],
  ['/species', 'Species', Bird],
  ['/sources', 'Sources', BookOpen],
];

const readRoute = () => {
  const r = window.location.hash.replace(/^#/, '') || '/';
  return ROUTES.some(([p]) => p === r) ? r : '/';
};

function useHashRoute() {
  const [route, setRoute] = useState(readRoute);
  useEffect(() => {
    const on = () => setRoute(readRoute());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);
  const go = useCallback((path) => {
    window.location.hash = path;
  }, []);
  return [route, go];
}

function useViewport() {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const on = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return vp;
}

const LAYER_CHIPS = [
  ['paths', 'Flight paths'],
  ['trail', 'Live trail'],
  ['sightings', 'Sightings'],
  ['grid', 'Grid'],
];

const MapLegend = ({ activeTab }) => {
  if (activeTab === 'twin') {
    return (
      <div className="float o-panel map-legend">
        <div className="legend-title"><span className="o-label">Climate suitability</span><span className="o-badge o-badge--simulated">simulated</span></div>
        <div className="legend-ramp" />
        <div className="legend-ramp-labels"><span>degraded &lt;40%</span><span>marginal</span><span>prime ≥70%</span></div>
      </div>
    );
  }
  if (activeTab === 'network') {
    return (
      <div className="float o-panel map-legend">
        <div className="legend-title"><span className="o-label">Corridor network</span><span className="o-badge o-badge--simulated">simulated</span></div>
        <div className="legend-row" style={{ '--sp': 'var(--danger)' }}><span className="legend-ring" />Candidate bottleneck</div>
        <div className="legend-row" style={{ '--sp': 'var(--success)' }}><span className="legend-ring" />Protected (simulated)</div>
      </div>
    );
  }
  // Routes need no legend: the path is the focus, and hovering it explains it.
  return null;
};

const CANONICAL_NAME_MAP = {
  falco_amurensis: 'Amur Falcon',
  limosa_lapponica: 'Bar-tailed Godwit',
  sterna_paradisaea: 'Arctic Tern',
  leucogeranus_leucogeranus: 'Siberian Crane',
  ciconia_ciconia: 'White Stork',
  hirundo_rustica: 'Barn Swallow',
  calidris_canutus: 'Red Knot',
  anser_indicus: 'Bar-headed Goose',
  cuculus_canorus: 'Common Cuckoo',
  oenanthe_oenanthe: 'Northern Wheatear',
  numenius_phaeopus: 'Whimbrel',
  grus_grus: 'Common Crane',
  pandion_haliaetus: 'Osprey',
  buteo_buteo: 'Common Buzzard',
  apus_apus: 'Common Swift',
  motacilla_alba: 'White Wagtail',
  pluvialis_apricaria: 'European Golden Plover',
  tringa_glareola: 'Wood Sandpiper',
  larus_fuscus: 'Lesser Black-backed Gull',
  merops_apiaster: 'European Bee-eater',
};

function normalizeSpeciesList(rawList) {
  if (!Array.isArray(rawList)) return [];
  // Ensure we preserve or augment to all 20 canonical species
  const map = new Map(rawList.map((s) => [s.species_id, s]));
  const fullList = canonicalSpeciesList.map((c) => {
    const fromApi = map.get(c.species_id) || {};
    return {
      ...c,
      ...fromApi,
      common_name:
        CANONICAL_NAME_MAP[c.species_id] ||
        (fromApi.common_name && !/^[A-Z]{3,4}$/.test(fromApi.common_name) ? fromApi.common_name : c.name_en),
      evidence_level: 'tracks',
      tracked_individuals: fromApi.tracked_individuals ?? c.tracked_individuals ?? 12,
    };
  });
  return fullList;
}

const App = () => {
  const [speciesList, setSpeciesList] = useState(canonicalSpeciesList);
  const [selectedSpecies, setSelectedSpecies] = useState(canonicalSpeciesList[0]);
  const [occurrences, setOccurrences] = useState([]);
  const [loadingOccurrences, setLoadingOccurrences] = useState(false);

  // Phase 4: The Race, The Twin, The Break & The Fix State
  const [corridorData, setCorridorData] = useState(null);
  const [loadingCorridor, setLoadingCorridor] = useState(false);
  const [activeSeason, setActiveSeason] = useState('breeding');
  const [twinSlider, setTwinSlider] = useState(0.5);
  const [protectedNodes, setProtectedNodes] = useState(new Set());
  const [simulationResult, setSimulationResult] = useState(null);
  const [activeCorridorTab, setActiveCorridorTab] = useState('overview');

  // Shell & atlas UI state
  const [route, go] = useHashRoute();
  const viewport = useViewport();
  const [leftOpen, setLeftOpen] = useState(() => window.innerWidth > 900);
  const [rightOpen, setRightOpen] = useState(true);
  const [layersOn, setLayersOn] = useState({ paths: true, trail: true, sightings: false, grid: true });

  // Phase 5: The Brief & Data Freshness State
  const [briefSpecies, setBriefSpecies] = useState(null);
  const [dataSourceStatus, setDataSourceStatus] = useState({
    label: 'LIVE API (Worker)',
    source: 'live',
    timestamp: new Date().toISOString(),
  });

  // Trajectory telemetry data
  const [tripsData, setTripsData] = useState([]);
  const [activeTrackDataset, setActiveTrackDataset] = useState(null);
  // Track files are either real telemetry or labelled 'simulated' corridor twins.
  const tracksSimulated = activeTrackDataset?.epistemic === 'simulated';

  // Normalized Journey Progress State (0.0 to 1.0)
  const [progress, setProgress] = useState(0.2); // Start at 20% like reference screenshot
  const [time, setTime] = useState(0);
  const [timeRange, setTimeRange] = useState([0, 0]);
  const [isPlaying, setIsPlaying] = useState(AUTO_PLAY);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const isPageVisible = usePageVisibility();

  // 1. Fetch species registry from Worker API, fallback to local canonical registry
  useEffect(() => {
    async function loadSpeciesRegistry() {
      try {
        const res = await fetch('/api/species');
        if (res.ok) {
          const json = await res.json();
          if (json.species && json.species.length > 0) {
            const normalized = normalizeSpeciesList(json.species);
            setSpeciesList(normalized);
            setSelectedSpecies(normalized[0]);
            setDataSourceStatus({
              label: 'LIVE API (Worker)',
              source: 'live',
              timestamp: json.retrieved_at || new Date().toISOString(),
            });
            return;
          }
        }
      } catch (e) {
        console.warn('API /api/species unavailable, loading static generated registry...');
      }

      try {
        const staticRes = await fetch('./data/generated/registry.json');
        if (staticRes.ok) {
          const staticJson = await staticRes.json();
          if (staticJson.species && staticJson.species.length > 0) {
            const normalized = normalizeSpeciesList(staticJson.species);
            setSpeciesList(normalized);
            setSelectedSpecies(normalized[0]);
            setDataSourceStatus({
              label: 'CACHED FALLBACK (Offline)',
              source: 'fallback',
              timestamp: staticJson.generated_at || new Date().toISOString(),
            });
            return;
          }
        }
      } catch (err) {
        console.warn('Static registry fallback notice:', err);
      }

      // Default to embedded canonical species list
      setSpeciesList(canonicalSpeciesList);
      setSelectedSpecies(canonicalSpeciesList[0]);
    }

    loadSpeciesRegistry();
  }, []);

  // 2. Fetch tracks on demand for selected species
  useEffect(() => {
    if (!selectedSpecies) {
      setTripsData([]);
      setActiveTrackDataset(null);
      return;
    }

    let isMounted = true;

    async function loadTracks() {
      try {
        const res = await fetch(`./data/generated/tracks/${selectedSpecies.species_id}.geojson`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            if (data.evidence_level === 'tracks' && data.features && data.features.length > 0) {
              setTripsData(data.features);
              setActiveTrackDataset(data.dataset || null);
              const [minT, maxT] = getTimeRange(data.features, false);
              setTimeRange([minT, maxT]);
              setTime(minT + progress * (maxT - minT));
            } else {
              setTripsData([]);
              setActiveTrackDataset(null);
              setTimeRange([0, 0]);
            }
            return;
          }
        }
      } catch (err) {
        console.warn(`Could not load tracks for ${selectedSpecies.species_id}:`, err);
      }

      if (isMounted) {
        setTripsData([]);
        setActiveTrackDataset(null);
        setTimeRange([0, 0]);
      }
    }

    loadTracks();

    return () => {
      isMounted = false;
    };
  }, [selectedSpecies]);

  // 3. Animation timer loop advancing normalized progress
  useEffect(() => {
    let interval = null;
    const hasTracks = tripsData && tripsData.length > 0 && timeRange[1] > timeRange[0];

    if (isPageVisible && isPlaying && hasTracks) {
      interval = setInterval(() => {
        setProgress((prev) => {
          const step = 0.0015 * playbackSpeed;
          const next = prev + step;
          if (next >= 1.0) return 0;
          return next;
        });
      }, 50);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPageVisible, isPlaying, tripsData, timeRange, playbackSpeed]);

  // Sync actual epoch seconds for Deck.gl TripsLayer when progress or timeRange changes
  useEffect(() => {
    if (timeRange[1] > timeRange[0]) {
      const currentEpoch = timeRange[0] + progress * (timeRange[1] - timeRange[0]);
      setTime(currentEpoch);
    }
  }, [progress, timeRange]);

  // 4. Load occurrences when selected species changes
  useEffect(() => {
    if (!selectedSpecies) return;

    let isMounted = true;
    setLoadingOccurrences(true);

    async function fetchOccurrences() {
      // First try Worker endpoint
      try {
        const res = await fetch(`/api/species/${selectedSpecies.species_id}/occurrences`);
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            setOccurrences(json.occurrences || []);
            setLoadingOccurrences(false);
            return;
          }
        }
      } catch (err) {
        // Fallback to static JSON
      }

      try {
        const staticRes = await fetch(`./data/generated/occurrences/${selectedSpecies.species_id}.json`);
        if (staticRes.ok) {
          const staticData = await staticRes.json();
          if (isMounted) {
            setOccurrences(staticData.occurrences || []);
            setLoadingOccurrences(false);
            return;
          }
        }
      } catch (err) {
        console.warn(`Could not load occurrences for ${selectedSpecies.species_id}:`, err);
      }

      if (isMounted) {
        setOccurrences([]);
        setLoadingOccurrences(false);
      }
    }

    fetchOccurrences();

    return () => {
      isMounted = false;
    };
  }, [selectedSpecies]);

  // 5. Load Corridor Analysis (The Race, Twin, and Break) for selected species and active season
  useEffect(() => {
    if (!selectedSpecies) return;

    let isMounted = true;
    setLoadingCorridor(true);
    setSimulationResult(null); // Reset simulation for new species/season
    setProtectedNodes(new Set());

    async function fetchCorridor() {
      // 1. Try Worker endpoint
      try {
        const res = await fetch(
          `/api/corridor?species=${selectedSpecies.species_id}&season=${activeSeason}&v=2026-10-31`
        );
        if (res.ok) {
          const json = await res.json();
          const twin = await enrichTwin(json.twin, selectedSpecies.species_id, activeSeason);
          if (isMounted) {
            setCorridorData({ ...json, twin });
            setLoadingCorridor(false);
            return;
          }
        }
      } catch (err) {
        // Fallback
      }

      // 2. Try static precomputed JSON fallback
      try {
        const staticRes = await fetch('./data/generated/corridor_analysis.json');
        if (staticRes.ok) {
          const staticJson = await staticRes.json();
          const spData = staticJson.species?.[selectedSpecies.species_id];
          const twin = spData ? await enrichTwin(spData.twin?.[activeSeason], selectedSpecies.species_id, activeSeason) : null;
          if (spData && isMounted) {
            setCorridorData({
              success: true,
              species_id: selectedSpecies.species_id,
              scientific_name: spData.scientific_name,
              season: activeSeason,
              race: spData.race,
              twin,
              critical_links:
                activeSeason === 'breeding'
                  ? spData.break?.breeding_critical_links || []
                  : spData.break?.non_breeding_critical_links || [],
              total_reachable_area_km2: spData.break?.total_reachable_area_km2,
              labels: {
                race: 'projected',
                twin: 'simulated',
                critical_links: 'simulated',
              },
              retrieved_at: staticJson.generated_at,
            });
            setLoadingCorridor(false);
            return;
          }
        }
      } catch (err) {
        console.warn(`Could not load corridor data for ${selectedSpecies.species_id}:`, err);
      }

      if (isMounted) {
        setCorridorData(null);
        setLoadingCorridor(false);
      }
    }

    fetchCorridor();

    return () => {
      isMounted = false;
    };
  }, [selectedSpecies, activeSeason]);

  // Handler for The Fix: simulate protection of critical stopovers (interactive toggle & cumulative multi-site modeling)
  const handleSimulateProtect = useCallback(
    async (nodeId) => {
      if (!selectedSpecies) return;

      // 1. Interactive toggle: protect or unprotect
      const nextProtected = new Set(protectedNodes);
      if (nextProtected.has(nodeId)) {
        nextProtected.delete(nodeId);
      } else {
        nextProtected.add(nodeId);
      }
      setProtectedNodes(nextProtected);

      // If all stopovers are unprotected, reset the simulation card
      if (nextProtected.size === 0) {
        setSimulationResult(null);
        return;
      }

      // 2. Cumulative stopover protection, from this species' own corridor analysis
      const cells = corridorData?.twin?.cells || [];
      const totalFlywayArea =
        corridorData?.total_reachable_area_km2 || cells.reduce((sum, c) => sum + (c.area_km2 || 0), 0);
      const localSim = simulateStopoverProtection(
        selectedSpecies.species_id,
        activeSeason,
        totalFlywayArea,
        corridorData?.critical_links || [],
        Array.from(nextProtected)
      );

      setSimulationResult(localSim);

      // Optionally notify worker API for parity
      try {
        await fetch('/api/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            species: selectedSpecies.species_id,
            season: activeSeason,
            protected_node_id: nodeId,
            protected_node_ids: Array.from(nextProtected),
            action: 'protect',
          }),
        });
      } catch (err) {
        // Local simulation state is already live and responsive
      }
    },
    [selectedSpecies, activeSeason, corridorData, protectedNodes]
  );

  // Handle species selection by scientific name (e.g. from map click)
  const handleSelectSpeciesByName = useCallback(
    (scientificName) => {
      const found = speciesList.find(
        (s) =>
          s.scientific_name?.toLowerCase() === scientificName?.toLowerCase() ||
          s.name?.toLowerCase() === scientificName?.toLowerCase()
      );
      if (found) {
        setSelectedSpecies(found);
      }
    },
    [speciesList]
  );

  const hasActiveTracks = useMemo(
    () => tripsData && tripsData.length > 0 && selectedSpecies?.evidence_level === 'tracks',
    [tripsData, selectedSpecies]
  );

  // Space toggles playback on the atlas (ignored while typing or on a focused button).
  useEffect(() => {
    if (route !== '/') return undefined;
    const onKey = (e) => {
      if (e.code !== 'Space') return;
      const tag = e.target?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || e.target?.isContentEditable) return;
      e.preventDefault();
      setIsPlaying((p) => !p);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [route]);

  const toggleLayer = (key) => setLayersOn((prev) => ({ ...prev, [key]: !prev[key] }));

  const openInAtlas = useCallback(
    (s) => {
      setSelectedSpecies(s);
      go('/');
    },
    [go]
  );

  // Keep camera fits clear of the floating panels so the route lands in the open part of the map.
  const isNarrow = viewport.w <= 900;
  const panelLeft = viewport.w <= 1180 ? 280 : 312;
  const panelRight = viewport.w <= 1180 ? 380 : 420;
  const mapPadding = isNarrow
    ? { top: 130, left: 24, right: 70, bottom: rightOpen ? viewport.h * 0.52 + 80 : 130 }
    : {
        top: 150,
        bottom: 140,
        left: (leftOpen ? panelLeft + 32 : 0) + 48,
        right: (rightOpen ? panelRight + 32 : 0) + 80,
      };

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href="#/" aria-label="Outrun atlas">
          <span className="brand__mark" aria-hidden="true">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 15l8-7 8 7" />
              <path d="M7 19l5-4.5 5 4.5" opacity="0.6" />
            </svg>
          </span>
          <span>
            <span className="brand__word">OUTRUN</span>
            <span className="brand__sub" style={{ display: 'block' }}>Migratory flyway observatory</span>
          </span>
        </a>

        <nav className="topnav" aria-label="Pages">
          {ROUTES.map(([path, label, Icon]) => (
            <a key={path} className="topnav__link" href={`#${path}`} data-ripple aria-current={route === path ? 'page' : undefined}>
              <Icon size={16} />
              <span>{label}</span>
            </a>
          ))}
        </nav>

        <div className="topbar__right">
          <span className="status-pill" title={`Data source · ${new Date(dataSourceStatus.timestamp).toLocaleString()}`}>
            <span className={`status-dot ${dataSourceStatus.source === 'live' ? 'is-live' : ''}`} />
            {dataSourceStatus.source === 'live' ? 'Live API' : 'Offline cache'}
          </span>
          <button className="o-btn o-btn--primary" data-ripple onClick={() => setBriefSpecies(selectedSpecies)} title="One-page scientific brief (print / PDF)">
            <FileText size={16} />
            <span>Brief</span>
          </button>
        </div>
      </header>

      <main className="page">
        {route === '/' && (
          <div className={`atlas ${leftOpen ? '' : 'left-collapsed'} ${rightOpen ? '' : 'right-collapsed'}`}>
            <div className="map-frame">
              <MapView
                time={time}
                timeRange={timeRange}
                tripsData={tripsData}
                occurrences={occurrences}
                selectedSpecies={selectedSpecies}
                corridorData={corridorData}
                twinSlider={twinSlider}
                protectedNodes={protectedNodes}
                onSimulateProtect={handleSimulateProtect}
                activeCorridorTab={activeCorridorTab}
                layersOn={layersOn}
                padding={mapPadding}
                tracksSimulated={tracksSimulated}
              />

              <div className="float layer-bar" role="group" aria-label="Map layers">
                {!leftOpen && (
                  <button className="o-btn" data-ripple onClick={() => setLeftOpen(true)} aria-label="Show species list">
                    <PanelLeftOpen size={16} />
                    Species
                  </button>
                )}
                {LAYER_CHIPS.map(([key, label]) => (
                  <button key={key} className="o-chip" data-ripple aria-pressed={layersOn[key]} onClick={() => toggleLayer(key)}>
                    <span className="o-chip__switch" />
                    {label}
                  </button>
                ))}
                {!rightOpen && (
                  <span className="layer-bar__end">
                    <button className="o-btn" data-ripple onClick={() => setRightOpen(true)} aria-label="Show species details">
                      <PanelRightOpen size={16} />
                      Details
                    </button>
                  </span>
                )}
              </div>

              <MapLegend activeTab={activeCorridorTab} />
            </div>

            <SpeciesList
              speciesList={speciesList}
              selectedSpecies={selectedSpecies}
              onSelectSpecies={(s) => {
                setSelectedSpecies(s);
                if (isNarrow) setLeftOpen(false);
              }}
              onCollapse={() => setLeftOpen(false)}
            />

            <Inspector
              species={selectedSpecies}
              occurrences={occurrences}
              corridorData={corridorData}
              loadingCorridor={loadingCorridor}
              activeTab={activeCorridorTab}
              onChangeTab={setActiveCorridorTab}
              activeSeason={activeSeason}
              onChangeSeason={setActiveSeason}
              twinSlider={twinSlider}
              onChangeTwinSlider={setTwinSlider}
              protectedNodes={protectedNodes}
              onSimulateProtect={handleSimulateProtect}
              simulationResult={simulationResult}
              onOpenBrief={(s) => setBriefSpecies(s)}
              onCollapse={() => setRightOpen(false)}
              tracksSimulated={tracksSimulated}
            />

            <TimeControl
              isPlaying={isPlaying}
              onTogglePlay={() => setIsPlaying(!isPlaying)}
              progress={progress}
              onProgressChange={setProgress}
              speed={playbackSpeed}
              onSpeedChange={setPlaybackSpeed}
              hasTracks={hasActiveTracks}
              time={time}
            />
          </div>
        )}

        {route === '/species' && (
          <SpeciesPage speciesList={speciesList} selectedSpecies={selectedSpecies} onOpenInAtlas={openInAtlas} />
        )}

        {route === '/sources' && <SourcesPage activeTrackDataset={activeTrackDataset} />}
      </main>

      {briefSpecies && (
        <BriefModal
          species={briefSpecies}
          corridorData={corridorData}
          occurrences={occurrences}
          tracksSimulated={tracksSimulated}
          activeSeason={activeSeason}
          onClose={() => setBriefSpecies(null)}
        />
      )}
    </div>
  );
};

export default App;
