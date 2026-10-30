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
         seanceCboe, semaineCboe, esBarresTradingView, rangSeanceReglee, vixQuoteCboe, esMinutesCnbc } from './sources.js';
import { pocControle } from './poc.js';
import { seancesDeposees, semaineDeposee } from './instantanes.js';
import { controlerOhlc, controlerDate, controlerBasis, controlerContrat, dernierJourOuvre, FERIES_US } from './validation.js';
import { concilier, TOLERANCE_ES } from './croisement.js';

const val = (v, meta = {}) => ({ nd: false, valeur: v, ...meta });
const nd = (motif) => ({ nd: true, valeur: null, motif });
const essai = async (f) => { try { return { ok: await f() }; } catch (e) { return { err: e.message }; } };

export async function collecterMarche(dateBrief, { historique = null, dossier = null, dossierSemaines = null, maintenant = new Date() } = {}) {
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
    let s = await essai(() => seanceCboe(symbole, seance));
    // VIX : l'historique de graphique arrive en retard sur celui du SPX (n/d du 23/10).
    // Second chemin daté : le cadran différé, dont l'horodatage est vérifié.
    if (s.err && bloc === 'vix') {
      const q = await essai(() => vixQuoteCboe(seance));
      if (q.ok) s = { ok: { ...q.ok, ouverture: null, haut: q.ok.haut ?? q.ok.cloture, bas: q.ok.bas ?? q.ok.cloture } };
      else s = { err: `${s.err} ; cadran différé : ${q.err}` };
    }
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
  // Le VIX ne figure au brief que par sa clôture et sa VARIATION ; ses hauts et bas sont
  // collectés parce qu'ils ne coûtent rien et qu'ils servent au contrôle de cohérence.
  //
  // ── VARIATION DU VIX (30/10/2026) ───────────────────────────────────────────
  // Nadir : « ça fait plusieurs jours que le VIX est en n/d sur la variation ». Elle était
  // laissée au modèle, qui ne la trouvait pas. Elle est désormais CALCULÉE : clôture de la
  // séance visée moins clôture de la séance précédente, toutes deux datées par Cboe
  // (historique). Repli : le champ prev_day_close du cadran différé, s'il est daté de la
  // séance visée. Sans clôture du jour, pas de variation : elle part en n/d avec son motif.
  const vixCloture = r.vix.cloture;
  let vixVariation, vixVariationPct;
  if (vixCloture?.nd) { vixVariation = nd(vixCloture.motif); vixVariationPct = nd(vixCloture.motif); }
  else {
    const veille = dernierJourOuvre(seance);
    let prec = await essai(async () => (await seanceCboe('_VIX', veille)).cloture);
    if (prec.err) {
      const q = await essai(() => vixQuoteCboe(seance));
      prec = q.ok && typeof q.ok.clotureVeille === 'number' ? { ok: q.ok.clotureVeille } : { err: `${prec.err} ; cadran différé : ${q.err || 'prev_day_close absent'}` };
    }
    if (prec.err || !(prec.ok > 0)) {
      const m = `variation VIX : clôture du ${veille} indisponible (${prec.err || 'valeur nulle'})`;
      noter(m); vixVariation = nd(m); vixVariationPct = nd(m);
    } else {
      const diff = Math.round((vixCloture.valeur - prec.ok) * 100) / 100;
      vixVariation = val(diff, { veille, clotureVeille: prec.ok });
      vixVariationPct = val(Math.round((diff / prec.ok) * 10000) / 100, { veille });
    }
  }
  r.vix = { cloture: vixCloture, variation: vixVariation, variationPct: vixVariationPct };

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
    for (const k of ['cloture', 'haut', 'bas', 'hautSemaine', 'basSemaine', 'poc']) r.es[k] = nd(motifsContrat[0]);
  } else {
    // Les chemins sont rangés du plus autoritaire au moins autoritaire. Le règlement
    // daté vient en tête : c'est le seul qui porte SA PROPRE date, au lieu de laisser
    // déduire de quelle séance il parle.
    // ⚠️ LES CHEMINS DÉPENDENT DE L'HEURE (25/10/2026). « Clôture veille » et
    // « close − change » décrivent la séance qui PRÉCÈDE la barre courante. Après la
    // réouverture de 18h00, c'est bien la séance visée ; mais pendant l'interruption
    // (17h-18h) et tout le week-end, la barre courante EST la séance visée, et ces deux
    // chemins rendent la séance d'avant. Mesuré dimanche 25/10 au matin : règlement
    // 7 659,75 contre 7 704,50 deux fois, n/d par divergence. Dès le 2 novembre, le
    // cron de 22h43 UTC tombe à 17h43 à New York, en pleine interruption.
    // Rang 0 : règlement daté + clôture de la barre courante. Rang 1 : les trois
    // chemins d'origine, plus la clôture de la barre précédente.
    const tvb = await essai(() => esBarresTradingView(front.contrat));
    const rang = rangSeanceReglee(maintenant);
    const clotureBarre = tvb.ok?.barres?.[rang]?.cloture ?? null;
    const cheminBarre = { nom: `TradingView barre journalière rang ${rang}`, valeur: clotureBarre,
      motif: tvb.err || (clotureBarre == null ? 'clôture de barre absente' : null) };
    const reglement = { nom: 'règlement CNBC daté', valeur: cnbc.ok?.reglement ?? null,
      motif: cnbc.err || (cnbc.ok?.reglement == null ? 'champ settlePrice absent' : null) };
    const chemins = rang === 0 ? [reglement, cheminBarre] : [
      reglement,
      { nom: 'clôture veille CNBC', valeur: cnbc.ok?.clotureVeille ?? null,
        motif: cnbc.err || (cnbc.ok?.clotureVeille == null ? 'champ previous_day_closing absent' : null) },
      { nom: 'TradingView close−change', valeur: tv.ok?.clotureVeille ?? null, motif: tv.err },
      cheminBarre,
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

    // ── Hauts et bas d'ES (refonte du 25/10/2026) ─────────────────────────────
    //
    // ⚠️ LE PRÉLÈVEMENT DE 17H05 N'A RIEN DÉPOSÉ DEPUIS LE 16/09 : les crons GitHub
    // partent avec des heures de retard, le job tombait hors de sa fenêtre et sortait
    // en succès. Les hauts et bas d'ES viennent désormais des barres journalières de
    // TradingView, lues PAR RANG (cf. `esBarresTradingView`), et la barre retenue est
    // VÉRIFIÉE contre la clôture conciliée : rang 1, c'est le règlement au tick près ;
    // rang 0 (interruption ou week-end), à 3 points près. Un rang mal deviné donne un
    // n/d avec son motif, jamais la fourchette d'une autre séance.
    const h = historique || {};
    let barre = null;
    let motifBarre = null;
    if (tvb.err) motifBarre = `barres TradingView indisponibles (${tvb.err})`;
    else {
      const mC = controlerContrat(tvb.ok, front);
      const b = tvb.ok.barres[rang];
      const clo = r.es.cloture?.valeur;
      if (mC.length) motifBarre = mC[0];
      else if (!b || [b.haut, b.bas, b.cloture].some((x) => x === null)) motifBarre = `barre de rang ${rang} incomplète`;
      else if (typeof clo !== 'number') motifBarre = 'clôture ES non publiée : la barre ne peut pas être vérifiée';
      else if (Math.abs(b.cloture - clo) > (rang === 1 ? TOLERANCE_ES : 3)) {
        motifBarre = `la barre de rang ${rang} clôture à ${b.cloture}, la clôture conciliée vaut ${clo} : ce n'est pas la séance du ${seance}`;
      } else {
        const mO = controlerOhlc('ES', { haut: b.haut, bas: b.bas, cloture: clo });
        if (mO.length) motifBarre = mO[0];
        else barre = { ...b, date: seance };
      }
    }
    if (barre) {
      // Les pivots ES (30/10/2026) se calculent sur CETTE barre : haut et bas de la séance
      // Globex, clôture = règlement concilié. Vérifié le 30/10 contre Investing.com au
      // centime (H 7 773,75 · B 7 709,50 · règlement 7 754,25 → P 7 745,83, R1 7 782,17).
      r.es.barrePivots = { haut: barre.haut, bas: barre.bas, cloture: r.es.cloture.valeur };
      r.sources.esHautBas = `${tvb.ok.source}, rang ${rang}`;
      r.es.haut = val(barre.haut, { source: 'TradingView barre journalière', rang });
      r.es.bas = val(barre.bas, { source: 'TradingView barre journalière', rang });
    } else if (typeof h.esHautSeance === 'number') {
      r.es.haut = val(h.esHautSeance, { source: 'prélèvement 17h05' });
      r.es.bas = val(h.esBasSeance, { source: 'prélèvement 17h05' });
      noter(`ES haut/bas : ${motifBarre} ; repli sur le prélèvement de 17h05`);
    } else {
      r.es.haut = nd(motifBarre); r.es.bas = nd(motifBarre);
    }

    // ── POC de la séance régulière (29/10/2026, voir poc.js) ───────────────────
    // Calculé sur les minutes CNBC du contrat nommé, et rattaché à la séance par le
    // règlement conciliée et la barre journalière vérifiée : sans règlement, pas de POC.
    if (typeof r.es.cloture?.valeur !== 'number') r.es.poc = nd('POC : clôture ES non publiée, séance non vérifiable');
    else {
      const mn = await essai(() => esMinutesCnbc(codeCnbc(front.contrat), seance));
      if (mn.err) r.es.poc = nd(`POC : minutes indisponibles (${mn.err})`);
      else {
        const p = pocControle(mn.ok.barres, { reglement: r.es.cloture.valeur, hautJour: barre?.haut, basJour: barre?.bas });
        if (p.motif) r.es.poc = nd(p.motif);
        else { r.es.poc = val(p.valeur, { minutes: p.minutes }); r.sources.esPoc = mn.ok.source; }
      }
    }

    // Les séances à DÉPOSER : celle-ci, et les barres antérieures quand elles sont
    // lisibles. Datées en remontant les jours ouvrés depuis la séance visée.
    r.es.aDeposer = [];
    if (barre && tvb.ok) {
      r.es.aDeposer.push({ date: seance, esHaut: barre.haut, esBas: barre.bas, esCloture: barre.cloture });
      let d = seance;
      for (let k = rang + 1; k < tvb.ok.barres.length; k++) {
        d = dernierJourOuvre(d);
        const b = tvb.ok.barres[k];
        if ([b.haut, b.bas, b.cloture].some((x) => x === null) || !(b.haut > b.bas)) break;
        r.es.aDeposer.push({ date: d, esHaut: b.haut, esBas: b.bas, esCloture: b.cloture });
      }
    }

    // ── La semaine : du lundi à la séance visée, séance par séance ─────────────
    // ⛔ Une semaine à laquelle il manque une séance n'est pas publiée : son haut ou
    // son bas pourrait être justement dans la séance absente.
    const [ya, ym, yj] = seance.split('-').map(Number);
    const fin = Date.UTC(ya, ym - 1, yj);
    const lundi = new Date(fin - ((new Date(fin).getUTCDay() + 6) % 7) * 86400000).toISOString().slice(0, 10);
    const connues = seancesDeposees(dossier, front.contrat);
    for (const x of r.es.aDeposer) connues.set(x.date, { haut: x.esHaut, bas: x.esBas });
    const attendues = [];
    for (let t = Date.parse(lundi + 'T00:00:00Z'); t <= fin; t += 86400000) {
      const iso = new Date(t).toISOString().slice(0, 10);
      const jour = new Date(t).getUTCDay();
      if (jour !== 0 && jour !== 6 && !FERIES_US.has(iso)) attendues.push(iso);
    }
    const manquantes = attendues.filter((d) => !connues.has(d));
    const bloc = semaineDeposee(dossierSemaines, lundi, front.contrat);
    if (!barre) {
      const m = `semaine ES : séance du ${seance} non vérifiée (${motifBarre})`;
      r.es.hautSemaine = nd(m); r.es.basSemaine = nd(m);
    } else if (!manquantes.length) {
      const dans = attendues.map((d) => connues.get(d));
      r.es.hautSemaine = val(Math.max(...dans.map((x) => x.haut)), { seances: dans.length });
      r.es.basSemaine = val(Math.min(...dans.map((x) => x.bas)), { seances: dans.length });
    } else if (bloc && seance === attendues.at(-1)) {
      // Semaine relevée d'un bloc ; la séance visée, lue aujourd'hui, est intégrée.
      r.es.hautSemaine = val(Math.max(bloc.haut, barre.haut), { source: bloc.source });
      r.es.basSemaine = val(Math.min(bloc.bas, barre.bas), { source: bloc.source });
    } else {
      const m = `semaine ES : séance(s) ${manquantes.join(', ')} jamais relevée(s), haut et bas de semaine non calculables`;
      r.es.hautSemaine = nd(m); r.es.basSemaine = nd(m);
    }
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
  const ligneSignee = (e, v) => `  ${e} : ${!v || v.nd ? `n/d (${v?.motif || 'non collectée'})` : `${v.valeur > 0 ? '+' : v.valeur < 0 ? '−' : ''}${fr(Math.abs(v.valeur))}`}`;
  return [
    'DONNÉES DE MARCHÉ FOURNIES — collectées et validées par le code, hors du modèle.',
    `Séance de référence : ${r.seanceVisee}. Contrat ES : ${r.contratAttendu.contrat}`
      + `${r.es.libelle ? ` (${r.es.libelle})` : ''}, expire le ${r.contratAttendu.expirationIso}.`,
    'Tu les REPRENDS TELLES QUELLES. Aucun recalcul, aucun arrondi, aucune substitution',
    'depuis ta mémoire ou depuis une page web. Une valeur marquée n/d se publie « n/d »',
    'dans le tableau ; tu ne la remplaces jamais par une valeur trouvée ailleurs.',
    // Hauts et bas de séance et de semaine RETIRÉS du brief le 29/10/2026 (Nadir : ils
    // ne concordaient pas avec ceux qu'il lit). Ils restent COLLECTÉS : la barre de séance
    // vérifie la clôture et alimente le dépôt des séances. Ils ne sont plus TRANSMIS au
    // modèle, sinon le contrôle « reprise des chiffres » du workflow les chercherait dans
    // un brief qui ne les publie plus, et l'alerte n/d préviendrait pour des valeurs
    // que personne ne lit.
    'ES :',
    ligne('clôture', r.es.cloture),
    ligne('POC séance régulière', r.es.poc),
    // Pivots ES : calculés par le code et insérés par l'endpoint, jamais par le modèle.
    // La ligne n'apparaît QUE s'ils sont impossibles, pour que le n/d soit compté et que
    // l'alerte prévienne Nadir (une valeur publiée ici serait cherchée dans le brief).
    ...(r.es.barrePivots ? [] : [`  pivots ES (à ne pas publier, calcul du code) : n/d (${r.es.haut?.nd ? r.es.haut.motif : r.es.cloture?.nd ? r.es.cloture.motif : 'barre de séance non vérifiée'})`]),
    'CFD SPX500 (indice comptant) :',
    ligne('clôture', r.spx.cloture),
    'VIX :',
    ligne('clôture', r.vix.cloture),
    // La variation est CALCULÉE par le code (clôture du jour moins celle de la veille,
    // Cboe) : le modèle la reprend telle quelle, signe compris.
    ligneSignee('variation (points)', r.vix.variation),
    ligneSignee('variation (%)', r.vix.variationPct),
    `Chemins croisés pour la clôture ES : ${(r.chemins.esCloture || ['aucun']).join(' · ')}`,
    `Sources : ${Object.entries(r.sources).map(([k, v]) => `${k} = ${v}`).join(' · ') || 'aucune'}`,
  ].join('\n');
}
