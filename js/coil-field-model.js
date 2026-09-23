/* Axisymmetric, air-core field study of two identical coils.
 *
 * Length and current are dimensionless. Biot–Savart quadrature over circular
 * turns supplies Bx, Br and r·Aφ; contours of r·Aφ are magnetic flux lines,
 * not decorative ellipses. The model deliberately leaves out ferromagnetic
 * saturation, eddy currents and the real hardware's circuit. It is not the
 * Python simulator from the coilgun-simulator case study.
 *
 * Two symmetries keep the grid cheap to build:
 *   - Bx and flux are even in r and Br is odd, so only rows with r >= 0 are
 *     computed and the rest are mirrored.
 *   - The coils are identical and sit exactly SHIFT grid columns apart, so one
 *     coil's field on a grid SHIFT columns wider serves both.
 * Together that is about a third of the direct computation.
 *
 * Works in the browser (window.CoilFieldModel) and in Node (module.exports)
 * so tools/test_field_model.cjs can check it.
 */
(function (root) {
  'use strict';

  const COILS = [315, 565];     // coil centres on the x axis
  const RADIUS = 36;
  const HALF_LENGTH = 36;
  const NX = 181;
  const NY = 81;
  const WIDTH = 900;
  const HEIGHT = 340;
  const DX = WIDTH / (NX - 1);  // 5
  const DY = HEIGHT / (NY - 1); // 4.25
  const TURNS = 10;
  const SAMPLES = 40;           // quadrature points around each turn

  const SHIFT = Math.round((COILS[1] - COILS[0]) / DX); // 50 columns between the coils
  const WIDE = NX + SHIFT;                              // columns in the one-coil grid
  const MID = (NY - 1) / 2;                             // the row on the axis, r = 0

  const angular = Array.from({ length: SAMPLES }, (_, i) => {
    const angle = ((i + 0.5) * Math.PI * 2) / SAMPLES;
    return [Math.cos(angle), Math.sin(angle)];
  });
  const turns = Array.from({ length: TURNS }, (_, i) => -HALF_LENGTH + (2 * HALF_LENGTH * i) / (TURNS - 1));

  /* [Bx, Br, r·Aφ] at (x, r) from one coil centred at `center`. The +1.5 keeps
     the integrand finite on the windings themselves. */
  function rawField(x, r, center) {
    let bx = 0;
    let br = 0;
    let flux = 0;
    for (const turn of turns) {
      const axial = x - center - turn;
      for (const [cos, sin] of angular) {
        const radial = r - RADIUS * cos;
        const d2 = axial * axial + radial * radial + RADIUS * RADIUS * sin * sin + 1.5;
        const inv = 1 / Math.sqrt(d2);
        const inv3 = inv / d2;
        bx += (RADIUS * RADIUS - RADIUS * r * cos) * inv3;
        br += RADIUS * cos * axial * inv3;
        flux += r * RADIUS * cos * inv;
      }
    }
    return [bx, br, flux];
  }
  const NORMALIZATION = rawField(COILS[0], 0, COILS[0])[0];

  /* One coil's field on a grid SHIFT columns wider than the picture, filled a
     row at a time from the axis outward. Yields after each row so callers can
     spread the work across frames. */
  function* fillUnitRows(unit) {
    for (let row = MID; row < NY; row += 1) {
      const r = row * DY - HEIGHT / 2;
      for (let col = 0; col < WIDE; col += 1) {
        const [bx, br, flux] = rawField((col - SHIFT) * DX, r, COILS[0]);
        const i = row * WIDE + col;
        unit.bx[i] = bx / NORMALIZATION;
        unit.br[i] = br / NORMALIZATION;
        unit.flux[i] = flux / NORMALIZATION;
      }
      yield row;
    }
  }

  /* Mirror the computed half, then cut both coils' fields out of the wide grid:
     coil 0 starts SHIFT columns in, coil 1 at column 0. */
  function assemble(unit) {
    for (let row = 0; row < MID; row += 1) {
      const src = (NY - 1 - row) * WIDE;
      const dst = row * WIDE;
      for (let col = 0; col < WIDE; col += 1) {
        unit.bx[dst + col] = unit.bx[src + col];
        unit.br[dst + col] = -unit.br[src + col];
        unit.flux[dst + col] = unit.flux[src + col];
      }
    }
    return [SHIFT, 0].map(offset => {
      const field = { bx: new Float32Array(NX * NY), br: new Float32Array(NX * NY), flux: new Float32Array(NX * NY) };
      for (let row = 0; row < NY; row += 1) {
        const from = row * WIDE + offset;
        for (const key of ['bx', 'br', 'flux']) field[key].set(unit[key].subarray(from, from + NX), row * NX);
      }
      return field;
    });
  }

  const newUnit = () => ({
    bx: new Float32Array(WIDE * NY),
    br: new Float32Array(WIDE * NY),
    flux: new Float32Array(WIDE * NY),
  });

  /* Both coils' fields, [coil0, coil1], each {bx, br, flux} on the NX x NY grid. */
  function buildField() {
    const unit = newUnit();
    const rows = fillUnitRows(unit);
    while (!rows.next().done);
    return assemble(unit);
  }

  /* The same result, built in slices of about `budgetMs` so the main thread
     stays free for input and scrolling while the page loads. */
  async function buildFieldAsync(budgetMs = 8) {
    const unit = newUnit();
    const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const yieldToMain = () =>
      root.scheduler?.yield ? root.scheduler.yield() : new Promise(resolve => setTimeout(resolve, 0));
    let deadline = now() + budgetMs;
    for (const _row of fillUnitRows(unit)) {
      if (now() > deadline) {
        await yieldToMain();
        deadline = now() + budgetMs;
      }
    }
    return assemble(unit);
  }

  /* Bilinear interpolation of a grid value at picture coordinates (x, y),
     with y measured from the axis. */
  function sample(grid, x, y) {
    const gx = Math.max(0, Math.min(NX - 1.001, x / DX));
    const gy = Math.max(0, Math.min(NY - 1.001, (y + HEIGHT / 2) / DY));
    const col = Math.floor(gx);
    const row = Math.floor(gy);
    const u = gx - col;
    const v = gy - row;
    const i = row * NX + col;
    return (grid[i] * (1 - u) + grid[i + 1] * u) * (1 - v) + (grid[i + NX] * (1 - u) + grid[i + NX + 1] * u) * v;
  }

  function axisField(x, center) {
    let value = 0;
    for (const t of turns) value += (SAMPLES * RADIUS * RADIUS) / Math.pow(RADIUS * RADIUS + (x - center - t) ** 2 + 1.5, 1.5);
    return value / NORMALIZATION;
  }

  /* Illustrative motion: force proportional to the gradient of B². Each coil's
     current is gated off before the projectile reaches its centre, which is
     what avoids suck-back. The coupling constant and units are arbitrary. */
  function trajectory() {
    const dt = 1 / 240;
    const frames = [];
    let x = 195;
    let v = 32;
    const currents = [1, 0];
    for (let step = 0; step < 240 * 14 && x < 850; step += 1) {
      let a = 0;
      COILS.forEach((center, i) => {
        const target = x > center - 155 && x < center - 17 ? 1 : 0;
        currents[i] += (target - currents[i]) * (1 - Math.exp(-dt / (target ? 0.08 : 0.025)));
        const gradient = (axisField(x + 1, center) ** 2 - axisField(x - 1, center) ** 2) / 2;
        a += 24500 * currents[i] ** 2 * gradient;
      });
      v = Math.max(0, v + a * dt);
      x += v * dt;
      frames.push({ time: step * dt, x, v, a, currents: [...currents] });
    }
    // Coast out of frame and hold, so the widening strobe spacing is readable.
    const end = frames[frames.length - 1];
    for (let i = 1; i <= 120; i += 1) {
      frames.push({ time: end.time + i * dt, x: end.x + end.v * i * dt, v: end.v, a: 0, currents: [0, 0] });
    }
    return frames;
  }

  /* Marching squares, with an asymptotic-centre decision for saddle cells.
     Calls emit(x1, y1, x2, y2) for every segment of the `level` contour, and
     allocates nothing per cell. Without `emit`, returns [[x, y], [x, y]] pairs. */
  function contours(values, level, emit) {
    const segments = emit ? null : [];
    const out = emit || ((x1, y1, x2, y2) => segments.push([[x1, y1], [x2, y2]]));
    const px = new Float64Array(4);
    const py = new Float64Array(4);
    for (let row = 0; row < NY - 1; row += 1) {
      const y0 = row * DY;
      const y1 = y0 + DY;
      for (let col = 0; col < NX - 1; col += 1) {
        const i = row * NX + col;
        // corners clockwise from top-left, and the edges between them
        const v0 = values[i];
        const v1 = values[i + 1];
        const v2 = values[i + NX + 1];
        const v3 = values[i + NX];
        const x0 = col * DX;
        const x1 = x0 + DX;
        let n = 0;
        if ((v0 >= level) !== (v1 >= level)) { const t = (level - v0) / (v1 - v0); px[n] = x0 + t * DX; py[n] = y0; n += 1; }
        if ((v1 >= level) !== (v2 >= level)) { const t = (level - v1) / (v2 - v1); px[n] = x1; py[n] = y0 + t * DY; n += 1; }
        if ((v2 >= level) !== (v3 >= level)) { const t = (level - v2) / (v3 - v2); px[n] = x1 - t * DX; py[n] = y1; n += 1; }
        if ((v3 >= level) !== (v0 >= level)) { const t = (level - v3) / (v0 - v3); px[n] = x0; py[n] = y1 - t * DY; n += 1; }
        if (n === 2) {
          out(px[0], py[0], px[1], py[1]);
        } else if (n === 4) {
          const centre = (v0 + v1 + v2 + v3) / 4;
          if ((centre >= level) === (v0 >= level)) {
            out(px[0], py[0], px[1], py[1]);
            out(px[2], py[2], px[3], py[3]);
          } else {
            out(px[0], py[0], px[3], py[3]);
            out(px[1], py[1], px[2], py[2]);
          }
        }
      }
    }
    return segments;
  }

  const api = {
    COILS, RADIUS, HALF_LENGTH, NX, NY, WIDTH, HEIGHT, DX, DY, NORMALIZATION,
    rawField, buildField, buildFieldAsync, sample, axisField, trajectory, contours,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoilFieldModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
