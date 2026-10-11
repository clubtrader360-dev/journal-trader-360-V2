/**
 * L ESPACE FORMATION CONTRE SA MAQUETTE. Lot 9.
 *
 * ── ⚠️ CE QUE CE BANC DOUBLE, ET CE QU IL NE DOUBLE PAS ─────────────────────
 *
 * Il double `window.supabaseClient`, c est-a-dire LE CLIENT, parce que c est ce
 * que le code lit reellement. ⛔ PAS `window.supabase`, qui est la bibliotheque
 * UMD : une sonde qui doublait ce global-la a rendu un rapport vert sur du code
 * casse, le 11/10/2026. Le nom du global double se releve dans le code eprouve,
 * jamais de memoire.
 *
 * ⛔ IL NE DOUBLE NI LE STYLE NI LE CALCUL. L experience, le niveau, les badges
 * et la serie sont calcules par le code de production, dans un vrai navigateur,
 * et le banc LIT le resultat par `Formation._calcul`. Il ne le recalcule pas de
 * son cote : deux calculs qui se verifient l un l autre valident surtout leur
 * accord, pas leur justesse.
 *
 * ── ⚠️ LES DEUX COTES PARTENT DE LA MEME PROGRESSION ────────────────────────
 *
 * La maquette vit sur `localStorage`, le resultat sur Supabase. Le banc pose
 * donc la MEME avancee des deux cotes, par deux chemins differents, pour que la
 * comparaison porte sur le rendu et non sur les donnees. ⚠️ Les identifiants de
 * chapitre different (`m1-a1` cote maquette, `m01-l0` ici) : la table de
 * correspondance est explicite plus bas.
 *
 * Usage : node outils/formation-maquette-captures.mjs
 */
import { mkdirSync, readFileSync, existsSync, statSync, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import path from 'node:path';

const CHEMIN_PPTR = '/Users/nadirkasmi/Projets/trader360-site/node_modules/'
  + 'puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
let puppeteer;
try { ({ default: puppeteer } = await import(CHEMIN_PPTR)); }
catch (e) { console.error(`\n  ⛔ puppeteer-core introuvable : ${e.message}`); process.exit(1); }

const RACINE = process.cwd();
const SORTIE = 'captures/maquette';
mkdirSync(SORTIE, { recursive: true });

let fautes = 0;
const dire = (nom, ok, detail) => {
  if (!ok) fautes += 1;
  console.log(`       ${ok ? 'ok ' : '⛔ '} ${nom}${detail ? `  ${detail}` : ''}`);
};
let n = 0;
const titre = (s) => { n += 1; console.log(`\n  ══ ${n}. ${s.toUpperCase()} ══`); };

/* ══ SERVEUR STATIQUE ═════════════════════════════════════════════════════ */
const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg',
  '.webp': 'image/webp', '.ico': 'image/x-icon', '.woff2': 'font/woff2',
};
const srv = createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p === '/' || (!path.extname(p) && !p.startsWith('/_maquette'))) p = '/index.html';
  const f = path.join(RACINE, p);
  if (!f.startsWith(RACINE) || !existsSync(f) || statSync(f).isDirectory()) {
    res.writeHead(404); res.end('non'); return;
  }
  res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' });
  res.end(readFileSync(f));
});
const PORT = 4531;
await new Promise((ok) => srv.listen(PORT, ok));
const MAQUETTE = `http://localhost:${PORT}/_maquette-espace-formation/espace-formation-trader360.html`;
const RESULTAT = `http://localhost:${PORT}/`;

/**
 * ⚠️ LA NAVIGATION EST REESSAYEE, ET L ECHEC EST DIT.
 * Une course sur trois echouait sur un depassement de delai. ⛔ Un controle
 * intermittent est pire qu absent : on apprend a le relancer jusqu au vert, et
 * un vrai defaut passe dans le lot des « ca arrive ». Deux essais, et si les
 * deux echouent, le banc s arrete en nommant la page.
 */
async function naviguer(p, url) {
  for (let essai = 1; essai <= 3; essai += 1) {
    try {
      await p.goto(url, { waitUntil: 'load', timeout: 20000 });
      return;
    } catch (e) {
      if (essai === 3) {
        console.error(`\n  ⛔ ${url} injoignable apres 3 essais : ${e.message.split('\n')[0]}`);
        throw e;
      }
      console.log(`       ⚠️ essai ${essai} sur ${url.slice(-34)} : ${e.message.split('\n')[0].slice(0, 40)}`);
    }
  }
}

const nav = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check', '--font-render-hinting=none'],
});

/* ══ LA MEME PROGRESSION, DES DEUX COTES ══════════════════════════════════ */
/**
 * Trois modules entiers termines, et trois chapitres du quatrieme.
 * ⚠️ Les comptes viennent du releve Vimeo : 7, 10, 5, 5...
 */
const AVANCEE = [['01', 7], ['02', 10], ['03', 5], ['04', 3]];
const NOTE_TEMOIN = 'TEMOIN BASE : cette note n existe que dans Supabase.';

/** Cote maquette : `m{n}-a{i}`, i commence a 1. */
function etatMaquette() {
  const done = {};
  const notes = {};
  const base = Date.now() - 20 * 864e5;
  let k = 0;
  AVANCEE.forEach(([num, combien]) => {
    for (let i = 1; i <= combien; i += 1) {
      done[`m${Number(num)}-a${i}`] = base + k * 36e5; k += 1;
    }
  });
  notes['m1-a1'] = NOTE_TEMOIN;
  return { done, notes, last: [3, 2], modsDone: {} };
}
/** Cote resultat : `m{num}-l{idx}`, idx commence a 0. */
function progressionBase() {
  const out = [];
  const base = Date.now() - 20 * 864e5;
  let k = 0;
  AVANCEE.forEach(([num, combien]) => {
    for (let i = 0; i < combien; i += 1) {
      out.push({
        lecon_id: `m${num}-l${i}`, vue: true, progress_seconds: 0,
        last_watched_at: new Date(base + k * 36e5).toISOString(),
      });
      k += 1;
    }
  });
  return out;
}

/* ══ OUVRIR LES DEUX COTES ════════════════════════════════════════════════ */
async function ouvrirMaquette({ largeur, etat, gele }) {
  const ctx = await nav.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: largeur, height: largeur <= 420 ? 844 : 900, deviceScaleFactor: 2 });
  if (gele) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.evaluateOnNewDocument((e) => {
    try { localStorage.setItem('t360-formation-v1', JSON.stringify(e)); } catch (x) { /* rien */ }
  }, etat || etatMaquette());
  await naviguer(p, MAQUETTE);
  await new Promise((r) => setTimeout(r, 900));
  return { ctx, p };
}

async function ouvrirResultat({ largeur, prog, notes, droits, coach, gele, theme }) {
  const ctx = await nav.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: largeur, height: largeur <= 420 ? 844 : 900, deviceScaleFactor: 2 });
  if (gele) await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.evaluateOnNewDocument((cfg) => {
    /**
     * ⚠️ TOUTE TABLE LUE OU ECRITE EST JOURNALISEE. C est ce qui prouve
     * qu aucune table nouvelle n est creee pour l experience ou les badges :
     * `window.__tables` doit ne contenir que les tables deja connues.
     */
    window.__tables = [];
    window.__ecritures = [];
    const poser = () => {
      const t = (nom) => {
        window.__tables.push(nom);
        const b = {
          select() { return b; }, not() { return b; }, order() { return b; },
          in: () => Promise.resolve({ data: [], error: null }),
          eq() {
            const liste = {
              data: nom === 'formation_progression' ? window.__prog
                : nom === 'formation_notes' ? window.__notes : [],
              error: null,
            };
            const un = nom === 'formation_parcours_vu' ? { data: null, error: null }
              : nom === 'user_preferences'
                ? { data: { mantra_texte: null, mantra_auteur: null }, error: null }
                : { data: cfg.droits, error: null };
            return {
              maybeSingle: () => Promise.resolve(un),
              single: () => Promise.resolve(un),
              then: (ok, ko) => Promise.resolve(liste).then(ok, ko),
            };
          },
          update(ligne) {
            window.__ecritures.push({ table: nom, ligne });
            return { eq: () => Promise.resolve({ error: null }) };
          },
          upsert(ligne) {
            window.__ecritures.push({ table: nom, ligne });
            if (nom === 'formation_progression') {
              const i = window.__prog.findIndex((x) => x.lecon_id === ligne.lecon_id);
              const l = { ...ligne, last_watched_at: ligne.last_watched_at || new Date().toISOString() };
              if (i >= 0) Object.assign(window.__prog[i], l); else window.__prog.push(l);
            }
            if (nom === 'formation_notes') {
              const i = window.__notes.findIndex((x) => x.lecon_id === ligne.lecon_id);
              if (i >= 0) Object.assign(window.__notes[i], ligne); else window.__notes.push({ ...ligne });
            }
            return Promise.resolve({ error: null });
          },
        };
        return b;
      };
      window.supabaseClient = {
        from: t,
        auth: {
          getUser: async () => ({ data: { user: { id: 'eleve-maquette' } } }),
          getSession: async () => ({ data: { session: { user: { id: 'eleve-maquette' }, access_token: 'x' } } }),
          onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
        },
      };
    };
    window.__prog = cfg.prog;
    window.__notes = cfg.notes;
    poser();
    window.addEventListener('load', poser);
    window.currentUser = { role: cfg.coach ? 'coach' : 'student', uuid: 'eleve-maquette', first_name: 'Nadir' };
    window.alert = () => {}; window.confirm = () => true;
    // ⚠️ LE THEME DU JOURNAL, pose sur le corps. L espace formation est sombre
    // dans les deux cas : c est precisement ce que la parite doit prouver.
    window.addEventListener('load', () => {
      document.body.classList.toggle('dark-mode', cfg.theme !== 'clair');
    });
  }, {
    prog: prog || progressionBase(),
    notes: notes || [{ lecon_id: 'm01-l0', texte: NOTE_TEMOIN }],
    droits: droits || { formation_actif: true, journal_actif: true, journal_demande_le: null, journal_retire_le: null },
    coach: !!coach,
    theme: theme || 'sombre',
  });
  await naviguer(p, RESULTAT);
  await p.evaluate(async () => {
    if (window.Acces) { await window.Acces.charger(); window.Acces.entrer('formation'); }
  });
  await new Promise((r) => setTimeout(r, 1200));
  return { ctx, p };
}

/* ══ CAPTURE ET COMPOSITION COTE A COTE ═══════════════════════════════════ */
const b64 = (f) => readFileSync(f).toString('base64');
async function capturer(p, fichier, pleinePage = true) {
  const chemin = `${SORTIE}/${fichier}.png`;
  await p.screenshot({ path: chemin, fullPage: pleinePage });
  return chemin;
}
/**
 * ⚠️ LA COMPOSITION SE FAIT DANS LE NAVIGATEUR, pas avec une bibliotheque
 * d images. Une dependance de plus pour coller deux PNG cote a cote serait
 * disproportionnee, et le lot interdit d en ajouter.
 */
async function coteACote(gauche, droite, sortie, libelle) {
  const p = await nav.newPage();
  await p.setViewport({ width: 1600, height: 900, deviceScaleFactor: 1 });
  await p.setContent(`<!doctype html><html><head><style>
    body{margin:0;background:#0a0a0c;font:14px -apple-system,Inter,sans-serif;color:#f7f6f3}
    h1{font-size:15px;margin:0;padding:12px 16px;border-bottom:1px solid #26262c;letter-spacing:.04em}
    .r{display:flex;gap:16px;padding:16px;align-items:flex-start}
    .c{flex:1;min-width:0}
    .c b{display:block;font-size:12px;letter-spacing:.14em;text-transform:uppercase;
      color:#e8b84b;margin:0 0 8px;font-weight:700}
    img{width:100%;display:block;border:1px solid #26262c;border-radius:8px}
  </style></head><body>
    <h1>${libelle}</h1>
    <div class="r">
      <div class="c"><b>Maquette validee</b><img src="data:image/png;base64,${b64(gauche)}"></div>
      <div class="c"><b>Resultat, sur les donnees reelles</b><img src="data:image/png;base64,${b64(droite)}"></div>
    </div></body></html>`);
  await new Promise((r) => setTimeout(r, 250));
  const el = await p.$('body');
  await el.screenshot({ path: `${SORTIE}/${sortie}.png` });
  await p.close();
  return `${sortie}.png`;
}

/* ════════════════════════════════════════════════════════════════════════ */
titre('les six ecrans, cote a cote, en 390 puis en 1440 (controles 1 et 2)');

/** Les gestes qui amenent chaque ecran, de chaque cote. */
const ECRANS = [
  {
    cle: 'accueil', libelle: 'Accueil : mon parcours',
    maq: async () => {}, res: async () => {},
  },
  {
    cle: 'modules', libelle: 'Les dix modules',
    maq: async (p) => { await p.evaluate(() => document.querySelector('[data-go="modules"]').click()); },
    res: async (p) => { await p.evaluate(() => document.querySelector('#formationApp [data-go="modules"]').click()); },
  },
  {
    cle: 'module', libelle: 'Un module : le 02, dix chapitres termines',
    maq: async (p) => { await p.evaluate(() => document.querySelector('[data-mod="1"]').click()); },
    res: async (p) => { await p.evaluate(() => document.querySelector('#formationApp [data-mod="1"]').click()); },
  },
  {
    cle: 'chapitre', libelle: 'Un chapitre : le 3 du module 04, non termine',
    maq: async (p) => {
      await p.evaluate(() => document.querySelector('[data-mod="3"]').click());
      await new Promise((r) => setTimeout(r, 400));
      await p.evaluate(() => document.querySelectorAll('.chap')[3].click());
    },
    res: async (p) => {
      await p.evaluate(() => document.querySelector('#formationApp [data-mod="3"]').click());
      await new Promise((r) => setTimeout(r, 500));
      await p.evaluate(() => document.querySelectorAll('#formationApp .chap')[3].click());
    },
  },
  {
    cle: 'notes', libelle: 'Mes notes',
    maq: async (p) => { await p.evaluate(() => document.querySelector('[data-go="notes"]').click()); },
    res: async (p) => { await p.evaluate(() => document.querySelector('#formationApp [data-go="notes"]').click()); },
  },
  {
    cle: 'badges', libelle: 'Mes badges',
    maq: async (p) => { await p.evaluate(() => document.querySelector('[data-go="badges"]').click()); },
    res: async (p) => { await p.evaluate(() => document.querySelector('#formationApp [data-go="badges"]').click()); },
  },
];

// ⚠️ 390 D ABORD : c est la demande explicite de Nadir.
for (const largeur of [390, 1440]) {
  for (const e of ECRANS) {
    const m = await ouvrirMaquette({ largeur });
    const r = await ouvrirResultat({ largeur });
    await e.maq(m.p); await e.res(r.p);
    await new Promise((x) => setTimeout(x, 900));
    const g = await capturer(m.p, `_m-${e.cle}-${largeur}`);
    const d = await capturer(r.p, `_r-${e.cle}-${largeur}`);
    const f = await coteACote(g, d, `${e.cle}-${largeur}`, `${e.libelle} · ${largeur} px`);
    dire(`${e.libelle} / ${largeur}px`, true, f);
    await m.ctx.close(); await r.ctx.close();
  }
}

titre('les donnees viennent de la base, pas de localStorage (controle 3)');
{
  const { ctx, p } = await ouvrirResultat({ largeur: 1440 });
  const m = await p.evaluate((temoin) => {
    const txt = document.getElementById('formationApp').textContent;
    return {
      // ⚠️ La note temoin n existe QUE dans le double de la base.
      noteALEcran: txt.includes(temoin),
      chapitres: (txt.match(/(\d+)\s*\/\s*63/) || [])[1] || '(introuvable)',
      // ⛔ Rien ne doit etre ecrit dans le stockage local par cet espace.
      clesLocales: Object.keys(localStorage).filter((k) => /formation|t360-formation/i.test(k)),
      toutesClesLocales: Object.keys(localStorage).length,
      tablesLues: [...new Set(window.__tables)].sort(),
    };
  }, NOTE_TEMOIN);
  dire('⚠️ une note qui n existe QU EN BASE s affiche a l ecran', m.noteALEcran,
    `« ${NOTE_TEMOIN.slice(0, 34)}... »`);
  dire('le compte de chapitres vient de la progression lue en base',
    m.chapitres === '25', `${m.chapitres} / 63 affiche (attendu 25 = 7+10+5+3)`);
  dire('⛔ aucune cle de formation ecrite dans localStorage', m.clesLocales.length === 0,
    `${m.toutesClesLocales} cle(s) locale(s) au total, dont ${m.clesLocales.length} de formation`);
  console.log(`       tables touchees : ${m.tablesLues.join(', ')}`);
  await ctx.close();
}

titre('experience et niveau DERIVES, aucune table nouvelle (controle 4)');
{
  const CONNUES = new Set(['acces_membre', 'formation_progression', 'formation_notes',
    'formation_parcours_vu', 'user_preferences', 'users', 'journal_entries',
    'gamification_state', 'daily_summary', 'trades', 'system_settings',
    'user_motivation', 'accounts', 'checklist_validations', 'replay_views',
    'payouts', 'account_costs', 'daily_fees', 'tradovate_credentials',
    'tradovate_sync_state', 'coach_formation_overview', 'replays']);

  // Deux progressions DIFFERENTES doivent donner deux niveaux DIFFERENTS.
  const cas = [
    { nom: '3 modules + 3 chapitres', prog: progressionBase() },
    { nom: '1 seul chapitre', prog: [{ lecon_id: 'm01-l0', vue: true, progress_seconds: 0,
      last_watched_at: new Date().toISOString() }] },
  ];
  const vus = [];
  for (const c of cas) {
    const { ctx, p } = await ouvrirResultat({ largeur: 1440, prog: c.prog });
    const m = await p.evaluate(() => {
      const C = window.Formation._calcul;
      const x = C.xpTotal();
      const i = C.niveauDe(x);
      return {
        xp: x, niveau: i + 1, nom: C.NIVEAUX[i].nom,
        badges: C.badges().filter((b) => b.ok()).map((b) => b.id),
        serie: C.serie(),
        chip: document.getElementById('chipXp').textContent,
        chipNiv: document.getElementById('chipLvl').textContent,
        tables: [...new Set(window.__tables)],
        ecritures: window.__ecritures.length,
      };
    });
    vus.push(m);
    console.log(`       ${c.nom.padEnd(26)} ${String(m.xp).padStart(5)} XP  `
      + `niveau ${m.niveau} « ${m.nom} »  serie ${m.serie} sem.  `
      + `${m.badges.length} badge(s)`);
    dire(`${c.nom} : la pastille affiche le meme calcul`,
      m.chip === `${m.xp.toLocaleString('fr-FR')} XP` && m.chipNiv === m.nom,
      `« ${m.chip} » / « ${m.chipNiv} »`);
    const inconnues = m.tables.filter((t) => !CONNUES.has(t));
    dire(`${c.nom} : ⛔ aucune table inconnue touchee`, inconnues.length === 0,
      inconnues.length ? inconnues.join(', ') : m.tables.join(', '));
    dire(`${c.nom} : ⛔ aucune ecriture pour l experience ou les badges`, m.ecritures === 0,
      `${m.ecritures} ecriture(s)`);
    await ctx.close();
  }
  dire('⚠️ TEMOIN : deux progressions differentes donnent deux niveaux differents',
    vus[0].niveau !== vus[1].niveau,
    `${vus[0].xp} XP -> niveau ${vus[0].niveau} ; ${vus[1].xp} XP -> niveau ${vus[1].niveau}`);
  dire('⚠️ TEMOIN : et deux lots de badges differents',
    vus[0].badges.length !== vus[1].badges.length,
    `${vus[0].badges.length} contre ${vus[1].badges.length}`);
  // ⚠️ Le calcul est reproduit a la main UNE fois, pour que le barème soit lisible.
  const attendu = 25 * 100 + 3 * 250;
  dire('le calcul se refait a la main : 25 chapitres x 100 + 3 modules x 250',
    vus[0].xp === attendu, `${attendu} attendu, ${vus[0].xp} calcule`);
}

titre('sans animation, tout s affiche et rien ne bouge (controle 5)');
for (const largeur of [390, 1440]) {
  const { ctx, p } = await ouvrirResultat({ largeur, gele: true });
  const m = await p.evaluate(() => {
    const barres = Array.from(document.querySelectorAll('#formationApp .bar i'));
    const anneau = document.getElementById('ringArc');
    const ar = anneau ? getComputedStyle(anneau) : null;
    return {
      // ⛔ Au style CALCULE, jamais a l attribut.
      /**
       * ⚠️ ASSERTION CORRIGEE, PAS LE CODE. La version precedente comptait
       * « 6 barres a zero » et criait au defaut. Ces six-la sont les modules 05
       * a 10, qui sont reellement a 0 % : une barre vide y est le bon rendu.
       * ⛔ On ne compare donc que les barres qui DOIVENT etre remplies, en
       * relisant leur propre `data-w`.
       */
      attendues: barres.filter((b) => Number(b.dataset.w) > 0).length,
      remplies: barres.filter((b) => Number(b.dataset.w) > 0
        && parseFloat(getComputedStyle(b).width) > 0.5).length,
      nbBarres: barres.length,
      anneauOffset: ar ? parseFloat(ar.strokeDashoffset) : -1,
      anneauTotal: ar ? parseFloat(ar.strokeDasharray) : -1,
      transitions: barres.map((b) => getComputedStyle(b).transitionDuration),
      visible: getComputedStyle(document.getElementById('formationApp')).display,
    };
  });
  dire(`${largeur}px : les barres non nulles sont POSEES`,
    m.nbBarres > 0 && m.attendues > 0 && m.remplies === m.attendues,
    `${m.remplies}/${m.attendues} remplies sur ${m.nbBarres} barres`);
  dire(`${largeur}px : l anneau de progression est pose`,
    m.anneauOffset >= 0 && m.anneauOffset < m.anneauTotal - 1,
    `offset ${Math.round(m.anneauOffset)} / ${Math.round(m.anneauTotal)}`);
  dire(`${largeur}px : ⛔ aucune transition armee`,
    m.transitions.every((d) => d === '0s'), [...new Set(m.transitions)].join(', '));
  await capturer(p, `sans-animation-${largeur}`);
  await ctx.close();
}

titre('l animation s arrete quand on quitte l ecran (controle 6)');
{
  /**
   * ⚠️ LA MESURE PORTE SUR LE CANEVAS, PAS SUR UN COMPTEUR AJOUTE AU CODE.
   * Si la boucle tournait encore, elle REPEINDRAIT le canevas a chaque trame :
   * un canevas vide qui reste vide est donc la preuve que la boucle est morte.
   * ⛔ Un compteur pose dans le code de production pour les besoins du test
   * mesurerait le test, pas le produit.
   */
  const { ctx, p } = await ouvrirResultat({ largeur: 1440 });
  const encre = () => p.evaluate(() => {
    const cv = document.getElementById('confetti');
    if (!cv || !cv.width) return 0;
    const g = cv.getContext('2d');
    const d = g.getImageData(0, 0, cv.width, Math.min(cv.height, 400)).data;
    let s = 0;
    for (let i = 3; i < d.length; i += 400) s += d[i];
    return s;
  });
  const vide0 = await encre();
  // On declenche une celebration en terminant le dernier chapitre du module 04.
  await p.evaluate(() => {
    document.querySelector('#formationApp [data-mod="3"]').click();
  });
  await new Promise((r) => setTimeout(r, 600));
  await p.evaluate(() => {
    const b = document.querySelector('#formationApp [data-complete]');
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 160));
  await p.evaluate(() => {
    const b = document.querySelector('#formationApp [data-complete]');
    if (b) b.click();
  });
  await new Promise((r) => setTimeout(r, 300));
  const pendant1 = await encre();
  await new Promise((r) => setTimeout(r, 160));
  const pendant2 = await encre();
  dire('⚠️ TEMOIN : pendant la celebration, le canevas est peint ET il CHANGE',
    pendant1 > 0 && pendant2 > 0 && pendant1 !== pendant2,
    `${pendant1} puis ${pendant2}`);
  await capturer(p, 'celebration-1440', false);

  // ⛔ On quitte l ecran : retour vers le journal.
  await p.evaluate(() => window.Acces.retourJournal());
  await new Promise((r) => setTimeout(r, 120));
  const apres1 = await encre();
  await new Promise((r) => setTimeout(r, 250));
  const apres2 = await encre();
  await new Promise((r) => setTimeout(r, 400));
  const apres3 = await encre();
  dire('⛔ apres le retour au journal, le canevas est vide et RESTE vide',
    apres1 === 0 && apres2 === 0 && apres3 === 0,
    `${apres1} / ${apres2} / ${apres3} (avant la celebration : ${vide0})`);
  const etat = await p.evaluate(() => ({
    journal: getComputedStyle(document.getElementById('mainApp')).display,
    formation: getComputedStyle(document.getElementById('formationApp')).display,
  }));
  dire('le journal est revenu, l espace formation est masque',
    etat.journal !== 'none' && etat.formation === 'none',
    `journal ${etat.journal}, formation ${etat.formation}`);
  await ctx.close();
}

titre('le retour, dans ses trois cas, et le journal intact');
for (const cas of [
  { nom: 'eleve avec journal', droits: { formation_actif: true, journal_actif: true }, coach: false, j: true, c: false },
  { nom: 'eleve sans journal', droits: { formation_actif: true, journal_actif: false }, coach: false, j: false, c: false },
  { nom: 'coach', droits: { formation_actif: true, journal_actif: true }, coach: true, j: false, c: true },
]) {
  const { ctx, p } = await ouvrirResultat({ largeur: 1440, droits: cas.droits, coach: cas.coach });
  if (cas.coach) {
    await p.evaluate(async () => {
      window.Acces.retourCoach();
      await new Promise((r) => setTimeout(r, 60));
      window.Acces.entrer('formation');
    });
    await new Promise((r) => setTimeout(r, 900));
  }
  const m = await p.evaluate(() => {
    const vu = (s) => {
      const e = document.querySelector(s);
      if (!e) return false;
      const c = getComputedStyle(e);
      return c.display !== 'none' && c.visibility !== 'hidden' && e.offsetParent !== null;
    };
    // ⛔ On ne lit QUE LE TEXTE VISIBLE : `textContent` inclut celui des
    // elements masques, et la sonde accuserait le code d une mention
    // qu aucun eleve ne voit.
    const texteVisible = (racine) => {
      let out = '';
      const marche = (el) => {
        if (el.nodeType === 3) { out += el.nodeValue; return; }
        if (el.nodeType !== 1) return;
        const c = getComputedStyle(el);
        if (c.display === 'none' || c.visibility === 'hidden') return;
        el.childNodes.forEach(marche);
      };
      marche(racine);
      return out;
    };
    return {
      journal: vu('.formation-retour-journal'),
      coach: vu('.formation-retour-coach'),
      mentions: (texteVisible(document.getElementById('formationApp')).match(/journal/gi) || []).length,
      barresJournalDansFormation: document.querySelectorAll('#formationApp .sidebar-item').length,
      navJournal: Array.from(document.querySelectorAll('#mainApp .sidebar-item[data-section]'))
        .map((e) => ({ section: e.dataset.section, libelle: e.textContent.trim().replace(/\s+/g, ' ') })),
    };
  });
  dire(`${cas.nom} : « Revenir au journal »`, m.journal === cas.j, m.journal ? 'affiche' : 'masque');
  dire(`${cas.nom} : « Revenir a l espace coach »`, m.coach === cas.c, m.coach ? 'affiche' : 'masque');
  if (!cas.j && !cas.c) {
    dire('⛔ un eleve formation seule ne lit AUCUNE mention du journal',
      m.mentions === 0, `${m.mentions} occurrence(s) visible(s)`);
  }
  dire(`${cas.nom} : ⛔ aucune barre laterale du journal dans la formation`,
    m.barresJournalDansFormation === 0, `${m.barresJournalDansFormation} trouvee(s)`);
  if (!cas.coach) {
    const ref = JSON.parse(readFileSync('/tmp/nav-avant.json', 'utf8'));
    const egal = JSON.stringify(ref) === JSON.stringify(m.navJournal);
    dire(`${cas.nom} : ⚠️ les ${ref.length} entrees du journal sont INCHANGEES`, egal,
      `${m.navJournal.length} entrees`);
    if (!egal) console.log('        avant :', JSON.stringify(ref), '\n        apres :', JSON.stringify(m.navJournal));
  }
  await ctx.close();
}

titre('parite des styles calcules : la maquette et le resultat, dans les deux themes');
{
  /**
   * ── ⚠️ L ORACLE EST LE STYLE CALCULE, PAS MON OEIL ────────────────────────
   *
   * ⛔ Une capture cote a cote dit « ca se ressemble ». Elle ne dit pas qu une
   * regle du journal a gagne sur une propriete que la maquette ne declare pas :
   * c est exactement ainsi que `.logo { flex-direction: column }` et
   * `.bar { width: 40px }` sont passes. On compare donc, propriete par
   * propriete, ce que le navigateur CALCULE des deux cotes.
   *
   * ⚠️ ET DANS LES DEUX THEMES DU JOURNAL. `h1 { color: var(--text-strong) }`
   * vaut #ffffff en sombre et #020617 en clair : un defaut qui n apparait que
   * chez les eleves en mode clair est un defaut qu une seule capture ne voit
   * jamais.
   */
  const CIBLES = [
    '.top', '.logo', '.logo b', '.eyebrow', '.hero h1', '.lead',
    '.btn.btn-gold', '.dash', '.ring', '#ringArc', '.ring circle', '.bar', '.bar i', '.stat .v',
    '.sec-head h2', '.mod', '.mod h3', '.mod p', '.pill',
    '.badge', '.badge strong', '.xp-chip .lvl', 'footer',
  ];
  const PROPS = ['color', 'backgroundColor', 'fontFamily', 'fontSize', 'fontWeight',
    'letterSpacing', 'lineHeight', 'borderRadius', 'display', 'flexDirection',
    'textTransform', 'height', 'borderTopWidth', 'paddingTop', 'paddingLeft',
    // ⚠️ LES PROPRIETES SVG SONT DANS LA LISTE DEPUIS QUE LA REMISE A ZERO A
    // EFFACE LE `stroke-dasharray` DE L ANNEAU. Elles ne se voient pas sur une
    // capture : un anneau complet reste un bel anneau.
    'strokeDasharray', 'stroke', 'strokeWidth', 'fill'];
  /**
   * ⚠️ DEUX PROPRIETES SONT HORS COMPARAISON, ET IL FAUT DIRE POURQUOI.
   *   `strokeDashoffset` encode la PROGRESSION, pas le style : la maquette
   *   compte 65 chapitres (elle en invente 2 au module 10), nous 63, mesures sur
   *   le releve Vimeo. 38 % contre 40 %, et c est NOUS qui avons raison.
   *   `stroke`/`fill` en `url(#...)` designent un degrade dont l IDENTIFIANT est
   *   volontairement different : `rg` chez elle, `rgFormation` chez nous, pour
   *   qu un identifiant de trois lettres ne heurte rien dans un document de
   *   11 000 lignes. ⛔ On compare donc la forme, pas le nom.
   */
  const horsParite = (s, k, a, b) => (k === 'strokeDashoffset')
    || ((k === 'stroke' || k === 'fill') && /^url\(/.test(a) && /^url\(/.test(b));
  const lire = (p) => p.evaluate((sels, props) => {
    const out = {};
    for (const s of sels) {
      const el = document.querySelector(`#formationApp ${s}`) || document.querySelector(s);
      if (!el) { out[s] = null; continue; }
      const c = getComputedStyle(el);
      out[s] = Object.fromEntries(props.map((k) => [k, c[k]]));
    }
    return out;
  }, CIBLES, PROPS);

  const m = await ouvrirMaquette({ largeur: 1440 });
  const refMaq = await lire(m.p);
  await m.ctx.close();

  for (const theme of ['sombre', 'clair']) {
    const r = await ouvrirResultat({ largeur: 1440, theme });
    const got = await lire(r.p);
    const ecarts = [];
    let compares = 0;
    for (const s of CIBLES) {
      if (!refMaq[s]) { ecarts.push(`${s} : absent de la MAQUETTE`); continue; }
      if (!got[s]) { ecarts.push(`${s} : absent du RESULTAT`); continue; }
      for (const k of PROPS) {
        compares += 1;
        // ⚠️ `height` ne se compare que sur `.bar` : ailleurs elle depend du
        // contenu, pas du style, et un ecart n y voudrait rien dire.
        if (k === 'height' && !s.startsWith('.bar')) continue;
        if (horsParite(s, k, refMaq[s][k], got[s][k])) continue;
        if (refMaq[s][k] !== got[s][k]) ecarts.push(`${s} · ${k} : « ${refMaq[s][k]} » -> « ${got[s][k]} »`);
      }
    }
    dire(`theme ${theme} : ${compares} proprietes comparees, aucun ecart`, ecarts.length === 0,
      ecarts.length ? `${ecarts.length} ecart(s)` : '');
    for (const e of ecarts.slice(0, 14)) console.log(`          ⛔ ${e}`);
    if (ecarts.length > 14) console.log(`          ... et ${ecarts.length - 14} autres`);
    await r.ctx.close();
  }

  // ⚠️ TEMOIN : le comparateur sait-il voir un ecart qu on introduit expres ?
  const r = await ouvrirResultat({ largeur: 1440 });
  /**
   * ⚠️ `!important` DANS LE TEMOIN, ET C EST UNE CORRECTION.
   * Sans lui, l injection n emportait que `color`, propriete que la maquette ne
   * declare pas sur ce selecteur : `font-size` restait a 19px parce que la
   * feuille injectee se place AVANT `formation.css` dans l ordre des feuilles.
   * ⛔ Le temoin sous-detectait donc, et m aurait fait douter d un comparateur
   * qui fonctionnait. Un temoin mal construit discredite un bon instrument.
   */
  await r.p.addStyleTag({ content: '#formationApp .mod h3{font-size:3px !important;color:#ff0000 !important;font-weight:100 !important}' });
  const abime = await lire(r.p);
  const vus = PROPS.filter((k) => refMaq['.mod h3'][k] !== abime['.mod h3'][k]);
  dire('⚠️ TEMOIN : un ecart introduit expres est bien detecte', vus.length >= 3,
    `proprietes vues differentes : ${vus.join(', ') || 'AUCUNE'}`);
  await r.ctx.close();
}

titre('rien du journal ne traverse dans l espace formation');
{
  const { ctx, p } = await ouvrirResultat({ largeur: 1440 });
  const m = await p.evaluate(() => {
    const fa = document.getElementById('formationApp');
    const fuites = [];
    for (const el of document.body.children) {
      if (el === fa) continue;
      const c = getComputedStyle(el);
      if (c.display === 'none' || c.visibility === 'hidden') continue;
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height) continue;
      // ⚠️ `.skip-link` est a `top:-200px` : il a une taille mais il est HORS
      // DE L ECRAN. Une sonde qui ne regarde que la taille l accuse a tort.
      if (r.bottom <= 0 || r.right <= 0 || r.top >= window.innerHeight) continue;
      fuites.push(`<${el.tagName.toLowerCase()}> .${(el.className || '').toString().slice(0, 30)} `
        + `${Math.round(r.width)}x${Math.round(r.height)}`);
    }
    const liensLegaux = Array.from(fa.querySelectorAll('footer a')).map((a) => a.getAttribute('href'));
    return { fuites, liensLegaux, marqueur: document.body.dataset.espace || '(absent)' };
  });
  dire('⛔ aucun element du journal visible par-dessus l espace', m.fuites.length === 0,
    m.fuites.join(' | ') || 'aucun');
  dire('les quatre liens legaux sont dans le pied de page de l espace',
    ['/mentions-legales.html', '/cgv.html', '/confidentialite.html', '/cgu.html']
      .every((h) => m.liensLegaux.includes(h)), m.liensLegaux.join(' '));
  dire('le marqueur est pose pendant la visite', m.marqueur === 'formation', m.marqueur);
  // ⚠️ TEMOIN : au retour au journal, le marqueur tombe et le pied revient.
  const apres = await p.evaluate(() => {
    window.Acces.retourJournal();
    const f = document.querySelector('body > .app-footer');
    return { marqueur: document.body.dataset.espace || '(absent)',
      pied: f ? getComputedStyle(f).display : '(absent)' };
  });
  dire('⚠️ TEMOIN : de retour au journal, le pied de page legal revient',
    apres.marqueur === '(absent)' && apres.pied !== 'none',
    `marqueur ${apres.marqueur}, pied ${apres.pied}`);
  await ctx.close();
}

titre('les polices demandees par la maquette sont servies');
{
  const { ctx, p } = await ouvrirResultat({ largeur: 1440 });
  const m = await p.evaluate(async () => {
    await document.fonts.ready;
    const veut = [['Inter', '800'], ['Inter', '400'], ['JetBrains Mono', '700'], ['JetBrains Mono', '400']];
    const res = veut.map(([f, w]) => ({ f, w, ok: document.fonts.check(`${w} 16px "${f}"`) }));
    // ⚠️ ON NE COMPTE QUE LES FEUILLES DE STYLE. La version precedente comptait
    // aussi le `rel="preconnect"`, qui ne charge aucune police : elle rendait
    // « 2 liens » sur un chargement parfaitement unique. Assertion fausse, pas
    // code faux.
    const liens = Array.from(document.querySelectorAll('link[rel="stylesheet"][href*="fonts.googleapis"]'))
      .map((l) => l.href);
    return { res, liens };
  });
  for (const r of m.res) dire(`${r.f} ${r.w}`, r.ok);
  dire('⛔ UN SEUL lien de polices, pas deux', m.liens.length === 1, `${m.liens.length} lien(s)`);
  await ctx.close();
}

/* ════════════════════════════════════════════════════════════════════════ */
await nav.close();
srv.close();
console.log(`\n  ── captures dans ${SORTIE}/ ──`);
console.log(fautes ? `\n  ⛔ ${fautes} CONTROLE(S) ROUGE(S).\n` : '\n  Tout est vert.\n');
process.exit(fautes ? 1 : 0);
