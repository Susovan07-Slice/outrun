// Canonical Species Registry & Luminous Path Palette
// Outrun — Migratory Birds Observatory (Class Aves Only)

export const canonicalSpeciesList = [
  {
    species_id: 'ciconia_ciconia',
    name: 'Ciconia ciconia',
    name_en: 'White Stork',
    family: 'Ciconiidae',
    color: [0, 168, 232], // Electric Sky Blue (high contrast against red bottleneck rings)
    hex: '#00A8E8',
    evidence_level: 'tracks',
    tracked_individuals: 100,
  },
  {
    species_id: 'pandion_haliaetus',
    name: 'Pandion haliaetus',
    name_en: 'Osprey',
    family: 'Pandionidae',
    color: [16, 185, 129], // Bright Mint (high contrast against red bottleneck rings)
    hex: '#10B981',
    evidence_level: 'tracks',
    tracked_individuals: 842,
  },
  {
    species_id: 'grus_grus',
    name: 'Grus grus',
    name_en: 'Common Crane',
    family: 'Gruidae',
    color: [46, 154, 62], // Meadow green (path hue legible on light and satellite basemaps)
    hex: '#2E9A3E',
    evidence_level: 'tracks',
    tracked_individuals: 812,
  },
  {
    species_id: 'falco_amurensis',
    name: 'Falco amurensis',
    name_en: 'Amur Falcon',
    family: 'Falconidae',
    color: [157, 78, 221], // Electric Violet (high contrast against red bottleneck rings)
    hex: '#9D4EDD',
    evidence_level: 'tracks',
    tracked_individuals: 10,
    movement_type: 'migration',
    movement_label: 'Trans-Oceanic Corridor (Amur River -> India -> Indian Ocean -> Southern Africa)',
  },
  {
    species_id: 'limosa_lapponica',
    name: 'Limosa lapponica',
    name_en: 'Bar-tailed Godwit',
    family: 'Scolopacidae',
    color: [12, 156, 138], // Teal (path hue legible on light and satellite basemaps)
    hex: '#0C9C8A',
    evidence_level: 'tracks',
    tracked_individuals: 10,
    movement_type: 'migration',
    movement_label: 'Trans-Pacific Non-Stop Corridor (Alaska to New Zealand)',
  },
  {
    species_id: 'sterna_paradisaea',
    name: 'Sterna paradisaea',
    name_en: 'Arctic Tern',
    family: 'Laridae',
    color: [47, 111, 224], // Cobalt (path hue legible on light and satellite basemaps)
    hex: '#2F6FE0',
    evidence_level: 'tracks',
    tracked_individuals: 10,
    movement_type: 'migration',
    movement_label: 'Pole-to-Pole Trans-Global Corridor (Arctic to Antarctica)',
  },
  {
    species_id: 'leucogeranus_leucogeranus',
    name: 'Leucogeranus leucogeranus',
    name_en: 'Siberian Crane',
    family: 'Gruidae',
    color: [192, 47, 166], // Magenta (path hue legible on light and satellite basemaps)
    hex: '#C02FA6',
    evidence_level: 'tracks',
    tracked_individuals: 10,
    movement_type: 'migration',
    movement_label: 'East Asian Migratory Corridor (Siberian Tundra to Poyang Lake Sanctuary)',
  },
  {
    species_id: 'hirundo_rustica',
    name: 'Hirundo rustica',
    name_en: 'Barn Swallow',
    family: 'Hirundinidae',
    color: [6, 182, 212], // Turquoise Cyan (high contrast against red bottleneck rings)
    hex: '#06B6D4',
    evidence_level: 'tracks',
    tracked_individuals: 8,
    movement_type: 'migration',
    movement_label: 'Trans-Saharan European Flyway (UK & Western Europe to Sub-Saharan Africa)',
  },
  {
    species_id: 'calidris_canutus',
    name: 'Calidris canutus',
    name_en: 'Red Knot',
    family: 'Scolopacidae',
    color: [79, 70, 229], // Royal Indigo (high contrast against red bottleneck rings)
    hex: '#4F46E5',
    evidence_level: 'tracks',
    tracked_individuals: 8,
    movement_type: 'migration',
    movement_label: 'Atlantic Flyway Corridor (High Arctic Canada -> Delaware Bay -> Tierra del Fuego)',
  },
  {
    species_id: 'anser_indicus',
    name: 'Anser indicus',
    name_en: 'Bar-headed Goose',
    family: 'Anatidae',
    color: [110, 79, 216], // Violet (path hue legible on light and satellite basemaps)
    hex: '#6E4FD8',
    evidence_level: 'tracks',
    tracked_individuals: 10,
    movement_type: 'migration',
    movement_label: 'Trans-Himalayan Extreme-Altitude Flyway (Qinghai Lake / Tibet to Keoladeo & Chilika Lake)',
  },
  {
    species_id: 'cuculus_canorus',
    name: 'Cuculus canorus',
    name_en: 'Common Cuckoo',
    family: 'Cuculidae',
    color: [20, 148, 156], // Deep Teal (high contrast against red bottleneck rings)
    hex: '#14949C',
    evidence_level: 'tracks',
    tracked_individuals: 8,
    movement_type: 'migration',
    movement_label: 'Trans-Continental Migratory Corridor (Northern Europe across Mediterranean & Sahara to Central Africa)',
  },
  {
    species_id: 'oenanthe_oenanthe',
    name: 'Oenanthe oenanthe',
    name_en: 'Northern Wheatear',
    family: 'Muscicapidae',
    color: [92, 154, 14], // Olive green (path hue legible on light and satellite basemaps)
    hex: '#5C9A0E',
    evidence_level: 'tracks',
    tracked_individuals: 8,
    movement_type: 'migration',
    movement_label: 'Trans-Atlantic & Sahelian Corridor (Iceland & Greenland to Western Africa)',
  },
  {
    species_id: 'numenius_phaeopus',
    name: 'Numenius phaeopus',
    name_en: 'Whimbrel',
    family: 'Scolopacidae',
    color: [2, 132, 199], // Deep Azure (high contrast against red bottleneck rings)
    hex: '#0284C7',
    evidence_level: 'tracks',
    tracked_individuals: 8,
    movement_type: 'migration',
    movement_label: 'East Atlantic Coastal Flyway (Iceland to Banc d\'Arguin & Gulf of Guinea)',
  },
  {
    species_id: 'numenius_arquata',
    name: 'Numenius arquata',
    name_en: 'Eurasian Curlew',
    family: 'Scolopacidae',
    color: [10, 133, 194], // Cerulean (path hue legible on light and satellite basemaps)
    hex: '#0A85C2',
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
    color: [99, 102, 241], // Slate Indigo (high contrast against red bottleneck rings)
    hex: '#6366F1',
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
    color: [19, 138, 99], // Jade (path hue legible on light and satellite basemaps)
    hex: '#138A63',
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
    color: [74, 90, 120], // Slate (path hue legible on light and satellite basemaps)
    hex: '#4A5A78',
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
    color: [61, 125, 216], // Glacier blue (path hue legible on light and satellite basemaps)
    hex: '#3D7DD8',
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
    color: [52, 168, 124], // Sea Sage (high contrast against red bottleneck rings)
    hex: '#34A87C',
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
    color: [132, 204, 22], // Electric Lime (high contrast against red bottleneck rings)
    hex: '#84CC16',
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

// Path colour for a species record from the API, the static registry or this file.
const FALLBACK_COLOR = { rgb: [12, 156, 138], hex: '#0C9C8A' };
export function speciesColorOf(species) {
  if (!species) return FALLBACK_COLOR;
  const conf =
    speciesConfig[species.scientific_name] ||
    speciesConfig[species.species_id] ||
    speciesConfig[species.name];
  return conf ? { rgb: conf.color, hex: conf.hex } : FALLBACK_COLOR;
}

// Registry lookup for movement descriptions that the API record may not carry.
export function speciesMetaOf(species) {
  if (!species) return {};
  return speciesConfig[species.scientific_name] || speciesConfig[species.species_id] || {};
}
