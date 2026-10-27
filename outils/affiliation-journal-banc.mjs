/**
 * BANC DE L'AFFILIATION, CÔTÉ JOURNAL (27/10/2026) : la route api/coach/membres.js
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
process.env.BACKOFFICE_CLE = 'cle-bo'; process.env.SITE_URL = 'https://site.test';
let ko = 0; const dire = (ok, m, v) => { console.log((ok ? 'ok  ' : '⛔  ') + m + (v !== undefined ? '  ' + JSON.stringify(v).slice(0, 220) : '')); if (!ok) ko++; };

const MARIO = { id: '33333333-3333-4333-8333-000000000001', email: 'mario@exemple.fr' };
const USERS = [{ uuid: MARIO.id, name: 'Mario Rossi', email: 'mario@exemple.fr', role: 'student' }, { uuid: '33333333-3333-4333-8333-000000000002', name: 'Léa', email: 'lea@exemple.fr', role: 'student' }, { uuid: '33333333-3333-4333-8333-000000000009', name: 'Nadir K', email: 'nadir@trader360.fr', role: 'coach' }];
const requete = (table) => { const f = []; const q = { select() { return q; }, eq(c, v) { f.push([c, v]); return q; },
  maybeSingle: async () => ({ data: USERS.filter((u) => f.every(([c, v]) => u[c] === v))[0] || null, error: null }),
  then: (ok) => ok({ data: (table === 'users' ? USERS : []).filter((u) => f.every(([c, v]) => u[c] === v)), error: null }) }; return q; };
globalThis.__sb = { auth: { getUser: async (j) => (j === 'jeton-mario' ? { data: { user: MARIO }, error: null } : { data: null, error: { message: 'invalide' } }) }, from: requete };
const site = [];
globalThis.fetch = async (url, o = {}) => {
  if (!String(url).startsWith('https://site.test/api/affiliation')) return { ok: false, status: 404, json: async () => ({}) };
  if (o.headers['x-backoffice-cle'] !== 'cle-bo') return { ok: false, status: 401, json: async () => ({ ok: false, motif: 'non autorisé' }) };
  const b = JSON.parse(o.body); site.push(b);
  return { ok: true, status: 200, json: async () => ({ ok: true, resultat: b.action === 'membres' ? { crees: b.membres.length, total: b.membres.length } : b.action === 'membre' ? { code: 'mario-k7p2', lien: 'https://site.test/candidater/?ref=mario-k7p2', actif: true, clics: 0, candidatures: 0 } : { affilies: [] } }) };
};
const { default: handler } = await import('../api/coach/membres.js');
const appel = async (corps, jeton) => { let statut = 0, d = null; const res = { setHeader() {}, status(s) { statut = s; return res; }, json(x) { d = x; return res; } };
  await handler({ method: 'POST', headers: jeton ? { authorization: `Bearer ${jeton}` } : {}, body: corps }, res); return { statut, d }; };

console.log('— le membre et son lien');
let x = await appel({ action: 'mon_affiliation', user_id: '33333333-3333-4333-8333-000000000002', email: 'lea@exemple.fr' }, 'jeton-mario');
const envoye = site.at(-1);
dire(x.statut === 200 && x.d.resultat.code === 'mario-k7p2', 'mon_affiliation : le lien revient au membre', x.d);
dire(envoye.action === 'membre' && envoye.user_id === MARIO.id && envoye.email === 'mario@exemple.fr' && envoye.prenom === 'Mario' && envoye.nom === 'Rossi', 'identité tirée du JETON, pas du corps (l identifiant de Léa envoyé est ignoré)', envoye);
dire(USERS[1].uuid !== envoye.user_id, 'témoin : l identifiant usurpé était bien différent');
const n = site.length;
x = await appel({ action: 'mon_affiliation' }, 'faux');
dire(x.statut === 401 && site.length === n, 'jeton invalide : 401, le site n est pas appelé');
x = await appel({ action: 'mon_affiliation' });
dire(x.statut === 401, 'sans jeton : 401');

console.log('— le coach');
x = await appel({ action: 'affiliation', sous_action: 'lister' }, 'jeton-mario');
dire(x.statut === 403, 'un élève ne peut pas lister les affiliés');
x = await appel({ action: 'affiliation', sous_action: 'generer_membres' }, 'coach');
const lot = site.at(-1);
dire(x.statut === 200 && lot.action === 'membres' && lot.membres.length === 2 && lot.membres.every((m) => m.email !== 'nadir@trader360.fr'), 'génération en lot : les élèves seuls, pas le coach', lot.membres.map((m) => m.email));
dire(lot.membres.find((m) => m.email === 'lea@exemple.fr').prenom === 'Léa' && lot.membres.find((m) => m.email === 'lea@exemple.fr').nom === '', 'prénom et nom découpés (nom vide si un seul mot)');
x = await appel({ action: 'affiliation', sous_action: 'creer', nom: 'Jean' }, 'coach');
dire(x.statut === 200 && site.at(-1).action === 'creer' && site.at(-1).nom === 'Jean' && site.at(-1).par === 'nadir@trader360.fr' && !('sous_action' in site.at(-1)), 'créer : relayé au site avec l auteur, sans la sous-action', site.at(-1));
x = await appel({ action: 'affiliation', sous_action: 'membres' }, 'coach');
dire(x.statut === 400, 'sous-action hors liste (membres en direct) : refusée');
console.log(ko ? `\n⛔ ${ko} défaut(s)` : '\nbanc vert'); process.exitCode = ko ? 1 : 0;
