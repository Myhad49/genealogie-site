// ============================================================
//  recherche.js — Moteur de recherche généalogique v9
//  REFONTE MOTEUR — Filtrage unifié cumulatif
// ============================================================

'use strict';

let DATA = null;
let ongletActif = 'tous';
let timerInput = null;

// ============================================================
// 1. CHARGEMENT INITIAL
// ============================================================
async function chargerDonnees() {
  try {
    const r = await fetch('/data/index.json');
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    DATA = await r.json();
    console.log('✓ DATA chargée:', DATA);
    await preChargerActes();
    await chargerMaires();   // ← ne peut plus remonter d'erreur
    peuplerFiltres();
    lancerRecherche();
  } catch (e) {
    const z = document.getElementById('resultats');
    if (z) z.innerHTML = '<p class="vide">⚠️ Impossible de charger index.json</p>';
    console.error('Erreur chargement:', e);
  }
}

// ============================================================
// 1b. PRÉ-CHARGER LES FICHIERS JSON DES ACTES
// ============================================================
async function preChargerActes() {
  if (!DATA || !DATA.actes) return;

  const fichiersUniques = new Set();
  DATA.actes.forEach(a => { if (a.fichier) fichiersUniques.add(a.fichier); });

  const promesses = Array.from(fichiersUniques).map(async (fichier) => {
    try {
      const res = await fetch('/data/' + fichier);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const actesFichier = await res.json();
      if (Array.isArray(actesFichier)) {
        actesFichier.forEach(acteComplet => {
          const acteIndex = DATA.actes.find(a => a.acte_id === acteComplet.acte_id);
          if (acteIndex) Object.assign(acteIndex, acteComplet);
        });
      }
    } catch (err) {
      console.warn(`⚠️ Impossible de charger ${fichier}:`, err);
    }
  });

  await Promise.all(promesses);
  console.log('✓ Actes enrichis depuis les fichiers JSON');
}

// ============================================================
// 1c. CHARGER ET ENRICHIR DEPUIS maires.json
// ============================================================
async function chargerMaires() {
  // Fonction autonome — ne remonte jamais d'erreur
  try {
    const res = await fetch('/data/individus/maires.json');
    if (!res.ok) {
      console.warn(`⚠️ maires.json introuvable (HTTP ${res.status})`);
      return;   // ← on sort proprement, pas de throw
    }

    const maires = await res.json();
    if (!Array.isArray(maires)) {
      console.warn('⚠️ maires.json : format inattendu (attendu tableau)');
      return;
    }

    let enrichis = 0;
    maires.forEach(m => {
      if (!m.personne_id) return;
      const ind = (DATA.individus || []).find(i => i.personne_id === m.personne_id);
      if (!ind) return;

      // Enrichir mandats
      if (Array.isArray(m.mandats) && m.mandats.length > 0) {
        ind.mandats = m.mandats;
      }
      // Enrichir le sexe si présent dans maires.json
      if (m.sexe) {
        ind.sexe = m.sexe;
      }
      // Enrichir professions seulement si absentes
      if (Array.isArray(m.professions) && m.professions.length > 0) {
        if (!ind.professions || ind.professions.length === 0) {
          ind.professions = m.professions;
        }
      }
      enrichis++;
    });

    console.log(`✓ Maires enrichis : ${enrichis} individu(s) mis à jour`);

  } catch (e) {
    // On log mais on NE throw PAS → chargerDonnees() continue normalement
    console.warn('⚠️ Erreur lors du chargement de maires.json:', e);
  }
}

// ============================================================
// 2. PEUPLER LES SELECTS DYNAMIQUES
// ============================================================
function peuplerFiltres() {
  if (!DATA) return;

  const genSet = new Set();
  const branchSet = new Set();
  const profSet = new Set();
  const deptSet = new Set();
  const depotSet = new Set();

  (DATA.actes || []).forEach(a => {
    if (a.generation) genSet.add(a.generation);
    if (a.branche) branchSet.add(a.branche);
    if (a.dept) deptSet.add(a.dept);
    // Dépôt d'archives — clés possibles
    const depot = a.source?.depot || null;
    if (depot) depotSet.add(depot);
  });

  (DATA.individus || []).forEach(i => {
    if (i.generation) genSet.add(i.generation);
    if (i.branche) branchSet.add(i.branche);
    (i.professions || []).forEach(p => profSet.add(p));
    if (i.dept_naissance) deptSet.add(i.dept_naissance);
  });

  _peuplerSelect('filtre-generation', Array.from(genSet).sort((a, b) => a - b),
    g => `Génération ${g}`);
  _peuplerSelect('filtre-branche', Array.from(branchSet).sort());
  _peuplerSelect('filtre-profession', Array.from(profSet).sort());
  _peuplerSelect('filtre-dept', Array.from(deptSet).sort());
  _peuplerSelect('filtre-depot', Array.from(depotSet).sort());
}

function _peuplerSelect(id, valeurs, labelFn = v => v) {
  const sel = document.getElementById(id);
  if (!sel) return;
  valeurs.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = labelFn(v);
    sel.appendChild(opt);
  });
}

// ============================================================
// 3. LIRE LES PRÉNOMS (défensif)
// ============================================================
function lireChampPrenoms(ind) {
  if (!ind) return [];
  if (Array.isArray(ind.prenoms) && ind.prenoms.length > 0)
    return ind.prenoms.filter(p => p && p.trim());
  if (typeof ind.prenom === 'string' && ind.prenom.trim())
    return [ind.prenom.trim()];
  const prenoms = [];
  for (let i = 1; i <= 10; i++) {
    const key = `prenom_${i}`;
    if (ind[key] && ind[key].trim()) prenoms.push(ind[key].trim());
  }
  return prenoms;
}

// ============================================================
// 4. TROUVER INDIVIDU PAR SOSA
// ============================================================
function trouverIndividuBySosa(sosa) {
  if (!DATA || !DATA.individus || !sosa) return null;
  return DATA.individus.find(i =>
    i.sosa === sosa || i.sosa === String(sosa)
  ) || null;
}

// ============================================================
// 5. TROUVER INDIVIDU PAR ID
// ============================================================
function trouverIndividuById(id) {
  if (!DATA || !DATA.individus || !id) return null;
  return DATA.individus.find(i => i.personne_id === id) || null;
}

// ============================================================
// 6. OBTENIR INFOS MAIRE / OFFICIER
// ============================================================
function obtenirInfoMaireOfficier(ind) {
  const info = { estMaire: false, estOfficier: false, communes: [], fonction: null };
  if (!ind || !ind.personne_id) return info;

  // ── Via professions ──
  (ind.professions || []).forEach(p => {
    const pl = p.toLowerCase();
    if (pl.includes('maire')) info.estMaire = true;
    if (pl.includes('officier') || pl.includes('attaché')) info.estOfficier = true;
  });

  // ── Via mandats (chargés depuis maires.json) ──
  (ind.mandats || []).forEach(m => {
    const ft = (m.fonction_type || '').toLowerCase();
    if (ft.includes('maire')) info.estMaire = true;
    if (ft.includes('officier') || ft.includes('attaché')) info.estOfficier = true;
    // Collecter les communes de fonction
    if (m.lieu_fonction_affiche && !info.communes.includes(m.lieu_fonction_affiche)) {
      info.communes.push(m.lieu_fonction_affiche);
    }
  });

  // ── Via actes signés ──
  (DATA?.actes || []).forEach(a => {
    if (a.maire_officier === ind.personne_id && a.lieu_affiche
      && !info.communes.includes(a.lieu_affiche))
      info.communes.push(a.lieu_affiche);
  });

  info.fonction = info.estMaire ? 'Maire'
    : info.estOfficier ? 'Officier'
      : null;
  return info;
}


// ============================================================
// 7. COMPTER LES ACTES LIÉS À UNE PERSONNE
// ============================================================
function compterActesPersonne(personne_id, sosa) {
  if (!DATA || !DATA.actes) return 0;
  const set = new Set();

  DATA.actes.forEach(a => {

    // --- 1. Recherche par SOSA ---
    if (sosa) {
      if (a.sosa === sosa || (Array.isArray(a.sosa) && a.sosa.includes(sosa))) {
        set.add(a.acte_id); return;
      }
    }

    // --- 2. Recherche par personne_id dans personne_ids OU personnes_ids ---
    if (personne_id) {
      const ids = a.personne_ids || a.personnes_ids || [];
      if (Array.isArray(ids) && ids.includes(personne_id)) {
        set.add(a.acte_id); return;
      }
    }

    // --- 3. Recherche dans maire_officier (string ou tableau d'objets) ---
    if (personne_id) {
      const maire = a.maire_officier;
      if (typeof maire === "string" && maire === personne_id) {
        set.add(a.acte_id); return;
      }
      if (Array.isArray(maire) && maire.some(m => m.personne_id === personne_id)) {
        set.add(a.acte_id); return;
      }
    }

  });

  return set.size;
}

// ============================================================
// 8. AFFICHER DATE
// ============================================================
function afficherDate(acte) {
  if (!acte) return '—';
  const { jour, mois, annee } = acte;
  if (!jour || !mois || !annee) return annee ? String(annee) : '—';
  const moisNames = ['', 'jan', 'fév', 'mar', 'avr', 'mai', 'juin',
    'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];
  return `${jour} ${moisNames[mois] || '?'} ${annee}`;
}

// ============================================================
// 9. AFFICHER SOSA
// ============================================================
function afficherSosa(sosaField) {
  if (!sosaField) return '';
  if (typeof sosaField === 'string') return sosaField.trim();
  if (Array.isArray(sosaField))
    return sosaField.filter(s => s !== null && s !== undefined).join(', ');
  return '';
}

// ============================================================
// 10. LABEL TYPE ACTE
// ============================================================
function labelTypeActe(type, sexe) {
  if (type === 'Naissance' && sexe === 'F') return 'Naissance-F';
  if (type === 'Naissance' && sexe === 'M') return 'Naissance-M';
  return type || 'Inconnu';
}

// ============================================================
// 11. CARTE INDIVIDU
// ============================================================
function carteIndividu(ind) {
  const prenoms = lireChampPrenoms(ind);
  const prenomAff = prenoms[0] || '—';
  const nbActes = compterActesPersonne(ind.personne_id, ind.sosa);
  const infoMaire = obtenirInfoMaireOfficier(ind);
  const sosaAff = ind.sosa
    ? `Sosa ${ind.sosa}${ind.aliase_id ? ` - [${ind.aliase_id}]` : ''}`
    : (ind.aliase_id ? ind.aliase_id : '');

  let iconeGenre = '';
  if (ind.sexe === 'M') iconeGenre = ' ♂️';
  else if (ind.sexe === 'F') iconeGenre = ' ♀️';

  const communesAff = infoMaire.communes.join(' / ');

  let html = `
    <a href="${ind.url || '#'}" class="carte" data-type="Individu">
      <div class="carte-corps">
        <div>
          <span class="carte-type type-Individu">Individu</span>`;

  if (infoMaire.fonction === 'Maire') {
    const emojiMaire = ind.sexe === 'F' ? '👩‍💼' : '👨‍💼';
    html += `<span style="margin-left:.5rem">Maire ${emojiMaire}</span>`;
  } else if (infoMaire.fonction === 'Officier') {
    const emojiOfficier = ind.sexe === 'F' ? '👩‍💻' : '👨‍💻';
    html += `<span style="margin-left:.5rem">Officier ${emojiOfficier}</span>`;
  }

  html += `
        </div>
        <div class="carte-titre">${ind.nom || '—'} ${prenomAff}${iconeGenre}
          <span style="color:#999">${sosaAff}</span>
        </div>
        <div class="carte-meta">
          ${communesAff ? `📍 ${communesAff} | ` : ''}${nbActes} acte(s) lié(s)
        </div>`;

  if (ind.decorations && ind.decorations.length > 0) {
    html += '<div class="carte-badges">';
    ind.decorations.forEach(d => { html += `<span class="carte-badge decor">${d}</span>`; });
    html += '</div>';
  }

  html += `
      </div>
      <div class="carte-lien">Voir la fiche →</div>
    </a>`;
  return html;
}

// ============================================================
// 12. CARTE ACTE
// ============================================================
function carteActe(acte) {
  const dateAff = afficherDate(acte);
  const lieuAff = acte.lieu_affiche || '—';
  const deptAff = acte.dept || '';
  const sosaAff = afficherSosa(acte.sosa);

  let titrePersonne = '';
  let sexe = null;

  if (acte.type === 'Mariage') {
    let nom1 = '', prenom1 = '', nom2 = '', prenom2 = '';

    if (acte.epoux?.nom) {
      nom1 = acte.epoux.nom;
      prenom1 = lireChampPrenoms(acte.epoux)[0] || '';
    }
    if (acte.epouse?.nom) {
      nom2 = acte.epouse.nom;
      prenom2 = lireChampPrenoms(acte.epouse)[0] || '';
    }
    if (!nom1 && acte.personnes_ids?.length >= 2) {
      const i1 = trouverIndividuById(acte.personnes_ids[0]);
      const i2 = trouverIndividuById(acte.personnes_ids[1]);
      if (i1) { nom1 = i1.nom || ''; prenom1 = lireChampPrenoms(i1)[0] || ''; }
      if (i2) { nom2 = i2.nom || ''; prenom2 = lireChampPrenoms(i2)[0] || ''; }
    }
    if (!nom1 && Array.isArray(acte.sosa) && acte.sosa.length >= 2) {
      const i1 = trouverIndividuBySosa(String(acte.sosa[0]));
      const i2 = trouverIndividuBySosa(String(acte.sosa[1]));
      if (i1) { nom1 = i1.nom || ''; prenom1 = lireChampPrenoms(i1)[0] || ''; }
      if (i2) { nom2 = i2.nom || ''; prenom2 = lireChampPrenoms(i2)[0] || ''; }
    }

    titrePersonne = nom1 && nom2
      ? `${nom1} ${prenom1} × ${nom2} ${prenom2}`.trim()
      : (nom1 ? `${nom1} ${prenom1}`.trim() : acte.acte_id || 'Mariage');

  } else {
    let individu = null;
    if (acte.personne?.nom) individu = acte.personne;
    else if (acte.personne_id) individu = trouverIndividuById(acte.personne_id);
    else if (acte.sosa) {
      const s = Array.isArray(acte.sosa) ? acte.sosa.find(s => s !== null) : acte.sosa;
      individu = trouverIndividuBySosa(String(s));
    }

    if (individu) {
      titrePersonne = `${individu.nom || ''} ${lireChampPrenoms(individu).join(' ')}`.trim();
      sexe = individu.sexe;
    } else {
      titrePersonne = acte.acte_id || 'Acte';
    }
  }

  // Icône mariage civil/religieux
  let iconesMariage = '';
  if (acte.type === 'Mariage') {
    if (acte.mariage_civil) iconesMariage += ' 🏫';
    if (acte.mariage_religieux) iconesMariage += ' ⛪';
  }

  // Maire / Officier
  let maireHtml = '';
  if (acte.maire_officier) {
    const m = trouverIndividuById(acte.maire_officier);
    if (m) {
      const fn = (m.professions || []).some(p => p.toLowerCase().includes('maire'))
        ? 'Maire' : 'Officier';
      maireHtml = `<span class="carte-infos-maire">${fn}: <strong>${m.nom || ''} ${lireChampPrenoms(m)[0] || ''}</strong></span>`;
    }
  }

  const typeLabel = labelTypeActe(acte.type, sexe);

  let iconeGenre = '';
  if (acte.type === 'Naissance') {
    const sexeNaissance = acte.personne?.sexe || sexe || '';
    if (sexeNaissance === 'M') iconeGenre = ' ♂️';
    else if (sexeNaissance === 'F') iconeGenre = ' ♀️';
  } else if (acte.type === 'Décès') {
    iconeGenre = ' 🪦';
  }

  return `
    <a class="carte" data-type="${typeLabel}" href="${acte.url || '#'}">
      <div class="carte-contenu">
        <div class="carte-titre">${acte.type}${iconeGenre}${iconesMariage}</div>
        <div class="carte-nom">${titrePersonne}</div>
        <div class="carte-meta">
          📅 ${dateAff} | 📍 ${lieuAff}${deptAff ? `, ${deptAff}` : ''}${sosaAff ? ` | Sosa ${sosaAff}` : ''}
        </div>
        ${maireHtml}
      </div>
      <div class="carte-lien">Voir l'acte →</div>
    </a>`;
}

// ============================================================
// 13. LIRE LES FILTRES ACTIFS (source unique de vérité)
// ============================================================
function lireFiltres() {
  return {
    q: (document.getElementById('input-recherche')?.value || '').toLowerCase().trim(),
    type: document.getElementById('filtre-type')?.value || '',
    gen: document.getElementById('filtre-generation')?.value || '',
    annDeb: parseInt(document.getElementById('filtre-annee-debut')?.value) || null,
    annFin: parseInt(document.getElementById('filtre-annee-fin')?.value) || null,
    branche: document.getElementById('filtre-branche')?.value || '',
    ligne: document.getElementById('filtre-ligne')?.value || '',
    sexe: document.getElementById('filtre-sexe')?.value || '',
    prof: document.getElementById('filtre-profession')?.value || '',
    dept: document.getElementById('filtre-dept')?.value || '',
    depot: document.getElementById('filtre-depot')?.value || '',
    cote: (document.getElementById('filtre-cote')?.value || '').toLowerCase().trim(),
    commune: (document.getElementById('filtre-commune')?.value || '').toLowerCase().trim(),
    avecDecore: document.getElementById('filtre-avec-decoration')?.checked || false,
    avecContrat: document.getElementById('filtre-avec-contrat')?.checked || false,
    indDecore: document.getElementById('filtre-individu-decore')?.checked || false,
    typeUnion: document.getElementById('filtre-type-union')?.value || '',
    tri: document.getElementById('filtre-tri')?.value || 'pertinence',
  };
}

// ============================================================
// 14. MOTEUR DE FILTRAGE UNIFIÉ
// ============================================================

// ── Récupérer tous les individus liés à un acte ──
function individusDeLActe(acte) {
  const inds = [];

  const ajouter = (id) => {
    if (!id) return;
    const ind = trouverIndividuById(id);
    if (ind) inds.push(ind);
  };

  // Via personne_id
  if (acte.personne_id) ajouter(acte.personne_id);
  // Via personnes_ids (tableau)
  (acte.personnes_ids || acte.personne_ids || []).forEach(ajouter);
  // Via sosa
  const sosas = Array.isArray(acte.sosa) ? acte.sosa : (acte.sosa ? [acte.sosa] : []);
  sosas.filter(s => s !== null).forEach(s => {
    const ind = trouverIndividuBySosa(String(s));
    if (ind && !inds.find(i => i.personne_id === ind.personne_id)) inds.push(ind);
  });
  // Via epoux / epouse embarqués
  if (acte.epoux?.personne_id) ajouter(acte.epoux.personne_id);
  if (acte.epouse?.personne_id) ajouter(acte.epouse.personne_id);
  // Via maire_officier
  if (acte.maire_officier) ajouter(acte.maire_officier);

  return inds;
}

// ── Récupérer tous les actes liés à un individu ──
function actesDeIndividu(ind) {
  if (!DATA?.actes) return [];
  return DATA.actes.filter(a => {
    if (ind.sosa) {
      if (a.sosa === ind.sosa) return true;
      if (Array.isArray(a.sosa) && a.sosa.includes(ind.sosa)) return true;
    }
    if (ind.personne_id) {
      if (a.personne_id === ind.personne_id) return true;
      if (a.maire_officier === ind.personne_id) return true;
      if ((a.personnes_ids || a.personne_ids || []).includes(ind.personne_id)) return true;
    }
    return false;
  });
}

// ── Tester un texte de recherche sur un item ──
function correspondTexte(r, q) {
  if (!q) return true;

  const tokens = q.split(/\s+/).filter(Boolean); // Chaque mot doit matcher

  const corpus = [];

  if (r._type === 'acte') {
    corpus.push(
      r.acte_id || '', r.type || '', r.lieu_affiche || '',
      r.dept || '', r.depot || r.depot_archives || '',
      r.source?.cote_1 || '', r.source?.cote_2 || '', r.source?.cote_3 || '',
      String(r.sosa || ''), String(r.annee || ''),
    );
    // Ajouter noms des individus liés
    individusDeLActe(r).forEach(ind => {
      corpus.push(ind.nom || '');
      corpus.push(...lireChampPrenoms(ind));
      (ind.aliases_nom || []).forEach(a => corpus.push(a));
    });
  } else {
    corpus.push(
      r.nom || '', r.lieu_naissance_affiche || '', r.dept_naissance || '',
      String(r.sosa || ''), String(r.annee_naissance || ''),
    );
    corpus.push(...lireChampPrenoms(r));
    (r.professions || []).forEach(p => corpus.push(p));
    (r.aliases_nom || []).forEach(a => corpus.push(a));
    (r.aliases_prenom || []).forEach(a => corpus.push(a));
    // Ajouter infos des actes liés
    actesDeIndividu(r).forEach(a => {
      corpus.push(a.lieu_affiche || '', a.dept || '', String(a.annee || ''));
    });
  }

  const texte = corpus.join(' ').toLowerCase();
  return tokens.every(t => texte.includes(t));
}

// ── Tester tous les filtres sur un item ──
function passerFiltres(r, f) {

  const isActe = r._type === 'acte';
  const isInd = r._type === 'individu';

  // ── Recherche texte ──
  if (!correspondTexte(r, f.q)) return false;

  // ── TYPE D'ACTE ──
  // Si filtre type actif → les individus doivent être exclus SAUF si
  // onglet "tous" et qu'on veut montrer tout. 
  // Règle : type d'acte ne s'applique QUE aux actes.
  if (f.type) {
    if (isInd) return false;           // un filtre type => on cache les individus
    if (r.type !== f.type) return false;
  }

  // ── GÉNÉRATION ──
  if (f.gen) {
    const genNum = parseInt(f.gen);
    if (isActe) {
      if (r.generation !== genNum) return false;
    }
    if (isInd) {
      if (r.generation !== genNum) return false;
    }
  }

  // ── PÉRIODE (année) ──
  if (f.annDeb !== null || f.annFin !== null) {
    const annee = isActe
      ? (r.annee || null)
      : (r.annee_naissance || null);
    if (annee !== null) {
      if (f.annDeb !== null && annee < f.annDeb) return false;
      if (f.annFin !== null && annee > f.annFin) return false;
    }
  }

  // ── BRANCHE ──
  if (f.branche) {
    if (r.branche !== f.branche) return false;
  }

  // ── LIGNE ──
  if (f.ligne) {
    if (r.ligne !== f.ligne) return false;
  }

  // ── SEXE ──
  // Pour les actes : chercher parmi les individus liés
  if (f.sexe) {
    if (isInd) {
      if (r.sexe !== f.sexe) return false;
    }
    if (isActe) {
      const inds = individusDeLActe(r).filter(i => i.personne_id !== r.maire_officier);
      // Au moins un individu principal (hors maire) correspond au sexe
      const ok = inds.some(i => i.sexe === f.sexe);
      if (!ok) return false;
    }
  }

  // ── PROFESSION ──
  if (f.prof) {
    if (isInd) {
      if (!(r.professions || []).includes(f.prof)) return false;
    }
    if (isActe) {
      const inds = individusDeLActe(r);
      if (!inds.some(i => (i.professions || []).includes(f.prof))) return false;
    }
  }

  // ── DÉPARTEMENT ──
  if (f.dept) {
    if (isActe) {
      if (r.dept !== f.dept) return false;
    }
    if (isInd) {
      if (r.dept_naissance !== f.dept && r.dept !== f.dept) return false;
    }
  }

  // ── DÉPÔT D'ARCHIVES ──
  if (f.depot) {
    if (isActe) {
      if ((r.source?.depot || '') !== f.depot) return false;
    }
    if (isInd) {
      const actes = actesDeIndividu(r);
      if (!actes.some(a => (a.source?.depot || '') === f.depot)) return false;
    }
  }

  // ── COTE ──
  if (f.cote) {
    if (isActe) {
      const cotes = [
        r.source?.cote_1, r.source?.cote_2, r.source?.cote_3
      ].filter(Boolean).map(c => c.toLowerCase());
      if (!cotes.some(c => c.includes(f.cote))) return false;
    }
    if (isInd) {
      const actes = actesDeIndividu(r);
      const ok = actes.some(a => {
        const cotes = [
          a.source?.cote_1, a.source?.cote_2, a.source?.cote_3
        ].filter(Boolean).map(c => c.toLowerCase());
        return cotes.some(c => c.includes(f.cote));
      });
      if (!ok) return false;
    }
  }

  // ── COMMUNE ──
  if (f.commune) {
    const q = f.commune.toLowerCase();

    if (isActe) {
      // Chercher dans TOUS les champs contenant "lieu" de l'acte
      const valeurs = Object.entries(r)
        .filter(([k]) => k.toLowerCase().includes('lieu'))
        .map(([, v]) => {
          if (typeof v === 'string') return v.toLowerCase();
          if (Array.isArray(v)) return v.join(' ').toLowerCase();
          return '';
        });
      if (!valeurs.some(v => v.includes(q))) return false;
    }

    if (isInd) {
      // 1. Chercher dans les champs lieu_* de l'individu lui-même
      const valeursInd = Object.entries(r)
        .filter(([k]) => k.toLowerCase().includes('lieu'))
        .map(([, v]) => {
          if (typeof v === 'string') return v.toLowerCase();
          if (Array.isArray(v)) return v.join(' ').toLowerCase();
          return '';
        });
      if (valeursInd.some(v => v.includes(q))) return true;

      // 2. Chercher dans les actes liés (tous leurs champs lieu_*)
      const actes = actesDeIndividu(r);
      const okActes = actes.some(a =>
        Object.entries(a)
          .filter(([k]) => k.toLowerCase().includes('lieu'))
          .some(([, v]) => {
            if (typeof v === 'string') return v.toLowerCase().includes(q);
            if (Array.isArray(v)) return v.join(' ').toLowerCase().includes(q);
            return false;
          })
      );
      if (!okActes) return false;
    }
  }

  // ── AVEC DÉCORATION (acte) ──
  if (f.avecDecore) {
    if (isActe) {
      // Chercher si un individu lié est décoré
      const inds = individusDeLActe(r);
      if (!inds.some(i => i.decorations && i.decorations.length > 0)) return false;
    }
    if (isInd) {
      if (!r.decorations || r.decorations.length === 0) return false;
    }
  }

  // ── INDIVIDU DÉCORÉ ──
  if (f.indDecore) {
    if (isInd) {
      if (!r.decorations || r.decorations.length === 0) return false;
    }
    if (isActe) {
      const inds = individusDeLActe(r).filter(i => i.personne_id !== r.maire_officier);
      if (!inds.some(i => i.decorations && i.decorations.length > 0)) return false;
    }
  }

  // ── AVEC CONTRAT DE MARIAGE ──
  if (f.avecContrat) {
    if (isActe) {
      if (r.type !== 'Mariage' || !r.contrat_mariage) return false;
    }
    if (isInd) {
      const actes = actesDeIndividu(r).filter(a => a.type === 'Mariage');
      if (!actes.some(a => a.contrat_mariage)) return false;
    }
  }

  // ── TYPE D'UNION ──
  if (f.typeUnion) {
    if (isActe) {
      if (r.type !== 'Mariage') return false;
      if (f.typeUnion === 'civil' && !r.mariage_civil) return false;
      if (f.typeUnion === 'religieux' && !r.mariage_religieux) return false;
      if (f.typeUnion === 'les-deux'
        && !(r.mariage_civil && r.mariage_religieux)) return false;
    }
    if (isInd) return false;
  }

  return true;
}

// ============================================================
// 15. TRIER
// ============================================================
function trierResultats(resultats, tri) {
  const arr = [...resultats];
  switch (tri) {
    case 'annee-asc':
      return arr.sort((a, b) =>
        (a.annee || a.annee_naissance || 9999) - (b.annee || b.annee_naissance || 9999));
    case 'annee-desc':
      return arr.sort((a, b) =>
        (b.annee || b.annee_naissance || 0) - (a.annee || a.annee_naissance || 0));
    case 'nom-asc':
      return arr.sort((a, b) => (a.nom || '').localeCompare(b.nom || ''));
    case 'nom-desc':
      return arr.sort((a, b) => (b.nom || '').localeCompare(a.nom || ''));
    default:
      return arr;
  }
}

// ============================================================
// 16. RECHERCHE PRINCIPALE
// ============================================================
function lancerRecherche() {
  if (!DATA) { console.warn('DATA pas encore chargée'); return; }

  const f = lireFiltres();

  // ── Construire le pool complet ──
  const pool = [
    ...(DATA.actes || []).map(a => ({ ...a, _type: 'acte' })),
    ...(DATA.individus || []).map(i => ({ ...i, _type: 'individu' })),
  ];

  // ── Appliquer tous les filtres ──
  const resultats = trierResultats(
    pool.filter(r => passerFiltres(r, f)),
    f.tri
  );

  // ── Comptes par onglet ──
  const cntActes = resultats.filter(r => r._type === 'acte').length;
  const cntIndividu = resultats.filter(r => r._type === 'individu').length;
  const cntMaires = resultats.filter(r => {
    if (r._type !== 'individu') return false;
    return obtenirInfoMaireOfficier(r).fonction !== null;
  }).length;
  const cntTous = resultats.length;

  document.getElementById('count-tous').textContent = `(${cntTous})`;
  document.getElementById('count-actes').textContent = `(${cntActes})`;
  document.getElementById('count-individus').textContent = `(${cntIndividu})`;
  document.getElementById('count-maires').textContent = `(${cntMaires})`;

  // ── Filtrer par onglet APRÈS les comptes ──
  let affichage = resultats;
  if (ongletActif === 'actes') affichage = resultats.filter(r => r._type === 'acte');
  if (ongletActif === 'individus') affichage = resultats.filter(r => r._type === 'individu');
  if (ongletActif === 'maires') affichage = resultats.filter(r =>
    r._type === 'individu' && obtenirInfoMaireOfficier(r).fonction !== null
  );

  // ── Compteur ──
  const compteur = document.getElementById('compteur');
  if (compteur) {
    compteur.textContent = `${affichage.length} résultat${affichage.length !== 1 ? 's' : ''}${affichage.length > 0 ? ` sur ${cntTous}` : ''}`;
  }

  // ── Rendu ──
  const zone = document.getElementById('resultats');
  if (!zone) return;

  if (affichage.length === 0) {
    zone.innerHTML = '<p class="vide">Aucun résultat</p>';
    return;
  }

  zone.innerHTML = affichage.map(r =>
    r._type === 'acte' ? carteActe(r) : carteIndividu(r)
  ).join('');
}

// ============================================================
// 17. CHANGER D'ONGLET
// ============================================================
function changerOnglet(nom, element) {
  ongletActif = nom;
  document.querySelectorAll('.onglet').forEach(o => o.classList.remove('actif'));
  element.classList.add('actif');
  lancerRecherche();
}

// ============================================================
// 18. RÉINITIALISER LES FILTRES
// ============================================================
function reinitialiser() {
  const resets = {
    'filtre-type': '', 'filtre-generation': '', 'filtre-annee-debut': '',
    'filtre-annee-fin': '', 'filtre-branche': '', 'filtre-ligne': '',
    'filtre-sexe': '', 'filtre-profession': '', 'filtre-dept': '',
    'filtre-depot': '', 'filtre-cote': '', 'filtre-commune': '',
    'filtre-type-union': '', 'filtre-tri': 'pertinence',
    'input-recherche': '',
  };
  const checkboxes = [
    'filtre-individu-decore',
    'filtre-avec-decoration', 'filtre-avec-contrat',
  ];

  Object.entries(resets).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.value = val;
  });
  checkboxes.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.checked = false;
  });

  lancerRecherche();
}

// ============================================================
// 19. DÉMARRAGE
// ============================================================
document.addEventListener('DOMContentLoaded', () => {
  console.log('✓ DOM chargé');
  chargerDonnees();

  const onInput = (id, delay = 0) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('input', () => {
      if (delay) { clearTimeout(timerInput); timerInput = setTimeout(lancerRecherche, delay); }
      else lancerRecherche();
    });
  };
  const onChange = (id) => {
    document.getElementById(id)?.addEventListener('change', lancerRecherche);
  };

  // Champs texte avec délai
  onInput('input-recherche', 200);
  onInput('filtre-commune', 200);
  onInput('filtre-cote', 200);

  // Selects et checkboxes
  ['filtre-type', 'filtre-generation', 'filtre-annee-debut', 'filtre-annee-fin',
    'filtre-branche', 'filtre-ligne', 'filtre-sexe', 'filtre-profession',
    'filtre-dept', 'filtre-depot', 'filtre-type-union', 'filtre-tri',
    'filtre-individu-decore',
    'filtre-avec-decoration', 'filtre-avec-contrat',
  ].forEach(onChange);
});
