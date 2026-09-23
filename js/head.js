/* Runs in <head>, before the first paint.
 *
 * 1. Marks that JavaScript is available (html.js), so enhancements such as
 *    scroll reveals only hide content when something will reveal it again.
 * 2. Applies the theme: the visitor's saved choice, else the OS preference.
 *    Setting it here, not later, means the page never flashes the wrong colors.
 * 3. Names the shared project image and title for cross-page view transitions.
 *    Those events fire before the page renders, so the listeners must exist
 *    this early. Navigation itself stays ordinary links and history.
 */
(() => {
  'use strict';
  const root = document.documentElement;
  root.classList.add('js');

  // --- theme ----------------------------------------------------------------
  const prefersDark = matchMedia('(prefers-color-scheme: dark)');
  const saved = () => {
    try { return localStorage.getItem('theme'); } catch { return null; }
  };
  const system = () => (prefersDark.matches ? 'dark' : 'light');
  const choice = saved();
  root.dataset.theme = choice === 'light' || choice === 'dark' ? choice : system();
  // Follow the OS setting until the visitor picks a theme themselves.
  prefersDark.addEventListener('change', () => {
    if (!saved()) root.dataset.theme = system();
  });

  // --- page transitions ---------------------------------------------------------
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');

  function projectSlug(url) {
    try {
      return new URL(url, location.href).pathname.match(/\/projects\/([a-z-]+)\.html$/)?.[1] || '';
    } catch {
      return '';
    }
  }

  // Home <-> case study share their image and title; case study -> case study
  // does not, because both ends would name different projects.
  function sharedSlug(fromUrl, toUrl) {
    const from = projectSlug(fromUrl);
    const to = projectSlug(toUrl);
    return from && to ? '' : from || to;
  }

  function nameShared(slug, transition) {
    if (!slug) return;
    for (const kind of ['image', 'title']) {
      const node = document.querySelector(`[data-project-${kind}="${slug}"]`);
      if (!node) continue;
      node.style.viewTransitionName = `project-${kind}`;
      // A snapshot must never capture a scroll reveal that is still hidden.
      node.closest('.reveal')?.classList.add('is-in');
      const clear = () => { node.style.viewTransitionName = ''; };
      transition.finished.then(clear, clear);
    }
  }

  addEventListener('pageswap', event => {
    if (!event.viewTransition || reduced.matches) return;
    nameShared(sharedSlug(location.href, event.activation?.entry?.url), event.viewTransition);
  });

  addEventListener('pagereveal', event => {
    if (!event.viewTransition || reduced.matches) return;
    const from = window.navigation?.activation?.from?.url;
    nameShared(sharedSlug(from, location.href), event.viewTransition);
  });
})();
