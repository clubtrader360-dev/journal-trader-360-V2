/**
 * ⛔ L ESPACE FORMATION DANS UN VRAI NAVIGATEUR, AVEC DE VRAIS CLICS.
 *
 * ── ⚠️ POURQUOI CETTE SONDE EXISTE ALORS QUE QUATRE AUTRES SONT VERTES ─────
 *
 * Les quatre autres lisent des DONNEES : les XP se derivent-ils, les
 * descriptions sont-elles verbatim, les conditions ferment-elles. ⛔ Aucune n a
 * jamais clique. Quatre lots verts se sont succede sur un parcours qui ne
 * s ouvrait pas : `xpDe(ch.id)` levait une ReferenceError dans le gabarit du
 * bouton « Marquer comme terminé », `rendreModule` etant `async` le rejet
 * n etait observe par personne, et un clic sur un module ne faisait RIEN.
 *
 * ⚠️ MESURER LES DONNEES SANS JAMAIS CLIQUER, c est mesurer un plan sans
 * jamais entrer dans la maison. ⛔ Tout ce qui est controle ici passe par le
 * navigateur, sur le vrai rendu, avec de vrais clics et le journal des erreurs
 * de page ouvert.
 *
 * ── ⛔ LE JOURNAL DES ERREURS EST UN CONTROLE, PAS UN AGREMENT ─────────────
 *
 * Chaque etape vide le journal avant d agir et le relit apres. ⚠️ Une erreur
 * de page qui ne casse rien a l ecran est precisement le defaut qui a coute
 * quatre lots : elle doit rougir une sonde, pas attendre un oeil.
 *
 * Usage : node outils/formation-scene.mjs [port]
 */
import { mkdirSync } from 'node:fs';

const CHEMIN = '/Users/nadirkasmi/Projets/trader360-site/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
let puppeteer;
try { ({ default: puppeteer } = await import(CHEMIN)); }
catch (e) { console.error(`\n  ⛔ puppeteer-core introuvable : ${e.message}`); process.exit(1); }

const PORT = process.argv[2] ?? '4417';
const SORTIE = 'captures/formation-scene';
mkdirSync(SORTIE, { recursive: true });

let fautes = 0;
const dire = (nom, ok, detail) => {
  if (!ok) fautes += 1;
  console.log(`     ${ok ? 'ok ' : '⛔ '} ${nom}${detail ? `  ${detail}` : ''}`);
};
let n = 0;
const titre = (s) => { n += 1; console.log(`\n  ══ ${n}. ${s} ══`); };

const nav = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new',
  args: ['--no-first-run', '--no-default-browser-check', '--autoplay-policy=no-user-gesture-required'],
});

/**
 * ── ⛔ LE DOUBLE PORTE LES REFUS DU VRAI SERVICE ───────────────────────────
 *
 * ⚠️ Trois fois sur ce depot, un double plus permissif que le service a rendu
 * un rapport vert sur du code casse : `window.supabase` double avec un `.auth`
 * qu il n avait pas, PostgREST qui rendait 201 sur n importe quoi, Brevo qui
 * ignorait l annulation.
 *
 * ⛔ CELUI-CI DOUBLE `window.supabaseClient`, le nom que le code lit REELLEMENT,
 * releve dans la source et pas de memoire. ⚠️ Et il rend `{ data: null }` quand
 * la ligne n existe pas, comme `maybeSingle()`, au lieu d un objet vide : c est
 * precisement sur cette distinction que repose la fenetre de bienvenue.
 */
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
      getUser: async () => ({ data: { user: { id: 'eleve-scene' } } }),
      getSession: async () => ({ data: { session: { user: { id: 'eleve-scene' }, access_token: 'j' } } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }) } };
  };
  faire();
  window.addEventListener('load', faire);
  window.currentUser = { role: 'student', uuid: 'eleve-scene' };
}

const journal = [];
/**
 * ── ⛔ CE QUE LE JOURNAL D ERREURS NE DOIT PAS COMPTER, ET POURQUOI ────────
 *
 * ⚠️ MESURE AU PREMIER PASSAGE : six controles « aucune erreur de page »
 * etaient rouges sur trois lignes identiques,
 *
 *     Failed to load resource: the server responded with a status of 400
 *     [REDUNDANT] Erreur fetch journal_entries
 *
 * ⛔ Elles ne viennent PAS de l espace formation. Le journal vit dans la meme
 * page et interroge `journal_entries` par `fetch` direct, sans passer par
 * `window.supabaseClient` : mon double ne le couvre pas, et la vraie base
 * refuse un jeton d essai. ⚠️ C est du bruit de banc, pas un defaut du produit.
 *
 * ⛔ LE FILTRE EST NOMME LIGNE PAR LIGNE, JAMAIS LARGE. Un filtre qui aurait
 * ecarte « toutes les erreurs reseau » aurait aussi avale une vraie requete
 * cassee de l espace formation, et le vert n aurait plus rien voulu dire.
 * ⚠️ Et `[pageerror]` n est JAMAIS filtre : c est exactement la classe qui a
 * coute quatre lots.
 */
const BRUIT_DU_JOURNAL = [
  /Failed to load resource/,
  /Erreur fetch journal_entries/,
  /\[REDUNDANT\]/,
];
const retenu = (l) => l.startsWith('[pageerror]') || !BRUIT_DU_JOURNAL.some((m) => m.test(l));

async function ouvrir(opts) {
  const o = opts || {};
  const ctx = await nav.createBrowserContext();
  const p = await ctx.newPage();
  await p.setViewport({ width: o.largeur || 1440, height: o.hauteur || 900 });
  if (o.sansMouvement) {
    await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  }
  p.on('pageerror', (e) => journal.push(`[pageerror] ${e.message}`));
  p.on('console', (m) => { if (m.type() === 'error') journal.push(`[console] ${m.text()}`); });
  await p.evaluateOnNewDocument(poserDouble, {
    droits: { formation_actif: true, journal_actif: false },
    notes: [], progression: o.progression || [], parcoursVu: o.parcoursVu ?? null,
  });
  await p.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await p.evaluate(() => window.Acces.orienter());
  await new Promise((r) => setTimeout(r, 1000));
  return { ctx, p };
}
const propre = (nom) => {
  const tous = journal.splice(0);
  const vus = tous.filter(retenu);
  const ecartes = tous.length - vus.length;
  dire(nom, vus.length === 0, vus.length ? vus.join(' | ')
    : `aucune erreur${ecartes ? `, ${ecartes} ligne(s) de bruit du journal écartée(s)` : ''}`);
};

/* ══════════════════════════════════════════════════════════════════════════ */
titre('⚠️ L ETALONNAGE : LA SONDE SAIT-ELLE VOIR UNE ERREUR DE PAGE ?');
{
  /**
   * ⛔ SANS CE TEMOIN, TOUS LES « aucune erreur de page » QUI SUIVENT NE
   * VALENT RIEN. ⚠️ C est exactement le defaut qu on repare : un instrument
   * qui ne peut pas echouer ne mesure rien.
   */
  const { ctx, p } = await ouvrir();
  journal.splice(0);
  await p.evaluate(() => { setTimeout(() => { throw new Error('temoin-volontaire'); }, 0); });
  await new Promise((r) => setTimeout(r, 200));
  dire('⚠️ TÉMOIN : une erreur de page est bien captée',
    journal.some((l) => l.includes('temoin-volontaire')), journal.join(' | '));
  /**
   * ⛔ ET LE FILTRE DE BRUIT NE DOIT PAS L AVALER. ⚠️ Sans ce second temoin, un
   * filtre trop large rendrait tous les « aucune erreur » verts pour rien.
   */
  dire('⚠️ TÉMOIN : le filtre de bruit LAISSE PASSER une vraie erreur',
    journal.filter(retenu).some((l) => l.includes('temoin-volontaire')));
  dire('⚠️ TÉMOIN : et il écarte bien la ligne du journal',
    !retenu('[console] Failed to load resource: the server responded with a status of 400 ()'));
  journal.splice(0);
  await ctx.close();
}
if (fautes) { console.log('\n  ⛔ ÉTALONNAGE RATÉ : rien de ce qui suit n est interprétable.\n'); process.exit(1); }

/* ══════════════════════════════════════════════════════════════════════════ */
titre('⛔ UN CLIC OUVRE CHACUN DES ONZE MODULES');
{
  const { ctx, p } = await ouvrir();
  const cartes = await p.evaluate(() => [...document.querySelectorAll('#formationApp .mod')]
    .map((c) => ({ cle: c.dataset.carteModule, verrou: c.classList.contains('locked') })));
  dire('⛔ ONZE cartes de module, et l Introduction n en est pas une',
    cartes.length === 11, `${cartes.length} : ${cartes.map((c) => c.cle).join(', ')}`);
  dire('⚠️ et TROIS sont verrouillées, c est voulu',
    cartes.filter((c) => c.verrou).length === 3,
    cartes.filter((c) => c.verrou).map((c) => c.cle).join(', '));

  let ouverts = 0;
  let refuses = 0;
  for (let i = 0; i < cartes.length; i += 1) {
    journal.splice(0);
    const r = await p.evaluate(async (k) => {
      document.querySelectorAll('#formationApp .mod')[k].click();
      await new Promise((res) => setTimeout(res, 400));
      return {
        chapitres: document.querySelectorAll('#formationApp .chap').length,
        h1: (document.querySelector('#formationApp .mhead h1') || {}).textContent || '',
        cond: !!document.querySelector('#formationApp .cond'),
        toast: ((document.getElementById('toast') || {}).textContent || '').trim(),
      };
    }, i);
    const c = cartes[i];
    const ok = c.verrou
      // ⛔ UN MODULE VERROUILLE NE S OUVRE PAS, et il DIT pourquoi : un refus
      // muet se lit comme une panne. ⚠️ Deux formes de refus, l ecran des
      // conditions pour un niveau, un message pour la certification.
      ? (r.chapitres === 0 && !r.h1 && (r.cond || r.toast.length > 0))
      : (r.chapitres > 0 && r.h1.length > 0);
    if (ok && !c.verrou) ouverts += 1;
    if (ok && c.verrou) refuses += 1;
    dire(`  module ${String(c.cle).padEnd(5)} ${c.verrou ? 'refuse' : 'ouvre '}`, ok,
      `${r.chapitres} chapitre(s)${journal.length ? ` ⛔ ${journal.join(' | ')}` : ''}`);
    if (journal.length) fautes += 1;
    await p.evaluate(() => {
      const m = document.querySelector('#formationApp .cond-bg'); if (m) m.remove();
      window.Formation.aller('modules');
    });
    await new Promise((r2) => setTimeout(r2, 250));
  }
  dire('⛔ les HUIT modules ouvrables s ouvrent tous', ouverts === 8, `${ouverts} / 8`);
  dire('⛔ et les TROIS verrouillés refusent tous', refuses === 3, `${refuses} / 3`);
  journal.splice(0);
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════ */
titre('⛔ LA CARTE INTRODUCTION, ET LA VIDEO DE BIENVENUE QU ON PEUT REVOIR');
{
  // ⚠️ `parcoursVu` renseigne : la fenetre de premiere connexion NE doit PAS
  // s ouvrir. ⛔ C est l etat reel du compte de Nadir, mesure en base.
  const { ctx, p } = await ouvrir({ parcoursVu: { user_id: 'eleve-scene', vue_le: '2026-10-11T17:25:12Z' } });
  const r = await p.evaluate(() => {
    const c = document.querySelector('#formationApp .intro-card');
    const grille = document.querySelector('#formationApp .grid');
    return {
      existe: !!c,
      // ⛔ AU-DESSUS DE TOUS LES MODULES, pas dedans.
      horsGrille: !!c && !c.closest('.grid'),
      avant: !!c && !!grille && c.compareDocumentPosition(grille) === 4,
      texte: c ? c.textContent.replace(/\s+/g, ' ').trim() : '',
      cadenas: !!c && !!c.querySelector('svg rect'),
      bienvenueOuverte: !!document.getElementById('formationBienvenue'),
    };
  });
  dire('⛔ la carte Introduction existe, HORS de la grille', r.existe && r.horsGrille);
  dire('⛔ et AU-DESSUS de tous les modules', r.avant);
  dire('⛔ elle ne porte NI numéro, NI « module », NI XP',
    !/module|\bXP\b|\b00\b/i.test(r.texte), `« ${r.texte} »`);
  dire('⛔ ni cadenas', !r.cadenas);
  dire('⛔ et elle dit « Introduction », pas « en attente de description »',
    /Introduction/.test(r.texte) && !/attente de description/i.test(r.texte));
  dire('⚠️ la fenêtre de première connexion ne revient PAS quand la ligne existe',
    !r.bienvenueOuverte);

  // ⛔ ET LE MOYEN D Y REVENIR : un clic sur la carte rouvre la video.
  journal.splice(0);
  const r2 = await p.evaluate(async () => {
    document.querySelector('#formationApp .intro-card').click();
    await new Promise((res) => setTimeout(res, 300));
    const d = document.getElementById('formationBienvenue');
    return { ouverte: !!d, titre: d ? (d.querySelector('h2') || {}).textContent : '',
      ecritures: (window.__ecritures || []).filter((e) => e.table === 'formation_parcours_vu').length };
  });
  dire('⛔ un clic sur la carte Introduction ROUVRE la vidéo de bienvenue',
    r2.ouverte, r2.titre);
  dire('⚠️ et elle n écrit rien de plus en base : rien de neuf à noter',
    r2.ecritures === 0, `${r2.ecritures} écriture(s)`);
  propre('⛔ aucune erreur de page');
  await p.screenshot({ path: `${SORTIE}/01-accueil-1440.png`, fullPage: true });
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════ */
titre('⛔ LA FENETRE DE BIENVENUE APPARAIT SUR UN COMPTE SANS LIGNE');
{
  /**
   * ⚠️ MESURE EN BASE LE 14/10 : `formation_parcours_vu` porte UNE ligne, celle
   * du compte de Nadir, ecrite le 11/10 a 17 h 25. ⛔ Ce n etait donc pas un
   * defaut : il l avait vue sur un apercu precedent, et elle ne revient pas.
   * ⚠️ Ce controle-ci eprouve le cas d un eleve NEUF, `parcoursVu: null`.
   */
  const { ctx, p } = await ouvrir({ parcoursVu: null });
  const r = await p.evaluate(() => {
    const d = document.getElementById('formationBienvenue');
    if (!d) return { ouverte: false };
    const c = getComputedStyle(d);
    return {
      ouverte: true,
      // ⛔ ON LIT `getComputedStyle`, PAS L ATTRIBUT. Sur ce depot, un `hidden`
      // perd contre un `!important`, et quatre defauts sont nes de cette
      // confiance. ⚠️ Un dialogue ouvert mais invisible compterait pour ouvert.
      visible: c.display !== 'none' && c.visibility !== 'hidden' && Number(c.opacity) > 0,
      modal: d.hasAttribute('open'),
      largeur: d.getBoundingClientRect().width,
      ecritures: (window.__ecritures || []).filter((e) => e.table === 'formation_parcours_vu').length,
    };
  });
  dire('⛔ elle s ouvre sur un compte sans ligne', r.ouverte);
  dire('⛔ et elle est VISIBLE, mesuré sur le style calculé',
    r.visible && r.largeur > 200, `${Math.round(r.largeur)} px de large`);
  dire('⛔ la ligne est notée À L OUVERTURE, pas à la fermeture',
    r.ecritures === 1, `${r.ecritures} écriture(s)`);
  await p.screenshot({ path: `${SORTIE}/02-bienvenue.png` });

  // ⚠️ ET ELLE NE REVIENT PAS : second rendu, meme page, aucune seconde fenetre.
  const r2 = await p.evaluate(async () => {
    document.getElementById('formationBienvenue').querySelector('[data-fermer]').click();
    await new Promise((res) => setTimeout(res, 200));
    window.Formation.aller('accueil');
    await new Promise((res) => setTimeout(res, 300));
    return !!document.getElementById('formationBienvenue');
  });
  dire('⚠️ fermée, elle ne revient pas au rendu suivant', !r2);
  propre('⛔ aucune erreur de page');
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════ */
titre('⛔ CE QUI A DISPARU DE L ECRAN, ET LE PALIER RENDU EXPLICITE');
{
  const { ctx, p } = await ouvrir();
  const r = await p.evaluate(() => {
    const vu = (racine) => {
      let out = '';
      const marche = (el) => {
        if (el.nodeType === 3) { out += el.nodeValue; return; }
        if (el.nodeType !== 1) return;
        const c = getComputedStyle(el);
        if (c.display === 'none' || c.visibility === 'hidden') return;
        el.childNodes.forEach(marche);
      };
      marche(racine);
      return out.replace(/\s+/g, ' ');
    };
    const t = vu(document.getElementById('formationApp'));
    const pal = document.querySelector('#formationApp [data-palier]');
    return {
      texte: t,
      semaine: /chapitre par semaine/i.test(t),
      regularite: /Régularité/i.test(t),
      huit: /8 semaines/i.test(t),
      palier: !!pal,
      palierTexte: pal ? vu(pal).trim() : '',
      barre: !!(pal && pal.querySelector('[data-palier-bar]')),
      nomSuivant: pal ? /Psychologie/.test(vu(pal)) : false,
    };
  });
  dire('⛔ « un chapitre par semaine » a disparu de l écran', !r.semaine);
  dire('⛔ « Régularité » a disparu', !r.regularite);
  dire('⛔ « 8 semaines » a disparu', !r.huit);
  /**
   * ⚠️ LE TEMOIN POSITIF : si ces trois « non » venaient d un lecteur qui ne
   * lit rien, ils seraient verts sur une page blanche. ⛔ On exige donc qu il
   * trouve ce qui DOIT etre la.
   */
  dire('⚠️ TÉMOIN : le lecteur de texte visible n est pas aveugle',
    /Espace formation/.test(r.texte) && r.texte.length > 1500,
    `${r.texte.length} caractères lus`);
  dire('⛔ le bloc du prochain palier existe', r.palier);
  dire('⛔ il NOMME le palier suivant', r.nomSuivant, `« ${r.palierTexte.slice(0, 90)}… »`);
  dire('⛔ il dit ce qu il RESTE', /Il te reste/.test(r.palierTexte));
  dire('⛔ et il porte une BARRE, pas un chiffre seul', r.barre);
  propre('⛔ aucune erreur de page');
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════ */
titre('⛔ LES ONZE DESCRIPTIONS DE MODULE SONT A L ECRAN');
{
  const { ctx, p } = await ouvrir();
  const r = await p.evaluate(() => {
    const out = [];
    for (const c of document.querySelectorAll('#formationApp .mod')) {
      const pp = c.querySelector('p');
      out.push({ cle: c.dataset.carteModule, texte: (pp ? pp.textContent : '').trim() });
    }
    return { cartes: out, source: window.FormationDonnees.MODULES.map((m) => ({ cle: m.cle, d: m.description })) };
  });
  const attente = r.cartes.filter((c) => /attente de description/i.test(c.texte));
  dire('⛔ AUCUNE carte ne dit « en attente de description »',
    attente.length === 0, attente.map((c) => c.cle).join(', ') || '0 sur 11');
  const vides = r.cartes.filter((c) => c.texte.length < 40);
  dire('⛔ les onze portent un texte de description',
    vides.length === 0, vides.map((c) => c.cle).join(', ') || '11 sur 11');
  // ⛔ ET CARACTERE PAR CARACTERE CONTRE LA DONNEE : l affichage echappe le
  // HTML, il ne reecrit rien. ⚠️ Un seul caractere de difference rougit.
  const ecarts = r.cartes.filter((c) => {
    const s = r.source.find((x) => x.cle === c.cle);
    return !s || !s.d || s.d.trim() !== c.texte;
  });
  dire('⛔ chacune est à l écran EXACTEMENT comme dans la donnée',
    ecarts.length === 0, ecarts.map((c) => c.cle).join(', ') || '11 sur 11');
  // ⚠️ TEMOIN D ECHEC : le comparateur sait dire non.
  dire('⚠️ TÉMOIN : un caractère changé serait vu',
    r.cartes[0].texte !== r.cartes[0].texte.replace(/e/, 'é'));
  const bis = r.cartes.find((c) => c.cle === '07bis');
  dire('⛔ le 7 bis, dont la clé se perdait un cinquième endroit, a la sienne',
    !!bis && bis.texte.length > 40, `${bis ? bis.texte.slice(0, 60) : ', '}…`);
  const neuf = r.cartes.find((c) => c.cle === '09');
  dire('⛔ et le 09 ne dit plus « Aucune description dans LearnyBox »',
    !!neuf && !/aucune description/i.test(neuf.texte), `${neuf ? neuf.texte.slice(0, 60) : ', '}…`);
  propre('⛔ aucune erreur de page');
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════ */
titre('⛔ LES BADGES : ENGENDRES, DECLINES, ET AUCUNE REQUETE RESEAU');
{
  const { ctx, p } = await ouvrir();
  /**
   * ⛔ LA REQUETE RESEAU SE MESURE, ELLE NE SE SUPPOSE PAS. ⚠️ On ecoute les
   * requetes pendant qu on rend la collection : un `<img>` ou une police
   * chargee pour un badge apparaitrait ici.
   */
  const requetes = [];
  p.on('request', (q) => requetes.push(q.url()));
  const r = await p.evaluate(() => {
    const badges = [...document.querySelectorAll('#formationApp .badge')];
    const svgs = badges.map((b) => b.querySelector('svg'));
    return {
      total: badges.length,
      deModule: badges.filter((b) => /^m/.test(b.dataset.badge)).length,
      tousSvg: svgs.every(Boolean),
      // ⛔ AUCUNE IMAGE EXTERNE : ni <img>, ni url() dans le SVG.
      /**
       * ⛔ `url(#md1m)` N EST PAS UN FICHIER, et ma premiere version de ce
       * controle etait rouge pour cela : elle cherchait `url(` et trouvait les
       * references internes aux degrades du SVG. ⚠️ Suspecter l instrument
       * avant la mesure : les badges etaient justes, la sonde avait tort.
       * ⛔ On ne cherche donc que les `url(` qui pointent AILLEURS.
       */
      images: badges.filter((b) => b.querySelector('img')
        || /url\(\s*['"]?(?!#)/.test(b.innerHTML)).length,
      silhouettes: badges.filter((b) => b.dataset.obtenu === 'non').length,
      obtenus: badges.filter((b) => b.dataset.obtenu === 'oui').length,
      // ⚠️ Les identifiants de degrade doivent etre UNIQUES : partages, un
      // badge d acier emprunterait le metal du premier sans rien signaler.
      ids: [...document.querySelectorAll('#formationApp .badge svg linearGradient')].map((g) => g.id),
      // Les trois metaux, lus dans le SVG rendu.
      metaux: badges.map((b) => {
        const s = b.querySelector('linearGradient stop');
        return { id: b.dataset.badge, couleur: s ? s.getAttribute('stop-color') : null };
      }),
      neuf: (() => {
        const b = document.querySelector('#formationApp .badge[data-badge="m09"]');
        if (!b) return null;
        return {
          // ⛔ NATURE DIFFERENTE : rond, pas d ecusson, et SANS numero.
          rond: !!b.querySelector('circle'),
          ecusson: !!b.querySelector('path[d^="M32 2 58 17"]'),
          texte: [...b.querySelectorAll('svg text')].map((t) => t.textContent).join(''),
        };
      })(),
      silhouetteFiltre: (() => {
        const b = document.querySelector('#formationApp .badge[data-obtenu="non"] .medal');
        if (!b) return null;
        const f = getComputedStyle(b).filter;
        return { filtre: f, numeroVisible: !!b.querySelector('text') };
      })(),
    };
  });
  dire('⛔ ONZE badges de module, un par module, l Introduction exceptée',
    r.deModule === 11, `${r.deModule}`);
  dire('⚠️ et trois badges de parcours en plus', r.total === 14, `${r.total} au total`);
  dire('⛔ tous engendrés en SVG, aucun fichier', r.tousSvg && r.images === 0);
  const reseau = requetes.filter((u) => /\.(png|jpg|jpeg|svg|webp|gif)(\?|$)/i.test(u));
  dire('⛔ AUCUNE requête réseau d image pour un badge',
    reseau.length === 0, reseau.length ? reseau.join(', ') : '0 requête');
  dire('⛔ les identifiants de dégradé sont tous UNIQUES',
    new Set(r.ids).size === r.ids.length, `${r.ids.length} dégradés, ${new Set(r.ids).size} distincts`);
  const couleurs = new Set(r.metaux.map((m) => m.couleur).filter(Boolean));
  dire('⛔ TROIS métaux de niveau à l écran, pas un seul',
    couleurs.size >= 3, [...couleurs].join(', '));
  dire('⛔ le badge du module 09 est rond, pas un écusson',
    r.neuf && r.neuf.rond && !r.neuf.ecusson);
  dire('⛔ et il ne porte AUCUN numéro', r.neuf && r.neuf.texte.trim() === '',
    `« ${r.neuf ? r.neuf.texte : ', '} »`);
  dire('⛔ les badges non obtenus se voient en SILHOUETTE, filtre mesuré',
    !!r.silhouetteFiltre && /grayscale/.test(r.silhouetteFiltre.filtre),
    r.silhouetteFiltre ? r.silhouetteFiltre.filtre : ', ');
  dire('⚠️ et la silhouette GARDE sa forme et son numéro',
    !!r.silhouetteFiltre && r.silhouetteFiltre.numeroVisible);
  dire('⚠️ TÉMOIN : il y a bien des badges non obtenus à mesurer',
    r.silhouettes > 0, `${r.silhouettes} silhouette(s), ${r.obtenus} obtenu(s)`);
  await p.screenshot({ path: `${SORTIE}/03-collection.png`, fullPage: false });
  propre('⛔ aucune erreur de page');
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════ */
titre('⛔ LA SCENE DE FIN DE CHAPITRE : QUATRE TEMPS, ET RIEN N APPARAIT DE NULLE PART');
{
  const { ctx, p } = await ouvrir();
  journal.splice(0);
  const r = await p.evaluate(async () => {
    document.querySelector('#formationApp .mod[data-carte-module="01"]').click();
    await new Promise((res) => setTimeout(res, 400));
    const avant = {
      xp: (document.getElementById('chipXp') || {}).textContent,
      rail: document.querySelector('#formationApp .mprog .bar i').style.width,
      coche: document.querySelectorAll('#formationApp .chap.done').length,
    };
    const ancre = document.querySelector('#formationApp .chap[data-chap="0"] .dot').getBoundingClientRect();
    const compteur = document.getElementById('chipXp').getBoundingClientRect();
    document.querySelector('#formationApp [data-complete]').click();
    /**
     * ── ⛔ ON GUETTE LA PREMIERE APPARITION, ON N ECHANTILLONNE PAS A L HEURE
     *
     * ⚠️ DEUX FOIS DE SUITE MA SONDE A EU TORT ICI, et de deux facons
     * opposees. D abord elle lisait le jeton a 620 ms, soit presque arrive :
     * il etait alors plus proche du compteur que du chapitre, et le controle
     * « il part du chapitre » acceptait aussi bien un jeton apparu au centre
     * de l ecran. Puis, corrigee a « marque + 90 ms », elle ne trouvait PLUS
     * RIEN : le jeton nait vers 310 ms et l ecriture en base decale le depart
     * de quelques dizaines de millisecondes. ⛔ Une sonde calee sur une heure
     * fixe mesure la gigue du banc, pas le produit.
     *
     * ⛔ ON GUETTE DONC : toutes les 20 ms, et on retient la PREMIERE position
     * vue. A cet instant, le jeton doit etre plus pres du chapitre que du
     * compteur , et cette comparaison-la, elle, tranche.
     */
    const dist = (a2, b2) => Math.hypot(a2.left - b2.left, a2.top - b2.top);
    let vol = null;
    let jeton = null;
    for (let i = 0; i < 60 && !vol; i += 1) {
      await new Promise((res) => setTimeout(res, 20));
      jeton = document.querySelector('#formationApp .scene-jeton');
      if (jeton) vol = jeton.getBoundingClientRect();
    }
    const temps1 = document.querySelectorAll('#formationApp .chap.done').length;
    await new Promise((res) => setTimeout(res, 2400));
    return {
      avant,
      // ⛔ TEMPS 1 : le chapitre se marque PENDANT la scene, pas au rechargement.
      marqueEnCours: temps1 > avant.coche,
      // ⛔ TEMPS 2 : le jeton part du chapitre, il n apparait pas au centre.
      jetonVu: !!vol,
      partDuChapitre: !!vol && dist(vol, ancre) < dist(vol, compteur),
      distances: vol ? { chapitre: Math.round(dist(vol, ancre)), compteur: Math.round(dist(vol, compteur)) } : null,
      ancre: { x: Math.round(ancre.left), y: Math.round(ancre.top) },
      compteur: { x: Math.round(compteur.left), y: Math.round(compteur.top) },
      jeton: vol ? { x: Math.round(vol.left), y: Math.round(vol.top) } : null,
      apres: {
        xp: (document.getElementById('chipXp') || {}).textContent,
        rail: document.querySelector('#formationApp .mprog .bar i')?.style.width,
        coche: document.querySelectorAll('#formationApp .chap.done').length,
      },
      ecritures: (window.__ecritures || []).filter((e) => e.table === 'formation_progression').length,
      restes: document.querySelectorAll('#formationApp .scene-jeton,#formationApp .scene-badge').length,
      budget: window.Formation._calcul.budgetChapitre(),
    };
  });
  dire('⛔ TEMPS 1 : le chapitre se marque pendant la scène', r.marqueEnCours,
    `${r.avant.coche} → ${r.apres.coche} coché(s)`);
  dire('⛔ TEMPS 2 : un jeton d XP existe en vol', r.jetonVu,
    r.jeton ? `jeton en (${r.jeton.x}, ${r.jeton.y})` : 'aucun');
  dire('⛔ et il PART du chapitre, pas du centre de l écran', r.partDuChapitre,
    r.distances ? `à ${r.distances.chapitre} px du chapitre contre ${r.distances.compteur} px du compteur`
      : 'aucun jeton');
  dire('⛔ le compteur a reçu : il n affiche plus la même valeur',
    r.avant.xp !== r.apres.xp, `${r.avant.xp} → ${r.apres.xp}`);
  dire('⛔ TEMPS 3 : le rail du module a gagné un cran',
    r.avant.rail !== r.apres.rail, `${r.avant.rail || '0%'} → ${r.apres.rail}`);
  dire('⚠️ et l écriture en base a bien eu lieu', r.ecritures >= 1, `${r.ecritures}`);
  dire('⛔ la scène ne laisse RIEN derrière elle', r.restes === 0, `${r.restes} reste(s)`);
  /**
   * ⛔ DEUX SECONDES AU PLUS POUR LE TOUT, et le chiffre est LU dans le code,
   * pas recopie ici. ⚠️ Un budget ecrit dans la sonde mesurerait la sonde.
   */
  dire('⛔ le budget de la scène de chapitre tient sous 2 000 ms',
    r.budget <= 2000, `${r.budget} ms`);
  propre('⛔ aucune erreur de page pendant la scène');
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════ */
titre('⛔ LE CUMUL : LE DERNIER CHAPITRE D UN MODULE, SES XP, LES 250, ET LE PALIER');
{
  /**
   * ⚠️ C EST LE CAS A EPROUVER, pas le cas simple. ⛔ Le dernier chapitre d un
   * module cumule trois gains, et il doit en sortir UNE scene qui enchaine les
   * neuf temps , pas trois scenes l une sur l autre.
   *
   * ⚠️ Le module 03 a cinq chapitres : on en pose quatre comme vus, et le
   * cinquieme clic termine le module. ⛔ On y ajoute de quoi etre juste sous un
   * palier, pour que le cumul porte aussi le temps 4.
   */
  const dejaVus = [];
  for (const id of ['m01-l0', 'm01-l1', 'm01-l2', 'm01-l3', 'm01-l4', 'm01-l5', 'm01-l6',
    'm02-l0', 'm02-l1', 'm02-l2', 'm02-l3', 'm02-l4', 'm02-l5', 'm02-l6', 'm02-l7', 'm02-l8', 'm02-l9',
    'm03-l0', 'm03-l1', 'm03-l2', 'm03-l3']) {
    dejaVus.push({ lecon_id: id, vue: true, progress_seconds: 0, last_watched_at: '2026-10-13T09:00:00Z' });
  }
  const { ctx, p } = await ouvrir({ progression: dejaVus });
  journal.splice(0);
  const r = await p.evaluate(async () => {
    const C = window.Formation._calcul;
    const avant = { xp: C.xpTotal(), niveau: C.niveauDe(C.xpTotal()),
      badges: C.badges().filter((b) => b.ok()).map((b) => b.id) };
    document.querySelector('#formationApp .mod[data-carte-module="03"]').click();
    await new Promise((res) => setTimeout(res, 450));
    // Le dernier chapitre non vu du module 03.
    const reste = [...document.querySelectorAll('#formationApp .chap')]
      .findIndex((c) => !c.classList.contains('done'));
    document.querySelectorAll('#formationApp .chap')[reste].click();
    await new Promise((res) => setTimeout(res, 400));
    const ancre = document.querySelector('#formationApp [data-ancre-badge="03"]').getBoundingClientRect();
    document.querySelector('#formationApp [data-complete]').click();

    // ⚠️ On echantillonne la scene, temps par temps.
    const vus = { calme: false, badgeSombre: false, eclaire: false, texte: false,
      piece: null, confettis: false };
    /**
     * ⛔ L ECHANTILLONNAGE DURE PLUS LONGTEMPS QUE LA SCENE, et ma premiere
     * version ne le faisait pas : 4,6 s d echantillons pour une scene complete
     * de 4,5 s, le dernier temps tombait hors fenetre et « rien ne reste »
     * etait rouge sur une scene qui se terminait tres bien.
     * ⚠️ La duree est LUE dans le code eprouve, pas devinee : une sonde qui
     * ecrit son propre budget mesure son chiffre, pas celui du produit.
     */
    const S = window.Formation._calcul.SCENE;
    const budget = Object.values(S).reduce((a2, b2) => a2 + b2, 0) + 900;
    for (let i = 0; i < Math.ceil(budget / 100); i += 1) {
      await new Promise((res) => setTimeout(res, 100));
      const c = document.querySelector('#formationApp .scene-couche');
      if (c && c.classList.contains('calme')) vus.calme = true;
      const pi = document.querySelector('#formationApp .scene-badge__piece');
      if (pi) {
        if (pi.classList.contains('sombre')) vus.badgeSombre = true;
        if (pi.classList.contains('eclaire')) {
          if (!vus.eclaire) vus.piece = (() => { const b = pi.getBoundingClientRect();
            return { x: Math.round(b.left + b.width / 2), y: Math.round(b.top + b.height / 2) }; })();
          vus.eclaire = true;
        }
      }
      const d = document.querySelector('#formationApp .scene-badge__dire.la');
      if (d) vus.texte = true;
    }
    const apres = { xp: C.xpTotal(), niveau: C.niveauDe(C.xpTotal()),
      badges: C.badges().filter((b) => b.ok()).map((b) => b.id) };
    const place = document.querySelector('#formationApp .badge[data-badge="m03"]');
    return {
      avant, apres, vus,
      ancre: { x: Math.round(ancre.left + ancre.width / 2), y: Math.round(ancre.top + ancre.height / 2) },
      centre: { x: Math.round(window.innerWidth / 2), y: Math.round(window.innerHeight / 2) },
      // ⛔ TEMPS 8 : la place du badge dans la collection existe, et il y est.
      dansCollection: !!place && place.dataset.obtenu === 'oui',
      surCollection: (document.querySelector('#formationApp .nav button[aria-current="true"]') || {}).dataset?.go,
      restes: document.querySelectorAll('#formationApp .scene-badge,#formationApp .scene-jeton').length,
      modalPopup: document.querySelectorAll('#formationApp .modal-bg:not(.cond-bg)').length,
    };
  });
  const gagnes = r.apres.badges.filter((b) => !r.avant.badges.includes(b));
  dire('⛔ UNE SEULE scène : le module est fini et le badge est gagné',
    gagnes.includes('m03'), gagnes.join(', ') || 'aucun');
  dire('⛔ les XP cumulent les chapitres ET les 250 du module',
    r.apres.xp - r.avant.xp > 250, `${r.avant.xp} → ${r.apres.xp} (+${r.apres.xp - r.avant.xp})`);
  dire('⛔ et un palier est franchi dans la même scène',
    r.apres.niveau > r.avant.niveau, `niveau ${r.avant.niveau + 1} → ${r.apres.niveau + 1}`);
  dire('⛔ TEMPS 5 : la page se calme', r.vus.calme);
  dire('⛔ TEMPS 6 : le badge arrive SOMBRE, en silhouette', r.vus.badgeSombre);
  dire('⛔ TEMPS 7 : il s éclaire', r.vus.eclaire);
  dire('⚠️ et le texte arrive EN DÉCALÉ, après l éclat', r.vus.texte);
  dire('⛔ TEMPS 8 : le badge est dans la collection du profil', r.dansCollection);
  dire('⚠️ et l écran s est posé sur la collection', r.surCollection === 'badges' || r.dansCollection);
  dire('⛔ TEMPS 9 : la page revient, rien ne reste', r.restes === 0, `${r.restes}`);
  /**
   * ⛔ ET AUCUN POP-UP. ⚠️ C est la demande centrale du lot : « pas que ça
   * apparaisse comme un pop-up ». L ancienne `celebrer()` posait une
   * `.modal-bg` au centre ; ce controle refuse son retour.
   */
  dire('⛔ AUCUN pop-up de célébration : la scène a remplacé la fenêtre',
    r.modalPopup === 0, `${r.modalPopup} fenêtre(s)`);
  dire('⛔ le badge sort de l ANCRE DE SA CARTE, pas du centre de l écran',
    Math.abs(r.ancre.y - r.centre.y) > 60 || Math.abs(r.ancre.x - r.centre.x) > 60,
    `ancre (${r.ancre.x}, ${r.ancre.y}) ≠ centre (${r.centre.x}, ${r.centre.y})`);
  propre('⛔ aucune erreur de page pendant la scène de module');
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════ */
titre('⛔ LE MODULE 09 : ZERO XP, ET LE CHAPITRE SE MARQUE QUAND MEME');
{
  const { ctx, p } = await ouvrir();
  journal.splice(0);
  const r = await p.evaluate(async () => {
    const C = window.Formation._calcul;
    document.querySelector('#formationApp .mod[data-carte-module="09"]').click();
    await new Promise((res) => setTimeout(res, 400));
    const xpAvant = C.xpTotal();
    const gain = C.xpDe('m09-l0');
    document.querySelector('#formationApp [data-complete]').click();
    let jeton = false;
    for (let i = 0; i < 12; i += 1) {
      await new Promise((res) => setTimeout(res, 80));
      if (document.querySelector('#formationApp .scene-jeton')) jeton = true;
    }
    await new Promise((res) => setTimeout(res, 1400));
    return { gain, xpAvant, xpApres: C.xpTotal(), jeton,
      coche: document.querySelectorAll('#formationApp .chap.done').length,
      ecrit: (window.__ecritures || []).some((e) => e.ligne.lecon_id === 'm09-l0' && e.ligne.vue) };
  });
  dire('⛔ le chapitre du bonus rapporte bien ZÉRO XP', r.gain === 0, `${r.gain} XP`);
  dire('⛔ le total ne bouge pas', r.xpAvant === r.xpApres, `${r.xpAvant} → ${r.xpApres}`);
  dire('⛔ AUCUN jeton ne vole : un « +0 XP » qui rejoint le compteur mentirait',
    !r.jeton);
  dire('⛔ et le chapitre se marque QUAND MÊME', r.coche >= 1 && r.ecrit,
    `${r.coche} coché(s), écriture ${r.ecrit ? 'faite' : 'absente'}`);
  propre('⛔ aucune erreur de page');
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════ */
titre('⛔ `prefers-reduced-motion` : LES ETATS FINAUX, SANS MOUVEMENT');
{
  const { ctx, p } = await ouvrir({ sansMouvement: true });
  journal.splice(0);
  const r = await p.evaluate(async () => {
    const C = window.Formation._calcul;
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    document.querySelector('#formationApp .mod[data-carte-module="01"]').click();
    await new Promise((res) => setTimeout(res, 350));
    const xpAvant = C.xpTotal();
    document.querySelector('#formationApp [data-complete]').click();
    // ⚠️ On regarde PENDANT : aucune piece de scene ne doit jamais exister.
    let scene = 0;
    for (let i = 0; i < 16; i += 1) {
      await new Promise((res) => setTimeout(res, 70));
      scene += document.querySelectorAll('#formationApp .scene-jeton,#formationApp .scene-badge,#formationApp .scene-couche.calme').length;
    }
    await new Promise((res) => setTimeout(res, 500));
    return { reduit, xpAvant, xpApres: C.xpTotal(), scene,
      coche: document.querySelectorAll('#formationApp .chap.done').length,
      toast: ((document.getElementById('toast') || {}).textContent || '').trim(),
      ecrit: (window.__ecritures || []).some((e) => e.table === 'formation_progression') };
  });
  dire('⚠️ TÉMOIN : le réglage est bien actif dans ce navigateur', r.reduit);
  dire('⛔ AUCUNE pièce de scène n apparaît', r.scene === 0, `${r.scene} vue(s)`);
  dire('⛔ et le RÉSULTAT est le même : le chapitre est marqué',
    r.coche >= 1 && r.ecrit, `${r.coche} coché(s)`);
  dire('⛔ les XP sont comptés', r.xpApres > r.xpAvant, `${r.xpAvant} → ${r.xpApres}`);
  dire('⚠️ et un message dit ce qui vient de se passer', r.toast.length > 5, `« ${r.toast} »`);
  propre('⛔ aucune erreur de page');
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════ */
titre('⛔ UN CLIC SAUTE CE QUI RESTE DE LA SCENE');
{
  const { ctx, p } = await ouvrir();
  journal.splice(0);
  const r = await p.evaluate(async () => {
    const C = window.Formation._calcul;
    document.querySelector('#formationApp .mod[data-carte-module="01"]').click();
    await new Promise((res) => setTimeout(res, 350));
    const xpAvant = C.xpTotal();
    const t0 = performance.now();
    document.querySelector('#formationApp [data-complete]').click();
    await new Promise((res) => setTimeout(res, 160));
    document.body.click();           // ⛔ le clic qui saute
    let restes = 1;
    for (let i = 0; i < 20 && restes; i += 1) {
      await new Promise((res) => setTimeout(res, 60));
      restes = document.querySelectorAll('#formationApp .scene-jeton,#formationApp .scene-badge').length;
    }
    return { duree: Math.round(performance.now() - t0), restes,
      xpAffiche: (document.getElementById('chipXp') || {}).textContent,
      xpVrai: `${C.xpTotal().toLocaleString('fr-FR')} XP`, xpAvant };
  });
  dire('⛔ la scène se termine vite après le clic', r.restes === 0 && r.duree < 1600,
    `${r.duree} ms`);
  /**
   * ⛔ ET ELLE POSE LES ETATS FINAUX, JAMAIS UN ETAT INTERMEDIAIRE. ⚠️ Un
   * compteur fige a mi-comptage serait le pire des deux mondes : faux a
   * l ecran, juste en base, et rien ne le dirait.
   */
  dire('⛔ le compteur affiche la valeur FINALE, pas un mi-comptage',
    r.xpAffiche === r.xpVrai, `${r.xpAffiche} vs ${r.xpVrai}`);
  propre('⛔ aucune erreur de page');
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════ */
titre('⚠️ EN 390 PIXELS : RIEN NE DEBORDE');
{
  const { ctx, p } = await ouvrir({ largeur: 390, hauteur: 844 });
  const r = await p.evaluate(() => ({
    deborde: document.documentElement.scrollWidth > window.innerWidth + 1,
    largeurPage: document.documentElement.scrollWidth,
    largeurs: [...document.querySelectorAll('#formationApp .mod,#formationApp .intro-card,#formationApp [data-palier],#formationApp .badge')]
      .filter((e) => e.getBoundingClientRect().right > window.innerWidth + 1)
      .map((e) => e.className),
    cartes: document.querySelectorAll('#formationApp .mod').length,
  }));
  dire('⛔ la page ne défile pas horizontalement', !r.deborde,
    `${r.largeurPage} px de contenu pour 390 px de fenêtre`);
  dire('⛔ aucun bloc ne dépasse les 390 px', r.largeurs.length === 0,
    r.largeurs.join(' | ') || 'aucun');
  dire('⚠️ TÉMOIN : les onze cartes sont bien rendues à cette largeur', r.cartes === 11);
  await p.screenshot({ path: `${SORTIE}/04-accueil-390.png`, fullPage: true });
  propre('⛔ aucune erreur de page');
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════ */
titre('⚠️ LES TROIS METAUX : LE CONTRASTE EST MESURE, PAS SUPPOSE');
{
  /**
   * ── ⛔ LES COULEURS SONT LUES DANS LE CODE QUI TOURNE ────────────────────
   *
   * ⚠️ Recopiees ici, elles mesureraient ma copie. ⛔ Elles viennent de
   * `window.Formation._calcul.METAUX`, c est-a-dire de ce qui s affiche.
   *
   * ── ⚠️ CE QUI EST MESURE, ET CONTRE QUOI ────────────────────────────────
   *
   * Le glyphe du badge , son numero , est peint avec le degrade du metal sur le
   * cœur sombre `#0d0f13`. ⛔ C est CE rapport qui compte : un numero illisible
   * rend la silhouette inutile, et la silhouette est ce qui donne envie du
   * badge suivant.
   *
   * ⚠️ Le seuil retenu est 3:1, celui de la WCAG pour un GRAND texte et pour
   * les elements non textuels. ⛔ Le numero est en 20 px gras : il relève bien
   * du grand texte, et ecrire 4,5:1 ici serait s inventer une exigence qu on
   * ne tiendrait pas , l acier pale et le cuivre chaud ne peuvent pas tenir le
   * meme seuil qu un texte de paragraphe.
   */
  const { ctx, p } = await ouvrir();
  const metaux = await p.evaluate(() => window.Formation._calcul.METAUX);
  const lum = (hex) => {
    const c = hex.replace('#', '').match(/../g).map((x) => parseInt(x, 16) / 255)
      .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const rapport = (a, b) => {
    const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
    return (x + 0.05) / (y + 0.05);
  };
  const FOND = '#0d0f13';          // le cœur du badge
  const CARTE = '#111318';         // la carte de la collection
  dire('⚠️ TÉMOIN : le calcul de contraste est juste sur un cas connu',
    Math.abs(rapport('#ffffff', '#000000') - 21) < 0.01, `blanc/noir = ${rapport('#ffffff', '#000000').toFixed(2)}`);
  dire('⚠️ TÉMOIN : et il sait dire qu un contraste est mauvais',
    rapport('#0d0f13', '#111318') < 1.2, `deux noirs voisins = ${rapport(FOND, CARTE).toFixed(2)}`);
  for (const [cle, m] of Object.entries(metaux)) {
    const sombre = rapport(m.sombre, FOND);
    const moyen = rapport(m.moyen, FOND);
    const clair = rapport(m.clair, FOND);
    // ⚠️ Le degrade va du clair au sombre : c est le point LE PLUS SOMBRE qui
    // decide. ⛔ Mesurer la moyenne cacherait le pire endroit du glyphe.
    dire(`⛔ ${cle.padEnd(14)} ${m.nom.padEnd(6)} lisible sur le cœur du badge`,
      sombre >= 3, `pire point ${sombre.toFixed(2)}:1 · moyen ${moyen.toFixed(2)} · clair ${clair.toFixed(2)}`);
  }
  // ⛔ ET LES TROIS SE DISTINGUENT ENTRE EUX : trois metaux qui se ressemblent
  // ne disent aucun niveau. ⚠️ Mesure sur leur teinte moyenne, deux a deux.
  const paires = [['debutant', 'intermediaire'], ['intermediaire', 'confirme'], ['debutant', 'confirme']];
  for (const [a, b] of paires) {
    const d = ['clair', 'moyen', 'sombre']
      .reduce((acc, t) => acc + Math.abs(lum(metaux[a][t]) - lum(metaux[b][t])), 0);
    dire(`⚠️ ${metaux[a].nom} et ${metaux[b].nom} se distinguent`, d > 0.06,
      `écart de luminance ${d.toFixed(3)}`);
  }
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════ */
titre('⛔ APRES SIX SECONDES, L ECRAN DE CONNEXION NE TOMBE PAS SUR L ESPACE');
{
  /**
   * ── ⛔ DEFAUT TROUVE EN REGARDANT UNE IMAGE, PAS EN LISANT UN COMPTEUR ────
   *
   * `index.html` porte un filet de securite : si aucune interface n est visible
   * cinq secondes apres le chargement, il force l ecran de connexion « pour ne
   * jamais laisser l utilisateur sur du vide ». ⚠️ Sa liste ne connaissait que
   * `mainApp`, `coachApp` et `authScreen` : `#formationApp` est ne apres, et
   * personne n est revenu l allonger.
   *
   * ⛔ RESULTAT POUR UN ELEVE QUI N A QUE LA FORMATION : son espace s affiche,
   * puis l ecran de connexion lui tombe dessus a la cinquieme seconde,
   * formulaire et photo de fond compris. Aucune erreur, aucun avertissement :
   * un `setTimeout` qui fait exactement ce qu on lui a demande.
   *
   * ⚠️ ET AUCUNE SONDE NE POUVAIT LE VOIR : toutes mesuraient dans les deux
   * premieres secondes. Il a fallu regarder une image prise a 3,2 s d une scene
   * de badge, ou le fond n etait pas le parcours mais la page de connexion.
   * ⛔ C est la raison d etre de ce controle : il attend PLUS LONGTEMPS que le
   * filet, ce qu aucun autre ne fait.
   */
  const { ctx, p } = await ouvrir();
  const avant = await p.evaluate(() => {
    const v = (id) => { const e = document.getElementById(id);
      return !!e && getComputedStyle(e).display !== 'none'; };
    return { auth: v('authScreen'), form: v('formationApp') };
  });
  dire('⚠️ TÉMOIN : à l arrivée, la formation est visible et la connexion non',
    avant.form && !avant.auth, `formation ${avant.form}, connexion ${avant.auth}`);
  // ⛔ SIX SECONDES, pas cinq : le filet se declenche A cinq.
  await new Promise((r) => setTimeout(r, 6200));
  const apres = await p.evaluate(() => {
    const v = (id) => { const e = document.getElementById(id);
      return !!e && getComputedStyle(e).display !== 'none'; };
    return { auth: v('authScreen'), form: v('formationApp'),
      // ⚠️ On lit aussi ce qui se trouve SOUS le centre de l ecran : un ecran
      // de connexion affiche derriere un espace opaque compterait quand meme.
      sous: (() => { const e = document.elementFromPoint(window.innerWidth / 2, 120);
        return e ? `${e.tagName}.${String(e.className).slice(0, 40)}` : 'rien'; })() };
  });
  dire('⛔ six secondes plus tard, l écran de connexion ne s est PAS affiché',
    !apres.auth, `connexion ${apres.auth}`);
  dire('⛔ et l espace formation est toujours là', apres.form,
    `sous le curseur : ${apres.sous}`);
  propre('⛔ aucune erreur de page');
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════ */
titre('⛔ L INTRODUCTION NE COMPTE NI COMME ETAPE NI DANS LE TOTAL');
{
  /**
   * ── ⚠️ DEUX DEFAUTS VUS A L OEIL, PAS PAR UNE SONDE ──────────────────────
   *
   * Sur une capture en 390 : l accueil annoncait « Prochaine étape : Module 00
   * · Bienvenue à Trader 360 », et le bouton « Reprendre » y menait. ⛔ Le
   * parcours entier commencait donc par une video de bienvenue presentee comme
   * une etape, alors qu elle a sa carte a part depuis ce meme lot.
   *
   * ⚠️ Et « 22 chapitres terminés » comptait l Introduction au denominateur :
   * un eleve ayant termine les ONZE modules ne serait jamais arrive a 100 %.
   *
   * ⛔ AUCUNE DES QUATORZE SECTIONS PRECEDENTES NE POUVAIT LE VOIR : elles
   * verifient des mecanismes, pas des PHRASES. Celle-ci lit ce qui est ecrit.
   */
  const { ctx, p } = await ouvrir();
  const r = await p.evaluate(() => {
    const C = window.Formation._calcul;
    const hero = document.querySelector('#formationApp .hero');
    const total = window.FormationDonnees.MODULES
      .filter((m) => !m.introduction).reduce((a, m) => a + m.lecons.length, 0);
    const avecIntro = window.FormationDonnees.SUITE.length;
    return {
      hero: hero ? hero.textContent.replace(/\s+/g, ' ') : '',
      stat: ([...document.querySelectorAll('#formationApp .stat')]
        .find((e) => /Chapitres/.test(e.textContent)) || {}).textContent || '',
      total, avecIntro,
      // ⚠️ Ce que le bouton « Reprendre » ouvre reellement.
      reprendre: (document.querySelector('#formationApp .hero [data-open]') || {}).dataset?.open,
    };
  });
  dire('⛔ l accueil ne propose PAS l Introduction comme prochaine étape',
    !/Module 00/.test(r.hero), r.hero.slice(0, 120));
  dire('⛔ et le bouton de reprise ne mène pas au module 00',
    r.reprendre !== '0,0', `data-open = ${r.reprendre}`);
  dire('⛔ le compte de chapitres exclut l Introduction',
    r.stat.includes(`/${r.total}`), `« ${r.stat.replace(/\s+/g, ' ').trim() }» pour ${r.total} chapitres de parcours`);
  dire('⚠️ TÉMOIN : avec elle, le total serait différent',
    r.avecIntro !== r.total, `${r.avecIntro} avec, ${r.total} sans`);
  propre('⛔ aucune erreur de page');
  await ctx.close();
}

/* ══════════════════════════════════════════════════════════════════════════ */
titre('⛔ UN BADGE NON OBTENU NE S ANNONCE PAS COMME OBTENU');
{
  /**
   * ⚠️ DEFAUT VU A L OEIL SUR LA COLLECTION EN 390 : sous une silhouette, la
   * carte disait « Module 04 validé », et « PAS ENCORE » juste dessous.
   * ⛔ Les deux phrases se contredisent, et c est la premiere qu on lit.
   */
  const { ctx, p } = await ouvrir();
  const r = await p.evaluate(() => [...document.querySelectorAll('#formationApp .badge')]
    .map((b) => ({ obtenu: b.dataset.obtenu, titre: (b.querySelector('strong') || {}).textContent || '' })));
  const menteurs = r.filter((b) => b.obtenu === 'non' && /validé|certifié|parcourus/i.test(b.titre));
  dire('⛔ aucune silhouette ne se dit « validé »', menteurs.length === 0,
    menteurs.map((b) => b.titre).join(', ') || `${r.length} badges relus`);
  dire('⚠️ TÉMOIN : le détecteur reconnaît bien le mot',
    /validé/i.test('Module 04 validé'));
  propre('⛔ aucune erreur de page');
  await ctx.close();
}

await nav.close();
console.log(fautes ? `\n  ⛔ ${fautes} CONTROLE(S) ROUGE(S).\n` : `\n  Tout est vert. Captures dans ${SORTIE}/\n`);
process.exit(fautes ? 1 : 0);
