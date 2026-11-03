/**
 * IUCN Red List category codes and their full names, plus the full forms of the other
 * acronyms the site shows, so no code appears without its meaning.
 */

import React from 'react';
import { IUCN_MEANING, THREATENED } from './analytics/concern';

export const IUCN_ORDER = ['CR', 'EN', 'VU', 'NT', 'LC'];

// "Near Threatened: close to qualifying…" -> "Near Threatened"
export const iucnName = (cat) => (cat && IUCN_MEANING[cat] ? IUCN_MEANING[cat].split(':')[0] : null);
// "…: close to qualifying…" -> "Close to qualifying…"
export const iucnDefinition = (cat) => {
  const d = cat && IUCN_MEANING[cat] ? IUCN_MEANING[cat].split(':').slice(1).join(':').trim() : '';
  return d ? d[0].toUpperCase() + d.slice(1) : '';
};

export const ACRONYMS = {
  IUCN: 'International Union for Conservation of Nature',
  GBIF: 'Global Biodiversity Information Facility',
  AVONET: 'AVONET: global database of bird traits (Tobias et al. 2022)',
  GPS: 'Global Positioning System',
  ERA5: 'ERA5: ECMWF climate reanalysis, version 5',
  CMIP6: 'Coupled Model Intercomparison Project, phase 6',
};

/** An acronym with its full form on hover and for screen readers. */
export const Abbr = ({ children }) => (
  <abbr className="o-abbr" title={ACRONYMS[children] || undefined}>
    {children}
  </abbr>
);

/**
 * IUCN status tag. Always carries the full category name (hover tooltip and accessible
 * name); `full` also prints it next to the code.
 */
export const IucnTag = ({ cat, full = false, prefix = false, className = '', style }) => {
  const name = iucnName(cat);
  const label = cat ? `IUCN Red List: ${name || cat}` : 'No verified IUCN assessment';
  return (
    <span className={`iucn iucn--${cat || 'none'} ${className}`} style={style} title={label} aria-label={label}>
      <span aria-hidden="true">
        {prefix && 'IUCN '}
        {cat || 'n/a'}
        {full && name && <span className="iucn__name"> · {name}</span>}
      </span>
    </span>
  );
};

export const isAtRiskCategory = (cat) => THREATENED.includes(cat);
