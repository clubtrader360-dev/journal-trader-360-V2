/**
 * BANC : Marketing · Webinaires live et le suivi des inscrits (assets/back-office.js),
 * et le mode `rappels_webinaires` du déclencheur (api/cron/daily-brief.js), 25/10/2026.
 *
 * Le back-office est exécuté TEL QUEL dans un bac à sable (vm), routeur compris.
 * ⛔ Le double du pont refuse toute sous-action absente de SOUS_ACTIONS_TUNNELS, relue
 * dans api/coach/membres.js : un bouton qui appellerait une action non ouverte serait
 * refusé ici comme il le serait en production (témoin en fin de section 2).
 *
 * Parcourt chaque cas présent dans les données : webinaire à venir sans lien, à venir
 * avec lien, passé avec replay à envoyer, passé déjà envoyé à tous, réponse d'un site
 * pas encore à jour (sans retombées), et un tunnel qui n'est pas un webinaire.
 * Usage : node outils/webinaires-bo-banc.mjs
 */
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
let ko = 0; const dire = (ok, m, v) => { console.log((ok ? 'ok  ' : '⛔  ') + m + (v !== undefined ? '  ' + JSON.stringify(v).slice(0, 200) : '')); if (!ok) ko++; };

// ── Le pont, avec les sous-actions réellement ouvertes ────────────────────────
const src = readFileSync('api/coach/membres.js', 'utf8');
const OUVERTES = JSON.parse(src.match(/const SOUS_ACTIONS_TUNNELS = (\[[^\]]+\])/)[1].replace(/'/g, '"'));
dire(OUVERTES.includes('lister') && OUVERTES.length >= 10, 'sous-actions du pont relues dans membres.js', OUVERTES.length);

const h = (n) => new Date(Date.now() + n * 3600e3).toISOString();
const dateSaisie = (iso) => iso.slice(0, 16);
const T = [
  { id: 1, slug: 'web-sans-lien', type: 'webinaire', statut: 'publie', jeton_apercu: '11111111-1111-4111-8111-111111111111', titre: 'À venir sans lien', inscrits: 4, date: dateSaisie(h(30)), debut: h(30), lien_direct_pose: false, lien_replay_pose: false, retombees: { inscrits: 4, presents: 0, replays_vus: 0, replays_envoyes: 0, candidatures: 0 } },
  { id: 2, slug: 'web-avec-lien', type: 'webinaire', statut: 'publie', titre: 'À venir avec lien', inscrits: 2, date: dateSaisie(h(2)), debut: h(2), lien_direct_pose: true, lien_replay_pose: false, retombees: { inscrits: 2, presents: 0, replays_vus: 0, replays_envoyes: 0, candidatures: 0 } },
  { id: 3, slug: 'web-passe', type: 'webinaire', statut: 'publie', titre: 'Passé à envoyer', inscrits: 3, date: dateSaisie(h(-30)), debut: h(-30), lien_direct_pose: true, lien_replay_pose: true, retombees: { inscrits: 3, presents: 2, replays_vus: 1, replays_envoyes: 1, candidatures: 3, candidatures_live: 2 } },
  { id: 4, slug: 'web-fini', type: 'webinaire', statut: 'archive', titre: 'Passé envoyé', inscrits: 2, date: dateSaisie(h(-300)), debut: h(-300), lien_direct_pose: true, lien_replay_pose: true, retombees: { inscrits: 2, presents: 1, replays_vus: 2, replays_envoyes: 2, candidatures: 0 } },
  { id: 5, slug: 'web-vieux-site', type: 'webinaire', statut: 'brouillon', titre: 'Réponse sans retombées', inscrits: 0 },
  { id: 6, slug: 'guide', type: 'lead', statut: 'publie', titre: 'Le guide offert', inscrits: 9 },
];
const MODELES = [{ type: 'webinaire', nom: 'Inscription à un webinaire', resume: 'r', formulaire: true, champs: [
  { cle: 'date', libelle: 'Date et heure (Paris)', genre: 'date', obligatoire: true },
  { cle: 'lien_direct', libelle: 'Lien du direct YouTube', genre: 'url', aide: 'Jamais affiché sur la page.' },
  { cle: 'lien_replay', libelle: 'Lien du replay', genre: 'url' }], exemple: { slug: 'web-sans-lien', titre: 'Exemple', contenu: { date: '2026-11-05T19:00' } } }];
const INSCRITS = [
  { prenom: 'Alice', email: 'a@x.fr', created_at: h(-50), rappel_veille_le: h(-31), rappel_heure_le: h(-31), present_le: h(-30), replay_envoye_le: h(-2), replay_vu_le: h(-1), a_candidate: true, mail_confirmation_envoye: true },
  { prenom: 'Bruno', email: 'b@x.fr', created_at: h(-50), rappel_veille_le: h(-54), rappel_heure_le: null, rappel_erreur: 'Brevo 400 adresse refusée', present_le: null, replay_envoye_le: null, a_candidate: false, mail_confirmation_envoye: true },
  { prenom: 'Chloé', email: 'c@x.fr', created_at: h(-40), rappel_heure_le: h(-31), present_le: h(-30), a_candidate: false, mail_confirmation_envoye: true },
];
const appels = [];
let replayRendu = { envoyes: 2, presents: 1, absents: 1, erreurs: [] };
const fetch = async (u, o) => {
  const b = JSON.parse(o.body); appels.push(`${b.action}:${b.sous_action || ''}`);
  const rep = (resultat) => ({ ok: true, status: 200, json: async () => ({ ok: true, resultat }) });
  if (b.action !== 'tunnels') return rep({});
  if (!OUVERTES.includes(b.sous_action)) return { ok: false, status: 400, json: async () => ({ ok: false, motif: 'sous_action inconnue' }) };
  if (b.sous_action === 'lister') return rep(T);
  if (b.sous_action === 'modeles') return rep(MODELES);
  if (b.sous_action === 'listes_brevo') return rep([]);
  if (b.sous_action === 'lire') return rep({ ...T.find((x) => x.id === b.id), contenu: { date: T.find((x) => x.id === b.id).date, lien_direct: 'https://youtube.com/live/abc', lien_replay: 'https://vimeo.com/1130000000/a1b2c3' }, manquants: [], jeton_apercu: '22222222-2222-4222-8222-222222222222' });
  if (b.sous_action === 'inscrits') return rep(INSCRITS);
  if (b.sous_action === 'envoyer_replay') return rep(replayRendu);
  if (b.sous_action === 'enregistrer') return rep({ ...b, manquants: [] });
  return rep(null);
};

// ── Le bac à sable du navigateur ──────────────────────────────────────────────
const elements = new Map();
const el = (id) => { if (!elements.has(id)) elements.set(id, { id, innerHTML: '', textContent: '', hidden: false, dataset: {}, style: { setProperty() {} }, classList: { add() {}, remove() {}, toggle() {}, contains: () => false }, addEventListener() {}, querySelector: () => el(`${id}>enfant`) }); return elements.get(id); };
const clics = []; const surHash = [];
const location = { hash: '#/marketing/webinaires', replace(u) { throw new Error(`redirigé vers ${u}`); } };
const copies = [];
const sandbox = {
  navigator: { clipboard: { writeText: async (x) => { copies.push(x); } } },
  console, Intl, Date, Number, String, JSON, Math, Promise, Map, Set, Array, Object, RegExp, URLSearchParams, setTimeout, clearTimeout, fetch, location,
  localStorage: { getItem: () => null, setItem() {} },
  document: { getElementById: el, querySelector: () => null, querySelectorAll: () => [], addEventListener: (t, f) => { if (t === 'click') clics.push(f); }, body: { classList: { contains: () => true } },
    createElement: () => { const d = { _t: '' }; Object.defineProperty(d, 'textContent', { set(v) { d._t = v; } }); Object.defineProperty(d, 'innerHTML', { get() { return String(d._t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); } }); return d; } },
};
sandbox.window = { addEventListener: (t, f) => { if (t === 'hashchange') surHash.push(f); }, confirm: () => true, scrollTo() {},
  supabaseClient: { auth: { getSession: async () => ({ data: { session: { access_token: 't', user: { id: 'u' } } } }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { role: 'coach', status: 'active', name: 'Coach' } }) }) }) }) } };
sandbox.window.window = sandbox.window;
sandbox.window.location = location;
sandbox.scrollTo = () => {};
vm.createContext(sandbox);
// `window.x` et `x` doivent désigner la même chose, comme dans un navigateur.
vm.runInContext('Object.assign(globalThis, window); window = globalThis;', sandbox);
vm.runInContext(readFileSync('assets/back-office.js', 'utf8'), sandbox);
const attendre = () => new Promise((r) => setTimeout(r, 60));
await attendre(); await attendre();
const html = () => el('boWebinaires').innerHTML;
const cliquer = async (bouton) => { for (const f of clics) await f({ target: { closest: (sel) => (sel.split(',').some((s) => bouton.matches(s.trim())) ? bouton : null) }, preventDefault() {} }); await attendre(); };
const bouton = (attrs) => ({ dataset: attrs.dataset || {}, disabled: false, matches: (s) => { const m = /^\[data-([a-z-]+)\]$/.exec(s); return !!m && attrs.attr === m[1]; } });

console.log('\n  ══ 1. L’ÉCRAN DES WEBINAIRES ══');
const w = html();
dire(w.length > 500, 'l’écran est rendu par le routeur', w.length);
dire(!/undefined|NaN|\[object Object\]|>null</.test(w), 'ni undefined, ni NaN, ni objet brut', (w.match(/undefined|NaN|\[object Object\]|>null</) || [''])[0]);
dire(!w.includes('Le guide offert'), 'un tunnel « lead » n’est pas un webinaire : absent');
const aVenir = w.slice(w.indexOf('À venir'), w.indexOf('Passés'));
const passes = w.slice(w.indexOf('Passés'));
dire(aVenir.includes('À venir sans lien') && aVenir.includes('À venir avec lien') && !aVenir.includes('Passé à envoyer'), 'à venir : les deux prochains, pas les passés');
dire(aVenir.indexOf('À venir avec lien') < aVenir.indexOf('À venir sans lien'), 'à venir : le plus proche en premier');
dire(passes.includes('Passé à envoyer') && passes.includes('Passé envoyé'), 'passés : les deux');
const ligne = (titre) => w.split('<tr>').find((x) => x.includes(titre)) || '';
dire(/bo-pill--attend">à poser/.test(ligne('À venir sans lien')), 'sans lien du direct : « à poser » signalé');
dire(/data-web-replay="3" data-reste="2"/.test(ligne('Passé à envoyer')), 'passé, replay posé, 1 envoyé sur 3 : « Envoyer le replay (2) »');
dire(!/data-web-replay/.test(ligne('Passé envoyé')), 'passé, envoyé à tous : plus de bouton');
dire(!/data-web-replay/.test(ligne('À venir avec lien')), 'à venir : pas de bouton replay');
dire(/>…</.test(ligne('Réponse sans retombées')), 'site pas encore à jour : « … » au lieu d’un faux zéro');
dire(/Inscrits[\s\S]*?>11</.test(w) && /Présents[\s\S]*?>3</.test(w), 'indicateurs : 11 inscrits, 3 présents (sommes des webinaires)');
dire(/27 % des inscrits/.test(w), 'taux de présence : 3 / 11 = 27 %');
dire(/>2 <small>67 %<\/small>/.test(ligne('Passé à envoyer')), 'taux par webinaire : 2 présents sur 3 = 67 %');
dire(/data-web-creer/.test(w) && !/data-web-creer[^>]*disabled/.test(w), 'bouton « Créer un webinaire » actif');
dire(/data-tun-copier="https:\/\/www\.trader360\.fr\/t\/web-sans-lien\/"/.test(ligne('À venir sans lien')), 'publié : lien d’inscription affiché, avec « Copier »');
dire(/data-tun-copier="https:\/\/www\.trader360\.fr\/t\/web-sans-lien\/candidater\/"/.test(ligne('À venir sans lien')), 'publié : lien « candidater » du live, avec « Copier »');
dire(/>3 <small title="par le lien du live">dont 2 live<\/small>/.test(ligne('Passé à envoyer')), 'candidatures : 3, dont 2 par le lien du live');
dire(/\/t\/web-sans-lien\/direct\/\?coach=11111111-1111-4111-8111-111111111111/.test(ligne('À venir sans lien')), 'lien « salle du live en coach » avec la clé d’aperçu');
dire(!/data-tun-copier/.test(ligne('Réponse sans retombées')) && /Pas encore publié/.test(ligne('Réponse sans retombées')), 'brouillon : pas de lien à partager, « Pas encore publié »');
dire(/data-tun-copier="https:\/\/www\.trader360\.fr\/t\/web-fini\/"/.test(ligne('Passé envoyé')) === false, '⚠️ TÉMOIN : un webinaire archivé ne propose pas son lien');

console.log('\n  ══ 2. ENVOYER LE REPLAY, CRÉER, OUVRIR ══');
await cliquer(bouton({ attr: 'tun-copier', dataset: { tunCopier: 'https://www.trader360.fr/t/web-sans-lien/' } }));
dire(copies[0] === 'https://www.trader360.fr/t/web-sans-lien/' && el('boToast').textContent === 'Lien copié.', '« Copier le lien d’inscription » copie depuis l’écran Webinaires', copies);
appels.length = 0;
await cliquer(bouton({ attr: 'web-replay', dataset: { webReplay: '3', reste: '2' } }));
dire(appels.includes('tunnels:envoyer_replay'), 'le clic appelle envoyer_replay', appels);
dire(el('boToast').textContent === 'Replay envoyé à 2 inscrit(s) : 1 présent(s), 1 absent(s).', 'le compte rendu est dit au coach', el('boToast').textContent);
replayRendu = { envoyes: 1, presents: 0, absents: 1, erreurs: ['b@x.fr : Brevo 400'] };
await cliquer(bouton({ attr: 'web-replay', dataset: { webReplay: '3', reste: '2' } }));
dire(/1 échec\(s\) : b@x\.fr/.test(el('boToast').textContent), 'un échec partiel est dit, pas masqué', el('boToast').textContent);
appels.length = 0;
await cliquer(bouton({ attr: 'web-creer' }));
dire(location.hash === '#/marketing/tunnels', '« Créer un webinaire » ouvre Tunnels', location.hash);
for (const f of surHash) await f(); await attendre();
const ed = el('boTunnels').innerHTML;
dire(/Webinaire/.test(ed) && /data-tun-champ="lien_direct"/.test(ed) && /data-tun-champ="lien_replay"/.test(ed), 'l’éditeur s’ouvre sur le modèle webinaire, avec les deux liens');
dire(/value="web-sans-lien-2"/.test(ed), 'adresse libre proposée (l’exemple est déjà pris)');
location.hash = '#/marketing/webinaires'; for (const f of surHash) await f(); await attendre();
await cliquer(bouton({ attr: 'web-ouvrir', dataset: { webOuvrir: '3' } }));
for (const f of surHash) await f(); await attendre(); await attendre();
const ed2 = el('boTunnels').innerHTML;
dire(/<th>Présent<\/th>/.test(ed2) && /<th>Candidature<\/th>/.test(ed2) && /<th>Rappels<\/th>/.test(ed2), 'éditeur d’un webinaire : colonnes rappels, présent, replay, candidature');
dire(/title="Brevo 400 adresse refusée">non parti/.test(ed2), 'un rappel refusé est visible, avec son motif');
dire(/veille \+ heure/.test(ed2), 'Alice : « veille + heure »');
dire(/<b class="num">2<\/b> présents/.test(ed2) && /<b class="num">1<\/b> candidatures/.test(ed2), 'suivi : 2 présents, 1 candidature');
dire(/data-web-replay="3" data-reste="2"/.test(ed2), 'éditeur : « Envoyer le replay (2) »');
dire(/Ouvrir la salle du live en coach/.test(ed2) && /\/t\/web-passe\/direct\/\?coach=/.test(ed2), 'éditeur : bouton « Ouvrir la salle du live en coach »');
// Témoin : une sous-action fermée est refusée par le double, comme par le pont.
const refus = await fetch('', { body: JSON.stringify({ action: 'tunnels', sous_action: 'rappels' }) });
dire(refus.status === 400, '⚠️ TÉMOIN : « rappels » n’est PAS ouvert au back-office (seul le cron l’appelle)');

console.log('\n  ══ 3. UN TUNNEL QUI N’EST PAS UN WEBINAIRE GARDE SA TABLE ══');
{
  const m = readFileSync('assets/back-office.js', 'utf8');
  dire(/tableInscrits\(_tun\.inscrits, t\.type\)/.test(m) && /const w = type === 'webinaire';/.test(m), 'les colonnes du webinaire ne s’ajoutent qu’aux webinaires');
}

console.log('\n  ══ 4. LE DÉCLENCHEUR (daily-brief, mode rappels_webinaires) ══');
{
  process.env.CRON_SECRET = 'secret-du-banc'; process.env.VERCEL_ENV = 'production'; process.env.BACKOFFICE_CLE = 'cle-du-banc';
  process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'x'; process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'https://double.invalid';
  const vus = []; let reponseSite = { ok: true, resultat: { webinaires: 1, veille: 0, heure: 3, erreurs: [], alertes: [] } };
  globalThis.fetch = async (u, o) => { vus.push({ u, cle: o?.headers?.['x-backoffice-cle'], corps: o?.body }); return { ok: true, status: 200, json: async () => reponseSite }; };
  const { default: handler } = await import('../api/cron/daily-brief.js');
  const res = () => { const r = { code: 0, corps: null, status(c) { r.code = c; return r; }, json(j) { r.corps = j; return r; } }; return r; };
  let r = res(); await handler({ method: 'POST', headers: {}, body: { rappels_webinaires: true } }, r);
  dire(r.code === 401 && vus.length === 0, 'sans le secret du cron : 401, le site n’est pas appelé', r.code);
  r = res(); await handler({ method: 'POST', headers: { authorization: 'Bearer secret-du-banc' }, body: { rappels_webinaires: true } }, r);
  dire(r.code === 200 && r.corps.resultat.heure === 3, 'avec le secret : 200 et le rapport du site', r.corps);
  dire(vus[0] && /\/api\/tunnels$/.test(vus[0].u) && vus[0].cle === 'cle-du-banc' && JSON.parse(vus[0].corps).action === 'rappels', 'appel au site : /api/tunnels, clé partagée, action rappels', vus[0]);
  reponseSite = { ok: true, resultat: { webinaires: 1, veille: 0, heure: 2, erreurs: ['x : Brevo 400'], alertes: [] } };
  r = res(); await handler({ method: 'POST', headers: { authorization: 'Bearer secret-du-banc' }, body: { rappels_webinaires: true } }, r);
  dire(r.code === 502, 'un envoi refusé rend 502 : le run GitHub passe au rouge', r.code);
  reponseSite = { ok: false, motif: 'non autorisé' };
  r = res(); await handler({ method: 'POST', headers: { authorization: 'Bearer secret-du-banc' }, body: { rappels_webinaires: true } }, r);
  dire(r.code === 502 && /non autorisé/.test(r.corps.error), 'le site refuse la clé : 502 avec le motif, pas un faux succès', r.corps);
  delete process.env.BACKOFFICE_CLE;
  r = res(); await handler({ method: 'POST', headers: { authorization: 'Bearer secret-du-banc' }, body: { rappels_webinaires: true } }, r);
  dire(r.code === 500 && /BACKOFFICE_CLE/.test(r.corps.error), 'clé absente du Journal : 500 nommé');
  const wf = readFileSync('.github/workflows/webinaires-rappels.yml', 'utf8');
  dire(/cron: '\*\/15 \* \* \* \*'/.test(wf) && /"rappels_webinaires":true/.test(wf) && /exit 1/.test(wf), 'workflow : tous les quarts d’heure, bon mode, échoue sur un code ≠ 200');
}

console.log(ko ? `\n⛔ ${ko} défaut(s)` : '\nbanc vert'); process.exitCode = ko ? 1 : 0;
