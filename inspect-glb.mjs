// Prints the structure of a .glb so you can fill in client/species/modelConfigs.js:
// node tree, skins/bones, meshes with world-space bounding boxes, animation clips.
//   npm run inspect-glb -- client/models/birds/osprey.glb
import fs from 'node:fs';

const file = process.argv[2];
if (!file) { console.error('usage: npm run inspect-glb -- <file.glb>'); process.exit(1); }
const d = fs.readFileSync(file);
if (d.toString('ascii', 0, 4) !== 'glTF') { console.error('not a binary glTF (.glb) file'); process.exit(1); }
const jsonLen = d.readUInt32LE(12);
const j = JSON.parse(d.subarray(20, 20 + jsonLen).toString('utf8'));
const binOff = 20 + jsonLen;
const bin = binOff + 8 <= d.length ? d.subarray(binOff + 8) : Buffer.alloc(0);
const nodes = j.nodes || [];

const I = () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1];
const mul = (a, b) => { const r = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let rr = 0; rr < 4; rr++) for (let k = 0; k < 4; k++) r[c*4+rr] += a[k*4+rr] * b[c*4+k]; return r; };
function local(n) {
  if (n.matrix) return n.matrix;
  const t = n.translation || [0,0,0], q = n.rotation || [0,0,0,1], s = n.scale || [1,1,1];
  const [x,y,z,w] = q;
  return [
    (1-2*(y*y+z*z))*s[0], (2*(x*y+z*w))*s[0], (2*(x*z-y*w))*s[0], 0,
    (2*(x*y-z*w))*s[1], (1-2*(x*x+z*z))*s[1], (2*(y*z+x*w))*s[1], 0,
    (2*(x*z+y*w))*s[2], (2*(y*z-x*w))*s[2], (1-2*(x*x+y*y))*s[2], 0,
    t[0], t[1], t[2], 1];
}
const world = {};
const jointSet = new Set((j.skins || []).flatMap((s) => s.joints));
function positions(mi) {
  const out = [];
  for (const p of j.meshes[mi].primitives) {
    const a = j.accessors[p.attributes.POSITION], bv = j.bufferViews[a.bufferView];
    const base = (bv.byteOffset || 0) + (a.byteOffset || 0), stride = bv.byteStride || 12;
    for (let i = 0; i < a.count; i++) out.push([0,1,2].map((k) => bin.readFloatLE(base + i * stride + k * 4)));
  }
  return out;
}
function walk(i, parent, depth) {
  const n = nodes[i];
  const m = mul(parent, local(n));
  world[i] = m;
  let extra = '';
  if (n.mesh != null) {
    const pts = positions(n.mesh).map(([x,y,z]) => [m[0]*x+m[4]*y+m[8]*z+m[12], m[1]*x+m[5]*y+m[9]*z+m[13], m[2]*x+m[6]*y+m[10]*z+m[14]]);
    if (pts.length) {
      const lo = [0,1,2].map((k) => Math.min(...pts.map((p) => p[k])).toFixed(3));
      const hi = [0,1,2].map((k) => Math.max(...pts.map((p) => p[k])).toFixed(3));
      extra = `  mesh${n.skin != null ? ' (skinned)' : ''} bbox [${lo}] .. [${hi}]`;
    }
  }
  console.log(`${'  '.repeat(depth)}[${i}] ${n.name ?? '(unnamed)'}${jointSet.has(i) ? '  <bone>' : ''}${extra}`);
  for (const c of n.children || []) walk(c, m, depth + 1);
}
console.log(`File: ${file}\nNode tree (names as written in the file; three.js strips "." and similar):`);
for (const s of j.scenes[j.scene ?? 0].nodes) walk(s, I(), 0);
console.log('\nSkins:', (j.skins || []).map((s) => `${s.joints.length} joints`).join(', ') || 'none');
console.log('Animation clips:', (j.animations || []).map((a) => `${a.name} (${a.channels.length} channels)`).join(', ') || 'none');
console.log('Meshes:', (j.meshes || []).length, ' Materials:', (j.materials || []).length, ' Images:', (j.images || []).length);
console.log('Extensions used:', (j.extensionsUsed || []).join(', ') || 'none');
