import urllib.request
import urllib.parse
import json

headers = {"User-Agent": "Outrun/1.0"}

import time

def query(url, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=20) as r:
                return json.loads(r.read().decode())
        except Exception as e:
            if attempt == retries - 1:
                print(f"Error querying {url}: {e}")
                return None
            time.sleep(2)


# Check BOP_RODENT species:
sp_map = {
    'Western Marsh Harrier': 'Circus aeruginosus',
    'Hen Harrier': 'Circus cyaneus',
    'Short-eared Owl': 'Asio flammeus',
    'Black Stork': 'Ciconia nigra',
    'Frigatebird': 'Fregata magnificens'
}

print("Checking Black Stork (Eagle Club):")
bs_url = "https://api.gbif.org/v1/occurrence/search?datasetKey=712dba38-74cc-4704-87c0-63d1bf8484bc&scientificName=Ciconia%20nigra&facet=organismId&limit=0&facetLimit=50"
bs_data = query(bs_url)
print("Black Stork organismIds:", [c['name'] for c in bs_data['facets'][0]['counts']])

print("\nChecking BOP_RODENT species organismIds:")
for name, sciname in [('Western Marsh Harrier', 'Circus aeruginosus'), ('Hen Harrier', 'Circus cyaneus'), ('Short-eared Owl', 'Asio flammeus')]:
    url = f"https://api.gbif.org/v1/occurrence/search?datasetKey=e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a&scientificName={urllib.parse.quote(sciname)}&facet=organismId&limit=0&facetLimit=50"
    data = query(url)
    orgs = [c['name'] for c in data['facets'][0]['counts']]
    print(f"{name} ({sciname}): {len(orgs)} organisms -> {orgs[:10]}")

print("\nChecking Frigatebirds in Anguilla dataset:")
freg_url = "https://api.gbif.org/v1/occurrence/search?datasetKey=291e47e6-1cb6-4211-9fbd-4f06accb1c37&scientificName=Fregata%20magnificens&facet=organismId&limit=0&facetLimit=50"
freg_data = query(freg_url)
freg_orgs = [c['name'] for c in freg_data['facets'][0]['counts']]
print(f"Frigatebird: {len(freg_orgs)} organisms -> {freg_orgs[:15]}")
