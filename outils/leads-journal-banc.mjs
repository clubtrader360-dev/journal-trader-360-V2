/**
 * BANC DU CRM DES LEADS, CÔTÉ JOURNAL (27/10/2026) : la route api/coach/membres.js
 * exécutée telle quelle, avec trois doubles :
 *  - Supabase (getServiceClient) : `auth.getUser(jeton)` rend l'utilisateur DU JETON,
 *    et la table `users` porte des élèves ET un coach ;
 *  - requireCoach : accepte le jeton « coach », refuse les autres (comme le vrai) ;
 *  - le site (/api/affiliation) : enregistre chaque appel et exige la clé.
 * Éprouve : un membre n'obtient QUE son lien, même s'il envoie l'identifiant d'un
 * autre ; la génération en lot ne prend que les élèves ; un élève ne peut pas lister.
 * Usage : node outils/affiliation-journal-banc.mjs
 */
import { register } from 'node:module';
const stubs = {
  'tradovate/_lib/auth.js': `export const getServiceClient = () => globalThis.__sb;`,
  'vimeo/_lib/coach-auth.js': `export const httpError = (s, m) => Object.assign(new Error(m), { statusCode: s });
    export async function requireCoach(req) { if ((req.headers.authorization || '') !== 'Bearer coach') throw httpError(403, 'coach requis'); return { email: 'nadir@trader360.fr' }; }`,
  '_lib/sheets-client.js': `export const getSheetsClient = () => null;`,
};
const hook = `const S = ${JSON.stringify(stubs)};
export async function resolve(spec, ctx, next) {
  for (const [fin, code] of Object.entries(S)) if (spec.endsWith(fin) && (ctx.parentURL || '').includes('/api/coach/membres.js')) return { url: 'data:text/javascript,' + encodeURIComponent(code), shortCircuit: true };
  if (spec === '@resvg/resvg-js') return { url: 'data:text/javascript,export default {}', shortCircuit: true };
  return next(spec, ctx);
}`;
register('data:text/javascript,' + encodeURIComponent(hook));
process.env.BACKOFFICE_CLE = 'cle-bo'; process.env.SITE_URL = 'https://site.test'; process.env.BREVO_API_KEY = 'brevo-test';
let ko = 0; const dire = (ok, m, v) => { console.log((ok ? 'ok  ' : '⛔  ') + m + (v !== undefined ? '  ' + JSON.stringify(v).slice(0, 220) : '')); if (!ok) ko++; };
const USERS = [{ uuid: 'u1', name: 'Léo Martin', email: 'leo@exemple.fr', role: 'student' }];
const requete = (table) => { const q = { select() { return q; }, eq() { return q; }, in() { return q; }, maybeSingle: async () => ({ data: null, error: null }), then: (ok) => ok({ data: table === 'users' ? USERS : [], error: null }) }; return q; };
globalThis.__sb = { auth: { getUser: async () => ({ data: null, error: { message: 'x' } }) }, from: requete };
const site = []; let brevoAppels = [];
globalThis.fetch = async (url, o = {}) => {
  const u = String(url);
  if (u.startsWith('https://api.brevo.com/v3/contacts/lists')) { brevoAppels.push({ u, m: o.method || 'GET' }); return { status: 200, text: async () => JSON.stringify({ lists: [{ id: 6, name: 'PROSPECTS', uniqueSubscribers: 1 }] }) }; }
  if (u.startsWith('https://api.brevo.com/v3/contacts?')) { brevoAppels.push({ u, m: o.method || 'GET' }); return { status: 200, text: async () => JSON.stringify({ count: 2, contacts: [{ id: 9, email: 'Prospect@exemple.fr', listIds: [6], attributes: { PRENOM: 'Paul' } }, { id: 10, email: 'leo@exemple.fr', listIds: [6], attributes: {} }] }) }; }
  if (u.startsWith('https://api.brevo.com/v3/contacts/')) {
    brevoAppels.push({ u, m: o.method || 'GET' });
    if (u.includes('inconnu')) return { status: 404, text: async () => JSON.stringify({ code: 'document_not_found', message: 'Contact does not exist' }) };
    return { status: 200, text: async () => JSON.stringify({ id: 5, email: 'leo@exemple.fr', listIds: [6], attributes: { PRENOM: 'Léo' }, statistics: { messagesSent: [{ campaignId: 1, eventTime: '2026-10-20T08:00:00Z' }], opened: [{ campaignId: 1, eventTime: '2026-10-20T09:00:00Z', ip: '203.0.113.9' }] } }) };
  }
  if (!u.startsWith('https://site.test/api/crm')) return { ok: false, status: 404, json: async () => ({}) };
  if (o.headers['x-backoffice-cle'] !== 'cle-bo') return { ok: false, status: 401, json: async () => ({ ok: false }) };
  const b = JSON.parse(o.body); site.push(b);
  const lead = (email) => ({ email, statut: 'nouvelle', candidatures: [], reponses: [], interactions: [], commandes: [], rdv: { relie: false, liste: [] }, statuts: [], types: [] });
  const leads = { statuts: [{ cle: 'nouvelle' }], types: [], calendly: false, leads: [{ email: 'leo@exemple.fr', prenom: 'Léo', candidatures: 1, statut: 'nouvelle', interactions: 0 }], prospects: [] };
  return { ok: true, status: 200, json: async () => ({ ok: true, resultat: b.action === 'lead' ? lead(b.email) : b.action === 'leads' ? leads : { ok: 1 } }) };
};
const { default: handler } = await import('../api/coach/membres.js');
const appel = async (corps, jeton) => { let statut = 0, d = null; const res = { setHeader() {}, status(s) { statut = s; return res; }, json(x) { d = x; return res; } };
  await handler({ method: 'POST', headers: jeton ? { authorization: `Bearer ${jeton}` } : {}, body: corps }, res); return { statut, d }; };

let x = await appel({ action: 'leads', sous_action: 'leads' }, 'eleve');
dire(x.statut === 403 && site.length === 0, 'un élève ne peut pas lire les leads');
x = await appel({ action: 'leads', sous_action: 'leads' }, 'coach');
const ll = x.d.resultat && x.d.resultat.leads;
dire(x.statut === 200 && ll.length === 2 && ll.some((l) => l.email === 'prospect@exemple.fr' && l.listes[0] === 'PROSPECTS') && ll.filter((l) => l.email === 'leo@exemple.fr').length === 1, 'liste : site et Brevo fusionnés par adresse, prospect Brevo inclus', ll && ll.map((l) => l.email));
x = await appel({ action: 'leads', sous_action: 'noter', email: 'leo@exemple.fr', type: 'appel', contenu: 'ok', par: 'usurpateur@x.fr' }, 'coach');
dire(x.statut === 200 && site.at(-1).action === 'noter' && site.at(-1).par === 'nadir@trader360.fr' && !('sous_action' in site.at(-1)), 'note relayée, signée par le coach de la session, pas par le corps', site.at(-1));
x = await appel({ action: 'leads', sous_action: 'lead', email: 'leo@exemple.fr' }, 'coach');
dire(x.statut === 200 && x.d.resultat.brevo && x.d.resultat.brevo.activite.envoyes === 1 && x.d.resultat.brevo.compte === 'membre', 'fiche : activité Brevo et compte du journal ajoutés', x.d.resultat.brevo.activite);
dire(!JSON.stringify(x.d.resultat).includes('203.0.113.9'), 'aucune IP d ouverture dans la fiche');
dire(brevoAppels.every((a) => a.m === 'GET'), 'Brevo en lecture seule');
x = await appel({ action: 'leads', sous_action: 'lead', email: 'inconnu@exemple.fr' }, 'coach');
dire(x.statut === 200 && x.d.resultat.brevo === null && x.d.resultat.brevo_motif === 'absent de Brevo', 'lead absent de Brevo : la fiche s affiche quand même, et le dit', { m: x.d.resultat.brevo_motif });
x = await appel({ action: 'leads', sous_action: 'supprimer', email: 'leo@exemple.fr' }, 'coach');
dire(x.statut === 400, 'sous-action hors liste : refusée');
console.log(ko ? `\n⛔ ${ko} défaut(s)` : '\nbanc vert'); process.exitCode = ko ? 1 : 0;
