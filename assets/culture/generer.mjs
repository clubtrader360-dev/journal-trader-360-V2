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

  // ── Moyenne mobile ────────────────────────────────────────────────────────────
  // Un seul panneau : la moyenne vit SUR le prix, la séparer serait un contresens.
  // Deux lissages pour tenir l'angle « simple contre exponentielle » : le trait plein
  // colle au prix, le pointillé traîne derrière. C'est toute la différence, et elle se
  // voit sans qu'on ait à l'écrire.
  'moyenne-mobile': `
    ${panneau(24, 20, 552, 260)}
    <path d="M40 210 78 178 116 196 154 148 192 172 230 118 268 142 306 92 344 124 382 104 420 150 458 128 496 176 534 150 560 186"
          fill="none" stroke="${GRILLE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M40 200 78 190 116 188 154 174 192 168 230 152 268 146 306 132 344 128 382 124 420 130 458 132 496 144 534 148 560 158"
          fill="none" stroke="${ACCENT}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M40 196 78 192 116 190 154 184 192 180 230 172 268 166 306 156 344 150 382 146 420 146 458 148 496 154 534 158 560 164"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.4" stroke-dasharray="7 6" stroke-linecap="round" stroke-linejoin="round"/>`,

  // ── Break of structure ────────────────────────────────────────────────────────
  // Une suite de creux ascendants, puis un passage SOUS le dernier. Le niveau rompu
  // est tiré à l'horizontale jusqu'au point de rupture : sans ce prolongement, on voit
  // une baisse ordinaire et pas une rupture de structure.
  'break-of-structure': `
    ${panneau(24, 20, 552, 260)}
    <path d="M40 232 92 168 140 212 192 130 240 176 292 96 340 148 392 78 440 132 470 176 500 220 530 252 560 244"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M240 176h250" stroke="${ACCENT}" stroke-width="1.4" stroke-dasharray="5 6"/>
    <circle cx="192" cy="130" r="5" fill="${HAUSSE}"/>
    <circle cx="240" cy="176" r="5" fill="${ACCENT}"/>
    <circle cx="340" cy="148" r="5" fill="${HAUSSE}"/>
    <circle cx="490" cy="176" r="6.5" fill="${BAISSE}"/>`,

  // ── Chandelier japonais ───────────────────────────────────────────────────────
  // Une bougie AGRANDIE, et les quatre niveaux qu'elle résume tirés à sa gauche. Pas
  // de légende : les quatre traits montrent qu'un corps et deux mèches encodent quatre
  // prix, ce qui est exactement la notion. Trois bougies de taille normale à droite
  // remettent l'échelle en place.
  //
  // Les traits vont JUSQU'À l'axe de la mèche (x=202), pas jusqu'au bord du corps. À
  // 180 ils s'arrêtaient quatre pixels avant un corps translucide : sur la planche à
  // 279 px, ils flottaient à gauche sans qu'on voie ce qu'ils désignaient, et le
  // schéma devenait « une grosse bougie et des pointillés ». Encre STRUCTURE et non
  // grille, pour la même raison : à cette taille, la grille disparaît.
  'chandelier-japonais': `
    ${panneau(24, 20, 552, 260)}
    <path d="M60 66h142M60 108h142M60 212h142M60 254h142" stroke="${STRUCTURE}" stroke-width="1.4" stroke-dasharray="5 6" opacity="0.55"/>
    <path d="M200 66v188" stroke="${HAUSSE}" stroke-width="3"/>
    <rect x="176" y="108" width="48" height="104" rx="3" fill="${HAUSSE}" opacity="0.18" stroke="${HAUSSE}" stroke-width="2.6"/>
    <path d="M330 92v150" stroke="${BAISSE}" stroke-width="2.6"/>
    <rect x="312" y="122" width="36" height="86" rx="3" fill="${BAISSE}" opacity="0.18" stroke="${BAISSE}" stroke-width="2.4"/>
    <path d="M420 110v120" stroke="${HAUSSE}" stroke-width="2.6"/>
    <rect x="402" y="140" width="36" height="58" rx="3" fill="${HAUSSE}" opacity="0.18" stroke="${HAUSSE}" stroke-width="2.4"/>
    <path d="M510 78v160" stroke="${HAUSSE}" stroke-width="2.6"/>
    <rect x="492" y="104" width="36" height="106" rx="3" fill="${HAUSSE}" opacity="0.18" stroke="${HAUSSE}" stroke-width="2.4"/>`,

  // ── Volume ────────────────────────────────────────────────────────────────────
  // Douze barres, sous le seuil de densité du MACD. Chaque barre prend la couleur du
  // sens de sa séance : c'est ce qui fait qu'on lit le volume AVEC le prix et non à
  // côté. Les deux barres hautes tombent sur les deux mouvements marqués du prix.
  volume: `
    ${panneau(24, 20, 552, 132)}
    <path d="M52 118 96 104 140 112 184 82 228 94 272 54 316 68 360 46 404 74 448 62 492 96 536 84"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    ${panneau(24, 176, 552, 104)}
    <path d="M24 268h552" stroke="${GRILLE}" stroke-width="1"/>
    <g opacity="0.62">
      <rect x="42" y="242" width="20" height="26" rx="2" fill="${BAISSE}"/>
      <rect x="86" y="230" width="20" height="38" rx="2" fill="${HAUSSE}"/>
      <rect x="130" y="248" width="20" height="20" rx="2" fill="${BAISSE}"/>
      <rect x="174" y="204" width="20" height="64" rx="2" fill="${HAUSSE}"/>
      <rect x="218" y="246" width="20" height="22" rx="2" fill="${BAISSE}"/>
      <rect x="262" y="192" width="20" height="76" rx="2" fill="${HAUSSE}"/>
      <rect x="306" y="244" width="20" height="24" rx="2" fill="${BAISSE}"/>
      <rect x="350" y="218" width="20" height="50" rx="2" fill="${HAUSSE}"/>
      <rect x="394" y="240" width="20" height="28" rx="2" fill="${BAISSE}"/>
      <rect x="438" y="234" width="20" height="34" rx="2" fill="${HAUSSE}"/>
      <rect x="482" y="226" width="20" height="42" rx="2" fill="${BAISSE}"/>
      <rect x="526" y="250" width="20" height="18" rx="2" fill="${HAUSSE}"/>
    </g>`,

  // ── Gap ───────────────────────────────────────────────────────────────────────
  // Deux séances et le vide entre elles. La bande grise EST la notion : ce n'est pas
  // une baisse, c'est une zone où aucun prix n'a été échangé. La coupure verticale
  // marque la fin d'une séance et le début de la suivante.
  gap: `
    ${panneau(24, 20, 552, 260)}
    <rect x="24" y="112" width="552" height="70" rx="3" fill="${STRUCTURE}" opacity="0.10"/>
    <path d="M24 112h552M24 182h552" stroke="${STRUCTURE}" stroke-width="1.4" stroke-dasharray="5 6" opacity="0.7"/>
    <path d="M290 34v232" stroke="${GRILLE}" stroke-width="1.4"/>
    <path d="M48 226 90 202 132 214 174 186 216 196 258 182"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M322 112 364 88 406 102 448 74 490 88 532 62"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="258" cy="182" r="5.5" fill="${ACCENT}"/>
    <circle cx="322" cy="112" r="5.5" fill="${ACCENT}"/>`,

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
