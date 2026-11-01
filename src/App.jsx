import React, { useState, useEffect, useCallback, useMemo } from 'react';
import MapView from './MapView';
import SpeciesPanel from './SpeciesPanel';
import TimeControl from './TimeControl';
import Footer from './Footer';
import Legend from './Legend';
import BriefModal from './BriefModal';
import { AUTO_PLAY, canonicalSpeciesList } from './config';
import { getTimeRange } from './times';
import { usePageVisibility } from './usePageVisibility';
import { Info, BookOpen, Layers, FileText } from 'lucide-react';
import { simulateNodeProtection } from './analytics/breakFix';

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
  const [activeCorridorTab, setActiveCorridorTab] = useState('race');

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

  // Normalized Journey Progress State (0.0 to 1.0)
  const [progress, setProgress] = useState(0.2); // Start at 20% like reference screenshot
  const [time, setTime] = useState(0);
  const [timeRange, setTimeRange] = useState([0, 0]);
  const [isPlaying, setIsPlaying] = useState(AUTO_PLAY);
  const [playbackSpeed, setPlaybackSpeed] = useState(1);
  const [timeMode, setTimeMode] = useState('progress');
  const isPageVisible = usePageVisibility();

  // Modals state
  const [showLegend, setShowLegend] = useState(false);
  const [showSources, setShowSources] = useState(false);

  // 1. Fetch species registry from Worker API, fallback to local canonical registry
  useEffect(() => {
    async function loadSpeciesRegistry() {
      try {
        const res = await fetch('/api/species');
        if (res.ok) {
          const json = await res.json();
          if (json.species && json.species.length > 0) {
            setSpeciesList(json.species);
            setSelectedSpecies(json.species[0]);
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
            setSpeciesList(staticJson.species);
            setSelectedSpecies(staticJson.species[0]);
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

    async function fetchCorridor() {
      // 1. Try Worker endpoint
      try {
        const res = await fetch(
          `/api/corridor?species=${selectedSpecies.species_id}&season=${activeSeason}`
        );
        if (res.ok) {
          const json = await res.json();
          if (isMounted) {
            setCorridorData(json);
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
          if (spData && isMounted) {
            setCorridorData({
              success: true,
              species_id: selectedSpecies.species_id,
              scientific_name: spData.scientific_name,
              season: activeSeason,
              race: spData.race,
              twin: spData.twin?.[activeSeason],
              critical_links:
                activeSeason === 'breeding'
                  ? spData.break?.breeding_critical_links || []
                  : spData.break?.non_breeding_critical_links || [],
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

  // Handler for The Fix: simulate protection of a critical link
  const handleSimulateProtect = useCallback(
    async (nodeId) => {
      if (!selectedSpecies) return;
      try {
        const res = await fetch('/api/simulate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            species: selectedSpecies.species_id,
            season: activeSeason,
            protected_node_id: nodeId,
            action: 'protect',
          }),
        });

        if (res.ok) {
          const json = await res.json();
          setSimulationResult(json);
          setProtectedNodes((prev) => new Set([...prev, nodeId]));
          return;
        }
      } catch (err) {
        // Fallback to local simulation
      }

      // Local interactive simulation fallback
      try {
        const cells = (corridorData?.twin?.cells || []).map((c) => ({
          id: c.node_id || c.id,
          lat: c.lat,
          lon: c.lon,
          area_km2: c.area_km2 || 11000,
          suitability: c.baseline_suitability || 0.8,
          uncertainty: c.uncertainty || 0.1,
        }));

        if (!cells.some((c) => c.id === nodeId) && corridorData?.critical_links) {
          for (const cl of corridorData.critical_links) {
            cells.push({
              id: cl.node_id,
              lat: cl.lat,
              lon: cl.lon,
              area_km2: cl.area_km2 || 14000,
              suitability: cl.suitability || 0.89,
              uncertainty: 0.1,
            });
          }
        }

        const localSim = simulateNodeProtection(
          selectedSpecies.species_id,
          activeSeason,
          cells,
          nodeId,
          'protect'
        );
        setSimulationResult(localSim);
        setProtectedNodes((prev) => new Set([...prev, nodeId]));
      } catch (simErr) {
        console.warn('Local simulation fallback warning:', simErr);
      }
    },
    [selectedSpecies, activeSeason, corridorData]
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

  return (
    <div id="outrun-app">
      {/* Top Atlas Header Bar */}
      <header className="atlas-header">
        <div className="header-brand-group">
          <div className="observatory-logo-symbol" aria-hidden="true">
            <span className="logo-spark">✦</span>
          </div>
          <div>
            <h1 className="header-title">OUTRUN</h1>
            <p className="header-subtitle">
              Global Climate-Pressure & Corridor Platform for Migratory Birds (Class Aves)
            </p>
          </div>
        </div>

        <div className="header-meta-group">
          <div className="data-freshness-badge font-mono" title="Data freshness and provenance pipeline status">
            <span className={`freshness-dot ${dataSourceStatus.source === 'live' ? 'live' : 'fallback'}`} />
            <span className="freshness-label">{dataSourceStatus.label}</span>
          </div>

          <span className="canonical-badge">
            <strong>{speciesList.length}</strong> Species Configured
          </span>

          <button
            className="header-link-btn highlight"
            onClick={() => setBriefSpecies(selectedSpecies)}
            title="Export One-Page Executive Scientific Brief"
          >
            <FileText size={14} />
            <span>Executive Brief</span>
          </button>

          <button
            className="header-link-btn"
            onClick={() => setShowLegend(!showLegend)}
            title="Epistemic labels reference"
          >
            <Layers size={14} />
            <span>Labels</span>
          </button>

          <button
            className="header-link-btn"
            onClick={() => setShowSources(true)}
            title="Data sources, citations and licenses"
          >
            <BookOpen size={14} />
            <span>Sources & Provenance</span>
          </button>
        </div>
      </header>

      {/* Main Observatory Body: 70% Map/Timeline + 30% Species Sidebar */}
      <main className="observatory-main-layout">
        {/* Left Column: Map Dominant (68-72% width) + Timeline */}
        <section className="map-and-timeline-column">
          {/* Main Map Card */}
          <div className="map-card-container">
            <MapView
              time={time}
              tripsData={tripsData}
              highlightedSpecies={selectedSpecies?.scientific_name}
              occurrences={occurrences}
              selectedSpecies={selectedSpecies}
              onSelectSpeciesByName={handleSelectSpeciesByName}
              corridorData={corridorData}
              twinSlider={twinSlider}
              protectedNodes={protectedNodes}
              onSimulateProtect={handleSimulateProtect}
              activeCorridorTab={activeCorridorTab}
            />
          </div>

          {/* Timeline Panel below map */}
          <TimeControl
            isPlaying={isPlaying}
            onTogglePlay={() => setIsPlaying(!isPlaying)}
            progress={progress}
            onProgressChange={setProgress}
            speed={playbackSpeed}
            onSpeedChange={setPlaybackSpeed}
            hasTracks={hasActiveTracks}
            selectedSpeciesName={selectedSpecies?.common_name || selectedSpecies?.scientific_name}
            timeMode={timeMode}
            onTimeModeChange={setTimeMode}
          />
        </section>

        {/* Right Column: Species Sidebar & Inspector */}
        <section className="species-sidebar-column">
          <SpeciesPanel
            speciesList={speciesList}
            selectedSpecies={selectedSpecies}
            onSelectSpecies={setSelectedSpecies}
            occurrences={occurrences}
            loadingOccurrences={loadingOccurrences}
            onFocusSpecies={(s) => setSelectedSpecies(s)}
            corridorData={corridorData}
            loadingCorridor={loadingCorridor}
            activeSeason={activeSeason}
            onChangeSeason={setActiveSeason}
            twinSlider={twinSlider}
            onChangeTwinSlider={setTwinSlider}
            onSimulateProtect={handleSimulateProtect}
            protectedNodes={protectedNodes}
            simulationResult={simulationResult}
            onOpenBrief={(s) => setBriefSpecies(s)}
            activeCorridorTab={activeCorridorTab}
            onChangeCorridorTab={setActiveCorridorTab}
          />
        </section>
      </main>

      {/* Epistemic Labels Float/Drawer */}
      {showLegend && (
        <div className="legend-flyout-container">
          <Legend onClose={() => setShowLegend(false)} />
        </div>
      )}

      {/* Sources & Licences Modal & Footer */}
      <Footer
        activeTrackDataset={activeTrackDataset}
        showSourcesModal={showSources}
        setShowSourcesModal={setShowSources}
      />

      {/* Executive Scientific Brief Modal (Print-to-PDF) */}
      {briefSpecies && (
        <BriefModal
          species={briefSpecies}
          corridorData={corridorData}
          occurrences={occurrences}
          onClose={() => setBriefSpecies(null)}
        />
      )}
    </div>
  );
};

export default App;
