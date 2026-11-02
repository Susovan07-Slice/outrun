/**
 * Dateline-safe path segmenter:
 * Ensures LineStrings crossing longitude 180 / -180 do not wrap across the world map.
 */
export function ensureDatelineSafeFeatures(features) {
  if (!features || features.length === 0) return [];
  const safeFeatures = [];

  for (const f of features) {
    const coords = f.geometry?.coordinates;
    const times = f.properties?.times;
    if (!coords || coords.length < 2) {
      safeFeatures.push(f);
      continue;
    }

    let hasDatelineCross = false;
    for (let i = 1; i < coords.length; i++) {
      if (Math.abs(coords[i][0] - coords[i - 1][0]) > 180) {
        hasDatelineCross = true;
        break;
      }
    }

    if (!hasDatelineCross) {
      safeFeatures.push(f);
      continue;
    }

    // Split at antimeridian
    let currentCoords = [coords[0]];
    let currentTimes = times ? [times[0]] : [];
    let segIdx = 0;

    for (let i = 1; i < coords.length; i++) {
      const prevLon = coords[i - 1][0];
      const currLon = coords[i][0];

      if (Math.abs(currLon - prevLon) > 180) {
        // Antimeridian crossing detected: push current segment
        if (currentCoords.length >= 2) {
          safeFeatures.push({
            ...f,
            id: `${f.id}_seg_${segIdx++}`,
            geometry: {
              type: 'LineString',
              coordinates: currentCoords,
            },
            properties: {
              ...f.properties,
              times: times ? currentTimes : undefined,
              point_count: currentCoords.length,
            },
          });
        }
        currentCoords = [coords[i]];
        currentTimes = times ? [times[i]] : [];
      } else {
        currentCoords.push(coords[i]);
        if (times) currentTimes.push(times[i]);
      }
    }

    if (currentCoords.length >= 2) {
      safeFeatures.push({
        ...f,
        id: `${f.id}_seg_${segIdx}`,
        geometry: {
          type: 'LineString',
          coordinates: currentCoords,
        },
        properties: {
          ...f.properties,
          times: times ? currentTimes : undefined,
          point_count: currentCoords.length,
        },
      });
    }
  }

  return safeFeatures;
}

/**
 * Longitude unwrapper: keeps each path continuous across the antimeridian by
 * shifting longitudes ±360° so consecutive fixes never jump more than 180°.
 * Pair with a repeating map view so the unwrapped segment renders on the
 * neighbouring world copy instead of being cut.
 */
export function unwrapDatelineFeatures(features) {
  if (!features || features.length === 0) return [];
  const unwrapped = features.map((f) => {
    const coords = f.geometry?.coordinates;
    if (!coords || coords.length < 2) return f;
    let offset = 0;
    let changed = false;
    const out = [coords[0]];
    for (let i = 1; i < coords.length; i++) {
      const delta = coords[i][0] - coords[i - 1][0];
      if (delta > 180) offset -= 360;
      else if (delta < -180) offset += 360;
      if (offset !== 0) changed = true;
      out.push(offset === 0 ? coords[i] : [coords[i][0] + offset, coords[i][1], ...coords[i].slice(2)]);
    }
    return changed ? { ...f, geometry: { ...f.geometry, coordinates: out } } : f;
  });

  // Shift whole tracks by ±360° so every individual sits on the same world copy
  // as the first one (keeps a Pacific flyway together instead of split at both map edges).
  const meanLon = (f) => {
    const c = f.geometry?.coordinates || [];
    return c.length ? c.reduce((sum, p) => sum + p[0], 0) / c.length : 0;
  };
  const ref = meanLon(unwrapped[0]);
  return unwrapped.map((f) => {
    const k = Math.round((ref - meanLon(f)) / 360);
    if (k === 0 || !f.geometry?.coordinates) return f;
    return {
      ...f,
      geometry: { ...f.geometry, coordinates: f.geometry.coordinates.map((p) => [p[0] + k * 360, p[1], ...p.slice(2)]) },
    };
  });
}
