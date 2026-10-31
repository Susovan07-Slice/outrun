import React from 'react';
import { X, Layers } from 'lucide-react';

const Legend = ({ onClose }) => {
  return (
    <div className="legend-atlas-card">
      <div className="legend-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <Layers size={14} color="#2A6F7D" />
          <span className="legend-title">Universal Epistemic Labels (Rule 3)</span>
        </div>
        {onClose && (
          <button className="legend-close-btn" onClick={onClose} aria-label="Close legend">
            <X size={14} />
          </button>
        )}
      </div>

      <div className="legend-items-list">
        <div className="legend-item-row">
          <div className="legend-dot dot-observed" />
          <div className="legend-content">
            <div className="legend-label-name">observed</div>
            <div className="legend-desc">
              Empirical occurrence records (GBIF human observations) & verified telemetry track positions.
            </div>
          </div>
        </div>

        <div className="legend-item-row">
          <div className="legend-dot dot-forecast" />
          <div className="legend-content">
            <div className="legend-label-name">current conditions (forecast)</div>
            <div className="legend-desc">
              Real-time & synoptic atmospheric predictions from Open-Meteo numerical weather models.
            </div>
          </div>
        </div>

        <div className="legend-item-row">
          <div className="legend-dot dot-projected" />
          <div className="legend-content">
            <div className="legend-label-name">projected</div>
            <div className="legend-desc">
              Medium- to long-term climate scenario projections (CMIP6 / shared socioeconomic pathways).
            </div>
          </div>
        </div>

        <div className="legend-item-row">
          <div className="legend-dot dot-simulated" />
          <div className="legend-content">
            <div className="legend-label-name">simulated</div>
            <div className="legend-desc">
              Flyway corridor connectivity simulations, cost-distance surfaces, and digital twins.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Legend;
