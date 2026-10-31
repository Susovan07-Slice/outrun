import sqlite3
import glob
import json
import datetime

db_files = glob.glob('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')
if not db_files:
    print("No D1 database found, skipping D1 sync.")
    exit(0)

db_path = db_files[0]
print(f"Connecting to D1 database at {db_path}...")
conn = sqlite3.connect(db_path)
cur = conn.cursor()

with open('data/generated/registry.json', 'r', encoding='utf-8') as f:
    registry = json.load(f)

now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

for s in registry['species']:
    sp_id = s['species_id']
    cur.execute('''
        INSERT OR REPLACE INTO species (species_id, gbif_taxon_key, scientific_name, common_name, family, monitoring_group, evidence_level, last_checked_at)
        VALUES (?, ?, ?, ?, ?, 'review_required', ?, ?)
    ''', (
        sp_id,
        s.get('gbif_taxon_key'),
        s.get('scientific_name'),
        s.get('common_name'),
        s.get('family'),
        s.get('evidence_level', 'occurrences_only'),
        s.get('last_checked_at') or now_iso
    ))

    traits = s.get('traits', {})
    cur.execute('''
        INSERT OR REPLACE INTO species_traits (species_id, hand_wing_index, migration_category, source, source_version, matched)
        VALUES (?, ?, ?, 'AVONET (Tobias et al. 2022)', 'AVONET1_BirdLife.csv', ?)
    ''', (
        sp_id,
        traits.get('hand_wing_index'),
        traits.get('migration_category'),
        1 if traits.get('matched') else 0
    ))

conn.commit()
conn.close()
print("D1 database synced successfully for all species in registry!")
