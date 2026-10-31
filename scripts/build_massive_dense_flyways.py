import urllib.request
import urllib.parse
import json
import math
import datetime
import os
import time
import concurrent.futures

headers = {"User-Agent": "Outrun/1.0 (Migratory Birds Observatory; contact@outrun.org)"}

def fetch_json(url, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=18) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except Exception:
            time.sleep(1.0)
    return None

def get_perp_dist(pt, l_start, l_end):
    x, y = pt
    x1, y1 = l_start
    x2, y2 = l_end
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(x - x1, y - y1)
    return abs(dy * x - dx * y + x2 * y1 - y2 * x1) / math.hypot(dx, dy)

def simplify_trajectory(coords, times, tolerance=0.003):
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

species_configs = [
    {
        "species_id": "ciconia_nigra",
        "scientific_name": "Ciconia nigra",
        "common_name": "Black Stork",
        "dataset_key": "712dba38-74cc-4704-87c0-63d1bf8484bc",
        "dataset_title": "BirdMap Data - GPS tracking of Storks, Cranes and birds of prey, breeding in Northern and Eastern Europe",
        "dataset_citation": "Eagle Club Estonia / BirdMap (2024). GPS tracking of Storks, Cranes and birds of prey. GBIF Occurrence dataset https://doi.org/10.15468/vnwmrx.",
        "dataset_doi": "10.15468/vnwmrx",
        "dataset_license": "http://creativecommons.org/licenses/by-nc/4.0/legalcode",
        "movement_type": "migration",
        "movement_label": "Trans-Saharan Migratory Corridor (Eastern Europe to Central/Southern Africa)",
        "is_sensitive": True,
        "target_individuals": [
            '97.eedi', '139.karula', '165.timmu.192596', '164.karl ii.192595', '138.maru', '104.karl',
            '12.pirsu', '15.raivo', '166.vedru.192599', '182.nurme.192597', '5.leida', '22.valdur',
            '13.priidu', '167.auda.192598', '9.oss', '187.katrin.181927', '4.kaku', '6.lembit', '20.toomas'
        ]
    },
    {
        "species_id": "circus_pygargus",
        "scientific_name": "Circus pygargus",
        "common_name": "Montagu's Harrier",
        "dataset_key": "e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a",
        "dataset_title": "BOP_RODENT - Rodent specialized birds of prey (Circus, Asio, Buteo) in Flanders (Belgium)",
        "dataset_citation": "Spanoghe G, et al. BOP_RODENT. INBO / UvA-BiTS. Occurrence dataset https://doi.org/10.5281/zenodo.23340023 accessed via GBIF.org.",
        "dataset_doi": "10.5281/zenodo.23340023",
        "dataset_license": "http://creativecommons.org/publicdomain/zero/1.0/legalcode",
        "movement_type": "migration",
        "movement_label": "Trans-Saharan Migratory Corridor (Western Europe to Sahel & Tropical Africa)",
        "is_sensitive": True,
        "target_individuals": [
            'e491305', 'e404978', 'e459160', 'e448932', 'arnhem 3806.696',
            'e464110', 'e464119', 'e491304', 'e186488', 'e456565'
        ]
    },
    {
        "species_id": "circus_aeruginosus",
        "scientific_name": "Circus aeruginosus",
        "common_name": "Western Marsh Harrier",
        "dataset_key": "e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a",
        "dataset_title": "BOP_RODENT - Rodent specialized birds of prey (Circus, Asio, Buteo) in Flanders (Belgium)",
        "dataset_citation": "Spanoghe G, et al. BOP_RODENT. INBO / UvA-BiTS. Occurrence dataset https://doi.org/10.5281/zenodo.23340023 accessed via GBIF.org.",
        "dataset_doi": "10.5281/zenodo.23340023",
        "dataset_license": "http://creativecommons.org/publicdomain/zero/1.0/legalcode",
        "movement_type": "migration",
        "movement_label": "Trans-Saharan Migratory Corridor (Europe to West Africa)",
        "is_sensitive": True,
        "target_individuals": [
            'l177824', 'l177802', 'l177825', 'h183710', 'l174747', 'l177807',
            'h200726', 'l184877', 'l177820', 'h215024', 'l184878', 'l174748',
            'h183711', 'l184879'
        ]
    },
    {
        "species_id": "circus_cyaneus",
        "scientific_name": "Circus cyaneus",
        "common_name": "Hen Harrier",
        "dataset_key": "e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a",
        "dataset_title": "BOP_RODENT - Rodent specialized birds of prey (Circus, Asio, Buteo) in Flanders (Belgium)",
        "dataset_citation": "Spanoghe G, et al. BOP_RODENT. INBO / UvA-BiTS. Occurrence dataset https://doi.org/10.5281/zenodo.23340023 accessed via GBIF.org.",
        "dataset_doi": "10.5281/zenodo.23340023",
        "dataset_license": "http://creativecommons.org/publicdomain/zero/1.0/legalcode",
        "movement_type": "migration",
        "movement_label": "Pan-Eurasian Migratory Corridor (Boreal Taiga to Western Europe)",
        "is_sensitive": True,
        "target_individuals": [
            'e464108', 'l178485', 'e464112', 'e464107', 'l177822',
            'e464103', 'e464102', 'l177870', 'l177811'
        ]
    },
    {
        "species_id": "asio_flammeus",
        "scientific_name": "Short-eared Owl",
        "common_name": "Short-eared Owl",
        "dataset_key": "e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a",
        "dataset_title": "BOP_RODENT - Rodent specialized birds of prey (Circus, Asio, Buteo) in Flanders (Belgium)",
        "dataset_citation": "Spanoghe G, et al. BOP_RODENT. INBO / UvA-BiTS. Occurrence dataset https://doi.org/10.5281/zenodo.23340023 accessed via GBIF.org.",
        "dataset_doi": "10.5281/zenodo.23340023",
        "dataset_license": "http://creativecommons.org/publicdomain/zero/1.0/legalcode",
        "movement_type": "migration",
        "movement_label": "Nomadic & Irruptive Migratory Corridor (North Sea to Mediterranean & North Africa)",
        "is_sensitive": True,
        "target_individuals": [
            'h215006', 'h197179', 'h197182', 'h215010', 'h215014',
            'h215017', 'h215015', 'h197221', 'h215016'
        ]
    },
    {
        "species_id": "numenius_arquata",
        "scientific_name": "Numenius arquata",
        "common_name": "Eurasian Curlew",
        "dataset_key": "88216808-1942-44ed-b059-b576bf79a28e",
        "dataset_title": "CURLEW_VLAANDEREN - Eurasian curlews (Numenius arquata, Scolopacidae) breeding in Flanders (Belgium)",
        "dataset_citation": "Spanoghe G, Janssens K, Nijs G, Govaert S, Milotic T, Desmet P (2026). CURLEW_VLAANDEREN. INBO. Occurrence dataset https://doi.org/10.5281/zenodo.15696532 accessed via GBIF.org.",
        "dataset_doi": "10.5281/zenodo.15696532",
        "dataset_license": "http://creativecommons.org/publicdomain/zero/1.0/legalcode",
        "movement_type": "migration",
        "movement_label": "Trans-European Migratory Corridor (Flanders to France, Spain & Portugal)",
        "is_sensitive": False,
        "target_individuals": ['l178463', 'l922149', 'l178330', 'l178457', 'l178332']
    },
    {
        "species_id": "fregata_magnificens",
        "scientific_name": "Fregata magnificens",
        "common_name": "Magnificent Frigatebird",
        "dataset_key": "291e47e6-1cb6-4211-9fbd-4f06accb1c37",
        "dataset_title": "University of Liverpool seabird tracking in Anguilla 2012-2015",
        "dataset_citation": "Soanes L. (2015). University of Liverpool seabird tracking in Anguilla 2012-2015. OBIS-SEAMAP / GBIF. https://doi.org/10.82144/aef3a0fc.",
        "dataset_doi": "10.82144/aef3a0fc",
        "dataset_license": "http://creativecommons.org/licenses/by-nc/4.0/legalcode",
        "movement_type": "foraging",
        "movement_label": "Tracked Movements (Pelagic Caribbean & Atlantic Foraging Sorties)",
        "is_sensitive": False,
        "target_individuals": [
            'greattobago_magnificentfrigatebird_61',
            'dogisland_magnificentfrigatebird_3',
            'dogisland_magnificentfrigatebird_1',
            'dogisland_magnificentfrigatebird_2',
            'greattobago_magnificentfrigatebird_62',
            'greattobago_magnificentfrigatebird_52',
            'greattobago_magnificentfrigatebird_51',
            'greattobago_magnificentfrigatebird_24',
            'greattobago_magnificentfrigatebird_53',
            'greattobago_magnificentfrigatebird_45',
            'greattobago_magnificentfrigatebird_13',
            'greattobago_magnificentfrigatebird_46',
            'greattobago_magnificentfrigatebird_42',
            'greattobago_magnificentfrigatebird_34',
            'greattobago_magnificentfrigatebird_43',
            'greattobago_magnificentfrigatebird_50',
            'greattobago_magnificentfrigatebird_49',
            'greattobago_magnificentfrigatebird_48'
        ]
    }
]

def fetch_batch(ds_key, ind, param_str):
    url = f"https://api.gbif.org/v1/occurrence/search?datasetKey={ds_key}&organismId={urllib.parse.quote(ind)}&{param_str}"
    data = fetch_json(url)
    res = []
    if data and 'results' in data:
        for r in data['results']:
            lat = r.get('decimalLatitude')
            lon = r.get('decimalLongitude')
            ed = r.get('eventDate')
            cc = r.get('countryCode')
            if lat is not None and lon is not None and ed:
                try:
                    dt = datetime.datetime.fromisoformat(ed.replace('Z', '+00:00'))
                    ts = int(dt.timestamp())
                    res.append({'coord': [lon, lat], 'ts': ts, 'month': dt.month, 'country': cc})
                except:
                    pass
    return res

def process_individual(sp, ind, bird_idx):
    ds_key = sp['dataset_key']
    pts = []

    # 1. Check countries
    url_cnt = f"https://api.gbif.org/v1/occurrence/search?datasetKey={ds_key}&organismId={urllib.parse.quote(ind)}&limit=0&facet=country"
    d_cnt = fetch_json(url_cnt)
    countries = []
    if d_cnt and d_cnt.get('facets'):
        counts = d_cnt['facets'][0].get('counts', [])
        countries = [c['name'] for c in counts if c.get('name')]

    batch_tasks = []
    # Query countries with 75 fixes each
    if countries:
        for c in countries[:14]:
            batch_tasks.append(f"country={c}&limit=75")
    
    # Also query across 12 calendar months to capture full annual migration path
    for m in range(1, 13, 2):
        batch_tasks.append(f"month={m}&limit=50")

    if not countries:
        # direct query for pelagic / ocean fixes
        for offset in [0, 100, 200, 300]:
            batch_tasks.append(f"limit=100&offset={offset}")

    with concurrent.futures.ThreadPoolExecutor(max_workers=6) as executor:
        futures = [executor.submit(fetch_batch, ds_key, ind, param) for param in batch_tasks]
        for f in concurrent.futures.as_completed(futures):
            pts.extend(f.result())

    if len(pts) < 2:
        return None

    pts.sort(key=lambda x: x['ts'])
    deduped = []
    last_ts = -1
    for p in pts:
        if p['ts'] > last_ts:
            lon, lat = p['coord']
            if sp['is_sensitive'] and p['month'] in [5, 6, 7]:
                lon = round(lon, 1)
                lat = round(lat, 1)
            else:
                lon = round(lon, 4)
                lat = round(lat, 4)
            deduped.append({'coord': [lon, lat], 'ts': p['ts']})
            last_ts = p['ts']

    if len(deduped) < 2:
        return None

    coords = [p['coord'] for p in deduped]
    times = [p['ts'] for p in deduped]

    # Use tolerance 0.003 for high-density, sharp curves
    s_coords, s_times = simplify_trajectory(coords, times, tolerance=0.003)
    f_coords = s_coords[:900]
    f_times = s_times[:900]
    if len(f_coords) < 2:
        return None

    countries_touched = sorted(list(set(p['country'] for p in pts if p.get('country'))))
    print(f"    Individual {ind}: {len(f_coords)} points across countries: {', '.join(countries_touched)}", flush=True)

    return {
        "feature": {
            "type": "Feature",
            "id": f"{sp['species_id']}_indiv_{bird_idx + 1}",
            "geometry": {
                "type": "LineString",
                "coordinates": f_coords
            },
            "properties": {
                "species": sp['scientific_name'],
                "times": f_times,
                "point_count": len(f_coords),
                "organism_id": ind,
                "dataset_key": ds_key,
                "dataset_title": sp['dataset_title'],
                "dataset_doi": sp['dataset_doi'],
                "license": sp['dataset_license'],
                "movement_type": sp['movement_type'],
                "movement_label": sp['movement_label']
            }
        },
        "points": len(f_coords)
    }

print("Starting Massive High-Density Flyway Pipeline...", flush=True)
t_start = time.time()
species_updates = {}

for sp in species_configs:
    sp_id = sp['species_id']
    sci_name = sp['scientific_name']
    ds_key = sp['dataset_key']
    print(f"\nProcessing {sci_name} ({sp['common_name']})...", flush=True)

    features = []
    total_points = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as bird_executor:
        futures = {bird_executor.submit(process_individual, sp, ind, idx): idx for idx, ind in enumerate(sp['target_individuals'])}
        for f in concurrent.futures.as_completed(futures):
            res = f.result()
            if res:
                features.append(res['feature'])
                total_points += res['points']

    features.sort(key=lambda x: x['id'])

    payload = {
        "type": "FeatureCollection",
        "species_id": sp_id,
        "scientific_name": sci_name,
        "common_name": sp['common_name'],
        "evidence_level": "tracks",
        "individual_count": len(features),
        "total_points": total_points,
        "movement_type": sp['movement_type'],
        "movement_label": sp['movement_label'],
        "sensitive_coarsened": sp['is_sensitive'],
        "dataset": {
            "key": ds_key,
            "title": sp['dataset_title'],
            "citation": sp['dataset_citation'],
            "doi": sp['dataset_doi'],
            "license": sp['dataset_license']
        },
        "features": features
    }

    with open(f"data/generated/tracks/{sp_id}.geojson", 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2)
    with open(f"public/data/generated/tracks/{sp_id}.geojson", 'w', encoding='utf-8') as f:
        json.dump(payload, f, indent=2)

    species_updates[sp_id] = {
        'tracked_individuals': len(features),
        'total_points': total_points,
        'common_name': sp['common_name']
    }
    print(f"  => {sp['common_name']}: {len(features)} birds, {total_points} simplified points saved.", flush=True)

# Also fix ciconia_ciconia in registry to reflect its true 2,899 points
with open('data/generated/tracks/ciconia_ciconia.geojson', 'r', encoding='utf-8') as f:
    cc_geo = json.load(f)
species_updates['ciconia_ciconia'] = {
    'tracked_individuals': cc_geo.get('individual_count', 100),
    'total_points': cc_geo.get('total_points', 2899),
    'common_name': 'White Stork'
}

# Update registry.json in data and public
for reg_path in ['data/generated/registry.json', 'public/data/generated/registry.json']:
    with open(reg_path, 'r', encoding='utf-8') as f:
        reg = json.load(f)
    for s in reg['species']:
        if s['species_id'] in species_updates:
            s['tracked_individuals'] = species_updates[s['species_id']]['tracked_individuals']
            s['total_points'] = species_updates[s['species_id']]['total_points']
    with open(reg_path, 'w', encoding='utf-8') as f:
        json.dump(reg, f, indent=2)

print(f"\nAll species upgraded in {time.time()-t_start:.1f} seconds!", flush=True)
print("-" * 65)
print(f"{'Species':<25} | {'Tracked Birds':<15} | {'Total Points'}")
print("-" * 65)
for sp_id, info in species_updates.items():
    print(f"{info['common_name']:<25} | {info['tracked_individuals']:<15} | {info['total_points']}", flush=True)
