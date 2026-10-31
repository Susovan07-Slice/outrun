import urllib.request
import urllib.parse
import json

headers = {"User-Agent": "Outrun/1.0"}

def query(url):
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=15) as r:
        return json.loads(r.read().decode())

# Test Curlew bird l178463 (which has 37,451 points in dataset 88216808-1942-44ed-b059-b576bf79a28e)
# What if we sample by month or year?
ind = "l178463"
ds = "88216808-1942-44ed-b059-b576bf79a28e"
url = f"https://api.gbif.org/v1/occurrence/search?datasetKey={ds}&organismId={ind}&limit=0&facet=year"
data = query(url)
print("Years for l178463:", [(c['name'], c['count']) for c in data['facets'][0]['counts']])

# What about month facet?
url_m = f"https://api.gbif.org/v1/occurrence/search?datasetKey={ds}&organismId={ind}&limit=0&facet=month"
data_m = query(url_m)
print("Months for l178463:", [(c['name'], c['count']) for c in data_m['facets'][0]['counts']])
