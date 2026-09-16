/**
 * La collecte de marché, en ligne de commande.
 *
 *   node outils/marche.mjs collecte [AAAA-MM-JJ] [dossier-instantanes]
 *                                                  → ce qui serait injecté dans le prompt
 *   node outils/marche.mjs json     [AAAA-MM-JJ]   → l'objet structuré
 *   node outils/marche.mjs determinisme [n]        → n collectes de suite, mêmes valeurs ?
 *   node outils/marche.mjs echec-force             → un contrôle mis en échec exprès
 *   node outils/marche.mjs divergence-forcee       → deux chemins écartés : n/d + écart
 *   node outils/marche.mjs instantanes-test        → les instantanés, lus et rejetés
 *   node outils/marche.mjs instantane              → l'instantané de clôture (17h05 NY)
 *   node outils/marche.mjs comparaison             → trois séances passées contre relevé manuel
 *
 * `determinisme` est le contrôle qui distingue un processus déterministe d'un
 * processus qui a l'air de marcher. Dix lectures de la même journée doivent rendre
 * dix fois la même valeur ; si elles n'y arrivent pas, la source n'est pas une source,
 * c'est une impression.
 */
import { collecterMarche, versPrompt } from '../api/_lib/marche/collecte.js';
import { spxCboe, vixCboe, esTradingView, esCnbc, codeCnbc, contratFrontMonth, seanceCboe, semaineCboe } from '../api/_lib/marche/sources.js';
import { concilier, TOLERANCE_ES } from '../api/_lib/marche/croisement.js';
import { viderCacheMarche } from '../api/_lib/marche/sources.js';
import { controlerOhlc, controlerDate, controlerBasis, controlerContrat, dernierJourOuvre } from '../api/_lib/marche/validation.js';

const [commande = 'collecte', arg, arg2] = process.argv.slice(2);

/**
 * Les instantanés du prélèvement de 17h05, s'ils ont été déposés.
 *
 * Le dossier est passé en argument par le workflow, qui l'extrait de la branche
 * `donnees-marche`. Absent, la collecte se poursuit : les hauts et bas d'ES sortent en
 * n/d avec leur motif, et rien d'autre du tableau n'en dépend.
 */
async function historiqueDe(dateBrief, dossier) {
  if (!dossier) return null;
  const { historiqueInstantanes } = await import('../api/_lib/marche/instantanes.js');
  const { dernierJourOuvre: djo } = await import('../api/_lib/marche/validation.js');
  const { contratFrontMonth: cfm } = await import('../api/_lib/marche/sources.js');
  return historiqueInstantanes(dossier, djo(dateBrief), cfm(dateBrief).contrat);
}
const aujourdhui = () => new Date().toISOString().slice(0, 10);

if (commande === 'collecte') {
  const d = arg || aujourdhui();
  console.log(versPrompt(await collecterMarche(d, { historique: await historiqueDe(d, arg2) })));
}

else if (commande === 'json') {
  const d = arg || aujourdhui();
  console.log(JSON.stringify(await collecterMarche(d, { historique: await historiqueDe(d, arg2) }), null, 2));
}

else if (commande === 'determinisme') {
  const n = Number(arg) || 10;
  const date = aujourdhui();
  const cles = ['es.cloture', 'spx.cloture', 'spx.haut', 'spx.bas', 'vix.cloture'];
  const lu = (r, c) => { const [a, b] = c.split('.'); const v = r[a][b]; return v?.nd ? `n/d` : v?.valeur; };
  const series = new Map(cles.map((c) => [c, []]));
  for (let i = 0; i < n; i++) {
    // Le cache est VIDÉ à chaque tour, et les tours sont espacés de trois secondes.
    // Sans le vidage, on mesurerait dix fois la même réponse en mémoire, ce qui ne
    // prouve rien. Sans l'espacement, on s'inflige le blocage de débit de Cboe et on
    // mesure sa politique de quota au lieu du déterminisme de la collecte : le premier
    // essai de ce test rendait « n/d » une fois sur deux pour cette seule raison.
    viderCacheMarche();
    if (i) await new Promise((r) => setTimeout(r, 3000));
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

else if (commande === 'instantanes-test') {
  // Les instantanés sont-ils RÉELLEMENT lus, et les mauvais rejetés ? Le mécanisme
  // avait été écrit, testé isolément, déployé — et laissé débranché : le workflow
  // récupérait la branche de données sans jamais passer le dossier à la collecte.
  // Ce test-ci va de bout en bout, du fichier au tableau, parce que c'est la seule
  // manière de voir un débranchement.
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { historiqueInstantanes } = await import('../api/_lib/marche/instantanes.js');
  const d = fs.mkdtempSync(os.tmpdir() + '/instantanes-');
  const ecrire = (o) => fs.writeFileSync(`${d}/${o.nom || o.date}.json`, JSON.stringify(o));
  const CAS = [
    ['nominal, deux séances', [
      { date: '2026-09-14', contrat: 'ESZ2026', esHaut: 7719.5, esBas: 7661.25 },
      { date: '2026-09-15', contrat: 'ESZ2026', esHaut: 7689.25, esBas: 7638.5 }]],
    ['date interne ≠ nom de fichier', [
      { date: '2026-09-14', contrat: 'ESZ2026', esHaut: 7719.5, esBas: 7661.25 },
      { nom: '2026-09-15', date: '2026-09-11', contrat: 'ESZ2026', esHaut: 9999, esBas: 1 }]],
    ['contrat d\'une autre échéance', [
      { date: '2026-09-14', contrat: 'ESZ2026', esHaut: 7719.5, esBas: 7661.25 },
      { date: '2026-09-15', contrat: 'ESU2026', esHaut: 7689.25, esBas: 7638.5 }]],
    ['haut inférieur au bas', [
      { date: '2026-09-15', contrat: 'ESZ2026', esHaut: 100, esBas: 200 }]],
    ['prélèvement forcé (hors fenêtre)', [
      { date: '2026-09-15', contrat: 'ESZ2026', esHaut: 7689.25, esBas: 7658.75, force: true }]],
    ['aucun instantané', []],
  ];
  for (const [nom, fichiers] of CAS) {
    for (const f of fs.readdirSync(d)) fs.unlinkSync(`${d}/${f}`);
    fichiers.forEach(ecrire);
    const h = historiqueInstantanes(d, '2026-09-15', 'ESZ2026');
    const r = h.esHautSeance != null
      ? `séance ${h.esBasSeance}–${h.esHautSeance} · semaine ${h.esBasSemaine}–${h.esHautSemaine} (${h.seancesSemaine} séances)`
      : `n/d — ${h.motif}`;
    console.log(`  ${nom.padEnd(32)} → ${r}`);
    if (nom.startsWith('nominal') && h.esHautSeance == null) process.exit(1);
    if (!nom.startsWith('nominal') && h.esHautSeance != null) { console.error('   ATTENDU : rejet'); process.exit(1); }
    // Une semaine ne doit JAMAIS sortir sans la séance de référence.
    if (h.esHautSeance == null && h.esHautSemaine != null) { console.error('   semaine rendue sans sa séance de référence'); process.exit(1); }
  }
  fs.rmSync(d, { recursive: true, force: true });
  console.log('\n  Les instantanés sont lus, et les mauvais rejetés sans emporter le reste.\n');
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
    // ⚠️ UN PRÉLÈVEMENT FORCÉ SE DÉNONCE. Hors de l'interruption du Globex, le haut et
    // le bas décrivent une séance EN COURS : ce sont des valeurs de test, pas des
    // valeurs de séance. Sans cette marque, un essai déposé en pleine journée serait
    // relu tel quel le lendemain matin et publié comme la fourchette d'une séance
    // réglée. C'est arrivé au premier essai, et le nettoyage à la main aurait laissé
    // le piège intact pour la fois suivante.
    force: process.env.PRELEVEMENT_FORCE === 'oui' || undefined,
  };
  const m = [...controlerOhlc('ES', { haut: sortie.esHaut, bas: sortie.esBas, cloture: sortie.esCloture }),
             ...controlerOhlc('SPX', { haut: sortie.spxHaut, bas: sortie.spxBas, cloture: sortie.spxCloture }),
             ...controlerContrat(es, front)];
  if (m.length) { console.error('Instantané REFUSÉ :\n  ' + m.join('\n  ')); process.exit(1); }
  console.log(JSON.stringify(sortie, null, 2));
}

else if (commande === 'comparaison') {
  // Trois séances passées, hauts et bas de SÉANCE et de SEMAINE, comparés à ce que le
  // brief avait publié à l'époque — valeurs que le modèle avait alors croisées à la
  // main sur Investing, Yahoo et la presse. C'est le relevé manuel demandé.
  const CAS = [
    { seance: '2026-09-09', hautPub: 7660.68, basPub: 7624.16, hautSemPub: 7717.81, basSemPub: 7624.16, vixPub: 16.46 },
    { seance: '2026-09-10', hautPub: 7612.86, basPub: 7580.06, hautSemPub: 7717.81, basSemPub: 7580.06, vixPub: 17.84 },
    { seance: '2026-09-11', hautPub: 7677.02, basPub: 7636.75, hautSemPub: 7717.81, basSemPub: 7580.06, vixPub: 15.84 },
  ];
  let bon = true;
  const cmp = (nom, obtenu, publie) => {
    const e = obtenu - publie;
    if (Math.abs(e) > 0.005) bon = false;
    return `${nom} ${String(obtenu).padStart(9)} contre ${String(publie).padStart(9)} publié  écart ${e.toFixed(2).padStart(6)}`;
  };
  for (const c of CAS) {
    const s = await seanceCboe('_SPX', c.seance);
    const w = await semaineCboe('_SPX', c.seance);
    const v = await seanceCboe('_VIX', c.seance);
    console.log(`\n  ── séance ${c.seance} ──`);
    console.log('    ' + cmp('haut séance ', s.haut, c.hautPub));
    console.log('    ' + cmp('bas séance  ', s.bas, c.basPub));
    console.log('    ' + cmp('haut semaine', w.haut, c.hautSemPub) + `  (${w.seances} séances depuis le ${w.debutIso})`);
    console.log('    ' + cmp('bas semaine ', w.bas, c.basSemPub));
    console.log('    ' + cmp('VIX clôture ', v.cloture, c.vixPub));
  }
  console.log(`\n  ${bon ? 'Les trois séances concordent avec le relevé, séance ET semaine.' : 'ÉCART DÉTECTÉ.'}\n`);
  if (!bon) process.exit(1);
}

else if (commande === 'divergence-forcee') {
  // On ne fabrique pas le résultat : on donne aux chemins de vraies valeurs écartées
  // et on regarde ce que la conciliation en fait. Les nombres sont ceux du 16/09 —
  // 7 656 contre la ligne historique d'Investing à 7 665,50, l'écart même qui avait
  // fait écarter une valeur juste ce matin-là.
  const cas = [
    ['deux chemins à 9,50 pt', [{ nom: 'règlement CNBC daté', valeur: 7656 }, { nom: 'chemin tiers', valeur: 7665.5 }]],
    ['deux chemins à un demi-tick', [{ nom: 'règlement CNBC daté', valeur: 7656 }, { nom: 'chemin tiers', valeur: 7656.125 }]],
    ['deux chemins à un tick pile', [{ nom: 'règlement CNBC daté', valeur: 7656 }, { nom: 'chemin tiers', valeur: 7656.25 }]],
    ['deux chemins à deux ticks', [{ nom: 'règlement CNBC daté', valeur: 7656 }, { nom: 'chemin tiers', valeur: 7656.5 }]],
    ['un seul chemin disponible', [{ nom: 'règlement CNBC daté', valeur: 7656 }, { nom: 'chemin tiers', valeur: null, motif: 'HTTP 429' }]],
  ];
  for (const [nom, chemins] of cas) {
    const a = concilier('ES clôture', chemins, TOLERANCE_ES);
    console.log(`  ${nom.padEnd(30)} → ${a.valeur === null ? 'n/d — ' + a.motif : 'publié ' + a.valeur}`);
  }
  console.log('\n  Et le contrôle de contrat, sur le cas du 14/09 :');
  console.log('    →', JSON.stringify(controlerContrat({ contrat: 'ESU2026', expiration: 20260918 }, contratFrontMonth('2026-09-14'))));
}

else if (commande === 'instantanes-test') {
  // Les instantanés sont-ils RÉELLEMENT lus, et les mauvais rejetés ? Le mécanisme
  // avait été écrit, testé isolément, déployé — et laissé débranché : le workflow
  // récupérait la branche de données sans jamais passer le dossier à la collecte.
  // Ce test-ci va de bout en bout, du fichier au tableau, parce que c'est la seule
  // manière de voir un débranchement.
  const fs = await import('node:fs');
  const os = await import('node:os');
  const { historiqueInstantanes } = await import('../api/_lib/marche/instantanes.js');
  const d = fs.mkdtempSync(os.tmpdir() + '/instantanes-');
  const ecrire = (o) => fs.writeFileSync(`${d}/${o.nom || o.date}.json`, JSON.stringify(o));
  const CAS = [
    ['nominal, deux séances', [
      { date: '2026-09-14', contrat: 'ESZ2026', esHaut: 7719.5, esBas: 7661.25 },
      { date: '2026-09-15', contrat: 'ESZ2026', esHaut: 7689.25, esBas: 7638.5 }]],
    ['date interne ≠ nom de fichier', [
      { date: '2026-09-14', contrat: 'ESZ2026', esHaut: 7719.5, esBas: 7661.25 },
      { nom: '2026-09-15', date: '2026-09-11', contrat: 'ESZ2026', esHaut: 9999, esBas: 1 }]],
    ['contrat d\'une autre échéance', [
      { date: '2026-09-14', contrat: 'ESZ2026', esHaut: 7719.5, esBas: 7661.25 },
      { date: '2026-09-15', contrat: 'ESU2026', esHaut: 7689.25, esBas: 7638.5 }]],
    ['haut inférieur au bas', [
      { date: '2026-09-15', contrat: 'ESZ2026', esHaut: 100, esBas: 200 }]],
    ['prélèvement forcé (hors fenêtre)', [
      { date: '2026-09-15', contrat: 'ESZ2026', esHaut: 7689.25, esBas: 7658.75, force: true }]],
    ['aucun instantané', []],
  ];
  for (const [nom, fichiers] of CAS) {
    for (const f of fs.readdirSync(d)) fs.unlinkSync(`${d}/${f}`);
    fichiers.forEach(ecrire);
    const h = historiqueInstantanes(d, '2026-09-15', 'ESZ2026');
    const r = h.esHautSeance != null
      ? `séance ${h.esBasSeance}–${h.esHautSeance} · semaine ${h.esBasSemaine}–${h.esHautSemaine} (${h.seancesSemaine} séances)`
      : `n/d — ${h.motif}`;
    console.log(`  ${nom.padEnd(32)} → ${r}`);
    if (nom.startsWith('nominal') && h.esHautSeance == null) process.exit(1);
    if (!nom.startsWith('nominal') && h.esHautSeance != null) { console.error('   ATTENDU : rejet'); process.exit(1); }
    // Une semaine ne doit JAMAIS sortir sans la séance de référence.
    if (h.esHautSeance == null && h.esHautSemaine != null) { console.error('   semaine rendue sans sa séance de référence'); process.exit(1); }
  }
  fs.rmSync(d, { recursive: true, force: true });
  console.log('\n  Les instantanés sont lus, et les mauvais rejetés sans emporter le reste.\n');
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
    // ⚠️ UN PRÉLÈVEMENT FORCÉ SE DÉNONCE. Hors de l'interruption du Globex, le haut et
    // le bas décrivent une séance EN COURS : ce sont des valeurs de test, pas des
    // valeurs de séance. Sans cette marque, un essai déposé en pleine journée serait
    // relu tel quel le lendemain matin et publié comme la fourchette d'une séance
    // réglée. C'est arrivé au premier essai, et le nettoyage à la main aurait laissé
    // le piège intact pour la fois suivante.
    force: process.env.PRELEVEMENT_FORCE === 'oui' || undefined,
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
