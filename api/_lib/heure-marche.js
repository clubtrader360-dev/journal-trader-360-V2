// ========================================================================
// Les heures de Paris des rendez-vous américains, selon la date (25/10/2026).
//
// ⚠️ L'Europe et les États-Unis ne changent pas d'heure le même jour : dernier
// dimanche d'octobre pour l'Europe, premier dimanche de novembre pour New York (et de
// même au printemps, à trois semaines d'écart). Pendant ces semaines-là, l'ouverture
// de Wall Street tombe à 14h30 à Paris au lieu de 15h30, et les statistiques de 14h30
// passent à 13h30. Le prompt du brief écrivait ces heures EN DUR : sans ce module, le
// brief aurait annoncé une heure fausse, avec aplomb, une semaine sur deux de l'année.
// ========================================================================

const decalage = (tz, d) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hour: 'numeric', hourCycle: 'h23', minute: 'numeric', day: 'numeric' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  const h = Number(p.hour) + Number(p.minute) / 60;
  let dh = h - (d.getUTCHours() + d.getUTCMinutes() / 60);
  if (Number(p.day) !== d.getUTCDate()) dh += Number(p.day) > d.getUTCDate() || (Number(p.day) === 1 && d.getUTCDate() > 27) ? 24 : -24;
  return Math.round(dh);
};
const ecartParisNy = (d) => decalage('Europe/Paris', d) - decalage('America/New_York', d);
const heureParis = (hNy, mNy, ecart) => `${hNy + ecart}h${String(mNy).padStart(2, '0')}`;

/** La phrase à injecter dans le prompt, pour le matin `dateIso` (AAAA-MM-JJ). */
export function contexteHoraire(dateIso) {
  const midi = new Date(`${dateIso}T12:00:00Z`);
  const ecart = ecartParisNy(midi);
  const semainePassee = ecartParisNy(new Date(midi.getTime() - 7 * 86400000));
  const parisAvant = decalage('Europe/Paris', new Date(midi.getTime() - 7 * 86400000));
  const nyAvant = decalage('America/New_York', new Date(midi.getTime() - 7 * 86400000));
  const changements = [];
  if (decalage('Europe/Paris', midi) !== parisAvant) changements.push(`la France est passée à l'heure ${decalage('Europe/Paris', midi) < parisAvant ? "d'hiver" : "d'été"} ces derniers jours`);
  if (decalage('America/New_York', midi) !== nyAvant) changements.push(`les États-Unis sont passés à l'heure ${decalage('America/New_York', midi) < nyAvant ? "d'hiver" : "d'été"} ces derniers jours`);
  const heures = `Heures de Paris ce jour : statistiques américaines de 8h30 à New York = ${heureParis(8, 30, ecart)}, ouverture de Wall Street = ${heureParis(9, 30, ecart)}, décision de la Fed (14h00 à New York) = ${heureParis(14, 0, ecart)}.`;
  const decale = ecart !== 6
    ? ` ATTENTION, semaine décalée : l'écart Paris / New York n'est que de ${ecart} heures (au lieu de 6), les rendez-vous américains arrivent une heure plus tôt que d'habitude. Utilise ces heures-là, jamais 14h30 / 15h30 par habitude.`
    : ' Les horaires habituels reviennent.';
  const note = changements.length || ecart !== semainePassee || ecart !== 6
    ? ` CHANGEMENT D'HEURE à signaler aux lecteurs, en une phrase claire en tête de brief : ${changements.join(' et ') || "l'écart horaire avec New York a changé"}.${decale}`
    : '';
  return heures + note;
}
