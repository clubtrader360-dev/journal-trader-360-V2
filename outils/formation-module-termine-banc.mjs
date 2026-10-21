/**
 * BANC : LA RÈGLE UNIQUE « MODULE TERMINÉ » (21/10). Pour CHAQUE module :
 * quiz réussi sans aucune vidéo vue => terminé ; toutes les vidéos vues sans le
 * quiz => pas terminé ; module sans quiz => terminé quand ses chapitres sont vus.
 * Puis l'XP de l'écran élève (`xpTotal`) comparé à celui du tableur
 * (`api/_lib/formation-xp.js`) sur plusieurs états : ils doivent être ÉGAUX.
 * Usage : node outils/formation-module-termine-banc.mjs   (code 1 si un défaut)
 */
import vm from 'node:vm';
import fs from 'node:fs';
const rendus = []; const ecritures = []; const listeners = []; const zoneListeners = {};
const graph = { _html: '', set innerHTML(v) { graph._html = v; }, get innerHTML() { return graph._html; } };
const zone = {
  _html: '', clientWidth: 720, querySelectorAll() { return []; }, querySelector(sel) { return sel === '#exGraph' ? graph : { disabled: false }; },
  getBoundingClientRect() { return { top: 10, height: 300 }; }, scrollIntoView() {}, classList: { add() {}, remove() {} },
  addEventListener(t, f) { (zoneListeners[t] = zoneListeners[t] || []).push(f); }, removeEventListener(t, f) { zoneListeners[t] = (zoneListeners[t] || []).filter((x) => x !== f); },
  contains() { return true; },
};
Object.defineProperty(zone, 'innerHTML', { get() { return zone._html; }, set(v) { zone._html = v; rendus.push({ id: 'quizZone', html: v }); } });
const main = { _html: '', style: { setProperty() {} }, querySelectorAll() { return []; }, querySelector() { return null; } };
Object.defineProperty(main, 'innerHTML', { get() { return main._html; }, set(v) { main._html = v; rendus.push({ id: 'formation', html: v }); } });
const simple = () => ({ textContent: '', style: { setProperty() {} }, classList: { add() {}, remove() {}, contains() { return false; } }, setAttribute() {},  removeAttribute() {}, hasAttribute() { return false; }, querySelector() { return null; }, querySelectorAll() { return []; }, appendChild() {}, getBoundingClientRect() { return { top: 0, height: 60, width: 10 }; }, addEventListener() {}, dataset: {}, focus() {}, scrollIntoView() {}, remove() {}, close() {}, showModal() {}, _html: '' });
const document = { addEventListener(t, f) { if (t === 'click') listeners.push(f); }, removeEventListener() {}, getElementById(id) { return id === 'formation' ? main : id === 'quizZone' ? zone : id === 'formationApp' ? simple() : (id === 'chipXp' || id === 'chipLvl') ? simple() : null; }, querySelector() { return null; }, querySelectorAll() { return []; }, createElement() { const d = simple(); Object.defineProperty(d, 'innerHTML', { get() { return String(d.textContent).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }, set(v) { d._html = v; } }); return d; }, body: { dataset: {}, appendChild() {}, classList: { contains() { return true; } } }, hidden: false };
const chaine = (data) => { const p = Promise.resolve({ data, error: null }); const o = { select() { return o; }, eq() { return o; }, ilike() { return o; }, limit() { return o; }, order() { return o; }, maybeSingle() { return Promise.resolve({ data: null, error: null }); }, upsert(l) { ecritures.push(l); return Promise.resolve({ error: null }); }, insert(l) { ecritures.push(l); return Promise.resolve({ error: null }); }, then: p.then.bind(p), catch: p.catch.bind(p) }; return o; };
const tables = { formation_progression: [], formation_notes: [], formation_videos: [], formation_quiz_resultats: [], formation_niveau_learnybox: [] };
const supabaseClient = { auth: { getUser: async () => ({ data: { user: { id: 'u1', email: 'banc@t360.test' } } }) }, from(t) { return chaine(tables[t] ?? []); } };
const window = { document, matchMedia: () => ({ matches: true }), addEventListener() {}, removeEventListener() {}, innerWidth: 1200, innerHeight: 800, scrollTo() {}, localStorage: { getItem() { return null; }, setItem() {} }, supabaseClient };
window.window = window;
const ctx = vm.createContext({ window, document, console, setTimeout, clearTimeout, requestAnimationFrame: (f) => setTimeout(f, 16), cancelAnimationFrame: clearTimeout, performance, Promise, Symbol, URLSearchParams, Date, Math, Number, String, Array, Object, Set, Map, JSON, encodeURIComponent, localStorage: window.localStorage });
for (const f of ['assets/formation-donnees.js', 'assets/formation-quiz.js', 'assets/formation-certification.js', 'assets/formation-examen.js', 'supabase-formation.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
const F = window.Formation; const C = F._calcul; const E = window.FormationExamen; const D = window.FORMATION_CERTIFICATION;
const racine = { contains() { return true; }, appendChild() {}, setAttribute() {}, removeAttribute() {}, hasAttribute() { return false; }, insertBefore() {}, firstChild: null, querySelector() { return null; }, querySelectorAll() { return []; } };
document.getElementById = ((orig) => (id) => id === 'formationApp' ? racine : orig(id))(document.getElementById);
const cible = (attrs) => ({ attrs, closest(sel) { return sel.split(',').some((s) => Object.keys(attrs).some((a) => s.includes(a))) ? this : null; }, hasAttribute(a) { return a in attrs; }, dataset: Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v])) });
const clic = async (attrs) => { const target = cible(attrs); const ev = { target, shiftKey: false, preventDefault() {} }; for (const f of listeners) f(ev); for (const f of (zoneListeners.click || [])) f(ev); await new Promise((r) => setTimeout(r, 25)); };
const dire = (ok, msg, val) => { console.log(`  ${ok ? 'ok ' : '⛔ '} ${msg}${val !== undefined ? '  ' + val : ''}`); if (!ok) process.exitCode = 1; };
const derniereZone = () => [...rendus].reverse().find((r) => r.id === 'quizZone')?.html || '';
const verifierContrainte = (l) => l.score >= 0 && l.score <= l.total && l.total > 0;

import { xpTotal as xpTableur } from '../api/_lib/formation-xp.js';
const FD = window.FormationDonnees;
const M = FD.MODULES;
console.log(`${M.length} modules dans la structure`);
let avecQuiz = 0, sansQuiz = 0;
for (const m of M) {
  const q = FD.aUnQuiz(m);
  const chap = m.lecons.filter((l) => !l.quiz);
  if (q) {
    avecQuiz += 1;
    dire(FD.moduleTermine(m, () => false, (c) => c === m.cle), `${m.cle} : quiz réussi, aucune vidéo vue => terminé`);
    dire(!FD.moduleTermine(m, () => true, () => false), `${m.cle} : toutes les vidéos vues, quiz non réussi => pas terminé`);
  } else if (chap.length) {
    sansQuiz += 1;
    dire(FD.moduleTermine(m, () => true, () => false), `${m.cle} : sans quiz, chapitres tous vus => terminé`);
    dire(!FD.moduleTermine(m, (id) => id !== chap[0].id, () => false), `${m.cle} : sans quiz, un chapitre manquant => pas terminé`);
  }
}
dire(avecQuiz >= 11, `${avecQuiz} modules avec quiz (01 à 09, 7 bis, certification)`, avecQuiz);
console.log(`(${sansQuiz} module(s) sans quiz)`);

console.log('\nl écran élève et le tableur comptent les mêmes XP');
await F.ouvrir();
const mods = C.mods();
const toutesLecons = mods.flatMap((m) => m.lecons.filter((l) => !l.quiz).map((l) => l.id));
const etats = [
  { nom: 'rien', vues: [], quiz: [] },
  { nom: 'quiz 01 et 04 réussis sans vidéo', vues: [], quiz: ['01', '04'] },
  { nom: 'toutes les vidéos, aucun quiz', vues: toutesLecons, quiz: [] },
  { nom: 'tout', vues: toutesLecons, quiz: mods.filter((m) => m.lecons.some((l) => l.quiz)).map((m) => m.cle) },
  { nom: 'moitié des vidéos, quiz 02 03 05', vues: toutesLecons.filter((_, i) => i % 2), quiz: ['02', '03', '05'] },
];
for (const e of etats) {
  tables.formation_progression = e.vues.map((id) => ({ lecon_id: id, vue: true, progress_seconds: 0, last_watched_at: '2026-10-21T10:00:00Z' }));
  tables.formation_quiz_resultats = e.quiz.map((cle) => ({ module_cle: cle, score: 15, total: 15, reussi: true, created_at: '2026-10-21T11:00:00Z' }));
  tables.formation_niveau_learnybox = [{ niveau: 'confirme', progression_pct: 100, groupes: '' }];
  await F.ouvrir();
  const ecran = C.xpTotal();
  const tableur = xpTableur(new Set(e.vues), new Set(e.quiz));
  dire(ecran === tableur, `${e.nom} : écran ${ecran} XP, tableur ${tableur} XP`);
}
// Témoin : la règle reconnaît bien un module NON terminé (sinon tout serait « vrai »).
dire(!FD.moduleTermine(M.find((m) => FD.aUnQuiz(m)), () => true, () => false), 'témoin : un module à quiz non réussi n est pas terminé');
console.log(process.exitCode ? '\n⛔ des défauts' : '\nbanc vert');
