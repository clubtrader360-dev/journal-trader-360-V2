/**
 * Transforme un brief en fichier d'archive publiable sur le site vitrine.
 *
 *   node outils/archiver-brief.mjs <source.html> <date-iso> <dossier-de-sortie>
 *
 * Écrit `<dossier>/<date-iso>.md` : en-tête de collection Astro, puis le courriel
 * TEL QU'IL EST PARTI — mise en page, couleurs, bandeau et typographie compris.
 *
 * ── ⛔ LE BRIEF N'EST PAS REMIS À LA CHARTE DU SITE ──────────────────────────
 * Une première version réduisait le courriel à sa sémantique et le réhabillait aux
 * couleurs du site, par crainte que le gabarit courriel soit illisible sur
 * téléphone. Cette crainte était infondée : le brief est déjà lu sur téléphone dans
 * Gmail, son gabarit tient. La consigne est désormais la fidélité.
 *
 * Ce qui reste à la charte du site, et qui n'est pas dans ce fichier : l'en-tête et
 * le pied de page du site, le bloc de date et d'avertissement AU-DESSUS du
 * courriel, et la page d'index. Ici, on ne touche pas à la présentation.
 *
 * ── UNE SEULE ROUTINE, DEUX APPELANTS ────────────────────────────────────────
 * Ce fichier sert à la fois au RATTRAPAGE des briefs déjà envoyés (récupérés depuis
 * les campagnes Brevo) et à l'ARCHIVAGE AUTOMATIQUE du brief du jour. Les deux
 * appellent le même code sur la même forme d'entrée.
 *
 * ⛔ NE PAS EN ÉCRIRE UNE SECONDE VERSION pour l'un des deux usages. Deux routines
 * de nettoyage finiraient par diverger, et rien ne le signalerait.
 *
 * ── POURQUOI UNE EXTRACTION, ET NON UN FILTRAGE ──────────────────────────────
 * ⚠️ C'est le choix de conception le plus important de ce fichier, et il ne change
 * pas avec le passage à la fidélité.
 *
 * Il faut retirer la personnalisation, les pixels de suivi, les liens de
 * désinscription, les identifiants de campagne et les adresses e-mail. Le premier
 * réflexe est un filtre par motif. Un filtre qui rate une occurrence ne lève AUCUNE
 * erreur : il rend un document qui a l'air propre.
 *
 * On fait donc l'inverse. On ne garde QUE le `<div>` d'enveloppe du courriel, celui
 * que produit `wrapBriefHtml()`. Tout ce que Brevo ajoute à l'envoi — pixel de
 * suivi, lien de désinscription, logo Mailin, `utm_campaign` — est déposé en FRÈRE
 * de ce div, directement sous `<body>`. Ce n'est pas enlevé : ce n'est jamais pris.
 *
 * Le filtrage existe quand même, mais en VÉRIFICATION FINALE, sur le document
 * produit, et il ne nettoie rien — il REFUSE D'ÉCRIRE.
 *
 * ── CE QUI EST RETIRÉ À L'INTÉRIEUR DE L'ENVELOPPE ──────────────────────────
 * Quatre choses, et rien d'autre :
 *
 *   · la LIGNE DE SALUTATION. « Bonjour {{ contact.PRENOM|default:"Trader" }}, »
 *     dans la source de campagne, « Bonjour Emmanuel, » dans le courriel reçu. Un
 *     brief archivé ne s'adresse à personne.
 *   · les COMMENTAIRES HTML. Quatre briefs (28, 29, 31/08 et 01/09) portent un bloc
 *     `<!-- AUDIT QUALITÉ V10.1 … -->` : les notes de sourcing internes. Personne ne
 *     les voyait dans un courriel ; sur une page publique elles seraient lisibles
 *     dans le code source.
 *   · les PARAMÈTRES DE CAMPAGNE des liens (`utm_*`), et les liens qui sortent des
 *     domaines maison.
 *   · les ATTRIBUTS BREVO résiduels (`sib_img_id`, `sib_link_id`, `templating`) et
 *     tout ce qui serait actif : `<script>`, `on*=`, `javascript:`.
 *
 * ⛔ LES STYLES EN LIGNE, EUX, SONT LE CONTENU. Ne pas les retirer.
 */
import fs from 'node:fs';
import path from 'node:path';
import { formatDateLongFr, capitaliser } from '../api/_lib/date-fr.js';

const HOTES_AUTORISES = ['journaltrader360.fr', 'trader360.fr'];

/* ══════════════════════════════════════════════════════════════════════════════
   1. EXTRACTION DE L'ENVELOPPE
   ══════════════════════════════════════════════════════════════════════════════
   Le premier <div> sous <body>, par comptage de profondeur. C'est l'enveloppe que
   pose `wrapBriefHtml()` : fond crème, rembourrage, pile de polices. Elle contient
   le bandeau, la carte à 600 px, le corps et le pied du courriel.

   Le comptage de profondeur n'est pas un luxe : l'enveloppe contient des dizaines
   de <div> imbriqués, et un `<div[\s\S]*?</div>` non glouton s'arrêterait au
   premier. Une expression gloutonne, elle, avalerait le bloc de désinscription que
   Brevo dépose plus bas.

   Contrôle de garde : l'enveloppe DOIT contenir `brief-marche`. Deux campagnes de
   juillet portent une date dans leur nom sans être des briefs ; elles sont écartées
   par ce contrôle, et non par une liste d'exclusion à tenir à jour. */
export function extraireCourriel(html) {
  const corps = /<body[^>]*>/i.exec(html);
  const depart = corps ? corps.index + corps[0].length : 0;
  const ouverture = /<div\b[^>]*>/i.exec(html.slice(depart));
  if (!ouverture) return null;
  const debut = depart + ouverture.index;
  let profondeur = 0;
  const balises = /<(\/?)div\b[^>]*>/gi;
  balises.lastIndex = debut;
  for (let m; (m = balises.exec(html)); ) {
    profondeur += m[1] ? -1 : 1;
    if (profondeur === 0) {
      const fragment = html.slice(debut, m.index + m[0].length);
      return /brief-marche/.test(fragment) ? fragment : null;
    }
  }
  return null; // enveloppe jamais refermée : document tronqué, on n'archive pas.
}

/* ══════════════════════════════════════════════════════════════════════════════
   2. CE QUI EST RETIRÉ
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * Retire la ligne de salutation.
 *
 * ⚠️ PAS PAR LA BALISE DE FUSION. Le réflexe est de chercher `{{`, présent dans la
 * source de campagne. Mais Brevo RÉSOUT cette balise à l'envoi : le courriel reçu
 * porte « Bonjour Emmanuel, » sans la moindre accolade. Une règle calée sur `{{`
 * nettoierait parfaitement la source de campagne et laisserait passer le prénom
 * dans le chemin d'archivage automatique, qui part du HTML réellement envoyé.
 * La sonde `verifier-archive-brief.mjs` éprouve exactement ce cas.
 *
 * La règle est donc STRUCTURELLE : un `<p>` dont le texte commence par « Bonjour »
 * et qui se trouve AVANT le corps du brief. Deux briefs réels ouvrent sur « Bonjour
 * et bon mercredi » — mais à l'intérieur du corps, donc après la borne.
 */
function retirerSalutation(html) {
  const borne = html.search(/class="brief-body"/i);
  const fin = borne < 0 ? html.length : borne;
  return html.slice(0, fin).replace(/<p\b[^>]*>\s*Bonjour\b[\s\S]{0,120}?<\/p>\s*/gi, '')
    + html.slice(fin);
}

export function nettoyer(fragment) {
  let h = fragment;

  // Commentaires HTML : le bloc d'audit interne part ici, et avec lui les
  // commentaires de gabarit qui expliquent le pourquoi du bandeau.
  h = h.replace(/<!--[\s\S]*?-->/g, '');

  h = retirerSalutation(h);

  // Tout ce qui serait actif. Défensif : rien de tel n'a jamais été observé dans un
  // brief, mais on s'apprête à publier du HTML brut sur un domaine public.
  h = h.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  h = h.replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  h = h.replace(/\s(?:sib_[a-z_]+|templating)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');

  // Liens : paramètres de campagne retirés, hôtes étrangers dépliés en texte.
  // Un lien de suivi publié serait un identifiant de campagne publié.
  h = h.replace(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi, (tout, attrs, texte) => {
    const href = /href\s*=\s*"([^"]*)"/i.exec(attrs);
    if (!href) return texte;
    // ⚠️ LES ENTITÉS SONT DÉCODÉES AVANT D'ANALYSER L'ADRESSE. Dans un attribut
    // HTML, les séparateurs de paramètres sont écrits `&amp;`. `new URL()` lit
    // alors le paramètre suivant comme s'il s'appelait « amp;utm_medium », qui ne
    // commence pas par `utm_` et survit donc au filtrage.
    // Le rattrapage n'a jamais rencontré le cas : Brevo déséchappe les `&` en
    // stockant la campagne. Le chemin automatique, lui, part de la sortie de
    // `wrapBriefHtml()`, qui les échappe. Deux sources, deux graphies, un filtre
    // qui ne mordait que sur l'une des deux.
    const adresse = href[1].replace(/&amp;/gi, '&').replace(/&#0*38;/g, '&');
    let url;
    try { url = new URL(adresse, 'https://journaltrader360.fr'); } catch { return texte; }
    if (!/^https?:$/.test(url.protocol)) return texte;           // javascript:, data:…
    if (!HOTES_AUTORISES.some((d) => url.hostname === d || url.hostname.endsWith(`.${d}`))) return texte;
    [...url.searchParams.keys()].filter((k) => /^utm_/i.test(k)).forEach((k) => url.searchParams.delete(k));
    // Réécrite échappée : c'est un attribut HTML, et une esperluette nue y est une
    // entité mal formée.
    const propre = url.toString().replace(/&/g, '&amp;');
    return `<a${attrs.replace(/href\s*=\s*"[^"]*"/i, `href="${propre}"`)}>${texte}</a>`;
  });

  // Images : les fichiers du courriel sont servis par le SITE, et non par
  // journaltrader360.fr dont le sort n'est pas tranché. Une image hébergée ailleurs
  // — le pixel de suivi en est une — ne passe pas.
  h = h.replace(/<img\b([^>]*)>/gi, (balise, attrs) => {
    const src = /src\s*=\s*"([^"]*)"/i.exec(attrs);
    if (!src) return '';
    const m = /^https?:\/\/(?:www\.)?journaltrader360\.fr\/assets\/(.+)$/i.exec(src[1].trim());
    if (!m) return '';
    return `<img${attrs.replace(/src\s*=\s*"[^"]*"/i, `src="/courriel/${m[1]}"`)}>`;
  });

  // ⚠️ AUCUNE LIGNE VIDE dans le fragment produit, et ce n'est pas de l'esthétique.
  // Le corps est inséré dans un fichier markdown. En CommonMark, un bloc HTML de
  // type 6 se TERMINE à la première ligne vide : tout ce qui suit repart en analyse
  // markdown, les lignes de texte se retrouvent enveloppées dans des <p> parasites
  // et une astérisque devient de l'italique. Le document resterait valide, la page
  // se construirait sans erreur, et la mise en page du courriel partirait de
  // travers à partir de la première respiration du HTML source.
  return h.replace(/[ \t]+\n/g, '\n').replace(/\n{2,}/g, '\n').trim();
}

/** Les fichiers du courriel à rapatrier, tels qu'ils sont référencés à la source. */
export function ressources(fragment) {
  return [...new Set(
    [...fragment.matchAll(/https?:\/\/(?:www\.)?journaltrader360\.fr\/assets\/([^"'\s>]+)/gi)]
      .map((m) => m[1]),
  )];
}

/* ══════════════════════════════════════════════════════════════════════════════
   3. VÉRIFICATION — SUR LE DOCUMENT PRODUIT
   ══════════════════════════════════════════════════════════════════════════════
   ⚠️ Cette liste ne nettoie RIEN. Elle refuse d'écrire. Un nettoyage de dernière
   minute masquerait le fait que l'enveloppe a changé, et on publierait des briefs
   de plus en plus dépendants d'un filtre qu'on ne relit pas.

   ⛔ `style=` N'EST PLUS INTERDIT. Il l'était quand le brief était remis à la charte
   du site ; il est maintenant le contenu, et c'est son ABSENCE qui devient une
   anomalie (contrôle positif plus bas). */
const INTERDITS = [
  [/<!--/, 'commentaire HTML (bloc d\'audit interne ?)'],
  [/\bsib_[a-z_]+\s*=/i, 'attribut Brevo (sib_…)'],
  [/\btemplating\s*=/i, 'attribut Brevo (templating)'],
  [/sendibm|sendinblue|brevo\.net|\.brevo\.com|mailin/i, 'domaine ou logo de suivi Brevo'],
  [/utm_[a-z]+\s*=/i, 'paramètre de campagne'],
  [/\{\{|\}\}/, 'balise de fusion de personnalisation'],
  [/>\s*Bonjour\b[^<]{0,40}<\/p>/i, 'ligne de salutation'],
  [/d[ée]sinscri|unsubscribe/i, 'lien de désinscription'],
  [/[\w.+-]+@[\w-]+\.[a-z]{2,}/i, 'adresse e-mail'],
  [/AUDIT\s+QUALIT/i, 'bloc d\'audit interne'],
  [/<script|<iframe|<form\b|\son[a-z]+\s*=|javascript:/i, 'élément ou gestionnaire actif'],
  [/https?:\/\/(?!(?:www\.)?(?:journaltrader360|trader360)\.fr)/i, 'adresse hors des domaines maison'],
];

export function verifier(corps) {
  const echecs = INTERDITS
    .filter(([motif]) => motif.test(corps))
    .map(([motif, libelle]) => `${libelle} — ${String(motif.exec(corps)).slice(0, 60)}`);

  // Contrôles positifs : un document vide passerait toutes les interdictions.
  if (!/brief-marche/.test(corps)) echecs.push('le corps du brief a disparu du document');
  const titres = (corps.match(/<h2\b/gi) || []).length;
  if (titres < 3) echecs.push(`seulement ${titres} titre(s) de section, 3 attendus au minimum`);
  const texte = corps.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (texte.length < 800) echecs.push(`corps trop court : ${texte.length} caractères de texte`);
  // La mise en page du courriel EST le livrable : son absence est une anomalie.
  const styles = (corps.match(/\bstyle\s*=/gi) || []).length;
  if (styles < 30) echecs.push(`seulement ${styles} style(s) en ligne — la mise en page du courriel a été perdue`);
  return echecs;
}

/* ══════════════════════════════════════════════════════════════════════════════
   4. PRODUCTION DU FICHIER
   ══════════════════════════════════════════════════════════════════════════════ */

/** Le chapeau du brief, réduit à une phrase, sert de description de page. */
function description(corps) {
  const dansLeCorps = corps.slice(Math.max(0, corps.search(/brief-marche/)));
  const premier = /<p\b[^>]*>([\s\S]*?)<\/p>/i.exec(dansLeCorps);
  const texte = (premier ? premier[1] : dansLeCorps)
    .replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  if (texte.length <= 155) return texte;
  const coupe = texte.slice(0, 155);
  return `${coupe.slice(0, Math.max(coupe.lastIndexOf(' '), 120)).trim()}…`;
}

export function archiver(html, dateIso, dossier) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) throw new Error(`date invalide : ${dateIso}`);

  const fragment = extraireCourriel(html);
  if (!fragment) {
    return { ok: false, motif: 'enveloppe du courriel introuvable, non refermée, ou sans corps « brief-marche »' };
  }

  const corps = nettoyer(fragment);
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
  fs.writeFileSync(fichier, `${entete + corps}\n`);
  return {
    ok: true,
    fichier,
    octets: Buffer.byteLength(corps, 'utf8'),
    styles: (corps.match(/\bstyle\s*=/gi) || []).length,
    titres: (corps.match(/<h2\b/gi) || []).length,
    images: (corps.match(/<img\b/gi) || []).length,
    liens: (corps.match(/<a\b/gi) || []).length,
    ressources: ressources(fragment),
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
    `Brief du ${dateIso} archivé : ${r.octets} octets, ${r.styles} styles en ligne, `
    + `${r.titres} sections, ${r.images} image(s), ${r.liens} lien(s).`,
  );
  // Les fichiers du courriel à rapatrier sont annoncés sur stdout, un par ligne :
  // l'étape du workflow les lit pour les déposer à côté du brief.
  r.ressources.forEach((x) => console.log(`RESSOURCE ${x}`));
}
