import csv
from dateutil import parser

with open('scratch/bird-tracking/data/clean_bird_migration.csv', 'r', encoding='utf-8') as f:
    r = csv.DictReader(f)
    c_rows = [row for row in r if row['species'] == 'Ciconia ciconia' and row['longitude'] and row['latitude']]

c_rows.sort(key=lambda r: int(r['occurrenceID']))
groups = []
curr = []
for row in c_rows:
    t = parser.isoparse(row['date'])
    occ = int(row['occurrenceID'])
    if curr and occ == curr[-1]['occ'] + 1 and t > curr[-1]['time'] and t.year == curr[0]['time'].year:
        curr.append({'occ': occ, 'coord': [float(row['longitude']), float(row['latitude'])], 'time': t})
    else:
        if curr:
            groups.append(curr)
        curr = [{'occ': occ, 'coord': [float(row['longitude']), float(row['latitude'])], 'time': t}]

if curr:
    groups.append(curr)

print('Ciconia groups:', len(groups))
for i, g in enumerate(groups[:10]):
    print(f"Bird {i}: points={len(g)}, start={g[0]['time']}, end={g[-1]['time']}")
