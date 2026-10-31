import urllib.request
import json

headers = {"User-Agent": "Outrun/1.0 (Migratory Birds Observatory; contact@outrun.org)"}

targets = [
    {
        "species_name": "Numenius arquata",
        "dataset_key": "88216808-1942-44ed-b059-b576bf79a28e",
        "movement_type": "migration"
    },
    {
        "species_name": "Circus pygargus",
        "dataset_key": "e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a",
        "movement_type": "migration"
    },
    {
        "species_name": "Fregata magnificens",
        "dataset_key": "291e47e6-1cb6-4211-9fbd-4f06accb1c37",
        "movement_type": "foraging"
    }
]

def fetch_json(url):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=25) as resp:
        return json.loads(resp.read().decode('utf-8'))

for t in targets:
    url = f"https://api.gbif.org/v1/occurrence/search?datasetKey={t['dataset_key']}&scientificName={urllib.parse.quote(t['species_name'])}&limit=10"
    res = fetch_json(url)
    cnt = res.get('count', 0)
    print(f"Species: {t['species_name']} in {t['dataset_key']}: {cnt:,} records")
    sample = res.get('results', [])
    if sample:
        first = sample[0]
        print(f"  Sample: organismID={first.get('organismID')}, eventDate={first.get('eventDate')}, lat={first.get('decimalLatitude')}, lon={first.get('decimalLongitude')}")
