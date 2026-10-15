/**
 * LE BACK-OFFICE DES MEMBRES, COTE COACH (tache #54).
 *
 * ── ⚠️ UNE SEULE ROUTE, CINQ ACTIONS ────────────────────────────────────────
 *
 *   lister         la liste complete : compte, droits, niveau, avancement, quiz
 *   droits         ouvrir ou fermer la formation et/ou le journal d une personne
 *   niveau         poser le niveau (debutant / intermediaire / confirme) ou le
 *                  retirer (retour au niveau LearnyBox)
 *   creer          creer un compte, lui donner ses droits et son niveau, et lui
 *                  envoyer le mail de premiere connexion (lien pour choisir son
 *                  mot de passe)
 *   renvoyer_mail  renvoyer ce mail a un compte existant
 *
 * ── ⛔ POURQUOI TOUT PASSE PAR ICI, AVEC LA CLE DE SERVICE ───────────────────
 *
 * `acces_membre` n a qu une colonne ecrivable par le role `authenticated`
 * (`journal_demande_le`), et c est voulu : voir acces-journal.js. Un `grant`
 * de colonne porte sur le ROLE, l ouvrir pour le coach l ouvrirait pour chaque
 * eleve. Les quatorze comptes sans ligne dans `public.users` ne sont visibles
 * que par `auth.admin.listUsers`, qui demande aussi la cle de service. Et la
 * creation d un compte avec mot de passe a choisir passe par `admin.generateLink`.
 * Tout cela derriere `requireCoach`, comme les autres routes coach.
 *
 * ⚠️ Le mail part par Resend, comme le brief et le rapport hebdo (meme expediteur).
 * ⛔ Le lien de premiere connexion est un lien de RECUPERATION Supabase vers
 * `/reset-password.html`, page qui existe deja et sait le lire. L origine du
 * lien est celle de la requete : sur l apercu, il mene a l apercu ; en prod, a
 * la prod. ⚠️ Cette origine doit etre dans la liste des redirections autorisees
 * du projet Supabase, sinon Supabase renvoie vers l URL du site par defaut.
 */
import { requireCoach, httpError } from '../vimeo/_lib/coach-auth.js';
import { getServiceClient } from '../tradovate/_lib/auth.js';

const NIVEAUX = ['debutant', 'intermediaire', 'confirme'];
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EXPEDITEUR = 'Trader 360 <noreply@mail.journaltrader360.fr>';

const texte = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** L origine de la requete, pour le lien du mail : apercu ou prod, jamais en dur. */
function origineDe(req) {
  const proto = (req.headers['x-forwarded-proto'] || 'https').split(',')[0].trim();
  const hote = (req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  return hote ? `${proto}://${hote}` : 'https://app.journaltrader360.fr';
}

/* ══ LISTER ════════════════════════════════════════════════════════════════ */
async function lister(sb) {
  // ⚠️ Tous les comptes, y compris les quatorze sans ligne dans public.users.
  const comptes = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw httpError(500, `liste des comptes illisible : ${error.message}`);
    comptes.push(...(data?.users || []));
    if (!data?.users || data.users.length < 200) break;
  }

  const [pub, acces, lb, prog, quiz, vus] = await Promise.all([
    sb.from('users').select('uuid, name, email, role, status, created_at'),
    sb.from('acces_membre').select('user_id, formation_actif, journal_actif, journal_demande_le, journal_retire_le, niveau'),
    sb.from('formation_niveau_learnybox').select('email, niveau, progression_pct, actif'),
    sb.from('formation_progression').select('user_id, vue, last_watched_at'),
    sb.from('formation_quiz_resultats').select('user_id, module_cle, reussi'),
    sb.from('formation_parcours_vu').select('user_id, vue_le'),
  ]);
  for (const r of [pub, acces, lb, prog, quiz, vus]) {
    if (r.error) throw httpError(500, `lecture impossible : ${r.error.message}`);
  }

  const parUuid = new Map((pub.data || []).map((u) => [u.uuid, u]));
  const parAcces = new Map((acces.data || []).map((a) => [a.user_id, a]));
  const parEmailLB = new Map((lb.data || []).map((l) => [String(l.email || '').toLowerCase(), l]));
  const progression = new Map();
  for (const p of prog.data || []) {
    const e = progression.get(p.user_id) || { vues: 0, derniere: null };
    if (p.vue) e.vues += 1;
    if (p.last_watched_at && (!e.derniere || p.last_watched_at > e.derniere)) e.derniere = p.last_watched_at;
    progression.set(p.user_id, e);
  }
  const quizReussis = new Map();
  for (const q of quiz.data || []) {
    if (!q.reussi) continue;
    const s = quizReussis.get(q.user_id) || new Set();
    s.add(q.module_cle);
    quizReussis.set(q.user_id, s);
  }
  const ouvertures = new Map((vus.data || []).map((v) => [v.user_id, v.vue_le]));

  const membres = comptes.map((c) => {
    const p = parUuid.get(c.id);
    const a = parAcces.get(c.id);
    const l = parEmailLB.get(String(c.email || '').toLowerCase());
    const pr = progression.get(c.id) || { vues: 0, derniere: null };
    const derniere = [pr.derniere, ouvertures.get(c.id), c.last_sign_in_at].filter(Boolean).sort().pop() || null;
    return {
      user_id: c.id,
      email: c.email,
      nom: (p && p.name) || (c.user_metadata && c.user_metadata.name) || '',
      role: (p && p.role) || 'student',
      statut: (p && p.status) || (p ? 'active' : 'sans_profil'),
      cree_le: c.created_at,
      derniere_connexion: c.last_sign_in_at || null,
      derniere_activite: derniere,
      formation: !!(a && a.formation_actif),
      journal: !!(a && a.journal_actif),
      journal_demande_le: (a && a.journal_demande_le) || null,
      journal_retire_le: (a && a.journal_retire_le) || null,
      niveau_coach: (a && a.niveau) || null,
      niveau_learnybox: (l && l.niveau) || null,
      learnybox_pct: l && l.progression_pct != null ? l.progression_pct : null,
      lecons_vues: pr.vues,
      quiz_reussis: Array.from(quizReussis.get(c.id) || []).sort(),
    };
  });
  // ⚠️ Les coachs sont listes aussi, en queue : ils ont des droits a gerer
  // comme les autres (leur ligne existe), mais ce ne sont pas des eleves.
  membres.sort((x, y) => (x.role === 'student') === (y.role === 'student')
    ? String(x.nom || x.email).localeCompare(String(y.nom || y.email), 'fr')
    : (x.role === 'student' ? -1 : 1));
  return membres;
}

/* ══ DROITS ════════════════════════════════════════════════════════════════ */
async function droits(sb, corps, coach) {
  const cible = String(corps.user_id || '').trim();
  if (!UUID.test(cible)) throw httpError(400, 'user_id absent ou mal forme');
  const champs = { updated_at: new Date().toISOString() };
  if (typeof corps.formation === 'boolean') champs.formation_actif = corps.formation;
  if (typeof corps.journal === 'boolean') {
    champs.journal_actif = corps.journal;
    // ⚠️ Fermer le journal pose la date de retrait, et efface une demande en
    // cours ; l ouvrir efface les deux. C est ce que lit l ecran de choix.
    champs.journal_retire_le = corps.journal ? null : new Date().toISOString();
    champs.journal_demande_le = null;
  }
  if (Object.keys(champs).length === 1) throw httpError(400, 'rien a changer');
  // ⛔ `upsert` et pas `update` : un compte sans ligne (ancien, d avant le
  // declencheur) en recoit une ici plutot que de rester sans droits en silence.
  const { error } = await sb.from('acces_membre')
    .upsert({ user_id: cible, ...champs }, { onConflict: 'user_id' });
  if (error) throw httpError(500, `ecriture refusee : ${error.message}`);
  console.log(`[MEMBRES] ✅ droits ${JSON.stringify(champs)} pour ${cible} par ${coach.email}`);
  return { user_id: cible, ...champs };
}

/* ══ NIVEAU ════════════════════════════════════════════════════════════════ */
async function niveau(sb, corps, coach) {
  const cible = String(corps.user_id || '').trim();
  if (!UUID.test(cible)) throw httpError(400, 'user_id absent ou mal forme');
  const n = corps.niveau == null || corps.niveau === '' ? null : String(corps.niveau);
  if (n !== null && !NIVEAUX.includes(n)) throw httpError(400, 'niveau doit valoir debutant, intermediaire, confirme ou rien');
  const { error } = await sb.from('acces_membre')
    .upsert({ user_id: cible, niveau: n, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw httpError(500, `ecriture refusee : ${error.message}`);
  console.log(`[MEMBRES] ✅ niveau ${n} pour ${cible} par ${coach.email}`);
  return { user_id: cible, niveau: n };
}

/* ══ LE MAIL DE PREMIERE CONNEXION ═════════════════════════════════════════ */
/**
 * ⚠️ TEXTE PROPOSE, PAS ARRETE : un mail qui part au nom de Trader 360 est une
 * decision de contenu qui revient a Nadir. Il est ecrit pour etre relu, et
 * change en un seul endroit.
 */
function mailPremiereConnexion({ prenom, lien, origine }) {
  const bonjour = prenom ? `Bonjour ${texte(prenom)},` : 'Bonjour,';
  const sujet = 'Ton accès à Trader 360 : choisis ton mot de passe';
  const html = `<!doctype html><html lang="fr"><body style="margin:0;padding:0;background:#0a0a0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f7f6f3">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0d"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111318;border:1px solid #1e2128;border-radius:22px">
<tr><td style="padding:36px 36px 8px;text-align:center">
  <img src="${texte(origine)}/assets/marque/t360-logo-or.png" alt="Trader 360" width="180" style="width:180px;height:auto;display:inline-block">
</td></tr>
<tr><td style="padding:16px 36px 0;font-size:12.5px;letter-spacing:.22em;text-transform:uppercase;color:#e8b84b;font-weight:700;text-align:center">Ton espace est ouvert</td></tr>
<tr><td style="padding:14px 36px 0;font-size:17px;line-height:1.65;color:#f7f6f3">
  <p style="margin:0 0 14px">${bonjour}</p>
  <p style="margin:0 0 14px">Ton compte Trader 360 est créé. Il te donne accès à la formation et au journal de trading, avec la même adresse email.</p>
  <p style="margin:0 0 14px">Il te reste une seule chose à faire : choisir ton mot de passe.</p>
</td></tr>
<tr><td align="center" style="padding:14px 36px 10px">
  <a href="${texte(lien)}" style="display:inline-block;background:#e8b84b;color:#120e07;font-weight:700;font-size:16px;text-decoration:none;padding:15px 30px;border-radius:40px">Choisir mon mot de passe</a>
</td></tr>
<tr><td style="padding:6px 36px 0;font-size:14px;line-height:1.6;color:#9c9b94;text-align:center">Ce lien est personnel et ne sert qu'une fois. S'il a expiré, demande « Mot de passe oublié » sur la page de connexion.</td></tr>
<tr><td style="padding:26px 36px 34px;font-size:15px;line-height:1.65;color:#bdbcb6">
  <p style="margin:0 0 8px">Ensuite, connecte-toi sur <a href="${texte(origine)}" style="color:#e8b84b;text-decoration:none">${texte(origine.replace(/^https?:\/\//, ''))}</a> et choisis ton espace : la formation ou le journal.</p>
  <p style="margin:0">À tout de suite,<br>Nadir et Manu</p>
</td></tr>
</table>
<p style="max-width:560px;margin:18px auto 0;font-size:12px;color:#6f6e68;line-height:1.5">Trader 360 · Le trading comporte un risque de perte en capital. Tu reçois ce message parce qu'un compte a été créé pour toi sur le journal Trader 360.</p>
</td></tr></table></body></html>`;
  return { sujet, html };
}

async function envoyerMail({ to, sujet, html }) {
  if (!RESEND_API_KEY) throw httpError(500, 'RESEND_API_KEY absente : le mail ne peut pas partir');
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: EXPEDITEUR, to: [to], subject: sujet, html }),
  });
  const d = await r.json().catch(() => ({}));
  // ⛔ `r.ok`, jamais l absence d exception : un refus de Resend arrive en 4xx sans lever.
  if (!r.ok) throw httpError(502, `Resend a refuse le mail : ${d.message || r.status}`);
  return d.id;
}

async function lienDeConnexion(sb, email, origine) {
  const { data, error } = await sb.auth.admin.generateLink({
    type: 'recovery',
    email,
    options: { redirectTo: `${origine}/reset-password.html` },
  });
  if (error) throw httpError(500, `lien de connexion impossible : ${error.message}`);
  const lien = data?.properties?.action_link;
  if (!lien) throw httpError(500, 'lien de connexion vide');
  return lien;
}

/* ══ CREER ═════════════════════════════════════════════════════════════════ */
async function creer(sb, corps, coach, origine) {
  const email = String(corps.email || '').trim().toLowerCase();
  const prenom = String(corps.prenom || '').trim();
  const nom = String(corps.nom || '').trim();
  const n = corps.niveau ? String(corps.niveau) : null;
  const formation = corps.formation !== false;
  const journal = corps.journal !== false;
  const envoyer = corps.envoyer_mail !== false;
  if (!EMAIL.test(email)) throw httpError(400, 'email absent ou mal forme');
  if (!prenom) throw httpError(400, 'prenom absent');
  if (n !== null && !NIVEAUX.includes(n)) throw httpError(400, 'niveau inconnu');

  const nomComplet = [prenom, nom].filter(Boolean).join(' ');
  // ⚠️ `email_confirm: true` : le compte est cree confirme, c est le coach qui
  // l a cree. Le mot de passe est aleatoire et jamais communique : la personne
  // en choisit un par le lien. ⛔ Un compte deja existant est une erreur claire.
  const motDePasse = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
  const { data: cree, error: creeErr } = await sb.auth.admin.createUser({
    email, password: motDePasse, email_confirm: true, user_metadata: { name: nomComplet },
  });
  if (creeErr) {
    const deja = /already|exists|registered/i.test(creeErr.message || '');
    throw httpError(deja ? 409 : 500, deja ? 'un compte existe deja avec cet email' : `creation refusee : ${creeErr.message}`);
  }
  const uid = cree.user.id;

  // Le profil du journal : actif tout de suite, c est le coach qui l a cree.
  const { error: pubErr } = await sb.from('users')
    .upsert({ uuid: uid, email, name: nomComplet, role: 'student', status: 'active' }, { onConflict: 'uuid' });
  if (pubErr) console.error('[MEMBRES] ⚠️ profil public non ecrit :', pubErr.message);

  // Les droits et le niveau. Le declencheur a deja pose (true, true) : on
  // ecrit ce que le coach a coche, par-dessus.
  const { error: accErr } = await sb.from('acces_membre')
    .upsert({ user_id: uid, formation_actif: formation, journal_actif: journal, niveau: n, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  if (accErr) throw httpError(500, `droits non ecrits : ${accErr.message}`);

  let mail = null;
  if (envoyer) {
    const lien = await lienDeConnexion(sb, email, origine);
    const { sujet, html } = mailPremiereConnexion({ prenom, lien, origine });
    mail = await envoyerMail({ to: email, sujet, html });
  }
  console.log(`[MEMBRES] ✅ compte cree ${email} (${uid}) par ${coach.email}, mail ${mail ? 'envoye' : 'non envoye'}`);
  return { user_id: uid, email, mail_envoye: !!mail };
}

/* ══ RENVOYER LE MAIL ══════════════════════════════════════════════════════ */
async function renvoyerMail(sb, corps, coach, origine) {
  const cible = String(corps.user_id || '').trim();
  if (!UUID.test(cible)) throw httpError(400, 'user_id absent ou mal forme');
  const { data, error } = await sb.auth.admin.getUserById(cible);
  if (error || !data?.user?.email) throw httpError(404, 'compte introuvable');
  const email = data.user.email;
  const { data: p } = await sb.from('users').select('name').eq('uuid', cible).maybeSingle();
  const prenom = String((p && p.name) || (data.user.user_metadata && data.user.user_metadata.name) || '').split(' ')[0];
  const lien = await lienDeConnexion(sb, email, origine);
  const { sujet, html } = mailPremiereConnexion({ prenom, lien, origine });
  const id = await envoyerMail({ to: email, sujet, html });
  console.log(`[MEMBRES] ✅ mail de connexion renvoye a ${email} par ${coach.email}`);
  return { user_id: cible, email, mail_id: id };
}

/* ══ HANDLER ═══════════════════════════════════════════════════════════════ */
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, motif: 'POST attendu' });
  }
  let coach;
  try {
    coach = await requireCoach(req);
  } catch (e) {
    return res.status(e?.statusCode || e?.status || 401).json({ ok: false, motif: e?.message || 'non autorise' });
  }
  const corps = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const action = String(corps.action || '').trim();
  const sb = getServiceClient();
  const origine = origineDe(req);
  try {
    let resultat;
    if (action === 'lister') resultat = await lister(sb);
    else if (action === 'droits') resultat = await droits(sb, corps, coach);
    else if (action === 'niveau') resultat = await niveau(sb, corps, coach);
    else if (action === 'creer') resultat = await creer(sb, corps, coach, origine);
    else if (action === 'renvoyer_mail') resultat = await renvoyerMail(sb, corps, coach, origine);
    else return res.status(400).json({ ok: false, motif: 'action inconnue' });
    return res.status(200).json({ ok: true, action, resultat });
  } catch (e) {
    const code = e?.statusCode || e?.status || 500;
    if (code >= 500) console.error('[MEMBRES] ⚠️', action, e?.message || e);
    return res.status(code).json({ ok: false, motif: e?.message || 'erreur' });
  }
}
