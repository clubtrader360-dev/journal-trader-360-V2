// ========================================================================
// LE GARDE-FOU DU BRIEF V22 (Manu, 26/11/2026 : « jamais une valeur manquante »).
//
// Trois contrôles, et un brief qui en rate UN ne part pas :
//   1. COMPLÉTUDE : les six lignes « Sur les marchés hier », toutes les lignes ES et CFD,
//      les niveaux psychologiques et le VIX sont des nombres. Aucun « n/d » ne passe.
//   2. COHÉRENCE : les chiffres de l'actualité sont ceux du bloc. Le modèle n'écrit
//      JAMAIS un chiffre des sept valeurs du bloc : il écrit un JETON ({SPX_CLOTURE},
//      {NASDAQ_VAR_ABS}…) que le code remplace par la valeur du bloc, formatée comme lui.
//      Le contrôle refuse un chiffre brut posé à côté d'une de ces valeurs, un jeton
//      inconnu, un jeton placé dans une phrase qui ne nomme pas son instrument, et un
//      verbe de baisse sur une hausse (ou l'inverse).
//   3. RÉDACTION : aucun deux-points au milieu d'une phrase, aucun tiret cadratin ni
//      demi-cadratin, texte visible, textes alternatifs, titre et sujet compris.
// Chaque refus porte un motif en clair : c'est lui que l'alerte Discord envoie.
// ========================================================================
import { nombreFr, valeurHier, variationHier, DRAPEAUX } from './brief-v22.js';

const estNombre = (x) => typeof x === 'number' && Number.isFinite(x);

// ── 1. COMPLÉTUDE ───────────────────────────────────────────────────────────────
const NOMS_HIER = { spx: 'S&P 500', nasdaq: 'Nasdaq', dax: 'DAX', cac: 'CAC 40', oat: 'OAT France 10 ans', btc: 'Bitcoin' };
const NOMS_ZONES = { cloture: 'clôture', poc: 'POC', R2: 'résistance 2', R1: 'résistance 1', P: 'pivot', S1: 'support 1', S2: 'support 2' };

export function controlerCompletude({ hier, zones }) {
  const m = [];
  for (const [k, nom] of Object.entries(NOMS_HIER)) {
    const v = hier?.[k];
    if (!v || v.nd || !estNombre(v.cloture) || !estNombre(v.variation)) {
      m.push(`${nom} manquant${v?.motif ? ` (${v.motif})` : ''}`);
    }
  }
  for (const [k, nom] of Object.entries(NOMS_ZONES)) {
    if (!estNombre(zones?.es?.[k])) m.push(`ES ${nom} manquant${zones?.motifs?.es?.[k] ? ` (${zones.motifs.es[k]})` : ''}`);
    if (k !== 'poc' && !estNombre(zones?.cfd?.[k])) m.push(`CFD ${nom} manquant${zones?.motifs?.cfd?.[k] ? ` (${zones.motifs.cfd[k]})` : ''}`);
  }
  if (!estNombre(zones?.vix?.cloture)) m.push(`VIX manquant${zones?.motifs?.vix ? ` (${zones.motifs.vix})` : ''}`);
  return m;
}

/** Niveaux psychologiques rendus par le modèle : 2 à 6 nombres ronds autour de la clôture ES. */
export function controlerNiveauxPsy(psy, clotureEs) {
  if (!Array.isArray(psy) || psy.length < 2 || psy.length > 6) return ['niveaux psychologiques manquants (2 à 6 attendus)'];
  const m = [];
  for (const n of psy) {
    if (!Number.isInteger(n) || n % 25 !== 0) m.push(`niveau psychologique ${n} : nombre rond attendu (multiple de 25)`);
    else if (estNombre(clotureEs) && Math.abs(n - clotureEs) > clotureEs * 0.05) m.push(`niveau psychologique ${n} : à plus de 5 % de la clôture ES ${clotureEs}`);
  }
  return m;
}

// ── 2. COHÉRENCE : LES JETONS ─────────────────────────────────────────────────────
// Instrument → noms qui le désignent dans une phrase.
const INSTRUMENTS = {
  SPX: /S&P\s*500|S&P|SP500|SPX/i,
  NASDAQ: /Nasdaq/i,
  DAX: /\bDAX\b/,
  CAC: /\bCAC\b/,
  OAT: /\bOAT\b|taux (?:français|de la France)|rendement français/i,
  BTC: /Bitcoin|\bBTC\b/i,
  VIX: /\bVIX\b/,
  ES: /\bES\b|future[s]? (?:sur le )?S&P|mini S&P/i,
};

/** Les jetons et leur valeur formatée, tirés du BLOC (mêmes chaînes que le bloc). */
export function tableJetons({ hier, zones }) {
  const t = {};
  const ajout = (k, cle) => {
    const v = hier[cle];
    t[`${k}_CLOTURE`] = { texte: valeurHier(cle, v).replace(/ ([%$])/, '&nbsp;$1'), instrument: k };
    t[`${k}_VAR`] = { texte: variationHier(cle, v).replace(/ (%|pt)$/, '&nbsp;$1'), instrument: k, signe: Math.sign(v.variation) };
    t[`${k}_VAR_ABS`] = { texte: variationHier(cle, { ...v, variation: Math.abs(v.variation) }).replace(/^\+/, '').replace(/ (%|pt)$/, '&nbsp;$1'), instrument: k, signe: Math.sign(v.variation), abs: true };
  };
  ajout('SPX', 'spx'); ajout('NASDAQ', 'nasdaq'); ajout('DAX', 'dax'); ajout('CAC', 'cac'); ajout('OAT', 'oat'); ajout('BTC', 'btc');
  t.VIX_CLOTURE = { texte: nombreFr(zones.vix.cloture, 2), instrument: 'VIX' };
  t.ES_CLOTURE = { texte: nombreFr(zones.es.cloture, 2), instrument: 'ES' };
  return t;
}

const BAISSE = /\b(c[èée]d|recul|perd|perdu|baiss|chut|repli|gliss|abandonn|l[âa]ch|termin\w* en baisse|d[ée]cro)/i;
const HAUSSE = /\b(gagn|progress|mont|grimp|avanc|hausse|rebond|bondi|s'appr[ée]ci|termin\w* en hausse)/i;
// Ampleurs en séance ET niveaux (« sous les 7 200 points », « au-dessus de 60 000 dollars ») :
// ce ne sont ni des clôtures ni des variations, la concordance ne les concerne pas.
const QUALIF = /(plus de|près de|pres de|jusqu'à|jusqu’à|environ|presque|moins de|quelque|en séance|en cours de séance|sous les|sous la barre des|au-dessus des?|au-dessus de la barre des|au-delà des?|seuil des|barre des|cap des|niveau des|zone des|vers les|résistance des|support des|des)\s*$/i;
const NOMBRE = /(\d[\d\u00a0\u202f ]*(?:[.,]\d+)?)\s*(%|points?|pts?|pt\b|\$|dollars)/gi;
const JETON = /\{([A-Z]+_(?:CLOTURE|VAR_ABS|VAR))\}/g;

/**
 * Contrôle un texte de la prose AVANT remplacement des jetons, puis remplace.
 * Rend { html, motifs }. Le HTML rendu est échappé ; les jetons y sont injectés.
 */
export function controlerEtRemplacer(texte, jetons, ou) {
  const motifs = [];
  const brut = String(texte ?? '');
  const phrases = brut.split(/(?<=[.!?])\s+/);
  for (const phrase of phrases) {
    // Jetons : connus, et leur instrument nommé dans la même phrase.
    for (const [, nom] of phrase.matchAll(JETON)) {
      const j = jetons[nom];
      if (!j) { motifs.push(`${ou} : jeton inconnu {${nom}}`); continue; }
      if (!INSTRUMENTS[j.instrument].test(phrase.replace(JETON, ' '))) motifs.push(`${ou} : {${nom}} dans une phrase qui ne nomme pas ${j.instrument} (« ${phrase.slice(0, 120)} »)`);
    }
    // Propositions : chiffre brut à côté d'un instrument du bloc, et sens du verbe.
    for (const prop of phrase.split(/,(?!\d)|;|\s+et\s+|\s+tandis que\s+|\s+alors que\s+/)) {
      // ⚠️ Noms cherchés HORS jetons : « {SPX_VAR} » contient « SPX ».
      const sans = prop.replace(JETON, ' ');
      const nommes = Object.entries(INSTRUMENTS).filter(([, re]) => re.test(sans)).map(([k]) => k);
      for (const [, nom] of prop.matchAll(JETON)) {
        const j = jetons[nom];
        if (j && nommes.length && !nommes.includes(j.instrument)) motifs.push(`${ou} : {${nom}} accolé à ${nommes.join(', ')} (« ${prop.trim().slice(0, 100)} »)`);
      }
      if (!nommes.length) continue;
      for (const m of prop.matchAll(NOMBRE)) {
        const avant = prop.slice(0, m.index);
        if (QUALIF.test(avant)) continue;
        motifs.push(`${ou} : chiffre écrit à la main « ${m[0].trim()} » à côté de ${nommes.join(', ')} (seuls les jetons du bloc sont admis, pour garantir la concordance)`);
      }
      for (const [, nom] of prop.matchAll(JETON)) {
        const j = jetons[nom];
        if (!j || !j.abs || !j.signe) continue;
        if (j.signe > 0 && BAISSE.test(prop) && !HAUSSE.test(prop)) motifs.push(`${ou} : verbe de baisse pour ${j.instrument}, en hausse de ${j.texte.replace('&nbsp;', ' ')} dans le bloc`);
        if (j.signe < 0 && HAUSSE.test(prop) && !BAISSE.test(prop)) motifs.push(`${ou} : verbe de hausse pour ${j.instrument}, en baisse de ${j.texte.replace('&nbsp;', ' ')} dans le bloc`);
      }
    }
  }
  const esc = (t) => t.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const html = esc(brut).replace(JETON, (x, nom) => (jetons[nom] ? jetons[nom].texte : x));
  return { html, motifs };
}

// ── 3. RÉDACTION ──────────────────────────────────────────────────────────────────
/** Texte visible + alt + title d'un HTML, entités décodées. */
export function textesVisibles(html) {
  const sansStyle = String(html).replace(/<style[\s\S]*?<\/style>/gi, '').replace(/<!--[\s\S]*?-->/g, '');
  const attributs = [...sansStyle.matchAll(/\b(?:alt|title)="([^"]*)"/gi)].map((m) => m[1]);
  const titre = (sansStyle.match(/<title>([\s\S]*?)<\/title>/i) || [])[1];
  const corps = sansStyle.replace(/<title>[\s\S]*?<\/title>/i, '').replace(/<br\s*\/?>/gi, '\n').replace(/<[^>]+>/g, '\n');
  const dec = (t) => t.replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
  return [corps, ...attributs, titre || ''].map(dec);
}

export function controlerRedaction(html, { sujet = '' } = {}) {
  const m = [];
  const textes = [...textesVisibles(html), sujet];
  for (const t of textes) {
    for (const ligne of t.split('\n')) {
      const l = ligne.trim();
      if (!l) continue;
      if (/[\u2014\u2013\u2015]|&mdash;|&ndash;/.test(l)) m.push(`tiret long dans « ${l.slice(0, 100)} »`);
      // Deux-points : seul admis entre deux chiffres (heure « 14:30 »).
      const sansHeures = l.replace(/\d:\d/g, '');
      if (sansHeures.includes(':')) m.push(`deux-points dans « ${l.slice(0, 100)} »`);
      if (/\bn\/d\b|\bundefined\b|\bNaN\b|\bnull\b|\{[A-Z_]+\}|\{\{(?!\s*unsubscribe)/.test(l)) m.push(`valeur manquante ou jeton non remplacé dans « ${l.slice(0, 100)} »`);
    }
  }
  return [...new Set(m)];
}

// ── LA PROSE DU MODÈLE ────────────────────────────────────────────────────────────
const nonVide = (t) => typeof t === 'string' && t.trim().length > 0;

export function controlerProse(p) {
  const m = [];
  if (!p || typeof p !== 'object') return ['prose du modèle absente ou illisible'];
  if (!nonVide(p.intro)) m.push('intro absente');
  const psy = [].concat(p.psychologie || []);
  if (!psy.length || !psy.every(nonVide)) m.push('psychologie du jour absente');
  if (!nonVide(p.vix_lecture)) m.push('lecture du VIX absente');
  if (!Array.isArray(p.agenda)) m.push('agenda absent (liste attendue, vide s\'il n\'y a rien)');
  else p.agenda.forEach((a, i) => {
    if (!/^\d\d:\d\d$/.test(a?.heure || '')) m.push(`agenda ligne ${i + 1} : heure « ${a?.heure} » (HH:MM attendu)`);
    if (![1, 2, 3].includes(a?.impact)) m.push(`agenda ligne ${i + 1} : impact « ${a?.impact} » (1, 2 ou 3 attendu)`);
    if (!DRAPEAUX[a?.pays]) m.push(`agenda ligne ${i + 1} : pays « ${a?.pays} » sans drapeau connu`);
    if (!nonVide(a?.theme)) m.push(`agenda ligne ${i + 1} : thème absent`);
  });
  if (p.ferie && !nonVide(p.ferie.titre)) m.push('jour férié sans titre');
  if (!Array.isArray(p.actualite) || !p.actualite.length) m.push('actualité absente');
  else p.actualite.forEach((a, i) => { if (!nonVide(a?.titre) || !nonVide(a?.texte)) m.push(`actualité ${i + 1} : sujet ou texte absent`); });
  if (!Array.isArray(p.retenir) || !p.retenir.length || !p.retenir.every(nonVide)) m.push('« Ce qu\'il faut retenir » absent');
  if (!p.culture || !nonVide(p.culture.titre) || !nonVide(p.culture.definition) || !nonVide(p.culture.usage)) m.push('culture de marché incomplète');
  // Preuve de recherche : sans adresses consultées, la prose a été écrite de mémoire
  // (mesuré le 26/11/2026 : décision de la Fed inventée un jour de Thanksgiving).
  const url = (u) => typeof u === 'string' && /^https?:\/\/[^\s]+\.[a-z]{2,}/i.test(u);
  const ag = Array.isArray(p.sources?.agenda) ? p.sources.agenda.filter(url) : [];
  const ac = Array.isArray(p.sources?.actualite) ? p.sources.actualite.filter(url) : [];
  if (!ag.some((u) => /forexfactory\.com/i.test(u)) || !ag.some((u) => /investing\.com/i.test(u))) m.push('sources de l\'agenda absentes (Forex Factory ET Investing.com exigés) : prose écrite sans recherche ?');
  if (ac.length < 3) m.push(`sources de l'actualité insuffisantes (${ac.length} adresse(s), 3 exigées) : prose écrite sans recherche ?`);
  return m;
}
