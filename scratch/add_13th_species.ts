import fs from 'node:fs';
import path from 'node:path';
import { matchSpecies, getCommonName, fetchStratifiedOccurrences, fetchDatasetMetadata } from '../scripts/ingest/gbif.js';
import { AVONETMatcher } from '../scripts/ingest/avonet.js';
import { processSpeciesTracks } from '../scripts/ingest/tracking.js';
import { StoredOccurrence, SpeciesRecord, DatasetMetadata } from '../scripts/ingest/types.js';

async function main() {
  console.log('Adding 13th species: Pandion haliaetus (Osprey)...');

  // 1. Update seed_species.csv if not present
  const seedCsvPath = path.resolve('data', 'seed_species.csv');
  const currentSeed = fs.readFileSync(seedCsvPath, 'utf-8');
  if (!currentSeed.includes('Pandion haliaetus')) {
    fs.appendFileSync(seedCsvPath, 'Pandion haliaetus\n');
    console.log('✔ Appended Pandion haliaetus to data/seed_species.csv');
  }

  // 2. GBIF match & Aves verification
  const match = await matchSpecies('Pandion haliaetus');
  console.log('GBIF match:', match.usageKey, match.canonicalName, match.family, match.class);

  // 3. Vernacular name
  let commonName = await getCommonName(match.usageKey!);
  if (!commonName) {
    commonName = 'Osprey';
  }
  console.log('Common name:', commonName);

  // 4. AVONET match
  const avonetMatcher = new AVONETMatcher();
  avonetMatcher.load();
  const traits = avonetMatcher.match('Pandion haliaetus');
  console.log('AVONET traits:', traits);

  // 5. Fetch stratified occurrences (Month 1..12, 42/month)
  console.log('Fetching stratified occurrences from GBIF...');
  const { occurrences: rawOccs, requestedCount } = await fetchStratifiedOccurrences(match.usageKey!, 42);
  const dedupedMap = new Map<string, StoredOccurrence>();
  const datasetKeys = new Set<string>();
  const retrievedAt = new Date().toISOString();

  for (const o of rawOccs) {
    const gbifId = String(o.key);
    if (!dedupedMap.has(gbifId)) {
      if (o.datasetKey) datasetKeys.add(o.datasetKey);
      dedupedMap.set(gbifId, {
        gbif_id: gbifId,
        species_id: 'pandion_haliaetus',
        lat: o.decimalLatitude,
        lon: o.decimalLongitude,
        event_date: o.eventDate || null,
        month: o.month || 1,
        dataset_key: o.datasetKey || null,
        license: o.license || null,
        basis_of_record: o.basisOfRecord || 'HUMAN_OBSERVATION',
        country_code: o.countryCode || null,
        coord_uncertainty_m: o.coordinateUncertaintyInMeters || null,
        retrieved_at: retrievedAt,
      });
    }
  }

  const occurrencesList = Array.from(dedupedMap.values());
  console.log(`Retrieved ${occurrencesList.length} occurrences for pandion_haliaetus`);

  // Write occurrences to data and public
  const occPayload = {
    species_id: 'pandion_haliaetus',
    label: 'observed',
    count: occurrencesList.length,
    short: occurrencesList.length < 500,
    retrieved_at: retrievedAt,
    occurrences: occurrencesList,
  };

  fs.writeFileSync(
    path.resolve('data', 'generated', 'occurrences', 'pandion_haliaetus.json'),
    JSON.stringify(occPayload, null, 2),
    'utf-8'
  );
  fs.writeFileSync(
    path.resolve('public', 'data', 'generated', 'occurrences', 'pandion_haliaetus.json'),
    JSON.stringify(occPayload, null, 2),
    'utf-8'
  );
  console.log('✔ Wrote occurrences JSON files');

  // 6. Update registry.json in data and public
  const registryPath = path.resolve('data', 'generated', 'registry.json');
  const reg = JSON.parse(fs.readFileSync(registryPath, 'utf-8'));
  const existingSpecies = reg.species.filter((s: any) => s.species_id !== 'pandion_haliaetus');

  const newSpeciesRecord: SpeciesRecord = {
    species_id: 'pandion_haliaetus',
    gbif_taxon_key: match.usageKey!,
    scientific_name: match.canonicalName || 'Pandion haliaetus',
    common_name: commonName,
    family: match.family || 'Pandionidae',
    monitoring_group: 'review_required',
    last_checked_at: retrievedAt,
    status: null,
    traits: traits,
    stats: {
      requested_records: requestedCount,
      received_records: occurrencesList.length,
      short: occurrencesList.length < 500,
    },
    evidence_level: 'tracks',
  };

  existingSpecies.push(newSpeciesRecord);

  reg.species_count = existingSpecies.length;
  reg.species = existingSpecies;
  reg.generated_at = new Date().toISOString();

  fs.writeFileSync(registryPath, JSON.stringify(reg, null, 2), 'utf-8');
  fs.writeFileSync(
    path.resolve('public', 'data', 'generated', 'registry.json'),
    JSON.stringify(reg, null, 2),
    'utf-8'
  );
  console.log(`✔ Updated registry.json (Total species: ${existingSpecies.length})`);

  // 7. Process tracks for all species (including Pandion haliaetus)
  console.log('Processing species tracks...');
  const { trackedSpeciesReport } = await processSpeciesTracks();
  console.log('Tracked species report:', trackedSpeciesReport);

  // Update registry evidence levels based on track report
  for (const rep of trackedSpeciesReport) {
    const sp = reg.species.find((s: any) => s.species_id === rep.species_id);
    if (sp) {
      sp.evidence_level = rep.evidence_level;
      sp.tracked_individuals = rep.individuals;
    }
  }
  fs.writeFileSync(registryPath, JSON.stringify(reg, null, 2), 'utf-8');
  fs.writeFileSync(
    path.resolve('public', 'data', 'generated', 'registry.json'),
    JSON.stringify(reg, null, 2),
    'utf-8'
  );

  console.log('✔ Done adding 13th species!');
}

main().catch(console.error);
