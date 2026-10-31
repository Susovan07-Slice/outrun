import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

interface WeatherSnapshot {
  species_id: string;
  scientific_name: string;
  latitude: number;
  longitude: number;
  weather: any;
  retrieved_at: string;
}

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWeatherSnapshot() {
  console.log('\n======================================================');
  console.log('=== Open-Meteo Live Weather Snapshotting Pipeline   ===');
  console.log('======================================================\n');

  const registryPath = path.resolve('data', 'generated', 'registry.json');
  if (!fs.existsSync(registryPath)) {
    throw new Error('data/generated/registry.json not found. Run "npm run ingest" first.');
  }

  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  const speciesList = registry.species || [];
  console.log(`Snapshotting live atmospheric conditions for ${speciesList.length} species...`);

  const snapshots: WeatherSnapshot[] = [];

  for (const s of speciesList) {
    const occPath = path.resolve('data', 'generated', 'occurrences', `${s.species_id}.json`);
    let lat = 19.72; // Default flyway hub (Chilika)
    let lon = 85.32;

    if (fs.existsSync(occPath)) {
      const occData = JSON.parse(fs.readFileSync(occPath, 'utf-8'));
      if (occData.occurrences && occData.occurrences.length > 0) {
        // Use the latest occurrence coordinate
        lat = occData.occurrences[0].lat;
        lon = occData.occurrences[0].lon;
      }
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(4)}&longitude=${lon.toFixed(4)}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m`;

    try {
      await sleep(250); // Polite pacing
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Outrun/1.0 (Live Weather Snapshotter)' },
      });

      if (!res.ok) {
        throw new Error(`Open-Meteo HTTP ${res.status}: ${res.statusText}`);
      }

      const json: any = await res.json();
      const retrievedAt = new Date().toISOString();

      snapshots.push({
        species_id: s.species_id,
        scientific_name: s.scientific_name,
        latitude: lat,
        longitude: lon,
        weather: json.current,
        retrieved_at: retrievedAt,
      });

      console.log(`✔ [${s.scientific_name}] Lat: ${lat.toFixed(2)}, Lon: ${lon.toFixed(2)} -> ${json.current.temperature_2m}°C, wind: ${json.current.wind_speed_10m} km/h (saved: ${retrievedAt})`);
    } catch (err: any) {
      console.warn(`✖ Failed live snapshot for ${s.species_id}: ${err.message}`);
    }
  }

  // Write to data/generated/weather_snapshots.json
  const outPath = path.resolve('data', 'generated', 'weather_snapshots.json');
  fs.writeFileSync(outPath, JSON.stringify(snapshots, null, 2), 'utf-8');
  console.log(`\n✔ Wrote ${snapshots.length} live snapshots to ${outPath}`);

  // Persist directly into local D1 SQLite weather_snapshots table
  const pyScript = path.resolve('scripts', 'save_weather_to_d1.py');
  fs.writeFileSync(
    pyScript,
    `import sqlite3, glob, json
db_files = glob.glob('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')
if not db_files:
    print('No D1 DB found')
    exit(1)
conn = sqlite3.connect(db_files[0])
cur = conn.cursor()
with open('data/generated/weather_snapshots.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
for row in data:
    cur.execute('''
        INSERT OR REPLACE INTO weather_snapshots (species_id, weather_json, retrieved_at)
        VALUES (?, ?, ?)
    ''', (row['species_id'], json.dumps(row['weather']), row['retrieved_at']))
conn.commit()
print(f'Successfully stored {len(data)} snapshots into D1 weather_snapshots table.')
`,
    'utf-8'
  );

  execSync('python "scripts/save_weather_to_d1.py"', { stdio: 'inherit' });
  console.log('✔ All live snapshots successfully persisted into D1 database.\n');
}

runWeatherSnapshot().catch((err) => {
  console.error('Fatal snapshot error:', err);
  process.exit(1);
});
