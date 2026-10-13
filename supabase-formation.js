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
    await chargerBienvenue(u);
  }

  /* ══ LA FENETRE DE BIENVENUE ═══════════════════════════════════════════ */
  /**
   * ── ⛔ COMMENT ON DISTINGUE « JAMAIS VUE » DE « VUE ET FERMEE » ──────────
   *
   * Par L EXISTENCE DE LA LIGNE dans `formation_parcours_vu`, et par rien
   * d autre :
   *
   *     aucune ligne   la fenetre n a JAMAIS ete montree  -> on la montre
   *     une ligne      elle a ete montree, et `vue_le` dit quand
   *                    -> on ne la remontre plus, jamais
   *
   * ⛔ FERMER COMPTE COMME VOIR, et c est le point. Douze minutes imposees a
   * l arrivee et l eleve ferme l onglet : on ne le force pas une seconde fois.
   * ⚠️ La video reste dans l Introduction, c est tout l interet de l y ranger.
   *
   * ⛔ LA LIGNE EST ECRITE A L OUVERTURE, PAS A LA FERMETURE. Un eleve qui
   * ferme l onglet sans cliquer, ou qui perd sa connexion, ne doit pas la
   * revoir au prochain chargement : l ecriture au moment ou on l affiche est la
   * seule qui tienne. ⚠️ Le prix assume est qu une fenetre affichee une demi-
   * seconde avant un plantage compte comme vue.
   *
   * ⚠️ `lecons_vues_au_dernier_affichage` reste a 0 : la colonne servait a
   * l ancien usage de cette table. On ne la supprime pas, on ne s en sert pas.
   */
  let _bienvenueAMontrer = false;
  async function chargerBienvenue(u) {
    _bienvenueAMontrer = false;
    try {
      const { data, error } = await cli()
        .from('formation_parcours_vu').select('vue_le').eq('user_id', u).maybeSingle();
      if (error) {
        // ⛔ On NE MONTRE PAS en cas de doute. Une lecture qui echoue ferait
        // reapparaitre la fenetre a chaque chargement, ce qui est pire que de
        // ne pas la montrer : la video reste dans l Introduction.
        console.warn('[FORMATION] bienvenue illisible, fenetre non montree :', error.message);
        return;
      }
      _bienvenueAMontrer = !data;
    } catch (e) {
      console.warn('[FORMATION] bienvenue illisible :', e);
    }
  }

  /** Note que la fenetre a ete montree. ⚠️ Idempotent : `upsert` sur la cle. */
  async function marquerBienvenueVue() {
    const u = await uid();
    if (!u) return false;
    const { error } = await cli().from('formation_parcours_vu')
      .upsert({ user_id: u, lecons_vues_au_dernier_affichage: 0 }, { onConflict: 'user_id' });
    if (error) { console.warn('[FORMATION] bienvenue non notee :', error.message); return false; }
    _bienvenueAMontrer = false;
    return true;
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
    // ⛔ L Introduction exclue, comme dans `prochain()` : voir son commentaire.
    return D().SUITE.find((l) => l.module !== '00' && !estVue(l.id)) || null;
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
  /**
   * ── ⛔ CHAQUE MODULE VAUT 100 XP, DIVISES PAR SON NOMBRE DE CHAPITRES ──────
   *
   * Tranche par Nadir le 14/10. ⚠️ Un chapitre ne vaut donc pas la meme chose
   * partout, et c est voulu : on recompense l AVANCEMENT, pas le temps passe.
   * Un module de 12 chapitres ne rapporte pas plus qu un module de 3.
   *
   * ⛔ LES DIVISIONS NE TOMBENT PAS RONDES. Le module 1 a 7 chapitres, soit
   * 14,28 chacun. ⚠️ Afficher une decimale est laid ; arrondir chapitre par
   * chapitre fait que le module ne totalise plus 100 : 7 x 14 = 98.
   *
   * ⛔ ON REPARTIT DONC LES ARRONDIS. Chaque chapitre recoit la part entiere,
   * et les unites restantes vont aux PREMIERS chapitres, un chacune. Pour 7
   * chapitres : les deux premiers recoivent l unite restante, soit
   * 15, 15, 14, 14, 14, 14, 14. Total 100.
   *
   * ⚠️ Les premiers plutot que les derniers : un eleve qui abandonne en route a
   * encaisse la part la plus grande, et le dernier chapitre ne vaut jamais
   * moins que les autres de plus d une unite.
   */
  const XP_MODULE = 100;

  /**
   * La part de chaque chapitre d un module, dans l ordre.
   * @return {number[]} longueur = nombre de chapitres, somme = 100
   */
  function partsXp(nbChapitres) {
    if (!nbChapitres) return [];
    const base = Math.floor(XP_MODULE / nbChapitres);
    const reste = XP_MODULE - base * nbChapitres;
    return Array.from({ length: nbChapitres }, (_, i) => base + (i < reste ? 1 : 0));
  }

  /** Les XP d un chapitre, par son identifiant. ⚠️ Zero s il est introuvable. */
  function xpDe(leconId) {
    for (const m of mods()) {
      const i = m.lecons.findIndex((l) => l.id === leconId);
      if (i >= 0) {
        // ⛔ L INTRODUCTION NE RAPPORTE RIEN. Elle ne compte pas pour la
        // certification non plus : la video de bienvenue n est pas un acquis.
        // ⛔ L INTRODUCTION et LE BONUS rapportent zero. ⚠️ Le bonus reste
        // visible : zero XP ne veut pas dire cache.
        if (m.introduction || m.bonus) return 0;
        return partsXp(m.lecons.length)[i];
      }
    }
    return 0;
  }

  const XP_MOD = 250;
  const XP_CERT = 1000;

  /**
   * ── ⛔ LE MAXIMUM ATTEIGNABLE SE CALCULE, IL NE S ECRIT PAS ───────────────
   *
   * ⚠️ DEUX SYSTEMES S ADDITIONNENT, et il faut le dire parce que deux
   * compteurs qui ne comptent pas la meme chose est precisement ce qu il ne
   * faut pas :
   *
   *   les CHAPITRES   100 XP par module, repartis entre ses chapitres.
   *                   C est l avancement fin : chaque chapitre vu rapporte.
   *   les MODULES     XP_MOD de plus quand un module est TERMINE en entier.
   *                   C est la recompense d avoir fini, pas d avoir avance.
   *
   * ⛔ Ils ne se concurrencent pas : le premier mesure le chemin, le second
   * marque l arrivee. Et `xpTotal()` les additionne, une seule fois chacun.
   *
   * ⛔ AUCUN TOTAL N EST ECRIT EN DUR. Le jour ou la certification du module 10
   * aura des chapitres, elle rapportera, et ce maximum montera tout seul.
   * ⚠️ Un 3150 ecrit ici serait faux le lendemain, sans que rien ne le signale.
   */
  function xpMaximum() {
    let max = 0;
    for (const m of mods()) {
      if (m.introduction || m.bonus || !m.lecons.length) continue;
      max += XP_MODULE;                              // tous ses chapitres
      max += estCert(m) ? XP_CERT : XP_MOD;          // et le module termine
    }
    return max;
  }

  /**
   * ── ⛔ LES PALIERS SE DERIVENT DU MAXIMUM, ILS NE SONT PLUS FIXES ─────────
   *
   * ⚠️ DEFAUT MESURE LE 14/10 : ils montaient a 8200 XP, calibres sur l ancien
   * calcul qui donnait 100 XP par chapitre, soit 6300. Depuis que chaque module
   * vaut 100, le maximum atteignable est tombe a 3150. ⛔ Les trois derniers
   * paliers etaient donc INATTEIGNABLES, et un eleve ayant tout termine serait
   * reste au troisieme niveau sur sept, sans qu aucune erreur ne le dise.
   *
   * ⚠️ Les NOMS sont un choix editorial et ne bougent pas. Les seuils, eux,
   * sont des fractions du maximum : ils suivent le parcours quoi qu il arrive.
   */
  const NOMS_NIVEAUX = ['Découvrir', 'Psychologie', 'Méthode', 'Outils',
    'Discipline', 'Financé', 'Durer'];
  const niveaux = () => {
    const max = xpMaximum();
    return NOMS_NIVEAUX.map((nom, i) => ({
      nom,
      // ⚠️ Le premier a 0, le dernier au maximum : on atteint le sommet en
      // terminant le parcours, et pas avant.
      xp: Math.round((max * i) / (NOMS_NIVEAUX.length - 1)),
    }));
  };
  /**
   * ⛔ `niveaux()` EST UNE FONCTION, PAS UNE CONSTANTE. ⚠️ Fige au chargement,
   * le tableau n aurait plus suivi les donnees : ajouter un module n aurait
   * rien change aux paliers, et la derivation n aurait ete qu une apparence.
   */

  /* ══ LES TROIS CONDITIONS DE PASSAGE DE NIVEAU ════════════════════════════ */
  /**
   * ── ⛔ TROIS SOURCES, AUCUNE CONSTRUITE, AUCUNE QUI OUVRE PAR DEFAUT ──────
   *
   * Passer d un niveau au suivant demande les TROIS, pas deux sur trois :
   *
   *   1. l eleve a TOUT PAYE      l info vit dans le tableur de Manu
   *   2. il a VALIDE son quiz     80 % minimum
   *   3. il a rempli 20 SEANCES   dans son journal
   *
   * ⛔ AUCUNE DES TROIS NE SE MESURE AUJOURD HUI. Le lien au tableur n existe
   * pas, les quiz n existent pas, et le comptage des seances appartient a la
   * refonte du journal. ⚠️ Chacune est donc isolee derriere une fonction qui
   * rendra un jour la vraie valeur : un futur lot n a qu a la remplir.
   *
   * ⛔ ET UNE SOURCE ABSENTE FERME, ELLE N OUVRE PAS. C est la regle la plus
   * importante de ce bloc : un `?? true` quelque part donnerait l acces a tout
   * le monde, et personne ne s en apercevrait avant qu un eleve non paye ne
   * voie le module 07. ⚠️ `etat` vaut `'inconnu'` tant que la source se tait,
   * et `'inconnu'` ne passe jamais pour `'rempli'`.
   */
  const CONDITIONS = [
    {
      cle: 'paiement',
      /**
       * ⛔ A REMPLIR : lire l etat de paiement dans le tableur de Manu.
       * ⚠️ Chemin releve le 14/10 dans `_contenu-formation/releve-paiement-et-
       * seances.md` : colonne AC du tableur, qui porte le MONTANT et non un
       * etat. Il faudra une action lecture seule dans le dispatcher Apps
       * Script, appelee cote SERVEUR, jamais depuis le navigateur.
       */
      lire: () => ({ etat: 'inconnu' }),
      message: () => 'Ton accès au niveau suivant n’est pas encore ouvert.',
      action: 'Écris à ton coach',
    },
    {
      cle: 'quiz',
      /**
       * ⛔ A REMPLIR : le score du quiz du dernier module du niveau, 80 % mini.
       * ⚠️ Les quiz n existent pas encore. Specification dans
       * `_contenu-formation/specification-quiz.md`.
       */
      lire: () => ({ etat: 'a_venir' }),
      /**
       * ⚠️ « A VENIR » N EST PAS UN ECHEC, et la formulation le dit. ⛔ Un eleve
       * qui lirait « quiz non valide » alors qu aucun quiz n existe croirait a
       * un defaut et ecrirait au coach pour rien.
       * ⛔ TEXTE PROPOSE, pas fige : il est publie au nom de Trader 360.
       */
      message: () => 'Le quiz de fin de niveau arrive bientôt. Rien à faire pour l’instant.',
      action: null,
    },
    {
      cle: 'seances',
      /**
       * ⛔ A REMPLIR : compter les seances remplies dans `journal_entries`.
       * ⚠️ Quatre questions restent ouvertes, relevees le 14/10 : ce qu est une
       * seance remplie, si les journees `no_trade` comptent, vingt d affilee ou
       * vingt en tout, et ce qui se passe si l eleve en efface.
       * ⛔ Rattache a la refonte du journal, pas a l espace formation.
       */
      lire: () => ({ etat: 'inconnu', faites: null, requis: 20 }),
      message: (v) => (v.faites == null
        ? 'Il te faut 20 séances remplies dans ton journal.'
        : `Il te reste ${Math.max(0, v.requis - v.faites)} séance(s) à remplir dans ton journal.`),
      action: 'Ouvrir mon journal',
    },
  ];

  /**
   * L etat des trois conditions, et ce qui bloque.
   * @return {{ouvert:boolean, manquantes:Array}}
   */
  function conditionsNiveau() {
    const manquantes = [];
    for (const c of CONDITIONS) {
      const v = c.lire();
      // ⛔ SEUL `'rempli'` OUVRE. `'inconnu'`, `'a_venir'`, `'manquant'` et
      // toute valeur inattendue ferment : c est le defaut qui protege.
      if (v.etat !== 'rempli') {
        manquantes.push({ cle: c.cle, etat: v.etat, texte: c.message(v), action: c.action });
      }
    }
    return { ouvert: manquantes.length === 0, manquantes };
  }

  /**
   * ── ⛔ LA CLE VIENT DE LA DONNEE, ELLE NE SE RECONSTRUIT PLUS ─────────────
   *
   * ⚠️ Ce fichier portait `cleModule(m)`, qui refabriquait « 07bis » a partir
   * de « 7 bis » a coups de `replace` et de `padStart`. ⛔ C etait le cinquieme
   * rattrapage d un meme defaut, et un sixieme est arrive quand meme ailleurs :
   * la pose des descriptions lisait `DESCRIPTIONS[m.numero]` et perdait celle
   * du 7 bis en silence.
   *
   * ⛔ `cle` EST DESORMAIS DECLAREE DANS LA DONNEE, a cote du `numero`, et
   * `assets/formation-donnees.js` crie si une cle manque ou ne resout rien.
   * ⚠️ `numero` ne sert plus qu a l affichage : c est ce que l eleve lit.
   */
  const mods = () => D().MODULES;
  /**
   * ── ⛔ L INTRODUCTION NE COMPTE PAS DANS LE PARCOURS ──────────────────────
   *
   * ⚠️ DEFAUT VU A L OEIL LE 14/10, sur une capture en 390 : l accueil
   * annoncait « 22 chapitres terminés » et un anneau a 34 % alors que
   * l Introduction n avait pas ete regardee , elle etait comptee au
   * denominateur. ⛔ Un eleve ayant termine les ONZE modules n aurait jamais
   * atteint 100 %, et le message « Parcours terminé » lui aurait echappe pour
   * une video de bienvenue.
   *
   * ⛔ C est le MEME arbitrage que partout ailleurs dans ce fichier :
   * l Introduction ne rapporte pas d XP, ne conditionne pas la certification,
   * n a pas de badge. ⚠️ Elle ne comptait que dans ce total-ci, et c est ce
   * genre d exception oubliee qui fait des chiffres faux sans erreur.
   */
  const chapitresParcours = () => mods().filter((m) => !estIntro(m)).flatMap((m) => m.lecons);
  const totalChap = () => chapitresParcours().length;
  const faitesDe = (m) => m.lecons.filter((l) => estVue(l.id)).length;
  const pctDe = (m) => (m.lecons.length ? Math.round((faitesDe(m) / m.lecons.length) * 100) : 0);
  const moduleFini = (m) => m.lecons.length > 0 && faitesDe(m) === m.lecons.length;
  const estCert = (m) => !!m.certification;
  const estIntro = (m) => !!m.introduction;
  /**
   * La certification s ouvre quand les neuf autres modules sont traverses.
   * ⛔ L INTRODUCTION EN EST EXCLUE : elle a ete ajoutee au lot 11 pour ranger
   * la video de bienvenue, et la compter ici ferait du visionnage de cette
   * video une condition neuve pour obtenir le certificat. ⚠️ D autant qu elle
   * ne peut pas encore jouer, sa liste de domaines Vimeo n etant pas confirmee :
   * le certificat deviendrait inatteignable.
   */
  const estBonus = (m) => !!m.bonus;
  /**
   * ⛔ NI L INTRODUCTION NI LE BONUS ne conditionnent la certification.
   * ⚠️ Le module 9 est hors parcours : exiger ses trois chapitres pour le
   * certificat en ferait un passage oblige, ce qu un bonus n est pas.
   */
  const certOuverte = () => mods()
    .filter((m) => !estCert(m) && !estIntro(m) && !estBonus(m)).every(moduleFini);
  const nbFaites = () => chapitresParcours().filter((l) => estVue(l.id)).length;

  /**
   * ── ⛔ « CE MODULE S OUVRE-T-IL ? » SE DEMANDE A UN SEUL ENDROIT ──────────
   *
   * ⚠️ DEFAUT MESURE LE 14/10 : le verrou de niveau n existait QUE dans le
   * rendu de la carte. `rendreModule()` ne le connaissait pas. Les modules 05
   * et 07 s affichaient donc avec leur cadenas et leurs conditions manquantes,
   * et un clic les ouvrait quand meme , la carte etant un `<button>`, le
   * `aria-disabled` n empeche rien.
   *
   * ⛔ CE N EST PAS DEUX FOIS LA MEME CONDITION, C EST UNE SEULE, LUE PAR LES
   * DEUX. Ecrire le verrou une seconde fois dans `rendreModule` aurait remis le
   * meme piege un cran plus loin : deux copies qui divergent au premier
   * changement, et c est l affichage qui aurait eu l air juste.
   *
   * @return {{ouvrable:boolean, cause:string|null, cond:object, niveau:object|null}}
   */
  function etatModule(m) {
    const niveau = D().niveauDuModule(m.cle);
    /**
     * ⚠️ LE VERROU DE NIVEAU NE PORTE QUE SUR LE PREMIER MODULE D UN NIVEAU.
     * ⛔ Verrouiller tout le niveau cacherait son contenu, alors que l eleve
     * doit voir ce qui l attend. ⚠️ Et le bonus n est jamais verrouille : il
     * est hors parcours, il ne rapporte rien, il ne conditionne rien.
     */
    const premierDuNiveau = !!niveau && niveau.modules[0] === m.cle;
    const soumis = premierDuNiveau && niveau.cle !== 'debutant' && !estBonus(m);
    const cond = soumis ? conditionsNiveau() : { ouvert: true, manquantes: [] };
    if (!cond.ouvert) return { ouvrable: false, cause: 'niveau', cond, niveau };
    if (estCert(m) && !certOuverte()) return { ouvrable: false, cause: 'certification', cond, niveau };
    if (!m.lecons.length) return { ouvrable: false, cause: 'vide', cond, niveau };
    return { ouvrable: true, cause: null, cond, niveau };
  }

  function xpTotal() {
    /**
     * ⛔ LA SOMME DES CHAPITRES VUS, chacun a sa propre valeur.
     * ⚠️ L ancien calcul comptait 100 XP par chapitre, soit 6 300 pour le
     * parcours. ⛔ Deux systemes qui comptent differemment seraient pires que
     * pas de gamification : celui-ci est le seul.
     */
    let x = 0;
    mods().forEach((m) => {
      const parts = partsXp(m.lecons.length);
      m.lecons.forEach((l, i) => { if (estVue(l.id) && !m.introduction && !m.bonus) x += parts[i]; });
    });
    mods().forEach((m) => {
      if (moduleFini(m) && !m.introduction && !m.bonus) x += estCert(m) ? XP_CERT : XP_MOD;
    });
    return x;
  }
  function niveauDe(x) {
    let i = 0;
    niveaux().forEach((n, k) => { if (x >= n.xp) i = k; });
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

  /* ══ LES ONZE BADGES DE MODULE ════════════════════════════════════════════
   *
   * ── ⛔ UNE DECLINAISON, PAS ONZE DESSINS ─────────────────────────────────
   *
   * Forme commune, numero du module, couleur du niveau. ⚠️ Onze dessins
   * separes auraient onze occasions de divergence et personne ne les
   * compterait ; une declinaison se lit comme une collection.
   *
   * ⛔ ENGENDRES, ET AUCUNE REQUETE RESEAU. Le badge est du SVG construit au
   * moment ou on l affiche. ⚠️ Un fichier a telecharger ferait attendre le
   * moment le plus important de la scene, et un reseau lent le casserait ;
   * ici il ne peut pas arriver en retard, il n arrive pas d ailleurs.
   *
   * ── ⚠️ LES TROIS METAUX, PROPOSES ET NON FIGES ───────────────────────────
   *
   *     Débutant       cuivre   le depart, chaud et mat
   *     Intermédiaire  acier    le palier technique, froid et net
   *     Confirmé       or       la couleur de la maison, gardee pour la fin
   *
   * ⛔ CETTE PROGRESSION EST UN CHOIX, et c est le seul endroit du lot ou j en
   * fais un sans mesure pour le trancher : cuivre → acier → or se lit sans
   * legende parce que tout le monde connait le podium. ⚠️ Le prix assume est
   * que les premiers badges sont les moins brillants. L autre voie etait de
   * tout faire en or et de ne marquer le niveau que par l anneau : plus
   * homogene, moins progressif. A Nadir de trancher.
   *
   * ⚠️ ET « S ECLAIRER EN DORE » RESTE DORE POUR LES ONZE. Le metal dit le
   * niveau, la LUMIERE de la revelation est la meme pour tous : c est le
   * moment qui compte, pas le rang.
   */
  const METAUX = {
    debutant: { clair: '#e8b887', moyen: '#c9833f', sombre: '#8a5526', nom: 'cuivre' },
    intermediaire: { clair: '#eef1f6', moyen: '#c2cad6', sombre: '#8b94a3', nom: 'acier' },
    confirme: { clair: '#f3d585', moyen: '#e8b84b', sombre: '#b98a2e', nom: 'or' },
  };
  /** Le metal d un module, par son niveau. ⚠️ L or par defaut, jamais du gris. */
  const metalDe = (m) => {
    const n = D().niveauDuModule(m.cle);
    return METAUX[n ? n.cle : 'confirme'] || METAUX.confirme;
  };

  /**
   * Les badges, chacun CALCULE. ⛔ Il n existe aucun endroit ou un badge
   * pourrait etre pose a la main : un badge non merite est un badge qui ne
   * veut plus rien dire.
   */
  function badges() {
    return [
      { id: 'first', t: 'Première séance', d: 'Ton premier chapitre terminé.',
        forme: 'etoile', metal: METAUX.debutant, glyphe: '1',
        ok: () => nbFaites() >= 1 },
      /**
       * ⛔ LES ONZE MODULES, L INTRODUCTION EXCEPTEE. ⚠️ Elle n est pas une
       * etape : regarder la video de bienvenue ne se recompense pas.
       */
      ...mods().filter((m) => !estIntro(m)).map((m) => ({
        id: `m${m.cle}`,
        /**
         * ── ⛔ DEUX LIBELLES, ET C EST UNE CORRECTION VUE A L OEIL ──────────
         *
         * ⚠️ La collection affichait « Module 04 validé » sous une silhouette,
         * avec « PAS ENCORE » juste dessous. ⛔ Les deux phrases se
         * contredisent : la premiere affirme ce que la seconde dement, et
         * c est la premiere qu on lit.
         *
         * ⛔ `t` EST LE NOM DU BADGE, neutre, celui qui tient dans les deux
         * etats. ⚠️ `tFait` est ce qu on annonce AU MOMENT de l obtenir, dans
         * la scene, ou « validé » est exactement le mot juste.
         */
        t: estCert(m) ? 'Certification Trader 360'
          : estBonus(m) ? 'Les bonus' : `Module ${m.numero}`,
        tFait: estCert(m) ? 'Trader 360 certifié'
          : estBonus(m) ? 'Bonus parcourus' : `Module ${m.numero} validé`,
        d: m.titre,
        /**
         * ⛔ LE MODULE 09 EST D UNE AUTRE NATURE, ET SON BADGE LE DIT.
         * ⚠️ Il ne rapporte aucun XP et ne compte pas dans la progression :
         * lui donner le meme ecusson numerote que les dix autres le ferait
         * passer pour une etape du parcours. ⛔ Rond, sans numero, marque
         * d une etoile : c est un a-cote, et il se voit.
         */
        forme: estBonus(m) ? 'etoile' : estCert(m) ? 'certification' : 'module',
        metal: metalDe(m),
        glyphe: estBonus(m) ? null : estCert(m) ? '360' : m.cle.replace('bis', 'ᵇ'),
        module: m.cle,
        ok: () => moduleFini(m),
        big: estCert(m),
      })),
      { id: 'half', t: 'Mi-parcours', d: 'La moitié des chapitres terminés.',
        forme: 'etoile', metal: METAUX.intermediaire, glyphe: '½',
        ok: () => totalChap() > 0 && nbFaites() >= Math.ceil(totalChap() / 2) },
      /**
       * ⚠️ LE LIBELLE NE PRESCRIT PLUS DE RYTHME. Il disait « au moins un
       * chapitre par semaine », et ⛔ Nadir a retire cette phrase de l ecran
       * le 14/10 : ce n est pas au site de dicter une cadence. Le badge, lui,
       * reste : il CONSTATE quatre semaines d affilee, il ne les demande pas.
       */
      { id: 'weeks4', t: 'Quatre semaines d affilée',
        d: 'Tu as avancé quatre semaines de suite.',
        forme: 'etoile', metal: METAUX.confirme, glyphe: '4',
        ok: () => serie() >= 4 },
    ];
  }
  /** Le badge d un module, par sa cle. ⚠️ `null` si le module n en a pas. */
  const badgeDeModule = (cle) => badges().find((b) => b.module === cle) || null;

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
      /**
       * ⛔ L INTRODUCTION N EST JAMAIS « LA PROCHAINE ETAPE ». ⚠️ DEFAUT VU A
       * L OEIL : l accueil annoncait « Prochaine étape : Module 00 · Bienvenue
       * à Trader 360 » et le bouton « Reprendre » y menait. Elle est la
       * premiere du tableau, donc la premiere non vue : le parcours entier
       * commencait par une video de bienvenue presentee comme une etape.
       * ⛔ Elle a sa carte a part, c est la qu on la regarde.
       * ⚠️ Et le module verrouille non plus : proposer une porte fermee.
       */
      if (estIntro(m)) continue;
      if (!etatModule(m).ouvrable) continue;
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
  /**
   * ── ⛔ UN SEUL GENERATEUR POUR LES QUATORZE BADGES ────────────────────────
   *
   * ⚠️ Trois formes, trois metaux, un glyphe. ⛔ Chaque identifiant de degrade
   * est UNIQUE : deux `<svg>` qui partagent un `id` de `defs` dans la meme page
   * font que le second emprunte le degrade du premier, et un badge d acier
   * s afficherait en cuivre sans que rien ne le signale.
   *
   * ⚠️ `role="img"` ET UN LIBELLE, pas `aria-hidden`. Dans la collection, le
   * badge EST l information : masque aux lecteurs d ecran, la grille ne dirait
   * rien du tout.
   */
  let _numeroMedaille = 0;
  function medaille(b, opts) {
    const o = opts || {};
    const m = b.metal || METAUX.confirme;
    const g = `md${(_numeroMedaille += 1)}`;
    const glyphe = b.glyphe == null ? '' : String(b.glyphe);
    const taillePolice = glyphe.length > 2 ? 13 : glyphe.length > 1 ? 17 : 20;
    const degrades = `<defs>
      <linearGradient id="${g}m" x1="0" y1="0" x2=".35" y2="1">
        <stop offset="0" stop-color="${m.clair}"/><stop offset=".52" stop-color="${m.moyen}"/>
        <stop offset="1" stop-color="${m.sombre}"/></linearGradient>
      <radialGradient id="${g}h"><stop offset="0" stop-color="#fff" stop-opacity=".9"/>
        <stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
      <linearGradient id="${g}s" x1="0" y1="0" x2="1" y2="1">
        <stop offset=".30" stop-color="#fff" stop-opacity="0"/>
        <stop offset=".50" stop-color="#fff" stop-opacity=".85"/>
        <stop offset=".70" stop-color="#fff" stop-opacity="0"/></linearGradient>
      <clipPath id="${g}c"><path d="${b.forme === 'etoile'
        ? 'M32 4a28 28 0 1 0 .1 0Z' : 'M32 2 58 17v30L32 62 6 47V17Z'}"/></clipPath>
    </defs>`;
    /** ⚠️ Le corps change, le reste est commun : c est ce qui fait la famille. */
    let corps;
    if (b.forme === 'etoile') {
      // ⛔ ROND, et une etoile a cinq branches : hors parcours, et ca se voit.
      corps = `<circle cx="32" cy="32" r="28" fill="#0d0f13" stroke="url(#${g}m)" stroke-width="2.4"/>
        <circle cx="32" cy="32" r="22" fill="url(#${g}m)" opacity=".10"/>
        <path d="M32 15.5l4.6 10.3 11.2 1.2-8.4 7.5 2.4 11-9.8-5.7-9.8 5.7 2.4-11-8.4-7.5 11.2-1.2z"
          fill="url(#${g}m)" opacity=".95"/>
        ${glyphe ? `<text x="32" y="36" text-anchor="middle" font-family="JetBrains Mono,monospace"
          font-weight="700" font-size="13" fill="#0d0f13">${txt(glyphe)}</text>` : ''}`;
    } else if (b.forme === 'certification') {
      // ⛔ DOUBLE ANNEAU : c est l arrivee, elle ne ressemble pas a une etape.
      corps = `<path d="M32 2 58 17v30L32 62 6 47V17Z" fill="#0d0f13" stroke="url(#${g}m)" stroke-width="2.6"/>
        <path d="M32 8 52.8 20v24L32 56 11.2 44V20Z" fill="none" stroke="url(#${g}m)" stroke-width="1.1" opacity=".55"/>
        <path d="M32 13 48 22.2v19.6L32 51 16 41.8V22.2Z" fill="url(#${g}m)" opacity=".13"/>
        <text x="32" y="38" text-anchor="middle" font-family="JetBrains Mono,monospace"
          font-weight="700" font-size="15" fill="url(#${g}m)">${txt(glyphe)}</text>`;
    } else {
      // L ecusson commun des dix modules du parcours.
      corps = `<path d="M32 2 58 17v30L32 62 6 47V17Z" fill="#0d0f13" stroke="url(#${g}m)" stroke-width="2.5"/>
        <path d="M32 10 51 21v22L32 54 13 43V21Z" fill="url(#${g}m)" opacity=".13"/>
        <path d="M22 20h20" stroke="url(#${g}m)" stroke-width="1.2" opacity=".5"/>
        <text x="32" y="40" text-anchor="middle" font-family="JetBrains Mono,monospace"
          font-weight="700" font-size="${taillePolice}" fill="url(#${g}m)">${txt(glyphe)}</text>`;
    }
    return `<svg class="medal${o.classe ? ` ${o.classe}` : ''}" viewBox="0 0 64 64"
      role="img" aria-label="${txt(b.t)}${o.obtenu === false ? ' , pas encore obtenu' : ''}"
      ${o.style ? `style="${o.style}"` : ''}>${degrades}
      <g class="medal__corps">${corps}</g>
      <!-- ⚠️ LE BALAYAGE ET LA LUEUR SONT TOUJOURS PRESENTS, invisibles au repos.
           ⛔ Les ajouter au moment de la scene demanderait de reconstruire le
           SVG pendant l animation, ce qui la fait sauter d une trame. -->
      <g class="medal__eclat" clip-path="url(#${g}c)">
        <rect class="medal__balayage" x="-70" y="-10" width="60" height="84" fill="url(#${g}s)"/>
      </g>
      <circle class="medal__lueur" cx="32" cy="32" r="31" fill="url(#${g}h)"/>
    </svg>`;
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
    if (b) b.textContent = niveaux()[niveauDe(x)].nom;
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
        <!-- ⛔ LE SON SE COUPE, et le reglage tient d une session a l autre.
             ⚠️ Un espace qui sonne sans qu on puisse l arreter se fait fermer. -->
        <button type="button" data-son aria-pressed="${sonActif() ? 'true' : 'false'}">${sonActif() ? 'Son : activé' : 'Son : coupé'}</button>
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
    const N = niveaux();
    const niv = N[li];
    const suiv = N[li + 1];
    const pctNiv = suiv ? Math.round(((x - niv.xp) / (suiv.xp - niv.xp)) * 100) : 100;
    const modsOk = M.filter(moduleFini).length;
    const pr = prochain();
    const st = serie();
    const act = semainesActives();
    const sem = clesSemaines(8);
    const cette = semaineIso(new Date());
    const C = 2 * Math.PI * 56;

    let reprendre;
    /**
     * ⛔ `data-open="0,0"` ETAIT ECRIT EN DUR, et il designait le module 01
     * tant que c etait le premier du tableau. ⚠️ Depuis que l Introduction y
     * est posee devant lui, l index 0 est l INTRODUCTION : le bouton
     * « Commencer le module 01 » ouvrait la video de bienvenue.
     * ⛔ Troisieme fois dans ce lot qu un index ecrit en dur devient faux quand
     * la liste change. On le CHERCHE, desormais.
     */
    const iPremier = M.findIndex((m) => !estIntro(m) && m.lecons.length);
    if (!faites) reprendre = `<button type="button" class="btn btn-gold" data-open="${iPremier},0">Commencer le module ${txt(M[iPremier].numero)} ${I.arrow}</button>`;
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
        <p class="lead">Onze modules, dans l'ordre réel de la progression d'un trader. Chaque chapitre terminé te rapporte de l'expérience et te rapproche de la certification.</p>
        <!-- ⚠️ « M.length » compte l Introduction, qui n est pas un module.
             ⛔ Et les accents graves sont interdits dans ce commentaire : il vit
             DANS un gabarit, ou un accent grave termine la chaine. -->
        <div class="hero-ctas">${reprendre}<button type="button" class="btn btn-ghost" data-go="modules">Voir les ${M.filter((m) => !estIntro(m)).length} modules</button></div>
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
            <div class="eyebrow" style="font-size:11px">Niveau ${li + 1} / ${N.length}</div>
            <div class="big">${txt(niv.nom)}</div>
            <div class="small">${faites ? `${faites} chapitre${faites > 1 ? 's' : ''} terminé${faites > 1 ? 's' : ''}` : 'Rien de commencé'}</div>
          </div>
        </div>
        <!--
          ── ⛔ LE PROCHAIN PALIER EST NOMME, CHIFFRE ET DESSINE ───────────────

          ⚠️ Il tenait en une ligne : « 525 XP avant Psychologie ». Nadir l a
          accepte le 14/10 mais a du REFLECHIR pour comprendre que c etait le
          prochain palier : un chiffre seul n a pas d echelle, et « avant »
          pouvait se lire comme une date.

          ⛔ Trois choses, donc, et dans cet ordre : le NOM de ce qui vient, ce
          qu il RESTE, et une BARRE qui montre ou on en est entre les deux
          paliers. ⚠️ Les deux bornes sont ecrites sous la barre : sans elles,
          un remplissage ne dit pas de quoi il est la fraction.
        -->
        <div class="lvl-bar palier" data-palier>
          <div class="head">
            <span class="palier-eyebrow">Prochain palier</span>
            <b>${suiv ? txt(suiv.nom) : 'Dernier niveau atteint'}</b>
          </div>
          ${suiv ? `<div class="palier-reste">Il te reste
            <b class="mono" data-palier-reste>${(suiv.xp - x).toLocaleString('fr-FR')} XP</b></div>` : ''}
          <div class="bar"><i data-w="${pctNiv}" data-palier-bar></i></div>
          <div class="palier-bornes">
            <span>${txt(niv.nom)}<em class="mono">${niv.xp.toLocaleString('fr-FR')}</em></span>
            <span class="mono" data-palier-xp>${x.toLocaleString('fr-FR')} XP</span>
            ${suiv ? `<span>${txt(suiv.nom)}<em class="mono">${suiv.xp.toLocaleString('fr-FR')}</em></span>` : ''}
          </div>
          <div class="ladder" aria-hidden="true">${N.map((l, k) => `<span class="${k <= li ? 'on' : ''}" data-palier-cran="${k}" title="${txt(l.nom)}"></span>`).join('')}</div>
        </div>
        <div class="stat-row">
          <div class="stat"><div class="k">Chapitres</div><div class="v">${faites}<span style="color:var(--ink-mute);font-weight:400">/${total}</span></div></div>
          <div class="stat"><div class="k">Modules</div><div class="v">${modsOk}<span style="color:var(--ink-mute);font-weight:400">/${M.filter((m) => !estIntro(m)).length}</span></div></div>
          <div class="stat"><div class="k">Badges</div><div class="v">${badges().filter((b) => b.ok()).length}<span style="color:var(--ink-mute);font-weight:400">/${badges().length}</span></div></div>
        </div>
        <!--
          ⛔ LA BANDE « RÉGULARITÉ · 8 SEMAINES » EST RETIREE, et avec elle la
          mention « un chapitre par semaine suffit ». ⚠️ Decision de Nadir du
          14/10 : il n est pas d accord avec ce rythme, et ce n est pas au site
          de le dicter. ⛔ La SERIE de semaines n a pas disparu du code pour
          autant : le badge « quatre semaines d affilee » la lit toujours, et il
          CONSTATE au lieu de prescrire. Voir « serie() ».
        -->
      </aside>
    </section>

    <section id="modules">
      <div class="sec-head">
        <div><div class="eyebrow">Le parcours</div><h2>Onze modules, du premier graphique<br>à la certification.</h2></div>
        <p>La psychologie vient avant la méthode. Suis l'ordre : chaque module prépare le suivant.</p>
      </div>
      <!--
        ── ⛔ L INTRODUCTION EST UNE ENTREE, PAS UNE ETAPE ───────────────────

        ⚠️ Elle etait une carte de la grille, douzieme module aligne avec les
        onze autres : meme cadre, meme pastille « À commencer », et un
        « MODULE 00 » qui n existe dans aucun sommaire. ⛔ Un eleve y lisait un
        module zero a valider.

        ⛔ ELLE N A DONC NI NUMERO, NI XP, NI CADENAS, et le mot
        « Introduction » lui suffit : pas de « en attente de description », qui
        est un aveu de chantier et pas un texte.

        ⚠️ Elle porte la VIDEO DE BIENVENUE, la meme que la fenetre de premiere
        connexion. C est tout l interet de l y ranger : la fenetre se ferme sans
        regarder, et la video reste la. ⛔ Le lecteur reste en attente tant que
        la liste de domaines Vimeo n est pas confirmee.
      -->
      ${(() => {
        const intro = M.find(estIntro);
        if (!intro) return '';
        const l = intro.lecons[0];
        const vu = l && estVue(l.id);
        return `<button type="button" class="intro-card" data-bienvenue>
          <span class="intro-card__marque" aria-hidden="true">${I.play}</span>
          <span class="intro-card__texte">
            <span class="intro-card__titre">Introduction</span>
            <span class="intro-card__sous">${vu ? 'La vidéo de bienvenue, à revoir quand tu veux.'
              : 'La vidéo de bienvenue, avant de commencer.'}</span>
          </span>
          <span class="intro-card__act">${vu ? 'Revoir' : 'Regarder'} ${I.arrow}</span>
        </button>`;
      })()}
      <div class="grid">
        ${M.filter((m) => !estIntro(m)).map((m) => {
          const i = M.indexOf(m);
          /**
           * ⛔ UN SEUL ETAT, LU PAR LA CARTE ET PAR L OUVERTURE. ⚠️ La carte
           * portait sa propre lecture du verrou, et `rendreModule` n en avait
           * aucune : les cartes verrouillees s ouvraient au clic.
           */
          const e = etatModule(m);
          const verrou = e.cause === 'certification';
          const verrouNiveau = e.cause === 'niveau';
          const vide = e.cause === 'vide';
          const niv = e.niveau;
          const cond = e.cond;
          const fini = moduleFini(m);
          const d = faitesDe(m);
          const pp = pctDe(m);
          const pastille = verrouNiveau ? `<span class="pill">${I.lock} Niveau ${txt(niv.nom)}</span>`
            : verrou ? `<span class="pill">${I.lock} Verrouillé</span>`
            : vide ? '<span class="pill">Leçons à venir</span>'
              : fini ? `<span class="pill ok">${I.check} Validé</span>`
                : d ? '<span class="pill go">En cours</span>' : '<span class="pill">À commencer</span>';
          const inerte = !e.ouvrable;
          const bm = badgeDeModule(m.cle);
          return `<button type="button" class="mod ${inerte ? 'locked' : ''} ${i === premierOuvert && d ? 'current' : ''}"
            ${inerte ? 'aria-disabled="true"' : ''} data-mod="${i}" data-carte-module="${txt(m.cle)}">
            ${pastille}
            <div class="num">MODULE ${txt(m.numero)}</div>
            <h3>${txt(m.titre)}</h3>
            <p>${m.description ? txt(m.description) : '<em style="color:var(--ink-mute)">En attente de description.</em>'}</p>
            <div class="foot">
              <div class="meta"><span>${verrouNiveau
                ? cond.manquantes.map((x) => txt(x.texte)).join('<br>')
                : verrou ? `Termine les modules 01 à ${txt(M[M.length - 2].numero)}`
                  : vide ? 'Chapitres à venir' : `${d} / ${m.lecons.length} chapitres`}</span><span class="mono">${inerte ? '' : `${pp} %`}</span></div>
              <div class="bar thin ${fini ? 'done' : ''}"><i data-w="${pp}" data-rail-module="${txt(m.cle)}"></i></div>
            </div>
            <!-- ⚠️ L ANCRE D OU LE BADGE EMERGE, et c est pour cela qu elle est
                 ici plutot que dans la scene : le badge doit sortir de SA carte,
                 pas du centre de l ecran. ⛔ Vide et sans taille : elle ne
                 dessine rien, elle donne un point. -->
            <span class="mod__ancre" data-ancre-badge="${txt(m.cle)}" aria-hidden="true"
              ${bm ? '' : 'hidden'}></span>
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
        <div><div class="eyebrow">Récompenses</div><h2>Ma collection.</h2></div>
        <p>Chaque badge correspond à une étape réelle du parcours, jamais à un simple clic.
          ${(() => { const n = badges().filter((b) => !b.ok()).length;
            return n ? `Il t'en reste <b style="color:var(--ink)">${n}</b> à décrocher.` : 'Tu les as tous.'; })()}</p>
      </div>
      <!--
        ── ⛔ LES BADGES NON OBTENUS SE VOIENT EN SILHOUETTE ─────────────────

        ⚠️ Pas caches, pas remplaces par un point d interrogation : la FORME
        exacte du badge, son numero compris, sans son metal. ⛔ C est ce qui
        donne envie du suivant : on voit precisement ce qu on n a pas.

        ⚠️ La silhouette est obtenue par un filtre CSS sur le MEME SVG, pas par
        un second dessin. Deux dessins divergeraient, et c est la silhouette qui
        aurait raison a l ecran.
      -->
      <div class="badges">
        ${badges().map((b) => { const o = b.ok(); return `<div class="badge ${o ? '' : 'off'}"
          data-badge="${txt(b.id)}" data-obtenu="${o ? 'oui' : 'non'}">
          ${medaille(b, { obtenu: o, classe: o ? '' : 'medal--silhouette' })}
          <strong>${txt(b.t)}</strong><span>${txt(b.d)}</span>
          ${o ? '' : '<em class="badge__etat">Pas encore</em>'}
        </div>`; }).join('')}
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
    montrerBienvenue();
  }

  /* ══ L ECRAN DES CONDITIONS ═══════════════════════════════════════════════
   *
   * ── ⛔ IL NOMME TOUT CE QUI MANQUE, ET IL DIT QUOI FAIRE ─────────────────
   *
   * ⚠️ Les trois conditions n appellent pas la meme action : « ton acces n est
   * pas ouvert » demande d ecrire au coach, « il te reste 7 seances » demande
   * d ouvrir le journal, et « le quiz arrive bientot » ne demande RIEN.
   * ⛔ Les confondre dans un seul « pas encore disponible » ferait ecrire au
   * coach pour une condition qu il ne peut pas lever.
   *
   * ⛔ ET « A VENIR » N EST PAS UN ECHEC : la condition porte `etat`, et l ecran
   * le lit pour ne pas habiller en reproche ce qui n est pas encore construit.
   */
  function montrerConditions(m, etat) {
    const existant = document.querySelector('#formationApp .cond-bg');
    if (existant) existant.remove();
    const bg = document.createElement('div');
    bg.className = 'modal-bg cond-bg';
    bg.innerHTML = `<div class="modal cond" role="dialog" aria-modal="true" aria-labelledby="condTitre">
      <span class="cond__cadenas" aria-hidden="true">${I.lock}</span>
      <div class="eyebrow">Niveau ${txt(etat.niveau ? etat.niveau.nom : '')}</div>
      <h3 id="condTitre">Module ${txt(m.numero)} , pas encore ouvert.</h3>
      <p>Trois conditions ouvrent ce niveau. Voilà où tu en es.</p>
      <ul class="cond__liste">
        ${CONDITIONS.map((c) => {
          const manque = etat.cond.manquantes.find((x) => x.cle === c.cle);
          const v = manque || { etat: 'rempli', texte: '', action: null };
          /**
           * ⚠️ TROIS ETATS A L ECRAN, PAS DEUX. ⛔ Un « rempli / pas rempli »
           * rangerait le quiz inexistant avec un paiement en retard, et l eleve
           * croirait avoir rate quelque chose.
           */
          const classe = !manque ? 'ok' : v.etat === 'a_venir' ? 'attente' : 'manque';
          const marque = !manque ? I.check : v.etat === 'a_venir' ? '…' : I.lock;
          return `<li class="cond__item ${classe}">
            <span class="cond__marque" aria-hidden="true">${marque}</span>
            <span class="cond__texte">
              <b>${txt({ paiement: 'Ton accès', quiz: 'Le quiz de fin de niveau',
                seances: 'Tes séances de journal' }[c.cle] || c.cle)}</b>
              <span>${manque ? txt(v.texte) : 'C’est bon.'}</span>
            </span>
            ${manque && v.action ? `<span class="cond__act">${txt(v.action)}</span>` : ''}
          </li>`;
        }).join('')}
      </ul>
      <div class="row"><button type="button" class="btn btn-ghost" data-close>J'ai compris</button></div>
    </div>`;
    // ⛔ DANS `#formationApp` : tout le style est prefixe par cet identifiant.
    $('formationApp').appendChild(bg);
    bg.addEventListener('click', (ev) => {
      if (ev.target === bg || ev.target.closest('[data-close]')) bg.remove();
    });
    const premier = bg.querySelector('button');
    if (premier) premier.focus();
  }

  /**
   * ── ⛔ LA FENETRE DE BIENVENUE, A LA PREMIERE CONNEXION SEULEMENT ────────
   *
   * ⚠️ ELLE SE FERME SANS REGARDER, et c est une exigence, pas un confort :
   * douze minutes imposees a l arrivee et l eleve ferme l onglet. Trois sorties,
   * toutes equivalentes : la croix, le bouton, et la touche d echappement.
   *
   * ⛔ LA VIDEO NE PEUT PAS ENCORE JOUER. Relevee dans Vimeo le 11/10, elle
   * porte `embed: "whitelist"` : son integration est restreinte a une liste de
   * domaines non confirmee. L emplacement du lecteur est pose et ANNONCE son
   * attente, plutot qu un lecteur en erreur que personne ne saurait lire.
   */
  /**
   * ── ⛔ ET POURQUOI NADIR NE LA VOYAIT PAS SUR L APERCU `9m8k49253` ────────
   *
   * ⚠️ CE N ETAIT PAS UN DEFAUT, MESURE EN BASE LE 14/10 : la table
   * `formation_parcours_vu` porte UNE ligne, celle de son compte, ecrite le
   * 11/10/2026 a 17 h 25. Il a donc vu la fenetre sur un apercu precedent, et
   * elle ne revient pas : c est exactement le comportement voulu.
   *
   * ⛔ CE QUI MANQUAIT, C EST LE MOYEN D Y REVENIR. La carte Introduction le
   * donne desormais : `forcee` passe outre le drapeau et n ecrit rien de plus.
   * ⚠️ Pour revoir la PREMIERE connexion telle qu un eleve la vit, il faut
   * effacer la ligne , ce que je ne fais pas moi-meme : c est une ecriture en
   * base, et la carte repond au besoin reel.
   *
   * @param {boolean} forcee demandee par l eleve, pas par la premiere connexion
   */
  function montrerBienvenue(forcee) {
    if (!forcee && !_bienvenueAMontrer) return;
    if (document.getElementById('formationBienvenue')) return;
    // ⛔ On note AVANT de montrer : voir `chargerBienvenue`. ⚠️ Mais pas quand
    // c est l eleve qui la redemande : il n y a rien de neuf a noter.
    if (!forcee) void marquerBienvenueVue();

    const d = document.createElement('dialog');
    d.id = 'formationBienvenue';
    d.className = 'f-bienvenue';
    d.innerHTML = `
      <div class="f-bienvenue__cadre">
        <button type="button" class="f-bienvenue__croix" data-fermer
          aria-label="Fermer">&times;</button>
        <p class="f-bienvenue__sur">Bienvenue</p>
        <h2 class="f-bienvenue__titre">Bienvenue à Trader 360</h2>
        <div class="f-bienvenue__lecteur" role="note">
          <p>La vidéo sera disponible ici très bientôt.</p>
        </div>
        <p class="f-bienvenue__sous">Tu la retrouveras quand tu veux dans
          <strong>Introduction</strong>, avant le module 01.</p>
        <button type="button" class="btn btn-gold" data-fermer>Commencer</button>
      </div>`;
    document.body.appendChild(d);
    const fermer = () => { d.close(); d.remove(); };
    d.querySelectorAll('[data-fermer]').forEach((b) => b.addEventListener('click', fermer));
    // ⚠️ La touche d echappement ferme deja un `<dialog>` : on retire l element
    // apres, sinon un second chargement trouverait l ancien et ne montrerait rien.
    d.addEventListener('close', () => d.remove());
    if (typeof d.showModal === 'function') d.showModal(); else d.setAttribute('open', '');
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
    /**
     * ── ⛔ LE MEME VERROU QUE LA CARTE, LU AU MEME ENDROIT ───────────────────
     *
     * ⚠️ Cette fonction ne connaissait que deux des trois causes : la
     * certification et le module vide. ⛔ Le verrou de NIVEAU lui manquait, et
     * un clic sur le module 05 ou 07 les ouvrait alors que leur carte affichait
     * un cadenas et trois conditions manquantes.
     *
     * ⛔ ET L ECRAN NOMME LES TROIS CONDITIONS, pas une. Les reveler une par
     * une ferait revenir l eleve trois fois pour rien.
     */
    const etat = etatModule(m);
    if (!etat.ouvrable) {
      if (etat.cause === 'niveau') {
        montrerConditions(m, etat);
      } else if (etat.cause === 'certification') {
        toast(I.lock, `Termine les modules 01 à ${txt(M[M.length - 2].numero)} pour débloquer la certification.`);
      } else {
        toast('⏳', `Les chapitres du module ${txt(m.numero)} arrivent.`);
      }
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
        <span><span class="t">${txt(ch.titre)}</span><br><span class="s">${dn ? `Terminé · +${xpDe(ch.id)} XP` : `+${xpDe(ch.id)} XP`}</span></span></button>`;
    }).join('');

    const prec = ci > 0 ? [mi, ci - 1] : (mi > 0 && M[mi - 1].lecons.length ? [mi - 1, M[mi - 1].lecons.length - 1] : null);
    const modSuiv = M[mi + 1];
    const suiv = ci < m.lecons.length - 1 ? [mi, ci + 1]
      : (modSuiv && modSuiv.lecons.length && !(estCert(modSuiv) && !certOuverte()) ? [mi + 1, 0] : null);
    const bCert = estCert(m) && moduleFini(m)
      /**
       * ⛔ `badges()[badges().length - 1]` ETAIT FAUX DEPUIS LE LOT 14.
       * ⚠️ La certification n est plus le dernier badge de la liste : les
       * badges de module sont engendres au milieu, et « quatre semaines
       * d affilee » les suit. Le certificat affichait donc la medaille de la
       * SERIE, avec son « 4 » en plein milieu, sans qu aucune erreur ne le
       * dise. ⛔ On le demande maintenant par sa cle.
       */
      ? `<div class="cert">${medaille(badgeDeModule('10') || badges()[0], { classe: 'medal--cert' })}<div class="eyebrow" style="margin-top:8px">Parcours validé</div><h3>Trader 360 certifié.</h3><p>Les onze modules sont traversés. La suite se joue en séance, avec le journal, le brief et la communauté.</p></div>`
      : '';

    app().innerHTML = `
    <div class="crumbs"><button type="button" data-go="modules">Les modules</button><span>/</span><span>Module ${txt(m.numero)}</span></div>
    <section class="mhead">
      <div><div class="eyebrow">Module ${txt(m.numero)} · ${m.lecons.length} chapitres</div><h1>${txt(m.titre)}</h1><p>${m.description ? txt(m.description) : '<em style="color:var(--ink-mute)">En attente de description.</em>'}</p></div>
      <!--
        ⚠️ L ANCRE D OU LE BADGE EMERGERA, DANS CETTE VUE-CI. ⛔ On termine un
        chapitre depuis la page du module, pas depuis la grille : la carte du
        module n est donc pas a l ecran a ce moment-la. Son representant ici est
        son rail de progression, et c est de la que le badge sort.
        ⚠️ Meme attribut que sur la carte, « data-ancre-badge » : la scene cherche
        « l ancre de ce module », elle ne sait pas sur quel ecran elle est.
      -->
      <div class="mprog"><div class="head"><span>${d} / ${m.lecons.length} terminés</span><b class="mono" style="color:var(--ink)">${pp} %</b></div><div class="bar ${pp === 100 ? 'done' : ''}"><i data-w="${pp}"></i></div>
        <span class="mod__ancre" data-ancre-badge="${txt(m.cle)}" aria-hidden="true"></span></div>
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
              /**
               * ── ⛔ `c.id`, ET C EST LE DEFAUT QUI FERMAIT TOUT LE PARCOURS ──
               *
               * ⚠️ Cette ligne lisait `xpDe(ch.id)`. `ch` est le parametre du
               * `.map()` qui construit la liste des chapitres, cinquante lignes
               * plus haut : il n existe PLUS ici. Le chapitre courant s appelle
               * `c`.
               *
               * ⛔ CE QUE CELA DONNAIT, MESURE DANS CHROME LE 14/10 : evaluer ce
               * gabarit levait `ReferenceError: ch is not defined`, donc
               * `app().innerHTML = ...` n etait jamais atteint. `rendreModule`
               * etant `async`, l exception devenait un rejet de promesse que le
               * gestionnaire de clic n observe pas : AUCUNE erreur a l ecran,
               * aucun toast, aucun journal. Un clic sur un module ne faisait
               * rien du tout, les douze cartes comprises.
               *
               * ⚠️ ET SEULEMENT POUR UN CHAPITRE PAS ENCORE TERMINE : la branche
               * `fini` ne lit pas `ch`. Un compte avec de la progression
               * ouvrait donc certains chapitres, ce qui rendait le defaut
               * intermittent a l oeil. ⛔ Sur un compte neuf, rien ne s ouvrait.
               *
               * ⛔ ET LA SONDE DE BOUT EN BOUT L AURAIT VU : elle clique sur
               * `[data-mod="0"]` puis ecrit dans `#formationNote`, qui n existe
               * pas. Elle plantait. ⚠️ Elle n a pas ete lancee depuis trois lots :
               * une sonde juste qu on ne lance pas vaut une sonde absente.
               */
              : `<button type="button" class="btn btn-gold" data-complete>${I.check} Marquer comme terminé <span class="mono" style="opacity:.75">+${xpDe(c.id)} XP</span></button>`}
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

  /* ══════════════════════════════════════════════════════════════════════════
   * LA SCENE
   * ══════════════════════════════════════════════════════════════════════════
   *
   * ── ⛔ CE N EST PAS UN POP-UP, ET C EST TOUTE LA DIFFERENCE ───────────────
   *
   * Ses mots, le 14/10 : « il faut que ce soit intégré au site et pas que ça
   * apparaisse comme un pop-up, mais que ça vienne de quelque part ».
   * ⛔ Une boite au centre avec une image dedans est exactement ce qu il
   * refuse, et c est ce que faisait `celebrer()`.
   *
   * ⚠️ LA REGLE TECHNIQUE QUI EN DECOULE : rien n apparait, tout PART d un
   * element reel de la page et ARRIVE sur un autre. Chaque temps de la scene
   * mesure donc deux rectangles a l ecran et anime entre les deux. C est la
   * methode FLIP (First, Last, Invert, Play) : on lit la position de depart,
   * on lit celle d arrivee, et on joue la difference sur un clone.
   *
   * ⛔ AUCUNE BIBLIOTHEQUE. `framer-motion` est dans les dependances du depot
   * mais c est du React, et cet espace est en JS nu. L API d animation du
   * navigateur suffit, et elle ne pese rien.
   *
   * ── ⚠️ CE QUE J AI REGARDE POUR LA CHOREGRAPHIE ──────────────────────────
   *
   *   Duolingo, distribution des recompenses de quete : le jeton SORT de
   *   l action, monte en arc jusqu au compteur, et le compteur PULSE en
   *   s incrementant. C est la source directe des temps 2 et 3.
   *     https://60fps.design/shots/duolingo-quest-point-trail-animation
   *   Duolingo, revelation de ligue : l ancien ecran s efface, le badge monte
   *   avec un ressort, des eclats tournent, et le texte arrive EN DECALE.
   *     https://60fps.design/shots/duolingo-emerald-league-reveal-animation
   *   Apple Fitness, vitrine de medaille : la medaille grandit vers le centre
   *   pendant que le fond se CALME et que les autres s effacent, puis elle
   *   s immobilise avec une legere rotation. C est la source des temps 5 et 6.
   *     https://60fps.design/shots/apple-fitness-metal-badge-showcase
   *   Duolingo, coffres et jalons : la recompense se REVELE avec un delai, et
   *   seuls les vrais paliers ont leur celebration propre.
   *     https://60fps.design/shots/duolingo-50-day-streak-animation
   *
   * ⚠️ Ce qui est commun aux trois, et que je garde : la recompense vient de
   * l action, elle se revele avec un delai, et elle prend sa place ensuite.
   *
   * ── ⛔ ELLE EST COURTE, ET UN CLIC SAUTE CE QUI RESTE ────────────────────
   *
   * Un eleve qui enchaine dix chapitres ne doit pas attendre vingt secondes.
   * ⚠️ Chaque temps est `await`e, et `_scene.saute` coupe la file : les etats
   * FINAUX sont alors poses d un coup, jamais un etat intermediaire.
   */
  /**
   * ── ⛔ LES DUREES, ET LE BUDGET QU ELLES TIENNENT ────────────────────────
   *
   * ⚠️ MESURE, PAS ESTIME : la somme des quatre premiers temps fait le budget
   * de la scene de chapitre, et Nadir a fixe DEUX SECONDES AU PLUS.
   *
   *     1. marque   300          le chapitre se marque
   *     2. vol      520 + 420    le jeton part, puis le compteur compte
   *     3. rail     360          le rail gagne un cran
   *                ─────
   *                1 600 ms      ⛔ sous les 2 000, et la sonde le verifie
   *
   * ⚠️ Le temps 4 n existe que si un palier est franchi, et les temps 5 a 9
   * que si un module se termine : ⛔ une scene complete fait environ 4,5 s,
   * mais elle ne se joue qu une fois par module, et un clic la saute.
   *
   * ⛔ CES CHIFFRES SONT UN BUDGET, PAS UN GOUT. Un eleve qui enchaine dix
   * chapitres attendrait seize secondes au lieu de vingt-cinq ; c est cela qui
   * est en jeu, pas l elegance d une courbe.
   */
  const SCENE = {
    marque: 300,      // 1. le chapitre se marque
    vol: 520,         // 2. les XP rejoignent le compteur
    compte: 420,      //    et le compteur s incremente en recevant
    rail: 360,        // 3. le rail se remplit
    palier: 480,      // 4. le palier s allume
    calme: 280,       // 5. la page se calme
    emerge: 480,      // 6. le badge sort de sa carte
    eclat: 850,       // 7. ⚠️ LE TEMPS FORT : il s eclaire en dore
    pose: 600,        // 8. il s installe dans la collection
    retour: 250,      // 9. la page revient
  };
  /** ⚠️ Le budget de la scene de chapitre, expose pour que la sonde le lise. */
  const budgetChapitre = () => SCENE.marque + SCENE.vol + SCENE.compte + SCENE.rail;

  let _scene = { enCours: false, saute: false, nettoyages: [] };

  /** ⚠️ Un sommeil qui se laisse couper. ⛔ Sans cela, « sauter » attendrait. */
  const pause = (ms) => new Promise((r) => {
    if (_scene.saute || !motionOk()) { r(); return; }
    const t = setTimeout(r, ms);
    _scene.nettoyages.push(() => { clearTimeout(t); r(); });
  });

  /** Le rectangle d un element, ou `null`. ⚠️ Un element hors ecran n a pas de point. */
  function coin(el) {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) return null;
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top, w: r.width, h: r.height };
  }

  /**
   * Une couche de scene, posee DANS `#formationApp`.
   * ⛔ Sur `document.body`, elle s afficherait sans aucun style : tout le style
   * de cet espace est prefixe par `#formationApp`. ⚠️ Defaut deja rencontre.
   */
  function couche() {
    let c = document.querySelector('#formationApp .scene-couche');
    if (!c) {
      c = document.createElement('div');
      c.className = 'scene-couche';
      c.setAttribute('aria-hidden', 'true');
      $('formationApp').appendChild(c);
    }
    return c;
  }

  /**
   * ── ⛔ TEMPS 2 : LE JETON D XP PART DU CHAPITRE ET REJOINT LE COMPTEUR ────
   *
   * ⚠️ IL SUIT UN ARC, pas une droite. Une droite se lit comme un glissement ;
   * un arc se lit comme un lancer, et c est ce qui fait que le compteur a
   * RECU quelque chose. L arc est obtenu par une image-cle intermediaire
   * placee au-dessus de la corde.
   *
   * ⛔ ET IL N Y A PAS DE JETON QUAND IL N Y A PAS D XP. Le module 09 ne
   * rapporte rien : un jeton « +0 XP » qui vole jusqu au compteur mentirait.
   */
  async function volXp(depart, montant) {
    const cible = coin($('chipXp'));
    const d = coin(depart);
    if (!d || !cible || !montant) return;
    const jeton = document.createElement('span');
    jeton.className = 'scene-jeton mono';
    jeton.textContent = `+${montant} XP`;
    couche().appendChild(jeton);
    jeton.style.left = `${d.x}px`;
    jeton.style.top = `${d.y}px`;
    const dx = cible.x - d.x;
    const dy = cible.y - d.y;
    // ⚠️ Le sommet de l arc : a mi-chemin, remonte d un quart de la distance.
    const sommet = -Math.max(40, Math.abs(dx) * 0.22);
    const anim = jeton.animate([
      { transform: 'translate(-50%,-50%) scale(.6)', opacity: 0 },
      { transform: 'translate(-50%,-50%) scale(1.08)', opacity: 1, offset: 0.16 },
      { transform: `translate(calc(-50% + ${dx / 2}px), calc(-50% + ${dy / 2 + sommet}px)) scale(1)`, opacity: 1, offset: 0.62 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(.42)`, opacity: 0 },
    ], { duration: SCENE.vol, easing: 'cubic-bezier(.3,.05,.4,1)', fill: 'forwards' });
    _scene.nettoyages.push(() => { anim.finish(); jeton.remove(); });
    await anim.finished.catch(() => {});
    jeton.remove();
  }

  /**
   * ── ⚠️ LE COMPTEUR S INCREMENTE EN RECEVANT, il ne saute pas ─────────────
   *
   * ⛔ Un compteur qui passe de 0 a 15 d un coup ne se voit pas : l oeil lit
   * deux etats, pas un gain. Le comptage est ce qui rend le gain lisible.
   */
  async function compter(de, a) {
    const el = $('chipXp');
    if (!el) return;
    if (!motionOk() || _scene.saute || de === a) { majChip(); return; }
    el.classList.add('recoit');
    const debut = performance.now();
    const duree = SCENE.compte;
    await new Promise((fini) => {
      const trame = () => {
        const p = Math.min(1, (performance.now() - debut) / duree);
        // ⚠️ Une sortie douce : le compte ralentit en arrivant sur sa valeur.
        const v = Math.round(de + (a - de) * (1 - (1 - p) ** 3));
        el.textContent = `${v.toLocaleString('fr-FR')} XP`;
        if (p < 1 && !_scene.saute) requestAnimationFrame(trame); else fini();
      };
      requestAnimationFrame(trame);
    });
    majChip();
    setTimeout(() => el.classList.remove('recoit'), 260);
  }

  /**
   * ── ⛔ TEMPS 6, 7 ET 8 : LE BADGE EMERGE, S ECLAIRE, S INSTALLE ───────────
   *
   * ⚠️ IL SORT DE L ANCRE DE SON MODULE, et c est tout l objet du champ
   * `data-ancre-badge` dans la carte, puis `data-ancre-badge` dans l en-tete du
   * module : ⛔ selon l ecran ou l on se trouve, l ancre n est pas la meme,
   * mais elle est toujours CELLE DU MODULE. Jamais le centre de l ecran.
   *
   * ⛔ LE TEMPS FORT EST L ECLAIRAGE, pas l apparition. Le badge arrive
   * SOMBRE , une silhouette, exactement celle qu on voyait dans la collection,
   * et c est la montee de lumiere qui le revele. ⚠️ C est ce qui fait qu il se
   * merite : on a vu la silhouette pendant des semaines, elle s allume.
   */
  async function scenerBadge(b, ancre, titre, sous) {
    const c = couche();
    const d = coin(ancre) || { x: window.innerWidth / 2, y: window.innerHeight / 2 };

    const scene = document.createElement('div');
    scene.className = 'scene-badge';
    scene.innerHTML = `
      <div class="scene-badge__halo"></div>
      <div class="scene-badge__piece">${medaille(b, { classe: 'medal--scene' })}</div>
      <div class="scene-badge__dire">
        <div class="eyebrow">${txt(titre)}</div>
        <strong>${txt(b.tFait || b.t)}</strong>
        <span>${txt(sous || b.d)}</span>
      </div>`;
    c.appendChild(scene);
    const piece = scene.querySelector('.scene-badge__piece');
    const halo = scene.querySelector('.scene-badge__halo');
    const dire = scene.querySelector('.scene-badge__dire');
    _scene.nettoyages.push(() => scene.remove());

    /* ── 5. LA PAGE SE CALME ─────────────────────────────────────────────
     * ⛔ Elle s assombrit, elle ne DISPARAIT pas : ses mots. L ossature du
     * parcours reste lisible derriere, et c est ce qui garde la scene « dans
     * le site » au lieu de la poser par-dessus. */
    c.classList.add('calme');
    await pause(SCENE.calme);

    /* ── 6. LE BADGE EMERGE DE LA CARTE ──────────────────────────────────
     * ⚠️ Il part A LA TAILLE DE SON ANCRE et au centre de sa carte, puis
     * monte au centre de l ecran en grandissant. ⛔ Sombre : c est une
     * silhouette qui sort, pas un badge fini. */
    const cible = coin(piece);
    const dx = d.x - (cible ? cible.x : window.innerWidth / 2);
    const dy = d.y - (cible ? cible.y : window.innerHeight / 2);
    piece.classList.add('sombre');
    if (motionOk() && !_scene.saute) {
      const a = piece.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(.18) rotate(-14deg)`, opacity: 0 },
        { transform: `translate(${dx * 0.35}px, ${dy * 0.35}px) scale(.72) rotate(-5deg)`, opacity: 1, offset: 0.55 },
        { transform: 'translate(0,0) scale(1) rotate(0deg)', opacity: 1 },
      ], { duration: SCENE.emerge, easing: 'cubic-bezier(.22,1.08,.3,1)', fill: 'both' });
      _scene.nettoyages.push(() => a.finish());
      await a.finished.catch(() => {});
    }

    /* ── 7. ⚠️ IL S ECLAIRE EN DORE. LE MOMENT QUI COMPTE. ───────────────
     * ⛔ Pas une apparition : quatre choses en meme temps, et c est leur
     * simultaneite qui fait l eclat.
     *     le halo         grandit derriere et deborde
     *     le metal        passe de la silhouette a son degrade
     *     le balayage     traverse la piece en diagonale
     *     l anneau        s ouvre vers l exterieur et s efface
     * ⚠️ Et un leger depassement d echelle : la lumiere « pousse » la piece.
     *
     * ⛔ LE SON PART ICI, dans le geste de clic qui a declenche la scene. */
    jouerSon();
    /**
     * ⚠️ LES ECLATS PARTENT DU BADGE, pas du haut de l ecran. ⛔ `confettis()`
     * les lance depuis le centre, qui est precisement ou la piece se trouve a
     * ce moment : ils sortent donc de la lumiere, ils ne tombent pas dessus.
     */
    confettis();
    halo.classList.add('allume');
    piece.classList.remove('sombre');
    piece.classList.add('eclaire');
    if (motionOk() && !_scene.saute) {
      piece.animate([
        { transform: 'scale(1)' }, { transform: 'scale(1.14)', offset: 0.3 },
        { transform: 'scale(.99)', offset: 0.62 }, { transform: 'scale(1.04)' },
      ], { duration: SCENE.eclat, easing: 'cubic-bezier(.2,.9,.2,1)', fill: 'forwards' });
    }
    // ⚠️ Le texte arrive EN DECALE, apres l eclat : lu en meme temps, il
    // volerait l attention au moment fort.
    await pause(SCENE.eclat * 0.45);
    dire.classList.add('la');
    await pause(SCENE.eclat * 0.55);

    /* ── 8. IL S INSTALLE DANS LA COLLECTION, ET ON LE VOIT Y ARRIVER ────
     * ⛔ Il faut donc que sa place EXISTE a l ecran. On revient a l accueil
     * et on va a la collection, puis on anime la piece jusqu a son
     * emplacement. ⚠️ Sans ce retour, il faudrait inventer une destination,
     * et « il s installe » redeviendrait « il disparait ». */
    /**
     * ⚠️ LE TEXTE S EFFACE AVANT QUE LA PAGE NE REVIENNE, et c est une
     * correction vue a l oeil : il restait affiche en pleine lumiere au-dessus
     * d un accueil deja revenu, et la coupure se lisait comme un bogue.
     * ⛔ Cent cinquante millisecondes suffisent : on ne fait pas attendre, on
     * evite une arete.
     */
    dire.classList.remove('la');
    await pause(150);
    c.classList.remove('calme');
    rendreAccueil('badges');
    const place = document.querySelector(`#formationApp .badge[data-badge="${b.id}"]`);
    if (place) place.scrollIntoView({ behavior: 'auto', block: 'center' });
    const arrivee = coin(place ? place.querySelector('.medal') : null);
    const depart2 = coin(piece);
    if (arrivee && depart2 && motionOk() && !_scene.saute) {
      const ex = arrivee.x - depart2.x;
      const ey = arrivee.y - depart2.y;
      const ech = arrivee.w / Math.max(1, depart2.w);
      if (place) place.classList.add('arrive');
      const a = piece.animate([
        { transform: 'translate(0,0) scale(1)', opacity: 1 },
        { transform: `translate(${ex}px, ${ey}px) scale(${ech})`, opacity: 0 },
      ], { duration: SCENE.pose, easing: 'cubic-bezier(.4,0,.2,1)', fill: 'forwards' });
      _scene.nettoyages.push(() => a.finish());
      await a.finished.catch(() => {});
      setTimeout(() => place && place.classList.remove('arrive'), 700);
    }

    /* ── 9. LA PAGE REVIENT ──────────────────────────────────────────── */
    scene.remove();
    await pause(SCENE.retour);
  }

  /**
   * ── ⛔ LA SCENE DE FIN DE CHAPITRE, EN QUATRE TEMPS ──────────────────────
   *
   * ⚠️ ET LA CINQUIEME POSSIBILITE EST LE CAS A EPROUVER : le dernier chapitre
   * d un module CUMULE ses XP, les 250 du module, et parfois un palier. ⛔ Une
   * seule scene qui enchaine les neuf temps, pas trois scenes l une sur
   * l autre : c est pour cela que tout vit dans cette fonction et que
   * `scenerBadge` en est la SUITE, pas un appel independant.
   *
   * @param {object} av l etat lu AVANT l ecriture : xp, niveau, moduleFini
   */
  async function jouerScene(mi, ci, av) {
    const M = mods();
    const m = M[mi];
    const c = m.lecons[ci];
    const gain = xpDe(c.id);
    const xpApres = xpTotal();
    const nivApres = niveauDe(xpApres);
    const finiMaintenant = !av.fini && moduleFini(m);

    _scene = { enCours: true, saute: false, nettoyages: [] };
    const sauter = () => {
      _scene.saute = true;
      _scene.nettoyages.splice(0).forEach((f) => { try { f(); } catch { /* rien */ } });
    };
    // ⛔ UN CLIC SAUTE CE QUI RESTE. ⚠️ `capture` : il ne doit pas d abord
    // declencher le bouton qui se trouve dessous.
    document.addEventListener('click', sauter, { capture: true, once: true });

    try {
      /* ── 1. LE CHAPITRE SE MARQUE, SOUS LES YEUX ──────────────────────
       * ⛔ Pas au rechargement. La ligne du chapitre passe a « terminé » en
       * place : sa pastille devient une coche et la ligne s allume une fois.
       * ⚠️ C est le seul temps qui existe TOUJOURS, module 09 compris. */
      const ligne = document.querySelector(`#formationApp .chap[data-chap="${ci}"]`);
      if (ligne) {
        ligne.classList.add('done', 'vient-de-finir');
        const dot = ligne.querySelector('.dot');
        if (dot) dot.innerHTML = I.check;
        const s = ligne.querySelector('.s');
        if (s) s.textContent = gain ? `Terminé · +${gain} XP` : 'Terminé';
      }
      await pause(SCENE.marque);

      /* ── 2. LES XP PARTENT DU CHAPITRE ET REJOIGNENT LE COMPTEUR ──────
       * ⛔ SAUTE QUAND LE CHAPITRE NE RAPPORTE RIEN : c est le cas du module
       * 09, bonus a zero XP. ⚠️ Le chapitre se marque quand meme, temps 1 :
       * zero XP ne veut pas dire « rien ne s est passe ». */
      if (gain > 0) {
        await volXp(ligne ? ligne.querySelector('.dot') : null, gain);
        await compter(av.xp, xpApres);
      } else {
        majChip();
      }

      /* ── 3. LE RAIL DU MODULE SE REMPLIT D UN CRAN ───────────────────── */
      const rail = document.querySelector('#formationApp .mprog .bar i')
        || document.querySelector(`#formationApp [data-rail-module="${m.cle}"]`);
      if (rail) {
        rail.style.width = `${pctDe(m)}%`;
        rail.parentElement.classList.add('gagne');
        if (pctDe(m) === 100) rail.parentElement.classList.add('done');
        setTimeout(() => rail.parentElement.classList.remove('gagne'), 700);
      }
      const texteRail = document.querySelector('#formationApp .mprog .head span');
      if (texteRail) texteRail.textContent = `${faitesDe(m)} / ${m.lecons.length} terminés`;
      await pause(SCENE.rail);

      /* ── 4. SI UN PALIER EST FRANCHI, LE PALIER S ALLUME ──────────────
       * ⚠️ On n est pas sur l accueil quand on termine un chapitre : le cran
       * a allumer n y est pas. ⛔ On le dit donc la ou l eleve regarde, sur
       * la pastille de niveau, et le rail de paliers s allume au retour. */
      const palier = nivApres > av.niveau;
      if (palier) {
        const chip = $('chipLvl');
        if (chip) {
          chip.textContent = niveaux()[nivApres].nom;
          chip.classList.add('allume');
          setTimeout(() => chip.classList.remove('allume'), 1400);
        }
        await pause(SCENE.palier);
      }

      /* ── 5 a 9 : LE MODULE EST TERMINE, LA SCENE CONTINUE ────────────── */
      if (finiMaintenant) {
        const b = badgeDeModule(m.cle);
        if (b) {
          const ancre = document.querySelector(`#formationApp [data-ancre-badge="${m.cle}"]`);
          await scenerBadge(b, ancre,
            estCert(m) ? 'Parcours validé' : `Module ${m.numero} terminé`,
            palier ? `${b.d} , et tu passes au niveau ${niveaux()[nivApres].nom}.` : b.d);
          return;   // ⚠️ `scenerBadge` a deja rendu l accueil.
        }
      }

      if (!gain && !palier) toast(I.check, `${txt(c.titre)} terminé`);
      else if (!palier) toast(`<span class="xp">+${gain} XP</span>`, `${txt(c.titre)} terminé`);

      // Et on enchaine sur le chapitre suivant, comme avant.
      const nx = m.lecons.findIndex((ch, k) => k > ci && !estVue(ch.id));
      await rendreModule(mi, nx > -1 ? nx : ci);
    } finally {
      document.removeEventListener('click', sauter, { capture: true });
      _scene.enCours = false;
      _scene.nettoyages = [];
    }
  }

  /**
   * ── ⛔ `prefers-reduced-motion` : LES ETATS FINAUX, SANS MOUVEMENT ───────
   *
   * ⚠️ Pas « la meme scene en plus rapide » : AUCUN mouvement. Le chapitre est
   * marque, les XP sont comptes, le badge est dans la collection, et un toast
   * dit ce qui vient de se passer. ⛔ Le resultat est le meme, a la trame pres :
   * c est le meme code qui ecrit, seule la mise en scene disparait.
   */
  async function sansMouvement(mi, ci, av) {
    const M = mods();
    const m = M[mi];
    const c = m.lecons[ci];
    const finiMaintenant = !av.fini && moduleFini(m);
    const nivApres = niveauDe(xpTotal());
    const b = finiMaintenant ? badgeDeModule(m.cle) : null;
    const bouts = [];
    if (xpDe(c.id)) bouts.push(`+${xpDe(c.id)} XP`);
    if (b) bouts.push(`badge « ${b.t} » obtenu`);
    if (nivApres > av.niveau) bouts.push(`niveau ${niveaux()[nivApres].nom}`);
    if (finiMaintenant || nivApres > av.niveau) rendreAccueil(b ? 'badges' : 'accueil');
    else {
      const nx = m.lecons.findIndex((ch, k) => k > ci && !estVue(ch.id));
      await rendreModule(mi, nx > -1 ? nx : ci);
    }
    toast(I.check, `${txt(c.titre)} terminé${bouts.length ? ` · ${bouts.join(' · ')}` : ''}`);
  }

  /* ══ LE SON ═══════════════════════════════════════════════════════════════
   *
   * ── ⛔ IL PART DANS LE GESTE DE CLIC, ET SON ECHEC NE CASSE RIEN ─────────
   *
   * ⚠️ Les navigateurs refusent de demarrer un contexte audio en dehors d un
   * geste de l utilisateur. `jouerSon()` est appele depuis la chaine du clic
   * sur « Marquer comme terminé » : le contexte s ouvre la, et pas ailleurs.
   * ⛔ Sorti d un minuteur detache, il serait refuse en silence et le son
   * manquerait sans qu on sache pourquoi.
   *
   * ⛔ ENGENDRE, AUCUNE REQUETE RESEAU. Deux oscillateurs et une enveloppe :
   * une quinte qui monte, bref. ⚠️ Un fichier a telecharger pourrait arriver
   * apres le moment qu il doit souligner.
   *
   * ⛔ ET TOUT EST DANS UN `try` SANS CONSEQUENCE. Un contexte refuse, un
   * appareil muet, une politique d autoplay : la scene se joue pareil. Le son
   * est un supplement, jamais une dependance.
   */
  const SON_CLE = 'formationSon';
  const sonActif = () => {
    try { return localStorage.getItem(SON_CLE) !== 'off'; } catch { return true; }
  };
  /**
   * ⚠️ `localStorage` ICI, ET C EST ASSUME. Les notes n y vont jamais : un
   * eleve qui change d appareil les perdrait. ⛔ Une preference de SON perdue
   * ne coute rien et se repose d un clic.
   */
  function basculerSon() {
    try { localStorage.setItem(SON_CLE, sonActif() ? 'off' : 'on'); } catch { /* rien */ }
    const b = document.querySelector('#formationApp [data-son]');
    if (b) {
      b.textContent = sonActif() ? 'Son : activé' : 'Son : coupé';
      b.setAttribute('aria-pressed', sonActif() ? 'true' : 'false');
    }
    if (sonActif()) jouerSon();
  }
  let _audio = null;
  /**
   * Ouvre le contexte audio. ⛔ A appeler DANS un geste de l utilisateur.
   * ⚠️ Il ne sonne pas : il rend le son possible pour la suite de la scene.
   */
  function ouvrirAudio() {
    if (!sonActif()) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      _audio = _audio || new AC();
      if (_audio.state === 'suspended') _audio.resume();
    } catch { /* ⛔ Un contexte refuse ne casse rien. */ }
  }
  function jouerSon() {
    if (!sonActif()) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      _audio = _audio || new AC();
      if (_audio.state === 'suspended') _audio.resume();
      const t = _audio.currentTime;
      const vol = _audio.createGain();
      vol.gain.setValueAtTime(0, t);
      vol.gain.linearRampToValueAtTime(0.085, t + 0.02);
      vol.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      vol.connect(_audio.destination);
      // ⚠️ Une quinte : la fondamentale, puis la quinte avec un retard court.
      [[523.25, 0], [783.99, 0.075], [1046.5, 0.15]].forEach(([f, d]) => {
        const o = _audio.createOscillator();
        o.type = 'triangle';
        o.frequency.setValueAtTime(f, t + d);
        const g = _audio.createGain();
        g.gain.setValueAtTime(0, t + d);
        g.gain.linearRampToValueAtTime(1, t + d + 0.015);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.7);
        o.connect(g); g.connect(vol);
        o.start(t + d); o.stop(t + d + 0.75);
      });
    } catch { /* ⛔ Un son qui ne part pas ne casse rien. */ }
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
    if (!m || !m.lecons[ci]) return;
    const c = m.lecons[ci];
    /**
     * ⛔ L ETAT D AVANT EST LU AVANT L ECRITURE, et c est ce qui rend la scene
     * possible : « +15 XP » n est pas une donnee, c est une DIFFERENCE. ⚠️ Lu
     * apres, on ne saurait plus d ou l on vient.
     */
    const av = {
      xp: xpTotal(),
      niveau: niveauDe(xpTotal()),
      fini: moduleFini(m),
      badges: badges().filter((b) => b.ok()).map((b) => b.id),
    };

    const ok = await ecrireProgression(c.id, { vue: true });
    if (!ok) { toast('⚠️', 'Non enregistré. Vérifie ta connexion et réessaie.'); return; }

    /**
     * ⛔ LE CONTEXTE AUDIO S OUVRE ICI, DANS LE GESTE DE CLIC, et le son part
     * au temps 7. ⚠️ Les deux sont separes pour une raison precise : un
     * navigateur n autorise la CREATION et la REPRISE d un contexte que dans un
     * geste de l utilisateur, mais une fois ouvert, le contexte peut sonner
     * quand il veut. ⛔ Sonner ici aussi ferait deux sons : l un au clic,
     * l autre a l eclat, et le temps fort serait double.
     */
    ouvrirAudio();

    if (!motionOk()) { await sansMouvement(mi, ci, av); return; }
    await jouerScene(mi, ci, av);
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

  /**
   * ── ⛔ `celebrer()` A ETE RETIREE, ET C EST LE CŒUR DE CE LOT ─────────────
   *
   * Elle posait une `.modal-bg` au centre de l ecran avec une medaille dedans.
   * ⚠️ C est MOT POUR MOT ce que Nadir refuse : « pas que ça apparaisse comme
   * un pop-up, mais que ça vienne de quelque part ».
   *
   * ⛔ ELLE N EST PAS REMPLACEE PAR UNE AUTRE FENETRE, elle est remplacee par
   * `scenerBadge()`, ou le badge SORT de la carte de son module, s eclaire, et
   * va se poser dans la collection. ⚠️ Rien n apparait au centre : tout part
   * d un point de la page et arrive sur un autre.
   *
   * ⛔ ET `.modal-bg` N A PAS DISPARU DU FICHIER : l ecran des conditions
   * l utilise, et c est son juste emploi. Une information qui bloque le
   * parcours est une fenetre ; une recompense est une scene.
   */

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
    const t = e.target.closest('[data-go],[data-mod],[data-open],[data-chap],[data-complete],[data-undo],[data-export],[data-bienvenue],[data-son]');
    if (!t) return;
    // ⛔ LA CARTE INTRODUCTION OUVRE LA VIDEO DE BIENVENUE, forcee : c est le
    // moyen d y revenir apres l avoir fermee a la premiere connexion.
    if (t.hasAttribute('data-bienvenue')) { montrerBienvenue(true); return; }
    if (t.hasAttribute('data-son')) { basculerSon(); return; }
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
    /**
     * ── ⛔ LA FENETRE DE BIENVENUE, EXPOSEE A L APPELANT ───────────────────
     *
     * ⚠️ Ce module ne decide pas de l affichage : il dit s il FAUT montrer, et
     * il note qu on a montre. ⛔ Le rendu appartient a la page, qui sait ou
     * poser une fenetre et comment la fermer.
     */
    bienvenueAMontrer: () => _bienvenueAMontrer,
    marquerBienvenueVue,
    // ⚠️ Exposes pour les sondes : elles doivent pouvoir lire le CALCUL, pas le
    // deviner. ⛔ Aucun d eux n ECRIT quoi que ce soit.
    _calcul: { xpTotal, niveauDe, badges, serie, niveaux, xpMaximum, conditionsNiveau,
      CONDITIONS, XP_MODULE, partsXp, xpDe, XP_MOD, XP_CERT,
      // ⚠️ Pour que la sonde lise le BUDGET de la scene au lieu de le deviner.
      // ⛔ Un budget devine par la sonde mesurerait son propre chiffre.
      etatModule, badgeDeModule, METAUX, SCENE, budgetChapitre },
  };
  window.Formation = Formation;
})();
