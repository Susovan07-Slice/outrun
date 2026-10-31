import sqlite3, glob, json
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
