/**
 * La collecte de marché, en ligne de commande.
 *
 *   node outils/marche.mjs collecte [AAAA-MM-JJ]   → ce qui serait injecté dans le prompt
 *   node outils/marche.mjs json     [AAAA-MM-JJ]   → l'objet structuré
 *   node outils/marche.mjs determinisme [n]        → n collectes de suite, mêmes valeurs ?
 *   node outils/marche.mjs echec-force             → un contrôle mis en échec exprès
 *   node outils/marche.mjs instantane              → l'instantané de clôture (17h05 NY)
 *   node outils/marche.mjs comparaison             → trois séances passées contre relevé manuel
 *
 * `determinisme` est le contrôle qui distingue un processus déterministe d'un
 * processus qui a l'air de marcher. Dix lectures de la même journée doivent rendre
 * dix fois la même valeur ; si elles n'y arrivent pas, la source n'est pas une source,
 * c'est une impression.
 */
import { collecterMarche, versPrompt } from '../api/_lib/marche/collecte.js';
import { spxCboe, vixCboe, esTradingView, contratFrontMonth } from '../api/_lib/marche/sources.js';
import { controlerOhlc, controlerDate, controlerBasis, controlerContrat, dernierJourOuvre } from '../api/_lib/marche/validation.js';

const [commande = 'collecte', arg] = process.argv.slice(2);
const aujourdhui = () => new Date().toISOString().slice(0, 10);

if (commande === 'collecte') {
  console.log(versPrompt(await collecterMarche(arg || aujourdhui())));
}

else if (commande === 'json') {
  console.log(JSON.stringify(await collecterMarche(arg || aujourdhui()), null, 2));
}

else if (commande === 'determinisme') {
  const n = Number(arg) || 10;
  const date = aujourdhui();
  const cles = ['es.cloture', 'spx.cloture', 'spx.haut', 'spx.bas', 'vix.cloture'];
  const lu = (r, c) => { const [a, b] = c.split('.'); const v = r[a][b]; return v?.nd ? `n/d` : v?.valeur; };
  const series = new Map(cles.map((c) => [c, []]));
  for (let i = 0; i < n; i++) {
    const r = await collecterMarche(date);
    for (const c of cles) series.get(c).push(lu(r, c));
    process.stdout.write(`  ${i + 1}/${n} ${cles.map((c) => `${c}=${series.get(c).at(-1)}`).join(' ')}\n`);
  }
  console.log(`\n  Sur ${n} collectes consécutives de la journée ${date} :`);
  let stable = true;
  for (const [c, vals] of series) {
    const uniques = [...new Set(vals.map(String))];
    if (uniques.length > 1) stable = false;
    console.log(`    ${c.padEnd(14)} ${uniques.length === 1 ? `✅ ${uniques[0]}` : `❌ ${uniques.length} valeurs : ${uniques.join(' / ')}`}`);
  }
  console.log(`\n  ${stable ? 'Déterministe.' : 'NON DÉTERMINISTE — une source varie d\'un appel à l\'autre.'}\n`);
  if (!stable) process.exit(1);
}

else if (commande === 'echec-force') {
  // On ne simule pas le résultat du contrôle : on lui donne une vraie valeur fautive
  // et on regarde ce qu'il en fait. Un test qui vérifie que « n/d » s'affiche quand on
  // a écrit « n/d » ne vérifie rien.
  console.log('  1. OHLC incohérent (clôture hors de la fourchette)');
  console.log('     →', JSON.stringify(controlerOhlc('ES', { haut: 7600, bas: 7500, cloture: 7700 })));
  console.log('  2. Haut inférieur au bas');
  console.log('     →', JSON.stringify(controlerOhlc('SPX', { haut: 7500, bas: 7600, cloture: 7550 })));
  console.log('  3. Date non antérieure au brief');
  console.log('     →', JSON.stringify(controlerDate('SPX', '2026-09-16', '2026-09-16')));
  console.log('  4. Date qui n\'est pas le dernier jour ouvré');
  console.log('     →', JSON.stringify(controlerDate('SPX', '2026-09-09', '2026-09-16')));
  console.log('  5. Écart ES/SPX aberrant (mauvais instrument)');
  console.log('     →', JSON.stringify(controlerBasis(9500, 7600)));
  console.log('  6. Mauvais contrat — l\'incident du 14/09 rejoué');
  console.log('     →', JSON.stringify(controlerContrat(
    { contrat: 'ESU2026', expiration: 20260918 }, contratFrontMonth('2026-09-14'))));
  // Le 7 n'est pas un contrôle mis en échec : c'est la collecte RÉELLE, pour montrer
  // que les motifs des champs indisponibles remontent bien jusqu'au niveau supérieur,
  // là où l'alerte Discord ira les chercher. Un motif qui resterait enfoui dans le
  // champ sans remonter serait un échec silencieux de plus.
  console.log('  7. Remontée des motifs sur une collecte réelle');
  const r = await collecterMarche(aujourdhui());
  console.log('     → motifs remontés :', r.motifs.length);
  for (const m of r.motifs) console.log('       ·', m);
}

else if (commande === 'instantane') {
  // L'instantané de clôture. À lancer pendant l'interruption technique du Globex,
  // 17h00-18h00 à New York : la bougie journalière d'ES y est figée, et c'est la SEULE
  // fenêtre où son haut et son bas décrivent la séance qui vient de se régler.
  const date = arg || aujourdhui();
  const front = contratFrontMonth(date);
  const es = await esTradingView(front.contrat);
  const spx = await spxCboe();
  const sortie = {
    date, contrat: es.contrat, libelle: es.libelle, modeMaj: es.modeMaj,
    esCloture: es.prixCourant, esHaut: es.hautCourant, esBas: es.basCourant,
    spxCloture: spx.cloture, spxHaut: spx.haut, spxBas: spx.bas,
    preleveA: new Date().toISOString(),
  };
  const m = [...controlerOhlc('ES', { haut: sortie.esHaut, bas: sortie.esBas, cloture: sortie.esCloture }),
             ...controlerOhlc('SPX', { haut: sortie.spxHaut, bas: sortie.spxBas, cloture: sortie.spxCloture }),
             ...controlerContrat(es, front)];
  if (m.length) { console.error('Instantané REFUSÉ :\n  ' + m.join('\n  ')); process.exit(1); }
  console.log(JSON.stringify(sortie, null, 2));
}

else if (commande === 'comparaison') {
  // Trois séances passées, la valeur que la collecte rend AUJOURD'HUI pour ces
  // dates-là, et ce que le brief avait publié à l'époque. Le relevé de référence est
  // repris du fichier historique Cboe, qui est l'autorité sur ses propres indices.
  const CAS = [
    { seance: '2026-09-09', vixPublie: 16.46, spxPublie: 7636.36, vixReference: 16.46, spxReference: 7636.36 },
    { seance: '2026-09-10', vixPublie: 17.84, spxPublie: 7591.79, vixReference: 17.84, spxReference: 7591.70 },
    { seance: '2026-09-11', vixPublie: 15.84, spxPublie: 7656.98, vixReference: 15.84, spxReference: 7656.98 },
  ];
  console.log('\n  séance      | VIX collecté | VIX relevé | écart | VIX publié alors | écart du brief');
  let bon = true;
  for (const c of CAS) {
    let collecte = null, err = null;
    try { collecte = (await vixCboe(c.seance)).cloture; } catch (e) { err = e.message; }
    const ecart = collecte === null ? null : collecte - c.vixReference;
    if (ecart === null || Math.abs(ecart) > 0.005) bon = false;
    console.log(`  ${c.seance}  | ${String(collecte ?? 'ERR ' + err).padStart(12)} | ${String(c.vixReference).padStart(10)} |`
      + ` ${(ecart === null ? 'n/a' : ecart.toFixed(2)).padStart(5)} | ${String(c.vixPublie).padStart(16)} |`
      + ` ${(c.vixPublie - c.vixReference).toFixed(2).padStart(6)}`);
  }
  console.log('\n  Rappel SPX — la collecte lit le cadran du JOUR, elle ne remonte pas dans le temps.');
  console.log('  Comparaison des clôtures publiées à l\'époque au relevé Cboe :');
  for (const c of CAS) {
    console.log(`  ${c.seance}  publié ${c.spxPublie}  relevé ${c.spxReference}  écart ${(c.spxPublie - c.spxReference).toFixed(2)}`);
  }
  console.log(`\n  ${bon ? 'Les trois séances concordent avec le relevé.' : 'ÉCART DÉTECTÉ.'}\n`);
  if (!bon) process.exit(1);
}

else {
  console.error(`commande inconnue : ${commande}`);
  process.exit(2);
}
