/**
 * FICHE MEMBRE COMPLÈTE (Nadir, 27/10/2026) : ce qui manquait à la fiche.
 *  - le statut réel des e-mails chez Resend (délivré, ouvert, cliqué, rebond) ;
 *  - le questionnaire de positionnement de l'onglet « 📋 Questionnaire / suivi
 *    prospects » du tableur de Manu (réponses Google Form d'avant le site).
 * ⛔ Lecture seule partout. ⚠️ Chaque source dit si elle a été lue : une source
 * illisible n'est jamais rendue comme « rien à afficher ».
 */
import { getSheetsClient, getSheetId } from '../coach/_lib/sheets-client.js';

/**
 * Le dernier événement Resend de chaque mail (25 plus récents au plus, 2 à la fois :
 * Resend limite à 2 requêtes par seconde). `fetchFn` injectable pour les bancs.
 * ⚠️ « Ouvert » n'existe que si le suivi des ouvertures est activé chez Resend ;
 * sinon le dernier événement reste « délivré », et l'écran le dit.
 */
export async function statutsResend(mails, cle, fetchFn = fetch) {
  const cibles = (mails || []).filter((m) => m.fournisseur === 'resend' && m.fournisseur_id).slice(0, 25);
  const out = new Map();
  if (!cle || !cibles.length) return out;
  for (let i = 0; i < cibles.length; i += 2) {
    await Promise.all(cibles.slice(i, i + 2).map(async (m) => {
      try {
        const r = await fetchFn(`https://api.resend.com/emails/${encodeURIComponent(m.fournisseur_id)}`, { headers: { Authorization: `Bearer ${cle}` } });
        if (!r.ok) { out.set(m.fournisseur_id, { erreur: `Resend ${r.status}` }); return; }
        const d = await r.json();
        out.set(m.fournisseur_id, { evenement: d.last_event || null });
      } catch (e) { out.set(m.fournisseur_id, { erreur: String(e.message || e) }); }
    }));
  }
  return out;
}

let _cacheQ = null; let _cacheQAt = 0;
/**
 * L'onglet du questionnaire dans le tableur de Manu, indexé par adresse.
 * Onglet retrouvé par son NOM (contient « questionnaire »), jamais par position ; ligne
 * de titres = la première qui contient une colonne d'adresse (« mail »).
 */
export async function questionnaireTableur(email, sheets = null, id = null) {
  const e = String(email || '').trim().toLowerCase();
  if (!_cacheQ || Date.now() - _cacheQAt > 60_000 || sheets) {
    const s = sheets || getSheetsClient(); const sid = id || getSheetId();
    const meta = await s.spreadsheets.get({ spreadsheetId: sid, fields: 'sheets.properties.title' });
    const titre = (meta.data.sheets || []).map((x) => x.properties.title).find((t) => /questionnaire/i.test(t));
    if (!titre) { _cacheQ = { onglet: null, colonnes: [], lignes: [] }; _cacheQAt = Date.now(); }
    else {
      const r = await s.spreadsheets.values.get({ spreadsheetId: sid, range: `'${titre.replace(/'/g, "''")}'`, valueRenderOption: 'FORMATTED_VALUE' });
      const v = r.data.values || [];
      const iTete = v.findIndex((l) => (l || []).some((c) => /mail/i.test(String(c || ''))));
      if (iTete < 0) { _cacheQ = { onglet: titre, colonnes: [], lignes: [], sans_adresse: true }; }
      else {
        const colonnes = (v[iTete] || []).map((c) => String(c ?? '').trim());
        const iMails = colonnes.map((c, i) => (/mail/i.test(c) ? i : -1)).filter((i) => i >= 0);
        const lignes = v.slice(iTete + 1).filter((l) => (l || []).some((c) => String(c ?? '').trim())).map((l) => ({
          emails: iMails.map((i) => String(l[i] ?? '').trim().toLowerCase()).filter((x) => x.includes('@')),
          cellules: Object.fromEntries(colonnes.map((c, i) => [c || `Colonne ${i + 1}`, l[i] ?? ''])),
        }));
        _cacheQ = { onglet: titre, colonnes: colonnes.map((c, i) => c || `Colonne ${i + 1}`), lignes };
      }
      _cacheQAt = Date.now();
    }
  }
  const q = _cacheQ;
  return { lu: true, onglet: q.onglet, colonnes: q.colonnes, sans_adresse: !!q.sans_adresse, reponses: q.lignes.filter((l) => l.emails.includes(e)).map((l) => l.cellules) };
}
