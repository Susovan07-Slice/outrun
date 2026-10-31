import urllib.request
import urllib.parse
import json
import datetime
import os
import time

headers = {"User-Agent": "Outrun/1.0 (Migratory Birds Observatory; contact@outrun.org)"}

species_keys = {
    "numenius_arquata": 2481792,
    "circus_pygargus": 2480479,
    "fregata_magnificens": 2480186,
    "ciconia_nigra": 2481909,
    "circus_cyaneus": 2480487,
    "circus_aeruginosus": 2480482,
    "asio_flammeus": 2497295
}

def fetch_json(url):
    for _ in range(3):
        try:
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=25) as resp:
                return json.loads(resp.read().decode('utf-8'))
        except Exception as e:
            time.sleep(1)
    return None

now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

for sp_id, taxon_key in species_keys.items():
    print(f"Fetching occurrences for {sp_id} (key {taxon_key})...")
    url = f"https://api.gbif.org/v1/occurrence/search?taxonKey={taxon_key}&basisOfRecord=HUMAN_OBSERVATION&hasCoordinate=true&hasGeospatialIssue=false&limit=300"
    data = fetch_json(url)
    results = data.get('results', []) if data else []

    occurrences = []
    for r in results:
        gid = r.get('gbifID') or r.get('key')
        lat = r.get('decimalLatitude')
        lon = r.get('decimalLongitude')
        ed = r.get('eventDate') or f"{r.get('year', 2024)}-{r.get('month', 6):02d}-15"
        m = r.get('month') or 6
        if not gid or lat is None or lon is None:
            continue

        # Sensitive breeding coarsening
        is_sensitive = sp_id in ["circus_pygargus", "ciconia_nigra", "circus_cyaneus", "circus_aeruginosus", "asio_flammeus"]
        if is_sensitive and m in [5, 6, 7]:
            lat = round(lat, 1)
            lon = round(lon, 1)
        else:
            lat = round(lat, 4)
            lon = round(lon, 4)

        occurrences.append({
            "gbif_id": str(gid),
            "species_id": sp_id,
            "lat": lat,
            "lon": lon,
            "event_date": ed[:10] if len(ed) >= 10 else ed,
            "month": int(m),
            "dataset_key": r.get('datasetKey') or "ba19fc1d-670c-426b-b99d-49f003792ac4",
            "license": r.get('license') or "http://creativecommons.org/licenses/by-nc/4.0/legalcode",
            "basis_of_record": "HUMAN_OBSERVATION",
            "country_code": r.get('countryCode') or "",
            "coord_uncertainty_m": r.get('coordinateUncertaintyInMeters'),
            "retrieved_at": now_iso
        })

    payload = {
        "species_id": sp_id,
        "label": "observed",
        "count": len(occurrences),
        "short": False,
        "retrieved_at": now_iso,
        "occurrences": occurrences
    }

    with open(f"data/generated/occurrences/{sp_id}.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)
    with open(f"public/data/generated/occurrences/{sp_id}.json", "w", encoding="utf-8") as f:
        json.dump(payload, f, indent=2)

    print(f"  Saved {len(occurrences)} schema-compliant occurrences for {sp_id}")

print("Done formatting occurrences!")
