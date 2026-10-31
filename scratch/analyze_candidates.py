import json

with open('data/generated/candidate_evaluation.json', 'r', encoding='utf-8') as f:
    d = json.load(f)

print(f"Total accepted datasets: {len(d['accepted'])}")
print("=" * 100)

for i, a in enumerate(d['accepted']):
    seeds = [s['name'] for s in a.get('matched_seed_species', [])]
    migs = [m['name'] for m in a.get('matched_migratory_species', [])]
    lic = a.get('license', 'Unspecified')
    if 'by-nc' in lic.lower():
        lic_short = 'CC-BY-NC 4.0'
    elif 'by' in lic.lower():
        lic_short = 'CC-BY 4.0'
    elif 'zero' in lic.lower():
        lic_short = 'CC0 1.0'
    else:
        lic_short = lic

    print(f"[{i+1}] {a['datasetKey']}")
    print(f"    Title: {a['title']}")
    print(f"    Licence: {lic_short} | Obs: {a['obs_count']:,} | DOI: {a.get('doi')}")
    print(f"    Seeds: {seeds}")
    print(f"    AVONET Migratory: {migs}")
    print("-" * 100)
