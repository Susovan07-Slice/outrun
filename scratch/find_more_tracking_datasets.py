import urllib.request
import urllib.parse
import json

headers = {"User-Agent": "Outrun/1.0"}

def query(url):
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=12) as r:
            return json.loads(r.read().decode())
    except Exception as e:
        return None

other_species = [
    ('falco_amurensis', 'Falco amurensis'),
    ('limosa_lapponica', 'Limosa lapponica'),
    ('sterna_paradisaea', 'Sterna paradisaea'),
    ('cuculus_canorus', 'Cuculus canorus'),
    ('anser_indicus', 'Anser indicus'),
    ('calidris_canutus', 'Calidris canutus'),
    ('hirundo_rustica', 'Hirundo rustica'),
    ('numenius_phaeopus', 'Numenius phaeopus'),
    ('oenanthe_oenanthe', 'Oenanthe oenanthe'),
]

print("Searching GBIF for MACHINE_OBSERVATION tracking datasets for remaining species:")
for sp_id, sci_name in other_species:
    url = f"https://api.gbif.org/v1/occurrence/search?scientificName={urllib.parse.quote(sci_name)}&basisOfRecord=MACHINE_OBSERVATION&hasCoordinate=true&limit=0&facet=datasetKey&facetLimit=5"
    data = query(url)
    if data and data.get('facets'):
        counts = data['facets'][0].get('counts', [])
        total = data.get('count', 0)
        print(f"\n{sci_name} ({sp_id}): {total} MACHINE_OBSERVATION records across {len(counts)} datasets")
        for c in counts:
            d_key = c['name']
            cnt = c['count']
            ds_info = query(f"https://api.gbif.org/v1/dataset/{d_key}")
            if ds_info:
                title = ds_info.get('title', 'Unknown')
                lic = ds_info.get('license', 'Unknown')
                print(f"   - [{d_key}] ({cnt} recs, license={lic}): {title}")
