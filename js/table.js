/* ════════════════════════════════════════════════
   table.js  —  Moteur de filtres généalogiques
   ════════════════════════════════════════════════ */

/**
 * Applique tous les filtres actifs sur un tableau donné.
 * @param {string} tableId  — id de la <table>
 */
function appliquerFiltres(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;

  /* ── Lecture des filtres ── */

  // Texte libre
  const texte = (
    document.querySelector(`[data-filter-table="${tableId}"][data-filter="texte"]`)?.value || ''
  ).toLowerCase().trim();

  // Recherche par ID
  const idRecherche = (
    document.querySelector(`[data-filter-table="${tableId}"][data-filter="id"]`)?.value || ''
  ).toLowerCase().trim();

  // Recherche par Sosa (direct uniquement)
  const sosaRecherche = (
    document.querySelector(`[data-filter-table="${tableId}"][data-filter="sosa"]`)?.value || ''
  ).trim();

  // Checkboxes type
  const typesCoches = Array.from(
    document.querySelectorAll(
      `[data-filter-table="${tableId}"][data-filter="type"]:checked`
    )
  ).map(cb => cb.value.toLowerCase());

  // Plage d'années
  const anneeMin = parseInt(
    document.querySelector(`[data-filter-table="${tableId}"][data-filter="annee-min"]`)?.value || ''
  );
  const anneeMax = parseInt(
    document.querySelector(`[data-filter-table="${tableId}"][data-filter="annee-max"]`)?.value || ''
  );

  // Checkboxes spéciales
  const filtreInconnu     = document.querySelector(`[data-filter-table="${tableId}"][data-filter="date-inconnue"]`)?.checked;
  const filtreLieuInconnu = document.querySelector(`[data-filter-table="${tableId}"][data-filter="lieu-inconnu"]`)?.checked;
  const filtreIncertain   = document.querySelector(`[data-filter-table="${tableId}"][data-filter="date-incertaine"]`)?.checked;
  const filtreVivant      = document.querySelector(`[data-filter-table="${tableId}"][data-filter="vivant"]`)?.checked;

  /* ── Application ligne par ligne ── */
  const lignes = table.querySelectorAll('tbody tr:not(.person-separator)');
  let visibles = 0;

  lignes.forEach(tr => {
    const d = tr.dataset;

    // -- Texte libre --
    if (texte && !tr.textContent.toLowerCase().includes(texte)) {
      tr.classList.add('hidden'); return;
    }

    // -- Recherche par ID --
    if (idRecherche) {
      const idLigne = (d.id || '').toLowerCase();
      if (!idLigne.includes(idRecherche)) {
        tr.classList.add('hidden'); return;
      }
    }

    // -- Recherche par Sosa --
    // Correspondance exacte.
    // Exception : les lignes de mariage (data-type contient "mariage")
    // portent deux sosas séparés par "–" (ex. "2–3").
    // Dans ce cas, on vérifie si le sosa recherché correspond
    // à l'un des deux sosas de la paire.
    if (sosaRecherche) {
      const sosaLigne  = (d.sosa || '').trim();
      const typeLigne  = (d.type || '').toLowerCase();
      const estMariage = typeLigne.includes('mariage');

      if (estMariage) {
        // Sépare sur "–" (tiret demi-cadratin) ou "-" (tiret court)
        const paire = sosaLigne.split(/[–-]/).map(s => s.trim());
        if (!paire.includes(sosaRecherche)) {
          tr.classList.add('hidden'); return;
        }
      } else {
        // Correspondance exacte standard
        if (sosaLigne !== sosaRecherche) {
          tr.classList.add('hidden'); return;
        }
      }
    }

    // -- Type --
    if (typesCoches.length > 0) {
      const typeLigne = (d.type || '').toLowerCase();
      if (!typesCoches.some(t => typeLigne.includes(t))) {
        tr.classList.add('hidden'); return;
      }
    }

    // -- Plage d'années --
    const annee = parseInt(d.annee || '');
    if (!isNaN(anneeMin) && !isNaN(annee) && annee < anneeMin) {
      tr.classList.add('hidden'); return;
    }
    if (!isNaN(anneeMax) && !isNaN(annee) && annee > anneeMax) {
      tr.classList.add('hidden'); return;
    }

    // -- Date inconnue --
    if (filtreInconnu && d.dateInconnue !== 'oui') {
      tr.classList.add('hidden'); return;
    }

    // -- Lieu inconnu --
    if (filtreLieuInconnu && d.lieuInconnu !== 'oui') {
      tr.classList.add('hidden'); return;
    }

    // -- Date incertaine --
    if (filtreIncertain && d.dateIncertaine !== 'oui') {
      tr.classList.add('hidden'); return;
    }

    // -- En vie --
    if (filtreVivant && d.vivant !== 'oui') {
      tr.classList.add('hidden'); return;
    }

    tr.classList.remove('hidden');
    visibles++;
  });

  // Mise à jour compteur
  const compteur = document.getElementById(`count-${tableId}`);
  if (compteur) compteur.textContent = `${visibles} acte(s) affiché(s)`;

  // Gestion séparateurs : masquer si tous leurs actes sont cachés
  _majSeparateurs(table);
}

/**
 * Masque les séparateurs de personne si tous leurs actes sont cachés.
 */
function _majSeparateurs(table) {
  const lignes = Array.from(table.querySelectorAll('tbody tr'));
  lignes.forEach((tr, i) => {
    if (!tr.classList.contains('person-separator')) return;
    let j = i + 1;
    let auMoinsUneVisible = false;
    while (j < lignes.length && !lignes[j].classList.contains('person-separator')) {
      if (!lignes[j].classList.contains('hidden')) {
        auMoinsUneVisible = true;
        break;
      }
      j++;
    }
    tr.classList.toggle('hidden', !auMoinsUneVisible);
  });
}

/**
 * Réinitialise tous les filtres d'un tableau.
 */
function reinitialiserFiltres(tableId) {
  document.querySelectorAll(`[data-filter-table="${tableId}"]`).forEach(el => {
    if (el.type === 'checkbox') el.checked = false;
    else el.value = '';
  });
  appliquerFiltres(tableId);
}
