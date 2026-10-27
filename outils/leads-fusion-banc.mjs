/**
 * BANC DE LA FUSION DES LEADS (27/10/2026) : api/_lib/leads-fusion.js, la vraie.
 * Retour de Nadir : l'onglet Leads ne montrait que des tests. Le banc prouve qu'un
 * prospect Brevo sans questionnaire devient un lead, qu'un membre n'en est pas un sauf
 * suivi en cours, que l'équipe et les tests sont marqués internes (alias compris).
 * Usage : node outils/leads-fusion-banc.mjs
 */
import { fusionnerLeads, sourceDe, estInterne } from '../api/_lib/leads-fusion.js';
let ko = 0; const dire = (ok, m, v) => { console.log((ok ? 'ok  ' : '⛔  ') + m + (v !== undefined ? '  ' + JSON.stringify(v).slice(0, 200) : '')); if (!ok) ko++; };
const listes = [{ id: 6, nom: 'PROSPECTS' }, { id: 7, nom: 'MEMBRES T360' }, { id: 17, nom: 'BRIEF QUOTIDIEN T360 (auto)' }];
const site = [
  { email: 'enzo@exemple.fr', prenom: 'Enzo', nom: 'Lion', candidatures: 1, premiere_candidature: '2026-10-15T00:00:00Z', statut: 'nouvelle', interactions: 0, client: false, recommande_par: 'Instagram' },
  { email: 'clubtrader360+testceo@gmail.com', prenom: 'TEST CEO', nom: 'NE PAS TRAITER', candidatures: 1, statut: 'nouvelle', interactions: 0 },
  { email: 'membre.suivi@exemple.fr', candidatures: 0, statut: 'qualifiee', interactions: 2, client: false },
];
const brevo = [
  { id: 1, email: 'Prospect@Exemple.fr', prenom: 'Paul', listes: [6, 17], cree_le: '2026-09-01T00:00:00Z', compte: null },
  { id: 2, email: 'enzo@exemple.fr', prenom: 'Enzo', listes: [6], cree_le: '2026-10-01T00:00:00Z', compte: null },
  { id: 3, email: 'membre@exemple.fr', prenom: 'Mia', listes: [7], compte: 'membre' },
  { id: 4, email: 'membre.suivi@exemple.fr', prenom: 'Max', listes: [7], compte: 'membre' },
  { id: 5, email: 'manugaliano@gmail.com', listes: [6], compte: 'coach' },
  { id: 6, email: 'nkasmi59@gmail.com', listes: [6], compte: null },
];
const prospects = [{ email: 'brief.seul@exemple.fr', prenom: 'Bri', created_at: '2026-10-05T00:00:00Z', page_origine: '/brief/' }];
const L = fusionnerLeads({ site, prospects, brevo, listes, coachs: ['clubtrader360@gmail.com', 'manugaliano@gmail.com'] });
const de = (e) => L.find((l) => l.email === e);
dire(!!de('prospect@exemple.fr') && de('prospect@exemple.fr').listes.join() === 'PROSPECTS,BRIEF QUOTIDIEN T360 (auto)', 'prospect Brevo sans questionnaire : un lead, avec ses listes nommées');
dire(!!de('brief.seul@exemple.fr') && sourceDe(de('brief.seul@exemple.fr')) === '/brief/', 'inscrit au brief absent de Brevo : un lead');
const enzo = de('enzo@exemple.fr');
dire(L.filter((l) => l.email === 'enzo@exemple.fr').length === 1 && enzo.candidatures === 1 && enzo.entre_le === '2026-10-01T00:00:00Z' && sourceDe(enzo) === 'Instagram', 'site + Brevo fusionnés : un seul lead, date d entrée la plus ancienne, source du questionnaire', enzo);
dire(!de('membre@exemple.fr'), 'membre sans suivi : pas un lead');
dire(!!de('membre.suivi@exemple.fr') && de('membre.suivi@exemple.fr').statut === 'qualifiee', 'membre avec un suivi en cours : gardé, rien ne disparaît');
dire(!de('manugaliano@gmail.com'), 'coach : jamais un lead');
dire(de('clubtrader360+testceo@gmail.com').interne === true && de('nkasmi59@gmail.com').interne === true && de('prospect@exemple.fr').interne === false, 'équipe, alias et tests marqués internes ; un vrai prospect non');
dire(estInterne('Quelquun@exemple.fr', 'Jean Testard') === false && estInterne('a@b.fr', 'TEST') === true, 'témoins : « Testard » n est pas un test, « TEST » l est');
dire(sourceDe({ listes: [] }) === 'Direct' && sourceDe({ affilies: { nom: 'Jean' }, utm_source: 'x' }) === 'Lien de Jean', 'source : affilié d abord, « Direct » faute de mieux');
console.log(ko ? `\n⛔ ${ko} défaut(s)` : '\nbanc vert'); process.exitCode = ko ? 1 : 0;
