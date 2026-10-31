import sqlite3
import glob
import os
import sys

def seed_local_d1():
    db_pattern = os.path.join('.wrangler', 'state', 'v3', 'd1', 'miniflare-D1DatabaseObject', '*.sqlite')
    db_files = glob.glob(db_pattern)
    
    if not db_files:
        print("[D1 Seed] No local D1 database file found. Initializing schema first...")
        os.system("npx wrangler d1 execute outrun-db --local --file=db/schema.sql")
        db_files = glob.glob(db_pattern)
        
    if not db_files:
        print("[D1 Seed] ERROR: Could not find D1 SQLite database file after initialization.")
        sys.exit(1)
        
    db_path = db_files[0]
    print(f"[D1 Seed] Applying db/seed.sql to local D1 SQLite ({db_path})...")
    
    conn = sqlite3.connect(db_path)
    with open('db/seed.sql', 'r', encoding='utf-8') as f:
        sql = f.read()
        
    conn.executescript(sql)
    conn.commit()
    
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM species")
    species_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM occurrences")
    occ_count = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM datasets")
    ds_count = cur.fetchone()[0]
    
    print(f"[D1 Seed] SUCCESS: Loaded {species_count} species, {occ_count} occurrences, {ds_count} datasets into local D1.")

if __name__ == '__main__':
    seed_local_d1()
