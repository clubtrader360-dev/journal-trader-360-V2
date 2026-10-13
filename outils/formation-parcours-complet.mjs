/**
 * LE PARCOURS D'UN ELEVE, DE BOUT EN BOUT.
 *
 * ── ⚠️ POURQUOI CETTE SONDE EXISTE ALORS QUE DEUX AUTRES SONT VERTES ────────
 *
 * Les deux autres verifient des MORCEAUX : le rendu, la reprise, les droits, le
 * clavier. ⛔ AUCUNE NE SUIT UNE PERSONNE DU DEBUT A LA FIN, et c'est le defaut
 * qui est revenu le plus souvent sur ce projet : un module ecrit, teste, et
 * jamais cable. Un test qui s'arrete aux frontieres d'un module ne voit pas un
 * fil manquant entre deux.
 *
 * Le parcours suivi, dans l'ordre reel :
 *
 *    1. il arrive, il n'a QUE la formation
 *    2. il ouvre un chapitre, prend une note, le marque termine
 *    3. il revient le lendemain, dans un navigateur neuf
 *    4. il demande le journal
 *    5. un coach voit la demande et accorde
 *    6. il revient : il a les deux espaces
 *
 * ⚠️ REECRIT AU LOT 10 : les etapes qui visaient la fenetre de parcours et le
 * sommaire en liste ont disparu avec eux. ⛔ Une sonde qu on ne met pas a jour
 * avec l interface finit par eprouver un produit qui n existe plus, en vert.
 *
 * ⚠️ L'ETAT EST PORTE ENTRE LES ETAPES, comme en vrai : ce que l'etape 5 ecrit,
 * l'etape 7 le relit. Un double qui repartirait de zero a chaque etape ne
 * prouverait rien de l'enchainement.
 *
 * Usage : node outils/formation-parcours-complet.mjs 4417
 */
import { mkdirSync } from 'node:fs';

const CHEMIN = '/Users/nadirkasmi/Projets/trader360-site/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
let puppeteer;
try { ({ default: puppeteer } = await import(CHEMIN)); }
catch (e) { console.error(`\n  ⛔ puppeteer-core introuvable : ${e.message}`); process.exit(1); }

const PORT = process.argv[2] ?? '4417';
const SORTIE = 'captures/parcours-complet';
mkdirSync(SORTIE, { recursive: true });

/**
 * ── ⛔ CE QUE RAPPORTE LE PREMIER CHAPITRE, CALCULE A PART ────────────────
 *
 * ⚠️ Cette sonde attendait 100 XP, et c etait le bareme d AVANT le lot 14 :
 * chaque chapitre valait 100. ⛔ Depuis, c est chaque MODULE qui vaut 100,
 * repartis entre ses chapitres, et les deux lignes qui l affirmaient sont
 * restees rouges sur un calcul parfaitement juste.
 *
 * ⛔ LA VALEUR ATTENDUE EST ECRITE AVANT D ETRE LUE, et elle est RECALCULEE
 * ICI depuis la regle, pas demandee a `xpDe()` : ⚠️ interroger la fonction
 * qu on eprouve rendrait le controle vrai quoi qu elle reponde.
 *
 *     module 01, 7 chapitres : 100 / 7 = 14 de base, reste 2
 *     les DEUX premiers recoivent l unite restante  ->  15
 */
const XP_ATTENDU_M01_L0 = (() => {
  const nb = 7;                      // les sept chapitres du module 01
  const base = Math.floor(100 / nb);
  return base + (0 < 100 - base * nb ? 1 : 0);
})();

let fautes = 0;
let etape = 0;
const dire = (nom, ok, detail) => {
  if (!ok) fautes += 1;
  console.log(`       ${ok ? 'ok ' : '⛔ '} ${nom}${detail ? `  ${detail}` : ''}`);
};
const titre = (s) => { etape += 1; console.log(`\n  ── ETAPE ${etape} : ${s} ──`); };

const nav = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check'],
});

/**
 * L'etat qui PERSISTE entre les etapes, hors du navigateur : c'est lui qui joue
 * le role de la base. ⚠️ Il n'est jamais reinitialise entre deux ouvertures de
 * page, sinon on ne mesurerait plus un enchainement mais dix debuts.
 */
const BASE = {
  droits: { formation_actif: true, journal_actif: false, journal_demande_le: null, journal_retire_le: null },
  notes: [],
  progression: [],
  parcoursVu: null,
};

/** Ouvre une page NEUVE, avec l'etat courant de la base. */
async function ouvrirPage(avecCoach = false) {
  const ctx = await nav.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.evaluateOnNewDocument((base, coach) => {
    window.__base = JSON.parse(JSON.stringify(base));
    window.__ecritures = [];
    const faire = () => {
      const t = (nom) => {
        const b = {
          select() { return b; },
          not() { return b; },
          in: () => Promise.resolve({ data: [], error: null }),
          order: () => Promise.resolve({ data: window.__base.demandes || [], error: null }),
          eq() {
            const liste = {
              data: nom === 'formation_progression' ? window.__base.progression
                : nom === 'formation_notes' ? window.__base.notes : [],
              error: null,
            };
            const un = nom === 'formation_parcours_vu'
              ? { data: window.__base.parcoursVu, error: null }
              : { data: window.__base.droits, error: null };
            return {
              maybeSingle: () => Promise.resolve(un),
              single: () => Promise.resolve(un),
              then: (ok, ko) => Promise.resolve(liste).then(ok, ko),
            };
          },
          update(ligne) {
            window.__ecritures.push({ table: nom, ligne });
            if (nom === 'acces_membre') Object.assign(window.__base.droits, ligne);
            return { eq: () => Promise.resolve({ error: null }) };
          },
          upsert(ligne) {
            window.__ecritures.push({ table: nom, ligne });
            const cible = nom === 'formation_notes' ? window.__base.notes
              : nom === 'formation_progression' ? window.__base.progression : null;
            if (cible) {
              const i = cible.findIndex((x) => x.lecon_id === ligne.lecon_id);
              if (i >= 0) Object.assign(cible[i], ligne); else cible.push({ ...ligne });
            } else if (nom === 'formation_parcours_vu') {
              window.__base.parcoursVu = { ...ligne };
            }
            return Promise.resolve({ error: null });
          },
        };
        return b;
      };
      window.supabaseClient = { from: t, auth: {
        getUser: async () => ({ data: { user: { id: 'eleve-parcours' } } }),
        getSession: async () => ({ data: { session: { user: { id: 'eleve-parcours' }, access_token: 'jeton' } } }),
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
    };
    faire();
    window.addEventListener('load', faire);
    window.currentUser = { role: coach ? 'coach' : 'student', uuid: 'eleve-parcours' };
    window.confirm = () => true;
    window.alert = () => {};
  }, BASE, avecCoach);
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  return { ctx, p };
}

/** Recupere l'etat de la « base » depuis la page, pour le reporter a la suivante. */
async function rapatrier(p) {
  const b = await p.evaluate(() => window.__base);
  Object.assign(BASE, b);
}

/* ══ 1 : il arrive, il n a QUE la formation ════════════════════════════════ */
/**
 * ⚠️ REECRIT AU LOT 10. Les etapes 1 a 7 visaient la fenetre de parcours et le
 * sommaire en liste, qui n existent plus : l espace est desormais celui de la
 * maquette validee. ⛔ Le PARCOURS SUIVI est le meme, c est l interface qui a
 * change. Une sonde qu on ne met pas a jour avec l interface finit par eprouver
 * un produit qui n existe plus, et elle le fait en vert.
 */
titre('il arrive, il n a QUE la formation');
{
  const { ctx, p } = await ouvrirPage();
  await p.evaluate(() => window.Acces.orienter());
  await new Promise((r) => setTimeout(r, 900));
  const r = await p.evaluate(() => {
    const vu = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    const txtVisible = (racine) => {
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
      choix: vu('choixEspace'), journal: vu('mainApp'), formation: vu('formationApp'),
      xp: (document.getElementById('chipXp') || {}).textContent || '',
      niveau: (document.getElementById('chipLvl') || {}).textContent || '',
      titre: (document.querySelector('#formationApp .hero h1') || {}).textContent || '',
      cartes: document.querySelectorAll('#formationApp .mod').length,
      intro: !!document.querySelector('#formationApp .intro-card'),
      introHorsGrille: !document.querySelector('#formationApp .grid .intro-card'),
      barres: document.querySelectorAll('#formationApp .sidebar-item').length,
      /**
       * ── ⛔ CE QUI MENTIONNE LE JOURNAL, ET OU ──────────────────────────
       *
       * ⚠️ Compter les occurrences ne suffit plus : le controle est passe de
       * zero a deux le 14/10 et ne disait pas POURQUOI. ⛔ On releve donc le
       * texte ET son emplacement, sinon on arbitre a l aveugle.
       */
      mentions: (() => {
        const out = [];
        const marche = (el, ou) => {
          if (el.nodeType === 3) {
            if (/journal/i.test(el.nodeValue)) out.push({ ou, t: el.nodeValue.trim().slice(0, 70) });
            return;
          }
          if (el.nodeType !== 1) return;
          const c = getComputedStyle(el);
          if (c.display === 'none' || c.visibility === 'hidden') return;
          const nom = el.tagName.toLowerCase() + (el.className ? `.${String(el.className).split(' ')[0]}` : '');
          el.childNodes.forEach((n) => marche(n, nom));
        };
        marche(document.getElementById('formationApp'), 'racine');
        return out;
      })(),
    };
  });
  dire('⛔ pas d ecran de choix : un seul droit, on entre directement', !r.choix);
  dire('l espace formation est ouvert, le journal est masque', r.formation && !r.journal);
  dire('⛔ aucune barre laterale du journal dans l espace', r.barres === 0, `${r.barres}`);
  /**
   * ── ⚠️ LA SEULE MENTION TOLEREE, ET ELLE ATTEND UN ARBITRAGE ─────────────
   *
   * ⛔ RELEVE LE 14/10 : deux mentions sont apparues, toutes deux la meme
   * phrase, sur les cartes des modules 05 et 07 :
   *
   *     « Il te faut 20 séances remplies dans ton journal. »
   *
   * ⚠️ C est la troisieme condition de passage de niveau, et son texte est une
   * PROPOSITION de ma part, pas un texte valide. ⛔ Elle demande a un eleve qui
   * n a QUE la formation d aller remplir un journal auquel il n a pas acces :
   * c est un vrai probleme de produit, et il appartient a Nadir , soit le
   * journal fait partie de la condition et il faut le lui ouvrir, soit la
   * condition ne vaut que pour ceux qui l ont.
   *
   * ⛔ LE CONTROLE NE L AVALE PAS : il refuse toute AUTRE mention, et il exige
   * que celle-ci reste exactement ou elle est. ⚠️ Un compte a zero aurait
   * cache le sujet ; un compte a deux sans son texte n aurait rien appris.
   */
  const ailleurs = r.mentions.filter((m) => !/séances remplies dans ton journal/.test(m.t));
  dire('⛔ aucune mention du journal hors la condition de séances',
    ailleurs.length === 0, ailleurs.map((m) => `${m.ou} : ${m.t}`).join(' | ') || 'aucune');
  dire('⚠️ et celle-ci est bien la condition de niveau, en attente d arbitrage',
    r.mentions.length === 2 && r.mentions.every((m) => m.ou === 'span'),
    r.mentions.map((m) => m.t).join(' / ') || 'aucune');
  dire('il part de zero : 0 XP, premier niveau', /^0\s*XP$/.test(r.xp.trim()) && /Découvrir/.test(r.niveau),
    `${r.xp.trim()} / ${r.niveau}`);
  // ⚠️ ONZE depuis le lot 14 : le 7 bis est devenu un module a part entiere, et
  // ⛔ l Introduction a quitte la grille au lot 16 pour sa carte d entree.
  dire('les ONZE cartes de module sont la', r.cartes === 11, `${r.cartes}`);
  dire('⛔ et l Introduction est une carte A PART, hors de la grille',
    r.intro && r.introHorsGrille);
  console.log(`         accueil : « ${r.titre.replace(/\s+/g, ' ').trim()} »`);
  await p.screenshot({ path: `${SORTIE}/01-arrivee.png`, fullPage: true });
  await rapatrier(p);
  await ctx.close();
}

/* ══ 2 : il ouvre un chapitre, prend une note, le marque termine ═══════════ */
titre('il ouvre un chapitre, prend une note, le marque termine');
{
  const { ctx, p } = await ouvrirPage();
  await p.evaluate(() => window.Acces.orienter());
  await new Promise((r) => setTimeout(r, 900));
  const r = await p.evaluate(async () => {
    /**
     * ⛔ ON VISE LE MODULE PAR SA CLE, PLUS PAR SON INDEX. ⚠️ `[data-mod="0"]`
     * designait le module 01 tant qu il etait le premier du tableau ; depuis
     * que l Introduction y est posee devant lui, l index 0 est l Introduction,
     * et depuis qu elle a quitte la grille, ce selecteur ne trouve PLUS RIEN.
     * ⛔ La sonde plantait sur un `null.click()`, et c est le troisieme index
     * ecrit en dur devenu faux dans ce lot.
     */
    document.querySelector('#formationApp .mod[data-carte-module="01"]').click();
    await new Promise((res) => setTimeout(res, 500));
    const titreChap = (document.querySelector('#formationApp .lesson-head h2') || {}).textContent || '';
    const chapitres = document.querySelectorAll('#formationApp .chap').length;
    const description = (document.querySelector('#formationApp .card p') || {}).textContent || '';
    const z = document.getElementById('formationNote');
    z.value = 'ma premiere note de formation';
    z.dispatchEvent(new Event('input', { bubbles: true }));
    z.dispatchEvent(new Event('blur', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 1600));
    const etat = (document.getElementById('savedMsg') || {}).textContent || '';
    document.querySelector('#formationApp [data-complete]').click();
    /**
     * ── ⛔ ON ATTEND LA FIN DE LA SCENE, et la duree est LUE dans le code ───
     *
     * ⚠️ Cette sonde lisait le compteur 700 ms apres le clic. Depuis le lot 16,
     * les XP ne sautent plus a leur valeur : ils PARTENT du chapitre et
     * s incrementent en arrivant, et a 700 ms le compteur est encore a zero.
     * ⛔ La sonde mesurait donc le milieu d une animation et le rapportait
     * comme un total faux, sur un calcul parfaitement juste.
     * ⚠️ `budgetChapitre()` vient du code eprouve : un chiffre recopie ici
     * redeviendrait faux au premier reglage de rythme.
     */
    const attente = window.Formation._calcul.budgetChapitre() + 500;
    await new Promise((res) => setTimeout(res, attente));
    return {
      titreChap: titreChap.trim(), chapitres, description: description.trim(), etat: etat.trim(),
      xp: (document.getElementById('chipXp') || {}).textContent || '',
      ecrites: window.__ecritures.map((e) => e.table),
      progression: window.__base.progression.length,
      vue: (window.__base.progression[0] || {}).vue,
      notes: window.__base.notes.length,
    };
  });
  dire('le module 01 montre ses SEPT chapitres reels', r.chapitres === 7, `${r.chapitres}`);
  dire('⛔ le titre du chapitre n est pas « Chapitre 1 »', !/^Chapitre \d+$/.test(r.titreChap),
    `« ${r.titreChap.slice(0, 54)} »`);
  dire('⛔ aucune description inventee', /En attente de description/.test(r.description),
    `« ${r.description.slice(0, 40)} »`);
  dire('la note est enregistree, et le dit', /Enregistré/.test(r.etat), `« ${r.etat} »`);
  dire('la note part en base', r.notes === 1, `${r.notes} ligne(s) dans formation_notes`);
  dire('le chapitre est marque vu en base', r.progression === 1 && r.vue === true,
    `${r.progression} ligne(s), vue=${r.vue}`);
  dire(`l experience suit : ${XP_ATTENDU_M01_L0} XP`,
    r.xp.replace(/\s/g, '') === `${XP_ATTENDU_M01_L0}XP`, r.xp.trim());
  dire('⛔ aucune table hors formation_notes / formation_progression',
    r.ecrites.every((x) => ['formation_notes', 'formation_progression'].includes(x)),
    [...new Set(r.ecrites)].join(', '));
  await p.screenshot({ path: `${SORTIE}/02-chapitre-note.png`, fullPage: true });
  await rapatrier(p);
  await ctx.close();
}

/* ══ 3 : il revient le lendemain, dans un navigateur neuf ══════════════════ */
titre('il revient le lendemain, dans un navigateur neuf');
{
  const { ctx, p } = await ouvrirPage();
  await p.evaluate(() => window.Acces.orienter());
  await new Promise((r) => setTimeout(r, 900));
  const r = await p.evaluate(() => ({
    note: (window.__base.notes[0] || {}).texte || '',
    // ⛔ Le stockage local ne porte RIEN de la formation : tout revient de la base.
    clesLocales: Object.keys(localStorage).filter((k) => /formation|t360/i.test(k)).length,
    chapitres: ((document.querySelector('#formationApp .stat .v') || {}).textContent || '').replace(/\s+/g, ''),
    xp: (document.getElementById('chipXp') || {}).textContent || '',
    reprise: (document.querySelector('#formationApp .resume-meta') || {}).textContent || '',
    badges: document.querySelectorAll('#formationApp .badge:not(.off)').length,
  }));
  dire('sa note est toujours la', /premiere note/.test(r.note), r.note.slice(0, 32));
  dire('⛔ et elle ne vient pas du stockage local', r.clesLocales === 0,
    `${r.clesLocales} cle(s) de formation`);
  dire('le tableau de bord compte son chapitre', /^1\/63$/.test(r.chapitres), r.chapitres);
  dire(`son experience a suivi : ${XP_ATTENDU_M01_L0} XP`,
    r.xp.replace(/\s/g, '') === `${XP_ATTENDU_M01_L0}XP`, r.xp.trim());
  dire('un badge est gagne : « Première séance »', r.badges === 1, `${r.badges} badge(s) allume(s)`);
  console.log(`         reprise : « ${r.reprise.replace(/\s+/g, ' ').trim().slice(0, 78)} »`);
  await rapatrier(p);
  await ctx.close();
}


/* ══ 8 : il demande le journal ═════════════════════════════════════════════ */
titre('il demande le journal');
{
  const { ctx, p } = await ouvrirPage();
  const r = await p.evaluate(async () => {
    await window.Acces.charger();
    window.Acces.appliquer();
    const b = document.querySelector('[data-journal-bouton]');
    const avant = b.textContent.trim();
    b.click();
    await new Promise((res) => setTimeout(res, 300));
    return { avant, apres: b.textContent.trim(), inactif: b.disabled,
      ecrit: window.__ecritures.filter((e) => e.table === 'acces_membre'),
      demande: window.__base.droits.journal_demande_le };
  });
  dire('le bouton invite a demander', /Demander/.test(r.avant), r.avant);
  dire('apres le clic il dit « Demande envoyee »', /Demande envoyee/.test(r.apres), r.apres);
  dire('et devient inactif', r.inactif);
  dire('⛔ UNE SEULE colonne ecrite', r.ecrit.length === 1
    && Object.keys(r.ecrit[0].ligne).join() === 'journal_demande_le', JSON.stringify(r.ecrit.map((e) => Object.keys(e.ligne))));
  dire('la demande est bien posee', !!r.demande);
  await rapatrier(p);
  await ctx.close();
}

/* ══ 9 : un coach accorde ══════════════════════════════════════════════════ */
titre('un coach voit la demande et accorde');
{
  BASE.demandes = [{ user_id: 'eleve-parcours', journal_demande_le: BASE.droits.journal_demande_le }];
  const { ctx, p } = await ouvrirPage(true);
  const r = await p.evaluate(async () => {
    const appels = [];
    const vrai = window.fetch;
    window.fetch = (u, o) => {
      if (String(u).includes('/api/coach/acces-journal')) {
        appels.push(JSON.parse(o.body));
        // ⚠️ On simule ce que fait la route serveur, pour que l etape 10 relise
        // un etat coherent. La route elle-meme est eprouvee ailleurs.
        window.__base.droits.journal_actif = true;
        window.__base.droits.journal_demande_le = null;
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) });
      }
      return vrai(u, o);
    };
    await window.DemandesJournal.charger();
    await new Promise((res) => setTimeout(res, 300));
    const cartes = document.querySelectorAll('#coachDemandesJournal button').length / 2;
    document.querySelectorAll('#coachDemandesJournal button')[0].click();
    await new Promise((res) => setTimeout(res, 400));
    return { cartes, appels };
  });
  dire('la demande apparait dans l espace coach', r.cartes === 1, `${r.cartes} carte(s)`);
  dire('⛔ l octroi passe par la route serveur, pas par le navigateur',
    r.appels.length === 1 && r.appels[0].action === 'accorder', JSON.stringify(r.appels));
  await p.screenshot({ path: `${SORTIE}/03-coach-demande.png` });
  await rapatrier(p);
  await ctx.close();
}

/* ══ 10 : il revient, il a les deux ════════════════════════════════════════ */
titre('il revient : il a les deux espaces');
{
  const { ctx, p } = await ouvrirPage();
  await p.evaluate(() => window.Acces.orienter());
  await new Promise((r) => setTimeout(r, 600));
  const r = await p.evaluate(() => {
    const vu = (s) => { const e = document.querySelector(s); return !!e && !e.hidden && !!e.offsetParent; };
    return {
      choix: getComputedStyle(document.getElementById('choixEspace')).display !== 'none',
      boutonFormation: vu('#choixEspace [data-droit="formation"]'),
      boutonJournal: vu('#choixEspace [data-journal-bouton]'),
      libelleJournal: (document.querySelector('[data-journal-bouton]') || {}).textContent || '',
    };
  });
  dire('l ecran de choix apparait maintenant', r.choix);
  dire('les deux portes sont ouvertes', r.boutonFormation && r.boutonJournal);
  dire('le bouton journal dit « Journal de trading »', /Journal de trading/.test(r.libelleJournal), r.libelleJournal.trim());
  await p.screenshot({ path: `${SORTIE}/04-les-deux.png` });

  // Et l entree « Formation » de la barre laterale suit le droit, dans le journal.
  const s = await p.evaluate(async () => {
    window.Acces.entrer('journal');
    await new Promise((res) => setTimeout(res, 400));
    const e = document.querySelector('#mainAppSidebar [data-droit="formation"]');
    return { visible: !!e && !e.hidden, chemin: location.pathname };
  });
  dire('depuis le journal, l entree « Formation » est la', s.visible);
  dire('et on est bien dans le journal', s.chemin === '/dashboard', s.chemin);
  await ctx.close();
}

await nav.close();
console.log(fautes === 0
  ? '\n  Le parcours tient de bout en bout, six etapes, sans accroc.'
  : `\n  ⛔ ${fautes} accroc(s) sur le parcours.`);
process.exit(fautes === 0 ? 0 : 1);
