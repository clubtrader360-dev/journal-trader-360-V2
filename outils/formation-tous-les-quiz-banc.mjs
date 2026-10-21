/**
 * BANC : TOUS LES QUIZ, DE BOUT EN BOUT, UN PAR UN.
 *
 * ⛔ POURQUOI IL EXISTE. Le 16/10, le lot des quiz illustres a ete eprouve sur un
 * echantillon (quiz 03, certification, un quiz sans illustration). La combinaison
 * « illustrations sans exercice » n'a jamais ete ouverte : cinq quiz sur dix ne se
 * lancaient pour personne pendant cinq jours (correctif de Manu, PR #118, 21/10).
 * Regle de CLAUDE.md : quand un chantier touche une famille, le banc la parcourt
 * EN ENTIER. Ici : chaque chapitre quiz de chaque module, examen compris, est ouvert,
 * commence, repondu juste, valide, et son ecriture en base est controlee.
 *
 * La liste des quiz n'est PAS ecrite ici : elle vient de `C.mods()`. Un quiz ajoute
 * demain entre dans le banc sans qu'on y touche, et le banc annonce combien il en a
 * parcouru, pour qu'un parcours vide ne passe pas pour un succes.
 *
 * Usage : node outils/formation-tous-les-quiz-banc.mjs
 *         EXAMEN=/chemin/formation-examen.js node outils/formation-tous-les-quiz-banc.mjs
 *         (pour eprouver une autre version du moteur, par exemple celle de la production)
 * Code 1 si un defaut.
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
const EXAMEN = process.env.EXAMEN || 'assets/formation-examen.js';
for (const f of ['assets/formation-donnees.js', 'assets/formation-quiz.js', 'assets/formation-certification.js', EXAMEN, 'supabase-formation.js']) vm.runInContext(fs.readFileSync(f, 'utf8'), ctx, { filename: f });
console.log(`moteur eprouve : ${EXAMEN}`);
const F = window.Formation; const C = F._calcul; const E = window.FormationExamen; const D = window.FORMATION_CERTIFICATION;
const racine = { contains() { return true; }, appendChild() {}, setAttribute() {}, removeAttribute() {}, hasAttribute() { return false; }, insertBefore() {}, firstChild: null, querySelector() { return null; }, querySelectorAll() { return []; } };
document.getElementById = ((orig) => (id) => id === 'formationApp' ? racine : orig(id))(document.getElementById);
const cible = (attrs) => ({ attrs, closest(sel) { return sel.split(',').some((s) => Object.keys(attrs).some((a) => s.includes(a))) ? this : null; }, hasAttribute(a) { return a in attrs; }, dataset: Object.fromEntries(Object.entries(attrs).map(([k, v]) => [k.replace(/^data-/, '').replace(/-([a-z])/g, (_, c) => c.toUpperCase()), v])) });
const clic = async (attrs) => { const target = cible(attrs); const ev = { target, shiftKey: false, preventDefault() {} }; for (const f of listeners) f(ev); for (const f of (zoneListeners.click || [])) f(ev); await new Promise((r) => setTimeout(r, 25)); };
const dire = (ok, msg, val) => { console.log(`  ${ok ? 'ok ' : '⛔ '} ${msg}${val !== undefined ? '  ' + val : ''}`); if (!ok) process.exitCode = 1; };
const derniereZone = () => [...rendus].reverse().find((r) => r.id === 'quizZone')?.html || '';
const verifierContrainte = (l) => l.score >= 0 && l.score <= l.total && l.total > 0;

/* ── Tout est ouvert : videos vues, aucun quiz encore reussi ─────────── */
await F.ouvrir();
let M = C.mods();
tables.formation_progression = M.flatMap((m) => m.lecons.filter((l) => !l.quiz).map((l) => ({ lecon_id: l.id, vue: true, progress_seconds: 0, last_watched_at: '2026-10-21T10:00:00Z' })));
tables.formation_niveau_learnybox = [{ niveau: 'confirme', progression_pct: 100, groupes: '' }];
// Les quiz reussis d'avance SAUF celui qu'on passe : l'examen exige tout le parcours fini.
const tousReussis = (sauf) => M.filter((m) => m.lecons.some((l) => l.quiz && !l.examen) && m.cle !== sauf).map((m) => ({ module_cle: m.cle, score: 15, total: 15, reussi: true, created_at: '2026-10-21T11:00:00Z' }));
await F.ouvrir();
M = C.mods();
const chapitresQuiz = M.flatMap((m) => m.lecons.filter((l) => l.quiz).map((l) => ({ m, l })));
console.log(`${chapitresQuiz.length} chapitres quiz trouves dans la structure : ${chapitresQuiz.map(({ m }) => m.cle).join(', ')}`);
dire(chapitresQuiz.length >= 11, 'au moins 11 quiz (10 modules + l examen) : le parcours n est pas vide', chapitresQuiz.length);

const combinaisons = new Map();
let parcourus = 0;
for (const { m, l } of chapitresQuiz) {
  const D = l.examen ? window.FORMATION_CERTIFICATION : window.FORMATION_QUIZ[m.cle];
  const nbEx = (D && Array.isArray(D.exercices)) ? D.exercices.length : 0;
  const nbIllu = D ? D.questions.filter((q) => q.illustration).length : 0;
  const combi = l.examen ? 'examen' : `${nbEx ? 'exercices' : 'sans exercice'} / ${nbIllu ? 'illustre' : 'sans illustration'}`;
  combinaisons.set(combi, [...(combinaisons.get(combi) || []), m.cle]);
  console.log(`\nquiz ${m.cle} (${combi}, ${D ? D.questions.length : '?'} questions, ${nbEx} exercice(s))`);
  if (!D) { dire(false, `${m.cle} : aucune donnee de quiz`); continue; }

  tables.formation_quiz_resultats = tousReussis(m.cle);
  await F.ouvrir();
  ecritures.length = 0; rendus.length = 0;
  let erreur = null;
  try {
    F.ouvrirLecon(l.id); await new Promise((r) => setTimeout(r, 40));
    let h = rendus.find((r) => r.id === 'formation')?.html || '';
    dire(/quiz__entree/.test(h) && /data-quiz-commencer/.test(h), `${m.cle} : ecran d entree avec « Commencer »`);
    if (!nbEx) dire(!/sur graphique/.test(h), `${m.cle} : l entree n annonce pas d exercice sur graphique`);
    rendus.length = 0; await clic({ 'data-quiz-commencer': '' });
    h = derniereZone();
    const moteur = /data-ex-rep=/.test(h);
    dire(moteur || /data-rep=/.test(h), `${m.cle} : la question 1 s affiche (moteur ${moteur ? 'examen' : 'classique'})`);
    dire(new RegExp(`Question 1 sur ${D.questions.length}`).test(h), `${m.cle} : « Question 1 sur ${D.questions.length} »`);
    for (let i = 0; i < D.questions.length; i += 1) {
      if (moteur) { await clic({ 'data-ex-rep': String(D.questions[i].bonne) }); await clic({ 'data-ex-suiv': '' }); }
      else { await clic({ 'data-rep': String(D.questions[i].bonne) }); rendus.length = 0; await clic({ 'data-quiz-suiv': '' }); }
    }
    for (let k = 0; k < nbEx; k += 1) {
      const ex = D.exercices[k];
      h = derniereZone();
      dire(new RegExp(`Exercice ${k + 1} sur ${nbEx}`).test(h), `${m.cle} : exercice ${k + 1} sur ${nbEx} (${ex.type})`);
      if (ex.type === 'zone') {
        const pas = Math.round((ex.attendu.centre - ex.bande.depart) / 0.25);
        for (let j = 0; j < Math.abs(pas); j += 1) await clic({ [pas > 0 ? 'data-ex-haut' : 'data-ex-bas']: '' });
      } else if (ex.type === 'entrees') {
        for (const c of ex.candidats.filter((x) => x.bon)) await clic({ 'data-ex-chip': String(c.i) });
      } else if (ex.type === 'reperer') {
        await clic({ 'data-ex-ind': ex.cible });
      } else dire(false, `${m.cle} : type d exercice inconnu du banc`, ex.type);
      rendus.length = 0; await clic({ 'data-ex-suiv': '' });
    }
    await new Promise((r) => setTimeout(r, 60));
    h = derniereZone();
    dire(/quiz__resultat--ok/.test(h), `${m.cle} : resultat « reussi »`);
    const e = ecritures.find((x) => x.module_cle === m.cle);
    dire(e && e.reussi === true && e.score === e.total && verifierContrainte(e), `${m.cle} : ecriture en base, score plein et contraintes respectees`, e ? `${e.score} / ${e.total}` : 'aucune ecriture');
    if (e) parcourus += 1;
  } catch (err) { erreur = err; }
  dire(!erreur, `${m.cle} : aucune exception de bout en bout`, erreur ? String(erreur.stack || erreur).split('\n').slice(0, 2).join(' | ') : undefined);
}
console.log('\ncombinaisons rencontrees :');
for (const [k, v] of combinaisons) console.log(`  ${k} : ${v.join(', ')}`);
dire(parcourus === chapitresQuiz.length, `tous les quiz parcourus jusqu a l ecriture : ${parcourus} sur ${chapitresQuiz.length}`);
console.log(process.exitCode ? '\n⛔ des defauts' : '\nbanc vert');
