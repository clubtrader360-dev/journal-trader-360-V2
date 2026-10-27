/**
 * BANC DE LA FICHE MEMBRE COMPLÈTE (27/10/2026) : api/_lib/fiche-complements.js, la vraie.
 * Statut Resend (borné, deux à la fois, erreurs dites) et questionnaire du tableur de Manu
 * (onglet trouvé par son nom, ligne de titres trouvée par « mail », casse ignorée).
 * Usage : node --import /tmp/stub/register.mjs outils/fiche-complete-banc.mjs
 */
import { statutsResend, questionnaireTableur } from '../api/_lib/fiche-complements.js';
let ko = 0; const dire = (ok, m, v) => { console.log((ok ? 'ok  ' : '⛔  ') + m + (v !== undefined ? '  ' + JSON.stringify(v).slice(0, 200) : '')); if (!ok) ko++; };

const mails = Array.from({ length: 30 }, (_, i) => ({ fournisseur: 'resend', fournisseur_id: `id${i}` })).concat([{ fournisseur: 'brevo', fournisseur_id: 'b1' }, { fournisseur: 'resend', fournisseur_id: null }]);
let enVol = 0, maxVol = 0, appels = 0;
const fauxFetch = async (url, o) => { appels++; enVol++; maxVol = Math.max(maxVol, enVol); await new Promise((r) => setTimeout(r, 2)); enVol--;
  if (o.headers.Authorization !== 'Bearer cle') return { ok: false, status: 401 };
  const id = url.split('/').pop(); if (id === 'id3') return { ok: false, status: 404 };
  return { ok: true, json: async () => ({ last_event: id === 'id0' ? 'opened' : 'delivered' }) }; };
const st = await statutsResend(mails, 'cle', fauxFetch);
dire(appels === 25 && st.size === 25, 'Resend : 25 mails relus au plus, Brevo et sans identifiant ignorés', { appels });
dire(maxVol <= 2, 'Resend : jamais plus de 2 requêtes à la fois', { maxVol });
dire(st.get('id0').evenement === 'opened' && st.get('id1').evenement === 'delivered' && st.get('id3').erreur === 'Resend 404', 'statuts lus, erreur dite (pas « délivré » par défaut)');
dire((await statutsResend(mails, '', fauxFetch)).size === 0, 'sans clé : rien demandé');

const onglets = ['👥 Parcours Membre', '📋 Questionnaire / suivi prospects'];
const valeurs = [['Suivi des prospects'], [], ['Horodatage', 'Prénom', 'Adresse e-mail', 'Ton niveau en trading'], ['01/09/2026', 'Mario', 'Mario@Exemple.fr', 'Débutant'], ['02/09/2026', 'Léa', 'lea@exemple.fr', 'Intermédiaire'], ['', '', '', '']];
let lu = null;
const fauxSheets = { spreadsheets: { get: async () => ({ data: { sheets: onglets.map((t) => ({ properties: { title: t } })) } }), values: { get: async ({ range }) => { lu = range; return { data: { values: valeurs } }; } } } };
const q = await questionnaireTableur(' MARIO@exemple.fr ', fauxSheets, 'x');
dire(lu === "'📋 Questionnaire / suivi prospects'" && q.onglet === '📋 Questionnaire / suivi prospects', 'onglet trouvé par son nom (contient « questionnaire »), pas par position', lu);
dire(q.reponses.length === 1 && q.reponses[0]['Ton niveau en trading'] === 'Débutant' && q.reponses[0]['Prénom'] === 'Mario', 'réponses de CETTE adresse, casse et espaces ignorés, titres repris', q.reponses[0]);
const q2 = await questionnaireTableur('inconnu@exemple.fr', fauxSheets, 'x');
dire(q2.lu && q2.reponses.length === 0, 'adresse absente : lu, aucune réponse (et pas une erreur)');
const sansOnglet = { spreadsheets: { get: async () => ({ data: { sheets: [{ properties: { title: '👥 Parcours Membre' } }] } }), values: { get: async () => { throw new Error('ne doit pas être lu'); } } } };
const q3 = await questionnaireTableur('a@b.fr', sansOnglet, 'x');
dire(q3.onglet === null && q3.reponses.length === 0, 'pas d onglet « questionnaire » : dit, rien d inventé');
console.log(ko ? `\n⛔ ${ko} défaut(s)` : '\nbanc vert'); process.exitCode = ko ? 1 : 0;
