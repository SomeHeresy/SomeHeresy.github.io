/* Numerical checks for js/coil-field-model.js.  Run: node tools/test_field_model.cjs
 *
 * These confirm the illustrative model is internally consistent (symmetry,
 * divergence, flux tangency, the mirrored/shifted grid build, the gated
 * trajectory). They say nothing about agreement with real coilgun hardware;
 * that is the Python simulator's job. */
'use strict';
const assert = require('assert');
const M = require('../js/coil-field-model.js');

const rel = (a, b) => Math.abs(a - b) / Math.max(1e-8, Math.abs(a), Math.abs(b));
const f = (x, y) => M.rawField(x, y, M.COILS[0]);

// Field symmetry, divergence and flux-contour tangency at a few points.
for (const [x, y] of [[315, 15], [240, 60], [410, 90], [150, 120]]) {
  const a = f(x, y);
  const b = f(x, -y);
  assert(rel(a[0], b[0]) < 1e-6, 'Bx is even in r');
  assert(rel(a[1], -b[1]) < 1e-6, 'Br is odd in r');
  assert(rel(a[2], b[2]) < 1e-6, 'flux is even in r');
  const h = 0.05;
  const xp = f(x + h, y), xm = f(x - h, y), yp = f(x, y + h), ym = f(x, y - h);
  const dx = (xp[0] - xm[0]) / (2 * h);
  const dr = ((y + h) * yp[1] - (y - h) * ym[1]) / (2 * h * y);
  assert(Math.abs(dx + dr) < 0.0004, 'axisymmetric divergence vanishes');
  assert(rel(-(xp[2] - xm[2]) / (2 * h * y), a[1]) < 0.01, 'flux contour tangent matches Br');
  assert(rel((yp[2] - ym[2]) / (2 * h * y), a[0]) < 0.02, 'flux contour tangent matches Bx');
}

// The fast build (one mirrored half-grid, shifted for the second coil) must
// agree with computing every grid point directly.
console.time('field model');
const fields = M.buildField();
console.timeEnd('field model');
for (const field of fields) for (const key of ['bx', 'br', 'flux']) assert(field[key].every(Number.isFinite));
const probes = [[0, 0], [3, 7], [17, 40], [40, 90], [55, 180], [80, 0], [80, 180], [21, 131], [66, 49]];
fields.forEach((field, coil) => {
  for (const [row, col] of probes) {
    const direct = M.rawField(col * M.DX, row * M.DY - M.HEIGHT / 2, M.COILS[coil]).map(v => v / M.NORMALIZATION);
    const i = row * M.NX + col;
    ['bx', 'br', 'flux'].forEach((key, k) => {
      assert(Math.abs(field[key][i] - direct[k]) <= 1e-5 * Math.max(1, Math.abs(direct[k])),
        `coil ${coil} ${key} at row ${row}, col ${col}: ${field[key][i]} vs ${direct[k]}`);
    });
  }
});
assert(Math.abs(M.sample(fields[0].bx, 315, 0) - 1) < 0.025, 'field is normalised to 1 at the first coil centre');

// Trajectory: always moving forward, faster after each stage, currents cut before each centre.
const states = M.trajectory();
assert(states.at(-1).x > 900);
assert(states.at(-1).v > states[0].v * 7);
for (let i = 1; i < states.length; i += 1) assert(states[i].x > states[i - 1].x);
for (let c = 0; c < 2; c += 1) {
  assert(states.filter(s => s.x > M.COILS[c] + 30).every(s => s.currents[c] < 0.015), 'current removed after coil centre');
}
const midway = states.find(s => s.x > 450);
assert(midway.v > states[0].v * 4);
assert(states.at(-1).v > midway.v * 1.2);

// Contours: the callback form emits exactly what the array form returns.
console.time('contours');
let segments = 0;
let emitted = 0;
for (const level of [5, 12, 23, 39, 62, 92, 130, 178, 237, 310, 397, 500, 620]) {
  segments += M.contours(fields[0].flux, level).length;
  M.contours(fields[0].flux, level, () => { emitted += 1; });
}
console.timeEnd('contours');
assert(segments > 1000);
assert.strictEqual(emitted, segments);

console.log('PASS: symmetry, divergence, flux tangency, fast grid build, trajectory, contours.',
  { speedGain: +(states.at(-1).v / states[0].v).toFixed(2), segments });
