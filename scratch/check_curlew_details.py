import urllib.request
import json
import math
import ssl

ctx = ssl.create_default_context()
headers = {'User-Agent': 'OutrunAudit/1.0 (conservation research platform)'}
dataset_key = "88216808-1942-44ed-b059-b576bf79a28e"

individuals = ["L178463", "L922149", "L178330", "L178457", "L178332"]

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0 # km
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    return R * c

print(f"{'Individual':<12} | {'Count':<7} | {'Date Range':<25} | {'Lat Range':<16} | {'Lon Range':<16} | {'Max Disp (km)':<14} | {'Travel Description'}", flush=True)
print("-" * 120, flush=True)

for ind in individuals:
    # 1. Total count
    url_cnt = f"https://api.gbif.org/v1/occurrence/search?datasetKey={dataset_key}&organismId={ind}&limit=0"
    req = urllib.request.Request(url_cnt, headers=headers)
    with urllib.request.urlopen(req, context=ctx, timeout=15) as r:
        cnt = json.loads(r.read().decode('utf-8')).get('count', 0)
        
    # 2. Fetch first 100 and last 100 records
    # First 100
    points = []
    url_f = f"https://api.gbif.org/v1/occurrence/search?datasetKey={dataset_key}&organismId={ind}&limit=100"
    req_f = urllib.request.Request(url_f, headers=headers)
    with urllib.request.urlopen(req_f, context=ctx, timeout=15) as r:
        res = json.loads(r.read().decode('utf-8')).get('results', [])
        for rec in res:
            if rec.get('decimalLatitude') and rec.get('eventDate'):
                points.append((rec['eventDate'], rec['decimalLatitude'], rec['decimalLongitude']))
                
    # Sample from middle and end
    if cnt > 200:
        for off in [cnt // 2, max(0, cnt - 100)]:
            url_m = f"https://api.gbif.org/v1/occurrence/search?datasetKey={dataset_key}&organismId={ind}&offset={off}&limit=100"
            req_m = urllib.request.Request(url_m, headers=headers)
            try:
                with urllib.request.urlopen(req_m, context=ctx, timeout=15) as r:
                    res = json.loads(r.read().decode('utf-8')).get('results', [])
                    for rec in res:
                        if rec.get('decimalLatitude') and rec.get('eventDate'):
                            points.append((rec['eventDate'], rec['decimalLatitude'], rec['decimalLongitude']))
            except Exception:
                pass
                
    points.sort(key=lambda x: x[0])
    
    if not points:
        print(f"{ind:<12} | {cnt:<7} | No valid points")
        continue
        
    date_start = points[0][0][:10]
    date_end = points[-1][0][:10]
    lats = [p[1] for p in points]
    lons = [p[2] for p in points]
    min_lat, max_lat = min(lats), max(lats)
    min_lon, max_lon = min(lons), max(lons)
    
    origin = points[0]
    max_disp = max(haversine(origin[1], origin[2], p[1], p[2]) for p in points)
    
    # Cumulative distance across sampled points
    cum_dist = sum(haversine(points[i][1], points[i][2], points[i+1][1], points[i+1][2]) for i in range(len(points)-1))
    
    desc = "Local breeding movements" if max_disp < 100 else f"Migratory travel ({max_disp:.0f} km)"
    
    print(f"{ind:<12} | {cnt:<7} | {date_start} .. {date_end} | {min_lat:.2f} .. {max_lat:.2f} | {min_lon:.2f} .. {max_lon:.2f} | {max_disp:<14.1f} | {desc}", flush=True)
