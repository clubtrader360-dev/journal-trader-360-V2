/**
 * LE BACK-OFFICE COACH : les lectures agregees (15/10).
 *
 *   accueil      les chiffres et series du tableau de bord
 *   ventes       le tableau de bord des ventes, les series mensuelles, les offres
 *   evaluations  toutes les tentatives de quiz, avec le nom de l eleve
 *   progression  la progression chapitre par chapitre de chaque eleve (badges,
 *                diplomes) et son identite
 *   transactions toutes les transactions valides (111 aujourd hui) : la page d une
 *                offre, la liste des commandes et les factures se construisent
 *                dessus cote navigateur
 *
 * ⚠️ Tout passe par des fonctions SQL `security definer` reservees a la cle de
 * service : `back_office_accueil`, `back_office_ventes`,
 * `back_office_progression_par_eleve`. Une agregation en base ne depend pas
 * du nombre de lignes, la lecon du « 0 sur 64 » du 15/10.
 */
import { requireCoach, httpError } from '../vimeo/_lib/coach-auth.js';
import { getServiceClient } from '../tradovate/_lib/auth.js';

async function identites(sb) {
  const comptes = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw httpError(500, `liste des comptes illisible : ${error.message}`);
    comptes.push(...(data?.users || []));
    if (!data?.users || data.users.length < 200) break;
  }
  const { data: pub, error } = await sb.from('users').select('uuid, name, email, role, status');
  if (error) throw httpError(500, `profils illisibles : ${error.message}`);
  const parUuid = new Map((pub || []).map((u) => [u.uuid, u]));
  return new Map(comptes.map((c) => {
    const p = parUuid.get(c.id);
    return [c.id, { user_id: c.id, email: c.email, nom: (p && p.name) || (c.user_metadata && c.user_metadata.name) || '', role: (p && p.role) || 'student', statut: (p && p.status) || 'sans_profil' }];
  }));
}

async function accueil(sb) {
  const { data, error } = await sb.rpc('back_office_accueil');
  if (error) throw httpError(500, `accueil illisible : ${error.message}`);
  return data;
}

async function ventes(sb) {
  const { data, error } = await sb.rpc('back_office_ventes');
  if (error) throw httpError(500, `ventes illisibles : ${error.message}`);
  return data;
}

async function transactions(sb) {
  const { data, error } = await sb.from('membres_transactions').select('*').order('date_transaction', { ascending: false }).limit(5000);
  if (error) throw httpError(500, `transactions illisibles : ${error.message}`);
  if ((data || []).length >= 1000) console.warn('[BACK-OFFICE] ⚠️ membres_transactions depasse 1000 lignes : paginer');
  return data || [];
}

async function evaluations(sb) {
  const [{ data, error }, ids] = await Promise.all([
    sb.from('formation_quiz_resultats').select('id, user_id, module_cle, score, total, reussi, reponses, created_at').order('created_at', { ascending: false }).limit(1000),
    identites(sb),
  ]);
  if (error) throw httpError(500, `quiz illisibles : ${error.message}`);
  return (data || []).map((q) => ({ ...q, eleve: ids.get(q.user_id) || { user_id: q.user_id, email: '', nom: '' } }));
}

async function progression(sb) {
  const [{ data, error }, ids, acces] = await Promise.all([
    sb.rpc('back_office_progression_par_eleve'),
    identites(sb),
    sb.from('acces_membre').select('user_id, formation_actif, niveau'),
  ]);
  if (error) throw httpError(500, `progression illisible : ${error.message}`);
  if (acces.error) throw httpError(500, `droits illisibles : ${acces.error.message}`);
  const parAcces = new Map((acces.data || []).map((a) => [a.user_id, a]));
  const parProg = new Map((data || []).map((p) => [p.user_id, p]));
  // ⚠️ Tous les eleves, meme sans aucune progression : un diplome se lit aussi
  // par son absence.
  const eleves = [];
  for (const [uid, id] of ids) {
    if (id.role !== 'student' || id.statut === 'revoked') continue;
    const p = parProg.get(uid);
    const a = parAcces.get(uid);
    eleves.push({ ...id, lecons: (p && p.lecons) || [], derniere: (p && p.derniere) || null, formation: !!(a && a.formation_actif), niveau_coach: (a && a.niveau) || null });
  }
  eleves.sort((x, y) => String(x.nom || x.email).localeCompare(String(y.nom || y.email), 'fr'));
  return eleves;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, motif: 'POST attendu' });
  }
  try {
    await requireCoach(req);
  } catch (e) {
    return res.status(e?.statusCode || e?.status || 401).json({ ok: false, motif: e?.message || 'non autorise' });
  }
  const corps = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const action = String(corps.action || '').trim();
  const sb = getServiceClient();
  try {
    let resultat;
    if (action === 'accueil') resultat = await accueil(sb);
    else if (action === 'ventes') resultat = await ventes(sb);
    else if (action === 'evaluations') resultat = await evaluations(sb);
    else if (action === 'progression') resultat = await progression(sb);
    else if (action === 'transactions') resultat = await transactions(sb);
    else return res.status(400).json({ ok: false, motif: 'action inconnue' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, action, resultat });
  } catch (e) {
    const code = e?.statusCode || e?.status || 500;
    if (code >= 500) console.error('[BACK-OFFICE] ⚠️', action, e?.message || e);
    return res.status(code).json({ ok: false, motif: e?.message || 'erreur' });
  }
}
