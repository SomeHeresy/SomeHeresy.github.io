/* Axisymmetric, air-core field study. Length and current are dimensionless.
 * Biot–Savart quadrature over circular turns supplies Bx, Br and r*Aphi.
 * Contours of r*Aphi are magnetic flux lines, not decorative ellipses.
 * This deliberately excludes ferromagnetic saturation, eddy currents and the
 * measured hardware's circuit. It is not the Python project's simulator. */
(function (root) {
  'use strict';
  const COILS = [315, 565], RADIUS = 36, HALF_LENGTH = 36;
  const NX = 181, NY = 81, WIDTH = 900, HEIGHT = 340;
  const DX = WIDTH / (NX - 1), DY = HEIGHT / (NY - 1);
  const TURNS = 10, SAMPLES = 40;
  const angular = Array.from({ length: SAMPLES }, (_, i) => {
    const angle = (i + .5) * Math.PI * 2 / SAMPLES;
    return [Math.cos(angle), Math.sin(angle)];
  });
  const turns = Array.from({ length: TURNS }, (_, i) => -HALF_LENGTH + 2 * HALF_LENGTH * i / (TURNS - 1));

  function rawField(x, r, center) {
    let bx = 0, br = 0, flux = 0;
    for (const turn of turns) {
      const axial = x - center - turn;
      for (const [cos, sin] of angular) {
        const radial = r - RADIUS * cos;
        const d2 = axial * axial + radial * radial + RADIUS * RADIUS * sin * sin + 1.5;
        const inv = 1 / Math.sqrt(d2), inv3 = inv / d2;
        bx += (RADIUS * RADIUS - RADIUS * r * cos) * inv3;
        br += RADIUS * cos * axial * inv3;
        flux += r * RADIUS * cos * inv;
      }
    }
    return [bx, br, flux];
  }
  const NORMALIZATION = rawField(COILS[0], 0, COILS[0])[0];

  function buildField() {
    return COILS.map(center => {
      const bx = new Float32Array(NX * NY), br = new Float32Array(NX * NY), flux = new Float32Array(NX * NY);
      for (let row = 0; row < NY; row++) {
        const r = row * DY - HEIGHT / 2;
        for (let col = 0; col < NX; col++) {
          const i = row * NX + col;
          const field = rawField(col * DX, r, center);
          bx[i] = field[0] / NORMALIZATION;
          br[i] = field[1] / NORMALIZATION;
          flux[i] = field[2] / NORMALIZATION;
        }
      }
      return { bx, br, flux };
    });
  }

  function sample(grid, x, y) {
    const gx = Math.max(0, Math.min(NX - 1.001, x / DX));
    const gy = Math.max(0, Math.min(NY - 1.001, (y + HEIGHT / 2) / DY));
    const col = Math.floor(gx), row = Math.floor(gy), u = gx - col, v = gy - row, i = row * NX + col;
    return (grid[i] * (1-u) + grid[i+1] * u) * (1-v) + (grid[i+NX] * (1-u) + grid[i+NX+1] * u) * v;
  }

  function axisField(x, center) {
    let value = 0;
    for (const t of turns) value += SAMPLES * RADIUS * RADIUS / Math.pow(RADIUS * RADIUS + (x-center-t) ** 2 + 1.5, 1.5);
    return value / NORMALIZATION;
  }

  // Illustrative force law: F proportional to the gradient of B². Gate current
  // before each center to avoid pullback, integrate velocity then position.
  // The arbitrary coupling and dimensionless units do not predict hardware.
  function trajectory() {
    const dt = 1/240, frames = [];
    let x = 195, v = 32, currents = [1, 0];
    for (let step = 0; step < 240 * 14 && x < 850; step++) {
      let a = 0;
      COILS.forEach((center, i) => {
        const target = x > center-155 && x < center-17 ? 1 : 0;
        currents[i] += (target - currents[i]) * (1 - Math.exp(-dt / (target ? .08 : .025)));
        const gradient = (axisField(x+1, center)**2 - axisField(x-1, center)**2) / 2;
        a += 24500 * currents[i] ** 2 * gradient;
      });
      v = Math.max(0, v + a*dt); x += v*dt;
      frames.push({ time: step*dt, x, v, a, currents: [...currents] });
    }
    // Coast out of frame and hold so the widening strobe spacing is readable.
    const end = frames[frames.length-1];
    for (let i=1;i<=120;i++) frames.push({time:end.time+i*dt,x:end.x+end.v*i*dt,v:end.v,a:0,currents:[0,0]});
    return frames;
  }

  // Marching squares with an asymptotic-center decision for saddle cells.
  function contours(values, level) {
    const segments = [];
    for (let row=0;row<NY-1;row++) for (let col=0;col<NX-1;col++) {
      const i=row*NX+col, v=[values[i],values[i+1],values[i+NX+1],values[i+NX]];
      const corners=[[col*DX,row*DY],[(col+1)*DX,row*DY],[(col+1)*DX,(row+1)*DY],[col*DX,(row+1)*DY]];
      const edges=[];
      for(let e=0;e<4;e++) {
        const n=(e+1)%4;
        if((v[e]>=level)===(v[n]>=level)) continue;
        const t=(level-v[e])/(v[n]-v[e]);
        edges.push([corners[e][0]+t*(corners[n][0]-corners[e][0]),corners[e][1]+t*(corners[n][1]-corners[e][1])]);
      }
      if(edges.length===2) segments.push([edges[0],edges[1]]);
      else if(edges.length===4) {
        const center=(v[0]+v[1]+v[2]+v[3])/4;
        if((center>=level)===(v[0]>=level)) segments.push([edges[0],edges[1]],[edges[2],edges[3]]);
        else segments.push([edges[0],edges[3]],[edges[1],edges[2]]);
      }
    }
    return segments;
  }
  const api = { COILS, RADIUS, HALF_LENGTH, NX, NY, WIDTH, HEIGHT, DX, DY, buildField, rawField, NORMALIZATION, sample, axisField, trajectory, contours };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.CoilFieldModel = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
