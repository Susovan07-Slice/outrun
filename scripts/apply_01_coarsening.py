import json
import glob
import os
import datetime

sensitive_species = {
    'ciconia_ciconia',
    'circus_pygargus',
    'grus_grus',
    'pandion_haliaetus',
    'ciconia_nigra',
    'circus_cyaneus',
    'circus_aeruginosus',
    'asio_flammeus',
    'crex_crex',
    'falco_amurensis'
}

def coarsen_coord(val):
    return round(val, 1)

def process_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        
    species_id = data.get('species_id')
    if species_id not in sensitive_species:
        return 0, 0
        
    coarsened_count = 0
    total_count = 0
    
    for feat in data.get('features', []):
        coords = feat['geometry']['coordinates']
        times = feat['properties']['times']
        new_coords = []
        for pt, t in zip(coords, times):
            total_count += 1
            dt = datetime.datetime.fromtimestamp(t, tz=datetime.timezone.utc)
            # Breeding season: May, June, July (months 5, 6, 7)
            if dt.month in (5, 6, 7):
                new_coords.append([coarsen_coord(pt[0]), coarsen_coord(pt[1])])
                coarsened_count += 1
            else:
                new_coords.append(pt)
        feat['geometry']['coordinates'] = new_coords
        feat['properties']['coarsened_breeding_season_01deg'] = True
        
    data['sensitive_coarsening'] = {
        'applied': True,
        'precision_degrees': 0.1,
        'approx_km': 11.1,
        'breeding_months': [5, 6, 7],
        'points_coarsened': coarsened_count
    }
    
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(data, f, indent=2)
        
    # Also write to public/ if exists
    pub_path = os.path.join('public', file_path)
    if os.path.exists(os.path.dirname(pub_path)):
        with open(pub_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)
            
    return coarsened_count, total_count

total_coarsened = 0
for p in glob.glob('data/generated/tracks/*.geojson'):
    c, t = process_file(p)
    if c > 0:
        sp = os.path.basename(p).replace('.geojson', '')
        print(f"Coarsened {sp}: {c} / {t} fixes coarsened to 0.1° (~11 km)")
        total_coarsened += c

print(f"\nDone! Total breeding season fixes coarsened to 0.1°: {total_coarsened}")
