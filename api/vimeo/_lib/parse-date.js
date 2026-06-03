// ========================================
// PARSE — date de live extraite d'un titre Vimeo
// ========================================
// Convention Manu : préfixe `JJ_MM_AAAA` (séparateurs tolérés : _, -, /, espace)
// au début du titre. Vimeo transforme parfois `/` et `-` en `_`, on accepte
// donc toutes ces variantes. Année 2 chiffres acceptée et résolue en 20xx.
//
// Exemples acceptés :
//   "07_04_2026 - 7H - TP - Avec Guillaume" → 2026-04-07
//   "7-4-2026 - 8H"                         → 2026-04-07
//   "07/04/2026 - …"                        → 2026-04-07
//   "7 4 26 - …"                            → 2026-04-07
// Refusé :
//   "Live SP500"                            → null
//   "Replay du jeudi"                       → null
// ========================================

export function parseDateFromTitle(title) {
  if (!title || typeof title !== 'string') return null;

  // 1-2 chiffres (jour) + séparateur + 1-2 chiffres (mois) + séparateur + 2 ou 4 chiffres (année),
  // ancré au début (après trim). `\b` après l'année évite de matcher 20261 → 2026 par hasard.
  const match = title.trim().match(/^(\d{1,2})[\s_\-\/](\d{1,2})[\s_\-\/](\d{2,4})\b/);
  if (!match) return null;

  let [, day, month, year] = match;
  day = parseInt(day, 10);
  month = parseInt(month, 10);
  year = parseInt(year, 10);

  // Validation calendaire basique (pas de validation jours/mois plus fine —
  // 31/02 passerait, mais c'est un cas d'école improbable côté replays).
  if (day < 1 || day > 31) return null;
  if (month < 1 || month > 12) return null;

  // Année 2 chiffres : "26" → 2026 (on assume 20xx pour les années récentes).
  if (year < 100) year = 2000 + year;
  // Garde-fou : refuse années aberrantes (avant 2020 ou après 2050).
  if (year < 2020 || year > 2050) return null;

  // Format YYYY-MM-DD (zero-padded) — compatible directement avec colonne DATE Postgres.
  const yyyy = String(year);
  const mm = String(month).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
