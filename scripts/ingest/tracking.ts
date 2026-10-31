import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { fetchDatasetMetadata, sleep } from './gbif.js';
import { DatasetMetadata } from './types.js';

export interface TrackingDataset {
  datasetKey: string;
  title: string;
  doi: string | null;
  citation: string;
  license: string;
  accepted: boolean;
  skip_reason?: string;
}

export interface TrackPoint {
  id: number;
  species: string;
  coord: [number, number]; // [lon, lat]
  timestamp: number; // Unix seconds
}

export interface TrackFeature {
  type: 'Feature';
  id: string | number;
  geometry: {
    type: 'LineString';
    coordinates: [number, number][];
  };
  properties: {
    species: string;
    times: number[];
    point_count: number;
    dataset_key: string;
    dataset_title: string;
    dataset_doi?: string;
    license: string;
  };
}

export interface TrackFeatureCollection {
  type: 'FeatureCollection';
  species_id: string;
  scientific_name: string;
  evidence_level: 'tracks' | 'occurrences_only';
  individual_count: number;
  total_points: number;
  dataset: {
    key: string;
    title: string;
    citation: string;
    license: string;
    doi?: string;
  };
  features: TrackFeature[];
}

/**
 * Licence evaluation policy:
 * Accepts open research licences: CC0, CC-BY, CC-BY-NC.
 * Strictly rejects datasets with NoDerivatives (ND), in-copyright, proprietary, or missing/unspecified licences.
 */
export function evaluateDatasetLicense(license: string | null | undefined): { permitted: boolean; reason?: string } {
  if (!license || license.trim() === '' || license === 'Unspecified') {
    return { permitted: false, reason: 'Missing or unspecified license' };
  }
  if (/nd|no-derivatives|in-copyright|all-rights-reserved|proprietary/i.test(license)) {
    return { permitted: false, reason: `NoDerivatives (ND) or restrictive terms not permitted: ${license}` };
  }
  if (/cc0|zero|publicdomain|by-nc|by/i.test(license)) {
    return { permitted: true };
  }
  return { permitted: false, reason: `Unrecognized or non-open license: ${license}` };
}

/**
 * Dateline-safe antimeridian handler:
 * Detects longitude jumps across 180 / -180 and splits path into discrete LineString segments
 * preventing line wrap-around across the globe.
 */
export function splitDatelineCoordinates(
  coordinates: [number, number][],
  times?: number[]
): Array<{ coordinates: [number, number][]; times?: number[] }> {
  if (coordinates.length < 2) {
    return [{ coordinates, times }];
  }

  const segments: Array<{ coordinates: [number, number][]; times?: number[] }> = [];
  let currentSegment: [number, number][] = [coordinates[0]];
  let currentTimes: number[] = times ? [times[0]] : [];

  for (let i = 1; i < coordinates.length; i++) {
    const prevLon = coordinates[i - 1][0];
    const currLon = coordinates[i][0];

    // Crossing antimeridian: jump greater than 180 degrees in longitude
    if (Math.abs(currLon - prevLon) > 180) {
      segments.push({
        coordinates: currentSegment,
        times: times ? currentTimes : undefined,
      });
      currentSegment = [coordinates[i]];
      currentTimes = times ? [times[i]] : [];
    } else {
      currentSegment.push(coordinates[i]);
      if (times) currentTimes.push(times[i]);
    }
  }

  if (currentSegment.length > 0) {
    segments.push({
      coordinates: currentSegment,
      times: times ? currentTimes : undefined,
    });
  }

  return segments;
}

/**
 * Sensitive locations rule:
 * For ALL raptors, storks, cranes, harriers, owls and rails:
 * Breeding season fixes (May to July) near nesting territory
 * are coarsened to 0.1 degrees (~11 km) to prevent exposing nest sites.
 */
export function isSensitiveBreedingTaxon(
  scientificName: string,
  family?: string | null
): boolean {
  const sensitiveFamilies = [
    'pandionidae',
    'accipitridae',
    'falconidae',
    'ciconiidae',
    'gruidae',
    'strigidae',
    'tytonidae',
    'rallidae',
  ];
  if (family && sensitiveFamilies.includes(family.toLowerCase())) {
    return true;
  }
  const nameLower = scientificName.toLowerCase();
  const sensitiveNames = [
    'pandion haliaetus',
    'ciconia ciconia',
    'ciconia nigra',
    'grus grus',
    'circus pygargus',
    'circus aeruginosus',
    'circus cyaneus',
    'falco amurensis',
    'asio flammeus',
    'asio otus',
    'crex crex',
  ];
  return sensitiveNames.some((n) => nameLower.includes(n));
}

export function coarsenCoordinatesAt01(coord: number): number {
  return Math.round(coord * 10) / 10;
}

export function applySensitiveLocationCoarsening(
  coords: [number, number][],
  times: number[],
  isSensitive: boolean
): [number, number][] {
  if (!isSensitive) return coords;

  return coords.map((pt, idx) => {
    const t = times[idx];
    if (t) {
      const date = new Date(t > 1e11 ? t : t * 1000);
      const month = date.getUTCMonth() + 1; // 1..12
      // Breeding season: May, June, July (months 5, 6, 7)
      if (month >= 5 && month <= 7) {
        return [coarsenCoordinatesAt01(pt[0]), coarsenCoordinatesAt01(pt[1])];
      }
    }
    return pt;
  });
}

// 1. Ramer-Douglas-Peucker (RDP) Trajectory Simplification
function getPerpendicularDistance(
  pt: [number, number],
  lineStart: [number, number],
  lineEnd: [number, number]
): number {
  const [x, y] = pt;
  const [x1, y1] = lineStart;
  const [x2, y2] = lineEnd;

  const dx = x2 - x1;
  const dy = y2 - y1;

  if (dx === 0 && dy === 0) {
    return Math.hypot(x - x1, y - y1);
  }

  const num = Math.abs(dy * x - dx * y + x2 * y1 - y2 * x1);
  const den = Math.hypot(dx, dy);
  return num / den;
}

export function simplifyTrajectory(
  coords: [number, number][],
  times: number[],
  tolerance: number = 0.02 // ~2.2 km tolerance in decimal degrees
): { coords: [number, number][]; times: number[] } {
  if (coords.length <= 2) {
    return { coords, times };
  }

  let maxDist = 0;
  let maxIdx = 0;

  for (let i = 1; i < coords.length - 1; i++) {
    const dist = getPerpendicularDistance(coords[i], coords[0], coords[coords.length - 1]);
    if (dist > maxDist) {
      maxDist = dist;
      maxIdx = i;
    }
  }

  if (maxDist > tolerance) {
    const left = simplifyTrajectory(
      coords.slice(0, maxIdx + 1),
      times.slice(0, maxIdx + 1),
      tolerance
    );
    const right = simplifyTrajectory(
      coords.slice(maxIdx),
      times.slice(maxIdx),
      tolerance
    );

    return {
      coords: left.coords.slice(0, -1).concat(right.coords),
      times: left.times.slice(0, -1).concat(right.times),
    };
  } else {
    return {
      coords: [coords[0], coords[coords.length - 1]],
      times: [times[0], times[times.length - 1]],
    };
  }
}

// 2. Discover GPS Tracking Datasets on GBIF
export async function discoverTrackingDatasets(): Promise<{
  accepted: TrackingDataset[];
  skipped: TrackingDataset[];
}> {
  console.log('\n[Phase 2] Discovering GPS-tracking datasets on GBIF API...');
  const keywords = ['GPS tracking', 'telemetry bird', 'migration tracking'];
  const discoveredMap = new Map<string, TrackingDataset>();

  // Always include canonical primary tracking dataset 712dba38-74cc-4704-87c0-63d1bf8484bc
  const primaryMeta = await fetchDatasetMetadata('712dba38-74cc-4704-87c0-63d1bf8484bc');
  discoveredMap.set('712dba38-74cc-4704-87c0-63d1bf8484bc', {
    datasetKey: '712dba38-74cc-4704-87c0-63d1bf8484bc',
    title: primaryMeta.title,
    doi: '10.15468/vnwmrx',
    citation: primaryMeta.citation,
    license: 'http://creativecommons.org/licenses/by-nc/4.0/legalcode',
    accepted: true,
  });

  for (const kw of keywords) {
    try {
      await sleep(200);
      const url = `https://api.gbif.org/v1/dataset/search?q=${encodeURIComponent(kw)}&type=OCCURRENCE&limit=20`;
      const res = await fetch(url, { headers: { 'User-Agent': 'Outrun/1.0 (Research)' } });
      if (!res.ok) continue;
      const data: any = await res.json();

      for (const d of data.results || []) {
        const key = d.key;
        if (!discoveredMap.has(key)) {
          const lic = d.license || 'Unspecified';
          let accepted = false;
          let skipReason = undefined;

          // Permitted licenses: CC-BY, CC0, CC-BY-NC
          if (!(/cc0|zero|by|by-nc/i.test(lic) && !/nd|in-copyright|reserved/i.test(lic))) {
            accepted = false;
            skipReason = `Restrictive or non-open licence: ${lic}`;
          } else {
            // Verify dataset contains records for Class Aves (taxonKey = 212)
            try {
              const checkUrl = `https://api.gbif.org/v1/occurrence/search?datasetKey=${key}&taxonKey=212&limit=0`;
              const checkRes = await fetch(checkUrl, { headers: { 'User-Agent': 'Outrun/1.0 (Research)' } });
              if (checkRes.ok) {
                const checkData: any = await checkRes.json();
                if ((checkData.count || 0) === 0) {
                  accepted = false;
                  skipReason = 'Non-Aves dataset: 0 class Aves records on GBIF';
                } else {
                  accepted = true;
                }
              } else {
                accepted = true;
              }
            } catch {
              accepted = true;
            }
          }

          discoveredMap.set(key, {
            datasetKey: key,
            title: d.title || 'Untitled Dataset',
            doi: d.doi || null,
            citation: d.citation?.text || d.title || 'GBIF Telemetry Dataset',
            license: lic,
            accepted,
            skip_reason: skipReason,
          });
        }
      }
    } catch (err: any) {
      console.warn(`[GBIF Dataset Search] Error querying keyword "${kw}": ${err.message}`);
    }
  }

  const all = Array.from(discoveredMap.values());
  const accepted = all.filter((d) => d.accepted);
  const skipped = all.filter((d) => !d.accepted);

  console.log(`Discovered ${all.length} tracking datasets: ${accepted.length} accepted (verified Aves), ${skipped.length} skipped.`);
  return { accepted, skipped };
}

// 3. Process Tracking Points for Seed Species
export async function processSpeciesTracks(): Promise<{
  trackedSpeciesReport: Array<{
    species: string;
    species_id: string;
    individuals: number;
    points: number;
    evidence_level: 'tracks' | 'occurrences_only';
  }>;
  discoveredDatasets: { accepted: TrackingDataset[]; skipped: TrackingDataset[] };
}> {
  const discovered = await discoverTrackingDatasets();

  // Primary dataset metadata
  const primaryDataset = discovered.accepted.find(
    (d) => d.datasetKey === '712dba38-74cc-4704-87c0-63d1bf8484bc'
  )!;

  const tracksDir = path.resolve('data', 'generated', 'tracks');
  const publicTracksDir = path.resolve('public', 'data', 'generated', 'tracks');
  fs.mkdirSync(tracksDir, { recursive: true });
  fs.mkdirSync(publicTracksDir, { recursive: true });

  // Read seed species
  const registryPath = path.resolve('data', 'generated', 'registry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  const speciesList = registry.species || [];

  // Read CSV tracking data
  const csvPath = path.resolve('scratch', 'bird-tracking', 'data', 'clean_bird_migration.csv');
  const trackedPointsBySpecies = new Map<string, TrackPoint[]>();

  if (fs.existsSync(csvPath)) {
    console.log(`[Phase 2] Parsing telemetry tracking points from ${csvPath}...`);
    const csvContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = csvContent.split(/\r?\n/);
    const header = lines[0].split(',');

    const idIdx = header.indexOf('occurrenceID');
    const spIdx = header.indexOf('species');
    const latIdx = header.indexOf('latitude');
    const lonIdx = header.indexOf('longitude');
    const dateIdx = header.indexOf('date');

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (!line) continue;
      const cols = line.split(',');
      if (cols.length < 7) continue;

      const sp = cols[spIdx]?.trim();
      const lat = parseFloat(cols[latIdx]);
      const lon = parseFloat(cols[lonIdx]);
      const dateStr = cols[dateIdx]?.trim();
      const occId = parseInt(cols[idIdx], 10);

      // Quality filter: valid coordinates
      if (isNaN(lat) || isNaN(lon) || lat < -90 || lat > 90 || lon < -180 || lon > 180) {
        continue;
      }

      if (!dateStr) continue;
      const ts = Math.floor(new Date(dateStr).getTime() / 1000);
      if (isNaN(ts) || ts <= 0) continue;

      if (!trackedPointsBySpecies.has(sp)) {
        trackedPointsBySpecies.set(sp, []);
      }

      trackedPointsBySpecies.get(sp)!.push({
        id: isNaN(occId) ? i : occId,
        species: sp,
        coord: [lon, lat],
        timestamp: ts,
      });
    }
  }

  const report: Array<{
    species: string;
    species_id: string;
    individuals: number;
    points: number;
    evidence_level: 'tracks' | 'occurrences_only';
  }> = [];

  // Group and generate per-species GeoJSON files
  for (const s of speciesList) {
    const rawPoints = trackedPointsBySpecies.get(s.scientific_name) || [];

    if (rawPoints.length === 0) {
      // Species has no GPS tracking data -> "occurrences_only"
      s.evidence_level = 'occurrences_only';

      // Write empty feature collection for demand loading
      const emptyGeoJson: TrackFeatureCollection = {
        type: 'FeatureCollection',
        species_id: s.species_id,
        scientific_name: s.scientific_name,
        evidence_level: 'occurrences_only',
        individual_count: 0,
        total_points: 0,
        dataset: {
          key: primaryDataset.datasetKey,
          title: primaryDataset.title,
          citation: primaryDataset.citation,
          license: primaryDataset.license,
          doi: primaryDataset.doi || undefined,
        },
        features: [],
      };

      const outPath = path.join(tracksDir, `${s.species_id}.geojson`);
      fs.writeFileSync(outPath, JSON.stringify(emptyGeoJson, null, 2), 'utf-8');
      fs.copyFileSync(outPath, path.join(publicTracksDir, `${s.species_id}.geojson`));

      report.push({
        species: s.scientific_name,
        species_id: s.species_id,
        individuals: 0,
        points: 0,
        evidence_level: 'occurrences_only',
      });
      continue;
    }

    // Sort by occurrenceID sequence: consecutive occurrenceIDs represent one continuous bird deployment
    rawPoints.sort((a, b) => a.id - b.id);

    // Group into individuals by consecutive occurrenceID sequence and single calendar year
    const rawBirdGroups: Array<{
      id: string;
      points: Array<{ coord: [number, number]; timestamp: number }>;
    }> = [];

    let currentGroup: { id: string; points: Array<{ coord: [number, number]; timestamp: number }> } | null = null;
    let prevId = -1;
    let birdIndex = 0;

    for (const pt of rawPoints) {
      const year = new Date(pt.timestamp * 1000).getFullYear();
      const firstYear =
        currentGroup && currentGroup.points.length > 0
          ? new Date(currentGroup.points[0].timestamp * 1000).getFullYear()
          : null;

      if (currentGroup && pt.id === prevId + 1 && year === firstYear) {
        currentGroup.points.push({ coord: pt.coord, timestamp: pt.timestamp });
      } else {
        if (currentGroup && currentGroup.points.length >= 2) {
          rawBirdGroups.push(currentGroup);
        }
        birdIndex++;
        currentGroup = {
          id: `${s.species_id}_bird_${birdIndex}`,
          points: [{ coord: pt.coord, timestamp: pt.timestamp }],
        };
      }
      prevId = pt.id;
    }
    if (currentGroup && currentGroup.points.length >= 2) {
      rawBirdGroups.push(currentGroup);
    }

    // Process each bird:
    // 1. Sort points chronologically by timestamp
    // 2. Drop duplicate timestamps or coordinate spikes
    // 3. Simplify trajectory with Ramer-Douglas-Peucker (tolerance = 0.02 deg ~2.2 km)
    // 4. Cap points per bird (max 500)
    const features: TrackFeature[] = [];
    let totalPoints = 0;

    for (const bg of rawBirdGroups) {
      // 1. Order points strictly chronologically by time
      bg.points.sort((a, b) => a.timestamp - b.timestamp);

      // 2. Filter duplicate timestamps
      const uniquePoints: Array<{ coord: [number, number]; timestamp: number }> = [];
      let lastTs = -1;
      for (const p of bg.points) {
        if (p.timestamp > lastTs) {
          uniquePoints.push(p);
          lastTs = p.timestamp;
        }
      }

      if (uniquePoints.length < 2) continue;

      const rawCoords = uniquePoints.map((p) => p.coord);
      const rawTimes = uniquePoints.map((p) => p.timestamp);

      // 3. Simplify trajectory using RDP tolerance = 0.02 deg (~2.2 km)
      const simplified = simplifyTrajectory(rawCoords, rawTimes, 0.02);

      // 4. Cap points per bird to max 500
      const finalCoords = simplified.coords.slice(0, 500);
      const finalTimes = simplified.times.slice(0, 500);

      if (finalCoords.length < 2) continue;

      totalPoints += finalCoords.length;
      features.push({
        type: 'Feature',
        id: bg.id,
        geometry: {
          type: 'LineString',
          coordinates: finalCoords,
        },
        properties: {
          species: s.scientific_name,
          times: finalTimes,
          point_count: finalCoords.length,
          dataset_key: primaryDataset.datasetKey,
          dataset_title: primaryDataset.title,
          dataset_doi: primaryDataset.doi || undefined,
          license: primaryDataset.license,
        },
      });
    }

    s.evidence_level = features.length > 0 ? 'tracks' : 'occurrences_only';

    const speciesGeoJson: TrackFeatureCollection = {
      type: 'FeatureCollection',
      species_id: s.species_id,
      scientific_name: s.scientific_name,
      evidence_level: s.evidence_level,
      individual_count: features.length,
      total_points: totalPoints,
      dataset: {
        key: primaryDataset.datasetKey,
        title: primaryDataset.title,
        citation: primaryDataset.citation,
        license: primaryDataset.license,
        doi: primaryDataset.doi || undefined,
      },
      features,
    };

    const outPath = path.join(tracksDir, `${s.species_id}.geojson`);
    fs.writeFileSync(outPath, JSON.stringify(speciesGeoJson, null, 2), 'utf-8');
    fs.copyFileSync(outPath, path.join(publicTracksDir, `${s.species_id}.geojson`));

    report.push({
      species: s.scientific_name,
      species_id: s.species_id,
      individuals: features.length,
      points: totalPoints,
      evidence_level: s.evidence_level,
    });
  }

  // Update registry.json with evidence_level
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf-8');
  fs.copyFileSync(registryPath, path.resolve('public', 'data', 'generated', 'registry.json'));

  // Save tracking_datasets.json
  const trackingDatasetsPath = path.resolve('data', 'generated', 'tracking_datasets.json');
  fs.writeFileSync(
    trackingDatasetsPath,
    JSON.stringify(
      {
        retrieved_at: new Date().toISOString(),
        accepted: discovered.accepted,
        skipped: discovered.skipped,
      },
      null,
      2
    ),
    'utf-8'
  );

  // Update D1 database with evidence_level and tracking datasets
  const pyUpdate = path.resolve('scripts', 'update_tracks_d1.py');
  fs.writeFileSync(
    pyUpdate,
    `import sqlite3, glob, json
db_files = glob.glob('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')
if not db_files:
    exit(0)
conn = sqlite3.connect(db_files[0])
cur = conn.cursor()

# Update species evidence_level
with open('data/generated/registry.json', 'r', encoding='utf-8') as f:
    reg = json.load(f)
for s in reg.get('species', []):
    cur.execute("UPDATE species SET evidence_level = ? WHERE species_id = ?", (s.get('evidence_level', 'occurrences_only'), s['species_id']))

# Insert all accepted tracking datasets
with open('data/generated/tracking_datasets.json', 'r', encoding='utf-8') as f:
    td = json.load(f)
for d in td.get('accepted', []):
    cur.execute('''
        INSERT OR REPLACE INTO datasets (dataset_key, title, citation, doi, license)
        VALUES (?, ?, ?, ?, ?)
    ''', (
        d['datasetKey'],
        d.get('title', 'Untitled Dataset'),
        d.get('citation', ''),
        d.get('doi') or '',
        d.get('license', 'CC-BY')
    ))

conn.commit()
print("Updated D1 species evidence_level and all accepted datasets successfully.")
`,
    'utf-8'
  );

  execSync('python "scripts/update_tracks_d1.py"', { stdio: 'inherit' });

  return { trackedSpeciesReport: report, discoveredDatasets: discovered };
}

// Direct execution
if (import.meta.url.endsWith(process.argv[1]) || process.argv[1]?.includes('tracking.ts')) {
  processSpeciesTracks()
    .then(({ trackedSpeciesReport, discoveredDatasets }) => {
      console.log('\n======================================================');
      console.log('=== GPS TRACKING INGESTION REPORT                  ===');
      console.log('======================================================');
      console.log(`Discovered Accepted Datasets: ${discoveredDatasets.accepted.length}`);
      console.log(`Discovered Skipped Datasets:  ${discoveredDatasets.skipped.length}`);
      console.log('------------------------------------------------------');
      console.log('Species Name              | Level            | Birds | Points');
      console.log('--------------------------+------------------+-------+-------');
      for (const r of trackedSpeciesReport) {
        const namePad = r.species.padEnd(25, ' ');
        const levelPad = r.evidence_level.padEnd(16, ' ');
        const birdsPad = String(r.individuals).padStart(5, ' ');
        const ptsPad = String(r.points).padStart(6, ' ');
        console.log(`${namePad} | ${levelPad} | ${birdsPad} | ${ptsPad}`);
      }
      console.log('======================================================\n');
    })
    .catch((err) => {
      console.error('Fatal tracking error:', err);
      process.exit(1);
    });
}
