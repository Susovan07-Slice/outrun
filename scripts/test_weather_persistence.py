import sqlite3
import glob
import json
import sys

def main():
    action = sys.argv[1] if len(sys.argv) > 1 else 'get'
    species_id = sys.argv[2] if len(sys.argv) > 2 else 'falco_amurensis'
    
    db_files = glob.glob('.wrangler/state/v3/d1/miniflare-D1DatabaseObject/*.sqlite')
    if not db_files:
        print(json.dumps({'error': 'No DB found'}))
        return
        
    conn = sqlite3.connect(db_files[0])
    cur = conn.cursor()
    
    cur.execute("SELECT species_id, weather_json, retrieved_at FROM weather_snapshots WHERE species_id = ?", (species_id,))
    row = cur.fetchone()
    
    if row:
        print(json.dumps({
            'success': True,
            'species_id': row[0],
            'label': 'forecast',
            'source': 'fallback',
            'weather': json.loads(row[1]),
            'retrieved_at': row[2]
        }))
    else:
        print(json.dumps({
            'success': False,
            'label': 'forecast',
            'source': 'fallback',
            'message': 'No cached data'
        }))

if __name__ == '__main__':
    main()
