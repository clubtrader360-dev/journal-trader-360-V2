/**
 * BANC : l'écran Ventes · Offres (assets/back-office-offres.js), exécuté tel quel dans un
 * bac à sable. Le double de `fetch` imite la route coach : il rend `{ok, resultat}` par
 * sous-action, et REFUSE une sous-action inconnue (comme le pont).
 * Parcourt : liste (formation en ligne, présentiel en brouillon), éditeur neuf, éditeur
 * existant, et chaque état de commande. Usage : node outils/back-office-offres-banc.mjs
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let ko = 0; const dire = (ok, m, v) => { console.log((ok ? 'ok  ' : '⛔  ') + m + (v !== undefined ? '  ' + JSON.stringify(v).slice(0, 160) : '')); if (!ok) ko++; };

const ref = { modes: [{ cle: 'virement', nom: 'Virement en 1 fois', echeances: 1, aide: 'a' }, { cle: 'cb1', nom: 'Carte bancaire en 1 fois', echeances: 1, aide: 'b' }, { cle: 'cb3', nom: 'Carte bancaire en 3 fois', echeances: 3, aide: 'c' }, { cle: 'cb6', nom: 'Carte bancaire en 6 fois', echeances: 6, aide: 'd' }], formations: [{ cle: 'trader360', nom: 'Trader 360' }], site: 'https://www.trader360.fr' };
const offre = { id: 1, slug: 'formation', nom: 'Formation Trader 360', type: 'formation', formation_cle: 'trader360', tunnel_id: null, inclus: ['A', 'B'], modes: { virement: { actif: true, total: 2980 }, cb1: { actif: false, total: 2980 }, cb3: { actif: true, total: 3180 }, cb6: { actif: true, total: 3180 } }, statut: 'en_ligne', jeton_apercu: '11111111-1111-1111-1111-111111111111', lien: 'https://www.trader360.fr/commande/formation', commandes: 1, problemes: [] };
const pres = { ...offre, id: 2, slug: 'presentiel-x', nom: 'Présentiel X', type: 'presentiel', formation_cle: null, tunnel_id: 5, statut: 'brouillon', modes: { cb1: { actif: true, total: 70 } }, commandes: 0 };
const D = { offres: [offre, pres], codes: [{ id: 1, code: 'REC360', type: 'montant', valeur: 500, offre_id: 1, modes: null, fin: null, actif: true, max_utilisations: 10, utilisations: 3 }, { id: 3, code: 'PLEIN', type: 'montant', valeur: 100, offre_id: 1, modes: null, fin: null, actif: true, max_utilisations: 2, utilisations: 2 }, { id: 2, code: 'VIEUX', type: 'pourcent', valeur: 10, offre_id: null, modes: ['virement'], fin: '2020-01-01', actif: true }], tunnels: [{ id: 5, slug: 'p', titre: 'Présentiel X', type: 'presentiel', statut: 'brouillon' }] };
const statuts = ['attente_virement', 'attente_paiement', 'en_cours', 'payee', 'annulee'];
const cmds = statuts.map((s, i) => ({ id: i + 1, reference: `T360-2026-000${i + 1}`, created_at: '2026-10-21T18:00:00Z', prenom: 'A', nom: 'B', email: 'a@b.fr', offre_nom: 'Formation Trader 360', mode: i % 2 ? 'cb3' : 'virement', code: i ? null : 'REC360', total: 2480, echeances: i % 2 ? 3 : 1, paiements_recus: 1, statut: s }));
const R = { reference: ref, lister: D, commandes: cmds, envois: [
  { id: 1, email: 'valable@y.fr', offre_id: 1, code: 'REC360', created_at: '2026-10-21T18:00:00Z', expire_le: '2099-01-01T00:00:00Z', erreur: null },
  { id: 2, email: 'utilise@y.fr', offre_id: 1, code: null, created_at: '2026-10-21T18:00:00Z', expire_le: '2099-01-01T00:00:00Z', utilise_le: '2026-10-21T19:00:00Z' },
  { id: 3, email: 'expire@y.fr', offre_id: 1, code: null, created_at: '2026-10-01T18:00:00Z', expire_le: '2026-10-08T00:00:00Z' },
  { id: 4, email: 'revoque@y.fr', offre_id: 1, code: null, created_at: '2026-10-21T18:00:00Z', expire_le: '2099-01-01T00:00:00Z', revoque_le: '2026-10-21T18:30:00Z' },
  { id: 5, email: 'echec@y.fr', offre_id: 1, code: null, created_at: '2026-10-21T18:00:00Z', expire_le: '2099-01-01T00:00:00Z', erreur: 'Brevo 400', revoque_le: '2026-10-21T18:00:01Z' },
] };
const appels = [];
const fetch = async (u, o) => { const b = JSON.parse(o.body); appels.push(b.sous_action); if (!(b.sous_action in R)) return { ok: false, status: 400, json: async () => ({ ok: false, motif: 'sous_action inconnue' }) }; return { ok: true, status: 200, json: async () => ({ ok: true, resultat: R[b.sous_action] }) }; };
const el = () => ({ innerHTML: '', style: { setProperty() {}, removeProperty() {} }, value: '', dataset: {} });
const zone = el();
const sandbox = { window: {}, console, Intl, Date, Number, String, JSON, Math, Promise, fetch,
  document: { getElementById: (id) => (id === 'boOffresCommande' ? zone : null), querySelector: () => null, querySelectorAll: () => [], addEventListener() {}, createElement: () => { const d = { _t: '' }; Object.defineProperty(d, 'textContent', { set(v) { d._t = v; } }); Object.defineProperty(d, 'innerHTML', { get() { return String(d._t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); } }); return d; } } };
sandbox.window.supabaseClient = { auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) } };
sandbox.window.showNotification = () => {};
vm.createContext(sandbox);
vm.runInContext(readFileSync('assets/back-office-offres.js', 'utf8'), sandbox);
const OC = sandbox.window.OffresCommande;
dire(!!OC && typeof OC.bloc === 'function', 'module chargé, API exposée');
const propre = (h) => !/undefined|NaN|\[object Object\]|null/.test(h.replace(/data-[a-z-]+="[^"]*"/g, ''));

let h = await OC.bloc();
dire(propre(h), 'liste : ni undefined, ni NaN, ni null, ni objet brut');
dire(h.includes('Formation Trader 360') && h.includes('Présentiel X'), 'les deux offres listées');
dire(/3 × 1 060 €/.test(h) && /6 × 530 €/.test(h) && /2 980 €/.test(h), 'prix par mode : 2 980, 3 × 1 060, 6 × 530');
dire(h.includes('Formation Trader 360') && h.includes('Tunnel « Présentiel X »'), 'rattachements : formation et tunnel');
dire(h.includes('REC360 · moins 500'), 'code REC360 affiché sur la formation');
dire(!h.includes('VIEUX ·'), 'code expiré : absent des codes applicables');
dire(h.includes('?apercu=11111111'), 'brouillon : lien d aperçu avec jeton');
for (const s of statuts) dire(h.includes(s === 'payee' ? 'Payée' : s === 'annulee' ? 'Annulée' : s === 'attente_virement' ? 'Virement attendu' : s === 'en_cours' ? 'Échéances en cours' : 'Paiement attendu'), `commande « ${s} » affichée`);
dire((h.match(/data-of-recu=/g) || []).length === 1, 'bouton « Virement reçu » seulement sur la commande en attente de virement');
dire(h.includes('1 virement attendu'), 'compteur des virements attendus');
dire(h.includes('Envoyer le mail') && h.includes('data-of-env-email') && h.includes('data-of-env-jours'), 'envoi du lien : e-mail, durée de validité, bouton');
dire(h.includes('3 / 10 places') && h.includes('2 / 2 places') && h.includes('Complet'), 'places des codes : 3 / 10, et 2 / 2 marqué complet');
dire(!h.includes('PLEIN · moins'), 'code complet : retiré des codes applicables de l offre');
for (const [mail, attendu] of [['valable@y.fr', 'Valable jusqu au'], ['utilise@y.fr', 'Utilisé : commande passée'], ['expire@y.fr', 'Expiré'], ['revoque@y.fr', 'Désactivé'], ['echec@y.fr', 'Mail non parti']]) {
  const ligne = h.split('<tr>').find((x) => x.includes(mail)) || '';
  dire(ligne.includes(attendu), `lien envoyé à ${mail} : « ${attendu} »`);
}
dire((h.match(/data-of-revoquer=/g) || []).length === 1, 'bouton « Désactiver » seulement sur le lien encore valable');
dire(h.includes('sur invitation · /commande/formation'), 'liste : accès « sur invitation » affiché');
dire(appels.every((a) => ['reference', 'lister', 'commandes', 'envois'].includes(a)), 'seules les lectures prévues ont été appelées', appels);

sandbox.window.OffresCommande; // l'éditeur neuf
await OC.rafraichir.call(null);
const vmEtat = vm.runInContext('typeof window', sandbox);
dire(vmEtat === 'object', 'bac à sable intact');
// Éditeur : on passe par le clic simulé n'est pas possible sans DOM ; on appelle l'état interne via bloc après édition.
OC.editer({ type: 'formation', formation_cle: 'trader360', inclus: [], modes: {} });
h = await OC.bloc();
dire(propre(h) && h.includes('Nouvelle offre') && !h.includes('Mettre en ligne') && !h.includes('data-of-supprimer'), 'éditeur neuf : propre, ni mise en ligne ni suppression avant enregistrement');
dire((h.match(/data-of-mode-total=/g) || []).length === 4, 'éditeur : les 4 modes de paiement proposés');
OC.editer(pres);
h = await OC.bloc();
dire(propre(h) && h.includes('Mettre en ligne') && h.includes('data-of-supprimer') && h.includes('?apercu='), 'éditeur présentiel en brouillon : mise en ligne, suppression, aperçu');
dire(/<option value="5" selected>/.test(h), 'éditeur : tunnel lié présélectionné');
OC.editer(offre);
h = await OC.bloc();
dire(h.includes('Mettre hors ligne') && !h.includes('data-of-supprimer') && h.includes('REC360'), 'éditeur offre en ligne : hors ligne possible, suppression interdite, code affiché');
OC.editer(null);
R.lister = { ...D, offres: [] };
h = await OC.bloc();
dire(h.includes('Aucune offre') && h.includes('Aucune offre en ligne'), 'aucune offre : messages vides explicites, pas de tableau cassé');
dire(propre(h), 'aucune offre : sortie propre');
dire(/undefined/.test('x undefined') && !propre('a undefined b'), 'témoin des sondes');
console.log(ko ? '\n⛔ défauts' : '\nbanc vert'); process.exitCode = ko ? 1 : 0;
