/**
 * Banc Node du lot 18, sans navigateur : les modules composes, le quiz en
 * dernier chapitre, les XP, les conditions de niveau. Doubles MINIMAUX du DOM
 * et du client Supabase ; ils ne reparent rien, ils rendent vide.
 * Usage : node outils/formation-lot18-calcul.mjs   (code 1 si un defaut)
 */
import vm from 'node:vm';
import fs from 'node:fs';
const el = () => ({ innerHTML:'', textContent:'', style:{setProperty(){}}, classList:{add(){},remove(){}}, setAttribute(){}, querySelector(){return null}, querySelectorAll(){return []}, appendChild(){}, getBoundingClientRect(){return {top:0,height:60,width:10}}, addEventListener(){}, dataset:{}, focus(){}, scrollIntoView(){}, remove(){} });
const document = { addEventListener(){}, getElementById(){return null}, querySelector(){return null}, querySelectorAll(){return []}, createElement(){ const d=el(); Object.defineProperty(d,'innerHTML',{get(){return String(d.textContent).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')},set(){}}); return d; }, body:{dataset:{},appendChild(){}}, hidden:false };
const window = { document, matchMedia:()=>({matches:false}), addEventListener(){}, innerWidth:1200, innerHeight:800, scrollTo(){}, localStorage:{getItem(){return null},setItem(){}} };
window.window = window;
const ctx = vm.createContext({ window, document, console, setTimeout, clearTimeout, requestAnimationFrame:(f)=>setTimeout(f,16), cancelAnimationFrame:clearTimeout, performance, Promise, Symbol, URLSearchParams, Date, Math, Number, String, Array, Object, Set, Map, JSON, encodeURIComponent, localStorage: window.localStorage });
for (const f of ['assets/formation-donnees.js','assets/formation-quiz.js','supabase-formation.js']) vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
const F = window.Formation._calcul;
const M = F.mods();
const dire=(ok,msg,val)=>{ console.log(`  ${ok?'ok ':'⛔ '} ${msg}${val!==undefined?'  '+val:''}`); if(!ok) process.exitCode=1; };
dire(M.length===12,'12 modules composes',M.length);
const m1=M.find(m=>m.cle==='01');
dire(m1.lecons.length===8,'module 01 : 7 videos + 1 quiz',m1.lecons.length);
dire(m1.lecons[7].id==='m01-quiz' && m1.lecons[7].quiz===true,'le quiz est le DERNIER chapitre',m1.lecons[7].id);
dire(M.find(m=>m.cle==='00').lecons.length===1,'introduction : aucun chapitre fantome');
dire(M.find(m=>m.cle==='10').lecons.length===0,'certification : aucun chapitre fantome');
const m7b=M.find(m=>m.cle==='07bis'); dire(m7b.lecons[m7b.lecons.length-1].id==='m07bis-quiz','07bis : quiz m07bis-quiz', m7b.lecons.map(l=>l.id).join(','));
const parts = m1.lecons.map(l=>F.xpDe(l.id)); dire(parts.reduce((a,b)=>a+b,0)===100,'module 01 : 100 XP sur 8 chapitres, quiz compris',parts.join('+'));
dire(F.xpDe('m01-quiz')===12,'le quiz vaut sa part (12)',F.xpDe('m01-quiz'));
dire(F.xpDe('m09-quiz')===0,'bonus : le quiz vaut 0',F.xpDe('m09-quiz'));
dire(F.xpMaximum()===3150,'maximum inchange 3150',F.xpMaximum());
dire(F.quizOuvert(m1)===false,'quiz ferme tant que les videos ne sont pas vues');
dire(F.videosRestantes(m1)===7,'7 videos restantes',F.videosRestantes(m1));
dire(F.estVue('m01-quiz')===false,'quiz non reussi = non vu');
const c=F.conditionsNiveau(window.FormationDonnees.NIVEAUX_PARCOURS[1]);
const q=c.manquantes.find(x=>x.cle==='quiz');
dire(q && q.etat==='manquant' && /module 04/.test(q.texte),'condition quiz reelle : module 04, manquant',q&&q.texte);
dire(q && q.cible && q.cible.module==='04','la condition cible le quiz du 04',JSON.stringify(q&&q.cible));
const c2=F.conditionsNiveau(window.FormationDonnees.NIVEAUX_PARCOURS[2]);
dire(/module 06/.test(c2.manquantes.find(x=>x.cle==='quiz').texte),'niveau confirme : quiz du 06');
const c0=F.conditionsNiveau(); dire(c0.manquantes.find(x=>x.cle==='quiz').etat==='inconnu','sans niveau : inconnu (ferme)');
dire(F.seuilDe(m1.lecons[7])===12,'seuil 15 -> 12',F.seuilDe(m1.lecons[7]));
dire(F.seuilDe(M.find(m=>m.cle==='06').lecons.slice(-1)[0])===11,'seuil 13 -> 11');
dire(JSON.stringify(F.trouverLecon('m07-l10'))==='[8,1]','trouverLecon m07-l10 -> [8,1]',JSON.stringify(F.trouverLecon('m07-l10')));
dire(F.budgetChapitre()===2400 && F.budgetChapitre()<=F.BUDGET_CHAPITRE_MAX,'budget chapitre 2400 <= 3000',F.budgetChapitre());
dire(F.tempsLecture('abcdefghij')===2000,'tempsLecture 10 car = 2000');
// temoin : la composition ne touche pas la donnee
dire(window.FormationDonnees.MODULES.find(m=>m.cle==='01').lecons.length===7,'TEMOIN : FormationDonnees reste a 7 chapitres (donnee intacte)');
dire(window.FormationDonnees.total()===64,'TEMOIN : total() reste 64',window.FormationDonnees.total());
const b=F.badges(); dire(b.length===14,'14 badges',b.length);
