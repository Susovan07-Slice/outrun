/**
 * Decorative watermark behind the content pages: faint flyway arcs over a graticule, a
 * V-formation flock and one large soaring bird. Purely visual (aria-hidden), drawn in the
 * ink colour at low opacity so text on top keeps full contrast. The flock drifts slowly;
 * the drift is switched off for prefers-reduced-motion.
 */

import React from 'react';

// One soaring bird, wings raised, drawn in a 64 x 28 box.
const BIRD =
  'M1 17 C 10 11, 19 9, 27 13 C 30 7, 38 2, 54 2 C 45 5, 39 10, 36 16 C 35 18, 33 19, 31 19 L 29 22 L 27 19 C 20 16, 11 15, 1 17 Z';

// Offsets of a V formation (leader first), in bird widths.
const FLOCK = [
  [0, 0], [-1.1, 0.7], [1.1, 0.7], [-2.2, 1.4], [2.2, 1.4], [-3.3, 2.1], [3.3, 2.1], [-4.4, 2.8], [4.4, 2.8],
];

const Bird = ({ x, y, s = 1, o = 1, r = 0 }) => (
  <path d={BIRD} transform={`translate(${x} ${y}) rotate(${r}) scale(${s}) translate(-32 -14)`} opacity={o} />
);

const BirdBackdrop = ({ variant = 'flock' }) => (
  <div className={`backdrop backdrop--${variant}`} aria-hidden="true">
    <svg className="backdrop__svg" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMid slice">
      <defs>
        <radialGradient id="bd-fade" cx="70%" cy="30%" r="75%">
          <stop offset="0" stopColor="#fff" stopOpacity="1" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <mask id="bd-mask">
          <rect width="1440" height="900" fill="url(#bd-fade)" />
        </mask>
      </defs>

      {/* Graticule: a tilted globe, faint */}
      <g className="backdrop__grid" mask="url(#bd-mask)" fill="none">
        <circle cx="1060" cy="380" r="330" />
        {[-60, -30, 0, 30, 60].map((lat) => (
          <ellipse key={lat} cx="1060" cy={380 - lat * 3.6} rx={330 * Math.cos((lat * Math.PI) / 180)} ry={34 * Math.cos((lat * Math.PI) / 180)} />
        ))}
        {[0, 30, 60, 90, 120, 150].map((lon) => (
          <ellipse key={lon} cx="1060" cy="380" rx={330 * Math.abs(Math.cos((lon * Math.PI) / 180))} ry="330" />
        ))}
      </g>

      {/* Flyways: great-circle-like arcs with travelling dashes */}
      <g className="backdrop__routes" fill="none">
        <path d="M 120 760 C 420 520, 760 300, 1300 140" />
        <path d="M 40 520 C 380 420, 720 420, 1180 620" />
        <path d="M 300 880 C 520 640, 980 520, 1400 560" />
      </g>

      {/* Large soaring bird */}
      <g className="backdrop__bird">
        <Bird x={1080} y={360} s={7.2} r={-8} />
      </g>

      {/* V-formation flock, drifting */}
      <g className="backdrop__flock">
        {FLOCK.map(([dx, dy], i) => (
          <Bird key={i} x={360 + dx * 46} y={210 + dy * 40} s={0.72} o={1 - i * 0.05} r={-6} />
        ))}
      </g>
      <g className="backdrop__flock backdrop__flock--far">
        {FLOCK.slice(0, 5).map(([dx, dy], i) => (
          <Bird key={i} x={720 + dx * 30} y={640 + dy * 26} s={0.46} o={0.8} r={-10} />
        ))}
      </g>
    </svg>
  </div>
);

export default BirdBackdrop;
