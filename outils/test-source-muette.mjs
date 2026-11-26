#!/usr/bin/env node
// ========================================================================
// TEST DU POINT 3e : UNE SOURCE MUETTE NE LAISSE PARTIR AUCUN BRIEF, ET L'ALERTE PART.
//
// Le cycle testé est `executerCycle` (api/_lib/brief-cycle.js) : la collecte réelle
// (concordance, dates, calendriers), le garde-fou réel et le rendu réel. Seuls les
// fournisseurs de données, le modèle, l'envoi et Discord sont simulés.
//   1. Toutes les sources du S&P 500 muettes → aucun envoi, alerte qui nomme le S&P 500
//      et chaque source essayée.
//   2. Les deux sources ES muettes sauf une → aucun envoi (une seule source ne suffit pas).
//   3. Première source du S&P muette, les suivantes répondent → la liste ordonnée
//      prend le relais et le brief part.
//   4. Le modèle écrit un chiffre du bloc à la main → aucun envoi, l'alerte nomme l'écart.
//   5. Le modèle écrit un deux-points → aucun envoi, l'alerte le cite.
// ========================================================================
import assert from 'node:assert/strict';
import { executerCycle, collecterTout } from '../api/_lib/brief-cycle.js';

const DATE = '2026-11-26';
const MAINTENANT = new Date('2026-11-26T05:00:00+01:00');
const muette = (nom) => ({ nom, async serie() { throw new Error('HTTP 503'); } });
const fixe = (nom, map) => ({ nom, async serie() { return new Map(Object.entries(map)); } });
const deux = (c, p) => ({ '2026-11-25': c, '2026-11-24': p });

function listeHier({ spxMuettes = 0 } = {}) {
  const inst = (cle, nom, place, tol, unite, c, p, noms) => ({ cle, nom, place, tolerance: tol, unite,
    sources: noms.map((n, i) => (cle === 'spx' && i < spxMuettes ? muette(n) : fixe(n, deux(c, p)))) });
  const REL = (v) => ({ type: 'relative', valeur: v });
  return [
    inst('spx', 'S&P 500', 'US', REL(0.0005), 'pct', 7182.78, 7201.09, ['CNBC (.SPX)', 'TradingView (SP:SPX)', 'FT (INX:IOM)', 'Cboe (_SPX)']),
    inst('nasdaq', 'Nasdaq', 'US', REL(0.0005), 'pct', 23585.80, 23733.54, ['CNBC (.IXIC)', 'TradingView (IXIC)', 'Nasdaq.com']),
    inst('dax', 'DAX', 'DE', REL(0.0005), 'pct', 24702.13, 25017.81, ['CNBC (.GDAXI)', 'TradingView (DAX)', 'FT (DAX)']),
    inst('cac', 'CAC 40', 'FR', REL(0.0005), 'pct', 7980.57, 8040.49, ['CNBC (.FCHI)', 'TradingView (PX1)', 'FT (CAC)']),
    inst('oat', 'OAT France 10 ans', 'FR', { type: 'absolue', valeur: 0.01 }, 'pt', 4.732, 4.778, ['CNBC (FR10Y)', 'TradingView (FR10Y)', 'FT (OAT)']),
    inst('btc', 'Bitcoin', 'BTC', REL(0.005), 'pct', 60383.51, 59740.87, ['Coinbase', 'Bitstamp', 'Kraken']),
    inst('vix', 'VIX', 'US', REL(0.0005), 'pct', 28.29, 26.36, ['CNBC (.VIX)', 'TradingView (VIX)', 'Cboe CSV']),
  ];
}
const ES = { '2026-11-25': { haut: 7224, bas: 6982.5, cloture: 7195.75 } };
const SPX = { '2026-11-25': { haut: 7199.31, bas: 6970.11, cloture: 7182.78 } };
function sourcesZones({ esRepondent = 3 } = {}) {
  const noms = ['CNBC (ESZ26)', 'Finviz (ES)', 'TradingView (ESZ2026)'];
  return {
    front: { contrat: 'ESZ2026' },
    es: noms.map((n, i) => (i < esRepondent ? fixe(n, ES) : muette(n))),
    spx: [fixe('CNBC (.SPX)', SPX), fixe('TradingView (SP:SPX)', SPX)],
    poc: async () => ({ valeur: 7203.25, minutes: 390, source: 'CNBC minutes' }),
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
  culture: { titre: 'Le range', definition: 'Un range est une phase où le prix oscille entre un support et une résistance.', usage: 'Un trader s\'en sert pour cartographier les bornes du marché.' },
};

async function cycle({ hier = {}, zones = {}, prose = PROSE }) {
  const envois = [];
  const alertes = [];
  const r = await executerCycle({
    dateBrief: DATE, maintenant: MAINTENANT,
    collecter: (d, o) => collecterTout(d, { ...o, listeHier: listeHier(hier), sourcesZones: sourcesZones(zones) }),
    generer: async () => JSON.stringify(prose),
    envoyer: async (corps) => { envois.push(corps); },
    alerter: async (t) => { alertes.push(t); },
    urlSchema: 'https://journaltrader360.fr/assets/culture/range.png',
  });
  return { r, envois, alertes };
}

const resultats = [];
async function cas(nom, f) {
  try { await f(); resultats.push(`✅ ${nom}`); } catch (e) { resultats.push(`❌ ${nom}\n   ${e.message}`); }
}

await cas('1. S&P 500 : toutes les sources muettes → pas d\'envoi, alerte avec la valeur et les sources', async () => {
  const { r, envois, alertes } = await cycle({ hier: { spxMuettes: 4 } });
  assert.equal(envois.length, 0, 'un brief est parti');
  assert.equal(r.envoye, false);
  assert.equal(alertes.length, 1, 'alerte absente ou en double');
  for (const attendu of ['S&P 500', 'CNBC (.SPX)', 'TradingView (SP:SPX)', 'FT (INX:IOM)', 'Cboe (_SPX)', 'muette (HTTP 503)']) {
    assert.ok(alertes[0].includes(attendu), `l'alerte ne cite pas « ${attendu} »`);
  }
  console.log(`\n--- alerte du cas 1 ---\n${alertes[0]}\n-----------------------`);
});
await cas('2. ES : une seule source répond → pas d\'envoi (deux sources exigées), alerte', async () => {
  const { envois, alertes } = await cycle({ zones: { esRepondent: 1 } });
  assert.equal(envois.length, 0, 'un brief est parti avec une seule source ES');
  assert.equal(alertes.length, 1);
  assert.ok(alertes[0].includes('ES ESZ2026'), 'l\'alerte ne nomme pas ES');
  assert.ok(alertes[0].includes('Finviz (ES)') && alertes[0].includes('TradingView (ESZ2026)'), 'sources ES non citées');
});
await cas('3. S&P 500 : première source muette → la suivante prend le relais, le brief part', async () => {
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
await cas('5. Rédaction : deux-points → pas d\'envoi, l\'alerte cite la phrase', async () => {
  const prose = structuredClone(PROSE);
  prose.retenir[0] = 'À retenir : marché fermé.';
  const { envois, alertes } = await cycle({ prose });
  assert.equal(envois.length, 0);
  assert.ok(alertes[0] && alertes[0].includes('deux-points'), `deux-points non signalé : ${alertes[0]}`);
});

console.log(`\n${resultats.join('\n')}`);
process.exit(resultats.every((l) => l.startsWith('✅')) ? 0 : 1);
