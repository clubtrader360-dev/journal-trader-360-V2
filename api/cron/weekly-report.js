// ========================================
// API ROUTE : RAPPORT HEBDOMADAIRE AUTOMATIQUE (#19)
// Route : /api/cron/weekly-report
// Déclenché par une scheduled task externe (Cowork) le dimanche 18h Paris,
// via HTTP + Bearer CRON_SECRET (le cron Vercel a été retiré de vercel.json).
// Système expert + design Bourse à l'Aube + Trader 360 Score (cf _lib/weekly-expert-system.js).
// ========================================

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

/**
 * ⚠️ LA STRUCTURE DE LA FORMATION, LUE DEPUIS LE FICHIER DU NAVIGATEUR.
 *
 * ⛔ Ni `import` ni `require` ne marchent ici, et le second echoue EN SILENCE :
 * le depot est en `"type": "module"`, donc `createRequire` d un `.js` rend un
 * objet VIDE sans lever d erreur. ⚠️ Mesure du 12/10/2026, et ma premiere garde
 * `D ? ... : 0` le laissait passer, parce qu un objet vide est VRAI. Elle testait
 * la verite, pas l usabilite.
 *
 * Le fichier est donc evalue : il pose sa structure sur `globalThis`, et on la
 * reprend. ⛔ Le dupliquer ici la ferait diverger au premier module ajoute, et le
 * mail parlerait d une lecon qui n existe plus.
 */
let DONNEES_FORMATION = null;
try {
  const ici = path.dirname(fileURLToPath(import.meta.url));
  const source = readFileSync(path.join(ici, '../../assets/formation-donnees.js'), 'utf8');
  // eslint-disable-next-line no-new-func
  new Function(source)();
  const candidat = globalThis.FormationDonnees;
  // ⛔ ON TESTE CE QU ON VA APPELER, pas la verite de l objet.
  DONNEES_FORMATION = (candidat && typeof candidat.total === 'function'
    && Array.isArray(candidat.SUITE)) ? candidat : null;
  if (!DONNEES_FORMATION) {
    console.warn('[WEEKLY-REPORT] ⚠️ structure de formation chargee mais inutilisable');
  }
} catch (e) {
  console.warn('[WEEKLY-REPORT] ⚠️ structure de formation illisible :', e && e.message);
}

import { generateWeeklyReportHTML, generatePassiveReportHTML, generateFormationReportHTML, formatDate } from './_lib/weekly-expert-system.js';
import { resumeEleve, genererRapportCoachs } from './_lib/rapport-coachs.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zgihbpgoorymomtsbxpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Sécurité de test : si WEEKLY_REPORT_DRY_RUN = '1', on génère mais on N'ENVOIE PAS.
const DRY_RUN = process.env.WEEKLY_REPORT_DRY_RUN === '1';

// ---- Bornes de la semaine ISO (lundi 00:00 → dimanche 23:59) à partir d'une date ----
export function getWeekBounds(now = new Date()) {
  const day = now.getDay(); // 0 = dimanche
  const daysToMonday = day === 0 ? 6 : day - 1;
  const start = new Date(now); start.setDate(now.getDate() - daysToMonday); start.setHours(0, 0, 0, 0);
  const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23, 59, 59, 999);
  return { startDateStr: start.toISOString().split('T')[0], endDateStr: end.toISOString().split('T')[0] };
}

export function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ---- Élèves éligibles : role=student, status=active, NON en vacation_mode ----
export async function fetchEligibleStudents(supabase) {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, uuid, email, name, role, status')
    .eq('role', 'student')
    .eq('status', 'active')
    .not('email', 'is', null);
  if (error) throw error;

  const uuids = (users || []).map(u => u.uuid).filter(Boolean);
  let vacationMap = new Map();
  if (uuids.length) {
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('user_id, vacation_mode')
      .in('user_id', uuids);
    vacationMap = new Map((prefs || []).map(p => [p.user_id, p.vacation_mode === true]));
  }
  return (users || []).filter(u => u.uuid && !vacationMap.get(u.uuid));
}

// ---- Signaux de dispatch, mesurés sur la SEMAINE ISO du rapport ----
// Les deux comptages utilisent la fenêtre [startDateStr, endDateStr] de getWeekBounds(),
// donc exactement la période analysée dans le rapport.
async function countEntriesInWeek(supabase, uuid, startDateStr, endDateStr) {
  const { count, error } = await supabase
    .from('journal_entries')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', uuid)
    .gte('entry_date', startDateStr)
    .lte('entry_date', endDateStr);
  if (error) throw error;
  return count || 0;
}

async function countTradesInWeek(supabase, uuid, startDateStr, endDateStr) {
  const { count, error } = await supabase
    .from('trades')
    .select('user_id', { count: 'exact', head: true })
    .eq('user_id', uuid)
    .gte('trade_date', startDateStr)
    .lte('trade_date', endDateStr);
  if (error) throw error;
  return count || 0;
}

export async function buildUserReport(supabase, user, period, { preview = false } = {}) {
  const { startDateStr, endDateStr } = period;
  const uid = user.uuid; // toutes les tables référencent user_id = auth uuid

  const [{ data: trades }, { data: journalEntries }, { data: accounts }, { data: historicalTrades }] = await Promise.all([
    supabase.from('trades').select('*').eq('user_id', uid).gte('trade_date', startDateStr).lte('trade_date', endDateStr),
    supabase.from('journal_entries').select('*').eq('user_id', uid).gte('entry_date', startDateStr).lte('entry_date', endDateStr),
    supabase.from('accounts').select('id, name, active, risk_per_trade, initial_balance').eq('user_id', uid),
    supabase.from('trades').select('pnl, trade_date, account_id, is_break_even').eq('user_id', uid).lt('trade_date', startDateStr),
  ]);

  const weekTrades = trades || [];
  const weekJournal = journalEntries || [];

  // Seul le manque de trades empêche de construire un rapport chiffré.
  // Un journal vide est désormais TOLÉRÉ : le rapport part en version « actif chiffres »
  // avec un encart d'alerte (cf. generateWeeklyReportHTML, journaledDays === 0).
  if (weekTrades.length === 0) return { skip: '0 trades' };

  const { html, attachments } = generateWeeklyReportHTML({
    user,
    trades: weekTrades,
    journalEntries: weekJournal,
    accounts: accounts || [],
    historicalTrades: historicalTrades || [],
    startDate: startDateStr,
    endDate: endDateStr,
    radarMode: preview ? 'datauri' : 'cid', // preview navigateur = data URI ; email = CID attachment
  });
  // Le résumé destiné au rapport des coachs, calculé sur les MÊMES données.
  const resume = resumeEleve({
    user, trades: weekTrades, journalEntries: weekJournal, accounts: accounts || [],
    historicalTrades: historicalTrades || [], startDate: startDateStr,
  });
  return { html, attachments, resume };
}

// ========================================
// Dispatch 3 versions pour UN élève, sur 2 signaux (trades + journal de la semaine).
// Garantie : retourne TOUJOURS un email à envoyer — aucun skip silencieux.
//
//   tradesWeek | entriesWeek | version
//   -----------|-------------|--------------------------------------------------
//        0     |      *      | 'passive'           — motivation, rien à analyser
//       ≥1     |     ≥1      | 'active'            — rapport complet
//       ≥1     |      0      | 'active_no_journal' — chiffres + encart alerte
// ========================================
/** ⚠️ Texte public, a confirmer par Nadir : il part au nom des coachs. */
const FORMATION_SUBJECT = `Ou tu en es dans ta formation`;
/**
 * Les droits d un membre. ⚠️ `null` si la lecture echoue : on ne sait pas, et on
 * ne pretend pas savoir. ⛔ La table peut aussi ne pas exister sur un
 * environnement plus ancien, et cela ne doit pas empecher le rapport de partir.
 */
async function lireDroits(supabase, uuid) {
  if (!uuid) return null;
  const { data, error } = await supabase
    .from('acces_membre')
    .select('formation_actif, journal_actif')
    .eq('user_id', uuid)
    .maybeSingle();
  if (error) {
    console.warn(`[WEEKLY-REPORT] ⚠️ droits illisibles pour ${uuid} : ${error.message}`);
    return null;
  }
  return data;
}

/**
 * Ou en est l eleve dans sa formation. ⚠️ La structure vient du MEME fichier que
 * l espace membre, `assets/formation-donnees.js` : ⛔ la dupliquer ici la ferait
 * diverger au premier module ajoute, et le mail parlerait d une lecon qui
 * n existe plus.
 */
async function lireProgressionFormation(supabase, uuid) {
  const { data, error } = await supabase
    .from('formation_progression')
    .select('lecon_id, vue')
    .eq('user_id', uuid);
  if (error) {
    console.warn(`[WEEKLY-REPORT] ⚠️ progression illisible pour ${uuid} : ${error.message}`);
    return { vues: 0, total: 0, suivante: null };
  }
  const vues = new Set((data || []).filter((r) => r.vue).map((r) => r.lecon_id));
  const D = DONNEES_FORMATION;
  // ⚠️ `D` est soit utilisable, soit `null` : la verification a eu lieu au
  // chargement, une fois, plutot qu a chaque appel.
  const total = D ? D.total() : 0;
  const suivante = D ? (D.SUITE.find((l) => !vues.has(l.id)) || null) : null;
  return {
    vues: vues.size,
    total,
    suivante: suivante ? `Module ${suivante.module} · ${suivante.titre}` : null,
  };
}

const PASSIVE_SUBJECT = `Ton rapport de la semaine — pas de data cette fois`;

/**
 * ⚠️ EXPORTEE POUR POUVOIR ETRE EPROUVEE. Le choix de variante est la decision
 * la plus delicate de ce fichier : sans export, on ne pourrait la verifier qu en
 * envoyant de vrais courriels, ⛔ ce qui n est pas un banc d essai.
 */
export async function generateForUser(supabase, user, period) {
  const [entriesWeek, tradesWeek] = await Promise.all([
    countEntriesInWeek(supabase, user.uuid, period.startDateStr, period.endDateStr),
    countTradesInWeek(supabase, user.uuid, period.startDateStr, period.endDateStr),
  ]);

  // Le rapport passif porte lui aussi son logo en pièce jointe inline : il rend donc
  // { html, attachments } comme le rapport actif, et non plus une simple chaîne.
  const passive = () => {
    const { html, attachments } = generatePassiveReportHTML({ user });
    return { html, attachments, subject: PASSIVE_SUBJECT, reportType: 'passive', entriesWeek, tradesWeek };
  };

  /**
   * ── ⛔ LE DROIT D ABORD, LES TRADES ENSUITE ──────────────────────────────
   *
   * La variante passive dit « tu n as pas rempli ton journal dans les 3 derniers
   * jours ». Pour quelqu un qui n a PAS le droit journal, c est un reproche a
   * propos d un outil qu il ne peut pas ouvrir, ⚠️ et il le recevrait chaque
   * dimanche.
   *
   * ⛔ LE TEST PORTE DONC SUR LE DROIT, ET IL PASSE AVANT CELUI DES TRADES.
   * Un eleve qui A le journal et ne l a pas rempli garde la variante passive,
   * qui lui est justement destinee : « n a pas trade » et « n a pas le droit de
   * trader ici » ne sont pas la meme chose.
   *
   * ⚠️ UNE LECTURE EN ERREUR NE VAUT PAS « PAS DE DROIT ». On ne sait pas, donc
   * on garde le comportement d avant : mieux vaut un rapport un peu a cote
   * qu un silence, et le journaliser permet de le voir.
   */
  const droits = await lireDroits(supabase, user.uuid);
  if (droits && droits.formation_actif && !droits.journal_actif) {
    const progression = await lireProgressionFormation(supabase, user.uuid);
    const { html, attachments } = generateFormationReportHTML({ user, progression });
    return { html, attachments, subject: FORMATION_SUBJECT, reportType: 'formation', entriesWeek, tradesWeek };
  }

  /**
   * ⚠️ AUCUN DES DEUX DROITS : on n envoie RIEN. Lui parler de sa formation
   * serait faux, lui parler de son journal aussi. ⛔ Mesure du 12/10/2026 :
   * aucun compte n est dans ce cas aujourd hui, les 82 destinataires ont les deux
   * droits. C est donc une precaution, pas un correctif.
   */
  if (droits && !droits.formation_actif && !droits.journal_actif) {
    console.log(`[WEEKLY-REPORT] ⏭️ ${user.email} n a aucun droit : aucun rapport envoye`);
    return null;
  }

  // Aucun trade → rapport passif (peu importe le journal : rien de chiffré à analyser)
  if (tradesWeek === 0) return passive();

  // Trades ≥ 1 → rapport actif, avec ou sans insights journal
  const report = await buildUserReport(supabase, user, period);
  if (!report.skip) {
    return {
      html: report.html,
      attachments: report.attachments,
      subject: `📊 Ton rapport hebdomadaire — semaine du ${formatDate(period.startDateStr)}`,
      reportType: entriesWeek >= 1 ? 'active' : 'active_no_journal',
      entriesWeek, tradesWeek, resume: report.resume,
    };
  }

  // Filet de sécurité : buildUserReport skip pour une raison inattendue → passif
  console.log(`[WEEKLY-REPORT] ⏬ Fallback passif pour ${user.email} : ${report.skip} (tradesWeek=${tradesWeek}, entriesWeek=${entriesWeek})`);
  return passive();
}

// ========================================
// HANDLER (déclenché par la scheduled task Cowork via Bearer CRON_SECRET)
// ========================================
export default async function handler(req, res) {
  console.log('[WEEKLY-REPORT] ========== START ==========', DRY_RUN ? '(DRY_RUN)' : '');

  // En preview, l'URL est protégée par Vercel Authentication → on relâche le check CRON_SECRET
  // UNIQUEMENT en preview. En production, le Bearer reste obligatoire (tâche Cowork).
  const isPreview = process.env.VERCEL_ENV !== 'production';
  const cronSecret = process.env.CRON_SECRET;
  if (!isPreview) {
    if (!cronSecret) return res.status(500).json({ error: 'Missing CRON_SECRET' });
    if (req.headers.authorization !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });

  // Mode test ciblé : ?onlyUserId=<uuid> → n'envoie qu'à cet élève (filtre éligibilité conservé).
  const onlyUserId = req.query.onlyUserId || null;
  if (onlyUserId) console.log(`[WEEKLY-REPORT] 🎯 Mode test : envoi UNIQUEMENT à ${onlyUserId}`);

  // Override destinataire (test sans domaine Resend validé) — PREVIEW UNIQUEMENT.
  const testTo = req.query.testTo || null;
  if (testTo) {
    if (!isPreview) return res.status(403).json({ error: 'testTo only allowed in preview deployments' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(testTo)) return res.status(400).json({ error: 'testTo : email invalide' });
    if (!onlyUserId) return res.status(400).json({ error: 'testTo requires onlyUserId (évite d\'envoyer tous les élèves au testeur)' });
    console.log(`[WEEKLY-REPORT] 🧪 Override destinataire actif → ${testTo}`);
  }
  // Suffixe de sujet — PREVIEW UNIQUEMENT, et seulement en même temps qu'un override
  // de destinataire. Sert à reconnaître un envoi de test dans une boîte qui reçoit
  // aussi les vrais rapports : sans lui, le test et le rapport du lundi portent le
  // même objet et se confondent. Les mêmes garde-fous que `testTo`, pour la même
  // raison : rien de tout cela ne doit pouvoir partir en production.
  const testSubject = req.query.testSubject || null;
  if (testSubject) {
    if (!isPreview) return res.status(403).json({ error: 'testSubject only allowed in preview deployments' });
    if (!testTo) return res.status(400).json({ error: 'testSubject requires testTo' });
    if (testSubject.length > 80) return res.status(400).json({ error: 'testSubject : 80 caractères maximum' });
  }
  if (!RESEND_API_KEY && !DRY_RUN) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });

  /**
   * ── LE RAPPORT DES COACHS ──────────────────────────────────────────────
   * Il part à la fin d'un envoi COMPLET (jamais sur un test ciblé `onlyUserId`,
   * qui ne verrait qu'un élève et donnerait des moyennes fausses).
   * `?coachOnly=1` le produit seul, SANS rien envoyer aux élèves : sert à le
   * relancer ou à l'éprouver sans renvoyer 90 rapports.
   */
  const coachOnly = req.query.coachOnly === '1';
  if (coachOnly && onlyUserId) return res.status(400).json({ error: 'coachOnly et onlyUserId sont incompatibles (moyennes sur un seul élève)' });
  const COACHS_A = process.env.RAPPORT_COACHS_DESTINATAIRE || 'clubtrader360@gmail.com';

  try {
    const supabase = createServiceClient();
    const period = getWeekBounds();
    console.log(`[WEEKLY-REPORT] 📅 Période : ${period.startDateStr} → ${period.endDateStr}`);

    const eligible = await fetchEligibleStudents(supabase);
    console.log(`[WEEKLY-REPORT] 👥 ${eligible.length} élève(s) éligible(s) (actifs, non en pause)`);

    let usersToProcess = eligible;
    if (onlyUserId) {
      usersToProcess = eligible.filter(u => u.uuid === onlyUserId);
      if (usersToProcess.length === 0) {
        return res.status(404).json({ error: `User ${onlyUserId} non trouvé dans les éligibles (vérifier role=student, status=active, et pas en mode Pause)` });
      }
      console.log(`[WEEKLY-REPORT] 🎯 1 user ciblé, ${eligible.length - usersToProcess.length} autres skippés`);
    }

    const results = [];
    const resumes = [];   // élèves actifs, pour le rapport des coachs
    const autres = [];    // élèves sans rapport chiffré
    for (const user of usersToProcess) {
      try {
        // #21 — dispatch 3 versions sur (tradesWeek, entriesWeek) de la semaine ISO.
        const resultat = await generateForUser(supabase, user, period);
        /**
         * ⛔ `null` VEUT DIRE « ON N ENVOIE RIEN », et il faut le traiter ici,
         * sinon la destructuration leve et le cron s arrete pour tout le monde.
         * ⚠️ C est le cas de l eleve sans aucun droit : lui parler de sa
         * formation serait faux, lui parler de son journal aussi.
         */
        if (!resultat) {
          results.push({ email: user.email, status: 'skipped', reportType: 'aucun_droit' });
          continue;
        }
        const { html, attachments, subject, reportType, entriesWeek, tradesWeek, resume } = resultat;
        console.log(`[WEEKLY-REPORT] 📬 ${user.email} → ${reportType} (trades=${tradesWeek}, journal=${entriesWeek})`);
        if (resume) resumes.push(resume);
        else autres.push({ nom: user.name || user.email, email: user.email, reportType, entriesWeek });

        if (coachOnly) {
          results.push({ email: user.email, status: 'coach_only', reportType });
          continue;
        }

        if (DRY_RUN) {
          console.log(`[WEEKLY-REPORT] 🧪 DRY_RUN — rapport ${reportType} généré (non envoyé) pour ${user.email}`);
          results.push({ email: user.email, status: 'dry_run', reportType, entriesWeek, tradesWeek });
          continue;
        }
        const recipientForSend = testTo || user.email;
        if (testTo) console.log(`[WEEKLY-REPORT][TEST-OVERRIDE] user=${user.uuid} originalEmail=${user.email} → sentTo=${testTo}`);
        const subjectForSend = testSubject ? `${testSubject} — ${subject}` : subject;
        const sent = await sendEmail({ to: recipientForSend, subject: subjectForSend, html, attachments });
        results.push(sent.success
          ? { email: user.email, status: 'sent', reportType, sentTo: recipientForSend, emailId: sent.id }
          : { email: user.email, status: 'failed', reportType, error: sent.error });
      } catch (e) {
        console.error(`[WEEKLY-REPORT] ❌ ${user.email}:`, e);
        results.push({ email: user.email, status: 'error', error: e.message });
      }
    }

    let rapportCoachs = { status: 'non_prevu' };
    if (!onlyUserId) {
      try {
        const rc = genererRapportCoachs({ periode: period, resumes, autres });
        if (DRY_RUN) rapportCoachs = { status: 'dry_run', stats: rc.stats };
        else {
          const envoi = await sendEmail({ to: COACHS_A, subject: rc.objet, html: rc.html, text: rc.texte });
          rapportCoachs = envoi.success
            ? { status: 'sent', to: COACHS_A, emailId: envoi.id, stats: rc.stats }
            : { status: 'failed', to: COACHS_A, error: envoi.error };
        }
      } catch (e) {
        console.error('[WEEKLY-REPORT] ❌ rapport coachs :', e);
        rapportCoachs = { status: 'error', error: e.message };
      }
      console.log('[WEEKLY-REPORT] 🧑‍🏫 rapport coachs :', JSON.stringify(rapportCoachs));
    }

    console.log('[WEEKLY-REPORT] ========== FIN ==========', JSON.stringify(results));
    return res.status(200).json({ success: true, period, eligible: eligible.length, dryRun: DRY_RUN, coachOnly: coachOnly || undefined, onlyUserId: onlyUserId || undefined, testToOverride: testTo || undefined, testSubject: testSubject || undefined, rapportCoachs, results });
  } catch (error) {
    console.error('[WEEKLY-REPORT] ❌ Erreur globale:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ========================================
// Envoi email via Resend
// ========================================
async function sendEmail({ to, subject, html, attachments, text }) {
  try {
    const payload = { from: 'Trader 360 <noreply@mail.journaltrader360.fr>', to: [to], subject, html };
    if (text) payload.text = text;
    if (Array.isArray(attachments) && attachments.length > 0) payload.attachments = attachments;
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.message || 'Unknown error' };
    return { success: true, id: data.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
