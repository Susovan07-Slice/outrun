import sqlite3, glob, json

db_files = glob.glob('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')
if not db_files:
    print('No local D1 DB file found')
    exit(0)

conn = sqlite3.connect(db_files[0])
cur = conn.cursor()

cur.execute('''
CREATE TABLE IF NOT EXISTS corridor_snapshots (
    species_id TEXT PRIMARY KEY,
    analysis_json TEXT NOT NULL,
    retrieved_at TEXT NOT NULL
)
''')

with open('data/generated/corridor_analysis.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

retrieved_at = data.get('generated_at')
inserted = 0

for sp_id, analysis in data.get('species', {}).items():
    cur.execute('''
        INSERT OR REPLACE INTO corridor_snapshots (species_id, analysis_json, retrieved_at)
        VALUES (?, ?, ?)
    ''', (sp_id, json.dumps(analysis), retrieved_at))
    inserted += 1

conn.commit()
print(f'Successfully stored {inserted} species corridor snapshots into local D1.')
