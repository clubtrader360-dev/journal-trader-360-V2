/**
 * Eprouve le CHOIX de variante du rapport hebdomadaire.
 *
 * ⚠️ LE POINT QUI COMPTE : la variante est choisie sur le DROIT, pas sur
 * l absence de trades. ⛔ Un eleve qui A le journal et n a pas trade doit garder
 * la variante passive, qui lui est justement destinee.
 *
 * Usage : node outils/rapport-variantes.mjs
 */
import { generateForUser } from '../api/cron/weekly-report.js';

let fautes = 0;
const dire = (nom, ok, detail) => {
  if (!ok) fautes += 1;
  console.log(`     ${ok ? 'ok ' : '⛔ '} ${nom}${detail ? `  ${detail}` : ''}`);
};

/** Double de Supabase : rien ne sort d ici. */
function faux({ droits, trades = 0, entrees = 0, progression = [] }) {
  return {
    from(nom) {
      const b = {
        select() { return b; },
        eq() { return b; },
        gte() { return b; },
        lte() { return b; },
        maybeSingle: () => Promise.resolve({ data: droits, error: null }),
        then: (ok, ko) => Promise.resolve({
          data: nom === 'formation_progression' ? progression
            : nom === 'trades' ? Array(trades).fill({ pnl: 1 })
            : nom === 'journal_entries' ? Array(entrees).fill({}) : [],
          error: null,
        }).then(ok, ko),
      };
      return b;
    },
  };
}

const PERIODE = { startDateStr: '2026-10-06', endDateStr: '2026-10-12' };
const USER = { uuid: 'u-1', email: 'eleve@exemple.fr', name: 'Eleve Essai' };

console.log('\n  ══ LE CHOIX DE VARIANTE ══\n');
const CAS = [
  ['formation seule, rien vu',
    { formation_actif: true, journal_actif: false }, 0, [], 'formation'],
  ['formation seule, 3 lecons vues',
    { formation_actif: true, journal_actif: false }, 0,
    [{ lecon_id: 'm01-l0', vue: true }, { lecon_id: 'm01-l1', vue: true }, { lecon_id: 'm01-l2', vue: true }], 'formation'],
  ['⚠️ TEMOIN : a le journal, n a PAS trade',
    { formation_actif: true, journal_actif: true }, 0, [], 'passive'],
  ['aucun droit',
    { formation_actif: false, journal_actif: false }, 0, [], null],
  ['⚠️ droits illisibles : on garde l ancien comportement',
    null, 0, [], 'passive'],
];

for (const [nom, droits, trades, progression, attendu] of CAS) {
  const r = await generateForUser(faux({ droits, trades, progression }), USER, PERIODE);
  const type = r ? r.reportType : null;
  console.log(`     ${nom.padEnd(42)} -> ${type === null ? 'AUCUN ENVOI' : type}`);
  dire(`  variante attendue : ${attendu === null ? 'aucun envoi' : attendu}`, type === attendu, String(type));
  if (type === 'formation') {
    const h = r.html;
    dire('    ⛔ le mot « journal » n apparait pas', !/journal/i.test(h));
    const interdits = /gain|revenu|profit|payout|financ|riche|rentab/i;
    dire('    ⛔ aucune promesse de gain', !interdits.test(h), (h.match(interdits) || [''])[0]);
    if (progression.length) {
      dire('    l avancement est nomme', /3 lecon/.test(h));
      dire('    la prochaine lecon est nommee', /La suite/.test(h) && /Module 01/.test(h));
    } else {
      dire('    il invite a commencer sans reprocher', /pas un reproche/i.test(h));
    }
  }
}

// ⚠️ TEMOIN du detecteur de promesse : il doit savoir en voir une.
dire('⚠️ TEMOIN : le detecteur reconnait une promesse',
  /gain|revenu|profit|payout|financ|riche|rentab/i.test('bientot ton premier payout'));

console.log(fautes === 0 ? '\n  Tout est vert.' : `\n  ⛔ ${fautes} ecart(s).`);
process.exit(fautes === 0 ? 0 : 1);
