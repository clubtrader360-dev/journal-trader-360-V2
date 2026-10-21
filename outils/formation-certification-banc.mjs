/**
 * Banc Node de la certification, de bout en bout par la delegation de clics :
 * module 10 verrouille tant que le parcours n est pas fini, puis ouvert ;
 * vingt questions, quatre exercices (bande glissee par les fleches, candidats
 * coches par les puces), resultat certifie et ecriture ; puis une tentative
 * ratee (bande posee a cote), et le calcul pur sur les quatre graphiques.
 * ⚠️ Le double de PostgREST accepte tout : les contraintes de la table ont ete
 * relues dans pg_constraint le 15/10 (score >= 0, score <= total, total > 0),
 * et le banc les verifie lui-meme sur chaque ecriture.
 * Usage : node outils/formation-certification-banc.mjs   (code 1 si un defaut)
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

/* ── 1. Le calcul pur ───────────────────────────────────────────────── */
console.log('calcul pur');
for (const ex of D.exercices) {
  const B = E._calcul.bougiesDe(ex);
  dire(B.length === ex.n && B.every((b) => b.l <= Math.min(b.o, b.c) && b.h >= Math.max(b.o, b.c)), `${ex.id} : ${ex.n} bougies coherentes`);
  const B2 = E._calcul.bougiesDe(ex);
  dire(JSON.stringify(B) === JSON.stringify(B2), `${ex.id} : deterministe (deux rendus identiques)`);
  Object.entries(ex.bougies).forEach(([i, b]) => { const k = B[+i]; if (!(k.o === b.o && k.h === b.h && k.l === b.l && k.c === b.c)) dire(false, `${ex.id} : bougie ${i} posee a la main alteree`, JSON.stringify(k)); });
  if (ex.type === 'zone') {
    // ⚠️ Le piege doit rester un piege : aucune autre bougie ne touche le sommet isole ; la zone attendue a bien ses trois touches.
    const touches = B.filter((b) => Math.abs((ex.attendu.centre > ex.chemin[0][0] ? b.h : b.l) - ex.attendu.centre) <= 0.5).length;
    dire(touches >= 3, `${ex.id} : la zone attendue est touchee au moins 3 fois`, touches);
    for (const p of ex.pieges) { const n = B.filter((b) => b.h === p.prix || b.l === p.prix).length; if (p.texte.includes('une fois') || p.texte.includes('une seule fois')) dire(n === 1, `${ex.id} : le piege ${p.prix} n est touche qu une fois`, n); }
    dire(E._calcul.noterExercice(ex, { bande: ex.attendu.centre }).ok && E._calcul.noterExercice(ex, { bande: ex.attendu.centre + ex.attendu.marge }).ok && !E._calcul.noterExercice(ex, { bande: ex.attendu.centre + ex.attendu.marge + 0.25 }).ok && !E._calcul.noterExercice(ex, { bande: ex.bande.depart }).ok, `${ex.id} : notation (centre, marge exacte, marge + 0,25, depart)`);
  } else {
    const bons = ex.candidats.filter((c) => c.bon).map((c) => c.i);
    dire(E._calcul.noterExercice(ex, { coches: bons }).ok && !E._calcul.noterExercice(ex, { coches: bons.slice(1) }).ok && !E._calcul.noterExercice(ex, { coches: [...bons, ex.candidats.find((c) => !c.bon).i] }).ok && !E._calcul.noterExercice(ex, { coches: [] }).ok, `${ex.id} : notation (exact, un bon de moins, un faux de plus, rien)`);
    // Chaque bon candidat : corps dans la zone, stop entre 2 et 8.
    for (const c of ex.candidats) {
      const b = ex.bougies[c.i];
      const d = ex.sens === 'achat' ? (Math.max(b.o, b.c) + 0.25) - (b.l - 1.25) : (b.h + 1.25) - (Math.min(b.o, b.c) - 0.25);
      const dans = Math.max(b.o, b.c) >= ex.zone.bas && Math.min(b.o, b.c) <= ex.zone.haut;
      if (c.bon) dire(dans && d >= 2 && d <= 8, `${ex.id} ${c.lettre} (bon) : dans la zone, stop ${d} pts`);
      else dire(!dans || d > 8 || /continuation|annonce/.test(c.texte), `${ex.id} ${c.lettre} (faux) : hors zone, ou trop cher, ou pas un retournement`, `dans=${dans} stop=${d}`);
    }
  }
  const g = E._calcul.graphique(ex, { largeur: 680, bande: ex.type === 'zone' ? ex.bande.depart : null, coches: new Set(), interactif: true });
  dire(/<svg/.test(g.html) && (g.html.match(/ex__bougie /g) || []).length === ex.n, `${ex.id} : SVG avec ${ex.n} bougies`);
  if (ex.type === 'entrees') dire((g.html.match(/data-ex-cand=/g) || []).length === ex.candidats.length && /ex__mm20/.test(g.html) && /ex__zone/.test(g.html), `${ex.id} : candidats, MM20 et zone dessines`);
  else dire(/data-ex-bande/.test(g.html) && /ex__cv/.test(g.html), `${ex.id} : bande et CV dessinees`);
  dire(!/[\u2013\u2014]/.test(g.html), `${ex.id} : aucun tiret cadratin dans le SVG`);
}
const notation = E._calcul.noter(D, { choix: Object.fromEntries(D.questions.map((q) => [q.id, q.bonne])), reponses: Object.fromEntries(D.exercices.map((ex) => [ex.id, ex.type === 'zone' ? { bande: ex.attendu.centre } : { coches: ex.candidats.filter((c) => c.bon).map((c) => c.i) }])) });
dire(notation.score === 40 && notation.total === 40 && notation.seuil === 32 && notation.reussi, 'tout juste : 40 / 40, seuil 32, reussi');
const n2 = E._calcul.noter(D, { choix: Object.fromEntries(D.questions.map((q) => [q.id, q.bonne])), reponses: Object.fromEntries(D.exercices.map((ex) => [ex.id, ex.type === 'zone' ? { bande: ex.bande.depart } : { coches: ex.candidats.filter((c) => c.bon).map((c) => c.i) }])) });
dire(n2.score === 30 && !n2.reussi, '20 questions justes et 2 exercices sur 4 : 30 / 40, pas certifie', n2.score);
const n3 = E._calcul.noter(D, { choix: Object.fromEntries(D.questions.map((q) => [q.id, (q.bonne + 1) % q.options.length])), reponses: Object.fromEntries(D.exercices.map((ex) => [ex.id, ex.type === 'zone' ? { bande: ex.attendu.centre } : { coches: ex.candidats.filter((c) => c.bon).map((c) => c.i) }])) });
dire(n3.score === 20 && !n3.reussi, '4 exercices justes et 0 question : 20 / 40, pas certifie', n3.score);

/* ── 2. Le parcours dans l espace ───────────────────────────────────── */
console.log('parcours : module 10 ferme');
await F.ouvrir();
const M = C.mods();
const m10 = M.find((m) => m.cle === '10');
dire(m10 && m10.lecons.length === 1 && m10.lecons[0].id === 'm10-quiz' && m10.lecons[0].examen, 'module 10 : un chapitre, m10-quiz, examen');
dire(!C.etatModule(m10).ouvrable, 'ferme tant que le parcours n est pas fini', C.etatModule(m10).cause);
const totalAvant = C.totalChap ? C.totalChap() : null;

console.log('parcours : tout vu, tous les quiz reussis');
// ⚠️ Toutes les videos vues et tous les quiz reussis : on rejoue l ouverture avec ces donnees.
tables.formation_progression = M.flatMap((m) => m.lecons.filter((l) => !l.quiz).map((l) => ({ lecon_id: l.id, vue: true, progress_seconds: 0, last_watched_at: '2026-10-14T10:00:00Z' })));
tables.formation_niveau_learnybox = [{ niveau: 'confirme', progression_pct: 100, groupes: '' }];
tables.formation_quiz_resultats = M.filter((m) => m.lecons.some((l) => l.quiz && !l.examen)).map((m) => ({ module_cle: m.cle, score: 15, total: 15, reussi: true, created_at: '2026-10-14T11:00:00Z' }));
await F.ouvrir();
dire(C.etatModule(C.mods().find((m) => m.cle === '10')).ouvrable, 'module 10 ouvert');
rendus.length = 0; F.ouvrirLecon('m10-quiz'); await new Promise((r) => setTimeout(r, 40));
let h = rendus.find((r) => r.id === 'formation')?.html || '';
const h0 = h;
dire(/Certification Trader 360/.test(h) && /quiz__entree/.test(h) && /20 questions et 4 exercices/.test(h) && /32 points sur 40/.test(h) && /data-quiz-commencer/.test(h), 'ecran d entree : 20 questions, 4 exercices, 32 sur 40');
const xpAvant = C.xpTotal();

rendus.length = 0; await clic({ 'data-quiz-commencer': '' });
h = derniereZone();
dire(/Question 1 sur 20/.test(h) && (h.match(/data-ex-rep=/g) || []).length === 4 && /disabled/.test(h), 'question 1 : 4 options, suivant desactive');
for (let i = 0; i < 20; i += 1) { await clic({ 'data-ex-rep': String(D.questions[i].bonne) }); await clic({ 'data-ex-suiv': '' }); }
h = derniereZone();
dire(/Exercice 1 sur 4/.test(h) && /data-ex-bande/.test(h) && /data-ex-haut/.test(h), 'apres 20 reponses : exercice 1, bande presente');
// Exercice A1 : la bande monte de 6 950 a 6 975,50 par les fleches (102 quarts de point).
const A1 = D.exercices[0];
const pas1 = Math.round((A1.attendu.centre - A1.bande.depart) / 0.25);
for (let k = 0; k < pas1; k += 1) await clic({ 'data-ex-haut': '' });
dire(new RegExp(`Ta zone · ${(A1.attendu.centre - 2).toLocaleString('fr-FR', { minimumFractionDigits: 2 })}`.replace(/ /g, '.')).test(graph._html.replace(/ /g, '.')) , 'A1 : la bande affiche 6 973,50 a 6 977,50 apres 102 fleches', (graph._html.match(/Ta zone · [^<]+/) || [])[0]);
await clic({ 'data-ex-suiv': '' });
h = derniereZone(); dire(/Exercice 2 sur 4/.test(h), 'exercice 2');
const A2 = D.exercices[1];
const pas2 = Math.round((A2.bande.depart - A2.attendu.centre) / 0.25);
for (let k = 0; k < pas2; k += 1) await clic({ 'data-ex-bas': '' });
await clic({ 'data-ex-suiv': '' });
h = derniereZone(); dire(/Exercice 3 sur 4/.test(h) && (h.match(/data-ex-chip=/g) || []).length === 5 && /disabled/.test(h), 'exercice 3 : 5 puces, suivant desactive sans coche');
for (const c of D.exercices[2].candidats.filter((x) => x.bon)) await clic({ 'data-ex-chip': String(c.i) });
h = derniereZone(); dire((h.match(/ex__chip--coche/g) || []).length === 2 && !/data-ex-suiv disabled/.test(h), 'B1 : deux puces cochees, suivant actif');
await clic({ 'data-ex-suiv': '' });
h = derniereZone(); dire(/Exercice 4 sur 4/.test(h) && /Valider mon examen/.test(h), 'exercice 4 : « Valider mon examen »');
for (const c of D.exercices[3].candidats.filter((x) => x.bon)) await clic({ 'data-ex-chip': String(c.i) });
rendus.length = 0; await clic({ 'data-ex-suiv': '' }); await new Promise((r) => setTimeout(r, 60));
h = derniereZone();
dire(/quiz__resultat--ok/.test(h) && /40<small>\/ 40/.test(h) && /Certifié/.test(h) && /Trader 360 certifié/.test(h), 'resultat : 40 / 40, certifie');
dire(/data-quiz-scene/.test(h) && (h.match(/ex__corr--ok/g) || []).length === 4 && /Zone attendue/.test(h), 'bouton XP, 4 corrections ok avec la zone attendue dessinee');
const e1 = ecritures.find((x) => x.module_cle === '10');
dire(e1 && e1.score === 40 && e1.total === 40 && e1.reussi === true && e1.reponses.questions.length === 20 && e1.reponses.exercices.length === 4 && e1.reponses.exercices[0].bande === A1.attendu.centre && verifierContrainte(e1), 'ecriture : module_cle 10, 40/40, reussi, 20 questions + 4 exercices, contraintes ok', JSON.stringify(e1 && e1.reponses.exercices[2]));
dire(C.estVue('m10-quiz') && C.moduleFini(C.mods().find((m) => m.cle === '10')), 'l examen est vu, le module 10 est fini');
dire(C.xpTotal() === xpAvant + 1100 && C.xpMaximum() === C.xpTotal(), 'XP = avant + 1 100 (le chapitre 100 + la prime 1 000), et c est le maximum atteignable', `${xpAvant} -> ${C.xpTotal()} / max ${C.xpMaximum()}`);
dire(/\+1100 XP/.test(h0), 'le bouton d entree annonce +1100 XP');
dire(C.badges().find((b) => b.module === '10' || b.id === 'm10')?.ok(), 'le badge de certification est acquis');

console.log('parcours : une tentative ratee');
rendus.length = 0; F.ouvrirLecon('m10-quiz'); await new Promise((r) => setTimeout(r, 40));
h = rendus.find((r) => r.id === 'formation')?.html || '';
dire(/quiz__fait/.test(h) && /Réussi : 40 \/ 40/.test(h), 'rouvert : ecran reussi 40 / 40');
await clic({ 'data-quiz-commencer': '' });
for (let i = 0; i < 20; i += 1) { await clic({ 'data-ex-rep': String(D.questions[i].bonne) }); await clic({ 'data-ex-suiv': '' }); }
await clic({ 'data-ex-suiv': '' }); // A1 laissee au depart : faux
await clic({ 'data-ex-suiv': '' }); // A2 laissee au depart : faux
for (const c of D.exercices[2].candidats.filter((x) => x.bon)) await clic({ 'data-ex-chip': String(c.i) });
await clic({ 'data-ex-suiv': '' });
await clic({ 'data-ex-chip': String(D.exercices[3].candidats[0].i) }); // un seul bon sur deux : faux
rendus.length = 0; await clic({ 'data-ex-suiv': '' }); await new Promise((r) => setTimeout(r, 60));
h = derniereZone();
dire(/quiz__resultat--rate/.test(h) && /25<small>\/ 40/.test(h) && /Pas encore/.test(h) && /Il fallait 32 points/.test(h), 'rate : 25 / 40, il fallait 32 points');
dire((h.match(/ex__corr--rate/g) || []).length === 3 && /Ta bande était à/.test(h) && /tu l’as laissé/.test(h) && /data-quiz-commencer/.test(h), '3 corrections ratees, bande expliquee, candidat laisse signale, Reessayer');
const e2 = ecritures.filter((x) => x.module_cle === '10');
dire(e2.length === 2 && e2[1].score === 25 && e2[1].reussi === false && verifierContrainte(e2[1]), 'deux lignes, la seconde 25 / 40 non reussie');
dire(C.quiz()['10'].reussi && C.quiz()['10'].score === 40, 'synthese : reste certifie, meilleur score 40');
// temoin negatif : une chaine absente
dire(!/CHAINE_ABSENTE_DU_RENDU/.test(h), 'temoin negatif : une chaine etrangere est bien absente');
/* ── 3. Un quiz de module par le moteur : module 03, 12 questions + 2 reperes ── */
console.log('quiz de module par le moteur (03 : reperer ; 02 : questions illustrees)');
const Q3 = window.FORMATION_QUIZ['03'], Q2 = window.FORMATION_QUIZ['02'];
dire(Q3.exercices && Q3.exercices.length === 3 && Q3.exercices.every((x) => x.type === 'reperer') && Q3.points_par_exercice === 2, 'FORMATION_QUIZ.03 : 3 exercices reperer a 2 points');
dire(Q2.questions.filter((q) => q.illustration).length === 6 && Q2.exercices.length === 2, 'FORMATION_QUIZ.02 : 6 questions illustrees, 2 exercices');
const m3 = C.mods().find((m) => m.cle === '03'), q3 = m3.lecons.find((l) => l.quiz);
dire(q3.moteur && q3.questions === 18 && C.seuilDe(q3) === 15, 'chapitre quiz 03 : moteur, 18 points, seuil 15', `${q3.questions} / ${C.seuilDe(q3)}`);
for (const ex of Q3.exercices) {
  const g = E._calcul.graphique(ex, { largeur: 680, choix: null, interactif: true });
  dire((g.html.match(/data-ex-ind=/g) || []).length === ex.reperes.length && /ex__vwap/.test(g.html) && (ex.cible !== 'pivot' || /ex__pivot/.test(g.html)), `${ex.id} : ${ex.reperes.length} reperes cliquables, traces presents`);
  dire(!new RegExp(`CV ${(ex.cv || 0).toLocaleString('fr-FR')}`).test(g.html), `${ex.id} : la CV n est pas etiquetee (ce serait la reponse)`);
  dire(E._calcul.noterExercice(ex, { choix: ex.cible }).ok && !E._calcul.noterExercice(ex, { choix: ex.reperes.find((r) => r.cle !== ex.cible).cle }).ok && !E._calcul.noterExercice(ex, { choix: null }).ok, `${ex.id} : notation (cible, autre, rien)`);
}
for (const q of Q2.questions.filter((x) => x.illustration)) { const svg = E.illustrer(q.illustration, 520); dire(/<svg/.test(svg) && (q.illustration.type !== 'bougies' || (svg.match(/ex__bougie /g) || []).length === q.illustration.bougies.length), `${q.id} : illustration ${q.illustration.type} rendue`); }
for (const q of window.FORMATION_QUIZ['06'].questions.filter((x) => x.illustration)) { const svg = E.illustrer(q.illustration, 520); dire(/ex__courbe/.test(svg) && (svg.match(/ex__point/g) || []).length >= q.illustration.etapes.length, `${q.id} : courbe de capital rendue avec ses etapes`); }
for (const q of window.FORMATION_QUIZ['03'].questions.filter((x) => x.illustration)) { const svg = E.illustrer(q.illustration, 520); dire(/ex__bb|ex__vwap|ex__pivot|ex__mm100|ex__mm20/.test(svg) && /<svg/.test(svg), `${q.id} : graphique illustre avec ses indicateurs`); }
// parcours : le quiz 03 par les clics
rendus.length = 0; ecritures.length = 0; F.ouvrirLecon('m03-quiz'); await new Promise((r) => setTimeout(r, 40));
h = rendus.find((r) => r.id === 'formation')?.html || '';
dire(/quiz__fait/.test(h) || /quiz__entree/.test(h), 'quiz 03 ouvert (deja reussi dans ce banc, ecran « reussi »)');
await clic({ 'data-quiz-commencer': '' });
h = derniereZone();
dire(/Question 1 sur 12/.test(h) && (h.match(/data-ex-rep=/g) || []).length >= 2, 'moteur : question 1 sur 12');
for (let i = 0; i < 12; i += 1) {
  if (Q3.questions[i].illustration) { h = derniereZone(); dire(/ex__illu/.test(h) && /<svg/.test(h), `question ${i + 1} : illustree a l ecran`); }
  await clic({ 'data-ex-rep': String(Q3.questions[i].bonne) }); await clic({ 'data-ex-suiv': '' });
}
h = derniereZone(); dire(/Exercice 1 sur 3/.test(h) && /Repère la VWAP/.test(h) && /disabled/.test(h), 'exercice 1 : reperer, suivant desactive');
await clic({ 'data-ex-ind': 'vwap' });
h = derniereZone(); dire(/c’est celle-là/.test(h) && !/data-ex-suiv disabled/.test(h), 'C choisi : suivant actif');
await clic({ 'data-ex-suiv': '' });
await clic({ 'data-ex-ind': 'cv' }); // faux : la CV au lieu du pivot
await clic({ 'data-ex-suiv': '' });
await clic({ 'data-ex-ind': 'mm20' }); // juste
rendus.length = 0; await clic({ 'data-ex-suiv': '' }); await new Promise((r) => setTimeout(r, 60));
h = derniereZone();
dire(/quiz__resultat--ok/.test(h) && /16<small>\/ 18/.test(h) && /Module 03 validé|Toujours là/.test(h) && !/Certifié/.test(h), 'resultat : 16 / 18, reussi, registre « module », pas « certifie »');
dire(/ex__corr--rate/.test(h) && /ton choix/.test(h) && /la bonne/.test(h), 'le repere faux est corrige, lettre par lettre');
const e3 = ecritures.find((x) => x.module_cle === '03');
dire(e3 && e3.score === 16 && e3.total === 18 && e3.reussi === true && e3.reponses.exercices[1].choix === 'cv' && verifierContrainte(e3), 'ecriture 03 : 16 / 18, reponses { questions, exercices }');
console.log(process.exitCode ? '\n⛔ des defauts' : '\nbanc vert');
