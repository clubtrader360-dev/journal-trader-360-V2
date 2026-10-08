/**
 * Les icônes du journal, produites depuis UNE SEULE source.
 *
 *   node outils/icones.mjs
 *
 * ── POURQUOI UN GÉNÉRATEUR, ET PAS QUATRE FICHIERS DESSINÉS À LA MAIN ───────────
 *
 * Quatre fichiers posés un par un se désaccordent de la marque à la première
 * retouche du logo : on remplace celui qu'on a sous les yeux, et les trois autres
 * restent sur l'ancien tracé. ⛔ RIEN NE LE SIGNALE. Les navigateurs affichent
 * chacun une taille différente selon le contexte, l'onglet garde la nouvelle et
 * l'écran d'accueil l'ancienne, sans la moindre erreur.
 *
 * Toutes les sorties descendent donc de `assets/marque/t360-monogramme.svg`.
 * Changer la marque, c'est remplacer ce SVG et relancer ce script.
 *
 * ── CE QUI DIFFÈRE DU GÉNÉRATEUR DU SITE, ET POURQUOI ───────────────────────────
 *
 * Le dépôt du site fabrique les mêmes fichiers dans `outils/icones.mjs`, avec les
 * MÊMES constantes : fond #050506, marge 10 %, tailles 16/32/48 pour l'ICO,
 * 180 et 192 en PNG. L'assemblage de l'ICO et sa relecture sont reprises ligne
 * pour ligne : c'est la même méthode, volontairement.
 *
 * Un seul point change, et il est imposé par l'outillage : le site rastérise avec
 * `sharp`, qui n'est pas une dépendance de ce dépôt. Ici c'est `@resvg/resvg-js`,
 * déjà utilisé par `assets/marque/generer.mjs`. ⛔ On n'ajoute pas une dépendance
 * de rendu pour la seule raison qu'un autre dépôt en utilise une autre.
 *
 * La conséquence est géométrique, pas esthétique. `sharp` compose : il rend la
 * marque sur un calque transparent, puis la colle au centre d'un carré opaque.
 * `resvg` ne compose pas, alors le carré, le fond et la marge sont décrits dans un
 * SVG enveloppe que l'on rend d'un seul coup. Le résultat est le même cadrage :
 * un `<svg>` imbriqué avec `preserveAspectRatio` par défaut (`xMidYMid meet`) EST
 * le `fit: 'contain'` + `gravity: 'center'` de sharp, à ceci près qu'il est exact
 * au lieu d'être arrondi au pixel avant collage.
 *
 * ── POURQUOI LE SVG SOURCE N'EST PAS TOUCHÉ ────────────────────────────────────
 *
 * Il porte `fill="currentColor"` : sa couleur vient du CSS, et c'est ce qui lui
 * permet de suivre le thème là où il est posé en masque dans les pages. L'or est
 * donc CUIT dans une copie en mémoire, exactement comme le fait `enOr()` dans
 * `assets/marque/generer.mjs`. La source reste transparente et en `currentColor`.
 */
import { Resvg } from '@resvg/resvg-js';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RACINE = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = path.join(RACINE, 'assets/marque/t360-monogramme.svg');

/** L'or de la marque, jeton `--trader-gold`. Même valeur que `generer.mjs`. */
const OR = '#d4af37';

/**
 * Fond des icônes. Opaque, décidé par Nadir.
 *
 * ⚠️ IL N'EST PAS DÉCORATIF. La marque est en or sur un tracé fin : posée sans
 * fond, elle est rendue sur le fond de l'onglet, blanc dans un thème clair, et
 * l'or sur blanc tombe sous le seuil de lisibilité. Le fond noir rend le contraste
 * indépendant du thème du navigateur.
 */
const FOND = '#050506';

/**
 * Marge intérieure, en proportion du côté.
 *
 * ⚠️ ELLE N'EST PAS DÉCORATIVE. Sans elle, le tracé touche le bord, et les masques
 * arrondis d'iOS comme d'Android en rognent les pointes. Dix pour cent laissent la
 * marque entière sous le masque le plus agressif.
 */
const MARGE = 0.10;

/**
 * La marque, en or, cadrée dans un carré de côté `cote` sur le fond opaque.
 *
 * Rend un SVG, pas une image : c'est ce document qui sert à la fois de sortie
 * vectorielle (`favicon.svg`) et d'entrée du rastériseur. Les deux ne peuvent donc
 * pas montrer un cadrage différent.
 */
function enveloppe(cote) {
  const marque = readFileSync(SOURCE, 'utf8')
    .replaceAll('currentColor', OR)
    // Le `<svg>` imbriqué est placé par x/y/width/height. Une largeur ou une
    // hauteur héritée de la source entrerait en conflit avec ce placement.
    .replace(/<svg\b[^>]*>/, (racine) =>
      racine
        .replace(/\s(?:width|height|x|y)="[^"]*"/g, '')
        .replace(/<svg/, `<svg x="${MARGE * cote}" y="${MARGE * cote}"`
          + ` width="${cote * (1 - 2 * MARGE)}" height="${cote * (1 - 2 * MARGE)}"`));

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${cote}" height="${cote}"`
    + ` viewBox="0 0 ${cote} ${cote}" role="img" aria-label="Trader 360">\n`
    + `<rect width="${cote}" height="${cote}" fill="${FOND}"/>\n`
    + `${marque.trim()}\n</svg>\n`;
}

/** Rend l'enveloppe en PNG, à la taille demandée. */
function icone(cote) {
  return new Resvg(enveloppe(cote), { fitTo: { mode: 'width', value: cote } }).render();
}

/**
 * Assemble un ICO à partir de PNG déjà rendus.
 * ⚠️ Un côté de 256 s'écrit `0` dans l'entrée, par convention du format. Les tailles
 * utilisées ici restent sous 256, mais la règle est appliquée pour ne pas se faire
 * surprendre si quelqu'un ajoute 256 un jour.
 */
function assemblerIco(images) {
  const entete = Buffer.alloc(6);
  entete.writeUInt16LE(0, 0);              // réservé
  entete.writeUInt16LE(1, 2);              // type 1 = icône
  entete.writeUInt16LE(images.length, 4);  // nombre d'images
  let offset = 6 + 16 * images.length;
  const entrees = [];
  for (const { cote, png } of images) {
    const e = Buffer.alloc(16);
    e.writeUInt8(cote >= 256 ? 0 : cote, 0);   // largeur
    e.writeUInt8(cote >= 256 ? 0 : cote, 1);   // hauteur
    e.writeUInt8(0, 2);                        // palette : aucune
    e.writeUInt8(0, 3);                        // réservé
    e.writeUInt16LE(1, 4);                     // plans
    e.writeUInt16LE(32, 6);                    // bits par pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    entrees.push(e);
    offset += png.length;
  }
  return Buffer.concat([entete, ...entrees, ...images.map((i) => i.png)]);
}

/** Lit largeur, hauteur et type de couleur DANS le fichier, dans son IHDR. */
function ihdr(buf) {
  return {
    signature: buf.subarray(0, 8).toString('hex') === '89504e470d0a1a0a',
    largeur: buf.readUInt32BE(16),
    hauteur: buf.readUInt32BE(20),
    bits: buf.readUInt8(24),
    type: buf.readUInt8(25),
  };
}

const TYPES = { 0: 'gris', 2: 'RVB', 3: 'palette', 4: 'gris+alpha', 6: 'RVB+alpha' };

let fautes = 0;
const dire = (nom, ok, detail) => {
  if (!ok) fautes++;
  console.log(`     ${ok ? 'ok ' : '⛔ '} ${nom}${detail ? `  ${detail}` : ''}`);
};

console.log(`\n  source : ${path.relative(RACINE, SOURCE)}  ·  or ${OR}`
  + `  ·  fond ${FOND} opaque  ·  marge ${MARGE * 100} %\n`);

/* ── LE VECTEUR ──────────────────────────────────────────────────────────────
   Chrome et Firefox préfèrent un favicon SVG quand il est déclaré : il doit donc
   porter le fond noir lui aussi. ⚠️ Un SVG transparent ici annulerait tout le lot
   dans les deux navigateurs les plus utilisés, sans que l'ICO soit en cause et
   sans la moindre erreur. Le fond est décrit dans le même `enveloppe()` que celui
   des PNG, pour qu'un cadrage ne puisse pas diverger de l'autre.
   Côté 48 : la valeur ne contraint pas le rendu d'un vecteur, elle ne fixe que le
   rapport entre la marge et le côté, qui est le même à toutes les tailles. */
{
  const cible = path.join(RACINE, 'favicon.svg');
  const svg = enveloppe(48);
  writeFileSync(cible, svg);
  console.log(`  ${'favicon.svg'.padEnd(22)} vectoriel, carré      `
    + `${(Buffer.byteLength(svg) / 1024).toFixed(1)} Ko   onglet Chrome et Firefox`);
}

/* ── LES PNG ─────────────────────────────────────────────────────────────────
   ⛔ Pas d'icon-512.png ni de manifeste : aucun des deux n'a de consommateur ici. */
const SORTIES = [
  { fichier: 'apple-touch-icon.png', cote: 180, pourquoi: 'écran d\'accueil iOS' },
  { fichier: 'icon-192.png', cote: 192, pourquoi: 'écran d\'accueil Android' },
];

for (const s of SORTIES) {
  const rendu = icone(s.cote);
  const png = rendu.asPng();
  writeFileSync(path.join(RACINE, s.fichier), png);
  const m = ihdr(readFileSync(path.join(RACINE, s.fichier)));
  // Le canal alpha de resvg est présent mais doit être entièrement opaque : un seul
  // pixel translucide laisserait le fond de l'onglet traverser le noir.
  let alphaMin = 255;
  for (let i = 3; i < rendu.pixels.length; i += 4) alphaMin = Math.min(alphaMin, rendu.pixels[i]);
  console.log(`  ${s.fichier.padEnd(22)} ${m.largeur}x${m.hauteur}  ${m.bits} bits `
    + `type ${m.type} (${TYPES[m.type]})  alpha min ${alphaMin}  `
    + `${(png.length / 1024).toFixed(1)} Ko   ${s.pourquoi}`);
  dire(`  ${s.fichier} : ${s.cote}x${s.cote} carré`, m.largeur === s.cote && m.hauteur === s.cote);
  dire(`  ${s.fichier} : opaque partout`, alphaMin === 255, `alpha min ${alphaMin}`);
}

/* ── L'ICO ───────────────────────────────────────────────────────────────────
   ⚠️ Aucune bibliothèque de ce dépôt ne sait écrire un ICO. Il est donc assemblé à
   la main, et RELU après écriture. Écrire des octets ne prouve pas qu'on a écrit un
   ICO : un conteneur mal formé serait indiscernable d'un bon, le navigateur
   n'afficherait simplement rien, sans la moindre erreur. */
const TAILLES = [16, 32, 48];
const images = TAILLES.map((cote) => ({ cote, png: icone(cote).asPng() }));
const ico = assemblerIco(images);
writeFileSync(path.join(RACINE, 'favicon.ico'), ico);
console.log(`  ${'favicon.ico'.padEnd(22)} ${TAILLES.join(', ')}              `
  + `${(ico.length / 1024).toFixed(1)} Ko   onglet, favoris, bureau`);

console.log('\n  ── relecture de favicon.ico ──');
const relu = readFileSync(path.join(RACINE, 'favicon.ico'));
dire('en-tête : réservé 0, type 1 (icône)', relu.readUInt16LE(0) === 0 && relu.readUInt16LE(2) === 1,
  `réservé ${relu.readUInt16LE(0)}, type ${relu.readUInt16LE(2)}`);
dire(`${TAILLES.length} images déclarées`, relu.readUInt16LE(4) === TAILLES.length, String(relu.readUInt16LE(4)));
for (let i = 0; i < TAILLES.length; i++) {
  const e = 6 + 16 * i;
  const cote = relu.readUInt8(e) || 256;
  const haut = relu.readUInt8(e + 1) || 256;
  const taille = relu.readUInt32LE(e + 8);
  const pos = relu.readUInt32LE(e + 12);
  const signature = relu.subarray(pos, pos + 8).toString('hex');
  dire(`entrée ${i + 1} : ${cote}x${haut}, ${taille} o à l'offset ${pos}, signature PNG`,
    cote === TAILLES[i] && haut === TAILLES[i] && signature === '89504e470d0a1a0a'
      && pos + taille <= relu.length,
    signature);
}
dire('⛔ aucun octet orphelin après la dernière image',
  relu.length === 6 + 16 * TAILLES.length + images.reduce((t, i) => t + i.png.length, 0),
  `${relu.length} o`);

console.log(fautes === 0
  ? '\n  Les quatre fichiers descendent de la même source, sont carrés, opaques,\n'
    + '  et l\'ICO relu déclare trois images qui tombent chacune sur un PNG.'
  : `\n  ⛔ ${fautes} écart(s).`);
process.exit(fautes === 0 ? 0 : 1);
