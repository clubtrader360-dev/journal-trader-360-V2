/**
 * Extrait la rubrique « culture de marché » d'un brief et en fait un fichier d'archive.
 *
 *   node outils/archiver-culture.mjs <brief.html> <dossier-de-sortie>
 *
 * ── POURQUOI CETTE ÉTAPE EXISTE ───────────────────────────────────────────────
 * Le texte de la rubrique est rédigé au moment de l'envoi, à partir d'un angle d'une
 * ligne. Il ne vivait nulle part ensuite : l'artefact `brief-html` du run est purgé au
 * bout de QUATORZE JOURS, et la seule copie durable était une boîte mail. Une notion
 * tombe chaque jour ouvré ; sans cette étape, la prose des vingt notions se perdait au
 * fil de l'eau et il aurait fallu la réécrire pour les articles du site.
 *
 * Ce n'est pas un sauvetage ponctuel : c'est le sauvetage rendu inutile.
 *
 * ── COMMENT LA SECTION EST DÉLIMITÉE ──────────────────────────────────────────
 * Par deux bornes de texte, pas par une structure HTML. Le gabarit du brief change au
 * fil des chantiers — tableaux, encarts, images — et un sélecteur calé sur une balise
 * casserait à la première retouche, en silence. Les deux bornes, elles, sont écrites
 * dans le prompt système :
 *   début : le libellé « Culture de marché »
 *   fin   : la phrase de clôture, toujours la même
 * Si l'une des deux manque, on n'écrit RIEN et on le dit. Un fichier d'archive à moitié
 * juste est pire qu'un fichier absent : personne ne le relit.
 */
import fs from 'node:fs';
import path from 'node:path';

const FIN = "Culture de marché, pour comprendre ce qu'on croise ailleurs";

const [fichier, sortie] = process.argv.slice(2);
if (!fichier || !sortie) {
  console.error('usage : node outils/archiver-culture.mjs <brief.html> <dossier>');
  process.exit(2);
}

const html = fs.readFileSync(fichier, 'utf8');

// Le schéma nomme la notion sans ambiguïté : c'est le seul endroit du brief où le slug
// apparaît tel quel. Le titre affiché, lui, est libre et varie d'un jour à l'autre.
const m = /assets\/culture\/([a-z0-9-]+)\.png/.exec(html);
if (!m) {
  console.log('Aucun schéma de culture dans ce brief : rubrique sautée ce jour-là, rien à archiver.');
  process.exit(0);
}
const slug = m[1];

// ⚠️ PAS DE `decodeURIComponent` ICI. La première version en passait par là, et elle
// échouait sur TOUS les briefs : un brief est plein de pourcentages, et « +0,86% à »
// forme une séquence d'échappement invalide qui fait lever la fonction. Ce qu'on veut
// décoder, ce sont des entités HTML, pas des échappements d'adresse. Les deux n'ont
// rien à voir, et l'erreur ne s'est vue que parce que la sonde tournait sur de vrais
// fichiers plutôt que sur un exemple fabriqué.
const texte = html
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
 .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&rsquo;/g, "'")
 .replace(/&laquo;/g, '«').replace(/&raquo;/g, '»').replace(/&eacute;/g, 'é')
 .replace(/\s+/g, ' ').trim();

const i = texte.indexOf('Culture de marché');
const j = texte.indexOf(FIN, i + 10);
if (i < 0 || j < 0) {
  console.error(`::error::Rubrique culture introuvable pour « ${slug} » : borne de ${i < 0 ? 'début' : 'fin'} absente. Rien n'est archivé.`);
  process.exit(1);
}

let corps = texte.slice(i, j).replace(/^(Culture de marché\s*)+/, '').trim();
// Le titre affiché précède le texte. On le retire en coupant à la première phrase qui
// commence par un déterminant ou un nom propre, ce qui est toujours le début du corps.
const coupe = /^(.{0,80}?)\s(?=(?:Le |La |Les |L'|Un |Une |Il |Elle |Ce |Cette |Sur |Dans |En |Quand |Lorsqu))/.exec(corps);
if (coupe) corps = corps.slice(coupe[1].length).trim();

// Une phrase par ligne : les révisions d'une version à l'autre se lisent alors ligne à
// ligne plutôt qu'en un seul pâté illisible.
const phrases = corps.split(/(?<=[.!?])\s+(?=[A-ZÀ-Ý«])/).map((p) => p.trim()).filter(Boolean);
if (phrases.length < 2 || corps.length < 120) {
  console.error(`::error::Texte de culture suspect pour « ${slug} » : ${corps.length} caractères, ${phrases.length} phrase(s). Rien n'est archivé.`);
  process.exit(1);
}

const jour = new Date().toISOString().slice(0, 10);
fs.mkdirSync(sortie, { recursive: true });
fs.writeFileSync(path.join(sortie, `${slug}.md`),
`---
slug: ${slug}
publie_le: ${jour}
source: brief quotidien, archive automatique
schema: assets/culture/${slug}.png
---

${phrases.join('\n')}
`);
console.log(`Notion « ${slug} » archivée : ${corps.length} caractères, ${phrases.length} phrases.`);
