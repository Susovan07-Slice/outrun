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
