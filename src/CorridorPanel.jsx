/**
 * src/CorridorPanel.jsx
 *
 * Inspector tab bodies for the analysis layers:
 * 1. RaceTab    — climate velocity (km/decade) vs AVONET HWI dispersal rank + honest verdict
 * 2. TwinTab    — baseline-vs-future envelope suitability slider with model spread
 * 3. NetworkTab — The Break (candidate critical links) & The Fix (protect + connectivity diff)
 * 4. WatchTab   — synoptic forecast risk gated by seasonal activity windows
 */

import React, { useState } from 'react';
import { ShieldAlert, ShieldCheck, Info, Sparkles, ArrowRight, CloudSun, AlertTriangle, ChevronDown } from 'lucide-react';
import { deriveRangeWindow, evaluateForecastRisk } from './analytics/watch';
import { rangeName } from './analytics/seasonCalendar';

const INSUFFICIENT = 'Insufficient evidence';
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const PLAIN_VAR = { wind_speed_10m: 'Wind', precipitation: 'Rain', temperature_2m: 'Temperature' };

export const SeasonSwitch = ({ value, onChange }) => (
  <div className="o-seg o-seg--full season-switch" role="tablist" aria-label="Seasonal range">
    {[
      ['breeding', 'Breeding · May–Aug'],
      ['non_breeding', 'Non-breeding · Nov–Feb'],
    ].map(([key, label]) => (
      <button key={key} className="o-seg__btn" role="tab" aria-selected={value === key} data-ripple onClick={() => onChange(key)}>
        {label}
      </button>
    ))}
  </div>
);

// Figures (e.g. "235 km/decade", "#17 of 20", "+1.4°C") get the figure face; words stay in the UI face.
export const isFigure = (v) => typeof v === 'number' || (typeof v === 'string' && /^[\s+\-−–#±~]*\d/.test(v));

const Stat = ({ label, value, sub, accent }) => (
  <div className={`o-stat ${accent ? 'o-stat--accent' : ''}`}>
    <span className="o-stat__label">{label}</span>
    <span className={`o-stat__value ${isFigure(value) ? 'is-figure' : ''}`}>{value ?? INSUFFICIENT}</span>
    {sub && <span className="o-stat__sub">{sub}</span>}
  </div>
);

// Shown wherever a figure comes from Outrun's demo climate data rather than ERA5/CMIP6.
export const DemoClimateNote = () => (
  <p className="demo-note">Demo climate data: these temperatures and speeds are placeholders, not ERA5 or CMIP6 output yet.</p>
);

const SectionHead = ({ title, badge, lead }) => (
  <div className="sec">
    <div className="sec__head">
      <h3 className="sec__title">{title}</h3>
      <span className={`o-badge o-badge--${badge}`}>{badge}</span>
    </div>
    {lead && <p className="sec__lead">{lead}</p>}
  </div>
);

// Plain-language reading of the velocity-vs-dispersal verdict.
export function plainRaceVerdict(verdict = '') {
  if (/deficit/i.test(verdict)) return { title: 'Climate is moving faster than it can follow', tone: 'danger' };
  if (/marginal/i.test(verdict)) return { title: 'May struggle to keep pace with the climate', tone: 'warn' };
  if (/outpace/i.test(verdict)) return { title: 'Can likely keep pace with the climate', tone: 'ok' };
  return { title: verdict || INSUFFICIENT, tone: 'warn' };
}

export const RaceTab = ({ race }) => {
  if (!race) return <div className="empty-note">{INSUFFICIENT} for climate velocity.</div>;
  const kmd = (v) => (v != null ? `${v} km/decade` : null);
  const verdict = plainRaceVerdict(race.verdict);
  return (
    <>
      <SectionHead
        title="Can it keep up with climate change?"
        badge="simulated"
        lead="How fast suitable climate is shifting across its range, compared with how well this bird is built for long flights."
      />
      <DemoClimateNote />
      <div className={`note note--${verdict.tone}`}>
        <ShieldAlert size={16} />
        <div><strong>{verdict.title}</strong></div>
      </div>
      <div className="stat-grid">
        <Stat label="Climate shift speed" value={kmd(race.mean_velocity_km_decade)} sub="Average across its range" accent />
        <Stat
          label="Flight ability rank"
          value={race.hwi_rank != null ? `#${race.hwi_rank} of ${race.hwi_rank_total}` : null}
          sub={race.hwi != null ? `Wing shape score ${race.hwi} (higher flies farther)` : 'No wing record'}
        />
        <Stat label="Breeding range" value={kmd(race.breeding_velocity_km_decade)} sub="Summer" />
        <Stat label="Wintering range" value={kmd(race.non_breeding_velocity_km_decade)} sub="Winter" />
      </div>
      <p className="cite">Wing shape shows flight ability, not a speed, so this is a comparison rather than a prediction. Method: Loarie et al. 2009.</p>
    </>
  );
};

export const TwinTab = ({ twin, twinSlider, onChangeTwinSlider, activeSeason, onChangeSeason }) => {
  const pct = Math.round(twinSlider * 100);
  const env = twin?.envelope;
  const sum = twin?.summary;
  const of = sum?.total_cells ? ` of ${sum.total_cells} areas` : '';
  return (
    <>
      <SectionHead
        title="Where the climate suits it"
        badge="simulated"
        lead="Coloured areas on the map show how well the climate suits this species. Move the slider to see 2050."
      />
      <DemoClimateNote />
      <SeasonSwitch value={activeSeason} onChange={onChangeSeason} />
      {!twin ? (
        <div className="empty-note">{INSUFFICIENT} for this season.</div>
      ) : (
        <>
          <div className="horizon">
            <div className="horizon__labels">
              <span className={twinSlider <= 0.2 ? 'is-on' : ''}><strong>Today</strong>2005–2024</span>
              <span className={twinSlider >= 0.8 ? 'is-on' : ''} style={{ textAlign: 'right' }}><strong>2050</strong>climate models</span>
            </div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.01"
              value={twinSlider}
              onChange={(e) => onChangeTwinSlider(parseFloat(e.target.value))}
              className="o-slider"
              style={{ '--fill': `${pct}%` }}
              aria-label="Projection horizon"
            />
            <div className="o-seg" style={{ alignSelf: 'center' }}>
              {[
                [0, 'Today'],
                [0.5, '2037'],
                [1, '2050'],
              ].map(([v, label]) => (
                <button key={v} className="o-seg__btn" aria-selected={twinSlider === v} data-ripple onClick={() => onChangeTwinSlider(v)}>
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="stat-grid">
            <Stat
              label="Temperatures it lives in"
              value={env ? `${env.p05}–${env.p95}°C` : null}
              sub={env ? `Typical ${env.p50}°C today` : 'No climate data for this range'}
            />
            <Stat
              label="Typical in 2050"
              value={env?.future_p50 != null ? `${env.future_p50}°C` : null}
              sub={env?.future_p50 != null ? `${env.future_p50 >= env.p50 ? '+' : ''}${(env.future_p50 - env.p50).toFixed(1)}°C warmer` : ''}
              accent
            />
            <Stat label="Suitable today" value={sum ? `${sum.baseline_suitable_cells}${of}` : null} />
            <Stat label="Suitable in 2050" value={sum ? `${sum.future_suitable_cells}${of}` : null} accent />
            <Stat label="Lost by 2050" value={sum ? `${sum.lost_cells} areas` : null} sub={sum ? `${sum.gained_cells} gained` : ''} />
            <Stat label="Model disagreement" value={sum?.mean_uncertainty != null ? `±${sum.mean_uncertainty}` : null} sub="Between two climate models" />
          </div>

          <p className="cite">Climate only: land cover, food and human impacts are not modelled.</p>
        </>
      )}
    </>
  );
};

// Reachable habitat as a share of the whole flyway, e.g. "12% of flyway".
const flywayShare = (m) =>
  m.total_suitable_area_km2 > 0
    ? `${Math.round((m.reachable_suitable_area_km2 / m.total_suitable_area_km2) * 100)}% of flyway`
    : `${m.reachable_suitable_area_km2.toLocaleString()} km²`;

export const NetworkTab = ({ species, criticalLinks = [], protectedNodes, onSimulateProtect, simulationResult, activeSeason, onChangeSeason }) => {
  const [busy, setBusy] = useState(null);
  const protect = async (id) => {
    setBusy(id);
    if (onSimulateProtect) await onSimulateProtect(id);
    setBusy(null);
  };

  return (
    <>
      <SectionHead
        title="Key stopovers"
        badge="simulated"
        lead="Red rings on the map are stopovers whose loss would cut off the most habitat. Tap Protect on one or more to see what saving them does; tap again to undo."
      />
      <SeasonSwitch value={activeSeason} onChange={onChangeSeason} />

      {simulationResult && (
        <div className="note note--ok" style={{ flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <ShieldCheck size={16} />
            <strong>
              {simulationResult.difference.protected_count} of {criticalLinks.length} stopover{criticalLinks.length === 1 ? '' : 's'} protected
            </strong>
            <span className="o-badge o-badge--simulated" style={{ marginLeft: 'auto' }}>simulated</span>
          </div>
          <div className="diff">
            <div className="diff__row">
              <span className="o-label">Habitat birds can reach: all stopovers lost → with these protected</span>
              <div className="diff__vals">
                <span className="old">{flywayShare(simulationResult.baseline)}</span>
                <ArrowRight size={13} />
                <span className="new">{flywayShare(simulationResult.result)}</span>
              </div>
              <span className="diff__delta">
                +{simulationResult.difference.reachable_area_delta_km2.toLocaleString()} km² reachable again
              </span>
            </div>
            <div className="diff__row">
              <span className="o-label">Separate pieces of the flyway</span>
              <div className="diff__vals">
                <span className="old">{simulationResult.baseline.connected_components}</span>
                <ArrowRight size={13} />
                <span className="new">{simulationResult.result.connected_components}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="sec">
        <div className="sec__head">
          <span className="o-label">Most important stopovers</span>
          <span className="o-species__meta">{criticalLinks.length}</span>
        </div>
        {criticalLinks.length === 0 ? (
          <div className="note"><Info size={15} /><div>No acute bottlenecks found for {species?.common_name || species?.scientific_name} in this season.</div></div>
        ) : (
          <div className="link-list">
            {criticalLinks.map((link) => {
              const isProt = protectedNodes.has(link.node_id);
              return (
                <div key={link.node_id} className={`link-card ${isProt ? 'is-protected' : ''}`}>
                  <span className="link-rank">{link.rank}</span>
                  <div className="link-info">
                    <b>{link.name || link.label || `${link.lat}°, ${link.lon}°`}</b>
                    <span>If lost: −{link.loss_percent}% of reachable habitat ({link.loss_of_reachable_area_km2.toLocaleString()} km²)</span>
                  </div>
                  <button
                    className={`o-btn o-btn--sm ${isProt ? 'is-protected' : ''}`}
                    data-ripple
                    aria-pressed={isProt}
                    onClick={() => protect(link.node_id)}
                    disabled={busy === link.node_id}
                  >
                    {busy === link.node_id ? 'Running…' : isProt ? <><ShieldCheck size={14} />Protected</> : <><Sparkles size={14} />Protect</>}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <p className="cite">Network model estimate: likely stopovers, not confirmed by tracking.</p>
      </div>
    </>
  );
};

// One current reading against its cited limit; the bar fills toward the limit and turns red past it.
const Reading = ({ label, value, unit, limit, min = 0, limitText }) => {
  const has = value != null && Number.isFinite(Number(value));
  const v = Number(value);
  const frac = has ? Math.max(0, Math.min(1, (v - min) / (limit - min))) : 0;
  const breached = has && v > limit;
  return (
    <div className={`reading ${breached ? 'is-breached' : ''}`}>
      <div className="reading__top">
        <span className="o-stat__label">{label}</span>
        <span className="reading__value">{has ? `${v}${unit}` : '–'}</span>
      </div>
      <div className="reading__bar"><span style={{ width: `${frac * 100}%` }} /></div>
      <span className="reading__limit">{limitText}</span>
    </div>
  );
};

const SOURCE_TEXT = { live: 'Open-Meteo (live)', cache: 'Open-Meteo (cached ≤30 min)', fallback: 'Open-Meteo (last saved reading)' };
const PLACE_TEXT = { breeding: 'in its breeding range', non_breeding: 'in its wintering range', migrating: 'on migration' };

export const WatchTab = ({ species, calendar, activeSeason, onChangeSeason, weatherData, onFetchWeather, loadingWeather }) => {
  if (!calendar) return <div className="loading-block"><div className="spinner" />Working out where it is this month…</div>;

  const seasonalWindow = deriveRangeWindow(calendar.months, activeSeason);
  const watch = evaluateForecastRisk(species.species_id, weatherData?.weather, seasonalWindow);
  const active = seasonalWindow.isCurrentMonthActive;
  const month = MONTHS[seasonalWindow.currentMonth - 1];
  const here = rangeName(activeSeason);
  const now = seasonalWindow.currentPlace;
  const otherSeason = activeSeason === 'breeding' ? 'non_breeding' : 'breeding';
  const basis = seasonalWindow.source === 'tracks' ? 'From GPS tracks logged in ' + month + '.' : 'From its usual seasonal cycle.';

  return (
    <>
      <SectionHead
        title="Weather risk today"
        badge="forecast"
        lead="Current weather where this species lives, checked against safe limits for migrating birds."
      />
      <SeasonSwitch value={activeSeason} onChange={onChangeSeason} />
      <div className={`note ${active ? '' : 'note--warn'}`}>
        <CloudSun size={16} />
        <div>
          {active ? (
            <strong>{now === 'migrating' ? `On migration in ${month}, arriving at or leaving its ${here}.` : `Here now: it is usually in its ${here} in ${month}.`}</strong>
          ) : (
            <strong>Usually not seen in its {here} in {month}, so today's weather here matters less.</strong>
          )}
          <div className="cite" style={{ marginTop: 2 }}>
            {!active && now && now !== 'migrating' && `It is ${PLACE_TEXT[now]} now. `}
            {basis}
          </div>
          {!active && now === otherSeason && (
            <button className="o-btn o-btn--sm" data-ripple style={{ marginTop: 8 }} onClick={() => onChangeSeason(otherSeason)}>
              Check its {rangeName(otherSeason)} <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {weatherData?.weather ? (
        <div className="sec">
          <div className="sec__head">
            <span className="o-label">Current conditions</span>
            <button className="o-btn o-btn--ghost o-btn--sm" data-ripple onClick={onFetchWeather} disabled={loadingWeather}>
              {loadingWeather ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
          <div className="reading-grid">
            <Reading label="Wind 10 m" value={weatherData.weather.wind_speed_10m} unit=" km/h" limit={54} limitText="limit 54 km/h" />
            <Reading label="Precipitation" value={weatherData.weather.precipitation} unit=" mm/h" limit={5} limitText="limit 5 mm/h" />
            <Reading label="Heat" value={weatherData.weather.temperature_2m} unit="°C" min={-20} limit={38} limitText="safe −20 to 38°C" />
            <Reading label="Humidity" value={weatherData.weather.relative_humidity_2m} unit="%" limit={100} limitText="context only" />
          </div>
          <p className="cite">
            {weatherData.place} · {SOURCE_TEXT[weatherData.source] || weatherData.source || 'Open-Meteo'}
            {weatherData.retrieved_at ? ` · ${new Date(weatherData.retrieved_at).toLocaleString()}` : ''}
          </p>
        </div>
      ) : loadingWeather ? (
        <div className="loading-block"><div className="spinner" />Querying Open-Meteo for current conditions…</div>
      ) : (
        <>
          {weatherData?.error && <div className="note note--warn"><AlertTriangle size={16} /><div>{weatherData.error}. Insufficient evidence to evaluate risk.</div></div>}
          <button className="o-btn o-btn--primary" data-ripple onClick={onFetchWeather}>
            <CloudSun size={16} />
            Load current conditions
          </button>
        </>
      )}

      {weatherData?.weather && (
        active ? (
          <div className={`note ${watch.forecast_risk ? 'note--danger' : 'note--ok'}`}>
            {watch.forecast_risk ? <AlertTriangle size={16} /> : <ShieldCheck size={16} />}
            <div>
              <strong>{watch.forecast_risk ? `Dangerous for migrating birds (${watch.risk_level})` : 'Safe for migrating birds right now'}</strong>
              <div style={{ marginTop: 4 }}>{watch.summary}</div>
            </div>
          </div>
        ) : (
          <div className="note">
            <Info size={16} />
            <div>{watch.summary}</div>
          </div>
        )
      )}

      <details className="proof__more">
        <summary>Where the limits come from <ChevronDown size={14} /></summary>
        <ul className="proof__sources">
          {watch.all_thresholds.map((t, i) => (
            <li key={i}>
              <strong>{PLAIN_VAR[t.variable] || t.variable}</strong> · {t.threshold}
              <div className="cite">{t.basis.replace(/^cited:\s*/i, '')}</div>
            </li>
          ))}
        </ul>
      </details>
    </>
  );
};
