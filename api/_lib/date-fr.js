// ========================================================================
// FORMATAGE DE DATE EN FRANÇAIS — source de vérité unique
//
// POURQUOI CE FICHIER EXISTE.
// Le workflow construisait la date longue avec `LC_TIME=fr_FR.UTF-8 date`, suivi
// d'un repli `||`. Cette locale n'est pas installée sur le runner GitHub, mais
// `date` NE PLANTE PAS pour autant : il sort simplement en anglais, avec un code
// de retour 0. Le repli ne pouvait donc jamais se déclencher, et les 74 élèves ont
// reçu « Thursday 3 September 2026 » sans qu'aucun signal ne le révèle.
//
// Une locale système est une dépendance d'environnement qui peut disparaître à la
// prochaine mise à jour de l'image, en silence. Pire, quand elle EST présente, sa
// sortie varie : macOS rend « Lundi 7 septembre 2026 » avec une capitale, Linux
// rend « lundi 7 septembre 2026 » sans. Le même code produit deux résultats.
//
// Intl embarque ICU dans Node, ne dépend d'aucune locale système, et donne le même
// résultat partout. C'est la seule façon d'avoir une sortie déterministe.
//
// Ce module n'a AUCUNE dépendance : le workflow peut l'appeler directement avec
// `node -e`, ce qui évite de dupliquer la logique entre le workflow et l'endpoint.
// ========================================================================

const FUSEAU = 'Europe/Paris';

const FORMATEUR = new Intl.DateTimeFormat('fr-FR', {
  weekday: 'long',
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  timeZone: FUSEAU,
});

/**
 * « 2026-09-03 » → « jeudi 3 septembre 2026 »
 *
 * Sortie en MINUSCULES, qui est la forme correcte en français au milieu d'une
 * phrase (« brief du jeudi 3 septembre »). Les emplacements qui commencent un bloc
 * appliquent `capitaliser()` par-dessus.
 *
 * @param {string} dateIso date au format AAAA-MM-JJ
 * @returns {string}
 */
export function formatDateLongFr(dateIso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateIso || ''))) {
    throw new Error(`formatDateLongFr : date ISO attendue (AAAA-MM-JJ), reçu « ${dateIso} »`);
  }

  // Midi UTC et non minuit : à minuit UTC, un fuseau à l'ouest de Greenwich
  // basculerait sur la veille. Midi laisse une marge de douze heures de chaque
  // côté, donc la date reste la bonne quel que soit le fuseau de formatage.
  const date = new Date(`${dateIso}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) {
    throw new Error(`formatDateLongFr : date invalide « ${dateIso} »`);
  }

  const rendu = FORMATEUR.format(date);

  // Le premier jour du mois s'écrit « 1er » en français. Intl produit « 1 ».
  // L'ancrage sur l'espace qui suit évite de toucher au « 1 » de l'année (2016…)
  // ou à un quantième comme « 21 ».
  return rendu.replace(/(^|\s)1 /, '$11er ');
}

/**
 * Capitale initiale, sans toucher au reste. Réservé aux emplacements où la date
 * ouvre un bloc autonome. Jamais utilisé au milieu d'une phrase : « brief du Jeudi »
 * serait une capitale à l'anglaise.
 *
 * @param {string} texte
 * @returns {string}
 */
export function capitaliser(texte) {
  const s = String(texte || '');
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}
