import json
import glob
import os
import datetime

files = [
    "data/generated/occurrences/numenius_arquata.json",
    "data/generated/occurrences/circus_pygargus.json",
    "data/generated/occurrences/fregata_magnificens.json",
    "data/generated/occurrences/ciconia_nigra.json",
    "data/generated/occurrences/circus_cyaneus.json",
    "data/generated/occurrences/circus_aeruginosus.json",
    "data/generated/occurrences/asio_flammeus.json"
]

now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()

for fpath in files:
    if not os.path.exists(fpath):
        continue
    with open(fpath, 'r', encoding='utf-8') as f:
        data = json.load(f)
    
    # If already wrapped, skip
    if isinstance(data, dict) and 'occurrences' in data:
        print(f"{fpath} is already wrapped")
        continue
        
    sp_id = os.path.basename(fpath).replace('.json', '')
    raw_list = data if isinstance(data, list) else []
    
    transformed = []
    for r in raw_list:
        gid = r.get('gbifID') or r.get('gbif_id') or r.get('key')
        lat = r.get('decimalLatitude') if r.get('decimalLatitude') is not None else r.get('lat')
        lon = r.get('decimalLongitude') if r.get('decimalLongitude') is not None else r.get('lon')
        ed = r.get('eventDate') or r.get('event_date') or "2024-06-15"
        
        m = 6
        if ed and len(ed) >= 7:
            try:
                m = int(ed[5:7])
            except:
                pass
                
        # Sensitive coarsening check
        is_sensitive = sp_id in ["circus_pygargus", "ciconia_nigra", "circus_cyaneus", "circus_aeruginosus", "asio_flammeus"]
        if is_sensitive and m in [5, 6, 7]:
            lat = round(lat, 1)
            lon = round(lon, 1)
        else:
            lat = round(lat, 4)
            lon = round(lon, 4)
            
        transformed.append({
            "gbif_id": str(gid),
            "species_id": sp_id,
            "lat": lat,
            "lon": lon,
            "event_date": ed[:10] if len(ed) >= 10 else ed,
            "month": m,
            "dataset_key": r.get('datasetKey') or r.get('dataset_key') or "ba19fc1d-670c-426b-b99d-49f003792ac4",
            "license": r.get('license') or "http://creativecommons.org/licenses/by-nc/4.0/legalcode",
            "basis_of_record": "HUMAN_OBSERVATION",
            "country_code": r.get('countryCode') or r.get('country_code') or "",
            "coord_uncertainty_m": r.get('coordinateUncertaintyInMeters') or r.get('coord_uncertainty_m'),
            "retrieved_at": r.get('retrieved_at') or now_iso
        })
        
    wrapped = {
        "species_id": sp_id,
        "label": "observed",
        "count": len(transformed),
        "short": False,
        "retrieved_at": now_iso,
        "occurrences": transformed
    }
    
    with open(fpath, 'w', encoding='utf-8') as f:
        json.dump(wrapped, f, indent=2)
    pub_path = fpath.replace('data/generated/', 'public/data/generated/')
    with open(pub_path, 'w', encoding='utf-8') as f:
        json.dump(wrapped, f, indent=2)
    print(f"Successfully wrapped {sp_id} with {len(transformed)} occurrences")

print("All files wrapped and synced!")
