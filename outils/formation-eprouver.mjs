/**
 * Éprouve l'espace formation : rendu, thèmes, écritures et reprise de lecture.
 *
 * ── ⚠️ CE QUE CETTE SONDE MESURE, ET CE QU'ELLE NE MESURE PAS ────────────────
 *
 * Elle NE prouve PAS que les notes survivent à un changement de navigateur. Cela
 * demande une session d'élève réelle et les deux tables appliquées en base ;
 * ⛔ les tables ne sont pas appliquées, et ⛔ on ne se connecte pas sur le compte
 * d'un élève. Ce contrôle est donc rapporté comme NON FAIT, pas contourné.
 *
 * Ce qu'elle mesure vraiment, et qui ne dépend pas d'une session :
 *   1. Le rendu des trois vues, dans les deux thèmes, à quatre tailles.
 *   2. Le NOMBRE d'écritures pendant une minute de lecture simulée. C'est le
 *      contrôle 5 ter : si ce nombre suit la cadence de `timeupdate`, c'est que
 *      l'espacement de dix secondes n'a pas été repris.
 *   3. La reprise de lecture : `setCurrentTime` doit être appelé avec la position
 *      enregistrée. ⚠️ Avec un témoin, une leçon JAMAIS ouverte, pour laquelle
 *      `setCurrentTime` ne doit PAS être appelé du tout. Sans ce témoin, un
 *      lecteur qui démarre toujours au début serait indiscernable d'une reprise
 *      réussie sur une vidéo à peine entamée.
 *
 * ── ⚠️ POURQUOI UN DOUBLE DE SUPABASE, ET CE QUE ÇA COÛTE ────────────────────
 * Le double compte les appels et rend des lignes choisies. Il laisse donc hors de
 * portée tout ce qui dépend du vrai service : RLS, contraintes, conflits. C'est
 * assumé et dit, pas masqué.
 *
 * Usage : node outils/formation-eprouver.mjs 4410
 */
import { mkdirSync } from 'node:fs';

/**
 * ⚠️ `puppeteer-core` N'EST PAS UNE DÉPENDANCE DE CE DÉPÔT, et on ne l'y ajoute
 * pas pour une sonde. Il est résolu depuis le dépôt du site, où il sert déjà.
 * ⛔ Si ce chemin n'existe pas, la sonde s'arrête en le disant : une sonde qui ne
 * tourne pas doit se taire bruyamment, pas être confondue avec une sonde verte.
 */
const CHEMIN_PUPPETEER = '/Users/nadirkasmi/Projets/trader360-site/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
let puppeteer;
try {
  ({ default: puppeteer } = await import(CHEMIN_PUPPETEER));
} catch (e) {
  console.error(`\n  ⛔ puppeteer-core introuvable : ${CHEMIN_PUPPETEER}\n     ${e.message}`);
  process.exit(1);
}

const PORT = process.argv[2] ?? '4410';
const SORTIE = process.argv[3] ?? 'captures/formation';
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
mkdirSync(SORTIE, { recursive: true });

let fautes = 0;
const dire = (nom, ok, detail) => {
  if (!ok) fautes += 1;
  console.log(`     ${ok ? 'ok ' : '⛔ '} ${nom}${detail ? `  ${detail}` : ''}`);
};

const nav = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check'],
});

/**
 * Prépare une page : double de Supabase, session feinte, `#mainApp` dévoilé.
 * ⛔ Aucune donnée réelle, aucun compte d'élève, aucune écriture en base.
 */
async function preparer(page, lignesProgression = [], droits = { formation: true, journal: true }) {
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });

  /**
   * ⚠️ LE DOUBLE EST INSTALLÉ APRÈS LE CHARGEMENT, ET C'EST UNE CORRECTION.
   * Posé avant par `evaluateOnNewDocument`, il était ÉCRASÉ par
   * `supabase-config.js`, qui réaffecte `window.supabase` au vrai client. La sonde
   * interrogeait donc la vraie base, trouvait des tables absentes, et rendait une
   * progression vide. ⛔ Elle accusait alors le code d'un défaut qui était le sien :
   * « la position enregistrée n'est pas restituée », alors qu'aucune position
   * n'avait jamais été chargée.
   */
  await page.evaluate((progression, d) => {
    window.__ecritures = [];
    const table = (nom) => ({
      select() { return this; },
      /**
       * ⚠️ `eq()` DOIT RENDRE UN CONSTRUCTEUR DE REQUÊTE, PAS UNE PROMESSE.
       * Le vrai client PostgREST enchaîne `.eq(...).maybeSingle()`. Une première
       * version rendait directement une promesse : `maybeSingle` n'existait pas et
       * la sonde tombait. ⛔ C'était le double qui était faux, pas le code.
       * L'objet rendu est donc « thenable » ET porte `maybeSingle`.
       */
      eq() {
        const liste = { data: nom === 'formation_progression' ? progression : [], error: null };
        const un = { data: { formation_actif: d.formation, journal_actif: d.journal }, error: null };
        return {
          maybeSingle: () => Promise.resolve(un),
          single: () => Promise.resolve(un),
          then: (resoudre, rejeter) => Promise.resolve(liste).then(resoudre, rejeter),
        };
      },
      upsert(ligne) {
        window.__ecritures.push({ table: nom, ligne, t: Date.now() });
        return Promise.resolve({ error: null });
      },
    });
    window.supabase = {
      from: table,
      auth: {
        getUser: async () => ({ data: { user: { id: 'eleve-double-0000' } } }),
        getSession: async () => ({ data: { session: { user: { id: 'eleve-double-0000' } } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      },
    };
    const a = document.getElementById('authScreen');
    if (a) a.style.display = 'none';
    const m = document.getElementById('mainApp');
    if (m) m.style.display = 'flex';
  }, lignesProgression, droits);

  await page.evaluate(() => window.Formation && window.Formation.ouvrir());
  await new Promise((r) => setTimeout(r, 400));
}

/* ══ 1. LE RENDU EXISTE, ET LE BOUTON EST AU BON ENDROIT ════════════════════ */
console.log('\n  ══ STRUCTURE ══');
{
  const p = await nav.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await preparer(p);

  const r = await p.evaluate(() => {
    const acces = document.querySelector('#mainAppSidebar .formation-acces');
    const info = document.getElementById('userInfo');
    const cartes = document.querySelectorAll('#formation .formation-carte');
    return {
      accesPresent: !!acces,
      // ⚠️ « sous le bloc nom et prénom » se VÉRIFIE, il ne se suppose pas :
      // on compare les positions dans le document.
      sousLeNom: !!(acces && info &&
        (info.compareDocumentPosition(acces) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0),
      memeStyle: !!(acces && acces.classList.contains('sidebar-item')),
      modules: cartes.length,
      avecLecons: [...cartes].filter((c) => !c.classList.contains('formation-carte-vide')).length,
      reprise: !!document.querySelector('#formation .formation-btn-or'),
    };
  });
  dire('le bouton « Espace membre » existe', r.accesPresent);
  dire('il est SOUS le bloc nom et prénom', r.sousLeNom);
  dire('il porte le style des autres entrées', r.memeStyle);
  dire('dix modules au sommaire', r.modules === 10, String(r.modules));
  dire('un seul module de démonstration', r.avecLecons === 1, `${r.avecLecons} module(s) avec leçons`);
  dire('un moyen de reprendre est proposé', r.reprise);

  // ⚠️ Arbitrage du 10/10 : le coach a son entree « Formation » lui aussi, et
  // ⛔ SANS `data-droit`, parce qu'il n'a pas de ligne dans `acces_membre`.
  const coach = await p.evaluate(() => {
    const e = document.querySelector('#coachAppSidebar .formation-acces');
    return { present: !!e, sansDroit: !!(e && !e.hasAttribute('data-droit')) };
  });
  dire('le coach a une entrée « Formation »', coach.present);
  dire('⛔ elle ne porte pas `data-droit`, sinon elle serait masquée pour lui', coach.sansDroit);

  // Tache #27, libelle arrete.
  const sousTitre = await p.evaluate(() =>
    document.body.innerHTML.includes('Espace membre Trader 360'));
  dire('le sous-titre de connexion est « Espace membre Trader 360 »', sousTitre);

  // Navigation jusqu'à une leçon, par les vrais chemins de l'interface.
  await p.evaluate(() => window.Formation.ouvrirModule('01'));
  await new Promise((r2) => setTimeout(r2, 200));
  const lignes = await p.evaluate(() => document.querySelectorAll('#formation .formation-lecon-ligne').length);
  dire('sept leçons dans le module 01', lignes === 7, String(lignes));

  await p.evaluate(() => window.Formation.ouvrirLecon('m01-l0'));
  await new Promise((r2) => setTimeout(r2, 200));
  const ordre = await p.evaluate(() => {
    const a = document.querySelector('#formation .formation-titre');
    const d = document.querySelector('#formation .formation-description');
    const v = document.getElementById('formationVideo');
    const n = document.getElementById('formationNote');
    const pos = (x, y) => (x.compareDocumentPosition(y) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    return {
      tout: !!(a && d && v && n),
      descAvantVideo: !!(d && v && pos(d, v)),
      videoAvantNotes: !!(v && n && pos(v, n)),
      dictee: !!(n && n.hasAttribute('data-mic-dictation')),
      caseVue: !!document.getElementById('formationVue'),
    };
  });
  dire('la leçon porte titre, description, vidéo et notes', ordre.tout);
  dire('⚠️ la description est AVANT la vidéo', ordre.descAvantVideo);
  dire('les notes sont APRÈS la vidéo', ordre.videoAvantNotes);
  dire('la zone de notes accepte la dictée vocale', ordre.dictee);
  dire('« Vu » est une case que l\'élève coche', ordre.caseVue);
  await p.close();
}

/* ══ 2. L'ESPACEMENT DES ÉCRITURES (contrôle 5 ter) ═════════════════════════ */
console.log('\n  ══ ÉCRITURES PENDANT UNE MINUTE DE LECTURE ══');
{
  const p = await nav.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await preparer(p);
  const r = await p.evaluate(async () => {
    /* ⚠️ On simule UNE MINUTE en temps accéléré : `timeupdate` à 4 Hz pendant
       60 secondes de vidéo, soit 240 événements. Le temps réel est remplacé par
       un compteur contrôlé, sinon la sonde durerait une minute pour rien. */
    let faux = 1_000_000;
    const vrai = Date.now;
    Date.now = () => faux;

    const ecoutes = {};
    const lecteur = {
      ready: () => Promise.resolve(),
      setCurrentTime(s) { lecteur.pose = s; },
      getCurrentTime: () => Promise.resolve(60),
      on(ev, f) { ecoutes[ev] = f; },
      destroy() {},
    };
    window.Vimeo = { Player: function () { return lecteur; } };
    // ⚠️ Il faut être SUR la leçon : `#formationVideo` n'existe que là. La
    // premiere version posait l'iframe depuis le sommaire et la sonde tombait,
    // ce qui accusait le code d'un defaut qui etait le sien.
    window.Formation.ouvrirLecon('m01-l0');
    await new Promise((res) => setTimeout(res, 200));
    const cadre = document.createElement('iframe');
    document.getElementById('formationVideo').appendChild(cadre);

    window.__ecritures = [];
    window.Formation._brancherLecteur('m01-l0');
    for (let i = 1; i <= 240; i++) {
      faux += 250;                    // 4 evenements par seconde
      await ecoutes.timeupdate({ seconds: i / 4, duration: 600 });
    }
    Date.now = vrai;
    // ⚠️ Un repos AVANT de lire le compteur. Les ecritures partent sans etre
    // attendues ; sans ce repos la sonde lisait zero et accusait le code.
    await new Promise((res) => setTimeout(res, 400));
    return {
      evenements: 240,
      ecritures: window.__ecritures.filter((e) => e.table === 'formation_progression').length,
    };
  });
  console.log(`     ${r.evenements} evenements timeupdate sur une minute simulee`);
  console.log(`     ${r.ecritures} ecriture(s) en base`);
  // 60 s / 10 s d'espacement = 6 au plus. ⛔ 240 voudrait dire aucun espacement.
  dire('⚠️ les écritures sont espacées, pas une par événement',
    r.ecritures <= 7, `${r.ecritures} au lieu de ${r.evenements}`);
  dire('⛔ et il y en a quand même : la position est bien suivie', r.ecritures >= 5, String(r.ecritures));
  await p.close();
}

/* ══ 3. LA REPRISE DE LECTURE, AVEC SON TÉMOIN ═════════════════════════════ */
console.log('\n  ══ REPRISE DE LECTURE ══');
{
  const p = await nav.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  // Une leçon avancée à 137 secondes, l'autre jamais ouverte.
  await preparer(p, [{ lecon_id: 'm01-l1', vue: false, progress_seconds: 137 }]);

  const r = await p.evaluate(async () => {
    const essai = async (leconId) => {
      const lecteur = {
        appels: [],
        ready: () => Promise.resolve(),
        setCurrentTime(s) { lecteur.appels.push(s); },
        getCurrentTime: () => Promise.resolve(0),
        on() {}, destroy() {},
      };
      window.Vimeo = { Player: function () { return lecteur; } };
      window.Formation.ouvrirLecon(leconId);
      await new Promise((res) => setTimeout(res, 150));
      const cadre = document.createElement('iframe');
      document.getElementById('formationVideo').appendChild(cadre);
      window.Formation._brancherLecteur(leconId);
      await new Promise((res) => setTimeout(res, 250));
      return lecteur.appels;
    };
    return { avancee: await essai('m01-l1'), temoin: await essai('m01-l2') };
  });
  console.log(`     lecon avancee  : setCurrentTime appele avec ${JSON.stringify(r.avancee)}`);
  console.log(`     temoin, jamais ouverte : setCurrentTime appele avec ${JSON.stringify(r.temoin)}`);
  dire('la position enregistrée est restituée', r.avancee.length === 1 && r.avancee[0] === 137,
    `${JSON.stringify(r.avancee)} au lieu de [137]`);
  dire('⚠️ TÉMOIN : une leçon jamais ouverte ne déclenche AUCUNE reprise',
    r.temoin.length === 0, JSON.stringify(r.temoin));
  await p.close();
}

/* ══ 3 bis. LES QUATRE COMBINAISONS DE DROITS ══════════════════════════════
   ⚠️ CE QUE CE BLOC MESURE EST L'INTERFACE, PAS LA SÉCURITÉ. Il dit quelles
   portes sont montrées. ⛔ Il ne dit RIEN de ce qui est réellement refusé : la
   barrière est dans les politiques RLS, et elle ne peut pas être mesurée tant que
   `migrations/01-acces-membre.sql` n'est pas appliquée. C'est rapporté comme non
   fait, pas contourné. */
console.log('\n  ══ LES QUATRE COMBINAISONS DE DROITS ══');
for (const [f, j, attendu] of [
  [true, true, 'les deux boutons, on choisit'],
  [true, false, 'formation seule, on y entre directement'],
  [false, true, 'journal seul, on y entre directement'],
  [false, false, 'aucun droit : un message, jamais une page blanche'],
]) {
  const p2 = await nav.newPage();
  await p2.setViewport({ width: 1440, height: 900 });
  await preparer(p2, [], { formation: f, journal: j });
  const r = await p2.evaluate(async () => {
    document.getElementById('mainApp').style.display = 'none';
    await window.Acces.orienter();
    const vu = (el) => !!(el && !el.hidden && el.offsetParent !== null);
    const choix = document.getElementById('choixEspace');
    return {
      choixVisible: !!(choix && choix.style.display !== 'none'),
      appVisible: document.getElementById('mainApp').style.display !== 'none',
      boutonFormation: vu(document.querySelector('#choixEspace [data-droit="formation"]')),
      boutonJournal: vu(document.querySelector('#choixEspace [data-droit="journal"]')),
      message: vu(document.getElementById('choixAucunDroit')),
      entreeFormation: vu(document.querySelector('#mainAppSidebar [data-droit="formation"]')),
      section: location.pathname,
      ecranBlanc: document.body.innerText.trim().length === 0,
    };
  });
  console.log(`\n     formation ${f ? 'oui' : 'non'}, journal ${j ? 'oui' : 'non'}  →  ${attendu}`);
  console.log(`       ecran de choix ${r.choixVisible ? 'visible' : 'masque'}  ·  application ${r.appVisible ? 'visible' : 'masquee'}`
    + `  ·  bouton formation ${r.boutonFormation}  ·  bouton journal ${r.boutonJournal}`
    + `  ·  message ${r.message}  ·  chemin ${r.section}`);
  dire('  ⛔ jamais un écran blanc', !r.ecranBlanc);
  if (f && j) {
    dire('  les deux boutons sont proposés', r.boutonFormation && r.boutonJournal);
    dire('  on n entre pas sans avoir choisi', !r.appVisible);
  } else if (f !== j) {
    dire('  on entre directement, sans choix', r.appVisible && !r.choixVisible);
    dire(`  destination ${f ? '/formation' : '/dashboard'}`,
      r.section === (f ? '/formation' : '/dashboard'), r.section);
    dire('  l entrée « Formation » de la barre latérale suit le droit',
      r.entreeFormation === f, String(r.entreeFormation));
  } else {
    dire('  un message explique et invite à écrire', r.message);
    dire('  ⛔ aucune porte n est montrée', !r.boutonFormation && !r.boutonJournal);
    dire('  ⛔ l application reste fermée', !r.appVisible);
  }
  await p2.close();
}

/* ══ 4. CAPTURES, DEUX THÈMES, QUATRE TAILLES ══════════════════════════════ */
console.log('\n  ══ CAPTURES ══');
{
  const TAILLES = [[1440, 900], [1440, 620], [390, 844], [390, 620]];
  const VUES = [
    ['connexion', () => {
      document.getElementById('mainApp').style.display = 'none';
      document.getElementById('choixEspace').style.display = 'none';
      document.getElementById('authScreen').style.display = 'flex';
    }],
    ['choix', () => {
      document.getElementById('authScreen').style.display = 'none';
      document.getElementById('mainApp').style.display = 'none';
      document.getElementById('choixEspace').style.display = 'flex';
      window.Acces._poser({ formation: true, journal: true });
      window.Acces.appliquer();
    }],
    ['sommaire', () => { window.__formation(); window.Formation.ouvrirSommaire(); }],
    ['module', () => { window.__formation(); window.Formation.ouvrirModule('01'); }],
    ['lecon', () => { window.__formation(); window.Formation.ouvrirLecon('m01-l0'); }],
  ];

  /**
   * ⚠️ CETTE AIDE EST UNE CORRECTION, ET ELLE MÉRITE D'ÊTRE DITE. La première
   * version rendait le sommaire dans `#formationContenu` SANS jamais afficher la
   * section : les captures montraient le tableau de bord, et le contrôle « 40
   * captures » passait au vert en ne mesurant rien. Un compteur de fichiers ne dit
   * pas ce qu'il y a dedans.
   */
  const AFFICHER_FORMATION = () => {
    // ⛔ `#coachApp` AUSSI. La deuxieme version l avait oublie : l interface coach
    // restait posee par-dessus, et les captures montraient « Eleves actifs » et
    // « Performance par Heure (tous eleves) » au lieu de la formation. Le temoin
    // de contenu ne l avait pas vu parce qu il ne regardait que `#formation`.
    // ⛔ `setProperty(..., 'important')` ET PAS `style.display = 'none'`.
    // `index.html` porte `#mainApp.flex, #coachApp.flex { display: block !important }`.
    // Un style en ligne ordinaire perd contre `!important` : l interface coach
    // restait affichee par-dessus la formation, et ⛔ RIEN NE LE SIGNALAIT, puisque
    // l attribut `style` valait bien « none ». C est la meme classe de defaut que
    // `[hidden]` neutralise par une classe d auteur.
    ['authScreen', 'choixEspace', 'coachApp'].forEach((id) => {
      const e = document.getElementById(id);
      if (e) e.style.setProperty('display', 'none', 'important');
    });
    document.getElementById('mainApp').style.setProperty('display', 'flex', 'important');
    document.querySelectorAll('#mainApp .section').forEach((s) => s.classList.add('hidden'));
    document.getElementById('formation').classList.remove('hidden');
  };
  let n = 0;
  for (const sombre of [false, true]) {
    for (const [l, h] of TAILLES) {
      const p = await nav.newPage();
      await p.setViewport({ width: l, height: h, deviceScaleFactor: 2 });
      await preparer(p);
      await p.evaluate((d) => {
        document.body.classList.toggle('dark-mode', d);
        localStorage.setItem('theme', d ? 'dark' : 'light');
      }, sombre);
      await p.evaluate(`window.__formation = ${AFFICHER_FORMATION.toString()}`);
      for (const [nom, aller] of VUES) {
        await p.evaluate(aller);
        await new Promise((r) => setTimeout(r, 400));
        /* ⚠️ ON REMASQUE JUSTE AVANT DE DÉCLENCHER. L'initialisation de
           l'application réaffiche `#coachApp` de façon asynchrone, APRÈS notre
           premier masquage : les captures montraient alors « Élèves actifs » et
           « Performance par Heure (tous élèves) ». Le témoin ne l'avait pas vu
           parce qu'il lisait tout de suite, avant que l'init n'ait repris la main. */
        if (nom !== 'connexion' && nom !== 'choix') await p.evaluate(() => window.__formation());
        await new Promise((r) => setTimeout(r, 150));
        const f = `${SORTIE}/${sombre ? 'sombre' : 'clair'}-${nom}-${l}x${h}.png`;
        await p.screenshot({ path: f });
        n += 1;
      }
      await p.close();
    }
  }
  console.log(`     ${n} captures ecrites dans ${SORTIE}/`);
  dire('40 captures : 5 vues x 4 tailles x 2 themes', n === 40, String(n));
  {
    // ⚠️ TÉMOIN DE CONTENU. Sans lui, quarante fichiers d'une page quelconque
    // rendraient exactement le même « ok » que quarante captures justes.
    const p3 = await nav.newPage();
    await p3.setViewport({ width: 1440, height: 900 });
    await preparer(p3);
    await p3.evaluate(`window.__formation = ${AFFICHER_FORMATION.toString()}`);
    // ⚠️ Le témoin attend, lui aussi : lire tout de suite, c'était lire avant que
    // l'initialisation n'ait eu le temps de défaire le masquage.
    await p3.evaluate(() => { window.__formation(); window.Formation.ouvrirSommaire(); });
    await new Promise((r) => setTimeout(r, 600));
    const r = await p3.evaluate(() => {
      window.__formation();
      const f = document.getElementById('formation');
      const d = document.getElementById('dashboard');
      return {
        formationVisible: !!(f && !f.classList.contains('hidden') && f.offsetParent !== null),
        dashboardMasque: !!(d && d.classList.contains('hidden')),
        cartes: document.querySelectorAll('#formation .formation-carte').length,
        // ⚠️ Et on lit ce qui est REELLEMENT a l ecran, pas seulement l etat des
        // noeuds : un texte de l interface coach suffit a trahir un recouvrement.
        // ⚠️ STYLE CALCULE, pas attribut. La version precedente lisait
        // `style.display`, qui valait « none » alors que la regle `!important`
        // imposait « block » : le temoin passait au vert sur une interface
        // parfaitement visible.
        coachMasque: (() => {
          const c = document.getElementById('coachApp');
          return !!c && getComputedStyle(c).display === 'none';
        })(),
        texteCoach: /Eleves actifs|Élèves actifs|tous élèves/i.test(document.body.innerText),
        texteFormation: document.body.innerText.includes('Se préparer mentalement'),
      };
    });
    dire('⚠️ ce qui est capturé EST la formation, pas un autre tableau de bord',
      r.formationVisible && r.dashboardMasque && r.cartes === 10
      && r.coachMasque && !r.texteCoach && r.texteFormation,
      `formation ${r.formationVisible}, journal masqué ${r.dashboardMasque}, `
      + `coach masqué ${r.coachMasque}, texte coach présent ${r.texteCoach}, `
      + `texte formation présent ${r.texteFormation}, ${r.cartes} cartes`);
    await p3.close();
  }
}

await nav.close();
console.log(fautes === 0
  ? '\n  La structure tient, les ecritures sont espacees, la reprise restitue la position,\n'
    + '  et le temoin montre qu une lecon jamais ouverte ne reprend rien.\n'
    + '  ⛔ NON MESURE : la survie des notes a un changement de navigateur. Elle demande\n'
    + '  une session d eleve reelle et les deux tables appliquees en base.'
  : `\n  ⛔ ${fautes} ecart(s).`);
process.exit(fautes === 0 ? 0 : 1);
