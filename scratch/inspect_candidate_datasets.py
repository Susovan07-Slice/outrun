import urllib.request
import json
import datetime

headers = {"User-Agent": "Outrun/1.0 (Migratory Birds Observatory; contact@outrun.org)"}

datasets = [
    {
        "key": "e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a",
        "name": "BOP_RODENT",
        "license_stated": "CC0"
    },
    {
        "key": "88216808-1942-44ed-b059-b576bf79a28e",
        "name": "CURLEW_VLAANDEREN",
        "license_stated": "CC0"
    },
    {
        "key": "299e7998-73f0-42ff-9fb7-d8a5a0cc44d1",
        "name": "CREX_VLAANDEREN",
        "license_stated": "CC0"
    },
    {
        "key": "3a3c40ec-fb9b-4de3-aa32-4c8a2e101d16",
        "name": "ARMENIAN_GULL",
        "license_stated": "CC0"
    },
    {
        "key": "291e47e6-1cb6-4211-9fbd-4f06accb1c37",
        "name": "Liverpool Anguilla seabirds",
        "license_stated": "CC-BY-NC"
    }
]

def fetch_json(url):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode('utf-8'))

for ds in datasets:
    key = ds['key']
    print("=" * 80)
    print(f"DATASET: {ds['name']} ({key})")
    print("=" * 80)
    
    # 1. Dataset metadata
    meta = fetch_json(f"https://api.gbif.org/v1/dataset/{key}")
    title = meta.get('title')
    license_url = meta.get('license')
    doi = meta.get('doi')
    citation = meta.get('citation', {}).get('text') if isinstance(meta.get('citation'), dict) else meta.get('citation')
    print(f"Title: {title}")
    print(f"DOI: {doi}")
    print(f"Licence: {license_url}")
    print(f"Citation: {citation}")
    
    # 2. Occurrence search with facets
    search_url = f"https://api.gbif.org/v1/occurrence/search?datasetKey={key}&facet=basisOfRecord&facet=speciesKey&limit=5"
    res = fetch_json(search_url)
    total_records = res.get('count', 0)
    print(f"Total Occurrence Records: {total_records:,}")
    
    # Facets
    facets = {f['field']: f['counts'] for f in res.get('facets', [])}
    bor_counts = facets.get('BASIS_OF_RECORD', [])
    print(f"basisOfRecord values: {bor_counts}")
    sp_counts = facets.get('SPECIES_KEY', [])
    print(f"speciesKey counts (top species): {sp_counts[:5]}")
    
    # Inspect individual identifier and time range from sample records
    # Fetch 20 records sorted by date to calculate typical interval between fixes
    sample_records = res.get('results', [])
    print("\n--- 5 Sample Rows ---")
    for r in sample_records[:5]:
        print(f"  gbifID: {r.get('gbifID')} | species: {r.get('species')} | lat: {r.get('decimalLatitude')} | lon: {r.get('decimalLongitude')} | date: {r.get('eventDate')} | organismID: {r.get('organismID')} | eventID: {r.get('eventID')}")
    
    # Fetch chronological records for one organism to check fix intervals
    first_organism = sample_records[0].get('organismID') if sample_records else None
    first_species = sample_records[0].get('species') if sample_records else None
    
    # Check organism count
    org_search_url = f"https://api.gbif.org/v1/occurrence/search?datasetKey={key}&facet=organismID&facetLimit=100&limit=0"
    org_res = fetch_json(org_search_url)
    org_facets = org_res.get('facets', [])
    org_counts = org_facets[0].get('counts', []) if org_facets else []
    print(f"\nNumber of Tracked Individuals (distinct organismID): {len(org_counts)}")
    if org_counts:
        print(f"Sample individuals: {[o['name'] for o in org_counts[:5]]}")
        
    # Calculate time range and typical interval between fixes
    # Query min and max dates
    date_search_url = f"https://api.gbif.org/v1/occurrence/search?datasetKey={key}&limit=20&organismID={org_counts[0]['name'] if org_counts else ''}"
    if org_counts:
        org_data = fetch_json(date_search_url)
        dates = []
        for rec in org_data.get('results', []):
            ed = rec.get('eventDate')
            if ed:
                try:
                    # Clean ISO date
                    dt = datetime.datetime.fromisoformat(ed.replace('Z', '+00:00'))
                    dates.append(dt)
                except:
                    pass
        dates.sort()
        if len(dates) >= 2:
            intervals = [(dates[i+1] - dates[i]).total_seconds() for i in range(len(dates)-1) if (dates[i+1] - dates[i]).total_seconds() > 0]
            if intervals:
                median_interval = sorted(intervals)[len(intervals)//2]
                print(f"Typical interval between fixes (sample individual {org_counts[0]['name']}): {median_interval:.0f} seconds ({median_interval/60:.1f} mins)")
        if dates:
            print(f"Sample individual date range: {dates[0]} to {dates[-1]}")
            
    print("\n")
