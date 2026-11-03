import React, { useEffect, useState } from 'react';
import { Search, X, ArrowRight, Bird } from 'lucide-react';
import { speciesColorOf, speciesMetaOf } from './config';
import { filterSpecies, isThreatened } from './SpeciesList';
import { IucnTag, Abbr, IUCN_ORDER, iucnName } from './iucn';

const MIGRATION = { 1: 'Sedentary', 2: 'Partial migrant', 3: 'Long-distance migrant' };

// Species photos: openly licensed iNaturalist images, credited on each card (see the file's
// "selection" note). Loaded once for the page.
let photosPromise = null;
function loadPhotos() {
  if (!photosPromise) {
    photosPromise = fetch('./data/species_photos.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d?.photos || {})
      .catch(() => ({}));
  }
  return photosPromise;
}

// "(c) Name, some rights reserved (CC BY-NC), uploaded by …" -> "© Name · CC BY-NC"
function shortCredit(attribution = '') {
  const m = attribution.match(/^\(c\)\s*(.+?),\s*some rights reserved \(([^)]+)\)/i);
  return m ? `© ${m[1]} · ${m[2]}` : attribution;
}

// "Trans-Oceanic Corridor (Amur River -> India -> Southern Africa)" -> title + route steps
function splitCorridor(label = '') {
  const m = label.match(/^(.*?)\s*\((.*)\)\s*$/);
  if (!m) return { title: label, steps: [] };
  const steps = m[2].split(/\s*(?:->|→)\s*/).filter(Boolean);
  return { title: m[1], steps: steps.length > 1 ? steps : [], note: steps.length > 1 ? null : m[2] };
}

const fmt = (n) => (Number.isFinite(n) ? n.toLocaleString() : '–');

const Photo = ({ photo, name }) => {
  const [state, setState] = useState(photo ? 'loading' : 'missing');
  useEffect(() => setState(photo ? 'loading' : 'missing'), [photo?.url]);

  return (
    <div className={`spx-photo is-${state}`}>
      {photo && state !== 'error' && (
        <img
          src={photo.url}
          alt={name}
          loading="lazy"
          decoding="async"
          onLoad={() => setState('loaded')}
          onError={() => setState('error')}
        />
      )}
      {(state === 'missing' || state === 'error') && <Bird className="spx-photo__fallback" size={40} strokeWidth={1.6} aria-hidden="true" />}
    </div>
  );
};

const SpeciesCard = ({ s, photo, selected, onOpen }) => {
  const meta = speciesMetaOf(s);
  const cat = s.status?.category;
  const name = s.common_name || s.scientific_name;
  const { title, steps, note } = splitCorridor(meta.movement_label || '');
  const tracked = s.evidence_level === 'tracks' ? s.tracked_individuals ?? meta.tracked_individuals : null;

  return (
    <article
      className={`spx-card ${isThreatened(s) ? 'is-at-risk' : ''}`}
      style={{ '--sp': speciesColorOf(s).hex }}
      aria-current={selected || undefined}
    >
      <div className="spx-media">
        <Photo photo={photo} name={`${name} (${s.scientific_name})`} />
        <IucnTag cat={cat} full className="spx-iucn" />
        {photo && (
          <a className="spx-credit" href={`https://www.inaturalist.org/photos/${photo.photo_id}`} target="_blank" rel="noreferrer">
            {shortCredit(photo.attribution)}
          </a>
        )}
      </div>

      <div className="spx-body">
        <h3 className="spx-name">
          {/* The whole card is the hit area (stretched button); the photo credit stays its own link. */}
          <button className="spx-hit" data-ripple onClick={() => onOpen(s)} aria-label={`Open ${name} in the atlas`}>
            {name}
          </button>
        </h3>
        <div className="spx-sci">
          <em>{s.scientific_name}</em> · {s.family}
        </div>

        {title && <div className="spx-corridor">{title}</div>}
        {steps.length > 0 ? (
          <ol className="spx-route" aria-label="Route">
            {steps.map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        ) : (
          note && <p className="spx-route-note">{note}</p>
        )}

        <dl className="spx-facts">
          <div>
            <dt>Tracked</dt>
            <dd>{tracked != null ? fmt(tracked) : 'None'}</dd>
          </div>
          <div>
            <dt>Sightings</dt>
            <dd>{fmt(s.occurrence_count)}</dd>
          </div>
          <div>
            <dt>Wing score</dt>
            <dd>{s.traits?.hand_wing_index ?? '–'}</dd>
          </div>
        </dl>

        <div className="spx-foot">
          <span>{MIGRATION[s.traits?.migration_category] || 'Migratory'}</span>
          <span className="spx-go">
            Open in atlas <ArrowRight size={14} />
          </span>
        </div>
      </div>
    </article>
  );
};

const SpeciesPage = ({ speciesList = [], selectedSpecies, onOpenInAtlas }) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const [photos, setPhotos] = useState({});
  useEffect(() => {
    let live = true;
    loadPhotos().then((p) => live && setPhotos(p));
    return () => { live = false; };
  }, []);

  const filtered = filterSpecies(speciesList, query, status);
  const atRisk = speciesList.filter(isThreatened).length;
  const trackedTotal = speciesList.reduce((a, s) => a + (s.evidence_level === 'tracks' ? s.tracked_individuals || 0 : 0), 0);
  const sightingsTotal = speciesList.reduce((a, s) => a + (s.occurrence_count || 0), 0);

  return (
    <div className="content-page">
      <div className="content-wrap spx-wrap">
        <header className="hero spx-hero">
          <div>
            <span className="spx-kicker">The flock</span>
            <h1>Species</h1>
            <p>
              Migratory birds with <Abbr>GPS</Abbr> telemetry, <Abbr>GBIF</Abbr> sightings and <Abbr>AVONET</Abbr> wing
              traits. Pick one to fly its routes on the atlas.
            </p>
          </div>
          <dl className="spx-stats">
            <div><dt>Species</dt><dd>{speciesList.length}</dd></div>
            <div className="is-risk"><dt>At risk</dt><dd>{atRisk}</dd></div>
            <div><dt>Tracked birds</dt><dd>{fmt(trackedTotal)}</dd></div>
            <div><dt>Sightings</dt><dd>{fmt(sightingsTotal)}</dd></div>
          </dl>
        </header>

        <div className="spx-toolbar">
          <div className="search">
            <Search size={15} />
            <input type="search" placeholder="Search name or family" value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search species" />
            {query && (
              <button className="search__clear" onClick={() => setQuery('')} aria-label="Clear search"><X size={14} /></button>
            )}
          </div>
          <div className="o-seg" role="tablist" aria-label="Conservation status">
            {[
              ['all', 'All'],
              ['threatened', `At risk · ${atRisk}`],
              ['lc', 'Least concern'],
            ].map(([key, label]) => (
              <button key={key} className="o-seg__btn" role="tab" aria-selected={status === key} data-ripple onClick={() => setStatus(key)}>
                {label}
              </button>
            ))}
          </div>
          <span className="spx-count" aria-live="polite">
            {filtered.length} of {speciesList.length}
          </span>
        </div>

        {/* What the status codes on the cards mean */}
        <dl className="spx-key" aria-label="IUCN Red List categories">
          <dt className="spx-key__title">
            <Abbr>IUCN</Abbr> Red List status
          </dt>
          {IUCN_ORDER.map((c) => (
            <dd key={c}>
              <IucnTag cat={c} /> {iucnName(c)}
            </dd>
          ))}
          <dd className="spx-key__note">At risk = CR, EN, VU or NT</dd>
        </dl>

        {filtered.length === 0 ? (
          <div className="empty-note">No species match “{query}”.</div>
        ) : (
          <div className="card-grid spx-grid">
            {filtered.map((s) => (
              <SpeciesCard
                key={s.species_id}
                s={s}
                photo={photos[s.species_id]}
                selected={selectedSpecies?.species_id === s.species_id}
                onOpen={onOpenInAtlas}
              />
            ))}
          </div>
        )}

        <p className="spx-photo-note">
          Photos: iNaturalist contributors under the Creative Commons licence shown on each photo. Wing score is the
          hand-wing index from <Abbr>AVONET</Abbr>: higher means longer, narrower wings built for long flights.
        </p>
      </div>
    </div>
  );
};

export default SpeciesPage;
