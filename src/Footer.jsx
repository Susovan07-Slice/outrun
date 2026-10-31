import React, { useState } from 'react';
import { ExternalLink, X, ShieldCheck } from 'lucide-react';

const Footer = ({
  activeTrackDataset = null,
  showSourcesModal: controlledShowModal,
  setShowSourcesModal: controlledSetShowModal,
}) => {
  const [internalShowModal, setInternalShowModal] = useState(false);

  const isModalOpen =
    controlledShowModal !== undefined ? controlledShowModal : internalShowModal;
  const setModalOpen =
    controlledSetShowModal !== undefined
      ? controlledSetShowModal
      : setInternalShowModal;

  return (
    <>
      <footer className="atlas-footer">
        <div className="footer-left-meta">
          <span className="footer-brand">Outrun v2.0 · Migratory Birds Observatory</span>
          <span className="footer-sep">•</span>
          <span className="footer-attribution">
            Basemap: ©{' '}
            <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">
              OpenStreetMap
            </a>
            , ©{' '}
            <a href="https://carto.com/attributions" target="_blank" rel="noreferrer">
              CARTO Positron
            </a>
          </span>

          {activeTrackDataset && (
            <>
              <span className="footer-sep">•</span>
              <span className="footer-telemetry-badge">
                🛰️ Active Tracks: <strong>{activeTrackDataset.title || 'GPS Telemetry'}</strong>
                {activeTrackDataset.citation && (
                  <span style={{ marginLeft: '6px' }} title={activeTrackDataset.citation}>
                    · Citation: <em>{activeTrackDataset.citation.split('.')[0]} et al.</em>
                  </span>
                )}
                {activeTrackDataset.doi && (
                  <span style={{ marginLeft: '6px' }}>
                    · DOI:{' '}
                    <a
                      href={`https://doi.org/${activeTrackDataset.doi}`}
                      target="_blank"
                      rel="noreferrer"
                    >
                      {activeTrackDataset.doi}
                    </a>
                  </span>
                )}
                <span style={{ marginLeft: '6px', color: '#6B7280' }}>
                  · Licence:{' '}
                  <a
                    href={activeTrackDataset.license || 'http://creativecommons.org/licenses/by-nc/4.0/legalcode'}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <code>
                      {activeTrackDataset.license?.includes('zero') || activeTrackDataset.license?.includes('publicdomain')
                        ? 'CC0 1.0'
                        : activeTrackDataset.license?.includes('by-nc')
                        ? 'CC-BY-NC 4.0'
                        : activeTrackDataset.license?.includes('by')
                        ? 'CC-BY 4.0'
                        : activeTrackDataset.license || 'CC-BY-NC 4.0'}
                    </code>
                  </a>
                </span>
                {activeTrackDataset.license?.includes('by-nc') && (
                  <span style={{ marginLeft: '8px', color: '#B45309', fontWeight: 600, fontSize: '11px', background: '#FEF3C7', padding: '1px 6px', borderRadius: '4px' }}>
                    ⚠️ Non-Commercial Use Only
                  </span>
                )}
                {(activeTrackDataset.license?.includes('zero') || activeTrackDataset.license?.includes('publicdomain')) && (
                  <span style={{ marginLeft: '8px', color: '#047857', fontWeight: 600, fontSize: '11px', background: '#D1FAE5', padding: '1px 6px', borderRadius: '4px' }}>
                    ✓ Public Domain (CC0)
                  </span>
                )}
              </span>
            </>
          )}
        </div>

        <div className="footer-right-links">
          <button className="footer-btn" onClick={() => setModalOpen(true)}>
            Sources & Licences
          </button>
          <a
            href="https://www.gbif.org"
            target="_blank"
            rel="noreferrer"
            className="footer-link"
          >
            GBIF.org <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
          </a>
          <a
            href="https://open-meteo.com"
            target="_blank"
            rel="noreferrer"
            className="footer-link"
          >
            Open-Meteo <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
          </a>
        </div>
      </footer>

      {isModalOpen && (
        <div className="modal-backdrop" onClick={() => setModalOpen(false)}>
          <div className="sources-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShieldCheck size={20} color="#2A6F7D" />
                <h3 className="modal-title">Scientific Provenance, Sources & Licences</h3>
              </div>
              <button
                className="modal-close-btn"
                onClick={() => setModalOpen(false)}
                aria-label="Close dialog"
              >
                <X size={18} />
              </button>
            </div>

            <div className="modal-body-scroll">
              <p className="modal-intro">
                Outrun operates under strict scientific non-negotiables (AGENTS.md Rule 1 & Rule 7):
                no synthetic or fabricated records, coordinates, or tracks are ever permitted.
                Every single record retains its authoritative institutional provenance.
              </p>

              <div className="source-block">
                <h4>1. GPS Telemetry Tracking (Class Aves Only)</h4>
                <p>
                  <strong>Primary Telemetry Archive:</strong> BirdMap Data - GPS tracking of Storks, Cranes and birds of prey, breeding in Northern and Eastern Europe.
                </p>
                <p>
                  <strong>Citation:</strong> Adojaan K, Sellis U, Väli Ü, Ojaste I, Denac K, Lõhmus A, Ķuze J. <em>BirdMap Data</em>. PlutoF / GBIF Occurrence dataset.
                </p>
                <p>
                  <strong>GBIF Dataset Key:</strong> <code>712dba38-74cc-4704-87c0-63d1bf8484bc</code> · <strong>DOI:</strong> <a href="https://doi.org/10.15468/vnwmrx" target="_blank" rel="noreferrer">10.15468/vnwmrx</a>
                </p>
                <p>
                  <strong>Licence:</strong> Creative Commons Attribution-NonCommercial 4.0 International (CC-BY-NC 4.0).
                </p>
                <p>
                  <strong>Trajectometry & Filtering:</strong> Consecutive occurrenceIDs segmented by calendar year deployments; points monotonically ordered by Unix timestamp; simplified using Ramer-Douglas-Peucker (tolerance &epsilon; = 0.02&deg; &approx; 2.2 km); capped at 500 points per individual.
                </p>
              </div>

              <div className="source-block">
                <h4>2. GBIF Empirical Occurrence Records</h4>
                <p>
                  <strong>Taxonomic Match:</strong> GBIF Species Match API strictly verified for Class <code>Aves</code> (taxonKey 212).
                </p>
                <p>
                  <strong>Stratified Seasonal Sampling:</strong> 12 monthly queries (~42 records per month) from 2010 to 2026 for <code>HUMAN_OBSERVATION</code> with valid coordinates and no geospatial issues. Deduplicated by <code>gbifID</code>.
                </p>
                <p>
                  <strong>Licences:</strong> CC0 1.0, CC-BY 4.0, CC-BY-NC 4.0. Retaining all 10 provenance fields.
                </p>
              </div>

              <div className="source-block">
                <h4>3. AVONET Morphological & Ecological Traits</h4>
                <p>
                  <strong>Reference:</strong> Tobias, J. A., Sheard, C., Pigot, A. L., et al. (2022). <em>AVONET: morphological, ecological and geographical data for all birds</em>. Ecology Letters, 25(3), 581–597. DOI: <a href="https://doi.org/10.1111/ele.13898" target="_blank" rel="noreferrer">10.1111/ele.13898</a>.
                </p>
                <p>
                  <strong>Traits:</strong> Hand-Wing Index (HWI) as continuous dispersal capability proxy; discrete Migration Category (1=Sedentary, 2=Partially migratory, 3=Migratory).
                </p>
                <p>
                  <strong>Licence:</strong> Creative Commons Attribution 4.0 International (CC-BY 4.0).
                </p>
              </div>

              <div className="source-block">
                <h4>4. Open-Meteo Synoptic & Historical Weather API</h4>
                <p>
                  <strong>Endpoints:</strong> Open-Meteo Forecast & Historical APIs for temperature, relative humidity, precipitation, and wind speed.
                </p>
                <p>
                  <strong>Epistemic Label:</strong> Labeled as <code>current conditions</code> (forecast) in observatory UI; persisted into local Cloudflare D1 weather snapshots for instant fallback.
                </p>
                <p>
                  <strong>Licence:</strong> CC-BY 4.0 Attribution.
                </p>
              </div>

              <div className="source-block">
                <h4>5. Rule 5 Conservation Status Provenance</h4>
                <p>
                  Conservation statuses are assigned <strong>only</strong> when validated via authoritative IUCN Red List token.
                  Without a verified token, status remains strictly <code>NULL</code> and <code>monitoring_group = 'review_required'</code>.
                  Absence of threat status never allows inferring "least concern" or "common".
                </p>
              </div>

              <div className="source-block">
                <h4>6. Base Map & UI Attribution</h4>
                <p>
                  Interactive animated trajectory concepts adapted from <code>github.com/bbecquet/bird-tracking</code> (MIT Licence).
                  Map vector tiles: © OpenStreetMap contributors, © CARTO.
                </p>
              </div>
            </div>

            <div className="modal-footer">
              <button className="modal-confirm-btn" onClick={() => setModalOpen(false)}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default Footer;
