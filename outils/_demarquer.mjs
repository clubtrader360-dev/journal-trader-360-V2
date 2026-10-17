/**
 * ⛔ RETIRER LE BALISAGE MARKDOWN D UN TEXTE DESTINE A L ECRAN.
 *
 * ── ⚠️ POURQUOI CE FICHIER EXISTE A PART ───────────────────────────────────
 *
 * L outil d import POSE les descriptions et la sonde les VERIFIE. Si chacun
 * portait sa propre version de ce nettoyage, les deux divergeraient au premier
 * cas nouveau, et ⛔ c est la sonde qui aurait l air juste : elle compare a ce
 * qu elle a nettoye elle-meme, pas a ce que l eleve lit. ⚠️ Une seule fonction,
 * lue par les deux, rend la divergence impossible.
 *
 * ── ⛔ CE QU IL CORRIGE, MESURE LE 14/10 ───────────────────────────────────
 *
 * Six chapitres arrivaient a l eleve avec les chevrons de leur bloc de
 * citation, un par ligne repliee :
 *
 *     « ... comment sont imposes les revenus que tu > percois d une prop firm »
 *
 * ⚠️ Les trois du module 08 et les trois du 09. ⛔ Et la sonde de comparaison
 * verbatim etait VERTE, parce qu elle compare au fichier source, qui porte les
 * memes chevrons. Un comparateur pris dans le meme moule que la mesure ne
 * discrimine rien.
 *
 * ── ⚠️ CE QU IL NE FAIT PAS ────────────────────────────────────────────────
 *
 * ⛔ Il ne reecrit pas, il DEBALISE. Les mots, les apostrophes, la ponctuation
 * et les accents ne bougent pas : ce sont ceux de Nadir. Seuls les caracteres
 * qui etaient de la SYNTAXE Markdown partent.
 */

/** Les marqueurs qui ne doivent jamais arriver a l ecran. ⚠️ Sert aussi de sonde. */
export const MARQUEURS = [
  { nom: 'chevron de citation', motif: /(^|\n)\s*>\s?/ },
  { nom: 'chevron de citation replie', motif: /\s>\s/ },
  { nom: 'gras', motif: /\*\*/ },
  { nom: 'titre', motif: /(^|\n)#+\s/ },
  { nom: 'puce', motif: /(^|\n)\s*[-*]\s/ },
];

/**
 * Debalise un texte lu dans `_contenu-formation/`.
 * @param {string} s le texte brut, retours a la ligne compris
 * @return {string} le texte tel que l eleve le lira
 */
export function demarquer(s) {
  if (!s) return s;
  return String(s)
    // ⛔ LES CHEVRONS D ABORD, LIGNE PAR LIGNE, AVANT DE REPLIER. ⚠️ Replier
    // en premier collerait les chevrons au milieu des phrases et il n y aurait
    // plus de « debut de ligne » ou les reconnaitre.
    .split('\n').map((l) => l.replace(/^\s*>\s?/, '')).join('\n')
    .replace(/\*\*(.+?)\*\*/g, '$1')   // le gras, en gardant son texte
    .replace(/\s*\n\s*/g, ' ')         // et seulement ensuite on replie
    .trim();
}

/**
 * Les marqueurs encore presents dans un texte. ⛔ Vide = propre.
 * @return {string[]} les noms des marqueurs trouves
 */
export function marqueursRestants(s) {
  return MARQUEURS.filter((m) => m.motif.test(String(s || ''))).map((m) => m.nom);
}
