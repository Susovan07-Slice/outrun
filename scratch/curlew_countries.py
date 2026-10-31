import urllib.request
import json
import ssl

ctx = ssl.create_default_context()
headers = {'User-Agent': 'OutrunAudit/1.0'}
dataset_key = "88216808-1942-44ed-b059-b576bf79a28e"
individuals = ["L178463", "L922149", "L178330", "L178457", "L178332"]

print("Curlew Individual Migration Analysis:\n")

for ind in individuals:
    url = f"https://api.gbif.org/v1/occurrence/search?datasetKey={dataset_key}&organismId={ind}&limit=0&facet=countryCode"
    req = urllib.request.Request(url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=20) as r:
            data = json.loads(r.read().decode('utf-8'))
            total = data.get('count', 0)
            countries = data.get('facets', [{}])[0].get('counts', [])
            country_str = ", ".join([f"{c['name']}: {c['count']}" for c in countries])
            print(f"Individual: {ind}")
            print(f"  Total fixes: {total}")
            print(f"  Countries: {country_str}")
    except Exception as e:
        print(f"Individual {ind} error: {e}")
