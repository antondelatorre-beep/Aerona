# AERONA: The Living World

A realistic multiplayer bird wildlife simulator for the browser (Three.js, Node.js, Socket.IO, PostgreSQL, Render).

## Status

| Stage | Scope | State |
|---|---|---|
| 1 | Playable prototype: 3D world, GLB loading, one playable bird, procedural flight and walking, camera, desktop and mobile controls | done |
| 2 | Species system: roster, per-species configs and bone mapping, species-specific movement, in-game switching | **this release** (code); each species gets its 3D model when you add the GLB |
| 3 | Wildlife simulation: AI birds, feeding, flocking, predation, nesting | not started |
| 4 | Multiplayer: Socket.IO, sync, chat, PostgreSQL persistence | not started (`server.js` is ready to host it) |
| 5 | Full game: weather, breeding, progression, polish | not started |

The project is one flat folder: no subfolders anywhere, so the zip can be uploaded as is.
Files that arrive in later stages (same flat folder): `wildlife.js`, `ecosystem.js`, `multiplayer.js`, `menu.js`, `encyclopedia.js`, `wildlifeServer.js`, `database.js`.

## Stage 2: species system

* **41 species** in ``speciesData.js`` (the Philippine and worldwide lists, minus King Penguin, which cannot fly and needs swimming first). Each has its own size, wingspan, speeds, glide ratio, thrust, turn rate, stamina, diet, habitat, social and territorial flags, ecological role, nocturnal/diurnal activity, and wing-beat animation numbers. Groups are in `GROUPS` (all unlocked for now; unlock rules arrive with progression).
* **Switch species in game** from the Tab/Esc menu. Position, heading and flight state carry over. Dashed buttons are species without a GLB yet: they fly with their real numbers using a stand-in body.
* **Drop-in models**: put `<species_id>.glb` next to `main.js` (for example `peregrine_falcon.glb`). With no entry in `modelConfigs.js`, the game fits the scale to the species size, finds rigid wing/leg meshes and neck/tail bones by name, and prints the draft config in the browser console. Paste it into `modelConfigs.js` and refine it. The server lists installed models at `/api/models`.
* Models that are already authored with wings spread out load with no wing rig (body bob only) until you map their wing bones with a `bones`-type config.

### Models included in this build

| Species id | File | Rig notes |
|---|---|---|
| `osprey` | `osprey.glb` | rigid folded wings, neck and tail bones |
| `song_sparrow` | `song_sparrow.glb` | same recipe; wings are the `perchedBody.037/038` meshes |
| `red_winged_blackbird` | `red_winged_blackbird.glb` | same recipe |
| `european_robin` | `european_robin.glb` | rigid wings on a bone; neck and tail stay at rest pose (joint axes are not world-aligned) |
| `american_coot` | `american_coot.glb` | wings are baked into the body, so flat feathered wing plates (`type: 'synthetic'`) are added for flight |

`osprey_1.glb` was byte-identical to `osprey.glb`, so it was not added. The menu lists only species that have a model; use "Show species without a model" to reach the stand-in birds.
All scales, `flightPitch` and wing `spread` values are first guesses from the model geometry; tune them in `modelConfigs.js`.

## Run locally

```bash
npm install
npm run dev        # or: npm start
# open http://localhost:3000
```

Useful URL options: `?species=peregrine_falcon`, `?quality=low|medium|high`, `?touch=1` (force touch controls).

## Controls

Desktop: mouse = look and steer, W flap forward, S brake, A/D turn, Space hard flap (also takes off), Shift boost, C dive, F land / take off, E peck or drink (ground), R rest, Tab or Esc menu.
Mobile: left joystick, Flap, Glide, Boost, Dive, Land / Take off, Interact, drag the right side to look.

Gliding is the default when you are not flapping. The bird is trimmed so a glide holds cruise speed and sinks at about 1/glide-ratio. Flap to climb, pitch down to trade height for speed, and stay above stall speed.

## Where the Sketchfab models go

Put `.glb` files next to `main.js` (the project is one flat folder). The Osprey is already there as `osprey.glb`.
If a model fails to load, the game shows why and falls back to a procedural stand-in bird, so you can always test flight.

## Adding or configuring a bird

1. Download the GLB from Sketchfab and put it next to `main.js`.
2. List its structure:
   ```bash
   npm run inspect-glb -- your_bird.glb
   ```
   The browser console also lists every node when the game loads the model.
3. Add an entry to ``modelConfigs.js`` with the same `id` as the species in `speciesData.js`.
   Names are matched ignoring case and punctuation (three.js strips "." from node names).

Sample configuration (the working Osprey entry):

```js
osprey: {
  path: '/osprey.glb',
  scale: 1.25,              // model units to metres
  forwardRotation: 0,       // yaw correction so the beak points along +Z
  flightPitch: 0.75,        // model authored perched/upright: tilt this much in flight (0 for horizontal models)
  fixMaterials: true,
  shoulderDir: [0, 1, 1],   // which way the shoulder end of a wing mesh lies
  wings: { type: 'rigid', nodes: ['perchedWings.004_0', 'perchedWings.013_2'],
           spread: { length: 1.45, thickness: 0.35, chord: 2.1 } },
  legs:  { type: 'rigid', nodes: ['perchedLegs.003_1', 'perchedLegs.009_3'] },
  bones: { neck: ['Bone_6', 'Bone.001_5', 'Bone.002_4'], tail: ['Bone.003_8', 'Bone.004_7'] },
  neck:  { straightenFrom: 1, yawBone: 1, pitchWeights: [0.25, 0.4, 0.35], yawWeights: [0, 1, 0] },
  tail:  { pitchWeights: [0.6, 0.4], yawWeights: [0.6, 0.4] }
}
```

Supported model types:

* **Rigid wing meshes, no wing bones** (like the Osprey): wings are re-pivoted at the shoulder, unfolded outward by principal-axis analysis of their vertices, and stretched to flight span (`wings.spread`).
* **Skinned wings**: `wings: { type: 'bones', left: [...], right: [...] }`, each segment `{ bone, flap: ['z', 1], fold: ['y', 1.2], twist: ['x', 0.5] }` (axis, weight or radians). Right-hand wings are mirrored unless `mirrorRight: false`.
* **Neck and tail bones**: any chain length, with per-bone weights. Missing bones only log a warning.
* **No usable skeleton**: the body bobs as a fallback. Existing animation clips are ignored (the game drives bones procedurally).
* Draco and Meshopt compressed GLBs are supported.

Per-species motion lives in `speciesData.js` (`flight`, `ground`, `anim`). Flap frequency, amplitude, upstroke fold and sweep are all separate numbers.

Tuning from the browser console: `aerona.model.config`, `aerona.animator.a` (animation numbers, live), `aerona.species`.

## Known limits of Stage 1

* The bundled Osprey is a perched-pose model: wings are rigid slabs, so flight uses stretched folded-wing meshes. It works as a prototype; a spread-wing or fully rigged model will look much better. Tune `wings.spread` and `shoulderDir` if the wings look wrong.
* The Osprey's `perchedBody` node is an empty group, so only the skinned body mesh is visible and bendable.
* No collisions with trees or buildings yet, and no perching on branches (arrives with the ecosystem stage).
* Not yet profiled on real mobile hardware. `?quality=low` is the default on touch devices.

## Deploy on Render

Option A, blueprint (easiest): push this folder to GitHub, then in Render choose New, Blueprint and select the repo. `render.yaml` sets everything.

Option B, manual: New, Web Service, connect the repo. Runtime Node, build command `npm install`, start command `npm start`, health check path `/healthz`, environment variable `NODE_VERSION=20`.

Notes:
* Render sets `PORT`; the server reads it and binds to `0.0.0.0`.
* Commit your `.glb` files with the repo (the Osprey is 1.3 MB). Keep total model weight reasonable: free instances have limited bandwidth and slow cold starts after idling.
* Responses are gzip-compressed, and three.js and models are cached by the browser.
* Make sure the site is served over HTTPS (Render does this) so pointer lock works everywhere.

From Stage 4: add a Render PostgreSQL instance and set `DATABASE_URL` and `SESSION_SECRET` as environment variables on the web service. Secrets never go into the browser files.
