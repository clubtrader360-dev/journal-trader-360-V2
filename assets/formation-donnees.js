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
    ...l,
    // ⛔ Vides tant que la confidentialité Vimeo n'est pas tranchée.
    description: '',
    video: null,
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

  const MODULES = [
    { numero: '01', titre: 'Se préparer mentalement et comprendre les bases', lecons: LECONS_MODULE_01 },
    { numero: '02', titre: 'Comprendre le trading', lecons: [] },
    { numero: '03', titre: 'Maîtriser tes indicateurs, et rien de plus', lecons: [] },
    { numero: '04', titre: 'Prendre en main ta plateforme de trading', lecons: [] },
    { numero: '05', titre: 'Appliquer la méthode Trader 360', lecons: [] },
    { numero: '06', titre: 'Renforcer ta psychologie de trader', lecons: [] },
    { numero: '07', titre: "Gérer l'après-challenge et structurer son activité", lecons: [] },
    { numero: '08', titre: 'Comprendre la fiscalité liée au trading', lecons: [] },
    { numero: '09', titre: 'Pour aller plus loin', lecons: [] },
    { numero: '10', titre: 'Certification Trader 360', lecons: [] },
  ];

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

  window.FormationDonnees = {
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
})();
