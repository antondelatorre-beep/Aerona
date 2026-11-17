// Small dependency-free maths helpers used when binding rigid wing/leg meshes.
// Kept free of three.js so it can be unit tested from Node.

/** Eigen-decomposition of a symmetric 3x3 matrix (cyclic Jacobi). Returns {values, vectors} sorted by value, descending. */
export function eigenSym3(m) {
  const a = [m[0].slice(), m[1].slice(), m[2].slice()];
  const v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  for (let sweep = 0; sweep < 24; sweep++) {
    const off = Math.abs(a[0][1]) + Math.abs(a[0][2]) + Math.abs(a[1][2]);
    if (off < 1e-14) break;
    for (const [p, q] of [[0, 1], [0, 2], [1, 2]]) {
      if (Math.abs(a[p][q]) < 1e-16) continue;
      const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
      const t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
      const c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < 3; k++) {
        const akp = a[k][p], akq = a[k][q];
        a[k][p] = c * akp - s * akq;
        a[k][q] = s * akp + c * akq;
      }
      for (let k = 0; k < 3; k++) {
        const apk = a[p][k], aqk = a[q][k];
        a[p][k] = c * apk - s * aqk;
        a[q][k] = s * apk + c * aqk;
      }
      for (let k = 0; k < 3; k++) {
        const vkp = v[k][p], vkq = v[k][q];
        v[k][p] = c * vkp - s * vkq;
        v[k][q] = s * vkp + c * vkq;
      }
    }
  }
  const idx = [0, 1, 2].sort((i, j) => a[j][j] - a[i][i]);
  return {
    values: idx.map((i) => a[i][i]),
    vectors: idx.map((i) => [v[0][i], v[1][i], v[2][i]])
  };
}

export const dot3 = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const neg3 = (a) => [-a[0], -a[1], -a[2]];
export const norm3 = (a) => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };

/**
 * Principal axes of a point cloud (flat xyz array).
 * Returns the centroid, the three unit axes (longest first) and the min/max
 * extent of the cloud along each axis.
 */
export function principalAxes(points) {
  const n = points.length / 3;
  const mean = [0, 0, 0];
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) mean[k] += points[i * 3 + k];
  for (let k = 0; k < 3; k++) mean[k] /= n;
  const cov = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (let i = 0; i < n; i++) {
    const d = [points[i * 3] - mean[0], points[i * 3 + 1] - mean[1], points[i * 3 + 2] - mean[2]];
    for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cov[r][c] += d[r] * d[c];
  }
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) cov[r][c] /= n;
  const { values, vectors } = eigenSym3(cov);
  const axes = vectors.map(norm3);
  const extents = axes.map((ax) => {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < n; i++) {
      const p = dot3([points[i * 3] - mean[0], points[i * 3 + 1] - mean[1], points[i * 3 + 2] - mean[2]], ax);
      if (p < lo) lo = p;
      if (p > hi) hi = p;
    }
    return [lo, hi];
  });
  return { mean, axes, values, extents };
}

/**
 * Work out how a rigid wing mesh should be unfolded.
 *  points      flat xyz of the wing vertices in the model's content space
 *  side        +1 for the model's +X wing, -1 for the -X wing
 *  shoulderDir direction (content space) that points towards the shoulder end of the wing
 * Returns { shoulder, u, n, f, length } where u runs shoulder->tip, n is the
 * outward (dorsal) normal and f = u x n, forming a right-handed basis.
 */
export function wingBasis(points, side, shoulderDir = [0, 1, 0]) {
  const pa = principalAxes(points);
  let u = pa.axes[0];
  if (dot3(u, shoulderDir) > 0) u = neg3(u);          // u points away from the shoulder
  const ext = pa.extents[0];
  const projMin = dot3(u, pa.axes[0]) > 0 ? ext[0] : -ext[1];
  const projMax = dot3(u, pa.axes[0]) > 0 ? ext[1] : -ext[0];
  const shoulder = [pa.mean[0] + u[0] * projMin, pa.mean[1] + u[1] * projMin, pa.mean[2] + u[2] * projMin];
  let n = pa.axes[2];                                  // thinnest direction
  if (dot3(n, [side, 0, 0]) < 0) n = neg3(n);          // dorsal side faces away from the body
  // make n exactly perpendicular to u
  const d = dot3(n, u);
  n = norm3([n[0] - u[0] * d, n[1] - u[1] * d, n[2] - u[2] * d]);
  const f = cross3(u, n);
  return { shoulder, u, n, f, length: projMax - projMin, mean: pa.mean, values: pa.values };
}
