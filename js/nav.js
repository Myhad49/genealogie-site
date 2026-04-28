/* ================================================== */
/* NAV.JS — Chargement du menu partagé + active link */
/* ================================================== */

(function () {

  /* ── 1. Injection du nav ── */
  const container = document.getElementById('nav-container');
  if (!container) return;

  /* Calcul du chemin relatif vers nav.html selon la profondeur */
  const depth = (window.location.pathname.match(/\//g) || []).length - 1;
  const prefix = depth > 0 ? '../'.repeat(depth) : './';
  const navPath = prefix + 'nav.html';

  fetch(navPath)
    .then(r => {
      if (!r.ok) throw new Error('nav.html introuvable : ' + navPath);
      return r.text();
    })
    .then(html => {
      container.innerHTML = html;
      initNav();
    })
    .catch(err => console.warn('[nav.js]', err));


  /* ── 2. Init navigation ── */
  function initNav () {

    /* ── 2a. Lien actif ── */
    const currentPath = window.location.pathname
      .replace(/\/+$/, '')   /* supprime slash final */
      .toLowerCase();

    document.querySelectorAll('#nav-menu a').forEach(link => {
      const linkPath = new URL(link.href).pathname
        .replace(/\/+$/, '')
        .toLowerCase();

      if (linkPath === currentPath) {
        link.classList.add('active');

        /* Remonte les parents pour les mettre en surbrillance */
        let parent = link.closest('.submenu');
        while (parent) {
          const trigger = parent.previousElementSibling;
          if (trigger) trigger.classList.add('active');
          parent = parent.parentElement?.closest('.submenu');
        }
      }
    });


    /* ── 2b. Hamburger (mobile) ── */
    const hamburger = document.getElementById('hamburger');
    const navMenu   = document.getElementById('nav-menu');

    if (hamburger && navMenu) {
      hamburger.addEventListener('click', () => {
        const isOpen = navMenu.classList.toggle('open');
        hamburger.setAttribute('aria-expanded', isOpen);
      });
    }


    /* ── 2c. Sous-menus mobile (tap) ── */
    if (window.innerWidth <= 768) {
      document.querySelectorAll('#nav-menu span').forEach(trigger => {
        trigger.addEventListener('click', () => {
          const sub = trigger.nextElementSibling;
          if (sub && sub.classList.contains('submenu')) {
            sub.classList.toggle('open');
            const arrow = trigger.querySelector('.arrow');
            if (arrow) {
              arrow.style.transform =
                sub.classList.contains('open') ? 'rotate(90deg)' : '';
            }
          }
        });
      });
    }

  } /* fin initNav */

})();
