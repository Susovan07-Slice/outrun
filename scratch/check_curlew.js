const datasetKey = '88216808-1942-44ed-b059-b576bf79a28e';
const individuals = ['L178463', 'L922149', 'L178330', 'L178457', 'L178332'];

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371.0;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function run() {
  console.log('Individual  | Total Count | Date Range                 | Lat Range        | Lon Range        | Max Disp (km) | Travel Type');
  console.log('--------------------------------------------------------------------------------------------------------------------------');
  
  for (const ind of individuals) {
    // 1. Get count and first 100
    const resFirst = await fetch(`https://api.gbif.org/v1/occurrence/search?datasetKey=${datasetKey}&organismId=${ind}&limit=100`);
    const dataFirst = await resFirst.json();
    const count = dataFirst.count || 0;
    
    let allPoints = (dataFirst.results || [])
      .filter(r => r.decimalLatitude != null && r.eventDate != null)
      .map(r => ({ date: r.eventDate, lat: r.decimalLatitude, lon: r.decimalLongitude }));
      
    // Fetch last 100
    if (count > 100) {
      const offset = Math.max(0, count - 100);
      const resLast = await fetch(`https://api.gbif.org/v1/occurrence/search?datasetKey=${datasetKey}&organismId=${ind}&offset=${offset}&limit=100`);
      const dataLast = await resLast.json();
      const lastPts = (dataLast.results || [])
        .filter(r => r.decimalLatitude != null && r.eventDate != null)
        .map(r => ({ date: r.eventDate, lat: r.decimalLatitude, lon: r.decimalLongitude }));
      allPoints = allPoints.concat(lastPts);
    }
    
    allPoints.sort((a, b) => a.date.localeCompare(b.date));
    
    if (allPoints.length === 0) {
      console.log(`${ind.padEnd(11)} | ${String(count).padStart(11)} | No valid coordinates`);
      continue;
    }
    
    const dStart = allPoints[0].date.substring(0, 10);
    const dEnd = allPoints[allPoints.length - 1].date.substring(0, 10);
    const lats = allPoints.map(p => p.lat);
    const lons = allPoints.map(p => p.lon);
    const minLat = Math.min(...lats).toFixed(2);
    const maxLat = Math.max(...lats).toFixed(2);
    const minLon = Math.min(...lons).toFixed(2);
    const maxLon = Math.max(...lons).toFixed(2);
    
    const origin = allPoints[0];
    let maxDisp = 0;
    for (const p of allPoints) {
      const d = haversine(origin.lat, origin.lon, p.lat, p.lon);
      if (d > maxDisp) maxDisp = d;
    }
    
    const travelType = maxDisp > 300 ? `Migration route (${Math.round(maxDisp)} km)` : `Tracked movements (local, ${Math.round(maxDisp)} km)`;
    
    console.log(`${ind.padEnd(11)} | ${String(count).padStart(11)} | ${dStart} .. ${dEnd} | ${minLat.padStart(6)} .. ${maxLat.padStart(5)} | ${minLon.padStart(6)} .. ${maxLon.padStart(5)} | ${maxDisp.toFixed(1).padStart(13)} | ${travelType}`);
  }
}

run().catch(console.error);
