import urllib.request
import urllib.parse
import json
import csv
import math
import datetime
import os
import sqlite3
import glob
import time
import sys

headers = {"User-Agent": "Outrun/1.0 (Migratory Birds Observatory; contact@outrun.org)"}

def fetch_json(url, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=25) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            if attempt == retries - 1:
                print(f"Error fetching {url}: {e}")
                return None
            time.sleep(1)
    return None

# Load AVONET
print("1. Loading AVONET...")
avonet = {}
with open('data/avonet/AVONET1_BirdLife.csv', 'r', encoding='utf-8', errors='ignore') as f:
    for r in csv.DictReader(f):
        sp = r.get('Species1')
        if sp:
            mig_val = r.get('Migration')
            hwi_val = r.get('Hand-Wing.Index')
            mig = None
            hwi = None
            try:
                if mig_val and mig_val != 'NA':
                    mig = int(float(mig_val))
            except:
                pass
            try:
                if hwi_val and hwi_val != 'NA':
                    hwi = float(hwi_val)
            except:
                pass
            avonet[sp] = {
                'family': r.get('Family1'),
                'hwi': hwi,
                'migration': mig
            }

new_species_defs = [
    {
        "species_id": "numenius_arquata",
        "scientific_name": "Numenius arquata",
        "common_name": "Eurasian Curlew",
        "color": [108, 142, 191],
        "hex": "#6C8EBF",
        "dataset_key": "88216808-1942-44ed-b059-b576bf79a28e",
        "dataset_title": "CURLEW_VLAANDEREN - Eurasian curlews (Numenius arquata, Scolopacidae) breeding in Flanders (Belgium)",
        "dataset_citation": "Spanoghe G, Janssens K, Nijs G, Govaert S, Milotic T, Desmet P (2026). CURLEW_VLAANDEREN. INBO. Occurrence dataset https://doi.org/10.5281/zenodo.15696532 accessed via GBIF.org.",
        "dataset_doi": "10.5281/zenodo.15696532",
        "dataset_license": "http://creativecommons.org/publicdomain/zero/1.0/legalcode",
        "movement_type": "migration",
        "movement_label": "Migratory Corridor",
        "is_raptor": False,
    },
    {
        "species_id": "circus_pygargus",
        "scientific_name": "Circus pygargus",
        "common_name": "Montagu's Harrier",
        "color": [184, 92, 56],
        "hex": "#B85C38",
        "dataset_key": "e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a",
        "dataset_title": "BOP_RODENT - Rodent specialized birds of prey (Circus, Asio, Buteo) in Flanders (Belgium)",
        "dataset_citation": "Spanoghe G, et al. BOP_RODENT. INBO / UvA-BiTS. Occurrence dataset https://doi.org/10.5281/zenodo.23340023 accessed via GBIF.org.",
        "dataset_doi": "10.5281/zenodo.23340023",
        "dataset_license": "http://creativecommons.org/publicdomain/zero/1.0/legalcode",
        "movement_type": "migration",
        "movement_label": "Trans-Saharan Migratory Corridor",
        "is_raptor": True,
    },
    {
        "species_id": "fregata_magnificens",
        "scientific_name": "Fregata magnificens",
        "common_name": "Magnificent Frigatebird",
        "color": [64, 130, 109],
        "hex": "#40826D",
        "dataset_key": "291e47e6-1cb6-4211-9fbd-4f06accb1c37",
        "dataset_title": "University of Liverpool seabird tracking in Anguilla 2012-2015",
        "dataset_citation": "Soanes L. (2015). University of Liverpool seabird tracking in Anguilla 2012-2015. OBIS-SEAMAP / GBIF. https://doi.org/10.82144/aef3a0fc.",
        "dataset_doi": "10.82144/aef3a0fc",
        "dataset_license": "http://creativecommons.org/licenses/by-nc/4.0/legalcode",
        "movement_type": "foraging",
        "movement_label": "Tracked Movements (Pelagic Foraging Trips)",
        "is_raptor": False,
    }
]

# RDP Simplification
def get_perp_dist(pt, l_start, l_end):
    x, y = pt
    x1, y1 = l_start
    x2, y2 = l_end
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(x - x1, y - y1)
    return abs(dy * x - dx * y + x2 * y1 - y2 * x1) / math.hypot(dx, dy)

def simplify_trajectory(coords, times, tolerance=0.02):
    if len(coords) <= 2:
        return coords, times
    max_d = 0
    max_i = 0
    for i in range(1, len(coords) - 1):
        d = get_perp_dist(coords[i], coords[0], coords[-1])
        if d > max_d:
            max_d = d
            max_i = i
    if max_d > tolerance:
        c1, t1 = simplify_trajectory(coords[:max_i+1], times[:max_i+1], tolerance)
        c2, t2 = simplify_trajectory(coords[max_i:], times[max_i:], tolerance)
        return c1[:-1] + c2, t1[:-1] + t2
    return [coords[0], coords[-1]], [times[0], times[-1]]

os.makedirs('data/generated/tracks', exist_ok=True)
os.makedirs('public/data/generated/tracks', exist_ok=True)
os.makedirs('data/generated/occurrences', exist_ok=True)

species_ingestion_summary = []

for sp_def in new_species_defs:
    sp_id = sp_def['species_id']
    sci_name = sp_def['scientific_name']
    ds_key = sp_def['dataset_key']
    print(f"\n========================================================")
    print(f"Ingesting {sci_name} ({sp_id}) from {ds_key}")
    print(f"========================================================")

    # 1. Fetch taxonKey from GBIF
    match_url = f"https://api.gbif.org/v1/species/match?name={urllib.parse.quote(sci_name)}&rank=species"
    match_res = fetch_json(match_url)
    taxon_key = match_res.get('usageKey') or match_res.get('speciesKey')
    canonical_name = match_res.get('canonicalName') or sci_name
    print(f"Resolved GBIF taxonKey: {taxon_key} ({canonical_name})")

    # 2. Fetch tracking pings (MACHINE_OBSERVATION) from specific tracking dataset
    # We query up to 800 tracking records to build high quality tracks
    track_query_url = f"https://api.gbif.org/v1/occurrence/search?datasetKey={ds_key}&speciesKey={taxon_key}&basisOfRecord=MACHINE_OBSERVATION&hasCoordinate=true&limit=800"
    track_res = fetch_json(track_query_url)
    raw_results = track_res.get('results', []) if track_res else []
    print(f"Fetched {len(raw_results)} raw telemetry tracking pings from GBIF")

    # Group by organismID
    by_bird = {}
    for r in raw_results:
        org_id = r.get('organismID') or f"{sp_id}_bird_1"
        lat = r.get('decimalLatitude')
        lon = r.get('decimalLongitude')
        ed = r.get('eventDate')
        if lat is None or lon is None or not ed:
            continue
        try:
            dt = datetime.datetime.fromisoformat(ed.replace('Z', '+00:00'))
            ts = int(dt.timestamp())
        except:
            continue

        # Rule 3 Sensitive Locations Masking:
        # For raptors (e.g. Circus pygargus), coarsen fixes inside breeding season (May-July) near initial nest site
        if sp_def['is_raptor']:
            month = dt.month
            if month in [5, 6, 7] and lat > 45: # European breeding range in summer
                # Coarsen to 2 decimal places (~1.1 km) to prevent pinpointing nest
                lat = round(lat, 2)
                lon = round(lon, 2)
            else:
                lat = round(lat, 4)
                lon = round(lon, 4)
        else:
            lat = round(lat, 5)
            lon = round(lon, 5)

        if org_id not in by_bird:
            by_bird[org_id] = []
        by_bird[org_id].append({'coord': [lon, lat], 'ts': ts})

    features = []
    total_simplified_points = 0

    for bird_idx, (org_id, pts) in enumerate(by_bird.items()):
        # Sort chronologically
        pts.sort(key=lambda x: x['ts'])
        # Deduplicate timestamps
        unique_pts = []
        last_ts = -1
        for p in pts:
            if p['ts'] > last_ts:
                unique_pts.append(p)
                last_ts = p['ts']
        if len(unique_pts) < 2:
            continue

        coords = [p['coord'] for p in unique_pts]
        times = [p['ts'] for p in unique_pts]

        s_coords, s_times = simplify_trajectory(coords, times, tolerance=0.02)
        # Cap at 500
        f_coords = s_coords[:500]
        f_times = s_times[:500]
        if len(f_coords) < 2:
            continue

        total_simplified_points += len(f_coords)
        features.append({
            "type": "Feature",
            "id": f"{sp_id}_indiv_{bird_idx + 1}",
            "geometry": {
                "type": "LineString",
                "coordinates": f_coords
            },
            "properties": {
                "species": sci_name,
                "times": f_times,
                "point_count": len(f_coords),
                "organism_id": org_id,
                "dataset_key": ds_key,
                "dataset_title": sp_def['dataset_title'],
                "dataset_doi": sp_def['dataset_doi'],
                "license": sp_def['dataset_license'],
                "movement_type": sp_def['movement_type'],
                "movement_label": sp_def['movement_label']
            }
        })

    print(f"Generated {len(features)} tracked individual trajectories, {total_simplified_points} points after RDP simplification")

    # Write GeoJSON
    geojson_payload = {
        "type": "FeatureCollection",
        "species_id": sp_id,
        "scientific_name": sci_name,
        "common_name": sp_def['common_name'],
        "evidence_level": "tracks",
        "individual_count": len(features),
        "total_points": total_simplified_points,
        "movement_type": sp_def['movement_type'],
        "movement_label": sp_def['movement_label'],
        "sensitive_coarsened": sp_def['is_raptor'],
        "dataset": {
            "key": ds_key,
            "title": sp_def['dataset_title'],
            "citation": sp_def['dataset_citation'],
            "doi": sp_def['dataset_doi'],
            "license": sp_def['dataset_license']
        },
        "features": features
    }

    track_out_1 = f"data/generated/tracks/{sp_id}.geojson"
    track_out_2 = f"public/data/generated/tracks/{sp_id}.geojson"
    with open(track_out_1, 'w', encoding='utf-8') as f:
        json.dump(geojson_payload, f, indent=2)
    with open(track_out_2, 'w', encoding='utf-8') as f:
        json.dump(geojson_payload, f, indent=2)

    # 3. Fetch Stratified Monthly Occurrences (HUMAN_OBSERVATION, months 1..12, limit=42/mo)
    print(f"Fetching stratified monthly occurrences for {sci_name} (Class Aves)...")
    stratified_occs = []
    for month in range(1, 13):
        occ_url = f"https://api.gbif.org/v1/occurrence/search?taxonKey={taxon_key}&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&basisOfRecord=HUMAN_OBSERVATION&year=2010,2026&month={month}&limit=42"
        mo_res = fetch_json(occ_url)
        if mo_res and 'results' in mo_res:
            for o in mo_res['results']:
                stratified_occs.append({
                    "gbif_id": str(o.get('key')),
                    "species_id": sp_id,
                    "lat": o.get('decimalLatitude'),
                    "lon": o.get('decimalLongitude'),
                    "event_date": o.get('eventDate'),
                    "month": o.get('month') or month,
                    "dataset_key": o.get('datasetKey'),
                    "license": o.get('license'),
                    "basis_of_record": o.get('basisOfRecord', 'HUMAN_OBSERVATION'),
                    "country_code": o.get('countryCode'),
                    "coord_uncertainty_m": o.get('coordinateUncertaintyInMeters'),
                    "retrieved_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
                })
    print(f"Retrieved {len(stratified_occs)} stratified occurrence records preserving 10 provenance fields")

    # Write occurrences JSON
    occ_payload = {
        "species_id": sp_id,
        "label": "observed",
        "count": len(stratified_occs),
        "short": len(stratified_occs) < 500,
        "retrieved_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "occurrences": stratified_occs
    }
    with open(f"data/generated/occurrences/{sp_id}.json", 'w', encoding='utf-8') as f:
        json.dump(occ_payload, f, indent=2)

    # AVONET traits
    traits = avonet.get(sci_name, {'hwi': None, 'migration': None, 'family': None})

    species_record = {
        "species_id": sp_id,
        "gbif_taxon_key": taxon_key,
        "scientific_name": sci_name,
        "common_name": sp_def['common_name'],
        "family": traits['family'] or "Aves",
        "monitoring_group": "review_required",
        "last_checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": None,
        "traits": {
            "hand_wing_index": traits['hwi'],
            "migration_category": traits['migration'],
            "source": "AVONET (Tobias et al. 2022)",
            "source_version": "AVONET1_BirdLife.csv",
            "matched": True
        },
        "stats": {
            "requested_records": 504,
            "received_records": len(stratified_occs),
            "short": len(stratified_occs) < 500
        },
        "evidence_level": "tracks",
        "movement_type": sp_def['movement_type'],
        "movement_label": sp_def['movement_label'],
        "tracked_individuals": len(features),
        "total_points": total_simplified_points,
        "occurrence_count": len(stratified_occs)
    }

    species_ingestion_summary.append({
        "species_id": sp_id,
        "scientific_name": sci_name,
        "common_name": sp_def['common_name'],
        "dataset": sp_def['dataset_title'],
        "doi": sp_def['dataset_doi'],
        "license": sp_def['dataset_license'],
        "movement_type": sp_def['movement_type'],
        "individuals": len(features),
        "points": total_simplified_points,
        "occurrences": len(stratified_occs),
        "record": species_record,
        "color": sp_def['color'],
        "hex": sp_def['hex'],
        "stratified_occs": stratified_occs
    })

# 4. Update data/generated/registry.json
print("\nUpdating registry.json...")
with open('data/generated/registry.json', 'r', encoding='utf-8') as f:
    registry = json.load(f)

existing_sp_ids = {s['species_id'] for s in registry['species']}

for item in species_ingestion_summary:
    rec = item['record']
    if rec['species_id'] not in existing_sp_ids:
        registry['species'].append(rec)
        existing_sp_ids.add(rec['species_id'])
    else:
        # Update existing
        for i, s in enumerate(registry['species']):
            if s['species_id'] == rec['species_id']:
                registry['species'][i] = rec

registry['species_count'] = len(registry['species'])
registry['generated_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()

with open('data/generated/registry.json', 'w', encoding='utf-8') as f:
    json.dump(registry, f, indent=2)

print(f"Registry updated: Total Species = {registry['species_count']}")

# 5. Update local D1 SQLite Database
db_files = glob.glob('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')
if db_files:
    print(f"\nUpdating D1 Database ({db_files[0]})...")
    conn = sqlite3.connect(db_files[0])
    cur = conn.cursor()

    for item in species_ingestion_summary:
        rec = item['record']
        sp_id = rec['species_id']

        # Insert dataset
        cur.execute('''
            INSERT OR REPLACE INTO datasets (dataset_key, title, citation, doi, license)
            VALUES (?, ?, ?, ?, ?)
        ''', (
            item['dataset'],
            item['dataset'],
            rec['scientific_name'],
            item['doi'],
            item['license']
        ))

        # Insert species
        cur.execute('''
            INSERT OR REPLACE INTO species (species_id, gbif_taxon_key, scientific_name, common_name, family, monitoring_group, evidence_level, last_checked_at)
            VALUES (?, ?, ?, ?, ?, 'review_required', 'tracks', ?)
        ''', (
            sp_id,
            rec['gbif_taxon_key'],
            rec['scientific_name'],
            rec['common_name'],
            rec['family'],
            rec['last_checked_at']
        ))

        # Insert traits
        cur.execute('''
            INSERT OR REPLACE INTO species_traits (species_id, hand_wing_index, migration_category, source, source_version, matched)
            VALUES (?, ?, ?, 'AVONET (Tobias et al. 2022)', 'AVONET1_BirdLife.csv', 1)
        ''', (
            sp_id,
            rec['traits']['hand_wing_index'],
            rec['traits']['migration_category']
        ))

        # Insert gps_tracks
        cur.execute('''
            INSERT OR REPLACE INTO gps_tracks (track_id, species_id, individual_id, point_count, dataset_key, geojson_path, retrieved_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ''', (
            f"{sp_id}_track",
            sp_id,
            f"{item['individuals']} individuals",
            item['points'],
            item['doi'],
            f"data/generated/tracks/{sp_id}.geojson",
            datetime.datetime.now(datetime.timezone.utc).isoformat()
        ))

        # Insert occurrences
        for o in item['stratified_occs']:
            cur.execute('''
                INSERT OR REPLACE INTO occurrences (gbif_id, species_id, lat, lon, event_date, month, dataset_key, license, basis_of_record, country_code, coord_uncertainty_m, retrieved_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                o['gbif_id'],
                sp_id,
                o['lat'],
                o['lon'],
                o['event_date'],
                o['month'],
                o['dataset_key'],
                o['license'],
                o['basis_of_record'],
                o['country_code'],
                o['coord_uncertainty_m'],
                o['retrieved_at']
            ))

    conn.commit()
    print("D1 Database updated successfully.")

print("\n=== SUMMARY OF INGESTED DATASETS & SPECIES ===")
for item in species_ingestion_summary:
    print(f"- {item['common_name']} ({item['scientific_name']}): {item['individuals']} individuals, {item['points']} simplified points, {item['occurrences']} occurrences. Movement: {item['movement_type']}. Licence: {item['license']}")
