import urllib.request
import json
import math
import ssl

ctx = ssl.create_default_context()
headers = {'User-Agent': 'OutrunAudit/1.0 (conservation research platform)'}

dataset_key = "88216808-1942-44ed-b059-b576bf79a28e"

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0 # km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

# First, get all organismIDs
f_url = f"https://api.gbif.org/v1/occurrence/search?datasetKey={dataset_key}&limit=0&facet=organismID&facetLimit=20"
req = urllib.request.Request(f_url, headers=headers)
with urllib.request.urlopen(req, context=ctx) as r:
    data = json.loads(r.read().decode('utf-8'))
    org_facets = data['facets'][0]['counts']

print(f"Curlew dataset has {len(org_facets)} individuals.")

results_per_ind = {}

for item in org_facets:
    ind_id = item['name']
    total_count = item['count']
    print(f"\nAnalyzing individual: {ind_id} ({total_count} records)...", flush=True)
    
    # Page through occurrences for this individual (or sample if large)
    # Fetch 300 points sorted by eventDate to see full trajectory and extent
    # GBIF occurrence search allows sorting? No, but we can fetch batches or min/max dates
    
    # Get first and last by date or fetch 1000 points
    batch_url = f"https://api.gbif.org/v1/occurrence/search?datasetKey={dataset_key}&organismID={ind_id}&limit=300"
    req_batch = urllib.request.Request(batch_url, headers=headers)
    points = []
    with urllib.request.urlopen(req_batch, context=ctx) as b_resp:
        b_data = json.loads(b_resp.read().decode('utf-8'))
        for rec in b_data.get('results', []):
            if rec.get('decimalLatitude') is not None and rec.get('decimalLongitude') is not None:
                points.append({
                    'date': rec.get('eventDate'),
                    'lat': rec['decimalLatitude'],
                    'lon': rec['decimalLongitude']
                })
                
    # Also fetch another batch from offset 1000, 5000, 10000 if available
    for offset in [5000, 15000, 25000]:
        if offset < total_count:
            o_url = f"https://api.gbif.org/v1/occurrence/search?datasetKey={dataset_key}&organismID={ind_id}&offset={offset}&limit=300"
            req_o = urllib.request.Request(o_url, headers=headers)
            try:
                with urllib.request.urlopen(req_o, context=ctx) as o_resp:
                    o_data = json.loads(o_resp.read().decode('utf-8'))
                    for rec in o_data.get('results', []):
                        if rec.get('decimalLatitude') is not None and rec.get('decimalLongitude') is not None:
                            points.append({
                                'date': rec.get('eventDate'),
                                'lat': rec['decimalLatitude'],
                                'lon': rec['decimalLongitude']
                            })
            except Exception as e:
                pass

    # Sort points by date
    points = [p for p in points if p['date']]
    points.sort(key=lambda x: x['date'])
    
    if not points:
        continue
        
    date_start = points[0]['date']
    date_end = points[-1]['date']
    lats = [p['lat'] for p in points]
    lons = [p['lon'] for p in points]
    min_lat, max_lat = min(lats), max(lats)
    min_lon, max_lon = min(lons), max(lons)
    
    # Calculate sampled cumulative distance
    dist = 0.0
    for i in range(len(points)-1):
        dist += haversine(points[i]['lat'], points[i]['lon'], points[i+1]['lat'], points[i+1]['lon'])
        
    # Max displacement from origin
    origin_lat, origin_lon = points[0]['lat'], points[0]['lon']
    max_displacement = max(haversine(origin_lat, origin_lon, p['lat'], p['lon']) for p in points)
    
    results_per_ind[ind_id] = {
        'total_records': total_count,
        'sampled_points': len(points),
        'date_start': date_start,
        'date_end': date_end,
        'lat_range': (round(min_lat, 4), round(max_lat, 4)),
        'lon_range': (round(min_lon, 4), round(max_lon, 4)),
        'sampled_cumulative_dist_km': round(dist, 1),
        'max_displacement_km': round(max_displacement, 1),
        'countries': set()
    }
    print(f"  Dates: {date_start} to {date_end}")
    print(f"  Lat range: {min_lat:.2f} to {max_lat:.2f} | Lon range: {min_lon:.2f} to {max_lon:.2f}")
    print(f"  Max displacement: {max_displacement:.1f} km | Sampled distance: {dist:.1f} km")

print("\n--- SUMMARY OF CURLEW INDIVIDUALS ---")
for k, v in results_per_ind.items():
    print(f"{k}: count={v['total_records']}, dates={v['date_start'][:10]}..{v['date_end'][:10]}, lat={v['lat_range']}, max_displacement={v['max_displacement_km']}km")
