(() => {
  const root = document.documentElement;
  const body = document.body;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const menu = document.querySelector('.menu-button');
  const navLinks = [...document.querySelectorAll('.nav-links a[href^="#"]')];

  document.querySelectorAll('[data-year]').forEach(el => { el.textContent = new Date().getFullYear(); });

  function setMenu(open) {
    if (!menu) return;
    body.classList.toggle('menu-open', open);
    menu.setAttribute('aria-expanded', String(open));
    menu.textContent = open ? 'Close' : 'Menu';
  }
  if (menu) {
    menu.addEventListener('click', () => setMenu(!body.classList.contains('menu-open')));
    navLinks.forEach(link => link.addEventListener('click', () => setMenu(false)));
  }

  const revealItems = [...document.querySelectorAll('.reveal')];
  if ('IntersectionObserver' in window && !reducedMotion.matches) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: .08, rootMargin: '0px 0px -5% 0px' });
    revealItems.forEach(item => observer.observe(item));
  } else {
    revealItems.forEach(item => item.classList.add('visible'));
  }

  const trackedSections = [...document.querySelectorAll('main section[id], footer[id]')];
  function updateScrollState() {
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    root.style.setProperty('--progress', `${(scrollY / max * 100).toFixed(2)}%`);
    let current = '';
    trackedSections.forEach(section => {
      if (section.getBoundingClientRect().top <= innerHeight * .38) current = section.id;
    });
    navLinks.forEach(link => link.classList.toggle('active', link.getAttribute('href') === `#${current}`));
  }
  updateScrollState();
  addEventListener('scroll', updateScrollState, { passive: true });

  const canvas = document.getElementById('magnetic-field');
  if (!canvas) return;

  const ctx = canvas.getContext('2d', { alpha: true });
  const stage = canvas.parentElement;
  const status = document.querySelector('[data-field-status]');
  const palette = ['#edae61', '#72b6ef', '#bdc7ff', '#75d3a7', '#d57ad8'];
  const bases = [.12, .31, .5, .69, .88];
  const nodes = bases.map((x, index) => ({ x, y: .52, baseX: x, baseY: .52, phase: index * 1.17, polarity: index % 2 ? -1 : 1, color: palette[index] }));
  const pointer = { x: 0, y: 0, inside: false };
  let width = 0, height = 0, dpr = 1, hover = -1, energy = 0, frame = 0, visible = true;

  function resizeField() {
    const rect = stage.getBoundingClientRect();
    width = Math.max(1, rect.width);
    height = Math.max(1, rect.height);
    dpr = Math.min(devicePixelRatio || 1, 1.6);
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawField(performance.now());
  }

  function nodePixels(node) { return { x: node.x * width, y: node.y * height }; }
  function nearestNode(x, y) {
    let found = -1, best = 42 * 42;
    nodes.forEach((node, index) => {
      const p = nodePixels(node), dx = x - p.x, dy = y - p.y, d = dx * dx + dy * dy;
      if (d < best) { best = d; found = index; }
    });
    return found;
  }
  function pointerPosition(event) {
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function vectorAt(x, y) {
    let bx = 0, by = 0;
    for (const node of nodes) {
      const p = nodePixels(node), dx = x - p.x, dy = y - p.y;
      const r2 = Math.max(300, dx * dx + dy * dy), r = Math.sqrt(r2);
      const inv3 = 1 / (r2 * r), inv5 = inv3 / r2;
      const m = node.polarity * 720000;
      bx += m * 3 * dx * dy * inv5;
      by += m * (3 * dy * dy * inv5 - inv3);
    }
    if (pointer.inside) {
      const dx = x - pointer.x, dy = y - pointer.y, r2 = Math.max(900, dx * dx + dy * dy);
      bx += -dy * (30 + energy * 34) / r2;
      by += dx * (30 + energy * 34) / r2;
    }
    return { x: bx, y: by };
  }

  function colorWithAlpha(hex, alpha) {
    const value = hex.replace('#', '');
    const r = parseInt(value.slice(0, 2), 16), g = parseInt(value.slice(2, 4), 16), b = parseInt(value.slice(4, 6), 16);
    return `rgba(${r},${g},${b},${alpha})`;
  }

  function drawTraces(time) {
    ctx.save();
    ctx.lineWidth = .85;
    ctx.setLineDash([2.5, 4.5]);
    ctx.lineDashOffset = reducedMotion.matches ? 0 : -time * .008;
    nodes.forEach((node, index) => {
      const p = nodePixels(node);
      for (let seed = 0; seed < 12; seed++) {
        const angle = seed / 12 * Math.PI * 2;
        const radius = 23 + (seed % 3) * 4;
        let x = p.x + Math.cos(angle) * radius;
        let y = p.y + Math.sin(angle) * radius;
        ctx.beginPath();
        ctx.moveTo(x, y);
        for (let step = 0; step < 76; step++) {
          const v = vectorAt(x, y), length = Math.hypot(v.x, v.y);
          if (!Number.isFinite(length) || length < .00001) break;
          const direction = node.polarity > 0 ? 1 : -1;
          x += direction * v.x / length * 5.2;
          y += direction * v.y / length * 5.2;
          if (x < -12 || x > width + 12 || y < -12 || y > height + 12) break;
          ctx.lineTo(x, y);
        }
        ctx.strokeStyle = colorWithAlpha(node.color, index === hover ? .42 : .17 + energy * .1);
        ctx.stroke();
      }
    });
    ctx.setLineDash([]);
    nodes.forEach((node, index) => {
      const p = nodePixels(node);
      const pullX = pointer.inside ? (pointer.x - p.x) * (.025 + energy * .035) : 0;
      const pullY = pointer.inside ? (pointer.y - p.y) * (.02 + energy * .026) : 0;
      for (let ring = 0; ring < 6; ring++) {
        const rx = 34 + ring * 17, ry = 19 + ring * 11;
        ctx.beginPath();
        ctx.moveTo(p.x - rx, p.y);
        ctx.bezierCurveTo(p.x - rx * .56 + pullX, p.y - ry * 1.35 + pullY, p.x + rx * .56 + pullX, p.y - ry * 1.35 + pullY, p.x + rx, p.y);
        ctx.bezierCurveTo(p.x + rx * .56 + pullX, p.y + ry * 1.35 + pullY, p.x - rx * .56 + pullX, p.y + ry * 1.35 + pullY, p.x - rx, p.y);
        ctx.strokeStyle = colorWithAlpha(node.color, index === hover ? .29 : .09 + energy * .06);
        ctx.stroke();
      }
    });
    const xs = nodes.map(node => node.x * width), ys = nodes.map(node => node.y * height);
    const centerX = xs.reduce((sum, value) => sum + value, 0) / xs.length;
    const centerY = ys.reduce((sum, value) => sum + value, 0) / ys.length;
    for (let ring = 0; ring < 5; ring++) {
      ctx.beginPath();
      const rotation = reducedMotion.matches ? 0 : Math.sin(time * .00035 + ring * .4) * .045 + (pointer.inside ? (pointer.x / width - .5) * .08 : 0);
      ctx.ellipse(centerX, centerY, width * (.34 + ring * .055), 58 + ring * 30, rotation, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(158,229,209,${.06 + energy * .055 - ring * .007})`;
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawNodes(time) {
    nodes.forEach((node, index) => {
      const p = nodePixels(node), active = index === hover;
      const pulse = reducedMotion.matches ? 0 : Math.sin(time * .002 + index) * 1.5;
      const radius = (active ? 23 : 18 + energy * 1.8) + pulse;
      const glow = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, radius * 2.6);
      glow.addColorStop(0, colorWithAlpha(node.color, active ? .48 : .2 + energy * .16));
      glow.addColorStop(1, colorWithAlpha(node.color, 0));
      ctx.fillStyle = glow;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius * 2.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = node.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(246,250,248,.65)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(p.x, p.y, radius + 5, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(5,9,10,.8)'; ctx.font = '700 8px "Cascadia Code", monospace'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(index + 1).padStart(2, '0'), p.x, p.y + .5);
    });
  }

  function drawField(time) {
    if (!width || !height) return;
    ctx.clearRect(0, 0, width, height);
    const wash = ctx.createRadialGradient(pointer.inside ? pointer.x : width * .5, pointer.inside ? pointer.y : height * .46, 0, width * .5, height * .5, Math.max(width, height) * .72);
    wash.addColorStop(0, `rgba(109,190,169,${.065 + energy * .09})`); wash.addColorStop(1, 'rgba(7,13,15,0)');
    ctx.fillStyle = wash; ctx.fillRect(0, 0, width, height);
    drawTraces(time); drawNodes(time);
  }

  function animate(time) {
    const targetEnergy = pointer.inside ? 1 : 0;
    energy += (targetEnergy - energy) * .065;
    if (!reducedMotion.matches) {
      nodes.forEach((node, index) => {
        const pointerX = pointer.inside ? (pointer.x / Math.max(1, width) - .5) * .007 * (index % 2 ? -1 : 1) : 0;
        const pointerY = pointer.inside ? (pointer.y / Math.max(1, height) - .5) * .012 : 0;
        node.x = node.baseX + Math.sin(time * .00038 + node.phase) * .004 + pointerX * energy;
        node.y = node.baseY + Math.cos(time * .00052 + node.phase) * .011 + pointerY * energy;
      });
    }
    if (visible) drawField(time);
    frame = requestAnimationFrame(animate);
  }

  canvas.addEventListener('pointermove', event => {
    const p = pointerPosition(event); pointer.x = p.x; pointer.y = p.y; pointer.inside = true;
    hover = nearestNode(p.x, p.y);
    status.textContent = hover >= 0 ? `SOURCE ${String(hover + 1).padStart(2, '0')} / COUPLED` : 'FIELD / ENERGIZED';
  }, { passive: true });
  canvas.addEventListener('pointerleave', () => { pointer.inside = false; hover = -1; status.textContent = 'AUTONOMOUS LOOP'; });
  document.addEventListener('visibilitychange', () => { visible = !document.hidden; });
  addEventListener('resize', resizeField, { passive: true });
  resizeField(); cancelAnimationFrame(frame); frame = requestAnimationFrame(animate);
})();

/* ==========================================================================
   Embedded video + wiring schematic
   Both are no-ops on pages that do not contain the markup, so this file stays
   shared across the home page and the three case studies.
   ========================================================================== */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  /* --- YouTube facade -----------------------------------------------------
     Each card shows the video thumbnail behind a play button; the iframe is
     built only when someone asks to watch, so six videos stay off the critical
     path while still playing here rather than sending people to YouTube.

     The embed deliberately mirrors the plain markup that already works
     elsewhere on this site: www.youtube.com (not youtube-nocookie.com), the
     same allow list, and no referrerPolicy override. Overriding either is what
     produces the player "Error 153" - YouTube rejects an embed whose referrer
     it cannot attribute to an allowed origin. The same error appears when the
     page is opened over file://, which has no origin to attribute at all. */
  document.querySelectorAll('.video-card').forEach(card => {
    const trigger = card.querySelector('.video-trigger');
    if (!trigger) return;

    trigger.addEventListener('click', () => {
      if (card.classList.contains('is-playing')) return;
      const id = card.dataset.yt;
      if (!id) return;

      const frame = card.querySelector('.video-frame');
      const iframe = document.createElement('iframe');
      iframe.src = 'https://www.youtube.com/embed/' + encodeURIComponent(id) + '?autoplay=1&playsinline=1&rel=0';
      iframe.title = card.querySelector('.video-meta strong')?.textContent || 'Project video';
      iframe.setAttribute('frameborder', '0');
      iframe.setAttribute('allow', 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture');
      iframe.setAttribute('allowfullscreen', '');

      frame.textContent = '';
      frame.appendChild(iframe);
      card.classList.add('is-playing');
      trigger.setAttribute('aria-label', 'Now playing');

      /* Escape hatch: if an extension, a strict network or the file:// scheme
         still blocks the player, one visible link beats a dead rectangle. */
      const cta = card.querySelector('.video-cta');
      if (cta) {
        const out = document.createElement('a');
        out.href = 'https://www.youtube.com/watch?v=' + encodeURIComponent(id);
        out.target = '_blank';
        out.rel = 'noopener noreferrer';
        out.className = 'video-cta video-out';
        out.textContent = 'Open on YouTube';
        cta.replaceWith(out);
      }
    });
  });

  /* --- wiring schematic ---------------------------------------------------
     Hovering a component lifts every wire, node and pin label on the nets that
     component sits on, and dims the rest. Nets are declared in the markup with
     data-net, so the wiring stays the single source of truth. */
  document.querySelectorAll('.circuit').forEach(svg => {
    const parts = [...svg.querySelectorAll('.part')];
    if (!parts.length) return;

    if (!reduced.matches) svg.classList.add('is-live');

    const netMembers = net => svg.querySelectorAll('[data-net~="' + net + '"]');

    function clear() {
      svg.removeAttribute('data-focus');
      svg.querySelectorAll('.is-lit').forEach(el => el.classList.remove('is-lit'));
    }

    function focus(part) {
      clear();
      svg.setAttribute('data-focus', '');
      part.classList.add('is-lit');
      (part.dataset.net || '').split(/\s+/).filter(Boolean).forEach(net => {
        netMembers(net).forEach(el => el.classList.add('is-lit'));
      });
    }

    parts.forEach(part => {
      part.addEventListener('pointerenter', () => focus(part));
      part.addEventListener('focus', () => focus(part));
      part.addEventListener('pointerleave', clear);
      part.addEventListener('blur', clear);
    });
    svg.addEventListener('pointerleave', clear);
  });
})();
