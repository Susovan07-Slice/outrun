import urllib.request
import json
import datetime
import socket
import time

socket.setdefaulttimeout(15)

headers = {"User-Agent": "Outrun/1.0 (Migratory Birds Observatory; contact@outrun.org)"}
taxon_key = 2480189 # Fregata magnificens
sp_id = "fregata_magnificens"

def fetch_json(url, retries=3):
    for attempt in range(retries):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=15) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            if attempt == retries - 1:
                print(f"Error {url}: {e}")
                return None
            time.sleep(1)
    return None

print("Fetching stratified occurrences for Fregata magnificens...")
stratified_occs = []
for month in range(1, 13):
    occ_url = f"https://api.gbif.org/v1/occurrence/search?taxonKey={taxon_key}&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&basisOfRecord=HUMAN_OBSERVATION&year=2010,2026&month={month}&limit=42"
    mo_res = fetch_json(occ_url)
    if mo_res and 'results' in mo_res:
        for o in mo_res['results']:
            stratified_occs.append({
                "gbif_id": str(o.get('key')),
                "species_id": sp_id,
                "lat": o.get('decimalLatitude'),
                "lon": o.get('decimalLongitude'),
                "event_date": o.get('eventDate'),
                "month": o.get('month') or month,
                "dataset_key": o.get('datasetKey'),
                "license": o.get('license'),
                "basis_of_record": o.get('basisOfRecord', 'HUMAN_OBSERVATION'),
                "country_code": o.get('countryCode'),
                "coord_uncertainty_m": o.get('coordinateUncertaintyInMeters'),
                "retrieved_at": datetime.datetime.now(datetime.timezone.utc).isoformat()
            })
    print(f"  Month {month}: {len(stratified_occs)} total records so far")

occ_payload = {
    "species_id": sp_id,
    "label": "observed",
    "count": len(stratified_occs),
    "short": len(stratified_occs) < 500,
    "retrieved_at": datetime.datetime.now(datetime.timezone.utc).isoformat(),
    "occurrences": stratified_occs
}
with open(f"data/generated/occurrences/{sp_id}.json", 'w', encoding='utf-8') as f:
    json.dump(occ_payload, f, indent=2)

print(f"Saved {len(stratified_occs)} occurrences for {sp_id}.")
