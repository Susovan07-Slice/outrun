import urllib.request
import json

headers = {"User-Agent": "Outrun/1.0"}

def query(url):
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=15) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        print(f"Error {url}: {e}", flush=True)
        return None

url = "https://api.gbif.org/v1/occurrence/search?classKey=212&basisOfRecord=MACHINE_OBSERVATION&hasCoordinate=true&limit=0&facet=datasetKey&facetLimit=50"
data = query(url)
if data and data.get('facets'):
    counts = data['facets'][0].get('counts', [])
    print(f"Found {len(counts)} candidate datasets with MACHINE_OBSERVATION in Aves:", flush=True)
    for c in counts[:30]:
        d_key = c['name']
        cnt = c['count']
        ds = query(f"https://api.gbif.org/v1/dataset/{d_key}")
        if ds:
            title = ds.get('title', '')
            lic = ds.get('license', '')
            # get species facet
            sp_url = f"https://api.gbif.org/v1/occurrence/search?datasetKey={d_key}&limit=0&facet=speciesKey&facetLimit=5"
            sp_data = query(sp_url)
            top_sp = []
            if sp_data and sp_data.get('facets'):
                for sc in sp_data['facets'][0].get('counts', [])[:3]:
                    sp_key = sc['name']
                    sp_cnt = sc['count']
                    # resolve species name
                    sp_info = query(f"https://api.gbif.org/v1/species/{sp_key}")
                    name = sp_info.get('canonicalName', sp_info.get('scientificName', sp_key)) if sp_info else sp_key
                    top_sp.append(f"{name} ({sp_cnt})")
            print(f"[{d_key}] cnt={cnt} lic={lic}\n   Title: {title}\n   Species: {', '.join(top_sp)}\n", flush=True)
