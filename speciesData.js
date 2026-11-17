// Species definitions: ecology + flight + animation parameters.
// Units: metres, seconds, radians. Every species must differ meaningfully;
// the flight controller and the procedural animator both read these numbers.
//
// A species is playable as soon as it exists here. If client/species/modelConfigs.js
// has an entry with the same id, that GLB is loaded; otherwise a procedural
// stand-in bird is built from the numbers below (so every species can be flight-tested
// before its Sketchfab model has been downloaded and configured).

const BASE = {
  name: 'Bird', scientific: '',
  group: 'starter',            // unlock group
  diet: 'omnivore', habitat: ['grassland'], social: 'solitary', territorial: false,
  role: 'generalist',
  activity: 'diurnal',
  size: { length: 0.5, wingspan: 1.0, mass: 0.5 },
  flight: {
    style: 'flap',             // flap | soar | dash | hover | glide | dive
    cruiseSpeed: 12,           // m/s, speed at which a glide holds level energy
    stallSpeed: 6,
    maxSpeed: 20,              // level-flight limit
    diveSpeed: 34,             // terminal speed in a stoop
    glideRatio: 10,            // lift/drag
    flapThrust: 3.0,           // m/s^2 at full flapping
    turnRate: 1.6,             // rad/s at low speed
    maxBank: 0.9,              // rad
    bankGain: 1.0,
    pitchRate: 1.3,            // rad/s
    soaring: 0.3,              // 0..1, how much of a thermal updraft the bird can use
    hover: false,
    stamina: 100, staminaDrain: 7, staminaRegen: 4
  },
  ground: { walk: 1.6, run: 4.5, turnRate: 4.0, hop: false, swims: false, strideLength: 0.35 },
  anim: {
    flapFreq: [3.2, 5.0],      // Hz, from light to full flapping
    flapAmp: 0.75,             // rad of dihedral swing at full flapping
    glideDihedral: 0.12,       // wings slightly raised while gliding
    upFold: 0.35,              // wing partially folds on the upstroke
    twist: 0.25,
    sweepCruise: 0.05,
    sweepDive: 0.9,
    idleLook: 1.0              // how often the bird looks around when idle
  },
  camera: { distance: 4.5, height: 0.7 }
};

function define(overrides) {
  const out = structuredClone(BASE);
  for (const [k, v] of Object.entries(overrides)) {
    if (v && typeof v === 'object' && !Array.isArray(v) && out[k]) Object.assign(out[k], v);
    else out[k] = v;
  }
  return out;
}

export const SPECIES = {
  osprey: define({
    id: 'osprey', name: 'Osprey', scientific: 'Pandion haliaetus', group: 'raptors',
    diet: 'piscivore', habitat: ['wetland', 'coast', 'lakes'], social: 'pairs', territorial: true,
    role: 'fish-eating raptor; plunge-dives for fish',
    size: { length: 0.58, wingspan: 1.7, mass: 1.5 },
    flight: {
      style: 'soar', cruiseSpeed: 14, stallSpeed: 8.5, maxSpeed: 24, diveSpeed: 40, glideRatio: 12,
      flapThrust: 3.4, turnRate: 1.5, maxBank: 0.85, pitchRate: 1.1, soaring: 0.75,
      stamina: 110, staminaDrain: 6, staminaRegen: 5
    },
    ground: { walk: 1.1, run: 3.0, turnRate: 3.0, strideLength: 0.3 },
    anim: { flapFreq: [2.4, 3.4], flapAmp: 0.7, glideDihedral: 0.2, upFold: 0.3, twist: 0.2, sweepCruise: 0.08, sweepDive: 0.95, idleLook: 1.0 },
    camera: { distance: 5.5, height: 0.9 }
  }),
  peregrine_falcon: define({
    id: 'peregrine_falcon', name: 'Peregrine Falcon', scientific: 'Falco peregrinus', group: 'raptors',
    diet: 'avivore', habitat: ['coast', 'mountain', 'urban'], social: 'pairs', territorial: true,
    role: 'aerial predator of other birds; fastest animal in a stoop',
    size: { length: 0.42, wingspan: 1.0, mass: 0.9 },
    flight: {
      style: 'dive', cruiseSpeed: 17, stallSpeed: 10, maxSpeed: 32, diveSpeed: 70, glideRatio: 9,
      flapThrust: 5.2, turnRate: 2.4, maxBank: 1.15, pitchRate: 1.9, soaring: 0.4,
      stamina: 90, staminaDrain: 8, staminaRegen: 4
    },
    anim: { flapFreq: [3.6, 5.2], flapAmp: 0.6, glideDihedral: 0.05, upFold: 0.45, twist: 0.2, sweepCruise: 0.2, sweepDive: 1.15 },
    camera: { distance: 4.2, height: 0.7 }
  }),
  bald_eagle: define({
    id: 'bald_eagle', name: 'Bald Eagle', scientific: 'Haliaeetus leucocephalus', group: 'raptors',
    diet: 'piscivore', habitat: ['coast', 'wetland', 'mountain'], social: 'pairs', territorial: true,
    role: 'large generalist raptor, fish and carrion',
    size: { length: 0.85, wingspan: 2.1, mass: 4.5 },
    flight: {
      style: 'soar', cruiseSpeed: 15, stallSpeed: 9.5, maxSpeed: 26, diveSpeed: 44, glideRatio: 15,
      flapThrust: 3.0, turnRate: 1.2, maxBank: 0.8, pitchRate: 0.9, soaring: 1.0,
      stamina: 130, staminaDrain: 6, staminaRegen: 5
    },
    ground: { walk: 1.2, run: 3.2, turnRate: 2.6, strideLength: 0.4 },
    anim: { flapFreq: [1.7, 2.6], flapAmp: 0.65, glideDihedral: 0.12, upFold: 0.25, twist: 0.2, sweepCruise: 0.0, sweepDive: 0.8 },
    camera: { distance: 7.0, height: 1.1 }
  }),
  wandering_albatross: define({
    id: 'wandering_albatross', name: 'Wandering Albatross', scientific: 'Diomedea exulans', group: 'seabirds',
    diet: 'piscivore', habitat: ['coast', 'ocean'], social: 'colonial', territorial: false,
    role: 'ocean wanderer; dynamic soaring over the sea',
    size: { length: 1.1, wingspan: 3.1, mass: 9 },
    flight: {
      style: 'glide', cruiseSpeed: 17, stallSpeed: 11, maxSpeed: 28, diveSpeed: 40, glideRatio: 22,
      flapThrust: 2.2, turnRate: 0.9, maxBank: 0.7, pitchRate: 0.7, soaring: 1.0,
      stamina: 160, staminaDrain: 5, staminaRegen: 6
    },
    ground: { walk: 0.9, run: 2.4, turnRate: 2.0, swims: true, strideLength: 0.5 },
    anim: { flapFreq: [1.0, 1.7], flapAmp: 0.45, glideDihedral: 0.02, upFold: 0.1, twist: 0.1, sweepCruise: 0.0, sweepDive: 0.5 },
    camera: { distance: 9.0, height: 1.4 }
  }),
  ruby_throated_hummingbird: define({
    id: 'ruby_throated_hummingbird', name: 'Ruby-throated Hummingbird', scientific: 'Archilochus colubris', group: 'nectar-feeders',
    diet: 'nectarivore', habitat: ['rainforest', 'garden'], social: 'solitary', territorial: true,
    role: 'pollinator',
    size: { length: 0.09, wingspan: 0.12, mass: 0.0035 },
    flight: {
      style: 'hover', cruiseSpeed: 7, stallSpeed: 0.5, maxSpeed: 14, diveSpeed: 20, glideRatio: 4,
      flapThrust: 7.0, turnRate: 4.0, maxBank: 0.6, pitchRate: 3.0, soaring: 0,
      hover: true, stamina: 70, staminaDrain: 9, staminaRegen: 6
    },
    ground: { walk: 0.3, run: 0.6, turnRate: 6.0, hop: true, strideLength: 0.05 },
    anim: { flapFreq: [10, 14], flapAmp: 0.55, glideDihedral: 0.0, upFold: 0.0, twist: 0.5, sweepCruise: 0.0, sweepDive: 0.2 },
    camera: { distance: 0.8, height: 0.12 }
  }),
  collared_kingfisher: define({
    id: 'collared_kingfisher', name: 'Collared Kingfisher', scientific: 'Todiramphus chloris', group: 'philippine',
    diet: 'piscivore', habitat: ['coast', 'wetland'], social: 'pairs', territorial: true,
    role: 'perch-and-plunge hunter; burrow nester',
    size: { length: 0.24, wingspan: 0.4, mass: 0.07 },
    flight: {
      style: 'dash', cruiseSpeed: 11, stallSpeed: 6, maxSpeed: 19, diveSpeed: 28, glideRatio: 7,
      flapThrust: 4.5, turnRate: 2.2, maxBank: 1.0, pitchRate: 1.8, soaring: 0.05,
      stamina: 80, staminaDrain: 7, staminaRegen: 5
    },
    ground: { walk: 0.8, run: 2.0, hop: true, strideLength: 0.12 },
    anim: { flapFreq: [6, 9], flapAmp: 0.7, glideDihedral: 0.05, upFold: 0.3, twist: 0.2, sweepCruise: 0.1, sweepDive: 0.8 },
    camera: { distance: 2.4, height: 0.35 }
  }),
  rock_pigeon: define({
    id: 'rock_pigeon', name: 'Rock Pigeon', scientific: 'Columba livia', group: 'starter',
    diet: 'granivore', habitat: ['urban', 'grassland', 'coast'], social: 'flocking', territorial: false,
    role: 'urban flocking generalist',
    size: { length: 0.32, wingspan: 0.65, mass: 0.3 },
    flight: {
      style: 'flap', cruiseSpeed: 15, stallSpeed: 7.5, maxSpeed: 25, diveSpeed: 33, glideRatio: 8,
      flapThrust: 4.0, turnRate: 1.9, maxBank: 0.95, pitchRate: 1.5, soaring: 0.1,
      stamina: 120, staminaDrain: 5, staminaRegen: 5
    },
    ground: { walk: 1.0, run: 3.0, strideLength: 0.2 },
    anim: { flapFreq: [4.5, 7.0], flapAmp: 0.85, glideDihedral: 0.3, upFold: 0.4, twist: 0.25, sweepCruise: 0.0, sweepDive: 0.6 },
    camera: { distance: 3.2, height: 0.5 }
  })
};


// ---------------------------------------------------------------------------
// Roster. bird() derives camera distance from body length; every entry
// overrides the numbers that make that species fly and move differently.
// (King Penguin is omitted until swimming exists: it cannot fly.)
// ---------------------------------------------------------------------------

export const GROUPS = {
  starter:         { label: 'Starter birds', unlocked: true },
  raptors:         { label: 'Raptors', unlocked: true },
  philippine:      { label: 'Philippine birds', unlocked: true },
  owls:            { label: 'Owls', unlocked: true },
  corvids:         { label: 'Crows and magpies', unlocked: true },
  waterbirds:      { label: 'Waterbirds', unlocked: true },
  seabirds:        { label: 'Seabirds', unlocked: true },
  parrots:         { label: 'Parrots', unlocked: true },
  'nectar-feeders': { label: 'Nectar feeders', unlocked: true },
  runners:         { label: 'Ground specialists', unlocked: true },
  songbirds:       { label: 'Songbirds', unlocked: true }
};

function bird(id, name, scientific, group, [length, wingspan, mass], o = {}) {
  const camera = o.camera || { distance: Math.max(1.4, length * 9), height: Math.max(0.2, length * 1.4) };
  return define({ id, name, scientific, group, size: { length, wingspan, mass }, ...o, camera });
}
const add = (sp) => { SPECIES[sp.id] = sp; };

// Philippine birds
add(bird('philippine_eagle', 'Philippine Eagle', 'Pithecophaga jefferyi', 'philippine', [1.0, 2.0, 6], {
  diet: 'carnivore', habitat: ['rainforest', 'mountain'], social: 'pairs', territorial: true, role: 'apex forest raptor; takes monkeys and flying lemurs',
  flight: { style: 'soar', cruiseSpeed: 15, stallSpeed: 9.5, maxSpeed: 25, diveSpeed: 42, glideRatio: 11, flapThrust: 3.2, turnRate: 1.3, maxBank: 0.9, pitchRate: 1.0, soaring: 0.8, stamina: 120 },
  ground: { walk: 1.2, run: 3.0, strideLength: 0.4 }, anim: { flapFreq: [1.8, 2.6], flapAmp: 0.65, sweepCruise: 0.05 }
}));
add(bird('brahminy_kite', 'Brahminy Kite', 'Haliastur indus', 'philippine', [0.48, 1.2, 0.5], {
  diet: 'piscivore', habitat: ['coast', 'wetland'], social: 'pairs', territorial: true, role: 'coastal scavenger and fish-taker',
  flight: { style: 'soar', cruiseSpeed: 12, stallSpeed: 7, maxSpeed: 20, diveSpeed: 30, glideRatio: 13, flapThrust: 2.8, turnRate: 1.7, soaring: 0.9 },
  anim: { flapFreq: [2.6, 3.6], flapAmp: 0.7 }
}));
add(bird('philippine_hanging_parrot', 'Philippine Hanging Parrot', 'Loriculus philippensis', 'philippine', [0.14, 0.22, 0.03], {
  diet: 'frugivore', habitat: ['rainforest'], social: 'flocking', role: 'fruit and nectar feeder; roosts upside down',
  flight: { style: 'dash', cruiseSpeed: 12, stallSpeed: 6, maxSpeed: 18, diveSpeed: 24, glideRatio: 6, flapThrust: 4.5, turnRate: 2.4, soaring: 0.05 },
  ground: { walk: 0.5, run: 1.2, hop: true, strideLength: 0.08 }, anim: { flapFreq: [7, 10], flapAmp: 0.8, upFold: 0.3 }
}));
add(bird('philippine_pygmy_woodpecker', 'Philippine Pygmy Woodpecker', 'Yungipicus maculatus', 'philippine', [0.11, 0.18, 0.02], {
  diet: 'insectivore', habitat: ['rainforest'], role: 'cavity nester; gleans bark insects',
  flight: { style: 'dash', cruiseSpeed: 9, stallSpeed: 5, maxSpeed: 15, diveSpeed: 20, glideRatio: 5, flapThrust: 4, turnRate: 2.3, soaring: 0 },
  ground: { walk: 0.4, run: 1, hop: true, strideLength: 0.06 }, anim: { flapFreq: [8, 11], flapAmp: 0.75, upFold: 0.6 }
}));
add(bird('brown_shrike', 'Brown Shrike', 'Lanius cristatus', 'philippine', [0.19, 0.28, 0.03], {
  diet: 'insectivore', habitat: ['grassland'], territorial: true, role: 'perch hunter; impales prey on thorns',
  flight: { style: 'dash', cruiseSpeed: 10, stallSpeed: 5.5, maxSpeed: 16, diveSpeed: 24, glideRatio: 7, flapThrust: 3.8, turnRate: 2.3 },
  ground: { hop: true, walk: 0.7, run: 1.8, strideLength: 0.1 }, anim: { flapFreq: [6, 9] }
}));
add(bird('long_tailed_shrike', 'Long-tailed Shrike', 'Lanius schach', 'philippine', [0.25, 0.3, 0.05], {
  diet: 'insectivore', habitat: ['grassland'], territorial: true, role: 'bold open-country perch hunter',
  flight: { style: 'dash', cruiseSpeed: 11, stallSpeed: 6, maxSpeed: 17, diveSpeed: 25, glideRatio: 7, flapThrust: 3.8, turnRate: 2.2 },
  ground: { hop: true, walk: 0.8, run: 2, strideLength: 0.12 }, anim: { flapFreq: [5.5, 8.5] }
}));
add(bird('brown_breasted_kingfisher', 'Brown-breasted Kingfisher', 'Halcyon gularis', 'philippine', [0.28, 0.45, 0.08], {
  diet: 'piscivore', habitat: ['wetland', 'coast'], territorial: true, role: 'perch-and-plunge hunter',
  flight: { style: 'dash', cruiseSpeed: 12, stallSpeed: 6.5, maxSpeed: 20, diveSpeed: 30, glideRatio: 7, flapThrust: 4.6, turnRate: 2.0 },
  ground: { hop: true, walk: 0.8, run: 2, strideLength: 0.13 }, anim: { flapFreq: [6, 9] }
}));
add(bird('white_browed_shama', 'White-browed Shama', 'Copsychus luzoniensis', 'philippine', [0.2, 0.26, 0.03], {
  diet: 'insectivore', habitat: ['rainforest'], territorial: true, role: 'forest-floor songster',
  flight: { style: 'flap', cruiseSpeed: 9, stallSpeed: 5, maxSpeed: 15, diveSpeed: 22, glideRatio: 6, flapThrust: 3.6, turnRate: 2.5 },
  ground: { hop: true, walk: 0.8, run: 2, strideLength: 0.1 }, anim: { flapFreq: [6, 9] }
}));
add(bird('pied_bushchat', 'Pied Bushchat', 'Saxicola caprata', 'philippine', [0.13, 0.2, 0.017], {
  diet: 'insectivore', habitat: ['grassland'], territorial: true, role: 'low perch hunter of open ground',
  flight: { style: 'dash', cruiseSpeed: 9, stallSpeed: 5, maxSpeed: 14, diveSpeed: 20, glideRatio: 6, flapThrust: 3.8, turnRate: 2.6 },
  ground: { hop: true, walk: 0.6, run: 1.5, strideLength: 0.07 }, anim: { flapFreq: [7, 10] }
}));
add(bird('olive_backed_sunbird', 'Olive-backed Sunbird', 'Cinnyris jugularis', 'philippine', [0.11, 0.16, 0.009], {
  diet: 'nectarivore', habitat: ['garden', 'coast', 'rainforest'], territorial: true, role: 'pollinator; briefly hovers at flowers',
  flight: { style: 'dash', cruiseSpeed: 8, stallSpeed: 3, maxSpeed: 14, diveSpeed: 18, glideRatio: 5, flapThrust: 5, turnRate: 3.2, hover: true },
  ground: { hop: true, walk: 0.4, run: 1, strideLength: 0.05 }, anim: { flapFreq: [10, 15], flapAmp: 0.6, upFold: 0 }
}));
add(bird('yellow_vented_bulbul', 'Yellow-vented Bulbul', 'Pycnonotus goiavier', 'philippine', [0.2, 0.28, 0.03], {
  diet: 'frugivore', habitat: ['grassland', 'garden', 'urban'], social: 'flocking', role: 'seed disperser of scrub and gardens',
  flight: { style: 'flap', cruiseSpeed: 10, stallSpeed: 5.5, maxSpeed: 16, diveSpeed: 22, glideRatio: 6, flapThrust: 3.6, turnRate: 2.2 },
  ground: { hop: true, walk: 0.7, run: 1.8, strideLength: 0.1 }, anim: { flapFreq: [6, 9] }
}));
add(bird('philippine_bulbul', 'Philippine Bulbul', 'Hypsipetes philippinus', 'philippine', [0.23, 0.32, 0.04], {
  diet: 'frugivore', habitat: ['rainforest'], social: 'flocking', role: 'forest fruit eater',
  flight: { style: 'flap', cruiseSpeed: 10, stallSpeed: 5.5, maxSpeed: 16, diveSpeed: 22, glideRatio: 6, flapThrust: 3.6, turnRate: 2.2 },
  ground: { hop: true, walk: 0.7, run: 1.8, strideLength: 0.11 }, anim: { flapFreq: [6, 9] }
}));
add(bird('jungle_crow', 'Jungle Crow', 'Corvus macrorhynchos', 'philippine', [0.48, 1.0, 0.6], {
  diet: 'omnivore', habitat: ['coast', 'urban', 'rainforest'], social: 'flocking', role: 'intelligent scavenger and nest predator',
  flight: { style: 'flap', cruiseSpeed: 13, stallSpeed: 7, maxSpeed: 22, diveSpeed: 30, glideRatio: 9, flapThrust: 3.4, turnRate: 1.9, soaring: 0.4 },
  ground: { walk: 1.3, run: 3.2, strideLength: 0.2 }, anim: { flapFreq: [3, 4.4], flapAmp: 0.7 }
}));
add(bird('philippine_scops_owl', 'Philippine Scops Owl', 'Otus megalotis', 'philippine', [0.22, 0.5, 0.1], {
  diet: 'insectivore', habitat: ['rainforest'], activity: 'nocturnal', territorial: true, role: 'small night hunter of insects',
  flight: { style: 'flap', cruiseSpeed: 9, stallSpeed: 5, maxSpeed: 15, diveSpeed: 22, glideRatio: 8, flapThrust: 3.2, turnRate: 2.0 },
  ground: { hop: true, walk: 0.6, run: 1.5, strideLength: 0.1 }, anim: { flapFreq: [3.6, 5], flapAmp: 0.8 }
}));
add(bird('blue_throated_bee_eater', 'Blue-throated Bee-eater', 'Merops viridis', 'philippine', [0.27, 0.35, 0.03], {
  diet: 'insectivore', habitat: ['grassland', 'coast'], social: 'colonial', role: 'aerial insect hunter; burrow nester',
  flight: { style: 'glide', cruiseSpeed: 12, stallSpeed: 6, maxSpeed: 19, diveSpeed: 26, glideRatio: 11, flapThrust: 3.4, turnRate: 2.5, soaring: 0.3 },
  ground: { hop: true, walk: 0.5, run: 1.2, strideLength: 0.08 }, anim: { flapFreq: [5, 8], glideDihedral: 0.05, sweepCruise: 0.15 }
}));

// Raptors
add(bird('golden_eagle', 'Golden Eagle', 'Aquila chrysaetos', 'raptors', [0.85, 2.1, 4.5], {
  diet: 'carnivore', habitat: ['mountain', 'grassland'], territorial: true, role: 'mountain apex raptor',
  flight: { style: 'soar', cruiseSpeed: 16, stallSpeed: 10, maxSpeed: 27, diveSpeed: 50, glideRatio: 16, flapThrust: 3.0, turnRate: 1.2, soaring: 1.0, stamina: 130 },
  ground: { walk: 1.2, run: 3.2 }, anim: { flapFreq: [1.7, 2.5], flapAmp: 0.65, sweepCruise: 0 }
}));
add(bird('red_tailed_hawk', 'Red-tailed Hawk', 'Buteo jamaicensis', 'raptors', [0.55, 1.3, 1.1], {
  diet: 'carnivore', habitat: ['grassland', 'mountain'], territorial: true, role: 'open-country soaring hunter of small mammals',
  flight: { style: 'soar', cruiseSpeed: 13, stallSpeed: 8, maxSpeed: 22, diveSpeed: 35, glideRatio: 12, flapThrust: 3.2, turnRate: 1.5, soaring: 0.95 },
  anim: { flapFreq: [2.4, 3.4], flapAmp: 0.7 }
}));
add(bird('eurasian_sparrowhawk', 'Eurasian Sparrowhawk', 'Accipiter nisus', 'raptors', [0.33, 0.65, 0.25], {
  diet: 'avivore', habitat: ['rainforest', 'garden'], territorial: true, role: 'ambush hunter of small birds in cover',
  flight: { style: 'dash', cruiseSpeed: 15, stallSpeed: 8, maxSpeed: 26, diveSpeed: 36, glideRatio: 7, flapThrust: 5.2, turnRate: 3.0, maxBank: 1.3, pitchRate: 2.2, soaring: 0.3 },
  anim: { flapFreq: [4.5, 6.5], flapAmp: 0.8, sweepCruise: 0.2 }
}));

// Owls
add(bird('barn_owl', 'Barn Owl', 'Tyto alba', 'owls', [0.36, 0.9, 0.33], {
  diet: 'carnivore', habitat: ['grassland', 'urban'], activity: 'nocturnal', role: 'silent hunter of small rodents',
  flight: { style: 'glide', cruiseSpeed: 9, stallSpeed: 4.5, maxSpeed: 15, diveSpeed: 22, glideRatio: 9, flapThrust: 2.6, turnRate: 2.0, soaring: 0.3 },
  anim: { flapFreq: [3, 4.2], flapAmp: 0.65, upFold: 0.1 }
}));
add(bird('great_horned_owl', 'Great Horned Owl', 'Bubo virginianus', 'owls', [0.55, 1.4, 1.4], {
  diet: 'carnivore', habitat: ['rainforest', 'mountain'], activity: 'nocturnal', territorial: true, role: 'powerful generalist night predator',
  flight: { style: 'flap', cruiseSpeed: 11, stallSpeed: 6, maxSpeed: 18, diveSpeed: 26, glideRatio: 9, flapThrust: 3.0, turnRate: 1.6, soaring: 0.3 },
  ground: { walk: 1.0, run: 2.5 }, anim: { flapFreq: [2.8, 4], flapAmp: 0.7, upFold: 0.1 }
}));

// Corvids and small perching birds
add(bird('common_raven', 'Common Raven', 'Corvus corax', 'corvids', [0.63, 1.2, 1.2], {
  diet: 'omnivore', habitat: ['mountain', 'coast', 'urban'], social: 'pairs', role: 'intelligent generalist; rolls and plays in wind',
  flight: { style: 'soar', cruiseSpeed: 14, stallSpeed: 7.5, maxSpeed: 23, diveSpeed: 32, glideRatio: 10, flapThrust: 3.4, turnRate: 2.1, soaring: 0.6 },
  ground: { walk: 1.4, run: 3.4 }, anim: { flapFreq: [2.8, 4], flapAmp: 0.7 }
}));
add(bird('eurasian_magpie', 'Eurasian Magpie', 'Pica pica', 'corvids', [0.46, 0.57, 0.22], {
  diet: 'omnivore', habitat: ['grassland', 'urban'], territorial: true, role: 'curious egg thief and collector',
  flight: { style: 'flap', cruiseSpeed: 11, stallSpeed: 6, maxSpeed: 18, diveSpeed: 25, glideRatio: 6, flapThrust: 3.6, turnRate: 2.2 },
  ground: { hop: true, walk: 1.0, run: 2.6 }, anim: { flapFreq: [4.5, 6.5], flapAmp: 0.8 }
}));
add(bird('european_starling', 'European Starling', 'Sturnus vulgaris', 'starter', [0.21, 0.37, 0.08], {
  diet: 'omnivore', habitat: ['grassland', 'urban'], social: 'flocking', role: 'murmuration flocker',
  flight: { style: 'flap', cruiseSpeed: 16, stallSpeed: 8, maxSpeed: 22, diveSpeed: 30, glideRatio: 8, flapThrust: 4.2, turnRate: 2.8, maxBank: 1.2 },
  ground: { walk: 0.9, run: 2.4, strideLength: 0.1 }, anim: { flapFreq: [6, 9], flapAmp: 0.8 }
}));
add(bird('house_sparrow', 'House Sparrow', 'Passer domesticus', 'starter', [0.15, 0.24, 0.03], {
  diet: 'granivore', habitat: ['urban', 'grassland'], social: 'flocking', role: 'urban seed eater',
  flight: { style: 'flap', cruiseSpeed: 10, stallSpeed: 5.5, maxSpeed: 16, diveSpeed: 22, glideRatio: 6, flapThrust: 4, turnRate: 2.6 },
  ground: { hop: true, walk: 0.7, run: 1.8, strideLength: 0.08 }, anim: { flapFreq: [7, 10], flapAmp: 0.85 }
}));

// Waterbirds and seabirds
add(bird('mallard', 'Mallard', 'Anas platyrhynchos', 'waterbirds', [0.58, 0.9, 1.1], {
  diet: 'omnivore', habitat: ['wetland'], social: 'flocking', role: 'dabbling duck',
  flight: { style: 'flap', cruiseSpeed: 18, stallSpeed: 10, maxSpeed: 25, diveSpeed: 30, glideRatio: 6, flapThrust: 4.2, turnRate: 1.5, soaring: 0 },
  ground: { walk: 1.2, run: 2.6, swims: true, strideLength: 0.2 }, anim: { flapFreq: [5.5, 8], flapAmp: 0.7, upFold: 0.15 }
}));
add(bird('great_egret', 'Great Egret', 'Ardea alba', 'waterbirds', [0.95, 1.4, 1.0], {
  diet: 'piscivore', habitat: ['wetland', 'coast'], role: 'patient wader; stalks fish in shallows',
  flight: { style: 'glide', cruiseSpeed: 11, stallSpeed: 6, maxSpeed: 17, diveSpeed: 24, glideRatio: 10, flapThrust: 2.8, turnRate: 1.5, soaring: 0.5 },
  ground: { walk: 1.0, run: 2.4, swims: false, strideLength: 0.35 }, anim: { flapFreq: [2.2, 3.2], flapAmp: 0.6, glideDihedral: 0.05 }
}));
add(bird('grey_heron', 'Grey Heron', 'Ardea cinerea', 'waterbirds', [0.95, 1.7, 1.5], {
  diet: 'piscivore', habitat: ['wetland', 'coast'], territorial: true, role: 'still-hunting wader',
  flight: { style: 'glide', cruiseSpeed: 11, stallSpeed: 6, maxSpeed: 17, diveSpeed: 24, glideRatio: 10, flapThrust: 2.8, turnRate: 1.4, soaring: 0.5 },
  ground: { walk: 1.0, run: 2.2, strideLength: 0.35 }, anim: { flapFreq: [2, 3], flapAmp: 0.55 }
}));
add(bird('shoebill', 'Shoebill', 'Balaeniceps rex', 'waterbirds', [1.2, 2.5, 5.5], {
  diet: 'piscivore', habitat: ['wetland'], territorial: true, role: 'giant marsh ambusher of lungfish',
  flight: { style: 'glide', cruiseSpeed: 12, stallSpeed: 7.5, maxSpeed: 18, diveSpeed: 24, glideRatio: 9, flapThrust: 2.4, turnRate: 1.0, soaring: 0.6, stamina: 90 },
  ground: { walk: 0.8, run: 1.8, strideLength: 0.4 }, anim: { flapFreq: [1.6, 2.2], flapAmp: 0.55 }
}));
add(bird('atlantic_puffin', 'Atlantic Puffin', 'Fratercula arctica', 'seabirds', [0.3, 0.55, 0.45], {
  diet: 'piscivore', habitat: ['coast'], social: 'colonial', role: 'burrow-nesting diver; rapid wingbeats',
  flight: { style: 'dash', cruiseSpeed: 17, stallSpeed: 11, maxSpeed: 24, diveSpeed: 28, glideRatio: 5, flapThrust: 5.0, turnRate: 1.6, soaring: 0 },
  ground: { walk: 0.8, run: 2.0, swims: true, strideLength: 0.1 }, anim: { flapFreq: [9, 12], flapAmp: 0.6, upFold: 0.1 }
}));

// Parrots, swifts, runners
add(bird('scarlet_macaw', 'Scarlet Macaw', 'Ara macao', 'parrots', [0.85, 1.0, 1.0], {
  diet: 'frugivore', habitat: ['rainforest'], social: 'pairs', role: 'canopy fruit and seed eater; strong flier',
  flight: { style: 'flap', cruiseSpeed: 14, stallSpeed: 7.5, maxSpeed: 22, diveSpeed: 28, glideRatio: 6, flapThrust: 3.8, turnRate: 1.7 },
  ground: { walk: 0.8, run: 1.8, hop: true, strideLength: 0.15 }, anim: { flapFreq: [3.4, 5], flapAmp: 0.75 }
}));
add(bird('kea', 'Kea', 'Nestor notabilis', 'parrots', [0.48, 0.9, 0.9], {
  diet: 'omnivore', habitat: ['mountain'], social: 'flocking', role: 'playful alpine parrot, rides updrafts',
  flight: { style: 'soar', cruiseSpeed: 13, stallSpeed: 7, maxSpeed: 21, diveSpeed: 30, glideRatio: 8, flapThrust: 3.6, turnRate: 2.0, soaring: 0.7 },
  ground: { walk: 1.2, run: 3.0, hop: true, strideLength: 0.15 }, anim: { flapFreq: [3.4, 5] }
}));
add(bird('common_swift', 'Common Swift', 'Apus apus', 'starter', [0.17, 0.42, 0.04], {
  diet: 'insectivore', habitat: ['urban', 'coast'], social: 'flocking', role: 'lives on the wing; feeds, sleeps and mates in flight',
  flight: { style: 'glide', cruiseSpeed: 18, stallSpeed: 9, maxSpeed: 32, diveSpeed: 38, glideRatio: 12, flapThrust: 4.5, turnRate: 2.4, maxBank: 1.2, stamina: 200, staminaDrain: 3 },
  ground: { walk: 0.1, run: 0.2, strideLength: 0.03 }, anim: { flapFreq: [8, 11], flapAmp: 0.55, upFold: 0.1, sweepCruise: 0.5, sweepDive: 0.9 }
}));
add(bird('greater_roadrunner', 'Greater Roadrunner', 'Geococcyx californianus', 'runners', [0.55, 0.5, 0.3], {
  diet: 'carnivore', habitat: ['grassland'], role: 'sprinter; prefers running to flying',
  flight: { style: 'flap', cruiseSpeed: 11, stallSpeed: 6, maxSpeed: 15, diveSpeed: 20, glideRatio: 5, flapThrust: 3.4, turnRate: 1.8, stamina: 50, staminaDrain: 10 },
  ground: { walk: 3.0, run: 8.0, turnRate: 6, strideLength: 0.5 }, anim: { flapFreq: [5.5, 8], flapAmp: 0.8 }
}));
add(bird('secretarybird', 'Secretarybird', 'Sagittarius serpentarius', 'runners', [1.2, 2.1, 4.0], {
  diet: 'carnivore', habitat: ['grassland'], territorial: true, role: 'long-legged ground hunter that stomps snakes',
  flight: { style: 'glide', cruiseSpeed: 14, stallSpeed: 9, maxSpeed: 22, diveSpeed: 30, glideRatio: 10, flapThrust: 2.6, turnRate: 1.0, soaring: 0.6, stamina: 70, staminaDrain: 8 },
  ground: { walk: 1.8, run: 5.0, turnRate: 3.0, strideLength: 0.7 }, anim: { flapFreq: [2, 2.8], flapAmp: 0.6 }
}));

// Birds with 3D models in this build
add(bird('european_robin', 'European Robin', 'Erithacus rubecula', 'songbirds', [0.14, 0.21, 0.018], {
  diet: 'insectivore', habitat: ['rainforest', 'grassland', 'garden'], territorial: true, role: 'fiercely territorial insect eater; sings year-round',
  flight: { style: 'dash', cruiseSpeed: 9, stallSpeed: 4.5, maxSpeed: 14, diveSpeed: 20, glideRatio: 6, flapThrust: 3.8, turnRate: 2.8, maxBank: 1.1, pitchRate: 2.0, soaring: 0, stamina: 70 },
  ground: { walk: 0.6, run: 1.8, hop: true, turnRate: 6, strideLength: 0.08 },
  anim: { flapFreq: [8, 12], flapAmp: 0.8, upFold: 0.4, glideDihedral: 0.05 }
}));
add(bird('song_sparrow', 'Song Sparrow', 'Melospiza melodia', 'songbirds', [0.15, 0.21, 0.02], {
  diet: 'omnivore', habitat: ['wetland', 'grassland'], territorial: true, role: 'ground-foraging seed and insect eater of marsh edges and scrub',
  flight: { style: 'flap', cruiseSpeed: 9.5, stallSpeed: 5, maxSpeed: 15, diveSpeed: 20, glideRatio: 6, flapThrust: 3.8, turnRate: 2.6, soaring: 0, stamina: 75 },
  ground: { walk: 0.7, run: 1.9, hop: true, turnRate: 6, strideLength: 0.08 },
  anim: { flapFreq: [8, 11], flapAmp: 0.85, upFold: 0.4, glideDihedral: 0.05 }
}));
add(bird('red_winged_blackbird', 'Red-winged Blackbird', 'Agelaius phoeniceus', 'songbirds', [0.22, 0.36, 0.052], {
  diet: 'omnivore', habitat: ['wetland', 'grassland'], social: 'flocking', territorial: true, role: 'marsh colonist; males defend reed-bed territories and flash red shoulder patches',
  flight: { style: 'flap', cruiseSpeed: 12, stallSpeed: 6, maxSpeed: 18, diveSpeed: 25, glideRatio: 7, flapThrust: 3.8, turnRate: 2.2, soaring: 0.1, stamina: 90 },
  ground: { walk: 0.9, run: 2.4, turnRate: 5, strideLength: 0.12 },
  anim: { flapFreq: [5.5, 8], flapAmp: 0.8, upFold: 0.35 }
}));
add(bird('american_coot', 'American Coot', 'Fulica americana', 'waterbirds', [0.38, 0.65, 0.7], {
  diet: 'omnivore', habitat: ['wetland'], social: 'flocking', territorial: true, role: 'marsh diver and grazer; patters across the water to take off',
  flight: { style: 'flap', cruiseSpeed: 14, stallSpeed: 9, maxSpeed: 20, diveSpeed: 26, glideRatio: 6, flapThrust: 3.2, turnRate: 1.2, maxBank: 0.8, pitchRate: 1.0, soaring: 0, stamina: 80, staminaDrain: 8 },
  ground: { walk: 0.8, run: 2.2, turnRate: 3, swims: true, strideLength: 0.15 },
  anim: { flapFreq: [5, 7.5], flapAmp: 0.7, upFold: 0.2, glideDihedral: 0.1 }
}));

export const DEFAULT_SPECIES = 'osprey';

export function getSpecies(id) {
  return SPECIES[id] || SPECIES[DEFAULT_SPECIES];
}
