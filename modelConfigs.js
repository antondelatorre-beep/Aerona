// Per-species model configuration: where the GLB lives and how to bind it.
//
// Nothing here assumes a particular bone naming scheme. Names are matched
// case-insensitively and with punctuation ignored, because three.js removes
// characters such as "." from node names on import ("Bone.001_5" arrives as
// "Bone001_5"). Use `npm run inspect-glb -- <file>.glb`
// or the browser console (the game logs every node it finds) to list names.
//
// A config may contain:
//   path            URL of the .glb (the .glb sits next to this file)
//   scale           model units -> metres
//   forwardRotation extra yaw (radians) so the bird's beak points along +Z
//   flightPitch     radians the model is pitched forward when flying. Use it for models
//                   authored in an upright perched pose (0 for horizontal models)
//   pivot           [x,y,z] centre of rotation in model units (default: bounding-box centre)
//   footY           lowest point of the feet in model units (default: bounding-box minimum)
//   fixMaterials    flatten metalness (no environment map is used, metal renders black)
//   shoulderDir     direction (model space) that points towards the shoulder end of a wing mesh
//   wings           how wings are driven. Two modes:
//        { type: 'rigid', nodes: [names], spread: {length, thickness, chord} }
//            wings are separate meshes (typical for perched-pose Sketchfab birds). They are
//            re-pivoted at the shoulder, rotated outward and stretched to a flight span.
//        { type: 'synthetic', shoulder: [x,y,z], length, chord, color, trailColor }
//            the model has no wing parts: flat feathered plates are added for flight
//        { type: 'bones', left: [segment...], right: [segment...] }
//            wings are skinned. segment = { bone, flap: [axis, weight], fold: [axis, radians], twist: [axis, weight] }
//   legs            { type: 'rigid', nodes: [names] }   (rigid leg meshes swing at the hip)
//   bones           { neck: [names base->head], tail: [names base->tip] }
//                   (pitch/yaw are applied about the model's own X and vertical axes, whatever the joint orientation)
//   split           true on wings/legs when one mesh holds both sides: it is cut into left and right halves
//   idleClip        true (or a clip name): play the model's own animation clip while on the ground
//   neck            { straightenFrom: index, yawBone: index, pitchWeights: [...], yawWeights: [...] }
//   tail            { pitchWeights: [...], yawWeights: [...] }
//   animation       optional overrides merged over speciesData.anim
//
// Species without an entry here get a procedural stand-in bird.

export const MODEL_CONFIGS = {
  osprey: {
    path: '/osprey.glb',
    scale: 1.25,                 // model body is ~0.45 units long; a real osprey is ~0.58 m
    forwardRotation: 0,          // the beak already points along +Z
    flightPitch: 0.75,           // model is authored perched (upright); tilt ~43 degrees to fly
    fixMaterials: true,
    shoulderDir: [0, 1, 1],      // wing strips run from shoulder (up/front) down towards the tail
    wings: {
      type: 'rigid',
      nodes: ['perchedWings.004_0', 'perchedWings.013_2'],
      spread: { length: 1.45, thickness: 0.35, chord: 2.1 }
    },
    legs: { type: 'rigid', nodes: ['perchedLegs.003_1', 'perchedLegs.009_3'] },
    bones: {
      neck: ['Bone_6', 'Bone.001_5', 'Bone.002_4'],
      tail: ['Bone.003_8', 'Bone.004_7']
    },
    neck: {
      straightenFrom: 1,         // in flight, uncurl the perched S-shaped neck from bone index 1
      yawBone: 1,
      pitchWeights: [0.25, 0.4, 0.35],
      yawWeights: [0, 1, 0]
    },
    tail: { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
  },
  // The four small birds below come from the same Sketchfab perched-pose family
  // (rigid folded wings, a few bones for neck and tail), so they share the Osprey recipe.
  song_sparrow: {
    path: '/song_sparrow.glb',
    scale: 1.25,                 // model is 0.12 long, a real Song Sparrow ~0.15 m
    flightPitch: 0.3,
    fixMaterials: true,
    shoulderDir: [0, 1, 1],
    wings: { type: 'rigid', nodes: ['perchedBody.037_2', 'perchedBody.038_3'], spread: { length: 1.3, thickness: 0.35, chord: 2.0 } },
    legs: { type: 'rigid', nodes: ['perchedBody.035_0', 'perchedBody.036_1'] },
    bones: { neck: ['Bone_5', 'Bone.001_4'], tail: ['Bone.002_7', 'Bone.003_6'] },
    neck: { straightenFrom: 1, pitchWeights: [0.4, 0.6], yawWeights: [0, 1] },
    tail: { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
  },
  red_winged_blackbird: {
    path: '/red_winged_blackbird.glb',
    scale: 1.1,                  // model is 0.20 long, real ~0.22 m
    flightPitch: 0.5,
    fixMaterials: true,
    shoulderDir: [0, 1, 1],
    wings: { type: 'rigid', nodes: ['perchedWings.005_0', 'perchedWings.014_2'], spread: { length: 1.1, thickness: 0.35, chord: 2.0 } },
    legs: { type: 'rigid', nodes: ['perchedLegs.004_1', 'perchedLegs.010_3'] },
    bones: { neck: ['Bone_5', 'Bone.003_4'], tail: ['Bone.001_7', 'Bone.002_6'] },
    neck: { straightenFrom: 1, pitchWeights: [0.4, 0.6], yawWeights: [0, 1] },
    tail: { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
  },
  european_robin: {
    // FBX-derived rig: wings are rigid meshes parented to a bone, beak and tail are meshes
    // on their bones, legs are inside the skinned body.
    path: '/european_robin.glb',
    scale: 0.86,                 // model is 0.162 long including beak and tail, a real robin ~0.14 m
    flightPitch: 0.6,
    fixMaterials: true,
    shoulderDir: [0, 1, 1],
    wings: { type: 'rigid', nodes: ['left_wing', 'right_wing'], spread: { length: 1.15, thickness: 0.4, chord: 2.0 } },
    bones: { neck: ['joint2_01', 'joint8_02'], tail: ['joint3_03'] },
    neck: { pitchWeights: [0.5, 0.5], yawWeights: [0, 1] },
    tail: { pitchWeights: [1], yawWeights: [1] }
  },
  american_coot: {
    // Wings are baked into the body mesh, so flat wing plates are added for flight.
    path: '/american_coot.glb',
    scale: 1.28,                 // model is 0.30 long, a real coot ~0.38 m
    flightPitch: 0.4,
    fixMaterials: true,
    wings: { type: 'synthetic', shoulder: [0.05, 0.16, 0.03], length: 0.27, chord: 0.14, color: [0.13, 0.14, 0.16], trailColor: [0.7, 0.72, 0.75] },
    legs: { type: 'rigid', nodes: ['perchedFeet.001_0', 'perchedFeet.008_1'] },
    bones: {
      neck: ['Bone_6', 'Bone.001_5', 'Bone.002_4', 'Bone.003_3', 'Bone.004_2'],
      tail: ['Bone.005_8', 'Bone.006_7']
    },
    neck: { straightenFrom: 1, pitchWeights: [0.2, 0.2, 0.2, 0.2, 0.2], yawWeights: [0, 0, 0.5, 0.5, 0] },
    tail: { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
  },
  american_bittern: {
    path: '/american_bittern.glb',
    scale: 1.420,                // model body 0.493 long, real 0.7 m
    flightPitch: 0.15,
    fixMaterials: true,
    shoulderDir: [0, 1, 1],
    wings: { type: 'rigid', nodes: ['perchedWings.002'], split: true, spread: { length: 1.28, thickness: 0.35, chord: 2.0 } },
    legs: { type: 'rigid', nodes: ['perchedLegs.001'], split: true },
    bones: { neck: ['Bone', 'Bone.001', 'Bone.002', 'Bone.003', 'Bone.004'], tail: ['Bone.005', 'Bone.006'] },
    neck: { straightenFrom: 1, pitchWeights: [0.2, 0.2, 0.2, 0.2, 0.2], yawWeights: [0, 0.25, 0.25, 0.25, 0.25] },
    tail: { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
  },
  american_kestrel: {
    path: '/american_kestrel.glb',
    scale: 0.935,                // model body 0.278 long, real 0.26 m
    flightPitch: 0.8,
    fixMaterials: true,
    shoulderDir: [0, 1, 1],
    wings: { type: 'rigid', nodes: ['wings'], split: true, spread: { length: 1.65, thickness: 0.35, chord: 2.0 } },
    legs: { type: 'rigid', nodes: ['legs'], split: true },
    bones: { neck: ['Bone'], tail: ['Bone.001', 'Bone.002', 'Bone.003'] },
    neck: { straightenFrom: 1, pitchWeights: [1.0], yawWeights: [1] },
    tail: { pitchWeights: [0.33, 0.33, 0.33], yawWeights: [0.33, 0.33, 0.33] }
  },
  american_robin: {
    path: '/american_robin.glb',
    scale: 0.887,                // model body 0.282 long, real 0.25 m
    flightPitch: 0.73,
    fixMaterials: true,
    shoulderDir: [0, 1, 1],
    wings: { type: 'rigid', nodes: ['wings'], split: true, spread: { length: 1.20, thickness: 0.35, chord: 2.0 } },
    legs: { type: 'rigid', nodes: ['legs'], split: true },
    bones: { neck: ['Bone', 'Bone.001'], tail: ['Bone.002', 'Bone.003'] },
    neck: { straightenFrom: 1, pitchWeights: [0.5, 0.5], yawWeights: [0, 1.0] },
    tail: { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
  },
  belted_kingfisher: {
    path: '/belted_kingfisher.glb',
    scale: 1.119,                // model body 0.277 long, real 0.31 m
    flightPitch: 0.51,
    fixMaterials: true,
    shoulderDir: [0, 1, 1],
    wings: { type: 'rigid', nodes: ['perchedWings.003', 'perchedWings.012'], spread: { length: 1.20, thickness: 0.35, chord: 2.0 } },
    legs: { type: 'rigid', nodes: ['perchedLegs.002', 'perchedLegs.008'] },
    bones: { neck: ['Bone', 'Bone.001'], tail: ['Bone.002', 'Bone.003'] },
    neck: { straightenFrom: 1, pitchWeights: [0.5, 0.5], yawWeights: [0, 1.0] },
    tail: { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
  },
  canada_goose: {
    path: '/canada_goose.glb',
    scale: 1.391,                // model body 0.719 long, real 1.0 m
    flightPitch: 0.38,
    fixMaterials: true,
    wings: { type: 'synthetic', shoulder: [0.046, 0.348, 0.052], length: 0.494, chord: 0.188, color: [0.35, 0.32, 0.28], trailColor: [0.8, 0.78, 0.72] },
    bones: { neck: ['Bone', 'Bone.001', 'Bone.002', 'Bone.003', 'Bone.004', 'Bone.005', 'Bone.006'], tail: [] },
    neck: { straightenFrom: 1, pitchWeights: [0.14, 0.14, 0.14, 0.14, 0.14, 0.14, 0.14], yawWeights: [0, 0.17, 0.17, 0.17, 0.17, 0.17, 0.17] },
    tail: { pitchWeights: [], yawWeights: [] }
  },
  common_loon: {
    path: '/common_loon.glb',
    scale: 1.354,                // model body 0.591 long, real 0.8 m
    flightPitch: 0.4,
    fixMaterials: true,
    wings: { type: 'synthetic', shoulder: [0.031, 0.296, 0.154], length: 0.449, chord: 0.171, color: [0.1, 0.1, 0.12], trailColor: [0.55, 0.55, 0.58] },
    legs: { type: 'rigid', nodes: ['perchedFeet.003', 'perchedFeet.009'] },
    bones: { neck: ['Bone', 'Bone.001', 'Bone.002', 'Bone.003', 'Bone.004', 'Bone.005'], tail: ['Bone.006', 'Bone.007'] },
    neck: { straightenFrom: 1, pitchWeights: [0.17, 0.17, 0.17, 0.17, 0.17, 0.17], yawWeights: [0, 0.2, 0.2, 0.2, 0.2, 0.2] },
    tail: { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
  },
  eastern_wood_pewee: {
    path: '/eastern_wood_pewee.glb',
    scale: 0.941,                // model body 0.159 long, real 0.15 m
    flightPitch: 0.38,
    fixMaterials: true,
    shoulderDir: [0, 1, 1],
    wings: { type: 'rigid', nodes: ['perchedBody.001', 'perchedBody.003'], spread: { length: 1.28, thickness: 0.35, chord: 2.0 } },
    legs: { type: 'rigid', nodes: ['perchedBody.004', 'perchedBody.005'] },
    bones: { neck: ['Bone', 'Bone.001'], tail: ['Bone.002', 'Bone.003'] },
    neck: { straightenFrom: 1, pitchWeights: [0.5, 0.5], yawWeights: [0, 1.0] },
    tail: { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
  },
  pied_billed_grebe: {
    path: '/pied_billed_grebe.glb',
    scale: 1.592,                // model body 0.214 long, real 0.34 m
    flightPitch: 0.3,
    fixMaterials: true,
    wings: { type: 'synthetic', shoulder: [0.014, 0.120, 0.058], length: 0.159, chord: 0.060, color: [0.3, 0.24, 0.18], trailColor: [0.62, 0.56, 0.5] },
    legs: { type: 'rigid', nodes: ['perchedFeet.004'], split: true },
    bones: { neck: ['Bone', 'Bone.003', 'Bone.004', 'Bone.005', 'Bone.006'], tail: ['Bone.001', 'Bone.002'] },
    neck: { straightenFrom: 1, pitchWeights: [0.2, 0.2, 0.2, 0.2, 0.2], yawWeights: [0, 0.25, 0.25, 0.25, 0.25] },
    tail: { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
  },
  purple_finch: {
    path: '/purple_finch.glb',
    scale: 1.120,                // model body 0.134 long, real 0.15 m
    flightPitch: 0.7,
    fixMaterials: true,
    shoulderDir: [0, 1, 1],
    wings: { type: 'rigid', nodes: ['perchedBody.027', 'perchedBody.028'], spread: { length: 1.19, thickness: 0.35, chord: 2.0 } },
    legs: { type: 'rigid', nodes: ['perchedBody.029', 'perchedBody.030'] },
    bones: { neck: ['Bone', 'Bone.001'], tail: ['Bone.002', 'Bone.003'] },
    neck: { straightenFrom: 1, pitchWeights: [0.5, 0.5], yawWeights: [0, 1.0] },
    tail: { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
  },
  red_tailed_hawk: {
    path: '/red_tailed_hawk.glb',
    scale: 0.809,                // model body 0.680 long, real 0.55 m
    flightPitch: 0.55,
    fixMaterials: true,
    shoulderDir: [0, 1, 1],
    wings: { type: 'rigid', nodes: ['perchedBody.031', 'perchedBody.032'], spread: { length: 1.43, thickness: 0.35, chord: 2.0 } },
    legs: { type: 'rigid', nodes: ['perchedBody.033', 'perchedBody.034'] },
    bones: { neck: ['Bone', 'Bone.001'], tail: ['Bone.002', 'Bone.003'] },
    neck: { straightenFrom: 1, pitchWeights: [0.5, 0.5], yawWeights: [0, 1.0] },
    tail: { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
  },
  ring_billed_gull: {
    path: '/ring_billed_gull.glb',
    scale: 0.963,                // model body 0.478 long, real 0.46 m
    flightPitch: 0.55,
    fixMaterials: true,
    wings: { type: 'synthetic', shoulder: [0.020, 0.229, -0.022], length: 0.603, chord: 0.229, color: [0.62, 0.64, 0.68], trailColor: [0.92, 0.92, 0.94] },
    legs: { type: 'rigid', nodes: ['perchedFeet.006', 'perchedFeet.012'] },
    bones: { neck: ['Bone', 'Bone.003', 'Bone.004'], tail: ['Bone.001', 'Bone.002'] },
    neck: { straightenFrom: 1, pitchWeights: [0.33, 0.33, 0.33], yawWeights: [0, 0.5, 0.5] },
    tail: { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
  },
  swainsons_thrush: {
    path: '/swainsons_thrush.glb',
    scale: 0.979,                // model body 0.184 long, real 0.18 m
    flightPitch: 0.54,
    fixMaterials: true,
    shoulderDir: [0, 1, 1],
    wings: { type: 'rigid', nodes: ['perchedBody.039', 'perchedBody.040'], spread: { length: 1.21, thickness: 0.35, chord: 2.0 } },
    legs: { type: 'rigid', nodes: ['perchedBody.041', 'perchedBody.042'] },
    bones: { neck: ['Bone', 'Bone.001'], tail: ['Bone.002', 'Bone.003'] },
    neck: { straightenFrom: 1, pitchWeights: [0.5, 0.5], yawWeights: [0, 1.0] },
    tail: { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
  },
  warbling_vireo: {
    path: '/warbling_vireo.glb',
    scale: 1.228,                // model body 0.106 long, real 0.13 m
    flightPitch: 0.59,
    fixMaterials: true,
    shoulderDir: [0, 1, 1],
    wings: { type: 'rigid', nodes: ['perchedBody.045', 'perchedBody.046'], spread: { length: 1.12, thickness: 0.35, chord: 2.0 } },
    legs: { type: 'rigid', nodes: ['perchedBody.043', 'perchedBody.044'] },
    bones: { neck: ['Bone', 'Bone.003'], tail: ['Bone.001', 'Bone.002'] },
    neck: { straightenFrom: 1, pitchWeights: [0.5, 0.5], yawWeights: [0, 1.0] },
    tail: { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
  },
  western_wood_pewee: {
    path: '/western_wood_pewee.glb',
    scale: 1.128,                // model body 0.133 long, real 0.15 m
    flightPitch: 0.7,
    fixMaterials: true,
    shoulderDir: [0, 1, 1],
    wings: { type: 'rigid', nodes: ['perchedWings.001', 'perchedWings.007'], spread: { length: 1.10, thickness: 0.35, chord: 2.0 } },
    legs: { type: 'rigid', nodes: ['perchedWings.009', 'perchedWings.010'] },
    bones: { neck: ['Bone', 'Bone.001'], tail: ['Bone.002', 'Bone.003'] },
    neck: { straightenFrom: 1, pitchWeights: [0.5, 0.5], yawWeights: [0, 1.0] },
    tail: { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
  },
  wood_duck: {
    path: '/wood_duck.glb',
    scale: 1.433,                // model body 0.335 long, real 0.48 m
    flightPitch: 0.35,
    fixMaterials: true,
    wings: { type: 'synthetic', shoulder: [0.022, 0.191, 0.004], length: 0.222, chord: 0.084, color: [0.1, 0.17, 0.19], trailColor: [0.68, 0.7, 0.74] },
    legs: { type: 'rigid', nodes: ['perchedFeet.007', 'perchedFeet.013'] },
    bones: { neck: ['Bone', 'Bone.003', 'Bone.004', 'Bone.005'], tail: ['Bone.001', 'Bone.002'] },
    neck: { straightenFrom: 1, pitchWeights: [0.25, 0.25, 0.25, 0.25], yawWeights: [0, 0.33, 0.33, 0.33] },
    tail: { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
  },

  rock_pigeon: {
    // Full skeleton with one long idle clip, no wing parts: the clip plays on the ground,
    // flat feathered wing plates are added for flight.
    path: '/rock_pigeon.glb',
    scale: 0.37,
    flightPitch: 0.3,
    fixMaterials: true,
    idleClip: true,
    wings: { type: 'synthetic', shoulder: [0.06, 0.36, 0.05], length: 0.82, chord: 0.3, color: [0.45, 0.47, 0.5], trailColor: [0.75, 0.77, 0.8] }
  },
  wild_turkey: {
    path: '/wild_turkey.glb',
    scale: 1.7,                  // model is 0.56 tall; a wild turkey stands ~0.95 m
    flightPitch: 0.3,
    fixMaterials: true,
    idleClip: true,
    wings: { type: 'synthetic', shoulder: [0.09, 0.34, 0.03], length: 0.29, chord: 0.12, color: [0.22, 0.16, 0.10], trailColor: [0.55, 0.45, 0.32] }
  },
  ostrich: {
    // Flightless. Full skeleton; the clip is a long idle and plays while it stands or walks.
    path: '/ostrich.glb',
    scale: 2.7,                  // model is 0.88 tall; an ostrich head stands ~2.4 m
    flightPitch: 0,
    fixMaterials: true,
    idleClip: true
  }
};

export function getModelConfig(id) {
  return MODEL_CONFIGS[id] || null;
}
