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
 *    2. la fenetre de parcours l'accueille
 *    3. il la ferme
 *    4. il ouvre une lecon
 *    5. il prend une note
 *    6. il coche « vu »
 *    7. il revient le lendemain
 *    8. il demande le journal
 *    9. un coach accorde
 *   10. il revient : il a les deux espaces
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

/* ══ 1 a 3 : il arrive, la fenetre l accueille, il la ferme ════════════════ */
titre('il arrive, il n a QUE la formation');
{
  const { ctx, p } = await ouvrirPage();
  await p.evaluate(() => window.Acces.orienter());
  await new Promise((r) => setTimeout(r, 600));
  const r = await p.evaluate(() => {
    const vu = (id) => { const e = document.getElementById(id); return !!e && getComputedStyle(e).display !== 'none'; };
    return {
      choix: vu('choixEspace'), app: vu('mainApp'), chemin: location.pathname,
      fenetre: getComputedStyle(document.getElementById('formationFenetre')).display !== 'none',
      phrase: (document.querySelector('#formationFenetre .formation-parcours-phrase') || {}).textContent || '',
      // ⛔ AUCUNE MENTION DU JOURNAL nulle part : ni bouton, ni retour, ni allusion.
      // ⚠️ VISIBLES SEULEMENT. Une premiere version listait toute mention
      // textuelle, masquee comprise : elle signalait « Revenir au journal » sur
      // un bouton parfaitement cache. ⛔ Un element masque n est pas une mention,
      // et la sonde accusait le code d un defaut qui etait le sien.
      mentionsJournal: [...document.querySelectorAll('#formation *')]
        .filter((e) => !!e.offsetParent && !e.hidden)
        .filter((e) => [...e.childNodes].some((n) => n.nodeType === 3 && /journal/i.test(n.textContent)))
        .map((e) => e.textContent.trim().slice(0, 50)),
      retourJournalVisible: (() => {
        const b = document.querySelector('.formation-retour-journal');
        return !!b && !b.hidden && !!b.offsetParent;
      })(),
    };
  });
  dire('il entre directement, sans ecran de choix', !r.choix && r.app);
  dire('la destination est /formation', r.chemin === '/formation', r.chemin);
  dire('la fenetre de parcours l accueille', r.fenetre);
  dire('  avec la phrase de depart', /commences/i.test(r.phrase), r.phrase.trim());
  dire('⛔ aucune mention du journal dans la formation',
    r.mentionsJournal.length === 0 && !r.retourJournalVisible, r.mentionsJournal.join(' | '));
  await p.screenshot({ path: `${SORTIE}/01-arrivee.png` });

  titre('il ferme la fenetre');
  await p.keyboard.press('Escape');
  await new Promise((r2) => setTimeout(r2, 400));
  const f = await p.evaluate(() => ({
    fermee: getComputedStyle(document.getElementById('formationFenetre')).display === 'none',
    ecrit: window.__ecritures.filter((e) => e.table === 'formation_parcours_vu').length,
  }));
  dire('la fenetre se ferme a l echappement', f.fermee);
  dire('⚠️ et l etat part EN BASE, pas en stockage local', f.ecrit === 1, `${f.ecrit} ecriture(s)`);
  await rapatrier(p);
  await ctx.close();
}

/* ══ 4 a 6 : il ouvre une lecon, prend une note, coche vu ══════════════════ */
titre('il ouvre une lecon, prend une note, la marque vue');
{
  const { ctx, p } = await ouvrirPage();
  await p.evaluate(() => window.Acces.orienter());
  await new Promise((r) => setTimeout(r, 600));
  const r = await p.evaluate(async () => {
    // ⚠️ On passe par les VRAIS chemins de l interface : le sommaire, la carte du
    // module, la ligne de lecon. ⛔ Appeler ouvrirLecon() directement sauterait
    // precisement le cablage qu on veut eprouver.
    const fen = document.getElementById('formationFenetre');
    if (getComputedStyle(fen).display !== 'none') await window.Formation.fermerFenetre();
    document.querySelector('#formation .formation-carte:not(.formation-carte-vide)').click();
    await new Promise((res) => setTimeout(res, 250));
    const lignes = document.querySelectorAll('#formation .formation-lecon-ligne');
    const nbLecons = lignes.length;
    lignes[0].click();
    await new Promise((res) => setTimeout(res, 300));
    const zone = document.getElementById('formationNote');
    zone.value = 'Ma premiere note de cours.';
    zone.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 1600));
    const repere = (document.getElementById('formationNoteEtat') || {}).textContent || '';
    document.getElementById('formationVue').click();
    await new Promise((res) => setTimeout(res, 300));
    return {
      nbLecons, repere,
      titreLecon: (document.querySelector('#formationContenu .formation-titre') || {}).textContent || '',
      ecritures: window.__ecritures.map((e) => e.table),
    };
  });
  dire('le sommaire mene au module', r.nbLecons === 7, `${r.nbLecons} lecons`);
  dire('le module mene a la lecon', /Introduction/.test(r.titreLecon), r.titreLecon.trim().slice(0, 40));
  dire('⚠️ le repere dit que la note est enregistree', /Enregistr/i.test(r.repere), `« ${r.repere} »`);
  dire('la note part dans formation_notes', r.ecritures.includes('formation_notes'));
  dire('la case « vu » part dans formation_progression', r.ecritures.includes('formation_progression'));
  await p.screenshot({ path: `${SORTIE}/02-lecon-note.png` });
  await rapatrier(p);
  await ctx.close();
}

/* ══ 7 : il revient le lendemain ═══════════════════════════════════════════ */
titre('il revient le lendemain, dans un navigateur neuf');
{
  // ⚠️ On recule la date du dernier affichage pour que l intervalle de 20 h soit
  // franchi : c est le seul moyen de jouer « le lendemain » en une seconde.
  if (BASE.parcoursVu) BASE.parcoursVu.vue_le = new Date(Date.now() - 30 * 3600000).toISOString();
  const { ctx, p } = await ouvrirPage();
  await p.evaluate(() => window.Acces.orienter());
  await new Promise((r) => setTimeout(r, 700));
  const r = await p.evaluate(() => ({
    note: (window.__base.notes[0] || {}).texte || '',
    reprise: (document.querySelector('#formation .formation-reprise-ou') || {}).textContent || '',
    compteur: (document.querySelector('#formation .formation-compteur') || {}).textContent || '',
    fenetre: getComputedStyle(document.getElementById('formationFenetre')).display !== 'none',
  }));
  dire('sa note est toujours la', /premiere note/.test(r.note), r.note.slice(0, 30));
  dire('le sommaire compte sa lecon vue', /1 leçon sur 7/.test(r.compteur.replace(/\s+/g, ' ')), r.compteur.replace(/\s+/g, ' ').trim().slice(0, 40));
  dire('⚠️ la fenetre revient, car il a progresse ET 20 h ont passe', r.fenetre);
  console.log(`         reprise : « ${r.reprise.replace(/\s+/g, ' ').trim()} »`);
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
  ? '\n  Le parcours tient de bout en bout, dix etapes, sans accroc.'
  : `\n  ⛔ ${fautes} accroc(s) sur le parcours.`);
process.exit(fautes === 0 ? 0 : 1);
