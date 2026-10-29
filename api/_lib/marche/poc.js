// ========================================================================
// Le POC (point of control) de la veille sur l'ES, calculé par le CODE.
//
// Demande de Nadir, 29/10/2026. Aucune source publique ne PUBLIE le POC journalier de
// l'ES : on ne le trouve que dans des indicateurs à poser sur un graphique. On le
// calcule donc comme le fait l'indicateur « Volume Profile » de TradingView : à partir
// des barres d'une minute de la séance, en répartissant le volume de chaque minute à
// parts égales sur chaque tick (0,25 point) entre son bas et son haut. Le POC est le
// prix qui a concentré le plus de volume.
//
// ⚠️ LA SÉANCE EST LA SÉANCE RÉGULIÈRE, 9h30 à 16h00 à New York (15h30 à 22h00 à
// Paris en temps normal). C'est la séance du règlement publié en CLÔTURE : les deux
// valeurs du tableau parlent donc de la même journée.
//
// ⚠️ UN CALCUL SUR DES BARRES À LA MINUTE APPROCHE LE POC AU TICK PRÈS, il ne le
// mesure pas au contrat près : deux plateformes peuvent différer d'un ou deux ticks.
// C'est la même approximation que l'indicateur de TradingView.
// ========================================================================

export const TICK = 0.25;
export const MINUTES_SEANCE = 390;          // 9h30 → 16h00
export const COUVERTURE_MIN = 370;          // au moins 370 minutes sur 390
export const ECART_CLOTURE_MAX = 5;         // dernière minute contre règlement, en points

/** Les minutes de la séance régulière, triées, dédoublonnées. `hhmm` en heure de New York. */
export function minutesSeance(barres) {
  const vues = new Map();
  for (const b of barres) {
    if (!(b.hhmm >= 930 && b.hhmm < 1600)) continue;
    vues.set(b.hhmm, b);
  }
  return [...vues.values()].sort((a, b) => a.hhmm - b.hhmm);
}

/**
 * Le POC d'un ensemble de barres { haut, bas, volume }. Rend { poc, volume, ticks }.
 * À égalité de volume, le tick le plus proche du prix moyen pondéré l'emporte : une
 * règle fixe, pour qu'un même jeu de barres rende toujours le même POC.
 */
export function calculerPoc(barres, tick = TICK) {
  const profil = new Map();
  let volume = 0, somme = 0;
  for (const b of barres) {
    if (!(b.volume > 0) || !(b.haut >= b.bas)) continue;
    const bas = Math.round(b.bas / tick), haut = Math.round(b.haut / tick);
    const n = haut - bas + 1;
    for (let k = bas; k <= haut; k++) profil.set(k, (profil.get(k) || 0) + b.volume / n);
    volume += b.volume;
    somme += b.volume * (b.haut + b.bas) / 2;
  }
  if (!volume) return { poc: null, volume: 0, ticks: 0 };
  const moyen = somme / volume / tick;
  let meilleur = null;
  for (const [k, v] of profil) {
    if (!meilleur || v > meilleur.v + 1e-9 || (Math.abs(v - meilleur.v) <= 1e-9 && Math.abs(k - moyen) < Math.abs(meilleur.k - moyen))) meilleur = { k, v };
  }
  return { poc: Math.round(meilleur.k * tick * 100) / 100, volume, ticks: profil.size };
}

/**
 * Contrôle puis calcule. `controle` : { reglement, hautJour, basJour } (valeurs déjà
 * vérifiées par la collecte, chacune peut manquer). Rend { valeur } ou { motif }.
 */
export function pocControle(barres, controle = {}) {
  const m = minutesSeance(barres);
  if (m.length < COUVERTURE_MIN) return { motif: `POC : ${m.length} minutes sur ${MINUTES_SEANCE} pour la séance régulière, ${COUVERTURE_MIN} exigées` };
  const avecVolume = m.filter((b) => b.volume > 0).length;
  if (avecVolume < m.length * 0.95) return { motif: `POC : volume absent sur ${m.length - avecVolume} minutes sur ${m.length}` };
  const haut = Math.max(...m.map((b) => b.haut)), bas = Math.min(...m.map((b) => b.bas));
  const { reglement, hautJour, basJour } = controle;
  if (typeof hautJour === 'number' && haut > hautJour + 0.5) return { motif: `POC : haut des minutes ${haut} au-dessus du haut du jour ${hautJour} (autre contrat ?)` };
  if (typeof basJour === 'number' && bas < basJour - 0.5) return { motif: `POC : bas des minutes ${bas} sous le bas du jour ${basJour} (autre contrat ?)` };
  const derniere = m.at(-1);
  if (typeof reglement === 'number' && Math.abs(derniere.cloture - reglement) > ECART_CLOTURE_MAX) {
    return { motif: `POC : dernière minute à ${derniere.cloture}, règlement ${reglement} (autre contrat ou autre séance ?)` };
  }
  const r = calculerPoc(m);
  if (r.poc === null || r.poc < bas || r.poc > haut) return { motif: 'POC : calcul impossible sur ces minutes' };
  return { valeur: r.poc, minutes: m.length, volume: r.volume };
}
