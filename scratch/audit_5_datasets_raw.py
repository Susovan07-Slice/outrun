import urllib.request
import json
import ssl

ctx = ssl.create_default_context()

keys = [
    ("e2fb42ca-e408-4aa2-a7bd-a9bb4ddcc83a", "BOP_RODENT"),
    ("88216808-1942-44ed-b059-b576bf79a28e", "CURLEW_VLAANDEREN"),
    ("299e7998-73f0-42ff-9fb7-d8a5a0cc44d1", "CREX_VLAANDEREN"),
    ("3a3c40ec-fb9b-4de3-aa32-4c8a2e101d16", "ARMENIAN_GULL"),
    ("291e47e6-1cb6-4211-9fbd-4f06accb1c37", "Liverpool Anguilla seabirds")
]

headers = {'User-Agent': 'OutrunAudit/1.0 (conservation research platform)'}

for key, label in keys:
    print(f"\n{'='*80}")
    print(f"AUDITING DATASET: {label} ({key})")
    print(f"{'='*80}")
    
    # 1. Dataset metadata
    ds_url = f"https://api.gbif.org/v1/dataset/{key}"
    req = urllib.request.Request(ds_url, headers=headers)
    try:
        with urllib.request.urlopen(req, context=ctx, timeout=30) as resp:
            ds_data = json.loads(resp.read().decode('utf-8'))
            
        title = ds_data.get('title')
        doi = ds_data.get('doi')
        license_val = ds_data.get('license')
        pub_org_key = ds_data.get('publishingOrganizationKey')
        
        # Org metadata
        org_title = "UNKNOWN"
        if pub_org_key:
            org_url = f"https://api.gbif.org/v1/organization/{pub_org_key}"
            req_org = urllib.request.Request(org_url, headers=headers)
            try:
                with urllib.request.urlopen(req_org, context=ctx, timeout=30) as org_resp:
                    org_data = json.loads(org_resp.read().decode('utf-8'))
                    org_title = org_data.get('title')
            except Exception as e:
                org_title = f"Error fetching org: {e}"
                
        print("\n--- RAW METADATA ---")
        print(f"Key: {key}")
        print(f"Title: {title}")
        print(f"DOI: {doi}")
        print(f"License: {license_val}")
        print(f"PublishingOrganizationKey: {pub_org_key}")
        print(f"Organization Title: {org_title}")
        
    except Exception as e:
        print(f"Error fetching dataset {key}: {e}")
        continue
        
    # 2. Occurrence search limit=5
    occ_url = f"https://api.gbif.org/v1/occurrence/search?datasetKey={key}&limit=5"
    req_occ = urllib.request.Request(occ_url, headers=headers)
    try:
        with urllib.request.urlopen(req_occ, context=ctx, timeout=30) as occ_resp:
            occ_data = json.loads(occ_resp.read().decode('utf-8'))
            
        total_records = occ_data.get('count', 0)
        results = occ_data.get('results', [])
        print(f"\n--- OCCURRENCE TOTAL COUNT: {total_records} ---")
        print(f"--- 5 RAW RECORDS ---")
        for i, r in enumerate(results):
            record_extract = {
                "gbifID": r.get('gbifID', r.get('key')),
                "eventDate": r.get('eventDate'),
                "decimalLatitude": r.get('decimalLatitude'),
                "decimalLongitude": r.get('decimalLongitude'),
                "basisOfRecord": r.get('basisOfRecord'),
                "individualCount": r.get('individualCount'),
                "organismID": r.get('organismID'),
                "occurrenceID": r.get('occurrenceID'),
                "recordedBy": r.get('recordedBy'),
                "species": r.get('species'),
                "scientificName": r.get('scientificName')
            }
            print(f"Record {i+1}: {json.dumps(record_extract, indent=2)}")
            
    except Exception as e:
        print(f"Error fetching 5 sample occurrences: {e}")

    # 3. Facets by basisOfRecord and individual identifier
    facet_url = f"https://api.gbif.org/v1/occurrence/search?datasetKey={key}&limit=0&facet=basisOfRecord&facet=organismID&facet=occurrenceID&facet=recordedBy&facetLimit=20"
    req_facet = urllib.request.Request(facet_url, headers=headers)
    try:
        with urllib.request.urlopen(req_facet, context=ctx, timeout=30) as f_resp:
            f_data = json.loads(f_resp.read().decode('utf-8'))
            facets = f_data.get('facets', [])
            print("\n--- FACETS ---")
            for f in facets:
                field = f.get('field')
                counts = f.get('counts', [])
                print(f"Facet {field} (top {len(counts)}):")
                for c in counts[:10]:
                    print(f"   {c.get('name')}: {c.get('count')}")
                if len(counts) > 10:
                    print(f"   ... and {len(counts) - 10} more")
    except Exception as e:
        print(f"Error fetching facets: {e}")
