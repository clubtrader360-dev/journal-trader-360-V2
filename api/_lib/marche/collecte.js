// ========================================================================
// La collecte : plusieurs chemins par grandeur, croisés entre eux, puis contrôlés.
//
// Le contrat ne change pas : chaque valeur sort soit avec un nombre, soit avec
// `nd: true` et un motif en clair. Ce qui change, c'est la MANIÈRE de vérifier.
//
// L'ancienne règle exigeait une seconde SOURCE. Celle-ci exige deux CHEMINS, et les
// chemins vivent là où la donnée est réellement atteignable depuis le runner. C'est
// ce qui fait passer la clôture ES de cinq publications sur dix à dix sur dix, sans
// rien céder sur l'exigence : un écart supérieur à un tick reste un n/d.
// ========================================================================
import { spxCboe, vixCboe, esTradingView, esCnbc, codeCnbc, contratFrontMonth,
         seanceCboe, semaineCboe } from './sources.js';
import { controlerOhlc, controlerDate, controlerBasis, controlerContrat, dernierJourOuvre } from './validation.js';
import { concilier, TOLERANCE_ES } from './croisement.js';

const val = (v, meta = {}) => ({ nd: false, valeur: v, ...meta });
const nd = (motif) => ({ nd: true, valeur: null, motif });
const essai = async (f) => { try { return { ok: await f() }; } catch (e) { return { err: e.message }; } };

export async function collecterMarche(dateBrief, { historique = null } = {}) {
  const seance = dernierJourOuvre(dateBrief);
  const front = contratFrontMonth(dateBrief);
  const r = { dateBrief, seanceVisee: seance, contratAttendu: front,
              spx: {}, es: {}, vix: {}, motifs: [], sources: {}, chemins: {} };
  const noter = (m) => { for (const x of [].concat(m)) if (x && !r.motifs.includes(x)) r.motifs.push(x); };

  // ── SPX comptant et VIX : historique DATÉ ───────────────────────────────────
  //
  // On demande une DATE et on obtient sa ligne, ou rien. C'est ce qui rend ces deux
  // lignes du tableau insensibles à l'heure de génération : plus besoin de se demander
  // si le cadran affiche la séance close ou celle en cours, la question ne se pose pas.
  for (const [bloc, symbole] of [['spx', '_SPX'], ['vix', '_VIX']]) {
    const s = await essai(() => seanceCboe(symbole, seance));
    if (s.err) {
      const motif = `source ${bloc.toUpperCase()} indisponible (${s.err})`;
      noter(motif);
      r[bloc] = { cloture: nd(motif), haut: nd(motif), bas: nd(motif) };
    } else {
      r.sources[bloc] = s.ok.source;
      const m = [...controlerOhlc(bloc.toUpperCase(), s.ok), ...controlerDate(bloc.toUpperCase(), s.ok.date, dateBrief)];
      if (m.length) { noter(m); r[bloc] = { cloture: nd(m[0]), haut: nd(m[0]), bas: nd(m[0]) }; }
      else r[bloc] = { cloture: val(s.ok.cloture), haut: val(s.ok.haut), bas: val(s.ok.bas) };
    }
    const w = await essai(() => semaineCboe(symbole, seance));
    if (w.err) { noter(`${bloc}.semaine : ${w.err}`); r[bloc].hautSemaine = nd(w.err); r[bloc].basSemaine = nd(w.err); }
    else {
      r[bloc].hautSemaine = val(w.ok.haut, { seances: w.ok.seances });
      r[bloc].basSemaine = val(w.ok.bas, { seances: w.ok.seances });
    }
  }
  // Le VIX ne figure au brief que par sa clôture ; ses hauts et bas sont collectés
  // parce qu'ils ne coûtent rien et qu'ils servent au contrôle de cohérence.
  r.vix = { cloture: r.vix.cloture };

  // ── ES : deux fournisseurs, trois chemins ───────────────────────────────────
  const cnbc = await essai(() => esCnbc(codeCnbc(front.contrat)));
  const tv = await essai(() => esTradingView(front.contrat));
  if (cnbc.ok) r.sources.es = cnbc.ok.source;
  if (tv.ok) r.sources.esBis = tv.ok.source;
  if (cnbc.ok) r.es.libelle = cnbc.ok.libelle;

  // ⚠️ LE CONTRÔLE DE CONTRAT PASSE AVANT LE CROISEMENT, et il est prioritaire.
  // C'est le seul qui attrape le cas du 14/09 : deux chemins peuvent concorder
  // parfaitement sur la clôture d'un contrat PÉRIMÉ. Croiser avant de vérifier le
  // contrat reviendrait à confirmer soigneusement la mauvaise valeur.
  const motifsContrat = [];
  if (cnbc.ok) {
    if (cnbc.ok.expirationIso !== front.expirationIso) {
      motifsContrat.push(`ES : CNBC annonce l'expiration ${cnbc.ok.expirationIso}, ${front.expirationIso} attendue`);
    }
  }
  if (tv.ok) motifsContrat.push(...controlerContrat(tv.ok, front));

  if (motifsContrat.length) {
    noter(motifsContrat);
    for (const k of ['cloture', 'haut', 'bas', 'hautSemaine', 'basSemaine']) r.es[k] = nd(motifsContrat[0]);
  } else {
    // Les chemins sont rangés du plus autoritaire au moins autoritaire. Le règlement
    // daté vient en tête : c'est le seul qui porte SA PROPRE date, au lieu de laisser
    // déduire de quelle séance il parle.
    const chemins = [
      { nom: 'règlement CNBC daté', valeur: cnbc.ok?.reglement ?? null,
        motif: cnbc.err || (cnbc.ok?.reglement == null ? 'champ settlePrice absent' : null) },
      { nom: 'clôture veille CNBC', valeur: cnbc.ok?.clotureVeille ?? null,
        motif: cnbc.err || (cnbc.ok?.clotureVeille == null ? 'champ previous_day_closing absent' : null) },
      { nom: 'TradingView close−change', valeur: tv.ok?.clotureVeille ?? null, motif: tv.err },
    ];
    r.chemins.esCloture = chemins.map((c) => `${c.nom} = ${c.valeur ?? `n/d (${c.motif})`}`);

    // La date du règlement doit être celle de la séance visée. Un règlement juste mais
    // daté d'avant-hier est une valeur fausse pour le brief d'aujourd'hui.
    const mDate = cnbc.ok?.dateReglement ? controlerDate('ES règlement', cnbc.ok.dateReglement, dateBrief) : [];
    const accord = mDate.length ? { valeur: null, motif: mDate[0] } : concilier('ES clôture', chemins, TOLERANCE_ES);
    r.es.ecartChemins = accord.ecart ?? null;

    if (accord.valeur === null) { noter(accord.motif); r.es.cloture = nd(accord.motif); }
    else {
      const mBasis = controlerBasis(accord.valeur, r.spx.cloture?.valeur);
      if (mBasis.length) { noter(mBasis); r.es.cloture = nd(mBasis[0]); }
      else r.es.cloture = val(accord.valeur, { contrat: front.contrat, libelle: cnbc.ok?.libelle, chemins: accord.chemins });
      if (accord.absents?.length) noter(`ES clôture publiée avec ${accord.chemins.length} chemins — ${accord.absents.join(' ; ')}`);
    }

    // ── Hauts et bas d'ES ─────────────────────────────────────────────────────
    //
    // Aucun des fournisseurs atteignables ne rend la bougie JOURNALIÈRE DATÉE d'un
    // contrat CME : CNBC n'a pas d'historique (404 sur ses trois routes de graphique),
    // TradingView ne rend que la séance en cours, Investing est inatteignable par les
    // sept portes essayées. Et à l'heure du brief, 18h43 à New York, la séance en
    // cours est la NOUVELLE — le Globex a rouvert à 18h00.
    //
    // D'où le prélèvement de 17h05, pendant l'interruption technique du Globex. Il
    // n'est PAS la voie unique par choix : il est la seule voie mesurée. Le jour où il
    // manque, ces deux cases sortent en n/d, et elles seules — le reste du tableau ne
    // dépend plus de lui.
    const h = historique || {};
    const deHisto = (cle) => (typeof h[cle] === 'number' ? val(h[cle], { source: 'prélèvement 17h05' })
      : nd("haut/bas d'ES : aucun fournisseur atteignable ne rend la bougie journalière datée d'un contrat CME ; prélèvement de 17h05 absent pour cette séance"));
    r.es.haut = deHisto('esHautSeance');
    r.es.bas = deHisto('esBasSeance');
    r.es.hautSemaine = deHisto('esHautSemaine');
    r.es.basSemaine = deHisto('esBasSemaine');
  }

  for (const [bloc, champs] of Object.entries({ spx: r.spx, es: r.es, vix: r.vix })) {
    for (const [nom, v] of Object.entries(champs)) {
      if (v && v.nd && v.motif) noter(`${bloc}.${nom} : ${v.motif}`);
    }
  }
  return r;
}

/** Le bloc injecté dans le prompt. Format figé : le modèle recopie, il ne recalcule pas. */
export function versPrompt(r) {
  const fr = (v, d = 2) => (v == null ? 'n/d' : v.toLocaleString('fr-FR', { minimumFractionDigits: d, maximumFractionDigits: d }));
  const ligne = (e, v) => `  ${e} : ${v?.nd ? `n/d (${v.motif})` : fr(v?.valeur)}`;
  return [
    'DONNÉES DE MARCHÉ FOURNIES — collectées et validées par le code, hors du modèle.',
    `Séance de référence : ${r.seanceVisee}. Contrat ES : ${r.contratAttendu.contrat}`
      + `${r.es.libelle ? ` (${r.es.libelle})` : ''}, expire le ${r.contratAttendu.expirationIso}.`,
    'Tu les REPRENDS TELLES QUELLES. Aucun recalcul, aucun arrondi, aucune substitution',
    'depuis ta mémoire ou depuis une page web. Une valeur marquée n/d se publie « n/d »',
    'dans le tableau ; tu ne la remplaces jamais par une valeur trouvée ailleurs.',
    'ES :',
    ligne('clôture', r.es.cloture),
    ligne('haut de séance', r.es.haut),
    ligne('bas de séance', r.es.bas),
    ligne('haut de semaine', r.es.hautSemaine),
    ligne('bas de semaine', r.es.basSemaine),
    'CFD SPX500 (indice comptant) :',
    ligne('clôture', r.spx.cloture),
    ligne('haut de séance', r.spx.haut),
    ligne('bas de séance', r.spx.bas),
    ligne('haut de semaine', r.spx.hautSemaine),
    ligne('bas de semaine', r.spx.basSemaine),
    'VIX :',
    ligne('clôture', r.vix.cloture),
    `Chemins croisés pour la clôture ES : ${(r.chemins.esCloture || ['aucun']).join(' · ')}`,
    `Sources : ${Object.entries(r.sources).map(([k, v]) => `${k} = ${v}`).join(' · ') || 'aucune'}`,
  ].join('\n');
}
