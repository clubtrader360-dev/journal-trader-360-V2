/**
 * Transforme un brief en fichier d'archive publiable sur le site vitrine.
 *
 *   node outils/archiver-brief.mjs <source.html> <date-iso> <dossier-de-sortie>
 *
 * Écrit `<dossier>/<date-iso>.md` : en-tête de collection Astro, puis le corps du
 * brief en HTML sémantique, débarrassé de tout ce qui appartient au courriel.
 *
 * ── UNE SEULE ROUTINE, DEUX APPELANTS ────────────────────────────────────────
 * Ce fichier sert à la fois au RATTRAPAGE des briefs déjà envoyés (récupérés depuis
 * les campagnes Brevo) et à l'ARCHIVAGE AUTOMATIQUE du brief du jour, depuis
 * l'étape du workflow. Les deux appellent exactement le même code sur exactement
 * la même forme d'entrée : du HTML de courriel contenant le wrapper `brief-marche`.
 *
 * ⛔ NE PAS EN ÉCRIRE UNE SECONDE VERSION pour l'un des deux usages. Deux routines
 * de nettoyage finiraient par diverger, et rien ne le signalerait : le rattrapage
 * est passé une fois, l'automatique tourne chaque nuit, et c'est précisément le
 * genre d'écart qu'on ne constate que des mois plus tard, sur une page publiée.
 *
 * ── POURQUOI UNE EXTRACTION, ET NON UN FILTRAGE ──────────────────────────────
 * ⚠️ C'est le choix de conception le plus important de ce fichier.
 *
 * La consigne était de retirer la personnalisation, les pixels de suivi, les liens
 * de désinscription, les identifiants de campagne et les adresses e-mail. Le
 * premier réflexe est d'écrire un filtre par motif. Un filtre qui rate une
 * occurrence ne lève AUCUNE erreur : il rend un document qui a l'air propre.
 *
 * On fait donc l'inverse. On n'enlève pas ce qui est interdit : on ne garde QUE le
 * sous-arbre `<div class="brief-marche">`, qui est le brief lui-même. Tout le reste
 * du courriel — et c'est là que vivent le « Bonjour Prénom », le pixel, le lien de
 * désinscription, le logo Brevo, l'`utm_campaign` — est en DEHORS de ce sous-arbre,
 * ajouté par `wrapBriefHtml()` puis par Brevo à l'envoi. Mesuré sur les 23 briefs
 * envoyés entre le 28/08 et le 28/09 : zéro pixel, zéro adresse, zéro balise de
 * fusion, zéro lien à l'intérieur du wrapper.
 *
 * Le filtrage existe quand même, mais à sa juste place : en VÉRIFICATION FINALE, sur
 * le document produit, et il ne nettoie rien — il REFUSE D'ÉCRIRE. Un motif interdit
 * qui apparaîtrait un jour dans le wrapper ne serait pas silencieusement gommé, il
 * ferait échouer l'archivage avec son motif en clair.
 *
 * ── CE QUI EST QUAND MÊME RETIRÉ À L'INTÉRIEUR DU WRAPPER ────────────────────
 * Deux choses, l'une et l'autre constatées sur les briefs réels :
 *
 *   · les COMMENTAIRES HTML. Quatre briefs (28, 29, 31/08 et 01/09) portent un bloc
 *     `<!-- AUDIT QUALITÉ V10.1 … -->` : les notes de sourcing internes, avec les
 *     sources retenues et écartées. Personne ne les voyait dans un courriel ; sur
 *     une page publique elles seraient lisibles dans le code source.
 *   · les STYLES EN LIGNE. Ils sont faits pour Outlook et n'ont rien à faire sur le
 *     site : c'est la charte qui habille l'archive. Le balisage en tableaux du
 *     courriel n'est donc pas transposé tel quel, il est réduit à sa sémantique.
 */
import fs from 'node:fs';
import path from 'node:path';
import { formatDateLongFr, capitaliser } from '../api/_lib/date-fr.js';

/* ══════════════════════════════════════════════════════════════════════════════
   1. EXTRACTION DU SOUS-ARBRE
   ══════════════════════════════════════════════════════════════════════════════
   Par comptage de profondeur, et non par une expression régulière gloutonne. Le
   brief contient des <div> imbriqués (les encarts), donc s'arrêter au premier
   </div> le tronquerait — c'est exactement l'erreur que le workflow a déjà
   rencontrée sur sa propre extraction, d'où le commentaire qu'il porte.
   Aller jusqu'à la fin du fichier, comme le fait le workflow, n'est pas possible
   ici : la source est le courriel COMPLET, et ce qui suit le wrapper est
   précisément ce dont on ne veut pas. */
export function extraireBrief(html) {
  const ouverture = /<div[^>]*\bbrief-marche\b[^>]*>/i.exec(html);
  if (!ouverture) return null;
  const debut = ouverture.index + ouverture[0].length;
  let profondeur = 1;
  const balises = /<(\/?)div\b[^>]*>/gi;
  balises.lastIndex = debut;
  for (let m; (m = balises.exec(html)); ) {
    profondeur += m[1] ? -1 : 1;
    if (profondeur === 0) return html.slice(debut, m.index);
  }
  return null; // wrapper jamais refermé : document tronqué, on n'archive pas.
}

/* ══════════════════════════════════════════════════════════════════════════════
   2. RÉDUCTION À LA SÉMANTIQUE
   ══════════════════════════════════════════════════════════════════════════════ */

const HOTES_AUTORISES = ['journaltrader360.fr', 'trader360.fr'];

/** Un tableau de DONNÉES se reconnaît à son en-tête ES / CFD.
 *
 *  ⚠️ Le brief utilise des <table> pour DEUX choses : le tableau des niveaux, qui
 *  est de la donnée, et une demi-douzaine de tableaux de MISE EN PAGE (encarts,
 *  blocs chiffrés), parce qu'Outlook ne rend ni flexbox ni grille. Recensé : 235
 *  <table> sur 19 briefs, soit une douzaine par brief, dont UN SEUL est un tableau.
 *
 *  Le discriminant retenu est l'en-tête `ES` / `CFD`, que le gabarit garantit et
 *  que le workflow contrôle déjà de son côté (`compter '>ES<'`). Il est préféré à
 *  un comptage de lignes et de colonnes parce qu'il porte sur l'INTENTION du
 *  tableau, pas sur sa forme.
 *
 *  Et il échoue du bon côté : si le gabarit changeait, le tableau ne serait pas
 *  rendu de travers, il se déplierait en suite de blocs — lisible. Le compte des
 *  tableaux reconnus est journalisé à chaque archivage, donc un changement se voit.
 */
function estTableauDonnees(fragment) {
  return /<t[dh][^>]*>\s*ES\s*<\/t[dh]>/i.test(fragment)
      && /<t[dh][^>]*>\s*CFD\s*<\/t[dh]>/i.test(fragment);
}

/** Retire les emoji de tête d'un titre : la charte du site n'en porte pas. */
function titreSansEmoji(texte) {
  return texte.replace(/^[\s\p{Extended_Pictographic}\u{FE0F}\u{20E3}]+/u, '').trim();
}

export function nettoyer(fragment, { onTableau = () => {} } = {}) {
  let h = fragment;

  // ── Commentaires HTML : le bloc d'audit interne part ici. ──────────────────
  h = h.replace(/<!--[\s\S]*?-->/g, '');

  // ── Tableaux ───────────────────────────────────────────────────────────────
  // ⚠️ DU PLUS IMBRIQUÉ VERS L'EXTÉRIEUR. Un `<table[\s\S]*?</table>` non glouton
  // appliqué à un tableau qui en contient un autre s'arrête au </table> INTÉRIEUR :
  // le tableau extérieur est coupé en deux et le document part de travers, sans
  // qu'aucune erreur ne soit levée. On traite donc d'abord les tableaux qui n'en
  // contiennent aucun, puis on recommence, jusqu'à ce qu'il n'en reste plus.
  //
  // ⚠️ Le tableau de niveaux est mis DE CÔTÉ sous un jeton, pas réinjecté tel quel.
  // Sa conversion produit elle-même un `<table>`, que la boucle réapparierait
  // aussitôt : elle ne consommait plus rien et tournait jusqu'au garde-fou. Le défaut
  // ne s'est vu que parce que la boucle porte un garde-fou — sans lui, l'archivage se
  // serait arrêté sur un dépassement de mémoire, sans dire pourquoi.
  const SEUL = /<table\b(?:(?!<table\b)[\s\S])*?<\/table>/i;
  const gardes = [];
  for (let tours = 0; SEUL.test(h); tours += 1) {
    if (tours > 300) throw new Error('imbrication de tableaux anormale : archivage interrompu');
    h = h.replace(SEUL, (tableau) => {
      if (!estTableauDonnees(tableau)) return deplierCellules(tableau);
      onTableau();
      gardes.push(tableauDonnees(tableau));
      return `[[TABLEAU-${gardes.length - 1}]]`;
    });
  }

  // Le tableau mis de côté revient AVANT les passes suivantes, et non à la fin.
  // ⚠️ Restauré en dernier, il échappait au nettoyage des attributs : ses `style=`
  // survivaient. Le fichier n'a pas été publié pour autant — la vérification finale
  // l'a refusé, avec son motif. C'est exactement ce qu'on lui demande de faire.
  h = h.replace(/\[\[TABLEAU-(\d+)\]\]/g, (_, i) => gardes[Number(i)]);

  // ── Encarts en <div> ───────────────────────────────────────────────────────
  // Un <div> à fond coloré est un encart (mindset, mot de la communauté, culture).
  // Les autres ne portent que de la mise en page. La correspondance ouverture /
  // fermeture est tenue par une PILE : convertir les ouvertures par expression
  // régulière puis « rééquilibrer » à l'aveugle attribuerait la fermeture au
  // mauvais bloc, et tout le brief se retrouverait dans l'encart du mindset.
  h = deplierDivs(h);

  // ── Images : seul le schéma de culture survit ──────────────────────────────
  h = h.replace(/<img\b([^>]*)>/gi, (balise, attrs) => {
    const src = /src="([^"]*)"/i.exec(attrs);
    const alt = /alt="([^"]*)"/i.exec(attrs);
    const schema = src && /\/assets\/culture\/([a-z0-9-]+)\.png/i.exec(src[1]);
    if (!schema) return ''; // pixel de suivi, logo, bandeau : rien de tout cela.
    return `<img src="/culture/${schema[1]}.png" alt="${alt ? alt[1] : ''}" loading="lazy" />`;
  });

  // ── Liens ──────────────────────────────────────────────────────────────────
  // Aucun lien n'a été trouvé à l'intérieur du wrapper sur les 23 briefs mesurés.
  // Ce traitement est là pour le jour où il y en aura un : les paramètres de
  // campagne sautent, et un lien qui sort des domaines maison est déplié en texte
  // plutôt que publié. Un lien de suivi publié serait un identifiant de campagne
  // publié.
  h = h.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (_, attrs, texte) => {
    const href = /href="([^"]*)"/i.exec(attrs);
    if (!href) return texte;
    let url;
    try { url = new URL(href[1], 'https://journaltrader360.fr'); } catch { return texte; }
    if (!HOTES_AUTORISES.some((d) => url.hostname === d || url.hostname.endsWith(`.${d}`))) return texte;
    [...url.searchParams.keys()].filter((k) => /^utm_/i.test(k)).forEach((k) => url.searchParams.delete(k));
    return `<a href="${url.toString()}">${texte}</a>`;
  });

  // ── <span> dépliés ─────────────────────────────────────────────────────────
  // Ils ne servaient qu'à porter la police à chasse fixe et une couleur de
  // variation. Privés de leurs attributs il ne reste qu'une balise vide de sens,
  // et la sonde la signalait comme « balise inattendue » — à raison.
  h = h.replace(/<\/?span\b[^>]*>/gi, '');

  // ── Titres : emoji retirés ─────────────────────────────────────────────────
  h = h.replace(/<h2\b[^>]*>([\s\S]*?)<\/h2>/gi, (_, t) => `<h2>${titreSansEmoji(t)}</h2>`);

  // ── Attributs : liste blanche ──────────────────────────────────────────────
  // Tout ce qui reste perd ses attributs. `style`, `sib_img_id`, `sib_link_id`,
  // `templating`, `role`, `width`, `align`… : rien de cela ne concerne le site.
  const GARDES = { img: ['src', 'alt', 'loading'], a: ['href'], table: ['class'],
                   aside: ['class'], div: ['class'], th: ['colspan'], td: ['colspan'] };
  h = h.replace(/<([a-z][a-z0-9]*)\b([^>]*)>/gi, (balise, nom, attrs) => {
    const autorises = GARDES[nom.toLowerCase()];
    if (!autorises) return `<${nom.toLowerCase()}>`;
    const retenus = autorises
      .map((a) => {
        const m = new RegExp(`\\b${a}="([^"]*)"`, 'i').exec(attrs);
        return m ? `${a}="${m[1]}"` : null;
      })
      .filter(Boolean);
    const auto = /\/\s*$/.test(attrs) ? ' /' : '';
    return `<${nom.toLowerCase()}${retenus.length ? ' ' + retenus.join(' ') : ''}${auto}>`;
  });

  // ── Normalisation ──────────────────────────────────────────────────────────
  // ⚠️ Les <div> de mise en page rendent un <br /> à leur fermeture, parce que le
  // libellé et la valeur d'un bloc chiffré sont deux <div> frères : sans coupure,
  // « VIX · clôture 25/09 » et « 14,87 » se lisaient sur une seule ligne. Mais un
  // <div> qui n'enveloppait qu'un <p> ou un tableau produisait alors une coupure
  // inutile contre une frontière de bloc. On les retire ici, des DEUX côtés.
  // ⚠️ Le motif porte sur `<br>` ET `<br />` : la passe des attributs, qui tourne
  // AVANT celle-ci, a déjà normalisé la balise en `<br>`. La première version ne
  // cherchait que `<br />` et ne trouvait donc jamais rien — zéro coupure retirée
  // sur les 23 briefs, alors que le compte des coupures POSÉES, lui, était non nul.
  // Un nettoyage qui ne nettoie rien ne lève aucune erreur.
  const BLOCS = 'p|ul|ol|li|h2|h3|table|thead|tbody|tr|td|th|div|aside';
  const BR = '<br\\s*/?>';
  h = h.replace(new RegExp(`(</(?:${BLOCS})>)\\s*(?:${BR}\\s*)+`, 'gi'), '$1\n');
  h = h.replace(new RegExp(`(?:${BR}\\s*)+(<(?:${BLOCS})[ >])`, 'gi'), '\n$1');
  h = h.replace(new RegExp(`(?:${BR}\\s*)+(</(?:${BLOCS})>)`, 'gi'), '\n$1');
  h = h.replace(new RegExp(`(?:${BR}\\s*)+$`, 'gi'), '');
  h = h.replace(/<p>\s*<\/p>/g, '').replace(/<li>\s*<\/li>/g, '');
  h = h.replace(/[ \t]{2,}/g, ' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
  return h;
}

/** Tableau de niveaux : structure conservée, en-tête promu en <thead>. */
function tableauDonnees(tableau) {
  const lignes = [...tableau.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((m) => m[1]);
  const cellules = (ligne, balise) =>
    [...ligne.matchAll(/<t[dh]\b([^>]*)>([\s\S]*?)<\/t[dh]>/gi)]
      .map(([, attrs, contenu]) => {
        const colspan = /colspan="?(\d+)/i.exec(attrs);
        return `<${balise}${colspan ? ` colspan="${colspan[1]}"` : ''}>${contenu.trim()}</${balise}>`;
      })
      .join('');
  const [entete, ...corps] = lignes;
  return '<table class="arc-niveaux">'
    + `<thead><tr>${cellules(entete, 'th')}</tr></thead>`
    + `<tbody>${corps.map((l) => `<tr>${cellules(l, 'td')}</tr>`).join('')}</tbody>`
    + '</table>';
}

/**
 * Tableau de mise en page : chaque cellule à fond devient un BLOC CHIFFRÉ, les
 * autres rendent simplement leur contenu.
 *
 * ⚠️ Ces cellules ne sont PAS des encarts rédigés. Mesuré sur le brief du 02/09 :
 * 22 éléments à fond coloré, dont 2 seulement sont du texte rédigé (le mindset et
 * le mot de la communauté) ; les 20 autres sont des blocs de valeur et des
 * pastilles « IMPACT FORT ». Les traiter tous comme des encarts aurait produit
 * vingt boîtes à la suite, ce qui n'est ni la charte du site ni l'intention du
 * courriel. Le fond crème est un signal de VALEUR, pas de citation.
 */
function deplierCellules(tableau) {
  const interieur = tableau.replace(/<\/?(?:table|tbody|thead|tr|colgroup|col)\b[^>]*>/gi, '');
  return parcourir(interieur, /<t[dh]\b([^>]*)>/i, /<\/t[dh]>/i,
    (attrs) => (/background\s*:/i.test(attrs)
      ? ['<div class="arc-bloc">', '</div>']
      : ['', '<br />']));
}

/**
 * Déplie les <div>, en promouvant en encart ceux qui portent un fond.
 *
 * Les <div> de mise en page rendent leur contenu suivi d'une ESPACE, et non rien :
 * dans le gabarit des blocs chiffrés, le libellé et la valeur sont deux <div>
 * frères, et les supprimer sans séparateur collait « CLÔTURE 02/09 » à
 * « 7 712,25 ». Les blocs déjà produits par le dépliage des cellules sont laissés
 * intacts, sans quoi ce second passage les effacerait.
 */
function deplierDivs(html) {
  return parcourir(html, /<div\b([^>]*)>/i, /<\/div>/i, (attrs) => {
    if (/class="arc-/.test(attrs)) return ['<div class="arc-bloc">', '</div>'];
    if (/background\s*:/i.test(attrs)) return ['<aside class="arc-encart">', '</aside>'];
    return ['', '<br />'];
  });
}

/**
 * Parcours à pile : remplace chaque paire ouverture / fermeture par le couple que
 * rend `decider(attrs)`. Une fermeture orpheline est omise, une ouverture non
 * refermée est fermée en fin de document. C'est ce qui garantit qu'une fermeture
 * revient bien au bloc qui l'a ouverte.
 */
function parcourir(html, ouvrante, fermante, decider) {
  const jetons = new RegExp(`${ouvrante.source}|${fermante.source}`, 'gi');
  const sortie = [];
  const pile = [];
  let curseur = 0;
  for (let m; (m = jetons.exec(html)); ) {
    sortie.push(html.slice(curseur, m.index));
    curseur = m.index + m[0].length;
    if (m[0].startsWith('</')) {
      if (pile.length) sortie.push(pile.pop());
    } else {
      const [debut, fin] = decider(m[1] ?? '');
      sortie.push(debut);
      pile.push(fin);
    }
  }
  sortie.push(html.slice(curseur));
  while (pile.length) sortie.push(pile.pop());
  return sortie.join('');
}

/* ══════════════════════════════════════════════════════════════════════════════
   3. VÉRIFICATION — SUR LE DOCUMENT PRODUIT
   ══════════════════════════════════════════════════════════════════════════════
   ⚠️ Cette liste ne nettoie RIEN. Elle refuse d'écrire. C'est volontaire : un
   nettoyage de dernière minute masquerait le fait que le wrapper a changé, et on
   publierait des briefs de plus en plus dépendants d'un filtre qu'on ne relit pas.

   ⚠️ « Bonjour » seul n'est PAS interdit : deux briefs réels ouvrent sur « Bonjour
   et bon mercredi » et « Bonjour et bon vendredi », qui sont du texte rédigé. Un
   contrôle qui les rejetterait serait un contrôle qu'on finirait par désactiver.
   Ce qui est interdit, c'est l'ADRESSE à une personne : « Bonjour Prénom, ». */
const INTERDITS = [
  [/<!--/, 'commentaire HTML (bloc d\'audit interne ?)'],
  [/\bstyle=/i, 'style en ligne du courriel'],
  [/\bsib_[a-z_]+=/i, 'attribut Brevo (sib_…)'],
  [/\btemplating=/i, 'attribut Brevo (templating)'],
  [/sendibm|sendinblue|brevo\.net|\.brevo\.com/i, 'domaine de suivi Brevo'],
  [/utm_[a-z]+=/i, 'paramètre de campagne'],
  [/\{\{/, 'balise de fusion de personnalisation'],
  [/^Bonjour\s+[A-ZÀ-Ý][\p{L}'-]*\s*[,!]/mu, 'personnalisation « Bonjour Prénom »'],
  [/Bonjour\s+(?:Coach|Emmanuel)\b/i, 'personnalisation nominative'],
  [/d[ée]sinscri|unsubscribe/i, 'lien de désinscription'],
  [/[\w.+-]+@[\w-]+\.[a-z]{2,}/i, 'adresse e-mail'],
  [/AUDIT\s+QUALIT/i, 'bloc d\'audit interne'],
  [/<script|<iframe|on[a-z]+=/i, 'script ou gestionnaire d\'événement'],
];

export function verifier(corps) {
  const echecs = INTERDITS
    .filter(([motif]) => motif.test(corps))
    .map(([motif, libelle]) => `${libelle} — ${String(motif.exec(corps)).slice(0, 60)}`);
  // Contrôles positifs : un document vide passerait toutes les interdictions.
  const titres = (corps.match(/<h2>/g) || []).length;
  if (titres < 3) echecs.push(`seulement ${titres} titre(s) de section, 3 attendus au minimum`);
  const texte = corps.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (texte.length < 800) echecs.push(`corps trop court : ${texte.length} caractères de texte`);
  return echecs;
}

/* ══════════════════════════════════════════════════════════════════════════════
   4. PRODUCTION DU FICHIER
   ══════════════════════════════════════════════════════════════════════════════ */

/** Le chapeau du brief, réduit à une phrase, sert de description de page. */
function description(corps) {
  const premier = /<p>([\s\S]*?)<\/p>/i.exec(corps);
  const texte = (premier ? premier[1] : corps)
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  if (texte.length <= 155) return texte;
  const coupe = texte.slice(0, 155);
  return coupe.slice(0, Math.max(coupe.lastIndexOf(' '), 120)).trim() + '…';
}

export function archiver(html, dateIso, dossier) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) throw new Error(`date invalide : ${dateIso}`);

  const fragment = extraireBrief(html);
  if (!fragment) {
    return { ok: false, motif: 'wrapper « brief-marche » introuvable ou non refermé' };
  }

  let tableaux = 0;
  const corps = nettoyer(fragment, { onTableau: () => { tableaux += 1; } });

  const echecs = verifier(corps);
  if (echecs.length) return { ok: false, motif: echecs.join(' | ') };

  const dateLongue = formatDateLongFr(dateIso);
  const entete = [
    '---',
    `date: ${dateIso}`,
    `titre: "Brief marché du ${dateLongue}"`,
    `description: "${description(corps).replace(/"/g, '\\"')}"`,
    '---',
    '',
  ].join('\n');

  fs.mkdirSync(dossier, { recursive: true });
  const fichier = path.join(dossier, `${dateIso}.md`);
  fs.writeFileSync(fichier, entete + corps + '\n');
  return {
    ok: true, fichier, tableaux,
    titres: (corps.match(/<h2>/g) || []).length,
    encarts: (corps.match(/<aside class="arc-encart">/g) || []).length,
    schemas: (corps.match(/<img /g) || []).length,
    octets: Buffer.byteLength(corps, 'utf8'),
    titre: `Brief marché du ${capitaliser(dateLongue)}`,
  };
}

/* ══════════════════════════════════════════════════════════════════════════════
   5. LIGNE DE COMMANDE
   ══════════════════════════════════════════════════════════════════════════════ */
if (import.meta.url === `file://${process.argv[1]}`) {
  const [source, dateIso, dossier] = process.argv.slice(2);
  if (!source || !dateIso || !dossier) {
    console.error('usage : node outils/archiver-brief.mjs <source.html> <date-iso> <dossier>');
    process.exit(2);
  }
  const r = archiver(fs.readFileSync(source, 'utf8'), dateIso, dossier);
  if (!r.ok) {
    console.error(`::error::Archivage du brief du ${dateIso} refusé : ${r.motif}`);
    process.exit(1);
  }
  console.log(
    `Brief du ${dateIso} archivé : ${r.octets} octets, ${r.titres} sections, `
    + `${r.encarts} encart(s), ${r.tableaux} tableau(x) de niveaux, ${r.schemas} schéma(s).`,
  );
}
