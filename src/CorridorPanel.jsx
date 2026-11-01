/**
 * src/CorridorPanel.jsx
 * 
 * Outrun Phase 4: The Race, The Twin, The Break & The Fix Interactive UI
 * 
 * Subpanels:
 * 1. THE RACE: Climate velocity (km/decade) in breeding & non-breeding range + HWI rank + honest verdict
 * 2. THE TWIN: Baseline-vs-future envelope suitability slider with model spread uncertainty
 * 3. THE BREAK: Candidate critical links (bottlenecks) ranking
 * 4. THE FIX: Protect toggle calling /api/simulate with before/after connectivity metric diff
 */

import React, { useState } from 'react';
import {
  Gauge,
  Sliders,
  GitBranch,
  ShieldAlert,
  ShieldCheck,
  Info,
  Layers,
  Sparkles,
  ArrowRight,
  TrendingUp,
  CloudSun,
  FileCheck,
  AlertCircle,
} from 'lucide-react';
import EvidencePanel from './EvidencePanel';
import { deriveSeasonalWindow, evaluateForecastRisk } from './analytics/watch';

const CorridorPanel = ({
  species,
  corridorData,
  loadingCorridor,
  activeSeason,
  onChangeSeason,
  twinSlider,
  onChangeTwinSlider,
  onSimulateProtect,
  protectedNodes = new Set(),
  simulationResult,
  weatherData,
  occurrences = [],
  activeTab: activeTabProp,
  onChangeTab,
}) => {
  const [internalTab, setInternalTab] = useState('race');
  const activeTab = activeTabProp !== undefined ? activeTabProp : internalTab;
  const handleTabChange = (tab) => {
    setInternalTab(tab);
    if (onChangeTab) onChangeTab(tab);
  };
  const [simulatingNode, setSimulatingNode] = useState(null);

  if (loadingCorridor) {
    return (
      <div className="corridor-loading-box">
        <div className="loading-spinner-ring" />
        <p>Computing climate velocity, envelope suitability, and corridor graph...</p>
      </div>
    );
  }

  if (!corridorData) {
    return (
      <div className="corridor-empty-state">
        <Info size={16} color="#7A7269" />
        <p>Select a species to view climate velocity, envelope projections, and corridor connectivity.</p>
      </div>
    );
  }

  const { race, twin, critical_links = [] } = corridorData;

  const handleProtectClick = async (nodeId) => {
    setSimulatingNode(nodeId);
    if (onSimulateProtect) {
      await onSimulateProtect(nodeId);
    }
    setSimulatingNode(null);
  };

  return (
    <div className="corridor-panel-wrapper">
      {/* Season Selector Bar */}
      <div className="corridor-season-bar">
        <span className="corridor-bar-label">Seasonal Range:</span>
        <div className="season-toggle-buttons">
          <button
            className={`season-btn ${activeSeason === 'breeding' ? 'active' : ''}`}
            onClick={() => onChangeSeason('breeding')}
          >
            Breeding Range (May–Aug)
          </button>
          <button
            className={`season-btn ${activeSeason === 'non_breeding' ? 'active' : ''}`}
            onClick={() => onChangeSeason('non_breeding')}
          >
            Non-Breeding (Nov–Feb)
          </button>
        </div>
      </div>

      {/* Layer Navigation Tabs */}
      <div className="corridor-tabs-nav">
        <button
          className={`corridor-tab-btn ${activeTab === 'race' ? 'active' : ''}`}
          onClick={() => handleTabChange('race')}
        >
          <Gauge size={13} />
          <span>The Race</span>
        </button>
        <button
          className={`corridor-tab-btn ${activeTab === 'twin' ? 'active' : ''}`}
          onClick={() => handleTabChange('twin')}
        >
          <Sliders size={13} />
          <span>The Twin</span>
        </button>
        <button
          className={`corridor-tab-btn ${activeTab === 'break_fix' ? 'active' : ''}`}
          onClick={() => handleTabChange('break_fix')}
        >
          <GitBranch size={13} />
          <span>Break & Fix</span>
        </button>
        <button
          className={`corridor-tab-btn ${activeTab === 'watch' ? 'active' : ''}`}
          onClick={() => handleTabChange('watch')}
        >
          <CloudSun size={13} />
          <span>The Watch</span>
        </button>
        <button
          className={`corridor-tab-btn ${activeTab === 'proof' ? 'active' : ''}`}
          onClick={() => handleTabChange('proof')}
        >
          <FileCheck size={13} />
          <span>The Proof</span>
        </button>
      </div>

      {/* TAB 1: THE RACE */}
      {activeTab === 'race' && race && (
        <div className="corridor-tab-content">
          <div className="corridor-section-header">
            <div className="section-title-group">
              <h3 className="section-main-title">THE RACE: Climate Velocity</h3>
              <span className="epistemic-badge badge-projected">projected</span>
            </div>
            <p className="section-subtitle">
              Calculates required tracking speed (&Delta;T / decade &divide; spatial gradient)
              next to morphological dispersal capacity.
            </p>
          </div>

          {/* Velocity Metric Cards Grid */}
          <div className="corridor-metric-grid">
            <div className="corridor-stat-card">
              <span className="stat-label">Breeding Velocity</span>
              <span className="stat-value">
                {race.breeding_velocity_km_decade != null
                  ? `${race.breeding_velocity_km_decade} km/dec`
                  : 'Insufficient data'}
              </span>
              <span className="stat-subtext">Northern summer range</span>
            </div>

            <div className="corridor-stat-card">
              <span className="stat-label">Non-Breeding Velocity</span>
              <span className="stat-value">
                {race.non_breeding_velocity_km_decade != null
                  ? `${race.non_breeding_velocity_km_decade} km/dec`
                  : 'Insufficient data'}
              </span>
              <span className="stat-subtext">Wintering flyway range</span>
            </div>

            <div className="corridor-stat-card highlight">
              <span className="stat-label">Overall Mean Velocity</span>
              <span className="stat-value font-mono">{race.mean_velocity_km_decade} km/dec</span>
              <span className="stat-subtext">Loarie et al. (2009) formulation</span>
            </div>

            <div className="corridor-stat-card highlight">
              <span className="stat-label">AVONET Dispersal Rank</span>
              <span className="stat-value font-mono">
                {race.hwi_rank != null ? `#${race.hwi_rank} of ${race.hwi_rank_total}` : 'Unmatched'}
              </span>
              <span className="stat-subtext">
                {race.hwi != null ? `HWI: ${race.hwi} (Dispersal proxy)` : 'No trait record'}
              </span>
            </div>
          </div>

          {/* Non-Negotiable Rule 4 Honest Verdict Box */}
          <div className="honest-verdict-box">
            <div className="verdict-header">
              <ShieldAlert size={15} color="#B45309" />
              <strong>OBSERVATORY VERDICT:</strong>
              <span className="verdict-tag">{race.verdict}</span>
            </div>
            <p className="verdict-explanation">
              {race.verdict_reason ||
                'The Hand-Wing Index (HWI) is a morphological dispersal proxy, not a physical velocity in km/decade. Sourced literature does not provide an empirical speed conversion threshold.'}
            </p>
            <div className="epistemic-cite-note">
              Methodology: Loarie et al. (2009) <em>Nature</em>; Burrows et al. (2011) <em>Science</em>.
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: THE TWIN */}
      {activeTab === 'twin' && twin && (
        <div className="corridor-tab-content">
          <div className="corridor-section-header">
            <div className="section-title-group">
              <h3 className="section-main-title">THE TWIN: Climate Suitability Envelope</h3>
              <span className="epistemic-badge badge-simulated">simulated</span>
            </div>
            <p className="section-subtitle">
              Scores 5th–95th percentile thermal niche derived from empirical observations against baseline
              and future CMIP6 models.
            </p>
          </div>

          {/* Interactive Baseline-to-Future Slider */}
          <div className="twin-slider-container">
            <div className="slider-label-row">
              <span className={twinSlider <= 0.2 ? 'active-horizon' : ''}>
                <strong>Baseline (2005–2024)</strong>
                <span className="horizon-sub">ERA5 Reanalysis</span>
              </span>
              <span className="slider-percent-badge font-mono">
                {Math.round(twinSlider * 100)}% Projection Horizon
              </span>
              <span className={twinSlider >= 0.8 ? 'active-horizon' : ''}>
                <strong>Future (2025–2050)</strong>
                <span className="horizon-sub">CMIP6 Multi-Model</span>
              </span>
            </div>

            <input
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={twinSlider}
              onChange={(e) => onChangeTwinSlider(parseFloat(e.target.value))}
              className="twin-temporal-slider"
              aria-label="Twin Climate Projection Horizon Slider"
            />

            <div className="slider-quick-buttons">
              <button
                className={`quick-step-btn ${twinSlider === 0 ? 'selected' : ''}`}
                onClick={() => onChangeTwinSlider(0)}
              >
                ERA5 Baseline
              </button>
              <button
                className={`quick-step-btn ${twinSlider === 0.5 ? 'selected' : ''}`}
                onClick={() => onChangeTwinSlider(0.5)}
              >
                Mid Horizon (2037)
              </button>
              <button
                className={`quick-step-btn ${twinSlider === 1 ? 'selected' : ''}`}
                onClick={() => onChangeTwinSlider(1)}
              >
                CMIP6 2050
              </button>
            </div>
          </div>

          {/* Empirical Envelope Percentiles */}
          <div className="envelope-bounds-card">
            <span className="bounds-title">Empirical 5th–95th Percentile Thermal Envelope</span>
            <div className="percentiles-row font-mono">
              <div className="p-item">
                <span className="p-lbl">5th %ile</span>
                <span className="p-val">{twin.envelope?.p05}°C</span>
              </div>
              <div className="p-item">
                <span className="p-lbl">10th %ile</span>
                <span className="p-val">{twin.envelope?.p10}°C</span>
              </div>
              <div className="p-item core">
                <span className="p-lbl">Median (50th)</span>
                <span className="p-val">{twin.envelope?.p50}°C</span>
              </div>
              <div className="p-item">
                <span className="p-lbl">90th %ile</span>
                <span className="p-val">{twin.envelope?.p90}°C</span>
              </div>
              <div className="p-item">
                <span className="p-lbl">95th %ile</span>
                <span className="p-val">{twin.envelope?.p95}°C</span>
              </div>
            </div>
          </div>

          {/* Suitability Summary & Spread */}
          <div className="corridor-metric-grid">
            <div className="corridor-stat-card">
              <span className="stat-label">Baseline Suitable</span>
              <span className="stat-value">{twin.summary?.baseline_suitable_cells} cells</span>
              <span className="stat-subtext">Suitability score &ge; 0.5</span>
            </div>
            <div className="corridor-stat-card">
              <span className="stat-label">Future Suitable</span>
              <span className="stat-value">{twin.summary?.future_suitable_cells} cells</span>
              <span className="stat-subtext">Ensemble score &ge; 0.5</span>
            </div>
            <div className="corridor-stat-card">
              <span className="stat-label">Habitat Shift</span>
              <span className="stat-value font-mono">
                {twin.summary?.gained_cells} gained / {twin.summary?.lost_cells} lost
              </span>
              <span className="stat-subtext">{twin.summary?.stable_cells} stable cells</span>
            </div>
            <div className="corridor-stat-card">
              <span className="stat-label">Model Uncertainty Spread</span>
              <span className="stat-value font-mono">&plusmn;{twin.summary?.mean_uncertainty}</span>
              <span className="stat-subtext">|EC_Earth3P_HR &minus; MPI_ESM1_2_XR|</span>
            </div>
          </div>

          {/* Mandatory Ecological Limitation */}
          <div className="limitation-alert-card">
            <Info size={14} color="#7A7269" />
            <p>{twin.disclaimer}</p>
          </div>
        </div>
      )}

      {/* TAB 3: THE BREAK & THE FIX */}
      {activeTab === 'break_fix' && (
        <div className="corridor-tab-content">
          <div className="corridor-section-header">
            <div className="section-title-group">
              <h3 className="section-main-title">THE BREAK & THE FIX: Corridor Network</h3>
              <span className="epistemic-badge badge-simulated">simulated</span>
            </div>
            <p className="section-subtitle">
              Graphology graph identifies candidate critical bottlenecks and simulates connectivity
              restoration.
            </p>
          </div>

          {/* Simulation Result Diff Card (if simulated) */}
          {simulationResult && (
            <div className="simulation-result-box">
              <div className="sim-header">
                <ShieldCheck size={16} color="#047857" />
                <strong>Intervention Simulation Completed</strong>
                <span className="sim-node-badge font-mono">{simulationResult.target_node_id}</span>
              </div>

              <div className="sim-diff-metrics">
                <div className="diff-item">
                  <span className="diff-lbl">Reachable Suitable Area</span>
                  <div className="diff-val-group">
                    <span className="old-val font-mono">
                      {simulationResult.baseline.reachable_suitable_area_km2.toLocaleString()} km²
                    </span>
                    <ArrowRight size={13} />
                    <span className="new-val font-mono">
                      {simulationResult.result.reachable_suitable_area_km2.toLocaleString()} km²
                    </span>
                  </div>
                  <span className="diff-change positive font-mono">
                    +{simulationResult.difference.reachable_area_delta_km2.toLocaleString()} km² (+
                    {simulationResult.difference.reachable_area_percent_change}%)
                  </span>
                </div>

                <div className="diff-item">
                  <span className="diff-lbl">Network Fragmentation</span>
                  <div className="diff-val-group">
                    <span className="old-val font-mono">
                      {simulationResult.baseline.connected_components} component(s)
                    </span>
                    <ArrowRight size={13} />
                    <span className="new-val font-mono">
                      {simulationResult.result.connected_components} component(s)
                    </span>
                  </div>
                  <span className="diff-change neutral">
                    {simulationResult.difference.components_delta <= 0
                      ? 'Corridor connectivity consolidated'
                      : 'Fragmentation altered'}
                  </span>
                </div>
              </div>

              {/* Non-Negotiable Rule: Transparent Assumptions & Never Claim Animals Saved */}
              <div className="sim-assumptions-list">
                <span className="assumptions-title">Model Assumptions & Boundaries:</span>
                <ul>
                  {simulationResult.assumptions?.map((asm, idx) => (
                    <li key={idx}>{asm}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Candidate Critical Links Table */}
          <div className="critical-links-section">
            <div className="links-header-row">
              <span className="links-heading">Candidate Critical Links (Bottlenecks)</span>
              <span className="links-count">{critical_links.length} identified</span>
            </div>

            {critical_links.length === 0 ? (
              <div className="empty-links-state">
                No acute bottleneck pinch-points identified for {species.common_name || species.scientific_name} in this seasonal window.
              </div>
            ) : (
              <div className="critical-links-list">
                {critical_links.map((link) => {
                  const isProtected = protectedNodes.has(link.node_id);
                  const isSimulating = simulatingNode === link.node_id;

                  return (
                    <div key={link.node_id} className={`critical-link-card ${isProtected ? 'protected' : ''}`}>
                      <div className="link-left-info">
                        <span className="link-rank-pill">#{link.rank}</span>
                        <div>
                          <div className="link-coord-title font-mono">
                            Cell ({link.lat}°N, {link.lon}°E)
                          </div>
                          <div className="link-impact-desc">
                            Severing loss: <strong>{link.loss_of_reachable_area_km2.toLocaleString()} km²</strong> ({link.loss_percent}%) • +{link.connected_components_increase} fragments
                          </div>
                        </div>
                      </div>

                      <button
                        className={`protect-action-btn ${isProtected ? 'btn-active' : ''}`}
                        onClick={() => handleProtectClick(link.node_id)}
                        disabled={isSimulating}
                        title="Simulate protection / corridor restoration for this candidate critical link"
                      >
                        {isSimulating ? (
                          'Simulating...'
                        ) : isProtected ? (
                          <>
                            <ShieldCheck size={13} />
                            <span>Protected</span>
                          </>
                        ) : (
                          <>
                            <Sparkles size={13} />
                            <span>Protect Link</span>
                          </>
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="links-disclaimer-subtext">
              Ranked via Graphology node removal sensitivity. Candidate critical links represent potential dispersal corridors, not confirmed animal behavioral choke-points.
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: THE WATCH */}
      {activeTab === 'watch' && (() => {
        const seasonalWindow = deriveSeasonalWindow(occurrences || [], activeSeason);
        const watchEval = evaluateForecastRisk(
          species.species_id,
          weatherData?.weather,
          seasonalWindow
        );

        return (
          <div className="corridor-tab-content">
            <div className="corridor-section-header">
              <div className="section-title-group">
                <h3 className="section-main-title">THE WATCH: Synoptic Forecast Risk</h3>
                <span className="epistemic-badge badge-forecast">forecast</span>
              </div>
              <p className="section-subtitle">
                Atmospheric hazard evaluation gated strictly by species seasonal activity windows.
                Thresholds cited from ornithological literature or explicitly marked assumption.
              </p>
            </div>

            {/* Seasonal Gating Status Banner */}
            <div className={`watch-gating-banner ${seasonalWindow.isCurrentMonthActive ? 'active' : 'dormant'}`}>
              <div className="gating-left">
                <CloudSun size={18} />
                <div>
                  <div className="gating-title">
                    {seasonalWindow.isCurrentMonthActive
                      ? 'In Seasonal Migration/Breeding Window'
                      : 'Outside Active Seasonal Window (Dormant)'}
                  </div>
                  <div className="gating-desc">
                    Current UTC Month: <strong>Month {seasonalWindow.currentMonth}</strong> • Active months derived from empirical occurrences: [{seasonalWindow.activeMonths.join(', ')}].
                  </div>
                </div>
              </div>
              <span className={`gating-status-tag ${seasonalWindow.isCurrentMonthActive ? 'tag-active' : 'tag-dormant'}`}>
                {seasonalWindow.isCurrentMonthActive ? 'GATING ACTIVE' : 'RISK UNFLAGGED'}
              </span>
            </div>

            {/* Forecast Risk Summary Box */}
            <div className={`watch-summary-card ${watchEval.forecast_risk ? 'risk-flagged' : 'favorable'}`}>
              <div className="watch-summary-head">
                {watchEval.forecast_risk ? (
                  <ShieldAlert size={16} color="#DC2626" />
                ) : (
                  <ShieldCheck size={16} color="#047857" />
                )}
                <span className="watch-risk-title">
                  {watchEval.forecast_risk
                    ? `FORECAST RISK DETECTED (${watchEval.risk_level.toUpperCase()})`
                    : 'SAFE TRANSIT MARGINS'}
                </span>
              </div>
              <p className="watch-summary-text">{watchEval.summary}</p>
            </div>

            {/* Triggered Hazards (if any) */}
            {watchEval.triggered_hazards.length > 0 && (
              <div className="triggered-hazards-section">
                <div className="section-small-title">BREACHED PHYSIOLOGICAL / AERODYNAMIC THRESHOLDS</div>
                <div className="hazards-cards-list">
                  {watchEval.triggered_hazards.map((h, idx) => (
                    <div key={idx} className="hazard-breach-item">
                      <div className="hazard-top">
                        <span className="hazard-name">{h.hazard}</span>
                        <span className="hazard-meas font-mono">
                          {h.measured_value} {h.unit} (Limit: {h.threshold_value} {h.unit})
                        </span>
                      </div>
                      <div className="hazard-basis font-mono">{h.basis}</div>
                      <div className="hazard-rationale">{h.rationale}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* All Standard Cited Thresholds Reference Table */}
            <div className="watch-thresholds-table-box">
              <div className="section-small-title">CITED THRESHOLDS & ASSUMPTION INVENTORY</div>
              <div className="table-responsive">
                <table className="proof-table">
                  <thead>
                    <tr>
                      <th>Atmospheric Variable</th>
                      <th>Hazard Boundary</th>
                      <th>Authoritative Basis</th>
                      <th>Methodological Rationale</th>
                    </tr>
                  </thead>
                  <tbody>
                    {watchEval.all_thresholds.map((t, i) => (
                      <tr key={i}>
                        <td className="font-mono">{t.variable}</td>
                        <td><strong className="font-mono">{t.threshold}</strong></td>
                        <td className="src-cite font-mono">{t.basis}</td>
                        <td>{t.rationale}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* TAB 5: THE PROOF */}
      {activeTab === 'proof' && (
        <div className="corridor-tab-content">
          <div className="corridor-section-header">
            <div className="section-title-group">
              <h3 className="section-main-title">THE PROOF: Scientific Confidence Rubric</h3>
              <span className="epistemic-badge badge-observed">observed + modeled</span>
            </div>
            <p className="section-subtitle">
              4-factor rubric audit evaluating empirical sample size, multi-model spread, and trait join completeness per METHODS.md Section 6.
            </p>
          </div>

          <EvidencePanel
            species={species}
            corridorData={corridorData}
            occurrences={occurrences}
          />
        </div>
      )}
    </div>
  );
};

export default CorridorPanel;
