/**
 * BANC : xpDetail (fiche membre) rend exactement xpTotal (tableur, espace élève), module par
 * module sommé, sur des parcours tirés au hasard ; et chaque module ne dépasse pas son max.
 * Usage (racine du dépôt) : node outils/formation-xp-detail-banc.mjs
 */
import { modulesFormation, xpTotal, xpDetail, xpMaximum } from '../api/_lib/formation-xp.js';
const dire = (ok, msg, v) => { console.log(`  ${ok ? 'ok ' : '⛔ '} ${msg}${v !== undefined ? '  ' + JSON.stringify(v) : ''}`); if (!ok) process.exitCode = 1; };
const mods = modulesFormation();
const ids = mods.flatMap((m) => m.lecons.filter((l) => !l.quiz).map((l) => l.id));
const cles = mods.map((m) => String(m.cle));
let graine = 7; const alea = () => ((graine = (graine * 16807) % 2147483647) / 2147483647);
let ecarts = 0; let depasse = 0;
for (let k = 0; k < 400; k++) {
  const p = alea();
  const vues = new Set(ids.filter(() => alea() < p));
  const quiz = new Set(cles.filter(() => alea() < p));
  const d = xpDetail(vues, quiz);
  if (d.total !== xpTotal(vues, quiz) || d.modules.reduce((a, m) => a + m.xp, 0) !== d.total) ecarts++;
  if (d.modules.some((m) => m.xp > m.max)) depasse++;
}
dire(ecarts === 0, '400 parcours : somme des modules = xpTotal', ecarts);
dire(depasse === 0, 'aucun module au-dessus de son maximum', depasse);
const tout = xpDetail(new Set(ids), new Set(cles));
dire(tout.total === xpMaximum(), `tout vu, tout réussi : ${tout.total} = maximum ${xpMaximum()}`);
dire(xpDetail(new Set(), new Set()).total === 0, 'rien vu : 0');
dire(tout.modules.filter((m) => !m.compte).every((m) => m.xp === 0), 'introduction et bonus : 0 XP');
dire(1 !== 2 && JSON.stringify([1]) !== JSON.stringify([2]), 'témoin');
console.log(process.exitCode ? '\n⛔ défauts' : '\nbanc vert');
