import urllib.request
import json
import csv
import time
import os

headers = {"User-Agent": "Outrun/1.0 (Migratory Birds Observatory Research; contact@outrun.org)"}

def fetch_json(url, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            if attempt == retries - 1:
                return None
            time.sleep(1 + attempt)
    return None

# 1. Load AVONET
print("[1/5] Loading AVONET trait database...")
avonet = {}
with open('data/avonet/AVONET1_BirdLife.csv', 'r', encoding='utf-8', errors='ignore') as f:
    reader = csv.DictReader(f)
    for r in reader:
        sp = r.get('Species1')
        mig = r.get('Migration')
        hwi = r.get('Hand-Wing.Index')
        if sp:
            try:
                avonet[sp] = {
                    'migration': int(float(mig)) if mig else None,
                    'hwi': float(hwi) if hwi else None
                }
            except:
                pass
print(f"Loaded {len(avonet)} species from AVONET.")

# 2. Seed species keys & names
seed_species = {
    'Falco amurensis': 2480998,
    'Limosa lapponica': 2481681,
    'Sterna paradisaea': 5229230,
    'Leucogeranus leucogeranus': 9578665,
    'Ciconia ciconia': 2481912,
    'Hirundo rustica': 2492476,
    'Calidris canutus': 2481755,
    'Anser indicus': 2498028,
    'Cuculus canorus': 2496259,
    'Oenanthe oenanthe': 5231204,
    'Numenius phaeopus': 2481783,
    'Grus grus': 2474950,
    'Pandion haliaetus': 2480577,
}
seed_species_keys = set(seed_species.values())
seed_species_names = set(seed_species.keys())

# 3. Get Top 100 datasets with MACHINE_OBSERVATION for Aves
print("[2/5] Querying GBIF Occurrence Facet API for top 100 machine observation datasets for Aves...")
facet_url = "https://api.gbif.org/v1/occurrence/search?taxonKey=212&basisOfRecord=MACHINE_OBSERVATION&hasCoordinate=true&limit=0&facet=datasetKey&facetLimit=100"
facet_res = fetch_json(facet_url)

if not facet_res or 'facets' not in facet_res or not facet_res['facets']:
    print("Failed to get facets from GBIF.")
    exit(1)

dataset_counts = facet_res['facets'][0]['counts']
print(f"Retrieved {len(dataset_counts)} candidate datasets.")

# Cache for speciesKey -> canonicalName
species_cache = {}

def get_species_name(sp_key):
    if sp_key in species_cache:
        return species_cache[sp_key]
    sp_url = f"https://api.gbif.org/v1/species/{sp_key}"
    sp_res = fetch_json(sp_url)
    if sp_res:
        name = sp_res.get('canonicalName') or sp_res.get('scientificName')
        species_cache[sp_key] = name
        return name
    return None

results = {
    "total_evaluated": len(dataset_counts),
    "accepted": [],
    "skipped": []
}

print(f"[3/5] Evaluating {len(dataset_counts)} candidate datasets...")

allowed_licenses = [
    'http://creativecommons.org/publicdomain/zero/1.0/legalcode',
    'http://creativecommons.org/licenses/by/4.0/legalcode',
    'http://creativecommons.org/licenses/by-nc/4.0/legalcode',
]

for idx, item in enumerate(dataset_counts):
    ds_key = item['name']
    obs_count = item['count']

    # Fetch dataset metadata
    ds_url = f"https://api.gbif.org/v1/dataset/{ds_key}"
    ds_meta = fetch_json(ds_url)
    if not ds_meta:
        results['skipped'].append({
            'datasetKey': ds_key,
            'obs_count': obs_count,
            'reason': 'Failed to fetch dataset metadata from GBIF'
        })
        continue

    title = ds_meta.get('title', 'Untitled')
    license_val = ds_meta.get('license', '')
    doi = ds_meta.get('doi', '')
    citation = ds_meta.get('citation', {}).get('text') if isinstance(ds_meta.get('citation'), dict) else str(ds_meta.get('citation') or '')

    # Check licence
    is_open = False
    if license_val:
        for al in allowed_licenses:
            if al in license_val.lower() or 'by-nc' in license_val.lower() or 'cc-by' in license_val.lower() or 'cc0' in license_val.lower():
                is_open = True
                break

    if not is_open:
        results['skipped'].append({
            'datasetKey': ds_key,
            'title': title,
            'license': license_val or 'Unspecified/Restricted',
            'obs_count': obs_count,
            'reason': f"Non-permissive or unspecified licence: {license_val}"
        })
        continue

    # Query species in this dataset
    sp_facet_url = f"https://api.gbif.org/v1/occurrence/search?datasetKey={ds_key}&taxonKey=212&basisOfRecord=MACHINE_OBSERVATION&hasCoordinate=true&limit=0&facet=speciesKey&facetLimit=25"
    sp_facet_res = fetch_json(sp_facet_url)

    candidate_sp_keys = []
    if sp_facet_res and sp_facet_res.get('facets'):
        candidate_sp_keys = [c['name'] for c in sp_facet_res['facets'][0].get('counts', [])]

    matched_seeds = []
    matched_avonet_migratory = []

    for sp_k in candidate_sp_keys:
        try:
            sp_k_int = int(sp_k)
        except:
            continue
        
        sp_name = get_species_name(sp_k_int)
        if not sp_name:
            continue

        if sp_k_int in seed_species_keys or sp_name in seed_species_names:
            matched_seeds.append({
                'speciesKey': sp_k_int,
                'name': sp_name,
                'is_seed': True
            })
        
        # Check AVONET migration category 3
        if sp_name in avonet:
            tr = avonet[sp_name]
            if tr.get('migration') == 3:
                matched_avonet_migratory.append({
                    'speciesKey': sp_k_int,
                    'name': sp_name,
                    'hwi': tr.get('hwi'),
                    'migration': 3
                })

    if matched_seeds or matched_avonet_migratory:
        entry = {
            'datasetKey': ds_key,
            'title': title,
            'doi': doi,
            'citation': citation,
            'license': license_val,
            'obs_count': obs_count,
            'matched_seed_species': matched_seeds,
            'matched_avonet_migratory': matched_avonet_migratory[:5], # top 5
            'total_species_in_facet': len(candidate_sp_keys)
        }
        results['accepted'].append(entry)
        print(f"  [{idx+1}/100] ACCEPTED: {title[:50]}... | Seeds: {[s['name'] for s in matched_seeds]} | Migratory: {[m['name'] for m in matched_avonet_migratory[:3]]}")
    else:
        results['skipped'].append({
            'datasetKey': ds_key,
            'title': title,
            'license': license_val,
            'obs_count': obs_count,
            'reason': f"No seed species or AVONET category 3 migratory birds in top {len(candidate_sp_keys)} species"
        })

    time.sleep(0.15) # Polite rate limit

print(f"\n[4/5] Evaluation complete. Accepted: {len(results['accepted'])}, Skipped: {len(results['skipped'])}")

# Save evaluation report
with open('data/generated/candidate_evaluation.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2)

print("[5/5] Report written to data/generated/candidate_evaluation.json")
