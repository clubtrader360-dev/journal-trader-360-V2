// ========================================================================
// Le croisement INTERNE.
//
// ── POURQUOI L'ANCIENNE RÈGLE PRODUISAIT UN n/d UN JOUR SUR DEUX ────────────────
// Elle exigeait une SECONDE SOURCE pour publier. Or la seconde source, mesurée depuis
// le runner, répond 429 (Yahoo) ou porte sur un contrat générique qui déraille au
// roulement. Une règle qui écarte une donnée juste parce qu'un témoin défaillant n'a
// pas pu la confirmer produit exactement ce qu'on a observé : cinq n/d sur dix, sur
// des journées où la valeur était pourtant disponible et exacte.
//
// ── CE QUI REMPLACE ────────────────────────────────────────────────────────────
// Plusieurs CHEMINS indépendants vers la même grandeur, comparés entre eux. Deux
// méthodes distinctes ne peuvent pas se tromper de contrat ni porter sur une autre
// échéance : elles interrogent le même instrument nommé.
//
// ⚠️ DEUX CHEMINS NE SONT PAS INDÉPENDANTS PARCE QU'ON LES APPELLE AUTREMENT.
// Déduire la clôture de `close - change_abs` puis de `close / (1 + change%)` ferait
// deux calculs sur la même grandeur : ils concorderaient toujours, y compris faux, et
// le croisement ne vaudrait rien. Les chemins retenus ici sont réellement distincts :
// un prix de règlement publié et daté, une clôture de veille calculée par le même
// fournisseur, et une troisième valeur déduite chez un fournisseur SANS RAPPORT.
//
// L'exigence de justesse ne baisse pas. C'est la manière de la vérifier qui change.
// ========================================================================

/** Un tick d'ES vaut 0,25 point. Deux chemins qui s'écartent de plus d'un tick ne
 *  décrivent pas le même prix — ils décrivent deux choses, et on ne sait pas laquelle. */
export const TOLERANCE_ES = 0.25;

/**
 * Concilier des chemins.
 *
 * Rend `{ valeur, chemins, ecart }` quand ils concordent, ou `{ valeur: null, motif }`
 * sinon. Un seul chemin disponible NE SUFFIT PAS : c'est le point où l'ancienne règle
 * avait raison, et on le garde.
 */
export function concilier(nom, chemins, tolerance) {
  const presents = chemins.filter((c) => typeof c.valeur === 'number' && Number.isFinite(c.valeur));
  const absents = chemins.filter((c) => !presents.includes(c));

  if (presents.length === 0) {
    return { valeur: null, motif: `${nom} : aucun chemin n'a rendu de valeur (${absents.map((c) => `${c.nom} : ${c.motif || 'absent'}`).join(' ; ')})` };
  }
  if (presents.length === 1) {
    return { valeur: null,
      motif: `${nom} : un seul chemin disponible (${presents[0].nom} = ${presents[0].valeur}), aucun croisement possible`
             + (absents.length ? ` — ${absents.map((c) => `${c.nom} : ${c.motif || 'absent'}`).join(' ; ')}` : '') };
  }

  const valeurs = presents.map((c) => c.valeur);
  const ecart = Math.max(...valeurs) - Math.min(...valeurs);
  if (ecart > tolerance) {
    const detail = presents.map((c) => `${c.nom} = ${c.valeur}`).join(' contre ');
    return { valeur: null, motif: `${nom} : chemins divergents, écart ${ecart.toFixed(2)} pt > ${tolerance} (${detail})`, ecart };
  }
  // À concordance, on retient la valeur du chemin le plus AUTORITAIRE — celui rangé en
  // premier —, pas une moyenne. Une moyenne de deux prix de marché n'est le prix de
  // personne, et tomberait entre deux ticks.
  return { valeur: presents[0].valeur, chemins: presents.map((c) => `${c.nom} = ${c.valeur}`), ecart,
           absents: absents.map((c) => `${c.nom} : ${c.motif || 'absent'}`) };
}
