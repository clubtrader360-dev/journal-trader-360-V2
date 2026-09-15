// ========================================================================
// Culture de marché — la notion du jour.
//
// LISTE FERMÉE, ROTATION DÉTERMINISTE. Sans liste, le modèle revient sur le RSI tous
// les trois jours et finit par inventer des concepts. Sans rotation calculée, deux
// briefs consécutifs peuvent tomber sur la même notion, et personne ne s'en aperçoit
// avant les destinataires.
//
// ⚠️ UNE SEULE SOURCE DE VÉRITÉ. Cette fonction est appelée à DEUX endroits :
//   - le workflow, qui injecte la notion et l'URL de son schéma dans le prompt ;
//   - l'endpoint, qui journalise la notion et vérifie que le HTML reçu porte bien
//     l'image correspondante.
// Recopier la rotation d'un côté ou de l'autre ferait diverger le texte et l'image,
// et le brief publierait une définition du MACD sous un schéma de RSI.
//
// Le critère de sélection est le même pour les vingt : un élève peut-il croiser ce
// terme sur un forum, dans une vidéo, ou dans la bouche d'un autre trader ? Un concept
// obscur encombre la rubrique sans rien apprendre.
// ========================================================================

/**
 * Les vingt notions, dans l'ordre de rotation.
 *
 * `slug` sert au nom de fichier du schéma : `assets/culture/<slug>.png`.
 * `nom` est le titre affiché, tel que le lecteur le croisera ailleurs.
 * `angle` est ce sur quoi la définition doit porter — il borne le sujet pour que deux
 * runs différents ne produisent pas deux briefs qui parlent d'autre chose.
 */
export const NOTIONS = [
  { slug: 'rsi', nom: 'RSI', angle: 'oscillateur de force relative, ses seuils 30 et 70' },
  { slug: 'macd', nom: 'MACD', angle: 'convergence-divergence de deux moyennes mobiles, la ligne de signal' },
  { slug: 'moyenne-mobile', nom: 'Moyenne mobile', angle: 'lissage du prix, simple contre exponentielle' },
  { slug: 'support-resistance', nom: 'Support et résistance', angle: 'niveaux où le prix a déjà réagi plusieurs fois' },
  { slug: 'break-of-structure', nom: 'Break of structure', angle: 'rupture d’un dernier sommet ou creux, lecture de tendance' },
  { slug: 'chandelier-japonais', nom: 'Chandelier japonais', angle: 'corps, mèches, ce que chaque bougie résume' },
  { slug: 'volume', nom: 'Volume', angle: 'nombre de contrats échangés, ce qu’il dit de la participation' },
  { slug: 'gap', nom: 'Gap', angle: 'écart entre deux séances, ouverture décalée' },
  { slug: 'tendance', nom: 'Tendance', angle: 'sommets et creux ascendants ou descendants' },
  { slug: 'range', nom: 'Range', angle: 'marché borné entre deux niveaux, absence de direction' },
  { slug: 'bandes-de-bollinger', nom: 'Bandes de Bollinger', angle: 'enveloppe d’écarts-types autour d’une moyenne mobile' },
  { slug: 'atr', nom: 'ATR', angle: 'amplitude moyenne d’une séance, mesure de volatilité' },
  { slug: 'fibonacci', nom: 'Retracement de Fibonacci', angle: 'les niveaux 38,2 %, 50 % et 61,8 % d’un mouvement' },
  { slug: 'divergence', nom: 'Divergence', angle: 'prix et oscillateur qui ne racontent pas la même chose' },
  { slug: 'pullback', nom: 'Pullback', angle: 'repli temporaire dans le sens contraire de la tendance' },
  { slug: 'double-sommet', nom: 'Double sommet et double creux', angle: 'figure en deux tentatives sur le même niveau' },
  { slug: 'triangle', nom: 'Triangle', angle: 'compression entre deux droites qui convergent' },
  { slug: 'vwap', nom: 'VWAP', angle: 'prix moyen pondéré par les volumes sur la séance' },
  { slug: 'order-block', nom: 'Order block', angle: 'zone d’où un mouvement est parti, vocabulaire du price action moderne' },
  { slug: 'liquidite', nom: 'Liquidité', angle: 'là où s’accumulent les ordres en attente, sous un creux ou au-dessus d’un sommet' },
];

/**
 * Les schémas RÉELLEMENT dessinés. Tant qu'une notion n'y figure pas, la rotation la
 * saute : mieux vaut un brief sans rubrique culture qu'une rubrique avec une image
 * manquante. La liste grandit au fur et à mesure que les schémas sont produits.
 */
export const SCHEMAS_DISPONIBLES = new Set([
  // Lot initial, validé.
  'rsi', 'macd', 'support-resistance',
  // Lot 1 : cinq notions de plus, mêmes règles de série.
  'moyenne-mobile', 'break-of-structure', 'chandelier-japonais', 'volume', 'gap',
]);

/** Base publique des schémas. Le brief part en campagne Brevo : l'image est une URL. */
export const BASE_SCHEMAS = 'https://journaltrader360.fr/assets/culture';

/**
 * Nombre de jours écoulés depuis une origine fixe, en UTC.
 *
 * L'origine est arbitraire mais FIXE : ce qui compte est que deux appels le même jour
 * rendent le même rang, et que deux jours consécutifs en rendent deux différents.
 * Le calcul passe par `Date.UTC` et non par un objet local : sur un runner en UTC et
 * une fonction Vercel en UTC, une arithmétique en heure locale donnerait le même
 * résultat aujourd'hui et un décalage d'un jour le jour du changement d'heure.
 */
function rangDepuisOrigine(dateIso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(dateIso || ''));
  if (!m) throw new Error(`culture-marche : date ISO attendue (AAAA-MM-JJ), reçu « ${dateIso} »`);
  const jour = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const origine = Date.UTC(2026, 0, 1);
  return Math.floor((jour - origine) / 86400000);
}

/**
 * La notion du jour.
 *
 * ⚠️ LA ROTATION PORTE SUR LES NOTIONS DONT LE SCHÉMA EXISTE, pas sur la liste
 * entière. Ce n'est pas le choix évident, et voici pourquoi c'est le bon.
 *
 * Faire tourner sur les vingt aurait un avantage : ajouter un schéma ne décalerait pas
 * le calendrier. Mais tant que la bibliothèque est incomplète, ça fait SAUTER la
 * rubrique tous les jours où la notion tirée n'a pas d'image — avec trois schémas sur
 * vingt, dix-sept jours sur vingt. Une rubrique qui n'apparaît qu'une fois par mois
 * n'existe pas.
 *
 * En tournant sur les disponibles, la rubrique part tous les jours dès le premier
 * schéma, et la règle se dissout d'elle-même : quand les vingt seront dessinés, les
 * disponibles SERONT la liste entière. Le prix à payer est qu'ajouter un schéma décale
 * l'ordre — sans conséquence tant que rien n'est établi.
 *
 * Rend `null` si aucun schéma n'existe : la rubrique saute, elle ne part jamais avec
 * une image manquante.
 */
export function notionDuJour(dateIso) {
  const rang = rangDepuisOrigine(dateIso);
  const disponibles = NOTIONS.filter((n) => SCHEMAS_DISPONIBLES.has(n.slug));
  if (disponibles.length === 0) return null;

  const index = ((rang % disponibles.length) + disponibles.length) % disponibles.length;
  const notion = disponibles[index];
  return {
    ...notion,
    index,
    // Le rang affiché est celui de la ROTATION EN COURS, pas la place dans la liste
    // des vingt : c'est lui qui permet de vérifier qu'on ne repasse pas deux fois sur
    // la même notion en trois jours.
    rang: `${index + 1}/${disponibles.length}`,
    rangCatalogue: `${NOTIONS.findIndex((n) => n.slug === notion.slug) + 1}/${NOTIONS.length}`,
    disponible: true,
    urlSchema: `${BASE_SCHEMAS}/${notion.slug}.png`,
  };
}
