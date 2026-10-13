/**
 * ⛔ CHAQUE MODULE VAUT EXACTEMENT 100 XP.
 *
 * ── ⚠️ POURQUOI CE CONTROLE EXISTE ─────────────────────────────────────────
 *
 * Les divisions ne tombent pas rondes : 100 / 7 = 14,28. ⛔ Arrondir chapitre
 * par chapitre donne 7 x 14 = 98, et le module ne vaut plus 100. L ecart est de
 * deux points sur un module, invisible a l oeil, et il s accumule sur dix.
 *
 * ⚠️ TEMOIN OBLIGATOIRE : un module ampute d un chapitre ne doit PLUS totaliser
 * 100 avec la repartition calculee pour son nombre d origine. Sans lui, « la
 * somme fait 100 » decrirait aussi une fonction qui rend toujours 100.
 *
 * Usage : node outils/formation-xp.mjs
 */
import { readFileSync } from 'node:fs';
const PPTR = '/Users/nadirkasmi/Projets/trader360-site/node_modules/'
  + 'puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const { default: puppeteer } = await import(PPTR);

let fautes = 0;
const dire = (n, ok, d) => { if (!ok) fautes += 1;
  console.log(`     ${ok ? 'ok ' : '⛔ '} ${n}${d ? `  ${d}` : ''}`); };

const nav = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-first-run'] });
const p = await nav.newPage();
await p.setContent('<!doctype html><html><body><div id="formationApp"><div id="formation"></div></div></body></html>');
await p.evaluate(() => {
  window.supabaseClient = { from: () => ({ select: () => ({ eq: () => ({
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (r) => Promise.resolve({ data: [], error: null }).then(r) }) }) }),
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'x' } } }) } };
});
await p.addScriptTag({ content: readFileSync('assets/formation-donnees.js', 'utf8') });
await p.addScriptTag({ content: readFileSync('supabase-formation.js', 'utf8') });

console.log('\n  ══ 1. ⚠️ L ÉTALONNAGE ══');
const expose = await p.evaluate(() => typeof window.Formation?._calcul?.partsXp === 'function');
dire('le calcul est exposé', expose === true);
const essais = await p.evaluate(() => {
  const f = window.Formation._calcul.partsXp;
  return { sept: f(7), trois: f(3), un: f(1), zero: f(0), douze: f(12) };
});
dire('⚠️ TÉMOIN : 7 chapitres donnent 7 parts', essais.sept.length === 7, essais.sept.join('+'));
dire('⚠️ TÉMOIN : 1 chapitre prend les 100', essais.un.join() === '100', essais.un.join());
dire('⚠️ TÉMOIN : 0 chapitre ne donne rien', essais.zero.length === 0);
if (fautes) { console.log('\n  ⛔ ÉTALONNAGE RATÉ.\n'); process.exit(1); }

console.log('\n  ══ 2. ⛔ LA SOMME VAUT 100 SUR LES DIX MODULES ══');
const mods = await p.evaluate(() => window.FormationDonnees.MODULES.map((m) => ({
  numero: m.numero, titre: m.titre, n: m.lecons.length,
  intro: !!m.introduction, cert: !!m.certification,
  parts: window.Formation._calcul.partsXp(m.lecons.length),
})));
for (const m of mods) {
  const somme = m.parts.reduce((a, b) => a + b, 0);
  const attendu = m.n === 0 ? 0 : 100;
  const etiquette = m.intro ? ' (introduction, 0 XP)' : m.cert ? ' (certification)' : '';
  dire(`module ${m.numero} : ${m.n} chapitre(s) → ${somme} XP${etiquette}`,
    somme === attendu, m.n ? m.parts.join(' + ') : 'aucun chapitre');
}

console.log('\n  ══ 3. ⚠️ LE TÉMOIN : un module amputé ne fait plus 100 ══');
{
  const r = await p.evaluate(() => {
    const f = window.Formation._calcul.partsXp;
    const sept = f(7);
    // ⛔ On retire un chapitre SANS recalculer : c est le cas qu on veut voir
    // echouer, celui d une repartition qui ne suivrait pas le nombre reel.
    return { ampute: sept.slice(0, 6).reduce((a, b) => a + b, 0), entier: sept.reduce((a, b) => a + b, 0) };
  });
  dire('⛔ six parts sur sept ne font PAS 100', r.ampute !== 100, `${r.ampute}`);
  dire('⚠️ et les sept, si', r.entier === 100, `${r.entier}`);
}

console.log('\n  ══ 4. ⛔ LE MODULE 9 EST UN BONUS ══');
{
  const m9 = mods.find((m) => m.numero === '09');
  dire('il rapporte 100 XP comme les autres', m9 && m9.parts.reduce((a, b) => a + b, 0) === 100,
    m9 ? m9.parts.join(' + ') : 'absent');
  console.log('     ⚠️ ARBITRAGE À RENDRE : un bonus qui rapporte autant qu un module');
  console.log('        obligatoire pousse à le faire en premier. ⛔ Trois chapitres à');
  console.log('        33 XP contre douze à 8 dans le module 05 : le bonus est le');
  console.log('        chemin le plus court vers le niveau suivant.');
  console.log('        ⚠️ Je ne tranche pas : Nadir décide s il rapporte 0, moins, ou autant.');
}

console.log('\n  ══ 5. ⛔ L INTRODUCTION NE RAPPORTE RIEN ══');
{
  const r = await p.evaluate(() => {
    const d = window.FormationDonnees.MODULES.find((m) => m.introduction);
    return d ? window.Formation._calcul.xpDe(d.lecons[0].id) : null;
  });
  dire('la vidéo de bienvenue vaut 0 XP', r === 0, `${r}`);
  // ⚠️ TÉMOIN : un chapitre ordinaire, lui, vaut quelque chose.
  const o = await p.evaluate(() => window.Formation._calcul.xpDe('m01-l0'));
  dire('⚠️ TÉMOIN : un chapitre ordinaire vaut plus que zéro', o > 0, `m01-l0 vaut ${o} XP`);
}

await nav.close();
console.log(fautes ? `\n  ⛔ ${fautes} CONTROLE(S) ROUGE(S).\n` : '\n  Tout est vert.\n');
process.exit(fautes ? 1 : 0);
