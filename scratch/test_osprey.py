import csv
from dateutil import parser

csv_path = 'scratch/bird-tracking/data/clean_bird_migration.csv'
rows = []
with open(csv_path, 'r', encoding='utf-8') as f:
    r = csv.DictReader(f)
    for row in r:
        if row.get('species') == 'Pandion haliaetus' and row.get('longitude') and row.get('latitude'):
            rows.append(row)

print(f"Total valid Pandion haliaetus rows: {len(rows)}")
rows.sort(key=lambda r: int(r['occurrenceID']))

groups = []
curr = []
for r in rows:
    t = parser.isoparse(r['date'])
    occ = int(r['occurrenceID'])
    if curr and occ == curr[-1]['occ'] + 1 and t > curr[-1]['time'] and t.year == curr[0]['time'].year:
        curr.append({'occ': occ, 'coord': [float(r['longitude']), float(r['latitude'])], 'time': t})
    else:
        if curr and len(curr) >= 2:
            groups.append(curr)
        curr = [{'occ': occ, 'coord': [float(r['longitude']), float(r['latitude'])], 'time': t}]
if curr and len(curr) >= 2:
    groups.append(curr)

print(f"Pandion haliaetus tracked individuals: {len(groups)}")
total_pts = sum(len(g) for g in groups)
print(f"Pandion haliaetus total raw track points: {total_pts}")
