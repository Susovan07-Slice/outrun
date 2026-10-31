import json
import os

with open('data/generated/registry.json', 'r', encoding='utf-8') as f:
    reg = json.load(f)

print(f"{'SPECIES ID':<26} | {'SCIENTIFIC NAME':<26} | {'EVIDENCE LEVEL':<16} | {'TRACKED INDIVIDUALS':<20} | {'SIMPLIFIED TRACK POINTS':<24}")
print("-" * 125)

for s in reg['species']:
    sp_id = s['species_id']
    track_file = os.path.join('data', 'generated', 'tracks', f'{sp_id}.geojson')
    indiv_count = 0
    total_pts = 0
    if os.path.exists(track_file):
        with open(track_file, 'r', encoding='utf-8') as tf:
            gj = json.load(tf)
            features = gj.get('features', [])
            indiv_count = len(features)
            for feat in features:
                coords = feat.get('geometry', {}).get('coordinates', [])
                total_pts += len(coords)
    print(f"{sp_id:<26} | {s['scientific_name']:<26} | {s.get('evidence_level',''):<16} | {indiv_count:<20} | {total_pts:<24}")

print("\n" + "=" * 110)
print("D1 DATABASE (SQLITE) QUERY: SELECT species, evidence_level, gps_tracks")
print("=" * 110)

import sqlite3, glob
db_files = glob.glob('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')
if db_files:
    conn = sqlite3.connect(db_files[0])
    cur = conn.cursor()
    sql = """
        SELECT 
            s.species_id, 
            s.scientific_name, 
            s.evidence_level,
            COALESCE(t.individual_id, '0 individuals') AS tracked_individuals,
            COALESCE(t.point_count, 0) AS simplified_points
        FROM species s
        LEFT JOIN gps_tracks t ON s.species_id = t.species_id
        ORDER BY s.species_id ASC
    """
    rows = cur.execute(sql).fetchall()
    print(f"{'SPECIES ID':<26} | {'SCIENTIFIC NAME':<26} | {'EVIDENCE LEVEL':<16} | {'INDIVIDUALS':<18} | {'SIMPLIFIED POINTS':<18}")
    print("-" * 110)
    for r in rows:
        print(f"{r[0]:<26} | {r[1]:<26} | {r[2]:<16} | {r[3]:<18} | {r[4]:<18}")

