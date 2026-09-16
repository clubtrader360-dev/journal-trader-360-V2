// ========================================================================
// Les contrôles. Une valeur qui en échoue un n'est PAS publiée.
//
// La règle tient en une phrase, et elle vient de Trader 360 : mieux vaut un « n/d
// (source indisponible) » chaque matin qu'un chiffre faux un matin sur trois. Un élève
// qui voit n/d va chercher ailleurs ; un élève qui voit un chiffre faux cale ses
// niveaux dessus.
//
// Chaque contrôle rend un MOTIF en clair quand il échoue. Ce motif part dans l'audit
// et dans l'alerte Discord : c'est lui qui rend l'échec visible, au lieu de le laisser
// dans un log que personne ne lit.
// ========================================================================

/** Le dernier jour ouvré américain STRICTEMENT antérieur à la date donnée. */
export function dernierJourOuvre(dateIso, feries = FERIES_US) {
  const [a, m, j] = dateIso.split('-').map(Number);
  let t = Date.UTC(a, m - 1, j);
  for (let n = 0; n < 12; n++) {
    t -= 86400000;
    const d = new Date(t);
    const jour = d.getUTCDay();
    const iso = d.toISOString().slice(0, 10);
    if (jour !== 0 && jour !== 6 && !feries.has(iso)) return iso;
  }
  throw new Error(`aucun jour ouvré trouvé avant ${dateIso}`);
}

// Jours fériés des marchés actions américains. Liste EXPLICITE et non calculée : une
// règle de calcul se trompe silencieusement sur les cas particuliers (Vendredi saint,
// deuils nationaux), alors qu'une date manquante dans cette liste se voit tout de
// suite — le contrôle de date refuse la valeur et le motif part dans l'alerte.
export const FERIES_US = new Set([
  '2026-01-01', '2026-01-19', '2026-02-16', '2026-04-03', '2026-05-25',
  '2026-06-19', '2026-07-03', '2026-09-07', '2026-11-26', '2026-12-25',
  '2027-01-01', '2027-01-18', '2027-02-15', '2027-03-26', '2027-05-31',
  '2027-06-18', '2027-07-05', '2027-09-06', '2027-11-25', '2027-12-24',
]);

/**
 * Les contrôles d'une ligne OHLC.
 *
 * `haut > bas` et `bas ≤ clôture ≤ haut` ne sont pas des précautions théoriques : sur
 * les dix runs audités, deux valeurs d'ES ont été publiées alors que les hauts et bas
 * relevés par le modèle provenaient de conventions de séance différentes (RTH contre
 * Globex), ce qui rendait la clôture hors fourchette sans que rien ne le signale.
 */
export function controlerOhlc(nom, v) {
  const motifs = [];
  const champs = ['haut', 'bas', 'cloture'];
  for (const c of champs) {
    if (typeof v?.[c] !== 'number' || !Number.isFinite(v[c])) motifs.push(`${nom} : « ${c} » absent ou non numérique`);
  }
  if (motifs.length) return motifs;
  if (!(v.haut > v.bas)) motifs.push(`${nom} : haut ${v.haut} non supérieur au bas ${v.bas}`);
  if (v.cloture > v.haut || v.cloture < v.bas) {
    motifs.push(`${nom} : clôture ${v.cloture} hors de la fourchette ${v.bas}–${v.haut}`);
  }
  return motifs;
}

/**
 * La date de la donnée est bien le dernier jour ouvré, strictement antérieure au jour
 * courant.
 *
 * C'est le contrôle qui aurait attrapé le run du 15/09 : le brief y a publié comme
 * « clôture » un champ dont l'audit note lui-même l'horodatage « Delayed Data ».
 */
export function controlerDate(nom, dateDonnee, dateBrief) {
  const attendue = dernierJourOuvre(dateBrief);
  if (!dateDonnee) return [`${nom} : la donnée ne porte aucune date`];
  if (dateDonnee >= dateBrief) return [`${nom} : donnée datée du ${dateDonnee}, non antérieure au brief du ${dateBrief}`];
  if (dateDonnee !== attendue) return [`${nom} : donnée datée du ${dateDonnee}, dernier jour ouvré attendu ${attendue}`];
  return [];
}

/**
 * L'écart ES / SPX comptant reste dans une fourchette plausible.
 *
 * Le « basis » est la prime du future sur le comptant : il vient du portage et des
 * dividendes, et il se resserre à mesure que l'échéance approche. Sur un contrat
 * trimestriel il vaut quelques dizaines de points, jamais zéro et jamais deux cents.
 *
 * ⚠️ LA FOURCHETTE EST LARGE À DESSEIN. Un seuil serré aurait rejeté la bonne valeur
 * le jour du roulement — le 14/09, l'écart ESZ26/SPX valait 70 points, parfaitement
 * normal pour un contrat de décembre, et un seuil à 30 l'aurait écarté. Ce contrôle
 * n'est pas là pour valider le basis au point près : il est là pour attraper l'erreur
 * GROSSIÈRE, celle du mauvais instrument, qui se compte en centaines de points.
 *
 * ⚠️ IL N'ATTRAPE DONC PAS L'INCIDENT DU 14/09, et c'est mesuré : l'écart entre la
 * valeur fautive (ESU26 à 7 659,50) et le SPX valait 2,52 points, soit en plein dans
 * la fourchette. Le contrat publié était faux, le basis avait l'air parfait. C'est
 * `controlerContrat` qui couvre ce cas, et lui seul. Croire que ce contrôle-ci
 * protège du mauvais contrat serait précisément le genre de confiance mal placée qui
 * a produit le problème.
 */
export function controlerBasis(es, spx, { min = -20, max = 180 } = {}) {
  if (typeof es !== 'number' || typeof spx !== 'number') return [];
  const ecart = es - spx;
  if (ecart < min || ecart > max) {
    return [`ES : écart au SPX comptant de ${ecart.toFixed(2)} pts, hors de la fourchette plausible [${min}, ${max}]`];
  }
  return [];
}

/**
 * Le contrat obtenu est bien celui demandé.
 *
 * TradingView rend `expiration` au format AAAAMMJJ et `description` en clair. Les deux
 * sont comparés au front-month calculé : un ticker qui pointerait encore sur le
 * contrat précédent après le roulement est refusé ici, et c'est précisément l'incident
 * du 14/09 que ce contrôle rend impossible.
 */
export function controlerContrat(donnee, attendu) {
  const motifs = [];
  if (donnee?.contrat !== attendu.contrat) {
    motifs.push(`ES : contrat ${donnee?.contrat} obtenu, ${attendu.contrat} attendu`);
  }
  const expIso = String(donnee?.expiration ?? '').replace(/^(\d{4})(\d{2})(\d{2})$/, '$1-$2-$3');
  if (expIso !== attendu.expirationIso) {
    motifs.push(`ES : expiration ${expIso || 'absente'} annoncée par la source, ${attendu.expirationIso} attendue`);
  }
  return motifs;
}
