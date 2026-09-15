/**
 * Les schémas de la rubrique « culture de marché ». UNE SÉRIE, pas des dessins.
 *
 *   node assets/culture/generer.mjs            → régénère les PNG
 *   PLANCHE=/chemin node assets/culture/...    → écrit en plus une planche contact
 *
 * ── POURQUOI DES PNG DESSINÉS À L'AVANCE ────────────────────────────────────────
 * Deux impasses, écartées avant d'écrire une ligne :
 *   - le SVG ne s'affiche pas dans la plupart des clients de messagerie ;
 *   - un schéma produit par le modèle à chaque run serait raté une fois sur trois, et
 *     personne ne le verrait avant les destinataires.
 *
 * ── POURQUOI UNE URL ET PAS UNE PIÈCE JOINTE `cid:` ─────────────────────────────
 * Le rapport hebdomadaire part par Resend, un message par élève : une pièce jointe
 * inline y est possible. LE BRIEF QUOTIDIEN PART EN CAMPAGNE BREVO — un seul HTML
 * envoyé à une liste — et une campagne n'a pas de mécanisme de pièce jointe inline.
 * Un `cid:` se serait affiché parfaitement sur le chemin de test, qui passe par
 * Resend, et se serait affiché cassé chez les soixante-seize destinataires réels.
 * Le schéma est donc servi par URL, exactement comme le bandeau du brief.
 *
 * ── LES HUIT RÈGLES DE SÉRIE, posées avant le premier tracé ─────────────────────
 *  1. Grille unique : `viewBox="0 0 600 300"`. Aire de dessin x 24→576, y 20→280.
 *     600 px est la largeur maximale d'affichage ; le PNG est rendu au double.
 *  2. Deux panneaux quand la notion l'exige : le PRIX en haut (y 20→152), l'indicateur
 *     en bas (y 176→280), 24 px entre les deux. Une notion à un seul panneau occupe
 *     toute la hauteur. Le prix est toujours en haut : c'est ce qu'on lit d'abord.
 *  3. Deux épaisseurs, pas trois : 2,6 pour le prix et les tracés principaux, 1 à 1,4
 *     pour la grille, les axes et les seuils. Ces valeurs viennent d'une mesure : à
 *     2 et 1, le schéma tenait à 600 px et s'effaçait à 279, la largeur réelle sur un
 *     téléphone de 375 px une fois retirés les rembourrages du courriel.
 *  4. Extrémités et angles `round`. Rayon 3 sur tout rectangle.
 *  5. Quatre encres, toutes tirées de la palette du brief : grille, structure, accent,
 *     et les deux couleurs sémantiques. Le vert et le rouge n'apparaissent QUE là où
 *     ils désignent un résultat de marché.
 *  6. Le fond `#fdf8ed` est CUIT dans le PNG, exactement la couleur de l'encart : le
 *     schéma ne dépend donc pas de ce que le client de messagerie décide de peindre
 *     derrière une image transparente.
 *  7. Aucune phrase dans un schéma. Des CHIFFRES sont admis quand ils SONT la notion
 *     — les seuils 30 et 70 du RSI, le zéro du MACD — jamais une légende.
 *  8. Rien ne touche le bord.
 */
import { Resvg } from '@resvg/resvg-js';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RACINE = path.resolve(ICI, '../..');
const POLICES = ['Inter-Regular.ttf', 'JetBrainsMono-Regular.ttf']
  .map((f) => path.join(RACINE, 'api/cron/_lib/fonts', f))
  .filter((f) => fs.existsSync(f));

// Palette « Bourse à l'Aube », recopiée du brief. Ce n'est PAS celle du site : un
// schéma dessiné pour du navy serait illisible sur le fond crème de l'encart.
const FOND = '#fdf8ed';
const GRILLE = 'rgba(26,18,8,0.14)';
const STRUCTURE = '#5a5040';
const ACCENT = '#ac862b';
const HAUSSE = '#067a4f';
const BAISSE = '#c62828';

/** L'ossature commune : le cadre des panneaux. Présente dans les trois. */
function panneau(x, y, l, h) {
  return `<rect x="${x}" y="${y}" width="${l}" height="${h}" rx="3" fill="none" stroke="${GRILLE}" stroke-width="1"/>`;
}

const SCHEMAS = {
  // ── RSI ───────────────────────────────────────────────────────────────────────
  // « Une courbe de prix au-dessus et l'oscillateur en dessous avec ses deux seuils :
  // pas plus. » Les deux seuils sont chiffrés parce qu'ils SONT la notion : un RSI
  // sans 30 ni 70 ne montre rien.
  rsi: `
    ${panneau(24, 20, 552, 132)}
    <path d="M40 120 78 96 116 108 154 74 192 88 230 52 268 66 306 44 344 70 382 58 420 92 458 78 496 110 534 96 560 118"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    ${panneau(24, 176, 552, 104)}
    <path d="M24 200h552" stroke="${BAISSE}" stroke-width="1.4" stroke-dasharray="5 6" opacity="0.65"/>
    <path d="M24 256h552" stroke="${HAUSSE}" stroke-width="1.4" stroke-dasharray="5 6" opacity="0.65"/>
    <text x="34" y="196" font-family="JetBrains Mono" font-size="14" fill="${BAISSE}">70</text>
    <text x="34" y="270" font-family="JetBrains Mono" font-size="14" fill="${HAUSSE}">30</text>
    <path d="M40 250 78 236 116 244 154 214 192 224 230 196 268 206 306 190 344 212 382 202 420 234 458 222 496 252 534 240 560 258"
          fill="none" stroke="${ACCENT}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="306" cy="190" r="5.5" fill="${ACCENT}"/>
    <circle cx="496" cy="252" r="5.5" fill="${ACCENT}"/>`,

  // ── MACD ──────────────────────────────────────────────────────────────────────
  // Deux lignes qui se croisent autour d'un zéro, et l'histogramme qui n'est que
  // l'écart entre elles. Les croisements sont marqués parce que c'est ce qu'on
  // regarde ; le reste est du décor.
  macd: `
    ${panneau(24, 20, 552, 132)}
    <path d="M40 116 82 100 124 110 166 78 208 92 250 58 292 72 334 48 376 74 418 62 460 96 502 84 544 112 560 104"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    ${panneau(24, 176, 552, 104)}
    <path d="M24 228h552" stroke="${GRILLE}" stroke-width="1"/>
    <text x="34" y="224" font-family="JetBrains Mono" font-size="14" fill="${STRUCTURE}">0</text>
    <g fill="${HAUSSE}" opacity="0.62">
      <rect x="148" y="222" width="8" height="6" rx="2"/><rect x="176" y="216" width="8" height="12" rx="2"/>
      <rect x="204" y="209" width="8" height="19" rx="2"/><rect x="232" y="205" width="8" height="23" rx="2"/>
      <rect x="260" y="207" width="8" height="21" rx="2"/><rect x="288" y="215" width="8" height="13" rx="2"/>
      <rect x="316" y="223" width="8" height="5" rx="2"/>
    </g>
    <g fill="${BAISSE}" opacity="0.62">
      <rect x="352" y="228" width="8" height="7" rx="2"/><rect x="380" y="228" width="8" height="15" rx="2"/>
      <rect x="408" y="228" width="8" height="22" rx="2"/><rect x="436" y="228" width="8" height="18" rx="2"/>
      <rect x="464" y="228" width="8" height="9" rx="2"/><rect x="492" y="228" width="8" height="4" rx="2"/>
    </g>
    <path d="M40 244 96 240 152 232 208 210 264 198 320 206 376 226 432 250 488 246 544 236"
          fill="none" stroke="${ACCENT}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M40 238 96 236 152 234 208 226 264 214 320 210 376 216 432 232 488 242 544 240"
          fill="none" stroke="${STRUCTURE}" stroke-width="2" stroke-dasharray="6 5" stroke-linecap="round"/>
    <circle cx="133" cy="235" r="5.5" fill="${HAUSSE}"/>
    <circle cx="336" cy="212" r="5.5" fill="${BAISSE}"/>`,

  // ── Support et résistance ─────────────────────────────────────────────────────
  // Un seul panneau : la notion tient dans le prix lui-même. Les deux niveaux sont des
  // BANDES et non des traits, parce que c'est ainsi qu'ils se comportent — le prix ne
  // tourne jamais deux fois exactement au même centième. Les points marquent les
  // réactions, qui sont ce qui fait un niveau.
  'support-resistance': `
    ${panneau(24, 20, 552, 260)}
    <rect x="24" y="56" width="552" height="22" rx="3" fill="${BAISSE}" opacity="0.10"/>
    <path d="M24 56h552M24 78h552" stroke="${BAISSE}" stroke-width="1.4" stroke-dasharray="5 6" opacity="0.6"/>
    <rect x="24" y="218" width="552" height="22" rx="3" fill="${HAUSSE}" opacity="0.10"/>
    <path d="M24 218h552M24 240h552" stroke="${HAUSSE}" stroke-width="1.4" stroke-dasharray="5 6" opacity="0.6"/>
    <path d="M40 200 96 236 150 180 206 120 258 70 300 112 348 168 396 228 444 190 492 130 540 74 560 96"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="258" cy="70" r="6" fill="${BAISSE}"/>
    <circle cx="540" cy="74" r="6" fill="${BAISSE}"/>
    <circle cx="96" cy="236" r="6" fill="${HAUSSE}"/>
    <circle cx="396" cy="228" r="6" fill="${HAUSSE}"/>`,
};

const svg = (corps) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300" width="600" height="300">` +
  `<rect width="600" height="300" fill="${FOND}"/>${corps}</svg>`;

const sorties = [];
for (const [slug, corps] of Object.entries(SCHEMAS)) {
  const png = new Resvg(svg(corps), {
    // Rendu au DOUBLE de la largeur d'affichage : les écrans à densité double sont la
    // norme, et une image nette coûte ici quelques kilo-octets, pas cent.
    fitTo: { mode: 'width', value: 1200 },
    font: { fontFiles: POLICES, loadSystemFonts: false, defaultFontFamily: 'Inter' },
  }).render().asPng();
  const cible = path.join(ICI, `${slug}.png`);
  fs.writeFileSync(cible, png);
  sorties.push([slug, png.length]);
}

console.log('\n  Schémas régénérés (1200 px de large, affichés 600) :');
for (const [slug, t] of sorties) console.log(`    ${slug.padEnd(22)} ${(t / 1024).toFixed(1)} Kio`);
console.log(`    ${'total'.padEnd(22)} ${(sorties.reduce((a, b) => a + b[1], 0) / 1024).toFixed(1)} Kio\n`);
