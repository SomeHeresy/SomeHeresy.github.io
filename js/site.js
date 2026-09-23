/* Progressive enhancement shared by every page. Each block looks for its own
 * markup first, so pages without that feature pay nothing for it. Everything
 * here is optional: with JavaScript off, the content is all still there. */
(() => {
  'use strict';
  const root = document.documentElement;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const hasObserver = 'IntersectionObserver' in window;

  /* --- footer year ----------------------------------------------------------- */
  document.querySelectorAll('[data-year]').forEach(el => {
    el.textContent = String(new Date().getFullYear());
  });

  /* --- theme toggle -----------------------------------------------------------
     head.js already applied the saved or system theme; this only handles the
     button and keeps the browser's UI color in step. */
  const toggle = document.querySelector('[data-theme-toggle]');
  const themeColor = { light: '#f1f0ea', dark: '#0b0c0b' };
  const themeMetas = document.querySelectorAll('meta[name="theme-color"]');

  function syncTheme() {
    const theme = root.dataset.theme === 'dark' ? 'dark' : 'light';
    toggle?.setAttribute('aria-label', `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`);
    themeMetas.forEach(meta => meta.setAttribute('content', themeColor[theme]));
  }

  toggle?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    const apply = () => {
      root.dataset.theme = next;
      try { localStorage.setItem('theme', next); } catch { /* private mode: keep it for this page */ }
    };
    // Cross-fade the whole page where the browser supports it.
    if (document.startViewTransition && !reduced.matches) document.startViewTransition(apply);
    else apply();
  });
  new MutationObserver(syncTheme).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  syncTheme();

  /* --- mobile menu ------------------------------------------------------------ */
  const header = document.querySelector('.site-header');
  const menuButton = document.querySelector('[data-menu-toggle]');
  if (header && menuButton) {
    const label = menuButton.querySelector('[data-menu-label]');
    const setMenu = open => {
      header.classList.toggle('is-open', open);
      menuButton.setAttribute('aria-expanded', String(open));
      if (label) label.textContent = open ? 'Close' : 'Menu';
    };
    menuButton.addEventListener('click', () => setMenu(!header.classList.contains('is-open')));
    header.querySelectorAll('.nav__link').forEach(link => link.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && header.classList.contains('is-open')) {
        setMenu(false);
        menuButton.focus();
      }
    });
    matchMedia('(min-width: 761px)').addEventListener('change', event => {
      if (event.matches) setMenu(false);
    });
  }

  /* --- scroll progress ----------------------------------------------------------
     CSS drives the bar with a scroll timeline where supported. Elsewhere this
     sets one scaleX variable on the bar itself, once per frame: a transform on
     a single element, so scrolling never restyles the rest of the page. */
  const bar = document.querySelector('.progress');
  if (bar && !CSS.supports('animation-timeline: scroll()')) {
    let queued = false;
    const update = () => {
      queued = false;
      const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
      bar.style.setProperty('--p', Math.min(1, scrollY / max).toFixed(4));
    };
    addEventListener('scroll', () => {
      if (!queued) { queued = true; requestAnimationFrame(update); }
    }, { passive: true });
    update();
  }

  /* --- current section: nav links on the home page, contents on case studies --- */
  const sections = new Map(); // section element -> links pointing at it
  document.querySelectorAll('.nav__link, .cs-toc a').forEach(link => {
    if (link.pathname !== location.pathname || !link.hash) return;
    const target = document.getElementById(decodeURIComponent(link.hash.slice(1)));
    if (!target) return;
    if (!sections.has(target)) sections.set(target, []);
    sections.get(target).push(link);
  });
  if (sections.size && hasObserver) {
    const visible = new Set();
    const ordered = [...sections.keys()].sort((a, b) =>
      a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
    const mark = () => {
      const current = ordered.filter(section => visible.has(section)).pop();
      sections.forEach((links, section) => links.forEach(link => {
        if (section === current) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }));
    };
    // A thin band 35-40% down the viewport decides which section is "current".
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => (entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target)));
      mark();
    }, { rootMargin: '-35% 0px -60% 0px' });
    ordered.forEach(section => observer.observe(section));
  }

  /* --- reveal on scroll ------------------------------------------------------------
     CSS only hides .reveal elements while html.js is set and motion is welcome;
     this adds .is-in as each one enters the viewport. */
  const reveals = [...document.querySelectorAll('.reveal')];
  const show = el => el.classList.add('is-in');
  if (reduced.matches || !hasObserver) {
    reveals.forEach(show);
  } else if (reveals.length) {
    reveals.forEach(el => {
      const siblings = [...el.parentElement.children].filter(child => child.classList.contains('reveal'));
      const index = siblings.indexOf(el);
      if (index > 0) el.style.setProperty('--delay', `${Math.min(index, 3) * 80}ms`);
    });
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      show(entry.target);
      observer.unobserve(entry.target);
    }), { rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(el => observer.observe(el));
  }
  // Never leave focused or printed content hidden.
  document.addEventListener('focusin', event => event.target.closest?.('.reveal') && show(event.target.closest('.reveal')));
  addEventListener('beforeprint', () => reveals.forEach(show));

  /* --- decoding labels ---------------------------------------------------------------
     Short mono labels resolve from random glyphs the first time they appear.
     Screen readers get the real text from a hidden copy; the animated copy is
     aria-hidden, so nothing ever reads the noise. */
  const scrambles = document.querySelectorAll('[data-scramble]');
  if (scrambles.length && !reduced.matches && hasObserver) {
    const GLYPHS = '#%&*+=<>/\\|01';
    const decode = (face, text) => {
      const start = performance.now();
      const step = now => {
        const t = Math.min(1, (now - start) / 560);
        const settled = Math.floor(t * text.length);
        let out = '';
        for (let i = 0; i < text.length; i += 1) {
          out += i < settled || text[i] === ' ' ? text[i] : GLYPHS[(Math.random() * GLYPHS.length) | 0];
        }
        face.textContent = out;
        if (t < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    };
    const observer = new IntersectionObserver(entries => entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      observer.unobserve(entry.target);
      decode(entry.target.querySelector('.scramble__face'), entry.target.dataset.scrambleText);
    }), { rootMargin: '0px 0px -10% 0px' });
    scrambles.forEach(el => {
      const text = el.textContent;
      const hidden = document.createElement('span');
      const face = document.createElement('span');
      hidden.className = 'sr-only';
      hidden.textContent = text;
      face.className = 'scramble__face';
      face.setAttribute('aria-hidden', 'true');
      face.textContent = text;
      el.dataset.scrambleText = text;
      el.replaceChildren(hidden, face);
      observer.observe(el);
    });
  }

  /* --- YouTube: thumbnail first, player on click ---------------------------------------
     Each video ships as a thumbnail button; the player iframe is only created
     when someone asks to watch, so ten videos cost ten small images at load.
     The embed uses www.youtube.com and the default referrer on purpose:
     overriding either makes YouTube refuse the embed with "Error 153", and so
     does opening the page over file://. */
  document.querySelectorAll('[data-yt]').forEach(video => {
    const button = video.querySelector('.video__play');
    button?.addEventListener('click', () => {
      const iframe = document.createElement('iframe');
      iframe.src = `https://www.youtube.com/embed/${encodeURIComponent(video.dataset.yt)}?autoplay=1&playsinline=1&rel=0`;
      iframe.title = video.querySelector('.video__title')?.textContent.trim() || 'Project video';
      iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';
      iframe.allowFullscreen = true;
      button.replaceWith(iframe);
      iframe.focus(); // keyboard users land on the player instead of <body>
    });
  });

  /* --- wiring schematic -------------------------------------------------------------------
     Pointing at a part (or focusing it) lights every wire, node and label on
     the nets it sits on. Clicking, tapping or pressing Enter pins it, which is
     what makes the diagram usable on touch screens. Nets are declared in the
     markup with data-net, so the SVG stays the single source of truth. */
  document.querySelectorAll('.circuit').forEach(svg => {
    const parts = [...svg.querySelectorAll('.part')];
    if (!parts.length) return;
    let pinned = null;

    const clear = () => {
      svg.removeAttribute('data-focus');
      svg.querySelectorAll('.is-lit').forEach(el => el.classList.remove('is-lit'));
    };
    const light = part => {
      clear();
      svg.setAttribute('data-focus', '');
      part.classList.add('is-lit');
      (part.dataset.net || '').split(/\s+/).filter(Boolean).forEach(net => {
        svg.querySelectorAll(`[data-net~="${net}"]`).forEach(el => el.classList.add('is-lit'));
      });
    };
    const settle = () => (pinned ? light(pinned) : clear());
    const pin = part => {
      pinned = pinned === part ? null : part;
      parts.forEach(p => p.setAttribute('aria-pressed', String(p === pinned)));
      settle();
    };

    parts.forEach(part => {
      part.addEventListener('pointerenter', event => { if (event.pointerType === 'mouse') light(part); });
      part.addEventListener('pointerleave', event => { if (event.pointerType === 'mouse') settle(); });
      part.addEventListener('focus', () => light(part));
      part.addEventListener('blur', settle);
      part.addEventListener('click', () => pin(part));
      part.addEventListener('keydown', event => {
        if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); pin(part); }
        if (event.key === 'Escape' && pinned) { pin(pinned); }
      });
    });
  });
})();
