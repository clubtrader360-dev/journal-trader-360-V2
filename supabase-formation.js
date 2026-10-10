/**
 * ESPACE FORMATION : sommaire, module, leçon.
 *
 * ── ⚠️ POURQUOI CE N'EST PAS UNE AUTRE PAGE ───────────────────────────────────
 *
 * Le journal est une application MONO-PAGE : tout vit dans `index.html`, et
 * `showSection(nom)` affiche `#nom` en masquant les autres `.section`. La barre
 * latérale est écrite une seule fois.
 *
 * ⛔ UNE SECONDE PAGE AURAIT DÛ DUPLIQUER CETTE BARRE, et c'est exactement le
 * piège déjà rencontré sur le dépôt du site : deux copies qui divergent, l'une
 * disant « Connexion » quand l'autre dit « Espace membre ». La formation est donc
 * une section de plus, pas un second document. Zéro duplication, par construction.
 *
 * ⚠️ ET L'AUTHENTIFICATION EST RÉGLÉE DU MÊME COUP. `supabase-auth.js` masque
 * `#mainApp` et montre `#authScreen` tant qu'il n'y a pas de session. La formation
 * vit dans `#mainApp` : elle est protégée par le même verrou, sans une ligne de
 * code en plus. ⛔ Ne construis aucune authentification séparée : la décision de
 * Nadir est que l'identifiant du journal soit celui de la formation.
 *
 * ── ⚠️ LA REPRISE DE LECTURE EST CELLE DES REPLAYS, PAS UNE SECONDE ──────────
 *
 * `supabase-replays-student.js` fait déjà exactement cela. Le mécanisme est repris
 * à l'identique, et les trois points qui comptent sont relevés chez lui :
 *
 *   1. `setCurrentTime(progress_seconds)` une fois le lecteur prêt, et SEULEMENT
 *      si la position est supérieure à zéro.
 *   2. `timeupdate` se déclenche plusieurs fois par seconde. Il est espacé par un
 *      garde `now - dernier < 10000`. ⛔ Sans lui, une minute de lecture écrirait
 *      des centaines de lignes et rien ne le signalerait.
 *   3. Une écriture de plus à la fermeture, pour ne pas perdre les secondes
 *      écoulées depuis la dernière.
 *
 * ⚠️ UNE SEULE CHOSE DIVERGE, ET C'EST VOULU. Les replays déduisent `completed`
 * de 90 % de durée écoulée. Ici, `vue` est une case que l'élève coche : une leçon
 * ouverte puis laissée de côté serait comptée comme vue, et l'élève perdrait
 * confiance dans sa propre barre de progression.
 *
 * ── ⚠️ LES NOTES NE SONT JAMAIS DANS `localStorage` SEUL ─────────────────────
 * Un élève qui change d'ordinateur perdrait tout, et ne le découvrirait que le
 * jour où c'est trop tard. Elles vont dans `formation_notes`, avec RLS.
 */
(function () {
  'use strict';

  const ESPACEMENT_MS = 10000;   // Même valeur que supabase-replays-student.js.
  const DELAI_SAISIE_MS = 1200;  // Repos de frappe avant d'enregistrer une note.

  let _vue = 'sommaire';
  let _moduleCourant = null;
  let _leconCourante = null;
  let _progression = {};         // lecon_id -> { vue, progress_seconds }
  let _notes = {};               // lecon_id -> texte
  let _minuterieNote = null;
  let _derniereEcriture = 0;
  let _lecteur = null;

  const $ = (id) => document.getElementById(id);
  const D = () => window.FormationDonnees;

  async function uid() {
    try {
      const { data } = await supabase.auth.getUser();
      return data?.user?.id || null;
    } catch { return null; }
  }

  /** Échappe le texte avant insertion : un titre venu de LearnyBox n'est pas du HTML. */
  function txt(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  }

  // ===== CHARGEMENT =========================================================

  async function charger() {
    const u = await uid();
    if (!u) return;
    const [p, n] = await Promise.all([
      supabase.from('formation_progression').select('lecon_id, vue, progress_seconds').eq('user_id', u),
      supabase.from('formation_notes').select('lecon_id, texte').eq('user_id', u),
    ]);
    _progression = {};
    (p.data || []).forEach((r) => { _progression[r.lecon_id] = r; });
    _notes = {};
    (n.data || []).forEach((r) => { _notes[r.lecon_id] = r.texte; });
    if (p.error) console.warn('[FORMATION] progression illisible :', p.error.message);
    if (n.error) console.warn('[FORMATION] notes illisibles :', n.error.message);
  }

  // ===== PROGRESSION ========================================================

  const estVue = (id) => !!(_progression[id] && _progression[id].vue);

  function avancement(mod) {
    const total = mod.lecons.length;
    return { total, faites: mod.lecons.filter((l) => estVue(l.id)).length };
  }

  /** La leçon à reprendre : la première non vue dans l'ordre. `null` si tout est vu. */
  function reprise() {
    return D().SUITE.find((l) => !estVue(l.id)) || null;
  }

  async function ecrireProgression(leconId, champs) {
    const u = await uid();
    if (!u) return;
    const avant = _progression[leconId] || { vue: false, progress_seconds: 0 };
    const ligne = {
      user_id: u,
      lecon_id: leconId,
      vue: champs.vue !== undefined ? champs.vue : avant.vue,
      progress_seconds: champs.progress_seconds !== undefined ? champs.progress_seconds : avant.progress_seconds,
      last_watched_at: new Date().toISOString(),
    };
    _progression[leconId] = ligne;
    const { error } = await supabase.from('formation_progression')
      .upsert(ligne, { onConflict: 'user_id,lecon_id' });
    // ⛔ Dit en clair : une écriture qui échoue en silence est le défaut dominant
    // de ce projet. L'élève doit pouvoir le signaler, et nous le retrouver.
    if (error) console.error('[FORMATION] ⚠️ progression NON enregistrée :', error.message);
  }

  // ===== NOTES ==============================================================

  async function ecrireNote(leconId, texte) {
    const u = await uid();
    if (!u) return false;
    const { error } = await supabase.from('formation_notes').upsert({
      user_id: u, lecon_id: leconId, texte, updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,lecon_id' });
    if (error) { console.error('[FORMATION] ⚠️ note NON enregistrée :', error.message); return false; }
    _notes[leconId] = texte;
    return true;
  }

  function repere(etat) {
    const el = $('formationNoteEtat');
    if (!el) return;
    const libelles = { repos: '', ecrit: 'Enregistrement…', ok: 'Enregistré', faute: "⚠️ Non enregistré" };
    el.textContent = libelles[etat] || '';
    el.dataset.etat = etat;
  }

  // ===== RENDU : SOMMAIRE ===================================================

  function rendreSommaire() {
    _vue = 'sommaire';
    const mods = D().MODULES;
    const total = D().total();
    const faites = D().SUITE.filter((l) => estVue(l.id)).length;
    const r = reprise();

    $('formationFilAriane').innerHTML = '<span class="formation-fil-actif">Sommaire</span>';
    $('formationContenu').innerHTML = `
      <div class="formation-entete">
        <div class="formation-progression-globale">
          <div class="formation-barre" role="progressbar" aria-valuemin="0" aria-valuemax="${total}"
               aria-valuenow="${faites}" aria-label="Progression dans la formation">
            <div class="formation-barre-remplie" style="width:${total ? (faites / total) * 100 : 0}%"></div>
          </div>
          <p class="formation-compteur">${faites} leçon${faites > 1 ? 's' : ''} sur ${total}</p>
        </div>
        ${r ? `<button type="button" class="formation-btn-or" onclick="Formation.ouvrirLecon('${r.id}')">
                 Reprendre : ${txt(r.titre)}
               </button>`
            : '<p class="formation-compteur">Toutes les leçons disponibles sont vues.</p>'}
      </div>
      <div class="formation-grille">
        ${mods.map((m) => {
          const a = avancement(m);
          const vide = a.total === 0;
          return `
          <article class="trader-card formation-carte${vide ? ' formation-carte-vide' : ''}"
                   ${vide ? '' : `tabindex="0" role="button" onclick="Formation.ouvrirModule('${m.numero}')"
                   onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();Formation.ouvrirModule('${m.numero}')}"`}>
            <div class="formation-carte-numero">Module ${txt(m.numero)}</div>
            <h3 class="formation-carte-titre">${txt(m.titre)}</h3>
            ${vide
              ? '<p class="formation-carte-vide-texte">Leçons à venir</p>'
              : `<div class="formation-barre formation-barre-fine">
                   <div class="formation-barre-remplie" style="width:${(a.faites / a.total) * 100}%"></div>
                 </div>
                 <p class="formation-carte-compteur">${a.faites} / ${a.total} leçon${a.total > 1 ? 's' : ''}</p>`}
          </article>`;
        }).join('')}
      </div>`;
  }

  // ===== RENDU : MODULE =====================================================

  function rendreModule(numero) {
    const m = D().module(numero);
    if (!m) return rendreSommaire();
    _vue = 'module';
    _moduleCourant = numero;
    const a = avancement(m);

    $('formationFilAriane').innerHTML =
      `<button type="button" class="formation-fil-lien" onclick="Formation.ouvrirSommaire()">Sommaire</button>
       <span class="formation-fil-sep" aria-hidden="true">/</span>
       <span class="formation-fil-actif">Module ${txt(numero)}</span>`;

    $('formationContenu').innerHTML = `
      <div class="formation-entete">
        <div class="formation-carte-numero">Module ${txt(m.numero)}</div>
        <h2 class="formation-titre">${txt(m.titre)}</h2>
        <div class="formation-barre" role="progressbar" aria-valuemin="0" aria-valuemax="${a.total}"
             aria-valuenow="${a.faites}" aria-label="Progression dans le module">
          <div class="formation-barre-remplie" style="width:${a.total ? (a.faites / a.total) * 100 : 0}%"></div>
        </div>
        <p class="formation-compteur">${a.faites} / ${a.total} leçon${a.total > 1 ? 's' : ''}</p>
      </div>
      <ol class="formation-liste">
        ${m.lecons.map((l, i) => `
          <li>
            <button type="button" class="formation-lecon-ligne" onclick="Formation.ouvrirLecon('${l.id}')">
              <span class="formation-lecon-etat${estVue(l.id) ? ' formation-lecon-vue' : ''}" aria-hidden="true">
                ${estVue(l.id) ? '✓' : i + 1}
              </span>
              <span class="formation-lecon-titre">${txt(l.titre)}</span>
              <span class="formation-lecon-badge">${estVue(l.id) ? 'Vue' : ''}</span>
            </button>
          </li>`).join('')}
      </ol>`;
  }

  // ===== RENDU : LEÇON ======================================================

  function rendreLecon(id) {
    const l = D().lecon(id);
    if (!l) return rendreSommaire();
    _vue = 'lecon';
    _leconCourante = id;
    const m = D().module(l.module);
    const suivante = D().suivante(id);

    $('formationFilAriane').innerHTML =
      `<button type="button" class="formation-fil-lien" onclick="Formation.ouvrirSommaire()">Sommaire</button>
       <span class="formation-fil-sep" aria-hidden="true">/</span>
       <button type="button" class="formation-fil-lien" onclick="Formation.ouvrirModule('${l.module}')">Module ${txt(l.module)}</button>
       <span class="formation-fil-sep" aria-hidden="true">/</span>
       <span class="formation-fil-actif">${txt(l.titre)}</span>`;

    /* ⚠️ L'ORDRE DES BLOCS N'EST PAS DÉCORATIF : titre, description, vidéo, notes.
       On lit ce qu'on va voir avant de le voir, et on prend ses notes sous la
       vidéo, pas ailleurs. */
    $('formationContenu').innerHTML = `
      <article class="formation-lecon">
        <div class="formation-carte-numero">Module ${txt(l.module)} · ${txt(m ? m.titre : '')}</div>
        <h2 class="formation-titre">${txt(l.titre)}</h2>

        <div class="formation-description">
          ${l.description
            ? txt(l.description)
            : '<em>La description de cette leçon sera versée depuis LearnyBox.</em>'}
        </div>

        <div class="formation-video" id="formationVideo">
          ${l.video
            ? `<iframe src="https://player.vimeo.com/video/${txt(l.video)}" title="${txt(l.titre)}"
                 allow="autoplay; fullscreen; picture-in-picture" allowfullscreen loading="lazy"></iframe>`
            : `<div class="formation-video-attente">
                 <p><strong>La vidéo n'est pas encore posée.</strong></p>
                 <p>Elle attend la décision de Nadir sur la restriction d'intégration Vimeo.
                    L'emplacement, la reprise de lecture et les notes fonctionnent sans elle.</p>
               </div>`}
        </div>

        <div class="formation-vue-ligne">
          <label class="formation-case">
            <input type="checkbox" id="formationVue" ${estVue(id) ? 'checked' : ''}
                   onchange="Formation.basculerVue('${id}', this.checked)">
            <span>J'ai vu cette leçon</span>
          </label>
          <span class="formation-compteur">Tu coches toi-même : rien n'est déduit du temps de lecture.</span>
        </div>

        <section class="formation-notes">
          <div class="formation-notes-entete">
            <h3>Mes notes</h3>
            <span id="formationNoteEtat" class="formation-note-etat" role="status" aria-live="polite"></span>
          </div>
          <textarea id="formationNote" data-mic-dictation="true" rows="8"
            placeholder="Tes notes sur cette leçon. Elles s'enregistrent toutes seules."
            aria-label="Notes personnelles sur cette leçon">${txt(_notes[id] || '')}</textarea>
        </section>

        <div class="formation-suite">
          <button type="button" class="formation-btn-fantome" onclick="Formation.ouvrirModule('${l.module}')">
            Retour au module
          </button>
          ${suivante
            ? `<button type="button" class="formation-btn-or" onclick="Formation.ouvrirLecon('${suivante.id}')">
                 Leçon suivante : ${txt(suivante.titre)}
               </button>`
            : ''}
        </div>
      </article>`;

    brancherNotes(id);
    brancherLecteur(id);
    // La dictée vocale existe déjà dans le journal ; on la rattache au DOM neuf.
    if (window.MicDictation) window.MicDictation.scan($('formationContenu'));
  }

  // ===== BRANCHEMENTS =======================================================

  function brancherNotes(id) {
    const z = $('formationNote');
    if (!z) return;
    z.addEventListener('input', () => {
      repere('ecrit');
      clearTimeout(_minuterieNote);
      _minuterieNote = setTimeout(async () => {
        repere(await ecrireNote(id, z.value) ? 'ok' : 'faute');
      }, DELAI_SAISIE_MS);
    });
    // ⚠️ Et une écriture de plus au départ : fermer l'onglet pendant le repos de
    // frappe perdrait la dernière phrase, sans qu'aucune erreur ne le signale.
    z.addEventListener('blur', () => {
      clearTimeout(_minuterieNote);
      if ((_notes[id] || '') !== z.value) ecrireNote(id, z.value).then((ok) => repere(ok ? 'ok' : 'faute'));
    });
  }

  /**
   * Arme la reprise de lecture. ⚠️ Repris de `supabase-replays-student.js`, pas
   * réécrit : même garde d'espacement, même `setCurrentTime`, même écriture à la
   * fermeture. `window.Vimeo` n'existe que lorsqu'une vidéo est réellement posée.
   */
  function brancherLecteur(id) {
    detacherLecteur();
    const cadre = $('formationVideo') && $('formationVideo').querySelector('iframe');
    if (!cadre || !window.Vimeo) return;

    _lecteur = new window.Vimeo.Player(cadre);
    _derniereEcriture = 0;
    const depart = (_progression[id] || {}).progress_seconds || 0;

    _lecteur.ready().then(() => {
      // ⛔ Seulement si la position est connue ET non nulle : appeler
      // setCurrentTime(0) marcherait aussi, mais masquerait une donnée absente
      // derrière un comportement identique à une reprise au début.
      if (depart > 0) _lecteur.setCurrentTime(depart);
    });

    _lecteur.on('timeupdate', ({ seconds }) => {
      const now = Date.now();
      if (now - _derniereEcriture < ESPACEMENT_MS) return;
      _derniereEcriture = now;
      ecrireProgression(id, { progress_seconds: Math.floor(seconds) });
    });
  }

  async function detacherLecteur() {
    if (!_lecteur) return;
    const id = _leconCourante;
    try {
      const s = await _lecteur.getCurrentTime();
      if (id) await ecrireProgression(id, { progress_seconds: Math.floor(s) });
      _lecteur.destroy();
    } catch (e) { console.warn('[FORMATION] lecteur :', e && e.message); }
    _lecteur = null;
  }

  // ===== API ================================================================

  const Formation = {
    async ouvrir() {
      await charger();
      rendreSommaire();
    },
    ouvrirSommaire() { detacherLecteur(); rendreSommaire(); },
    ouvrirModule(n) { detacherLecteur(); rendreModule(n); },
    ouvrirLecon(id) { detacherLecteur(); rendreLecon(id); },
    async basculerVue(id, vue) { await ecrireProgression(id, { vue }); },
    // Exposés pour la sonde : ⛔ ne pas les appeler depuis l'interface.
    _etat: () => ({ vue: _vue, module: _moduleCourant, lecon: _leconCourante }),
    _progression: () => _progression,
    _espacementMs: ESPACEMENT_MS,
    _brancherLecteur: brancherLecteur,
    _detacherLecteur: detacherLecteur,
  };

  window.Formation = Formation;
})();
