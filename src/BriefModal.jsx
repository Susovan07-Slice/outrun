/**
 * src/BriefModal.jsx
 * 
 * Outrun Phase 5: One-Page Executive Scientific Brief & Print-to-PDF
 * 
 * Formatted specifically for clean single-page printing / PDF export.
 * Built from computed results and source metadata only.
 */

import React, { useState, useEffect } from 'react';
import {
  Printer,
  X,
  ShieldCheck,
  ShieldAlert,
  AlertCircle,
  Gauge,
  Sliders,
  GitBranch,
  CloudSun,
  FileCheck,
  ExternalLink,
  Layers,
} from 'lucide-react';
import { generateSpeciesBrief } from './analytics/brief';

const BriefModal = ({ species, corridorData, weatherData, occurrences, tracksSimulated = false, onClose }) => {
  const [brief, setBrief] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!species) return;

    let isMounted = true;
    setLoading(true);

    async function loadBrief() {
      // 1. Try Worker API
      try {
        const res = await fetch(`/api/brief?species=${species.species_id}`);
        if (res.ok) {
          const json = await res.json();
          if (json.brief && isMounted) {
            setBrief(json.brief);
            setLoading(false);
            return;
          }
        }
      } catch (e) {
        // Fallback to local synthesis
      }

      // 2. Synthesize locally from active props
      const localBrief = generateSpeciesBrief({
        species_id: species.species_id,
        scientific_name: species.scientific_name,
        common_name: species.common_name,
        family: species.family,
        gbif_taxon_key: species.gbif_taxon_key,
        monitoring_group: species.monitoring_group,
        evidence_level: species.evidence_level,
        tracked_individuals: species.tracked_individuals,
        tracks_simulated: tracksSimulated,
        occurrence_count: species.occurrence_count,
        occurrences: occurrences || [],
        status: species.status,
        traits: species.traits,
        race: corridorData?.race,
        twin: corridorData?.twin,
        critical_links: corridorData?.critical_links || [],
        weather: weatherData?.weather,
      });

      if (isMounted) {
        setBrief(localBrief);
        setLoading(false);
      }
    }

    loadBrief();

    return () => {
      isMounted = false;
    };
  }, [species, corridorData, weatherData, occurrences]);

  const handlePrint = () => {
    window.print();
  };

  if (!species) return null;

  return (
    <div className="brief-modal-backdrop" onClick={onClose}>
      <div className="brief-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Control Bar (Hidden during print) */}
        <div className="brief-top-controls no-print">
          <div className="brief-title-bar-left">
            <span className="brief-tag font-mono">SCIENTIFIC EXECUTIVE BRIEF</span>
            <span className="brief-species-pill">{species.common_name || species.scientific_name}</span>
          </div>

          <div className="brief-actions-right">
            <button className="brief-action-btn primary" onClick={handlePrint} title="Export to PDF or Print">
              <Printer size={15} />
              <span>Print / Export PDF</span>
            </button>
            <button className="brief-action-btn close" onClick={onClose} aria-label="Close modal">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable Executive Dossier Page */}
        <div className="printable-brief-page printable-sheet">
          {loading || !brief ? (
            <div className="brief-loading-state">
              <div className="loading-spinner-ring" />
              <p>Synthesizing verified executive brief from observational and climate layers...</p>
            </div>
          ) : (
            <div className="brief-content-wrapper">
              {/* Header: Platform & Species Identity */}
              <header className="brief-header-row">
                <div>
                  <div className="brief-platform-logo">OUTRUN OBSERVATORY • CLASS AVES CLIMATE DOSSIER</div>
                  <h1 className="brief-species-name">
                    {brief.common_name} <span className="brief-sci-sub">({brief.scientific_name})</span>
                  </h1>
                  <div className="brief-meta-line">
                    <span><strong>Family:</strong> {brief.family}</span>
                    <span className="dot">•</span>
                    <span><strong>GBIF Taxon Key:</strong> {brief.gbif_taxon_key}</span>
                    <span className="dot">•</span>
                    <span><strong>Evidence:</strong> {brief.evidence_level.toUpperCase()}</span>
                  </div>
                </div>

                <div className="brief-confidence-stamp">
                  <span className="confidence-title">EVIDENCE GRADE</span>
                  <div className="confidence-grade-pill">{brief.the_proof.confidence_grade}</div>
                  <span className="confidence-score font-mono">{brief.the_proof.score}</span>
                </div>
              </header>

              {/* Status & Morphology Row */}
              <div className="brief-two-col-grid">
                {/* Conservation Status */}
                <div className="brief-section-box">
                  <div className="brief-box-title">
                    <ShieldCheck size={14} />
                    <span>Authoritative Conservation Status (Rule 5)</span>
                  </div>
                  <div className="brief-box-content">
                    <div className="brief-stat-highlight">
                      <span className="lbl">Status Category:</span>
                      <strong className="val">{brief.conservation_status.category}</strong>
                    </div>
                    <p className="brief-subtext">
                      {brief.conservation_status.provenance_rule}
                    </p>
                    <div className="brief-source-cite font-mono">
                      Source: {brief.conservation_status.source} ({brief.conservation_status.assessment_year})
                    </div>
                  </div>
                </div>

                {/* Morphological Traits */}
                <div className="brief-section-box">
                  <div className="brief-box-title">
                    <FileCheck size={14} />
                    <span>Morphological Traits (AVONET)</span>
                  </div>
                  <div className="brief-box-content">
                    <div className="brief-stat-highlight">
                      <span className="lbl">Hand-Wing Index (HWI):</span>
                      <strong className="val font-mono">{brief.morphology_traits.hand_wing_index}</strong>
                      <span className="note">(Dispersal proxy)</span>
                    </div>
                    <p className="brief-subtext">
                      <strong>Migration Strategy:</strong> {brief.morphology_traits.migration_category_label}
                    </p>
                    <div className="brief-source-cite font-mono">
                      {brief.morphology_traits.dispersal_rank}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: The Race & The Twin */}
              <div className="brief-two-col-grid">
                {/* The Race */}
                <div className="brief-section-box">
                  <div className="brief-box-title">
                    <Gauge size={14} />
                    <span>The Race: Climate Velocity</span>
                    <span className="epistemic-badge badge-projected">projected</span>
                  </div>
                  <div className="brief-box-content">
                    <div className="brief-metric-pair">
                      <div>
                        <span className="m-lbl">Breeding Range:</span>
                        <span className="m-val font-mono">{brief.the_race.breeding_velocity}</span>
                      </div>
                      <div>
                        <span className="m-lbl">Non-Breeding Range:</span>
                        <span className="m-val font-mono">{brief.the_race.non_breeding_velocity}</span>
                      </div>
                    </div>
                    <div className="brief-verdict-callout">
                      <strong>Observatory Verdict:</strong> {brief.the_race.verdict}
                    </div>
                    <p className="brief-subtext">{brief.the_race.verdict_reason}</p>
                  </div>
                </div>

                {/* The Twin */}
                <div className="brief-section-box">
                  <div className="brief-box-title">
                    <Sliders size={14} />
                    <span>The Twin: Suitability Shift (CMIP6)</span>
                    <span className="epistemic-badge badge-simulated">simulated</span>
                  </div>
                  <div className="brief-box-content">
                    <div className="brief-metric-pair">
                      <div>
                        <span className="m-lbl">Baseline Suitable:</span>
                        <span className="m-val font-mono">{brief.the_twin.baseline_suitable_cells} cells</span>
                      </div>
                      <div>
                        <span className="m-lbl">Future (2050):</span>
                        <span className="m-val font-mono">{brief.the_twin.future_suitable_cells} cells</span>
                      </div>
                    </div>
                    <p className="brief-subtext">
                      <strong>Net Envelope Turnover:</strong> {brief.the_twin.net_shift}
                    </p>
                    <div className="brief-source-cite">
                      Multi-Model Spread: {brief.the_twin.model_uncertainty_spread}
                    </div>
                  </div>
                </div>
              </div>

              {/* Section: The Break & The Watch */}
              <div className="brief-two-col-grid">
                {/* The Break */}
                <div className="brief-section-box">
                  <div className="brief-box-title">
                    <GitBranch size={14} />
                    <span>The Break: Flyway Criticality</span>
                    <span className="epistemic-badge badge-simulated">simulated</span>
                  </div>
                  <div className="brief-box-content">
                    {brief.the_break_and_fix.top_critical_link ? (
                      <div>
                        <div className="brief-stat-highlight">
                          <span className="lbl">Top Critical Bottleneck:</span>
                          <strong className="val font-mono">{brief.the_break_and_fix.top_critical_link.coordinates}</strong>
                        </div>
                        <p className="brief-subtext">
                          Pinch-point severing entails <strong>{brief.the_break_and_fix.top_critical_link.area_loss}</strong> loss of reachable suitable flyway area ({brief.the_break_and_fix.top_critical_link.components_increase}).
                        </p>
                      </div>
                    ) : (
                      <p className="brief-subtext">No severe topological bottlenecks detected in current seasonal range.</p>
                    )}
                    <div className="brief-source-cite font-mono">
                      Candidate Critical Links Identified: {brief.the_break_and_fix.bottleneck_count}
                    </div>
                  </div>
                </div>

                {/* The Watch */}
                <div className="brief-section-box">
                  <div className="brief-box-title">
                    <CloudSun size={14} />
                    <span>The Watch: Synoptic Forecast Risk</span>
                    <span className="epistemic-badge badge-forecast">forecast</span>
                  </div>
                  <div className="brief-box-content">
                    <div className="brief-stat-highlight">
                      <span className="lbl">Seasonal Gating:</span>
                      <strong className={`val ${brief.the_watch.current_season_active ? 'active-green' : 'dormant'}`}>
                        {brief.the_watch.current_season_active ? 'In Seasonal Window' : 'Outside Window (Dormant)'}
                      </strong>
                    </div>
                    <p className="brief-subtext">{brief.the_watch.summary}</p>
                    {brief.the_watch.triggered_hazards?.length > 0 && (
                      <ul className="brief-hazards-list">
                        {brief.the_watch.triggered_hazards.map((h, i) => (
                          <li key={i}>
                            <strong>{h.hazard}:</strong> {h.measured} (Threshold: {h.threshold})
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>

              {/* Rubric Breakdown */}
              <div className="brief-section-box full-width">
                <div className="brief-box-title">
                  <FileCheck size={14} />
                  <span>The Proof: 4-Factor Rubric Audit Breakdown</span>
                </div>
                <div className="brief-rubric-grid">
                  {brief.the_proof.dimensions.map((dim, idx) => (
                    <div key={idx} className="brief-rubric-cell">
                      <div className="rubric-cell-head">
                        <span className="d-name">{dim.dimension}</span>
                        <span className="d-pts font-mono">{dim.score} / {dim.weight} pts</span>
                      </div>
                      <p className="d-details">{dim.details}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Footer Provenance & Limitations */}
              <footer className="brief-footer">
                <div className="brief-datasets-line">
                  <strong>Authoritative Sources:</strong> GBIF (CC-BY 4.0), AVONET (Tobias et al. 2022), Copernicus ECMWF ERA5, CMIP6 HighResMIP (EC_Earth3P_HR & MPI_ESM1_2_XR).
                </div>
                <div className="brief-disclaimer-text">
                  {brief.provenance_and_licensing.disclaimer}
                </div>
                <div className="brief-hash-line font-mono">
                  Dossier Generated: {new Date(brief.provenance_and_licensing.generated_at).toUTCString()} • Outrun Platform v1.0
                </div>
              </footer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BriefModal;
