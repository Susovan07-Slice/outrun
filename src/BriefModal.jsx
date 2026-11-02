/**
 * src/BriefModal.jsx
 *
 * One-page species brief: the same plain-language findings as the side panel, laid out to
 * read in a minute and to print on a single A4 page. Built only from computed results and
 * source metadata; anything missing reads "Insufficient evidence".
 */

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, X } from 'lucide-react';
import { loadConcern, IUCN_MEANING } from './analytics/concern';
import { plainRaceVerdict } from './CorridorPanel';

const INSUFFICIENT = 'Insufficient evidence';
const SEASON_NAME = { breeding: 'breeding range', non_breeding: 'wintering range' };

const categoryName = (cat) => (cat && IUCN_MEANING[cat] ? IUCN_MEANING[cat].split(':')[0] : null);

const Label = ({ kind }) => <span className={`bf-label bf-label--${kind}`}>{kind}</span>;

const KeyFact = ({ label, value, sub, tone, kind }) => (
  <div className={`bf-fact ${tone ? `bf-fact--${tone}` : ''}`}>
    <div className="bf-fact__label">
      {label}
      {kind && <Label kind={kind} />}
    </div>
    <div className="bf-fact__value">{value ?? INSUFFICIENT}</div>
    {sub && <div className="bf-fact__sub">{sub}</div>}
  </div>
);

const BriefModal = ({ species, corridorData, occurrences, tracksSimulated = false, activeSeason = 'breeding', onClose }) => {
  const [concern, setConcern] = useState(null);

  useEffect(() => {
    let live = true;
    setConcern(null);
    loadConcern(species).then((c) => live && setConcern(c));
    return () => { live = false; };
  }, [species?.species_id]);

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  if (!species) return null;

  const name = species.common_name || species.scientific_name;
  const category = species.status?.category || null;
  const catName = categoryName(category);
  const race = corridorData?.race;
  const verdict = race?.verdict ? plainRaceVerdict(race.verdict) : null;
  const summary = corridorData?.twin?.summary;
  const seasonName = SEASON_NAME[activeSeason] || 'range';
  const keptPct =
    summary?.baseline_suitable_cells > 0
      ? Math.round((summary.future_suitable_cells / summary.baseline_suitable_cells) * 100)
      : null;
  const stop = [...(corridorData?.critical_links || [])].sort((a, b) => (b.loss_percent || 0) - (a.loss_percent || 0))[0];
  const stopName = stop ? stop.name || stop.label || `${stop.lat}°, ${stop.lon}°` : null;
  const birds = species.tracked_individuals;
  const sightings = occurrences?.length || species.occurrence_count;
  // The stopover pressure has its own section below, so it is not repeated here.
  const pressures = (concern?.pressures || []).filter((p) => !p.title.startsWith('Depends on')).slice(0, 4);

  // The "in short" paragraph: one sentence per finding, skipping anything we have no data for.
  const inShort = [
    catName ? `${name} is listed as ${catName} on the IUCN Red List.` : `${name} has no verified IUCN assessment.`,
    keptPct != null &&
      `By 2050, about ${keptPct}% of the places with suitable climate in its ${seasonName} are expected to remain.`,
    verdict && `${verdict.title}.`,
    stopName && stop.loss_percent != null &&
      `Its most important stopover is ${stopName}; losing it would cut off ${stop.loss_percent}% of the habitat it can reach.`,
  ].filter(Boolean);

  const today = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return createPortal(
    <div className="bf-backdrop brief-print-root" onClick={onClose}>
      <div className="bf-window" role="dialog" aria-label={`${name} brief`} onClick={(e) => e.stopPropagation()}>
        <div className="bf-bar no-print">
          <span className="bf-bar__title">Species brief</span>
          <div className="bf-bar__actions">
            <button className="bf-btn bf-btn--primary" onClick={() => window.print()}>
              <Printer size={15} />
              <span>Print / Save PDF</span>
            </button>
            <button className="bf-btn" onClick={onClose} aria-label="Close brief">
              <X size={16} />
            </button>
          </div>
        </div>

        <article className="bf-sheet">
          <header className="bf-head">
            <div>
              <div className="bf-kicker">Outrun · Migratory bird brief · {today}</div>
              <h1 className="bf-name">{name}</h1>
              <div className="bf-sci">
                <em>{species.scientific_name}</em>
                {species.family && <> · {species.family}</>}
              </div>
            </div>
            {category && (
              <div className={`bf-status iucn--${category}`}>
                <span className="bf-status__code">{category}</span>
                <span className="bf-status__name">{catName}</span>
              </div>
            )}
          </header>

          <section className="bf-short">
            <h2>In short</h2>
            <p>{inShort.join(' ')}</p>
          </section>

          <section className="bf-facts">
            <KeyFact
              label="Birds tracked"
              value={birds ? `${birds} birds` : sightings ? `${sightings.toLocaleString()} sightings` : null}
              sub={tracksSimulated ? 'Routes are modelled' : birds ? 'Real GPS routes' : 'Sightings only'}
              kind={tracksSimulated ? 'simulated' : 'observed'}
            />
            <KeyFact
              label="Suitable climate kept by 2050"
              value={keptPct != null ? `${keptPct}%` : null}
              sub={summary ? `${summary.future_suitable_cells} of ${summary.baseline_suitable_cells} areas, ${seasonName}` : null}
              tone={keptPct == null ? null : keptPct < 50 ? 'danger' : keptPct < 80 ? 'warn' : 'ok'}
              kind="projected"
            />
            <KeyFact
              label="Climate shift speed"
              value={race?.mean_velocity_km_decade != null ? `${race.mean_velocity_km_decade} km` : null}
              sub="per decade, across its range"
              kind="projected"
            />
            <KeyFact
              label="Can it keep up?"
              value={verdict ? (verdict.tone === 'ok' ? 'Likely' : verdict.tone === 'danger' ? 'No' : 'Partly') : null}
              sub={race?.hwi_rank != null ? `Flight ability #${race.hwi_rank} of ${race.hwi_rank_total}` : null}
              tone={verdict?.tone}
              kind="projected"
            />
          </section>

          <section className="bf-section">
            <h2>{concern?.atRisk ? 'Why it is of concern' : 'Pressures to watch'}</h2>
            {pressures.length ? (
              <ul className="bf-pressures">
                {pressures.map((p, i) => (
                  <li key={i} className={`bf-pressure is-${p.severity}`}>
                    <div className="bf-pressure__title">
                      <span>{p.title}</span>
                      <Label kind={p.label} />
                    </div>
                    <p>{p.detail}</p>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="bf-muted">{concern ? INSUFFICIENT : 'Loading…'}</p>
            )}
          </section>

          <section className="bf-section">
            <h2>Where protection helps most</h2>
            {stopName ? (
              <p>
                <strong>{stopName}</strong> is the stopover this flyway depends on most. If it were lost,{' '}
                <strong>{stop.loss_percent}%</strong> of the habitat the birds can reach would be cut off. <Label kind="simulated" />
              </p>
            ) : (
              <p className="bf-muted">No critical stopover found for this season.</p>
            )}
          </section>

          <footer className="bf-foot">
            <p>
              <strong>Data:</strong> GBIF sightings and GPS tracks, AVONET wing traits, ERA5 climate 2005–2024, CMIP6
              climate models for 2050, IUCN Red List{concern?.year ? ` (${concern.year})` : ''}.
            </p>
            <p>
              <strong>Labels:</strong> observed = measured; projected = climate-model outlook; simulated = Outrun model
              result. Climate suitability covers temperature only, not land use or food.
            </p>
          </footer>
        </article>
      </div>
    </div>,
    document.body
  );
};

export default BriefModal;
