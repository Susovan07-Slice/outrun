import React, { useState } from 'react';
import { Search, X, PanelLeftClose } from 'lucide-react';
import { speciesColorOf } from './config';

export const isThreatened = (s) => ['CR', 'EN', 'VU', 'NT'].includes(s.status?.category);

export function filterSpecies(list, query, status) {
  const q = query.toLowerCase().trim();
  const matched = list.filter((s) => {
    if (status === 'threatened' && !isThreatened(s)) return false;
    if (status === 'lc' && s.status?.category !== 'LC') return false;
    if (!q) return true;
    return (
      s.scientific_name?.toLowerCase().includes(q) ||
      s.common_name?.toLowerCase().includes(q) ||
      s.family?.toLowerCase().includes(q)
    );
  });

  // Sort species with the maximum number of tracked birds on the bottom (ascending order)
  return [...matched].sort((a, b) => {
    const countA = a.tracked_individuals ?? 0;
    const countB = b.tracked_individuals ?? 0;
    if (countA !== countB) return countA - countB;
    return (a.common_name || a.scientific_name || '').localeCompare(b.common_name || b.scientific_name || '');
  });
}

const SpeciesList = ({ speciesList = [], selectedSpecies, onSelectSpecies, onCollapse }) => {
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('all');

  const filtered = filterSpecies(speciesList, query, status);
  const threatenedCount = speciesList.filter(isThreatened).length;

  return (
    <aside className="float o-panel species-panel" aria-label="Species">
      <div className="panel-head">
        <h2>
          Species<span className="count">{filtered.length}/{speciesList.length}</span>
        </h2>
        <button className="o-iconbtn panel-collapse-btn" data-ripple onClick={onCollapse} title="Hide species list" aria-label="Hide species list">
          <PanelLeftClose size={17} />
        </button>
      </div>

      <div className="search">
        <Search size={15} />
        <input
          type="search"
          placeholder="Search name or family"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search species"
        />
        {query && (
          <button className="search__clear" onClick={() => setQuery('')} aria-label="Clear search">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="filter-row">
        <div className="o-seg" role="tablist" aria-label="Conservation status">
          {[
            ['all', `All`],
            ['threatened', `At risk · ${threatenedCount}`],
            ['lc', 'Least concern'],
          ].map(([key, label]) => (
            <button
              key={key}
              className="o-seg__btn"
              role="tab"
              aria-selected={status === key}
              data-ripple
              onClick={() => setStatus(key)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="species-scroll" role="listbox" aria-label="Species list">
        {filtered.length === 0 ? (
          <div className="empty-note">No species match “{query}”.</div>
        ) : (
          filtered.map((s) => {
            const selected = selectedSpecies?.species_id === s.species_id;
            return (
              <button
                key={s.species_id}
                className="o-species"
                role="option"
                aria-selected={selected}
                data-ripple
                style={{ '--sp': speciesColorOf(s).hex }}
                onClick={() => onSelectSpecies(s)}
              >
                <span className="o-species__swatch" />
                <span className="o-species__names">
                  <span className="o-species__common">{s.common_name || s.scientific_name}</span>
                  <span className="o-species__sci">{s.scientific_name}</span>
                </span>
                <span className="o-species__meta">
                  {isThreatened(s) && <span className={`iucn iucn--${s.status.category}`} title="IUCN Red List: of conservation concern">{s.status.category}</span>}
                  {s.evidence_level === 'tracks' ? `${s.tracked_individuals ?? '–'} birds` : 'sightings'}
                </span>
              </button>
            );
          })
        )}
      </div>
    </aside>
  );
};

export default SpeciesList;
