import urllib.request
import json

dataset_bop = 'e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a'
dataset_birdmap = '712dba38-74cc-4704-87c0-63d1bf8484bc'
dataset_curlew = '88216808-1942-44ed-b059-b576bf79a28e'
dataset_frigate = '291e47e6-1cb6-4211-9fbd-4f06accb1c37'

checks = [
    ('Ciconia nigra', dataset_birdmap, 2481909),
    ('Numenius arquata', dataset_curlew, 2481792),
    ('Circus pygargus', dataset_bop, 2480479),
    ('Circus cyaneus', dataset_bop, 2480487),
    ('Circus aeruginosus', dataset_bop, 2480482),
    ('Asio flammeus', dataset_bop, 2497295),
    ('Fregata magnificens', dataset_frigate, 2480186)
]

for sp, ds, key in checks:
    url = f'https://api.gbif.org/v1/occurrence/search?datasetKey={ds}&taxonKey={key}&facet=organismId&limit=0&facetLimit=25'
    try:
        with urllib.request.urlopen(url, timeout=20) as r:
            d = json.loads(r.read().decode())
            facets = d.get('facets', [{}])[0].get('counts', [])
            inds = [f"{c['name']} ({c['count']})" for c in facets[:10]]
            print(f"{sp:<22}: {len(facets)} individuals in facet. Top: {', '.join(inds)}")
    except Exception as e:
        print(f"Error {sp}: {e}")
