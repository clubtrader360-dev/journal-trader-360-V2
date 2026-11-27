// ========================================================================
// TYPOGRAPHIE DU BRIEF MARCHÉ (Manu, 27/11/2026) : lisibilité sur téléphone, sur le
// modèle d'Aktionnaire (corps 16 px, titres 19-20 px, rien sous 12 px).
//
// ⛔ AUCUNE POLICE WEB EXTERNE. JetBrains Mono n'est chargée nulle part dans le mail :
// elle n'est que le premier vœu d'une pile qui se dégrade vers la chasse fixe du
// système (SF Mono sur Apple, Consolas sur Windows, Roboto Mono sur Android).
// `tabular-nums` aligne les chiffres même quand la police de repli est proportionnelle.
// Guillemets SIMPLES : ces piles vont dans des attributs style="…".
// ========================================================================
export const SANS = "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
export const MONO = "'JetBrains Mono','SF Mono',SFMono-Regular,Menlo,Consolas,'Roboto Mono','Liberation Mono',monospace";
/** Déclarations des chiffres : chasse fixe + chiffres tabulaires. */
export const CHIFFRES = `font-family:${MONO}; font-variant-numeric:tabular-nums;`;

// ── ESPACEMENTS DU BRIEF (Manu, 27/11/2026, modèle Aktionnaire mesuré dans Gmail web) ─────
// Peu d'espace à l'intérieur d'un bloc, beaucoup entre les blocs. Tous les espacements
// verticaux sont des PADDING DE CELLULE (Gmail et Outlook ignorent souvent les margin),
// et aucune media query n'y touche : identiques sur téléphone et ordinateur.
// titre : titre de SECTION → premier élément, une seule règle partout (Manu 27/11/2026 : 18 px,
// 13 px collait trop dans Actualité, Culture et Partenaires). sousTitre : titre interne
// (nom de la notion de culture, VIX) → son texte.
export const ESPACES = { paragraphe: 16, titre: 18, sousTitre: 13, bloc: 40, intro: 48, titreActualite: 6, actualite: 24 };
const TABLE_PILE = '<table role="presentation" width="100%" cellspacing="0" cellpadding="0">';
/**
 * Pile verticale : un élément par cellule, l'écart en padding-bottom de la cellule.
 * `elements` : chaînes HTML (écart `ecart` entre elles, aucun après le dernier) ou paires
 * [html, écart sous l'élément]. Les éléments vides sont ignorés.
 */
export function pile(elements, ecart = 0, style = '') {
  const l = elements.filter((e) => (Array.isArray(e) ? e[0] : e));
  return TABLE_PILE + l.map((e, i) => {
    const [h, bas] = Array.isArray(e) ? e : [e, i === l.length - 1 ? 0 : ecart];
    return `<tr><td style="padding:0 0 ${bas}px;${style ? ` ${style}` : ''}">${h}</td></tr>`;
  }).join('') + '</table>';
}
/** Titre de section (19 px, capitales) : ESPACES.titre dessous, en padding. */
export const titreCarte = (texte, couleur, taille = 19, espacement = '0.08em') => TABLE_PILE
  + `<tr><td style="padding:0 0 ${ESPACES.titre}px; color:${couleur}; font-size:${taille}px; letter-spacing:${espacement}; text-transform:uppercase; font-weight:700;">${texte}</td></tr></table>`;
