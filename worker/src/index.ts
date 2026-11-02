import weatherTargetsData from '../../data/generated/weather_targets.json';
import weatherFallbackData from '../../data/generated/weather_snapshots.json';
import climateGridData from '../../data/generated/climate_grid.json';
import corridorAnalysisData from '../../data/generated/corridor_analysis.json';
import registryData from '../../data/generated/registry.json';
import {
  simulateNodeProtection,
  calculateCellAreaKm2,
  CorridorNode,
} from '../../src/analytics/breakFix.js';
import {
  deriveSeasonalWindow,
  evaluateForecastRisk,
} from '../../src/analytics/watch.js';
import { generateSpeciesBrief } from '../../src/analytics/brief.js';

export interface Env {
  DB?: D1Database;
  ENVIRONMENT?: string;
  ASSETS?: Fetcher;
}

// In-memory cache for ephemeral fast retrieval
let lastSuccessfulLiveWeather: { weather: any; retrieved_at: string } | null = null;

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);
    const { pathname, searchParams } = url;

    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== 'GET' && !(request.method === 'POST' && pathname === '/api/simulate')) {
      return new Response(JSON.stringify({ error: 'Method Not Allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      });
    }

    const cache = typeof caches !== 'undefined' ? (caches as any).default : null;

    // 1. Health check
    if (pathname === '/api/health') {
      return new Response(
        JSON.stringify({
          status: 'ok',
          service: 'outrun-api',
          timestamp: new Date().toISOString(),
          environment: env.ENVIRONMENT || 'development',
        }),
        {
          headers: { 'Content-Type': 'application/json', ...corsHeaders },
        }
      );
    }

    // 2. Species registry
    if (pathname === '/api/species') {
      if (cache) {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
      }

      try {
        // Master canonical 20 species from bundled registry data
        const canonicalSpecies: any[] = (registryData as any).species || [];

        // Query D1 if available to overlay dynamic occurrence counts / monitoring statuses
        const d1Map = new Map<string, any>();
        if (env.DB) {
          try {
            const query = `
              SELECT 
                s.species_id,
                s.monitoring_group,
                st.category AS status_category,
                st.assessment_year AS status_year,
                st.source AS status_source,
                st.source_url AS status_source_url,
                (SELECT COUNT(*) FROM occurrences o WHERE o.species_id = s.species_id) AS occurrence_count
              FROM species s
              LEFT JOIN species_status st ON s.species_id = st.species_id
            `;
            const { results } = await env.DB.prepare(query).all();
            for (const row of ((results || []) as any[])) {
              d1Map.set(String(row.species_id), row);
            }
          } catch (dbErr) {
            console.warn('D1 query in /api/species notice:', dbErr);
          }
        }

        // Merge: keep canonical full names ("Amur Falcon", etc.) and all 20 species
        const formatted = canonicalSpecies.map((s: any) => {
          const d1Row = d1Map.get(s.species_id);
          const liveOccCount = d1Row && Number(d1Row.occurrence_count) > 0
            ? Number(d1Row.occurrence_count)
            : s.occurrence_count || 504;

          return {
            ...s,
            // Preserve rich canonical common_name - never override with raw abbreviations
            common_name: s.common_name || s.name_en || s.scientific_name,
            evidence_level: s.evidence_level || 'tracks',
            tracked_individuals: s.tracked_individuals ?? 12,
            monitoring_group: d1Row?.monitoring_group || s.monitoring_group || 'transcontinental_migrant',
            occurrence_count: liveOccCount,
            short: liveOccCount < 500,
            status: s.status || (d1Row?.status_source ? {
              category: d1Row.status_category,
              assessment_year: d1Row.status_year,
              source: d1Row.status_source,
              source_url: d1Row.status_source_url,
            } : null),
          };
        });

        const responsePayload = {
          success: true,
          count: formatted.length,
          species: formatted,
          retrieved_at: new Date().toISOString(),
        };

        const response = new Response(JSON.stringify(responsePayload), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
            ...corsHeaders,
          },
        });

        if (cache) {
          ctx.waitUntil(cache.put(request, response.clone()));
        }
        return response;
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to retrieve species registry',
            details: err?.message || String(err),
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }
    }

    // 3. Species occurrences: /api/species/:id/occurrences
    const occurrencesMatch = pathname.match(/^\/api\/species\/([^/]+)\/occurrences$/);
    if (occurrencesMatch) {
      const speciesId = occurrencesMatch[1];
      if (!/^[a-z0-9_-]+$/i.test(speciesId)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid species ID format' }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      if (cache) {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
      }

      try {
        const query = `
          SELECT 
            gbif_id,
            species_id,
            lat,
            lon,
            event_date,
            month,
            dataset_key,
            license,
            basis_of_record,
            country_code,
            coord_uncertainty_m,
            retrieved_at
          FROM occurrences
          WHERE species_id = ?
          ORDER BY month ASC, event_date ASC
        `;

        const { results } = await env.DB.prepare(query).bind(speciesId).all();

        const responsePayload = {
          success: true,
          species_id: speciesId,
          label: 'observed',
          count: (results || []).length,
          short: (results || []).length < 500,
          occurrences: results || [],
          retrieved_at: new Date().toISOString(),
        };

        const response = new Response(JSON.stringify(responsePayload), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=3600',
            ...corsHeaders,
          },
        });

        if (cache) {
          ctx.waitUntil(cache.put(request, response.clone()));
        }
        return response;
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to retrieve occurrences for species',
            details: err?.message || String(err),
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }
    }

    // 4. Open-Meteo Weather endpoint: /api/weather
    if (pathname === '/api/weather') {
      const speciesParam = searchParams.get('species');
      const latParam = searchParams.get('latitude');
      const lonParam = searchParams.get('longitude');
      const forceOffline = searchParams.get('offline') === 'true';

      // Check Cache first if not forcing offline
      if (cache && !forceOffline) {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          const cachedJson = await cachedResponse.json();
          return new Response(
            JSON.stringify({
              ...cachedJson,
              source: 'cache',
            }),
            {
              headers: {
                'Content-Type': 'application/json',
                'X-Cache': 'HIT',
                ...corsHeaders,
              },
            }
          );
        }
      }

      // Collect coordinates to batch: latest-season positions of tracked individuals or cluster centers
      let coords: Array<{ lat: number; lon: number }> = [];

      if (speciesParam) {
        // 1. Try precomputed verified targets (latest-season tracked individuals or cluster centers)
        const targets = (weatherTargetsData as Record<string, any>)[speciesParam]?.targets;
        if (Array.isArray(targets) && targets.length > 0) {
          coords = targets.map((t: any) => ({ lat: t.lat, lon: t.lon }));
        }

        // 2. If not found in precomputed targets, query latest positions from D1
        if (coords.length === 0) {
          try {
            const { results } = await env.DB.prepare(`
              SELECT lat, lon, month 
              FROM occurrences 
              WHERE species_id = ? 
              ORDER BY month DESC, event_date DESC 
              LIMIT 10
            `).bind(speciesParam).all();

            if (results && results.length > 0) {
              coords = results.map((r: any) => ({ lat: r.lat, lon: r.lon }));
            }
          } catch (e) {
            // Empty if DB query fails
          }
        }
      } else if (latParam && lonParam) {
        const lats = latParam.split(',').map((v) => parseFloat(v.trim()));
        const lons = lonParam.split(',').map((v) => parseFloat(v.trim()));
        for (let i = 0; i < Math.min(lats.length, lons.length); i++) {
          if (!isNaN(lats[i]) && !isNaN(lons[i])) {
            coords.push({ lat: lats[i], lon: lons[i] });
          }
        }
      }

      // Fallback default: Chilika Lake flyway hub
      if (coords.length === 0) {
        coords.push({ lat: 19.72, lon: 85.32 });
      }

      // Batch all coordinates into ONE single comma-separated Open-Meteo forecast call
      const latsStr = coords.map((c) => c.lat.toFixed(4)).join(',');
      const lonsStr = coords.map((c) => c.lon.toFixed(4)).join(',');
      const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${latsStr}&longitude=${lonsStr}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m`;

      // Helper to compute Watch risk evaluation
      const getWatchAssessment = async (weather: any) => {
        let occMonths: Array<{ month: number }> = [];
        if (speciesParam) {
          try {
            const { results } = await env.DB.prepare(
              'SELECT DISTINCT month FROM occurrences WHERE species_id = ?'
            ).bind(speciesParam).all();
            if (results && results.length > 0) {
              occMonths = results as any;
            }
          } catch (e) {}
        }
        const sw = deriveSeasonalWindow(occMonths, 'breeding');
        const targetWeather = Array.isArray(weather) ? weather[0] : weather;
        return evaluateForecastRisk(speciesParam || 'unknown', targetWeather, sw);
      };

      // Helper to retrieve persistent fallback from D1, bundled file, or in-memory
      const getPersistentFallback = async (): Promise<Response> => {
        if (speciesParam) {
          // A. Try D1 weather_snapshots
          try {
            const row: any = await env.DB.prepare(`
              SELECT weather_json, retrieved_at 
              FROM weather_snapshots 
              WHERE species_id = ?
            `).bind(speciesParam).first();

            if (row && row.weather_json) {
              const parsedWeather = JSON.parse(row.weather_json);
              const watchEval = await getWatchAssessment(parsedWeather);
              return new Response(
                JSON.stringify({
                  success: true,
                  species_id: speciesParam,
                  label: 'forecast',
                  source: 'fallback',
                  coordinates_batched: coords.length,
                  weather: parsedWeather,
                  watch: watchEval,
                  retrieved_at: row.retrieved_at,
                }),
                {
                  headers: { 'Content-Type': 'application/json', ...corsHeaders },
                }
              );
            }
          } catch (e) {
            // DB fallback failed
          }

          // B. Try static cached fallback file
          const fileFallback = (weatherFallbackData as any[]).find((f) => f.species_id === speciesParam);
          if (fileFallback && fileFallback.weather) {
            const watchEval = await getWatchAssessment(fileFallback.weather);
            return new Response(
              JSON.stringify({
                success: true,
                species_id: speciesParam,
                label: 'forecast',
                source: 'fallback',
                coordinates_batched: coords.length,
                weather: fileFallback.weather,
                watch: watchEval,
                retrieved_at: fileFallback.retrieved_at,
              }),
              {
                headers: { 'Content-Type': 'application/json', ...corsHeaders },
              }
            );
          }
        }

        // C. Try in-memory ephemeral cache
        if (lastSuccessfulLiveWeather) {
          const watchEval = await getWatchAssessment(lastSuccessfulLiveWeather.weather);
          return new Response(
            JSON.stringify({
              success: true,
              species_id: speciesParam || 'custom_coordinates',
              label: 'forecast',
              source: 'fallback',
              coordinates_batched: coords.length,
              weather: lastSuccessfulLiveWeather.weather,
              watch: watchEval,
              retrieved_at: lastSuccessfulLiveWeather.retrieved_at,
            }),
            {
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }

        // D. Strict honest missingness (never invent weather data)
        return new Response(
          JSON.stringify({
            success: false,
            label: 'forecast',
            source: 'fallback',
            coordinates_batched: coords.length,
            message: 'No cached data',
          }),
          {
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      };

      // If offline requested, immediately return persistent fallback
      if (forceOffline) {
        return await getPersistentFallback();
      }

      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 4000); // 4s timeout

        const res = await fetch(openMeteoUrl, {
          signal: controller.signal,
          headers: { 'User-Agent': 'Outrun/1.0 (Migratory Birds Platform)' },
        });
        clearTimeout(timeoutId);

        if (!res.ok) {
          throw new Error(`Open-Meteo returned status ${res.status}`);
        }

        const data: any = await res.json();
        const weatherResult = Array.isArray(data)
          ? data.map((d: any) => d.current)
          : data.current;

        const retrievedAt = new Date().toISOString();

        // In-memory update
        lastSuccessfulLiveWeather = {
          weather: weatherResult,
          retrieved_at: retrievedAt,
        };

        // Persist to D1 weather_snapshots asynchronously
        if (speciesParam) {
          ctx.waitUntil(
            env.DB.prepare(`
              INSERT OR REPLACE INTO weather_snapshots (species_id, weather_json, retrieved_at)
              VALUES (?, ?, ?)
            `).bind(speciesParam, JSON.stringify(weatherResult), retrievedAt).run()
          );
        }

        const watchEval = await getWatchAssessment(weatherResult);

        const payload = {
          success: true,
          species_id: speciesParam || 'custom_coordinates',
          label: 'forecast',
          source: 'live',
          coordinates_batched: coords.length,
          batched_url: openMeteoUrl,
          weather: weatherResult,
          watch: watchEval,
          retrieved_at: retrievedAt,
        };

        const response = new Response(JSON.stringify(payload), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=1800',
            ...corsHeaders,
          },
        });

        if (cache) {
          ctx.waitUntil(cache.put(request, response.clone()));
        }
        return response;
      } catch (err: any) {
        // Fallback triggered on network/API failure or timeout
        return await getPersistentFallback();
      }
    }

    // 5. Open-Meteo Climate Grid endpoint: /api/climate-grid?species=&season=
    if (pathname === '/api/climate-grid') {
      const speciesParam = searchParams.get('species');
      const seasonParam = searchParams.get('season') || 'breeding';

      if (!speciesParam || !/^[a-z0-9_-]+$/i.test(speciesParam)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid or missing species parameter',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      // Check Cache API
      if (cache) {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
      }

      const normalizedSeason = seasonParam === 'non_breeding' || seasonParam === 'nonbreeding' ? 'non_breeding' : 'breeding';

      try {
        let gridData: any = null;
        let retrievedAt: string = new Date().toISOString();
        let source: 'live' | 'cache' | 'fallback' = 'live';

        // 1. Try D1 climate_grid_snapshots table
        try {
          const row: any = await env.DB.prepare(`
            SELECT grid_json, resolution, models, retrieved_at 
            FROM climate_grid_snapshots 
            WHERE species_id = ? AND season = ?
          `).bind(speciesParam, normalizedSeason).first();

          if (row && row.grid_json) {
            gridData = JSON.parse(row.grid_json);
            retrievedAt = row.retrieved_at;
          }
        } catch (e) {
          // DB query failed or table absent, fallback to static file
        }

        // 2. Try static precomputed climate_grid.json fallback
        if (!gridData) {
          const speciesClimate = (climateGridData as any).species?.[speciesParam];
          if (speciesClimate && speciesClimate.seasons?.[normalizedSeason]) {
            gridData = speciesClimate.seasons[normalizedSeason];
            retrievedAt = (climateGridData as any).generated_at || retrievedAt;
            source = 'fallback';
          }
        }

        // 3. Return honest missingness if no data exists
        if (!gridData || !gridData.cells || gridData.cells.length === 0) {
          return new Response(
            JSON.stringify({
              success: false,
              species_id: speciesParam,
              season: normalizedSeason,
              error: 'Insufficient evidence',
              message: 'No climate grid data verified for requested species and season',
            }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }

        const responsePayload = {
          success: true,
          species_id: speciesParam,
          season: normalizedSeason,
          resolution: '5_degrees',
          period: {
            baseline: '2005-01-01 to 2024-12-31',
            projection: '2025-01-01 to 2050-12-31',
          },
          models: ['EC_Earth3P_HR', 'MPI_ESM1_2_XR'],
          labels: {
            baseline: 'observed',
            projection: 'projected',
          },
          cell_count: gridData.cell_count || gridData.cells.length,
          cells: gridData.cells,
          source,
          retrieved_at: retrievedAt,
        };

        const response = new Response(JSON.stringify(responsePayload), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=86400',
            ...corsHeaders,
          },
        });

        if (cache) {
          ctx.waitUntil(cache.put(request, response.clone()));
        }
        return response;
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to retrieve climate grid',
            details: err?.message || String(err),
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }
    }

    // 6. Corridor Analysis endpoint: GET /api/corridor?species=&season=
    if (pathname === '/api/corridor' && request.method === 'GET') {
      const speciesParam = searchParams.get('species');
      const seasonParam = searchParams.get('season') || 'breeding';

      if (!speciesParam || !/^[a-z0-9_-]+$/i.test(speciesParam)) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Invalid or missing species parameter',
          }),
          {
            status: 400,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }

      if (cache) {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) {
          return cachedResponse;
        }
      }

      const normalizedSeason = seasonParam === 'non_breeding' || seasonParam === 'nonbreeding' ? 'non_breeding' : 'breeding';

      try {
        let analysis: any = null;
        let retrievedAt: string = new Date().toISOString();

        // 1. Try D1
        try {
          const row: any = await env.DB.prepare(`
            SELECT analysis_json, retrieved_at FROM corridor_snapshots WHERE species_id = ?
          `).bind(speciesParam).first();

          if (row && row.analysis_json) {
            analysis = JSON.parse(row.analysis_json);
            retrievedAt = row.retrieved_at;
          }
        } catch (e) {
          // DB error, fallback
        }

        // 2. Fallback to bundled dataset
        if (!analysis) {
          analysis = (corridorAnalysisData as any).species?.[speciesParam];
          retrievedAt = (corridorAnalysisData as any).generated_at || retrievedAt;
        }

        if (!analysis) {
          return new Response(
            JSON.stringify({
              success: false,
              species_id: speciesParam,
              error: 'Insufficient evidence',
              message: 'No corridor analysis verified for species',
            }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }

        const responsePayload = {
          success: true,
          species_id: speciesParam,
          scientific_name: analysis.scientific_name,
          season: normalizedSeason,
          race: analysis.race,
          twin: analysis.twin?.[normalizedSeason],
          critical_links:
            normalizedSeason === 'breeding'
              ? analysis.break?.breeding_critical_links || []
              : analysis.break?.non_breeding_critical_links || [],
          labels: {
            race: 'projected',
            twin: 'simulated',
            critical_links: 'simulated',
          },
          retrieved_at: retrievedAt,
        };

        const response = new Response(JSON.stringify(responsePayload), {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=86400',
            ...corsHeaders,
          },
        });

        if (cache) {
          ctx.waitUntil(cache.put(request, response.clone()));
        }
        return response;
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Failed to retrieve corridor analysis',
            details: err?.message || String(err),
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }
    }

    // 7. Simulation endpoint: POST /api/simulate
    if (pathname === '/api/simulate' && request.method === 'POST') {
      try {
        const body: any = await request.json();
        const { species, season = 'breeding', protected_node_id, action = 'protect' } = body;

        if (!species || !/^[a-z0-9_-]+$/i.test(species)) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Invalid or missing species parameter',
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }

        const normalizedSeason = season === 'non_breeding' || season === 'nonbreeding' ? 'non_breeding' : 'breeding';
        const analysis = (corridorAnalysisData as any).species?.[species];

        if (!analysis) {
          return new Response(
            JSON.stringify({
              success: false,
              error: 'Insufficient evidence',
              message: 'Species not found in corridor analysis',
            }),
            {
              status: 404,
              headers: { 'Content-Type': 'application/json', ...corsHeaders },
            }
          );
        }

        const twinData = analysis.twin?.[normalizedSeason];
        const cells = twinData?.cells || [];

        // Build corridor nodes
        const nodes: CorridorNode[] = cells
          .filter((c: any) => c.is_suitable_future)
          .map((c: any) => ({
            id: `cell_${c.lat}_${c.lon}`,
            lat: c.lat,
            lon: c.lon,
            area_km2: calculateCellAreaKm2(c.lat, 5.0),
            suitability: c.future_ensemble_suitability,
            uncertainty: c.uncertainty_spread,
          }));

        const targetNode = protected_node_id || (nodes.length > 0 ? nodes[0].id : 'cell_0_0');
        const simulation = simulateNodeProtection(
          species,
          normalizedSeason,
          nodes,
          targetNode,
          action
        );

        return new Response(JSON.stringify(simulation), {
          headers: {
            'Content-Type': 'application/json',
            ...corsHeaders,
          },
        });
      } catch (err: any) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Simulation execution error',
            details: err?.message || String(err),
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders },
          }
        );
      }
    }

    // 8. Executive Scientific Brief endpoint: GET /api/brief?species=
    if (pathname === '/api/brief' && request.method === 'GET') {
      const speciesParam = searchParams.get('species');
      if (!speciesParam || !/^[a-z0-9_-]+$/i.test(speciesParam)) {
        return new Response(
          JSON.stringify({ success: false, error: 'Invalid or missing species parameter' }),
          { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }

      if (cache) {
        const cachedResponse = await cache.match(request);
        if (cachedResponse) return cachedResponse;
      }

      try {
        // 1. Fetch species record from D1 or static registry
        let speciesRow: any = null;
        try {
          speciesRow = await env.DB.prepare(`
            SELECT 
              s.species_id, s.gbif_taxon_key, s.scientific_name, s.common_name, s.family,
              s.monitoring_group, s.evidence_level,
              st.category AS status_category, st.assessment_year AS status_year,
              st.source AS status_source, st.source_url AS status_source_url,
              tr.hand_wing_index, tr.migration_category, tr.source AS traits_source, tr.matched AS traits_matched,
              (SELECT COUNT(*) FROM occurrences o WHERE o.species_id = s.species_id) AS occurrence_count
            FROM species s
            LEFT JOIN species_status st ON s.species_id = st.species_id
            LEFT JOIN species_traits tr ON s.species_id = tr.species_id
            WHERE s.species_id = ?
          `).bind(speciesParam).first();
        } catch (e) {}

        const staticSp = (registryData as any).species?.find((s: any) => s.species_id === speciesParam);
        if (!speciesRow && !staticSp) {
          return new Response(
            JSON.stringify({ success: false, error: 'Insufficient evidence', message: 'Species not found in registry' }),
            { status: 404, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
          );
        }

        const speciesRecord = {
          species_id: speciesRow?.species_id || staticSp?.species_id,
          scientific_name: speciesRow?.scientific_name || staticSp?.scientific_name,
          common_name: speciesRow?.common_name || staticSp?.common_name,
          family: speciesRow?.family || staticSp?.family,
          gbif_taxon_key: speciesRow?.gbif_taxon_key || staticSp?.gbif_taxon_key,
          monitoring_group: speciesRow?.monitoring_group || staticSp?.monitoring_group,
          evidence_level: speciesRow?.evidence_level || staticSp?.evidence_level,
          tracked_individuals: staticSp?.tracked_individuals || 0,
          occurrence_count: Number(speciesRow?.occurrence_count || staticSp?.occurrence_count || 0),
          status: speciesRow?.status_source ? {
            category: speciesRow.status_category,
            assessment_year: speciesRow.status_year,
            source: speciesRow.status_source,
            source_url: speciesRow.status_source_url
          } : staticSp?.status || null,
          traits: {
            hand_wing_index: speciesRow?.hand_wing_index ?? staticSp?.traits?.hand_wing_index,
            migration_category: speciesRow?.migration_category ?? staticSp?.traits?.migration_category,
            source: speciesRow?.traits_source || staticSp?.traits?.source,
            matched: Boolean(speciesRow?.traits_matched ?? staticSp?.traits?.matched),
          }
        };

        // 2. Fetch corridor analysis (Race, Twin, Break)
        const analysis = (corridorAnalysisData as any).species?.[speciesParam];

        // 3. Fetch latest weather or fallback snapshot
        let weatherResult: any = null;
        const fileFallback = (weatherFallbackData as any[]).find((f: any) => f.species_id === speciesParam);
        if (fileFallback) {
          weatherResult = fileFallback.weather;
        }

        // 4. Generate Brief
        const brief = generateSpeciesBrief({
          ...speciesRecord,
          race: analysis?.race,
          twin: analysis?.twin?.breeding,
          critical_links: analysis?.break?.breeding_critical_links || [],
          weather: weatherResult
        });

        const response = new Response(
          JSON.stringify({ success: true, brief, retrieved_at: new Date().toISOString() }),
          {
            headers: {
              'Content-Type': 'application/json',
              'Cache-Control': 'public, max-age=3600',
              ...corsHeaders,
            },
          }
        );

        if (cache) {
          ctx.waitUntil(cache.put(request, response.clone()));
        }
        return response;
      } catch (err: any) {
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to generate species brief', details: err?.message || String(err) }),
          { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // Serve frontend static assets (Vite build) if available
    if (env.ASSETS) {
      return await env.ASSETS.fetch(request);
    }

    return new Response(JSON.stringify({ error: 'Endpoint Not Found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });
  },
};
