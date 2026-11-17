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
    // on their bones, legs are inside the skinned body. Joint axes are not world-aligned,
    // so neck and tail are left at rest pose (they still turn with the body).
    path: '/european_robin.glb',
    scale: 0.86,                 // model is 0.162 long including beak and tail, a real robin ~0.14 m
    flightPitch: 0.6,
    fixMaterials: true,
    shoulderDir: [0, 1, 1],
    wings: { type: 'rigid', nodes: ['left_wing', 'right_wing'], spread: { length: 1.15, thickness: 0.4, chord: 2.0 } },
    bones: { neck: ['joint2_01', 'joint8_02'], tail: ['joint3_03'] },
    neck: { pitchWeights: [], yawWeights: [] },
    tail: { pitchWeights: [], yawWeights: [] }
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
  }
};

export function getModelConfig(id) {
  return MODEL_CONFIGS[id] || null;
}
