import urllib.request
import json

datasets = [
    ('Ciconia nigra', 'b83d1946-8800-4b6e-8266-990e4e5cf902', None),
    ('Circus pygargus', 'e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a', 2480495),
    ('Circus aeruginosus', 'e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a', 2480488),
    ('Circus cyaneus', 'e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a', 2480447),
    ('Asio flammeus', 'e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a', 2495067),
    ('Fregata magnificens', '291e47e6-1cb6-4211-9fbd-4f06accb1c37', None),
    ('Numenius arquata', '88216808-1942-44ed-b059-b576bf79a28e', None),
    ('Ciconia ciconia', '2d1f4b80-87a3-11e0-a7d5-b8a03c50a862', None),
]

for name, dkey, sp_key in datasets:
    url = f'https://api.gbif.org/v1/occurrence/search?datasetKey={dkey}&facet=organismId&limit=0&facetLimit=100'
    if sp_key:
        url += f'&taxonKey={sp_key}'
    req = urllib.request.Request(url, headers={'User-Agent': 'OutrunResearch/1.0'})
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            data = json.loads(resp.read().decode())
            facets = data.get('facets', [])
            counts = facets[0].get('counts', []) if facets else []
            total = data.get('count', 0)
            print(f'{name}: total={total}, individuals={len(counts)}')
            top = [(c['name'], c['count']) for c in counts[:10]]
            print(f'   Top organisms: {top}')
    except Exception as e:
        print(f'{name}: {e}')
