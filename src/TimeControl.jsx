import React from 'react';
import { Play, Pause, ChevronUp, ChevronDown } from 'lucide-react';

const SPEED_OPTIONS = [0.5, 1, 2, 4];

const fmtDate = (epoch) =>
  epoch ? new Date(epoch * 1000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const TimeControl = ({
  isPlaying,
  onTogglePlay,
  progress = 0,
  onProgressChange,
  speed = 1,
  onSpeedChange,
  hasTracks = false,
  time,
  isOpen = true,
  onToggleOpen,
}) => {
  const pct = Math.round(progress * 1000) / 10;

  return (
    <>
      <div className={`float dock ${isOpen ? '' : 'is-collapsed'}`}>
        <div className="o-panel dock__inner">
          <button
            className={`o-play ${isPlaying && hasTracks ? 'is-playing' : ''}`}
            data-ripple
            onClick={onTogglePlay}
            disabled={!hasTracks}
            title={!hasTracks ? 'No GPS tracks for this species' : isPlaying ? 'Pause (Space)' : 'Play (Space)'}
            aria-label={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying && hasTracks ? (
              <Pause size={18} fill="currentColor" strokeWidth={0} />
            ) : (
              <Play size={18} fill="currentColor" strokeWidth={0} style={{ marginLeft: 2 }} />
            )}
          </button>

          <div className="dock__track">
            <div className="dock__meta">
              <span className="o-label">Journey progress</span>
              <span className="dock__hint">{hasTracks ? fmtDate(time) : 'No GPS tracks for this species'}</span>
              <span className="dock__value">{hasTracks ? `${Math.round(pct)}%` : '—'}</span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              value={hasTracks ? pct : 0}
              disabled={!hasTracks}
              onChange={(e) => onProgressChange(Number(e.target.value) / 100)}
              className="o-slider"
              style={{ '--fill': `${hasTracks ? pct : 0}%` }}
              aria-label="Journey progress"
            />
          </div>

          <div className="o-seg" role="radiogroup" aria-label="Playback speed">
            {SPEED_OPTIONS.map((s) => (
              <button
                key={s}
                className="o-seg__btn"
                role="radio"
                aria-checked={speed === s}
                aria-selected={speed === s}
                data-ripple
                onClick={() => onSpeedChange(s)}
                disabled={!hasTracks}
              >
                {s}×
              </button>
            ))}
          </div>

          {onToggleOpen && (
            <button
              className="o-iconbtn panel-collapse-btn dock__collapse-btn"
              data-ripple
              onClick={onToggleOpen}
              title="Hide journey controls (collapse down)"
              aria-label="Hide journey controls"
            >
              <ChevronDown size={17} />
            </button>
          )}
        </div>
      </div>

      {!isOpen && onToggleOpen && (
        <div className="dock-restore-bar">
          <button
            className="o-btn dock-restore-btn"
            data-ripple
            onClick={onToggleOpen}
            title="Show journey controls (expand up)"
            aria-label="Show journey controls"
          >
            <ChevronUp size={16} />
            <span>Journey progress</span>
            {hasTracks && <span className="dock__value">{Math.round(pct)}%</span>}
          </button>
        </div>
      )}
    </>
  );
};

export default TimeControl;
