/**
 * La structure de l'espace formation : modules et leçons.
 *
 * ⚠️ FICHIER DE DONNÉES, PAS DE LOGIQUE. Il est séparé pour que Nadir puisse
 * verser les titres et les descriptions depuis LearnyBox sans toucher au code.
 *
 * ── ⛔ POURQUOI UNE SEULE VIDÉO EST DÉCLARÉE, ET PAS LES 63 AUTRES ────────────
 *
 * Les 64 vidéos de la formation sont sur Vimeo. Relevé du 09/10/2026, sur la
 * totalité du compte (357 vidéos, quatre pages, couverture vérifiée) :
 *
 *     les 64 vidéos de Formation   view: unlisted   embed: whitelist
 *
 * `whitelist` veut dire « intégration restreinte à une liste de domaines ».
 * ⚠️ CETTE LISTE N'A PAS PU ÊTRE LUE : l'API la sert sur un point d'accès
 * (`/videos/{id}/privacy/domains`) que l'outillage disponible n'expose pas. On
 * sait donc que la restriction EXISTE, on ne sait pas ce qu'elle autorise.
 *
 * ⛔ TANT QUE CETTE LISTE N'EST PAS CONNUE ET VALIDÉE PAR NADIR, LES 63 AUTRES
 * NE SONT PAS POSÉES. Une vidéo dont l'intégration n'est pas restreinte au bon
 * domaine est lisible par quiconque lit le code de la page, et c'est
 * irrattrapable : une vidéo diffusée ne se reprend pas.
 *
 * ⚠️ UNE SEULE est posée, et seulement pour trancher la question du domaine :
 * voir le commentaire qui l'accompagne plus bas. Toutes les autres leçons portent
 * `video: null`, leur emplacement s'affiche et le lecteur attend.
 *
 * ── ⚠️ CE QUI EST MESURÉ, ET CE QUI EST UNE DÉCISION DE NADIR ─────────────────
 *
 * Les dix modules ci-dessous sont ceux de `trader360.fr/programme/`, repris mot
 * pour mot. Le dossier Vimeo compte neuf modules plus un `7BIS`, plus une vidéo
 * « Bienvenue à Trader 360 » à la racine.
 *
 * ⛔ AUCUNE CORRESPONDANCE N'EST INVENTÉE ICI. Le module 01 est le seul à porter
 * des leçons : ses sept titres sont ceux relevés dans le dossier Vimeo
 * `MODULE 1`, dont le nom correspond au titre du module 01 du site mot pour mot.
 * C'est une correspondance MESURÉE, pas supposée, et elle sert de démonstration.
 * Les deux divergences réelles, le module 10 sans dossier Vimeo et le `7BIS`
 * sans module de site, attendent l'arbitrage de Nadir et ne sont pas tranchées.
 *
 * ⚠️ AUCUNE DES SEPT VIDÉOS DU MODULE 1 NE PORTE DE DESCRIPTION SUR VIMEO,
 * vérifié. Les descriptions viendront donc de LearnyBox, elles ne peuvent pas
 * être récupérées automatiquement.
 *
 * ── LES IDENTIFIANTS DE LEÇON ────────────────────────────────────────────────
 * ⛔ `id` NE DOIT JAMAIS CHANGER : c'est la clé des notes et de la progression en
 * base. Il ne dépend volontairement ni du titre ni de l'identifiant Vimeo, pour
 * qu'une retouche de titre ou un remplacement de vidéo ne perde pas les notes
 * d'un élève.
 */
(function () {
  'use strict';

  /**
   * ── ⚠️ LE GABARIT A REMPLIR, POUR NADIR ─────────────────────────────────
   *
   * Une leçon est un objet. `id` et `titre` sont obligatoires, `description` et
   * `video` facultatifs. Pour verser une description, il suffit d'ajouter la
   * ligne : rien d'autre ne bouge, et une leçon sans description affiche son
   * titre et rien d'autre, proprement.
   *
   *   { id: 'm01-l3', titre: 'Développer sa discipline', description: 'Le texte ici.' },
   *
   * ⚠️ LES GUILLEMETS. Le texte est entre apostrophes droites. S'il CONTIENT une
   * apostrophe, prendre des guillemets doubles à la place :
   *
   *   { id: 'm01-l4', titre: "Gérer le stress", description: "Ce qu'on ressent avant." },
   *
   * ⛔ Et une virgule à la fin de chaque ligne, y compris la dernière. C'est la
   * seule faute de frappe qui casse le fichier entier.
   *
   * ⛔ `id` NE CHANGE JAMAIS : c'est la clé des notes et de la progression en base.
   */

  /** Les sept leçons du module 01, titres relevés dans le dossier Vimeo MODULE 1. */
  /**
   * ── ⚠️ LES CHAPITRES, PRODUITS PAR L OUTIL, PAS ECRITS A LA MAIN ──────────
   *
   * Ce bloc est la sortie VERBATIM de
   * `node outils/formation-import-vimeo.mjs`, qui lit `formation-vimeo-releve.json`
   * (releve du 09/10/2026, 64 videos, toutes en `embed: whitelist`). ⛔ Il n a
   * pas ete retranscrit : une retranscription a la main de soixante-trois titres
   * introduit une faute que personne ne retrouve.
   * ⚠️ Pour le refaire apres un changement cote Vimeo :
   *     node outils/formation-import-vimeo.mjs --vimeo     (avec un jeton)
   *
   * ── ⛔ CE SONT DES TITRES DE TRAVAIL ──────────────────────────────────────
   *
   * Ils viennent des noms de fichiers Vimeo, nettoyes de leur numerotation
   * interne (`1.5 - Creer ta routine` devient `Creer ta routine`). ⚠️ Ce ne sont
   * PAS des titres valides. Nadir les corrige ICI, directement, sans toucher a
   * une ligne de code : seul le texte entre guillemets change.
   *
   * ── ⚠️ QUATRE CHAPITRES N ONT AUCUNE NUMEROTATION ─────────────────────────
   *
   * `TradingView complement` (module 04) et les trois du module 09. Leur place
   * vient donc de l ordre ALPHABETIQUE, qui n a aucune raison d etre le bon
   * ordre pedagogique. ⛔ A relire avant de montrer l espace a un eleve : il
   * suffit de deplacer les blocs, les identifiants `m09-l0`, `m09-l1`... se
   * renumerotent a la main dans la foulee.
   *
   * ── ⛔ `video: null` PARTOUT ──────────────────────────────────────────────
   *
   * Les identifiants Vimeo servent a lire titres et durees, rien de plus. Ce
   * fichier est servi a TOUT navigateur qui charge la page, connecte ou non :
   * y deposer soixante-trois identifiants les rendrait lisibles par n importe
   * qui, et la liste des domaines d integration n est pas confirmee. Ils restent
   * dans `formation-vimeo-releve.json`.
   *
   * ⚠️ UNE VIDEO DU COMPTE N EST RANGEE NULLE PART : « Bienvenue a Trader 360 »
   * (12 min), seule dans le dossier `Formation`. Ce n est le chapitre d aucun
   * module. ⛔ L outil la signale et ne la range pas tout seul.
   */
  const CHAPITRES = {
  /**
   * ── ⛔ L'INTRODUCTION, AVANT LE MODULE 01 ─────────────────────────────────
   *
   * Arbitrage de Nadir du 13/10 : la vidéo de bienvenue s'affiche dans une
   * fenêtre à la première connexion, ET elle est rangée ici pour qu'un élève
   * puisse y revenir. ⚠️ C'est tout l'intérêt des deux : la fenêtre se ferme
   * sans regarder, et la vidéo reste accessible.
   *
   * ⛔ `video: null` N'EST PAS UN OUBLI. Relevé dans Vimeo le 11/10, cette
   * vidéo porte `embed: "whitelist"` : son intégration est restreinte à une
   * liste de domaines qui n'est pas confirmée. ⚠️ L'emplacement du lecteur
   * existe, le chapitre se parcourt, mais il restera MUET tant que la liste
   * n'aura pas été vérifiée. Poser un identifiant maintenant donnerait un
   * lecteur en erreur, ce qui est pire qu'un emplacement qui s'annonce en
   * attente.
   *
   * ⚠️ Durée relevée : 769 secondes, soit 12 min 49 s.
   */
  '00': [
    { id: 'm00-l0', titre: "Bienvenue à Trader 360",
      video: null, description: null, provisoire: true, minutes: 13 },
  ],
  '01': [
    { id: 'm01-l0', titre: "Introduction : se préparer mentalement et comprendre les bases du trading",
      video: null, description: null, provisoire: true, minutes: 6 },
    { id: 'm01-l1', titre: "Adopter l’état d’esprit du Trader 360",
      video: null, description: null, provisoire: true, minutes: 9 },
    { id: 'm01-l2', titre: "Définir ses objectifs de trading et de vie",
      video: null, description: null, provisoire: true, minutes: 11 },
    { id: 'm01-l3', titre: "Développer sa discipline",
      video: null, description: null, provisoire: true, minutes: 16 },
    { id: 'm01-l4', titre: "Gérer le stress et l'impatience",
      video: null, description: null, provisoire: true, minutes: 16 },
    { id: 'm01-l5', titre: "Créer ta routine mentale se préparer mentalement",
      video: null, description: null, provisoire: true, minutes: 10 },
    { id: 'm01-l6', titre: "Entrer dans la zone",
      video: null, description: null, provisoire: true, minutes: 12 },
  ],
  '02': [
    { id: 'm02-l0', titre: "Comprendre le trading introduction",
      video: null, description: null, provisoire: true, minutes: 4 },
    { id: 'm02-l1', titre: "Trading contre investissement",
      video: null, description: null, provisoire: true, minutes: 12 },
    { id: 'm02-l2', titre: "Comprendre comment trader sans risquer ton capital grâce aux prop firms",
      video: null, description: null, provisoire: true, minutes: 13 },
    { id: 'm02-l3', titre: "Distinguer l’analyse technique et l’analyse fondamentale",
      video: null, description: null, provisoire: true, minutes: 8 },
    { id: 'm02-l4', titre: "Configurer Investing",
      video: null, description: null, provisoire: true, minutes: 3 },
    { id: 'm02-l5', titre: "Lire un graphique et comprendre le mouvement des prix",
      video: null, description: null, provisoire: true, minutes: 11 },
    { id: 'm02-l6', titre: "Interpréter les bougies japonaises et choisir les bonnes unités de temps",
      video: null, description: null, provisoire: true, minutes: 12 },
    { id: 'm02-l7', titre: "Détecter la tendance avec la théorie de Dow",
      video: null, description: null, provisoire: true, minutes: 6 },
    { id: 'm02-l8', titre: "Identifier les résistances, les supports et les niveaux psychologiques clés",
      video: null, description: null, provisoire: true, minutes: 8 },
    { id: 'm02-l9', titre: "Utiliser la clôture de la veille et connaître les horaires clés du marché",
      video: null, description: null, provisoire: true, minutes: 13 },
  ],
  '03': [
    { id: 'm03-l0', titre: "Maîtriser tes indicateurs (et rien de plus!)",
      video: null, description: null, provisoire: true, minutes: 3 },
    { id: 'm03-l1', titre: "Comprendre les points pivots maîtriser tes indicateurs",
      video: null, description: null, provisoire: true, minutes: 6 },
    { id: 'm03-l2', titre: "Les bandes de Bollinger, MM20, MM100",
      video: null, description: null, provisoire: true, minutes: 8 },
    { id: 'm03-l3', titre: "Le VWAP",
      video: null, description: null, provisoire: true, minutes: 6 },
    { id: 'm03-l4', titre: "Comprendre le POC et le Market Profile",
      video: null, description: null, provisoire: true, minutes: 7 },
  ],
  '04': [
    { id: 'm04-l0', titre: "Prendre en main ta plateforme de trading",
      video: null, description: null, provisoire: true, minutes: 2 },
    { id: 'm04-l1', titre: "Identifier la différence entre une plateforme de trading et un broker",
      video: null, description: null, provisoire: true, minutes: 11 },
    { id: 'm04-l2', titre: "Installer TradingView",
      video: null, description: null, provisoire: true, minutes: 20 },
    /**
     * ⛔ « TradingView complément » SUIT « Installer TradingView », arbitrage de
     * Nadir du 13/10 : c'est son complément, il le suit. Il était placé après
     * « Rejoindre le groupe Discord », parce que Vimeo ne le numérote pas.
     *
     * ⚠️ LES IDENTIFIANTS NE SUIVENT PAS L'ORDRE, et c'est délibéré : `m04-l4`
     * reste `m04-l4`. Ils sont la clé de la progression déjà enregistrée en
     * base. ⛔ Les renuméroter ferait passer une leçon terminée pour une autre,
     * et personne ne s'en apercevrait : la progression resterait cohérente en
     * nombre, et fausse en contenu.
     */
    { id: 'm04-l4', titre: "TradingView complément",
      video: null, description: null, provisoire: true, minutes: 50 },
    { id: 'm04-l3', titre: "Rejoindre le groupe Discord",
      video: null, description: null, provisoire: true, minutes: 12 },
  ],
  '05': [
    { id: 'm05-l0', titre: "Introduction : appliquer la méthode Trader 360",
      video: null, description: null, provisoire: true, minutes: 3 },
    { id: 'm05-l1', titre: "Préparation mentale avant chaque séance",
      video: null, description: null, provisoire: true, minutes: 16 },
    { id: 'm05-l2', titre: "Comprendre l'importance du plan de trading",
      video: null, description: null, provisoire: true, minutes: 9 },
    { id: 'm05-l3', titre: "Identifier les zones",
      video: null, description: null, provisoire: true, minutes: 6 },
    { id: 'm05-l4', titre: "Identifier les zones (sur ta plateforme)",
      video: null, description: null, provisoire: true, minutes: 16 },
    { id: 'm05-l5', titre: "Définir un stop loss, un take profit et calculer un risk ratio",
      video: null, description: null, provisoire: true, minutes: 21 },
    { id: 'm05-l6', titre: "Appliquer les règles de money management et maîtriser les bases mathématiques du trading",
      video: null, description: null, provisoire: true, minutes: 8 },
    { id: 'm05-l7', titre: "Identifier les critères d'entrée et positionner correctement ses niveaux",
      video: null, description: null, provisoire: true, minutes: 5 },
    { id: 'm05-l8', titre: "Étudier des cas concrets d'entrées et de sorties de positions",
      video: null, description: null, provisoire: true, minutes: 9 },
    { id: 'm05-l9', titre: "Tenir un journal de trading et l’utiliser comme outil de progression",
      video: null, description: null, provisoire: true, minutes: 6 },
    { id: 'm05-l10', titre: "Présentation du journal de trading Trader 360",
      video: null, description: null, provisoire: true, minutes: 17 },
    { id: 'm05-l11', titre: "Se focaliser sur le processus plutôt que sur les résultats",
      video: null, description: null, provisoire: true, minutes: 6 },
  ],
  '06': [
    { id: 'm06-l0', titre: "Renforcer ta psychologie de trader",
      video: null, description: null, provisoire: true, minutes: 4 },
    { id: 'm06-l1', titre: "Adopter un état d’esprit professionnel et responsable",
      video: null, description: null, provisoire: true, minutes: 4 },
    { id: 'm06-l2', titre: "Gérer efficacement le stress, les émotions et la cupidité",
      video: null, description: null, provisoire: true, minutes: 8 },
    { id: 'm06-l3', titre: "Accepter les aléas du trading et évaluer objectivement ton niveau pour progresser",
      video: null, description: null, provisoire: true, minutes: 7 },
    { id: 'm06-l4', titre: "Renforcer ta discipline",
      video: null, description: null, provisoire: true, minutes: 8 },
  ],
  '07': [
    { id: 'm07-l0', titre: "Gérer l'après-challenge et construire sa rentabilité",
      video: null, description: null, provisoire: true, minutes: 4 },
    { id: 'm07-l1', titre: "Découvrir le fonctionnement des prop firms",
      video: null, description: null, provisoire: true, minutes: 4 },
    { id: 'm07-l2', titre: "Analyser les règles spécifiques et éviter les pièges de chaque prop firm",
      video: null, description: null, provisoire: true, minutes: 16 },
    { id: 'm07-l3', titre: "Installer et configurer la plateforme de la prop firm choisie",
      video: null, description: null, provisoire: true, minutes: 4 },
    { id: 'm07-l4', titre: "Installer TopstepX",
      video: null, description: null, provisoire: true, minutes: 11 },
    { id: 'm07-l5', titre: "Installer Tradovate",
      video: null, description: null, provisoire: true, minutes: 26 },
    { id: 'm07-l6', titre: "S'entraîner en démo et renforcer sa préparation mentale avant le challenge",
      video: null, description: null, provisoire: true, minutes: 8 },
    { id: 'm07-l7', titre: "Suivre une stratégie réussir son challenge en moins de 2 jours",
      video: null, description: null, provisoire: true, minutes: 16 },
    { id: 'm07-l8', titre: "Consolider son mindset après la réussite du challenge",
      video: null, description: null, provisoire: true, minutes: 9 },
  ],
  /**
   * ── ⛔ LE MODULE 7 BIS, AUTONOME DEPUIS LE LOT 14 ─────────────────────────
   *
   * Ses quatre chapitres etaient ranges dans le module 07, qui en comptait 13.
   * ⚠️ LearnyBox le presente a l eleve comme un MODULE : titre propre, intro
   * « 7bis Intro », description au sommaire. Il le connait comme un module, il
   * doit le retrouver comme un module.
   *
   * ⛔ LES IDENTIFIANTS NE CHANGENT PAS : `m07-l9` a `m07-l12` restent tels
   * quels, sous leur nouveau module. ⚠️ C est ce qui rend ce redecoupage sans
   * risque : la progression est enregistree par `lecon_id` dans
   * `formation_progression`, et le module n est qu un regroupement d affichage.
   * ⛔ Les renumeroter en `m7b-l0` ferait perdre toute progression deja
   * enregistree sur ces quatre chapitres, en silence : les lignes resteraient
   * en base, orphelines, et l eleve verrait quatre chapitres redevenus a faire.
   */
  '07bis': [
    { id: 'm07-l9', titre: "Structurer son activité de trader après le challenge",
      video: null, description: null, provisoire: true, groupe: '7 bis', minutes: 2 },
    { id: 'm07-l10', titre: "Comprendre le fonctionnement du payout et construire son matelas de sécurité",
      video: null, description: null, provisoire: true, groupe: '7 bis', minutes: 10 },
    { id: 'm07-l11', titre: "Appliquer un scaling plan pour faire croître son capital",
      video: null, description: null, provisoire: true, groupe: '7 bis', minutes: 10 },
    { id: 'm07-l12', titre: "Passer en live avec discipline et professionnalisme",
      video: null, description: null, provisoire: true, groupe: '7 bis', minutes: 5 },
  ],

  '08': [
    { id: 'm08-l0', titre: "Comprendre la fiscalité du trader prop firm",
      video: null, description: null, provisoire: true, minutes: 5 },
    { id: 'm08-l1', titre: "Démarrer légalement structure & fiscalité",
      video: null, description: null, provisoire: true, minutes: 4 },
    { id: 'm08-l2', titre: "Structurer son activité",
      video: null, description: null, provisoire: true, minutes: 6 },
  ],
  '09': [
    { id: 'm09-l0', titre: "Anti-perte de confiance",
      video: null, description: null, provisoire: true, minutes: 12 },
    { id: 'm09-l1', titre: "Programme membre & système de recommandation",
      video: null, description: null, provisoire: true, minutes: 7 },
    { id: 'm09-l2', titre: "Tuto \"Imbalance\"",
      video: null, description: null, provisoire: true, minutes: 28 },
  ],
  // ⛔ Module 10 : aucun dossier Vimeo. Il n a pas de chapitre.
  '10': [],
  };

  /**
   * ⚠️ LES DESCRIPTIONS DE MODULE VIENNENT DE LA MAQUETTE QUE NADIR A VALIDEE.
   * ⛔ Je ne les ai pas ecrites et je ne les ai pas modifiees. Elles sont posees
   * ici, dans la source unique, pour qu il les corrige a un seul endroit.
   */
  const DESCRIPTIONS = {
    '01': "Ce module vous forme à maîtriser l'aspect psychologique du trading, qui représente 80% de la réussite contre seulement 20% pour la technique. Il développe l'état d'esprit optimal du trader à travers la définition d'objectifs clairs, le renforcement de la discipline, la gestion du stress et de l'impatience, la création de routines mentales efficaces, et l'entrée \"dans la zone\" en démystifiant le trading pour adopter une approche réaliste et performante.",
    '02': "Ce module t'explique ce qu'est vraiment le trading dans le monde d'aujourd'hui : une activité ouverte à tous, grâce aux prop firms, qui te permettent de trader sur les marchés financiers sans utiliser ton propre capital. C'est une vraie opportunité… à condition de suivre la méthode avec rigueur.",
    '03': "Dans ce module, tu vas découvrir les quelques indicateurs que l'on utilise dans la méthode Club360. Pas de surcharge inutile : ici, on va à l'essentiel avec des outils simples, puissants, et surtout maîtrisables. L'objectif, c'est la clarté, pas la complexité.",
    '04': "Dans ce module, tu vas découvrir les outils que tu vas utiliser tous les jours : la plateforme sur laquelle tu analyses le marché, et celle sur laquelle tu passes tes trades. L'objectif, c'est que tu comprennes où tu mets les pieds et que tu sois à l'aise techniquement dès le départ.",
    '05': "Dans ce module, tu vas découvrir la méthode TRADER 360, une approche complète et structurée qui te guide pas à pas dans ta progression. Du mental à la technique, de la préparation à l'exécution, tout est conçu pour te rendre autonome et performant sur le long terme.",
    '06': "Dans ce module, tu vas découvrir l'importance capitale de la psychologie dans le trading. Comprendre comment tes émotions, tes biais et ta gestion mentale influencent tes décisions est la clé pour passer d'un trader impulsif à un trader discipliné et performant.",
    '07': "Dans ce module, tu vas apprendre toutes les étapes pour devenir un trader propfirm financé.",
    '07bis': "Dans ce module, tu vas découvrir les étapes clés à suivre après avoir réussi ou terminé ton challenge prop firm. Tu apprendras comment consolider tes acquis, gérer ta progression, et préparer les prochaines étapes pour continuer à évoluer dans le trading.",
    '08': "Dans ce module, tu vas comprendre les bases de la fiscalité applicable au trading, les obligations légales, et les bonnes pratiques pour optimiser ta situation fiscale tout en restant en règle.",
    '09': "Trois vidéos en marge du parcours, à regarder quand tu en as besoin plutôt que dans l'ordre. Retrouver ta confiance après une série de pertes, comprendre le programme membre et la recommandation, et un tuto technique sur les imbalances.",
    '10': 'La validation du parcours, une fois les neuf modules précédents traversés.',
  };

  /**
   * ⛔ LES TITRES ET DESCRIPTIONS DE MODULE NE SONT PAS TOUCHES ICI, et c est
   * voulu : ils viennent du site `trader360.fr`. L outil d import n emet que les
   * CHAPITRES, jamais les modules, pour que ce soit vrai par construction et non
   * par vigilance.
   */
/**
 * ⛔ ENGENDRÉ PAR `outils/formation-descriptions-import.mjs`. NE PAS ÉDITER.
 *
 * Source unique : `_contenu-formation/descriptions-chapitres-learnybox.md`,
 * relevé à la main par Nadir le 13/10 dans LearnyBox. ⚠️ Corriger ici serait
 * créer une seconde vérité, et c'est celle d'ici qui serait écrasée au prochain
 * import. ⛔ Les corrections se font dans le fichier source.
 *
 * ⚠️ `notes` est distinct de `description` : ce sont des avertissements liés à
 * la VIDÉO (coupure de son, version périmée), qui disparaîtront quand elle sera
 * refaite. ⛔ Les fondre dans la description les rendrait indélébiles.
 *
 * ⚠️ `sousTitre` et `encart` ne concernent que 4.3 et 6.4 : ils décrivent un
 * déblocage manuel par Discord qui n'existera pas dans le journal. ⛔ Posés tels
 * quels, Nadir tranche à la bascule.
 */
const CONTENU_CHAPITRES = {
  'm01-l0': { description: "Dans ce module, tu vas comprendre pourquoi il est essentiel de te concentrer sur le processus plutôt que sur les gains, d'avancer à ton rythme sans te comparer aux autres, et de bâtir un état d'esprit solide basé sur la régularité, la patience et la progression personnelle. Ca va être ton plus gros travail : 80% !", learnybox: "1.0" },
  'm01-l1': { description: "Dans ce chapitre, tu vas comprendre comment adopter l'état d'esprit TRADER 360 qui va te permettre d'avoir une posture professionnelle et de devenir rentable sur le long terme !", learnybox: "1.1" },
  'm01-l2': { description: "Ce chapitre t'aide à poser des objectifs clairs, à la fois dans ton trading et dans ta vie, en te reconnectant à ton vrai \"pourquoi\" et en comprenant pourquoi se former sérieusement est un passage obligé pour avancer avec sens et efficacité.", learnybox: "1.2" },
  'm01-l3': { description: "Dans ce chapitre, tu vas comprendre pourquoi la discipline est la clé de ta régularité, comment l'entraîner au quotidien, et en faire une alliée pour suivre ton plan de trading sans te laisser piéger par tes émotions ou tes impulsions.", learnybox: "1.3" },
  'm01-l4': { description: "Ce chapitre te montre comment le stress et l'impatience sabotent tes décisions, et pourquoi maîtriser ces deux ennemis est essentiel pour durer. Tu vas explorer ta capacité à différer la gratification et à agir avec calme et lucidité.", learnybox: "1.4" },
  'm01-l5': { description: "Tu vas construire ta propre routine mentale pour bien démarrer chaque séance : visualisation de ta journée idéale, pratique de la cohérence cardiaque, ancrage positif et même hydratation, car oui, ton cerveau carbure aussi à l'eau !", learnybox: "1.5" },
  'm01-l6': { description: "Ce chapitre démonte les idées reçues sur le trading en te montrant ce qu'est vraiment le quotidien d'un trader engagé. Tu comprendras pourquoi \"entrer dans la zone\" demande une vraie préparation psychologique, et pourquoi si c'était si simple… tout le monde le ferait.", learnybox: "1.6" },
  'm02-l0': { description: "Ce module t'explique ce qu'est vraiment le trading dans le monde d'aujourd'hui : une activité ouverte à tous, grâce aux prop firms, qui te permettent de trader sur les marchés financiers sans utiliser ton propre capital. C'est une vraie opportunité… à condition de suivre la méthode avec rigueur.", learnybox: "2.0" },
  'm02-l1': { description: "Ce chapitre te donne une vision claire du trading : sa définition, ses différences avec l'investissement classique, les actifs que tu peux trader (indices, actions, crypto), les acteurs qui composent le marché, et les principaux styles de trading pour t'aider à identifier celui qui te correspond.", learnybox: "2.1" },
  'm02-l2': { description: "Dans ce chapitre, tu vas comprendre pourquoi il est risqué de trader avec ton propre argent au début, et comment les prop firms te permettent d'accéder à des capitaux importants tout en te concentrant sur ta performance, sans mettre en danger ton épargne personnelle.", learnybox: "2.2" },
  'm02-l3': { description: "Dans ce chapitre, tu vas découvrir ce qui distingue l'analyse technique de l'analyse fondamentale, à quoi sert chacune et dans quels contextes elles sont utilisées. Tu apprendras également à suivre les annonces économiques clés et à utiliser un calendrier économique (comme sur Investing.com) pour anticiper les événements impactants, sans te laisser emporter par la panique.", learnybox: "2.3" },
  'm02-l4': { description: "Ce chapitre va te montrer comment bien configurer Investing pour que tu aies les news importantes.", learnybox: "2.3.1" },
  'm02-l5': { description: "Ce chapitre t'explique ce qu'est un graphique de prix, pourquoi le marché monte ou descend, et comment tu peux gagner à l'achat comme à la vente. Tu vas poser les bases de la lecture visuelle du marché et comprendre les mécanismes simples derrière chaque mouvement.", learnybox: "2.4" },
  'm02-l6': { description: "Dans ce chapitre, tu vas apprendre à lire une bougie japonaise, comprendre les différentes formes qu'elle peut prendre, et découvrir le rôle des unités de temps (ou time frames) dans ton analyse. C'est une étape essentielle pour décoder le langage du marché.", learnybox: "2.5" },
  'm02-l7': { description: "Dans ce chapitre, tu vas apprendre à repérer les plus hauts et les plus bas formés par le marché pour déterminer la tendance à l'aide de la théorie de Dow. Cette méthode simple et visuelle te permettra de savoir si tu es dans une dynamique haussière, baissière ou neutre, et d'agir en conséquence.", learnybox: "2.6" },
  'm02-l8': { description: "Ce chapitre t'apprend à repérer les zones où le prix réagit régulièrement : les résistances, les supports, et les niveaux psychologiques ronds (comme 5000 ou 6000). Ce sont des repères clés pour anticiper les réactions du marché et poser des plans cohérents.", learnybox: "2.7" },
  'm02-l9': { description: "Dans ce chapitre, tu vas comprendre pourquoi la clôture de la veille est un repère clé pour de nombreux traders, et comment les horaires d'ouverture et de volatilité influencent le comportement du marché. Mieux tu maîtrises le timing, plus tes décisions gagnent en précision.", learnybox: "2.8" },
  'm03-l0': { description: "Dans ce module, tu vas découvrir les quelques indicateurs que l'on utilise dans la méthode Club360. Pas de surcharge inutile : ici, on va à l'essentiel avec des outils simples, puissants, et surtout maîtrisables. L'objectif, c'est la clarté, pas la complexité.", learnybox: "3.0" },
  'm03-l1': { description: "Dans ce chapitre, tu vas découvrir ce que sont les points pivots, comment ils sont calculés, et pourquoi ils sont utilisés par de nombreux traders comme repères clés pour anticiper les réactions du prix. Simples, logiques et puissants, ce sont des niveaux que tu verras revenir tous les jours dans ton plan.", notes: ["Petite coupure de 5s au niveau du son entre 3m22 et 3m27."], learnybox: "3.1" },
  'm03-l2': { description: "Dans ce chapitre, tu vas apprendre à utiliser les bandes de Bollinger pour repérer les excès de volatilité, la moyenne mobile 20 pour suivre la dynamique du prix, la MM100 et la MM960 en complément. Un trio d'indicateurs simple et cohérent pour cadrer le marché avec clarté.", learnybox: "3.2" },
  'm03-l3': { description: "Dans ce chapitre, tu vas découvrir le VWAP (Volume Weighted Average Price), un indicateur utilisé par les traders institutionnels pour identifier les zones où le volume moyen s'est échangé. Il te permet de situer les zones de \"juste prix\" et d'éviter les pièges en plein milieu de marché.", learnybox: "3.3" },
  'm03-l4': { description: "Dans ce chapitre, tu vas apprendre ce qu'est le POC (Point of Control), issu de l'outil Market Profile. Il te permet d'identifier la zone de prix où le marché a passé le plus de temps et échangé le plus de volume. C'est un repère clé pour anticiper les réactions futures du prix avec plus de précision.", learnybox: "3.4" },
  'm04-l0': { description: "Dans ce module, tu vas découvrir les outils que tu vas utiliser tous les jours : la plateforme sur laquelle tu analyses le marché, et celle sur laquelle tu passes tes trades. L'objectif, c'est que tu comprennes où tu mets les pieds et que tu sois à l'aise techniquement dès le départ.", learnybox: "4.0" },
  'm04-l1': { description: "Dans ce chapitre, tu vas découvrir qui affiche tes graphes et qui tient ton argent : plateforme vs broker, deux rôles complémentaires à ne pas confondre.", learnybox: "4.1" },
  'm04-l2': { description: "Dans ce chapitre, tu vas apprendre à créer ton compte TradingView, à choisir la bonne version pour débuter, et à configurer ton premier espace de travail. Objectif : être opérationnel en quelques minutes, sans te perdre dans les options inutiles.", learnybox: "4.2.1" },
  'm04-l4': { description: "Ce chapitre complète l'installation de TradingView en direct, sur un vrai graphique, au format d'un live de questions-réponses. Tu vas y poser l'indicateur Multi Pro avec les points pivots, les bandes de Bollinger et la moyenne mobile 20, ajouter la VWAP, enregistrer un modèle de graphique pour ne plus tout refaire à chaque fois, régler tes alertes et te servir du replay pour t'entraîner hors marché. Tu verras aussi comment préparer tes captures pour le journal, garder tes rectangles en favoris et mesurer ton ratio avec l'outil de position, avec la règle à retenir : un rectangle vert au moins deux fois plus grand que le rouge.", learnybox: "4.2.2" },
  'm04-l3': { description: "---", sousTitre: "Rejoins le groupe Discord pour avoir accès à tous nos lives, replays, journal psycho…", encart: "Après cette vidéo, contacte Guillaume directement sur Discord ou envoie-nous un mail à clubtrader360@gmail.com pour nous confirmer que tu as bien terminé les modules débutants, afin que nous puissions débloquer les prochains niveaux.", learnybox: "4.3" },
  'm05-l0': { description: "Dans ce module, tu vas apprendre à appliquer la méthode TRADER 360, de la routine mentale au plan d'action, de l'analyse des tendances et des zones à l'exécution disciplinée pour transformer ton process en résultats.", learnybox: "5.0" },
  'm05-l1': { description: "Dans ce chapitre, tu apprendras à te préparer mentalement avant chaque séance de trading, avec des techniques pour te recentrer, gérer ton stress, et installer une concentration optimale. Cette étape est clé pour aborder le marché avec calme et clarté.", learnybox: "5.1" },
  'm05-l2': { description: "Ce chapitre insiste sur l'importance cruciale d'établir un plan de trading avant chaque séance. Sans plan clair et précis, tu prends le risque d'agir au hasard et de compromettre ta réussite. Apprendre à construire un plan solide est la base pour trader de manière disciplinée et efficace.", learnybox: "5.2" },
  'm05-l3': { description: "Dans ce chapitre, tu découvriras comment identifier tes zones. Comprendre la tendance et repérer ses zones d'achat et de vente est essentiel pour choisir les bons moments pour entrer et sortir des trades.", learnybox: "5.3" },
  'm05-l4': { description: "Dans ce chapitre, tu vas identifier tes zones directement sur ton graphique, sans aucun indicateur. Tu commences par placer la clôture de la veille, la bougie de 21 h 30, puis tu passes en 4 heures pour repérer les sommets et les creux sur lesquels le marché s'est retourné le plus souvent, avant d'affiner en 30 minutes. L'idée à retenir : on trade les zones les plus travaillées, jamais entre deux. C'est un travail à refaire chaque jour, et on le fera ensemble pendant les lives.", learnybox: "5.3 Bis" },
  'm05-l5': { description: "Dans ce chapitre, tu vas comprendre ce qu'est un stop loss, un take profit, et comment calculer ton ratio risque/rendement. Maîtriser ces notions te permettra de protéger ton capital et d'optimiser tes gains tout en contrôlant tes pertes.", learnybox: "5.4" },
  'm05-l6': { description: "Ce chapitre t'explique comment gérer ton capital avec rigueur grâce au money management, en utilisant des règles mathématiques simples. Tu découvriras notamment pourquoi il est important de garder un stop loss constant pour maîtriser tes risques.", learnybox: "5.5" },
  'm05-l7': { description: "Dans ce chapitre, tu vas apprendre à définir clairement tes critères d'entrée en position, ainsi qu'à placer tes niveaux clés (stop loss, take profit, points d'entrée) de manière précise et stratégique pour optimiser tes chances de réussite.", learnybox: "5.6" },
  'm05-l8': { description: "Dans ce chapitre, tu découvriras plusieurs cas concrets d'entrées et de sorties de trades, avec une analyse détaillée pour comprendre ce qui fonctionne, ce qui ne fonctionne pas, et comment adapter ta stratégie en temps réel.", learnybox: "5.7" },
  'm05-l9': { description: "Dans ce chapitre, tu vas découvrir l'importance de noter chaque détail dans ton journal de trading. Utiliser un outil simple comme Google Slides te permettra de suivre tes performances, analyser tes erreurs, et progresser de manière continue et structurée. Tu verras également comment utiliser le journal de trading Trader 360 créé sur mesure pour vous !", learnybox: "5.8.1" },
  'm05-l10': { description: "Ce chapitre va t'apprendre à utiliser notre journal de trading, fait sur mesure.", notes: ["Cette vidéo n'est pas à jour par rapport à la nouvelle version du journal de trading. Une version actualisée arrivera prochainement."], learnybox: "5.8.2" },
  'm05-l11': { description: "Ce chapitre t'invite à te focaliser sur la qualité de ton process de trading plutôt que sur les gains immédiats. La clé, c'est de t'entraîner sérieusement en démo pour intégrer les bons réflexes et construire ta confiance sans pression.", learnybox: "5.9" },
  'm06-l0': { description: "Dans ce module, tu vas apprendre à muscler ta psychologie de trader : adopter un état d'esprit pro, gérer stress/émotions et cupidité, accepter l'aléa avec objectivité, et installer une discipline durable avec un suivi émotionnel simple pour exécuter sereinement ton plan, jour après jour.", learnybox: "6.0" },
  'm06-l1': { description: "Dans ce chapitre, tu vas apprendre à te comporter comme un vrai professionnel du trading. Cela signifie respecter tes règles, gérer tes émotions, et aborder chaque séance avec rigueur et sérieux, comme le ferait un trader expérimenté.", learnybox: "6.1" },
  'm06-l2': { description: "Dans ce chapitre, tu vas apprendre à reconnaître et maîtriser le stress, les émotions fortes et la cupidité, qui sont des pièges fréquents en trading. Tu découvriras des techniques efficaces pour garder la tête froide et prendre des décisions rationnelles, même sous pression.", learnybox: "6.2" },
  'm06-l3': { description: "Dans ce chapitre, tu apprendras à accueillir les aléas du trading comme une étape normale du parcours. Tu découvriras aussi l'importance de reconnaître ton niveau actuel pour progresser avec confiance et éviter les décisions précipitées.", learnybox: "6.3" },
  'm06-l4': { description: "Dans ce chapitre, tu vas apprendre à maintenir ta discipline sur le long terme grâce à un check-in émotionnel quotidien. Tu découvriras comment repérer et noter tes erreurs pour progresser de manière continue et garder le contrôle de tes décisions.", encart: "A la suite de ce dernier module, n'oublie pas cette partie : MESSAGE DISCORD NIVEAU CONFIRMÉ DANS SALON \"REGLES ET ANNONCES\" POSTE : Message important pour tous les débutants", learnybox: "6.4" },
  'm07-l0': { description: "Dans ce module, tu vas apprendre à décoder le fonctionnement des prop firms et leurs règles, éviter les pièges, configurer ta plateforme, t'entraîner efficacement et appliquer une stratégie claire pour valider en moins de 2 jours, puis gérer l'après-challenge (gestion du risque, retraits, scaling) afin de construire une rentabilité durable.", learnybox: "7.0" },
  'm07-l1': { description: "Dans ce chapitre, tu vas comprendre comment fonctionne le défi prop firm, quels sont les objectifs à atteindre, et pourquoi c'est une opportunité unique pour trader avec un capital important sans risquer ton propre argent.", learnybox: "7.1" },
  'm07-l2': { description: "Dans ce chapitre, tu découvriras les règles propres à chaque prop firm, leurs exigences particulières, ainsi que les pièges courants à éviter pour maximiser tes chances de réussite lors du challenge.", learnybox: "7.2" },
  'm07-l3': { description: "Ce chapitre ouvre la partie plateforme : installer, paramétrer et maîtriser l'outil sur lequel tu vas passer ton challenge, parce qu'en trading l'exécution, c'est la moitié de la réussite. Tu verras ce qui change d'une prop firm à l'autre : TopstepX, devenue la seule plateforme autorisée par Topstep, avec ses verrouillages de sécurité, et Tradovate, utilisée par Apex et Tradify. Les deux chapitres suivants te guident pas à pas sur chacune.", learnybox: "7.3" },
  'm07-l4': { notes: ["Fais bien attention de calculer tes lots au préalable car il n'y a pas la fonctionnalité sur topstepx! Pour se faire tu peux utiliser Tradingview avec le papertrading ou Tradovate si tu l'as, et également faire tes analyses sur ces 2 plateformes ou les indicateurs sont plus fiables."], learnybox: "7.3.1" },
  'm07-l5': { description: "Dans ce chapitre, tu vas créer ton compte démo Tradovate et le configurer comme on trade : chandeliers japonais, bandes de Bollinger, EMA 20, VWAP, période 4 heures personnalisée, passage en micro contrats MES et l'outil de position pour vérifier ton ratio de 2 avant chaque entrée. Tu apprendras à trader avec le bracket, qui place ton stop et ton objectif automatiquement, puis sans, en plaçant toi-même tes ordres stop et limite, avec le réflexe à prendre : « Quitter marché » en fin de session pour ne laisser aucun ordre actif. Tu termineras par les rapports, les préférences, et le tracé du POC et de la clôture de la veille avec le TPO.", learnybox: "7.3.2" },
  'm07-l6': { description: "Ce chapitre t'accompagne dans ta phase d'entraînement sur compte démo, tout en te guidant pour préparer ton mental afin d'aborder le challenge prop firm avec confiance et sérénité.", learnybox: "7.4" },
  'm07-l7': { description: "Dans ce chapitre, tu découvriras des stratégies efficaces et des conseils pratiques pour réussir rapidement ton challenge prop firm, en maximisant ta concentration et en minimisant les risques, pour valider ton compte en un temps record.", learnybox: "7.5" },
  'm07-l8': { description: "Dans ce chapitre, tu apprendras à gérer ton état d'esprit après le challenge prop firm, qu'il soit réussi ou non. Tu découvriras comment rester aligné, analyser tes résultats sereinement, et préparer ta prochaine étape avec confiance.", learnybox: "7.6" },
  'm07-l9': { description: "Dans ce module, tu vas apprendre à structurer ton activité après le challenge : comprendre le système de payouts et bâtir ton matelas de sécurité, mettre en place un plan de scaling progressif, puis passer en live avec des routines pro pour faire croître ton capital sans dériver.", learnybox: "7bis Intro" },
  'm07-l10': { description: "Dans ce chapitre, tu découvriras comment fonctionne le payout (versement de tes gains) avec ta prop firm, et l'importance du matelas de sécurité pour protéger tes bénéfices tout en assurant la continuité de tes trades.", learnybox: "7bis 1" },
  'm07-l11': { description: "Dans ce chapitre, tu vas apprendre à augmenter progressivement la taille de tes positions et ton capital investi grâce au scaling plan. C'est une stratégie essentielle pour faire croître ton compte en maîtrisant les risques.", learnybox: "7bis 2" },
  'm07-l12': { description: "Dans ce chapitre, tu vas découvrir comment réussir ta transition du compte démo au trading en live. Tu apprendras les bonnes pratiques pour gérer le stress, rester discipliné, et appliquer ta méthode efficacement sur de l'argent réel.", learnybox: "7bis 3" },
  'm08-l0': { description: "Dans ce chapitre, tu vas comprendre comment sont imposés les revenus que tu perçois d'une prop firm, et pourquoi ils ne relèvent pas du même régime que ceux d'un trader pour compte propre. De quoi savoir ce que tu dois déclarer, et à quel titre.", learnybox: "8.1" },
  'm08-l1': { description: "Dans ce chapitre, tu vas découvrir quelles formes juridiques existent pour exercer, ce qu'elles impliquent en cotisations et en déclarations, et à partir de quel moment la question se pose vraiment. L'objectif est que tu saches quoi demander à un comptable, pas que tu t'en passes.", learnybox: "8.2" },
  'm08-l2': { description: "Dans ce chapitre, tu vas voir comment traiter ton activité de trading comme une activité professionnelle : séparer tes comptes, tenir tes chiffres, et poser un cadre qui tienne dans la durée. Le trading est un métier, et il s'organise comme tel.", learnybox: "8.3" },
  'm09-l0': { description: "Après une série de pertes, le doute s'installe et c'est là qu'on fait n'importe quoi. Ce bonus te donne de quoi retrouver stabilité, maîtrise et régularité quand la confiance n'est plus là.", learnybox: "9.1" },
  'm09-l1': { description: "Ce bonus présente le programme membre et la façon dont tu peux recommander Trader 360 autour de toi. Comment ça marche, ce que ça t'apporte, et ce qu'on attend en retour.", learnybox: "9.2" },
  'm09-l2': { description: "Ce bonus t'explique ce qu'est une imbalance, comment la repérer sur un graphique, et ce qu'elle dit du comportement du marché. Une notion technique qui complète la méthode.", learnybox: "9.3" },
};

  /**
   * ── ⛔ LES TROIS NIVEAUX DU PARCOURS ──────────────────────────────────────
   *
   * Tranche par Nadir le 14/10. ⚠️ A partir du module 7, c est CONFIRME, meme
   * si les couvertures du module 8 annoncent autre chose : les mentions
   * contradictoires sur les images n y changent rien.
   *
   * ⛔ Le module 7 bis appartient au confirme, ses couvertures portent
   * « PROGRAMME CONFIRME ». ⚠️ Le module 9, bonus, y figure aussi : il est
   * accessible, mais il ne compte ni en XP ni dans la progression du niveau.
   */
  const NIVEAUX_PARCOURS = [
    { cle: 'debutant', nom: 'Débutant', modules: ['01', '02', '03', '04'] },
    { cle: 'intermediaire', nom: 'Intermédiaire', modules: ['05', '06'] },
    { cle: 'confirme', nom: 'Confirmé', modules: ['07', '07bis', '08', '09', '10'] },
  ];

  const MODULES = [
    /**
     * ⛔ L'INTRODUCTION NE COMPTE PAS POUR LA CERTIFICATION, et c'est délibéré.
     *
     * `certOuverte()` exige que TOUS les modules non certifiants soient
     * terminés. ⚠️ Ajouter l'Introduction sans précaution créerait une condition
     * neuve pour obtenir le certificat : regarder la vidéo de bienvenue.
     * ⛔ Personne ne l'a décidée, et elle serait d'autant plus surprenante que
     * la vidéo ne peut pas encore jouer. Le drapeau `introduction` l'écarte.
     */
    { cle: '00', numero: '00', titre: 'Introduction', lecons: CHAPITRES['00'], introduction: true },
    { cle: '01', numero: '01', titre: 'Se préparer mentalement et comprendre les bases', lecons: CHAPITRES['01'] },
    { cle: '02', numero: '02', titre: 'Comprendre le trading', lecons: CHAPITRES['02'] },
    { cle: '03', numero: '03', titre: 'Maîtriser tes indicateurs, et rien de plus', lecons: CHAPITRES['03'] },
    { cle: '04', numero: '04', titre: 'Prendre en main ta plateforme de trading', lecons: CHAPITRES['04'] },
    { cle: '05', numero: '05', titre: 'Appliquer la méthode Trader 360', lecons: CHAPITRES['05'] },
    { cle: '06', numero: '06', titre: 'Renforcer ta psychologie de trader', lecons: CHAPITRES['06'] },
    { cle: '07', numero: '07', titre: "Gérer l'après-challenge et structurer son activité", lecons: CHAPITRES['07'] },
    /**
     * ⛔ `numero: '7 bis'` est ce que l ELEVE lit, `cle: '07bis'` est la cle
     * interne. ⚠️ LearnyBox ecrit « 7bis », « 5.3 Bis » et « 4.2.2 » pour la meme
     * idee de complement : trois formes. ⛔ Celle-ci suit le sommaire que l eleve
     * connait, l harmonisation des trois reste a trancher par Nadir.
     */
    { cle: '07bis', numero: '7 bis', titre: 'Structurer son activité de trader après le challenge',
      lecons: CHAPITRES['07bis'] },
    { cle: '08', numero: '08', titre: 'Comprendre la fiscalité liée au trading', lecons: CHAPITRES['08'] },
    /**
     * ⛔ LE MODULE 9 EST UN BONUS : ZERO XP, et hors progression.
     * ⚠️ Trois chapitres a 33 XP contre douze a 8 dans le module 05 en
     * faisaient de loin le chemin le plus rentable. ⛔ Un bonus ne doit pas
     * etre un raccourci vers le niveau suivant.
     * ⚠️ Il reste VISIBLE et accessible : zero XP ne veut pas dire cache.
     */
    { cle: '09', numero: '09', titre: 'Pour aller plus loin', lecons: CHAPITRES['09'], bonus: true },
    // ⛔ VERROUILLE tant que les neuf autres ne sont pas traverses, et SANS
    // chapitre : aucun dossier Vimeo ne lui correspond, et on ne lui en invente
    // pas. La certification est une condition, pas une lecon.
    { cle: '10', numero: '10', titre: 'Certification Trader 360', lecons: CHAPITRES['10'], certification: true },
  ];
  /**
   * ── ⛔ `cle` EST PORTEE PAR LE MODULE, ET C EST LA CORRECTION DE CLASSE ────
   *
   * ⚠️ DEFAUT MESURE LE 14/10, ET C EST LE CINQUIEME ENDROIT : cette ligne
   * lisait `DESCRIPTIONS[m.numero]`. Or le `numero` du 7 bis est « 7 bis »,
   * avec un espace, parce que c est ce que l ELEVE lit dans le sommaire.
   * `DESCRIPTIONS['7 bis']` vaut donc `undefined`, et la carte du module
   * affichait « En attente de description » alors que la description EXISTE,
   * sous la cle `'07bis'`, dans ce fichier, trois cents lignes plus haut.
   * ⛔ Aucune erreur, aucun avertissement : un `|| null` avale la faute.
   *
   * ── ⚠️ LES QUATRE PRECEDENTS, POUR QUE LE MOTIF SOIT LISIBLE ─────────────
   *
   *   1. `Number('07bis')` rendait `NaN` dans le tri des badges
   *   2. un motif n acceptait que `Bis` capitalise
   *   3. `lireDepot` ne reconnaissait que les cles a DEUX chiffres
   *   4. `Module 7` et `Module 7bis` partageaient une cle a l import
   *
   * ⛔ LA CORRECTION N EST PAS UN CINQUIEME RATTRAPAGE. Chacun des quatre avait
   * ete repare localement, et le cinquième est arrive quand meme : c est la
   * preuve que le defaut n est pas dans les appels mais dans la DONNEE, qui
   * n avait qu un seul champ pour deux usages. ⚠️ `cle` est desormais declaree
   * une fois, a cote du `numero`, et tout ce qui indexe lit `m.cle`.
   * ⛔ `numero` ne sert plus qu a l AFFICHAGE.
   */
  MODULES.forEach((m) => { m.description = DESCRIPTIONS[m.cle] || null; });

  /**
   * ── ⛔ LE GARDE-FOU QUI CRIE, PARCE QUE LE SILENCE EST LE DEFAUT ──────────
   *
   * ⚠️ Les cinq pertes de `07bis` ont TOUTES echoue en silence : un `undefined`
   * avale par un `|| null`, un `NaN` compare sans erreur, un `find` qui rend
   * `undefined`. ⛔ Aucun n a leve. Ce bloc est la seule chose qui aurait parle.
   *
   * ⛔ IL NE CORRIGE RIEN, IL DIT. Corriger une cle manquante en la devinant
   * remettrait le probleme exactement ou il etait.
   */
  (function controlerLesCles() {
    const cles = MODULES.map((m) => m.cle);
    const dits = NIVEAUX_PARCOURS.flatMap((n) => n.modules);
    // 1. Deux modules ne peuvent pas porter la meme cle.
    const doubles = cles.filter((c, i) => cles.indexOf(c) !== i);
    if (doubles.length) console.error('[DONNEES] ⛔ cles de module en double :', doubles);
    // 2. Un niveau ne peut pas nommer un module qui n existe pas.
    const fantomes = dits.filter((c) => !cles.includes(c));
    if (fantomes.length) console.error('[DONNEES] ⛔ niveau qui nomme un module absent :', fantomes);
    // 3. Tout module sauf l Introduction appartient a un niveau.
    const orphelins = MODULES.filter((m) => !m.introduction && !dits.includes(m.cle)).map((m) => m.cle);
    if (orphelins.length) console.error('[DONNEES] ⛔ module sans niveau :', orphelins);
    // 4. ⚠️ ET LA DESCRIPTION : c est precisement ce qui manquait sans le dire.
    const muets = MODULES.filter((m) => !m.introduction && !m.certification && !m.description)
      .map((m) => m.cle);
    if (muets.length) console.error('[DONNEES] ⛔ module sans description :', muets);
  }());

  /** Toutes les leçons, à plat, dans l'ordre de lecture. Sert à « leçon suivante ». */
  /**
   * ── ⚠️ LES DIX PHRASES DU PARCOURS, UNE PAR MODULE ───────────────────────
   *
   * ⛔ CE SONT DES PROPOSITIONS. Elles parlent au nom de Nadir, il les corrigera.
   *
   * ⚠️ ELLES DOIVENT RESTER CONFORMES. Trader 360 est une formation au trading :
   * ⛔ aucune ne promet un gain, un revenu, une réussite ni un financement.
   * « Tu approches de la méthode » est juste ; « bientôt ton premier payout » ne
   * l'est pas. Le site entier tient cette ligne, l'espace membre ne la casse pas.
   * Chacune nomme ce que le module APPREND, jamais ce qu'il rapporterait.
   */
  const PHRASES = {
    depart: 'Tu commences. La première leçon t\'attend.',
    '01': 'Tu poses les fondations : sans mental, aucune méthode ne tient.',
    '02': 'Tu apprends à lire le marché avant de vouloir le devancer.',
    '03': 'Tu réduis le bruit : quelques indicateurs, bien compris.',
    '04': 'Tu prends les commandes et tu apprivoises ta plateforme.',
    '05': 'Tu approches de la méthode Trader 360, le coeur de la formation.',
    '06': 'Tu travailles la part la plus difficile : toi.',
    '07': 'Tu abordes les règles des prop firms et la façon de les tenir.',
    '08': 'Tu mets ton activité au clair du côté administratif.',
    '09': 'Tu approfondis, au-delà du programme principal.',
    '10': 'Tu arrives à la certification Trader 360.',
  };

  const SUITE = MODULES.flatMap((m) => m.lecons.map((l) => ({ ...l, module: m.numero })));

  /**
   * ⚠️ LE MEME FICHIER SERT AU NAVIGATEUR ET AU SERVEUR, et c'est voulu.
   * Le rapport hebdomadaire a besoin de nommer la prochaine leçon d'un élève.
   * ⛔ Dupliquer la structure côté serveur la ferait diverger au premier module
   * ajouté, sans qu'aucune erreur ne le signale : le mail parlerait d'une leçon
   * qui n'existe plus, ou en oublierait une.
   * `globalThis` existe des deux côtés ; `module.exports` n'est pose que si
   * quelqu'un le cherche.
   */
  const racine = typeof window !== 'undefined' ? window : globalThis;
  racine.FormationDonnees = {
    MODULES,
    NIVEAUX_PARCOURS,
    /** Le niveau d un module, par son numero interne. `null` si inconnu. */
    niveauDuModule: (numero) => NIVEAUX_PARCOURS
      .find((n) => n.modules.includes(numero)) || null,
    PHRASES,
    SUITE,
    module: (numero) => MODULES.find((m) => m.numero === numero) || null,
    lecon: (id) => SUITE.find((l) => l.id === id) || null,
    /** La leçon qui suit, dans le module puis dans le suivant. `null` à la fin. */
    suivante: (id) => {
      const i = SUITE.findIndex((l) => l.id === id);
      return i >= 0 && i + 1 < SUITE.length ? SUITE[i + 1] : null;
    },
    /** Le nombre total de leçons réellement posées, modules vides exclus. */
    total: () => SUITE.length,
  };
  // ⛔ PAS DE `module.exports` ICI. Le depot est en `"type": "module"`, donc un
  // `require` de ce fichier rend un objet VIDE sans lever d erreur. Le serveur le
  // charge autrement, en l evaluant : voir `api/cron/weekly-report.js`.
})();
