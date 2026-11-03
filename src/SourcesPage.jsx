import React from 'react';

const SECTIONS = [
  ['labels', 'How we label evidence'],
  ['telemetry', 'GPS telemetry'],
  ['gbif', 'GBIF occurrences'],
  ['avonet', 'AVONET traits'],
  ['meteo', 'Open-Meteo weather'],
  ['iucn', 'Conservation status'],
  ['photos', 'Species photos'],
  ['map', 'Basemap & credits'],
];

const licenceLabel = (l = '') =>
  l.includes('zero') || l.includes('publicdomain') ? 'CC0 1.0' : l.includes('by-nc') ? 'CC-BY-NC 4.0' : l.includes('by') ? 'CC-BY 4.0' : l || 'CC-BY-NC 4.0';

const SourcesPage = ({ activeTrackDataset }) => (
  <div className="content-page">
    <div className="content-wrap">
      <header className="hero">
        <div>
          <h1>Sources & provenance</h1>
          <p>
            No synthetic records, coordinates or tracks. Every record keeps its institutional provenance, and every number
            in the atlas says how it is known.
          </p>
        </div>
      </header>

      <div className="doc-grid">
        <nav className="doc-toc" aria-label="On this page">
          {SECTIONS.map(([id, label]) => (
            <a key={id} href={`#/sources`} onClick={(e) => { e.preventDefault(); document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }); }}>
              {label}
            </a>
          ))}
        </nav>

        <div className="doc-sections">
          <section className="doc-card" id="labels">
            <h2>How we label evidence</h2>
            <p>Every metric and map layer carries one of four labels.</p>
            <div className="epi-grid">
              <div className="epi-item"><span className="o-badge o-badge--observed">observed</span><p>GBIF human observations and verified GPS telemetry fixes.</p></div>
              <div className="epi-item"><span className="o-badge o-badge--forecast">forecast</span><p>Current and short-range conditions from Open-Meteo weather models.</p></div>
              <div className="epi-item"><span className="o-badge o-badge--projected">projected</span><p>Medium to long-term CMIP6 climate scenario projections.</p></div>
              <div className="epi-item"><span className="o-badge o-badge--simulated">simulated</span><p>Corridor connectivity graphs, protection scenarios and the climate twin.</p></div>
            </div>
          </section>

          <section className="doc-card" id="telemetry">
            <h2>GPS telemetry</h2>
            {activeTrackDataset && (
              <p>
                <strong>Currently on the map:</strong> {activeTrackDataset.title || 'GPS telemetry'}
                {activeTrackDataset.doi && (
                  <> · DOI <a href={`https://doi.org/${activeTrackDataset.doi}`} target="_blank" rel="noreferrer">{activeTrackDataset.doi}</a></>
                )}{' '}
                · <code>{licenceLabel(activeTrackDataset.license)}</code>
                {activeTrackDataset.license?.includes('by-nc') && <> · non-commercial use only</>}
              </p>
            )}
            <p><strong>Primary archive:</strong> BirdMap Data — GPS tracking of storks, cranes and birds of prey breeding in Northern and Eastern Europe. Adojaan K, Sellis U, Väli Ü, Ojaste I, Denac K, Lõhmus A, Ķuze J. PlutoF / GBIF occurrence dataset.</p>
            <p><strong>GBIF dataset key:</strong> <code>712dba38-74cc-4704-87c0-63d1bf8484bc</code> · DOI <a href="https://doi.org/10.15468/vnwmrx" target="_blank" rel="noreferrer">10.15468/vnwmrx</a> · CC-BY-NC 4.0.</p>
            <p><strong>Processing:</strong> occurrence IDs segmented by deployment year, ordered by timestamp, simplified with Ramer–Douglas–Peucker (ε = 0.02° ≈ 2.2 km) and capped at 500 points per bird. Raptor breeding-season fixes near nests are coarsened to 0.1°.</p>
          </section>

          <section className="doc-card" id="gbif">
            <h2>GBIF occurrences</h2>
            <p><strong>Taxonomy:</strong> GBIF Species Match restricted to class <code>Aves</code> (taxonKey 212).</p>
            <p><strong>Sampling:</strong> 12 monthly queries (~42 records each) for <code>HUMAN_OBSERVATION</code> records, 2010–2026, with valid coordinates and no geospatial issues. Deduplicated by <code>gbifID</code>, keeping all 10 provenance fields.</p>
            <p><strong>Licences:</strong> CC0 1.0, CC-BY 4.0, CC-BY-NC 4.0. <a href="https://www.gbif.org" target="_blank" rel="noreferrer">gbif.org</a></p>
          </section>

          <section className="doc-card" id="avonet">
            <h2>AVONET traits</h2>
            <p>Tobias, J. A., Sheard, C., Pigot, A. L., et al. (2022). <em>AVONET: morphological, ecological and geographical data for all birds.</em> Ecology Letters 25(3), 581–597. DOI <a href="https://doi.org/10.1111/ele.13898" target="_blank" rel="noreferrer">10.1111/ele.13898</a> · CC-BY 4.0.</p>
            <p>Hand-wing index is used as a continuous dispersal proxy. Migration category runs 1 sedentary, 2 partial, 3 migratory.</p>
          </section>

          <section className="doc-card" id="meteo">
            <h2>Open-Meteo weather</h2>
            <p>Forecast and historical APIs for temperature, humidity, precipitation and wind. Labelled <span className="o-badge o-badge--forecast">forecast</span> and cached as snapshots for offline use. CC-BY 4.0. <a href="https://open-meteo.com" target="_blank" rel="noreferrer">open-meteo.com</a></p>
          </section>

          <section className="doc-card" id="iucn">
            <h2>Conservation status</h2>
            <p>Statuses come only from verified IUCN Red List assessments with a source URL. Without one, status stays <code>NULL</code> and reads “Insufficient evidence”. A missing status is never read as least concern.</p>
          </section>

          <section className="doc-card" id="photos">
            <h2>Species photos</h2>
            <p>Photos on the Species page come from <a href="https://www.inaturalist.org" target="_blank" rel="noreferrer">iNaturalist</a> contributors. Each is the species&apos; featured photo when it carries an open Creative Commons licence (CC0, CC-BY, CC-BY-SA, CC-BY-NC or CC-BY-NC-SA); otherwise the first openly licensed photo of that species. Photos marked all rights reserved or no-derivatives are never used.</p>
            <p>Every card credits its photographer and licence and links to the original. Images load from iNaturalist Open Data and are not redistributed.</p>
          </section>

          <section className="doc-card" id="map">
            <h2>Basemap & credits</h2>
            <p>Streets: <a href="https://openfreemap.org" target="_blank" rel="noreferrer">OpenFreeMap</a> (OpenMapTiles), data © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a> contributors. Satellite: Esri World Imagery, © Esri, Maxar, Earthstar Geographics. Animated trajectory concept adapted from <code>bbecquet/bird-tracking</code> (MIT).</p>
          </section>
        </div>
      </div>
    </div>
  </div>
);

export default SourcesPage;
