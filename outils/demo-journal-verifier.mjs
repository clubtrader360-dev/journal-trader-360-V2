/**
 * Sonde de la démo du journal : quels « Points à surveiller » chaque profil affiche-t-il ?
 *
 *   node outils/demo-journal-verifier.mjs
 *
 * ⚠️ Elle fait tourner la VRAIE fonction `updateWarnings` d'`index.html`, extraite
 * telle quelle, sur les trades fictifs de `assets/demo-supabase.js`. Une copie de la
 * logique d'alerte aurait dit ce que la copie pense, pas ce que le journal affiche.
 *
 * Le journal n'affiche que cinq alertes, triées par gravité : si une alerte parasite
 * s'invite (taux de réussite d'un instrument, d'une protection…), elle en chasse une
 * de celles qu'on veut tourner. La sonde le montre, et ÉCHOUE si une alerte attendue
 * manque.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const html = fs.readFileSync(path.join(racine, 'index.html'), 'utf8');
const src = fs.readFileSync(path.join(racine, 'assets/demo-supabase.js'), 'utf8');

const debut = html.indexOf('window.updateWarnings = function()');
if (debut < 0) { console.error('⛔ updateWarnings introuvable dans index.html'); process.exit(1); }
let i = html.indexOf('{', debut), prof = 0, fin = -1;
for (; i < html.length; i++) { if (html[i] === '{') prof++; else if (html[i] === '}') { prof--; if (prof === 0) { fin = i + 1; break; } } }
const corps = html.slice(debut, fin);

// Ce que chaque profil DOIT montrer, écrit avant de lire le résultat.
const ATTENDU = {
  alex: [],
  sam: ['sans protection', 'hors méthode', 'revenge', 'Streak', 'journée(s) avec >4 trades'],
  lea: ['Clôture veille', 'RR1/RR2 atteints mais clôturés en BE'],
};

let fautes = 0;
for (const profil of Object.keys(ATTENDU)) {
  const ctx = { location: { search: `?profil=${profil}`, href: 'x' }, history: { pushState() {}, replaceState() {} }, console: { log() {} }, fetch: () => {}, Response };
  ctx.window = ctx;
  new Function('window', 'location', 'history', 'console', 'Response', src)(ctx, ctx.location, ctx.history, ctx.console, Response);
  const c = ctx.supabase.createClient();
  const { data } = await c.from('trades').select('*').range(0, 999);
  // Même transformation que refreshAllModules() dans index.html.
  const trades = data.map((t) => ({ id: t.id, accountId: t.account_id, date: t.trade_date,
    entryTime: t.entry_time.slice(11, 16), exitTime: t.exit_time.slice(11, 16), symbol: t.instrument, direction: t.direction,
    type: t.type, entryPrice: t.entry_price, exitPrice: t.exit_price, quantity: t.quantity, pnl: t.manual_pnl, fees: t.fees,
    protections: t.protections || [], trade_trend_type: t.trade_trend_type, is_break_even: t.is_break_even,
    is_methode: t.is_methode, is_hors_methode: t.is_hors_methode }));
  let sortie = '';
  const dom = { warningsBanner: { style: {} }, warningsContainer: { set innerHTML(v) { sortie = v; } } };
  const w = { accounts: c.__tables.accounts };
  new Function('window', 'document', 'getFilteredTrades', 'console', corps)(w, { getElementById: (id) => dom[id] }, () => trades, { log() {} });
  w.updateWarnings();
  const msgs = [...sortie.matchAll(/<span style="font-size: 20px;">(.*?)<\/span>\s*<span[^>]*>(.*?)<\/span>/gs)].map((m) => `${m[1]} ${m[2]}`);
  const wr = (trades.filter((t) => t.pnl > 0).length / trades.length * 100).toFixed(1);
  console.log(`\n── ${profil} : ${trades.length} trades, taux de réussite ${wr} %`);
  msgs.forEach((m) => console.log('   ' + m));
  for (const motif of ATTENDU[profil]) {
    if (!msgs.some((m) => m.includes(motif))) { fautes++; console.log(`   ⛔ alerte attendue absente : « ${motif} »`); }
  }
  if (ATTENDU[profil].length === 0 && msgs.length) { fautes++; console.log('   ⛔ ce profil devait être sans alerte'); }
}
console.log(fautes ? `\n⛔ ${fautes} écart(s).` : '\nTout est conforme.');
process.exit(fautes ? 1 : 0);
