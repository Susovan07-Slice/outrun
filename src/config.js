// Canonical 13-Species Registry & Color Palette
// Outrun — Migratory Birds Observatory (Class Aves Only)

export const canonicalSpeciesList = [
  {
    species_id: 'ciconia_ciconia',
    name: 'Ciconia ciconia',
    name_en: 'White Stork',
    family: 'Ciconiidae',
    color: [42, 111, 125], // Muted deep teal
    hex: '#2A6F7D',
    evidence_level: 'tracks',
    tracked_individuals: 100,
  },
  {
    species_id: 'pandion_haliaetus',
    name: 'Pandion haliaetus',
    name_en: 'Osprey',
    family: 'Pandionidae',
    color: [175, 124, 48], // Warm ochre / bronze
    hex: '#AF7C30',
    evidence_level: 'tracks',
    tracked_individuals: 842,
  },
  {
    species_id: 'grus_grus',
    name: 'Grus grus',
    name_en: 'Common Crane',
    family: 'Gruidae',
    color: [61, 112, 77], // Muted forest olive
    hex: '#3D704D',
    evidence_level: 'tracks',
    tracked_individuals: 812,
  },
  {
    species_id: 'falco_amurensis',
    name: 'Falco amurensis',
    name_en: 'Amur Falcon',
    family: 'Falconidae',
    color: [168, 77, 56], // Terracotta rust
    hex: '#A84D38',
    evidence_level: 'occurrences_only',
    tracked_individuals: 0,
  },
  {
    species_id: 'limosa_lapponica',
    name: 'Limosa lapponica',
    name_en: 'Bar-tailed Godwit',
    family: 'Scolopacidae',
    color: [115, 78, 128], // Muted royal plum
    hex: '#734E80',
    evidence_level: 'occurrences_only',
    tracked_individuals: 0,
  },
  {
    species_id: 'sterna_paradisaea',
    name: 'Sterna paradisaea',
    name_en: 'Arctic Tern',
    family: 'Laridae',
    color: [57, 86, 128], // Twilight slate
    hex: '#395680',
    evidence_level: 'occurrences_only',
    tracked_individuals: 0,
  },
  {
    species_id: 'leucogeranus_leucogeranus',
    name: 'Leucogeranus leucogeranus',
    name_en: 'Siberian Crane',
    family: 'Gruidae',
    color: [142, 68, 88], // Rosewood crimson
    hex: '#8E4458',
    evidence_level: 'occurrences_only',
    tracked_individuals: 0,
  },
  {
    species_id: 'hirundo_rustica',
    name: 'Hirundo rustica',
    name_en: 'Barn Swallow',
    family: 'Hirundinidae',
    color: [192, 108, 56], // Warm amber
    hex: '#C06C38',
    evidence_level: 'occurrences_only',
    tracked_individuals: 0,
  },
  {
    species_id: 'calidris_canutus',
    name: 'Calidris canutus',
    name_en: 'Red Knot',
    family: 'Scolopacidae',
    color: [74, 122, 104], // Coastal sage
    hex: '#4A7A68',
    evidence_level: 'occurrences_only',
    tracked_individuals: 0,
  },
  {
    species_id: 'anser_indicus',
    name: 'Anser indicus',
    name_en: 'Bar-headed Goose',
    family: 'Anatidae',
    color: [74, 85, 132], // Alpine indigo
    hex: '#4A5584',
    evidence_level: 'occurrences_only',
    tracked_individuals: 0,
  },
  {
    species_id: 'cuculus_canorus',
    name: 'Cuculus canorus',
    name_en: 'Common Cuckoo',
    family: 'Cuculidae',
    color: [184, 136, 42], // Golden ochre
    hex: '#B8882A',
    evidence_level: 'occurrences_only',
    tracked_individuals: 0,
  },
  {
    species_id: 'oenanthe_oenanthe',
    name: 'Oenanthe oenanthe',
    name_en: 'Northern Wheatear',
    family: 'Muscicapidae',
    color: [102, 112, 54], // Tundra moss
    hex: '#667036',
    evidence_level: 'occurrences_only',
    tracked_individuals: 0,
  },
  {
    species_id: 'numenius_phaeopus',
    name: 'Numenius phaeopus',
    name_en: 'Whimbrel',
    family: 'Scolopacidae',
    color: [150, 75, 45], // Earth rust
    hex: '#964B2D',
    evidence_level: 'occurrences_only',
    tracked_individuals: 0,
  },
  {
    species_id: 'numenius_arquata',
    name: 'Numenius arquata',
    name_en: 'Eurasian Curlew',
    family: 'Scolopacidae',
    color: [108, 142, 191], // Soft steel blue
    hex: '#6C8EBF',
    evidence_level: 'tracks',
    movement_type: 'migration',
    movement_label: 'Trans-European Migratory Corridor (Flanders to France, Spain & Portugal)',
    tracked_individuals: 5,
  },
  {
    species_id: 'circus_pygargus',
    name: 'Circus pygargus',
    name_en: "Montagu's Harrier",
    family: 'Accipitridae',
    color: [184, 92, 56], // Deep amber copper
    hex: '#B85C38',
    evidence_level: 'tracks',
    movement_type: 'migration',
    movement_label: 'Trans-Saharan Migratory Corridor (Western Europe to Sahel & Tropical Africa)',
    tracked_individuals: 10,
    sensitive_coarsened: true,
  },
  {
    species_id: 'fregata_magnificens',
    name: 'Fregata magnificens',
    name_en: 'Magnificent Frigatebird',
    family: 'Fregatidae',
    color: [64, 130, 109], // Oceanic emerald
    hex: '#40826D',
    evidence_level: 'tracks',
    movement_type: 'foraging',
    movement_label: 'Tracked Movements (Pelagic Caribbean & Atlantic Foraging Sorties)',
    tracked_individuals: 15,
  },
  {
    species_id: 'ciconia_nigra',
    name: 'Ciconia nigra',
    name_en: 'Black Stork',
    family: 'Ciconiidae',
    color: [45, 55, 72], // Slate bronze
    hex: '#2D3748',
    evidence_level: 'tracks',
    movement_type: 'migration',
    movement_label: 'Trans-Saharan Migratory Corridor (Eastern Europe to Central/Southern Africa)',
    tracked_individuals: 19,
    sensitive_coarsened: true,
  },
  {
    species_id: 'circus_cyaneus',
    name: 'Circus cyaneus',
    name_en: 'Hen Harrier',
    family: 'Accipitridae',
    color: [74, 107, 130], // Cool silver steel
    hex: '#4A6B82',
    evidence_level: 'tracks',
    movement_type: 'migration',
    movement_label: 'Pan-Eurasian Migratory Corridor (Boreal Taiga to Western Europe)',
    tracked_individuals: 9,
    sensitive_coarsened: true,
  },
  {
    species_id: 'circus_aeruginosus',
    name: 'Circus aeruginosus',
    name_en: 'Western Marsh Harrier',
    family: 'Accipitridae',
    color: [140, 80, 50], // Umber chestnut
    hex: '#8C5032',
    evidence_level: 'tracks',
    movement_type: 'migration',
    movement_label: 'Trans-Saharan Migratory Corridor (Europe to West Africa)',
    tracked_individuals: 12,
    sensitive_coarsened: true,
  },
  {
    species_id: 'asio_flammeus',
    name: 'Asio flammeus',
    name_en: 'Short-eared Owl',
    family: 'Strigidae',
    color: [200, 138, 50], // Tawny amber gold
    hex: '#C88A32',
    evidence_level: 'tracks',
    movement_type: 'migration',
    movement_label: 'Nomadic & Irruptive Migratory Corridor (North Sea to Mediterranean & North Africa)',
    tracked_individuals: 9,
    sensitive_coarsened: true,
  },
];

// Backwards-compatible export
export const speciesList = canonicalSpeciesList;

// Dictionary indexed by scientific name, species_id, and common name
export const speciesConfig = canonicalSpeciesList.reduce(
  (obj, current) => {
    obj[current.name] = current;
    obj[current.species_id] = current;
    obj[current.name_en] = current;
    return obj;
  },
  {}
);

export const ANIMATION_SPEED = 3600 * 5; // 1 step in seconds
export const INITIAL_SAME_YEAR = false;
export const AUTO_PLAY = true;

// Helper to generate world graticules for Deck.gl PathLayer
export function getGraticules() {
  const features = [];

  // Parallels (-80° to 80° step 20°)
  for (let lat = -80; lat <= 80; lat += 20) {
    const coords = [];
    for (let lon = -180; lon <= 180; lon += 5) {
      coords.push([lon, lat]);
    }
    features.push({ coordinates: coords, type: 'parallel' });
  }

  // Meridians (-180° to 180° step 30°)
  for (let lon = -180; lon <= 180; lon += 30) {
    const coords = [];
    for (let lat = -80; lat <= 80; lat += 5) {
      coords.push([lon, lat]);
    }
    features.push({ coordinates: coords, type: 'meridian' });
  }

  return features;
}
