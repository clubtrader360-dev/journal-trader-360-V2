/**
 * Éprouve le RAPPORT DES COACHS (api/cron/_lib/rapport-coachs.js).
 *
 * Ce qui compte :
 *   1. le score annoncé au coach est CELUI que l'élève a reçu (lu dans son mail) ;
 *   2. la semaine d'avant = les 7 jours avant le lundi, pas tout l'historique
 *      (témoin : un trade d'il y a trois semaines ne doit pas bouger l'écart) ;
 *   3. l'écart moyen ne porte que sur les élèves présents les deux semaines ;
 *   4. chaque élève apparaît, et rien d'indéfini ne s'affiche.
 *
 * Usage : node outils/rapport-coachs-banc.mjs
 */
import { generateForUser } from '../api/cron/weekly-report.js';
import { genererRapportCoachs, statsGroupe, aSurveiller } from '../api/cron/_lib/rapport-coachs.js';

let fautes = 0;
const dire = (nom, ok, detail) => {
  if (!ok) fautes += 1;
  console.log(`  ${ok ? 'ok ' : '⛔ '} ${nom}${detail !== undefined ? `  (${detail})` : ''}`);
};

/** Double de Supabase qui APPLIQUE les filtres eq / gte / lte / lt, comme PostgREST. */
function base(tables) {
  return {
    from(nom) {
      const filtres = [];
      const b = {
        select() { return b; },
        eq(c, v) { filtres.push((r) => r[c] === v); return b; },
        gte(c, v) { filtres.push((r) => String(r[c]) >= v); return b; },
        lte(c, v) { filtres.push((r) => String(r[c]) <= v); return b; },
        lt(c, v) { filtres.push((r) => String(r[c]) < v); return b; },
        not() { return b; }, in() { return b; },
        maybeSingle: () => Promise.resolve({ data: (tables[nom] || []).filter((r) => filtres.every((f) => f(r)))[0] || null, error: null }),
        then: (ok, ko) => {
          const rows = (tables[nom] || []).filter((r) => filtres.every((f) => f(r)));
          return Promise.resolve({ data: rows, count: rows.length, error: null }).then(ok, ko);
        },
      };
      return b;
    },
  };
}

const PERIODE = { startDateStr: '2026-10-19', endDateStr: '2026-10-25' };
const T = (user_id, trade_date, pnl, account_id = 'a1') => ({ user_id, trade_date, pnl, account_id, entry_time: '15:40', direction: 'LONG' });

function donnees({ ancien = true } = {}) {
  return {
    acces_membre: [
      { user_id: 'u1', formation_actif: true, journal_actif: true },
      { user_id: 'u2', formation_actif: true, journal_actif: true },
      { user_id: 'u3', formation_actif: true, journal_actif: true },
    ],
    accounts: [{ user_id: 'u1', id: 'a1', active: true }, { user_id: 'u2', id: 'a1', active: true }],
    trades: [
      // u1 : cette semaine + la semaine d'avant (+ un trade ancien, hors fenêtre)
      T('u1', '2026-10-20', 300), T('u1', '2026-10-21', -100), T('u1', '2026-10-22', 200), T('u1', '2026-10-23', -50),
      T('u1', '2026-10-13', -200), T('u1', '2026-10-14', 50), T('u1', '2026-10-15', -150),
      ...(ancien ? [T('u1', '2026-09-29', 5000)] : []),
      // u2 : cette semaine seulement
      T('u2', '2026-10-20', -100), T('u2', '2026-10-21', -80), T('u2', '2026-10-22', 40),
    ],
    journal_entries: [{ user_id: 'u1', entry_date: '2026-10-20' }, { user_id: 'u1', entry_date: '2026-10-21' }, { user_id: 'u3', entry_date: '2026-10-22' }],
    formation_progression: [],
  };
}

const U = (uuid, name) => ({ uuid, email: `${uuid}@exemple.fr`, name });
const sb = base(donnees());
const r1 = await generateForUser(sb, U('u1', 'Alice'), PERIODE);
const r2 = await generateForUser(sb, U('u2', 'Bruno'), PERIODE);
const r3 = await generateForUser(sb, U('u3', 'Chloé'), PERIODE);

console.log('\n  ══ LE RÉSUMÉ DE CHAQUE ÉLÈVE ══');
dire('Alice et Bruno ont un résumé (actifs)', !!(r1.resume && r2.resume));
dire('Chloé n en a pas (passive)', r3.reportType === 'passive' && !r3.resume, r3.reportType);

// 1. Le score du coach = le score lu dans le mail de l'élève.
const lu = (html) => { const m = html.match(/([\d.]+)<span[^>]*> \/ 100<\/span>/); return m ? Number(m[1]) : NaN; };
dire('score coach = score du mail d Alice', r1.resume.score === lu(r1.html), `${r1.resume.score} / ${lu(r1.html)}`);
dire('score coach = score du mail de Bruno', r2.resume.score === lu(r2.html), `${r2.resume.score} / ${lu(r2.html)}`);
dire('⚠️ TÉMOIN : la lecture du mail rend un nombre', Number.isFinite(lu(r1.html)));

// 2. La semaine d'avant ne prend pas le trade d'il y a trois semaines.
const sansAncien = await generateForUser(base(donnees({ ancien: false })), U('u1', 'Alice'), PERIODE);
dire('écart identique avec ou sans le trade ancien', r1.resume.ecart === sansAncien.resume.ecart, `${r1.resume.ecart} / ${sansAncien.resume.ecart}`);
dire('Alice a un score précédent', r1.resume.scorePrecedent !== null, r1.resume.scorePrecedent);
dire('Bruno n en a pas (aucun trade la semaine d avant)', r2.resume.scorePrecedent === null && r2.resume.ecart === null);
dire('Alice : 4 trades, P&L 350, journal 2 j', r1.resume.trades === 4 && r1.resume.pnl === 350 && r1.resume.joursJournal === 2,
  `${r1.resume.trades} / ${r1.resume.pnl} / ${r1.resume.joursJournal}`);
dire('un plan d action pour la semaine suivante', r1.resume.actions.length >= 1 && r2.resume.actions.length >= 1);

console.log('\n  ══ LE GROUPE ══');
const g = statsGroupe([r1.resume, r2.resume]);
const attendu = Math.round(((r1.resume.score + r2.resume.score) / 2) * 10) / 10;
dire('score moyen = moyenne des deux', g.scoreMoyen === attendu, `${g.scoreMoyen} / ${attendu}`);
dire('écart moyen sur le seul élève comparable', g.comparables === 1 && g.ecartMoyen === r1.resume.ecart, `${g.ecartMoyen}`);
dire('journal tenu 1/2', g.journalTenu === 1);
dire('groupe vide : moyennes n/d, pas 0', statsGroupe([]).scoreMoyen === null);
dire('Bruno à surveiller (aucun journal)', aSurveiller(r2.resume).includes('aucun journal rempli'));

console.log('\n  ══ LE MAIL ══');
const rc = genererRapportCoachs({ periode: PERIODE, resumes: [r1.resume, r2.resume],
  autres: [{ nom: 'Chloé', email: 'u3@exemple.fr', reportType: 'passive', entriesWeek: 1 }] });
for (const n of ['Alice', 'Bruno', 'Chloé']) dire(`${n} figure dans le mail`, rc.html.includes(n) && rc.texte.includes(n));
dire('rien d indéfini', !/undefined|NaN|null/.test(rc.html + rc.texte), (rc.html.match(/undefined|NaN|null/) || [''])[0]);
dire('⚠️ TÉMOIN : le détecteur voit un « NaN »', /undefined|NaN|null/.test('score NaN'));
dire('aucun tiret cadratin', !/[—–]/.test(rc.html + rc.texte + rc.objet));
dire('⚠️ TÉMOIN : le détecteur voit un cadratin', /[—–]/.test('a — b'));
dire('l objet porte la période', /19 octobre 2026/.test(rc.objet), rc.objet);
const vide = genererRapportCoachs({ periode: PERIODE, resumes: [], autres: [] });
dire('semaine sans aucun actif : le mail se construit', /Aucun élève n’a tradé/.test(vide.html));

console.log(fautes ? `\n  ⛔ ${fautes} faute(s)\n` : '\n  ✅ tout est vert\n');
process.exit(fautes ? 1 : 0);
