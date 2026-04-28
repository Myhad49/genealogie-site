// ============================================================
//  individu.js — Fiche individu dynamique
// ============================================================

async function chargerFiche() {
  // Lire l'ID dans l'URL  ex: individu.html?id=IND-0001
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  if (!id) {
    document.getElementById('contenu').innerHTML =
      '<p class="vide">⚠️ Aucun identifiant fourni.</p>';
    return;
  }

  // Charger le JSON
  const reponse = await fetch('/data/index.json');
  const DATA = await reponse.json();

  // Trouver l'individu
  const ind = DATA.individus.find(i => i.personne_id === id);

  if (!ind) {
    document.getElementById('contenu').innerHTML =
      `<p class="vide">⚠️ Individu "${id}" introuvable.</p>`;
    return;
  }

  // Titre de page
  document.title = `${ind.nom} ${ind.prenom} — Généalogie`;
  document.getElementById('header-titre').textContent =
    `${ind.nom} ${ind.prenom}`;

  // Trouver tous les actes liés
  const actesLies = DATA.actes.filter(a =>
    (ind.actes || []).includes(a.acte_id)
  );

  // Trouver conjoint, père, mère
  const conjoint = DATA.individus.find(i => i.personne_id === ind.conjoint_id);
  const pere     = DATA.individus.find(i => i.personne_id === ind.pere_id);
  const mere     = DATA.individus.find(i => i.personne_id === ind.mere_id);

  // Construction HTML
  let html = `
    <div class="fiche">
      <h2>${ind.nom} ${ind.prenom}</h2>
      ${ind.sosa ? `<div class="sosa">Sosa ${ind.sosa} — Génération ${ind.generation} — Branche ${ind.branche}</div>` : ''}

      <div class="infos">
        <div class="info-bloc">
          <div class="info-label">Naissance</div>
          <div class="info-val">${ind.date_naissance || '—'}</div>
          <div>${ind.lieu_naissance || ''}</div>
        </div>
        <div class="info-bloc">
          <div class="info-label">Décès</div>
          <div class="info-val">${ind.date_deces || '—'}</div>
          <div>${ind.lieu_deces || ''}</div>
        </div>
        <div class="info-bloc">
          <div class="info-label">Profession(s)</div>
          <div class="info-val">${(ind.professions||[]).join(', ') || '—'}</div>
        </div>
        <div class="info-bloc">
          <div class="info-label">Conjoint</div>
          <div class="info-val">
            ${conjoint
              ? `<a href="/genealogie-site/individu.html?id=${conjoint.personne_id}">
                   ${conjoint.nom} ${conjoint.prenom}
                 </a>`
              : '—'}
          </div>
        </div>
        <div class="info-bloc">
          <div class="info-label">Père</div>
          <div class="info-val">
            ${pere
              ? `<a href="/genealogie-site/individu.html?id=${pere.personne_id}">
                   ${pere.nom} ${pere.prenom}
                 </a>`
              : '—'}
          </div>
        </div>
        <div class="info-bloc">
          <div class="info-label">Mère</div>
          <div class="info-val">
            ${mere
              ? `<a href="/genealogie-site/individu.html?id=${mere.personne_id}">
                   ${mere.nom} ${mere.prenom}
                 </a>`
              : '—'}
          </div>
        </div>
      </div>
    </div>`;

  // Actes liés
  html += `<h3>📄 Actes liés (${actesLies.length})</h3>`;

  if (actesLies.length === 0) {
    html += '<p class="vide">Aucun acte lié.</p>';
  } else {
    actesLies.forEach(a => {
      html += `
        <div class="acte-ligne">
          <div>
            <span class="acte-type type-${a.type}">${a.type}</span>
            <strong>${a.date_affichee || a.date}</strong>
            — ${a.lieu}, ${a.dept}
            ${a.source ? `<small style="color:#999"> — ${a.source.depot} ${a.source.cote}</small>` : ''}
          </div>
          <a class="btn" href="${a.url}">Voir →</a>
        </div>`;
    });
  }

  document.getElementById('contenu').innerHTML = html;
}

chargerFiche();
