import urllib.request
import json
import ssl
import math

def haversine(lat1, lon1, lat2, lon2):
    R = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1))*math.cos(math.radians(lat2))*math.sin(dlon/2)**2
    return 2 * R * math.asin(math.sqrt(a))

ctx = ssl.create_default_context()
headers = {'User-Agent': 'OutrunAudit/1.0'}
dataset = '88216808-1942-44ed-b059-b576bf79a28e'
individuals = ['L178463', 'L922149', 'L178330', 'L178457', 'L178332']

print(f"{'Individual':<12} | {'Raw Points':<10} | {'Date Range':<25} | {'Countries':<25} | {'Direct Disp (km)':<16} | {'Classification'}")
print("-" * 115)

for ind in individuals:
    url_f = f'https://api.gbif.org/v1/occurrence/search?datasetKey={dataset}&organismId={ind}&limit=1'
    req_f = urllib.request.Request(url_f, headers=headers)
    with urllib.request.urlopen(req_f, context=ctx) as r:
        d_f = json.loads(r.read().decode('utf-8'))
    cnt = d_f.get('count', 0)
    p_first = d_f['results'][0] if d_f.get('results') else None

    # Fetch last point
    url_l = f'https://api.gbif.org/v1/occurrence/search?datasetKey={dataset}&organismId={ind}&offset={max(0, cnt-1)}&limit=1'
    req_l = urllib.request.Request(url_l, headers=headers)
    with urllib.request.urlopen(req_l, context=ctx) as r:
        d_l = json.loads(r.read().decode('utf-8'))
    p_last = d_l['results'][0] if d_l.get('results') else None

    # Get country facets
    url_c = f'https://api.gbif.org/v1/occurrence/search?datasetKey={dataset}&organismId={ind}&facet=country&limit=0'
    req_c = urllib.request.Request(url_c, headers=headers)
    with urllib.request.urlopen(req_c, context=ctx) as r:
        d_c = json.loads(r.read().decode('utf-8'))
    facets = d_c.get('facets', [{}])[0].get('counts', [])
    countries = ', '.join([f"{c['name']}: {c['count']}" for c in facets])

    lat1, lon1 = p_first['decimalLatitude'], p_first['decimalLongitude']
    lat2, lon2 = p_last['decimalLatitude'], p_last['decimalLongitude']
    date1 = p_first['eventDate'][:10] if p_first.get('eventDate') else 'Unknown'
    date2 = p_last['eventDate'][:10] if p_last.get('eventDate') else 'Unknown'

    disp = haversine(lat1, lon1, lat2, lon2)
    has_international = any(c['name'] in ['ES', 'PT', 'FR', 'NL'] for c in facets if c['name'] != 'BE')
    classification = "Migration route (trans-European)" if has_international else "tracked movements (local)"

    print(f"{ind:<12} | {cnt:<10} | {date1} to {date2} | {countries:<25} | {disp:<16.1f} | {classification}")
