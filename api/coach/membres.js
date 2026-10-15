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
 *   creer_manquants  un compte pour chaque membre LearnyBox actif qui n en a
 *                  pas encore, sans mail
 *   fiche          tout ce qu on sait d une personne, pour l ecran « Fiche membre »
 *   accueil, ventes, evaluations, progression, transactions : le back-office (voir plus bas)
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

  /**
   * ── ⛔ LA PROGRESSION S AGREGE EN BASE, ELLE NE SE LIT PAS LIGNE A LIGNE ──
   *
   * ⚠️ DEFAUT VU PAR NADIR LE 15/10 : « beaucoup d eleves a 0 sur 64 alors
   * qu ils ont progresse ». La route lisait `formation_progression` en entier
   * et comptait ici ; PostgREST rend 1000 lignes au plus, la table en a 4169.
   * Les eleves au-dela de la millieme ligne tombaient a zero, sans erreur, et
   * leur pourcentage LearnyBox a cote rendait l ecart visible.
   * ⛔ C est le meme motif que le tableau de bord coach (281 requetes puis une
   * vue) : ce qui depend du nombre de lignes finit par mentir. La fonction
   * `coach_progression_resume()` compte en base, quel que soit le volume.
   * ⚠️ Elle est reservee a la cle de service : un eleve ne peut pas l appeler.
   */
  const [pub, acces, lb, prog, vus] = await Promise.all([
    sb.from('users').select('uuid, name, email, role, status, created_at'),
    sb.from('acces_membre').select('user_id, formation_actif, journal_actif, journal_demande_le, journal_retire_le, niveau'),
    sb.from('formation_niveau_learnybox').select('learnybox_id, email, prenom, nom, niveau, progression_pct, actif, inscrit_le, derniere_activite'),
    sb.rpc('coach_progression_resume'),
    sb.from('formation_parcours_vu').select('user_id, vue_le'),
  ]);
  for (const r of [pub, acces, lb, prog, vus]) {
    if (r.error) throw httpError(500, `lecture impossible : ${r.error.message}`);
  }
  // ⚠️ Temoin : si une de ces tables depasse un jour 1000 lignes, on le dit
  // plutot que de rendre une liste tronquee en silence.
  for (const [nom, r] of [['users', pub], ['acces_membre', acces], ['formation_niveau_learnybox', lb], ['formation_parcours_vu', vus]]) {
    if ((r.data || []).length >= 1000) console.warn(`[MEMBRES] ⚠️ ${nom} rend 1000 lignes : plafond PostgREST probablement atteint, liste incomplete`);
  }

  const parUuid = new Map((pub.data || []).map((u) => [u.uuid, u]));
  const parAcces = new Map((acces.data || []).map((a) => [a.user_id, a]));
  const parEmailLB = new Map((lb.data || []).map((l) => [String(l.email || '').toLowerCase(), l]));
  const progression = new Map();
  const quizReussis = new Map();
  for (const p of prog.data || []) {
    progression.set(p.user_id, { vues: Number(p.lecons_vues) || 0, derniere: p.derniere_lecture || null });
    quizReussis.set(p.user_id, new Set(p.quiz_reussis || []));
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
      learnybox_actif: l ? !!l.actif : null,
      lecons_vues: pr.vues,
      quiz_reussis: Array.from(quizReussis.get(c.id) || []).sort(),
      sans_compte: false,
    };
  });

  /**
   * ── ⚠️ LES MEMBRES LEARNYBOX SANS COMPTE FONT PARTIE DE LA LISTE ──────────
   *
   * Retour de Nadir du 15/10 : « ils ont accès à LearnyBox et à leur formation,
   * ils doivent apparaître dans ce tableau, sinon nous n avons pas la main
   * dessus et on va devoir ajouter manuellement à chaque fois ». Ils arrivent
   * donc ici, marques `sans_compte`, avec ce que LearnyBox sait d eux ; et le
   * bouton « Créer le compte » de leur ligne part de ces donnees-la.
   * ⛔ Pas de `user_id` : il n existe pas encore. La correspondance se fait
   * par email, insensible a la casse, comme partout ailleurs.
   */
  const emailsAvecCompte = new Set(comptes.map((c) => String(c.email || '').toLowerCase()));
  for (const l of lb.data || []) {
    const email = String(l.email || '').toLowerCase();
    if (!email || emailsAvecCompte.has(email)) continue;
    membres.push({
      user_id: null,
      learnybox_id: l.learnybox_id,
      email: l.email,
      prenom: l.prenom || '',
      nom: [l.prenom, l.nom].filter(Boolean).join(' '),
      nom_famille: l.nom || '',
      role: 'student',
      statut: 'sans_compte',
      cree_le: l.inscrit_le || null,
      derniere_connexion: null,
      derniere_activite: l.derniere_activite || null,
      formation: false, journal: false,
      journal_demande_le: null, journal_retire_le: null,
      niveau_coach: null,
      niveau_learnybox: l.niveau || null,
      learnybox_pct: l.progression_pct != null ? l.progression_pct : null,
      learnybox_actif: !!l.actif,
      lecons_vues: 0, quiz_reussis: [],
      sans_compte: true,
    });
  }
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

/**
 * ⚠️ CHAQUE MAIL QUE NOUS ENVOYONS EST JOURNALISE dans `mails_envoyes` : c est
 * l onglet « Emails » de la fiche membre. Un echec est journalise aussi, avec
 * son motif : un mail parti sans trace et un mail jamais parti se ressemblent.
 */
async function journaliserMail(sb, { user_id, email, type, sujet, fournisseur_id, envoye_par, erreur }) {
  const { error } = await sb.from('mails_envoyes').insert({
    user_id: user_id || null, email, type, sujet, fournisseur_id: fournisseur_id || null, envoye_par: envoye_par || null, erreur: erreur || null,
  });
  if (error) console.error('[MEMBRES] ⚠️ mail non journalise :', error.message);
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

  /**
   * ⚠️ LA PROGRESSION LEARNYBOX SUIT LE COMPTE. Si cet email a une ligne dans
   * `formation_niveau_learnybox`, ses chapitres pointes la-bas sont reportes
   * ici tout de suite : `appliquer_progression_learnybox()` est rejouable,
   * joint par email, ne coche que « terminee » et n ecrase jamais une vue.
   * ⛔ Sans cet appel, un ancien eleve repartirait de zero sans erreur.
   */
  let progression = null;
  const { data: ligneLb } = await sb.from('formation_niveau_learnybox').select('learnybox_id').ilike('email', email).limit(1);
  if (ligneLb && ligneLb.length) {
    const { data: r, error: rErr } = await sb.rpc('appliquer_progression_learnybox');
    if (rErr) console.error('[MEMBRES] ⚠️ progression LearnyBox non appliquee :', rErr.message);
    else progression = Array.isArray(r) ? r[0] : r;
  }

  let mail = null;
  if (envoyer) {
    const lien = await lienDeConnexion(sb, email, origine);
    const { sujet, html } = mailPremiereConnexion({ prenom, lien, origine });
    try {
      mail = await envoyerMail({ to: email, sujet, html });
      await journaliserMail(sb, { user_id: uid, email, type: 'premiere_connexion', sujet, fournisseur_id: mail, envoye_par: coach.email });
    } catch (e) {
      await journaliserMail(sb, { user_id: uid, email, type: 'premiere_connexion', sujet, envoye_par: coach.email, erreur: e.message });
      throw e;
    }
  }
  console.log(`[MEMBRES] ✅ compte cree ${email} (${uid}) par ${coach.email}, mail ${mail ? 'envoye' : 'non envoye'}, progression LearnyBox ${progression ? 'appliquee' : 'sans objet'}`);
  return { user_id: uid, email, mail_envoye: !!mail, learnybox: !!(ligneLb && ligneLb.length), progression };
}

/* ══ CREER TOUS LES COMPTES MANQUANTS ══════════════════════════════════════ */
/**
 * Arbitrage de Nadir du 15/10 : « tu me les mets tous avec un compte, ceux qui
 * ont accès à la formation sur LearnyBox, et tu me mets déjà les lignes ». Un
 * compte par membre LearnyBox actif sans compte, formation ET journal ouverts
 * (le coach ferme ce qu il veut d un interrupteur), SANS mail : ils seront
 * prevenus au moment choisi, par « Mail » sur leur ligne ou par la bascule.
 * ⚠️ La progression LearnyBox est reportee une fois a la fin, pour tous.
 * ⛔ Les inactifs LearnyBox ne sont pas crees sauf demande explicite.
 */
async function creerManquants(sb, corps, coach) {
  const inclureInactifs = corps.inclure_inactifs === true;
  const comptes = [];
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw httpError(500, `liste des comptes illisible : ${error.message}`);
    comptes.push(...(data?.users || []));
    if (!data?.users || data.users.length < 200) break;
  }
  const emailsAvecCompte = new Set(comptes.map((c) => String(c.email || '').toLowerCase()));
  const { data: lb, error: lbErr } = await sb.from('formation_niveau_learnybox').select('learnybox_id, email, prenom, nom, actif');
  if (lbErr) throw httpError(500, `LearnyBox illisible : ${lbErr.message}`);
  const aCreer = (lb || []).filter((l) => l.email && !emailsAvecCompte.has(String(l.email).toLowerCase()) && (inclureInactifs || l.actif));

  const crees = [], echecs = [];
  for (const l of aCreer) {
    const email = String(l.email).trim().toLowerCase();
    if (!EMAIL.test(email)) { echecs.push({ email: l.email, motif: 'email mal forme' }); continue; }
    const nomComplet = [l.prenom, l.nom].filter(Boolean).join(' ').trim();
    const motDePasse = Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
    const { data: cree, error: creeErr } = await sb.auth.admin.createUser({
      email, password: motDePasse, email_confirm: true, user_metadata: { name: nomComplet },
    });
    if (creeErr) { echecs.push({ email, motif: creeErr.message }); continue; }
    const uid = cree.user.id;
    const { error: pubErr } = await sb.from('users')
      .upsert({ uuid: uid, email, name: nomComplet, role: 'student', status: 'active' }, { onConflict: 'uuid' });
    if (pubErr) console.error('[MEMBRES] ⚠️ profil public non ecrit pour', email, ':', pubErr.message);
    /**
     * ⚠️ FORMATION OUVERTE, JOURNAL FERME A LA CREATION. Arbitrage de Nadir du
     * 15/10 : « si ces comptes n ont pas de journal, tu me decoches journal ».
     * C est le report de progression, juste apres, qui ouvre le journal a ceux
     * qui ont vu le chapitre 5.10 sur LearnyBox : le declencheur
     * `ouvrir_journal_apres_chapitre` fait exactement cela, et rien d autre.
     */
    const { error: accErr } = await sb.from('acces_membre')
      .upsert({ user_id: uid, formation_actif: true, journal_actif: false, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (accErr) { echecs.push({ email, motif: `droits non ecrits : ${accErr.message}` }); continue; }
    crees.push({ email, user_id: uid });
  }
  let progression = null;
  if (crees.length) {
    const { data: r, error: rErr } = await sb.rpc('appliquer_progression_learnybox');
    if (rErr) console.error('[MEMBRES] ⚠️ progression LearnyBox non appliquee :', rErr.message);
    else progression = Array.isArray(r) ? r[0] : r;
  }
  console.log(`[MEMBRES] ✅ ${crees.length} compte(s) cree(s) sans mail par ${coach.email}, ${echecs.length} echec(s)`);
  return { a_creer: aCreer.length, crees, echecs, progression };
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
  let id;
  try {
    id = await envoyerMail({ to: email, sujet, html });
    await journaliserMail(sb, { user_id: cible, email, type: 'premiere_connexion', sujet, fournisseur_id: id, envoye_par: coach.email });
  } catch (e) {
    await journaliserMail(sb, { user_id: cible, email, type: 'premiere_connexion', sujet, envoye_par: coach.email, erreur: e.message });
    throw e;
  }
  console.log(`[MEMBRES] ✅ mail de connexion renvoye a ${email} par ${coach.email}`);
  return { user_id: cible, email, mail_id: id };
}

/* ══ LA FICHE D UN MEMBRE ══════════════════════════════════════════════════ */
/**
 * Tout ce qu on sait d une personne, en une lecture, pour l ecran « Fiche
 * membre » (demande de Nadir du 15/10, sur le modele de la fiche CRM
 * LearnyBox). Par `user_id` (compte du journal) ou par `email` (membre
 * LearnyBox sans compte). ⚠️ Chaque onglet dit d ou vient sa donnee ; ce qui
 * n est pas encore importe (transactions LearnyBox, sondage de candidature)
 * revient vide avec `source`, jamais invente.
 */
async function fiche(sb, corps) {
  const uid = String(corps.user_id || '').trim();
  let email = String(corps.email || '').trim().toLowerCase();
  if (uid && !UUID.test(uid)) throw httpError(400, 'user_id mal forme');
  if (!uid && !EMAIL.test(email)) throw httpError(400, 'user_id ou email attendu');

  let compte = null;
  if (uid) {
    const { data, error } = await sb.auth.admin.getUserById(uid);
    if (error || !data?.user) throw httpError(404, 'compte introuvable');
    compte = data.user;
    email = String(compte.email || '').toLowerCase();
  }
  const [pub, acces, lbNiveau, lbProfil, mails] = await Promise.all([
    uid ? sb.from('users').select('uuid, name, email, role, status, created_at, legal_accepted_at').eq('uuid', uid).maybeSingle() : Promise.resolve({ data: null }),
    uid ? sb.from('acces_membre').select('*').eq('user_id', uid).maybeSingle() : Promise.resolve({ data: null }),
    sb.from('formation_niveau_learnybox').select('*').ilike('email', email).limit(1),
    sb.from('membres_profil_learnybox').select('*').ilike('email', email).limit(1),
    sb.from('mails_envoyes').select('type, sujet, envoye_le, erreur, envoye_par').ilike('email', email).order('envoye_le', { ascending: false }).limit(100),
  ]);
  for (const r of [pub, acces, lbNiveau, lbProfil, mails]) if (r.error) throw httpError(500, `lecture impossible : ${r.error.message}`);
  /**
   * ⚠️ LES TRANSACTIONS SE CHERCHENT PAR EMAIL ET PAR IDENTIFIANT LEARNYBOX.
   * Mesure a l import du 15/10 : une transaction porte « flyinh.gwen », la
   * membre s appelle « flying.gwen » ; l identifiant LearnyBox est le meme.
   * Par l email seul, sa fiche n aurait montre aucun paiement, sans erreur.
   */
  const idLb = lbNiveau.data && lbNiveau.data[0] ? lbNiveau.data[0].learnybox_id : null;
  const filtreTx = idLb ? `email.ilike.${email},learnybox_id.eq.${idLb}` : `email.ilike.${email}`;
  const transactions = await sb.from('membres_transactions').select('*').or(filtreTx).order('date_transaction', { ascending: false }).limit(100);
  if (transactions.error) throw httpError(500, `lecture impossible : ${transactions.error.message}`);

  let formation = { progression: [], quiz: [], notes: 0, parcours_vu_le: null };
  let journal = { trades: 0, dernier_trade: null, entrees: 0, derniere_entree: null, comptes: 0 };
  let activites = [];
  if (uid) {
    const [prog, quiz, notes, vu, trades, entrees, comptes] = await Promise.all([
      sb.from('formation_progression').select('lecon_id, vue, progress_seconds, secondes_vues, last_watched_at').eq('user_id', uid),
      sb.from('formation_quiz_resultats').select('module_cle, score, total, reussi, reponses, created_at').eq('user_id', uid).order('created_at', { ascending: false }),
      sb.from('formation_notes').select('lecon_id, updated_at').eq('user_id', uid),
      sb.from('formation_parcours_vu').select('vue_le').eq('user_id', uid).maybeSingle(),
      sb.from('trades').select('id, trade_date, created_at').eq('user_id', uid).order('created_at', { ascending: false }).limit(2000),
      sb.from('journal_entries').select('id, entry_date, created_at').eq('user_id', uid).order('entry_date', { ascending: false }).limit(2000),
      sb.from('accounts').select('id, name, active').eq('user_id', uid),
    ]);
    for (const r of [prog, quiz, notes, vu, trades, entrees, comptes]) if (r.error) throw httpError(500, `lecture impossible : ${r.error.message}`);
    formation = {
      progression: prog.data || [],
      quiz: quiz.data || [],
      notes: (notes.data || []).length,
      parcours_vu_le: vu.data ? vu.data.vue_le : null,
    };
    journal = {
      trades: (trades.data || []).length,
      dernier_trade: trades.data && trades.data[0] ? (trades.data[0].trade_date || trades.data[0].created_at) : null,
      entrees: (entrees.data || []).length,
      derniere_entree: entrees.data && entrees.data[0] ? entrees.data[0].entry_date : null,
      comptes: (comptes.data || []).filter((c) => c.active !== false).length,
    };
    /**
     * ⚠️ LES ACTIVITES : une ligne par evenement date, toutes sources
     * confondues, les plus recentes d abord. Chapitres vus, quiz, notes,
     * trades (par jour), entrees de journal, mails, connexions.
     */
    for (const p of formation.progression) if (p.vue && p.last_watched_at) activites.push({ quand: p.last_watched_at, type: 'chapitre', detail: p.lecon_id });
    for (const q of formation.quiz) activites.push({ quand: q.created_at, type: 'quiz', detail: `Module ${q.module_cle} : ${q.score} / ${q.total}${q.reussi ? ', réussi' : ''}` });
    for (const n of notes.data || []) activites.push({ quand: n.updated_at, type: 'note', detail: n.lecon_id });
    const joursTrades = new Map();
    for (const t of trades.data || []) { const j = String(t.trade_date || t.created_at || '').slice(0, 10); if (j) joursTrades.set(j, (joursTrades.get(j) || 0) + 1); }
    for (const [j, n] of joursTrades) activites.push({ quand: `${j}T12:00:00Z`, type: 'trades', detail: `${n} trade${n > 1 ? 's' : ''}` });
    for (const e of entrees.data || []) activites.push({ quand: `${e.entry_date}T12:00:00Z`, type: 'journal', detail: 'Entrée de journal' });
    if (compte && compte.last_sign_in_at) activites.push({ quand: compte.last_sign_in_at, type: 'connexion', detail: 'Dernière connexion' });
    if (compte && compte.created_at) activites.push({ quand: compte.created_at, type: 'compte', detail: 'Compte créé' });
  }
  for (const m of mails.data || []) activites.push({ quand: m.envoye_le, type: 'mail', detail: m.sujet + (m.erreur ? ' (échec)' : '') });
  for (const t of transactions.data || []) if (t.date_transaction) activites.push({ quand: t.date_transaction, type: 'transaction', detail: `${t.produit || ''} ${t.montant != null ? `${t.montant} ${t.devise || 'EUR'}` : ''}`.trim() });
  const lbN = lbNiveau.data && lbNiveau.data[0];
  if (lbN && lbN.inscrit_le) activites.push({ quand: lbN.inscrit_le, type: 'learnybox', detail: 'Inscription LearnyBox' });
  activites.sort((a, b) => String(b.quand).localeCompare(String(a.quand)));

  return {
    compte: compte ? { user_id: compte.id, email: compte.email, cree_le: compte.created_at, derniere_connexion: compte.last_sign_in_at, confirme: !!compte.email_confirmed_at } : null,
    profil: pub.data || null,
    acces: acces.data || null,
    learnybox: lbN || null,
    learnybox_profil: (lbProfil.data && lbProfil.data[0]) || null,
    formation,
    journal,
    mails: mails.data || [],
    transactions: { lignes: transactions.data || [], source: 'learnybox', importe: (transactions.data || []).length > 0 },
    activites: activites.slice(0, 300),
  };
}

/* ══ LE BACK-OFFICE : LES LECTURES AGREGEES (15/10) ════════════════════════
 * ⚠️ Dans CE fichier et pas dans un api/coach/back-office.js : le plan Hobby de
 * Vercel plafonne a 12 fonctions par deploiement, et la treizieme a fait
 * echouer le build du 15/10 (« No more than 12 Serverless Functions »). Une
 * route, plusieurs actions : c est la regle du depot desormais, pour chaque
 * lot coach a venir (offres, CRM, mails).
 *   accueil      les chiffres et series du tableau de bord
 *   ventes       le tableau de bord des ventes, les series mensuelles, les offres
 *   evaluations  toutes les tentatives de quiz, avec le nom de l eleve
 *   progression  la progression chapitre par chapitre de chaque eleve
 *   transactions toutes les transactions valides (page d offre, commandes, factures)
 * Fonctions SQL `security definer` reservees a la cle de service :
 * back_office_accueil, back_office_ventes, back_office_progression_par_eleve. */
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

async function boAccueil(sb) {
  const { data, error } = await sb.rpc('back_office_accueil');
  if (error) throw httpError(500, `accueil illisible : ${error.message}`);
  return data;
}

async function boVentes(sb) {
  const { data, error } = await sb.rpc('back_office_ventes');
  if (error) throw httpError(500, `ventes illisibles : ${error.message}`);
  return data;
}

async function boTransactions(sb) {
  const { data, error } = await sb.from('membres_transactions').select('*').order('date_transaction', { ascending: false }).limit(5000);
  if (error) throw httpError(500, `transactions illisibles : ${error.message}`);
  if ((data || []).length >= 1000) console.warn('[BACK-OFFICE] ⚠️ membres_transactions depasse 1000 lignes : paginer');
  return data || [];
}

async function boEvaluations(sb) {
  const [{ data, error }, ids] = await Promise.all([
    sb.from('formation_quiz_resultats').select('id, user_id, module_cle, score, total, reussi, reponses, created_at').order('created_at', { ascending: false }).limit(1000),
    identites(sb),
  ]);
  if (error) throw httpError(500, `quiz illisibles : ${error.message}`);
  return (data || []).map((q) => ({ ...q, eleve: ids.get(q.user_id) || { user_id: q.user_id, email: '', nom: '' } }));
}

async function boProgression(sb) {
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
    else if (action === 'creer_manquants') resultat = await creerManquants(sb, corps, coach);
    else if (action === 'fiche') resultat = await fiche(sb, corps);
    else if (action === 'accueil') resultat = await boAccueil(sb);
    else if (action === 'ventes') resultat = await boVentes(sb);
    else if (action === 'evaluations') resultat = await boEvaluations(sb);
    else if (action === 'progression') resultat = await boProgression(sb);
    else if (action === 'transactions') resultat = await boTransactions(sb);
    else return res.status(400).json({ ok: false, motif: 'action inconnue' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ ok: true, action, resultat });
  } catch (e) {
    const code = e?.statusCode || e?.status || 500;
    if (code >= 500) console.error('[MEMBRES] ⚠️', action, e?.message || e);
    return res.status(code).json({ ok: false, motif: e?.message || 'erreur' });
  }
}
