/* Motion is progressive enhancement: content is visible if JS is unavailable.
 * No scroll hijacking; work runs only in response to actual interaction. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const fine = matchMedia('(hover: hover) and (pointer: fine)');
  const root = document.documentElement;
  const selector = [
    '.section-heading', '.experiment-image', '.experiment-copy',
    '.simulator-heading', '.simulator-layout > div', '.experiment-secondary',
    '.personal-label', '.personal-layout > h2', '.personal-copy > p',
    '.personal-interests', '.personal-bottom', '.experience-timeline > li',
    '.capability-row', '.resume-bar', '.resume-block', '.contact-inner > h2',
    '.contact-bottom', '.footer-line', '.detail-content > section > h2',
    '.detail-content > section > h3', '.detail-content > section > p',
    '.detail-content > section > ul', '.metric-grid', '.gallery > figure',
    '.video-card', '.version-head', '.next-project', '.detail-actions'
  ].join(',');
  const items = [...document.querySelectorAll(selector)];
  let observer;
  function setupReveals() {
    observer?.disconnect();
    if (reduced.matches || !('IntersectionObserver' in window)) {
      root.classList.remove('motion-ready');
      items.forEach(item => item.classList.add('in-view'));
      return;
    }
    items.forEach(item => {
      const rect = item.getBoundingClientRect();
      item.classList.add('motion-reveal');
      // Stagger parallel siblings without delaying an entire long section.
      const siblings = [...item.parentElement.children].filter(el => el.matches(selector));
      item.style.setProperty('--reveal-delay', `${Math.min(siblings.indexOf(item), 3) * 75}ms`);
      if (rect.top < innerHeight * .97 || item.contains(document.activeElement)) item.classList.add('in-view');
    });
    observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      });
    }, { threshold: 0, rootMargin: '0px 0px -6% 0px' });
    items.filter(item => !item.classList.contains('in-view')).forEach(item => observer.observe(item));
    root.classList.add('motion-ready');
  }
  setupReveals();
  reduced.addEventListener('change', setupReveals);
  document.addEventListener('focusin', event => {
    let node = event.target.closest('.motion-reveal');
    while (node) { node.classList.add('in-view'); node = node.parentElement.closest('.motion-reveal'); }
  });
  addEventListener('beforeprint', () => items.forEach(item => item.classList.add('in-view')));

  // Images move gently within their crops as the reader advances. A set of
  // visible images keeps scrolling cheap on the photo-heavy case study.
  const images = [...document.querySelectorAll('.experiment-image img, .secondary-image:not(.rocket-photo) img, .detail-visual:not(.rocket):not(.diagram):not(.contain) > img')];
  const visible = new Set();
  let scrollFrame = 0;
  function updateScroll() {
    scrollFrame = 0;
    if (reduced.matches) return;
    visible.forEach(img => {
      const rect = img.parentElement.getBoundingClientRect();
      const progress = Math.max(-1, Math.min(1, (rect.top + rect.height / 2 - innerHeight / 2) / innerHeight));
      img.style.setProperty('--image-drift', `${progress * -14}px`);
    });
    const note = document.querySelector('.personal-notes');
    if (note) {
      const rect = note.getBoundingClientRect();
      const progress = Math.max(0,Math.min(1,(innerHeight-rect.top)/(innerHeight+rect.height)));
      note.style.setProperty('--reading-progress', progress);
    }
  }
  function queueScroll() { if (!scrollFrame) scrollFrame = requestAnimationFrame(updateScroll); }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(entry => entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target));
      queueScroll();
    });
    images.forEach(img => io.observe(img));
  }
  addEventListener('scroll', queueScroll, { passive: true });
  addEventListener('resize', queueScroll, { passive: true });

  // Pointer-driven image depth plus a cursor-following, contained arrow.
  document.querySelectorAll('.experiment-image, .secondary-image').forEach(card => {
    let pending = 0, point;
    card.addEventListener('pointermove', event => {
      if (!fine.matches || reduced.matches) return;
      const r = card.getBoundingClientRect();
      point = { x: (event.clientX-r.left)/r.width-.5, y: (event.clientY-r.top)/r.height-.5 };
      if (!pending) pending = requestAnimationFrame(() => {
        pending = 0;
        card.style.setProperty('--tilt-x', `${-point.y*3}deg`);
        card.style.setProperty('--tilt-y', `${point.x*3}deg`);
        card.style.setProperty('--arrow-x', `${point.x*12}px`);
        card.style.setProperty('--arrow-y', `${point.y*12}px`);
      });
    }, { passive: true });
    card.addEventListener('pointerleave', () => {
      cancelAnimationFrame(pending); pending = 0;
      ['--tilt-x','--tilt-y','--arrow-x','--arrow-y'].forEach(p => card.style.removeProperty(p));
    });
  });

  // A single fading click ring adds feedback without delaying the action.
  document.querySelectorAll('.button, .field-mode, .text-link, .menu-button').forEach(button => {
    button.addEventListener('click', event => {
      if (reduced.matches) return;
      const rect = button.getBoundingClientRect(), ring = document.createElement('span');
      ring.className = 'click-ring'; ring.setAttribute('aria-hidden','true');
      ring.style.left = `${event.detail ? event.clientX-rect.left : rect.width/2}px`;
      ring.style.top = `${event.detail ? event.clientY-rect.top : rect.height/2}px`;
      button.appendChild(ring); ring.addEventListener('animationend',()=>ring.remove(),{once:true});
      setTimeout(()=>ring.remove(),700);
    });
  });
})();
