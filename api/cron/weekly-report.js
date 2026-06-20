// ========================================
// API ROUTE : RAPPORT HEBDOMADAIRE AUTOMATIQUE (#19)
// Route : /api/cron/weekly-report
// Déclenché par une scheduled task externe (Cowork) le dimanche 18h Paris,
// via HTTP + Bearer CRON_SECRET (le cron Vercel a été retiré de vercel.json).
// Système expert + design Bourse à l'Aube + Trader 360 Score (cf _lib/weekly-expert-system.js).
// ========================================

import { createClient } from '@supabase/supabase-js';
import { generateWeeklyReportHTML, formatDate } from './_lib/weekly-expert-system.js';

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

// ---- Construit le rapport d'UN élève. Retourne { html } ou { skip: '<raison>' }. ----
export async function buildUserReport(supabase, user, period) {
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

  if (weekTrades.length === 0) return { skip: '0 trades' };
  if (weekJournal.length === 0) return { skip: 'no journal entries' };

  const html = generateWeeklyReportHTML({
    user,
    trades: weekTrades,
    journalEntries: weekJournal,
    accounts: accounts || [],
    historicalTrades: historicalTrades || [],
    startDate: startDateStr,
    endDate: endDateStr,
  });
  return { html };
}

// ========================================
// HANDLER (déclenché par la scheduled task Cowork via Bearer CRON_SECRET)
// ========================================
export default async function handler(req, res) {
  console.log('[WEEKLY-REPORT] ========== START ==========', DRY_RUN ? '(DRY_RUN)' : '');

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return res.status(500).json({ error: 'Missing CRON_SECRET' });
  if (req.headers.authorization !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' });
  if (!SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });
  if (!RESEND_API_KEY && !DRY_RUN) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });

  try {
    const supabase = createServiceClient();
    const period = getWeekBounds();
    console.log(`[WEEKLY-REPORT] 📅 Période : ${period.startDateStr} → ${period.endDateStr}`);

    const eligible = await fetchEligibleStudents(supabase);
    console.log(`[WEEKLY-REPORT] 👥 ${eligible.length} élève(s) éligible(s) (actifs, non en pause)`);

    const results = [];
    for (const user of eligible) {
      try {
        const report = await buildUserReport(supabase, user, period);
        if (report.skip) {
          console.log(`[WEEKLY-REPORT] ⏭️ Skipped ${user.email} : ${report.skip}`);
          results.push({ email: user.email, status: 'skipped', reason: report.skip });
          continue;
        }
        if (DRY_RUN) {
          console.log(`[WEEKLY-REPORT] 🧪 DRY_RUN — rapport généré (non envoyé) pour ${user.email}`);
          results.push({ email: user.email, status: 'dry_run' });
          continue;
        }
        const sent = await sendEmail({
          to: user.email,
          subject: `📊 Ton rapport hebdomadaire — semaine du ${formatDate(period.startDateStr)}`,
          html: report.html,
        });
        results.push(sent.success
          ? { email: user.email, status: 'sent', emailId: sent.id }
          : { email: user.email, status: 'failed', error: sent.error });
      } catch (e) {
        console.error(`[WEEKLY-REPORT] ❌ ${user.email}:`, e);
        results.push({ email: user.email, status: 'error', error: e.message });
      }
    }

    console.log('[WEEKLY-REPORT] ========== FIN ==========', JSON.stringify(results));
    return res.status(200).json({ success: true, period, eligible: eligible.length, dryRun: DRY_RUN, results });
  } catch (error) {
    console.error('[WEEKLY-REPORT] ❌ Erreur globale:', error);
    return res.status(500).json({ error: error.message });
  }
}

// ========================================
// Envoi email via Resend
// ========================================
async function sendEmail({ to, subject, html }) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Trader 360 <reports@resend.dev>', to: [to], subject, html }),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.message || 'Unknown error' };
    return { success: true, id: data.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}
