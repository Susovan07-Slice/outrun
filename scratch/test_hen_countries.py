import urllib.request
import json

bop_key = 'e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a'
birds = ['e464108', 'l178485', 'e464112', 'e464107', 'l177822', 'e464103', 'e464102']

for b in birds:
    url = f'https://api.gbif.org/v1/occurrence/search?datasetKey={bop_key}&organismId={urllib.request.quote(b)}&limit=0&facet=country'
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            d = json.loads(r.read().decode())
            cnt = d.get('count', 0)
            facets = d.get('facets', [{}])[0].get('counts', [])
            countries = ', '.join([f"{c['name']}:{c['count']}" for c in facets[:6]])
            print(f"{b:<12} | {cnt:<6} fixes | Countries: {countries}")
    except Exception as e:
        print(f"Error {b}: {e}")
