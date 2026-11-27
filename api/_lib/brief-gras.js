// ========================================================================
// PROSE SURVOLABLE (Manu, 27/11/2026) : paragraphes courts et gras ciblé, sur le
// modèle d'Aktionnaire (médiane 25 mots, une idée par paragraphe, un mot d'entrée en
// gras, une seule expression clé en gras, jamais une phrase entière).
//
// ⛔ UNE SEULE BALISE ADMISE DANS LA PROSE DU MODÈLE : <strong>…</strong>, sans
// attribut, ni imbriquée. Le rendu ÉCHAPPE TOUT, puis restaure seulement les paires
// exactes `&lt;strong&gt;…&lt;/strong&gt;` (liste d'autorisation réduite à un mot).
// Une balise orpheline est retirée ; toute autre balise reste échappée et le contrôle
// la refuse (une balise affichée en clair dans un mail est un défaut, pas un style).
// Paragraphes : un texte est une liste de paragraphes, ou une chaîne coupée aux
// retours à la ligne.
//
// ⛔ LES RÈGLES DE STYLE NE REFUSENT JAMAIS UN BRIEF. Un refus de la prose mène au brief
// « données seules ». Le gras en trop est donc retiré par le code (normaliserGras), et
// les longueurs sont MESURÉES et journalisées, pas sanctionnées.
// ========================================================================

const OUVRE = '<strong>';
const FERME = '</strong>';
const GRAS = /<strong>([\s\S]*?)<\/strong>/g;

/** Texte ou liste → liste de paragraphes non vides. */
export function paragraphesDe(t) {
  const liste = Array.isArray(t) ? t : [t];
  return liste.flatMap((x) => String(x ?? '').split(/\n+/)).map((x) => x.trim()).filter(Boolean);
}

/** Le texte sans aucune balise de gras (pour les contrôles de chiffres et la mesure). */
export const sansGras = (t) => String(t ?? '').replace(/<\/?strong>/g, '');

/** HTML déjà échappé → paires <strong> exactes restaurées, orphelines retirées. */
export function avecGras(htmlEchappe) {
  return String(htmlEchappe)
    .replace(/&lt;strong&gt;((?:(?!&lt;\/?strong&gt;)[\s\S])+?)&lt;\/strong&gt;/g, '<strong style="font-weight:700;">$1</strong>')
    .replace(/&lt;\/?strong&gt;/g, '');
}

const mots = (t) => sansGras(t).trim().split(/\s+/).filter(Boolean);
const phrases = (t) => sansGras(t).split(/(?<=[.!?…])\s+(?=[A-ZÀ-Ý«])/).filter((x) => x.trim());
const finEntree = /[.?!]$/;

/**
 * Un paragraphe → au plus un mot d'entrée en gras (en tête, terminé par « . », « ? »
 * ou « ! » ; un deux-points final devient un point) et au plus UNE expression clé de
 * 2 à 5 mots. Tout autre gras est retiré (le texte reste). Rend { texte, corrections }.
 */
export function normaliserGras(p) {
  const corrections = [];
  let texte = String(p);
  // Balises imbriquées ou orphelines : on garde le texte, on retire les balises.
  const ouv = texte.split(OUVRE).length - 1; const fer = texte.split(FERME).length - 1;
  if (ouv !== fer || /<strong>(?:(?!<\/strong>)[\s\S])*<strong>/.test(texte)) {
    corrections.push('gras mal formé retiré');
    return { texte: sansGras(texte), corrections };
  }
  let entree = false; let expression = false;
  texte = texte.replace(GRAS, (tout, inner, index) => {
    let c = inner.trim();
    const enTete = texte.slice(0, index).trim() === '';
    if (enTete && !entree) {
      if (/:$/.test(c)) { c = `${c.replace(/\s*:$/, '')}.`; corrections.push(`deux-points du mot d'entrée remplacé par un point (« ${c} »)`); }
      if (finEntree.test(c) && mots(c).length <= 6) { entree = true; return `${OUVRE}${c}${FERME}`; }
    }
    const n = mots(c).length;
    if (!expression && n >= 2 && n <= 5 && !finEntree.test(c)) { expression = true; return `${OUVRE}${c}${FERME}`; }
    corrections.push(`gras retiré sur « ${c.slice(0, 60)} » (${n} mot${n > 1 ? 's' : ''})`);
    return c;
  });
  // Mot d'entrée suivi de son texte : une espace entre les deux.
  texte = texte.replace(/<\/strong>(?=\S)/g, (m, i) => (/[.?!]$/.test(texte.slice(0, i)) ? `${FERME} ` : m));
  return { texte, corrections };
}

/** Mesures d'un ensemble de paragraphes (journal, pas de refus). */
export function mesurer(paras) {
  const n = paras.map((p) => mots(p).length).sort((a, b) => a - b);
  const med = n.length ? n[Math.floor((n.length - 1) / 2)] : 0;
  return {
    paragraphes: paras.length,
    medianeMots: med,
    maxMots: n.length ? n[n.length - 1] : 0,
    plusDe35: paras.filter((p) => mots(p).length > 35).length,
    plusDe2Phrases: paras.filter((p) => phrases(p).length > 2).length,
    avecGras: paras.filter((p) => p.includes(OUVRE)).length,
  };
}

/**
 * Toute la prose du modèle → paragraphes normalisés. Les champs de texte deviennent des
 * listes de paragraphes ; le gras est ramené aux règles, puis plafonné à 3 paragraphes
 * sur 4 (le gras des derniers paragraphes en trop est retiré, les mots d'entrée en
 * dernier). Rend { prose, corrections, mesures }.
 */
export function normaliserProse(prose) {
  const corrections = [];
  const tous = [];
  const norm = (t, ou) => paragraphesDe(t).map((p) => {
    const r = normaliserGras(p);
    corrections.push(...r.corrections.map((c) => `${ou} · ${c}`));
    const ref = { texte: r.texte, ou };
    tous.push(ref);
    return ref;
  });
  const P = {
    intro: norm(prose.intro, 'intro'),
    psychologie: norm(prose.psychologie, 'psychologie'),
    vix_lecture: norm(prose.vix_lecture, 'lecture du VIX'),
    actualite: (prose.actualite || []).map((a, i) => ({ ...a, texte: norm(a?.texte, `actualité ${i + 1}`) })),
    retenir: (prose.retenir || []).map((t, i) => {
      // Une puce = un paragraphe d'une phrase : pas de retour à la ligne.
      const r = normaliserGras(sansRetours(t)); corrections.push(...r.corrections.map((c) => `à retenir ${i + 1} · ${c}`));
      const ref = { texte: r.texte, ou: 'à retenir' }; tous.push(ref); return ref;
    }),
    culture: prose.culture ? { ...prose.culture, definition: norm(prose.culture.definition, 'culture'), usage: norm(prose.culture.usage, 'culture') } : prose.culture,
  };
  // Plafond : au plus 3 paragraphes sur 4 avec du gras.
  const plafond = Math.floor(tous.length * 0.75);
  let enTrop = tous.filter((r) => r.texte.includes(OUVRE)).length - plafond;
  for (const passe of ['expression', 'entree']) {
    for (let i = tous.length - 1; i >= 0 && enTrop > 0; i--) {
      const r = tous[i];
      if (!r.texte.includes(OUVRE)) continue;
      const aEntree = r.texte.trim().startsWith(OUVRE);
      if (passe === 'expression' && aEntree) continue;
      r.texte = sansGras(r.texte); enTrop--;
      corrections.push(`${r.ou} · gras retiré (plus de 3 paragraphes sur 4 en gras)`);
    }
  }
  const t = (l) => l.map((r) => r.texte);
  const sortie = {
    ...prose,
    intro: t(P.intro), psychologie: t(P.psychologie), vix_lecture: t(P.vix_lecture),
    actualite: P.actualite.map((a) => ({ ...a, texte: t(a.texte) })),
    retenir: P.retenir.map((r) => r.texte),
    culture: P.culture ? { ...P.culture, definition: t(P.culture.definition), usage: t(P.culture.usage) } : P.culture,
  };
  return { prose: sortie, corrections, mesures: mesurer(tous.map((r) => r.texte)) };
}
const sansRetours = (t) => String(t ?? '').replace(/\s*\n+\s*/g, ' ').trim();

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

/** Balise HTML affichée en clair dans le texte visible (hors <strong> rendu). */
export const BALISE_VISIBLE = /<\/?[a-z][a-z0-9]*(?:\s[^<>]*)?>/i;
