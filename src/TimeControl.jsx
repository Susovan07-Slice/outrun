import React, { useState } from 'react';
import { Play, Pause, Calendar, Route } from 'lucide-react';

const SPEED_OPTIONS = [0.5, 1, 2, 4];
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const TimeControl = ({
  isPlaying,
  onTogglePlay,
  progress = 0,
  onProgressChange,
  speed = 1,
  onSpeedChange,
  hasTracks = false,
  selectedSpeciesName = '',
  timeMode: controlledTimeMode,
  onTimeModeChange,
}) => {
  const [internalTimeMode, setInternalTimeMode] = useState('progress');
  const timeMode = controlledTimeMode !== undefined ? controlledTimeMode : internalTimeMode;
  const setTimeMode = onTimeModeChange || setInternalTimeMode;

  const percentage = Math.round(progress * 100);
  const currentMonthIdx = Math.min(11, Math.floor(progress * 12));
  const currentMonthName = MONTH_NAMES[currentMonthIdx];
  const dayOfYear = Math.min(365, Math.floor(progress * 365) + 1);

  return (
    <div className="timeline-container">
      <div className="timeline-card">
        {/* Play/Pause Button */}
        <button
          className="play-pause-btn"
          onClick={onTogglePlay}
          disabled={!hasTracks}
          title={!hasTracks ? 'No tracking telemetry for this taxon' : isPlaying ? 'Pause' : 'Play'}
          aria-label={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={18} fill="#FFFFFF" color="#FFFFFF" />
          ) : (
            <Play size={18} fill="#FFFFFF" color="#FFFFFF" style={{ marginLeft: '2px' }} />
          )}
        </button>

        {/* Progress / Calendar Section */}
        <div className="timeline-scrubber-section">
          <div className="timeline-header-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="timeline-title">
                {timeMode === 'annual_cycle' ? 'ANNUAL CYCLE (CALENDAR)' : 'JOURNEY PROGRESS'}
              </span>
              <button
                type="button"
                onClick={() => setTimeMode(timeMode === 'progress' ? 'annual_cycle' : 'progress')}
                disabled={!hasTracks}
                title="Toggle between Normalized Journey Progress and Calendar Annual Cycle animation"
                style={{
                  background: timeMode === 'annual_cycle' ? '#2A6F7D' : '#E5E7EB',
                  color: timeMode === 'annual_cycle' ? '#FFFFFF' : '#374151',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '2px 8px',
                  fontSize: '10px',
                  fontWeight: 600,
                  cursor: hasTracks ? 'pointer' : 'not-allowed',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {timeMode === 'annual_cycle' ? <Calendar size={11} /> : <Route size={11} />}
                <span>{timeMode === 'annual_cycle' ? 'Calendar Mode' : 'Journey Mode'}</span>
              </button>
            </div>
            <span className="timeline-percentage" style={{ fontWeight: 600, color: '#2A6F7D' }}>
              {hasTracks
                ? timeMode === 'annual_cycle'
                  ? `${currentMonthName} (Day ${dayOfYear})`
                  : `${percentage}%`
                : 'N/A'}
            </span>
          </div>

          <div className="scrubber-bar-wrapper">
            <input
              type="range"
              min="0"
              max="100"
              step="0.5"
              value={hasTracks ? percentage : 0}
              disabled={!hasTracks}
              onChange={(e) => onProgressChange(Number(e.target.value) / 100)}
              className="timeline-range-slider"
              aria-label={timeMode === 'annual_cycle' ? 'Annual calendar cycle scrubber' : 'Normalized journey progress scrubber'}
            />
          </div>
        </div>

        {/* Speed Controls */}
        <div className="speed-pills-row">
          {SPEED_OPTIONS.map((s) => (
            <button
              key={s}
              className={`speed-pill ${speed === s ? 'active' : ''}`}
              onClick={() => onSpeedChange(s)}
              disabled={!hasTracks}
            >
              {s}×
            </button>
          ))}
        </div>
      </div>

      {/* Explanatory Atlas Caption */}
      <div className="timeline-caption">
        {hasTracks ? (
          <span>
            Drag to pan • scroll or use the buttons to zoom • click any path to inspect it. The timeline is a
            normalised <em>journey progress</em>, not a calendar — each individual bird advances along its own recorded route.
          </span>
        ) : (
          <span style={{ color: '#8C7853' }}>
            <strong>Empirical occurrences only:</strong> No verified timestamped GPS telemetry tracks available for{' '}
            <em>{selectedSpeciesName || 'this species'}</em> in public archives. Displaying verified occurrence records;
            journey timeline disabled per Rule 1 & Rule 4.
          </span>
        )}
      </div>
    </div>
  );
};

export default TimeControl;
