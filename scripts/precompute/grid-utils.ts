/**
 * Grid and Spatial Range Utilities for Outrun Climate Pipeline
 * 
 * - Coarse 5-degree global grid snapping (~555 km at equator)
 * - Season derivation (breeding vs non-breeding ranges)
 * - Latest individual tracking positions & occurrence cluster centers
 */

import fs from 'node:fs';
import path from 'node:path';

export interface GridCell {
  lat: number;
  lon: number;
  key: string; // "lat_lon"
}

export interface SpeciesRangeCells {
  species_id: string;
  scientific_name: string;
  breeding_cells: GridCell[];
  non_breeding_cells: GridCell[];
  all_cells: GridCell[];
}

export interface TargetCoordinate {
  lat: number;
  lon: number;
  source: 'tracked_individual_latest' | 'occurrence_cluster_center';
  label: string;
}

/**
 * Snap a latitude and longitude to a coarse ~5-degree grid center.
 * Latitudes clamped to [-85, 85], Longitudes to [-180, 175].
 */
export function snapTo5DegreeGrid(lat: number, lon: number): GridCell {
  let snappedLat = Math.round(lat / 5) * 5;
  let snappedLon = Math.round(lon / 5) * 5;

  if (snappedLat > 85) snappedLat = 85;
  if (snappedLat < -85) snappedLat = -85;
  if (snappedLon > 180) snappedLon = 180;
  if (snappedLon < -180) snappedLon = -180;
  if (snappedLon === 180) snappedLon = -180;

  return {
    lat: snappedLat,
    lon: snappedLon,
    key: `${snappedLat.toFixed(1)}_${snappedLon.toFixed(1)}`,
  };
}

/**
 * Derives breeding and non-breeding grid cells for a species from occurrences and tracks.
 */
export function extractSpeciesRangeCells(
  speciesId: string,
  scientificName: string,
  occurrences: Array<{ lat: number; lon: number; month: number }>,
  trackFeatures?: Array<{ geometry: { coordinates: number[][] }; properties?: { times?: number[] } }>
): SpeciesRangeCells {
  const breedingMap = new Map<string, GridCell>();
  const nonBreedingMap = new Map<string, GridCell>();
  const allMap = new Map<string, GridCell>();

  // 1. Process occurrences by month
  for (const occ of occurrences) {
    const cell = snapTo5DegreeGrid(occ.lat, occ.lon);
    allMap.set(cell.key, cell);

    // Breeding season months: 5, 6, 7, 8 (May - August)
    if (occ.month >= 5 && occ.month <= 8) {
      breedingMap.set(cell.key, cell);
    }
    // Non-breeding / wintering months: 11, 12, 1, 2 (Nov - Feb)
    else if (occ.month === 11 || occ.month === 12 || occ.month === 1 || occ.month === 2) {
      nonBreedingMap.set(cell.key, cell);
    }
  }

  // 2. Process track coordinates if present
  if (trackFeatures && trackFeatures.length > 0) {
    for (const feat of trackFeatures) {
      const coords = feat.geometry.coordinates;
      const times = feat.properties?.times || [];

      for (let i = 0; i < coords.length; i++) {
        const [lon, lat] = coords[i];
        const cell = snapTo5DegreeGrid(lat, lon);
        allMap.set(cell.key, cell);

        if (times[i]) {
          const date = new Date(times[i] * 1000);
          const month = date.getUTCMonth() + 1;
          if (month >= 5 && month <= 8) {
            breedingMap.set(cell.key, cell);
          } else if (month === 11 || month === 12 || month === 1 || month === 2) {
            nonBreedingMap.set(cell.key, cell);
          }
        }
      }
    }
  }

  // If a species has winter records only, non-breeding holds the verified cells
  // If breeding is empty, we do not fabricate; we honestly leave it empty or insufficient
  return {
    species_id: speciesId,
    scientific_name: scientificName,
    breeding_cells: Array.from(breedingMap.values()),
    non_breeding_cells: Array.from(nonBreedingMap.values()),
    all_cells: Array.from(allMap.values()),
  };
}

/**
 * Extracts latest-season positions of tracked individuals or occurrence cluster centers
 * for a species to batch into Open-Meteo forecast queries.
 */
export function extractLatestWeatherTargets(
  speciesId: string,
  occurrences: Array<{ lat: number; lon: number; month: number }>,
  trackFeatures?: Array<{ geometry: { coordinates: number[][] }; properties?: any }>
): TargetCoordinate[] {
  const targets: TargetCoordinate[] = [];

  // 1. If real tracked individuals exist, extract the latest position of each individual
  if (trackFeatures && trackFeatures.length > 0) {
    for (let idx = 0; idx < trackFeatures.length; idx++) {
      const feat = trackFeatures[idx];
      const coords = feat.geometry.coordinates;
      if (coords && coords.length > 0) {
        const lastCoord = coords[coords.length - 1];
        targets.push({
          lat: Number(lastCoord[1].toFixed(4)),
          lon: Number(lastCoord[0].toFixed(4)),
          source: 'tracked_individual_latest',
          label: `Individual #${idx + 1} (latest fix)`,
        });
      }
      // Cap at 15 individuals to keep batching URL compact and well within single HTTP limits
      if (targets.length >= 15) break;
    }
    if (targets.length > 0) return targets;
  }

  // 2. If occurrence-only species, compute latest-season cluster centers
  if (occurrences && occurrences.length > 0) {
    // Determine latest recorded month in dataset
    const months = occurrences.map((o) => o.month);
    const maxMonth = Math.max(...months);
    const latestOccs = occurrences.filter((o) => o.month === maxMonth);

    // Group into coarse 5-degree grid clusters to find representative cluster centers
    const clusterMap = new Map<string, { sumLat: number; sumLon: number; count: number }>();
    for (const occ of latestOccs) {
      const key = `${Math.round(occ.lat / 5) * 5}_${Math.round(occ.lon / 5) * 5}`;
      const existing = clusterMap.get(key) || { sumLat: 0, sumLon: 0, count: 0 };
      existing.sumLat += occ.lat;
      existing.sumLon += occ.lon;
      existing.count += 1;
      clusterMap.set(key, existing);
    }

    // Sort clusters by occurrence density and pick top centroids
    const sortedClusters = Array.from(clusterMap.entries())
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10);

    for (let i = 0; i < sortedClusters.length; i++) {
      const cluster = sortedClusters[i][1];
      targets.push({
        lat: Number((cluster.sumLat / cluster.count).toFixed(4)),
        lon: Number((cluster.sumLon / cluster.count).toFixed(4)),
        source: 'occurrence_cluster_center',
        label: `Month ${maxMonth} Cluster #${i + 1} (${cluster.count} records)`,
      });
    }
  }

  // Fallback to Chilika Lake flyway hub if no coordinates present
  if (targets.length === 0) {
    targets.push({
      lat: 19.72,
      lon: 85.32,
      source: 'occurrence_cluster_center',
      label: 'Chilika Lake Stopover Hub',
    });
  }

  return targets;
}
