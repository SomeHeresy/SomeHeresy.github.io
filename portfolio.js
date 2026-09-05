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
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && body.classList.contains('menu-open')) { setMenu(false); menu.focus(); }
    });
    matchMedia('(min-width: 721px)').addEventListener('change', event => { if (event.matches) setMenu(false); });
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
      trigger.replaceWith(frame);
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
