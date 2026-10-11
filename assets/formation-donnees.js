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
    { id: 'm04-l3', titre: "Rejoindre le groupe Discord",
      video: null, description: null, provisoire: true, minutes: 12 },
    { id: 'm04-l4', titre: "TradingView complément",
      video: null, description: null, provisoire: true, minutes: 50 },
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
    // MODULE 7
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
    // MODULE 7BIS
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
    '01': 'Les objectifs, la discipline, la routine. Ce qui se met en place avant les graphiques.',
    '02': "Ce qu'on échange, comment se lit un graphique, ce qui fait bouger un prix.",
    '03': 'Quelques indicateurs bien compris valent mieux qu\'un graphique saturé.',
    '04': 'Installer, configurer, savoir où tout se trouve avant la première séance.',
    '05': 'Lire une séance, repérer les zones, calibrer son risque, décider sans improviser.',
    '06': 'Ce qui déclenche les décisions impulsives, et comment tenir quand ça tangue.',
    '07': 'Du challenge réussi au compte financé, puis à une activité qui tient.',
    '08': "Le cadre administratif et fiscal d'une activité de trading.",
    '09': "Les compléments qu'on ajoute quand une question revient souvent.",
    '10': 'La validation du parcours, une fois les neuf modules précédents traversés.',
  };

  /**
   * ⛔ LES TITRES ET DESCRIPTIONS DE MODULE NE SONT PAS TOUCHES ICI, et c est
   * voulu : ils viennent du site `trader360.fr`. L outil d import n emet que les
   * CHAPITRES, jamais les modules, pour que ce soit vrai par construction et non
   * par vigilance.
   */
  const MODULES = [
    { numero: '01', titre: 'Se préparer mentalement et comprendre les bases', lecons: CHAPITRES['01'] },
    { numero: '02', titre: 'Comprendre le trading', lecons: CHAPITRES['02'] },
    { numero: '03', titre: 'Maîtriser tes indicateurs, et rien de plus', lecons: CHAPITRES['03'] },
    { numero: '04', titre: 'Prendre en main ta plateforme de trading', lecons: CHAPITRES['04'] },
    { numero: '05', titre: 'Appliquer la méthode Trader 360', lecons: CHAPITRES['05'] },
    { numero: '06', titre: 'Renforcer ta psychologie de trader', lecons: CHAPITRES['06'] },
    { numero: '07', titre: "Gérer l'après-challenge et structurer son activité", lecons: CHAPITRES['07'] },
    { numero: '08', titre: 'Comprendre la fiscalité liée au trading', lecons: CHAPITRES['08'] },
    { numero: '09', titre: 'Pour aller plus loin', lecons: CHAPITRES['09'] },
    // ⛔ VERROUILLE tant que les neuf autres ne sont pas traverses, et SANS
    // chapitre : aucun dossier Vimeo ne lui correspond, et on ne lui en invente
    // pas. La certification est une condition, pas une lecon.
    { numero: '10', titre: 'Certification Trader 360', lecons: CHAPITRES['10'], certification: true },
  ];
  MODULES.forEach((m) => { m.description = DESCRIPTIONS[m.numero] || null; });

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
