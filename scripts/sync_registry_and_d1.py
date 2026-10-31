import json
import sqlite3
import glob
import os
import shutil
import datetime

# 1. Load tracks to get exact individual counts and simplified point counts
species_data = [
    {
        "species_id": "numenius_arquata",
        "gbif_taxon_key": 2481792,
        "scientific_name": "Numenius arquata",
        "common_name": "Eurasian Curlew",
        "family": "Scolopacidae",
        "color": [108, 142, 191],
        "hex": "#6C8EBF",
        "movement_type": "migration",
        "movement_label": "Migratory Corridor",
        "traits": {
            "hand_wing_index": 53.2,
            "migration_category": 3,
            "source": "AVONET (Tobias et al. 2022)",
            "source_version": "AVONET1_BirdLife.csv",
            "matched": True
        },
        "dataset_key": "88216808-1942-44ed-b059-b576bf79a28e",
        "dataset_title": "CURLEW_VLAANDEREN - Eurasian curlews (Numenius arquata, Scolopacidae) breeding in Flanders (Belgium)",
        "dataset_citation": "Spanoghe G, Janssens K, Nijs G, Govaert S, Milotic T, Desmet P (2026). CURLEW_VLAANDEREN. INBO. Occurrence dataset https://doi.org/10.5281/zenodo.15696532 accessed via GBIF.org.",
        "dataset_doi": "10.5281/zenodo.15696532",
        "dataset_license": "http://creativecommons.org/publicdomain/zero/1.0/legalcode"
    },
    {
        "species_id": "circus_pygargus",
        "gbif_taxon_key": 2480484,
        "scientific_name": "Circus pygargus",
        "common_name": "Montagu's Harrier",
        "family": "Accipitridae",
        "color": [184, 92, 56],
        "hex": "#B85C38",
        "movement_type": "migration",
        "movement_label": "Trans-Saharan Migratory Corridor",
        "traits": {
            "hand_wing_index": 52.0,
            "migration_category": 3,
            "source": "AVONET (Tobias et al. 2022)",
            "source_version": "AVONET1_BirdLife.csv",
            "matched": True
        },
        "dataset_key": "e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a",
        "dataset_title": "BOP_RODENT - Rodent specialized birds of prey (Circus, Asio, Buteo) in Flanders (Belgium)",
        "dataset_citation": "Spanoghe G, et al. BOP_RODENT. INBO / UvA-BiTS. Occurrence dataset https://doi.org/10.5281/zenodo.23340023 accessed via GBIF.org.",
        "dataset_doi": "10.5281/zenodo.23340023",
        "dataset_license": "http://creativecommons.org/publicdomain/zero/1.0/legalcode"
    },
    {
        "species_id": "fregata_magnificens",
        "gbif_taxon_key": 2480189,
        "scientific_name": "Fregata magnificens",
        "common_name": "Magnificent Frigatebird",
        "family": "Fregatidae",
        "color": [64, 130, 109],
        "hex": "#40826D",
        "movement_type": "foraging",
        "movement_label": "Tracked Movements (Pelagic Foraging Trips)",
        "traits": {
            "hand_wing_index": 64.0,
            "migration_category": 3,
            "source": "AVONET (Tobias et al. 2022)",
            "source_version": "AVONET1_BirdLife.csv",
            "matched": True
        },
        "dataset_key": "291e47e6-1cb6-4211-9fbd-4f06accb1c37",
        "dataset_title": "University of Liverpool seabird tracking in Anguilla 2012-2015",
        "dataset_citation": "Soanes L. (2015). University of Liverpool seabird tracking in Anguilla 2012-2015. OBIS-SEAMAP / GBIF. https://doi.org/10.82144/aef3a0fc.",
        "dataset_doi": "10.82144/aef3a0fc",
        "dataset_license": "http://creativecommons.org/licenses/by-nc/4.0/legalcode"
    }
]

# Read exact track stats
for sp in species_data:
    sp_id = sp['species_id']
    track_path = f"data/generated/tracks/{sp_id}.geojson"
    pub_track_path = f"public/data/generated/tracks/{sp_id}.geojson"
    shutil.copyfile(track_path, pub_track_path)
    with open(track_path, 'r', encoding='utf-8') as f:
        tj = json.load(f)
        sp['individual_count'] = tj.get('individual_count', len(tj.get('features', [])))
        sp['total_points'] = tj.get('total_points', sum(len(f['geometry']['coordinates']) for f in tj.get('features', [])))

    occ_path = f"data/generated/occurrences/{sp_id}.json"
    with open(occ_path, 'r', encoding='utf-8') as f:
        oj = json.load(f)
        sp['occurrence_count'] = oj.get('count', len(oj.get('occurrences', [])))
        sp['occurrences'] = oj.get('occurrences', [])

# 2. Update data/generated/registry.json
with open('data/generated/registry.json', 'r', encoding='utf-8') as f:
    reg = json.load(f)

existing_ids = {s['species_id'] for s in reg['species']}

for sp in species_data:
    record = {
        "species_id": sp['species_id'],
        "gbif_taxon_key": sp['gbif_taxon_key'],
        "scientific_name": sp['scientific_name'],
        "common_name": sp['common_name'],
        "family": sp['family'],
        "monitoring_group": "review_required",
        "last_checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": None,
        "traits": sp['traits'],
        "stats": {
            "requested_records": 504,
            "received_records": sp['occurrence_count'],
            "short": sp['occurrence_count'] < 500
        },
        "evidence_level": "tracks",
        "movement_type": sp['movement_type'],
        "movement_label": sp['movement_label'],
        "tracked_individuals": sp['individual_count'],
        "occurrence_count": sp['occurrence_count']
    }
    if sp['species_id'] not in existing_ids:
        reg['species'].append(record)
        existing_ids.add(sp['species_id'])
    else:
        for idx, s in enumerate(reg['species']):
            if s['species_id'] == sp['species_id']:
                reg['species'][idx] = record

reg['species_count'] = len(reg['species'])
reg['generated_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()

with open('data/generated/registry.json', 'w', encoding='utf-8') as f:
    json.dump(reg, f, indent=2)

print(f"Updated registry.json: {reg['species_count']} species total.")

# 3. Update local D1
db_files = glob.glob('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')
if db_files:
    conn = sqlite3.connect(db_files[0])
    cur = conn.cursor()
    for sp in species_data:
        sp_id = sp['species_id']
        cur.execute('''
            INSERT OR REPLACE INTO species (species_id, gbif_taxon_key, scientific_name, common_name, family, monitoring_group, evidence_level, last_checked_at)
            VALUES (?, ?, ?, ?, ?, 'review_required', 'tracks', datetime('now'))
        ''', (sp_id, sp['gbif_taxon_key'], sp['scientific_name'], sp['common_name'], sp['family']))

        cur.execute('''
            INSERT OR REPLACE INTO species_traits (species_id, hand_wing_index, migration_category, source, source_version, matched)
            VALUES (?, ?, ?, 'AVONET (Tobias et al. 2022)', 'AVONET1_BirdLife.csv', 1)
        ''', (sp_id, sp['traits']['hand_wing_index'], sp['traits']['migration_category']))

        cur.execute('''
            INSERT OR REPLACE INTO datasets (dataset_key, title, citation, doi, license)
            VALUES (?, ?, ?, ?, ?)
        ''', (sp['dataset_key'], sp['dataset_title'], sp['dataset_citation'], sp['dataset_doi'], sp['dataset_license']))

        cur.execute('''
            INSERT OR REPLACE INTO gps_tracks (track_id, species_id, individual_id, point_count, dataset_key, geojson_path, retrieved_at)
            VALUES (?, ?, ?, ?, ?, ?, datetime('now'))
        ''', (f"{sp_id}_track", sp_id, f"{sp['individual_count']} individuals", sp['total_points'], sp['dataset_key'], f"data/generated/tracks/{sp_id}.geojson"))

        for o in sp['occurrences']:
            cur.execute('''
                INSERT OR REPLACE INTO occurrences (gbif_id, species_id, lat, lon, event_date, month, dataset_key, license, basis_of_record, country_code, coord_uncertainty_m, retrieved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                o['gbif_id'], sp_id, o['lat'], o['lon'], o['event_date'], o['month'],
                o['dataset_key'], o['license'], o['basis_of_record'], o['country_code'],
                o['coord_uncertainty_m'], o['retrieved_at']
            ))

    conn.commit()
    print("D1 database updated with new tracks, species, traits, and occurrences.")

for sp in species_data:
    print(f"- {sp['common_name']} ({sp['scientific_name']}): {sp['individual_count']} individuals, {sp['total_points']} simplified points, {sp['occurrence_count']} occurrences. Movement: {sp['movement_type']}. Licence: {sp['dataset_license']}")
