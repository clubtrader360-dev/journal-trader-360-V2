// ========================================
// #20 — Destinataires du brief matinal depuis le TABLEUR Manu (source de vérité).
// Onglet "👥 Parcours Membre", lignes membres à partir de la 4 (onglet lu en entier).
//   - « Statut » : exclut 🔴 Inactif ; garde le reste (🟢 T360, 🟠 À surveiller,
//                  🟠 Peu impliqués, Moyen…).
//   - email : « Mail LearnyBox » prioritaire, fallback « 2ème mail » (multi-valeurs).
//   - dedup (email lowercase) + validation regex.
// Les colonnes sont retrouvées par leur TITRE en ligne 3 (api/_lib/parcours-colonnes.js) :
// Manu peut les déplacer. Titre absent ou en double → erreur levée, aucune liste renvoyée
// (mieux vaut pas de brief qu'un brief envoyé à une colonne prise pour des e-mails).
// SA Google en scope 'spreadsheets' déjà en place (cf api/coach/_lib/sheets-client.js).
// ========================================

import { getSheetsClient, getSheetId } from '../coach/_lib/sheets-client.js';
import { readParcours, TITRES } from './parcours-colonnes.js';

// Onglet lu en entier, plage ouverte : les membres ajoutés en bas restent visibles, les
// lignes sans email valide sont écartées par pickEmail().
const TITRES_REQUIS = [TITRES.PRENOM, TITRES.NOM, TITRES.STATUT, TITRES.MAIL_LB, TITRES.MAIL_PERSO];
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// ---- Coachs : ajoutés EN DUR, volontairement hors tableur ----
// Décision produit : l'onglet "👥 Parcours Membre" de Manu est la source de vérité des
// ÉLÈVES et sert de base à ses décomptes (suivi, relances, statistiques d'engagement).
// Y insérer les coachs ferait passer ses totaux à 77 dont 3 non-élèves et fausserait
// toutes ses lignes. Les coachs sont donc concaténés ici, après lecture du tableur.
// Conséquence assumée : cette liste se maintient dans le code, pas dans le tableur.
const COACH_RECIPIENTS = [
  { email: 'clubtrader360@gmail.com',   prenom: 'Emmanuel', nom: 'Trader 360', statut: 'Coach', name: 'Coach Trader 360' },
  { email: 'nkasmi59@gmail.com',        prenom: 'Nadir',    nom: 'Kasmi',      statut: 'Coach', name: 'Nadir Kasmi' },
  { email: 'emmanuel.galiano@gmail.com', prenom: 'Emmanuel', nom: 'Galiano',   statut: 'Coach', name: 'Emmanuel Galiano' },
];

// Email retenu pour une ligne : « Mail LearnyBox » valide en priorité, sinon 1re valeur
// valide de « 2ème mail ». `cols` = index résolus par titre.
function pickEmail(row, cols) {
  const t = String(row[cols[TITRES.MAIL_LB]] || '').trim().toLowerCase();
  if (EMAIL_RE.test(t)) return t;
  const u = String(row[cols[TITRES.MAIL_PERSO]] || '').trim().toLowerCase();
  for (const e of u.split(/[,;\s]+/)) { if (EMAIL_RE.test(e)) return e; }
  return null;
}

// Retourne { recipients: [{ email, prenom, nom, statut, name }], stats }.
export async function getBriefRecipients() {
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();
  const parcours = await readParcours(sheets, spreadsheetId, TITRES_REQUIS);
  if (!parcours.ok) {
    console.error(`[TABLEUR-RECIPIENTS] ⛔ ${parcours.error}`);
    throw new Error(parcours.error);
  }
  const { cols, rows: values } = parcours;

  const stats = { rows: values.length, inactifs: 0, no_valid_email: 0, duplicates: 0, kept: 0, coaches: 0, total: 0 };
  const seen = new Set();
  const recipients = [];

  for (const row of values) {
    const statut = String(row[cols[TITRES.STATUT]] || '').trim();
    if (/inactif/i.test(statut)) { stats.inactifs++; continue; } // exclut 🔴 Inactif

    const email = pickEmail(row, cols);
    if (!email) { stats.no_valid_email++; continue; }

    const key = email.toLowerCase();
    if (seen.has(key)) { stats.duplicates++; continue; }
    seen.add(key);

    const prenom = String(row[cols[TITRES.PRENOM]] || '').trim();
    const nom = String(row[cols[TITRES.NOM]] || '').trim();
    recipients.push({ email, prenom, nom, statut, name: `${prenom} ${nom}`.trim() || prenom || null });
    stats.kept++;
  }

  // Coachs concaténés APRÈS le tableur, donc jamais soumis au filtre de statut :
  // ils ne viennent pas du tableur et n'ont pas de statut à filtrer.
  // Dédup case-insensitive contre `seen`, qui contient déjà les emails élèves : un coach
  // présent par ailleurs dans le tableur reste servi UNE seule fois (sa ligne tableur
  // l'emporte, avec son statut réel). Compté à part pour ne pas polluer stats.duplicates,
  // qui mesure les doublons internes au tableur.
  for (const coach of COACH_RECIPIENTS) {
    const key = coach.email.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    recipients.push({ ...coach, email: key });
    stats.coaches++;
  }

  stats.total = recipients.length; // = kept + coaches
  return { recipients, stats };
}
