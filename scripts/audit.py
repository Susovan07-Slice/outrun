import json, sqlite3, glob, csv

print("=== OUTRUN SYSTEM AUDIT ===")

# 1. Registry
with open('data/generated/registry.json', 'r', encoding='utf-8') as f:
    reg = json.load(f)
species = reg.get('species', [])
print(f"Total Species in registry.json: {len(species)}")
for s in species:
    print(f"  [{s['species_id']}] {s['scientific_name']} | Common: {s.get('common_name')} | Level: {s.get('evidence_level')} | Group: {s.get('monitoring_group')} | Records: {s.get('occurrence_count')}")

# 2. D1 Database
db_files = glob.glob('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')
if db_files:
    conn = sqlite3.connect(db_files[0])
    cur = conn.cursor()
    sp_cnt = cur.execute("SELECT COUNT(*) FROM species").fetchone()[0]
    occ_cnt = cur.execute("SELECT COUNT(*) FROM occurrences").fetchone()[0]
    ds_cnt = cur.execute("SELECT COUNT(*) FROM datasets").fetchone()[0]
    ws_cnt = cur.execute("SELECT COUNT(*) FROM weather_snapshots").fetchone()[0]
    print(f"\nD1 Database Tables: species={sp_cnt}, occurrences={occ_cnt}, datasets={ds_cnt}, weather_snapshots={ws_cnt}")

# 3. Telemetry CSV check
csv_path = 'scratch/bird-tracking/data/clean_bird_migration.csv'
species_counts = {}
with open(csv_path, 'r', encoding='utf-8') as f:
    r = csv.reader(f)
    next(r)
    for row in r:
        if len(row) > 3:
            species_counts[row[3]] = species_counts.get(row[3], 0) + 1
print("\nSpecies in clean_bird_migration.csv:")
for sp, cnt in sorted(species_counts.items(), key=lambda x: x[1], reverse=True):
    print(f"  {sp}: {cnt} points")

# 4. Check Pandion haliaetus in AVONET
with open('data/avonet/AVONET1_BirdLife.csv', 'r', encoding='utf-8', errors='ignore') as f:
    r = csv.DictReader(f)
    for row in r:
        if row.get('Species1') == 'Pandion haliaetus':
            print(f"\nAVONET Match for Pandion haliaetus: HWI={row.get('Hand-Wing.Index')}, Migration={row.get('Migration')}, Family={row.get('Family1')}")
            break
