// Species definitions: ecology + flight + animation parameters.
// Units: metres, seconds, radians. Every species must differ meaningfully;
// the flight controller and the procedural animator both read these numbers.
//
// Only species that have a 3D model are listed. To add a bird: put its GLB next to
// main.js, add an entry here and a matching entry in modelConfigs.js.

const BASE = {
  name: 'Bird', scientific: '',
  group: 'starter',            // unlock group
  diet: 'omnivore', habitat: ['grassland'], social: 'solitary', territorial: false,
  role: 'generalist',
  activity: 'diurnal',
  predation: null,           // { maxPreyMass } in kg: species that can hunt other birds
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

export const SPECIES = {};
const add = (sp) => { SPECIES[sp.id] = sp; };

export const GROUPS = {
  raptors:    { label: 'Raptors', unlocked: true },
  songbirds:  { label: 'Songbirds and small perchers', unlocked: true },
  waterbirds: { label: 'Waterbirds', unlocked: true },
  seabirds:   { label: 'Gulls and seabirds', unlocked: true },
  starter:    { label: 'Starter birds', unlocked: true },
  runners:    { label: 'Ground birds', unlocked: true }
};

function bird(id, name, scientific, group, [length, wingspan, mass], o = {}) {
  const camera = o.camera || { distance: Math.min(9, Math.max(1.4, length * 7)), height: Math.max(0.2, length * 1.3) };
  return define({ id, name, scientific, group, size: { length, wingspan, mass }, ...o, camera });
}

// ----- raptors -----
add(bird('osprey', 'Osprey', 'Pandion haliaetus', 'raptors', [0.58, 1.7, 1.5], {
  diet: 'piscivore', habitat: ['wetland', 'coast', 'lakes'], social: 'pairs', territorial: true, role: 'fish-eating raptor; plunge-dives for fish, and will take small birds',
  predation: { maxPreyMass: 0.9 },
  flight: { style: 'soar', cruiseSpeed: 14, stallSpeed: 8.5, maxSpeed: 24, diveSpeed: 40, glideRatio: 12, flapThrust: 3.4, turnRate: 1.5, maxBank: 0.85, pitchRate: 1.1, soaring: 0.75, stamina: 110, staminaDrain: 6, staminaRegen: 5 },
  ground: { walk: 1.1, run: 3.0, turnRate: 3.0, strideLength: 0.3 },
  anim: { flapFreq: [2.4, 3.4], flapAmp: 0.7, glideDihedral: 0.2, upFold: 0.3, twist: 0.2, sweepCruise: 0.08, sweepDive: 0.95 },
  camera: { distance: 5.5, height: 0.9 }
}));
add(bird('red_tailed_hawk', 'Red-tailed Hawk', 'Buteo jamaicensis', 'raptors', [0.55, 1.3, 1.1], {
  diet: 'carnivore', habitat: ['grassland', 'mountain'], territorial: true, role: 'open-country soaring hunter of small mammals and birds',
  predation: { maxPreyMass: 1.4 },
  flight: { style: 'soar', cruiseSpeed: 13, stallSpeed: 8, maxSpeed: 22, diveSpeed: 35, glideRatio: 12, flapThrust: 3.2, turnRate: 1.5, soaring: 0.95 },
  ground: { walk: 1.1, run: 3.0, strideLength: 0.3 }, anim: { flapFreq: [2.4, 3.4], flapAmp: 0.7, glideDihedral: 0.15, sweepDive: 0.95 }
}));
add(bird('american_kestrel', 'American Kestrel', 'Falco sparverius', 'raptors', [0.26, 0.58, 0.12], {
  diet: 'insectivore', habitat: ['grassland'], territorial: true, role: 'small falcon that hovers over fields watching for insects, mice and small birds',
  predation: { maxPreyMass: 0.12 },
  flight: { style: 'hover', cruiseSpeed: 12, stallSpeed: 4, maxSpeed: 20, diveSpeed: 32, glideRatio: 8, flapThrust: 4.4, turnRate: 2.6, pitchRate: 1.9, soaring: 0.2, hover: true, stamina: 80 },
  ground: { walk: 0.8, run: 2.2, hop: true, strideLength: 0.12 }, anim: { flapFreq: [5, 8], flapAmp: 0.65, upFold: 0.4, sweepCruise: 0.15, sweepDive: 1.0 }
}));

// ----- songbirds and small perching birds -----
add(bird('american_robin', 'American Robin', 'Turdus migratorius', 'songbirds', [0.25, 0.40, 0.08], {
  diet: 'omnivore', habitat: ['grassland', 'garden', 'rainforest'], territorial: true, role: 'lawn worm hunter; seed disperser of berries',
  flight: { style: 'flap', cruiseSpeed: 11, stallSpeed: 6, maxSpeed: 17, diveSpeed: 24, glideRatio: 6.5, flapThrust: 3.8, turnRate: 2.4, stamina: 90 },
  ground: { walk: 0.9, run: 2.4, hop: true, turnRate: 5, strideLength: 0.1 }, anim: { flapFreq: [6, 9], flapAmp: 0.8, upFold: 0.4 }
}));
add(bird('european_robin', 'European Robin', 'Erithacus rubecula', 'songbirds', [0.14, 0.21, 0.018], {
  diet: 'insectivore', habitat: ['rainforest', 'grassland', 'garden'], territorial: true, role: 'fiercely territorial insect eater; sings year-round',
  flight: { style: 'dash', cruiseSpeed: 9, stallSpeed: 4.5, maxSpeed: 14, diveSpeed: 20, glideRatio: 6, flapThrust: 3.8, turnRate: 2.8, maxBank: 1.1, pitchRate: 2.0, soaring: 0, stamina: 70 },
  ground: { walk: 0.6, run: 1.8, hop: true, turnRate: 6, strideLength: 0.08 }, anim: { flapFreq: [8, 12], flapAmp: 0.8, upFold: 0.4, glideDihedral: 0.05 }
}));
add(bird('song_sparrow', 'Song Sparrow', 'Melospiza melodia', 'songbirds', [0.15, 0.21, 0.02], {
  diet: 'omnivore', habitat: ['wetland', 'grassland'], territorial: true, role: 'ground-foraging seed and insect eater of marsh edges and scrub',
  flight: { style: 'flap', cruiseSpeed: 9.5, stallSpeed: 5, maxSpeed: 15, diveSpeed: 20, glideRatio: 6, flapThrust: 3.8, turnRate: 2.6, soaring: 0, stamina: 75 },
  ground: { walk: 0.7, run: 1.9, hop: true, turnRate: 6, strideLength: 0.08 }, anim: { flapFreq: [8, 11], flapAmp: 0.85, upFold: 0.4, glideDihedral: 0.05 }
}));
add(bird('red_winged_blackbird', 'Red-winged Blackbird', 'Agelaius phoeniceus', 'songbirds', [0.22, 0.36, 0.052], {
  diet: 'omnivore', habitat: ['wetland', 'grassland'], social: 'flocking', territorial: true, role: 'marsh colonist; males defend reed-bed territories and flash red shoulder patches',
  flight: { style: 'flap', cruiseSpeed: 12, stallSpeed: 6, maxSpeed: 18, diveSpeed: 25, glideRatio: 7, flapThrust: 3.8, turnRate: 2.2, soaring: 0.1, stamina: 90 },
  ground: { walk: 0.9, run: 2.4, turnRate: 5, strideLength: 0.12 }, anim: { flapFreq: [5.5, 8], flapAmp: 0.8, upFold: 0.35 }
}));
add(bird('purple_finch', 'Purple Finch', 'Haemorhous purpureus', 'songbirds', [0.15, 0.25, 0.025], {
  diet: 'granivore', habitat: ['rainforest', 'garden'], social: 'flocking', role: 'seed and bud eater; bounding, undulating flight',
  flight: { style: 'dash', cruiseSpeed: 12, stallSpeed: 5.5, maxSpeed: 18, diveSpeed: 24, glideRatio: 6, flapThrust: 4.0, turnRate: 2.6, stamina: 80 },
  ground: { walk: 0.6, run: 1.6, hop: true, turnRate: 6, strideLength: 0.07 }, anim: { flapFreq: [7, 10], flapAmp: 0.85, upFold: 0.45 }
}));
add(bird('swainsons_thrush', "Swainson's Thrush", 'Catharus ustulatus', 'songbirds', [0.18, 0.30, 0.03], {
  diet: 'omnivore', habitat: ['rainforest'], territorial: true, role: 'long-distance night migrant; flute-like song in the forest understory',
  flight: { style: 'flap', cruiseSpeed: 11, stallSpeed: 5.5, maxSpeed: 17, diveSpeed: 23, glideRatio: 6, flapThrust: 3.8, turnRate: 2.4, stamina: 130, staminaDrain: 4 },
  ground: { walk: 0.7, run: 1.9, hop: true, turnRate: 6, strideLength: 0.09 }, anim: { flapFreq: [6.5, 9.5], flapAmp: 0.8, upFold: 0.4 }
}));
add(bird('warbling_vireo', 'Warbling Vireo', 'Vireo gilvus', 'songbirds', [0.13, 0.20, 0.012], {
  diet: 'insectivore', habitat: ['rainforest', 'wetland'], territorial: true, role: 'canopy gleaner; sings from the treetops',
  flight: { style: 'flap', cruiseSpeed: 9, stallSpeed: 4.5, maxSpeed: 14, diveSpeed: 19, glideRatio: 5.5, flapThrust: 3.8, turnRate: 2.8, stamina: 70 },
  ground: { walk: 0.5, run: 1.4, hop: true, turnRate: 6, strideLength: 0.06 }, anim: { flapFreq: [8, 12], flapAmp: 0.8, upFold: 0.4 }
}));
add(bird('eastern_wood_pewee', 'Eastern Wood-Pewee', 'Contopus virens', 'songbirds', [0.15, 0.26, 0.014], {
  diet: 'insectivore', habitat: ['rainforest'], territorial: true, role: 'sally-flycatcher; darts from a perch to snap insects',
  flight: { style: 'dash', cruiseSpeed: 9.5, stallSpeed: 4.5, maxSpeed: 16, diveSpeed: 22, glideRatio: 7, flapThrust: 4.2, turnRate: 3.0, pitchRate: 2.2, stamina: 80 },
  ground: { walk: 0.4, run: 1.2, hop: true, turnRate: 6, strideLength: 0.05 }, anim: { flapFreq: [7, 10.5], flapAmp: 0.8, upFold: 0.4 }
}));
add(bird('western_wood_pewee', 'Western Wood-Pewee', 'Contopus sordidulus', 'songbirds', [0.15, 0.26, 0.014], {
  diet: 'insectivore', habitat: ['rainforest', 'mountain'], territorial: true, role: 'sally-flycatcher of open woodland',
  flight: { style: 'dash', cruiseSpeed: 9.5, stallSpeed: 4.5, maxSpeed: 16, diveSpeed: 22, glideRatio: 7, flapThrust: 4.2, turnRate: 3.0, pitchRate: 2.2, stamina: 80 },
  ground: { walk: 0.4, run: 1.2, hop: true, turnRate: 6, strideLength: 0.05 }, anim: { flapFreq: [7, 10.5], flapAmp: 0.8, upFold: 0.4 }
}));

// ----- waterbirds -----
add(bird('american_coot', 'American Coot', 'Fulica americana', 'waterbirds', [0.38, 0.65, 0.7], {
  diet: 'omnivore', habitat: ['wetland'], social: 'flocking', territorial: true, role: 'marsh diver and grazer; patters across the water to take off',
  flight: { style: 'flap', cruiseSpeed: 14, stallSpeed: 9, maxSpeed: 20, diveSpeed: 26, glideRatio: 6, flapThrust: 3.2, turnRate: 1.2, maxBank: 0.8, pitchRate: 1.0, soaring: 0, stamina: 80, staminaDrain: 8 },
  ground: { walk: 0.8, run: 2.2, turnRate: 3, swims: true, strideLength: 0.15 }, anim: { flapFreq: [5, 7.5], flapAmp: 0.7, upFold: 0.2, glideDihedral: 0.1 }
}));
add(bird('american_bittern', 'American Bittern', 'Botaurus lentiginosus', 'waterbirds', [0.70, 1.15, 0.4], {
  diet: 'piscivore', habitat: ['wetland'], territorial: true, role: 'cryptic reed-bed ambusher; freezes with its bill pointed skyward',
  flight: { style: 'flap', cruiseSpeed: 10, stallSpeed: 6, maxSpeed: 16, diveSpeed: 22, glideRatio: 6, flapThrust: 3.0, turnRate: 1.4, soaring: 0.1, stamina: 90 },
  ground: { walk: 0.7, run: 1.8, strideLength: 0.25 }, anim: { flapFreq: [3, 4.2], flapAmp: 0.65, upFold: 0.2, glideDihedral: 0.05 }
}));
add(bird('pied_billed_grebe', 'Pied-billed Grebe', 'Podilymbus podiceps', 'waterbirds', [0.34, 0.55, 0.4], {
  diet: 'piscivore', habitat: ['wetland'], territorial: true, role: 'diving pond specialist; can sink slowly out of sight',
  flight: { style: 'flap', cruiseSpeed: 14, stallSpeed: 9, maxSpeed: 20, diveSpeed: 25, glideRatio: 5, flapThrust: 3.4, turnRate: 1.2, soaring: 0, stamina: 70, staminaDrain: 9 },
  ground: { walk: 0.3, run: 0.7, swims: true, turnRate: 2, strideLength: 0.1 }, anim: { flapFreq: [7, 10], flapAmp: 0.7, upFold: 0.15 }
}));
add(bird('common_loon', 'Common Loon', 'Gavia immer', 'waterbirds', [0.80, 1.30, 3.2], {
  diet: 'piscivore', habitat: ['wetland', 'lakes'], territorial: true, role: 'deep-diving fish hunter; heavy flier with a long takeoff run',
  flight: { style: 'flap', cruiseSpeed: 20, stallSpeed: 14, maxSpeed: 30, diveSpeed: 34, glideRatio: 5, flapThrust: 3.4, turnRate: 0.7, maxBank: 0.6, pitchRate: 0.8, soaring: 0, stamina: 90, staminaDrain: 8 },
  ground: { walk: 0.3, run: 0.7, swims: true, turnRate: 2, strideLength: 0.2 }, anim: { flapFreq: [4, 5.5], flapAmp: 0.6, upFold: 0.1, glideDihedral: 0.05 }
}));
add(bird('canada_goose', 'Canada Goose', 'Branta canadensis', 'waterbirds', [1.0, 1.5, 4.0], {
  diet: 'herbivore', habitat: ['wetland', 'grassland'], social: 'flocking', territorial: true, role: 'grazing flocker; flies in V formation',
  flight: { style: 'flap', cruiseSpeed: 17, stallSpeed: 10, maxSpeed: 25, diveSpeed: 30, glideRatio: 7, flapThrust: 3.4, turnRate: 0.9, maxBank: 0.7, pitchRate: 0.9, soaring: 0.2, stamina: 130, staminaDrain: 5 },
  ground: { walk: 1.2, run: 3.0, swims: true, turnRate: 3, strideLength: 0.35 }, anim: { flapFreq: [2.6, 3.6], flapAmp: 0.6, upFold: 0.15 }
}));
add(bird('wood_duck', 'Wood Duck', 'Aix sponsa', 'waterbirds', [0.48, 0.70, 0.65], {
  diet: 'omnivore', habitat: ['wetland', 'rainforest'], territorial: false, role: 'cavity-nesting duck; agile flier in forest swamps',
  flight: { style: 'flap', cruiseSpeed: 17, stallSpeed: 9, maxSpeed: 25, diveSpeed: 30, glideRatio: 6, flapThrust: 4.2, turnRate: 2.0, maxBank: 1.0, pitchRate: 1.5, soaring: 0, stamina: 100 },
  ground: { walk: 1.0, run: 2.6, swims: true, strideLength: 0.2 }, anim: { flapFreq: [5.5, 8], flapAmp: 0.7, upFold: 0.15 }
}));
add(bird('belted_kingfisher', 'Belted Kingfisher', 'Megaceryle alcyon', 'waterbirds', [0.31, 0.52, 0.15], {
  diet: 'piscivore', habitat: ['wetland', 'coast'], territorial: true, role: 'plunge-diving fish hunter; burrow nester',
  flight: { style: 'dash', cruiseSpeed: 13, stallSpeed: 7, maxSpeed: 21, diveSpeed: 30, glideRatio: 7, flapThrust: 4.6, turnRate: 2.1, soaring: 0.05, stamina: 80 },
  ground: { walk: 0.8, run: 2.0, hop: true, strideLength: 0.13 }, anim: { flapFreq: [5.5, 8], flapAmp: 0.7, upFold: 0.3, sweepCruise: 0.1, sweepDive: 0.8 }
}));

// ----- gulls and seabirds -----
add(bird('ring_billed_gull', 'Ring-billed Gull', 'Larus delawarensis', 'seabirds', [0.46, 1.2, 0.35], {
  diet: 'omnivore', habitat: ['coast', 'wetland', 'urban'], social: 'colonial', role: 'adaptable scavenger; soars on thermals and shore winds',
  flight: { style: 'soar', cruiseSpeed: 11, stallSpeed: 6, maxSpeed: 18, diveSpeed: 24, glideRatio: 12, flapThrust: 2.8, turnRate: 1.6, soaring: 0.7, stamina: 120 },
  ground: { walk: 1.0, run: 2.6, swims: true, strideLength: 0.2 }, anim: { flapFreq: [2.6, 3.6], flapAmp: 0.6, upFold: 0.2, glideDihedral: 0.1 }
}));

// ----- starter and ground birds -----
add(bird('rock_pigeon', 'Rock Pigeon', 'Columba livia', 'starter', [0.32, 0.65, 0.3], {
  diet: 'granivore', habitat: ['urban', 'grassland', 'coast'], social: 'flocking', role: 'urban flocking generalist',
  flight: { style: 'flap', cruiseSpeed: 15, stallSpeed: 7.5, maxSpeed: 25, diveSpeed: 33, glideRatio: 8, flapThrust: 4.0, turnRate: 1.9, maxBank: 0.95, pitchRate: 1.5, soaring: 0.1, stamina: 120, staminaDrain: 5 },
  ground: { walk: 1.0, run: 3.0, strideLength: 0.2 }, anim: { flapFreq: [4.5, 7.0], flapAmp: 0.85, glideDihedral: 0.3, upFold: 0.4, sweepDive: 0.6 }
}));
add(bird('wild_turkey', 'Wild Turkey', 'Meleagris gallopavo', 'runners', [1.0, 1.3, 6.0], {
  diet: 'omnivore', habitat: ['rainforest', 'grassland'], social: 'flocking', role: 'heavy ground forager; flies only in short, powerful bursts',
  flight: { style: 'flap', cruiseSpeed: 14, stallSpeed: 10, maxSpeed: 20, diveSpeed: 25, glideRatio: 5, flapThrust: 4.0, turnRate: 1.0, maxBank: 0.7, soaring: 0, stamina: 40, staminaDrain: 12, staminaRegen: 4 },
  ground: { walk: 1.6, run: 8.0, turnRate: 3.5, strideLength: 0.5 }, anim: { flapFreq: [4, 5.5], flapAmp: 0.7, upFold: 0.2 }
}));
add(bird('ostrich', 'Ostrich', 'Struthio camelus', 'runners', [2.0, 2.0, 100], {
  diet: 'omnivore', habitat: ['grassland'], social: 'flocking', territorial: false, role: 'largest living bird; flightless, the fastest runner on two legs',
  flight: { flightless: true, style: 'none', cruiseSpeed: 12, stallSpeed: 6, maxSpeed: 20, diveSpeed: 30, glideRatio: 4, flapThrust: 0, turnRate: 0.8, soaring: 0, stamina: 200, staminaDrain: 4, staminaRegen: 6 },
  ground: { walk: 2.5, run: 17.0, turnRate: 2.5, strideLength: 1.2 }, anim: { flapFreq: [2, 3], flapAmp: 0.5 }
}));

export const DEFAULT_SPECIES = 'osprey';

export function getSpecies(id) {
  return SPECIES[id] || SPECIES[DEFAULT_SPECIES];
}
