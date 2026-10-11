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
  let _notes = {};               // lecon_id -> texte, charge a la demande
  let _avecNote = new Set();     // les lecons qui PORTENT une note, sans leur texte
  let _citation = { texte: '', auteur: '' };
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

  /**
   * ── ⛔ ON NE CHARGE QUE CE QUI EST AFFICHE ───────────────────────────────
   *
   * La version precedente lisait le TEXTE de toutes les notes a chaque ouverture
   * de l'espace. Invisible a sept lecons, lourd a soixante-quatre, et ⚠️ personne
   * ne l'aurait vu venir : cela se degrade progressivement, sans seuil ni erreur.
   *
   * Le sommaire n'a pas besoin du texte, seulement de savoir QUELLES lecons en
   * portent une. On ne lit donc que `lecon_id`, et chaque lecon charge la sienne
   * a l'ouverture. La vue « toutes mes notes » les charge toutes, mais c'est
   * precisement ce qu'on lui demande, et seulement quand on y va.
   *
   * ⚠️ `last_watched_at` EST DESORMAIS SELECTIONNE, et c'etait un defaut :
   * `reprisePrecise()` le lisait pour trouver la lecon la plus recente, alors que
   * `charger()` ne le ramenait pas. ⛔ `quand` valait donc toujours zero, et la
   * reprise tombait sur la derniere lecon dans l'ordre du sommaire plutot que sur
   * la derniere ouverte. Aucune sonde ne pouvait le voir : elles n'avaient qu'une
   * seule ligne de progression, ou la comparaison ne tranche rien.
   */
  async function charger() {
    const u = await uid();
    if (!u) return;
    const [p, n] = await Promise.all([
      cli().from('formation_progression')
        .select('lecon_id, vue, progress_seconds, last_watched_at').eq('user_id', u),
      // ⛔ `lecon_id` SEUL : pas de `texte` ici.
      cli().from('formation_notes').select('lecon_id').eq('user_id', u),
    ]);
    _progression = {};
    (p.data || []).forEach((r) => { _progression[r.lecon_id] = r; });
    _avecNote = new Set((n.data || []).map((r) => r.lecon_id));
    _notes = {};
    if (p.error) console.warn('[FORMATION] progression illisible :', p.error.message);
    if (n.error) console.warn('[FORMATION] notes illisibles :', n.error.message);
    await chargerCitation();
  }

  /** Charge le texte d'UNE note, a l'ouverture de sa lecon. */
  async function chargerNote(leconId) {
    if (_notes[leconId] !== undefined) return _notes[leconId];
    if (!_avecNote.has(leconId)) { _notes[leconId] = ''; return ''; }
    const u = await uid();
    if (!u) return '';
    const { data, error } = await cli().from('formation_notes')
      .select('texte').eq('user_id', u).eq('lecon_id', leconId).maybeSingle();
    if (error) { console.warn('[FORMATION] note illisible :', error.message); return ''; }
    _notes[leconId] = (data && data.texte) || '';
    return _notes[leconId];
  }

  /** Charge TOUS les textes, pour la vue « toutes mes notes » et pour l'export. */
  async function chargerToutesLesNotes() {
    const u = await uid();
    if (!u) return;
    const { data, error } = await cli().from('formation_notes')
      .select('lecon_id, texte').eq('user_id', u);
    if (error) { console.warn('[FORMATION] notes illisibles :', error.message); return; }
    (data || []).forEach((r) => { _notes[r.lecon_id] = r.texte; });
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
    /**
     * ⛔ ELLE REND UN BOOLEEN, ET C EST UNE CORRECTION DU 11/10/2026.
     * Elle ne rendait rien. `terminer()` fait `const ok = await
     * ecrireProgression(...); if (!ok) return;` : `ok` valait donc TOUJOURS
     * `undefined`, l eleve aurait lu « Non enregistré » a chaque chapitre
     * termine, et l avancement n aurait jamais progresse a l ecran, ALORS QUE
     * L ECRITURE REUSSISSAIT. ⚠️ Attrape en listant les appels dont la
     * definition ne rend pas ce que l appelant lit.
     */
    return !error;
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
    // ⚠️ Le registre suit, sinon le sommaire ne saurait pas qu une note existe
    // tant qu on n a pas recharge la page.
    if (texte.trim()) _avecNote.add(leconId); else _avecNote.delete(leconId);
    return true;
  }

  function repere(etat) {
    const el = $('savedMsg');
    if (!el) return;
    const libelles = { repos: '', ecrit: 'Enregistrement…', ok: 'Enregistré', faute: "⚠️ Non enregistré" };
    el.textContent = libelles[etat] || '';
    el.dataset.etat = etat;
  }

  // ===== RENDU : SOMMAIRE ===================================================

  /**
   * Minutes et secondes lisibles. ⛔ Jamais des secondes brutes a l ecran.
   * ⚠️ ET LA POSITION NE S AFFICHE PAS QUAND ELLE VAUT ZERO. Le parcours de bout
   * en bout a montre « Module 01 · lecon 1 · a 0 s » pour une lecon cochee « vue »
   * sans avoir ete lue : techniquement vrai, et du bruit a l ecran. Une lecon
   * ouverte sans position se reprend a son debut, cela va de soi.
   */
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
   * ── ⚠️ CE QUI A CHANGE AU LOT 9, ET IL FAUT LE DIRE ICI ─────────────────
   *
   * `assets/formation-donnees.js` porte desormais les SOIXANTE-TROIS chapitres,
   * comptes sur le releve Vimeo. Le pourcentage est donc calcule sur un total
   * reel, et `structureComplete()` n a plus de raison d exister : elle a ete
   * retiree avec la mention « le pourcentage s affichera quand les dix modules
   * seront remplis ».
   * ⛔ CE QUI MANQUE N EST PLUS LE COMPTE, C EST LE RAPPROCHEMENT : on sait
   * combien de chapitres chaque module porte, pas QUELLE video va dans lequel.
   * Les titres des modules 02 a 09 sont donc des emplacements, et aucune video
   * n est posee.
   */
  async function chargerCitation() {
    const u = await uid();
    if (!u) return;
    const { data, error } = await cli().from('user_preferences')
      .select('mantra_texte, mantra_auteur').eq('user_id', u).maybeSingle();
    // ⚠️ La colonne n'existe pas encore : on se rabat sur le stockage local sans
    // bruit. ⛔ Ce repli disparait quand la migration 05 est appliquee.
    if (error) { console.warn('[FORMATION] citation illisible :', error.message); return; }

    if (data && data.mantra_texte) {
      _citation = { texte: data.mantra_texte, auteur: data.mantra_auteur || '' };
      return;
    }
    let local = '';
    let localAuteur = '';
    try {
      local = localStorage.getItem('userMantra') || '';
      localAuteur = localStorage.getItem('userMantraAuthor') || '';
    } catch { local = ''; }
    if (!local) return;

    _citation = { texte: local, auteur: localAuteur };
    const { error: e2 } = await cli().from('user_preferences')
      .upsert({ user_id: u, mantra_texte: local, mantra_auteur: localAuteur || null },
        { onConflict: 'user_id' });
    if (e2) console.warn('[FORMATION] citation NON reprise en base :', e2.message);
    else console.log('[FORMATION] ✅ citation reprise du navigateur vers la base');
  }

  function citation() {
    let texte = _citation.texte;
    let auteur = _citation.auteur;
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
  /** ⚠️ Le reglage du depot, lu comme dans les cinq autres modules qui animent. */
  async function exporterNotes() {
    await chargerToutesLesNotes();
    const lignes = [];
    lignes.push('MES NOTES DE FORMATION - TRADER 360');
    lignes.push(`Export du ${new Date().toLocaleDateString('fr-FR')}`);
    lignes.push('');
    let combien = 0;
    for (const m of D().MODULES) {
      const avec = m.lecons.filter((l) => (_notes[l.id] || '').trim());
      if (!avec.length) continue;
      lignes.push(`=== MODULE ${m.numero} - ${m.titre} ===`);
      lignes.push('');
      for (const l of avec) {
        lignes.push(`--- ${l.titre} ---`);
        // ⚠️ Le texte part TEL QUEL : apostrophes, retours a la ligne et accents
        // compris. ⛔ Aucun echappement, aucun remplacement : ce n'est pas du
        // HTML, c'est un fichier texte, et « nettoyer » y abimerait ses mots.
        lignes.push(_notes[l.id].trim());
        lignes.push('');
        combien += 1;
      }
    }
    if (!combien) { lignes.push('Aucune note pour le moment.'); }

    /**
     * ⚠️ `﻿` EN TETE, ET CE N'EST PAS UN DETAIL. Sans cette marque d'ordre
     * des octets, Excel sur Windows ouvre un fichier UTF-8 en interpretant les
     * octets comme du latin-1 : « préparé » devient « prÃ©parÃ© ». ⛔ L'eleve
     * croirait ses accents perdus alors que le fichier est juste.
     */
    const contenu = '﻿' + lignes.join('\n');
    const url = URL.createObjectURL(new Blob([contenu], { type: 'text/plain;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = `mes-notes-trader360-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    // ⚠️ L'adresse est liberee, mais pas tout de suite : la revoquer dans la
    // foulee annule le telechargement dans certains navigateurs.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return { notes: combien, contenu };
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
  // ===========================================================================
  // LA COUCHE D AFFICHAGE : CELLE DE LA MAQUETTE VALIDEE
  // ===========================================================================
  /**
   * ── ⚠️ D OU VIENT CE QUI SUIT ─────────────────────────────────────────────
   *
   * C est la transposition des deux vues de
   * `_maquette-espace-formation/espace-formation-trader360.html` :
   * `renderHome()` et `renderModule()`. La structure, les classes, les libelles
   * et les animations sont les siens. ⛔ Je ne les ai pas « ameliores ».
   *
   * ── ⛔ CE QUI A CHANGE, ET C EST TOUT LE TRAVAIL ───────────────────────────
   *
   * La maquette vit sur `localStorage` et sur une liste de modules qui lui est
   * propre. Ici :
   *
   *     maquette                    source reelle
   *     S.done[chap] = timestamp -> formation_progression (vue, last_watched_at)
   *     S.notes[chap]            -> formation_notes
   *     MODULES (sa propre liste) -> assets/formation-donnees.js, source UNIQUE
   *     S.last                   -> deduit de `last_watched_at`
   *
   * ⛔ ET RIEN N EST ECRIT DANS `localStorage`. Un eleve qui change d appareil
   * retrouve sa progression, ses notes, son experience et ses badges.
   */

  /* ══ L EXPERIENCE, LES NIVEAUX, LES BADGES, LA SERIE ══════════════════════
   *
   * ⛔ AUCUNE TABLE POUR TOUT CELA, ET C EST UNE DECISION.
   *
   * ⚠️ Une table d XP qui se desynchronise de la progression donne un eleve a
   * 60 % qui affiche 300 XP et un badge qu il n a pas merite. Rien ne le
   * signalerait, et il faudrait le recalculer a la main, eleve par eleve. Tout
   * ce qui suit se DEDUIT donc de `formation_progression`, a chaque affichage.
   * La seule source de verite reste la progression.
   *
   * ⚠️ Les baremes et les sept niveaux sont ceux de la maquette, au chiffre.
   */
  const XP_CHAP = 100;
  const XP_MOD = 250;
  const XP_CERT = 1000;
  const NIVEAUX = [
    { nom: 'Découvrir', xp: 0 }, { nom: 'Psychologie', xp: 800 },
    { nom: 'Méthode', xp: 2000 }, { nom: 'Outils', xp: 3500 },
    { nom: 'Discipline', xp: 5000 }, { nom: 'Financé', xp: 6500 },
    { nom: 'Durer', xp: 8200 },
  ];

  const mods = () => D().MODULES;
  const totalChap = () => D().total();
  const faitesDe = (m) => m.lecons.filter((l) => estVue(l.id)).length;
  const pctDe = (m) => (m.lecons.length ? Math.round((faitesDe(m) / m.lecons.length) * 100) : 0);
  const moduleFini = (m) => m.lecons.length > 0 && faitesDe(m) === m.lecons.length;
  const estCert = (m) => !!m.certification;
  /** La certification s ouvre quand les neuf autres modules sont traverses. */
  const certOuverte = () => mods().filter((m) => !estCert(m)).every(moduleFini);
  const nbFaites = () => D().SUITE.filter((l) => estVue(l.id)).length;

  function xpTotal() {
    let x = nbFaites() * XP_CHAP;
    mods().forEach((m) => { if (moduleFini(m)) x += estCert(m) ? XP_CERT : XP_MOD; });
    return x;
  }
  function niveauDe(x) {
    let i = 0;
    NIVEAUX.forEach((n, k) => { if (x >= n.xp) i = k; });
    return i;
  }

  /** La date de visionnage d une lecon, ou null. ⚠️ Sert la serie de semaines. */
  function quandVue(id) {
    const p = _progression[id];
    if (!p || !p.vue || !p.last_watched_at) return null;
    const t = Date.parse(p.last_watched_at);
    return Number.isFinite(t) ? t : null;
  }
  /** Semaine ISO, meme calcul que la maquette. */
  function semaineIso(d) {
    const x = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    const j = x.getUTCDay() || 7;
    x.setUTCDate(x.getUTCDate() + 4 - j);
    const a = new Date(Date.UTC(x.getUTCFullYear(), 0, 1));
    return `${x.getUTCFullYear()}-${Math.ceil(((x - a) / 864e5 + 1) / 7)}`;
  }
  function clesSemaines(n) {
    const out = [];
    const d = new Date();
    for (let i = n - 1; i >= 0; i -= 1) {
      const x = new Date(d);
      x.setDate(d.getDate() - i * 7);
      out.push(semaineIso(x));
    }
    return out;
  }
  function semainesActives() {
    const s = new Set();
    Object.keys(_progression).forEach((id) => {
      const t = quandVue(id);
      if (t) s.add(semaineIso(new Date(t)));
    });
    return s;
  }
  function serie() {
    const act = semainesActives();
    const cles = clesSemaines(52).reverse();
    let n = 0;
    for (let i = 0; i < cles.length; i += 1) {
      if (act.has(cles[i])) n += 1;
      else if (i === 0) continue;       // la semaine en cours peut etre vide
      else break;
    }
    return n;
  }

  /**
   * Les badges de la maquette, aux memes conditions. ⛔ Chacun se CALCULE : il
   * n existe aucun endroit ou un badge pourrait etre pose a la main.
   */
  function badges() {
    const liste = [
      { id: 'first', t: 'Première séance', d: 'Ton premier chapitre terminé.',
        ok: () => nbFaites() >= 1 },
      ...mods().filter((m) => !estCert(m)).map((m) => ({
        id: `m${m.numero}`, t: `Module ${m.numero} validé`, d: m.titre,
        num: Number(m.numero), ok: () => moduleFini(m),
      })),
      { id: 'half', t: 'Mi-parcours', d: 'La moitié des chapitres terminés.',
        ok: () => totalChap() > 0 && nbFaites() >= Math.ceil(totalChap() / 2) },
      { id: 'weeks4', t: 'Quatre semaines tenues',
        d: 'Au moins un chapitre par semaine, quatre semaines de suite.',
        ok: () => serie() >= 4 },
      { id: 'cert', t: 'Trader 360 certifié', d: 'Les dix modules traversés.',
        ok: () => { const c = mods().find(estCert); return !!c && moduleFini(c); }, big: true },
    ];
    return liste;
  }

  /** Le prochain chapitre a ouvrir : [indexModule, indexChapitre] ou null. */
  function prochain() {
    const r = reprisePrecise();
    if (r) {
      const mi = mods().findIndex((m) => m.numero === r.module);
      if (mi >= 0) {
        const ci = mods()[mi].lecons.findIndex((l) => l.id === r.lecon.id);
        if (ci >= 0 && !estVue(r.lecon.id)) return [mi, ci];
      }
    }
    for (let mi = 0; mi < mods().length; mi += 1) {
      const m = mods()[mi];
      if (estCert(m) && !certOuverte()) continue;
      const ci = m.lecons.findIndex((l) => !estVue(l.id));
      if (ci > -1) return [mi, ci];
    }
    return null;
  }

  /* ══ ICONES ET MEDAILLES, reprises telles quelles de la maquette ══════════ */
  const I = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
    play: '<svg viewBox="0 0 24 24" fill="#120e07"><path d="M7 4.5v15l13-7.5z"/></svg>',
    arrow: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
    back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>',
  };
  function medaille(b, taille) {
    const n = b.num ? String(b.num).padStart(2, '0')
      : (b.id === 'cert' ? '360' : b.id === 'first' ? '1' : b.id === 'half' ? '½' : '4');
    const g = `g${b.id}${taille || ''}`;
    return `<svg class="medal" viewBox="0 0 64 64" aria-hidden="true"><defs><linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f3d585"/><stop offset=".55" stop-color="#e8b84b"/><stop offset="1" stop-color="#b98a2e"/></linearGradient></defs>
      <path d="M32 3 57 17.5v29L32 61 7 46.5v-29Z" fill="#111318" stroke="url(#${g})" stroke-width="2.5"/>
      <path d="M32 11 50 21.5v21L32 53 14 42.5v-21Z" fill="url(#${g})" opacity=".14"/>
      <text x="32" y="37.5" text-anchor="middle" font-family="JetBrains Mono,monospace" font-weight="700" font-size="${n.length > 2 ? 13 : 16}" fill="url(#${g})">${n}</text></svg>`;
  }

  /* ══ RENDU ════════════════════════════════════════════════════════════════ */
  const app = () => $('formation');
  let _vueCourante = { nom: 'accueil' };

  /** ⚠️ Le reglage du depot, lu comme dans les cinq autres modules qui animent. */
  function motionOk() {
    return !window.matchMedia('(prefers-reduced-motion: reduce)').matches
      && document.body.dataset.animations !== 'off';
  }

  function majChip() {
    const x = xpTotal();
    const a = $('chipXp');
    const b = $('chipLvl');
    if (a) a.textContent = `${x.toLocaleString('fr-FR')} XP`;
    if (b) b.textContent = NIVEAUX[niveauDe(x)].nom;
  }

  function animerBarres() {
    const poser = () => app().querySelectorAll('.bar i[data-w]')
      .forEach((b) => { b.style.width = `${b.dataset.w}%`; });
    // ⛔ Sans animation, on pose la largeur TOUT DE SUITE. Deux trames
    // d attente sur un rendu fige ne donnent rien a voir, et laisseraient les
    // barres a zero le temps d un battement.
    if (!motionOk()) { poser(); return; }
    requestAnimationFrame(() => requestAnimationFrame(poser));
  }

  function majNav(id) {
    document.querySelectorAll('#formationApp .nav button').forEach((b) => {
      b.setAttribute('aria-current', b.dataset.go === id ? 'true' : 'false');
    });
  }

  function piedDePage() {
    /**
     * ⚠️ DEUX BOUTONS DE LA MAQUETTE NE SONT PAS REPRIS, ET C EST DELIBERE.
     * Elle propose « Voir un exemple de progression » et « Réinitialiser ma
     * progression ». Sur `localStorage` c est anodin ; sur `formation_progression`
     * le premier ECRASERAIT la progression reelle d un eleve et le second la
     * SUPPRIMERAIT. ⛔ Ni l un ni l autre n est une decision qui m appartient.
     * L export des notes, lui, existe deja et ne detruit rien : il prend leur
     * place. ⚠️ A Nadir de dire s il veut un vrai bouton de remise a zero.
     */
    return `<footer>
      <span>Trader 360 · Le trading comporte un risque de perte en capital.</span>
      <span class="acts">
        <button type="button" data-export>Exporter mes notes</button>
        <!-- ⛔ LES QUATRE LIENS LEGAUX SONT REPRIS ICI, a l identique du pied de
             page du journal. Celui-ci est masque dans cet espace : sans ces
             liens, l obligation posee au lot « pages legales » disparaitrait
             d un espace entier, et rien ne l aurait signale. -->
        <a href="/mentions-legales.html">Mentions légales</a>
        <a href="/cgv.html">CGV</a>
        <a href="/confidentialite.html">Confidentialité</a>
        <a href="/cgu.html">CGU</a>
      </span>
    </footer>`;
  }

  function rendreAccueil(ancre) {
    _vueCourante = { nom: 'accueil' };
    const M = mods();
    const total = totalChap();
    const faites = nbFaites();
    const pct = total ? Math.round((faites / total) * 100) : 0;
    const x = xpTotal();
    const li = niveauDe(x);
    const niv = NIVEAUX[li];
    const suiv = NIVEAUX[li + 1];
    const pctNiv = suiv ? Math.round(((x - niv.xp) / (suiv.xp - niv.xp)) * 100) : 100;
    const modsOk = M.filter(moduleFini).length;
    const pr = prochain();
    const st = serie();
    const act = semainesActives();
    const sem = clesSemaines(8);
    const cette = semaineIso(new Date());
    const C = 2 * Math.PI * 56;

    let reprendre;
    if (!faites) reprendre = `<button type="button" class="btn btn-gold" data-open="0,0">Commencer le module 01 ${I.arrow}</button>`;
    else if (pr) reprendre = `<button type="button" class="btn btn-gold" data-open="${pr[0]},${pr[1]}">Reprendre ${I.arrow}</button>`;
    else reprendre = `<button type="button" class="btn btn-gold" data-mod="${M.length - 1}">Voir mon certificat ${I.arrow}</button>`;
    const metaReprise = pr
      ? `<div class="resume-meta">Prochaine étape : <b>Module ${txt(M[pr[0]].numero)} · ${txt(M[pr[0]].lecons[pr[1]].titre)}</b></div>`
      : '';
    const salut = !faites ? "Ton parcours<br><span class='gold-text'>commence ici.</span>"
      : pct === 100 ? "Parcours<br><span class='gold-text'>terminé.</span>"
        : "Ton parcours<br><span class='gold-text'>avance.</span>";
    const premierOuvert = M.findIndex((m) => !moduleFini(m) && !(estCert(m) && !certOuverte()));

    app().innerHTML = `
    <section class="hero" id="accueil">
      <div>
        <div class="eyebrow">Espace formation</div>
        <h1>${salut}</h1>
        <p class="lead">Dix modules, dans l'ordre réel de la progression d'un trader. Chaque chapitre terminé te rapporte de l'expérience et te rapproche de la certification.</p>
        <div class="hero-ctas">${reprendre}<button type="button" class="btn btn-ghost" data-go="modules">Voir les ${M.length} modules</button></div>
        ${metaReprise}
      </div>
      <aside class="dash" aria-label="Ma progression">
        <div class="ring-row">
          <div class="ring" role="img" aria-label="${pct} % du parcours terminé">
            <svg viewBox="0 0 132 132"><defs><linearGradient id="rgFormation" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d585"/><stop offset="1" stop-color="#b98a2e"/></linearGradient></defs>
              <circle cx="66" cy="66" r="56" fill="none" stroke="#1b2028" stroke-width="10"/>
              <circle id="ringArc" cx="66" cy="66" r="56" fill="none" stroke="url(#rgFormation)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C}" style="transition:stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)"/></svg>
            <div class="val"><div><strong class="mono">${pct}<small style="font-size:.5em">%</small></strong><span>du parcours</span></div></div>
          </div>
          <div class="ring-side">
            <div class="eyebrow" style="font-size:11px">Niveau ${li + 1} / ${NIVEAUX.length}</div>
            <div class="big">${txt(niv.nom)}</div>
            <div class="small">${suiv
              ? `<span class="mono">${(suiv.xp - x).toLocaleString('fr-FR')} XP</span> avant <b style="color:var(--ink);font-weight:600">${txt(suiv.nom)}</b>`
              : 'Dernier niveau atteint'}</div>
          </div>
        </div>
        <div class="lvl-bar">
          <div class="head"><span>Expérience</span><b class="mono">${x.toLocaleString('fr-FR')}${suiv ? ` / ${suiv.xp.toLocaleString('fr-FR')}` : ''} XP</b></div>
          <div class="bar"><i data-w="${pctNiv}"></i></div>
          <div class="ladder" style="margin-top:12px" aria-hidden="true">${NIVEAUX.map((l, k) => `<span class="${k <= li ? 'on' : ''}"></span>`).join('')}</div>
          <div class="ladder-labels" aria-hidden="true"><span>${txt(NIVEAUX[0].nom)}</span><span>${txt(NIVEAUX[NIVEAUX.length - 1].nom)}</span></div>
        </div>
        <div class="stat-row">
          <div class="stat"><div class="k">Chapitres</div><div class="v">${faites}<span style="color:var(--ink-mute);font-weight:400">/${total}</span></div></div>
          <div class="stat"><div class="k">Modules</div><div class="v">${modsOk}<span style="color:var(--ink-mute);font-weight:400">/${M.length}</span></div></div>
          <div class="stat"><div class="k">Série</div><div class="v">${st}<span style="color:var(--ink-mute);font-weight:400"> sem.</span></div></div>
        </div>
        <div>
          <div class="lvl-bar"><div class="head"><span>Régularité · 8 semaines</span><span style="font-size:12px">un chapitre par semaine suffit</span></div></div>
          <div class="weeks">${sem.map((k) => `<div><i class="${act.has(k) ? 'on' : ''} ${k === cette ? 'now' : ''}" title="Semaine ${k.split('-')[1]}"></i><small>${k === cette ? 'auj.' : `S${k.split('-')[1]}`}</small></div>`).join('')}</div>
        </div>
      </aside>
    </section>

    <section id="modules">
      <div class="sec-head">
        <div><div class="eyebrow">Le parcours</div><h2>Dix modules, du premier graphique<br>à la certification.</h2></div>
        <p>La psychologie vient avant la méthode. Suis l'ordre : chaque module prépare le suivant.</p>
      </div>
      <div class="grid">
        ${M.map((m, i) => {
          const verrou = estCert(m) && !certOuverte();
          const fini = moduleFini(m);
          const d = faitesDe(m);
          const pp = pctDe(m);
          // ⚠️ Un module SANS chapitre n est pas « a commencer » : il attend
          // l import Vimeo. ⛔ Le dire, plutot que d afficher 0 / 0.
          const vide = m.lecons.length === 0 && !verrou;
          const pastille = verrou ? `<span class="pill">${I.lock} Verrouillé</span>`
            : vide ? '<span class="pill">Leçons à venir</span>'
              : fini ? `<span class="pill ok">${I.check} Validé</span>`
                : d ? '<span class="pill go">En cours</span>' : '<span class="pill">À commencer</span>';
          const inerte = verrou || vide;
          return `<button type="button" class="mod ${inerte ? 'locked' : ''} ${i === premierOuvert && d ? 'current' : ''}"
            ${inerte ? 'aria-disabled="true"' : ''} data-mod="${i}">
            ${pastille}
            <div class="num">MODULE ${txt(m.numero)}</div>
            <h3>${txt(m.titre)}</h3>
            <p>${m.description ? txt(m.description) : '<em style="color:var(--ink-mute)">En attente de description.</em>'}</p>
            <div class="foot">
              <div class="meta"><span>${verrou ? `Termine les modules 01 à ${txt(M[M.length - 2].numero)}`
                : vide ? 'Chapitres à venir' : `${d} / ${m.lecons.length} chapitres`}</span><span class="mono">${inerte ? '' : `${pp} %`}</span></div>
              <div class="bar thin ${fini ? 'done' : ''}"><i data-w="${pp}"></i></div>
            </div>
          </button>`;
        }).join('')}
      </div>
    </section>

    <section id="notes">
      <div class="sec-head">
        <div><div class="eyebrow">Carnet</div><h2>Mes notes.</h2></div>
        <div class="notes-tools"><label for="noteSearch" style="position:absolute;left:-9999px">Rechercher dans mes notes</label><input id="noteSearch" type="search" placeholder="Rechercher dans mes notes…"></div>
      </div>
      <div class="notes-wrap" id="notesList">${notesHtml('')}</div>
    </section>

    <section id="badges">
      <div class="sec-head">
        <div><div class="eyebrow">Récompenses</div><h2>Mes badges.</h2></div>
        <p>Chaque badge correspond à une étape réelle du parcours, jamais à un simple clic.</p>
      </div>
      <div class="badges">
        ${badges().map((b) => `<div class="badge ${b.ok() ? '' : 'off'}">${medaille(b)}<strong>${txt(b.t)}</strong><span>${txt(b.d)}</span></div>`).join('')}
      </div>
    </section>
    ${piedDePage()}`;

    const ns = $('noteSearch');
    if (ns) {
      ns.addEventListener('input', () => { $('notesList').innerHTML = notesHtml(ns.value); });
    }
    animerBarres();
    majChip();
    const poserAnneau = () => { const a = $('ringArc'); if (a) a.style.strokeDashoffset = C * (1 - pct / 100); };
    if (motionOk()) requestAnimationFrame(poserAnneau); else poserAnneau();
    majNav(ancre || 'accueil');
    if (ancre && ancre !== 'accueil') {
      const el = $(ancre);
      if (el) el.scrollIntoView({ behavior: motionOk() ? 'smooth' : 'auto', block: 'start' });
    }
  }

  /**
   * ⚠️ LA LISTE DES NOTES LIT LE TEXTE DEPUIS LA BASE.
   * `_avecNote` ne porte que les identifiants ; le texte vient de
   * `chargerToutesLesNotes()`, appele avant d afficher cette section. ⛔ Sans ce
   * chargement, la liste serait vide alors que les notes existent, et rien ne le
   * signalerait.
   */
  function notesHtml(q) {
    const r = (q || '').trim().toLowerCase();
    const combien = Object.values(_notes).filter((v) => v && v.trim()).length;
    if (!combien) {
      return `<div class="notes-empty">${_avecNote.size
        ? 'Tes notes se chargent…'
        : "Aucune note pour l'instant. Dans chaque chapitre, le bloc « Mes notes » se retrouve automatiquement ici, classé par module."}</div>`;
    }
    const blocs = mods().map((m, mi) => {
      const items = m.lecons.map((l, ci) => ({ l, ci, v: (_notes[l.id] || '').trim() }))
        .filter((x) => x.v && (!r || x.v.toLowerCase().includes(r)
          || x.l.titre.toLowerCase().includes(r) || m.titre.toLowerCase().includes(r)));
      if (!items.length) return '';
      return `<div class="notes-mod"><h3>Module ${txt(m.numero)} <span>${txt(m.titre)}</span></h3><div class="notes-grid">${items.map((x) =>
        `<button type="button" class="note-card" data-open="${mi},${x.ci}"><span class="h"><b>${txt(x.l.titre)}</b><em>Ouvrir →</em></span><p>${txt(x.v)}</p></button>`).join('')}</div></div>`;
    }).join('');
    return blocs || `<div class="notes-empty">Aucune note ne contient « ${txt(q)} ».</div>`;
  }

  async function rendreModule(mi, ci) {
    const M = mods();
    const m = M[mi];
    if (!m) return;
    if (estCert(m) && !certOuverte()) {
      toast('🔒', `Termine les modules 01 à ${M[M.length - 2].numero} pour débloquer la certification.`);
      return;
    }
    if (!m.lecons.length) {
      toast('⏳', `Les chapitres du module ${m.numero} arrivent.`);
      return;
    }
    if (ci == null) {
      ci = m.lecons.findIndex((l) => !estVue(l.id));
      if (ci < 0) ci = 0;
    }
    const c = m.lecons[ci];
    _vueCourante = { nom: 'module', mi, ci };
    _moduleCourant = m.numero;
    _leconCourante = c.id;
    const d = faitesDe(m);
    const pp = pctDe(m);
    const fini = estVue(c.id);

    // ⚠️ La note du chapitre est lue AVANT le rendu : le champ s affiche rempli,
    // et non vide puis rempli, ce qui ferait croire a une note perdue.
    const note = await chargerNote(c.id);

    /**
     * ⛔ UNE SENTINELLE, PAS `undefined`, ET C EST UNE CORRECTION MESUREE.
     * La version precedente ecrivait `let groupePose;`, donc `undefined`. Or les
     * chapitres du PREMIER groupe n ont pas de champ `groupe`, donc `undefined`
     * aussi : la comparaison etait fausse des le premier tour et l intertitre
     * « Module 07 » n etait jamais pose. ⚠️ Mesure : le module 07 affichait UN
     * intertitre (« Module 7 bis ») au lieu de DEUX, et une liste de treize
     * chapitres dont les neuf premiers flottaient sans titre de section.
     * La maquette s en sortait parce qu elle ecrivait `group: null` ;
     * ⛔ dependre de la difference entre `null` et `undefined` est precisement
     * le genre d accord tacite qui se casse au premier changement de source.
     */
    const AUCUN_GROUPE = Symbol('aucun');
    let groupePose = AUCUN_GROUPE;
    const liste = m.lecons.map((ch, k) => {
      let g = '';
      if ((ch.groupe || null) !== groupePose) {
        if (m.lecons.some((l) => l.groupe)) {
          g = `<div class="chap-group">${ch.groupe ? `Module ${txt(ch.groupe)}` : `Module ${txt(m.numero)}`}</div>`;
        }
        groupePose = ch.groupe || null;
      }
      const dn = estVue(ch.id);
      return `${g}<button type="button" class="chap ${dn ? 'done' : ''}" data-chap="${k}" ${k === ci ? 'aria-current="true"' : ''}>
        <span class="dot">${dn ? I.check : String(k + 1).padStart(2, '0')}</span>
        <span><span class="t">${txt(ch.titre)}</span><br><span class="s">${dn ? `Terminé · +${XP_CHAP} XP` : `+${XP_CHAP} XP`}</span></span></button>`;
    }).join('');

    const prec = ci > 0 ? [mi, ci - 1] : (mi > 0 && M[mi - 1].lecons.length ? [mi - 1, M[mi - 1].lecons.length - 1] : null);
    const modSuiv = M[mi + 1];
    const suiv = ci < m.lecons.length - 1 ? [mi, ci + 1]
      : (modSuiv && modSuiv.lecons.length && !(estCert(modSuiv) && !certOuverte()) ? [mi + 1, 0] : null);
    const bCert = estCert(m) && moduleFini(m)
      ? `<div class="cert">${medaille(badges()[badges().length - 1], 'c').replace('class="medal"', 'class="medal" style="width:96px;height:96px"')}<div class="eyebrow" style="margin-top:8px">Parcours validé</div><h3>Trader 360 certifié.</h3><p>Les dix modules sont traversés. La suite se joue en séance, avec le journal, le brief et la communauté.</p></div>`
      : '';

    app().innerHTML = `
    <div class="crumbs"><button type="button" data-go="modules">Les modules</button><span>/</span><span>Module ${txt(m.numero)}</span></div>
    <section class="mhead">
      <div><div class="eyebrow">Module ${txt(m.numero)} · ${m.lecons.length} chapitres</div><h1>${txt(m.titre)}</h1><p>${m.description ? txt(m.description) : '<em style="color:var(--ink-mute)">En attente de description.</em>'}</p></div>
      <div class="mprog"><div class="head"><span>${d} / ${m.lecons.length} terminés</span><b class="mono" style="color:var(--ink)">${pp} %</b></div><div class="bar ${pp === 100 ? 'done' : ''}"><i data-w="${pp}"></i></div></div>
    </section>
    <div class="mview">
      <nav class="chap-list" aria-label="Chapitres du module">${liste}</nav>
      <div class="player">
        ${bCert}
        <!-- ⛔ AUCUNE VIDEO POSEE. La question des domaines Vimeo n est pas
             tranchee : tant qu elle ne l est pas, un lecteur integre afficherait
             une erreur de lecture a l eleve. C est donc un EMPLACEMENT, au bon
             format et au bon endroit, qui dit que la video arrive. -->
        <div class="screen"><canvas id="chart"></canvas>
          <div class="over"><div><div class="play">${I.play}</div><strong style="font-size:17px">${txt(c.titre)}</strong><small>La vidéo de ce chapitre s'affichera ici.</small></div></div>
          <span class="tag">M${txt(m.numero)} · ${txt(c.titre)}</span>
        </div>
        <div class="lesson-head">
          <div><div class="eyebrow">Chapitre ${ci + 1} sur ${m.lecons.length}</div><h2>${txt(c.titre)}</h2></div>
          <div class="lesson-actions">
            ${fini
              ? `<button type="button" class="btn btn-ghost" data-undo>${I.check} Terminé · annuler</button>`
              : `<button type="button" class="btn btn-gold" data-complete>${I.check} Marquer comme terminé <span class="mono" style="opacity:.75">+${XP_CHAP} XP</span></button>`}
          </div>
        </div>
        <!-- ⛔ AUCUNE DESCRIPTION INVENTEE. Nadir les fournira ; d ici la, le
             bloc se lit comme provisoire plutot que de rester vide. -->
        <div class="card">
          <h4>Ce chapitre</h4>
          <p style="margin:0;color:var(--ink-mute);font-style:italic">${c.description
            ? txt(c.description) : 'En attente de description.'}</p>
        </div>
        <div class="card notes">
          <h4>Mes notes</h4>
          <label for="formationNote" style="position:absolute;left:-9999px">Notes du chapitre</label>
          <textarea id="formationNote" placeholder="Ce que je retiens de ce chapitre, ce que je veux appliquer en séance…">${txt(note || '')}</textarea>
          <div class="saved" id="savedMsg"></div>
        </div>
        <div class="pager">
          ${prec ? `<button type="button" class="btn btn-ghost" data-open="${prec[0]},${prec[1]}">${I.back} Précédent</button>` : '<span></span>'}
          ${suiv ? `<button type="button" class="btn btn-ghost" data-open="${suiv[0]},${suiv[1]}">${suiv[0] !== mi ? `Module ${txt(M[suiv[0]].numero)}` : 'Suivant'} ${I.arrow}</button>` : ''}
        </div>
      </div>
    </div>
    ${piedDePage()}`;

    animerBarres();
    dessinerChart(mi * 31 + ci * 7 + 3);
    majNav('modules');
    majChip();
    brancherNotes(c.id);
    window.scrollTo({ top: 0 });
  }

  /**
   * Decor du lecteur : des chandeliers generes, dessines une fois au canvas.
   * ⚠️ CE N EST PAS UNE BOUCLE : un seul passage, pas de `requestAnimationFrame`.
   * ⛔ Une boucle d animation qui continuerait en arriere-plan viderait la
   * batterie d un telephone sans que personne ne le voie.
   */
  function dessinerChart(graine) {
    const cv = $('chart');
    if (!cv) return;
    const r = cv.getBoundingClientRect();
    if (r.width < 10) return;
    const dpr = window.devicePixelRatio || 1;
    cv.width = r.width * dpr;
    cv.height = r.height * dpr;
    const g = cv.getContext('2d');
    g.scale(dpr, dpr);
    let s = graine;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const n = Math.floor(r.width / 14);
    const w = r.width / n;
    let p = r.height * 0.55;
    for (let i = 0; i < n; i += 1) {
      const o = p;
      const cl = o + (rnd() - 0.5) * r.height * 0.09 - (i / n) * 1.2;
      const h = Math.min(o, cl) - rnd() * r.height * 0.03;
      const l = Math.max(o, cl) + rnd() * r.height * 0.03;
      g.globalAlpha = 0.22;
      g.strokeStyle = cl < o ? '#e8b84b' : '#7e7e77';
      g.fillStyle = g.strokeStyle;
      g.beginPath();
      g.moveTo(i * w + w / 2, h);
      g.lineTo(i * w + w / 2, l);
      g.stroke();
      g.fillRect(i * w + w * 0.22, Math.min(o, cl), w * 0.56, Math.max(1, Math.abs(cl - o)));
      p = Math.max(r.height * 0.15, Math.min(r.height * 0.85, cl));
    }
    g.globalAlpha = 1;
  }

  /* ══ ACTIONS ══════════════════════════════════════════════════════════════ */
  /**
   * ⚠️ L ECRITURE VA EN BASE, ET L AFFICHAGE ATTEND SON RESULTAT.
   * ⛔ Afficher d abord et ecrire ensuite donnerait un chapitre coche a l ecran
   * et absent de la base : l eleve verrait sa progression disparaitre au
   * rechargement, sans la moindre erreur entre-temps.
   */
  async function terminer() {
    const { mi, ci } = _vueCourante;
    const M = mods();
    const m = M[mi];
    const c = m.lecons[ci];
    const niveauAvant = niveauDe(xpTotal());
    const finiAvant = moduleFini(m);
    const badgesAvant = badges().filter((b) => b.ok()).map((b) => b.id);

    const ok = await ecrireProgression(c.id, { vue: true });
    if (!ok) { toast('⚠️', "Non enregistré. Vérifie ta connexion et réessaie."); return; }

    majChip();
    const niveauApres = niveauDe(xpTotal());
    const neufs = badges().filter((b) => b.ok() && !badgesAvant.includes(b.id));

    if (!finiAvant && moduleFini(m)) {
      await rendreModule(mi, ci);
      const b = estCert(m) ? badges()[badges().length - 1] : badges().find((z) => z.id === `m${m.numero}`);
      celebrer(b, estCert(m) ? 'Parcours certifié' : `Module ${m.numero} validé`,
        `+${estCert(m) ? XP_CERT : XP_MOD} XP de bonus.`
        + (niveauApres > niveauAvant ? ` Tu passes au niveau ${NIVEAUX[niveauApres].nom}.` : ''), mi);
      return;
    }
    if (niveauApres > niveauAvant) {
      await rendreModule(mi, ci);
      celebrer({ id: 'lvl', num: niveauApres + 1 }, `Niveau ${NIVEAUX[niveauApres].nom}`,
        'Tu as franchi une nouvelle étape du parcours.', mi);
      return;
    }
    if (neufs.length) {
      await rendreModule(mi, ci);
      celebrer(neufs[0], neufs[0].t, neufs[0].d, mi);
      return;
    }
    toast(`<span class="xp">+${XP_CHAP} XP</span>`, `${txt(c.titre)} terminé`);
    const nx = m.lecons.findIndex((ch, k) => k > ci && !estVue(ch.id));
    await rendreModule(mi, nx > -1 ? nx : ci);
  }

  async function annuler() {
    const { mi, ci } = _vueCourante;
    const c = mods()[mi].lecons[ci];
    const ok = await ecrireProgression(c.id, { vue: false });
    if (!ok) { toast('⚠️', 'Non enregistré.'); return; }
    majChip();
    await rendreModule(mi, ci);
  }

  let _minuteurToast = null;
  function toast(icone, message) {
    const t = $('toast');
    if (!t) return;
    t.innerHTML = `${icone}<span>${message}</span>`;
    t.classList.add('show');
    clearTimeout(_minuteurToast);
    _minuteurToast = setTimeout(() => t.classList.remove('show'), 2600);
  }

  function celebrer(b, titre, texte, mi) {
    if (!b) return;
    const M = mods();
    const suiv = M[mi + 1];
    const peutSuivre = suiv && suiv.lecons.length && moduleFini(M[mi])
      && !(estCert(suiv) && !certOuverte());
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    bg.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="formationModalTitre">${medaille(b, 'm')}
      <div class="eyebrow">Bravo</div><h3 id="formationModalTitre">${txt(titre)}</h3><p>${txt(texte)}</p>
      <div class="row">${peutSuivre ? `<button type="button" class="btn btn-gold" data-next>Module ${txt(suiv.numero)} ${I.arrow}</button>` : ''}<button type="button" class="btn btn-ghost" data-close>Continuer</button></div></div>`;
    // ⛔ DANS `#formationApp`, PAS SUR `document.body`. Tout le style de la
    // maquette est prefixe par cet identifiant : posee sur le corps, la fenetre
    // s afficherait sans aucun style, et rien ne l aurait signale.
    $('formationApp').appendChild(bg);
    const fermer = () => bg.remove();
    bg.addEventListener('click', (e) => {
      if (e.target === bg || e.target.closest('[data-close]')) fermer();
      if (e.target.closest('[data-next]')) { fermer(); rendreModule(mi + 1, 0); }
    });
    const premier = bg.querySelector('button');
    if (premier) premier.focus();
    confettis();
  }

  /**
   * ── ⚠️ LA SEULE BOUCLE D ANIMATION DE CET ESPACE ──────────────────────────
   *
   * ⛔ ELLE S ARRETE QUAND ON QUITTE L ECRAN. Son identifiant de trame est
   * retenu, et `arreterAnimations()` l annule : au retour vers le journal, vers
   * l espace coach, et quand l onglet passe en arriere-plan. Une boucle laissee
   * en vie derriere une interface masquee vide la batterie d un telephone sans
   * que personne ne le voie, et sans lever d erreur.
   */
  let _trameConfettis = 0;
  function confettis() {
    if (!motionOk()) return;
    const cv = $('confetti');
    if (!cv) return;
    const g = cv.getContext('2d');
    cv.width = window.innerWidth;
    cv.height = window.innerHeight;
    const cols = ['#f3d585', '#e8b84b', '#b98a2e', '#f7f6f3'];
    const ps = Array.from({ length: 140 }, () => ({
      x: window.innerWidth / 2, y: window.innerHeight * 0.42,
      vx: (Math.random() - 0.5) * 14, vy: -Math.random() * 13 - 4,
      s: Math.random() * 6 + 3, r: Math.random() * 6,
      vr: (Math.random() - 0.5) * 0.3, c: cols[Math.random() * 4 | 0],
    }));
    let f = 0;
    const tick = () => {
      g.clearRect(0, 0, cv.width, cv.height);
      ps.forEach((p) => {
        p.vy += 0.35; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr;
        g.save(); g.translate(p.x, p.y); g.rotate(p.r);
        g.fillStyle = p.c; g.globalAlpha = Math.max(0, 1 - f / 120);
        g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore();
      });
      f += 1;
      if (f < 130) _trameConfettis = requestAnimationFrame(tick);
      else { _trameConfettis = 0; g.clearRect(0, 0, cv.width, cv.height); }
    };
    cancelAnimationFrame(_trameConfettis);
    _trameConfettis = requestAnimationFrame(tick);
  }

  function arreterAnimations() {
    if (_trameConfettis) { cancelAnimationFrame(_trameConfettis); _trameConfettis = 0; }
    const cv = $('confetti');
    if (cv && cv.getContext) cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
    clearTimeout(_minuteurToast);
    const t = $('toast');
    if (t) t.classList.remove('show');
  }
  // ⚠️ L onglet qui passe en arriere-plan compte aussi comme « quitter l ecran ».
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) arreterAnimations();
  });

  function aller(id) {
    if (_vueCourante.nom !== 'accueil') { rendreAccueil(id); return; }
    const el = $(id);
    if (el) el.scrollIntoView({ behavior: motionOk() ? 'smooth' : 'auto', block: 'start' });
    majNav(id);
  }

  /* ══ LES CLICS, UNE SEULE DELEGATION, BORNEE A L ESPACE ═══════════════════ */
  document.addEventListener('click', (e) => {
    const racine = $('formationApp');
    if (!racine || !racine.contains(e.target)) return;
    const t = e.target.closest('[data-go],[data-mod],[data-open],[data-chap],[data-complete],[data-undo],[data-export]');
    if (!t) return;
    if (t.dataset.go) { aller(t.dataset.go); return; }
    if (t.dataset.mod != null) { rendreModule(Number(t.dataset.mod), null); return; }
    if (t.dataset.open) {
      const [a, b] = t.dataset.open.split(',').map(Number);
      rendreModule(a, b);
      return;
    }
    if (t.dataset.chap != null) { rendreModule(_vueCourante.mi, Number(t.dataset.chap)); return; }
    if (t.hasAttribute('data-complete')) { terminer(); return; }
    if (t.hasAttribute('data-undo')) { annuler(); return; }
    if (t.hasAttribute('data-export')) { exporterNotes(); }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const m = document.querySelector('#formationApp .modal-bg');
    if (m) m.remove();
  });
  window.addEventListener('resize', () => {
    if (_vueCourante.nom === 'module') dessinerChart(_vueCourante.mi * 31 + _vueCourante.ci * 7 + 3);
  });

  /* ══ L ENTREE DANS L ESPACE ═══════════════════════════════════════════════ */
  const Formation = {
    /**
     * ⚠️ Rendu a CHAQUE ouverture, pas une fois pour toutes : la progression et
     * les notes viennent de Supabase et peuvent avoir change depuis un autre
     * appareil. Un rendu unique montrerait un etat perime sans qu aucune erreur
     * ne le signale.
     */
    async ouvrir() {
      await charger();
      // ⚠️ Le texte des notes est necessaire des l accueil : la section « Mes
      // notes » y vit. ⛔ Sans cela elle serait vide alors que les notes
      // existent en base.
      await chargerToutesLesNotes();
      rendreAccueil('accueil');
    },
    aller,
    ouvrirModule(numero) {
      const i = mods().findIndex((m) => m.numero === String(numero));
      if (i >= 0) rendreModule(i, null);
    },
    ouvrirLecon(id) {
      const M = mods();
      for (let mi = 0; mi < M.length; mi += 1) {
        const ci = M[mi].lecons.findIndex((l) => l.id === id);
        if (ci >= 0) { rendreModule(mi, ci); return; }
      }
    },
    exporterNotes,
    arreterAnimations,
    // ⚠️ Exposes pour les sondes : elles doivent pouvoir lire le CALCUL, pas le
    // deviner. ⛔ Aucun d eux n ECRIT quoi que ce soit.
    _calcul: { xpTotal, niveauDe, badges, serie, NIVEAUX, XP_CHAP, XP_MOD, XP_CERT },
  };
  window.Formation = Formation;
})();
