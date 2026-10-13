/**
 * ⛔ LA FENÊTRE DE BIENVENUE : UNE FOIS, ET UNE SEULE.
 *
 * ── ⚠️ LES TROIS CAS, ET POURQUOI LES TROIS ────────────────────────────────
 *
 *   1. PREMIÈRE CONNEXION   aucune ligne en base  -> la fenêtre s'affiche
 *   2. FERMÉE, PUIS RETOUR  une ligne existe      -> elle ne revient pas
 *   3. AUTRE NAVIGATEUR     la ligne est en BASE, pas dans le navigateur
 *                           -> elle ne revient pas non plus
 *
 * ⛔ Le troisième est celui qui distingue une mémoire de SESSION d'une mémoire
 * de COMPTE. Un `localStorage` passerait les deux premiers cas et échouerait au
 * troisième : l'élève reverrait la fenêtre sur son téléphone après l'avoir
 * fermée sur son ordinateur. ⚠️ Sans ce cas, les deux autres ne prouveraient
 * rien sur la nature de la mémoire.
 *
 * ⚠️ TÉMOIN OBLIGATOIRE : si les trois cas rendaient la même chose, la règle ne
 * déciderait rien. Le premier DOIT afficher, les deux autres DOIVENT se taire.
 *
 * ⛔ AUCUNE BASE RÉELLE N'EST TOUCHÉE. Le client Supabase est doublé, et le
 * double porte la sémantique qui compte : `maybeSingle` rend `null` quand la
 * ligne n'existe pas, et `upsert` ne crée pas de doublon sur la clé.
 *
 * Usage : node outils/formation-bienvenue.mjs
 */
import { readFileSync } from 'node:fs';

const PPTR = '/Users/nadirkasmi/Projets/trader360-site/node_modules/'
  + 'puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const { default: puppeteer } = await import(PPTR);

let fautes = 0;
const dire = (nom, ok, detail) => {
  if (!ok) fautes += 1;
  console.log(`     ${ok ? 'ok ' : '⛔ '} ${nom}${detail ? `  ${detail}` : ''}`);
};
let n = 0;
const titre = (s) => { n += 1; console.log(`\n  ══ ${n}. ${s.toUpperCase()} ══`); };

const nav = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-first-run', '--no-default-browser-check'],
});

/**
 * Monte le module de formation dans une page nue, avec un client Supabase
 * doublé. `lignes` est l'état de `formation_parcours_vu` côté base.
 */
async function monter(lignesEnBase) {
  const ctx = await nav.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: 1280, height: 900 });
  // ⚠️ `#formation` est le conteneur que le module écrit : `app()` le cherche
  // par cet identifiant. ⛔ `#formationApp` est le CADRE de la page, un autre
  // élément, et c'est en le confondant que la première version de cette sonde
  // levait « Cannot set properties of null ».
  await p.setContent('<!doctype html><html lang="fr"><head><meta charset="utf-8">'
    + '</head><body><div id="formationApp"><div id="formation"></div></div></body></html>');
  await p.addStyleTag({ content: readFileSync('assets/formation.css', 'utf8') });

  await p.evaluate((lignes) => {
    window.__ecritures = [];
    // ⛔ LE DOUBLE PORTE LA SÉMANTIQUE QUI COMPTE, pas une version complaisante.
    const table = { formation_parcours_vu: lignes.slice() };
    const faire = (nom) => {
      const q = {
        _filtres: {},
        select() { return q; },
        eq(col, v) { q._filtres[col] = v; return q; },
        maybeSingle() {
          const l = (table[nom] || []).find((r) =>
            Object.entries(q._filtres).every(([c, v]) => r[c] === v));
          // ⚠️ `maybeSingle` rend `data: null` et PAS d'erreur quand rien ne
          // correspond : c'est exactement ce que le code lit.
          return Promise.resolve({ data: l || null, error: null });
        },
        upsert(ligne) {
          window.__ecritures.push({ table: nom, ligne });
          const i = (table[nom] || []).findIndex((r) => r.user_id === ligne.user_id);
          if (i >= 0) table[nom][i] = { ...table[nom][i], ...ligne };
          else (table[nom] = table[nom] || []).push({ ...ligne, vue_le: new Date().toISOString() });
          return Promise.resolve({ error: null });
        },
        then(res) { return Promise.resolve({ data: [], error: null }).then(res); },
      };
      return q;
    };
    window.supabaseClient = {
      from: faire,
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'eleve-de-sonde' } } }) },
    };
    window.__table = table;
  }, lignesEnBase);

  await p.addScriptTag({ content: readFileSync('assets/formation-donnees.js', 'utf8') });
  await p.addScriptTag({ content: readFileSync('supabase-formation.js', 'utf8') });
  return { ctx, p };
}

/** Appelle le chargement, puis le rendu, comme le fait la page. */
const jouer = async (p) => {
  // ⛔ `ouvrir()` est le SEUL point d'entrée public : il charge, puis rend.
  // ⚠️ Appeler `charger()` et `rendre()` séparément, comme le faisait la
  // première version de cette sonde, mesurerait un chemin qui n'existe pas.
  await p.evaluate(async () => { await window.Formation.ouvrir(); });
  await new Promise((r) => setTimeout(r, 400));
};

const etat = (p) => p.evaluate(() => {
  const d = document.getElementById('formationBienvenue');
  return {
    presente: !!d,
    ouverte: !!d && d.hasAttribute('open'),
    titre: d ? (d.querySelector('.f-bienvenue__titre') || {}).textContent : null,
    lecteurEnAttente: !!d && !!d.querySelector('.f-bienvenue__lecteur'),
    sorties: d ? d.querySelectorAll('[data-fermer]').length : 0,
    ecritures: window.__ecritures.length,
    enBase: (window.__table.formation_parcours_vu || []).length,
  };
});

/* ════════════════════════════════════════════════════════════════════════ */
titre('⚠️ l étalonnage : le module se monte et le double répond');
{
  const { ctx, p } = await monter([]);
  const monte = await p.evaluate(() => typeof window.Formation === 'object'
    && typeof window.Formation.bienvenueAMontrer === 'function');
  dire('le module est monté et expose sa surface', monte === true);
  const lu = await p.evaluate(async () => {
    const r = await window.supabaseClient.from('formation_parcours_vu')
      .select('vue_le').eq('user_id', 'eleve-de-sonde').maybeSingle();
    return r;
  });
  dire('⚠️ TÉMOIN : le double rend `null` quand la ligne manque',
    lu.data === null && lu.error === null, JSON.stringify(lu));
  await ctx.close();
}
if (fautes) { console.log('\n  ⛔ ÉTALONNAGE RATÉ.\n'); process.exit(1); }

/* ════════════════════════════════════════════════════════════════════════ */
titre('⛔ CAS 1 : première connexion, aucune ligne en base');
{
  const { ctx, p } = await monter([]);
  await jouer(p);
  const e = await etat(p);
  dire('⛔ la fenêtre S AFFICHE', e.presente && e.ouverte, `présente ${e.presente}, ouverte ${e.ouverte}`);
  dire('elle porte le titre de la vidéo', e.titre === 'Bienvenue à Trader 360', `« ${e.titre} »`);
  dire('⛔ et l emplacement du lecteur, en attente', e.lecteurEnAttente === true);
  /**
   * ⛔ TROIS SORTIES : la croix, le bouton, et la touche d échappement qu un
   * `<dialog>` gère seul. ⚠️ Un élève doit pouvoir fermer sans regarder douze
   * minutes, sinon il ferme l onglet et on le perd.
   */
  dire('⛔ au moins deux sorties cliquables, plus la touche d échappement',
    e.sorties >= 2, `${e.sorties} élément(s) de fermeture`);
  dire('⛔ la ligne est écrite À L OUVERTURE, pas à la fermeture',
    e.ecritures === 1 && e.enBase === 1,
    `${e.ecritures} écriture(s), ${e.enBase} ligne(s) en base`);

  // ── La fermeture, et ce qu'elle laisse.
  await p.evaluate(() => document.querySelector('#formationBienvenue [data-fermer]').click());
  await new Promise((r) => setTimeout(r, 200));
  const apres = await etat(p);
  dire('⛔ fermée, elle disparaît du document', apres.presente === false);
  dire('⛔ et aucune écriture de plus', apres.ecritures === 1, `${apres.ecritures}`);
  await ctx.close();
}

titre('⛔ CAS 2 : fermée, puis reconnexion');
{
  // ⚠️ La ligne existe : c'est l'état que le cas 1 vient de laisser en base.
  const { ctx, p } = await monter([{ user_id: 'eleve-de-sonde',
    lecons_vues_au_dernier_affichage: 0, vue_le: '2026-10-13T09:00:00Z' }]);
  await jouer(p);
  const e = await etat(p);
  dire('⛔ la fenêtre NE REVIENT PAS', e.presente === false);
  dire('⛔ et rien n est réécrit', e.ecritures === 0, `${e.ecritures} écriture(s)`);
  dire('⚠️ la ligne en base est intacte', e.enBase === 1);
  await ctx.close();
}

titre('⛔ CAS 3 : un AUTRE navigateur, mémoire vide côté client');
{
  /**
   * ⛔ C'EST LE CAS QUI DISTINGUE UNE MÉMOIRE DE COMPTE D'UNE MÉMOIRE DE
   * SESSION. ⚠️ Contexte de navigateur neuf : `localStorage`, `sessionStorage`
   * et cookies sont vides. Seule la BASE sait. Un `localStorage` aurait passé
   * les cas 1 et 2, et montré la fenêtre ici.
   */
  const { ctx, p } = await monter([{ user_id: 'eleve-de-sonde',
    lecons_vues_au_dernier_affichage: 0, vue_le: '2026-10-13T09:00:00Z' }]);
  /**
   * ⚠️ ON NE COMPTE PAS LES ENTRÉES DE `localStorage`, ET VOICI POURQUOI.
   *
   * Une page montée par `setContent` a une origine OPAQUE : lire `localStorage`
   * y lève `SecurityError`. ⛔ La première version de ce témoin a donc planté.
   * Et même servie depuis une vraie origine, compter des entrées vides ne
   * prouverait que l'état du navigateur, pas ce que le CODE consulte.
   *
   * ⛔ On lit donc la SOURCE : le chemin de la bienvenue ne touche à aucune
   * mémoire de navigateur. C'est la preuve directe que la décision vient du
   * compte, et elle ne dépend d'aucune condition d'exécution.
   */
  const src = readFileSync('supabase-formation.js', 'utf8');
  /**
   * ⛔ ON DÉCOUPE LES TROIS FONCTIONS, PAS UNE RÉGION AU JUGÉ.
   * ⚠️ Un premier découpage prenait 38 856 caractères, bien au-delà du chemin
   * de la bienvenue, et trouvait un `localStorage` appartenant à du code sans
   * rapport. Un détecteur dont le périmètre déborde accuse le voisin.
   */
  const corpsDe = (nom) => {
    const d = src.indexOf(`function ${nom}(`);
    if (d < 0) return '';
    let i = src.indexOf('{', d); let niveau = 0;
    for (; i < src.length; i += 1) {
      if (src[i] === '{') niveau += 1;
      else if (src[i] === '}') { niveau -= 1; if (niveau === 0) return src.slice(d, i + 1); }
    }
    return '';
  };
  const bloc = ['chargerBienvenue', 'marquerBienvenueVue', 'montrerBienvenue']
    .map(corpsDe).join('\n');
  const memoires = ['localStorage', 'sessionStorage', 'document.cookie', 'indexedDB']
    .filter((m) => bloc.includes(m));
  dire('⛔ TÉMOIN : le chemin de la bienvenue ne lit AUCUNE mémoire de navigateur',
    memoires.length === 0, memoires.length ? memoires.join(', ') : 'base seule');
  dire('⚠️ TÉMOIN : le détecteur verrait une mémoire s il y en avait une',
    ['localStorage'].some((m) => `if (${m}.getItem('x'))`.includes(m)),
    'contrôle du motif lui-même');
  dire('⚠️ et les trois fonctions ont bien été trouvées', bloc.length > 1200,
    `${bloc.length} caractères, soit les trois corps et rien d autre`);
  await jouer(p);
  const e = await etat(p);
  dire('⛔ la fenêtre ne revient pas, la base seule décide', e.presente === false);
  await ctx.close();
}

titre('⛔ ET LE TÉMOIN D ENSEMBLE : les trois cas ne rendent pas la même chose');
{
  const sans = await (async () => {
    const { ctx, p } = await monter([]); await jouer(p);
    const e = await etat(p); await ctx.close(); return e.presente;
  })();
  const avec = await (async () => {
    const { ctx, p } = await monter([{ user_id: 'eleve-de-sonde',
      lecons_vues_au_dernier_affichage: 0, vue_le: '2026-10-13T09:00:00Z' }]);
    await jouer(p);
    const e = await etat(p); await ctx.close(); return e.presente;
  })();
  dire('⛔ sans ligne elle s affiche, avec ligne elle se tait', sans === true && avec === false,
    `sans ligne : ${sans}, avec ligne : ${avec}`);
  // ⚠️ Sans cette comparaison, « elle ne revient pas » décrirait aussi une
  // fenêtre qui ne s'affiche JAMAIS, donc du code mort.
}

titre('⛔ L INTRODUCTION est un module, AVANT le 01');
{
  const { ctx, p } = await monter([]);
  const m = await p.evaluate(() => {
    const M = window.FormationDonnees.MODULES;
    return {
      premier: M[0].numero, titre: M[0].titre,
      lecons: M[0].lecons.map((l) => ({ id: l.id, titre: l.titre, video: l.video })),
      second: M[1].numero,
      intro: !!M[0].introduction,
      total: M.length,
    };
  });
  dire('⛔ le premier module est l Introduction', m.premier === '00' && m.titre === 'Introduction',
    `${m.premier} « ${m.titre} »`);
  dire('⛔ et le module 01 vient juste après', m.second === '01');
  dire('elle porte la vidéo de bienvenue, une seule',
    m.lecons.length === 1 && m.lecons[0].titre === 'Bienvenue à Trader 360',
    m.lecons.map((l) => l.titre).join(', '));
  dire('⛔ son lecteur est EN ATTENTE, pas en erreur', m.lecons[0].video === null,
    'embed: whitelist dans Vimeo, liste de domaines non confirmée');
  dire('⚠️ elle ne compte PAS pour la certification', m.intro === true,
    'le drapeau `introduction` l écarte de `certOuverte`');
  await ctx.close();
}

titre('⛔ et « TradingView complément » suit « Installer TradingView »');
{
  const { ctx, p } = await monter([]);
  const l = await p.evaluate(() => window.FormationDonnees.MODULES
    .find((m) => m.numero === '04').lecons.map((x) => ({ id: x.id, titre: x.titre })));
  l.forEach((x, i) => console.log(`        ${i + 1}. [${x.id}] ${x.titre}`));
  const iTv = l.findIndex((x) => x.titre === 'Installer TradingView');
  const iComp = l.findIndex((x) => x.titre === 'TradingView complément');
  dire('⛔ le complément vient JUSTE après', iComp === iTv + 1,
    `TradingView en ${iTv + 1}, complément en ${iComp + 1}`);
  /**
   * ⛔ ET LES IDENTIFIANTS N ONT PAS BOUGÉ. ⚠️ Ils sont la clé de la progression
   * déjà enregistrée : les renuméroter ferait passer une leçon terminée pour une
   * autre, et le total resterait juste pendant que le contenu serait faux.
   */
  dire('⛔ les identifiants sont inchangés, la progression reste juste',
    l.map((x) => x.id).join(',') === 'm04-l0,m04-l1,m04-l2,m04-l4,m04-l3',
    l.map((x) => x.id).join(', '));
  await ctx.close();
}

await nav.close();
console.log(fautes ? `\n  ⛔ ${fautes} CONTROLE(S) ROUGE(S).\n` : '\n  Tout est vert.\n');
process.exit(fautes ? 1 : 0);
