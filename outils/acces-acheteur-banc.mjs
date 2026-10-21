/**
 * BANC : « Virement reçu » ouvre les accès (21/10). La VRAIE route `api/coach/membres.js`
 * est appelée, avec un coach authentifié ; seuls les services externes sont doublés :
 *   - Supabase (auth et PostgREST), aux formes que lit supabase-js ;
 *   - le site (`/api/offres` : virement_recu, commande, acces_resultat) ;
 *   - Resend (mail d'accès) et Brevo (liste MEMBRES T360).
 * Cas : nouvel élève, ancien élève qui rachète, présentiel, mail qui échoue puis
 * « Réessayer », commande annulée. Usage : node outils/acces-acheteur-banc.mjs
 */
process.env.SUPABASE_URL = 'https://journal.test'; process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
process.env.RESEND_API_KEY = 're_test'; process.env.BREVO_API_KEY = 'brevo'; process.env.BACKOFFICE_CLE = 'cle-bo'; process.env.SITE_URL = 'https://site.test';
let ko = 0; const dire = (ok, m, v) => { console.log((ok ? 'ok  ' : '⛔  ') + m + (v !== undefined ? '  ' + JSON.stringify(v).slice(0, 220) : '')); if (!ok) ko++; };

const E = { comptes: [{ id: 'coach-1', email: 'coach@trader360.fr' }, { id: 'ancien-1', email: 'ancien@exemple.fr' }], users: [], acces: [], mails: [], resend: [], brevo: [], site: [], resendEnPanne: false };
const COMMANDES = {
  1: { id: 1, reference: 'T360-2026-0101', email: 'Nouveau@Exemple.fr', prenom: 'Nouvel', nom: 'Élève', statut: 'attente_virement', mode: 'virement', offre: { id: 1, type: 'formation', formation_cle: 'trader360' } },
  2: { id: 2, reference: 'T360-2026-0102', email: 'ancien@exemple.fr', prenom: 'Ancien', nom: 'Élève', statut: 'attente_virement', mode: 'virement', offre: { id: 1, type: 'formation', formation_cle: 'trader360' } },
  3: { id: 3, reference: 'T360-2026-0103', email: 'pres@exemple.fr', prenom: 'Pré', nom: 'Sentiel', statut: 'attente_virement', mode: 'virement', offre: { id: 2, type: 'presentiel', formation_cle: null } },
  4: { id: 4, reference: 'T360-2026-0104', email: 'panne@exemple.fr', prenom: 'Panne', nom: 'Mail', statut: 'attente_virement', mode: 'virement', offre: { id: 1, type: 'formation', formation_cle: 'trader360' } },
  5: { id: 5, reference: 'T360-2026-0105', email: 'annule@exemple.fr', prenom: 'A', nom: 'B', statut: 'annulee', mode: 'virement', offre: { id: 1, type: 'formation', formation_cle: 'trader360' } },
  6: { id: 6, reference: 'T360-2026-0106', email: 'carte3@exemple.fr', prenom: 'Carte', nom: 'Trois', statut: 'en_cours', mode: 'cb3', offre: { id: 1, type: 'formation', formation_cle: 'trader360' } },
  7: { id: 7, reference: 'T360-2026-0107', email: 'pasencore@exemple.fr', prenom: 'Pas', nom: 'Encore', statut: 'attente_paiement', mode: 'cb1', offre: { id: 1, type: 'formation', formation_cle: 'trader360' } },
};
const json = (status, corps, h = {}) => new Response(corps === undefined ? '' : JSON.stringify(corps), { status, headers: { 'Content-Type': 'application/json', ...h } });
globalThis.fetch = async (entree, o = {}) => {
  const u = new URL(typeof entree === 'string' ? entree : entree.url); const m = (o.method || 'GET').toUpperCase();
  const corps = o.body ? JSON.parse(o.body) : null;
  if (u.host === 'site.test') {
    if (o.headers['x-backoffice-cle'] !== 'cle-bo') return json(401, { ok: false, motif: 'non autorisé' });
    E.site.push(corps); const k = COMMANDES[corps.id];
    if (corps.action === 'virement_recu') { if (!k) return json(404, { ok: false, motif: 'introuvable' }); if (k.statut === 'annulee') return json(409, { ok: false, motif: 'commande annulée : impossible de la marquer payée' }); k.statut = 'payee'; return json(200, { ok: true, resultat: { ...k } }); }
    if (corps.action === 'commande') return k ? json(200, { ok: true, resultat: { ...k } }) : json(404, { ok: false });
    if (corps.action === 'acces_resultat') { k.acces = corps.ok ? 'ouverts' : `erreur: ${corps.erreur}`; if (corps.ok) k.acces_ouverts_le = '2026-10-22T10:00:00Z'; return json(200, { ok: true, resultat: k }); }
    return json(400, { ok: false, motif: 'action inconnue' });
  }
  if (u.host === 'api.resend.com') { if (E.resendEnPanne) return json(422, { message: 'domaine non vérifié' }); E.resend.push(corps); return json(200, { id: `re_${E.resend.length}` }); }
  if (u.host === 'api.brevo.com') { E.brevo.push({ path: u.pathname, corps }); return json(201, { id: 1 }); }
  if (u.host !== 'journal.test') return json(404, {});
  const p = u.pathname;
  if (p === '/auth/v1/user') return json(200, { id: 'coach-1', email: 'coach@trader360.fr', aud: 'authenticated' });
  if (p === '/auth/v1/admin/users' && m === 'POST') {
    if (E.comptes.some((c) => c.email === corps.email)) return json(422, { code: 'email_exists', msg: 'A user with this email address has already been registered' });
    const c = { id: `uid-${E.comptes.length + 1}`, email: corps.email, user_metadata: corps.user_metadata }; E.comptes.push(c); return json(200, c);
  }
  if (p === '/auth/v1/admin/users' && m === 'GET') return json(200, { users: E.comptes, aud: 'authenticated' });
  if (p === '/auth/v1/admin/generate_link') { const c = E.comptes.find((x) => x.email === corps.email); return json(200, { action_link: `https://journal.test/verify?t=${c.id}`, email_otp: '', hashed_token: 'h', redirect_to: corps.redirect_to || '', verification_type: 'recovery', ...c }); }
  const table = p.replace('/rest/v1/', '');
  if (table === 'users' && m === 'GET') return json(200, { role: 'coach', status: 'active' });
  if (table === 'users' && m === 'POST') { E.users.push(corps); return json(201); }
  if (table === 'acces_membre' && m === 'POST') { const l = Array.isArray(corps) ? corps[0] : corps; E.acces = E.acces.filter((x) => x.user_id !== l.user_id); E.acces.push(l); return json(201); }
  if (table === 'formation_niveau_learnybox') return json(200, []);
  if (table === 'mails_envoyes' && m === 'POST') { E.mails.push(Array.isArray(corps) ? corps[0] : corps); return json(201); }
  return json(404, { message: `table ${table} non doublée` });
};

const { default: handler } = await import('../api/coach/membres.js');
async function appel(corps) {
  const req = { method: 'POST', headers: { authorization: 'Bearer jeton-coach', host: 'www.journaltrader360.fr', 'x-forwarded-proto': 'https' }, body: corps, query: {} };
  let statut = 0; let sortie = null;
  const res = { setHeader() {}, status(s) { statut = s; return res; }, json(d) { sortie = d; return res; } };
  await handler(req, res);
  return { statut, d: sortie };
}

console.log('— nouvel élève');
let r = await appel({ action: 'offres', sous_action: 'virement_recu', id: 1 });
const nouveau = E.comptes.find((c) => c.email === 'nouveau@exemple.fr');
dire(r.statut === 200 && r.d.resultat.acces.ok && r.d.resultat.acces.cree, 'réponse : accès ouverts, compte créé', r.d.resultat?.acces);
dire(!!nouveau, 'compte créé, adresse ramenée en minuscules');
const acc = E.acces.find((a) => a.user_id === nouveau?.id);
dire(acc && acc.formation_actif === true && acc.journal_actif === true, 'formation ET journal ouverts');
dire(E.users.some((x) => x.uuid === nouveau?.id && x.role === 'student' && x.status === 'active' && x.name === 'Nouvel Élève'), 'profil élève actif, nom complet');
dire(E.resend.some((x) => x.to.includes('nouveau@exemple.fr') && /mot de passe/i.test(x.subject + x.html)), 'mail d accès (choisir son mot de passe) parti à l élève');
dire(E.mails.some((x) => x.email === 'nouveau@exemple.fr' && x.type === 'premiere_connexion' && !x.erreur), 'mail journalisé dans sa fiche');
dire(E.brevo.some((x) => x.path === '/v3/contacts' && x.corps.email === 'nouveau@exemple.fr' && x.corps.listIds.includes(7) && x.corps.updateEnabled), 'ajouté à la liste Brevo MEMBRES T360 (7)');
dire(COMMANDES[1].acces === 'ouverts' && COMMANDES[1].statut === 'payee', 'site : commande payée, accès notés ouverts');

console.log('— ancien élève qui rachète');
E.acces.push({ user_id: 'ancien-1', formation_actif: false, journal_actif: false });
const avant = E.comptes.length;
r = await appel({ action: 'offres', sous_action: 'virement_recu', id: 2 });
dire(r.d.resultat.acces.ok && r.d.resultat.acces.cree === false && E.comptes.length === avant, 'aucun doublon : compte existant retrouvé', r.d.resultat?.acces);
const accA = E.acces.find((a) => a.user_id === 'ancien-1');
dire(accA.formation_actif && accA.journal_actif && accA.journal_retire_le === null, 'droits rouverts (formation et journal)');
dire(E.resend.some((x) => x.to.includes('ancien@exemple.fr')), 'mail d accès renvoyé');

console.log('— présentiel');
const nComptes = E.comptes.length; const nMails = E.resend.length;
r = await appel({ action: 'offres', sous_action: 'virement_recu', id: 3 });
dire(r.d.resultat.acces.ok && r.d.resultat.acces.sans_objet && E.comptes.length === nComptes && E.resend.length === nMails, 'payé, aucun compte ni mail d accès (offre sans compte)');

console.log('— le mail échoue, puis « Réessayer »');
E.resendEnPanne = true;
r = await appel({ action: 'offres', sous_action: 'virement_recu', id: 4 });
dire(r.statut === 200 && r.d.resultat.acces.ok === false && /Resend|mail/i.test(r.d.resultat.acces.erreur), 'échec rapporté au coach, pas masqué', r.d.resultat?.acces);
dire(String(COMMANDES[4].acces).startsWith('erreur') && COMMANDES[4].statut === 'payee', 'site : commande payée, accès notés EN ERREUR');
dire(E.mails.some((x) => x.email === 'panne@exemple.fr' && x.erreur), 'échec du mail journalisé dans la fiche');
E.resendEnPanne = false;
r = await appel({ action: 'offres', sous_action: 'ouvrir_acces', id: 4 });
dire(r.d.resultat.acces.ok && r.d.resultat.acces.cree === false && COMMANDES[4].acces === 'ouverts' && E.resend.some((x) => x.to.includes('panne@exemple.fr')), 'Réessayer : compte déjà créé retrouvé, mail parti, accès notés ouverts', r.d.resultat?.acces);
dire(E.comptes.filter((c) => c.email === 'panne@exemple.fr').length === 1, 'un seul compte malgré deux tentatives');

console.log('— commande annulée');
const n2 = E.comptes.length;
r = await appel({ action: 'offres', sous_action: 'virement_recu', id: 5 });
dire(r.statut === 409 && E.comptes.length === n2, 'refusée, aucun compte créé', r.d);
r = await appel({ action: 'offres', sous_action: 'ouvrir_acces', id: 5 });
dire(r.statut === 409 && E.comptes.length === n2, 'Réessayer sur une commande non payée : refusé');

console.log('— paiement Stripe confirmé (webhook du site, clé partagée, sans coach)');
async function appelSite(corps, cle = 'cle-bo') {
  const req = { method: 'POST', headers: { host: 'app.journaltrader360.fr', 'x-forwarded-proto': 'https', ...(cle ? { 'x-backoffice-cle': cle } : {}) }, body: corps, query: {} };
  let statut = 0; let sortie = null;
  await handler(req, { setHeader() {}, status(s) { statut = s; return this; }, json(d) { sortie = d; return this; } });
  return { statut, d: sortie };
}
const n3 = E.comptes.length;
r = await appelSite({ action: 'commande_payee', id: 6 }, null);
dire(r.statut === 401 && E.comptes.length === n3, 'sans clé : 401, rien créé');
r = await appelSite({ action: 'commande_payee', id: 6 }, 'cle-bo-fausse');
dire(r.statut === 401 && E.comptes.length === n3, 'clé fausse (même longueur ou non) : 401');
r = await appelSite({ action: 'commande_payee', id: 6 });
const c6 = E.comptes.find((c) => c.email === 'carte3@exemple.fr');
dire(r.statut === 200 && r.d.resultat.acces.ok && r.d.resultat.acces.cree && !!c6, '3 fois, 1re échéance payée (en cours) : compte créé', r.d);
dire(E.resend.some((x) => x.to.includes('carte3@exemple.fr')) && E.brevo.some((x) => x.corps?.email === 'carte3@exemple.fr' && x.corps.listIds.includes(7)), 'mail d accès + liste MEMBRES T360');
dire(COMMANDES[6].acces === 'ouverts' && E.site.some((x) => x.action === 'commande' && x.id === 6), 'commande RELUE chez le site, résultat rapporté');
const nMails6 = E.resend.length;
r = await appelSite({ action: 'commande_payee', id: 6 });
dire(r.statut === 200 && r.d.resultat.acces.deja && E.resend.length === nMails6, 'second appel : déjà ouverts, aucun second mail');
r = await appelSite({ action: 'commande_payee', id: 7 });
dire(r.statut === 409 && !E.comptes.some((c) => c.email === 'pasencore@exemple.fr'), 'commande pas encore payée : 409, aucun compte');
r = await appelSite({ action: 'commande_payee', id: 'x' });
dire(r.statut === 400, 'id illisible : 400');

console.log('— garde');
const req = { method: 'POST', headers: { host: 'x' }, body: { action: 'offres', sous_action: 'virement_recu', id: 1 }, query: {} };
let s0 = 0; await handler(req, { setHeader() {}, status(s) { s0 = s; return this; }, json() { return this; } });
dire(s0 === 401, 'sans session coach : 401');
dire(1 !== 2, 'témoin');
console.log(ko ? '\n⛔ défauts' : '\nbanc vert'); process.exitCode = ko ? 1 : 0;
