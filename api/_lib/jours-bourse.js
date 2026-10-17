// ========================================
// Ancienneté de la dernière saisie de journal, en JOURS DE BOURSE (lundi → vendredi).
// Règles Manu du 17/10/2026 pour la colonne « Journal » du tableur :
//   - ≤ 3 jours de bourse depuis la dernière saisie  → la note T360 ;
//   - > 3                                            → « non rempli » ;
//   - > 20                                           → « vide ».
// Date de référence : created_at de la dernière saisie (le jour où le membre a écrit),
// ramené au jour calendaire de Paris. Samedi et dimanche ne comptent pas ; aucun férié.
// ========================================

export const SEUIL_NON_REMPLI = 3;  // au-delà : « non rempli »
export const SEUIL_VIDE = 20;       // au-delà : « vide »

// 'YYYY-MM-DD' du jour de Paris d'un instant. `created_at` est un timestamp SANS fuseau
// stocké en UTC (default now() d'un Postgres en UTC) : supabase-js le renvoie sans « Z »,
// on le lit donc explicitement comme de l'UTC.
export function parisDayOf(ts) {
  let s = String(ts || '').trim();
  if (!s) return null;
  if (!/[zZ]$|[+-]\d{2}:?\d{2}$/.test(s)) s = s.replace(' ', 'T') + 'Z';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' }); // 'sv-SE' → 'YYYY-MM-DD'
}

// Jours ouvrés (lun-ven) strictement après `fromDay` et jusqu'à `toDay` inclus.
// Saisie le vendredi, lundi suivant → 1 ; saisie le jour même → 0.
export function joursBourseEntre(fromDay, toDay) {
  const from = Date.parse(`${fromDay}T00:00:00Z`);
  const to = Date.parse(`${toDay}T00:00:00Z`);
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) return 0;
  let n = 0;
  for (let t = from + 86400000; t <= to; t += 86400000) {
    const wd = new Date(t).getUTCDay();
    if (wd !== 0 && wd !== 6) n++;
  }
  return n;
}
