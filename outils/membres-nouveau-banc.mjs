/**
 * BANC : un nouveau membre absent du tableur reste visible dans Académie · Membres (21/10).
 * Exécute `supabase-coach-membres.js` tel quel ; le double de la route rend une liste
 * réelle de cas. Usage : node outils/membres-nouveau-banc.mjs
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let ko = 0; const dire = (ok, m, v) => { console.log((ok ? 'ok  ' : '⛔  ') + m + (v !== undefined ? '  ' + JSON.stringify(v) : '')); if (!ok) ko++; };
const jours = (n) => new Date(Date.now() - n * 86400000).toISOString();
const base = { role: 'student', statut: 'active', formation: true, journal: true, lecons_vues: 0, quiz_reussis: [], signalements: [], tableur_lu: true, tableur: null, xp: 0 };
const M = [
  { ...base, user_id: 'u1', email: 'nouveau@x.fr', nom: 'Nouveau Acheteur', cree_le: jours(1) },
  { ...base, user_id: 'u2', email: 'vieux@x.fr', nom: 'Vieux Compte', cree_le: jours(300) },
  { ...base, user_id: 'u3', email: 'tableur@x.fr', nom: 'Dans Tableur', cree_le: jours(300), tableur: { row: 5, couleur: 'blanc', couleur_source: 'fond' } },
  { ...base, user_id: null, email: 'rembourse@x.fr', nom: '', cree_le: jours(2), sans_compte: true, signale_seulement: true, statut: 'signale' },
];
const zone = { innerHTML: '' }; const compteur = { innerHTML: '', textContent: '' };
const el = (id) => ({ coachMembresListe: zone, coachMembresCompte: compteur }[id] || null);
const sandbox = { window: {}, console, Date, Intl, JSON, Math, Number, String, Promise,
  fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, resultat: M }) }),
  document: { readyState: 'complete', getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: () => { const d = { _t: '' }; Object.defineProperty(d, 'textContent', { set(v) { d._t = v; } }); Object.defineProperty(d, 'innerHTML', { get() { return String(d._t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); } }); return d; } } };
sandbox.window.supabaseClient = { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } };
vm.createContext(sandbox);
vm.runInContext(readFileSync('supabase-coach-membres.js', 'utf8'), sandbox);
await sandbox.window.CoachMembres.charger(true);
const h = zone.innerHTML;
dire(h.includes('Nouveau Acheteur') && h.includes('Nouveau, pas encore dans le tableur'), 'nouvel acheteur (1 jour) : visible, marqué « Nouveau »');
dire(!h.includes('Vieux Compte'), 'vieux compte hors tableur (300 jours) : toujours masqué');
dire(h.includes('Dans Tableur'), 'membre du tableur : visible');
dire(!h.includes('rembourse@x.fr'), 'ligne signalée récente (remboursé) : pas traitée comme « nouveau »');
dire(/2 hors tableur masqués/.test(compteur.innerHTML), 'compteur : 2 masqués (vieux compte et ligne remboursée), le nouveau n y est pas', compteur.innerHTML.replace(/<[^>]+>/g, '').slice(0, 90));
dire(h.length > 100 && !/Vieux Compte/.test('x'), 'témoin');
console.log(ko ? '\n⛔ défauts' : '\nbanc vert'); process.exitCode = ko ? 1 : 0;
