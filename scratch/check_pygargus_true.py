import urllib.request
import json

url = 'https://api.gbif.org/v1/occurrence/search?datasetKey=e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a&taxonKey=2480495&limit=0&facet=organismId&facet=country&facetLimit=25'
with urllib.request.urlopen(url) as r:
    d = json.loads(r.read().decode())
    print('Total Circus pygargus count:', d.get('count'))
    for f in d.get('facets', []):
        fld = f.get('field')
        counts = f.get('counts', [])
        str_counts = [f"{c['name']}({c['count']})" for c in counts[:10]]
        print(f"Facet {fld}: {', '.join(str_counts)}")
