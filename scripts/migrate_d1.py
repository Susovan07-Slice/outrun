import sqlite3
import glob

def migrate():
    db_files = glob.glob('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')
    if not db_files:
        print("No D1 database file found to migrate.")
        return
    conn = sqlite3.connect(db_files[0])
    cur = conn.cursor()
    
    cur.execute("PRAGMA table_info(species)")
    cols = [r[1] for r in cur.fetchall()]
    if 'evidence_level' not in cols:
        cur.execute("ALTER TABLE species ADD COLUMN evidence_level TEXT DEFAULT 'occurrences_only'")
        print("Added evidence_level column to species.")
        
    cur.execute("PRAGMA table_info(datasets)")
    d_cols = [r[1] for r in cur.fetchall()]
    if 'doi' not in d_cols:
        cur.execute("ALTER TABLE datasets ADD COLUMN doi TEXT")
        print("Added doi column to datasets.")
        
    cur.execute("""
        CREATE TABLE IF NOT EXISTS weather_snapshots (
            species_id TEXT PRIMARY KEY REFERENCES species(species_id),
            weather_json TEXT NOT NULL,
            retrieved_at TEXT NOT NULL
        )
    """)
    cur.execute("""
        CREATE TABLE IF NOT EXISTS gps_tracks (
            track_id TEXT PRIMARY KEY,
            species_id TEXT NOT NULL REFERENCES species(species_id),
            individual_id TEXT,
            point_count INTEGER NOT NULL,
            dataset_key TEXT REFERENCES datasets(dataset_key),
            geojson_path TEXT,
            retrieved_at TEXT NOT NULL
        )
    """)
    conn.commit()
    print("Local D1 schema migrated successfully!")

if __name__ == '__main__':
    migrate()
