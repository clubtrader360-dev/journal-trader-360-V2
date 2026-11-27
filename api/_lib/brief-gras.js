// ========================================================================
// PROSE SURVOLABLE (Manu, 27/11/2026) : paragraphes courts (1 à 2 phrases, 35 mots au
// plus, une idée par paragraphe), sur le modèle d'Aktionnaire (médiane 25 mots).
//
// ⛔ AUCUN GRAS DANS LA PROSE GÉNÉRÉE (décision d'Emmanuel après les tests « gras » v1
// et v2) : ni en début ni au milieu des paragraphes. Les titres et les éléments du
// gabarit restent en gras (<b>, font-weight) : eux ne viennent pas du modèle.
// - le prompt interdit toute balise HTML ;
// - le code RETIRE toute balise <strong> de la prose avant les contrôles (journalisé),
//   pour qu'un écart de style ne déclenche jamais le brief « données seules » ;
// - le contrôle final (controlerSansGras, brief-garde.js) refuse tout <strong> dans le
//   courriel, en filet de sécurité ; toute autre balise reste échappée au rendu.
// Paragraphes : un texte est une liste de paragraphes, ou une chaîne coupée aux retours
// à la ligne. Les longueurs sont MESURÉES et journalisées, jamais sanctionnées.
// ========================================================================

const BALISE_GRAS = /<\s*\/?\s*strong\b[^>]*>/gi;

/** Texte ou liste → liste de paragraphes non vides. */
export function paragraphesDe(t) {
  const liste = Array.isArray(t) ? t : [t];
  return liste.flatMap((x) => String(x ?? '').split(/\n+/)).map((x) => x.trim()).filter(Boolean);
}

/** Le texte sans aucune balise <strong> (le texte qu'elles entouraient reste). */
export const sansGras = (t) => String(t ?? '').replace(BALISE_GRAS, '');

const mots = (t) => String(t).trim().split(/\s+/).filter(Boolean);
const phrases = (t) => String(t).split(/(?<=[.!?…])\s+(?=[A-ZÀ-Ý«])/).filter((x) => x.trim());

/** Mesures d'un ensemble de paragraphes (journal, pas de refus). */
export function mesurer(paras) {
  const n = paras.map((p) => mots(p).length).sort((a, b) => a - b);
  return {
    paragraphes: paras.length,
    medianeMots: n.length ? n[Math.floor((n.length - 1) / 2)] : 0,
    maxMots: n.length ? n[n.length - 1] : 0,
    plusDe35: paras.filter((p) => mots(p).length > 35).length,
    plusDe2Phrases: paras.filter((p) => phrases(p).length > 2).length,
  };
}

// UN SEUL « BONJOUR » (Manu, 27/11/2026) : le gabarit affiche « Bonjour Trader, ». Une
// salutation en tête de l'intro (« Bonjour à toi. », « Salut, … ») est retirée par le
// code ; controlerProse refuse celle qui resterait.
export const SALUTATION = /^(?:bonjour|bonsoir|salut|hello|coucou|hey)\b/i;
const SALUTATION_SEULE = /^(?:bonjour|bonsoir|salut|hello|coucou|hey)\b[^.!?,;]{0,30}[.!?,;]\s*/i;
export function sansSalutation(intro) {
  const l = [...intro];
  if (l.length && SALUTATION_SEULE.test(l[0])) {
    const reste = l[0].replace(SALUTATION_SEULE, '').trim();
    if (reste) l[0] = reste.charAt(0).toUpperCase() + reste.slice(1); else l.shift();
    return { intro: l, retiree: true };
  }
  return { intro: l, retiree: false };
}

/** Toute la prose du modèle → listes de paragraphes, sans aucun gras. Rend { prose, corrections, mesures }. */
export function normaliserProse(prose) {
  const corrections = [];
  const tous = [];
  const nettoyer = (p, ou) => {
    const propre = sansGras(p);
    if (propre !== p) corrections.push(`${ou} · gras retiré (aucun gras dans la prose)`);
    tous.push(propre);
    return propre;
  };
  const norm = (t, ou) => paragraphesDe(t).map((p) => nettoyer(p, ou));
  const salut = sansSalutation(paragraphesDe(prose.intro));
  if (salut.retiree) corrections.push('intro · salutation d\'ouverture retirée (le gabarit dit déjà « Bonjour »)');
  const sortie = {
    ...prose,
    intro: norm(salut.intro, 'intro'),
    psychologie: norm(prose.psychologie, 'psychologie'),
    vix_lecture: norm(prose.vix_lecture, 'lecture du VIX'),
    actualite: (prose.actualite || []).map((a, i) => ({ ...a, texte: norm(a?.texte, `actualité ${i + 1}`) })),
    // Une puce = une phrase : pas de retour à la ligne.
    retenir: (prose.retenir || []).map((t, i) => nettoyer(String(t ?? '').replace(/\s*\n+\s*/g, ' ').trim(), `à retenir ${i + 1}`)),
    culture: prose.culture
      ? { ...prose.culture, definition: norm(prose.culture.definition, 'culture'), usage: norm(prose.culture.usage, 'culture') }
      : prose.culture,
  };
  return { prose: sortie, corrections, mesures: mesurer(tous) };
}

/** Vue « chaînes » de la prose normalisée, pour les contrôles de présence existants. */
export function aplatirProse(p) {
  const j = (l) => (Array.isArray(l) ? l.join('\n') : l);
  return {
    ...p,
    intro: j(p.intro), vix_lecture: j(p.vix_lecture),
    actualite: (p.actualite || []).map((a) => ({ ...a, texte: j(a.texte) })),
    culture: p.culture ? { ...p.culture, definition: j(p.culture.definition), usage: j(p.culture.usage) } : p.culture,
  };
}
