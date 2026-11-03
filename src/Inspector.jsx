import React, { useEffect, useState } from 'react';
import { PanelRightClose, ChevronUp, ChevronDown, List, FileText, CloudSun, ShieldCheck, ShieldAlert, AlertCircle, ExternalLink, ArrowRight } from 'lucide-react';
import { speciesColorOf, speciesMetaOf } from './config';
import { RaceTab, TwinTab, NetworkTab, WatchTab, isFigure } from './CorridorPanel';
import { loadConcern, THREATENED } from './analytics/concern';
import { loadSeasonCalendar, rangeName } from './analytics/seasonCalendar';
import { useBottomSheet } from './useBottomSheet';
import { IucnTag, Abbr } from './iucn';

export const INSPECTOR_TABS = [
  ['overview', 'Overview'],
  ['race', 'Race'],
  ['twin', 'Twin'],
  ['network', 'Network'],
  ['watch', 'Watch'],
  ['proof', 'Concern'],
];

const MIGRATION = { 1: 'Sedentary', 2: 'Partially migratory', 3: 'Long-distance migrant' };

// Why an at-risk species is of concern: its IUCN listing plus the pressures Outrun measures.
const ConcernCard = ({ species }) => {
  const [concern, setConcern] = useState(null);
  useEffect(() => {
    let live = true;
    setConcern(null);
    loadConcern(species).then((c) => live && setConcern(c));
    return () => { live = false; };
  }, [species?.species_id]);

  if (!concern) return null;
  return (
    <div className={`concern concern--${concern.category || 'none'}`}>
      <div className="concern__head">
        {concern.atRisk ? <ShieldAlert size={18} /> : <ShieldCheck size={18} />}
        <div>
          <strong>{concern.atRisk ? 'Why it is of conservation concern' : 'Conservation status'}</strong>
          <div className="concern__listing">
            {concern.category && <IucnTag cat={concern.category} prefix />} {concern.meaning}
          </div>
        </div>
      </div>
      {concern.pressures.length > 0 && !concern.atRisk && (
        <span className="o-label">Pressures to watch</span>
      )}
      {concern.pressures.length > 0 && (
        <ul className="concern__list">
          {concern.pressures.map((p, i) => (
            <li key={i} className={`concern__item is-${p.severity}`}>
              <div className="concern__title">
                <span>{p.title}</span>
                <span className={`o-badge o-badge--${p.label}`}>{p.label}</span>
              </div>
              <p>{p.detail}</p>
            </li>
          ))}
        </ul>
      )}
      <p className="cite">
        {concern.category && <>IUCN Red List{concern.year ? ` ${concern.year}` : ''}.{' '}</>}
        {concern.source_url && (
          <a href={concern.source_url} target="_blank" rel="noreferrer">
            {concern.atRisk ? 'Documented threats in the assessment' : 'IUCN assessment'} <ExternalLink size={11} style={{ verticalAlign: '-1px' }} />
          </a>
        )}{' '}
        The pressures above are Outrun model results, not part of the IUCN listing.
      </p>
    </div>
  );
};

// Weather for one range of the species: the centre of its breeding or wintering range
// (falls back to the centre of its GBIF sightings when the range is unknown).
async function loadWeather(species, occurrences, season, calendar) {
  const range = calendar?.ranges?.[season];
  let lat;
  let lon;
  let place;
  if (range) {
    lat = range.lat;
    lon = range.lon;
    place = `Centre of its ${rangeName(season)}`;
  } else if (occurrences?.length) {
    const cLat = occurrences.reduce((a, o) => a + o.lat, 0) / occurrences.length;
    const cLon = occurrences.reduce((a, o) => a + o.lon, 0) / occurrences.length;
    const pick = occurrences.reduce((best, o) =>
      (o.lat - cLat) ** 2 + (o.lon - cLon) ** 2 < (best.lat - cLat) ** 2 + (best.lon - cLon) ** 2 ? o : best
    );
    lat = pick.lat;
    lon = pick.lon;
    place = `Centre of its sightings${pick.country_code ? ` · ${pick.country_code}` : ''}`;
  } else {
    return { error: 'Insufficient evidence: no known range or sightings for this species' };
  }
  const at = `${place} (${lat.toFixed(1)}°, ${lon.toFixed(1)}°)`;
  const one = (w) => (Array.isArray(w) ? w[0] : w);

  try {
    const res = await fetch(`/api/weather?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}`);
    if (res.ok) {
      const json = await res.json();
      if (json.success !== false && json.weather) return { ...json, weather: one(json.weather), place: at, lat, lon };
    }
  } catch { /* fall through */ }
  try {
    const res = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m`
    );
    if (res.ok) {
      const d = await res.json();
      return { source: 'Open-Meteo (live)', weather: d.current, retrieved_at: new Date().toISOString(), place: at, lat, lon };
    }
  } catch { /* fall through */ }
  return { error: 'Current conditions unavailable' };
}

const Overview = ({ species, occurrences, onOpenBrief, weatherData, loadingWeather, onFetchWeather, tracksSimulated, onShowConcern }) => {
  const meta = speciesMetaOf(species);
  const status = species.status?.category;
  const sensitive = Boolean(species.sensitive_coarsened || meta.sensitive_coarsened);
  const hwi = species.traits?.hand_wing_index;

  return (
    <>
      {meta.movement_label && <p className="sec__lead" style={{ fontSize: 13.5, color: 'var(--ink)' }}>{meta.movement_label}</p>}

      <div className="stat-grid">
        <div className="o-stat o-stat--accent">
          <span className="o-stat__label">{tracksSimulated ? 'Simulated birds' : 'Tracked birds'}</span>
          <span className={`o-stat__value ${species.evidence_level === 'tracks' ? 'is-figure' : ''}`}>{species.evidence_level === 'tracks' ? species.tracked_individuals ?? meta.tracked_individuals ?? '–' : 'None'}</span>
          <span className="o-stat__sub">
            {tracksSimulated ? <span className="o-badge o-badge--simulated">simulated</span> : <span className="o-badge o-badge--observed">observed</span>}
          </span>
        </div>
        <div className="o-stat">
          <span className="o-stat__label">Sightings</span>
          <span className="o-stat__value is-figure">{occurrences.length.toLocaleString()}</span>
          <span className="o-stat__sub">From <Abbr>GBIF</Abbr></span>
        </div>
        <div className="o-stat">
          <span className="o-stat__label">Wing shape score</span>
          <span className={`o-stat__value ${isFigure(hwi) ? 'is-figure' : ''}`}>{hwi ?? 'Insufficient evidence'}</span>
          <span className="o-stat__sub">Higher flies farther</span>
        </div>
        <div className="o-stat">
          <span className="o-stat__label">Migration</span>
          <span className="o-stat__value" style={{ fontSize: 14 }}>{MIGRATION[species.traits?.migration_category] || 'Insufficient evidence'}</span>
          <span className="o-stat__sub">From <Abbr>AVONET</Abbr></span>
        </div>
      </div>

      <div className="sec">
        <span className="o-label">Conservation status</span>
        {status ? (
          <div className="note">
            <ShieldCheck size={16} style={{ color: 'var(--success)' }} />
            <div>
              <IucnTag cat={status} full prefix />{' '}
              <span style={{ marginLeft: 6 }}><Abbr>IUCN</Abbr> Red List{species.status.assessment_year ? `, assessed ${species.status.assessment_year}` : ''}</span>
              {THREATENED.includes(status) && (
                <div style={{ marginTop: 8 }}>
                  <button className="o-btn o-btn--sm" data-ripple onClick={onShowConcern}>
                    Why it is of concern <ArrowRight size={14} />
                  </button>
                </div>
              )}
              {species.status.source_url && (
                <div style={{ marginTop: 6 }}>
                  <a href={species.status.source_url} target="_blank" rel="noreferrer">
                    Assessment source <ExternalLink size={11} style={{ verticalAlign: '-1px' }} />
                  </a>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="note note--warn">
            <AlertCircle size={16} />
            <div><strong>Insufficient evidence.</strong> No verified IUCN assessment, so status is stored as NULL and never inferred.</div>
          </div>
        )}
      </div>

      {sensitive && (
        <div className="note note--warn">
          <ShieldCheck size={16} />
          <div><strong>Nest sites protected.</strong> Breeding-season fixes (May–July) are coarsened to 0.1° (~11 km).</div>
        </div>
      )}

      <dl className="kv">
        <dt>Family</dt><dd>{species.family || '–'}</dd>
      </dl>

      <button className="o-btn o-btn--primary" data-ripple onClick={() => onOpenBrief(species)}>
        <FileText size={16} />
        Export one-page brief
      </button>
    </>
  );
};

const Inspector = ({
  species,
  occurrences = [],
  corridorData,
  loadingCorridor,
  activeTab,
  onChangeTab,
  activeSeason,
  onChangeSeason,
  twinSlider,
  onChangeTwinSlider,
  protectedNodes,
  onSimulateProtect,
  simulationResult,
  onOpenBrief,
  onCollapse,
  tracksSimulated = false,
  isNarrow = false,
  sheet = 'peek',
  onSheetChange,
  onOpenSpecies,
}) => {
  const [weatherData, setWeatherData] = useState(null);
  const { sheetRef, handleProps } = useBottomSheet(sheet, onSheetChange, isNarrow);
  const [loadingWeather, setLoadingWeather] = useState(false);
  const [calendar, setCalendar] = useState(null);

  useEffect(() => setWeatherData(null), [species?.species_id, activeSeason]);

  // Where the species is month by month (tracks, else the documented cycle).
  useEffect(() => {
    let live = true;
    setCalendar(null);
    loadSeasonCalendar(species?.species_id, { tracksSimulated }).then((c) => live && setCalendar(c));
    return () => { live = false; };
  }, [species?.species_id, tracksSimulated]);

  // The Watch tab is about current conditions, so load them as soon as it opens.
  useEffect(() => {
    if (activeTab !== 'watch' || !species || !calendar || weatherData) return;
    let live = true;
    setLoadingWeather(true);
    loadWeather(species, occurrences, activeSeason, calendar).then((w) => {
      if (!live) return;
      setWeatherData(w);
      setLoadingWeather(false);
    });
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, species?.species_id, activeSeason, calendar, weatherData]);

  if (!species) return null;
  const { hex } = speciesColorOf(species);

  const fetchWeather = async () => {
    setLoadingWeather(true);
    setWeatherData(await loadWeather(species, occurrences, activeSeason, calendar));
    setLoadingWeather(false);
  };

  const needsCorridor = ['race', 'twin', 'network'].includes(activeTab);
  let body;
  if (needsCorridor && loadingCorridor) {
    body = <div className="loading-block"><div className="spinner" />Computing velocity, envelope and corridor graph…</div>;
  } else if (activeTab === 'overview') {
    body = <Overview species={species} occurrences={occurrences} onOpenBrief={onOpenBrief} weatherData={weatherData} loadingWeather={loadingWeather} onFetchWeather={fetchWeather} tracksSimulated={tracksSimulated} onShowConcern={() => onChangeTab('proof')} />;
  } else if (activeTab === 'race') {
    body = <RaceTab race={corridorData?.race} />;
  } else if (activeTab === 'twin') {
    body = <TwinTab twin={corridorData?.twin} twinSlider={twinSlider} onChangeTwinSlider={onChangeTwinSlider} activeSeason={activeSeason} onChangeSeason={onChangeSeason} />;
  } else if (activeTab === 'network') {
    body = (
      <NetworkTab
        species={species}
        criticalLinks={corridorData?.critical_links || []}
        protectedNodes={protectedNodes}
        onSimulateProtect={onSimulateProtect}
        simulationResult={simulationResult}
        activeSeason={activeSeason}
        onChangeSeason={onChangeSeason}
      />
    );
  } else if (activeTab === 'watch') {
    body = <WatchTab species={species} calendar={calendar} activeSeason={activeSeason} onChangeSeason={onChangeSeason} weatherData={weatherData} onFetchWeather={fetchWeather} loadingWeather={loadingWeather} />;
  } else if (activeTab === 'proof') {
    body = <ConcernCard species={species} />;
  }

  return (
    <aside ref={sheetRef} className="float o-panel inspector" style={{ '--sp': hex }} aria-label={`${species.common_name} inspector`}>
      <div className="insp-grab" {...handleProps}>
        {isNarrow && (
          <button
            className="sheet-handle"
            onClick={() => onSheetChange(sheet === 'peek' ? 'half' : 'peek')}
            aria-label={sheet === 'peek' ? 'Expand details' : 'Collapse details'}
          >
            <span />
          </button>
        )}
        <div className="insp-head">
          <span className="insp-swatch" />
          <div style={{ minWidth: 0 }}>
            <h2 className="insp-title">{species.common_name || species.scientific_name}</h2>
            <div className="insp-sci">
              {species.scientific_name}
              {species.status?.category && <IucnTag cat={species.status.category} style={{ marginLeft: 8, height: 18, fontSize: 10 }} />}
            </div>
          </div>
          <div className="insp-head__actions">
            {isNarrow ? (
              <>
                <button className="o-btn o-btn--sm sheet-species-btn" data-ripple onClick={onOpenSpecies} aria-label="Choose species">
                  <List size={15} />
                  Species
                </button>
                <button
                  className="o-iconbtn"
                  data-ripple
                  onClick={() => onSheetChange(sheet === 'full' ? 'peek' : 'full')}
                  aria-label={sheet === 'full' ? 'Show map' : 'Expand details'}
                >
                  {sheet === 'full' ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                </button>
              </>
            ) : (
              <button className="o-iconbtn panel-collapse-btn" data-ripple onClick={onCollapse} title="Hide panel" aria-label="Hide inspector">
                <PanelRightClose size={17} />
              </button>
            )}
          </div>
        </div>

        <div className="insp-tabs">
          <div className="o-seg" role="tablist" aria-label="Analysis layers">
            {INSPECTOR_TABS.map(([key, label]) => (
              <button
                key={key}
                className="o-seg__btn"
                role="tab"
                aria-selected={activeTab === key}
                data-ripple
                onClick={() => {
                  onChangeTab(key);
                  if (isNarrow && sheet === 'peek') onSheetChange('half');
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="insp-body" key={`${species.species_id}-${activeTab}`}>
        {body}
      </div>
    </aside>
  );
};

export default Inspector;
