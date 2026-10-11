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

  /**
   * ── ⛔ LE CLIENT EST `window.supabaseClient`, PAS `window.supabase` ────────
   *
   * ⚠️ C'EST LE DEFAUT QUI A FAIT DIRE A NADIR, AVEC SES DEUX DROITS, QU IL
   * N OUVRAIT AUCUN DES DEUX ESPACES. Mesure du 11/10/2026, dans le navigateur :
   *
   *     window.supabase        la BIBLIOTHEQUE UMD du CDN
   *                            cles : createClient, SupabaseClient, Functions*
   *                            .auth  absent      .from  undefined
   *     window.supabaseClient  le CLIENT, avec .auth et .from
   *
   * Ce fichier lisait le global nu `supabase`. `cli().auth.getUser()` levait
   * donc une exception, le `try/catch` la rattrapait, et `uid` valait null : le
   * code concluait « aucune session » et affichait l absence de droits.
   *
   * ⛔ ET MES SONDES NE POUVAIENT PAS LE VOIR : elles remplacaient
   * `window.supabase` par un double qui, lui, portait `.auth` et `.from`. Le banc
   * d essai rendait vrai le global fautif. ⚠️ Un double qui repare ce qu il devait
   * eprouver est pire qu absent : il rend un rapport vert sur du code casse.
   * Les deux sondes doublent desormais `window.supabaseClient`.
   *
   * Tous les autres modules du depot font exactement cette ligne. Cette fois, ce
   * fichier aussi.
   */
  /**
   * ⚠️ RESOLU A CHAQUE APPEL, PAS CAPTURE AU CHARGEMENT. Deux raisons :
   *   1. Plus de dependance a l ordre des scripts. `supabase-config.js` pose
   *      `window.supabaseClient` ; si un jour il le posait plus tard, ce fichier
   *      garderait une reference morte sans que rien ne le signale.
   *   2. ⛔ C est ce qui rend ce fichier EPROUVABLE. Un double pose apres le
   *      chargement est pris en compte ; une reference capturee ne l aurait
   *      jamais ete, et la sonde aurait mesure le vrai client en croyant mesurer
   *      le sien.
   */
  const cli = () => {
    const c = window.supabaseClient;
    if (!c) console.error('[FORMATION] ⛔ window.supabaseClient manquant : config non chargee ?');
    return c;
  };

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
      const { data } = await cli().auth.getUser();
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
      cli().from('formation_progression').select('lecon_id, vue, progress_seconds').eq('user_id', u),
      cli().from('formation_notes').select('lecon_id, texte').eq('user_id', u),
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
    const { error } = await cli().from('formation_progression')
      .upsert(ligne, { onConflict: 'user_id,lecon_id' });
    // ⛔ Dit en clair : une écriture qui échoue en silence est le défaut dominant
    // de ce projet. L'élève doit pouvoir le signaler, et nous le retrouver.
    if (error) console.error('[FORMATION] ⚠️ progression NON enregistrée :', error.message);
  }

  // ===== NOTES ==============================================================

  async function ecrireNote(leconId, texte) {
    const u = await uid();
    if (!u) return false;
    const { error } = await cli().from('formation_notes').upsert({
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

  /** Minutes et secondes lisibles. ⛔ Jamais des secondes brutes a l ecran. */
  function duree(s) {
    const n = Math.max(0, Math.floor(Number(s) || 0));
    const m = Math.floor(n / 60);
    return m >= 1 ? `${m} min` : `${n} s`;
  }

  /**
   * ── ⚠️ LA REPRISE PRECISE, ET LE CAS « JAMAIS COMMENCE » ─────────────────
   *
   * Rend le module, la lecon et la position, ou `null` si l eleve n a RIEN
   * ouvert. ⛔ Un « reprendre a 0 min » sur une formation jamais commencee est
   * faux et decourageant : dans ce cas on invite a commencer, on ne reprend pas.
   *
   * ⚠️ « Rien ouvert » se mesure sur la PROGRESSION ENREGISTREE, pas sur la
   * structure : une lecon vue sans position, ou une position sans vue, comptent
   * toutes les deux comme un debut.
   */
  function reprisePrecise() {
    let meilleure = null;
    for (const l of D().SUITE) {
      const p = _progression[l.id];
      if (!p) continue;
      if (!p.vue && !(p.progress_seconds > 0)) continue;
      const quand = p.last_watched_at ? Date.parse(p.last_watched_at) : 0;
      if (!meilleure || quand >= meilleure.quand) meilleure = { lecon: l, p, quand };
    }
    if (!meilleure) return null;
    const m = D().module(meilleure.lecon.module);
    const rang = m ? m.lecons.findIndex((x) => x.id === meilleure.lecon.id) + 1 : 0;
    return {
      lecon: meilleure.lecon,
      module: meilleure.lecon.module,
      rang,
      secondes: meilleure.p.progress_seconds || 0,
    };
  }

  /**
   * ── ⚠️ LE POURCENTAGE : POURQUOI IL NE S AFFICHE PAS ENCORE ──────────────
   *
   * ⛔ LE PIEGE EST REEL. Seul le module 01 porte ses lecons. Un pourcentage
   * calcule sur cette structure partielle dirait « 0 sur 7 » et laisserait croire
   * que la formation fait sept lecons. Elle en fera soixante-quatre. Le jour ou
   * les autres modules seront remplis, la progression de chacun s effondrerait
   * sans explication, et ⛔ RIEN NE LE SIGNALERAIT.
   *
   * ⚠️ DEUX SORTIES ETAIENT POSSIBLES, ET LA PREMIERE EST FERMEE AUJOURD HUI.
   * Compter toutes les lecons PREVUES supposerait de savoir combien chaque module
   * en portera, donc de poser la correspondance entre les dix modules du site et
   * les onze dossiers Vimeo. ⛔ Cette correspondance n est pas arbitree : le
   * module 10 n a aucun dossier, et le `7BIS` aucun module. L ecrire ici serait
   * inventer ce que le lot interdit d inventer.
   *
   * La seconde sortie est donc retenue : TANT QUE LA STRUCTURE EST INCOMPLETE, le
   * pourcentage ne s affiche pas, et la mention dit pourquoi. Le compte de lecons
   * reste affiche, lui, parce qu il est vrai.
   *
   * ⚠️ `structureComplete()` bascule toute seule le jour ou les dix modules
   * porteront des lecons : aucune intervention, aucun oubli possible.
   */
  function structureComplete() {
    return D().MODULES.every((m) => m.lecons.length > 0);
  }

  function rendreSommaire() {
    _vue = 'sommaire';
    const mods = D().MODULES;
    const total = D().total();
    const faites = D().SUITE.filter((l) => estVue(l.id)).length;
    const r = reprisePrecise();
    const complete = structureComplete();
    const pct = total ? Math.round((faites / total) * 100) : 0;
    const modulesFaits = mods.filter((m) => m.lecons.length > 0
      && m.lecons.every((l) => estVue(l.id))).length;

    $('formationFilAriane').innerHTML = '<span class="formation-fil-actif">Sommaire</span>';
    $('formationContenu').innerHTML = `
      ${citation()}

      <div class="formation-entete">
        <div class="formation-barre" role="progressbar" aria-valuemin="0" aria-valuemax="${total}"
             aria-valuenow="${faites}" aria-label="Progression dans la formation">
          <div class="formation-barre-remplie" style="width:${total ? (faites / total) * 100 : 0}%"></div>
        </div>
        <p class="formation-compteur">
          ${faites} leçon${faites > 1 ? 's' : ''} sur ${total}
          ${complete
            ? ` · <strong>${pct} %</strong>`
            : ' · <span class="formation-mention">le pourcentage s\'affichera quand les dix modules seront remplis</span>'}
        </p>

        ${r
          ? `<p class="formation-reprise-ou">Tu en es à
               <strong>Module ${txt(r.module)} · leçon ${r.rang} · à ${duree(r.secondes)}</strong></p>
             <button type="button" class="formation-btn-or" onclick="Formation.ouvrirLecon('${r.lecon.id}')">
               Reprendre : ${txt(r.lecon.titre)}
             </button>`
          : `<p class="formation-reprise-ou">Tu n'as pas encore commencé.</p>
             ${D().SUITE.length
               ? `<button type="button" class="formation-btn-or" onclick="Formation.ouvrirLecon('${D().SUITE[0].id}')">
                    Commencer : ${txt(D().SUITE[0].titre)}
                  </button>`
               : ''}`}

        <p class="formation-compteur">
          ${modulesFaits} module${modulesFaits > 1 ? 's' : ''} terminé${modulesFaits > 1 ? 's' : ''}
          · <button type="button" class="formation-lien" onclick="Formation.ouvrirNotes()">Toutes mes notes</button>
        </p>
      </div>

      ${parcours(r)}

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

  /**
   * ── ⚠️ LA CITATION VIENT DE LA MEME SOURCE QUE CELLE DU JOURNAL ──────────
   *
   * `#mantraContainer` du journal lit `localStorage.userMantra` et
   * `localStorage.userMantraAuthor`, posees par `saveMantra()`. On relit LES
   * MEMES CLES. ⛔ Aucune seconde source : deux systemes de citation dans la meme
   * application divergeraient, et celui qu on ne regarde pas deviendrait faux.
   *
   * ⚠️ C EST DONC LA CITATION DE L ELEVE, celle qu il a choisie dans son journal,
   * et non une autre. Cela se defend : la formation est son espace, pas une
   * vitrine. ⛔ Mais c est un choix, et il revient a Nadir de le confirmer.
   *
   * ⚠️ ET UN CONSTAT QUI N EST PAS DE MON RESSORT : cette source est
   * `localStorage` SEUL. La citation d un eleve ne le suit donc pas d un appareil
   * a l autre, et un eleve qui n a que la formation n en aura jamais aucune, ne
   * passant pas par le journal pour la saisir. Rapporte, pas corrige : changer la
   * source toucherait le journal, hors perimetre de ce lot.
   */
  function citation() {
    let texte = '';
    let auteur = '';
    try {
      texte = localStorage.getItem('userMantra') || '';
      auteur = localStorage.getItem('userMantraAuthor') || '';
    } catch { texte = ''; }
    /**
     * ⚠️ UNE CITATION PAR DÉFAUT, PARCE QUE L'ABSENCE PRODUIRAIT UN VIDE.
     * Un élève qui n'a que la formation ne passe jamais par le journal pour en
     * saisir une : sans ce repli, il n'en verrait jamais aucune.
     *
     * ⛔ CE N'EST PAS UNE SECONDE SOURCE DE PERSONNALISATION. Si l'élève a la
     * sienne, c'est la sienne qui s'affiche ; celle-ci ne s'écrit nulle part et
     * ne se règle pas.
     *
     * ⛔ ET ELLE NE PROMET RIEN. Ni gain, ni revenu, ni réussite, ni
     * financement, comme les dix phrases du parcours. Elle parle de méthode.
     */
    if (!texte) {
      texte = 'La régularité bat l\'intensité : une leçon comprise vaut mieux que dix survolées.';
      auteur = 'Trader 360';
    }
    return `
      <figure class="trader-card formation-citation">
        <i class="fas fa-quote-left" aria-hidden="true"></i>
        <blockquote>${txt(texte)}</blockquote>
        ${auteur ? `<figcaption>${txt(auteur)}</figcaption>` : ''}
      </figure>`;
  }

  /**
   * ── ⚠️ LE PARCOURS : UN CHEMIN QUI MONTE, PAS UNE BARRE ──────────────────
   *
   * Dix jalons, du bas vers le haut, et le trace rempli jusqu ou l eleve en est.
   *
   * ⚠️ IL MONTE, DONC IL EST VERTICAL, ET C EST AUSSI CE QUI LE REND MOBILE.
   * Un trace horizontal a dix etapes ne tient pas en 390 pixels : il deborderait
   * ou deviendrait illisible. Vertical, il tient a toutes les largeurs sans
   * point de rupture a maintenir, et il monte vraiment.
   *
   * ⛔ CE NE SONT PAS LES SEPT ETAPES DU SITE VITRINE. `trader360.fr` porte une
   * section « Sept etapes pour reussir », qui est un discours commercial. Ici ce
   * sont LES DIX MODULES. Les melanger donnerait un parcours qui ne ressemble a
   * aucun des deux.
   *
   * ⚠️ LE TRACE VIDE NE DOIT PAS RESSEMBLER A UNE ERREUR D AFFICHAGE, et c est
   * pourtant ce que verra CHAQUE NOUVEL ELEVE, puisque « formation sans journal »
   * est le cas normal a l arrivee. Le rail est donc toujours dessine en entier,
   * avec ses dix jalons visibles, et seul le remplissage varie.
   */
  function parcours(r) {
    const mods = D().MODULES;
    const atteint = r ? mods.findIndex((m) => m.numero === r.module) : -1;
    const faitsParModule = mods.map((m) => m.lecons.length > 0
      && m.lecons.every((l) => estVue(l.id)));
    const dernierFait = faitsParModule.lastIndexOf(true);
    const courant = Math.max(atteint, dernierFait, 0);
    const rempli = mods.length > 1 ? (courant / (mods.length - 1)) * 100 : 0;
    const phrase = r || dernierFait >= 0
      ? (D().PHRASES[mods[courant].numero] || '')
      : D().PHRASES.depart;

    return `
      <section class="formation-parcours" aria-label="Ton parcours">
        <p class="formation-parcours-phrase">${txt(phrase)}</p>
        <ol class="formation-rail" style="--rempli:${rempli}%">
          ${mods.slice().reverse().map((m, i) => {
            const idx = mods.length - 1 - i;
            const fait = faitsParModule[idx];
            const ici = idx === courant && (r || dernierFait >= 0);
            return `
            <li class="formation-jalon${fait ? ' formation-jalon-fait' : ''}${ici ? ' formation-jalon-ici' : ''}">
              <span class="formation-jalon-pastille" aria-hidden="true">${fait ? '✓' : m.numero}</span>
              <span class="formation-jalon-titre">${txt(m.titre)}</span>
            </li>`;
          }).join('')}
        </ol>
      </section>`;
  }

  /**
   * ── ⚠️ TOUTES LES NOTES AU MEME ENDROIT ──────────────────────────────────
   *
   * ⛔ PAS UN MENU DEROULANT, et c est delibere. Soixante-quatre notes dans un
   * menu est inutilisable : on ne lit rien, on ne cherche rien, et l extrait
   * disparait des qu on referme. Le besoin reel est de RETROUVER une note, de
   * savoir d ou elle vient et d y sauter. Une liste filtrable sert les trois ; un
   * menu n en sert aucun.
   *
   * ⛔ LECTURE SEULE ICI. Modifier une note hors de son contexte, sans la lecon
   * ni la video sous les yeux, est un bon moyen de la vider par erreur. Le bouton
   * mene a la lecon, ou la note s edite normalement. ⚠️ C est une proposition :
   * si Nadir veut l edition en place, elle s ajoute sans rien defaire.
   */
  function rendreNotes(filtre) {
    _vue = 'notes';
    const q = (filtre || '').trim().toLowerCase();
    const avec = D().SUITE
      .map((l) => ({ l, texte: (_notes[l.id] || '').trim() }))
      .filter((x) => x.texte)
      .filter((x) => !q || x.texte.toLowerCase().includes(q) || x.l.titre.toLowerCase().includes(q));

    $('formationFilAriane').innerHTML =
      `<button type="button" class="formation-fil-lien" onclick="Formation.ouvrirSommaire()">Sommaire</button>
       <span class="formation-fil-sep" aria-hidden="true">/</span>
       <span class="formation-fil-actif">Mes notes</span>`;

    $('formationContenu').innerHTML = `
      <h2 class="formation-titre">Mes notes</h2>
      <p class="formation-compteur">${avec.length} note${avec.length > 1 ? 's' : ''}${q ? ' trouvée' + (avec.length > 1 ? 's' : '') : ''}</p>
      <input type="search" id="formationNotesFiltre" class="formation-filtre"
             placeholder="Chercher dans mes notes" aria-label="Chercher dans mes notes"
             value="${txt(q)}" oninput="Formation.filtrerNotes(this.value)">
      ${avec.length === 0
        ? `<p class="formation-mention">${q ? 'Aucune note ne correspond.' : 'Tu n\'as encore écrit aucune note.'}</p>`
        : `<ul class="formation-notes-liste">
             ${avec.map(({ l, texte }) => `
               <li class="trader-card formation-note-carte">
                 <div class="formation-carte-numero">Module ${txt(l.module)} · ${txt(l.titre)}</div>
                 <p class="formation-note-extrait">${txt(texte)}</p>
                 <button type="button" class="formation-btn-fantome"
                         onclick="Formation.ouvrirLecon('${l.id}')">Ouvrir la leçon</button>
               </li>`).join('')}
           </ul>`}`;

    const f = $('formationNotesFiltre');
    if (f && q) { f.focus(); f.setSelectionRange(q.length, q.length); }
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

  // ===== LA FENETRE DE PARCOURS =============================================

  /**
   * ── ⚠️ QUAND LA FENETRE S OUVRE, ET POURQUOI PAS PLUS SOUVENT ───────────
   *
   *     aucune ligne en base                          PREMIERE VISITE  → oui
   *     lecons vues > au dernier affichage
   *       ET plus de 20 h depuis le dernier           progression      → oui
   *     sinon                                                          → non
   *
   * ⛔ LA PREMIERE VISITE EST LE CAS QUI COMPTE, et c est celui qui manquait a
   * la premiere redaction de cette regle. Un nouvel eleve n a AUCUNE
   * progression, donc aucun changement, donc il n aurait jamais vu la fenetre.
   * Or c est precisement lui qu elle doit accueillir : la formation sans journal
   * est le point d entree de tout le monde.
   *
   * ⚠️ L INTERVALLE DE VINGT HEURES repond a l eleve qui ferme sans lire. Sans
   * lui, la fenetre reviendrait a chaque visite de quelqu un qui avance d une
   * lecon entre deux, c est-a-dire de l eleve assidu : on punirait celui qu on
   * veut encourager. Vingt heures la laissent revenir le lendemain, jamais deux
   * fois dans la meme journee.
   *
   * ⛔ L ETAT VIT EN BASE, pas en stockage local : un repere local repartirait a
   * zero sur chaque appareil.
   */
  const INTERVALLE_MS = 20 * 60 * 60 * 1000;

  async function etatParcours() {
    const u = await uid();
    if (!u) return null;
    const { data, error } = await cli()
      .from('formation_parcours_vu')
      .select('lecons_vues_au_dernier_affichage, vue_le')
      .eq('user_id', u)
      .maybeSingle();
    // ⚠️ Une erreur n est PAS une premiere visite : on ne sait pas, donc on
    // n ouvre rien. ⛔ Ouvrir par defaut sur une panne ferait revenir la fenetre
    // a chaque chargement, exactement ce qu on veut eviter.
    if (error) { console.warn('[FORMATION] etat du parcours illisible :', error.message); return 'erreur'; }
    return data || null;
  }

  function doitOuvrir(etat, faites) {
    if (etat === 'erreur') return false;
    if (!etat) return true;                       // première visite
    if (faites <= etat.lecons_vues_au_dernier_affichage) return false;
    const depuis = Date.now() - Date.parse(etat.vue_le);
    return !(depuis >= 0 && depuis < INTERVALLE_MS);
  }

  async function marquerVue(faites) {
    const u = await uid();
    if (!u) return;
    const { error } = await cli().from('formation_parcours_vu').upsert({
      user_id: u,
      lecons_vues_au_dernier_affichage: faites,
      vue_le: new Date().toISOString(),
    }, { onConflict: 'user_id' });
    if (error) console.error('[FORMATION] ⚠️ fenetre NON marquee comme vue :', error.message);
  }

  function ouvrirFenetre(r) {
    const d = $('formationFenetre');
    if (!d) return;
    $('formationFenetreCorps').innerHTML = parcours(r);
    d.hidden = false;
    const b = $('formationFenetreFermer');
    if (b) b.focus();
  }

  async function fermerFenetre() {
    const d = $('formationFenetre');
    if (d) d.hidden = true;
    await marquerVue(D().SUITE.filter((l) => estVue(l.id)).length);
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
      const faites = D().SUITE.filter((l) => estVue(l.id)).length;
      const etat = await etatParcours();
      if (doitOuvrir(etat, faites)) ouvrirFenetre(reprisePrecise());
    },
    fermerFenetre,
    // Exposes pour la sonde. ⛔ Ne pas appeler depuis l interface.
    _doitOuvrir: doitOuvrir,
    _intervalleMs: INTERVALLE_MS,
    ouvrirSommaire() { detacherLecteur(); rendreSommaire(); },
    ouvrirModule(n) { detacherLecteur(); rendreModule(n); },
    ouvrirLecon(id) { detacherLecteur(); rendreLecon(id); },
    ouvrirNotes() { detacherLecteur(); rendreNotes(''); },
    filtrerNotes(q) { rendreNotes(q); },
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
