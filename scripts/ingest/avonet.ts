import fs from 'node:fs';
import path from 'node:path';

export interface AVONETRecord {
  hand_wing_index: number | null;
  migration_category: number | null;
  source: string | null;
  source_version: string | null;
  matched: boolean;
}

export class AVONETMatcher {
  private lookup = new Map<string, { hwi: number | null; migration: number | null }>();
  private loaded = false;
  private filename = '';

  constructor(private avonetDir: string = path.resolve('data', 'avonet')) {}

  public load(): void {
    if (this.loaded) return;

    if (!fs.existsSync(this.avonetDir)) {
      console.warn(`[AVONET] Directory "${this.avonetDir}" does not exist. Marking all species traits as unmatched.`);
      this.loaded = true;
      return;
    }

    const files = fs.readdirSync(this.avonetDir).filter((f) => f.endsWith('.csv'));
    if (files.length === 0) {
      console.warn(`[AVONET] No CSV files found in "${this.avonetDir}". Marking all species traits as unmatched.`);
      this.loaded = true;
      return;
    }

    // Pick the first available CSV
    const csvPath = path.join(this.avonetDir, files[0]);
    this.filename = files[0];
    console.log(`[AVONET] Inspecting trait dataset at: ${csvPath}`);

    const content = fs.readFileSync(csvPath, 'utf-8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);

    if (lines.length < 2) {
      console.warn(`[AVONET] CSV "${csvPath}" has insufficient rows.`);
      this.loaded = true;
      return;
    }

    const headerLine = lines[0];
    const headers = this.parseCSVLine(headerLine);

    // Dynamically identify column indices without assuming fixed names
    const speciesColIdx = headers.findIndex((h) =>
      /^(species1|species_name|scientific_name|species|taxon)$/i.test(h.replace(/[^a-z0-9]/gi, ''))
    );
    const hwiColIdx = headers.findIndex((h) =>
      /^(handwingindex|hwi|handwing_index)$/i.test(h.replace(/[^a-z0-9]/gi, ''))
    );
    const migrationColIdx = headers.findIndex((h) =>
      /^(migration|migrationcategory|migration_category)$/i.test(h.replace(/[^a-z0-9]/gi, ''))
    );

    console.log(
      `[AVONET] Resolved columns: Species -> "${headers[speciesColIdx]}" (col ${speciesColIdx}), Hand-Wing Index -> "${headers[hwiColIdx]}" (col ${hwiColIdx}), Migration -> "${headers[migrationColIdx]}" (col ${migrationColIdx})`
    );

    if (speciesColIdx === -1) {
      console.error(`[AVONET] ERROR: Could not identify scientific name column in headers:`, headers);
      this.loaded = true;
      return;
    }

    let parsedCount = 0;
    for (let i = 1; i < lines.length; i++) {
      const row = this.parseCSVLine(lines[i]);
      if (row.length <= speciesColIdx) continue;

      const rawSpecies = row[speciesColIdx]?.trim();
      if (!rawSpecies) continue;

      const cleanSpecies = rawSpecies.toLowerCase().replace(/\s+/g, ' ');

      const rawHwi = hwiColIdx !== -1 ? row[hwiColIdx]?.trim() : null;
      const hwi = rawHwi && !isNaN(Number(rawHwi)) ? Number(rawHwi) : null;

      const rawMig = migrationColIdx !== -1 ? row[migrationColIdx]?.trim() : null;
      const migration = rawMig && !isNaN(Number(rawMig)) ? parseInt(rawMig, 10) : null;

      this.lookup.set(cleanSpecies, { hwi, migration });
      parsedCount++;
    }

    console.log(`[AVONET] Successfully indexed ${parsedCount} species from ${this.filename}`);
    this.loaded = true;
  }

  public match(scientificName: string): AVONETRecord {
    if (!this.loaded) {
      this.load();
    }

    const key = scientificName.toLowerCase().trim().replace(/\s+/g, ' ');
    const trait = this.lookup.get(key);

    if (trait) {
      return {
        hand_wing_index: trait.hwi,
        migration_category: trait.migration,
        source: 'AVONET (Tobias et al. 2022)',
        source_version: this.filename || 'BirdLife 2022',
        matched: true,
      };
    }

    console.warn(`[AVONET Unmatched] Species "${scientificName}" was not found in AVONET CSV.`);
    return {
      hand_wing_index: null,
      migration_category: null,
      source: null,
      source_version: null,
      matched: false,
    };
  }

  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    result.push(cur.trim());
    return result;
  }
}
