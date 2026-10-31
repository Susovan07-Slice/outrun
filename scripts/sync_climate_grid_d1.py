import sqlite3, glob, json

db_files = glob.glob('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')
if not db_files:
    print('No D1 DB found')
    exit(0)

conn = sqlite3.connect(db_files[0])
cur = conn.cursor()

cur.execute('''
CREATE TABLE IF NOT EXISTS climate_grid_snapshots (
    species_id TEXT NOT NULL,
    season TEXT NOT NULL,
    resolution TEXT NOT NULL,
    models TEXT NOT NULL,
    grid_json TEXT NOT NULL,
    retrieved_at TEXT NOT NULL,
    PRIMARY KEY (species_id, season)
)
''')

with open('data/generated/climate_grid.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

inserted = 0
models_str = ",".join(data.get('models', []))
retrieved_at = data.get('generated_at')

for sp_id, sp_info in data.get('species', {}).items():
    for season in ['breeding', 'non_breeding']:
        s_data = sp_info['seasons'][season]
        cur.execute('''
            INSERT OR REPLACE INTO climate_grid_snapshots 
            (species_id, season, resolution, models, grid_json, retrieved_at)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (sp_id, season, '5_degrees', models_str, json.dumps(s_data), retrieved_at))
        inserted += 1

conn.commit()
print(f'Successfully synced {inserted} climate grid seasonal snapshots into local D1 database.')
