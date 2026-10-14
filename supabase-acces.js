/**
 * LES DEUX DROITS : formation et journal.
 *
 * ── ⛔ CE FICHIER NE PROTÈGE RIEN ────────────────────────────────────────────
 *
 * Il décide quels boutons montrer, et rien d'autre. ⛔ MASQUER UN BOUTON N'EST
 * PAS UNE PROTECTION : qui connaît l'adresse entre quand même, et cela ne lève
 * d'erreur chez personne. La barrière réelle est dans les politiques RLS, posées
 * par `migrations/01-acces-membre.sql` : une donnée de journal n'est lisible que
 * si `a_acces_journal()` rend vrai, quel que soit ce que fait l'interface.
 *
 * Ce module sert donc le confort, pas la sécurité, et c'est dit ici pour que
 * personne ne s'appuie dessus en croyant s'appuyer sur une serrure.
 *
 * ── ⚠️ UNE LIGNE ABSENTE VAUT REFUS. UNE ERREUR DE REQUÊTE, NON ─────────────
 *
 * Les deux cas se ressemblent et ne veulent pas dire la même chose :
 *
 *   requête réussie, aucune ligne  →  la personne n'a pas le droit  →  REFUS
 *   requête en erreur              →  on ne SAIT pas                →  pas un refus
 *
 * ⚠️ LA SECONDE BRANCHE EST UNE PRÉCAUTION DE TRANSITION, ET ELLE EST TEMPORAIRE.
 * Tant que `acces_membre` n'est pas appliquée en base, toute requête échoue avec
 * `42P01 relation inexistante`. Traiter cela comme un refus fermerait le journal
 * aux 102 élèves au premier déploiement, pour une table pas encore créée.
 *
 * ⛔ À RETIRER UNE FOIS LA MIGRATION APPLIQUÉE ET VÉRIFIÉE (102 lignes). Tant que
 * cette branche existe, une panne de base ouvre les deux portes. Le défaut est
 * borné par les politiques RLS, qui elles ne cèdent pas : sans droit, l'interface
 * s'ouvre mais les données ne viennent pas.
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
    if (!c) console.error('[ACCES] ⛔ window.supabaseClient manquant : config non chargee ?');
    return c;
  };

  /** Ce qu'on sait des droits de la personne connectée. */
  let _droits = null;

  /** ⛔ Transition. Voir l'en-tête : à retirer après application de la migration. */
  const TOLERER_TABLE_ABSENTE = true;

  async function charger() {
    let uid = null;
    try {
      const { data } = await cli().auth.getUser();
      uid = data?.user?.id || null;
    } catch { uid = null; }

    if (!uid) {
      // ⛔ `connu: false`, ET PAS `true`. Ne pas avoir de session n est PAS la
      // meme chose que ne pas avoir de droits, et affirmer savoir revient a dire
      // a quelqu un qui a paye qu il n a rien. ⚠️ C etait ecrit `connu: true`, et
      // c est ce qui transformait une ignorance en refus.
      _droits = { formation: false, journal: false, connu: false, motif: 'aucune session' };
      return _droits;
    }

    const { data, error } = await cli()
      .from('acces_membre')
      .select('formation_actif, journal_actif, journal_demande_le, journal_retire_le')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      const absente = error.code === '42P01' || /acces_membre/i.test(error.message || '');
      console.error(`[ACCES] ⚠️ droits illisibles : ${error.message}`);
      if (absente && TOLERER_TABLE_ABSENTE) {
        console.warn('[ACCES] ⛔ table absente : les deux espaces sont ouverts par TOLÉRANCE '
          + 'de transition. Les politiques RLS restent la vraie barrière.');
        _droits = { formation: true, journal: true, connu: false, motif: 'table absente' };
      } else {
        // ⛔ Une erreur qui n'est pas « table absente » ne s'interprète pas : on ne
        // sait pas, donc on ne prétend pas savoir.
        _droits = { formation: false, journal: false, connu: false, motif: 'erreur' };
      }
      return _droits;
    }

    // ⚠️ Requête réussie SANS ligne : c'est un refus, pas une inconnue.
    _droits = {
      formation: !!(data && data.formation_actif),
      journal: !!(data && data.journal_actif),
      demandeLe: (data && data.journal_demande_le) || null,
      retireLe: (data && data.journal_retire_le) || null,
      connu: true,
      motif: data ? 'lu en base' : 'aucune ligne',
    };
    return _droits;
  }

  /** Applique les droits à l'interface : les portes fermées ne se montrent pas. */
  function appliquer() {
    const d = _droits || { formation: false, journal: false };
    document.querySelectorAll('[data-droit="formation"]').forEach((el) => {
      el.hidden = !d.formation;
    });
    document.querySelectorAll('[data-droit="journal"]').forEach((el) => {
      el.hidden = !d.journal;
    });
    // ⚠️ Le bouton a quatre etats : il ne se masque pas, il change de libelle.
    rendreBoutonJournal();
    // ⚠️ Et le chemin de retour, pour qu'il ne puisse pas diverger de `data-droit`.
    majRetour();
  }

  /**
   * ⛔ `setProperty(..., 'important')` ET PAS `style.display = ...`.
   * `index.html` porte `#mainApp.flex, #coachApp.flex { display: block !important }`.
   * Un style en ligne ordinaire PERD contre `!important` : l'interface resterait
   * affichee alors que l'attribut `style` dirait « none », et ⛔ RIEN NE LE
   * SIGNALERAIT. C'est la meme classe de defaut que `[hidden]` neutralise par une
   * classe d'auteur, rencontree deux fois sur ces deux depots.
   */
  /**
   * ⚠️ LE MODE D'AFFICHAGE EST UN PARAMÈTRE, ET CE N'EST PAS DU CONFORT.
   * `#mainApp` et `#coachApp` sont des `flex` (barre latérale + contenu).
   * `#formationApp` est une PAGE : en `flex`, son en-tête et son contenu se
   * mettraient côte à côte au lieu de s'empiler. ⛔ Rien ne l'aurait signalé :
   * la page se serait simplement affichée de travers.
   */
  const montrer = (id, oui, mode) => {
    const el = document.getElementById(id);
    if (el) el.style.setProperty('display', oui ? (mode || 'flex') : 'none', 'important');
  };

  /** Les trois espaces, pour n'en laisser qu'un. ⛔ Aucun ne se masque tout seul. */
  function masquerTout() {
    // ⚠️ Le marqueur tombe des qu on quitte : les elements du journal
    // reviennent exactement comme avant.
    delete document.body.dataset.espace;
    finAttente();
    montrer('choixEspace', false);
    montrer('authScreen', false);
    montrer('coachApp', false);
    montrer('mainApp', false);
    montrer('formationApp', false);
  }

  /** D'ou l'on venait avant d'entrer dans la formation : 'coach' ou 'journal'. */
  let _origine = 'journal';

  /**
   * Fait entrer dans un espace. ⛔ Ne vérifie rien : la vérification a eu lieu
   * avant, et surtout elle a lieu en base. Cette fonction n'est qu'un aiguillage.
   */
  /**
   * ── ⚠️ DEUX ESPACES, PLUS DEUX ONGLETS ───────────────────────────────────
   *
   * ⛔ `entrer('formation')` NE PASSE PLUS PAR `showSection`. Tant que la
   * formation etait une `section` de `#mainApp`, y entrer voulait dire ouvrir un
   * onglet du journal : elle heritait de sa barre laterale et de son en-tete.
   * Retour de Nadir : « si je suis sur l espace formation, je suis sur l espace
   * formation ». Elle a donc son propre conteneur de premier niveau,
   * `#formationApp`, et `showSection` ne la connait plus.
   */
  /**
   * ── ⚠️ L ESPACE DEMANDE SUR L ECRAN DE CONNEXION, ET LE DERNIER OUVERT ────
   *
   * Demande de Nadir du 14/10 : « deux boutons, et c est direct, il n y a pas
   * d ecran intermediaire ». Le bouton presse retient l espace VOULU pour la
   * session de navigateur ; `orienter()` le lit une fois et l efface. Et chaque
   * entree retient le DERNIER espace ouvert : au rechargement, un eleve qui a
   * les deux droits revient la ou il etait, sans qu on le lui redemande.
   * ⛔ Ni l un ni l autre n ouvre quoi que ce soit : le droit est verifie dans
   * `orienter()`, comme avant. Un espace voulu sans droit mene a l ecran qui
   * l explique, pas a l espace.
   */
  const CLE_VOULU = 't360.espaceVoulu';
  const CLE_DERNIER = 't360.dernierEspace';
  const ESPACES = ['formation', 'journal'];

  /**
   * ── ⚠️ L ATTENTE DE L ESPACE MEMBRE, ET LE FOND BLEU NUIT ──────────────────
   *
   * Retour de Nadir du 14/10 : « au chargement de l espace membre, il y a des
   * fois un petit décalage et on a un fond bleu nuit ». Mesure dans le code :
   * `login()` et `restoreSession()` (supabase-auth.js) AFFICHENT `#mainApp`
   * des que la session est ouverte, puis `orienter()` lit les droits en base et
   * seulement alors entre dans la formation. Entre les deux, le journal et son
   * fond bleu nuit sont a l ecran, le temps d une requete.
   * Le marqueur `data-attente="formation"` sur `<html>` couvre cette fenetre :
   * assets/connexion.css masque `#mainApp` et peint le fond sombre tant qu il
   * est pose. ⚠️ Sur `<html>` et pas sur `<body>` : ce fichier est charge dans
   * `<head>`, le corps n existe pas encore quand il s execute.
   * ⛔ Il tombe a CHAQUE sortie d `orienter()` et dans `masquerTout()` : un
   * marqueur qui resterait masquerait le journal a qui y a droit.
   */
  const racineHtml = document.documentElement;
  function attendre(espace) {
    if (espace === 'formation') racineHtml.dataset.attente = 'formation';
    else delete racineHtml.dataset.attente;
  }
  function finAttente() { delete racineHtml.dataset.attente; }

  function vouloir(espace) {
    if (!ESPACES.includes(espace)) return;
    try { sessionStorage.setItem(CLE_VOULU, espace); } catch { /* navigation privee stricte : on continue sans */ }
    // ⚠️ Des le clic : la fenetre a couvrir s ouvre avant meme la session.
    attendre(espace);
  }
  function espaceVoulu() {
    let v = null;
    try { v = sessionStorage.getItem(CLE_VOULU); sessionStorage.removeItem(CLE_VOULU); } catch { v = null; }
    return ESPACES.includes(v) ? v : null;
  }
  /** Lit l espace voulu SANS le consommer : pour poser l attente au chargement. */
  function espaceVouluSansConsommer() {
    let v = null;
    try { v = sessionStorage.getItem(CLE_VOULU); } catch { v = null; }
    return ESPACES.includes(v) ? v : null;
  }
  function dernierEspace() {
    let v = null;
    try { v = localStorage.getItem(CLE_DERNIER); } catch { v = null; }
    return ESPACES.includes(v) ? v : null;
  }
  // ⚠️ Au chargement, si la derniere fois c etait la formation, on couvre tout
  // de suite : `restoreSession()` affichera le journal avant qu on ait les droits.
  attendre(espaceVouluSansConsommer() || dernierEspace());

  function entrer(espace) {
    try { localStorage.setItem(CLE_DERNIER, espace); } catch { /* rien */ }
    const coach = document.getElementById('coachApp');
    // ⚠️ On retient d'ou l'on vient AVANT de masquer : le chemin de retour de la
    // formation ne mene pas au meme endroit pour un coach et pour un eleve.
    _origine = (coach && getComputedStyle(coach).display !== 'none') ? 'coach' : 'journal';
    masquerTout();
    if (espace === 'formation') {
      // ⚠️ `block` et pas `flex` : c'est une page, en-tete au-dessus du contenu.
      montrer('formationApp', true, 'block');
      /**
       * ⚠️ UN MARQUEUR SUR LE CORPS, parce que deux elements du journal vivent
       * HORS de `#mainApp` et restaient donc affiches par-dessus l espace
       * formation. Mesure du 11/10/2026, elements visibles hors
       * `#formationApp` : le pied de page legal (1440x61) et l horloge
       * `.aube-clock` (120x18). ⛔ Le pied de page apparaissait en bleu sous la
       * maquette, et la capture le montrait.
       * ⚠️ Le journal n est pas touche : la regle CSS ne mord que tant que cet
       * attribut est pose, et `masquerTout()` le retire.
       */
      document.body.dataset.espace = 'formation';
      appliquer();
      nommerEleve();
      if (window.Formation) window.Formation.ouvrir();
      else console.error('[ACCES] ⛔ supabase-formation.js non charge');
      return;
    }
    sortirDeLaFormation();
    montrer('mainApp', true);
    appliquer();
    if (window.showSection) window.showSection('dashboard');
  }

  /**
   * Le chemin de retour, selon d'ou l'on vient. ⛔ Appele par `appliquer()` et
   * pas seulement par `entrer()` : sinon un rechargement des droits reafficherait
   * « Revenir au journal » a un coach, puisque `appliquer()` ne regarde que
   * `data-droit`. Les deux ne peuvent plus diverger.
   */
  function majRetour() {
    const versJournal = document.querySelector('.formation-retour-journal');
    const versCoach = document.querySelector('.formation-retour-coach');
    if (versJournal) versJournal.hidden = _origine === 'coach' || !aJournal();
    if (versCoach) versCoach.hidden = _origine !== 'coach';
  }

  /** Le prenom dans la tete de page. ⚠️ Vide plutot que faux si on ne le sait pas. */
  function nommerEleve() {
    const el = document.getElementById('formationTeteNom');
    if (!el) return;
    const u = window.currentUser || {};
    el.textContent = u.first_name || u.prenom || u.full_name || '';
  }

  /**
   * ⛔ ON ARRETE LES ANIMATIONS DE LA FORMATION AVANT DE SORTIR, et c est une
   * correction mesuree le 11/10/2026. `Formation.arreterAnimations()` existait,
   * ecrite expres pour cela, et ⚠️ ELLE N ETAIT BRANCHEE A RIEN. Mesure du banc,
   * encre du canevas des confettis apres le retour au journal :
   *
   *     2550  ->  1142  ->  183        la boucle tournait toujours
   *
   * Elle s eteignait d elle-meme au bout de 130 trames, donc personne n aurait
   * rien vu : juste deux secondes de calcul derriere une interface masquee, a
   * chaque celebration. ⛔ C est le motif « module ecrit, teste, mais jamais
   * cable » de ce depot.
   */
  function sortirDeLaFormation() {
    // ⚠️ Lot 18 : `quitter()` arrete les animations ET ferme le lecteur
    // Vimeo, en ecrivant sa position. L ancien nom reste en repli.
    if (window.Formation && window.Formation.quitter) {
      window.Formation.quitter();
    } else if (window.Formation && window.Formation.arreterAnimations) {
      window.Formation.arreterAnimations();
    }
  }

  /** Ramene l'eleve a son journal. ⛔ Ne verifie rien : la serrure est en base. */
  function retourJournal() {
    sortirDeLaFormation();
    masquerTout();
    montrer('mainApp', true);
    if (window.showSection) window.showSection('dashboard');
  }

  /** Ramene le coach a son espace. ⛔ Ne touche pas aux droits : il n'en a pas. */
  function retourCoach() {
    sortirDeLaFormation();
    masquerTout();
    montrer('coachApp', true);
  }

  /**
   * Oriente après l'ouverture d'une session.
   *
   * ── ⛔ POURQUOI CETTE FONCTION ATTEND, ET POURQUOI ELLE LIT LE RÔLE ─────────
   *
   * La première version décidait tout de suite et regardait si `#coachApp` était
   * visible pour savoir si elle avait affaire à un coach. ⛔ LES DEUX ÉTAIENT
   * FAUX, et le second à cause du premier.
   *
   * `onAuthStateChange` passe dès que la session est connue. `restoreSession()`,
   * elle, interroge encore `public.users` et ne pose l'interface qu'ensuite. Au
   * moment où cette fonction s'exécutait, AUCUNE des deux interfaces n'était
   * affichée : le test « le coach est-il à l'écran » rendait donc toujours non,
   * et un coach se voyait proposer le choix entre deux espaces d'élève.
   *
   * ⚠️ MESURÉ le 10/10/2026, les deux chemins en concurrence, à 1440 px :
   *
   *     coach  : choixEspace visible ET coachApp visible   deux écrans empilés
   *     élève  : choixEspace visible ET mainApp visible    deux écrans empilés
   *
   * Dans les deux cas, l'écran de choix se posait par-dessus une interface déjà
   * en place. ⛔ Aucune erreur, aucun message : juste un écran de trop.
   *
   * La correction tient en deux points. On ATTEND que `restoreSession()` ait posé
   * `window.currentUser`, qui est le signal que le rôle est connu et l'interface
   * choisie. Et on lit le RÔLE, à la même source que `restoreSession()` et que
   * `is_coach()`, au lieu de deviner depuis l'écran.
   */
  async function attendreSession(msMax = 6000) {
    const debut = Date.now();
    while (!window.currentUser && Date.now() - debut < msMax) {
      await new Promise((r) => setTimeout(r, 60));
    }
    return window.currentUser || null;
  }

  /**
   * ⚠️ UNE ORIENTATION PAR SESSION, pas une par evenement. `onAuthStateChange`
   * (supabase-auth.js) appelle `orienter()` a INITIAL_SESSION, a SIGNED_IN et a
   * chaque TOKEN_REFRESHED, soit toutes les heures environ. Sans ce garde, un
   * eleve en plein journal etait ramene au tableau de bord (ou, avant le 14/10,
   * a l ecran de choix) au premier rafraichissement du jeton, sans rien avoir
   * fait. On ne reoriente que si personne n est oriente, ou si la personne a
   * change, ou si aucun espace n est a l ecran (apres une deconnexion).
   */
  let _orienteId = null;
  function espaceAffiche() {
    return ['formationApp', 'mainApp', 'coachApp'].some((id) => {
      const el = document.getElementById(id);
      return el && getComputedStyle(el).display !== 'none';
    });
  }

  async function orienter() {
    // ⚠️ Le marqueur d attente tombe quoi qu il arrive a la sortie : voir
    // `attendre()`. Un `return` oublie dans une branche ne peut plus le laisser.
    try {
      await orienterVraiment();
    } finally {
      finAttente();
    }
  }

  async function orienterVraiment() {
    const u = await attendreSession();
    const idSession = u ? (u.id || u.auth_id || u.email || null) : null;
    if (u && idSession && _orienteId === idSession && espaceAffiche()) {
      console.log('[ACCES] orientation deja faite pour cette session, rien a refaire');
      return;
    }
    if (u) _orienteId = idSession;

    // ⛔ UN COACH N'EST PAS ORIENTÉ. Son interface est `#coachApp`, `restoreSession`
    // l'a déjà posée, et son entrée « Formation » vit dans sa propre barre
    // latérale. Lui proposer un choix entre deux espaces d'élève n'a pas de sens.
    if (u && ['coach', 'admin'].includes(u.role)) {
      await charger();
      appliquer();
      return;
    }

    // ⚠️ Pas de `currentUser` après six secondes : `restoreSession` a échoué ou
    // n'a pas rendu la main. ⛔ On ne pose RIEN par-dessus ce qui est à l'écran :
    // écraser une interface qu'on n'a pas comprise est pire que de s'abstenir.
    if (!u) {
      // ⚠️ `orienter()` n est appelee QUE lorsqu une session existe. Depasser le
      // delai veut donc dire que `restoreSession()` a echoue, pas que la personne
      // n est pas connectee : lui laisser l ecran de connexion serait trompeur.
      // ⛔ ET SURTOUT PAS « tu n as aucun acces » : on ne sait pas, on le dit.
      console.error('[ACCES] ⛔ session non restaurée après 6 s : message d incertitude');
      const bloc = document.getElementById('choixAucunDroit');
      const blocErreur = document.getElementById('choixErreur');
      if (bloc) bloc.hidden = true;
      if (blocErreur) blocErreur.hidden = false;
      montrer('authScreen', false);
      montrer('mainApp', false);
      montrer('choixEspace', true);
      // ⛔ Et aucune porte n est montree : on ne sait pas lesquelles existent.
      document.querySelectorAll('[data-droit], [data-journal-bouton]').forEach((e) => { e.hidden = true; });
      return;
    }

    await charger();
    const d = _droits;

    // ⚠️ TROIS CAS, ET ILS NE SE RESSEMBLENT QUE DE LOIN. Une lecture qui rend
    // zéro ligne dit « pas de droits ». Une lecture en ERREUR ne dit rien du tout,
    // et annoncer « tu n'as aucun droit » à quelqu'un dont la requête a échoué
    // serait un mensonge poli.
    // ⛔ TOUT CE QUI N EST PAS CONNU EST UNE INCERTITUDE, JAMAIS UN REFUS.
    // Une session absente, une requete en erreur : dans les deux cas on ne SAIT
    // pas, et un faux « tu n as aucun acces » est pire qu une seconde d attente,
    // parce que la personne croit avoir perdu ce qu elle a paye.
    const erreur = d.connu === false;
    const aucun = !erreur && !d.formation && !d.journal;

    const bloc = document.getElementById('choixAucunDroit');
    const blocErreur = document.getElementById('choixErreur');
    if (bloc) bloc.hidden = !aucun;
    if (blocErreur) blocErreur.hidden = !erreur;

    if (aucun || erreur) {
      montrer('authScreen', false);
      montrer('mainApp', false);
      montrer('choixEspace', true);
      appliquer();
      return;
    }

    // ⚠️ Un seul droit : on entre directement. Faire choisir entre une porte et
    // un mur serait une question dont on connaît déjà la réponse.
    if (d.formation !== d.journal) {
      const voulu = espaceVoulu();
      // ⛔ Sauf si l eleve a demande PRECISEMENT l autre : on lui montre
      // pourquoi elle est fermee (et, pour le journal, comment la demander).
      if (voulu && !d[voulu]) {
        montrer('authScreen', false);
        montrer('mainApp', false);
        montrer('choixEspace', true);
        appliquer();
        return;
      }
      entrer(d.formation ? 'formation' : 'journal');
      return;
    }

    // ⚠️ Les deux droits : l espace demande sur l ecran de connexion, sinon le
    // dernier ouvert, sinon seulement l ecran de choix. Demande de Nadir du
    // 14/10 : « c est direct, il n y a pas d ecran intermediaire ».
    const direct = espaceVoulu() || dernierEspace();
    if (direct) { entrer(direct); return; }

    montrer('authScreen', false);
    montrer('mainApp', false);
    montrer('choixEspace', true);
    appliquer();
  }

  const aJournal = () => !!(_droits && _droits.journal);

  /**
   * ── ⚠️ LE BOUTON « JOURNAL » A QUATRE ÉTATS, PAS DEUX ─────────────────────
   *
   * ⛔ CECI REMPLACE LA RÈGLE « ne montre jamais une porte fermée ». Ici la porte
   * fermée EST la demande : c'est par elle qu'un élève obtient le journal. Ce
   * qu'il ne faut pas, c'est une porte qui ne dit rien quand on la pousse.
   *
   * ⚠️ `retire` PRIME sur `demande` : qui a perdu le droit puis redemande reste
   * dans le cas « retiré », parce que c'est le message qui le concerne.
   */
  function etatJournal() {
    const d = _droits || {};
    if (d.journal) return 'actif';
    if (d.retireLe) return 'retire';
    if (d.demandeLe) return 'attente';
    return 'jamais';
  }

  const LIBELLES = {
    actif: 'Journal de trading',
    jamais: "Demander l acces au journal",
    attente: 'Demande envoyee',
    // ⚠️ Le quatrieme n est PAS un bouton grise : il reste cliquable et EXPLIQUE.
    // Arbitrage de Nadir. ⛔ Pas de refus muet.
    retire: 'Journal de trading',
  };

  /**
   * ⚠️ TEXTE QUI PARLE AU NOM DE NADIR, repris tel quel. ⛔ Ne le reformule pas.
   */
  const MESSAGE_RETIRE = "Tu n'es plus abonné aux outils. Recontacte les coachs "
    + "pour l'accompagnement.";

  function rendreBoutonJournal() {
    const etat = etatJournal();
    document.querySelectorAll('[data-journal-bouton]').forEach((b) => {
      b.textContent = LIBELLES[etat];
      b.dataset.etatJournal = etat;
      // ⛔ `disabled` SEULEMENT en attente : c est le seul etat ou cliquer ne
      // mene nulle part et n apprend rien. Les trois autres font quelque chose.
      b.disabled = etat === 'attente';
      b.hidden = false;
    });
    const msg = document.getElementById('journalMessageRetire');
    if (msg) { msg.textContent = MESSAGE_RETIRE; msg.hidden = true; }
  }

  /** Le clic, selon l etat. ⛔ Ne touche NI `public.users.status` NI la formation. */
  async function cliquerJournal() {
    const etat = etatJournal();
    if (etat === 'actif') return entrer('journal');
    if (etat === 'attente') return;
    if (etat === 'retire') {
      const msg = document.getElementById('journalMessageRetire');
      if (msg) msg.hidden = false;
      return;
    }
    // ── « jamais demandé » : on pose la demande, et RIEN d autre ────────────
    const { data } = await cli().auth.getUser();
    const uid = data?.user?.id;
    if (!uid) return;
    // ⚠️ UNE SEULE COLONNE EST ÉCRITE, et le `grant update (journal_demande_le)`
    // de la migration 03 fait que c est la seule qui PUISSE l etre. L interface
    // ne se protege pas elle-meme : la barriere est dans le grant.
    const { error } = await cli().from('acces_membre')
      .update({ journal_demande_le: new Date().toISOString() })
      .eq('user_id', uid);
    if (error) {
      console.error('[ACCES] ⚠️ demande NON enregistree :', error.message);
      return;
    }
    _droits.demandeLe = new Date().toISOString();
    rendreBoutonJournal();
  }


  window.Acces = {
    charger,
    appliquer,
    orienter,
    entrer,
    vouloir,
    etatJournal,
    rendreBoutonJournal,
    cliquerJournal,
    MESSAGE_RETIRE,
    retourCoach,
    majRetour,
    retourJournal,
    droits: () => _droits,
    aFormation: () => !!(_droits && _droits.formation),
    aJournal: () => !!(_droits && _droits.journal),
    /** Pour la sonde uniquement. ⛔ Ne pas appeler depuis l'interface. */
    _poser: (d) => { _droits = Object.assign({ connu: true, motif: 'sonde' }, d); },
  };
})();
