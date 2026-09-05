/* Loaded in <head> so incoming cross-document snapshots can share project
 * media and titles. Navigation remains ordinary HTML, including history. */
(() => {
  'use strict';
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const native = 'onpageswap' in window && 'onpagereveal' in window;
  if (native) document.documentElement.classList.add('native-page-transitions');
  function slug(url) {
    try { return new URL(url, location.href).pathname.match(/\/projects\/([a-z-]+)\.html$/)?.[1] || ''; }
    catch { return ''; }
  }
  function share(id) {
    const nodes = [];
    if (!id || !/^[a-z-]+$/.test(id)) return nodes;
    for (const kind of ['image', 'title']) {
      const node = document.querySelector(`[data-project-${kind}="${id}"]`);
      if (!node) continue;
      node.style.viewTransitionName = `project-${kind}`;
      // A history snapshot must not capture a still-hidden scroll reveal.
      node.classList.add('in-view');
      const parent = node.closest('.motion-reveal');
      if (parent) parent.classList.add('in-view');
      nodes.push(node);
    }
    return nodes;
  }
  function finish(transition, nodes) {
    transition.finished.catch(() => {}).finally(() => nodes.forEach(node => { node.style.viewTransitionName = ''; }));
  }
  addEventListener('pageswap', event => {
    if (!event.viewTransition || reduced.matches) return;
    const from = event.activation?.from?.url || location.href;
    const to = event.activation?.entry?.url;
    // Match home -> project or project -> home, not unrelated case studies.
    const fromId = slug(from), toId = slug(to);
    const id = fromId && toId ? '' : toId || fromId;
    finish(event.viewTransition, share(id));
  });
  addEventListener('pagereveal', event => {
    if (!event.viewTransition || reduced.matches) return;
    const activation = window.navigation?.activation;
    const fromId = slug(activation?.from?.url), toId = slug(location.href);
    const id = fromId && toId ? '' : toId || fromId;
    document.documentElement.classList.add('transition-arriving');
    finish(event.viewTransition, share(id));
    event.viewTransition.finished.catch(() => {}).finally(() => document.documentElement.classList.remove('transition-arriving'));
  });
  // Fade/slide fallback is short and leaves modified clicks, downloads, hash
  // links, off-site links and keyboard browser commands untouched.
  if (!native) document.addEventListener('click', event => {
    if (reduced.matches || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest('a[href]');
    if (!link || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href, location.href);
    if (url.origin !== location.origin || url.pathname === location.pathname || !(/\.html$/.test(url.pathname) || url.pathname.endsWith('/'))) return;
    event.preventDefault();
    document.documentElement.classList.add('page-leaving');
    setTimeout(() => location.assign(url.href), 170);
  });
  addEventListener('pageshow', () => document.documentElement.classList.remove('page-leaving'));
})();
