/**
 * Dérivés de la marque, à partir des DEUX SEULS fichiers source.
 *
 * `t360-logo.svg` et `t360-monogramme.svg` sont des copies OCTET POUR OCTET des
 * fichiers du dépôt du site (`src/marque/`). Ils ne sont jamais édités ici : remplacer
 * le logo, c'est remplacer ces deux fichiers et relancer ce script.
 *
 *   node assets/marque/generer.mjs
 *
 * ── POURQUOI DES DÉRIVÉS, ET PAS LES SOURCES DIRECTEMENT ────────────────────────
 *
 * Les deux sources portent `fill="currentColor"` : leur couleur vient du CSS. C'est
 * ce qui permet à la marque de suivre le thème clair ou sombre, et c'est comme ça
 * qu'elles sont utilisées sur le web du journal — en MASQUE CSS, où seule la forme
 * compte et où la couleur est celle du texte environnant.
 *
 * Posées dans une balise `<img>`, en revanche, elles sont rendues dans un document
 * isolé : `currentColor` retombe alors sur le NOIR. Vérifié, pas supposé — les deux
 * fichiers ont été affichés en `<img>` sur le fond marine du journal et le logo y est
 * noir sur marine, donc invisible. Deux contextes ne peuvent pas utiliser un masque :
 *
 *   1. LE COURRIEL. Un client de messagerie n'applique ni masque CSS ni SVG : Gmail,
 *      Outlook et Yahoo ignorent ou bloquent les SVG. Il faut un PNG, et sa couleur
 *      doit donc être cuite dedans.
 *   2. LE CANVAS DE PARTAGE. `drawImage` d'un SVG sans largeur ni hauteur intrinsèques
 *      est rendu à une taille par défaut selon le navigateur, quand il n'échoue pas.
 *      Un PNG n'a pas ce problème.
 *
 * Les PNG sont donc produits EN OR, la couleur de la marque sur fond marine, qui est
 * le fond du courriel comme celui de l'image de partage.
 *
 * ── POURQUOI UN MODULE JS POUR LE COURRIEL ──────────────────────────────────────
 *
 * `api/cron/_lib/marque.js` embarque le SVG source sous forme de chaîne. La fonction
 * qui envoie le rapport tourne sur Vercel, où seuls les fichiers déclarés dans
 * `includeFiles` accompagnent le code : lire `assets/marque/t360-logo.svg` à
 * l'exécution demanderait d'étendre cette déclaration, et un oubli ne se verrait qu'à
 * l'envoi réel du lundi. Une chaîne embarquée ne peut pas manquer à l'appel.
 */
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '../..');

/** L'or de la marque. Jeton `--trader-gold` du design system, recopié une seule fois. */
const OR = '#d4af37';

const SOURCES = {
  logo: path.join(ICI, 't360-logo.svg'),
  monogramme: path.join(ICI, 't360-monogramme.svg'),
};

/** Cuit la couleur dans une copie du SVG. La source n'est jamais touchée. */
function enOr(chemin) {
  return fs.readFileSync(chemin, 'utf8').replaceAll('currentColor', OR);
}

/** Rend un SVG en PNG à la largeur demandée, fond transparent. */
function png(svg, largeur) {
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: largeur },
    background: 'rgba(0,0,0,0)',
  }).render().asPng();
}

const sorties = [];

// Verrou doré. Sert au courriel (affiché 200 px) et au canvas de partage (dessiné
// 400 px) : 800 px de large couvre les deux au double de la densité d'affichage.
{
  const buf = png(enOr(SOURCES.logo), 800);
  const cible = path.join(ICI, 't360-logo-or.png');
  fs.writeFileSync(cible, buf);
  sorties.push([cible, buf.length]);
}

// Monogramme doré, pour la favicon. Presque carré (459 x 446), ce que les navigateurs
// mettent à l'échelle sans qu'on le voie à seize pixels.
{
  const buf = png(enOr(SOURCES.monogramme), 192);
  const cible = path.join(ICI, 't360-monogramme-or.png');
  fs.writeFileSync(cible, buf);
  sorties.push([cible, buf.length]);
}

// Module embarqué pour le rapport hebdomadaire.
{
  const svg = fs.readFileSync(SOURCES.logo, 'utf8').trim();
  const contenu = `// ⚠️ FICHIER GÉNÉRÉ — ne pas éditer à la main.
// Produit par \`node assets/marque/generer.mjs\` à partir de assets/marque/t360-logo.svg.
// Pour changer le logo : remplacer le SVG source et relancer le script.
//
// Le SVG est embarqué ici plutôt que lu sur le disque parce que la fonction d'envoi
// tourne sur Vercel, où seuls les fichiers déclarés dans \`includeFiles\` accompagnent
// le code. Un oubli de déclaration ne se verrait qu'à l'envoi réel du lundi matin.

/** L'or de la marque, jeton \`--trader-gold\`. */
export const OR_MARQUE = '${OR}';

/** Le verrou complet — hexagone et logotype — tel quel, couleur pilotée par le CSS. */
export const VERROU_SVG = ${JSON.stringify(svg)};

/** Le même, couleur cuite en or : c'est la forme utilisable hors navigateur. */
export const VERROU_SVG_OR = VERROU_SVG.replaceAll('currentColor', OR_MARQUE);
`;
  const cible = path.join(RACINE, 'api/cron/_lib/marque.js');
  fs.writeFileSync(cible, contenu);
  sorties.push([cible, contenu.length]);
}

console.log('\n  Dérivés régénérés :');
for (const [c, t] of sorties) {
  console.log(`    ${path.relative(RACINE, c).padEnd(40)} ${(t / 1024).toFixed(1)} Kio`);
}
console.log('');
