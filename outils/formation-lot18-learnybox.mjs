/**
 * Banc Node du lot 18, un ELEVE VENU DE LEARNYBOX (niveau confirme acquis) : tous
 * ses niveaux ouverts, sans ordre de quiz, l encart des quiz a valider sur
 * l accueil, et la certification qui attend les quiz.
 * (socle repris de formation-lot18-rendu.mjs)
 * Banc Node du lot 18, le RENDU : accueil, cartes et leurs verrous (niveau
 * entier, quiz du module precedent), page de module (titre puis description
 * puis video), quiz verrouille ou reussi. Doubles minimaux, qui rendent vide.
 * Usage : node outils/formation-lot18-rendu.mjs   (code 1 si un defaut)
 */
import vm from 'node:vm';
import fs from 'node:fs';
const rendus = [];
const el = (id) => { const o = { id, _html:'', textContent:'', style:{setProperty(){}}, classList:{add(){},remove(){}}, setAttribute(){}, querySelector(){return null}, querySelectorAll(){return []}, appendChild(){}, getBoundingClientRect(){return {top:0,height:60,width:10}}, addEventListener(){}, dataset:{}, focus(){}, scrollIntoView(){}, remove(){}, disabled:false };
  Object.defineProperty(o,'innerHTML',{get(){return o._html},set(v){o._html=v; rendus.push({id, html:v});}}); return o; };
const main = el('formation'); const chip=el('chipXp'); const lvl=el('chipLvl'); const chart=null;
const document = { addEventListener(){}, getElementById(id){ return id==='formation'?main: id==='chipXp'?chip: id==='chipLvl'?lvl : id==='formationApp'? el('formationApp') : null; }, querySelector(){return null}, querySelectorAll(){return []}, createElement(){ const d={textContent:'',style:{},classList:{add(){},remove(){}},setAttribute(){},appendChild(){},querySelector(){return null},querySelectorAll(){return []},addEventListener(){},remove(){},close(){},showModal(){}}; Object.defineProperty(d,'innerHTML',{get(){return String(d.textContent).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')},set(v){d._html=v}}); return d; }, body:{dataset:{},appendChild(){}}, hidden:false };
const appels = []; const chaine = (data) => { const p = Promise.resolve({ data, error:null }); const o = { select(){return o}, eq(){return o}, ilike(c,v){appels.push(['ilike',c,v]);return o}, limit(){return o}, order(){return o}, maybeSingle(){return Promise.resolve({data:null,error:null})}, upsert(){return Promise.resolve({error:null})}, insert(){return Promise.resolve({error:null})}, then: p.then.bind(p), catch: p.catch.bind(p) }; return o; };
const tables = { formation_progression: [], formation_notes: [], formation_videos: [{lecon_id:'m01-l1',vimeo_id:'123',hash:'abcdef0123',duree_s:540},{lecon_id:'m00-l0',vimeo_id:'9',hash:'0123456789',duree_s:769}], formation_quiz_resultats: [{module_cle:'03',score:12,total:12,reussi:true,created_at:'2026-10-14T09:00:00Z'}], formation_niveau_learnybox: [{niveau:'confirme',progression_pct:72,groupes:'Débutants, Intermédiaire, Confirmé'}], user_preferences: [] , formation_parcours_vu: [] };
const supabaseClient = { auth:{ getUser: async()=>({data:{user:{id:'u1', email:'Eleve@Exemple.fr'}}}) }, from(t){ return chaine(tables[t] ?? []); } };
const window = { document, matchMedia:()=>({matches:false}), addEventListener(){}, innerWidth:1200, innerHeight:800, scrollTo(){}, localStorage:{getItem(){return null},setItem(){}}, supabaseClient };
window.window = window;
const ctx = vm.createContext({ window, document, console, setTimeout, clearTimeout, requestAnimationFrame:(f)=>setTimeout(f,16), cancelAnimationFrame:clearTimeout, performance, Promise, Symbol, URLSearchParams, Date, Math, Number, String, Array, Object, Set, Map, JSON, encodeURIComponent, localStorage: window.localStorage });
for (const f of ['assets/formation-donnees.js','assets/formation-quiz.js','supabase-formation.js']) vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
const F = window.Formation; const C = F._calcul;
const dire=(ok,msg,val)=>{ console.log(`  ${ok?'ok ':'⛔ '} ${msg}${val!==undefined?'  '+val:''}`); if(!ok) process.exitCode=1; };
await F.ouvrir();
dire(appels.some(a=>a[0]==='ilike' && a[1]==='email' && a[2]==='Eleve@Exemple.fr'),'la ligne LearnyBox est lue par l email de la session (ilike)',JSON.stringify(appels[0]));
dire(C.lb() && C.lb().niveau==='confirme','niveau LearnyBox lu : confirme');
const M = C.mods();
const ouverts = M.filter(m=>!m.introduction).map(m=>[m.cle, C.etatModule(m).ouvrable, C.etatModule(m).cause]);
dire(ouverts.filter(([c])=>c!=='10').every(([,o])=>o),'01 a 09 ouverts, bonus compris, sans ordre de quiz',JSON.stringify(ouverts));
dire(!C.etatModule(M.find(m=>m.cle==='10')).ouvrable && C.etatModule(M.find(m=>m.cle==='10')).cause==='certification','la certification attend que tout soit fini');
const manq = C.quizManquantsAvant(null).map(m=>m.cle);
dire(JSON.stringify(manq)==='["01","02","04","05","06","07","07bis","08"]','quiz manquants : tous sauf 03 (reussi) et le bonus',JSON.stringify(manq));
const accueil = rendus.find(r=>r.id==='formation').html;
dire(/data-lb-encart/.test(accueil) && /Niveau Confirmé · acquis/.test(accueil),'accueil : l encart LearnyBox, niveau Confirmé acquis');
dire(/obtenir ta certification/.test(accueil),'encart : pour obtenir ta certification (dernier niveau)');
dire((accueil.match(/lb-encart__btn/g)||[]).length===8,'encart : 8 boutons vers les quiz',(accueil.match(/lb-encart__btn/g)||[]).length);
dire(!/locked/.test(accueil.slice(accueil.indexOf('data-carte-module="08"')-400, accueil.indexOf('data-carte-module="08"'))),'carte 08 sans cadenas');
dire(!/Après le quiz du module/.test(accueil),'aucune carte « Après le quiz du module »');
// sans ligne LearnyBox : rien ne change pour un nouvel eleve
tables.formation_niveau_learnybox = [];
rendus.length=0; await F.ouvrir();
const a2 = rendus.find(r=>r.id==='formation').html;
// 16/10 : la pastille « Après le quiz du module » est remplacee par un cadenas a cote du
// numero ; la raison reste en pied de carte. On teste le verrou, plus le libelle disparu.
const carteDe = (h, cle) => { const i = h.indexOf(`data-carte-module="${cle}"`); return i < 0 ? '' : h.slice(h.lastIndexOf('<button', i), h.indexOf('</button>', i)); };
dire(!/data-lb-encart/.test(a2) && /locked/.test(carteDe(a2,'02')) && /num__cadenas/.test(carteDe(a2,'02')) && /Réussis le quiz du module 01/.test(carteDe(a2,'02')),'TEMOIN : sans ligne LearnyBox, pas d encart et le 02 attend le quiz du 01 (cadenas)');
dire(/locked/.test(carteDe(a2,'05')) && /num__cadenas/.test(carteDe(a2,'05')),'TEMOIN : et le niveau intermediaire est ferme (05 sous cadenas)');
// le quiz d un module acquis s ouvre sans revoir les videos
tables.formation_niveau_learnybox = [{niveau:'intermediaire',progression_pct:50,groupes:'Débutants, Intermédiaire'}];
rendus.length=0; await F.ouvrir();
dire(C.quizOuvert(M.find(m=>m.cle==='05')) && C.videosRestantes(M.find(m=>m.cle==='05'))===12,'intermediaire : le quiz du 05 est ouvert, 12 videos non vues');
dire(!C.quizOuvert(M.find(m=>m.cle==='07')),'TEMOIN : le quiz du 07 (confirme, non acquis) reste ferme');
rendus.length=0; F.ouvrirLecon('m05-quiz'); await new Promise(r=>setTimeout(r,40));
const h = rendus.find(r=>r.id==='formation').html;
dire(/quiz__entree/.test(h) && !/quiz__verrou/.test(h),'page du quiz 05 : ecran d entree, pas de verrou');
const a3 = (rendus.length=0, await F.ouvrir(), rendus.find(r=>r.id==='formation').html);
dire(/passer au niveau Confirmé/.test(a3) && (a3.match(/lb-encart__btn/g)||[]).length===5,'intermediaire : encart « passer au niveau Confirmé », 5 quiz (01, 02, 04, 05, 06)');
dire(/locked/.test(carteDe(a3,'07')) && /num__cadenas/.test(carteDe(a3,'07')),'intermediaire : le 07 reste ferme (niveau confirme, cadenas)');
// ── 15/10 : le niveau de l eleve et les XP par module, a la place des paliers ──
dire(C.niveauCourant().cle==='intermediaire','niveauCourant : intermediaire (acquis LearnyBox)',C.niveauCourant().cle);
dire(/Ton niveau/.test(a3) && /class="big">Intermédiaire</.test(a3),'accueil : « Ton niveau » puis Intermédiaire',(a3.match(/class="big">[^<]*/)||[])[0]);
dire(!/Prochain palier/.test(a3) && /XP par module/.test(a3),'accueil : plus de palier, « XP par module »');
dire((a3.match(/xpm__ligne/g)||[]).length===9,'9 lignes d XP : 01 a 08 et 7 bis (ni intro, ni bonus, ni certification sans chapitre)',(a3.match(/xpm__ligne/g)||[]).length);
dire(!/xpm__nom">Certification</.test(a3) && !/xpm__nom">Module 09</.test(a3),'ni la certification (sans chapitre, 0 XP) ni le bonus');
const x05 = C.xpDuModule(M.find(m=>m.cle==='05'));
dire(x05.max===350 && x05.gagne===0,'xpDuModule 05 : 0 / 350 (100 chapitres + 250 de prime)',JSON.stringify(x05));
dire(C.xpDuModule(M.find(m=>m.cle==='10')).max===0,'certification sans chapitre : 0, comme xpMaximum (le jour ou elle en aura, 1100)',C.xpDuModule(M.find(m=>m.cle==='10')).max);
dire(C.xpDuModule(M.find(m=>m.cle==='05')).max + 8*0 > 0 && M.filter(m=>C.xpDuModule(m).max>0).reduce((t,m)=>t+C.xpDuModule(m).max,0)===C.xpMaximum(),'TEMOIN : la somme des max par module VAUT xpMaximum');
dire(C.xpDuModule(M.find(m=>m.cle==='09')).max===0,'TEMOIN : le bonus vaut zero');
tables.formation_niveau_learnybox = [];
rendus.length=0; await F.ouvrir();
dire(C.niveauCourant().cle==='debutant','TEMOIN : sans LearnyBox ni quiz, niveauCourant = debutant',C.niveauCourant().cle);
dire(/class="big">Débutant</.test(rendus.find(r=>r.id==='formation').html),'accueil : Débutant');
dire(lvl.textContent==='Débutant','la pastille du haut dit Débutant',lvl.textContent);
