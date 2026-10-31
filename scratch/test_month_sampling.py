import urllib.request
import urllib.parse
import json
import datetime
import math

headers = {"User-Agent": "Outrun/1.0"}

def query(url):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())

def get_perp_dist(pt, l_start, l_end):
    x, y = pt
    x1, y1 = l_start
    x2, y2 = l_end
    dx = x2 - x1
    dy = y2 - y1
    if dx == 0 and dy == 0:
        return math.hypot(x - x1, y - y1)
    return abs(dy * x - dx * y + x2 * y1 - y2 * x1) / math.hypot(dx, dy)

def simplify_trajectory(coords, times, tolerance=0.002):
    if len(coords) <= 2:
        return coords, times
    max_d = 0
    max_i = 0
    for i in range(1, len(coords) - 1):
        d = get_perp_dist(coords[i], coords[0], coords[-1])
        if d > max_d:
            max_d = d
            max_i = i
    if max_d > tolerance:
        c1, t1 = simplify_trajectory(coords[:max_i+1], times[:max_i+1], tolerance)
        c2, t2 = simplify_trajectory(coords[max_i:], times[max_i:], tolerance)
        return c1[:-1] + c2, t1[:-1] + t2
    return [coords[0], coords[-1]], [times[0], times[-1]]

ind = "l178463"
ds = "88216808-1942-44ed-b059-b576bf79a28e"

# Fetch across months
all_pts = []
for m in range(1, 13):
    url = f"https://api.gbif.org/v1/occurrence/search?datasetKey={ds}&organismId={ind}&month={m}&limit=60"
    data = query(url)
    if data and 'results' in data:
        for r in data['results']:
            lat = r.get('decimalLatitude')
            lon = r.get('decimalLongitude')
            ed = r.get('eventDate')
            cc = r.get('countryCode')
            if lat is not None and lon is not None and ed:
                try:
                    dt = datetime.datetime.fromisoformat(ed.replace('Z', '+00:00'))
                    ts = int(dt.timestamp())
                    all_pts.append({'coord': [round(lon, 4), round(lat, 4)], 'ts': ts, 'cc': cc})
                except:
                    pass

all_pts.sort(key=lambda x: x['ts'])
# dedupe monotonic
deduped = []
last_ts = -1
for p in all_pts:
    if p['ts'] > last_ts:
        deduped.append(p)
        last_ts = p['ts']

coords = [p['coord'] for p in deduped]
times = [p['ts'] for p in deduped]
s_coords, s_times = simplify_trajectory(coords, times, tolerance=0.003)

countries = set(p['cc'] for p in deduped if p['cc'])
print(f"Curlew {ind}: fetched {len(all_pts)}, deduped {len(deduped)}, simplified {len(s_coords)} points across {countries}")
