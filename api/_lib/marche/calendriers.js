// ========================================================================
// LES CALENDRIERS DE SÉANCE, UN PAR PLACE (brief v22, 26/11/2026).
//
// « La dernière séance réglée de SA place » : un jour férié américain n'est pas un
// jour férié européen. Le 26/11/2026 (Thanksgiving), Wall Street est fermée mais Xetra
// et Euronext cotent. Le brief du 27 publie donc les clôtures du 25 pour le S&P 500 et
// le Nasdaq, et celles du 26 pour le DAX, le CAC 40 et l'OAT.
//
// Listes EXPLICITES et non calculées, comme FERIES_US : une règle de calcul se trompe
// en silence sur les cas particuliers, une date manquante se voit (la source rend une
// autre date, le contrôle refuse, le brief attend et l'alerte le dit).
// ⚠️ Au-delà de la dernière année listée, `derniereSeance` LÈVE une erreur : un
// calendrier vide n'est pas un calendrier sans jour férié.
// ========================================================================
import { FERIES_US } from './validation.js';

// Xetra (Deutsche Börse) : fermé le 24 et le 31 décembre, ouvert le lundi de Pentecôte
// et le 3 octobre.
const FERIES_DE = new Set([
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-12-24', '2026-12-25', '2026-12-31',
  '2027-01-01', '2027-03-26', '2027-03-29', '2027-12-24', '2027-12-31',
]);

// Euronext Paris (CAC 40) et marché de l'OAT : fermetures TARGET (1er janvier, Vendredi
// saint, lundi de Pâques, 1er mai, 25 et 26 décembre). Les 24 et 31 décembre sont des
// séances écourtées, pas des fermetures.
const FERIES_FR = new Set([
  '2026-01-01', '2026-04-03', '2026-04-06', '2026-05-01', '2026-12-25',
  '2027-01-01', '2027-03-26', '2027-03-29',
]);

const DERNIERE_ANNEE = 2027;

export const PLACES = {
  US: { nom: 'États-Unis', feries: FERIES_US, fuseau: 'America/New_York', weekend: true },
  DE: { nom: 'Allemagne', feries: FERIES_DE, fuseau: 'Europe/Berlin', weekend: true },
  FR: { nom: 'France', feries: FERIES_FR, fuseau: 'Europe/Paris', weekend: true },
  // Le Bitcoin cote tous les jours : sa « séance » est la journée UTC, close à minuit UTC.
  BTC: { nom: 'Bitcoin', feries: new Set(), fuseau: 'UTC', weekend: false },
};

const iso = (t) => new Date(t).toISOString().slice(0, 10);
const jourMs = 86400000;

export function estSeance(place, dateIso) {
  const p = PLACES[place];
  if (!p) throw new Error(`place inconnue : ${place}`);
  if (Number(dateIso.slice(0, 4)) > DERNIERE_ANNEE) {
    throw new Error(`calendrier ${place} non renseigné pour ${dateIso.slice(0, 4)} (api/_lib/marche/calendriers.js)`);
  }
  const j = new Date(`${dateIso}T00:00:00Z`).getUTCDay();
  if (p.weekend && (j === 0 || j === 6)) return false;
  return !p.feries.has(dateIso);
}

/** La séance de la place STRICTEMENT antérieure à `dateIso`. */
export function seanceAvant(place, dateIso) {
  let t = Date.parse(`${dateIso}T00:00:00Z`);
  for (let n = 0; n < 15; n++) {
    t -= jourMs;
    if (estSeance(place, iso(t))) return iso(t);
  }
  throw new Error(`aucune séance ${place} trouvée avant ${dateIso}`);
}

/** La dernière séance RÉGLÉE de la place au matin du brief : la séance d'avant le jour du brief. */
export const derniereSeance = (place, dateBrief) => seanceAvant(place, dateBrief);

/** La date d'un instant (ms) dans le fuseau de la place. */
export function dateLocale(place, ms) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: PLACES[place].fuseau, year: 'numeric', month: '2-digit', day: '2-digit' })
    .format(new Date(ms));
}
