// ========================================
// POST /api/webhook/journal-entry
// Supabase Database Webhook sur public.journal_entries (INSERT/UPDATE/DELETE).
// Header d'auth : X-Webhook-Secret == process.env.SUPABASE_WEBHOOK_SECRET (timingSafeEqual).
//
// À chaque changement de journal d'un élève : recalcule son T360 Score et l'écrit dans la colonne « Journal » du
// tableur Manu (historiquement la col X — elle est retrouvée par son TITRE, cf
// api/_lib/parcours-colonnes.js, Manu peut la déplacer) :
//   Ancienneté de la dernière saisie = jours de BOURSE (lun-ven) depuis son created_at, jour de
//   Paris (règles Manu du 17/10/2026, cf api/_lib/jours-bourse.js) :
//   - "<score>" (ex "72.4") → dernière saisie il y a 3 jours de bourse ou moins
//   - "non rempli"          → plus de 3 jours de bourse (police 8, centré verticalement, sans fond)
//   - "vide"                → plus de 20 jours de bourse, aucune saisie, ou email tableur absent
//                             de public.users. Fond rouge clair (#f4cccc). Depuis le 18/10/2026,
//                             « vide » remplace aussi l'ancien « NO » (non inscrit au journal).
// N'écrit QUE dans la colonne « Journal », et jamais sur une ligne coach (col « ID » à « -- »).
// Ne throw jamais (retourne 500 { ok:false } en cas d'erreur).
// Garde-fou : un titre de colonne absent ou en double en ligne 3 → AUCUNE écriture, erreur
// loggée, et réponse 200 { ok:false } pour que Supabase ne rejoue pas le webhook en boucle.
//
// Trois modes, une seule fonction d'écriture (writeJournalCells) :
//   - POST (webhook Supabase, défaut)        → traite l'élève du payload, écrit sa seule cellule X.
//   - POST ?action=backfill-full             → re-scanne TOUT le tableur, recalcule chaque ligne,
//                                              écrit toutes les cellules X en 1 batchUpdate.
//   - ?action=daily-recalc                   → recalcul quotidien des seuls membres ayant au moins
//                                              une saisie (ni coachs). GET du cron Vercel
//                                              (Bearer CRON_SECRET, lun-ven 6h Paris) ou POST
//                                              X-Webhook-Secret pour un lancement à la main.
// ========================================

import crypto from 'crypto';
import { getServiceClient, readJson } from '../tradovate/_lib/auth.js';
import { getSheetsClient, getSheetId } from '../coach/_lib/sheets-client.js';
import { computeT360Score } from '../_lib/t360-score.js';
import { readParcours, cellA1, columnLetter, TITRES, FIRST_MEMBER_ROW, SHEET_NAME } from '../_lib/parcours-colonnes.js';
import { parisDayOf, joursBourseEntre, SEUIL_NON_REMPLI, SEUIL_VIDE } from '../_lib/jours-bourse.js';
import { xpParEmail, dateParis } from '../_lib/formation-xp.js';

// États écrits dans la colonne « Journal » quand il n'y a pas de note.
const JOURNAL_VIDE = 'vide';             // aucune saisie, plus de 20 jours de bourse, ou pas inscrit (ex-« NO »)
const JOURNAL_NON_REMPLI = 'non rempli'; // inscrit, plus de 3 jours de bourse
const JOURNAL_VIDE_BG = { red: 244 / 255, green: 204 / 255, blue: 204 / 255 }; // #f4cccc, comme la règle du tableur
const COACH_ID = '--';                   // col « ID » des lignes coachs : jamais écrites

// Colonnes lues (prénom, nom, mails) et écrite (journal), retrouvées par leur titre en ligne 3.
// Lecture de l'onglet entier, plage ouverte : rowNum = FIRST_MEMBER_ROW + index, les lignes
// sans email sont écartées (rowEmails vide → skipped).
const TITRES_REQUIS = [TITRES.ID, TITRES.PRENOM, TITRES.NOM, TITRES.MAIL_LB, TITRES.MAIL_PERSO, TITRES.JOURNAL];

// Le backfill peut prendre 30-60s (compute par élève). Vercel Hobby = 10s par défaut → on relève.
export const config = { maxDuration: 60 };

// Comparaison secret constante en temps (anti timing-attack).
function secretOk(provided, expected) {
  if (!expected) return false;
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function parisTodayStr() {
  // 'sv-SE' → 'YYYY-MM-DD'
  return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Paris' });
}

// Emails candidats d'une ligne tableur : « Mail LearnyBox » (prioritaire) puis « 2ème mail »
// (perso, multi-valeurs). `cols` = index résolus par titre.
function rowEmails(row, cols) {
  const out = [];
  const tv = String(row[cols[TITRES.MAIL_LB]] || '').trim().toLowerCase();
  if (tv) out.push(tv);
  const uv = String(row[cols[TITRES.MAIL_PERSO]] || '').trim().toLowerCase();
  if (uv) uv.split(/[,;\s]+/).forEach((e) => { if (e) out.push(e); });
  return out;
}

function isCoachRow(row, cols) {
  return String(row[cols[TITRES.ID]] || '').trim() === COACH_ID;
}

// Valeur col X pour un élève EXISTANT (uuid connu), selon l'ancienneté en jours de bourse de sa
// dernière saisie (created_at, jour de Paris) : ≤ 3 → "<score>", > 3 → "non rempli", > 20 ou
// aucune saisie → "vide". Seules les saisies datées dans le futur (erronées) restent exclues.
// Partagé entre le webhook unitaire, le backfill et le recalcul quotidien.
// Retourne { value, lastDay, joursBourse } (lastDay/joursBourse null sans saisie).
async function computeUserColX(sb, uuid) {
  const today = parisTodayStr();
  const { data: last, error: jErr } = await sb
    .from('journal_entries')
    .select('created_at')
    .eq('user_id', uuid)
    .lte('entry_date', today)
    .order('created_at', { ascending: false })
    .limit(1);
  if (jErr) throw jErr;

  const lastDay = last && last.length ? parisDayOf(last[0].created_at) : null;
  if (!lastDay) return { value: JOURNAL_VIDE, lastDay: null, joursBourse: null };
  const joursBourse = joursBourseEntre(lastDay, today);
  if (joursBourse > SEUIL_VIDE) return { value: JOURNAL_VIDE, lastDay, joursBourse };
  if (joursBourse > SEUIL_NON_REMPLI) return { value: JOURNAL_NON_REMPLI, lastDay, joursBourse };

  const [{ data: trades }, { data: accounts }] = await Promise.all([
    sb.from('trades').select('pnl, account_id, trade_date').eq('user_id', uuid).limit(10000),
    sb.from('accounts').select('id, active').eq('user_id', uuid),
  ]);
  const { globalScore } = computeT360Score(trades || [], accounts || []);
  return { value: globalScore.toFixed(1), lastDay, joursBourse };
}

// SEUL chemin d'écriture de la colonne « Journal » (webhook, backfill, recalcul quotidien).
// `cells` = [{ rowNum, value }]. Valeurs en RAW, 1 appel. « non rempli » et « vide » reçoivent
// la mise en forme des textes de la colonne : police 8 (« non rempli ») ou 10 (« vide »), centré
// verticalement ; fond rouge clair pour « vide » (18/10/2026), fond effacé pour « non rempli ».
// Le tableur pose en plus ses règles conditionnelles (vert sur les notes, rouge sur « vide »).
// La note garde sa mise en forme, inchangée.
async function writeJournalCells(sheets, spreadsheetId, colIdx, cells) {
  if (!cells.length) return;
  await sheets.spreadsheets.values.batchUpdate({
    spreadsheetId,
    requestBody: {
      valueInputOption: 'RAW',
      data: cells.map((c) => ({ range: cellA1(colIdx, c.rowNum), values: [[c.value]] })),
    },
  });

  const textes = cells.filter((c) => c.value === JOURNAL_NON_REMPLI || c.value === JOURNAL_VIDE);
  if (!textes.length) return;
  const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title)' });
  const onglet = (meta.data.sheets || []).find((sh) => sh.properties && sh.properties.title === SHEET_NAME);
  if (!onglet) throw new Error(`onglet « ${SHEET_NAME} » introuvable pour la mise en forme`);
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: textes.map((c) => ({
        repeatCell: {
          range: {
            sheetId: onglet.properties.sheetId,
            startRowIndex: c.rowNum - 1, endRowIndex: c.rowNum,
            startColumnIndex: colIdx, endColumnIndex: colIdx + 1,
          },
          // « non rempli » en police 8 (demande Manu du 17/10/2026), « vide » reste en 10.
          // Même règle côté Apps Script du tableur (_applyPoliceJoursJournal_).
          cell: { userEnteredFormat: c.value === JOURNAL_VIDE
            ? { textFormat: { fontSize: 10 }, verticalAlignment: 'MIDDLE', backgroundColor: JOURNAL_VIDE_BG, backgroundColorStyle: { rgbColor: JOURNAL_VIDE_BG } }
            : { textFormat: { fontSize: 8 }, verticalAlignment: 'MIDDLE' } },
          // « non rempli » : backgroundColor(Style) dans le masque sans valeur → fond effacé.
          fields: 'userEnteredFormat.textFormat.fontSize,userEnteredFormat.verticalAlignment,userEnteredFormat.backgroundColor,userEnteredFormat.backgroundColorStyle',
        },
      })),
    },
  });
}

export default async function handler(req, res) {
  try {
    const action = (req.query && req.query.action) || '';

    // 0bis. XP et dernière connexion formation (pg_cron Supabase toutes les heures, GET + Bearer
    // CRON_SECRET ; ou POST X-Webhook-Secret à la main). Voir handleFormationXp.
    if (action === 'formation-xp') {
      const ok = req.method === 'GET'
        ? secretOk(String(req.headers.authorization || '').replace(/^Bearer /, ''), process.env.CRON_SECRET)
        : secretOk(req.headers['x-webhook-secret'], process.env.SUPABASE_WEBHOOK_SECRET);
      if (!ok) return res.status(401).json({ ok: false, error: 'unauthorized' });
      return await handleFormationXp(res);
    }

    // 0. Cron Vercel (GET + Bearer CRON_SECRET) → recalcul quotidien.
    if (req.method === 'GET' && action === 'daily-recalc') {
      if (!secretOk(String(req.headers.authorization || '').replace(/^Bearer /, ''), process.env.CRON_SECRET)) {
        return res.status(401).json({ ok: false, error: 'unauthorized' });
      }
      // Deux crons (4h et 5h UTC) pour tomber à 6h Paris été comme hiver : seul celui de 6h agit.
      const heureParis = Number(new Date().toLocaleString('en-GB', { timeZone: 'Europe/Paris', hour: '2-digit', hour12: false }));
      if (heureParis !== 6) {
        console.log(`[WEBHOOK-COL-X][daily-recalc] ignoré : ${heureParis}h à Paris (attendu 6h)`);
        return res.status(200).json({ ok: true, skipped: true, heure_paris: heureParis });
      }
      return await handleDailyRecalc(res);
    }

    if (req.method !== 'POST') {
      res.setHeader('Allow', 'POST');
      return res.status(405).json({ ok: false, error: 'method not allowed' });
    }

    // 1. Auth webhook.
    const provided = req.headers['x-webhook-secret'];
    if (!secretOk(provided, process.env.SUPABASE_WEBHOOK_SECRET)) {
      return res.status(401).json({ ok: false, error: 'unauthorized' });
    }

    // 1bis. Mode backfill complet (re-scan tout le tableur).
    if (action === 'backfill-full') {
      return await handleBackfillFull(res);
    }
    // 1ter. Recalcul quotidien lancé à la main.
    if (action === 'daily-recalc') {
      return await handleDailyRecalc(res);
    }

    // 2. Payload Supabase.
    const body = await readJson(req);
    const type = body?.type || 'UNKNOWN';
    const record = body?.record || null;
    const oldRecord = body?.old_record || null;
    const user_id = record?.user_id || oldRecord?.user_id || null;
    if (!user_id) {
      return res.status(400).json({ ok: false, error: 'payload invalide : user_id manquant' });
    }

    const sb = getServiceClient();

    // 3. Email de l'élève.
    const { data: appUser, error: uErr } = await sb
      .from('users').select('email').eq('uuid', user_id).single();
    if (uErr || !appUser || !appUser.email) {
      console.warn('[WEBHOOK-COL-X] user introuvable ou sans email:', user_id);
      return res.status(404).json({ ok: false, error: 'user introuvable' });
    }
    const email = String(appUser.email).trim().toLowerCase();

    // 4-7. Valeur col X selon l'ancienneté de la dernière saisie (jours de bourse).
    const { value: valueToWrite } = await computeUserColX(sb, user_id);

    // 8. Matching dans le tableur (« Mail LearnyBox » ou « 2ème mail » == email).
    const sheets = getSheetsClient();
    const spreadsheetId = getSheetId();
    const parcours = await readParcours(sheets, spreadsheetId, TITRES_REQUIS);
    if (!parcours.ok) {
      // 200 et non 5xx : l'erreur ne se corrige pas en rejouant, seulement en réparant la ligne 3.
      console.error(`[WEBHOOK-COL-X] ⛔ AUCUNE écriture — ${parcours.error} (user=${user_id} email=${email})`);
      return res.status(200).json({ ok: false, matched: false, written: false, error: parcours.error });
    }
    const { cols, rows: values } = parcours;

    let matchIdx = -1, matchedMulti = 0;
    for (let i = 0; i < values.length; i++) {
      const row = values[i] || [];
      const tv = String(row[cols[TITRES.MAIL_LB]] || '').trim().toLowerCase();
      const uv = String(row[cols[TITRES.MAIL_PERSO]] || '').trim().toLowerCase();
      const hit = (tv && tv === email) || (uv && (uv === email || uv.split(/[,;\s]+/).includes(email)));
      if (hit) { matchedMulti++; if (matchIdx === -1) matchIdx = i; }
    }
    if (matchIdx === -1) {
      console.warn(`[WEBHOOK-COL-X] aucun match tableur pour email=${email} user=${user_id}`);
      return res.status(200).json({ ok: true, matched: false, email, value: valueToWrite });
    }
    if (matchedMulti > 1) {
      console.warn(`[WEBHOOK-COL-X] ${matchedMulti} matches pour email=${email} → prend le premier`);
    }

    const rowNum = FIRST_MEMBER_ROW + matchIdx;
    const matchedRow = values[matchIdx] || [];
    const prenom = matchedRow[cols[TITRES.PRENOM]] || '';
    const nom = matchedRow[cols[TITRES.NOM]] || '';
    if (isCoachRow(matchedRow, cols)) {
      console.log(`[WEBHOOK-COL-X] ligne coach ${rowNum} (${prenom} ${nom}) → aucune écriture`);
      return res.status(200).json({ ok: true, matched: true, coach: true, written: false, row: rowNum });
    }

    // 9. Écriture colonne « Journal » (UNIQUEMENT), lettre calculée depuis son titre.
    await writeJournalCells(sheets, spreadsheetId, cols[TITRES.JOURNAL], [{ rowNum, value: valueToWrite }]);

    // 10. Log détaillé.
    console.log(`[WEBHOOK-COL-X] user=${user_id} email=${email} (${prenom} ${nom}) action=${type} row=${rowNum} value=${valueToWrite}`);

    // 11.
    return res.status(200).json({ ok: true, matched: true, row: rowNum, value: valueToWrite, email });
  } catch (err) {
    console.error('[WEBHOOK-COL-X] error:', err);
    return res.status(500).json({ ok: false, error: err.message || 'erreur' });
  }
}

// ========================================
// ?action=backfill-full — re-scanne TOUT le tableur, recalcule chaque ligne, 1 seul batchUpdate.
// ========================================
async function handleBackfillFull(res) {
  const t0 = Date.now();
  const sb = getServiceClient();

  // Map email(lowercased) → uuid depuis public.users (1 requête ; table < 1000 lignes).
  const { data: users, error: uErr } = await sb.from('users').select('uuid, email');
  if (uErr) throw uErr;
  const emailToUuid = new Map();
  for (const u of users || []) {
    if (u.email) emailToUuid.set(String(u.email).trim().toLowerCase(), u.uuid);
  }

  // Lecture du tableur (1 requête).
  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();
  const parcours = await readParcours(sheets, spreadsheetId, TITRES_REQUIS);
  if (!parcours.ok) {
    console.error(`[WEBHOOK-COL-X][backfill-full] ⛔ AUCUNE écriture — ${parcours.error}`);
    return res.status(200).json({ ok: false, written: 0, error: parcours.error });
  }
  const { cols, rows: values } = parcours;

  let scored = 0, pas_rempli = 0, non_inscrit = 0, skipped = 0;
  const updates = [];

  for (let i = 0; i < values.length; i++) {
    const row = values[i] || [];
    const rowNum = FIRST_MEMBER_ROW + i;
    const emails = rowEmails(row, cols);
    if (emails.length === 0 || isCoachRow(row, cols)) { skipped++; continue; } // sans email ou coach → ne rien écrire

    // Premier email de la ligne qui matche un user Supabase (T prioritaire, cf rowEmails).
    let uuid = null;
    for (const e of emails) { if (emailToUuid.has(e)) { uuid = emailToUuid.get(e); break; } }

    let value;
    if (uuid) {
      ({ value } = await computeUserColX(sb, uuid));
      if (value === JOURNAL_VIDE || value === JOURNAL_NON_REMPLI) pas_rempli++; else scored++;
    } else {
      value = JOURNAL_VIDE; // pas inscrit au journal (ex-« NO »)
      non_inscrit++;
    }
    updates.push({ rowNum, value });
  }

  // 1 SEUL appel d'écriture pour toutes les cellules X (économie quota Google Sheets).
  await writeJournalCells(sheets, spreadsheetId, cols[TITRES.JOURNAL], updates);

  const duration_ms = Date.now() - t0;
  console.log(`[WEBHOOK-COL-X][backfill-full] rows=${values.length} scored=${scored} pas_rempli=${pas_rempli} non_inscrit=${non_inscrit} skipped=${skipped} written=${updates.length} in ${duration_ms}ms`);

  return res.status(200).json({
    ok: true,
    total_rows: values.length,
    scored,
    pas_rempli,
    non_inscrit,
    skipped,
    written: updates.length,
    duration_ms,
  });
}

// ========================================
// ?action=daily-recalc — chaque jour de bourse à 6h Paris : réapplique les règles d'ancienneté à
// chaque membre INSCRIT au journal, pour qu'une note ne reste pas affichée quand le membre ne
// note plus (aucun événement Supabase ne part alors). Lignes dont l'email est absent de
// public.users, lignes coachs et lignes sans email : jamais écrites.
// Anciens « NO » (devenus « vide » le 18/10/2026) : reconnus à « vide » + AUCUNE saisie sur tous
// les comptes de la ligne (comptes journal créés en masse le 15/10, jamais utilisés) → jamais
// écrits. Un « vide » pour plus de 20 jours de bourse a, lui, au moins une saisie ancienne.
// ========================================
async function handleDailyRecalc(res) {
  const t0 = Date.now();
  const sb = getServiceClient();

  const { data: users, error: uErr } = await sb.from('users').select('uuid, email');
  if (uErr) throw uErr;
  const emailToUuid = new Map();
  for (const u of users || []) {
    if (u.email) emailToUuid.set(String(u.email).trim().toLowerCase(), u.uuid);
  }

  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();
  const parcours = await readParcours(sheets, spreadsheetId, TITRES_REQUIS);
  if (!parcours.ok) {
    console.error(`[WEBHOOK-COL-X][daily-recalc] ⛔ AUCUNE écriture — ${parcours.error}`);
    return res.status(200).json({ ok: false, written: 0, error: parcours.error });
  }
  const { cols, rows: values } = parcours;

  const cibles = [];
  let coachs = 0, non_inscrits = 0, sans_email = 0, jamais_saisi = 0;
  for (let i = 0; i < values.length; i++) {
    const row = values[i] || [];
    const emails = rowEmails(row, cols);
    if (emails.length === 0) { sans_email++; continue; }
    if (isCoachRow(row, cols)) { coachs++; continue; }
    const uuids = [...new Set(emails.filter((e) => emailToUuid.has(e)).map((e) => emailToUuid.get(e)))];
    if (!uuids.length) { non_inscrits++; continue; }
    cibles.push({
      rowNum: FIRST_MEMBER_ROW + i,
      uuids,
      nom: `${row[cols[TITRES.PRENOM]] || ''} ${row[cols[TITRES.NOM]] || ''}`.trim(),
      avant: String(row[cols[TITRES.JOURNAL]] || ''),
    });
  }

  // Calcul par paquets de 8 (requêtes Supabase en parallèle, sous la limite de 60s).
  const membres = [];
  for (let k = 0; k < cibles.length; k += 8) {
    const lot = await Promise.all(cibles.slice(k, k + 8).map(async (c) => {
      // Plusieurs comptes pour une ligne (Mail LearnyBox + 2ème mail) : celui dont la dernière
      // saisie est la plus récente l'emporte (à défaut, le premier, Mail LearnyBox prioritaire).
      const rs = await Promise.all(c.uuids.map((u) => computeUserColX(sb, u)));
      const r = rs.reduce((best, x) => (x.lastDay && (!best.lastDay || x.lastDay > best.lastDay) ? x : best), rs[0]);
      // Ancien « NO » : « vide » sans aucune saisie → jamais touché ; seule une saisie réelle,
      // via le webhook, le remplace. (Sans saisie, le calcul donnerait « vide » de toute façon :
      // la garde rend la règle explicite et évite toute réécriture.)
      if (!r.lastDay && c.avant.trim().toLowerCase() === JOURNAL_VIDE) return null;
      return { row: c.rowNum, nom: c.nom, derniere_saisie: r.lastDay, jours_bourse: r.joursBourse, avant: c.avant, value: r.value };
    }));
    jamais_saisi += lot.filter((m) => !m).length;
    membres.push(...lot.filter(Boolean));
  }

  await writeJournalCells(sheets, spreadsheetId, cols[TITRES.JOURNAL], membres.map((m) => ({ rowNum: m.row, value: m.value })));

  const compte = (f) => membres.filter(f).length;
  const resume = {
    note: compte((m) => m.value !== JOURNAL_VIDE && m.value !== JOURNAL_NON_REMPLI),
    non_rempli: compte((m) => m.value === JOURNAL_NON_REMPLI),
    vide: compte((m) => m.value === JOURNAL_VIDE),
    changes: compte((m) => m.avant !== m.value),
  };
  const duration_ms = Date.now() - t0;
  console.log(`[WEBHOOK-COL-X][daily-recalc] written=${membres.length} note=${resume.note} non_rempli=${resume.non_rempli} vide=${resume.vide} changes=${resume.changes} skip: jamais_saisi=${jamais_saisi} coachs=${coachs} non_inscrits=${non_inscrits} sans_email=${sans_email} in ${duration_ms}ms`);
  for (const m of membres) {
    if (m.avant !== m.value) console.log(`[WEBHOOK-COL-X][daily-recalc] row=${m.row} (${m.nom}) ${m.avant || '(vide)'} → ${m.value} (dernière saisie ${m.derniere_saisie || 'aucune'}, ${m.jours_bourse ?? '-'} j de bourse)`);
  }

  return res.status(200).json({
    ok: true,
    today: parisTodayStr(),
    written: membres.length,
    ...resume,
    skipped: { jamais_saisi, coachs, non_inscrits, sans_email },
    duration_ms,
    membres,
  });
}

// ========================================
// ?action=formation-xp — colonnes « Dernière connexion formation » et « XP » du tableur.
// Demande de Manu du 21/10/2026. Lancé toutes les heures par pg_cron (Supabase).
//   - Dernière connexion formation = auth.users.last_sign_in_at, JJ/MM/AAAA (jour de Paris).
//   - XP = recalcul exact de xpTotal() de l'espace formation (api/_lib/formation-xp.js).
// Colonnes retrouvées par TITRE. Si AUCUNE des deux n'existe, elles sont créées en ligne 3,
// juste après la dernière colonne titrée (rien n'est décalé). Si une seule existe ou si un titre
// est en double → aucune écriture.
// Les lignes coachs SONT écrites ici (exception voulue par Manu : il veut voir son propre XP) ;
// ces deux colonnes sont informatives et ne nourrissent aucun score.
// Ligne sans compte correspondant → cellules laissées telles quelles, email listé en réponse.
// Seules les cellules dont la valeur change sont réécrites.
// ========================================
const T_CONNEXION = 'derniere connexion trader360.fr'; // titre choisi par Manu le 21/10/2026 (ex « Dernière connexion formation »)
const T_XP = 'xp';
const LIB_CONNEXION = 'Dernière connexion Trader360.fr';
const LIB_XP = 'XP';

async function handleFormationXp(res) {
  const t0 = Date.now();
  const sb = getServiceClient();
  const parEmail = await xpParEmail(sb);

  const sheets = getSheetsClient();
  const spreadsheetId = getSheetId();
  const base = [TITRES.ID, TITRES.MAIL_LB, TITRES.MAIL_PERSO];
  let parcours = await readParcours(sheets, spreadsheetId, [...base, T_CONNEXION, T_XP]);
  let created = false;

  if (!parcours.ok) {
    const manquants = parcours.missing || [];
    const seulsNouveaux = !(parcours.duplicates || []).length
      && manquants.length === 2 && manquants.includes(T_CONNEXION) && manquants.includes(T_XP);
    if (!seulsNouveaux) {
      console.error(`[FORMATION-XP] ⛔ AUCUNE écriture — ${parcours.error}`);
      return res.status(200).json({ ok: false, written: 0, error: parcours.error });
    }
    let derniere = -1;
    (parcours.header || []).forEach((v, i) => { if (String(v || '').trim()) derniere = i; });
    // La grille peut s'arrêter juste après la dernière colonne (AQ le 21/10/2026) : on ajoute
    // les colonnes manquantes à droite, sans rien décaler.
    const meta = await sheets.spreadsheets.get({ spreadsheetId, fields: 'sheets.properties(sheetId,title,gridProperties)' });
    const onglet = (meta.data.sheets || []).find((sh) => sh.properties && sh.properties.title === SHEET_NAME);
    if (!onglet) throw new Error(`onglet « ${SHEET_NAME} » introuvable`);
    const manque = (derniere + 3) - (onglet.properties.gridProperties.columnCount || 0);
    if (manque > 0) {
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ appendDimension: { sheetId: onglet.properties.sheetId, dimension: 'COLUMNS', length: manque } }] },
      });
    }
    const range = `'${SHEET_NAME}'!${columnLetter(derniere + 1)}3:${columnLetter(derniere + 2)}3`;
    await sheets.spreadsheets.values.update({
      spreadsheetId, range, valueInputOption: 'RAW',
      requestBody: { values: [[LIB_CONNEXION, LIB_XP]] },
    });
    created = true;
    parcours = await readParcours(sheets, spreadsheetId, [...base, T_CONNEXION, T_XP]);
    if (!parcours.ok) {
      console.error(`[FORMATION-XP] ⛔ AUCUNE écriture après création — ${parcours.error}`);
      return res.status(200).json({ ok: false, written: 0, error: parcours.error });
    }
  }

  const { cols, rows } = parcours;
  const data = [];
  const sansCompte = [];
  let lignes = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] || [];
    const rowNum = FIRST_MEMBER_ROW + i;
    const emails = rowEmails(row, cols);
    if (!emails.length) continue;
    const hit = emails.map((e) => parEmail.get(e)).find(Boolean);
    if (!hit) { sansCompte.push(emails[0]); continue; }
    lignes++;
    const conn = dateParis(hit.lastSignIn);
    if (String(row[cols[T_CONNEXION]] ?? '') !== conn) {
      data.push({ range: cellA1(cols[T_CONNEXION], rowNum), values: [[conn]] });
    }
    if (String(row[cols[T_XP]] ?? '') !== String(hit.xp)) {
      data.push({ range: cellA1(cols[T_XP], rowNum), values: [[hit.xp]] });
    }
  }
  if (data.length) {
    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId, requestBody: { valueInputOption: 'RAW', data },
    });
  }
  const duration_ms = Date.now() - t0;
  console.log(`[FORMATION-XP] lignes=${lignes} cellules=${data.length} sans_compte=${sansCompte.length} created=${created} in ${duration_ms}ms`);
  return res.status(200).json({
    ok: true, created_headers: created, lignes_trouvees: lignes, cellules_ecrites: data.length,
    sans_compte: sansCompte, duration_ms,
  });
}

