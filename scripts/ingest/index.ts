import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { matchSpecies, getCommonName, fetchStratifiedOccurrences, fetchDatasetMetadata } from './gbif.js';
import { AVONETMatcher } from './avonet.js';
import { DataWriter } from './writer.js';
import { SpeciesRecord, StoredOccurrence, DatasetMetadata, IngestionRunSummary } from './types.js';

async function main() {
  const startedAt = new Date().toISOString();
  const runId = `run_${Date.now()}`;
  console.log(`\n======================================================`);
  console.log(`=== Outrun Ingestion Pipeline (Class Aves Only)   ===`);
  console.log(`=== Run ID: ${runId}                      ===`);
  console.log(`======================================================\n`);

  // 1. Read seed species
  const seedFile = path.resolve('data', 'seed_species.csv');
  if (!fs.existsSync(seedFile)) {
    throw new Error(`Seed species file not found at ${seedFile}`);
  }

  const rawSeed = fs.readFileSync(seedFile, 'utf-8');
  const seedNames = rawSeed
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith('#') && l.toLowerCase() !== 'scientific_name');

  console.log(`Found ${seedNames.length} species in seed list.`);

  // 2. Initialize AVONET Matcher
  const avonetMatcher = new AVONETMatcher();
  avonetMatcher.load();

  // 3. Initialize Data Writer
  const writer = new DataWriter();

  const speciesRecords: SpeciesRecord[] = [];
  const allStoredOccurrences: StoredOccurrence[] = [];
  const datasetKeysSet = new Set<string>();
  const failures: IngestionRunSummary['failures'] = [];

  const perSpeciesSummary: Array<{
    name: string;
    requested: number;
    received: number;
    short: boolean;
    avonetMatched: boolean;
  }> = [];

  const iucnToken = process.env.IUCN_TOKEN || null;

  for (const sciName of seedNames) {
    console.log(`\n--------------------------------------------------`);
    console.log(`Processing species: "${sciName}"...`);

    try {
      // Step A: GBIF match & Aves verification
      const match = await matchSpecies(sciName);
      const usageKey = match.usageKey!;
      const canonicalName = match.canonicalName || match.scientificName || sciName;
      const family = match.family || null;
      const speciesId = canonicalName.toLowerCase().replace(/[^a-z0-9]+/g, '_');

      console.log(`✔ GBIF Matched: ${canonicalName} (TaxonKey: ${usageKey}, Family: ${family})`);

      // Step B: Vernacular Name
      const commonName = await getCommonName(usageKey);
      if (commonName) {
        console.log(`✔ Common Name: "${commonName}"`);
      }

      // Step C: AVONET Traits Join
      const traitResult = avonetMatcher.match(canonicalName);
      if (traitResult.matched) {
        console.log(`✔ AVONET Matched: HWI=${traitResult.hand_wing_index}, MigrationCategory=${traitResult.migration_category}`);
      } else {
        console.log(`⚠ AVONET Unmatched for "${canonicalName}"`);
      }

      // Step D: IUCN Status Check (Rule 5: verified source only, otherwise NULL & review_required)
      let statusData: SpeciesRecord['status'] = null;
      let monitoringGroup: SpeciesRecord['monitoring_group'] = 'review_required';

      if (iucnToken) {
        try {
          const iucnRes = await fetch(
            `https://apiv3.iucnredlist.org/api/v3/species/${encodeURIComponent(canonicalName)}?token=${iucnToken}`
          );
          if (iucnRes.ok) {
            const iucnJson: any = await iucnRes.json();
            if (iucnJson.result && iucnJson.result.length > 0) {
              const res = iucnJson.result[0];
              const cat = res.category;
              statusData = {
                category: cat,
                assessment_year: res.assessment_year ? parseInt(res.assessment_year, 10) : null,
                source: 'IUCN Red List of Threatened Species',
                source_url: `https://www.iucnredlist.org/species/${usageKey}`,
                retrieved_at: new Date().toISOString(),
              };

              if (['CR', 'EN', 'VU'].includes(cat)) {
                monitoringGroup = 'threatened_priority';
              } else if (cat === 'LC') {
                monitoringGroup = 'common_widespread';
              }
              console.log(`✔ IUCN Status verified: ${cat}`);
            }
          }
        } catch (e: any) {
          console.warn(`[IUCN] Error querying IUCN API: ${e.message}`);
        }
      } else {
        console.log(`ℹ No IUCN_TOKEN provided. In accordance with Rule 5: status=NULL, monitoring_group='review_required'.`);
      }

      // Step E: Stratified Occurrence Sampling (Month 1..12, ~42/month)
      console.log(`Fetching stratified seasonal occurrences (12 months)...`);
      const { occurrences: rawOccs, requestedCount } = await fetchStratifiedOccurrences(usageKey, 42);

      // Deduplicate by gbifID
      const dedupedMap = new Map<string, StoredOccurrence>();
      const retrievedAt = new Date().toISOString();

      for (const o of rawOccs) {
        const gbifId = String(o.key);
        if (!dedupedMap.has(gbifId)) {
          if (o.datasetKey) {
            datasetKeysSet.add(o.datasetKey);
          }
          dedupedMap.set(gbifId, {
            gbif_id: gbifId,
            species_id: speciesId,
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
      const receivedCount = occurrencesList.length;
      const isShort = receivedCount < 500;

      console.log(`✔ Stratified Occurrences: ${receivedCount} received / ${requestedCount} requested (Short: ${isShort})`);

      // Write species occurrences file
      writer.writeSpeciesOccurrences(speciesId, occurrencesList);
      allStoredOccurrences.push(...occurrencesList);

      const record: SpeciesRecord = {
        species_id: speciesId,
        gbif_taxon_key: usageKey,
        scientific_name: canonicalName,
        common_name: commonName,
        family,
        monitoring_group: monitoringGroup,
        last_checked_at: retrievedAt,
        status: statusData,
        traits: traitResult,
        stats: {
          requested_records: requestedCount,
          received_records: receivedCount,
          short: isShort,
        },
      };

      speciesRecords.push(record);
      perSpeciesSummary.push({
        name: canonicalName,
        requested: requestedCount,
        received: receivedCount,
        short: isShort,
        avonetMatched: traitResult.matched,
      });
    } catch (err: any) {
      console.error(`✖ FAILED processing species "${sciName}": ${err.message}`);
      failures.push({
        species: sciName,
        stage: 'ingestion',
        error: err.message,
      });
    }
  }

  // 4. Fetch Dataset Metadata
  console.log(`\n--------------------------------------------------`);
  console.log(`Fetching institutional metadata for ${datasetKeysSet.size} unique datasetKeys...`);
  const datasetsList: DatasetMetadata[] = [];
  for (const dKey of datasetKeysSet) {
    try {
      const meta = await fetchDatasetMetadata(dKey);
      datasetsList.push(meta);
    } catch (err: any) {
      console.warn(`[Dataset] Failed metadata for ${dKey}: ${err.message}`);
    }
  }
  writer.writeDatasets(datasetsList);
  console.log(`✔ Saved metadata for ${datasetsList.length} datasets.`);

  // 5. Write Registry & Seed SQL
  writer.writeRegistry(speciesRecords);

  const finishedAt = new Date().toISOString();
  const runSummary: IngestionRunSummary = {
    run_id: runId,
    started_at: startedAt,
    finished_at: finishedAt,
    species_count: speciesRecords.length,
    record_count: allStoredOccurrences.length,
    failures,
  };

  const seedSqlPath = writer.writeSeedSql(speciesRecords, allStoredOccurrences, datasetsList, runSummary);
  console.log(`✔ Generated SQL seed file at: ${seedSqlPath}`);

  // 6. Execute D1 Local Load
  console.log(`\nInitializing & loading local Cloudflare D1 database...`);
  try {
    console.log(`Applying schema to local D1 (outrun-db)...`);
    execSync(`npx wrangler d1 execute outrun-db --local --file=db/schema.sql`, { stdio: 'inherit' });
    console.log(`Loading seed data into local D1 SQLite...`);
    execSync(`python scripts/seed_d1.py`, { stdio: 'inherit' });
    console.log(`✔ Local D1 database successfully seeded!`);
  } catch (err: any) {
    console.warn(`[D1 Warning] Could not automatically load local D1: ${err.message}`);
    console.log(`Run manually: npm run d1:init && npm run d1:seed`);
  }

  // 7. Output Per-Species Table Report
  console.log(`\n========================================================================`);
  console.log(`=== INGESTION SUMMARY REPORT                                         ===`);
  console.log(`========================================================================`);
  console.log(`Species Processed: ${speciesRecords.length}/${seedNames.length}`);
  console.log(`Total Occurrences: ${allStoredOccurrences.length}`);
  console.log(`Datasets Attributed: ${datasetsList.length}`);
  console.log(`Failures: ${failures.length}`);
  console.log(`------------------------------------------------------------------------`);
  console.log(`Species Name              | Requested | Received | Short (<500) | AVONET`);
  console.log(`--------------------------+-----------+----------+--------------+-------`);
  for (const s of perSpeciesSummary) {
    const namePad = s.name.padEnd(25, ' ');
    const reqPad = String(s.requested).padStart(9, ' ');
    const recPad = String(s.received).padStart(8, ' ');
    const shortPad = (s.short ? 'YES' : 'NO').padStart(12, ' ');
    const avoPad = (s.avonetMatched ? 'MATCHED' : 'UNMATCHED').padStart(7, ' ');
    console.log(`${namePad} | ${reqPad} | ${recPad} | ${shortPad} | ${avoPad}`);
  }
  console.log(`========================================================================\n`);

  if (failures.length > 0) {
    console.warn(`Failures recorded:`, JSON.stringify(failures, null, 2));
  }
}

main().catch((err) => {
  console.error(`FATAL INGESTION ERROR:`, err);
  process.exit(1);
});
