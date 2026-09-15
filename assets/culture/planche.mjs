/**
 * Planche à TAILLE RÉELLE des schémas de culture.
 *
 * Deux largeurs par schéma, côte à côte, sur le fond réel de la carte du brief :
 *   - 600 px, la largeur de la carte sur ordinateur ;
 *   - 279 px, la largeur de contenu réelle sur un téléphone de 375 px
 *     (carte 600 mise à l'échelle par le client mail, rembourrage 32 px de chaque côté).
 *
 * Rendu à 1:1 — aucun `fitTo`. Une planche agrandie ne dit rien de la lisibilité
 * d'un schéma qui sera vu à 279 px de large.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { Resvg } from '@resvg/resvg-js';

const FOND = '#fdf8ed';
const ENCRE = '#5a5040';
const POLICES = ['api/cron/_lib/fonts/Inter-Regular.ttf', 'api/cron/_lib/fonts/JetBrainsMono-Regular.ttf'];

const slugs = process.argv.slice(3);
const sortie = process.argv[2];
const L1 = 600, H1 = 300, L2 = 279, H2 = Math.round(300 * 279 / 600);
const MARGE = 24, ECART = 32, TITRE = 26, INTER = 30;
const largeur = MARGE + L1 + ECART + L2 + MARGE;
const hauteurLigne = TITRE + H1 + INTER;
const hauteur = MARGE + hauteurLigne * slugs.length;

let corps = '';
slugs.forEach((slug, i) => {
  const y = MARGE + i * hauteurLigne;
  const b64 = readFileSync(`assets/culture/${slug}.png`).toString('base64');
  const href = `data:image/png;base64,${b64}`;
  corps +=
    `<text x="${MARGE}" y="${y + 16}" font-family="JetBrains Mono" font-size="14" fill="${ENCRE}">${slug}</text>` +
    `<text x="${MARGE + L1 + ECART}" y="${y + 16}" font-family="JetBrains Mono" font-size="12" fill="${ENCRE}" opacity="0.7">279 px, téléphone</text>` +
    `<image x="${MARGE}" y="${y + TITRE}" width="${L1}" height="${H1}" href="${href}"/>` +
    `<image x="${MARGE + L1 + ECART}" y="${y + TITRE}" width="${L2}" height="${H2}" href="${href}"/>`;
});

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${largeur}" height="${hauteur}" viewBox="0 0 ${largeur} ${hauteur}">` +
  `<rect width="${largeur}" height="${hauteur}" fill="${FOND}"/>${corps}</svg>`;

writeFileSync(sortie, new Resvg(svg, { font: { fontFiles: POLICES, loadSystemFonts: false, defaultFontFamily: 'Inter' } }).render().asPng());
console.log(`${sortie} — ${largeur}×${hauteur}, ${slugs.length} schémas à 1:1`);
