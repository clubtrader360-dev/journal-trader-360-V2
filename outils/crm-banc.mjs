/**
 * BANC DU CRM (recopie de Brevo, lecture seule, 27/10/2026).
 * Éprouve la vraie fonction `crm` (api/_lib/crm.js) avec un double de Brevo qui rend
 * la forme RELEVÉE le 27/10 (GET /contacts, /contacts/lists, /contacts/{id}) :
 * `listUnsubscribed` peut valoir null, les statistiques portent des IP.
 * Chaque sonde porte son témoin. Usage : node outils/crm-banc.mjs
 */
import { crm } from '../api/_lib/crm.js';

const dire = (ok, msg, val) => { console.log(`  ${ok ? 'ok ' : '⛔ '} ${msg}${val !== undefined ? '  ' + JSON.stringify(val) : ''}`); if (!ok) process.exitCode = 1; };
const httpError = (s, m) => Object.assign(new Error(m), { statusCode: s });
const appels = [];
const contact = (i, extra = {}) => ({ id: i, email: `Personne${i}@Exemple.fr`, emailBlacklisted: false, createdAt: '2026-10-01T10:00:00+02:00', modifiedAt: '2026-10-02T10:00:00+02:00', listIds: [6], listUnsubscribed: null, attributes: { PRENOM: `P${i}`, NOM: `N${i}`, SMS: '33600000000' }, ...extra });
const TOUS = Array.from({ length: 1003 }, (_, k) => contact(k + 1));
TOUS[0] = contact(1, { email: 'membre@exemple.fr', listIds: [7, 6], listUnsubscribed: [18] });
TOUS[1] = contact(2, { email: 'Coach@Exemple.fr', emailBlacklisted: true });
let compteAnnonce = null;
const brevoOk = async (chemin, init = {}) => {
  appels.push({ chemin, methode: init.method || 'GET' });
  const u = new URL('https://api.brevo.com/v3' + chemin);
  if (u.pathname === '/v3/contacts/lists') return { lists: [{ id: 7, name: 'MEMBRES T360', folderId: 1, uniqueSubscribers: 121, totalSubscribers: 0 }, { id: 6, name: 'PROSPECTS', folderId: 1, uniqueSubscribers: 79 }], count: 2 };
  if (u.pathname === '/v3/contacts') { const o = Number(u.searchParams.get('offset')); const l = Number(u.searchParams.get('limit')); return { contacts: TOUS.slice(o, o + l), count: compteAnnonce ?? TOUS.length }; }
  const m = u.pathname.match(/^\/v3\/contacts\/(.+)$/);
  if (m) {
    const id = decodeURIComponent(m[1]);
    const c = TOUS.find((x) => String(x.id) === id || x.email.toLowerCase() === id);
    if (!c) throw httpError(400, 'Brevo, lecture du contact : Contact does not exist');
    return { ...c, statistics: { messagesSent: [{ campaignId: 1, eventTime: '2026-10-20T08:00:00Z' }, { campaignId: 2, eventTime: '2026-10-21T08:00:00Z' }], delivered: [{ campaignId: 1 }, { campaignId: 2 }],
      opened: [{ campaignId: 1, count: 3, eventTime: '2026-10-20T09:00:00Z', ip: '203.0.113.7' }, { campaignId: 1, count: 1, eventTime: '2026-10-22T09:00:00Z', ip: '203.0.113.7' }], clicked: [{ campaignId: 2, links: [{ count: 1, eventTime: '2026-10-21T09:00:00Z', ip: '203.0.113.7', url: 'https://x' }] }], hardBounces: [], softBounces: [], unsubscriptions: { userUnsubscription: [], adminUnsubscription: [] } } };
  }
  throw new Error('chemin inattendu ' + chemin);
};
const sb = { from: (t) => ({ select: async () => (t === 'users' ? { data: [{ email: 'Membre@Exemple.fr', role: 'student' }, { email: 'coach@exemple.fr', role: 'coach' }], error: null } : { data: null, error: { message: 'table' } }) }) };
const D = { brevoOk, httpError };

console.log('listes');
const ls = await crm(sb, { sous_action: 'listes' }, D);
dire(ls.length === 2 && ls[0].nom === 'MEMBRES T360' && ls[0].contacts === 121, 'listes : nom et nombre réel (uniqueSubscribers, pas totalSubscribers à 0)', ls[0]);

console.log('contacts');
const d = await crm(sb, { sous_action: 'contacts' }, D);
dire(d.contacts.length === 1003 && d.total === 1003 && !d.tronque, 'deux pages de 1000 lues en entier, rien de tronqué', { n: d.contacts.length });
dire(appels.filter((a) => a.chemin.startsWith('/contacts?')).length === 2, 'exactement deux appels de pages');
const m1 = d.contacts.find((c) => c.id === 1), c2 = d.contacts.find((c) => c.id === 2), p3 = d.contacts.find((c) => c.id === 3);
dire(m1.compte === 'membre' && c2.compte === 'coach' && p3.compte === null, 'compte reconnu sans tenir compte de la casse (membre, coach, aucun)', [m1.compte, c2.compte, p3.compte]);
dire(m1.desinscrit_listes[0] === 18 && Array.isArray(p3.desinscrit_listes) && p3.desinscrit_listes.length === 0, 'listUnsubscribed null rendu en liste vide');
dire(c2.bloque === true && p3.bloque === false, 'désinscription (emailBlacklisted) portée');
dire(m1.prenom === 'P1' && m1.telephone === '33600000000' && m1.email === 'membre@exemple.fr', 'prénom, téléphone, adresse en minuscules');
compteAnnonce = 25000;
const t = await crm(sb, { sous_action: 'contacts' }, D);
dire(t.tronque === true, 'Brevo annonce plus que ce qui est lu : signalé, pas tronqué en silence');
compteAnnonce = null;

console.log('fiche');
const f = await crm(sb, { sous_action: 'contact', id: '1' }, D);
dire(f.activite.envoyes === 2 && f.activite.ouverts === 1 && f.activite.cliques === 1 && f.activite.derniere_ouverture === '2026-10-22T09:00:00Z', 'activité : envois, campagnes ouvertes (dédoublonnées), cliquées, dernière ouverture', f.activite);
dire(!JSON.stringify(f).includes('203.0.113.7'), 'aucune IP d ouverture ne sort de la fiche');
dire(JSON.stringify(await brevoOk('/contacts/1')).includes('203.0.113.7'), 'témoin : le double, lui, porte bien les IP');
dire(f.compte === 'membre' && f.attributs.PRENOM === 'P1', 'fiche : compte et attributs');
const parMail = await crm(sb, { sous_action: 'contact', email: 'MEMBRE@exemple.fr' }, D);
dire(parMail.id === 1, 'fiche lue par adresse, casse ignorée');
for (const [nom, corps] of [['identifiant invalide', { sous_action: 'contact', id: '1 OR 1=1' }], ['sous-action inconnue', { sous_action: 'supprimer' }], ['écriture demandée', { sous_action: 'ajouter' }]]) {
  let refuse = false; try { await crm(sb, corps, D); } catch (e) { refuse = e.statusCode === 400; }
  dire(refuse, `${nom} : refusé (400)`);
}
dire(appels.every((a) => a.methode === 'GET'), 'lecture seule : aucun appel Brevo autre que GET', [...new Set(appels.map((a) => a.methode))]);
console.log(process.exitCode ? '\n⛔ des défauts' : '\nbanc vert');
