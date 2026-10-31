import urllib.request
import urllib.parse
import json
import csv
import math
import datetime
import os
import glob
import time

headers = {"User-Agent": "Outrun/1.0 (Migratory Birds Observatory; contact@outrun.org)"}

def fetch_json(url, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=30) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            if attempt == retries - 1:
                print(f"Error fetching {url}: {e}")
                return None
            time.sleep(1.5)
    return None

# Load AVONET
print("1. Loading AVONET trait index...")
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
        "species_id": "ciconia_nigra",
        "scientific_name": "Ciconia nigra",
        "common_name": "Black Stork",
        "color": [45, 55, 72],
        "hex": "#2D3748",
        "dataset_key": "712dba38-74cc-4704-87c0-63d1bf8484bc",
        "dataset_title": "BirdMap Data - GPS tracking of Storks, Cranes and birds of prey, breeding in Northern and Eastern Europe",
        "dataset_citation": "Eagle Club Estonia / BirdMap (2024). GPS tracking of Storks, Cranes and birds of prey. GBIF Occurrence dataset https://doi.org/10.15468/vnwmrx.",
        "dataset_doi": "10.15468/vnwmrx",
        "dataset_license": "http://creativecommons.org/licenses/by-nc/4.0/legalcode",
        "movement_type": "migration",
        "movement_label": "Trans-Saharan Migratory Corridor",
        "is_sensitive": True,
    },
    {
        "species_id": "circus_cyaneus",
        "scientific_name": "Circus cyaneus",
        "common_name": "Hen Harrier",
        "color": [74, 107, 130],
        "hex": "#4A6B82",
        "dataset_key": "e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a",
        "dataset_title": "BOP_RODENT - Rodent specialized birds of prey (Circus, Asio, Buteo) in Flanders (Belgium)",
        "dataset_citation": "Spanoghe G, et al. BOP_RODENT. INBO / UvA-BiTS. Occurrence dataset https://doi.org/10.5281/zenodo.23340023 accessed via GBIF.org.",
        "dataset_doi": "10.5281/zenodo.23340023",
        "dataset_license": "http://creativecommons.org/publicdomain/zero/1.0/legalcode",
        "movement_type": "migration",
        "movement_label": "Pan-Eurasian Migratory Corridor",
        "is_sensitive": True,
    },
    {
        "species_id": "circus_aeruginosus",
        "scientific_name": "Circus aeruginosus",
        "common_name": "Western Marsh Harrier",
        "color": [140, 80, 50],
        "hex": "#8C5032",
        "dataset_key": "e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a",
        "dataset_title": "BOP_RODENT - Rodent specialized birds of prey (Circus, Asio, Buteo) in Flanders (Belgium)",
        "dataset_citation": "Spanoghe G, et al. BOP_RODENT. INBO / UvA-BiTS. Occurrence dataset https://doi.org/10.5281/zenodo.23340023 accessed via GBIF.org.",
        "dataset_doi": "10.5281/zenodo.23340023",
        "dataset_license": "http://creativecommons.org/publicdomain/zero/1.0/legalcode",
        "movement_type": "migration",
        "movement_label": "Trans-Saharan Migratory Corridor",
        "is_sensitive": True,
    },
    {
        "species_id": "asio_flammeus",
        "scientific_name": "Asio flammeus",
        "common_name": "Short-eared Owl",
        "color": [200, 138, 50],
        "hex": "#C88A32",
        "dataset_key": "e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a",
        "dataset_title": "BOP_RODENT - Rodent specialized birds of prey (Circus, Asio, Buteo) in Flanders (Belgium)",
        "dataset_citation": "Spanoghe G, et al. BOP_RODENT. INBO / UvA-BiTS. Occurrence dataset https://doi.org/10.5281/zenodo.23340023 accessed via GBIF.org.",
        "dataset_doi": "10.5281/zenodo.23340023",
        "dataset_license": "http://creativecommons.org/publicdomain/zero/1.0/legalcode",
        "movement_type": "migration",
        "movement_label": "Nomadic & Irruptive Migratory Corridor",
        "is_sensitive": True,
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
os.makedirs('public/data/generated/occurrences', exist_ok=True)

species_ingestion_summary = []

for sp_def in new_species_defs:
    sp_id = sp_def['species_id']
    sci_name = sp_def['scientific_name']
    ds_key = sp_def['dataset_key']
    print(f"\n{'='*70}")
    print(f"Ingesting {sci_name} ({sp_id}) from {ds_key[:8]}...")
    print(f"{'='*70}")

    # 1. Fetch taxonKey from GBIF
    match_url = f"https://api.gbif.org/v1/species/match?name={urllib.parse.quote(sci_name)}&rank=species"
    match_res = fetch_json(match_url)
    taxon_key = match_res.get('usageKey') or match_res.get('speciesKey')
    print(f"Resolved GBIF taxonKey: {taxon_key} ({match_res.get('canonicalName')})")

    # 2. Fetch tracking pings (MACHINE_OBSERVATION)
    track_query_url = f"https://api.gbif.org/v1/occurrence/search?datasetKey={ds_key}&speciesKey={taxon_key}&basisOfRecord=MACHINE_OBSERVATION&hasCoordinate=true&limit=800"
    track_res = fetch_json(track_query_url)
    raw_results = track_res.get('results', []) if track_res else []
    print(f"Fetched {len(raw_results)} telemetry tracking pings from GBIF")

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

        # Rule 3 Sensitive Locations:
        # Coarsen fixes inside breeding season (May-July) to 0.1 degrees (~11.1 km)
        if sp_def['is_sensitive']:
            month = dt.month
            if month in [5, 6, 7]:
                lat = round(lat, 1)
                lon = round(lon, 1)
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
        pts.sort(key=lambda x: x['ts'])
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

    print(f"Generated {len(features)} tracked individual trajectories, {total_simplified_points} simplified points")

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
        "sensitive_coarsened": sp_def['is_sensitive'],
        "dataset": {
            "key": ds_key,
            "title": sp_def['dataset_title'],
            "citation": sp_def['dataset_citation'],
            "doi": sp_def['dataset_doi'],
            "license": sp_def['dataset_license']
        },
        "features": features
    }

    geo_file = f"data/generated/tracks/{sp_id}.geojson"
    pub_geo_file = f"public/data/generated/tracks/{sp_id}.geojson"
    with open(geo_file, 'w', encoding='utf-8') as f:
        json.dump(geojson_payload, f, indent=2)
    with open(pub_geo_file, 'w', encoding='utf-8') as f:
        json.dump(geojson_payload, f, indent=2)

    # 3. Fetch occurrences preserving all 10 provenance fields
    print(f"Fetching stratified empirical occurrences from GBIF for {sci_name}...")
    occ_url = f"https://api.gbif.org/v1/occurrence/search?taxonKey={taxon_key}&hasCoordinate=true&hasGeospatialIssue=false&limit=300"
    occ_res = fetch_json(occ_url)
    raw_occ = occ_res.get('results', []) if occ_res else []

    occurrences = []
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    for r in raw_occ:
        gid = r.get('gbifID') or r.get('key')
        lat = r.get('decimalLatitude')
        lon = r.get('decimalLongitude')
        ed = r.get('eventDate')
        if not gid or lat is None or lon is None or not ed:
            continue
        try:
            dt = datetime.datetime.fromisoformat(ed.replace('Z', '+00:00'))
            month = dt.month
        except:
            month = 6

        # Sensitive breeding coarsening
        if sp_def['is_sensitive'] and month in [5, 6, 7]:
            lat = round(lat, 1)
            lon = round(lon, 1)
        else:
            lat = round(lat, 4)
            lon = round(lon, 4)

        occurrences.append({
            "gbifID": str(gid),
            "decimalLatitude": lat,
            "decimalLongitude": lon,
            "eventDate": ed,
            "datasetKey": r.get('datasetKey') or ds_key,
            "license": r.get('license') or sp_def['dataset_license'],
            "basisOfRecord": r.get('basisOfRecord') or "MACHINE_OBSERVATION",
            "countryCode": r.get('countryCode') or "",
            "coordinateUncertaintyInMeters": r.get('coordinateUncertaintyInMeters'),
            "retrieved_at": now_iso
        })

    print(f"Saved {len(occurrences)} verified occurrences preserving 10-field schema")
    occ_file = f"data/generated/occurrences/{sp_id}.json"
    pub_occ_file = f"public/data/generated/occurrences/{sp_id}.json"
    with open(occ_file, 'w', encoding='utf-8') as f:
        json.dump(occurrences, f, indent=2)
    with open(pub_occ_file, 'w', encoding='utf-8') as f:
        json.dump(occurrences, f, indent=2)

    avonet_trait = avonet.get(sci_name, {})
    species_ingestion_summary.append({
        "species_id": sp_id,
        "scientific_name": sci_name,
        "common_name": sp_def['common_name'],
        "gbif_taxon_key": taxon_key,
        "family": avonet_trait.get('family', 'Aves'),
        "hwi": avonet_trait.get('hwi'),
        "migration": avonet_trait.get('migration'),
        "tracked_individuals": len(features),
        "total_points": total_simplified_points,
        "occurrence_count": len(occurrences),
        "movement_type": sp_def['movement_type'],
        "movement_label": sp_def['movement_label'],
        "color": sp_def['color'],
        "hex": sp_def['hex'],
        "dataset_key": ds_key,
        "dataset_title": sp_def['dataset_title'],
        "dataset_doi": sp_def['dataset_doi'],
        "dataset_license": sp_def['dataset_license']
    })

# 4. Update data/generated/registry.json and public/data/generated/registry.json
print("\nUpdating registry.json...")
reg_file = 'data/generated/registry.json'
with open(reg_file, 'r', encoding='utf-8') as f:
    registry = json.load(f)

existing_ids = {s['species_id'] for s in registry['species']}

for s in species_ingestion_summary:
    sp_id = s['species_id']
    record = {
        "species_id": sp_id,
        "gbif_taxon_key": s['gbif_taxon_key'],
        "scientific_name": s['scientific_name'],
        "common_name": s['common_name'],
        "family": s['family'],
        "monitoring_group": "review_required",
        "last_checked_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": None,
        "traits": {
            "hand_wing_index": s['hwi'],
            "migration_category": s['migration'],
            "source": "AVONET (Tobias et al. 2022)",
            "source_version": "AVONET1_BirdLife.csv",
            "matched": s['hwi'] is not None
        },
        "stats": {
            "requested_records": s['occurrence_count'],
            "received_records": s['occurrence_count'],
            "short": False
        },
        "evidence_level": "tracks",
        "movement_type": s['movement_type'],
        "movement_label": s['movement_label'],
        "sensitive_coarsened": True,
        "tracked_individuals": s['tracked_individuals'],
        "occurrence_count": s['occurrence_count']
    }
    if sp_id in existing_ids:
        # Update existing
        for idx, item in enumerate(registry['species']):
            if item['species_id'] == sp_id:
                registry['species'][idx] = record
    else:
        registry['species'].append(record)

registry['species_count'] = len(registry['species'])
registry['generated_at'] = datetime.datetime.now(datetime.timezone.utc).isoformat()

with open('data/generated/registry.json', 'w', encoding='utf-8') as f:
    json.dump(registry, f, indent=2)
with open('public/data/generated/registry.json', 'w', encoding='utf-8') as f:
    json.dump(registry, f, indent=2)

print(f"Registry updated: Total species = {registry['species_count']}")

# Print summary table
print("\n" + "="*80)
print(f"{'Species':<25} | {'Common Name':<22} | {'Tracked Birds':<14} | {'Points':<8} | {'Occurrences'}")
print("="*80)
for s in species_ingestion_summary:
    print(f"{s['scientific_name']:<25} | {s['common_name']:<22} | {s['tracked_individuals']:<14} | {s['total_points']:<8} | {s['occurrence_count']}")
