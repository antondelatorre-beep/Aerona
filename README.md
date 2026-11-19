# AERONA: The Living World

A realistic multiplayer bird wildlife simulator for the browser (Three.js, Node.js, Socket.IO, PostgreSQL, Render).
The project is one flat folder: no subfolders anywhere, so the zip can be uploaded as is.

## Status

| Stage | Scope | State |
|---|---|---|
| 1 | Playable prototype: 3D world, GLB loading, procedural flight and walking, camera, desktop and mobile controls | done |
| 2 | Species system: per-species configs and bone mapping, species-specific movement, in-game switching | **this release**, 23 species with models |
| 3 | Wildlife simulation: AI birds, feeding, flocking, predation, nesting | AI birds, flocks, hunger, foraging and hunting done (this release); nesting not started |
| 4 | Multiplayer: Socket.IO, sync, chat, PostgreSQL persistence | not started (`server.js` is ready to host it) |
| 5 | Full game: weather, breeding, progression, polish | not started |

## Run locally

```bash
npm install
npm run dev        # or: npm start
# open http://localhost:3000
```

URL options: `?species=red_tailed_hawk`, `?quality=low|medium|high`, `?touch=1` (force touch controls).

## Controls

Desktop: mouse = look and steer, W flap forward, S brake, A/D turn, Space hard flap (also takes off), Shift boost, C dive, F land / take off, E peck or drink (ground), R rest, Tab or Esc menu.
Mobile: left joystick, Flap, Glide, Boost, Dive, Land / Take off, Interact, drag the right side to look.

Gliding is the default when you are not flapping. The bird is trimmed so a glide holds cruise speed and sinks at about 1/glide-ratio. Flap to climb, pitch down to trade height for speed, and stay above stall speed.

## Species (only birds with a 3D model are included)

Each species has its own size, wingspan, speeds, glide ratio, thrust, turn rate, stamina, diet, habitat, social and territorial flags, role and wing-beat numbers (`speciesData.js`). Switch species from the Tab/Esc menu; position, heading and flight state carry over.

| Species ids | Rig notes |
|---|---|
| `osprey`, `song_sparrow`, `red_winged_blackbird`, `red_tailed_hawk`, `american_robin`, `belted_kingfisher`, `purple_finch`, `swainsons_thrush`, `warbling_vireo`, `eastern_wood_pewee`, `western_wood_pewee`, `american_bittern`, `american_kestrel` | rigid folded wing and leg meshes (cut into left and right halves when one mesh holds both sides), neck and tail bones |
| `european_robin` | rigid wings on a bone, FBX-style joints |
| `american_coot`, `canada_goose`, `common_loon`, `pied_billed_grebe`, `wood_duck`, `ring_billed_gull` | no separate wing parts: flat feathered wing plates are added for flight (`type: 'synthetic'`); rigid feet where present |
| `rock_pigeon`, `wild_turkey`, `ostrich` | full skeleton plus a long idle clip that plays on the ground. Pigeon and turkey get synthetic wings. The ostrich is flightless (Shift to run) |

Not added: the African Penguin and Ring-necked Pheasant uploads contained only FBX files. Export them as `.glb` and they can be added.

All scales, `flightPitch` values and wing `spread` sizes are first guesses computed from the model geometry. Tune them in `modelConfigs.js`.

## NPC birds

Other species live in the world as AI birds (`wildlife.js`): 8, 14 or 22 of them depending on quality, kept within a few hundred metres of you. They use the same models, flight physics and animation as your bird. On the ground they idle, look around, peck and wander, and take off if you come close. In the air they fly between waypoints at heights that suit the species (soarers high, small dashers low), then land somewhere that fits their habitat (waterbirds on water, forest birds near forest). Flocking and colonial species spawn in groups of 3 to 5 and follow a leader. The ostrich only runs. NPCs are spawned in places that match their habitat, models download lazily (up to 10 species at a time), distant NPCs animate at a reduced rate, and NPCs far away are hidden and removed. The HUD shows the nearest bird's name.
 Tune `count`, flee distances and altitudes in `wildlife.js`; inspect live with `aerona.wildlife`.

## Hunting and feeding

* **Predators** are the Osprey, Red-tailed Hawk and American Kestrel (`predation: { maxPreyMass }` in `speciesData.js`). They can take birds up to that mass.
* **To hunt:** fly towards a bird. A red marker with its name and distance appears when it is within about 35 degrees of where you look and within 160 m. Within 30 m the prompt says "E: strike". Press **E**: talons come out for about a second, and if you get within reach the strike is rolled. Success depends on your speed, whether you are diving (hold **C**), how agile the prey is and whether it is on the ground. Birds heavier than your limit slip free.
* **Eating:** a catch is carried in your talons. Land and press **E** four times to eat it; the food it gives depends on its mass compared with yours. Hunger drains slowly (faster while flapping); at zero your stamina recovers at half speed.
* **Fishing:** piscivores (osprey, kingfishers, loons and others) can press **E** while skimming below 5 m over water, with about a 45 percent chance of a fish.
* **Foraging:** any bird can peck the ground with **E** for a little food; seed and insect eaters get a useful amount, predators almost none.
* **NPCs:** prey birds spot you (if you are a predator) and other hunters, then bolt, jink and dive. NPC osprey, hawks and kestrels stalk and stoop on NPC birds too, and then land to eat.
* **Progress:** XP, level, kills, fish and meals are saved in the browser (`localStorage`). This is not secure; Stage 4 moves progression to the server.
* Not yet: nesting, mating, carrion, thermals used by hunting AI beyond basic flight, and predators beyond these three species.

## Adding a bird

1. Put `<species_id>.glb` next to `main.js` (the Sketchfab GLB download works; Draco and Meshopt compression are supported).
2. List its structure: `npm run inspect-glb -- your_bird.glb` (the browser console also lists every node on load).
3. Add an entry to `speciesData.js` (flight and animation numbers) and `modelConfigs.js` (how to bind the model). Names are matched ignoring case and punctuation.

Config options: `scale`, `forwardRotation`, `flightPitch` (tilt for models authored perched/upright), `shoulderDir`, `wings` (`rigid`, `synthetic` or `bones`), `legs`, `bones` (neck and tail chains), `neck`/`tail` weights, `split`, `idleClip`. Neck and tail pitch/yaw act about the model's own axes, so any joint orientation works. If a GLB fails to load, the game falls back to a procedural stand-in bird and says why.

Tuning from the browser console: `aerona.model.config`, `aerona.animator.a` (live animation numbers), `aerona.species`.

## Known limits

* Most models are perched-pose Sketchfab birds: wings are rigid slabs stretched and unfolded for flight, so they work as a prototype but will not look like a fully rigged bird.
* The pigeon, turkey and ostrich legs do not walk (the clip is an idle); they glide over the ground.
* No collisions with trees or buildings yet, and no perching on branches.
* Not yet profiled on real mobile hardware; touch devices default to `?quality=low`.

## Deploy on Render

Option A, blueprint: push this folder to GitHub, then in Render choose New, Blueprint and select the repo. `render.yaml` sets everything.
Option B, manual: New, Web Service. Runtime Node, build command `npm install`, start command `npm start`, health check path `/healthz`, environment variable `NODE_VERSION=20`.

Notes: Render sets `PORT`. Commit the `.glb` files with the repo (about 40 MB in total, the Ostrich is the largest). Responses are gzip-compressed. Free instances sleep when idle, so the first load after a gap is slow.
From Stage 4: add a Render PostgreSQL instance and set `DATABASE_URL` and `SESSION_SECRET` as environment variables on the web service. Secrets never go into the browser files.
