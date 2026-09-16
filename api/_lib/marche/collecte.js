// ========================================================================
// La collecte : trois sources, tous les contrôles, un objet structuré.
//
// Le contrat de ce module est simple et il ne souffre aucune exception : CHAQUE valeur
// sort soit avec un nombre, soit avec `nd: true` et un motif en clair. Jamais une
// valeur approchée, jamais une valeur héritée d'un cache, jamais une valeur devinée.
//
// Le modèle ne va plus chercher ces chiffres : il les REÇOIT. C'est le renversement
// qui règle l'intermittence — un modèle rend toujours une valeur plausible, un appel
// de code échoue bruyamment.
// ========================================================================
import { spxCboe, vixCboe, esTradingView, contratFrontMonth } from './sources.js';
import { controlerOhlc, controlerDate, controlerBasis, controlerContrat, dernierJourOuvre } from './validation.js';

const val = (nombre, meta = {}) => ({ nd: false, valeur: nombre, ...meta });
const nd = (motif) => ({ nd: true, valeur: null, motif });

/** Toutes les valeurs de marché du brief du jour. Ne lève jamais : elle rend des n/d. */
export async function collecterMarche(dateBrief, { historique = null } = {}) {
  const seance = dernierJourOuvre(dateBrief);
  const front = contratFrontMonth(dateBrief);
  const r = {
    dateBrief, seanceVisee: seance, contratAttendu: front,
    spx: {}, es: {}, vix: {}, motifs: [], sources: {},
  };

  // ── SPX comptant ────────────────────────────────────────────────────────────
  let spx = null;
  try {
    spx = await spxCboe();
    r.sources.spx = spx.source;
    const m = controlerOhlc('SPX', spx);
    if (m.length) {
      r.motifs.push(...m);
      r.spx = { cloture: nd(m[0]), haut: nd(m[0]), bas: nd(m[0]) };
    } else {
      r.spx = { cloture: val(spx.cloture), haut: val(spx.haut), bas: val(spx.bas),
                clotureVeille: val(spx.clotureVeille) };
    }
  } catch (e) {
    const motif = `source SPX indisponible (${e.message})`;
    r.motifs.push(motif);
    r.spx = { cloture: nd(motif), haut: nd(motif), bas: nd(motif) };
  }

  // ── VIX ─────────────────────────────────────────────────────────────────────
  // Demandé PAR DATE. Une ligne absente est une absence, pas une approximation : le
  // fichier Cboe ne peut pas rendre « à peu près » la séance demandée.
  try {
    const vix = await vixCboe(seance);
    r.sources.vix = vix.source;
    const m = controlerOhlc('VIX', vix);
    r.vix = m.length ? (r.motifs.push(...m), { cloture: nd(m[0]) }) : { cloture: val(vix.cloture) };
  } catch (e) {
    const motif = `source VIX indisponible (${e.message})`;
    r.motifs.push(motif);
    r.vix = { cloture: nd(motif) };
  }

  // ── ES, contrat nommé ───────────────────────────────────────────────────────
  try {
    const es = await esTradingView(front.contrat);
    r.sources.es = es.source;
    r.es.libelle = es.libelle;
    const mContrat = controlerContrat(es, front);
    if (mContrat.length) {
      r.motifs.push(...mContrat);
      r.es.cloture = nd(mContrat[0]);
    } else {
      const mBasis = controlerBasis(es.clotureVeille, spx?.cloture);
      if (mBasis.length) {
        r.motifs.push(...mBasis);
        r.es.cloture = nd(mBasis[0]);
      } else {
        r.es.cloture = val(es.clotureVeille, { contrat: es.contrat, libelle: es.libelle });
      }
    }
  } catch (e) {
    const motif = `source ES indisponible (${e.message})`;
    r.motifs.push(motif);
    r.es.cloture = nd(motif);
  }

  // ── Hauts et bas : séance ES, et semaine des deux ───────────────────────────
  //
  // ⚠️ CE QUI SUIT EST LA LIMITE HONNÊTE DE LA COLLECTE À L'HEURE DU BRIEF, et elle
  // est mesurée, pas supposée. À 18h43 à New York, le Globex a rouvert depuis
  // quarante-trois minutes : le haut et le bas que rend TradingView couvrent ces
  // quarante-trois minutes, pas la séance réglée. Aucune des vingt-trois sources
  // éprouvées ne rend le haut et le bas d'une séance ES TERMINÉE depuis un runner.
  //
  // Le comptant n'a pas ce problème — sa séance est close depuis trois heures — mais
  // le haut et le bas de la SEMAINE demandent l'historique des séances précédentes,
  // que le fichier Cboe ne porte pas (il ne contient que les clôtures).
  //
  // D'où l'historique : un instantané pris chaque soir pendant l'interruption
  // technique du Globex, 17h00-18h00 à New York, quand la bougie journalière est
  // figée. Tant qu'il n'est pas alimenté, ces champs sortent en n/d avec ce motif —
  // ce qui est le comportement voulu, pas un manque.
  const sansHistorique = "haut et bas d'une séance réglée non disponibles à l'heure du brief (Globex rouvert) — instantané de 17h05 absent";
  const h = historique || {};
  const deLhistorique = (cle, motif) => (typeof h[cle] === 'number' ? val(h[cle], { source: 'instantané 17h05' }) : nd(motif));

  r.es.haut = deLhistorique('esHautSeance', sansHistorique);
  r.es.bas = deLhistorique('esBasSeance', sansHistorique);
  r.es.hautSemaine = deLhistorique('esHautSemaine', sansHistorique);
  r.es.basSemaine = deLhistorique('esBasSemaine', sansHistorique);
  const sansSemaine = "haut et bas de la semaine : le fichier Cboe ne porte que les clôtures, historique d'instantanés absent";
  r.spx.hautSemaine = deLhistorique('spxHautSemaine', sansSemaine);
  r.spx.basSemaine = deLhistorique('spxBasSemaine', sansSemaine);

  for (const [bloc, champs] of Object.entries({ spx: r.spx, es: r.es, vix: r.vix })) {
    for (const [nom, v] of Object.entries(champs)) {
      if (v && v.nd && v.motif && !r.motifs.includes(v.motif)) r.motifs.push(`${bloc}.${nom} : ${v.motif}`);
    }
  }
  return r;
}

/** Le bloc injecté dans le prompt. Format figé : le modèle recopie, il ne recalcule pas. */
export function versPrompt(r) {
  const fr = (v, dec = 2) => (v === null || v === undefined ? 'n/d'
    : v.toLocaleString('fr-FR', { minimumFractionDigits: dec, maximumFractionDigits: dec }));
  const ligne = (etiquette, v, dec = 2) =>
    `  ${etiquette} : ${v?.nd ? `n/d (${v.motif})` : fr(v?.valeur, dec)}`;
  return [
    'DONNÉES DE MARCHÉ FOURNIES — collectées et validées par le code, hors du modèle.',
    `Séance de référence : ${r.seanceVisee}. Contrat ES attendu : ${r.contratAttendu.contrat} (expire le ${r.contratAttendu.expirationIso}).`,
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
    `Sources : ${Object.entries(r.sources).map(([k, v]) => `${k} = ${v}`).join(' · ') || 'aucune'}`,
  ].join('\n');
}
