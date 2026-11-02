import React, { useState } from 'react';
import { Search, X, ArrowRight } from 'lucide-react';
import { speciesColorOf, speciesMetaOf } from './config';
import { filterSpecies, isThreatened } from './SpeciesList';

const SpeciesPage = ({ speciesList = [], selectedSpecies, onOpenInAtlas }) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');
  const filtered = filterSpecies(speciesList, query, status);

  return (
    <div className="content-page">
      <div className="content-wrap">
        <header className="hero">
          <div>
            <h1>Species</h1>
            <p>
              {speciesList.length} migratory birds with GPS telemetry, GBIF sightings and AVONET traits. Pick one to fly its
              routes on the atlas.
            </p>
          </div>
          <div className="hero__tools">
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
                ['threatened', `At risk · ${speciesList.filter(isThreatened).length}`],
                ['lc', 'Least concern'],
              ].map(([key, label]) => (
                <button key={key} className="o-seg__btn" role="tab" aria-selected={status === key} data-ripple onClick={() => setStatus(key)}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        </header>

        {filtered.length === 0 ? (
          <div className="empty-note">No species match “{query}”.</div>
        ) : (
          <div className="card-grid">
            {filtered.map((s) => {
              const meta = speciesMetaOf(s);
              const cat = s.status?.category;
              return (
                <button
                  key={s.species_id}
                  className="sp-card"
                  data-ripple
                  style={{ '--sp': speciesColorOf(s).hex }}
                  aria-current={selectedSpecies?.species_id === s.species_id}
                  onClick={() => onOpenInAtlas(s)}
                >
                  <div className="sp-card__top">
                    <div>
                      <div className="sp-card__name">{s.common_name || s.scientific_name}</div>
                      <div className="sp-card__sci">{s.scientific_name} · {s.family}</div>
                    </div>
                    <span className={`iucn iucn--${cat || 'none'}`}>{cat || 'n/a'}</span>
                  </div>
                  <p className="sp-card__route">{meta.movement_label || 'Migratory route'}</p>
                  <div className="sp-card__foot">
                    <span>{s.evidence_level === 'tracks' ? `${s.tracked_individuals ?? '–'} tracked birds` : 'Sightings only'}</span>
                    <span className="sp-card__go">Open in atlas <ArrowRight size={14} /></span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default SpeciesPage;
