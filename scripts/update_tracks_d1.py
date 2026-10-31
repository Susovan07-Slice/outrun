import sqlite3, glob, json
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

# Insert / update gps_tracks for tracked species
tracks_info = [
    ('ciconia_ciconia_track', 'ciconia_ciconia', '100 individuals', 2899, '712dba38-74cc-4704-87c0-63d1bf8484bc', 'data/generated/tracks/ciconia_ciconia.geojson'),
    ('grus_grus_track', 'grus_grus', '812 individuals', 59856, '712dba38-74cc-4704-87c0-63d1bf8484bc', 'data/generated/tracks/grus_grus.geojson'),
    ('pandion_haliaetus_track', 'pandion_haliaetus', '842 individuals', 14883, '712dba38-74cc-4704-87c0-63d1bf8484bc', 'data/generated/tracks/pandion_haliaetus.geojson'),
]

for track_id, sp_id, ind_label, pts, ds_key, gj_path in tracks_info:
    cur.execute('''
        INSERT OR REPLACE INTO gps_tracks (track_id, species_id, individual_id, point_count, dataset_key, geojson_path, retrieved_at)
        VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
    ''', (track_id, sp_id, ind_label, pts, ds_key, gj_path))

conn.commit()
print("Updated D1 species evidence_level, all accepted datasets, and gps_tracks successfully.")
