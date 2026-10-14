/**
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
const chaine = (data) => { const p = Promise.resolve({ data, error:null }); const o = { select(){return o}, eq(){return o}, order(){return o}, maybeSingle(){return Promise.resolve({data:null,error:null})}, upsert(){return Promise.resolve({error:null})}, insert(){return Promise.resolve({error:null})}, then: p.then.bind(p), catch: p.catch.bind(p) }; return o; };
const tables = { formation_progression: [{lecon_id:'m01-l0',vue:true,progress_seconds:0,secondes_vues:0,last_watched_at:'2026-10-14T10:00:00Z'},{lecon_id:'m01-l1',vue:false,progress_seconds:300,secondes_vues:432,last_watched_at:'2026-10-14T10:00:00Z'}], formation_notes: [], formation_videos: [{lecon_id:'m01-l1',vimeo_id:'123',hash:'abcdef0123',duree_s:540},{lecon_id:'m01-l3',vimeo_id:'124',hash:'abcdef0124',duree_s:960},{lecon_id:'m00-l0',vimeo_id:'9',hash:'0123456789',duree_s:769}], formation_quiz_resultats: [{module_cle:'01',score:12,total:15,reussi:true,created_at:'2026-10-14T09:00:00Z'},{module_cle:'02',score:13,total:15,reussi:true,created_at:'2026-10-14T10:00:00Z'}], user_preferences: [] , formation_parcours_vu: [] };
const supabaseClient = { auth:{ getUser: async()=>({data:{user:{id:'u1'}}}) }, from(t){ return chaine(tables[t] ?? []); } };
const window = { document, matchMedia:()=>({matches:false}), addEventListener(){}, innerWidth:1200, innerHeight:800, scrollTo(){}, localStorage:{getItem(){return null},setItem(){}}, supabaseClient };
window.window = window;
const ctx = vm.createContext({ window, document, console, setTimeout, clearTimeout, requestAnimationFrame:(f)=>setTimeout(f,16), cancelAnimationFrame:clearTimeout, performance, Promise, Symbol, URLSearchParams, Date, Math, Number, String, Array, Object, Set, Map, JSON, encodeURIComponent, localStorage: window.localStorage });
for (const f of ['assets/formation-donnees.js','assets/formation-quiz.js','supabase-formation.js']) vm.runInContext(fs.readFileSync(f,'utf8'), ctx, {filename:f});
const F = window.Formation;
await F.ouvrir();
const dire=(ok,msg,val)=>{ console.log(`  ${ok?'ok ':'⛔ '} ${msg}${val!==undefined?'  '+val:''}`); if(!ok) process.exitCode=1; };
const accueil = rendus.find(r=>r.id==='formation').html;
const sale = (h) => (h.match(/undefined|NaN|\[object|En attente|bientôt|à venir|s'affichera ici/g)||[]);
dire(sale(accueil).length===0,'accueil : aucun undefined/NaN/mention d attente',sale(accueil).join(','));
dire(/Prochaine étape : <b>Module 01 · Adopter/.test(accueil),'accueil : prochaine etape = chapitre 2 du module 01');
const carte = (cle) => { const i = accueil.indexOf(`data-carte-module="${cle}"`); return accueil.slice(accueil.lastIndexOf('<button', i), accueil.indexOf('</button>', i)); };
dire(!/locked/.test(carte('01')) && !/locked/.test(carte('02')) && !/locked/.test(carte('03')),'01, 02 (quiz 01 reussi), 03 (quiz 02 reussi) ouverts');
dire(/locked/.test(carte('04')) && /Après le quiz du module 03/.test(carte('04')),'04 verrouille : apres le quiz du module 03');
dire(/locked/.test(carte('05')) && /locked/.test(carte('06')) && /Niveau Intermédiaire/.test(carte('06')),'05 ET 06 verrouilles par le niveau');
dire(['07','07bis','08','09'].every(c=>/locked/.test(carte(c))),'07, 7 bis, 08, 09 verrouilles (niveau confirme, bonus compris)');
dire(/Niveau Confirmé/.test(carte('09')),'le bonus porte le cadenas de son niveau');
dire(/MODULE 02/.test(accueil) && />1 \/ 11 chapitres</.test(accueil),'carte module 02 : 1 / 11 chapitres (quiz reussi compte)', (accueil.match(/\d+ \/ 11 chapitres/)||[])[0]);
dire(/scroll|data-carte-module="02"/.test(accueil),'carte 02 a son ancre');
dire(['debutant','intermediaire','confirme'].every(n=>accueil.includes(`data-niveau="${n}"`)),'cartes groupees par niveau, trois titres');
dire(accueil.indexOf('data-niveau="debutant"') < accueil.indexOf('data-carte-module="01"') && accueil.indexOf('data-carte-module="04"') < accueil.indexOf('data-niveau="intermediaire"'),'01 a 04 sous Debutant, puis Intermediaire');
dire(/mod--cert/.test(accueil) && accueil.lastIndexOf('mod--cert') > accueil.lastIndexOf('data-carte-module="09"'),'la certification a sa carte a part, en dernier');
dire(/Les objectifs, la discipline, la routine\./.test(accueil) && !/Dans ce module, tu vas/.test(accueil),'les cartes portent le resume du site, pas la description LearnyBox');
dire(/mod--bonus/.test(carte('09')),'le bonus est marque');
const C2 = F._calcul;
dire(C2.pretAValider('m01-l1')===true && C2.secondesRequises('m01-l1')===432,'m01-l1 : 432 s vues sur 432 requises -> pret');
dire(C2.pretAValider('m01-l3')===false && C2.secondesRequises('m01-l3')===768,'m01-l3 : rien vu, 768 s requises -> pas pret');
dire(C2.pretAValider('m01-l2')===true,'m01-l2 : sans video connue, rien a exiger');
// module 01, chapitre 1 (video posee)
rendus.length=0; F.ouvrirLecon('m01-l1'); await new Promise(r=>setTimeout(r,40));
let h = rendus.find(r=>r.id==='formation').html;
dire(sale(h).length===0,'module 01 : propre',sale(h).join(','));
dire(/data-lire/.test(h),'chapitre avec video : bouton de lecture');
dire(h.indexOf('class="lesson-head"') < h.indexOf('class="lesson-desc"') && h.indexOf('class="lesson-desc"') < h.indexOf('class="screen"'),'titre, puis description, puis video, dans cet ordre');
dire(/lesson-desc">Dans ce chapitre, tu vas comprendre comment adopter/.test(h),'la description du chapitre est posee (CONTENU_CHAPITRES cable)');
dire(/chap done chap--quiz/.test(h) && /Réussi · 12 \/ 15 · \+12 XP/.test(h),'quiz 01 reussi dans la liste, 12/15, +12 XP');
dire(/class="mnav"/.test(h) && /Module 02/.test(h) && !/Module 00/.test(h),'navigation entre modules sans l Introduction');
dire(/Chapitre 2 sur 8/.test(h),'chapitre 2 sur 8');
// chapitre non regarde : bouton ferme, aide en clair
rendus.length=0; F.ouvrirLecon('m01-l3'); await new Promise(r=>setTimeout(r,40)); h = rendus.find(r=>r.id==='formation').html;
dire(/data-complete disabled/.test(h) && /Regarde la vidéo pour valider : 0 s sur 12 min\./.test(h),'m01-l3 : « Marquer comme terminé » desactive, aide « 0 s sur 12 min »');
rendus.length=0; F.ouvrirLecon('m01-l1'); await new Promise(r=>setTimeout(r,40)); h = rendus.find(r=>r.id==='formation').html;
dire(/data-complete >/.test(h) && !/data-complete disabled/.test(h) && /data-complete-aide hidden/.test(h),'m01-l1 : bouton ouvert, aide cachee');
// chapitre sans video
rendus.length=0; F.ouvrirLecon('m01-l2'); await new Promise(r=>setTimeout(r,40)); h = rendus.find(r=>r.id==='formation').html;
dire(/n’est pas rattachée/.test(h) && !/data-lire/.test(h),'chapitre sans video : cause dite, pas de bouton');
// le quiz du module 03 (verrouille, aucune video vue)
rendus.length=0; F.ouvrirLecon('m03-quiz'); await new Promise(r=>setTimeout(r,40)); h = rendus.find(r=>r.id==='formation').html;
dire(/quiz__verrou/.test(h) && /Il t’en reste <b>5<\/b>/.test(h),'quiz 03 : ecran verrouille, 5 restantes');
dire(/chap--quiz chap--verrou/.test(h) && /Après les 5 chapitres/.test(h),'quiz 03 verrouille dans la liste : apres les 5 chapitres');
// module 04 : verrouille par le quiz du 03
rendus.length=0; F.ouvrirModule('04'); await new Promise(r=>setTimeout(r,50));
dire(!rendus.some(r=>r.id==='formation' && /Module 04 · /.test(r.html)),'module 04 : pas rendu (quiz du 03 manquant)');
// m07-l4 : la note posee
rendus.length=0; F.ouvrirLecon('m01-l0'); await new Promise(r=>setTimeout(r,40));
dire(!/data-complete/.test(h) && !/formationNote/.test(h),'quiz : ni marquer termine ni notes');
dire(/Tous les modules/.test(h),'pager : le dernier chapitre propose Tous les modules');
// quiz du module 02 (reussi)
rendus.length=0; F.ouvrirLecon('m02-quiz'); await new Promise(r=>setTimeout(r,40)); h = rendus.find(r=>r.id==='formation').html;
dire(/quiz__fait/.test(h) && /13 \/ 15/.test(h),'quiz 02 : reussi 13 / 15');
dire(/Réussi · 13 \/ 15 · \+9 XP/.test(h),'liste : Reussi 13/15 +9 XP');
// module 05 : conditions avec quiz 04 manquant
rendus.length=0; F.ouvrirModule('05'); await new Promise(r=>setTimeout(r,50));
dire(rendus.length===0,'module 05 : pas rendu (verrou de niveau)');
console.log('  rendus', rendus.length);
