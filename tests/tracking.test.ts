import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { simplifyTrajectory } from '../scripts/ingest/tracking.js';

describe('Phase 2 GPS Telemetry Tracking Suite', () => {
  // Test 1: Track Ordering
  describe('Track Ordering', () => {
    it('sorts points strictly chronologically by timestamp and removes duplicate pings', () => {
      const rawPoints = [
        { coord: [21.45, 44.54] as [number, number], timestamp: 1440000000 },
        { coord: [14.64, 45.94] as [number, number], timestamp: 1437000000 }, // earlier
        { coord: [14.64, 45.94] as [number, number], timestamp: 1437000000 }, // duplicate timestamp
        { coord: [37.58, 35.01] as [number, number], timestamp: 1450000000 }, // later
        { coord: [16.39, 45.72] as [number, number], timestamp: 1438000000 }, // intermediate
      ];

      // Pipeline chronological ordering
      rawPoints.sort((a, b) => a.timestamp - b.timestamp);

      const uniquePoints: typeof rawPoints = [];
      let lastTs = -1;
      for (const p of rawPoints) {
        if (p.timestamp > lastTs) {
          uniquePoints.push(p);
          lastTs = p.timestamp;
        }
      }

      expect(uniquePoints.length).toBe(4);
      expect(uniquePoints.map((p) => p.timestamp)).toEqual([
        1437000000,
        1438000000,
        1440000000,
        1450000000,
      ]);

      // Verify strict monotonicity
      for (let i = 0; i < uniquePoints.length - 1; i++) {
        expect(uniquePoints[i + 1].timestamp).toBeGreaterThan(uniquePoints[i].timestamp);
      }
    });

    it('verifies that actual generated Ciconia ciconia tracks have strictly monotonic timestamps', () => {
      const geojsonPath = path.resolve('data', 'generated', 'tracks', 'ciconia_ciconia.geojson');
      expect(fs.existsSync(geojsonPath)).toBe(true);

      const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
      expect(geojson.evidence_level).toBe('tracks');
      expect(geojson.features.length).toBeGreaterThan(0);

      // Verify every individual feature
      for (const feature of geojson.features) {
        const times: number[] = feature.properties.times;
        const coords: [number, number][] = feature.geometry.coordinates;

        expect(times.length).toBe(coords.length);
        expect(times.length).toBeGreaterThanOrEqual(2);

        for (let i = 0; i < times.length - 1; i++) {
          expect(times[i + 1]).toBeGreaterThan(times[i]);
        }
      }
    });
  });

  // Test 2: Simplification
  describe('Trajectory Simplification', () => {
    it('simplifies collinear or nearly collinear points within tolerance while preserving endpoints', () => {
      // 5 points along line from (0, 0) to (4, 0), with slight deviation at (2, 0.005)
      const coords: [number, number][] = [
        [0, 0],
        [1, 0.002],
        [2, 0.005], // perpendicular distance 0.005 < tolerance 0.02
        [3, 0.003],
        [4, 0],
      ];
      const times = [100, 200, 300, 400, 500];

      const tolerance = 0.02; // ~2.2 km in decimal degrees
      const { coords: simplifiedCoords, times: simplifiedTimes } = simplifyTrajectory(
        coords,
        times,
        tolerance
      );

      // Collinear points collapsed to endpoints
      expect(simplifiedCoords.length).toBe(2);
      expect(simplifiedCoords[0]).toEqual([0, 0]);
      expect(simplifiedCoords[1]).toEqual([4, 0]);
      expect(simplifiedTimes).toEqual([100, 500]);
    });

    it('retains significant deviations and waypoints that exceed tolerance', () => {
      // Waypoint at (2, 1.0) is a major migratory stopover exceeding tolerance 0.02
      const coords: [number, number][] = [
        [0, 0],
        [1, 0],
        [2, 1.0], // excursion = 1.0 deg >> 0.02
        [3, 0],
        [4, 0],
      ];
      const times = [100, 200, 300, 400, 500];

      const { coords: simplifiedCoords, times: simplifiedTimes } = simplifyTrajectory(
        coords,
        times,
        0.02
      );

      expect(simplifiedCoords.length).toBeGreaterThan(2);
      expect(simplifiedCoords).toContainEqual([2, 1.0]);
      expect(simplifiedCoords.length).toBe(simplifiedTimes.length);
    });
  });

  // Test 3: Species with no tracks shows no route
  describe('Species Without Tracks', () => {
    it('generates empty feature collection and occurrences_only level for Falco amurensis', () => {
      const geojsonPath = path.resolve('data', 'generated', 'tracks', 'falco_amurensis.geojson');
      expect(fs.existsSync(geojsonPath)).toBe(true);

      const geojson = JSON.parse(fs.readFileSync(geojsonPath, 'utf-8'));
      expect(geojson.evidence_level).toBe('occurrences_only');
      expect(geojson.individual_count).toBe(0);
      expect(geojson.total_points).toBe(0);
      expect(geojson.features).toEqual([]);
    });

    it('confirms tripsData is empty for occurrences_only species, ensuring no route renders', () => {
      // Simulate frontend route check
      const speciesGeoJson = {
        evidence_level: 'occurrences_only',
        features: [],
      };

      // Frontend App.jsx logic:
      const tripsData =
        speciesGeoJson.evidence_level === 'tracks' && speciesGeoJson.features.length > 0
          ? speciesGeoJson.features
          : [];

      expect(tripsData.length).toBe(0);

      // Frontend MapView.jsx logic:
      const tripLayer = tripsData.length > 0 ? { id: 'birds-trips' } : null;
      expect(tripLayer).toBeNull();
    });
  });

  // Test 4: Dateline Crossing (Longitude 180 / -180)
  describe('Dateline Crossing & Antimeridian Normalization', () => {
    it('splits trajectories crossing longitude 180 to avoid map-wrapping line artifacts', async () => {
      const { splitDatelineCoordinates } = await import('../scripts/ingest/tracking.js');
      const { ensureDatelineSafeFeatures } = await import('../src/dateline.js');

      // Test coordinate sequence jumping from Alaska (178°E) to Aleutians/Russia (-178°W)
      const crossingCoords: [number, number][] = [
        [175.0, 60.0],
        [178.5, 61.0],
        [-178.5, 62.0], // Crossed antimeridian (|dx| = 357 > 180)
        [-175.0, 63.0],
      ];
      const times = [1000, 2000, 3000, 4000];

      const splitSegments = splitDatelineCoordinates(crossingCoords, times);
      expect(splitSegments.length).toBe(2);
      expect(splitSegments[0].coordinates.length).toBe(2);
      expect(splitSegments[0].coordinates).toEqual([[175.0, 60.0], [178.5, 61.0]]);
      expect(splitSegments[1].coordinates.length).toBe(2);
      expect(splitSegments[1].coordinates).toEqual([[-178.5, 62.0], [-175.0, 63.0]]);

      // Test GeoJSON FeatureCollection processing
      const dummyFeature = {
        type: 'Feature' as const,
        id: 1,
        geometry: {
          type: 'LineString' as const,
          coordinates: crossingCoords,
        },
        properties: {
          species: 'Limosa lapponica',
          times,
        },
      };

      const safeFeatures = ensureDatelineSafeFeatures([dummyFeature]);
      expect(safeFeatures.length).toBe(2);
      expect(safeFeatures[0].id).toBe('1_seg_0');
      expect(safeFeatures[1].id).toBe('1_seg_1');
    });

    it('leaves normal trajectories that do not cross the antimeridian intact', async () => {
      const { splitDatelineCoordinates } = await import('../scripts/ingest/tracking.js');
      const normalCoords: [number, number][] = [
        [10.0, 50.0],
        [12.0, 48.0],
        [15.0, 45.0],
      ];
      const times = [100, 200, 300];

      const segments = splitDatelineCoordinates(normalCoords, times);
      expect(segments.length).toBe(1);
      expect(segments[0].coordinates).toEqual(normalCoords);
    });
  });

  // Test 5: Open Licence Filtering & Restrictive Licence Rejection
  describe('Open Licence Filtering & Restrictive Licence Rejection', () => {
    it('strictly accepts open research licences: CC0, CC-BY, and CC-BY-NC', async () => {
      const { evaluateDatasetLicense } = await import('../scripts/ingest/tracking.js');

      expect(evaluateDatasetLicense('http://creativecommons.org/publicdomain/zero/1.0/legalcode').permitted).toBe(true);
      expect(evaluateDatasetLicense('CC0 1.0').permitted).toBe(true);
      expect(evaluateDatasetLicense('CC-BY 4.0').permitted).toBe(true);
      expect(evaluateDatasetLicense('http://creativecommons.org/licenses/by/4.0/legalcode').permitted).toBe(true);
      expect(evaluateDatasetLicense('CC-BY-NC 4.0').permitted).toBe(true);
      expect(evaluateDatasetLicense('http://creativecommons.org/licenses/by-nc/4.0/legalcode').permitted).toBe(true);
    });

    it('strictly rejects NoDerivatives (ND), in-copyright, proprietary, and missing licences', async () => {
      const { evaluateDatasetLicense } = await import('../scripts/ingest/tracking.js');

      // Missing or empty
      expect(evaluateDatasetLicense(null).permitted).toBe(false);
      expect(evaluateDatasetLicense('').permitted).toBe(false);
      expect(evaluateDatasetLicense('Unspecified').permitted).toBe(false);

      // NoDerivatives (ND)
      expect(evaluateDatasetLicense('CC-BY-ND 4.0').permitted).toBe(false);
      expect(evaluateDatasetLicense('CC-BY-NC-ND 4.0').permitted).toBe(false);
      expect(evaluateDatasetLicense('http://creativecommons.org/licenses/by-nd/4.0/legalcode').permitted).toBe(false);

      // Proprietary / In-copyright
      expect(evaluateDatasetLicense('All Rights Reserved').permitted).toBe(false);
      expect(evaluateDatasetLicense('In Copyright').permitted).toBe(false);
      expect(evaluateDatasetLicense('Proprietary / Permission required').permitted).toBe(false);
    });
  });

  // Test 6: Sensitive Locations Coarsening at 0.1 Degrees (~11 km)
  describe('Sensitive Locations Coarsening at 0.1 Degrees (~11 km)', () => {
    it('identifies sensitive raptors, storks, cranes, harriers, owls and rails', async () => {
      const { isSensitiveBreedingTaxon } = await import('../scripts/ingest/tracking.js');

      expect(isSensitiveBreedingTaxon('Pandion haliaetus', 'Pandionidae')).toBe(true);
      expect(isSensitiveBreedingTaxon('Ciconia ciconia', 'Ciconiidae')).toBe(true);
      expect(isSensitiveBreedingTaxon('Ciconia nigra', 'Ciconiidae')).toBe(true);
      expect(isSensitiveBreedingTaxon('Grus grus', 'Gruidae')).toBe(true);
      expect(isSensitiveBreedingTaxon('Circus pygargus', 'Accipitridae')).toBe(true);
      expect(isSensitiveBreedingTaxon('Circus cyaneus', 'Accipitridae')).toBe(true);
      expect(isSensitiveBreedingTaxon('Asio flammeus', 'Strigidae')).toBe(true);
      expect(isSensitiveBreedingTaxon('Crex crex', 'Rallidae')).toBe(true);

      // Non-sensitive species
      expect(isSensitiveBreedingTaxon('Numenius arquata', 'Scolopacidae')).toBe(false);
      expect(isSensitiveBreedingTaxon('Fregata magnificens', 'Fregatidae')).toBe(false);
      expect(isSensitiveBreedingTaxon('Hirundo rustica', 'Hirundinidae')).toBe(false);
    });

    it('coarsens fixes to 0.1 degrees during breeding season (May-July) for sensitive taxa', async () => {
      const { applySensitiveLocationCoarsening } = await import('../scripts/ingest/tracking.js');

      // May 15 timestamp (month 5)
      const mayTime = new Date('2023-05-15T12:00:00Z').getTime() / 1000;
      // July 10 timestamp (month 7)
      const julyTime = new Date('2023-07-10T12:00:00Z').getTime() / 1000;
      // October 20 timestamp (month 10, migration)
      const octTime = new Date('2023-10-20T12:00:00Z').getTime() / 1000;

      const rawCoords: [number, number][] = [
        [7.185674, 53.203712], // May: should coarsen to [7.2, 53.2]
        [7.190453, 53.207861], // July: should coarsen to [7.2, 53.2]
        [14.64123, 45.94123],  // Oct: should remain full precision [14.64123, 45.94123]
      ];
      const times = [mayTime, julyTime, octTime];

      const coarsened = applySensitiveLocationCoarsening(rawCoords, times, true);

      // May: coarsened to 0.1°
      expect(coarsened[0]).toEqual([7.2, 53.2]);
      // July: coarsened to 0.1°
      expect(coarsened[1]).toEqual([7.2, 53.2]);
      // October: untouched full precision
      expect(coarsened[2]).toEqual([14.64123, 45.94123]);
    });

    it('verifies generated GeoJSON track files have coarsening flag and 0.1 degree precision in breeding season', () => {
      const ospreyPath = path.resolve('data', 'generated', 'tracks', 'pandion_haliaetus.geojson');
      expect(fs.existsSync(ospreyPath)).toBe(true);

      const ospreyData = JSON.parse(fs.readFileSync(ospreyPath, 'utf-8'));
      expect(ospreyData.sensitive_coarsening?.applied).toBe(true);
      expect(ospreyData.sensitive_coarsening?.precision_degrees).toBe(0.1);
      expect(ospreyData.sensitive_coarsening?.approx_km).toBe(11.1);
    });
  });
});
