/**
 * Eprouve le lot 5 : la charge a 64 lecons, l'export, le compteur, la
 * progression coach.
 *
 * ⚠️ LES MESURES SONT FAITES SUR UNE STRUCTURE GONFLEE A 64 LECONS ET
 * 64 NOTES. ⛔ Une mesure a sept lecons ne dit rien de soixante-quatre : c'est
 * precisement parce que le defaut est invisible a sept qu'il fallait le gonfler.
 *
 * Usage : node outils/formation-lot5.mjs 4419
 */
const CHEMIN = '/Users/nadirkasmi/Projets/trader360-site/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
let puppeteer;
try { ({ default: puppeteer } = await import(CHEMIN)); }
catch (e) { console.error(`\n  ⛔ puppeteer-core introuvable : ${e.message}`); process.exit(1); }

const PORT = process.argv[2] ?? '4419';
let fautes = 0;
const dire = (nom, ok, detail) => {
  if (!ok) fautes += 1;
  console.log(`     ${ok ? 'ok ' : '⛔ '} ${nom}${detail ? `  ${detail}` : ''}`);
};

const nav = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check'],
});

/**
 * Prepare une page avec un double QUI COMPTE. Chaque `select` est enregistre
 * avec ses colonnes et le poids de ce qu'il rend : c'est la seule facon de
 * comparer « avant » et « apres » sur le meme banc.
 */
async function preparer(page, opts = {}) {
  const { lecons = 64, notes = 64, eleves = 0, demandes = 0, texteNote = null } = opts;
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.evaluate((nbLecons, nbNotes, nbEleves, nbDemandes, txtNote) => {
    // ── La structure, gonflee aux 64 lecons ──────────────────────────────
    const D = window.FormationDonnees;
    const parModule = Math.ceil(nbLecons / D.MODULES.length);
    let n = 0;
    D.MODULES.forEach((m) => {
      m.lecons = [];
      for (let i = 0; i < parModule && n < nbLecons; i += 1, n += 1) {
        m.lecons.push({ id: `g-${n}`, titre: `Lecon gonflee ${n}`, description: '', video: null });
      }
    });
    D.SUITE.length = 0;
    D.MODULES.forEach((m) => m.lecons.forEach((l) =>
      D.SUITE.push(Object.assign({}, l, { module: m.numero }))));

    const LONGUEUR = 900;  // une note de cours realiste, pas une ligne
    const TEXTE = txtNote || 'x'.repeat(LONGUEUR);
    const NOTES = [];
    for (let i = 0; i < nbNotes; i += 1) NOTES.push({ lecon_id: `g-${i}`, texte: TEXTE });
    const PROG = [];
    for (let i = 0; i < Math.min(12, nbLecons); i += 1) {
      PROG.push({ lecon_id: `g-${i}`, vue: true, progress_seconds: 60 + i,
        last_watched_at: new Date(Date.now() - i * 3600000).toISOString() });
    }
    const ELEVES = [];
    for (let i = 0; i < nbEleves; i += 1) {
      ELEVES.push({ user_id: `e-${i}`, name: `Eleve ${i}`, email: `e${i}@x.fr`,
        lecons_vues: i % 20, notes_ecrites: i % 5,
        derniere_activite: i % 7 === 0 ? null : new Date(Date.now() - i * 86400000).toISOString() });
    }
    const DEMANDES = [];
    for (let i = 0; i < nbDemandes; i += 1) {
      DEMANDES.push({ user_id: `d-${i}`, journal_demande_le: new Date().toISOString() });
    }

    window.__req = [];
    const poids = (x) => new Blob([JSON.stringify(x)]).size;
    const faire = () => {
      const t = (nom) => {
        let colonnes = '';
        let compte = false;
        const rendre = (donnees) => {
          window.__req.push({ table: nom, colonnes, octets: poids(donnees) });
          return { data: donnees, error: null, count: donnees.length };
        };
        const b = {
          select(c, o) { colonnes = c || ''; compte = !!(o && o.count); return b; },
          /**
           * ⚠️ `not()` DOIT ETRE « THENABLE », et il ne l etait pas.
           * Le vrai constructeur PostgREST se resout quand on l attend :
           * `await from(...).select(..., {count}).not(...)` rend
           * `{ data, count, error }`. Mon double rendait l objet lui-meme, dont
           * `count` etait `undefined`, et la sonde concluait « zero demande »
           * sur un compteur parfaitement juste. ⛔ Le double accusait le code.
           */
          not() {
            if (!compte) return b;
            return Object.assign(b, {
              then: (ok, ko) => Promise.resolve({
                data: null, count: DEMANDES.length, error: null,
              }).then(ok, ko),
            });
          },
          in: () => Promise.resolve(rendre([])),
          order: () => Promise.resolve(rendre(
            nom === 'coach_formation_overview' ? ELEVES
              : nom === 'acces_membre' ? DEMANDES : [])),
          eq() {
            const data = nom === 'formation_progression' ? PROG
              : nom === 'formation_notes'
                ? (colonnes.includes('texte') ? NOTES : NOTES.map((x) => ({ lecon_id: x.lecon_id })))
                : [];
            const un = nom === 'formation_parcours_vu'
              ? { lecons_vues_au_dernier_affichage: 99, vue_le: new Date().toISOString() }
              : nom === 'formation_notes'
                ? (NOTES.find((x) => x.lecon_id === window.__leconDemandee) || null)
                : { formation_actif: true, journal_actif: true };
            return Object.assign(b, {
              maybeSingle: () => { window.__req.push({ table: nom, colonnes, octets: poids(un) }); return Promise.resolve({ data: un, error: null }); },
              then: (ok, ko) => Promise.resolve(rendre(data)).then(ok, ko),
            });
          },
          upsert(l) { window.__req.push({ table: nom, colonnes: 'upsert', octets: poids(l) }); return Promise.resolve({ error: null }); },
          update(l) { window.__req.push({ table: nom, colonnes: 'update', octets: poids(l) }); return { eq: () => Promise.resolve({ error: null }) }; },
        };
        return b;
      };
      window.supabaseClient = { from: t, auth: {
        getUser: async () => ({ data: { user: { id: 'u' } } }),
        getSession: async () => ({ data: { session: { user: { id: 'u' }, access_token: 'j' } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
      window.__NOTES = NOTES;
      window.__DEMANDES = DEMANDES;
    };
    faire();
    window.currentUser = { role: 'student', uuid: 'u' };
    ['authScreen', 'choixEspace', 'coachApp'].forEach((id) => {
      const e = document.getElementById(id);
      if (e) e.style.setProperty('display', 'none', 'important');
    });
    document.getElementById('mainApp').style.setProperty('display', 'flex', 'important');
    document.querySelectorAll('#mainApp .section').forEach((s) => s.classList.add('hidden'));
    document.getElementById('formation').classList.remove('hidden');
  }, lecons, notes, eleves, demandes, texteNote);
}

/* ══ 1. LA CHARGE A 64 LECONS : AVANT ET APRES ═════════════════════════════ */
console.log('\n  ══ OUVERTURE DU SOMMAIRE, 64 LECONS ET 64 NOTES DE 900 CARACTERES ══');
{
  const p = await nav.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await preparer(p);
  const r = await p.evaluate(async () => {
    window.__req = [];
    const t0 = performance.now();
    await window.Formation.ouvrir();
    const apres = { ms: performance.now() - t0, req: window.__req.slice() };

    // ⚠️ « AVANT » REJOUE SUR LE MEME BANC : la requete que l ancienne version
    // emettait, mot pour mot. ⛔ Comparer a une mesure prise ailleurs, un autre
    // jour, ne vaudrait rien.
    window.__req = [];
    const t1 = performance.now();
    await window.supabaseClient.from('formation_progression')
      .select('lecon_id, vue, progress_seconds').eq('user_id', 'u');
    await window.supabaseClient.from('formation_notes')
      .select('lecon_id, texte').eq('user_id', 'u');
    const avant = { ms: performance.now() - t1, req: window.__req.slice() };
    return { avant, apres };
  });
  const somme = (x) => x.req.reduce((t, q) => t + q.octets, 0);
  const avantO = somme(r.avant); const apresO = somme(r.apres);
  console.log(`     AVANT  ${r.avant.req.length} requetes  ${avantO} octets`);
  r.avant.req.forEach((q) => console.log(`              ${q.table} (${q.colonnes}) ${q.octets} o`));
  console.log(`     APRES  ${r.apres.req.length} requetes  ${apresO} octets  ${r.apres.ms.toFixed(0)} ms jusqu au sommaire`);
  r.apres.req.forEach((q) => console.log(`              ${q.table} (${q.colonnes}) ${q.octets} o`));
  const gain = avantO ? Math.round((1 - apresO / avantO) * 100) : 0;
  console.log(`     ⚠️ ${gain} % de volume en moins a l ouverture`);
  dire('⛔ le texte des notes ne part plus a l ouverture',
    !r.apres.req.some((q) => q.table === 'formation_notes' && q.colonnes.includes('texte')));
  dire('le volume baisse d au moins 90 %', gain >= 90, `${gain} %`);
  dire('⚠️ TEMOIN : « avant » transferait bien les 64 textes',
    avantO > 50000, `${avantO} octets`);

  // Et la lecon charge SA note, une seule.
  const u = await p.evaluate(async () => {
    window.__leconDemandee = 'g-0';
    window.__req = [];
    window.Formation.ouvrirLecon('g-0');
    await new Promise((res) => setTimeout(res, 400));
    return window.__req.filter((q) => q.table === 'formation_notes');
  });
  dire('une lecon ne charge QUE sa note', u.length === 1, `${u.length} requete(s), ${u.reduce((t, q) => t + q.octets, 0)} o`);
  await p.close();
}

/* ══ 2. L EXPORT ═══════════════════════════════════════════════════════════ */
console.log('\n  ══ L EXPORT DES NOTES ══');
{
  // ⚠️ LE TEXTE QUI CASSE CE GENRE DE FONCTION : apostrophe, retour a la ligne,
  // accents, et un guillemet pour faire bonne mesure.
  const PIEGE = "J'ai compris l'idee.\nDeuxieme ligne : enchainer, repeter, preciser.\nTroisieme \"citation\" avec des accents : eleve, maitrise, reguliere.";
  const p = await nav.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await preparer(p, { lecons: 10, notes: 10, texteNote: PIEGE });
  const r = await p.evaluate(async () => {
    await window.Formation.ouvrir();
    const res = await window.Formation.exporterNotes();
    return { notes: res.notes, contenu: res.contenu };
  });
  console.log(`     ${r.notes} notes exportees, ${r.contenu.length} caracteres`);
  console.log(`     extrait : « ${r.contenu.split('\n').slice(4, 8).join(' / ')} »`);
  dire("l apostrophe survit", r.contenu.includes("J'ai compris l'idee"));
  dire('les retours a la ligne survivent', r.contenu.includes('Deuxieme ligne'));
  dire('les accents survivent', /eleve, maitrise, reguliere/.test(r.contenu));
  dire('les guillemets survivent', r.contenu.includes('"citation"'));
  dire('⚠️ le titre de la lecon precede chaque note', /--- Lecon gonflee 0 ---/.test(r.contenu));
  dire('⚠️ la marque d ordre des octets est en tete, pour Excel',
    r.contenu.charCodeAt(0) === 0xFEFF, `U+${r.contenu.charCodeAt(0).toString(16).toUpperCase()}`);
  // ⚠️ TEMOIN : un contenu qui aurait ete echappe en HTML se verrait.
  dire('⛔ TEMOIN : aucun echappement HTML ne s est glisse',
    !/&#39;|&quot;|&amp;/.test(r.contenu));
  await p.close();
}

/* ══ 3. LE COMPTEUR, A ZERO ET A DEUX ══════════════════════════════════════ */
console.log('\n  ══ LE COMPTEUR DE DEMANDES ══');
for (const n of [0, 2]) {
  const p = await nav.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await preparer(p, { demandes: n });
  const r = await p.evaluate(async () => {
    const compte = await window.DemandesJournal.majCompteur();
    const b = document.getElementById('coachBadgeDemandes');
    return { compte, masque: b.hidden, texte: b.textContent, aria: b.getAttribute('aria-label') };
  });
  console.log(`     ${n} demande(s) : badge ${r.masque ? 'masque' : `visible « ${r.texte} »`}`);
  dire(n === 0 ? '⛔ a zero, RIEN ne s affiche' : 'a deux, le badge montre 2',
    n === 0 ? r.masque : (!r.masque && r.texte === '2'));
  if (n === 2) dire('  et il se dit aux lecteurs d ecran', /2 demande/.test(r.aria || ''), r.aria);
  await p.close();
}

/* ══ 4. LA PROGRESSION COACH : LE COMPTE NE CROIT PAS AVEC LES ELEVES ══════ */
console.log('\n  ══ LA PROGRESSION COACH ══');
{
  const comptes = [];
  for (const n of [2, 100]) {
    const p = await nav.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    await preparer(p, { eleves: n });
    const r = await p.evaluate(async () => {
      window.__req = [];
      await window.DemandesJournal.chargerProgression();
      return {
        requetes: window.__req.length,
        lignes: document.querySelectorAll('#coachProgressionFormation tbody tr').length,
        absents: document.querySelectorAll('#coachProgressionFormation .coach-absent').length,
        // ⛔ Aucun texte de note ne doit apparaitre.
        texteNote: /x{50,}/.test(document.getElementById('coachProgressionFormation').textContent),
      };
    });
    comptes.push(r.requetes);
    console.log(`     ${n} eleves : ${r.requetes} requete(s), ${r.lignes} lignes, ${r.absents} signales absents`);
    dire(`  ${n} eleves affiches`, r.lignes === n, String(r.lignes));
    dire('  ⛔ aucun texte de note affiche', !r.texteNote);
    await p.close();
  }
  dire('⚠️ TEMOIN : le compte de requetes ne croit PAS avec le nombre d eleves',
    comptes[0] === comptes[1] && comptes[0] === 1, `${comptes[0]} puis ${comptes[1]}`);
}

await nav.close();
console.log(fautes === 0 ? '\n  Tout est vert.' : `\n  ⛔ ${fautes} ecart(s).`);
process.exit(fautes === 0 ? 0 : 1);
