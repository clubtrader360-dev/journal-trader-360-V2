/**
 * Les schémas de la rubrique « culture de marché ». UNE SÉRIE, pas des dessins.
 *
 *   node assets/culture/generer.mjs            → régénère les PNG
 *   node assets/culture/planche.mjs <sortie.png> <slug...>  → planche à taille réelle
 *   node assets/culture/lisibilite.mjs                     → densité et lisibilité à 279 px
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

  // ── Tendance ──────────────────────────────────────────────────────────────────
  // Sommets ET creux ascendants, marqués tous les deux : c'est leur conjonction qui
  // définit une tendance, pas la pente générale. La droite qui relie les creux est en
  // accent parce que c'est elle qu'on trace en pratique.
  //
  // Les sommets sont des cercles ÉVIDÉS et non des points verts. Un sommet plus haut
  // que le précédent n'est pas un résultat de marché, c'est une structure : la règle 5
  // lui interdit le vert. Le creux plein et le sommet évidé se distinguent sans
  // qu'aucune couleur n'ait à porter un sens qu'elle n'a pas.
  tendance: `
    ${panneau(24, 20, 552, 260)}
    <path d="M44 244 96 186 148 218 206 154 258 190 316 118 368 156 426 84 478 124 536 56 560 76"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M96 192 478 130" stroke="${ACCENT}" stroke-width="2" stroke-dasharray="6 6"/>
    <circle cx="96" cy="186" r="5.5" fill="${ACCENT}"/>
    <circle cx="258" cy="190" r="5.5" fill="${ACCENT}"/>
    <circle cx="478" cy="124" r="5.5" fill="${ACCENT}"/>
    <circle cx="206" cy="154" r="5" fill="${FOND}" stroke="${STRUCTURE}" stroke-width="2"/>
    <circle cx="316" cy="118" r="5" fill="${FOND}" stroke="${STRUCTURE}" stroke-width="2"/>
    <circle cx="426" cy="84" r="5" fill="${FOND}" stroke="${STRUCTURE}" stroke-width="2"/>`,

  // ── Range ─────────────────────────────────────────────────────────────────────
  // Tout l'intérieur est teinté, et non deux bandes fines : c'est ce qui distingue
  // visuellement un range d'un couple support/résistance. Aucun point de réaction —
  // les points sont le vocabulaire de l'autre schéma, les reprendre ici brouillerait
  // les deux.
  //
  // HUIT ALLERS-RETOURS ET NON DOUZE. Le premier tracé en comptait douze, la limite
  // haute de la série : à 279 px la planche montrait une dent de scie mécanique où
  // l'œil ne distinguait plus une oscillation d'une autre. La notion est « borné »,
  // pas « nombreux ». La bande occupe aussi plus de hauteur qu'au premier jet, où le
  // panneau était vide sur ses deux tiers.
  range: `
    ${panneau(24, 20, 552, 260)}
    <rect x="24" y="68" width="552" height="164" rx="3" fill="${ACCENT}" opacity="0.08"/>
    <path d="M24 68h552M24 232h552" stroke="${ACCENT}" stroke-width="1.8" stroke-dasharray="6 6" opacity="0.8"/>
    <path d="M44 224 108 76 172 226 236 74 300 228 364 76 428 224 492 78 556 180"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,

  // ── Bandes de Bollinger ───────────────────────────────────────────────────────
  // L'enveloppe se RESSERRE puis s'écarte : c'est la seule chose que ce schéma doit
  // montrer. Un Bollinger dessiné à largeur constante ne dit rien de ce qu'il mesure.
  //
  // La moyenne centrale est en ACCENT comme les deux bandes, et non en structure : les
  // trois lignes SONT le même indicateur, le prix seul appartient à l'autre encre. Au
  // premier jet la moyenne partageait l'encre du prix et, à 279 px, on lisait deux
  // tracés sombres entremêlés sans savoir lequel était le prix.
  'bandes-de-bollinger': `
    ${panneau(24, 20, 552, 260)}
    <path d="M40 92 96 104 152 126 208 138 264 140 320 132 376 104 432 72 488 54 544 44"
          fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M40 208 96 196 152 178 208 168 264 166 320 176 376 204 432 234 488 250 544 258"
          fill="none" stroke="${ACCENT}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M40 150 96 150 152 152 208 153 264 153 320 154 376 154 432 153 488 152 544 151"
          fill="none" stroke="${ACCENT}" stroke-width="1.4" stroke-dasharray="7 6" stroke-linecap="round"/>
    <path d="M40 126 82 168 124 140 166 162 208 146 250 158 292 144 334 164 376 122 418 188 460 88 502 214 544 96"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,

  // ── ATR ───────────────────────────────────────────────────────────────────────
  // Le prix du haut passe d'une phase calme à une phase agitée ; la courbe du bas
  // suit. Les deux panneaux doivent se lire ensemble : un ATR seul est une courbe
  // sans objet. Le trait vertical au même x dans les deux panneaux est ce qui les
  // relie — sans lui, on regarde deux dessins et non une cause et son effet.
  //
  // La partie calme de la courbe basse a été remontée de huit pixels : collée au bas
  // du panneau, elle se confondait avec la bordure et la marche perdait son départ.
  atr: `
    ${panneau(24, 20, 552, 132)}
    <path d="M40 92 78 84 116 96 154 86 192 94 230 82 268 100 306 62 344 128 382 48 420 118 458 56 496 112 534 70 560 96"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M290 26v120" stroke="${GRILLE}" stroke-width="1.4"/>
    ${panneau(24, 176, 552, 104)}
    <path d="M40 250 78 248 116 252 154 246 192 250 230 244 268 246 306 220 344 200 382 190 420 196 458 186 496 192 534 188 560 194"
          fill="none" stroke="${ACCENT}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M290 182v92" stroke="${GRILLE}" stroke-width="1.4"/>`,

  // ── Retracement de Fibonacci ──────────────────────────────────────────────────
  // Les trois pourcentages sont écrits parce qu'ils SONT la notion : un retracement
  // sans 38,2, 50 et 61,8 n'est qu'un repli. Les niveaux sont MESURÉS sur l'impulsion
  // dessinée — de y=244 à y=68, soit 176 points — et tombent donc là où ils doivent :
  // 68 + 0,382 × 176 = 135, 68 + 0,5 × 176 = 156, 68 + 0,618 × 176 = 177.
  //
  // Les chiffres sont à 17 px et non à 14 : sur la planche à taille réelle, les trois
  // pourcentages étaient une tache illisible à 279 px, c'est-à-dire que la seule chose
  // que ce schéma doit dire disparaissait exactement là où il est le plus lu.
  // Les extrémités du mouvement sont des cercles évidés, pas un point vert et un point
  // rouge : un creux et un sommet sont des structures, pas des résultats (règle 5).
  fibonacci: `
    ${panneau(24, 20, 552, 260)}
    <path d="M24 135h416" stroke="${ACCENT}" stroke-width="1.4" stroke-dasharray="5 6" opacity="0.75"/>
    <path d="M24 156h416" stroke="${ACCENT}" stroke-width="1.4" stroke-dasharray="5 6" opacity="0.75"/>
    <path d="M24 177h416" stroke="${ACCENT}" stroke-width="1.4" stroke-dasharray="5 6" opacity="0.75"/>
    <text x="450" y="141" font-family="JetBrains Mono" font-size="17" fill="${ACCENT}">38,2</text>
    <text x="450" y="162" font-family="JetBrains Mono" font-size="17" fill="${ACCENT}">50</text>
    <text x="450" y="183" font-family="JetBrains Mono" font-size="17" fill="${ACCENT}">61,8</text>
    <path d="M44 244 86 226 128 208 170 172 212 140 254 106 296 68"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M296 68 330 104 364 134 398 158 432 148"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="44" cy="244" r="5" fill="${FOND}" stroke="${STRUCTURE}" stroke-width="2"/>
    <circle cx="296" cy="68" r="5" fill="${FOND}" stroke="${STRUCTURE}" stroke-width="2"/>
    <circle cx="398" cy="158" r="6" fill="${ACCENT}"/>`,

  // ── Divergence ────────────────────────────────────────────────────────────────
  // LA PLUS EXIGEANTE DES VINGT, et la seule dont la notion ne vit dans aucun des deux
  // panneaux : elle vit dans la COMPARAISON entre eux. Un sommet plus haut sur le prix,
  // un sommet plus bas sur l'oscillateur, au même moment.
  //
  // Ce qui la rend tenable à 279 px, alors qu'elle porte deux fois la matière de l'ATR :
  // le tracé est réduit au strict nécessaire — deux sommets et le creux entre eux — et
  // tout le reste du dessin sert la comparaison. Les DEUX VERTICALES TRAVERSENT LE
  // VIDE ENTRE LES PANNEAUX, ce qu'aucun autre schéma de la série ne fait. C'est
  // délibéré : sans elles on regarde deux dessins côte à côte, avec elles on lit un
  // même instant vu deux fois. Les deux droites d'accent ont des pentes exactement
  // opposées, 26 points sur 222 dans un sens et dans l'autre — c'est ce contraste
  // d'inclinaison, et non la hauteur des sommets, qui survit à la réduction.
  //
  // Les deux droites passent PAR le centre des points et non au-dessus : au premier
  // jet elles flottaient huit pixels plus haut pour ne rien recouvrir, et on lisait
  // quatre points d'un côté et deux droites de l'autre au lieu d'une seule figure.
  divergence: `
    ${panneau(24, 20, 552, 132)}
    <path d="M176 26v248M392 26v248" stroke="${GRILLE}" stroke-width="1.4" stroke-dasharray="3 5"/>
    <path d="M40 126 96 106 140 86 176 60 226 102 280 88 336 72 392 34 448 80 500 66 556 96"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M162 62 410 32" stroke="${ACCENT}" stroke-width="2" stroke-dasharray="6 6"/>
    <circle cx="176" cy="60" r="5.5" fill="${ACCENT}"/>
    <circle cx="392" cy="34" r="5.5" fill="${ACCENT}"/>
    ${panneau(24, 176, 552, 104)}
    <path d="M40 248 96 238 140 224 176 200 226 242 280 232 336 238 392 226 448 254 500 246 556 264"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M162 198 410 228" stroke="${ACCENT}" stroke-width="2" stroke-dasharray="6 6"/>
    <circle cx="176" cy="200" r="5.5" fill="${ACCENT}"/>
    <circle cx="392" cy="226" r="5.5" fill="${ACCENT}"/>`,

  // ── Pullback ──────────────────────────────────────────────────────────────────
  // Le repli est PEINT, pas annoté. Le tracé est coupé en trois morceaux et seul celui
  // du milieu porte l'accent : la notion est un segment du mouvement, pas un point, et
  // un point posé sur une courbe continue aurait demandé de deviner où le repli
  // commence et où il finit. Aucune ligne, aucun niveau, aucun chiffre — un pullback
  // n'a pas de mesure, c'est ce qui le distingue du retracement de Fibonacci.
  //
  // LA BANDE TEINTÉE A ÉTÉ AJOUTÉE APRÈS LA PLANCHE. Sans elle, le segment d'accent
  // tenait à 600 px et s'évanouissait à 279 : le schéma se lisait comme une simple
  // dent dans une montée, c'est-à-dire comme rien. Un trait de couleur ne pèse pas
  // assez à cette taille, une surface oui — même vocabulaire que le range.
  pullback: `
    ${panneau(24, 20, 552, 260)}
    <rect x="252" y="20" width="88" height="260" fill="${ACCENT}" opacity="0.10"/>
    <path d="M44 246 120 192 196 132 252 96"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M252 96 300 140 340 170"
          fill="none" stroke="${ACCENT}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M340 170 400 122 460 78 520 46 556 62"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="340" cy="170" r="5.5" fill="${ACCENT}"/>`,

  // ── Double sommet ─────────────────────────────────────────────────────────────
  // Deux tentatives sur le MÊME niveau, et la cassure de la ligne de cou. Les trois
  // éléments sont indispensables : deux sommets sans cassure ne sont qu'un range, une
  // cassure sans les deux sommets n'est qu'une baisse.
  //
  // Les sommets sont marqués en accent PLEIN alors que ceux de la tendance sont évidés.
  // Ce n'est pas une entorse : l'accent plein désigne partout dans la série les points
  // QUI FONT la notion. Dans la tendance, ce sont les creux qui portent la droite ;
  // ici, ce sont les deux sommets eux-mêmes.
  'double-sommet': `
    ${panneau(24, 20, 552, 260)}
    <rect x="24" y="62" width="552" height="16" rx="3" fill="${ACCENT}" opacity="0.10"/>
    <path d="M24 62h552M24 78h552" stroke="${ACCENT}" stroke-width="1.4" stroke-dasharray="5 6" opacity="0.7"/>
    <path d="M24 178h552" stroke="${ACCENT}" stroke-width="1.8" stroke-dasharray="6 6"/>
    <path d="M44 238 110 190 180 70 232 130 288 178 342 124 396 70 448 136 500 178 540 234 560 246"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="180" cy="70" r="5.5" fill="${ACCENT}"/>
    <circle cx="396" cy="70" r="5.5" fill="${ACCENT}"/>
    <circle cx="500" cy="178" r="5" fill="${FOND}" stroke="${ACCENT}" stroke-width="2.4"/>`,

  // ── Triangle ──────────────────────────────────────────────────────────────────
  // La COMPRESSION est tout le sujet : chaque oscillation est plus courte que la
  // précédente. Les deux droites ne sont pas décoratives, elles sont ce que le tracé
  // touche — chaque extrémité vient s'y poser, alternativement en haut et en bas. La
  // dernière jambe sort par le haut : un triangle qui ne se résout pas n'est qu'une
  // figure en cours, et le schéma doit montrer la notion achevée.
  triangle: `
    ${panneau(24, 20, 552, 260)}
    <path d="M60 70 520 160M60 250 520 160" stroke="${ACCENT}" stroke-width="1.8" stroke-dasharray="6 6" opacity="0.85"/>
    <path d="M60 250 120 92 180 210 245 118 305 190 365 136 425 178 470 155 520 120 556 66"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,

  // ── VWAP ──────────────────────────────────────────────────────────────────────
  // Deux panneaux, parce que la notion est le mot PONDÉRÉ. Un VWAP dessiné seul sous
  // une courbe de prix est indiscernable d'une moyenne mobile : ce qui les sépare est
  // en bas. Les barres lourdes sont toutes à gauche, là où le prix était bas, et c'est
  // pour cela que la ligne finit loin SOUS le prix au lieu de le rejoindre.
  //
  // La ligne S'APLATIT au milieu, exactement là où les barres maigrissent. Au premier
  // jet elle montait d'une pente régulière et se lisait comme une droite de tendance :
  // c'est le coude, et lui seul, qui dit qu'une séance récente ne pèse presque rien.
  //
  // Les barres sont en accent et non en vert et rouge comme celles du schéma « volume ».
  // Là-bas, la couleur disait le sens de la séance, donc un résultat de marché. Ici la
  // barre dit un poids. La règle 5 lui refuse la couleur.
  //
  // LES BARRES ONT ÉTÉ RACCOURCIES APRÈS MESURE. Le premier jet passait le plafond de
  // densité de la série — 9,19 % d'encre à 279 px contre 7,22 % pour le volume à douze
  // barres, le schéma le plus chargé que Trader 360 ait validé. Douze barres, oui,
  // mais pas douze barres plus hautes que celles du schéma qui sert de plafond : ce
  // panneau porte en plus une seconde ligne dans le panneau du haut. Le contraste
  // lourd/léger, qui est la notion, tient aussi bien à cette échelle.
  vwap: `
    ${panneau(24, 20, 552, 132)}
    <path d="M52 118 96 110 140 116 184 100 228 106 272 88 316 66 360 74 404 48 448 58 492 40 536 50"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <path d="M52 116 96 115 140 115 184 112 228 110 272 106 316 99 360 95 404 92 448 90 492 88 536 87"
          fill="none" stroke="${ACCENT}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    ${panneau(24, 176, 552, 104)}
    <path d="M24 268h552" stroke="${GRILLE}" stroke-width="1"/>
    <g opacity="0.55" fill="${ACCENT}">
      <rect x="42" y="222" width="20" height="46" rx="2"/>
      <rect x="86" y="212" width="20" height="56" rx="2"/>
      <rect x="130" y="228" width="20" height="40" rx="2"/>
      <rect x="174" y="210" width="20" height="58" rx="2"/>
      <rect x="218" y="218" width="20" height="50" rx="2"/>
      <rect x="262" y="224" width="20" height="44" rx="2"/>
      <rect x="306" y="254" width="20" height="14" rx="2"/>
      <rect x="350" y="258" width="20" height="10" rx="2"/>
      <rect x="394" y="252" width="20" height="16" rx="2"/>
      <rect x="438" y="258" width="20" height="10" rx="2"/>
      <rect x="482" y="254" width="20" height="14" rx="2"/>
      <rect x="526" y="260" width="20" height="8" rx="2"/>
    </g>`,

  // ── Order block ───────────────────────────────────────────────────────────────
  // La zone est dessinée en DEUX intensités : pleine là où elle a été formée, atténuée
  // sur sa projection à droite. C'est la seule façon de montrer qu'un order block est
  // à la fois un endroit du passé et un niveau qui reste actif — une bande d'intensité
  // unique se lirait comme un support, et le schéma « support et résistance » existe
  // déjà. Le prix en sort une première fois, y revient, et repart : sans le retour, on
  // aurait dessiné une impulsion et non un order block.
  'order-block': `
    ${panneau(24, 20, 552, 260)}
    <rect x="230" y="182" width="346" height="40" fill="${ACCENT}" opacity="0.07"/>
    <rect x="150" y="182" width="80" height="40" rx="3" fill="${ACCENT}" opacity="0.28"/>
    <path d="M150 182h426M150 222h426" stroke="${ACCENT}" stroke-width="1.4" stroke-dasharray="5 6" opacity="0.7"/>
    <path d="M44 214 90 200 140 206 180 192 212 202 260 120 300 86 350 130 400 190 450 122 510 74 556 48"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="400" cy="190" r="5.5" fill="${ACCENT}"/>`,

  // ── Liquidité ─────────────────────────────────────────────────────────────────
  // La bande est SOUS les deux creux, pas dessus. C'est ce décalage de quelques points
  // qui fait toute la notion et qui la sépare d'un support : les ordres en attente ne
  // s'accumulent pas au niveau, ils s'accumulent juste en dessous. CE DÉCALAGE EST
  // MESURÉ : dix-huit points, et non huit comme au premier jet. À huit, la planche
  // montrait le niveau et le bord de la bande fondus en un seul trait doré dès 279 px
  // — la seule chose qui sépare ce schéma d'un support avait disparu. Les traits courts
  // dans la bande sont ces ordres — six, pas davantage : il faut qu'on lise une
  // accumulation, pas une trame.
  //
  // Le prix descend AU TRAVERS de la bande puis repart d'un coup. Un balayage qui ne
  // serait pas suivi du retournement ne montrerait qu'une cassure.
  liquidite: `
    ${panneau(24, 20, 552, 260)}
    <rect x="24" y="208" width="552" height="30" rx="3" fill="${ACCENT}" opacity="0.12"/>
    <path d="M24 208h552M24 238h552" stroke="${ACCENT}" stroke-width="1.4" stroke-dasharray="5 6" opacity="0.7"/>
    <g stroke="${STRUCTURE}" stroke-width="1.4" opacity="0.55" stroke-linecap="round">
      <path d="M60 223h26M146 223h26M232 223h26M318 223h26M404 223h26M490 223h26"/>
    </g>
    <path d="M24 190h452" stroke="${ACCENT}" stroke-width="1.8" stroke-dasharray="6 6"/>
    <path d="M44 110 100 156 160 190 220 140 280 168 340 190 400 150 442 182 480 256 506 240 532 130 556 84"
          fill="none" stroke="${STRUCTURE}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>
    <circle cx="160" cy="190" r="5" fill="${FOND}" stroke="${STRUCTURE}" stroke-width="2"/>
    <circle cx="340" cy="190" r="5" fill="${FOND}" stroke="${STRUCTURE}" stroke-width="2"/>
    <circle cx="480" cy="256" r="5.5" fill="${ACCENT}"/>`,

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
