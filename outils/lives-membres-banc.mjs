// Banc : les lives membres (29/10/2026). Lecture statique du câblage (espace membre,
// back-office, page OBS, migration) + exécution de la vraie fonction `youtubeId`.
// Chaque sonde a son témoin : appliquée à une version altérée, elle DOIT échouer.
// ⚠️ Le comportement des fonctions SQL s'éprouve sur la vraie base : outils/lives-membres-banc.sql.
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const racine = new URL('..', import.meta.url).pathname;
const lire = (f) => readFileSync(racine + f, 'utf8');
const F = {
  index: lire('index.html'), formation: lire('supabase-formation.js'), live: lire('assets/formation-live.js'), liveCss: lire('assets/formation-live.css'),
  bo: lire('back-office.html'), boJs: lire('assets/back-office.js'), regie: lire('assets/back-office-lives.js'), regieCss: lire('assets/back-office-lives.css'),
  obs: lire('live-obs.html'), sql: lire('migrations/06-lives-membres.sql'),
};
// Le code sans ses commentaires : un commentaire qui NOMME un piège n'est pas le piège.
const sansCommentaires = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
let ok = 0, ko = 0;
const verif = (nom, cond) => { if (cond) ok++; else { ko++; console.log('ÉCHEC', nom); } };

function sondes(f) {
  const r = [];
  // Espace membre
  r.push(['script formation-live chargé après supabase-formation', /supabase-formation\.js"><\/script>\s*<script src="\/assets\/formation-live\.js"><\/script>/.test(f.index)]);
  r.push(['feuille formation-live chargée', /href="\/assets\/formation-live\.css"/.test(f.index)]);
  const nav = (() => { const i = f.index.indexOf('<nav class="nav"'); return i < 0 ? '' : f.index.slice(i, f.index.indexOf('</nav>', i)); })();
  r.push(['bouton Live dans la barre', /data-go="live"/.test(nav)]);
  r.push(['entrée Live sur mobile', /class="[^"]*formation-live-mobile[^"]*" data-go="live"/.test(f.index)]);
  r.push(['aller(live) ouvre la salle', /if \(id === 'live'\) \{[\s\S]*?_vueCourante = \{ nom: 'live' \};[\s\S]*?FormationLive\.ouvrir\(\)/.test(f.formation)]);
  r.push(['quitter ferme la salle', /quitter\(\) \{[^}]*FormationLive\.fermer\(\)/.test(f.formation)]);
  r.push(['la veille démarre à l’ouverture', /FormationLive\.demarrerVeille\(\)/.test(f.formation)]);
  // ⛔ Aucune lecture de table en direct : tout passe par les fonctions live_*.
  r.push(['membre : rpc seulement, aucun .from()', /\.rpc\(nom/.test(f.live) && !/\.from\(/.test(f.live)]);
  r.push(['régie : rpc seulement, aucun .from()', /\.rpc\(nom/.test(f.regie) && !/\.from\(/.test(f.regie)]);
  r.push(['client = window.supabaseClient', [f.live, f.regie].every((x) => /window\.supabaseClient/.test(sansCommentaires(x)) && !/window\.supabase\b/.test(sansCommentaires(x)))]);
  r.push(['rpc teste error', /if \(error\) throw/.test(f.live) && /if \(error\) throw/.test(f.regie)]);
  // ⛔ Texte des membres jamais en innerHTML : la salle n'en pose qu'une, statique.
  r.push(['salle : un seul innerHTML, statique', (f.live.match(/innerHTML/g) || []).length === 1 && /innerHTML = '<section class="live"><p class="live__charge">Chargement du live…<\/p><\/section>'/.test(f.live)]);
  r.push(['régie : texte des messages en textContent', /el\('p', '', m\.texte\)/.test(f.regie) && !/\$\{m\.texte\}/.test(f.regie)]);
  r.push(['YouTube en nocookie, aucun lien youtube.com/watch', /youtube-nocookie\.com\/embed/.test(f.live) && !/youtube\.com\/watch/.test(f.live)]);
  r.push(['écran de fin par classe, vidéo vidée', /fin\.classList\.toggle\('on'/.test(f.live) && /iframe\.src = 'about:blank'/.test(f.live) && /\.live__fin\{[^}]*display:none/.test(f.liveCss) && /\.live__fin\.on\{display:flex/.test(f.liveCss)]);
  r.push(['« Ta caméra » posée une fois (hors bloc parole)', /chat\.append\(tete, epingle, sondage, liste, parole, maCam, form\)/.test(f.live)]);
  // Back-office
  r.push(['nav back-office', /href="#\/academie\/lives" data-nav="academie\/lives"/.test(f.bo)]);
  r.push(['écran back-office', /data-ecran="academie\/lives"[\s\S]*?id="boLives"/.test(f.bo)]);
  r.push(['script et feuille régie', /back-office-lives\.js" defer/.test(f.bo) && /back-office-lives\.css/.test(f.bo)]);
  r.push(['routeur : fil + chargeur', /'academie\/lives': 'Académie · Lives membres'/.test(f.boJs) && /CHARGEURS\['academie\/lives'\]/.test(f.boJs)]);
  r.push(['« Terminer le live » confirmé', /window\.confirm\('Terminer le live/.test(f.regie)]);
  r.push(['scène de coach flottante, hors de l’écran (survit à la navigation)', /document\.body\.append\(SC\.el\)/.test(f.regie) && !/target="_blank"[^>]*data-role/.test(f.regie) && !/clearInterval\(SC\.battement\)[^\n]*\n[^\n]*R = null/.test(f.regie)]);
  r.push(['flux des coachs venus du serveur, jamais déduits', /\['push', v\.animateur\]/.test(f.regie) && /\['push', v\.coanimateur\]/.test(f.regie) && !/\$\{v\.room\}(a0|c1)/.test(f.regie)]);
  r.push(['flux invité avec jeton aléatoire (base)', /live_flux_invite\(p_live, p\.place, p\.jeton\)/.test(f.sql) && /add column if not exists jeton uuid/.test(f.sql)]);
  r.push(['salle : génération contre les ouvertures concurrentes', /const gen = \+\+_generation;/.test(f.live) && /if \(gen !== _generation/.test(f.live)]);
  r.push(['salle : caméra accordée trop tard coupée', /if \(S !== moi \|\| moi\.surScene !== lien\) \{ m\.getTracks\(\)\.forEach\(\(tr\) => tr\.stop\(\)\); return; \}/.test(f.live)]);
  r.push(['salle : pas de reconstruction quand la vidéo arrive', !/if \(S === moi\) ouvrir\(\); \}, 60000\)/.test(f.live) && /cadre\.prepend\(iframe\)/.test(f.live)]);
  // OBS
  r.push(['page OBS : live_obs seulement', /rpc\('live_obs'/.test(f.obs) && !/live_(salle|regie|commande|ecrire)/.test(f.obs)]);
  r.push(['page OBS transparente, textContent', /background: transparent/.test(f.obs) && /p\.textContent = x\.texte/.test(f.obs) && !/innerHTML/.test(f.obs)]);
  // Migration
  const tables = ['lives', 'live_messages', 'live_parole', 'live_sondages', 'live_votes', 'live_presences', 'live_reglages'];
  r.push(['RLS sur les 7 tables', tables.every((t) => new RegExp(`alter table public\\.${t}\\s+enable row level security`).test(f.sql))]);
  r.push(['aucune politique (tout passe par les fonctions)', !/create policy/i.test(f.sql)]);
  r.push(['anon : live_obs seulement', /grant execute on function public\.live_obs\(text, text\) to anon, authenticated;/.test(f.sql) && !/live_(courant|salle|ecrire|regie|commande)\([^)]*\)[^;]*to anon/.test(f.sql)]);
  r.push(['barrières : formation et coach', (f.sql.match(/a_acces_formation\(\)/g) || []).length >= 5 && /perform public\.live_exiger_coach\(\);/.test(f.sql)]);
  // Charte : ni vert ni rouge dans les nouvelles feuilles ; easing unique.
  const css = f.liveCss + f.regieCss;
  r.push(['ni vert ni rouge', !/#10b981|#ef4444|var\(--ok\)|var\(--non\)/i.test(css)]);
  r.push(['easing unique', !/\b(ease-in-out|ease-in|ease-out)\b|\blinear\b(?!-gradient)|transition:[^;]*\bease\b/.test(css)]);
  return r;
}
for (const [n, c] of sondes(F)) verif(n, c);

// Témoins : chaque altération doit faire échouer au moins une sonde.
const alt = (cle, a, b) => { const g = { ...F }; g[cle] = F[cle].replace(a, b); return g; };
const temoins = {
  'bouton Live retiré': alt('index', '<button type="button" data-go="live">Live</button>', ''),
  'lecture de table en direct': alt('live', "const { data, error } = await c.rpc(nom, args || {});", "const { data, error } = await c.from('live_messages').select();"),
  'message en innerHTML': alt('live', "const p = el('p'); texteEn(p, m.texte, m.coach);", "const p = el('p'); p.innerHTML = m.texte;"),
  'écran de fin par hidden': alt('liveCss', '#formationApp .live__fin.on{display:flex', '#formationApp .live__fin[hidden]{display:flex'),
  'politique ajoutée': alt('sql', 'alter table public.lives          enable row level security;', "alter table public.lives enable row level security; create policy x on public.lives for select using (true);"),
  'rouge dans la régie': alt('regieCss', '.bo-live-manque { color: var(--gold);', '.bo-live-manque { color: #ef4444;'),
  'window.supabase nu': alt('regie', "const c = window.supabaseClient;", "const c = window.supabase;"),
  'easing étranger': alt('liveCss', 'transition:border-color .2s cubic-bezier(0.16,1,0.3,1)}', 'transition:border-color .2s ease-in-out}'),
  'flux coach déduit dans le navigateur': alt('regie', "['push', v.coanimateur]", "['push', `${v.room}c1`]"),
  'génération retirée': alt('live', 'if (gen !== _generation || !document.contains(f)) return;', ''),
  'confirmation retirée': alt('regie', "window.confirm('Terminer le live", "true || ('Terminer le live"),
};
for (const [n, g] of Object.entries(temoins)) {
  if (Object.keys(g).every((k) => g[k] === F[k])) { ko++; console.log('TÉMOIN INOPÉRANT', n); continue; }
  verif('témoin ' + n, sondes(g).some(([, c]) => !c));
}

// La vraie fonction youtubeId, exécutée.
const ctx = { window: { addEventListener() {} }, document: {}, location: { hash: '' }, URL, URLSearchParams, console };
vm.createContext(ctx); vm.runInContext(F.regie, ctx);
const yt = ctx.window.LivesRegie.youtubeId;
const cas = [
  ['https://youtube.com/live/AbCdEfGh123?si=x', 'AbCdEfGh123'], ['https://www.youtube.com/watch?v=AbCdEfGh123&t=3', 'AbCdEfGh123'],
  ['youtu.be/AbCdEfGh123', 'AbCdEfGh123'], ['https://m.youtube.com/live/AbCdEfGh123', 'AbCdEfGh123'], ['AbCdEfGh123', 'AbCdEfGh123'],
  ['', ''], ['https://vimeo.com/123', null], ['n’importe quoi', null],
];
for (const [e, s] of cas) verif(`youtubeId(${e || 'vide'}) = ${s}`, yt(e) === s);
verif('témoin youtubeId : un mauvais attendu échoue', yt('https://vimeo.com/123') !== 'AbCdEfGh123');

const esc = ctx.window.LivesRegie._txt;
verif('txt échappe les guillemets (attribut value)', esc('Revue "NFP" <b>') === 'Revue &quot;NFP&quot; &lt;b&gt;');
verif('témoin txt : sans guillemets échappés, la sonde échoue', 'Revue "NFP"' !== esc('Revue "NFP"'));

console.log(ko ? `\n⛔ ${ko} échec(s), ${ok} réussite(s)` : `\n✅ ${ok} contrôles verts`);
process.exitCode = ko ? 1 : 0;
