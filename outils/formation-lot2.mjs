/**
 * Éprouve l'enrichissement du sommaire : citation, reprise, pourcentage, notes,
 * parcours, et les quatre états du bouton Journal.
 *
 * ⚠️ CE QU'ELLE NE PROUVE PAS. `formation_notes` et `formation_progression`
 * n'existent pas en base, vérifié le 11/10/2026 : seule `acces_membre` a été
 * appliquée. Les données viennent donc d'un double. La sonde mesure le RENDU et
 * la LOGIQUE, ⛔ pas la persistance, qui reste non mesurable.
 *
 * Usage : node outils/formation-lot2.mjs 4413
 */
import { mkdirSync } from 'node:fs';

// `sharp` vit dans le depot du site : on ne l ajoute pas comme dependance ici.
const { default: sharp } = await import('/Users/nadirkasmi/Projets/trader360-site/node_modules/sharp/dist/index.cjs');

const CHEMIN_PUPPETEER = '/Users/nadirkasmi/Projets/trader360-site/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
let puppeteer;
try { ({ default: puppeteer } = await import(CHEMIN_PUPPETEER)); }
catch (e) { console.error(`\n  ⛔ puppeteer-core introuvable : ${e.message}`); process.exit(1); }

const PORT = process.argv[2] ?? '4413';
const SORTIE = process.argv[3] ?? 'captures/formation-lot2';
mkdirSync(SORTIE, { recursive: true });

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

/** Prépare une page : double de Supabase, session feinte, interfaces rangées. */
async function preparer(page, opts = {}) {
  const { progression = [], notes = [], droits = {}, mantra = null, sombre = false } = opts;
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: 'load' });
  await page.evaluate((prog, nts, dr, mant, dark) => {
    if (mant) {
      localStorage.setItem('userMantra', mant.texte);
      localStorage.setItem('userMantraAuthor', mant.auteur || '');
    } else {
      localStorage.removeItem('userMantra');
      localStorage.removeItem('userMantraAuthor');
    }
    window.__ecritures = [];
    const table = (nom) => ({
      select() { return this; },
      eq() {
        const liste = {
          data: nom === 'formation_progression' ? prog : nom === 'formation_notes' ? nts : [],
          error: null,
        };
        const un = { data: Object.assign({
          formation_actif: true, journal_actif: false,
          journal_demande_le: null, journal_retire_le: null,
        }, dr), error: null };
        return {
          maybeSingle: () => Promise.resolve(un),
          single: () => Promise.resolve(un),
          then: (ok, ko) => Promise.resolve(liste).then(ok, ko),
        };
      },
      update(ligne) {
        window.__ecritures.push({ table: nom, type: 'update', ligne });
        return { eq: () => Promise.resolve({ error: null }) };
      },
      upsert(ligne) {
        window.__ecritures.push({ table: nom, type: 'upsert', ligne });
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
    document.body.classList.toggle('dark-mode', dark);
    ['authScreen', 'choixEspace', 'coachApp'].forEach((id) => {
      const e = document.getElementById(id);
      if (e) e.style.setProperty('display', 'none', 'important');
    });
    document.getElementById('mainApp').style.setProperty('display', 'flex', 'important');
    document.querySelectorAll('#mainApp .section').forEach((s) => s.classList.add('hidden'));
    document.getElementById('formation').classList.remove('hidden');
    window.currentUser = { role: 'student', uuid: 'eleve-double-0000' };
  }, progression, notes, droits, mantra, sombre);
  await page.evaluate(() => window.Formation.ouvrir());
  await new Promise((r) => setTimeout(r, 350));
}

/* ══ 1. LE FOND, MESURÉ EN CONTRASTE ═══════════════════════════════════════ */
console.log('\n  ══ LE FOND : CONTRASTE AUX DEUX EXTREMES DE L IMAGE ══');
{
  /**
   * ⚠️ UN SEUL POINT DE MESURE NE DIT RIEN D UNE IMAGE. On echantillonne la
   * zone de contenu, on retient le pixel le plus CLAIR et le plus SOMBRE, et on
   * mesure le texte contre les deux. Le pire des deux est le verdict.
   */
  for (const sombre of [false, true]) {
    const p = await nav.newPage();
    await p.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await preparer(p, { sombre, mantra: { texte: 'Le succes est la somme de petits efforts.', auteur: 'Robert Collier' } });
    /**
     * ⚠️ ON ECHANTILLONNE LES PIXELS REELLEMENT RENDUS, PAS LE CSS.
     * Une premiere version lisait les `backgroundColor` des surfaces : elle
     * rendait DEUX FOIS LA MEME VALEUR pour « le plus clair » et « le plus
     * sombre », parce que toutes les cartes portent la meme couleur. ⛔ Elle ne
     * mesurait donc pas l image du tout, et son resultat etait indiscernable
     * d une vraie mesure. L image varie, le CSS non.
     */
    /**
     * ⚠️ TROISIEME ET DERNIERE FORME DE CETTE MESURE, et les deux premieres
     * etaient fausses de deux facons differentes :
     *   1. Elle lisait les `backgroundColor` du CSS : deux fois la meme valeur
     *      pour « le plus clair » et « le plus sombre ». Elle ne mesurait pas
     *      l image, qui est pourtant ce qui varie.
     *   2. Elle echantillonnait tous les pixels, TEXTE COMPRIS : en mode clair,
     *      le pixel le plus sombre etait le texte, et elle comparait le texte a
     *      lui-meme pour conclure 1,13:1.
     *
     * ⛔ ET LA TROISIEME FAUTE SERAIT D ECHANTILLONNER TOUT LE FOND. Le pixel
     * dore d une pastille et une zone de photographie hors carte font chuter le
     * ratio alors qu AUCUN TEXTE N Y REPOSE. Ce qui compte est le fond DERRIERE
     * CHAQUE TEXTE : on prend donc le rectangle de chaque element textuel, on
     * mesure le fond a l interieur, et on retient le PIRE de tous.
     */
    await p.evaluate(() => {
      const s = document.createElement('style');
      s.id = 'sonde-sans-texte';
      s.textContent = '#formation, #formation * { color: transparent !important; text-shadow: none !important; }';
      document.head.appendChild(s);
    });
    const vue = await p.evaluate(() => {
      const r2 = document.getElementById('formation').getBoundingClientRect();
      return { x: Math.round(r2.x), y: Math.round(r2.y),
               width: Math.round(r2.width), height: Math.min(900, Math.round(r2.height)) };
    });
    const png = await p.screenshot({ clip: vue });
    await p.evaluate(() => document.getElementById('sonde-sans-texte').remove());

    const textes = await p.evaluate((base) => {
      const sortie = [];
      for (const el of document.querySelectorAll('#formation *')) {
        const direct = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!direct) continue;
        const b = el.getBoundingClientRect();
        if (b.width < 4 || b.height < 4) continue;
        if (b.y < base.y || b.y + b.height > base.y + base.height) continue;
        sortie.push({
          classe: el.className || el.tagName,
          couleur: (getComputedStyle(el).color.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number),
          x: Math.round(b.x - base.x), y: Math.round(b.y - base.y),
          w: Math.round(b.width), h: Math.round(b.height),
        });
      }
      return sortie;
    }, vue);

    const { data: px, info } = await sharp(png).raw().toBuffer({ resolveWithObject: true });
    const lin = (c) => { const s = c / 255; return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
    const lum = ([a, b, c]) => 0.2126 * lin(a) + 0.7152 * lin(b) + 0.0722 * lin(c);
    const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((u, v) => v - u); return (x + 0.05) / (y + 0.05); };
    const pixel = (x, y) => {
      const i = (y * info.width + x) * info.channels;
      return [px[i], px[i + 1], px[i + 2]];
    };
    /**
     * ⚠️ UN SEUL PIXEL FAUTIF NE FAIT PAS UN DEFAUT DE LISIBILITE. Le rectangle
     * d un element deborde sa carte par ses bords arrondis et par ses marges :
     * quelques points y tombent sur la photographie. On retient donc le pire
     * pixel ET la PART des points sous le seuil. Un bord se voit a sa part
     * minuscule ; un vrai defaut couvre la zone.
     * ⛔ Sans cette part, la mesure confond un liseré d un texte illisible.
     */
    let pire = { ratio: Infinity };
    let echantillons = 0;
    let pireZone = { part: 0 };
    for (const e of textes) {
      let min = Infinity, fondPire = null, sous = 0, total = 0;
      for (let y = e.y; y < Math.min(e.y + e.h, info.height); y += 2) {
        for (let x = e.x; x < Math.min(e.x + e.w, info.width); x += 2) {
          if (x < 0 || y < 0) continue;
          const c = pixel(x, y);
          const r2 = ratio(e.couleur, c);
          echantillons += 1; total += 1;
          if (r2 < 4.5) sous += 1;
          if (r2 < min) { min = r2; fondPire = c; }
        }
      }
      if (min < pire.ratio) pire = { ratio: min, fond: fondPire, part: total ? sous / total : 0, ...e };
      const part = total ? sous / total : 0;
      if (part > pireZone.part) pireZone = { part, sous, total, ...e };
    }
    const r = {
      elements: textes.length, echantillons,
      pire, pireZone,
      etalonBlancNoir: ratio([255, 255, 255], [0, 0, 0]),
      etalonIdentique: ratio([128, 128, 128], [128, 128, 128]),
    };
    /**
     * ⚠️ TEMOIN : LES CARTES DU JOURNAL, mesurees par le MEME instrument.
     * Les cartes du journal sont translucides sur la photographie : une part de
     * leurs points passe donc aussi sous le seuil. ⛔ Sans ce temoin, on
     * attribuerait a l espace formation une propriete de tout le journal, et on
     * « corrigerait » en s ecartant du theme qu on doit suivre.
     */
    const temoin = await p.evaluate(async (base) => {
      document.getElementById('formation').classList.add('hidden');
      document.getElementById('dashboard').classList.remove('hidden');
      await new Promise((r2) => setTimeout(r2, 250));
      const sortie = [];
      for (const el of document.querySelectorAll('#dashboard .trader-card *')) {
        const direct = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
        if (!direct) continue;
        const b = el.getBoundingClientRect();
        if (b.width < 4 || b.height < 4) continue;
        if (b.y < base.y || b.y + b.height > base.y + base.height) continue;
        sortie.push({ classe: el.className || el.tagName,
          couleur: (getComputedStyle(el).color.match(/\d+/g) || [0, 0, 0]).slice(0, 3).map(Number),
          x: Math.round(b.x - base.x), y: Math.round(b.y - base.y),
          w: Math.round(b.width), h: Math.round(b.height) });
      }
      return sortie;
    }, vue);
    let temoinPart = 0, temoinNom = '(aucun)';
    if (temoin.length) {
      await p.evaluate(() => {
        const st = document.createElement('style');
        st.id = 'sonde-sans-texte';
        st.textContent = '#dashboard, #dashboard * { color: transparent !important; text-shadow: none !important; }';
        document.head.appendChild(st);
      });
      const png2 = await p.screenshot({ clip: vue });
      await p.evaluate(() => document.getElementById('sonde-sans-texte').remove());
      const b2 = await sharp(png2).raw().toBuffer({ resolveWithObject: true });
      const px2 = b2.data, i2 = b2.info;
      for (const e of temoin) {
        let sous = 0, total = 0;
        for (let y = e.y; y < Math.min(e.y + e.h, i2.height); y += 2) {
          for (let x = e.x; x < Math.min(e.x + e.w, i2.width); x += 2) {
            if (x < 0 || y < 0) continue;
            const k = (y * i2.width + x) * i2.channels;
            total += 1;
            if (ratio(e.couleur, [px2[k], px2[k + 1], px2[k + 2]]) < 4.5) sous += 1;
          }
        }
        const part = total ? sous / total : 0;
        if (part > temoinPart) { temoinPart = part; temoinNom = String(e.classe).slice(0, 30); }
      }
    }
    r.temoinPart = temoinPart; r.temoinNom = temoinNom;

    console.log(`\n     mode ${sombre ? 'sombre' : 'clair'}`);
    dire('  etalon : blanc sur noir = 21,00', Math.abs(r.etalonBlancNoir - 21) < 0.01, r.etalonBlancNoir.toFixed(2));
    dire('  etalon : ⛔ gris sur lui-meme = 1,00', Math.abs(r.etalonIdentique - 1) < 0.001, r.etalonIdentique.toFixed(2));
    console.log(`       ${r.elements} elements textuels, ${r.echantillons} points de fond mesures`);
    console.log(`       le PIRE : « ${String(r.pire.classe).slice(0, 38)} »`);
    console.log(`         texte rgb(${r.pire.couleur.join(',')}) sur fond rgb(${r.pire.fond.join(',')})  ${r.pire.ratio.toFixed(2)}:1`);
    console.log(`         ⚠️ part des points sous 4,5 pour CET element : ${(r.pire.part * 100).toFixed(1)} %`);
    console.log(`       la pire ZONE : « ${String(r.pireZone.classe).slice(0, 38)} »  ${(r.pireZone.part * 100).toFixed(1)} % de ses points sous 4,5  (${r.pireZone.sous}/${r.pireZone.total})`);
    // ⛔ Le verdict porte sur la PART, pas sur le pixel isole : au-dela de 5 %
    // de la surface d un texte, ce n est plus un bord, c est un fond illisible.
    console.log(`       ⚠️ TEMOIN, cartes du JOURNAL, meme instrument : ${(r.temoinPart * 100).toFixed(1)} % sur « ${r.temoinNom} »`);
    // ⛔ Le verdict se prend PAR RAPPORT AU JOURNAL, pas dans l absolu : les
    // cartes du journal sont translucides sur la photographie, une part de leurs
    // points passe donc aussi sous le seuil. L espace formation doit faire aussi
    // bien que le journal, pas mieux : il suit son theme.
    const seuil = Math.max(0.05, r.temoinPart);
    dire('  ⚠️ la formation ne fait pas pire que le journal lui-meme',
      r.pireZone.part <= seuil + 0.005,
      `formation ${(r.pireZone.part * 100).toFixed(1)} % sur « ${String(r.pireZone.classe).slice(0, 26)} », journal ${(r.temoinPart * 100).toFixed(1)} %`);
    await p.close();
  }
}

/* ══ 2. LA CITATION VIENT DE LA MEME SOURCE ════════════════════════════════ */
console.log('\n  ══ LA CITATION ══');
{
  const p = await nav.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await preparer(p, { mantra: { texte: 'Temoin de citation du journal', auteur: 'Source localStorage' } });
  const r = await p.evaluate(() => {
    const f = document.querySelector('#formation .formation-citation');
    const j = document.getElementById('mantraText');
    return {
      affichee: !!f && f.textContent.includes('Temoin de citation du journal'),
      memeCle: localStorage.getItem('userMantra'),
      journalLitLaMeme: !!j,
    };
  });
  dire('la citation du journal apparait dans la formation', r.affichee);
  dire('⚠️ meme cle `userMantra` que `#mantraContainer`', r.memeCle === 'Temoin de citation du journal');
  dire('le journal lit bien cette meme cle', r.journalLitLaMeme);
  await p.close();

  // ⚠️ TEMOIN : sans citation dans le journal, la formation n en invente aucune.
  const p2 = await nav.newPage();
  await p2.setViewport({ width: 1440, height: 900 });
  await preparer(p2, { mantra: null });
  const vide = await p2.evaluate(() => !document.querySelector('#formation .formation-citation'));
  dire('⚠️ TEMOIN : aucune citation dans le journal, aucune inventee ici', vide);
  await p2.close();
}

/* ══ 3. LE MARQUEUR DE REPRISE ═════════════════════════════════════════════ */
console.log('\n  ══ LA REPRISE, LES DEUX CAS ══');
{
  const p = await nav.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await preparer(p, { progression: [] });
  const jamais = await p.evaluate(() => document.querySelector('#formation .formation-reprise-ou').textContent.trim());
  console.log(`     jamais commence : « ${jamais} »`);
  dire('⛔ aucun « reprendre a 0 min »', !/0\s*(min|s)\b/.test(jamais));
  dire('on invite a commencer', /pas encore commenc/i.test(jamais));
  await p.close();

  const p2 = await nav.newPage();
  await p2.setViewport({ width: 1440, height: 900 });
  await preparer(p2, { progression: [
    { lecon_id: 'm01-l2', vue: false, progress_seconds: 3300, last_watched_at: '2026-10-10T10:00:00Z' },
  ] });
  const commence = await p2.evaluate(() => document.querySelector('#formation .formation-reprise-ou').textContent.replace(/\s+/g, ' ').trim());
  console.log(`     commence a 3300 s : « ${commence} »`);
  dire('le module est nomme', /Module 01/.test(commence));
  dire('la lecon est numerotee', /leçon 3/.test(commence));
  dire('⚠️ la duree est lisible, pas en secondes brutes', /55 min/.test(commence) && !/3300/.test(commence));
  await p2.close();
}

/* ══ 4. LE POURCENTAGE, ET SON TEMOIN ══════════════════════════════════════ */
console.log('\n  ══ LE POURCENTAGE ══');
{
  const p = await nav.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await preparer(p);
  const partiel = await p.evaluate(() => document.querySelector('#formation .formation-compteur').textContent.replace(/\s+/g, ' ').trim());
  console.log(`     structure incomplete : « ${partiel} »`);
  dire('⛔ aucun pourcentage affiche sur une structure partielle', !/%/.test(partiel));
  dire('la mention dit pourquoi', /dix modules seront remplis/.test(partiel));

  // ⚠️ TEMOIN : avec les dix modules remplis, le pourcentage DOIT apparaitre.
  // Sans ce temoin, « pas de pourcentage » pourrait venir d un bug d affichage.
  const complet = await p.evaluate(() => {
    window.FormationDonnees.MODULES.forEach((m, i) => {
      if (m.lecons.length === 0) {
        m.lecons = [{ id: `faux-${i}`, titre: 'Lecon de temoin', description: '', video: null }];
      }
    });
    window.FormationDonnees.SUITE.length = 0;
    window.FormationDonnees.MODULES.forEach((m) => m.lecons.forEach((l) =>
      window.FormationDonnees.SUITE.push(Object.assign({}, l, { module: m.numero }))));
    window.Formation.ouvrirSommaire();
    return document.querySelector('#formation .formation-compteur').textContent.replace(/\s+/g, ' ').trim();
  });
  console.log(`     ⚠️ TEMOIN, dix modules remplis : « ${complet} »`);
  dire('⚠️ TEMOIN : le pourcentage apparait quand la structure est complete', /%/.test(complet));
  await p.close();
}

/* ══ 5. LA VUE DES NOTES ═══════════════════════════════════════════════════ */
console.log('\n  ══ TOUTES MES NOTES ══');
{
  const p = await nav.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await preparer(p, { notes: [
    { lecon_id: 'm01-l0', texte: 'Premiere note : la routine du matin.' },
    { lecon_id: 'm01-l3', texte: 'Deuxieme note : tenir la discipline.' },
    { lecon_id: 'm01-l6', texte: 'Troisieme note : entrer dans la zone.' },
  ] });
  const r = await p.evaluate(async () => {
    window.Formation.ouvrirNotes();
    await new Promise((res) => setTimeout(res, 150));
    const cartes = document.querySelectorAll('#formation .formation-note-carte');
    const origines = [...cartes].map((c) => c.querySelector('.formation-carte-numero').textContent.trim());
    window.Formation.filtrerNotes('discipline');
    await new Promise((res) => setTimeout(res, 150));
    const apresFiltre = document.querySelectorAll('#formation .formation-note-carte').length;
    window.Formation.filtrerNotes('');
    await new Promise((res) => setTimeout(res, 150));
    document.querySelectorAll('#formation .formation-note-carte button')[1].click();
    await new Promise((res) => setTimeout(res, 200));
    return {
      nombre: cartes.length, origines, apresFiltre,
      arriveeTitre: (document.querySelector('#formation .formation-titre') || {}).textContent || '',
      zoneNote: (document.getElementById('formationNote') || {}).value || '',
    };
  });
  dire('les trois notes sont listees', r.nombre === 3, String(r.nombre));
  dire('chacune dit de quelle lecon elle vient', r.origines.every((o) => /Module 01 ·/.test(o)), r.origines.join(' | '));
  dire('le filtre reduit la liste', r.apresFiltre === 1, `${r.apresFiltre} apres filtre`);
  dire('le saut mene a la bonne lecon', /Développer sa discipline/.test(r.arriveeTitre), r.arriveeTitre.trim());
  dire('et la note y est chargee', /discipline/i.test(r.zoneNote), r.zoneNote.slice(0, 40));
  await p.close();
}

/* ══ 6. LES QUATRE ETATS DU BOUTON JOURNAL ═════════════════════════════════ */
console.log('\n  ══ LES QUATRE ETATS DU BOUTON JOURNAL ══');
{
  const CAS = [
    ['actif', { journal_actif: true }],
    ['jamais', {}],
    ['attente', { journal_demande_le: '2026-10-10T09:00:00Z' }],
    ['retire', { journal_retire_le: '2026-10-01T09:00:00Z' }],
  ];
  const vus = [];
  for (const [attendu, dr] of CAS) {
    const p = await nav.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    await preparer(p, { droits: dr });
    const r = await p.evaluate(async () => {
      await window.Acces.charger();
      window.Acces.appliquer();
      const b = document.querySelector('[data-journal-bouton]');
      // ⚠️ ON LIT AVANT DE CLIQUER. Une premiere version lisait apres : dans le cas
      // « jamais demande », le clic POSE la demande et le bouton devient
      // « Demande envoyee ». La sonde lisait donc « attente » et accusait le code
      // d un defaut qui etait le sien, ⛔ et son temoin « quatre rendus distincts »
      // tombait a trois pour la meme raison.
      const avant = { etat: b.dataset.etatJournal, libelle: b.textContent.trim(), inactif: b.disabled };
      b.click();
      await new Promise((res) => setTimeout(res, 200));
      const msg = document.getElementById('journalMessageRetire');
      return {
        etat: avant.etat, libelle: avant.libelle, inactif: avant.inactif,
        apresClic: b.dataset.etatJournal,
        message: msg && !msg.hidden ? msg.textContent.trim() : '',
        ecritures: JSON.stringify(window.__ecritures),
      };
    });
    vus.push(`${r.etat}|${r.libelle}|${r.inactif}|${r.message}`);
    console.log(`     ${attendu.padEnd(8)} libelle « ${r.libelle} »  inactif ${r.inactif}`);
    if (r.message) console.log(`               message « ${r.message} »`);
    dire(`  l etat lu est « ${attendu} »`, r.etat === attendu, r.etat);
    if (attendu === 'attente') dire('  le bouton est inactif', r.inactif);
    if (attendu === 'retire') {
      dire('  ⛔ pas un bouton grise : il reste cliquable', !r.inactif);
      dire('  le message exact est affiche',
        r.message === "Tu n'es plus abonné aux outils. Recontacte les coachs pour l'accompagnement.", r.message);
    }
    if (attendu === 'jamais') {
      // ⚠️ Et le clic doit faire BASCULER l affichage : une demande posee qui ne
      // se voit pas laisserait l eleve recliquer sans fin.
      dire('  le clic bascule l affichage vers « attente »', r.apresClic === 'attente', r.apresClic);
      const e = JSON.parse(r.ecritures);
      dire('  le clic enregistre la demande', e.length === 1 && e[0].table === 'acces_membre');
      // ⛔ CONTROLE 9 : rien ne touche le statut du compte ni la formation.
      const cle = e.length ? Object.keys(e[0].ligne) : [];
      dire('  ⛔ UNE SEULE colonne ecrite : journal_demande_le',
        cle.length === 1 && cle[0] === 'journal_demande_le', cle.join(', '));
      dire('  ⛔ ni `status`, ni `formation_actif`, ni `journal_actif`',
        !/status|formation_actif|journal_actif/.test(r.ecritures));
    } else {
      dire('  ⛔ aucune ecriture dans cet etat', r.ecritures === '[]', r.ecritures);
    }
    await p.close();
  }
  // ⚠️ TEMOIN : quatre etats doivent produire quatre rendus DIFFERENTS.
  dire('⚠️ TEMOIN : les quatre rendus sont distincts', new Set(vus).size === 4, `${new Set(vus).size} distincts sur 4`);
}

/* ══ 7. CAPTURES, DEUX MODES, QUATRE TAILLES ═══════════════════════════════ */
console.log('\n  ══ CAPTURES ══');
{
  let n = 0;
  for (const sombre of [false, true]) {
    for (const [l, h] of [[1440, 900], [1440, 620], [390, 844], [390, 620]]) {
      for (const [nom, prog] of [
        ['depart', []],
        ['encours', [{ lecon_id: 'm01-l2', vue: true, progress_seconds: 3300, last_watched_at: '2026-10-10T10:00:00Z' }]],
      ]) {
        const p = await nav.newPage();
        await p.setViewport({ width: l, height: h, deviceScaleFactor: 2 });
        await preparer(p, { sombre, progression: prog,
          mantra: { texte: 'Le succes est la somme de petits efforts repetes.', auteur: 'Robert Collier' } });
        await new Promise((r) => setTimeout(r, 250));
        await p.screenshot({ path: `${SORTIE}/${sombre ? 'sombre' : 'clair'}-${nom}-${l}x${h}.png` });
        n += 1;
        await p.close();
      }
    }
  }
  console.log(`     ${n} captures ecrites dans ${SORTIE}/`);
  dire('16 captures : 2 etats x 4 tailles x 2 modes', n === 16, String(n));
}

await nav.close();
console.log(fautes === 0 ? '\n  Tout est vert.' : `\n  ⛔ ${fautes} ecart(s).`);
process.exit(fautes === 0 ? 0 : 1);
