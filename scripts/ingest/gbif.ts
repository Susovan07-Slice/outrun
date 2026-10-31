import { GBIFMatchResponse, GBIFOccurrence, DatasetMetadata } from './types.js';

const PACING_DELAY_MS = 200;
const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchWithRetry(url: string, options: RequestInit = {}): Promise<any> {
  let attempt = 0;
  let delay = INITIAL_BACKOFF_MS;

  while (attempt <= MAX_RETRIES) {
    try {
      await sleep(PACING_DELAY_MS);
      const res = await fetch(url, {
        ...options,
        headers: {
          'User-Agent': 'Outrun-Aves-Platform/1.0 (Research; conservation pipeline)',
          ...(options.headers || {}),
        },
      });

      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      if (!res.ok) {
        throw new Error(`HTTP request failed with status ${res.status}: ${res.statusText}`);
      }

      return await res.json();
    } catch (err: any) {
      attempt++;
      if (attempt > MAX_RETRIES) {
        throw new Error(`Exceeded max retries (${MAX_RETRIES}) fetching ${url}: ${err.message}`);
      }
      console.warn(`[GBIF Retry] Attempt ${attempt} failed for ${url} (${err.message}). Retrying in ${delay}ms...`);
      await sleep(delay);
      delay *= 2;
    }
  }
}

export async function matchSpecies(name: string): Promise<GBIFMatchResponse> {
  const url = `https://api.gbif.org/v1/species/match?name=${encodeURIComponent(name)}&rank=species`;
  const result: GBIFMatchResponse = await fetchWithRetry(url);

  if (!result || !result.usageKey) {
    throw new Error(`GBIF species match failed for "${name}": No matching taxon found.`);
  }

  // Strict verification: Class MUST be Aves
  if (result.class !== 'Aves') {
    throw new Error(
      `Taxon verification failed for "${name}": Class is "${result.class}", expected "Aves". Only class Aves is permitted.`
    );
  }

  return result;
}

export async function getCommonName(usageKey: number): Promise<string | null> {
  try {
    const url = `https://api.gbif.org/v1/species/${usageKey}/vernacularNames?limit=50`;
    const data = await fetchWithRetry(url);
    if (data && Array.isArray(data.results)) {
      const eng = data.results.find((v: any) => v.language === 'eng' || v.language === 'en');
      if (eng && eng.vernacularName) {
        return eng.vernacularName.trim();
      }
    }
  } catch (e) {
    // Non-fatal
  }
  return null;
}

export async function fetchStratifiedOccurrences(
  taxonKey: number,
  limitPerMonth: number = 42
): Promise<{ occurrences: GBIFOccurrence[]; requestedCount: number }> {
  const allOccurrences: GBIFOccurrence[] = [];
  const requestedTotal = limitPerMonth * 12;

  for (let month = 1; month <= 12; month++) {
    const url = `https://api.gbif.org/v1/occurrence/search?taxonKey=${taxonKey}&hasCoordinate=true&hasGeospatialIssue=false&occurrenceStatus=PRESENT&basisOfRecord=HUMAN_OBSERVATION&year=2010,2026&month=${month}&limit=${limitPerMonth}`;
    try {
      const data = await fetchWithRetry(url);
      if (data && Array.isArray(data.results)) {
        for (const occ of data.results) {
          allOccurrences.push({
            key: occ.key,
            decimalLatitude: occ.decimalLatitude,
            decimalLongitude: occ.decimalLongitude,
            eventDate: occ.eventDate || null,
            month: occ.month || month,
            year: occ.year || null,
            datasetKey: occ.datasetKey || null,
            license: occ.license || null,
            basisOfRecord: occ.basisOfRecord || 'HUMAN_OBSERVATION',
            countryCode: occ.countryCode || null,
            coordinateUncertaintyInMeters: occ.coordinateUncertaintyInMeters || null,
            occurrenceStatus: occ.occurrenceStatus,
            hasCoordinate: occ.hasCoordinate,
            hasGeospatialIssue: occ.hasGeospatialIssue,
          });
        }
      }
    } catch (err: any) {
      console.error(`[GBIF] Error fetching month ${month} for taxonKey ${taxonKey}: ${err.message}`);
      throw err;
    }
  }

  return { occurrences: allOccurrences, requestedCount: requestedTotal };
}

const datasetCache = new Map<string, DatasetMetadata>();

export async function fetchDatasetMetadata(datasetKey: string): Promise<DatasetMetadata> {
  if (datasetCache.has(datasetKey)) {
    return datasetCache.get(datasetKey)!;
  }

  const url = `https://api.gbif.org/v1/dataset/${datasetKey}`;
  try {
    const data = await fetchWithRetry(url);
    const meta: DatasetMetadata = {
      dataset_key: datasetKey,
      title: data.title || 'Untitled Dataset',
      citation: data.citation?.text || data.title || 'GBIF Occurrence Dataset',
      license: data.license || 'Unknown',
    };
    datasetCache.set(datasetKey, meta);
    return meta;
  } catch (err: any) {
    const fallback: DatasetMetadata = {
      dataset_key: datasetKey,
      title: 'GBIF Dataset ' + datasetKey,
      citation: 'GBIF Dataset ' + datasetKey,
      license: 'CC-BY 4.0',
    };
    datasetCache.set(datasetKey, fallback);
    return fallback;
  }
}
