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
  const LECONS_MODULE_01 = [
    { id: 'm01-l0', titre: 'Introduction : se préparer mentalement et comprendre les bases du trading' },
    { id: 'm01-l1', titre: "Adopter l'état d'esprit du Trader 360" },
    { id: 'm01-l2', titre: 'Définir ses objectifs de trading et de vie' },
    { id: 'm01-l3', titre: 'Développer sa discipline' },
    { id: 'm01-l4', titre: "Gérer le stress et l'impatience" },
    { id: 'm01-l5', titre: 'Créer ta routine mentale' },
    { id: 'm01-l6', titre: 'Entrer dans la zone' },
  ].map((l) => ({
    // ⚠️ LES VALEURS ÉCRITES CI-DESSUS GAGNENT, les défauts ne font que combler.
    // ⛔ La version précédente écrasait `description` et `video` APRÈS l'étalement :
    // Nadir aurait pu coller un texte dans une leçon et ne rien voir s'afficher,
    // sans la moindre erreur. Il aurait fallu comprendre la structure pour y
    // arriver, ce qui est exactement ce que ce fichier doit éviter de demander.
    description: '',
    video: null,
    ...l,
  }));

  /**
   * ⚠️ UNE SEULE VIDÉO, POUR TRANCHER. Demande de Nadir du 10/10/2026.
   *
   * `1229950174`, première leçon du MODULE 1, relevée en `view: unlisted` et
   * `embed: whitelist`. ⛔ Les 63 autres ne sont PAS posées : si le domaine
   * manque dans la liste blanche, il faudra toutes les reprendre, et autant ne
   * les avoir posées qu'une fois.
   *
   * ⛔ LE RAISONNEMENT « LES REPLAYS MARCHENT DONC LE DOMAINE EST AUTORISÉ » NE
   * TIENT PAS, et il faut le dire ici parce qu'il est tentant. La liste des
   * domaines se règle VIDÉO PAR VIDÉO, pas une fois pour le compte. Les replays
   * sont déposés depuis le journal ; les 64 vidéos de formation ont vécu
   * intégrées dans LearnyBox, et leur liste contient probablement
   * `trader360.learnybox.com` ou l'ancien `trader360.fr`, pas
   * `journaltrader360.fr`.
   *
   * ⚠️ Et le piège dans l'autre sens : 99 replays sont en intégration PUBLIQUE,
   * donc ils jouent partout sans aucune liste. Les prendre pour preuve
   * conclurait à tort que le domaine est autorisé.
   */
  LECONS_MODULE_01[0].video = '1229950174';

  /**
   * ── ⚠️ LA STRUCTURE COMPLETE, ET D OU VIENNENT SES NOMBRES ────────────────
   *
   * ⛔ CE FICHIER EST LA SOURCE UNIQUE DES MODULES. La maquette validee en
   * portait une seconde, avec ses propres titres et ses propres comptes. ⚠️ Deux
   * listes de modules divergent toujours : celle qu on ne regarde pas devient
   * fausse, et personne ne s en apercoit avant qu un eleve lise un titre qui
   * n existe plus. C est donc la maquette qui s adapte a ce fichier.
   *
   * ── LES NOMBRES DE CHAPITRES SONT MESURES, PAS SUPPOSES ───────────────────
   *
   * Relevé Vimeo du 09/10/2026, `formation-vimeo-releve.json`, recompté le
   * 11/10/2026 :
   *
   *     MODULE 1   7      MODULE 5  12      MODULE 8   3
   *     MODULE 2  10      MODULE 6   5      MODULE 9   3
   *     MODULE 3   5      MODULE 7   9      (dossier « Formation »  1)
   *     MODULE 4   5      MODULE 7BIS 4
   *                                          soit 63 + 1 isolee
   *
   * La maquette annonce exactement ces nombres : ils ne sont pas inventes.
   * ⛔ SAUF LE MODULE 10, auquel elle attribue 2 chapitres alors qu AUCUN
   * dossier Vimeo ne lui correspond. Il reste donc VIDE ici, et il apparait
   * verrouille tant que les neuf premiers ne sont pas traverses, comme dans la
   * maquette. ⚠️ A Nadir de dire ce qu il contient.
   *
   * ── ⚠️ CE QUI EST PROVISOIRE, ET SE VOIT COMME TEL ────────────────────────
   *
   * ⛔ Les titres des chapitres des modules 02 a 09 sont des EMPLACEMENTS. Le
   * rapprochement dossier Vimeo / module n est pas tranche (voir
   * `formation-rapprochement-modules.md`), donc on ne sait pas encore QUELLE
   * video porte quel titre. Seul le module 01 a ses sept vrais titres.
   * ⛔ `video: null` PARTOUT SAUF UNE : la question des domaines Vimeo n est pas
   * reglee, et `index.html` ne pose aucun lecteur. L emplacement dit que la
   * video arrive.
   * ⛔ `description: null` : aucune description inventee. Celles des MODULES
   * viennent de la maquette validee et sont marquees comme telles ci-dessous ;
   * celles des chapitres n existent pas encore et s affichent « En attente de
   * description ».
   */
  const chapitres = (num, n, depart = 0, groupe = null) => Array.from(
    { length: n },
    (_, i) => ({
      id: `m${num}-l${depart + i}`,
      // ⚠️ Provisoire, et ecrit pour que cela se voie.
      titre: `Chapitre ${depart + i + 1}`,
      groupe,
      video: null,
      description: null,
      provisoire: true,
    }),
  );

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

  const MODULES = [
    { numero: '01', titre: 'Se préparer mentalement et comprendre les bases', lecons: LECONS_MODULE_01 },
    { numero: '02', titre: 'Comprendre le trading', lecons: chapitres('02', 10) },
    { numero: '03', titre: 'Maîtriser tes indicateurs, et rien de plus', lecons: chapitres('03', 5) },
    { numero: '04', titre: 'Prendre en main ta plateforme de trading', lecons: chapitres('04', 5) },
    { numero: '05', titre: 'Appliquer la méthode Trader 360', lecons: chapitres('05', 12) },
    { numero: '06', titre: 'Renforcer ta psychologie de trader', lecons: chapitres('06', 5) },
    // ⚠️ Le module 07 porte DEUX groupes : le dossier `MODULE 7` (9 videos) et
    // `MODULE 7BIS` (4). La maquette les affiche sous deux intertitres, et c est
    // la seule raison d etre du champ `groupe`.
    {
      numero: '07',
      titre: "Gérer l'après-challenge et structurer son activité",
      lecons: [...chapitres('07', 9), ...chapitres('07', 4, 9, '7 bis')],
    },
    { numero: '08', titre: 'Comprendre la fiscalité liée au trading', lecons: chapitres('08', 3) },
    { numero: '09', titre: 'Pour aller plus loin', lecons: chapitres('09', 3) },
    // ⛔ VIDE, et verrouille : aucun dossier Vimeo ne lui correspond.
    { numero: '10', titre: 'Certification Trader 360', lecons: [], certification: true },
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
