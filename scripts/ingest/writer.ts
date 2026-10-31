import fs from 'node:fs';
import path from 'node:path';
import { SpeciesRecord, StoredOccurrence, DatasetMetadata, IngestionRunSummary } from './types.js';

export class DataWriter {
  private baseDir = path.resolve('data', 'generated');
  private occDir = path.resolve('data', 'generated', 'occurrences');
  private dbDir = path.resolve('db');

  constructor() {
    fs.mkdirSync(this.baseDir, { recursive: true });
    fs.mkdirSync(this.occDir, { recursive: true });
    fs.mkdirSync(this.dbDir, { recursive: true });
  }

  public writeSpeciesOccurrences(speciesId: string, occurrences: StoredOccurrence[]): void {
    const filePath = path.join(this.occDir, `${speciesId}.json`);
    const payload = {
      species_id: speciesId,
      label: 'observed',
      count: occurrences.length,
      short: occurrences.length < 500,
      retrieved_at: new Date().toISOString(),
      occurrences,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  public writeRegistry(speciesList: SpeciesRecord[]): void {
    const filePath = path.join(this.baseDir, 'registry.json');
    const payload = {
      version: '1.0.0',
      generated_at: new Date().toISOString(),
      species_count: speciesList.length,
      species: speciesList,
    };
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8');
  }

  public writeDatasets(datasets: DatasetMetadata[]): void {
    const filePath = path.join(this.baseDir, 'datasets.json');
    fs.writeFileSync(filePath, JSON.stringify(datasets, null, 2), 'utf-8');
  }

  public writeSeedSql(
    speciesList: SpeciesRecord[],
    allOccurrences: StoredOccurrence[],
    datasets: DatasetMetadata[],
    runSummary: IngestionRunSummary
  ): string {
    const seedPath = path.join(this.dbDir, 'seed.sql');
    const statements: string[] = [];

    statements.push('-- Auto-generated Outrun D1 Seed SQL');
    statements.push(`-- Run ID: ${runSummary.run_id}`);
    statements.push(`-- Generated At: ${new Date().toISOString()}`);
    statements.push('');

    // 1. Datasets
    for (const d of datasets) {
      const titleEsc = this.escapeSql(d.title);
      const citEsc = this.escapeSql(d.citation);
      const licEsc = this.escapeSql(d.license);
      statements.push(
        `INSERT OR REPLACE INTO datasets (dataset_key, title, citation, license) VALUES ('${d.dataset_key}', '${titleEsc}', '${citEsc}', '${licEsc}');`
      );
    }
    statements.push('');

    // 2. Species, status, traits
    for (const s of speciesList) {
      const sciEsc = this.escapeSql(s.scientific_name);
      const comEsc = s.common_name ? `'${this.escapeSql(s.common_name)}'` : 'NULL';
      const famEsc = s.family ? `'${this.escapeSql(s.family)}'` : 'NULL';
      const group = s.monitoring_group;
      const lastChecked = `'${s.last_checked_at}'`;

      statements.push(
        `INSERT OR REPLACE INTO species (species_id, gbif_taxon_key, scientific_name, common_name, family, monitoring_group, last_checked_at) VALUES ('${s.species_id}', ${s.gbif_taxon_key}, '${sciEsc}', ${comEsc}, ${famEsc}, '${group}', ${lastChecked});`
      );

      // Species Status (Rule 5: NULL until verified by token/API)
      if (s.status && s.status.source) {
        const catEsc = s.status.category ? `'${this.escapeSql(s.status.category)}'` : 'NULL';
        const yr = s.status.assessment_year !== null ? s.status.assessment_year : 'NULL';
        const srcEsc = `'${this.escapeSql(s.status.source)}'`;
        const urlEsc = s.status.source_url ? `'${this.escapeSql(s.status.source_url)}'` : 'NULL';
        const retEsc = s.status.retrieved_at ? `'${s.status.retrieved_at}'` : 'NULL';
        statements.push(
          `INSERT OR REPLACE INTO species_status (species_id, category, assessment_year, source, source_url, retrieved_at) VALUES ('${s.species_id}', ${catEsc}, ${yr}, ${srcEsc}, ${urlEsc}, ${retEsc});`
        );
      } else {
        // Status remains NULL as unverified
        statements.push(
          `INSERT OR REPLACE INTO species_status (species_id, category, assessment_year, source, source_url, retrieved_at) VALUES ('${s.species_id}', NULL, NULL, NULL, NULL, '${new Date().toISOString()}');`
        );
      }

      // Species Traits
      const hwi = s.traits.hand_wing_index !== null ? s.traits.hand_wing_index : 'NULL';
      const mig = s.traits.migration_category !== null ? s.traits.migration_category : 'NULL';
      const trSrc = s.traits.source ? `'${this.escapeSql(s.traits.source)}'` : 'NULL';
      const trVer = s.traits.source_version ? `'${this.escapeSql(s.traits.source_version)}'` : 'NULL';
      const matched = s.traits.matched ? 1 : 0;

      statements.push(
        `INSERT OR REPLACE INTO species_traits (species_id, hand_wing_index, migration_category, source, source_version, matched) VALUES ('${s.species_id}', ${hwi}, ${mig}, ${trSrc}, ${trVer}, ${matched});`
      );
    }
    statements.push('');

    // 3. Occurrences (batched in chunks of 500)
    statements.push('-- Occurrences batches');
    const BATCH_SIZE = 200;
    for (let i = 0; i < allOccurrences.length; i += BATCH_SIZE) {
      const chunk = allOccurrences.slice(i, i + BATCH_SIZE);
      const values = chunk.map((o) => {
        const evDate = o.event_date ? `'${this.escapeSql(o.event_date)}'` : 'NULL';
        const dKey = o.dataset_key ? `'${this.escapeSql(o.dataset_key)}'` : 'NULL';
        const lic = o.license ? `'${this.escapeSql(o.license)}'` : 'NULL';
        const bor = o.basis_of_record ? `'${this.escapeSql(o.basis_of_record)}'` : 'NULL';
        const cc = o.country_code ? `'${this.escapeSql(o.country_code)}'` : 'NULL';
        const uncert = o.coord_uncertainty_m !== null ? o.coord_uncertainty_m : 'NULL';
        return `('${o.gbif_id}', '${o.species_id}', ${o.lat}, ${o.lon}, ${evDate}, ${o.month}, ${dKey}, ${lic}, ${bor}, ${cc}, ${uncert}, '${o.retrieved_at}')`;
      });

      statements.push(
        `INSERT OR REPLACE INTO occurrences (gbif_id, species_id, lat, lon, event_date, month, dataset_key, license, basis_of_record, country_code, coord_uncertainty_m, retrieved_at) VALUES\n  ${values.join(',\n  ')};`
      );
    }
    statements.push('');

    // 4. Ingestion Runs
    const failuresJson = this.escapeSql(JSON.stringify(runSummary.failures));
    statements.push(
      `INSERT OR REPLACE INTO ingestion_runs (run_id, started_at, finished_at, species_count, record_count, failures_json) VALUES ('${runSummary.run_id}', '${runSummary.started_at}', '${runSummary.finished_at}', ${runSummary.species_count}, ${runSummary.record_count}, '${failuresJson}');`
    );

    const fullSql = statements.join('\n');
    fs.writeFileSync(seedPath, fullSql, 'utf-8');
    return seedPath;
  }

  private escapeSql(str: string): string {
    return str.replace(/'/g, "''");
  }
}
