import urllib.request
import json
import time

birdmap_key = '712dba38-74cc-4704-87c0-63d1bf8484bc'
ind = '97.eedi'
countries = ['LV', 'BY', 'UA', 'RO', 'TR', 'SA']

t0 = time.time()
points = []
for c in countries:
    url = f'https://api.gbif.org/v1/occurrence/search?datasetKey={birdmap_key}&organismId={urllib.request.quote(ind)}&country={c}&limit=30'
    with urllib.request.urlopen(url, timeout=10) as r:
        res = json.loads(r.read().decode()).get('results', [])
        for rec in res:
            lat = rec.get('decimalLatitude')
            lon = rec.get('decimalLongitude')
            ed = rec.get('eventDate')
            if lat and lon and ed:
                points.append({'lat': lat, 'lon': lon, 'date': ed, 'country': c})

points.sort(key=lambda x: x['date'])
print(f"Fetched {len(points)} points across {len(countries)} countries in {time.time()-t0:.2f} seconds!")
print(f"Start: {points[0]['date']} at ({points[0]['lat']}, {points[0]['lon']}) in {points[0]['country']}")
print(f"End:   {points[-1]['date']} at ({points[-1]['lat']}, {points[-1]['lon']}) in {points[-1]['country']}")
seq = []
for p in points:
    if not seq or seq[-1] != p['country']:
        seq.append(p['country'])
print(f"Flight path sequence of countries: {' -> '.join(seq)}")
