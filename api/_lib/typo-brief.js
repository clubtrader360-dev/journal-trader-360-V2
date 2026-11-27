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
