/* The home page's coil instrument: draws js/coil-field-model.js on a canvas.
 *
 * - The field grid is built in small slices once the page is idle, so it never
 *   blocks loading or scrolling. Until then the stage shows the coils alone.
 * - Playback only starts from the button. It pauses off-screen and in
 *   background tabs, and switching the loop off lets the current run finish.
 * - A run passes through about 30 distinct coil-current settings. Each one's
 *   heat map and contour paths are cached, so only the first loop does the
 *   maths; later loops just draw.
 */
(() => {
  'use strict';
  const model = window.CoilFieldModel;
  const canvas = document.getElementById('coil-stage');
  const button = document.querySelector('[data-coil-toggle]');
  if (!model || !canvas || !button) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const leds = [...document.querySelectorAll('[data-coil-led]')];
  const clock = document.querySelector('[data-coil-clock]');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  const VIEW_W = model.WIDTH;   // drawing units; the canvas is scaled to fit
  const VIEW_H = model.HEIGHT;
  const AXIS_Y = VIEW_H / 2;
  const LEVELS = [5, 12, 23, 39, 62, 92, 130, 178, 237, 310, 397, 500, 620];
  const PLAYBACK = 0.7;         // model time per real second
  const MAX_STEP = 0.05;        // clamp after a hitch so the projectile never jumps
  const LIVE = 0.08;            // a coil counts as energised above this current

  // The instrument panel is dark in both site themes, so its colors are fixed.
  const COLOR = {
    field: [[34, 52, 44], [47, 84, 60], [74, 122, 70], [122, 170, 64], [180, 222, 48], [201, 243, 29], [236, 255, 170]],
    axis: '#5e6459',
    barrel: 'rgba(196, 200, 191, 0.5)',
    housing: '#131513',
    coil: { idle: '#5e6459', live: '#ff6a2b' },
    winding: { idle: '#6d7468', live: '#ffb38a' },
    label: { idle: '#9aa095', live: '#ff8551' },
    strobe: '#ecede6',
    projectile: ['#f4f5ee', '#b9bfb1', '#e9ecdf'],
    arrow: '#c9f31d',
  };
  const rgb = c => `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
  const clamp = (x, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, x));
  const colorIndex = strength => Math.floor(clamp(Math.log1p(strength * 7) / Math.log(15)) * 6);

  const states = model.trajectory();
  const duration = states.at(-1).time;
  const topSpeed = states.at(-1).v;
  const stateAt = t => states[Math.min(states.length - 1, Math.max(0, Math.round(t * 240)))];

  // Offscreen layers: the heat map at grid resolution, and the whole field picture.
  const heat = document.createElement('canvas');
  heat.width = model.NX;
  heat.height = model.NY;
  const heatCtx = heat.getContext('2d');
  const surface = document.createElement('canvas');
  surface.width = VIEW_W;
  surface.height = VIEW_H;
  const surfaceCtx = surface.getContext('2d');

  let fields = null;            // [coil 0, coil 1], once built
  const pictures = new Map();   // rounded currents -> { image, paths }
  let paintedKey = '';
  let time = 0;
  let frame = 0;
  let last = null;
  let playing = false;
  let looping = false;
  let inView = true;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;
  let dpr = 1;

  /* --- the field picture for one pair of coil currents ------------------------ */
  function picture(amps) {
    const key = amps.join(',');
    let entry = pictures.get(key);
    if (entry) return [key, entry];

    const [a, b] = fields;
    const cells = model.NX * model.NY;
    const flux = new Float32Array(cells);
    const bx = new Float32Array(cells);
    const br = new Float32Array(cells);
    const image = new ImageData(model.NX, model.NY);
    for (let i = 0; i < cells; i += 1) {
      flux[i] = a.flux[i] * amps[0] + b.flux[i] * amps[1];
      bx[i] = a.bx[i] * amps[0] + b.bx[i] * amps[1];
      br[i] = a.br[i] * amps[0] + b.br[i] * amps[1];
      const strength = Math.hypot(bx[i], br[i]);
      const color = COLOR.field[colorIndex(strength)];
      const p = i * 4;
      image.data[p] = color[0];
      image.data[p + 1] = color[1];
      image.data[p + 2] = color[2];
      image.data[p + 3] = Math.round(clamp(Math.log1p(strength * 12) / Math.log(25)) * 0.62 * 255);
    }

    // Flux contours stay fixed in space; the current only changes their extent.
    // Each segment is colored by the field strength at its midpoint.
    const paths = COLOR.field.map(() => new Path2D());
    for (const level of LEVELS) {
      model.contours(flux, level, (x1, y1, x2, y2) => {
        const mx = (x1 + x2) / 2;
        const my = (y1 + y2) / 2 - VIEW_H / 2;
        const strength = Math.hypot(model.sample(bx, mx, my), model.sample(br, mx, my));
        const path = paths[colorIndex(strength)];
        path.moveTo(x1, y1);
        path.lineTo(x2, y2);
      });
    }

    entry = { image, paths };
    pictures.set(key, entry);
    return [key, entry];
  }

  function paintField(currents) {
    const [key, entry] = picture(currents.map(v => Math.round(v * 20) / 20));
    if (key === paintedKey) return;
    paintedKey = key;
    heatCtx.putImageData(entry.image, 0, 0);
    surfaceCtx.clearRect(0, 0, VIEW_W, VIEW_H);
    surfaceCtx.imageSmoothingEnabled = true;
    surfaceCtx.drawImage(heat, 0, 0, VIEW_W, VIEW_H);
    surfaceCtx.lineWidth = 1.15;
    surfaceCtx.globalAlpha = 0.86;
    entry.paths.forEach((path, i) => {
      surfaceCtx.strokeStyle = rgb(COLOR.field[i]);
      surfaceCtx.stroke(path);
    });
    surfaceCtx.globalAlpha = 1;
  }

  /* --- foreground -------------------------------------------------------------- */
  function line(x1, y1, x2, y2, color, width = 1) {
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
  }

  function drawCoils(currents) {
    ctx.font = '500 13px "Martian Mono", ui-monospace, monospace';
    ctx.textAlign = 'center';
    model.COILS.forEach((cx, i) => {
      const state = currents[i] > LIVE ? 'live' : 'idle';
      ctx.fillStyle = COLOR.label[state];
      ctx.fillText(`0${i + 1}`, cx, 64);

      // Winding cross-sections: current comes out of the page on top (dots)
      // and goes into it underneath (crosses).
      for (const side of [-1, 1]) {
        const y = AXIS_Y + side * model.RADIUS;
        ctx.fillStyle = COLOR.housing;
        ctx.fillRect(cx - 43, y - 9, 86, 18);
        ctx.lineWidth = 1;
        ctx.strokeStyle = COLOR.coil[state];
        ctx.strokeRect(cx - 43, y - 9, 86, 18);

        const turns = new Path2D();
        const marks = new Path2D();
        for (let n = 0; n < 10; n += 1) {
          const x = cx - 36 + n * 8;
          turns.moveTo(x + 3, y);
          turns.arc(x, y, 3, 0, Math.PI * 2);
          if (side < 0) {
            marks.rect(x - 0.7, y - 0.7, 1.4, 1.4);
          } else {
            marks.moveTo(x - 1.5, y - 1.5);
            marks.lineTo(x + 1.5, y + 1.5);
            marks.moveTo(x - 1.5, y + 1.5);
            marks.lineTo(x + 1.5, y - 1.5);
          }
        }
        ctx.strokeStyle = COLOR.winding[state];
        ctx.stroke(turns);
        if (side < 0) {
          ctx.fillStyle = COLOR.winding[state];
          ctx.fill(marks);
        } else {
          ctx.stroke(marks);
        }
      }
    });
  }

  // Equal-time strobe marks spread apart as the projectile speeds up.
  function drawStrobes() {
    ctx.fillStyle = COLOR.strobe;
    for (let t = 0.15; t < time; t += 0.15) {
      const past = stateAt(t);
      if (past.x > 845) break;
      ctx.globalAlpha = 0.2 + clamp(t / duration) * 0.18;
      ctx.fillRect(past.x - 1, AXIS_Y - 4, 2, 8);
    }
    ctx.globalAlpha = 1;
  }

  function drawProjectile(state) {
    if (state.x >= 875) return;
    const shade = ctx.createLinearGradient(0, AXIS_Y - 7, 0, AXIS_Y + 7);
    COLOR.projectile.forEach((color, i) => shade.addColorStop(i / 2, color));
    ctx.fillStyle = shade;
    ctx.fillRect(state.x - 18, AXIS_Y - 7, 36, 14);

    // Velocity arrow, growing with speed.
    const x = state.x;
    const y = AXIS_Y - 27;
    const length = 18 + (110 * state.v) / topSpeed;
    ctx.beginPath();
    ctx.strokeStyle = COLOR.arrow;
    ctx.lineWidth = 1.5;
    ctx.moveTo(x, y);
    ctx.lineTo(x + length, y);
    ctx.moveTo(x + length - 5, y - 3);
    ctx.lineTo(x + length, y);
    ctx.lineTo(x + length - 5, y + 3);
    ctx.stroke();
  }

  function updateReadouts(state) {
    leds.forEach((led, i) => led.classList.toggle('is-on', state.currents[i] > LIVE));
    if (clock) clock.textContent = `t = ${time.toFixed(2)}`;
  }

  function draw() {
    const state = stateAt(time);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * offsetX, dpr * offsetY);

    if (fields) {
      paintField(state.currents);
      ctx.drawImage(surface, 0, 0);
    }
    ctx.setLineDash([5, 5]);
    line(20, AXIS_Y, VIEW_W - 20, AXIS_Y, COLOR.axis, 0.8);
    ctx.setLineDash([]);
    drawCoils(state.currents);
    line(120, AXIS_Y - 13, 825, AXIS_Y - 13, COLOR.barrel);
    line(120, AXIS_Y + 13, 825, AXIS_Y + 13, COLOR.barrel);
    drawStrobes();
    drawProjectile(state);
    updateReadouts(state);
  }

  /* --- playback ------------------------------------------------------------------ */
  function schedule() {
    if (!frame && playing && inView && !document.hidden) frame = requestAnimationFrame(tick);
  }

  function tick(now) {
    frame = 0;
    if (last !== null) time = Math.min(duration, time + Math.min((now - last) / 1000, MAX_STEP) * PLAYBACK);
    last = now;
    draw();
    if (time >= duration) {
      if (looping) time = 0;
      else { playing = false; last = null; }
    }
    schedule();
  }

  // The only playback control: pressed means "keep looping". Releasing it
  // never stops the projectile mid-flight; the current run finishes first.
  button.addEventListener('click', () => {
    looping = !looping;
    if (looping && !playing) {
      time = 0;
      playing = true;
      last = null;
    }
    button.setAttribute('aria-pressed', String(looping));
    schedule();
  });

  // A newly requested reduced-motion preference ends the loop after this run.
  reduced.addEventListener('change', () => {
    if (!reduced.matches) return;
    looping = false;
    button.setAttribute('aria-pressed', 'false');
  });

  document.addEventListener('visibilitychange', () => {
    last = null;
    if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
    else schedule();
  });

  if ('IntersectionObserver' in window) {
    new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      last = null;
      if (inView) schedule();
      else { cancelAnimationFrame(frame); frame = 0; }
    }, { threshold: 0.15 }).observe(canvas);
  }

  /* --- sizing ----------------------------------------------------------------------- */
  function resize() {
    const box = canvas.parentElement.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(box.width * dpr);
    canvas.height = Math.round(box.height * dpr);
    scale = Math.min(box.width / VIEW_W, box.height / VIEW_H);
    offsetX = (box.width - VIEW_W * scale) / 2;
    offsetY = (box.height - VIEW_H * scale) / 2;
    draw();
  }
  if ('ResizeObserver' in window) new ResizeObserver(resize).observe(canvas.parentElement);
  else addEventListener('resize', resize, { passive: true });
  resize();
  document.fonts?.ready.then(draw); // the coil labels use the web font

  /* --- build the field without blocking the page ------------------------------------ */
  const build = () => model.buildFieldAsync().then(result => {
    fields = result;
    draw();
  });
  if ('requestIdleCallback' in window) requestIdleCallback(build, { timeout: 1500 });
  else setTimeout(build, 200);
})();
