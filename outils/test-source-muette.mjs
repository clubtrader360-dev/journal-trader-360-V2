#!/usr/bin/env node
// ========================================================================
// TEST DE LA SOURCE MUETTE, AVANT ET À L'ÉCHÉANCE DE 6H45.
//
// Règle (Manu, 26/11/2026 21h) : le brief n'est plus jamais bloqué. AVANT l'échéance, une
// valeur manquante fait relancer la collecte (aucun envoi, alerte). À l'ÉCHÉANCE, le
// brief part, la valeur introuvable en « n/d », jamais inventée, et l'alerte la nomme
// avec les sources essayées. Une prose refusée ne part jamais : brief « données seules ».
//
// Le cycle testé est `executerCycle` (api/_lib/brief-cycle.js) : la collecte réelle
// (source principale puis secours, dates, calendriers), le garde-fou réel et le rendu réel. Seuls les
// fournisseurs de données, le modèle, l'envoi et Discord sont simulés. Le contrôle final
// de l'endpoint (wrapBriefHtml + controlerRedaction, deux variantes) est rejoué sur
// chaque brief envoyé.
// Règle des sources (Manu, 27/11/2026) : une source principale, une source de secours,
// aucune comparaison entre elles ; n/d seulement si les deux manquent.
//   1. Avant l'échéance, principale ET secours du S&P 500 muettes → aucun envoi, alerte qui
//      nomme le S&P 500 et les deux sources.
//   2. ES : principale muette → le secours publie, le brief part. 2 bis : les deux muettes → aucun envoi.
//   3. Principale du S&P muette → le secours prend le relais et le brief part.
//   14 à 18. Principale et secours différents → la principale, sans désaccord ; principale
//      sans veille → clôture ET veille du secours ; OAT du 27/11 (CNBC 4,7437 / 4,7322)
//      affichée ; alerte de l'heure limite en une ligne ; POC sans source de secours → n/d.
//   4. Le modèle écrit un chiffre du bloc à la main → aucun envoi, l'alerte nomme l'écart.
//   5. Le modèle écrit un deux-points → aucun envoi, l'alerte le cite.
//   8 à 13. À l'échéance : S&P 500 en n/d, ES en n/d (principale et secours muettes),
//      valeur manquante écrite à la main par le modèle, sortie illisible, « n/d » écrit
//      par le modèle → le brief part toujours, sans valeur inventée, alerte nominative.
// ========================================================================
import assert from 'node:assert/strict';
import { executerCycle, collecterTout, texteAlerteNd } from '../api/_lib/brief-cycle.js';
import { collecterInstrument } from '../api/_lib/marche/hier.js';
import { valeurHier, variationHier } from '../api/_lib/brief-v22.js';
import { controlerRedaction } from '../api/_lib/brief-garde.js';
import { ND_HTML } from '../api/_lib/brief-v22.js';
import { wrapBriefHtml, emailSubject } from '../api/cron/daily-brief.js';

const DATE = '2026-11-26';
const MAINTENANT = new Date('2026-11-26T05:00:00+01:00');
const muette = (nom) => ({ nom, async serie() { throw new Error('HTTP 503'); } });
const fixe = (nom, map) => ({ nom, async serie() { return new Map(Object.entries(map)); } });
const deux = (c, p) => ({ '2026-11-25': c, '2026-11-24': p });

// Chaque valeur : [source principale, source de secours]. `spxMuettes` : combien des
// deux sources du S&P 500 sont muettes (1 = la principale, 2 = les deux).
// `spxSecours` / `spxPrincipale` : séries datées imposées à l'une ou l'autre.
function listeHier({ spxMuettes = 0, spxPrincipale = null, spxSecours = null } = {}) {
  const inst = (cle, nom, place, unite, c, p, noms) => ({ cle, nom, place, unite,
    sources: noms.map((n, i) => {
      if (cle === 'spx' && i < spxMuettes) return muette(n);
      if (cle === 'spx' && i === 0 && spxPrincipale) return fixe(n, spxPrincipale);
      if (cle === 'spx' && i === 1 && spxSecours) return fixe(n, spxSecours);
      return fixe(n, deux(c, p));
    }) });
  return [
    inst('spx', 'S&P 500', 'US', 'pct', 7182.78, 7201.09, ['CNBC (.SPX)', 'TradingView (SP:SPX)']),
    inst('nasdaq', 'Nasdaq', 'US', 'pct', 23585.80, 23733.54, ['CNBC (.IXIC)', 'TradingView (IXIC)']),
    inst('dax', 'DAX', 'DE', 'pct', 24702.13, 25017.81, ['CNBC (.GDAXI)', 'TradingView (DAX)']),
    inst('cac', 'CAC 40', 'FR', 'pct', 7980.57, 8040.49, ['CNBC (.FCHI)', 'TradingView (PX1)']),
    inst('oat', 'OAT France 10 ans', 'FR', 'pt', 4.732, 4.778, ['CNBC (FR10Y)', 'TradingView (FR10Y)']),
    inst('btc', 'Bitcoin', 'BTC', 'pct', 60383.51, 59740.87, ['Coinbase', 'Bitstamp']),
    inst('vix', 'VIX', 'US', 'pct', 28.29, 26.36, ['CNBC (.VIX)', 'TradingView (VIX)']),
  ];
}
const ES = { '2026-11-25': { haut: 7224, bas: 6982.5, cloture: 7195.75 } };
const SPX = { '2026-11-25': { haut: 7199.31, bas: 6970.11, cloture: 7182.78 } };
// `esMuettes` : 1 = la principale CNBC muette, 2 = les deux. `pocMuettes` : idem pour le POC.
function sourcesZones({ esMuettes = 0, pocMuettes = 0 } = {}) {
  const noms = ['CNBC (ESZ26)', 'TradingView (ESZ2026)'];
  const poc = async () => ({ valeur: 7203.25, minutes: 390, source: 'CNBC barres 1 min' });
  return {
    front: { contrat: 'ESZ2026' },
    es: noms.map((n, i) => (i < esMuettes ? muette(n) : fixe(n, ES))),
    spx: [fixe('CNBC (.SPX)', SPX), fixe('TradingView (SP:SPX)', SPX)],
    poc: [pocMuettes ? async () => { throw new Error('HTTP 503'); } : poc],
  };
}

const PROSE = {
  intro: 'La séance s\'annonce calme après une journée d\'hier particulièrement nerveuse.',
  psychologie: ['Un biais de marché peut se retourner en quelques minutes. Décide avant l\'ouverture de ce qui déclenche une sortie.'],
  vix_lecture: 'Une remontée nette, cohérente avec le trou d\'air de la séance d\'hier. La nervosité ne retombe pas.',
  niveaux_psy: [7250, 7200, 7150, 7100],
  ferie: { titre: 'Jour férié aux États-Unis (Thanksgiving).', texte: 'Wall Street est fermée, la liquidité sera réduite.' },
  agenda: [],
  actualite: [
    { titre: 'Wall Street hier', texte: 'Le S&P 500 a chuté de plus de 3 % en séance avant d\'être racheté, pour finir à {SPX_CLOTURE} points ({SPX_VAR}), tandis que le Nasdaq cédait {NASDAQ_VAR_ABS} et que le Dow Jones progressait de 0,33 %.' },
    { titre: 'Taux et Fed', texte: 'Les paris sur un geste de la Fed en décembre se sont renforcés. Le dollar est resté stable.' },
    { titre: 'Ce matin et à surveiller', texte: 'L\'Asie a rebondi. La liquidité réduite de la séance de Thanksgiving appelle à la prudence.' },
  ],
  retenir: ['Marché américain fermé aujourd\'hui.', 'VIX en nette hausse.', 'Inflation PCE en hausse.'],
  sources: { agenda: ['https://www.forexfactory.com/calendar?day=nov26.2026', 'https://www.investing.com/economic-calendar/'],
    actualite: ['https://www.zonebourse.com/a', 'https://www.reuters.com/b', 'https://www.boursorama.com/c'] },
  culture: { titre: 'Le range', definition: 'Un range est une phase où le prix oscille entre un support et une résistance.', usage: 'Un trader s\'en sert pour cartographier les bornes du marché.' },
};

async function cycle({ hier = {}, zones = {}, prose = PROSE, echeance = false, sortie = null }) {
  const envois = [];
  const alertes = [];
  const r = await executerCycle({
    dateBrief: DATE, maintenant: MAINTENANT, echeance,
    collecter: (d, o) => collecterTout(d, { ...o, listeHier: listeHier(hier), sourcesZones: sourcesZones(zones) }),
    generer: async () => (sortie ?? JSON.stringify(prose)),
    envoyer: async (corps) => { envois.push(corps); },
    alerter: async (t) => { alertes.push([].concat(t).join('\n')); },
    urlSchema: 'https://journaltrader360.fr/assets/culture/range.png',
  });
  return { r, envois, alertes };
}

const resultats = [];
async function cas(nom, f) {
  try { await f(); resultats.push(`✅ ${nom}`); } catch (e) { resultats.push(`❌ ${nom}\n   ${e.message}`); }
}

await cas('1. S&P 500 : principale et secours muettes → pas d\'envoi, alerte avec la valeur et les sources', async () => {
  const { r, envois, alertes } = await cycle({ hier: { spxMuettes: 2 } });
  assert.equal(envois.length, 0, 'un brief est parti');
  assert.equal(r.envoye, false);
  assert.equal(alertes.length, 1, 'alerte absente ou en double');
  for (const attendu of ['S&P 500', 'CNBC (.SPX)', 'TradingView (SP:SPX)', 'muette (HTTP 503)']) {
    assert.ok(alertes[0].includes(attendu), `l'alerte ne cite pas « ${attendu} »`);
  }
  console.log(`\n--- alerte du cas 1 ---\n${alertes[0]}\n-----------------------`);
});
await cas('2. ES : principale CNBC muette → le secours TradingView publie, le brief part', async () => {
  const { r, envois, alertes } = await cycle({ zones: { esMuettes: 1 } });
  assert.equal(alertes.length, 0, `alerte inattendue : ${alertes[0]}`);
  assert.equal(envois.length, 1, `brief non envoyé (${JSON.stringify(r.motifs || r.manquants)})`);
  assert.ok(envois[0].includes('7&nbsp;195,75') && envois[0].includes('7&nbsp;134,08'), 'ES du secours absent');
});
await cas('2 bis. ES : principale et secours muettes → pas d\'envoi, alerte', async () => {
  const { envois, alertes } = await cycle({ zones: { esMuettes: 2 } });
  assert.equal(envois.length, 0, 'un brief est parti sans ES');
  assert.equal(alertes.length, 1);
  assert.ok(alertes[0].includes('ES ESZ2026'), 'l\'alerte ne nomme pas ES');
  assert.ok(alertes[0].includes('CNBC (ESZ26)') && alertes[0].includes('TradingView (ESZ2026)'), 'sources ES non citées');
});
await cas('3. S&P 500 : principale muette → le secours prend le relais, le brief part', async () => {
  const { r, envois, alertes } = await cycle({ hier: { spxMuettes: 1 } });
  assert.equal(alertes.length, 0, `alerte inattendue : ${alertes[0]}`);
  assert.equal(envois.length, 1, `brief non envoyé (${JSON.stringify(r.motifs || r.manquants || r.etape)})`);
  assert.ok(envois[0].includes('7&nbsp;182,78 points (-0,25&nbsp;%)'), 'jetons non remplacés par les valeurs du bloc');
  assert.ok(!/n\/d/.test(envois[0]));
});
await cas('4. Actualité : chiffre écrit à la main → pas d\'envoi, l\'alerte nomme l\'écart', async () => {
  const prose = structuredClone(PROSE);
  prose.actualite[0].texte = 'Le S&P 500 a fini à 7 190,00 points, tandis que le Nasdaq cédait {NASDAQ_VAR_ABS}.';
  const { envois, alertes } = await cycle({ prose });
  assert.equal(envois.length, 0);
  assert.ok(alertes[0] && alertes[0].includes('7 190,00 points'), `écart non nommé : ${alertes[0]}`);
});
await cas('6. Prose écrite sans recherche (aucune source) → pas d\'envoi', async () => {
  const prose = structuredClone(PROSE);
  delete prose.sources;
  const { envois, alertes } = await cycle({ prose });
  assert.equal(envois.length, 0);
  assert.ok(alertes[0] && alertes[0].includes('sans recherche'), `absence de sources non signalée : ${alertes[0]}`);
});
await cas('7. Jour férié connu du code mais absent de la prose → pas d\'envoi', async () => {
  const prose = structuredClone(PROSE);
  prose.ferie = null;
  const { envois, alertes } = await cycle({ prose });
  assert.equal(envois.length, 0);
  assert.ok(alertes[0] && alertes[0].includes('jour férié non signalé'), `férié non signalé : ${alertes[0]}`);
});
await cas('5. Rédaction : deux-points → pas d\'envoi, l\'alerte cite la phrase', async () => {
  const prose = structuredClone(PROSE);
  prose.retenir[0] = 'À retenir : marché fermé.';
  const { envois, alertes } = await cycle({ prose });
  assert.equal(envois.length, 0);
  assert.ok(alertes[0] && alertes[0].includes('deux-points'), `deux-points non signalé : ${alertes[0]}`);
});

// ── À L'ÉCHÉANCE DE 6H45 : LE BRIEF PART TOUJOURS ─────────────────────────────────
const LONG = 'jeudi 26 novembre 2026';
/** Le contrôle final de l'endpoint, rejoué tel quel (deux variantes, sujet compris). */
function controleEndpoint(corps) {
  return [...new Set(['members', 'prospects'].flatMap((variant) => controlerRedaction(
    wrapBriefHtml({ firstName: 'Trader', dateLongFr: LONG, briefHtml: corps, variant }), { sujet: emailSubject(LONG) })))];
}
function sansValeurCassee(corps) {
  assert.ok(!/NaN|undefined|null|\{[A-Z_]+\}/.test(corps.split(ND_HTML).join('')), 'NaN, undefined, null ou jeton dans le brief envoyé');
  assert.deepEqual(controleEndpoint(corps), [], 'le contrôle final de l\'endpoint refuse le brief');
}
// Prose d'un matin où le S&P 500 manque : le modèle n'en parle pas (consigne du prompt).
const PROSE_SANS_SPX = structuredClone(PROSE);
PROSE_SANS_SPX.actualite[0].texte = 'Le Nasdaq a cédé {NASDAQ_VAR_ABS} hier, dans une séance très agitée.';

await cas('8. Échéance, S&P 500 introuvable → le brief part, S&P 500 en n/d, le reste intact, alerte nominative', async () => {
  const { r, envois, alertes } = await cycle({ hier: { spxMuettes: 2 }, prose: PROSE_SANS_SPX, echeance: true });
  assert.equal(envois.length, 1, `brief non envoyé à l'échéance (${JSON.stringify(r.motifs)})`);
  assert.equal(r.secours, false, 'la prose valide aurait dû partir');
  const c = envois[0];
  assert.ok(new RegExp(`S&amp;P 500</td><td[^>]*>${ND_HTML}</td><td[^>]*><span[^>]*>${ND_HTML}</span>`).test(c), 'la ligne S&P 500 n\'est pas en n/d (valeur et variation)');
  assert.equal(c.split(ND_HTML).length - 1, 2, 'n/d ailleurs que sur la ligne S&P 500');
  for (const v of ['23&nbsp;585,80', '24&nbsp;702,13', '7&nbsp;980,57', '4,73 %', '60&nbsp;384 $', '28,29', '7&nbsp;195,75', '7&nbsp;182,78', '7&nbsp;203,25']) {
    assert.ok(c.includes(v), `valeur intacte absente : ${v}`);
  }
  sansValeurCassee(c);
  assert.equal(alertes.length, 1, `une alerte n/d attendue (${alertes.length})`);
  assert.ok(!alertes[0].includes('\n'), `l'alerte de l'heure limite tient sur plusieurs lignes : ${alertes[0]}`);
  assert.ok(alertes[0].includes('n/d sur S&P 500') && alertes[0].includes('26/11'), `l'alerte n/d ne nomme pas le S&P 500 : ${alertes[0]}`);
  console.log(`\n--- alerte du cas 8 ---\n${alertes[0]}\n-----------------------`);
});
await cas('9. Échéance, ES principale et secours muettes → ES en n/d, CFD intact', async () => {
  const { r, envois, alertes } = await cycle({ zones: { esMuettes: 2 }, echeance: true });
  assert.equal(envois.length, 1, `brief non envoyé (${JSON.stringify(r.motifs)})`);
  const c = envois[0];
  assert.ok(!c.includes('7&nbsp;195,75') && !c.includes('7&nbsp;203,25') && !c.includes('7&nbsp;134,08'), 'une valeur ES inventée est publiée');
  assert.equal(c.split(ND_HTML).length - 1, 8, '7 lignes ES + niveaux psychologiques en n/d attendus');
  for (const v of ['7&nbsp;182,78', '7&nbsp;117,40', '7&nbsp;346,60']) assert.ok(c.includes(v), `CFD absent : ${v}`);
  sansValeurCassee(c);
  assert.ok(alertes[0].includes('n/d sur ES') && !alertes[0].includes('\n'), `alerte ES incomplète : ${alertes[0]}`);
});
await cas('10. Échéance, le modèle écrit à la main la valeur manquante → prose refusée, brief « données seules », valeur jamais publiée', async () => {
  const prose = structuredClone(PROSE_SANS_SPX);
  prose.actualite[0].texte = 'Le S&P 500 a fini à 7 182,78 points hier, tandis que le Nasdaq cédait {NASDAQ_VAR_ABS}.';
  const { r, envois, alertes } = await cycle({ hier: { spxMuettes: 2 }, prose, echeance: true });
  assert.equal(envois.length, 1, 'aucun brief à l\'échéance');
  assert.equal(r.secours, true, 'la prose fautive est partie');
  const c = envois[0];
  assert.ok(!c.includes('7 182,78 points') && !c.includes('Wall Street hier'), 'la prose refusée est partie');
  assert.ok(c.includes('Agenda indisponible ce matin') && !c.includes('Pas d\'événement macro'), 'agenda de secours absent ou faux');
  assert.ok(!c.includes('Actualité éco') && !c.includes('psychologie du jour') && !c.includes('Culture de marché'), 'prose non vérifiée dans le secours');
  assert.ok(c.includes('7&nbsp;250 · 7&nbsp;200 · 7&nbsp;150 · 7&nbsp;100'), 'niveaux psychologiques du code absents');
  assert.ok(c.includes('Marché fermé aujourd\'hui, États-Unis'), 'jour férié des calendriers absent du secours');
  sansValeurCassee(c);
  assert.equal(alertes.length, 2, 'alertes n/d puis secours attendues');
  assert.ok(alertes[1].includes('données seules') && alertes[1].includes('7 182,78 points'), `alerte secours sans le motif : ${alertes[1]}`);
});
await cas('11. Échéance, sortie du modèle illisible → brief « données seules », complet', async () => {
  const { r, envois, alertes } = await cycle({ sortie: 'désolé, je ne peux pas', echeance: true });
  assert.equal(envois.length, 1);
  assert.equal(r.secours, true);
  assert.ok(!envois[0].includes(ND_HTML), 'n/d alors que tout est collecté');
  sansValeurCassee(envois[0]);
  assert.equal(alertes.length, 1);
  assert.ok(alertes[0].includes('illisible'));
});
await cas('12. Échéance, « n/d » écrit par le modèle → refusé (seul le code pose un n/d), secours', async () => {
  const prose = structuredClone(PROSE_SANS_SPX);
  prose.retenir[0] = 'Le S&P 500 est n/d ce matin.';
  const { r, envois } = await cycle({ hier: { spxMuettes: 2 }, prose, echeance: true });
  assert.equal(r.secours, true, 'un « n/d » du modèle est passé');
  assert.ok(!envois[0].includes('est n/d ce matin'));
  sansValeurCassee(envois[0]);
});
await cas('13. Contrôle final : un « n/d » nu (pas posé par le code) reste refusé par l\'endpoint', async () => {
  const { envois } = await cycle({ hier: { spxMuettes: 2 }, prose: PROSE_SANS_SPX, echeance: true });
  assert.deepEqual(controleEndpoint(envois[0]), []);
  const falsifie = envois[0].replace(ND_HTML, 'n/d');
  assert.ok(controleEndpoint(falsifie).some((m) => m.includes('valeur manquante')), 'n/d nu accepté par l\'endpoint');
});

// ── RÈGLE DES SOURCES DU 27/11/2026 : PRINCIPALE, PUIS SECOURS, SANS COMPARAISON ─────
await cas('14. Principale et secours différents → la principale est publiée, aucun désaccord', async () => {
  const { r, envois, alertes } = await cycle({ hier: { spxSecours: deux(7000, 7100) } });
  assert.equal(alertes.length, 0, `alerte inattendue : ${alertes[0]}`);
  assert.equal(envois.length, 1, `brief non envoyé (${JSON.stringify(r.motifs || r.manquants)})`);
  assert.ok(envois[0].includes('7&nbsp;182,78 points (-0,25&nbsp;%)') && !envois[0].includes('7&nbsp;000'), 'la principale n\'a pas fait foi');
});
await cas('15. Principale sans veille → clôture ET veille prises sur le secours (variation cohérente)', async () => {
  const d = await collecterTout(DATE, { maintenant: MAINTENANT, sourcesZones: sourcesZones(),
    listeHier: listeHier({ spxPrincipale: { '2026-11-25': 7182.78 }, spxSecours: deux(7180, 7200) }) });
  const v = d.hier.spx;
  assert.equal(v.nd, false);
  assert.deepEqual([v.cloture, v.precedente, v.variation], [7180, 7200, -0.28], 'clôture et veille pas toutes deux du secours');
  assert.equal(v.sources[0].role, 'secours');
});
await cas('16. Cas du 27/11 : CNBC OAT clôture 4,7437, veille 4,7322 (TradingView différent) → OAT affichée, pas n/d', async () => {
  const oat = { cle: 'oat', nom: 'OAT France 10 ans', place: 'FR', unite: 'pt', sources: [
    fixe('CNBC (graphique journalier FR10Y-FR)', { '2026-11-26': 4.7437, '2026-11-25': 4.7322 }),
    fixe('TradingView (TVC:FR10Y)', { '2026-11-26': 4.7226, '2026-11-25': 4.731 }),
  ] };
  const v = await collecterInstrument(oat, '2026-11-27', new Date('2026-11-27T05:00:00+01:00'));
  assert.equal(v.nd, false, `OAT en n/d : ${v.motif}`);
  assert.deepEqual([v.cloture, v.precedente, v.variation], [4.7437, 4.7322, 0.01]);
  assert.equal(v.sources.length, 1);
  assert.match(v.sources[0].nom, /^CNBC/);
  assert.ok(v.essais.every((e) => !/désaccord/.test(e.statut)), 'un « désaccord » subsiste');
  console.log(`   OAT affichée : ${valeurHier('oat', v)} (${variationHier('oat', v)})`);
});
await cas('17. Alerte de l\'heure limite : une seule ligne, valeurs nommées, lien du run', async () => {
  const t = texteAlerteNd({ dateBrief: '2026-11-27', manquants: [{ valeur: 'OAT France 10 ans (séance du 2026-11-26)' }, { valeur: 'POC ES (séance du 2026-11-25)' }] },
    { run: 'https://github.com/x/y/actions/runs/1' });
  assert.equal(typeof t, 'string');
  assert.ok(!t.includes('\n'), 'plusieurs lignes');
  assert.ok(t.includes('Brief du 27/11') && t.includes('n/d sur OAT France 10 ans, POC ES') && t.endsWith('[run](<https://github.com/x/y/actions/runs/1>)'), t);
  console.log(`   ${t}`);
});
await cas('18. Échéance, minutes CNBC muettes → POC seul en n/d (aucun POC d\'une autre granularité), le reste intact', async () => {
  const { r, envois, alertes } = await cycle({ zones: { pocMuettes: 1 }, echeance: true });
  assert.equal(envois.length, 1, `brief non envoyé (${JSON.stringify(r.motifs)})`);
  assert.equal(envois[0].split(ND_HTML).length - 1, 1, 'n/d attendu sur le seul POC');
  assert.ok(envois[0].includes('7&nbsp;195,75') && !envois[0].includes('7&nbsp;203,25'), 'ES absent ou POC publié');
  assert.ok(alertes[0].includes('n/d sur POC ES'), alertes[0]);
});

console.log(`\n${resultats.join('\n')}`);
process.exit(resultats.every((l) => l.startsWith('✅')) ? 0 : 1);
