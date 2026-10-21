/**
 * LES EMAILS MARKETING : les modèles, le gabarit, et les contrôles avant envoi.
 * Source unique, lue par la route coach (/api/coach/membres, action `campagnes`) ;
 * le back-office ne recopie rien.
 *
 * ── ⛔ ENVOI PAR CAMPAGNE BREVO, DONC IMAGES HÉBERGÉES ─────────────────────────
 * Une campagne Brevo ne transporte pas de pièce jointe : le logo en `cid:` des mails
 * transactionnels y casse (déjà vécu sur ce projet). Le logo est donc l'image
 * hébergée sur trader360.fr, vérifiée en ligne le 20/10 (200, image/png, 14 237 octets).
 *
 * ── ⛔ LA DÉSINSCRIPTION ───────────────────────────────────────────────────────
 * Le gabarit ne pose PAS de balise de désinscription : la syntaxe exacte n'est pas
 * établie dans la documentation, et une balise mal écrite partirait en texte brut.
 * Brevo ajoute son propre pied de désinscription à toute campagne qui n'en a pas,
 * c'est ce que fait le brief quotidien en production depuis des semaines. À regarder
 * dans le premier mail de test.
 *
 * ── ⛔ CE QU'UN MODÈLE N'A PAS LE DROIT DE DIRE ─────────────────────────────────
 * Aucune promesse de gain, aucun montant gagné, aucun chiffre inventé, aucun tiret
 * cadratin. Les exemples sont des brouillons à valider par Nadir ; les repères
 * [À VALIDER] bloquent l'envoi à une liste (pas l'envoi de test).
 */

export const LOGO = 'https://www.trader360.fr/courriel/t360-logo-or.png';
export const EXPEDITEUR_ID = 2; // contact@trader360.fr, validé dans Brevo (même expéditeur que le brief)
/** Le préfixe qui distingue nos campagnes de celles du brief dans l'historique Brevo. */
export const PREFIXE_NOM = 'T360 · ';

export const CHAMPS = [
  { cle: 'objet', libelle: 'Objet du mail', genre: 'texte', obligatoire: true, aide: 'Ce que la personne lit dans sa boîte. 60 caractères au plus, idéalement.' },
  { cle: 'pre_entete', libelle: 'Pré-en-tête', genre: 'texte', aide: 'La ligne grise affichée après l’objet dans Gmail ou Apple Mail. Facultatif.' },
  { cle: 'surtitre', libelle: 'Surtitre', genre: 'texte', aide: 'Quelques mots en or au-dessus du titre.' },
  { cle: 'titre', libelle: 'Titre', genre: 'texte', obligatoire: true },
  { cle: 'paragraphes', libelle: 'Texte', genre: 'liste', obligatoire: true, aide: 'Un paragraphe par ligne. {{prenom}} est remplacé par le prénom du contact.' },
  { cle: 'bouton_texte', libelle: 'Texte du bouton', genre: 'texte', aide: 'Facultatif. Sans texte, pas de bouton.' },
  { cle: 'bouton_lien', libelle: 'Lien du bouton', genre: 'url', aide: 'Adresse complète, en https.' },
  { cle: 'signature', libelle: 'Signature', genre: 'texte', aide: 'Par exemple « Emmanuel et Nadir ».' },
];

/**
 * ⛔ À QUI S'ADRESSENT CES MAILS (Nadir, 21/10) : aux PROSPECTS, pas aux membres.
 * Les relances et les félicitations des membres sont faites par Manu, à la main, avec
 * son calendrier : elles touchent la communauté et sont semi-personnalisées. Aucun
 * modèle ici ne parle à un membre (pas d'espace membre, pas de chapitre, pas de module).
 * ⛔ Le parcours d'un prospect passe TOUJOURS par le questionnaire, puis un appel :
 * c'est la suite proposée par défaut. Le présentiel s'adresse aux membres : il n'a
 * pas de modèle ici.
 */
const QUESTIONNAIRE = 'https://www.trader360.fr/candidater/';

export const MODELES = [
  {
    cle: 'webinaire', nom: 'Invitation à un webinaire', resume: 'Une date, un sujet, un lien vers la page d’inscription du webinaire.',
    exemple: {
      objet: 'Webinaire gratuit : [À VALIDER] le sujet',
      pre_entete: 'Une heure en direct avec les coachs, [À VALIDER] date.',
      surtitre: 'Webinaire gratuit en direct',
      titre: '[À VALIDER] Le sujet du webinaire',
      paragraphes: [
        'Salut {{prenom}},',
        'On organise un webinaire gratuit le [À VALIDER] date à [À VALIDER] heure, pour parler de [À VALIDER] sujet.',
        'Au programme : [À VALIDER] point 1 ; point 2 ; point 3. Et un temps de questions et réponses en direct avec les coachs.',
        'L’inscription prend dix secondes, et tu reçois le lien du direct par e-mail.',
      ],
      bouton_texte: 'Je réserve ma place',
      bouton_lien: 'https://www.trader360.fr/t/[À VALIDER]/',
      signature: 'Emmanuel et Nadir, coachs Trader 360',
    },
  },
  {
    cle: 'ressource', nom: 'Ressource offerte', resume: 'Un guide, une checklist ou une vidéo offerts, via la page de la ressource.',
    exemple: {
      objet: 'Pour toi : [À VALIDER] le nom de la ressource',
      pre_entete: 'Gratuit, à garder à côté de ton écran.',
      surtitre: 'Ressource offerte',
      titre: '[À VALIDER] Le nom de la ressource',
      paragraphes: [
        'Salut {{prenom}},',
        'On a rassemblé dans [À VALIDER] ce que les coachs vérifient avant chaque séance.',
        'C’est offert : il suffit de laisser ton adresse sur la page.',
      ],
      bouton_texte: 'Recevoir la ressource',
      bouton_lien: 'https://www.trader360.fr/t/[À VALIDER]/',
      signature: 'Emmanuel et Nadir, coachs Trader 360',
    },
  },
  {
    cle: 'conseil', nom: 'Un conseil de trading', resume: 'Un enseignement de la méthode, concret, en quelques lignes. Le mail qui donne avant de demander.',
    exemple: {
      objet: '[À VALIDER] Le conseil en une phrase',
      pre_entete: 'Deux minutes de lecture, applicable dès ta prochaine séance.',
      surtitre: 'Le conseil de la semaine',
      titre: 'Pas de zone, pas de trade.',
      paragraphes: [
        'Salut {{prenom}},',
        '[À VALIDER] Le constat : l’erreur que font la plupart des traders débutants.',
        '[À VALIDER] Ce qu’on fait à la place, et pourquoi.',
        '[À VALIDER] Comment l’appliquer dès ta prochaine séance.',
        'Si tu veux qu’on regarde ensemble où tu en es, le questionnaire est le premier pas.',
      ],
      bouton_texte: 'Remplir le questionnaire',
      bouton_lien: QUESTIONNAIRE,
      signature: 'Emmanuel et Nadir, coachs Trader 360',
    },
  },
  {
    cle: 'marche', nom: 'Point marché', resume: 'Le contexte du moment en quatre lignes, dans l’esprit du brief.',
    exemple: {
      objet: 'Point marché : [À VALIDER] le sujet',
      pre_entete: 'Le contexte en quatre lignes.',
      surtitre: 'Point marché',
      titre: '[À VALIDER] Le sujet du moment',
      paragraphes: [
        'Salut {{prenom}},',
        '[À VALIDER] Ce qui bouge, en une phrase.',
        '[À VALIDER] Pourquoi ça compte pour une séance de trading.',
        'Comme toujours chez nous : pas de zone, pas de trade.',
      ],
      bouton_texte: '',
      bouton_lien: '',
      signature: 'Emmanuel et Nadir, coachs Trader 360',
    },
  },
  {
    cle: 'accompagnement', nom: 'Présenter l’accompagnement', resume: 'La méthode, le suivi individuel, la communauté. Le bouton mène au questionnaire.',
    exemple: {
      objet: 'Comment on accompagne un trader jusqu’à l’autonomie',
      pre_entete: 'La méthode, le suivi, et la première étape.',
      surtitre: 'Formation et accompagnement',
      titre: 'Une méthode écrite, et des coachs qui tradent.',
      paragraphes: [
        'Salut {{prenom}},',
        'Chez Trader 360, on accompagne des traders sur les futures, de leur premier graphique jusqu’à l’autonomie.',
        'Une méthode écrite, des séances en direct chaque semaine, un journal de trading relu par les coachs, et une communauté qui avance ensemble.',
        'Chaque accompagnement commence par un questionnaire, puis un échange avec un coach : on regarde ensemble ton point de départ et tes objectifs.',
        'Le trading comporte un risque de perte en capital : on y travaille d’abord la discipline et la gestion du risque.',
      ],
      bouton_texte: 'Remplir le questionnaire',
      bouton_lien: QUESTIONNAIRE,
      signature: 'Emmanuel et Nadir, coachs Trader 360',
    },
  },
  {
    cle: 'libre', nom: 'Composer librement', resume: 'Une page blanche aux couleurs Trader 360 : titre, texte, bouton.',
    exemple: { objet: '', pre_entete: '', surtitre: '', titre: '', paragraphes: ['Salut {{prenom}},'], bouton_texte: 'Remplir le questionnaire', bouton_lien: QUESTIONNAIRE, signature: 'Emmanuel et Nadir, coachs Trader 360' },
  },
];

export const modeleDe = (cle) => MODELES.find((m) => m.cle === cle) || null;

/* ══ CONTRÔLES ════════════════════════════════════════════════════════════ */
const vide = (v) => v == null || (Array.isArray(v) ? v.filter((x) => String(x).trim()).length === 0 : String(v).trim() === '');
const texte = (v) => (Array.isArray(v) ? v.join(' ') : String(v ?? ''));

/** Ce qui bloque l'envoi à une liste. Le test, lui, part toujours. */
export function manquants(c) {
  const out = [];
  for (const ch of CHAMPS) {
    const v = c[ch.cle];
    if (ch.obligatoire && vide(v)) out.push(ch.libelle);
    else if (/\[À VALIDER\]/.test(texte(v))) out.push(`${ch.libelle} (repère à remplacer)`);
  }
  if (!vide(c.bouton_texte) && !/^https:\/\/[^\s]+$/.test(String(c.bouton_lien || '').trim())) out.push('Lien du bouton (adresse https complète)');
  if (/[–—]/.test(CHAMPS.map((ch) => texte(c[ch.cle])).join(' '))) out.push('Tiret cadratin ou demi-cadratin à remplacer');
  return out;
}

/* ══ GABARIT ══════════════════════════════════════════════════════════════ */
const C = {
  noir: '#050506', or: '#e8b84b', orFonce: '#b98a2e',
  encre: '#1a1c20', encreDouce: '#55585f', encrePale: '#8b8e95',
  fond: '#f4f3f0', carte: '#ffffff', ligne: '#e4e2dd',
  // ⛔ Guillemets SIMPLES dans la pile : des doubles fermeraient l'attribut style.
  police: "-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif",
};
const S = { fond: '#0b0c0e', carte: '#141619', ligne: '#24262b', encre: '#f1f0ee', encreDouce: '#b9bcc2', encrePale: '#8b8e95' };

/** Échappe le texte saisi : un champ du back-office n'est pas du HTML. L'apostrophe courbe est ramenée à la droite. */
export const esc = (s) => String(s ?? '').replace(/’/g, "'")
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * `{{prenom}}` devient la variable de contact Brevo. ⚠️ Sans prénom connu, Brevo
 * laisserait un blanc : « Salut , » ; le filtre `default` met « à toi » à la place.
 * Dans l'aperçu, on remplace par un prénom d'exemple.
 */
function personnaliser(s, apercu) {
  return s.replace(/\{\{\s*prenom\s*\}\}/gi, apercu ? 'Nadir' : '{{ contact.PRENOM | default : "à toi" }}');
}

function feuilleSombre() {
  const r = [
    ['.t-fond', `background:${S.fond} !important`],
    ['.t-carte', `background:${S.carte} !important;border-color:${S.ligne} !important`],
    ['.t-titre', `color:${S.encre} !important`],
    ['.t-texte', `color:${S.encreDouce} !important`],
    ['.t-pale', `color:${S.encrePale} !important`],
    ['.t-or', `color:${C.or} !important`],
    ['.t-bouton', `background:${C.or} !important;color:#120e07 !important`],
    ['.t-bande', `background:${C.noir} !important`],
    ['.t-pied', `background:${S.fond} !important`],
  ];
  return `<style>:root{color-scheme:light dark;supported-color-schemes:light dark}@media (prefers-color-scheme:dark){${r.map(([a, b]) => `${a}{${b}}`).join('')}}${r.map(([a, b]) => `[data-ogsc] ${a}{${b}}`).join('')}</style>`;
}

export function rendreCampagne(c, { apercu = false } = {}) {
  const p = (s) => personnaliser(esc(s), apercu);
  const paras = (Array.isArray(c.paragraphes) ? c.paragraphes : String(c.paragraphes || '').split('\n')).map((x) => String(x).trim()).filter(Boolean);
  const bouton = !vide(c.bouton_texte) && c.bouton_lien
    ? `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="margin:22px 0 6px"><tr><td align="center" class="t-bouton" style="background:${C.or};border-radius:9px">
        <a href="${esc(c.bouton_lien)}" class="t-bouton" style="display:block;padding:15px 20px;text-decoration:none;color:#120e07;font-weight:700;font-size:15px;font-family:${C.police}">${p(c.bouton_texte)}</a></td></tr></table>`
    : '';
  const corps = [
    c.surtitre ? `<div class="t-or" style="font-size:11px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:${C.orFonce};margin:0 0 10px">${p(c.surtitre)}</div>` : '',
    `<h1 class="t-titre" style="font-size:22px;line-height:1.3;font-weight:700;margin:0 0 16px;letter-spacing:-.01em;color:${C.encre}">${p(c.titre)}</h1>`,
    ...paras.map((x) => `<p class="t-texte" style="font-size:15px;line-height:1.7;color:${C.encreDouce};margin:0 0 14px">${p(x)}</p>`),
    bouton,
    c.signature ? `<p class="t-texte" style="font-size:15px;line-height:1.7;color:${C.encreDouce};margin:18px 0 0">${p(c.signature)}</p>` : '',
  ].join('\n');
  const preEntete = c.pre_entete ? `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;font-size:1px;line-height:1px;color:${C.fond}">${p(c.pre_entete)}${'&nbsp;&zwnj;'.repeat(40)}</div>` : '';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light dark"><meta name="supported-color-schemes" content="light dark"><title>${p(c.objet)}</title>${feuilleSombre()}</head>
<body class="t-fond" style="margin:0;padding:0;background:${C.fond}">${preEntete}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" class="t-fond" style="background:${C.fond};padding:18px 0"><tr><td align="center">
<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="t-carte" style="width:100%;max-width:600px;background:${C.carte};border:1px solid ${C.ligne};border-radius:10px;overflow:hidden">
<tr><td align="center" class="t-bande" style="background:${C.noir};padding:24px 26px 22px">
  <img src="${LOGO}" alt="TRADER 360" width="220" class="t-or" style="display:block;border:0;width:220px;max-width:220px;height:auto;color:${C.or};font-family:${C.police};font-size:19px;font-weight:700;letter-spacing:.2em;text-align:center"></td></tr>
<tr><td style="padding:28px 28px 24px;font-family:${C.police}">${corps}</td></tr>
<tr><td class="t-pied t-pale" style="background:${C.fond};padding:18px 28px;font-size:11.5px;line-height:1.6;color:${C.encrePale};font-family:${C.police}">
  Trader 360, SASU. Le trading comporte un risque de perte en capital.
  <a href="https://www.trader360.fr/politique-de-confidentialite/" class="t-pale" style="color:${C.encrePale}">Politique de confidentialité</a></td></tr>
</table></td></tr></table></body></html>`;
}
