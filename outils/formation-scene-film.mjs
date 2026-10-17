/**
 * ⛔ FILMER LA SCENE, EN 390 ET EN 1440, POUR QU ELLE SE REGARDE SANS LA REJOUER.
 *
 * ── ⚠️ POURQUOI UNE CAPTURE NE SUFFIT PAS ──────────────────────────────────
 *
 * Une image fixe d une animation ne montre ni l arc du jeton, ni la montee de
 * lumiere, ni le decalage du texte. ⛔ Et c est precisement ce qui se juge
 * dans ce lot : « il faut qu on aille très, très loin dans le design ». Une
 * capture du resultat final ressemblerait exactement a un pop-up.
 *
 * ── ⛔ COMMENT, SANS FFMPEG ────────────────────────────────────────────────
 *
 * `page.screencast()` de puppeteer exige un binaire ffmpeg, absent de cette
 * machine. ⚠️ On passe donc par le protocole de Chrome directement,
 * `Page.startScreencast`, qui livre des images JPEG horodatees des que la page
 * change , c est-a-dire exactement aux trames qui bougent.
 *
 * ⛔ ET LA SORTIE N EST PAS UNE VIDEO, C EST UNE PAGE. Les trames sont
 * embarquees dans un lecteur autonome : lecture, pause, vitesse, et une
 * reglette pour s arreter sur le temps fort. ⚠️ Un fichier video demanderait un
 * encodeur ; une page s ouvre partout et se partage par un lien.
 *
 * Usage : node outils/formation-scene-film.mjs [port]
 */
import { mkdirSync, writeFileSync } from 'node:fs';

const CHEMIN = '/Users/nadirkasmi/Projets/trader360-site/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const { default: puppeteer } = await import(CHEMIN);
const PORT = process.argv[2] ?? '4417';
const SORTIE = 'captures/formation-scene';
mkdirSync(SORTIE, { recursive: true });

const nav = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check'],
});

/** Le meme double que la sonde. ⛔ Un second double divergerait du premier. */
function poserDouble(base) {
  window.__base = JSON.parse(JSON.stringify(base));
  window.__ecritures = [];
  const faire = () => {
    const t = (nom) => {
      const b = {
        select() { return b; }, not() { return b; },
        in: () => Promise.resolve({ data: [], error: null }),
        order: () => Promise.resolve({ data: [], error: null }),
        eq() {
          const liste = { data: nom === 'formation_progression' ? window.__base.progression
            : nom === 'formation_notes' ? window.__base.notes : [], error: null };
          const un = nom === 'formation_parcours_vu'
            ? { data: window.__base.parcoursVu, error: null }
            : { data: window.__base.droits, error: null };
          return { maybeSingle: () => Promise.resolve(un), single: () => Promise.resolve(un),
            then: (ok, ko) => Promise.resolve(liste).then(ok, ko) };
        },
        update() { return { eq: () => Promise.resolve({ error: null }) }; },
        upsert(ligne) {
          window.__ecritures.push({ table: nom, ligne });
          const cible = nom === 'formation_notes' ? window.__base.notes
            : nom === 'formation_progression' ? window.__base.progression : null;
          if (cible) {
            const i = cible.findIndex((x) => x.lecon_id === ligne.lecon_id);
            if (i >= 0) Object.assign(cible[i], ligne); else cible.push({ ...ligne });
          } else if (nom === 'formation_parcours_vu') window.__base.parcoursVu = { ...ligne };
          return Promise.resolve({ error: null });
        },
      };
      return b;
    };
    window.supabaseClient = { from: t, auth: {
      getUser: async () => ({ data: { user: { id: 'eleve-film' } } }),
      getSession: async () => ({ data: { session: { user: { id: 'eleve-film' }, access_token: 'j' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
  };
  faire();
  window.addEventListener('load', faire);
  window.currentUser = { role: 'student', uuid: 'eleve-film' };
}

const vus = ['m01-l0', 'm01-l1', 'm01-l2', 'm01-l3', 'm01-l4', 'm01-l5', 'm01-l6',
  'm02-l0', 'm02-l1', 'm02-l2', 'm02-l3', 'm02-l4', 'm02-l5', 'm02-l6', 'm02-l7', 'm02-l8', 'm02-l9',
  'm03-l0', 'm03-l1', 'm03-l2', 'm03-l3']
  .map((id) => ({ lecon_id: id, vue: true, progress_seconds: 0, last_watched_at: '2026-10-13T09:00:00Z' }));

/**
 * Filme une scene.
 * @param {object} o largeur, hauteur, module, progression, nom
 * @return {Promise<{trames:Array, largeur:number, hauteur:number}>}
 */
async function filmer(o) {
  const ctx = await nav.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: o.largeur, height: o.hauteur });
  await p.evaluateOnNewDocument(poserDouble, {
    droits: { formation_actif: true, journal_actif: false },
    notes: [], progression: o.progression || [],
    // ⚠️ La fenetre de bienvenue n a rien a faire dans ce film : on la marque
    // vue. ⛔ Sinon elle couvrirait la scene qu on veut montrer.
    parcoursVu: { user_id: 'eleve-film', vue_le: '2026-10-11T17:25:12Z' },
  });
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await p.evaluate(() => window.Acces.orienter());
  await new Promise((r) => setTimeout(r, 900));

  // On entre dans le module et on se place sur le chapitre a terminer.
  await p.evaluate(async (cle) => {
    document.querySelector(`#formationApp .mod[data-carte-module="${cle}"]`).click();
    await new Promise((res) => setTimeout(res, 450));
    const k = [...document.querySelectorAll('#formationApp .chap')]
      .findIndex((c) => !c.classList.contains('done'));
    if (k > 0) {
      document.querySelectorAll('#formationApp .chap')[k].click();
      await new Promise((res) => setTimeout(res, 400));
    }
  }, o.module);
  await new Promise((r) => setTimeout(r, 400));

  const cdp = await p.createCDPSession();
  const trames = [];
  const t0 = Date.now();
  /**
   * ── ⛔ ON ECLAIRCIT LES TRAMES, ET LE CHIFFRE N EST PAS UN GOUT ──────────
   *
   * ⚠️ MESURE AU PREMIER TOURNAGE : 819 trames, 31 Mo de page. ⛔ Au-dela de
   * 16 Mo, le lien ne porte pas la page : elle serait injouable, donc inutile.
   *
   * ⛔ ON PLAFONNE DONC A 22 IMAGES PAR SECONDE. ⚠️ C est au-dessus du seuil
   * ou l oeil voit des saccades sur un mouvement d interface, et le lecteur
   * respecte les horodatages REELS : une trame sautee n accelere pas la scene,
   * elle la rend juste un peu moins lisse. ⛔ Et la duree affichee reste la
   * vraie duree, ce qui compte pour juger le rythme.
   */
  const ECART_MIN = 45;
  let dernier = -999;
  cdp.on('Page.screencastFrame', async (f) => {
    const t = Date.now() - t0;
    if (t - dernier >= ECART_MIN) { trames.push({ t, img: f.data }); dernier = t; }
    try { await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }); }
    catch { /* la session peut etre deja fermee */ }
  });
  /**
   * ⚠️ `maxWidth` BORNE LE POIDS, et c est ce qui rend le lecteur partageable :
   * ⛔ 1440 px de large en qualite pleine donnerait une page de dizaines de
   * megaoctets, qu aucun lien ne porterait.
   */
  await cdp.send('Page.startScreencast', {
    format: 'jpeg', quality: 46, maxWidth: Math.min(o.largeur, 540), everyNthFrame: 1,
  });
  // ⚠️ Une demi-seconde AVANT le clic : on doit voir l etat de depart.
  await new Promise((r) => setTimeout(r, 500));
  await p.evaluate(() => document.querySelector('#formationApp [data-complete]').click());
  await new Promise((r) => setTimeout(r, o.duree));
  await cdp.send('Page.stopScreencast');
  await new Promise((r) => setTimeout(r, 150));
  await ctx.close();
  console.log(`  ${o.nom.padEnd(34)} ${String(trames.length).padStart(3)} trames  `
    + `${Math.round(trames.reduce((a, f) => a + f.img.length, 0) / 1365)} Ko`);
  return { nom: o.nom, legende: o.legende, trames, largeur: o.largeur, hauteur: o.hauteur };
}

console.log('\n  ══ TOURNAGE ══');
const films = [];
// ⛔ LA SCENE DE CHAPITRE : quatre temps, sur un chapitre qui n acheve rien.
films.push(await filmer({ nom: 'Fin de chapitre · 1440',
  legende: 'Quatre temps : le chapitre se marque, les XP partent du chapitre et rejoignent le compteur, le rail gagne un cran.',
  largeur: 1440, hauteur: 900, module: '01', progression: [], duree: 2600 }));
films.push(await filmer({ nom: 'Fin de chapitre · 390',
  legende: 'La même scène en 390 px : le jeton vole plus court, le compteur est au-dessus.',
  largeur: 390, hauteur: 844, module: '01', progression: [], duree: 2600 }));
// ⛔ LA SCENE DE MODULE, AVEC LE CUMUL : les XP du chapitre, les 250 du module,
// et un palier franchi. ⚠️ C est le cas a eprouver, pas le cas simple.
films.push(await filmer({ nom: 'Fin de module · cumul · 1440',
  legende: 'Neuf temps, et le cumul : les XP du chapitre, les 250 du module, et un palier franchi. Le badge sort du rail du module, s’éclaire en doré, puis va se poser dans la collection.',
  largeur: 1440, hauteur: 900, module: '03', progression: vus, duree: 6200 }));
films.push(await filmer({ nom: 'Fin de module · cumul · 390',
  legende: 'La même scène complète en 390 px.',
  largeur: 390, hauteur: 844, module: '03', progression: vus, duree: 6200 }));

/* ══ LE LECTEUR ═══════════════════════════════════════════════════════════ */
const html = `<title>La scène, filmée</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;700&display=swap">
<style>
  /* ⛔ LES JETONS SONT CEUX DE L ESPACE FORMATION, pas une palette neuve.
     ⚠️ Cette page montre cet espace : lui donner d autres couleurs rendrait le
     rendu filme difficile a juger, puisque le cadre mentirait sur le sujet.
     ⛔ Elle assume donc UN SEUL monde, sombre, comme l espace qu elle filme, et
     peint explicitement son fond pour ne rien emprunter a son hote. */
  :root{
    --bg:#050506; --surface:#0f1116; --surface-2:#161a20; --line:#1e2128;
    --ink:#f7f6f3; --ink-soft:#a6a6a1; --ink-mute:#7b7b74;
    --gold:#e8b84b; --gold-2:#f3d585; --gold-deep:#b98a2e; --on-gold:#120e07;
    --f-ui:"Inter",-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,sans-serif;
    --f-mono:"JetBrains Mono","SF Mono",ui-monospace,monospace;
  }
  *{box-sizing:border-box}
  body{margin:0;background:var(--bg);color:var(--ink);font-family:var(--f-ui);
    font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
  .wrap{max-width:980px;margin:0 auto;padding:clamp(32px,6vw,64px) 20px 80px;
    display:flex;flex-direction:column;gap:28px}
  .sur{font-size:11.5px;font-weight:700;letter-spacing:.28em;text-transform:uppercase;
    color:var(--gold);margin:0}
  h1{font-size:clamp(34px,6.4vw,62px);font-weight:800;letter-spacing:-.035em;
    line-height:.98;margin:0;text-wrap:balance}
  h1 em{font-style:normal;background:linear-gradient(180deg,var(--gold-2),var(--gold));
    -webkit-background-clip:text;background-clip:text;color:transparent}
  .lead{color:var(--ink-soft);max-width:62ch;margin:0;font-size:17px}
  .entete{display:flex;flex-direction:column;gap:12px}
  .films{display:flex;flex-direction:column;gap:22px}
  .film{background:var(--surface);border:1px solid var(--line);border-radius:18px;
    padding:20px;display:flex;flex-direction:column;gap:14px}
  .film header{display:flex;flex-direction:column;gap:4px}
  .film h2{font-size:18.5px;font-weight:700;margin:0;letter-spacing:-.012em}
  .film h2 small{font-family:var(--f-mono);font-size:11.5px;font-weight:400;
    color:var(--ink-mute);letter-spacing:.08em;margin-left:9px}
  .film p{margin:0;font-size:14px;color:var(--ink-soft);max-width:72ch}
  .ecran{background:#000;border:1px solid var(--line);border-radius:12px;
    overflow:hidden;display:grid;place-items:center;min-height:140px}
  .ecran img{display:block;max-width:100%;height:auto}
  .cmd{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
  button{font:inherit;font-size:14px;font-weight:600;cursor:pointer;border:0;
    border-radius:40px;padding:9px 20px;color:var(--on-gold);
    background:linear-gradient(180deg,var(--gold-2),var(--gold));
    box-shadow:0 8px 26px -10px rgba(232,184,75,.5);min-width:104px}
  button.ghost{background:var(--surface-2);color:var(--ink);border:1px solid var(--line);
    box-shadow:none;min-width:72px;font-family:var(--f-mono);font-size:13px}
  button:focus-visible,input:focus-visible{outline:2px solid var(--gold);outline-offset:3px}
  input[type=range]{flex:1;min-width:150px;accent-color:var(--gold);height:22px}
  .t{font-family:var(--f-mono);font-size:12.5px;color:var(--ink-mute);
    font-variant-numeric:tabular-nums;white-space:nowrap;min-width:72px;text-align:right}
  .note{border-left:2px solid var(--gold-deep);padding-left:16px;color:var(--ink-mute);
    font-size:13.5px;max-width:70ch}
  @media (prefers-reduced-motion:reduce){button{transition:none}}
</style>
<div class="wrap">
  <header class="entete">
    <p class="sur">Espace formation · lot 16</p>
    <h1>La scène,<br><em>filmée.</em></h1>
    <p class="lead">Quatre enregistrements pris dans un vrai navigateur, sur le vrai rendu,
      avec de vrais clics. La réglette s’arrête où tu veux : le temps fort est l’éclairage
      du badge, vers le milieu des deux films de module.</p>
  </header>
  <div class="films">
  ${films.map((f, i) => `
    <section class="film">
      <header>
        <h2>${f.nom}<small>${f.trames.length} trames · ${(f.trames[f.trames.length - 1].t / 1000).toFixed(1)} s</small></h2>
        <p>${f.legende}</p>
      </header>
      <div class="ecran"><img id="v${i}" alt="${f.nom}"></div>
      <div class="cmd">
        <button data-play="${i}">Lecture</button>
        <button class="ghost" data-vit="${i}">× 1</button>
        <input type="range" id="r${i}" min="0" max="${f.trames.length - 1}" value="0"
          aria-label="Position dans ${f.nom}">
        <span class="t" id="t${i}">0 ms</span>
      </div>
    </section>`).join('')}
  </div>
  <p class="note">Les durées affichées sont les vraies : les trames sont plafonnées à
    22 par seconde pour que la page reste partageable, mais le lecteur respecte les
    horodatages d’origine. Le son part au moment où le badge s’éclaire : il n’est pas
    dans l’enregistrement.</p>
</div>
<script>
const FILMS = ${JSON.stringify(films.map((f) => ({ trames: f.trames })))};
FILMS.forEach((f, i) => {
  const img = document.getElementById('v' + i);
  const reg = document.getElementById('r' + i);
  const tmp = document.getElementById('t' + i);
  const bp = document.querySelector('[data-play="' + i + '"]');
  const bv = document.querySelector('[data-vit="' + i + '"]');
  const VITESSES = [1, .5, .25, 2];
  let vi = 0, k = 0, minuteur = null;
  const poser = (n) => {
    k = Math.max(0, Math.min(f.trames.length - 1, n));
    img.src = 'data:image/jpeg;base64,' + f.trames[k].img;
    reg.value = k;
    tmp.textContent = f.trames[k].t + ' ms';
  };
  const stop = () => { clearTimeout(minuteur); minuteur = null; bp.textContent = 'Lecture'; };
  const jouer = () => {
    if (k >= f.trames.length - 1) k = 0;
    bp.textContent = 'Pause';
    const suite = () => {
      if (k >= f.trames.length - 1) { stop(); return; }
      const dt = (f.trames[k + 1].t - f.trames[k].t) / VITESSES[vi];
      minuteur = setTimeout(() => { poser(k + 1); suite(); }, Math.max(16, dt));
    };
    suite();
  };
  bp.addEventListener('click', () => (minuteur ? stop() : jouer()));
  bv.addEventListener('click', () => {
    vi = (vi + 1) % VITESSES.length;
    bv.textContent = '× ' + VITESSES[vi];
  });
  reg.addEventListener('input', () => { stop(); poser(Number(reg.value)); });
  poser(0);
});
</script>`;

const chemin = `${SORTIE}/la-scene.html`;
writeFileSync(chemin, html, 'utf8');
console.log(`\n  ⇒ ${chemin}  (${Math.round(Buffer.byteLength(html) / 1024)} Ko)\n`);
await nav.close();
