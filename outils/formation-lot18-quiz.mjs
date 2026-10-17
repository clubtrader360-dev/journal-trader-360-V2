/**
 * Banc Node du lot 18, le parcours du quiz de bout en bout par la delegation
 * de clics : entree, 15 questions, resultat reussi puis rate, ecritures.
 * ⚠️ Le double de PostgREST accepte tout : les contraintes de la table ont ete
 * lues dans pg_constraint le 14/10 (score >= 0, score <= total, total > 0).
 * Usage : node outils/formation-lot18-quiz.mjs   (code 1 si un defaut)
 */
import vm from 'node:vm';
import fs from 'node:fs';
const rendus = []; const ecritures = []; const listeners = [];
const zone = { _html:'', querySelectorAll(){return []}, querySelector(){return {disabled:false}}, getBoundingClientRect(){return {top:10}}, scrollIntoView(){}, classList:{add(){},remove(){}} };
Object.defineProperty(zone,'innerHTML',{get(){return zone._html},set(v){zone._html=v; rendus.push({id:'quizZone',html:v});}});
const main = { _html:'', style:{setProperty(){}}, querySelectorAll(){return []}, querySelector(){return null} }; Object.defineProperty(main,'innerHTML',{get(){return main._html},set(v){main._html=v; rendus.push({id:'formation',html:v});}});
const simple = () => ({ textContent:'', style:{setProperty(){}}, classList:{add(){},remove(){}}, setAttribute(){}, querySelector(){return null}, querySelectorAll(){return []}, appendChild(){}, getBoundingClientRect(){return {top:0,height:60,width:10}}, addEventListener(){}, dataset:{}, focus(){}, scrollIntoView(){}, remove(){}, close(){}, showModal(){} , _html:''});
const document = { addEventListener(t,f){ if(t==='click') listeners.push(f); }, removeEventListener(){}, getElementById(id){ return id==='formation'?main: id==='quizZone'?zone : id==='formationApp'? simple() : (id==='chipXp'||id==='chipLvl') ? simple() : null; }, querySelector(){return null}, querySelectorAll(){return []}, createElement(){ const d=simple(); Object.defineProperty(d,'innerHTML',{get(){return String(d.textContent).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')},set(v){d._html=v}}); return d; }, body:{dataset:{},appendChild(){}}, hidden:false };
const chaine = (data) => { const p = Promise.resolve({ data, error:null }); const o = { select(){return o}, eq(){return o}, order(){return o}, maybeSingle(){return Promise.resolve({data:null,error:null})}, upsert(l){ecritures.push(l);return Promise.resolve({error:null})}, insert(l){ecritures.push(l);return Promise.resolve({error:null})}, then: p.then.bind(p), catch: p.catch.bind(p) }; return o; };
const vues = Array.from({length:7},(_,i)=>({lecon_id:`m01-l${i}`,vue:true,progress_seconds:0,last_watched_at:'2026-10-14T10:00:00Z'}));
const tables = { formation_progression: vues, formation_notes: [], formation_videos: [], formation_quiz_resultats: [] };
const supabaseClient = { auth:{ getUser: async()=>({data:{user:{id:'u1'}}}) }, from(t){ return chaine(tables[t] ?? []); } };
const window = { document, matchMedia:()=>({matches:true}), addEventListener(){}, innerWidth:1200, innerHeight:800, scrollTo(){}, localStorage:{getItem(){return null},setItem(){}}, supabaseClient };
window.window = window;
const ctx = vm.createContext({ window, document, console, setTimeout, clearTimeout, requestAnimationFrame:(f)=>setTimeout(f,16), cancelAnimationFrame:clearTimeout, performance, Promise, Symbol, URLSearchParams, Date, Math, Number, String, Array, Object, Set, Map, JSON, encodeURIComponent, localStorage: window.localStorage });
for (const f of ['assets/formation-donnees.js','assets/formation-quiz.js']) vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
// ⚠️ 16/10 : le quiz 01 porte maintenant des questions illustrees et passe par le moteur d examen
// (eprouve par formation-certification-banc.mjs). Ce banc-ci eprouve le moteur CLASSIQUE, toujours
// utilise par les quiz sans illustration (module 08) : on lui retire ses illustrations, et lui seul.
window.FORMATION_QUIZ['01'].questions.forEach((q) => { delete q.illustration; });
if (window.FORMATION_QUIZ['01'].questions.some((q) => q.illustration)) throw new Error('temoin : illustrations encore presentes');
vm.runInContext(fs.readFileSync('supabase-formation.js','utf8'), ctx, {filename:'supabase-formation.js'});
const F = window.Formation; const C = F._calcul;
const racine = { contains(){return true} };
document.getElementById = ((orig)=> (id)=> id==='formationApp'? racine : orig(id))(document.getElementById);
const clic = async (attrs) => { const target = { attrs, closest(sel){ return sel.split(',').some(s=>Object.keys(attrs).some(a=>s.includes(a))) ? target : null; }, hasAttribute(a){return a in attrs}, dataset: Object.fromEntries(Object.entries(attrs).map(([k,v])=>[k.replace(/^data-/,'').replace(/-([a-z])/g,(_,c)=>c.toUpperCase()), v])) }; for (const f of listeners) f({ target }); await new Promise(r=>setTimeout(r,30)); };
const dire=(ok,msg,val)=>{ console.log(`  ${ok?'ok ':'⛔ '} ${msg}${val!==undefined?'  '+val:''}`); if(!ok) process.exitCode=1; };
await F.ouvrir();
dire(C.quizOuvert(C.mods()[1]),'7 videos vues : quiz 01 ouvert');
const accueil = rendus.find(r=>r.id==='formation').html;
dire(/Prochaine étape : <b>Module 01 · Quiz du module 01/.test(accueil),'accueil : prochaine etape = le quiz');
rendus.length=0; F.ouvrirLecon('m01-quiz'); await new Promise(r=>setTimeout(r,40));
let h = rendus.find(r=>r.id==='formation').html;
dire(/quiz__entree/.test(h) && /15 questions, 12 bonnes réponses/.test(h),'ecran d entree : 15 questions, 12 pour valider');
rendus.length=0; await clic({'data-quiz-commencer':''});
h = rendus.find(r=>r.id==='quizZone')?.html || '';
dire(/Question 1 sur 15/.test(h) && (h.match(/class="quiz__opt"/g)||[]).length===4,'question 1 : 4 options');
dire(/disabled/.test(h),'suivant desactive sans reponse');
// repondre juste a tout : on lit la bonne dans FORMATION_QUIZ
const Q = window.FORMATION_QUIZ['01'].questions;
for (let i=0;i<15;i++){ const bonne = i<12 ? Q[i].bonne : (Q[i].bonne+1)%Q[i].options.length; await clic({'data-rep':String(bonne)}); rendus.length=0; await clic({'data-quiz-suiv':''}); }
h = rendus.find(r=>r.id==='quizZone')?.html || '';
dire(/quiz__resultat--ok/.test(h) && /12<small>\/ 15/.test(h),'12 justes : reussi 12 / 15 (seuil exact)');
dire(/data-quiz-scene/.test(h),'bouton Recuperer mes XP');
dire(/3 réponses à revoir quand même/.test(h),'3 reponses a revoir, en details');
dire(/data-seek="\d+"/.test(h) && /Revoir « /.test(h),'renvoi video avec seek');
const e = ecritures.find(x=>x.module_cle==='01');
dire(e && e.score===12 && e.total===15 && e.reussi===true && e.reponses.length===15 && e.reponses[14].choisie!==e.reponses[14].bonne,'ecriture : 1 ligne, score 12/15, reussi, 15 reponses',JSON.stringify(e&&e.reponses[0]));
dire(C.estVue('m01-quiz') && C.badges().find(b=>b.id==='m01').ok(),'le quiz est vu, le badge 01 est acquis');
dire(C.xpTotal()===100+250,'XP = 100 + 250 (module fini)',C.xpTotal());
// scene sans mouvement
rendus.length=0; await clic({'data-quiz-scene':''}); await new Promise(r=>setTimeout(r,60));
h = rendus.find(r=>r.id==='formation')?.html || '';
dire(/Ma collection/.test(h),'sans mouvement : retour a l accueil (badges)');
// un quiz rate
rendus.length=0; F.ouvrirLecon('m01-quiz'); await new Promise(r=>setTimeout(r,40));
h = rendus.find(r=>r.id==='formation').html; dire(/quiz__fait/.test(h) && /Réussi : 12 \/ 15/.test(h),'rouvert : ecran reussi 12/15');
await clic({'data-quiz-commencer':''});
for (let i=0;i<15;i++){ await clic({'data-rep':String((Q[i].bonne+1)%Q[i].options.length)}); rendus.length=0; await clic({'data-quiz-suiv':''}); }
h = rendus.find(r=>r.id==='quizZone')?.html || '';
dire(/quiz__resultat--rate/.test(h) && /0<small>\/ 15/.test(h) && /Il t’en manque 12/.test(h),'0 juste : rate, il en manque 12');
dire((h.match(/class="quiz__faute"/g)||[]).length===15,'15 fautes listees avec conseil', (h.match(/quiz__faute-c/g)||[]).length);
dire(ecritures.filter(x=>x.module_cle==='01').length===2,'deux lignes ecrites, une par tentative');
dire(C.quiz()['01'].reussi && C.quiz()['01'].score===12,'synthese : reste reussi, meilleur score 12');
