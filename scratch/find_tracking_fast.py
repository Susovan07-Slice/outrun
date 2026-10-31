import urllib.request
import json
import csv
import time
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed

sys.stdout.reconfigure(line_buffering=True)

headers = {"User-Agent": "Outrun/1.0 (Migratory Birds Research; contact@outrun.org)"}

def fetch_json(url, retries=2):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=12) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except Exception:
            time.sleep(0.3)
    return None

# 1. Load AVONET Migration=3 species
print("Loading AVONET traits...", flush=True)
avonet_migratory = {}
with open('data/avonet/AVONET1_BirdLife.csv', 'r', encoding='utf-8', errors='ignore') as f:
    reader = csv.DictReader(f)
    for r in reader:
        sp = r.get('Species1')
        mig = r.get('Migration')
        hwi = r.get('Hand-Wing.Index')
        if sp and mig:
            try:
                if int(float(mig)) == 3:
                    avonet_migratory[sp] = float(hwi) if hwi else None
            except:
                pass
print(f"Loaded {len(avonet_migratory)} migratory bird species (Migration=3) from AVONET.", flush=True)

# 2. Seed species keys map
seed_species_map = {
    2480998: "Falco amurensis",
    2481681: "Limosa lapponica",
    5229230: "Sterna paradisaea",
    9578665: "Leucogeranus leucogeranus",
    2481912: "Ciconia ciconia",
    2492476: "Hirundo rustica",
    2481755: "Calidris canutus",
    2498028: "Anser indicus",
    2496259: "Cuculus canorus",
    5231204: "Oenanthe oenanthe",
    2481783: "Numenius phaeopus",
    2474950: "Grus grus",
    2480577: "Pandion haliaetus",
}

def is_license_permitted(lic_str):
    if not lic_str:
        return False
    l = lic_str.lower()
    if '/by-nd/' in l or 'all rights reserved' in l:
        return False
    allowed_terms = ['publicdomain/zero', '/zero/', 'cc0', '/by/', '/by-nc/', '/by-sa/', '/by-nc-sa/', 'cc-by']
    return any(t in l for t in allowed_terms)

# 3. Query GBIF Occurrence Facet API
print("Querying GBIF Occurrence Facet API for top 100 machine observation datasets...", flush=True)
facet_url = "https://api.gbif.org/v1/occurrence/search?taxonKey=212&basisOfRecord=MACHINE_OBSERVATION&hasCoordinate=true&limit=0&facet=datasetKey&facetLimit=100"
facet_res = fetch_json(facet_url)

if not facet_res or 'facets' not in facet_res or not facet_res['facets']:
    print("Failed to get facet results.")
    sys.exit(1)

dataset_counts = facet_res['facets'][0]['counts']
print(f"Retrieved {len(dataset_counts)} candidate datasets from GBIF.", flush=True)

species_name_cache = {}

def get_species_name(sp_key):
    if sp_key in species_name_cache:
        return species_name_cache[sp_key]
    res = fetch_json(f"https://api.gbif.org/v1/species/{sp_key}")
    if res:
        name = res.get('canonicalName') or res.get('scientificName')
        species_name_cache[sp_key] = name
        return name
    return None

def evaluate_dataset(item):
    ds_key = item['name']
    obs_count = item['count']

    ds_meta = fetch_json(f"https://api.gbif.org/v1/dataset/{ds_key}")
    if not ds_meta:
        return {
            'status': 'skipped',
            'datasetKey': ds_key,
            'obs_count': obs_count,
            'reason': 'GBIF dataset metadata endpoint failed'
        }

    title = ds_meta.get('title', 'Untitled')
    license_val = ds_meta.get('license', '')
    doi = ds_meta.get('doi', '')
    citation = ds_meta.get('citation', {}).get('text') if isinstance(ds_meta.get('citation'), dict) else str(ds_meta.get('citation') or '')

    if not is_license_permitted(license_val):
        return {
            'status': 'skipped',
            'datasetKey': ds_key,
            'title': title,
            'doi': doi,
            'license': license_val or 'Unspecified',
            'obs_count': obs_count,
            'reason': f"Licence not permitted for non-commercial reuse ({license_val})"
        }

    # Query top species in dataset
    sp_facet = fetch_json(f"https://api.gbif.org/v1/occurrence/search?datasetKey={ds_key}&taxonKey=212&basisOfRecord=MACHINE_OBSERVATION&hasCoordinate=true&limit=0&facet=speciesKey&facetLimit=10")
    candidate_sp_keys = []
    if sp_facet and sp_facet.get('facets'):
        candidate_sp_keys = [c['name'] for c in sp_facet['facets'][0].get('counts', [])]

    matched_seeds = []
    matched_migratory = []

    for sp_k_str in candidate_sp_keys:
        try:
            sp_k = int(sp_k_str)
        except:
            continue

        if sp_k in seed_species_map:
            matched_seeds.append({
                'speciesKey': sp_k,
                'name': seed_species_map[sp_k],
                'is_seed': True
            })
            continue

        sp_name = get_species_name(sp_k)
        if sp_name and sp_name in avonet_migratory:
            matched_migratory.append({
                'speciesKey': sp_k,
                'name': sp_name,
                'hwi': avonet_migratory[sp_name],
                'migration': 3
            })

    if matched_seeds or matched_migratory:
        return {
            'status': 'accepted',
            'datasetKey': ds_key,
            'title': title,
            'doi': doi,
            'citation': citation,
            'license': license_val,
            'obs_count': obs_count,
            'matched_seed_species': matched_seeds,
            'matched_migratory_species': matched_migratory,
            'total_species_in_facet': len(candidate_sp_keys)
        }
    else:
        return {
            'status': 'skipped',
            'datasetKey': ds_key,
            'title': title,
            'doi': doi,
            'license': license_val,
            'obs_count': obs_count,
            'reason': f"No seed species or AVONET category 3 migratory birds in top {len(candidate_sp_keys)} species"
        }

print("Evaluating 100 datasets in parallel (8 workers)...", flush=True)
results = {
    "total_evaluated": len(dataset_counts),
    "accepted": [],
    "skipped": []
}

with ThreadPoolExecutor(max_workers=8) as executor:
    future_to_item = {executor.submit(evaluate_dataset, item): item for item in dataset_counts}
    completed_count = 0
    for future in as_completed(future_to_item):
        completed_count += 1
        res = future.result()
        if res['status'] == 'accepted':
            results['accepted'].append(res)
            seeds = [s['name'] for s in res.get('matched_seed_species', [])]
            migs = [m['name'] for m in res.get('matched_migratory_species', [])]
            print(f"[{completed_count}/100] ACCEPTED: {res['title'][:45]}... | Seeds: {seeds} | Migratory: {migs[:3]}", flush=True)
        else:
            results['skipped'].append(res)
            print(f"[{completed_count}/100] SKIPPED: {res.get('title', res['datasetKey'])[:45]}... ({res['reason'][:50]})", flush=True)

print("\n=== EVALUATION COMPLETE ===", flush=True)
print(f"Total evaluated: {results['total_evaluated']}", flush=True)
print(f"Accepted datasets: {len(results['accepted'])}", flush=True)
print(f"Skipped datasets: {len(results['skipped'])}", flush=True)

# Sort accepted by obs_count desc
results['accepted'].sort(key=lambda x: x['obs_count'], reverse=True)

with open('data/generated/candidate_evaluation.json', 'w', encoding='utf-8') as f:
    json.dump(results, f, indent=2)

print("Saved report to data/generated/candidate_evaluation.json", flush=True)
