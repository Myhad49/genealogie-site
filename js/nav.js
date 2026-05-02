/* ================================================== */
/* NAV.JS — Chargement du menu partagé + active link  */
/* ================================================== */

(function () {

  const container = document.getElementById('nav-container');
  if (!container) return;

  /* ── 1. Détection de la racine du site ──
     Cherche le segment commun entre toutes les pages.
     On remonte jusqu'à trouver nav.html en testant des chemins.
     Méthode : on part du script lui-même pour déduire la racine.          */
  const scriptSrc = document.currentScript?.src || '';
  let base = '';

  if (scriptSrc) {
    /* nav.js est dans /[base]/js/nav.js → on remonte de 2 niveaux */
    const url = new URL(scriptSrc);
    const parts = url.pathname.split('/').filter(Boolean);
    /* Retire "js" et "nav.js" */
    parts.splice(-2, 2);
    base = parts.length ? '/' + parts.join('/') + '/' : '/';
  } else {
    base = '/';
  }

  const navPath = base + 'nav.html';

  /* ── 2. Fetch et injection ── */
  fetch(navPath)
    .then(r => {
      if (!r.ok) throw new Error('nav.html introuvable : ' + navPath);
      return r.text();
    })
    .then(html => {
      container.innerHTML = html;
      rebaseLinks(base);
      initNav(base);
    })
    .catch(err => console.warn('[nav.js]', err));


  /* ── 3. Rebase des liens nav.html ──
     Les href dans nav.html sont écrits relatifs à la racine du site
     (ex. "individus/martin/direct/gen2/").
     On les préfixe avec `base` pour qu'ils fonctionnent depuis
     n'importe quelle profondeur.                                          */
  function rebaseLinks (base) {
    document.querySelectorAll('#nav-menu a').forEach(a => {
      const href = a.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('/') || href.startsWith('#')) return;
      a.setAttribute('href', base + href);
    });

    /* Logo */
    const logo = document.getElementById('nav-home-link');
    if (logo) logo.setAttribute('href', base);
  }


  /* ── 4. Init navigation ── */
  function initNav (base) {

    /* ── 4a. Lien actif ── */
    const currentPath = window.location.pathname
      .replace(/\/+$/, '')
      .toLowerCase();

    document.querySelectorAll('#nav-menu a').forEach(link => {
      const linkPath = new URL(link.href, window.location.origin).pathname
        .replace(/\/+$/, '')
        .toLowerCase();

      if (linkPath === currentPath) {
        link.classList.add('active');
        /* Remonte les parents */
        let parent = link.closest('.submenu');
        while (parent) {
          const trigger = parent.previousElementSibling;
          if (trigger) trigger.classList.add('active');
          parent = parent.parentElement?.closest('.submenu');
        }
      }
    });

    /* ── 4b. Hamburger ── */
    const hamburger = document.getElementById('hamburger');
    const navMenu   = document.getElementById('nav-menu');

    if (hamburger && navMenu) {
      hamburger.addEventListener('click', () => {
        const isOpen = navMenu.classList.toggle('open');
        hamburger.setAttribute('aria-expanded', isOpen);
      });
    }

    /* ── 4c. Sous-menus mobile ── */
    if (window.innerWidth <= 768) {
      document.querySelectorAll('#nav-menu span').forEach(trigger => {
        trigger.addEventListener('click', () => {
          const sub = trigger.nextElementSibling;
          if (sub?.classList.contains('submenu')) {
            sub.classList.toggle('open');
            const arrow = trigger.querySelector('.arrow');
            if (arrow) {
              arrow.style.transform = sub.classList.contains('open') ? 'rotate(90deg)' : '';
            }
          }
        });
      });
    }

  } /* fin initNav */

})();
