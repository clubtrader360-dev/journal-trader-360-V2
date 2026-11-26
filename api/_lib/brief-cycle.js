// ========================================================================
// UN CYCLE DU BRIEF V22 : collecter, alerter, assembler, contrôler, envoyer.
//
// ⛔ LA RÈGLE (Manu, 26/11/2026) : le brief ne part JAMAIS incomplet. Tant qu'une valeur
// manque, le workflow relance la collecte toutes les dix minutes, sans limite. L'alerte
// Discord part dès le PREMIER échec, en nommant chaque valeur manquante et les sources
// essayées. Même chose si la prose du modèle échoue à un contrôle (cohérence des
// chiffres, deux-points, tirets) : pas d'envoi, et l'alerte nomme l'écart.
//
// Le workflow appelle ces fonctions étape par étape (outils/brief-v22.mjs) ; le test
// outils/test-source-muette.mjs appelle `executerCycle`, qui les enchaîne dans le même
// ordre, avec une source muette, et vérifie qu'aucun envoi n'a lieu et que l'alerte part.
// ========================================================================
import { collecterHier } from './marche/hier.js';
import { collecterZones } from './marche/zones.js';
import { rendreCorps, rendreCourriel, sujetV22, nombreFr, valeurHier, variationHier, ICONES_SITE } from './brief-v22.js';
import { controlerCompletude, controlerNiveauxPsy, controlerProse, controlerRedaction, controlerEtRemplacer, tableJetons } from './brief-garde.js';
import { formatDateLongFr } from './date-fr.js';
import { estSeance } from './marche/calendriers.js';

/** Collecte complète. `options.hier` / `options.zones` : injection pour les tests. */
export async function collecterTout(dateBrief, { maintenant = new Date(), listeHier, sourcesZones } = {}) {
  const hier = await collecterHier(dateBrief, { maintenant, ...(listeHier ? { liste: listeHier } : {}) });
  const z = await collecterZones(dateBrief, { maintenant, ...(sourcesZones ? { sources: sourcesZones } : {}) });
  const zones = { es: z.es, cfd: z.cfd, seance: z.seance, contrat: z.contrat,
    vix: { cloture: hier.vix?.nd ? null : hier.vix?.cloture, seance: hier.vix?.seance },
    motifs: { ...z.motifs, vix: hier.vix?.nd ? hier.vix.motif : null } };
  const manquants = [];
  for (const v of Object.values(hier)) {
    if (v.nd) manquants.push({ valeur: `${v.nom} (séance du ${v.seance})`, motif: v.motif, essais: v.essais });
  }
  for (const [cle, nom] of [['es', `ES ${z.contrat}`], ['cfd', 'S&P 500 comptant (CFD)']]) {
    if (z.detail[cle]?.nd) manquants.push({ valeur: `${nom}, clôture, haut et bas (séance du ${z.seance})`, motif: z.detail[cle].motif, essais: z.detail[cle].essais });
  }
  if (!z.detail.es?.nd && typeof z.es.poc !== 'number') manquants.push({ valeur: `POC ES (séance du ${z.seance})`, motif: z.motifs.es.poc, essais: [{ nom: 'CNBC (minutes du contrat)', statut: z.motifs.es.poc }] });
  const d = { dateBrief, collecteLe: maintenant.toISOString(), hier, zones, detailZones: z.detail };
  const restants = controlerCompletude({ hier, zones });
  return { ...d, manquants, complet: manquants.length === 0 && restants.length === 0, controle: restants };
}

/** Le message Discord du premier échec de collecte. */
export function texteAlerteCollecte(d, { run = null, tentative = 1 } = {}) {
  const lignes = [`⚠️ **Brief du ${d.dateBrief} : collecte incomplète** (tentative ${tentative}). Le brief NE PART PAS ; nouvelle collecte toutes les 10 minutes jusqu'à ce que tout soit là.`];
  for (const m of d.manquants) {
    lignes.push(`• **${m.valeur}** : ${m.motif}`);
    for (const e of (m.essais || [])) lignes.push(`   ◦ ${e.nom} → ${e.statut === 'ok' ? 'ok' : e.statut}`);
  }
  if (run) lignes.push(run);
  return lignes.join('\n').slice(0, 1900);
}

export function texteAlerteControle(dateBrief, motifs, { run = null } = {}) {
  return [`⚠️ **Brief du ${dateBrief} : contrôle refusé**, le brief NE PART PAS. Nouvelle génération dans 2 minutes, motifs joints au modèle.`,
    ...motifs.slice(0, 15).map((m) => `• ${m}`), ...(run ? [run] : [])].join('\n').slice(0, 1900);
}

export async function alerterDiscord(url, texte, { fetchImpl = fetch } = {}) {
  if (!url) { console.log(`[ALERTE sans webhook]\n${texte}`); return { ok: false, motif: 'webhook absent' }; }
  const r = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content: texte }) });
  return { ok: r.ok, statut: r.status };
}

/** Places (États-Unis, Allemagne, France) fermées le jour du brief, un jour de semaine. */
export function placesFermees(dateIso) {
  const j = new Date(`${dateIso}T12:00:00Z`).getUTCDay();
  if (j === 0 || j === 6) return [];
  return [['US', 'États-Unis'], ['DE', 'Allemagne (Xetra)'], ['FR', 'France (Euronext)']]
    .filter(([p]) => !estSeance(p, dateIso)).map(([, n]) => n);
}

/** Le bloc de données donné au modèle : valeurs formatées comme dans le mail, et jetons. */
export function versPromptV22(d) {
  const { hier, zones } = d;
  const L = (cle, k, nom) => `  ${nom} (séance du ${hier[cle].seance}) : clôture ${valeurHier(cle, hier[cle]).replace(/&nbsp;/g, ' ')}, variation ${variationHier(cle, hier[cle])} · jetons {${k}_CLOTURE} {${k}_VAR} {${k}_VAR_ABS}`;
  const f = (v) => nombreFr(v, 2).replace(/&nbsp;/g, ' ');
  return [
    `Places fermées aujourd'hui (calendriers du code) : ${placesFermees(d.dateBrief).join(', ') || 'aucune'}.`,
    'DONNÉES DE MARCHÉ FOURNIES (collectées par le code, chacune confirmée par deux sources indépendantes).',
    'Tu ne les recopies jamais en chiffres : tu écris leurs jetons (voir « LES CHIFFRES DU BLOC »).',
    L('spx', 'SPX', 'S&P 500'), L('nasdaq', 'NASDAQ', 'Nasdaq Composite'), L('dax', 'DAX', 'DAX'),
    L('cac', 'CAC', 'CAC 40'), L('oat', 'OAT', 'OAT France 10 ans'), L('btc', 'BTC', 'Bitcoin (clôture à minuit UTC)'),
    `  VIX (séance du ${zones.vix.seance}) : clôture ${f(zones.vix.cloture)}, variation ${variationHier('vix', hier.vix)} · jeton {VIX_CLOTURE}`,
    `  Future ES ${zones.contrat} (séance du ${zones.seance}) : règlement ${f(zones.es.cloture)}, haut ${f(zones.es.haut)}, bas ${f(zones.es.bas)} · jeton {ES_CLOTURE}`,
    `  Pivots ES (calculés par le code, affichés par lui) : R2 ${f(zones.es.R2)} · R1 ${f(zones.es.R1)} · P ${f(zones.es.P)} · S1 ${f(zones.es.S1)} · S2 ${f(zones.es.S2)} · POC ${f(zones.es.poc)}`,
  ].join('\n');
}

/** Lit le JSON du modèle dans sa sortie brute (tolère un préambule). */
export function lireProse(brut) {
  const t = String(brut || '');
  const a = t.indexOf('{');
  const b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('aucun objet JSON dans la sortie du modèle');
  return JSON.parse(t.slice(a, b + 1));
}

/**
 * Prose + données → corps HTML, ou refus motivé. Contrôle la prose, remplace les jetons,
 * rend le corps PUIS le courriel complet, et contrôle la rédaction sur le courriel final
 * (textes alternatifs, titre et sujet compris).
 */
export function assembler(d, prose, { urlSchema, notion = null, icones = ICONES_SITE } = {}) {
  const motifs = [...d.controle, ...controlerProse(prose)];
  if (motifs.length) return { ok: false, motifs };
  const fermees = placesFermees(d.dateBrief);
  if (fermees.length && !prose.ferie) motifs.push(`jour férié non signalé : ${fermees.join(', ')} fermé(s) aujourd'hui selon les calendriers du code`);
  motifs.push(...controlerNiveauxPsy(prose.niveaux_psy, d.zones.es.cloture));
  if (notion && !String(prose.culture.titre).toLowerCase().includes(String(notion.nom).toLowerCase().split(' ')[0].slice(0, 5))) {
    motifs.push(`culture : « ${prose.culture.titre} » ne correspond pas à la notion du jour (${notion.nom})`);
  }
  const jetons = tableJetons({ hier: d.hier, zones: d.zones });
  const R = (texte, ou) => { const r = controlerEtRemplacer(texte, jetons, ou); motifs.push(...r.motifs); return r.html; };
  // Le rendu échappe le texte : on lui passe la prose DÉJÀ échappée et remplacée, décodée
  // une fois pour éviter un double échappement des « & ».
  const dec = (h) => h.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const proseRendue = {
    ...prose,
    intro: dec(R(prose.intro, 'intro')).replace(/&nbsp;/g, ' '),
    psychologie: [].concat(prose.psychologie).map((t) => dec(R(t, 'psychologie')).replace(/&nbsp;/g, ' ')),
    vix_lecture: dec(R(prose.vix_lecture, 'lecture du VIX')).replace(/&nbsp;/g, ' '),
    retenir: prose.retenir.map((t) => dec(R(t, 'à retenir')).replace(/&nbsp;/g, ' ')),
    actualite: prose.actualite.map((a, i) => ({ titre: a.titre, texteHtml: R(a.texte, `actualité ${i + 1}`) })),
    culture: prose.culture,
  };
  const zones = { es: d.zones.es, cfd: d.zones.cfd, psy: prose.niveaux_psy, vix: d.zones.vix };
  const corps = rendreCorps({ hier: d.hier, zones, prose: proseRendue, urlSchema });
  const dateLongFr = formatDateLongFr(d.dateBrief);
  const courriel = rendreCourriel({ firstName: 'Trader', dateLongFr, corpsHtml: corps, icones });
  motifs.push(...controlerRedaction(courriel, { sujet: sujetV22(dateLongFr) }));
  for (const v of ['prospects', 'archive']) {
    motifs.push(...controlerRedaction(rendreCourriel({ firstName: 'Trader', dateLongFr, corpsHtml: corps, variant: v, icones })));
  }
  const uniques = [...new Set(motifs)];
  return uniques.length ? { ok: false, motifs: uniques } : { ok: true, corps, courriel };
}

/**
 * Un cycle complet, tel que le workflow l'enchaîne. Rend { envoye, alerte, motifs }.
 * `generer(d)` → sortie brute du modèle ; `envoyer(corps)` ; `alerter(texte)`.
 */
export async function executerCycle({ dateBrief, maintenant, collecter = collecterTout, generer, envoyer, alerter, urlSchema }) {
  const d = await collecter(dateBrief, { maintenant });
  if (!d.complet) {
    const texte = texteAlerteCollecte(d);
    await alerter(texte);
    return { envoye: false, alerte: texte, etape: 'collecte', manquants: d.manquants };
  }
  let prose;
  try { prose = lireProse(await generer(d)); } catch (e) {
    const texte = texteAlerteControle(dateBrief, [`sortie du modèle illisible (${e.message})`]);
    await alerter(texte);
    return { envoye: false, alerte: texte, etape: 'generation' };
  }
  const a = assembler(d, prose, { urlSchema });
  if (!a.ok) {
    const texte = texteAlerteControle(dateBrief, a.motifs);
    await alerter(texte);
    return { envoye: false, alerte: texte, etape: 'controle', motifs: a.motifs };
  }
  await envoyer(a.corps);
  return { envoye: true, corps: a.corps };
}
