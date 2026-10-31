import urllib.request
import json

birdmap_key = '712dba38-74cc-4704-87c0-63d1bf8484bc'
birds = ['97.eedi', '139.karula', '165.timmu.192596', '164.karl ii.192595', '138.maru', '104.karl']

for b in birds:
    url = f'https://api.gbif.org/v1/occurrence/search?datasetKey={birdmap_key}&organismId={urllib.request.quote(b)}&limit=0&facet=country'
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            d = json.loads(r.read().decode())
            cnt = d.get('count', 0)
            facets = d.get('facets', [{}])[0].get('counts', [])
            countries = ', '.join([f"{c['name']}:{c['count']}" for c in facets[:6]])
            print(f"{b:<20} | {cnt:<6} fixes | Countries: {countries}")
    except Exception as e:
        print(f"Error {b}: {e}")
