// ========================================================================
// UN CYCLE DU BRIEF V22 : collecter, alerter, assembler, contrôler, envoyer.
//
// ⛔ LA RÈGLE (Manu, 26/11/2026 21h, remplace celle de 26/11 « jamais incomplet ») :
// LE BRIEF N'EST JAMAIS BLOQUÉ. L'effort reste maximal : une source principale et une
// source de secours par valeur (règle du 27/11/2026, plus de croisement entre sources),
// collecte relancée toutes les dix minutes. Mais à 6H45 PARIS (l'ÉCHÉANCE) le brief part quoi qu'il arrive :
//   · une valeur toujours introuvable part en « n/d » (balisage du code), JAMAIS
//     inventée ; une alerte Discord d'UNE ligne nomme chaque n/d (le détail des sources
//     essayées reste dans le journal du run) ;
//   · une prose toujours refusée par les contrôles ne part JAMAIS : le code envoie
//     alors un brief « données seules » (assemblerSecours), et l'alerte le dit.
// Avant l'échéance, rien ne change : collecte incomplète → nouvelle collecte ; prose
// refusée → nouvelle génération, motifs joints.
//
// Le workflow appelle ces fonctions étape par étape (outils/brief-v22.mjs) ; le test
// outils/test-source-muette.mjs appelle `executerCycle`, qui les enchaîne dans le même
// ordre, avant ET à l'échéance.
// ========================================================================
import { collecterHier } from './marche/hier.js';
import { collecterZones } from './marche/zones.js';
import { rendreCorps, rendreCourriel, sujetV22, nombreFr, valeurHier, variationHier, hierNd, ICONES_SITE } from './brief-v22.js';
import { controlerCompletude, controlerNiveauxPsy, controlerProse, controlerRedaction, controlerEtRemplacer, tableJetons } from './brief-garde.js';
import { formatDateLongFr } from './date-fr.js';
import { normaliserProse, aplatirProse, sansGras } from './brief-gras.js';
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
  if (!z.detail.es?.nd && typeof z.es.poc !== 'number') manquants.push({ valeur: `POC ES (séance du ${z.seance})`, motif: z.motifs.es.poc, essais: z.detail.poc?.essais || [] });
  const d = { dateBrief, collecteLe: maintenant.toISOString(), hier, zones, detailZones: z.detail };
  const restants = controlerCompletude({ hier, zones });
  return { ...d, manquants, complet: manquants.length === 0 && restants.length === 0, controle: restants };
}

/** Découpe des lignes en messages Discord de 1 900 caractères au plus : aucune valeur ni
 *  aucune source essayée n'est perdue par une coupure. */
export function decouper(lignes, max = 1900) {
  const msgs = [];
  let cur = '';
  for (const l0 of lignes) {
    const l = l0.length > max ? `${l0.slice(0, max - 1)}…` : l0;
    if (cur && cur.length + 1 + l.length > max) { msgs.push(cur); cur = ''; }
    cur = cur ? `${cur}\n${l}` : l;
  }
  if (cur) msgs.push(cur);
  return msgs;
}

const lignesManquants = (manquants) => manquants.flatMap((m) => [`• **${m.valeur}** : ${m.motif}`,
  ...(m.essais || []).map((e) => `   ◦ ${e.nom} → ${e.statut === 'ok' ? 'ok' : e.statut}`)]);

/** Le message Discord du premier échec de collecte (avant l'échéance). Rend une liste de messages. */
export function texteAlerteCollecte(d, { run = null, tentative = 1 } = {}) {
  return decouper([`⚠️ **Brief du ${d.dateBrief} : collecte incomplète** (tentative ${tentative}). Nouvelle collecte toutes les 10 minutes. Ce qui manquera encore à l'échéance partira en « n/d » (brief envoyé à 6h45 au plus tard, jamais une valeur inventée).`,
    ...lignesManquants(d.manquants), ...(run ? [run] : [])]);
}

/** Nom court d'une valeur manquante : « VIX (séance du …) » → « VIX ». */
export const nomCourt = (valeur) => String(valeur).replace(/ \(séance du [^)]*\)/g, '')
  .replace(/^ES [A-Z0-9]+, clôture, haut et bas$/, 'ES').replace(/^S&P 500 comptant \(CFD\), clôture, haut et bas$/, 'CFD');

/**
 * À l'échéance (heure limite de la collecte) : UNE seule ligne, les valeurs en « n/d »
 * par leur nom court et le lien du run (Manu, 27/11/2026). Le détail des sources essayées
 * reste dans le journal du run.
 */
export function texteAlerteNd(d, { run = null } = {}) {
  const [, mm, jj] = String(d.dateBrief).split('-');
  const noms = d.manquants.map((m) => nomCourt(m.valeur)).join(', ');
  return `🟠 Brief du ${jj}/${mm} : heure limite de la collecte atteinte, n/d sur ${noms}. Le brief part quand même, aucune valeur inventée.${run ? ` [run](<${run}>)` : ''}`;
}

export function texteAlerteControle(dateBrief, motifs, { run = null } = {}) {
  return decouper([`⚠️ **Brief du ${dateBrief} : contrôle refusé**. Nouvelle génération dans 2 minutes, motifs joints au modèle. Si la prose reste refusée à l'échéance, le brief part en version « données seules » (la prose refusée ne part jamais).`,
    ...motifs.map((m) => `• ${m}`), ...(run ? [run] : [])]);
}

export function texteAlerteSecours(dateBrief, motifs, { run = null } = {}) {
  return decouper([`🟠 **Brief du ${dateBrief} : prose toujours refusée à l'échéance**. Le brief part en version « données seules » (blocs chiffrés du code, agenda indiqué indisponible, sans actualité ni psychologie).`,
    ...motifs.map((m) => `• ${m}`), ...(run ? [run] : [])]);
}

/** Manu, mentionné en tête de CHAQUE alerte du brief pour qu'il reçoive une notification
 *  (même mention que le rapport quotidien). Seul cet utilisateur peut être notifié. */
export const MENTION_MANU = '<@710969599948095581>';
const MENTIONS_PERMISES = { users: ['710969599948095581'] };

/** Poste un message, ou une liste de messages (dans l'ordre). La mention est posée en
 *  tête du PREMIER message seulement. `BRIEF_ALERTE_TEST=1` (essai du workflow) marque
 *  l'alerte « 🧪 TEST ». */
export async function alerterDiscord(url, texte, { fetchImpl = fetch } = {}) {
  const test = process.env.BRIEF_ALERTE_TEST === '1' ? '🧪 TEST · ' : '';
  const msgs = [].concat(texte).map((m, i) => (i === 0 ? `${MENTION_MANU} ${test}${m}` : m));
  console.log(`[ALERTE Discord]\n${msgs.join('\n')}`);
  if (!url) return { ok: false, motif: 'webhook absent' };
  const statuts = [];
  for (const m of msgs) {
    const r = await fetchImpl(url, { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: m, allowed_mentions: MENTIONS_PERMISES }) });
    statuts.push(r.status);
  }
  return { ok: statuts.every((x) => x >= 200 && x < 300), statuts };
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
  const ND = 'INDISPONIBLE ce matin (affichée « n/d » par le code). Tu ne la cites pas, ni en chiffres ni par jeton, et tu ne la cherches pas ailleurs';
  const ok = (v) => typeof v === 'number' && Number.isFinite(v);
  const L = (cle, k, nom) => (hierNd(hier[cle])
    ? `  ${nom} (séance du ${hier[cle]?.seance}) : ${ND}.`
    : `  ${nom} (séance du ${hier[cle].seance}) : clôture ${valeurHier(cle, hier[cle]).replace(/&nbsp;/g, ' ')}, variation ${variationHier(cle, hier[cle])} · jetons {${k}_CLOTURE} {${k}_VAR} {${k}_VAR_ABS}`);
  const f = (v) => (ok(v) ? nombreFr(v, 2).replace(/&nbsp;/g, ' ') : 'n/d');
  const vixNd = !ok(zones.vix?.cloture);
  const esNd = !ok(zones.es?.cloture);
  return [
    `Places fermées aujourd'hui (calendriers du code) : ${placesFermees(d.dateBrief).join(', ') || 'aucune'}.`,
    'DONNÉES DE MARCHÉ FOURNIES (collectées par le code, chacune sur sa source principale ou sa source de secours).',
    'Tu ne les recopies jamais en chiffres : tu écris leurs jetons (voir « LES CHIFFRES DU BLOC »).',
    L('spx', 'SPX', 'S&P 500'), L('nasdaq', 'NASDAQ', 'Nasdaq Composite'), L('dax', 'DAX', 'DAX'),
    L('cac', 'CAC', 'CAC 40'), L('oat', 'OAT', 'OAT France 10 ans'), L('btc', 'BTC', 'Bitcoin (clôture à minuit UTC)'),
    vixNd
      ? `  VIX (séance du ${zones.vix?.seance}) : ${ND}. Ta « lecture du VIX » dit seulement, en une phrase, que sa clôture n'est pas disponible ce matin.`
      : `  VIX (séance du ${zones.vix.seance}) : clôture ${f(zones.vix.cloture)}, variation ${variationHier('vix', hier.vix)} · jeton {VIX_CLOTURE}`,
    esNd
      ? `  Future ES ${zones.contrat} (séance du ${zones.seance}) : ${ND}. Pivots et POC indisponibles. Rends quand même 4 niveaux_psy (ils ne seront pas affichés).`
      : `  Future ES ${zones.contrat} (séance du ${zones.seance}) : règlement ${f(zones.es.cloture)}, haut ${f(zones.es.haut)}, bas ${f(zones.es.bas)} · jeton {ES_CLOTURE}`,
    ...(esNd ? [] : [`  Pivots ES (calculés par le code, affichés par lui) : R2 ${f(zones.es.R2)} · R1 ${f(zones.es.R1)} · P ${f(zones.es.P)} · S1 ${f(zones.es.S1)} · S2 ${f(zones.es.S2)} · POC ${f(zones.es.poc)}`]),
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
  // Avant l'échéance, une valeur manquante refuse le brief (la collecte est relancée).
  // À l'échéance (`d.echeance`, posé par « figer »), elle part en « n/d ».
  // Prose survolable (27/11/2026) : textes en paragraphes, gras ramené aux règles par le
  // code (jamais un refus pour du style, voir brief-gras.js).
  const norm = prose && typeof prose === 'object' ? normaliserProse(prose) : null;
  const motifs = [...(d.echeance ? [] : d.controle), ...controlerProse(norm ? aplatirProse(norm.prose) : prose)];
  if (motifs.length) return { ok: false, motifs };
  prose = norm.prose;
  const fermees = placesFermees(d.dateBrief);
  if (fermees.length && !prose.ferie) motifs.push(`jour férié non signalé : ${fermees.join(', ')} fermé(s) aujourd'hui selon les calendriers du code`);
  const esOk = typeof d.zones.es?.cloture === 'number';
  // Sans règlement ES, les niveaux psychologiques n'ont pas d'ancre : « n/d ».
  if (esOk) motifs.push(...controlerNiveauxPsy(prose.niveaux_psy, d.zones.es.cloture));
  if (notion && !String(prose.culture.titre).toLowerCase().includes(String(notion.nom).toLowerCase().split(' ')[0].slice(0, 5))) {
    motifs.push(`culture : « ${prose.culture.titre} » ne correspond pas à la notion du jour (${notion.nom})`);
  }
  const jetons = tableJetons({ hier: d.hier, zones: d.zones });
  // Contrôles des chiffres sur le texte SANS balises (« plus de <strong>3 % » fausserait
  // QUALIF et NOMBRE) ; le HTML rendu garde le gras (échappé ici, restauré au rendu).
  const R = (texte, ou) => {
    motifs.push(...controlerEtRemplacer(sansGras(texte), jetons, ou).motifs);
    return controlerEtRemplacer(texte, jetons, ou).html;
  };
  // Le rendu échappe le texte : on lui passe la prose DÉJÀ échappée et remplacée, décodée
  // une fois pour éviter un double échappement des « & ».
  const dec = (h) => h.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const proseRendue = {
    ...prose,
    intro: prose.intro.map((t) => dec(R(t, 'intro')).replace(/&nbsp;/g, ' ')),
    psychologie: prose.psychologie.map((t) => dec(R(t, 'psychologie')).replace(/&nbsp;/g, ' ')),
    vix_lecture: prose.vix_lecture.map((t) => dec(R(t, 'lecture du VIX')).replace(/&nbsp;/g, ' ')),
    retenir: prose.retenir.map((t) => dec(R(t, 'à retenir')).replace(/&nbsp;/g, ' ')),
    actualite: prose.actualite.map((a, i) => ({ titre: a.titre, texteHtml: a.texte.map((t) => R(t, `actualité ${i + 1}`)) })),
    culture: prose.culture,
  };
  const zones = { es: d.zones.es, cfd: d.zones.cfd, psy: esOk ? prose.niveaux_psy : null, vix: d.zones.vix };
  const corps = rendreCorps({ hier: d.hier, zones, prose: proseRendue, urlSchema });
  motifs.push(...controlerCourriels(d, corps, icones));
  const uniques = [...new Set(motifs)];
  return uniques.length ? { ok: false, motifs: uniques } : { ok: true, corps, mesures: norm.mesures, corrections: norm.corrections };
}

/** Le contrôle de rédaction sur les TROIS courriels finaux (sujet compris). */
function controlerCourriels(d, corps, icones) {
  const dateLongFr = formatDateLongFr(d.dateBrief);
  const m = [...controlerRedaction(rendreCourriel({ firstName: 'Trader', dateLongFr, corpsHtml: corps, icones }), { sujet: sujetV22(dateLongFr) })];
  for (const v of ['prospects', 'archive']) {
    m.push(...controlerRedaction(rendreCourriel({ firstName: 'Trader', dateLongFr, corpsHtml: corps, variant: v, icones })));
  }
  return m;
}

/** Niveaux psychologiques calculés par le code (brief de secours) : deux multiples de 50
 *  au-dessus de la clôture ES, deux en dessous (référence v22 : 7 195,75 → 7250 · 7200 · 7150 · 7100). */
export function niveauxPsyCode(cloture) {
  if (typeof cloture !== 'number' || !Number.isFinite(cloture)) return null;
  const haut = Math.ceil(cloture / 50) * 50;
  const bas = Math.floor(cloture / 50) * 50;
  const h = haut === bas ? haut + 50 : haut;
  return [h + 50, h, bas, bas - 50];
}

/**
 * LE BRIEF DE SECOURS, « DONNÉES SEULES » (Manu, 26/11/2026 21h) : à l'échéance, quand la
 * prose du modèle est absente ou toujours refusée. Tout est écrit par le CODE : les blocs
 * chiffrés (avec « n/d » s'il en reste), une introduction fixe, l'agenda déclaré
 * indisponible (jamais « pas d'événement »), le jour férié des calendriers du code.
 * Ni psychologie, ni actualité, ni « à retenir », ni culture : rien de non vérifié.
 */
export function assemblerSecours(d, { icones = ICONES_SITE } = {}) {
  const fermees = placesFermees(d.dateBrief);
  const prose = {
    intro: 'Ce matin, le brief se limite aux données de marché vérifiées par le code. Le commentaire du jour n\'a pas pu être contrôlé à temps, il ne part donc pas.',
    psychologie: [],
    vix_lecture: '',
    ferie: fermees.length ? { titre: `Marché fermé aujourd'hui, ${fermees.join(', ')}.`, texte: '' } : null,
    agenda: null,
    actualite: [],
    retenir: [],
    culture: null,
  };
  const zones = { es: d.zones.es, cfd: d.zones.cfd, psy: niveauxPsyCode(d.zones.es?.cloture), vix: d.zones.vix };
  const corps = rendreCorps({ hier: d.hier, zones, prose, urlSchema: '' });
  const motifs = [...new Set(controlerCourriels(d, corps, icones))];
  return motifs.length ? { ok: false, motifs } : { ok: true, corps };
}

/**
 * Un cycle complet, tel que le workflow l'enchaîne. Rend { envoye, alerte, motifs }.
 * `generer(d)` → sortie brute du modèle ; `envoyer(corps)` ; `alerter(texte)`.
 */
export async function executerCycle({ dateBrief, maintenant, echeance = false, collecter = collecterTout, generer, envoyer, alerter, urlSchema }) {
  const d = await collecter(dateBrief, { maintenant });
  const alertes = [];
  const alerte = async (t) => { alertes.push([].concat(t).join('\n')); await alerter(t); };
  if (!d.complet) {
    if (!echeance) {
      await alerte(texteAlerteCollecte(d));
      return { envoye: false, alerte: alertes.join('\n'), etape: 'collecte', manquants: d.manquants };
    }
    d.echeance = true;
    await alerte(texteAlerteNd(d));
  }
  let a;
  try {
    a = assembler(d, lireProse(await generer(d)), { urlSchema });
  } catch (e) {
    a = { ok: false, motifs: [`sortie du modèle illisible (${e.message})`] };
  }
  if (!a.ok) {
    if (!echeance) {
      await alerte(texteAlerteControle(dateBrief, a.motifs));
      return { envoye: false, alerte: alertes.join('\n'), etape: 'controle', motifs: a.motifs };
    }
    await alerte(texteAlerteSecours(dateBrief, a.motifs));
    const s = assemblerSecours(d);
    if (!s.ok) throw new Error(`brief de secours refusé : ${s.motifs.join(' | ')}`);
    await envoyer(s.corps);
    return { envoye: true, secours: true, corps: s.corps, nd: d.manquants, alerte: alertes.join('\n'), motifs: a.motifs };
  }
  await envoyer(a.corps);
  return { envoye: true, secours: false, corps: a.corps, nd: d.manquants, alerte: alertes.join('\n') };
}
