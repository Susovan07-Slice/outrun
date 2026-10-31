import csv

species = ['Numenius arquata', 'Circus pygargus', 'Fregata magnificens', 'Larus armenicus', 'Crex crex']
with open('data/avonet/AVONET1_BirdLife.csv', 'r', encoding='utf-8', errors='ignore') as f:
    for r in csv.DictReader(f):
        if r.get('Species1') in species:
            print(f"{r['Species1']:<24} | Family: {r.get('Family1'):<16} | HWI: {r.get('Hand-Wing.Index'):<6} | Migration: {r.get('Migration')}")
