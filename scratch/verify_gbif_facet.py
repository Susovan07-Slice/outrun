import urllib.request
import json
import time

url = "https://api.gbif.org/v1/occurrence/search?taxonKey=212&basisOfRecord=MACHINE_OBSERVATION&hasCoordinate=true&limit=0&facet=datasetKey&facetLimit=100"
headers = {"User-Agent": "Outrun/1.0 (Research)"}

req = urllib.request.Request(url, headers=headers)
try:
    with urllib.request.urlopen(req) as resp:
        data = json.loads(resp.read().decode('utf-8'))
        print(f"Total machine observations for Aves: {data.get('count')}")
        facets = data.get('facets', [])
        if facets:
            counts = facets[0].get('counts', [])
            print(f"Total candidate datasets returned in facet: {len(counts)}")
            for c in counts[:10]:
                print(f"  datasetKey: {c['name']} (count: {c['count']})")
        else:
            print("No facets returned.")
except Exception as e:
    print(f"Error querying GBIF: {e}")
