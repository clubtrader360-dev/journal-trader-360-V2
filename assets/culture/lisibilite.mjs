/**
 * Ce qui reste d'un schéma à 279 px.
 *
 *   node assets/culture/lisibilite.mjs
 *
 * 279 px est la largeur de contenu RÉELLE de l'encart sur un téléphone de 375 px, une
 * fois retirés les rembourrages du courriel. C'est là que la moitié des destinataires
 * lisent le brief, et c'est la seule taille à laquelle un schéma peut échouer sans
 * qu'on s'en aperçoive : tout tient toujours à 600 px.
 *
 * DEUX MESURES, et rien de décoratif :
 *
 *  1. LE TAUX D'ENCRE — la part des pixels franchement différents du fond, une fois le
 *     schéma ramené à 279 px. C'est un chiffre de DENSITÉ, comparable d'un schéma à
 *     l'autre. Le volume à douze barres et le MACD à treize sont la limite haute posée
 *     par Trader 360 : tout schéma qui les dépasse est trop chargé, quelle que soit
 *     l'impression qu'il donne en grand.
 *
 *     Le seuil de 60 sur la distance à la couleur du fond n'est pas arbitraire : il
 *     laisse passer le prix (#5a5040) et l'accent (#ac862b), et ÉCARTE la grille et les
 *     bandes teintées, qui sont des surfaces et non de la matière à lire. Compter la
 *     bande d'un range comme de l'encre aurait fait du schéma le plus vide de la série
 *     le plus dense.
 *
 *  2. LA DIVERGENCE, mesurée à part. C'est la seule notion des vingt qui ne vit dans
 *     aucun de ses deux panneaux mais dans la COMPARAISON entre eux : un sommet plus
 *     haut sur le prix, un sommet plus bas sur l'oscillateur, au même instant. Si cet
 *     écart ne survit pas à la réduction, le schéma ne montre plus ce qu'il annonce et
 *     la notion doit sortir de la liste — pas être tassée.
 *
 *     La sonde relève, dans le rendu à 279 px et non dans le tracé d'origine, le haut
 *     de l'encre au-dessus de chacun des deux sommets, dans chacun des deux panneaux.
 *     Elle échouerait donc si la réduction avait fondu les deux sommets en un seul
 *     niveau — ce qui est exactement le risque qu'elle est là pour écarter.
 */
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const LARGEUR = 279;
const ECHELLE = LARGEUR / 600;
const FOND = [253, 248, 237];
const SEUIL = 60;

/** Le PNG ramené à 279 px de large, en pixels bruts. */
function rendu(slug) {
  const b64 = fs.readFileSync(path.join(ICI, `${slug}.png`)).toString('base64');
  const h = Math.round(300 * ECHELLE);
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${LARGEUR}" height="${h}" viewBox="0 0 ${LARGEUR} ${h}">` +
    `<image x="0" y="0" width="${LARGEUR}" height="${h}" href="data:image/png;base64,${b64}"/></svg>`;
  const img = new Resvg(svg).render();
  return { px: img.pixels, l: img.width, h: img.height };
}

const encre = (px, i) => {
  const d = Math.hypot(px[i] - FOND[0], px[i + 1] - FOND[1], px[i + 2] - FOND[2]);
  return d > SEUIL;
};

// ── 1. Densité ────────────────────────────────────────────────────────────────────
const mesures = [];
for (const f of fs.readdirSync(ICI).filter((n) => n.endsWith('.png')).sort()) {
  const slug = f.replace('.png', '');
  const { px, l, h } = rendu(slug);
  let n = 0;
  for (let i = 0; i < px.length; i += 4) if (encre(px, i)) n++;
  mesures.push([slug, (100 * n) / (l * h)]);
}
mesures.sort((a, b) => b[1] - a[1]);

const plafond = Math.max(
  mesures.find(([s]) => s === 'volume')?.[1] ?? 0,
  mesures.find(([s]) => s === 'macd')?.[1] ?? 0,
);

console.log(`\n  Taux d'encre à ${LARGEUR} px — plafond de série : ${plafond.toFixed(2)} %`);
console.log('  (le plus dense du volume à douze barres et du MACD à treize)\n');
for (const [slug, taux] of mesures) {
  const verdict = taux > plafond ? `AU-DESSUS DU PLAFOND (+${(taux - plafond).toFixed(2)})` : '';
  console.log(`    ${slug.padEnd(22)} ${taux.toFixed(2).padStart(5)} %  ${verdict}`);
}

// ── 2. La divergence ──────────────────────────────────────────────────────────────
// Le haut de l'encre au-dessus d'un sommet, relevé sur trois colonnes pour ne pas
// dépendre d'un pixel isolé de l'anticrénelage.
function hautEncre(px, l, x, yMin, yMax) {
  for (let y = yMin; y <= yMax; y++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (encre(px, 4 * (y * l + x + dx))) return y;
    }
  }
  return null;
}

const { px, l } = rendu('divergence');
const X1 = Math.round(176 * ECHELLE);
const X2 = Math.round(392 * ECHELLE);
const PANNEAUX = [
  ['prix        (sommet plus HAUT attendu)', Math.round(24 * ECHELLE), Math.round(154 * ECHELLE), -1],
  ['oscillateur (sommet plus BAS attendu) ', Math.round(180 * ECHELLE), Math.round(278 * ECHELLE), +1],
];

console.log(`\n  Divergence à ${LARGEUR} px — colonnes des deux sommets : x=${X1} et x=${X2}\n`);
let tenue = true;
for (const [nom, yMin, yMax, sens] of PANNEAUX) {
  const a = hautEncre(px, l, X1, yMin, yMax);
  const b = hautEncre(px, l, X2, yMin, yMax);
  if (a === null || b === null) { console.log(`    ${nom} : aucune encre relevée`); tenue = false; continue; }
  // `sens` vaut -1 quand le second sommet doit être plus haut sur l'écran, donc à un y
  // plus petit. L'écart est compté positif quand il va dans le sens attendu.
  const ecart = sens * (b - a);
  if (ecart < 6) tenue = false;
  console.log(
    `    ${nom} : ${String(a).padStart(3)} → ${String(b).padStart(3)} px  ` +
    `écart ${ecart >= 0 ? '+' : ''}${ecart} px  ${ecart < 6 ? '← TROP FAIBLE' : ''}`,
  );
}
console.log(`\n  ${tenue ? 'La divergence tient à cette taille.' : 'LA DIVERGENCE NE TIENT PAS — à retirer de la liste plutôt qu\'à tasser.'}\n`);
