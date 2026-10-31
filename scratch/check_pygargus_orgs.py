import urllib.request
import json

bop_key = 'e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a'
url = f'https://api.gbif.org/v1/occurrence/search?datasetKey={bop_key}&taxonKey=2480479&limit=50'
with urllib.request.urlopen(url) as r:
    d = json.loads(r.read().decode())
    res = d.get('results', [])
    orgs = set(r.get('organismID') for r in res if r.get('organismID'))
    print(f"Sample Circus pygargus organismIDs: {orgs}")

# Also facet on organismId with taxonKey=2480479
url_facet = f'https://api.gbif.org/v1/occurrence/search?datasetKey={bop_key}&taxonKey=2480479&limit=0&facet=organismId&facetLimit=20'
with urllib.request.urlopen(url_facet) as r:
    d2 = json.loads(r.read().decode())
    counts = d2.get('facets', [{}])[0].get('counts', [])
    print(f"Facet counts: {counts}")
