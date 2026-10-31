import urllib.request
import json
import datetime
import math

birdmap_key = '712dba38-74cc-4704-87c0-63d1bf8484bc'
ind = '97.eedi'

url_cnt = f'https://api.gbif.org/v1/occurrence/search?datasetKey={birdmap_key}&organismId={urllib.request.quote(ind)}&limit=0'
with urllib.request.urlopen(url_cnt) as r:
    total = json.loads(r.read().decode())['count']

print(f"Total fixes for {ind}: {total}")

points = []
offsets = [0, total // 4, total // 2, 3 * total // 4, max(0, total - 100)]
for off in offsets:
    url = f'https://api.gbif.org/v1/occurrence/search?datasetKey={birdmap_key}&organismId={urllib.request.quote(ind)}&offset={off}&limit=80'
    try:
        with urllib.request.urlopen(url) as r:
            res = json.loads(r.read().decode()).get('results', [])
            for rec in res:
                lat = rec.get('decimalLatitude')
                lon = rec.get('decimalLongitude')
                ed = rec.get('eventDate')
                c = rec.get('countryCode')
                if lat and lon and ed:
                    points.append({'lat': lat, 'lon': lon, 'date': ed, 'country': c})
    except Exception as e:
        print(f"Offset {off} error: {e}")

points.sort(key=lambda x: x['date'])
print(f"Sampled {len(points)} points across timeline.")
print(f"Start: {points[0]['date']} at ({points[0]['lat']}, {points[0]['lon']}) in {points[0]['country']}")
print(f"Mid:   {points[len(points)//2]['date']} at ({points[len(points)//2]['lat']}, {points[len(points)//2]['lon']}) in {points[len(points)//2]['country']}")
print(f"End:   {points[-1]['date']} at ({points[-1]['lat']}, {points[-1]['lon']}) in {points[-1]['country']}")
countries = sorted(list(set(p['country'] for p in points if p['country'])))
print(f"Countries touched in sampled track: {countries}")
