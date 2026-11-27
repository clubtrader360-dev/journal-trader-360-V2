// ========================================================================
// LE BRIEF MARCHÉ V22 : RENDU 100 % CODE (Manu, 26/11/2026).
//
// Référence visuelle OBLIGATOIRE : brief_reference_v22.html (mise à jour v26 du
// 26/11/2026, 16h05). Le mail envoyé doit être identique à ce fichier, bloc par bloc,
// au pixel près. Seul le contenu du jour change.
//
// ── QUI ÉCRIT QUOI ──────────────────────────────────────────────────────────────
// Le CODE écrit tout le HTML et TOUS les chiffres : les six lignes « Sur les marchés
// hier », les lignes ES et CFD, le VIX, les dates, l'agenda mis en forme.
// Le MODÈLE n'écrit que de la prose, rendue en JSON (voir le prompt système) : intro,
// psychologie, lecture du VIX, niveaux psychologiques, agenda (heure, impact, pays,
// thème), actualité, points à retenir, culture de marché.
// ⛔ Les styles ci-dessous sont COPIÉS de la référence. Un style « amélioré » ici casse
// le test outils/test-brief-v22.mjs, qui rend le contenu de la référence et le compare
// octet par octet au fichier de référence.
// ========================================================================
import { formatDateLongFr, capitaliser } from './date-fr.js';
import { blocPartenairesV22 } from './partenaires.js';
import { SANS, CHIFFRES } from './typo-brief.js';

export const BRIEF_V22 = true;

// Chiffres : pile à chasse fixe sans police web + chiffres tabulaires (voir typo-brief.js).
const ROUGE = '#c62828';
const VERT = '#067a4f';
const GRIS = '#7a6b50';

/** Échappe le texte de la prose du modèle (jamais de HTML venant du modèle). */
export function esc(t) {
  return String(t ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

/** 7182.78 → « 7&nbsp;182,78 ». Signe géré à part. */
export function nombreFr(v, decimales = 2) {
  const abs = Math.abs(v).toFixed(decimales);
  const [ent, dec] = abs.split('.');
  const groupes = ent.replace(/\B(?=(\d{3})+(?!\d))/g, '&nbsp;');
  return `${v < 0 ? '-' : ''}${groupes}${dec ? `,${dec}` : ''}`;
}
const signe = (v, d) => `${v > 0 ? '+' : v < 0 ? '-' : ''}${nombreFr(Math.abs(v), d)}`;

// ── « n/d » : SEULEMENT posé par le code, à l'échéance de 6h45 (Manu, 26/11/2026 21h) ──
// Une valeur que les sources n'ont toujours pas rendue à l'échéance part en « n/d »,
// jamais inventée. Le code l'écrit dans CE balisage, et seulement lui : la prose du
// modèle est échappée (`esc`), elle ne peut donc pas le produire. Le contrôle final
// (brief-garde.js, `controlerRedaction`) retire ce balisage avant de chercher un
// « n/d » : un « n/d » nu, venu d'ailleurs, reste refusé.
export const ND_HTML = '<span class="nd">n/d</span>';
const estNombre = (x) => typeof x === 'number' && Number.isFinite(x);
/** Nombre formaté, ou « n/d » balisé quand la valeur manque. */
export const nombreOuNd = (v, d = 2) => (estNombre(v) ? nombreFr(v, d) : ND_HTML);
/** Une ligne « hier » est-elle absente ? */
export const hierNd = (v) => !v || v.nd || !estNombre(v.cloture) || !estNombre(v.variation);

// ── Dates ─────────────────────────────────────────────────────────────────────────
const JOURS = ['dimanche', 'lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const jourSemaine = (iso) => JOURS[new Date(`${iso}T12:00:00Z`).getUTCDay()];
/** « 2026-11-25 » → « mercredi 25 novembre ». */
export function jourMoisFr(iso) {
  const d = new Date(`${iso}T12:00:00Z`);
  return `${JOURS[d.getUTCDay()]} ${d.getUTCDate()} ${MOIS[d.getUTCMonth()]}`;
}
const jjmm = (iso) => `${iso.slice(8, 10)}/${iso.slice(5, 7)}`;

/**
 * La note sous « Sur les marchés hier ». Une seule date si toutes les places ont la
 * même séance ; sinon chaque place avec SA séance (Manu, 26/11/2026) :
 * « *Cours de clôture du jeudi 26 novembre (Europe) et du mercredi 25 novembre
 * (États-Unis, fermés jeudi) sur chaque place. Bitcoin, … ».
 */
export function noteSeances(seances) {
  const fin = ' sur chaque place. Bitcoin, coté en continu, à minuit (heure UTC).';
  const { US, DE, FR } = seances;
  if (US === DE && DE === FR) return `*Cours de clôture du ${jourMoisFr(US)}${fin}`;
  const groupes = new Map();
  for (const [place, d] of [['US', US], ['DE', DE], ['FR', FR]]) groupes.set(d, [...(groupes.get(d) || []), place]);
  const dates = [...groupes.keys()].sort().reverse();
  const recente = dates[0];
  const nom = (places) => {
    const s = new Set(places);
    const noms = [];
    if (s.has('DE') && s.has('FR')) noms.push('Europe');
    else if (s.has('FR')) noms.push('France');
    else if (s.has('DE')) noms.push('Allemagne');
    if (s.has('US')) noms.push('États-Unis');
    return { texte: noms.join(' et '), pluriel: s.has('US') || noms.length > 1, feminin: !s.has('US') };
  };
  const parts = dates.map((d) => {
    const n = nom(groupes.get(d));
    if (d === recente) return `du ${jourMoisFr(d)} (${n.texte})`;
    const ferme = n.pluriel ? (n.feminin ? 'fermées' : 'fermés') : (n.feminin ? 'fermée' : 'fermé');
    return `du ${jourMoisFr(d)} (${n.texte}, ${ferme} ${jourSemaine(recente)})`;
  });
  return `*Cours de clôture ${parts.join(' et ')}${fin}`;
}

// ── Repères (drapeaux) ────────────────────────────────────────────────────────────
export const DRAPEAUX = {
  US: '🇺🇸', DE: '🇩🇪', FR: '🇫🇷', EU: '🇪🇺', GB: '🇬🇧', JP: '🇯🇵', CN: '🇨🇳', CH: '🇨🇭',
  CA: '🇨🇦', AU: '🇦🇺', NZ: '🇳🇿', IT: '🇮🇹', ES: '🇪🇸',
};
const caseDrapeau = (emoji) => `<span style="display:inline-block; width:18px; height:18px; line-height:18px; font-size:15px; text-align:center;">${emoji}</span>`;
const PASTILLE_BTC = '<span style="display:inline-block; width:18px; height:18px; line-height:18px; border-radius:9px; background:#F7931A; color:#ffffff; font-size:12px; font-weight:700; text-align:center; font-family:Arial,Helvetica,sans-serif;">₿</span>';

// ── Blocs ─────────────────────────────────────────────────────────────────────────
const paragraphes = (liste, style) => liste.map((t, i) =>
  `<p style="margin:0 0 ${i === liste.length - 1 ? '0px' : '10px'}; ${style}">${esc(t)}</p>`).join('');

function blocPsychologie(textes) {
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;"><tr><td class="b-carte" style="background:#f3e3ad; border:1px solid #d4af37; border-radius:10px; padding:18px 20px;">'
    + '<div style="color:#000B25; font-size:19px; letter-spacing:0.08em; text-transform:uppercase; font-weight:700; margin:0 0 10px;">🧠 La psychologie du jour</div>'
    + paragraphes(textes, 'font-size:16px; line-height:1.6; color:#000B25;')
    + '</td></tr></table>';
}

const LIGNES_HIER = [
  { cle: 'spx', nom: 'S&amp;P 500', repere: caseDrapeau('🇺🇸') },
  { cle: 'nasdaq', nom: 'Nasdaq', repere: caseDrapeau('🇺🇸') },
  { cle: 'dax', nom: 'DAX', repere: caseDrapeau('🇩🇪') },
  { cle: 'cac', nom: 'CAC 40', repere: caseDrapeau('🇫🇷') },
  { cle: 'oat', nom: 'OAT France 10 ans', repere: caseDrapeau('🇫🇷') },
  { cle: 'btc', nom: 'Bitcoin', repere: PASTILLE_BTC },
];

/** Valeur affichée d'une ligne (formats de la référence). */
export function valeurHier(cle, v) {
  if (hierNd(v)) return ND_HTML;
  if (cle === 'oat') return `${nombreFr(v.cloture, 2)} %`;
  if (cle === 'btc') return `${nombreFr(Math.round(v.cloture), 0)} $`;
  return nombreFr(v.cloture, 2);
}
export function variationHier(cle, v) {
  if (hierNd(v)) return ND_HTML;
  return cle === 'oat' ? `${signe(v.variation, 2)} pt` : `${signe(v.variation, 2)} %`;
}

function blocHier(hier) {
  const lignes = LIGNES_HIER.map((l, i) => {
    const v = hier[l.cle];
    const nd = hierNd(v);
    const hausse = !nd && v.variation >= 0;
    const couleur = nd ? GRIS : hausse ? VERT : ROUGE;
    const pad = i === 0 ? 'padding:9px 0;' : 'padding:9px 0;border-top:1px solid #eee7d6;';
    return `<tr><td width="6%" style="${pad} vertical-align:middle; color:${couleur}; font-size:14px; line-height:20px;">${nd ? '·' : hausse ? '▲' : '▼'}</td>`
      + `<td width="7%" style="${pad} vertical-align:middle; line-height:20px;">${l.repere}</td>`
      + `<td width="31%" class="b-nom" style="${pad} vertical-align:middle; font-size:16px; line-height:20px; font-weight:700; color:#000B25; white-space:nowrap;">${l.nom}</td>`
      + `<td width="29%" class="b-num-serre" style="${pad} vertical-align:middle; ${CHIFFRES} font-size:16px; line-height:20px; font-weight:700; color:#1a1208; white-space:nowrap;">${valeurHier(l.cle, v)}</td>`
      + `<td width="27%" align="right" style="${pad} vertical-align:middle; text-align:right;"><span class="b-pastille" style="display:inline-block; background:${nd ? '#ececec' : hausse ? '#d9f2dc' : '#f9d6d6'}; color:${couleur}; ${CHIFFRES} font-size:13px; line-height:18px; font-weight:700; border-radius:12px; white-space:nowrap; padding:3px 10px;">${variationHier(l.cle, v)}</span></td></tr>`;
  }).join('');
  const seances = { US: hier.spx.seance, DE: hier.dax.seance, FR: hier.cac.seance };
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;"><tr><td class="b-carte" style="background:#ffffff; border:1px solid rgba(212,175,55,0.55); border-radius:10px; padding:16px 20px 12px;">'
    + '<div style="color:#ac862b; font-size:19px; letter-spacing:0.08em; text-transform:uppercase; font-weight:700; margin:0 0 8px;">📈 Sur les marchés hier</div>'
    + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0">${lignes}</table>`
    + `<p style="margin:8px 0 0; font-size:13px; line-height:1.5; color:#7a6b50; font-style:italic;">${noteSeances(seances)}</p>`
    + '</td></tr></table>';
}

const LIGNES_ZONES = [
  { cle: 'cloture', libelle: 'Clôture', fond: '#fbe3c4' },
  { cle: 'poc', libelle: 'POC', fond: '#dbe7f5' },
  { cle: 'R2', libelle: 'Résistance 2' },
  { cle: 'R1', libelle: 'Résistance 1' },
  { cle: 'P', libelle: 'Pivot', fond: '#d5d6db' },
  { cle: 'S1', libelle: 'Support 1' },
  { cle: 'S2', libelle: 'Support 2' },
];

/**
 * zones = { es: {cloture, poc, R2, R1, P, S1, S2}, cfd: {cloture, R2, R1, P, S1, S2},
 *           psy: [nombres], vix: {cloture, seance}, vixLecture }
 */
function blocZones(z) {
  const lignes = LIGNES_ZONES.map((l) => {
    const fond = l.fond ? ` background:${l.fond};` : '';
    const lib = l.fond
      ? `<td style="padding:8px 6px 8px 10px; border-top:2px solid #ffffff;${fond} color:#000B25; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; font-weight:700; white-space:nowrap;">${l.libelle}</td>`
      : `<td style="padding:8px 6px 8px 10px; border-top:2px solid #ffffff; color:#5a5040; font-size:12px; letter-spacing:0.08em; text-transform:uppercase; white-space:nowrap;">${l.libelle}</td>`;
    const couleur = l.fond ? '#000B25' : '#1a1208';
    // POC : colonne CFD VIDE par conception (le POC est celui du future ES).
    const cfd = l.cle === 'poc' ? '' : nombreOuNd(z.cfd[l.cle], 2);
    return `<tr>${lib}`
      + `<td align="center" class="b-num" style="padding:7px 4px; border-top:2px solid #ffffff;${fond} text-align:center; ${CHIFFRES} font-size:16px; font-weight:700; color:${couleur}; white-space:nowrap;">${nombreOuNd(z.es[l.cle], 2)}</td>`
      + `<td align="center" class="b-num" style="padding:8px 10px 8px 4px; border-top:2px solid #ffffff;${fond} text-align:center; ${CHIFFRES} font-size:16px; font-weight:700; color:${couleur}; white-space:nowrap;">${cfd}</td></tr>`;
  }).join('');
  const psy = Array.isArray(z.psy) && z.psy.length ? z.psy.map((n) => nombreFr(n, 0)).join(' · ') : ND_HTML;
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;"><tr><td class="b-carte" style="background:#ffffff; border:1px solid rgba(212,175,55,0.55); border-radius:10px; padding:18px 20px;">'
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0">'
    + `<tr><td width="32%" class="b-empile b-empile-haut" style="color:#ac862b; font-size:19px; line-height:24px; letter-spacing:0.08em; text-transform:uppercase; font-weight:700; padding:0 0 10px; border-bottom:1px solid rgba(212,175,55,0.45); vertical-align:middle; white-space:nowrap;">${caseDrapeau('🇺🇸')}<span style="padding-left:8px;">S&amp;P 500</span></td>`
    + '<td width="68%" align="center" class="b-empile" style="padding:0 0 10px; border-bottom:1px solid rgba(212,175,55,0.45); vertical-align:middle; text-align:center;"><span style="display:inline-block; border:1px solid #d4af37; border-radius:18px; padding:5px 16px; color:#000B25; font-size:19px; line-height:24px; letter-spacing:0.08em; text-transform:uppercase; font-weight:700; white-space:nowrap;">Zones à surveiller</span></td></tr>'
    // Ligne de titre dans son PROPRE tableau : sur téléphone ses deux cellules s'empilent
    // (une ligne d'un tableau à trois colonnes ne le peut pas, les colonnes du dessous
    // gardent leur largeur). À 600 px, même rendu : 32 % / 68 % comme la grille.
    + '</table><table role="presentation" width="100%" cellspacing="0" cellpadding="0">'
    + '<tr><td colspan="3" style="height:12px; line-height:12px; font-size:0;">&nbsp;</td></tr>'
    + '<tr><td width="32%"></td><td width="34%" align="center" style="color:#ac862b; font-size:12px; letter-spacing:0.12em; font-weight:700; padding-bottom:6px;">ES</td><td width="34%" align="center" style="color:#ac862b; font-size:12px; letter-spacing:0.12em; font-weight:700; padding-bottom:6px;">CFD <span style="font-weight:400; letter-spacing:0.04em; text-transform:none;">(démo débutant)</span></td></tr>'
    + lignes
    + `<tr><td colspan="3" style="padding:12px 0 0;"><div style="color:#5a5040; font-size:12px; letter-spacing:0.08em; text-transform:uppercase;">Niveaux psychologiques</div><div style="${CHIFFRES} font-size:16px; font-weight:700; margin-top:5px;">${psy}</div></td></tr>`
    + '</table>'
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 0;"><tr><td style="border-top:1px solid rgba(212,175,55,0.45); padding:14px 0 0;">'
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;"><tr>'
    + `<td width="70%" style="color:#ac862b; font-size:19px; letter-spacing:0.08em; text-transform:uppercase; font-weight:700;">⚡ VIX <span style="font-size:13px; letter-spacing:0.04em; font-weight:400; color:#7a6b50; text-transform:none;">clôture ${jjmm(z.vix.seance)}</span></td>`
    + `<td width="30%" align="right" style="text-align:right; white-space:nowrap; ${CHIFFRES} font-size:24px; font-weight:700; color:#000B25;">${nombreOuNd(z.vix.cloture, 2)}</td>`
    + '</tr></table>'
    + (z.vixLecture ? `<p style="margin:8px 0 0; font-size:16px; line-height:1.6; color:#1a1208;">${esc(z.vixLecture)}</p>` : '')
    + '</td></tr></table>'
    + '<p style="margin:14px 0 0; font-size:13px; line-height:1.5; color:#7a6b50;">Sources Investing.com et Cboe.</p>'
    + '</td></tr></table>';
}

const pastilleTitre = (texte) => `<div style="margin:24px 0 12px;"><span style="display:inline-block; border:1px solid #d4af37; border-radius:18px; padding:5px 16px; color:#000B25; font-size:19px; line-height:24px; letter-spacing:0.08em; text-transform:uppercase; font-weight:700; white-space:nowrap;">${texte}</span></div>`;
const ESPACE = '<div style="height:16px;"></div>';

function blocAgenda(agenda, ferie) {
  const titre = pastilleTitre('📅 Agenda éco');
  const lignesFerie = ferie
    ? `<p style="margin:0 0 12px; font-size:16px; line-height:1.6; color:#1a1208;"><b>${esc(ferie.titre)}</b>${ferie.texte ? ` ${esc(ferie.texte)}` : ''}</p>`
    : '';
  // Brief de secours (données seules) : l'agenda n'a pas été vérifié, on le DIT. Jamais
  // « Pas d'événement macro aujourd'hui », qui serait une affirmation fausse.
  if (agenda === null) {
    return titre + lignesFerie
      + '<table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="background:#f4f4f6; border:1px solid #dcdce2; border-radius:8px; padding:8px 14px; font-size:16px; line-height:1.5; color:#5a5040;">Agenda indisponible ce matin. Consulte le calendrier économique avant l\'ouverture.</td></tr></table>'
      + ESPACE;
  }
  if (!agenda.length) {
    return titre + lignesFerie
      + '<table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="background:#f4f4f6; border:1px solid #dcdce2; border-radius:8px; padding:8px 14px; font-size:16px; line-height:1.5; color:#5a5040;">Pas d\'événement macro aujourd\'hui.</td></tr></table>'
      + ESPACE;
  }
  const lignes = agenda.map((a, i) => {
    const b = i === agenda.length - 1 ? ' ' : 'border-bottom:1px solid #eee6cf; ';
    return `<tr><td width="14%" style="${b}padding:10px 4px 10px 14px; ${CHIFFRES} font-feature-settings:'tnum' 1; font-size:16px; font-weight:700; color:#000B25; white-space:nowrap;">${esc(a.heure)}</td>`
      + `<td width="13%" style="${b}padding:10px 4px; font-size:14px; letter-spacing:1px; white-space:nowrap;"><span style="color:#d4af37;">${'★'.repeat(a.impact)}</span><span style="color:#d9d4c4;">${'★'.repeat(3 - a.impact)}</span></td>`
      + `<td width="6%" style="${b}padding:10px 4px; line-height:18px;">${caseDrapeau(DRAPEAUX[a.pays])}</td>`
      + `<td width="67%" style="${b}padding:10px 14px 10px 4px; font-size:16px; line-height:1.5; color:#1a1208;">${esc(a.theme)}</td></tr>`;
  }).join('');
  return titre + lignesFerie
    + `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #d4af37; border-radius:10px; border-collapse:separate;">${lignes}</table>`
    + '<p style="margin:8px 0 0; font-size:13px; line-height:1.5; color:#7a6b50;">Heures de Paris. ★★★ = impact fort sur le marché.</p>'
    + ESPACE;
}

function blocActualite(items) {
  return pastilleTitre('📰 Actualité éco')
    + items.map((it, i) => `<p style="margin:0 0 ${i === items.length - 1 ? '0px' : '10px'}; font-size:16px; line-height:1.6; color:#1a1208;"><b style="color:#000B25;">${esc(it.titre)}</b><br>${it.texteHtml ?? esc(it.texte)}</p>`).join('')
    + ESPACE;
}

function blocRetenir(points) {
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 16px;"><tr><td class="b-carte" style="background:#e7f0e4; border:1px solid rgba(0,11,37,0.15); border-radius:10px; padding:18px 20px;">'
    + '<div style="color:#000B25; font-size:19px; letter-spacing:0.08em; text-transform:uppercase; font-weight:700; margin:0 0 10px;">🧠 Ce qu\'il faut retenir</div>'
    + `<ul style="margin:0; padding-left:20px; font-size:16px; line-height:1.6;">${points.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`
    + '</td></tr></table>';
}

/** « Le range » → « Schéma du range » ; « La liquidité » → « Schéma de la liquidité ». */
export function altSchema(titre) {
  const t = String(titre).trim();
  const m = t.match(/^(le|la|les|l['’])\s*(.*)$/i);
  if (!m) return `Schéma ${t}`;
  const art = m[1].toLowerCase();
  const reste = m[2];
  if (art === 'le') return `Schéma du ${reste}`;
  if (art === 'les') return `Schéma des ${reste}`;
  if (art === 'la') return `Schéma de la ${reste}`;
  return `Schéma de l'${reste}`;
}

function blocCulture(c, urlSchema) {
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 16px;"><tr><td class="b-carte" style="background:#ffffff; border:1px solid rgba(212,175,55,0.55); border-radius:10px; padding:18px 20px;">'
    + '<div style="color:#ac862b; font-size:19px; letter-spacing:0.08em; text-transform:uppercase; font-weight:700; margin:0 0 10px;">📚 Culture de marché</div>'
    + `<div style="color:#000B25; font-size:18px; line-height:1.4; font-weight:700;">${esc(c.titre)}</div>`
    + `<p style="margin:8px 0 0; font-size:16px; line-height:1.6;">${esc(c.definition)}</p>`
    + `<p style="margin:10px 0 0; font-size:16px; line-height:1.6;">${esc(c.usage)}</p>`
    + `<img src="${urlSchema}" width="600" alt="${esc(altSchema(c.titre))}" style="display:block; width:100%; max-width:600px; height:auto; border:0; border-radius:8px; margin:14px 0 0;">`
    + '<p style="margin:12px 0 0; font-size:13px; line-height:1.5; color:#5a5040; font-style:italic;">Culture de marché, pour comprendre ce qu\'on croise ailleurs, dans une vidéo, sur un forum ou dans la bouche d\'un autre trader.</p>'
    + '</td></tr></table>';
}

/**
 * LE CORPS DU JOUR : de l'introduction à la culture de marché. Posté à l'endpoint dans
 * `<div class="brief-marche">` ; `rendreCourriel` le déballe et l'entoure du reste.
 */
export function rendreCorps({ hier, zones, prose, urlSchema }) {
  // Les blocs de prose absents (brief de secours, « données seules ») ne sont pas rendus.
  const psy = [].concat(prose.psychologie || []).filter(Boolean);
  return '<div class="brief-marche">'
    + `<p style="margin:0 0 10px; font-size:16px; line-height:1.6; color:#1a1208;">${esc(prose.intro)}</p>`
    + (psy.length ? blocPsychologie(psy) : '')
    + blocHier(hier)
    + blocZones({ ...zones, vixLecture: prose.vix_lecture })
    + blocAgenda(prose.agenda === null ? null : (prose.agenda || []), prose.ferie || null)
    + (prose.actualite?.length ? blocActualite(prose.actualite) : '')
    + (prose.retenir?.length ? blocRetenir(prose.retenir) : '')
    + (prose.culture ? blocCulture(prose.culture, urlSchema) : '')
    + '</div>';
}

// ── L'enveloppe : en-tête, salutation, partenaires, checklist, parrainage, pied ─────

// TÉLÉPHONE (≤ 480 px, Manu 27/11/2026) : marges resserrées, ligne de titre des zones
// empilée, chiffres à 14 px (zones) et 13 px (« Sur les marchés hier », le plus serré),
// jamais sous 13 px. Au-delà de 480 px, rien
// ne s'applique : le rendu ordinateur reste celui des styles en ligne. Les clients qui
// ignorent les media queries affichent la version ordinateur, mise à l'échelle.
export const STYLE_TELEPHONE = '@media only screen and (max-width:480px){'
  + '.b-page{padding:16px 6px !important;}'
  + '.b-main{padding:20px 14px !important;}'
  + '.b-carte{padding-left:12px !important;padding-right:12px !important;}'
  + '.b-num{font-size:14px !important;}'
  + '.b-num-serre{font-size:13px !important;padding-left:6px !important;}'
  + '.b-nom{white-space:normal !important;}'
  + '.b-pastille{padding:3px 7px !important;}'
  + '.b-empile{display:block !important;width:auto !important;text-align:center !important;}'
  + '.b-empile-haut{border-bottom:0 !important;padding-bottom:8px !important;}'
  + '}';

export const LIEN_PARRAINAGE = 'https://journaltrader360.fr/#parrainage';
// Même lien que l'encart prospects d'avant la v22 (lienCandidature('prospects', 'questionnaire')).
export const URL_QUESTIONNAIRE_PROSPECTS = 'https://www.trader360.fr/candidater/?utm_source=brief&amp;utm_medium=email&amp;utm_campaign=prospects&amp;utm_content=questionnaire';

// Icônes des réseaux : PNG or sur fond transparent, hébergés sur le site (Gmail
// n'affiche pas le SVG). `ICONES_ESSAI` = celles de la référence (icons8), pour l'essai
// uniquement, tant que les PNG ne sont pas en ligne (Manu, 26/11/2026 : en ligne au merge).
export const ICONES_SITE = {
  instagram: 'https://journaltrader360.fr/assets/reseaux/instagram-or.png',
  youtube: 'https://journaltrader360.fr/assets/reseaux/youtube-or.png',
  tiktok: 'https://journaltrader360.fr/assets/reseaux/tiktok-or.png',
  facebook: 'https://journaltrader360.fr/assets/reseaux/facebook-or.png',
};
export const ICONES_ESSAI = {
  instagram: 'https://img.icons8.com/ios-filled/50/d4af37/instagram-new.png',
  youtube: 'https://img.icons8.com/ios-filled/50/d4af37/youtube-play.png',
  tiktok: 'https://img.icons8.com/ios-filled/50/d4af37/tiktok.png',
  facebook: 'https://img.icons8.com/ios-filled/50/d4af37/facebook-new.png',
};
const RESEAUX = [
  ['instagram', 'https://www.instagram.com/trader360_officiel/', 'Instagram'],
  ['youtube', 'https://www.youtube.com/@ClubTrader360', 'YouTube'],
  ['tiktok', 'https://www.tiktok.com/@trader360_officiel', 'TikTok'],
  ['facebook', 'https://www.facebook.com/clubtrader360', 'Facebook'],
];

// PROSPECTS (Manu, 26/11/2026, référence outils/reference/brief_reference_prospects_v22.html,
// test Brevo validé) : checklist sur fond doré clair avec bouton journal verrouillé, puis
// encart bleu nuit « Tu veux en savoir plus ? » à la place du parrainage. Seul écart
// admis avec la référence : le bouton porte les UTM prospects du questionnaire actuel.
function blocChecklist(prospects) {
  if (prospects) {
    return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 0;"><tr><td align="center" class="b-carte" style="background:#fbf3dc; border:1px solid #d4af37; border-radius:10px; padding:20px 22px; text-align:center;">'
      + '<div style="color:#000B25; font-size:19px; letter-spacing:0.08em; text-transform:uppercase; font-weight:700;">✅ Checklist pré-séance</div>'
      + '<p style="margin:10px 0 0; font-size:16px; line-height:1.6; color:#000B25;">N\'oublie pas de remplir ta checklist pré-séance.<br>C\'est respecter la méthode Trader 360.</p>'
      + '<p style="margin:10px 0 0; font-size:16px; line-height:1.6; color:#ac862b; font-weight:700;">Commence par ouvrir ton journal, avant ta plateforme.</p>'
      + '<div style="margin-top:16px;"><span style="display:inline-block; border:1px solid rgba(0,11,37,0.25); color:#8a7d60; background:#fdf8ec; padding:12px 28px; border-radius:10px; font-weight:700; letter-spacing:0.04em;">🔒 Ouvrir mon journal</span></div>'
      + '<div style="margin-top:8px; color:#8a7d60; font-size:13px; font-style:italic;">Réservé aux membres Trader 360</div>'
      + '</td></tr></table>';
  }
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:8px 0 0;"><tr><td align="center" class="b-carte" style="background:#000B25; border-radius:10px; padding:20px 22px; text-align:center;">'
    + '<div style="color:#d4af37; font-size:19px; letter-spacing:0.08em; text-transform:uppercase; font-weight:700;">✅ Checklist pré-séance</div>'
    + '<p style="margin:10px 0 0; font-size:16px; line-height:1.6; color:#ffffff;">N\'oublie pas de remplir ta checklist pré-séance.<br>C\'est respecter la méthode Trader 360.</p>'
    + '<p style="margin:10px 0 0; font-size:16px; line-height:1.6; color:#d4af37; font-weight:700;">Commence par ouvrir ton journal, avant ta plateforme.</p>'
    + '<a href="https://journaltrader360.fr" style="display:inline-block; margin-top:16px; background:#d4af37; color:#000B25; padding:13px 30px; border-radius:10px; text-decoration:none; font-weight:700; letter-spacing:0.04em;">Ouvrir mon journal</a>'
    + '</td></tr></table>';
}

function blocParrainage(prospects) {
  if (prospects) {
    return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:16px 0 0;"><tr><td align="center" class="b-carte" style="background:#000B25; border-radius:12px; padding:30px 26px; text-align:center;">'
      + '<div style="color:#d4af37; font-size:26px; line-height:1.25; font-weight:800;">Tu veux en savoir plus ?</div>'
      + '<p style="margin:14px 0 0; font-size:16px; line-height:1.6; color:#ffffff;">Réponds au questionnaire de positionnement.<br>Tu accéderas ensuite à notre présentation et pourras prendre rendez-vous.</p>'
      + `<a href="${URL_QUESTIONNAIRE_PROSPECTS}" style="display:inline-block; margin-top:22px; background:#d4af37; color:#000B25; padding:16px 38px; border-radius:10px; text-decoration:none; font-size:16px; font-weight:800; letter-spacing:0.04em;">Répondre au questionnaire</a>`
      + '</td></tr></table>';
  }
  return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:14px 0 0;"><tr><td class="b-carte" style="background:#fbf3dc; border:1px solid #d4af37; border-left:4px solid #d4af37; border-radius:10px; padding:14px 18px;">'
    + '<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td valign="middle" style="padding-right:12px;">'
    + '<div style="color:#000B25; font-size:16px; letter-spacing:0.06em; text-transform:uppercase; font-weight:700; margin:0 0 6px;">🔗 Ton lien de parrainage</div>'
    + '<p style="margin:0; font-size:16px; line-height:1.5; color:#1a1208;">Tu connais quelqu\'un que le trading intéresse ? Partage-lui ton lien. Nous rémunérons la recommandation.</p>'
    + '</td><td valign="middle" align="right" style="white-space:nowrap;">'
    + `<a href="${LIEN_PARRAINAGE}" style="display:inline-block; border:1px solid #000B25; color:#000B25; padding:8px 14px; border-radius:8px; text-decoration:none; font-size:14px; font-weight:700; letter-spacing:0.03em;">Mon lien</a>`
    + '</td></tr></table></td></tr></table>';
}

function blocReseaux(icones) {
  return '<div style="text-align:center; margin-top:26px;"><div style="color:#ac862b; font-size:13px; letter-spacing:0.16em; text-transform:uppercase; font-weight:700; margin:0 0 10px;">Suis Trader 360</div>'
    + '<table role="presentation" align="center" cellspacing="0" cellpadding="0" style="margin:0 auto;"><tr>'
    + RESEAUX.map(([k, url, nom]) => `<td style="padding:0 7px;"><a href="${url}" style="display:inline-block; width:36px; height:36px; line-height:36px; border-radius:18px; background:#000B25; border:1px solid #d4af37; text-align:center; text-decoration:none;"><img src="${icones[k]}" width="22" height="22" alt="${nom}" style="display:inline-block; width:22px; height:22px; border:0; vertical-align:middle; margin-top:-2px;"></a></td>`).join('')
    + '</tr></table></div>';
}

export function sujetV22(dateLongFr) {
  return `📊 Brief marché · ${dateLongFr}`;
}

/**
 * Le courriel complet. `variant` : 'members' | 'prospects' | 'archive' (page du site :
 * ni lien de désinscription, ni pied « Suis Trader 360 », aucune adresse extérieure).
 */
export function rendreCourriel({ firstName, dateLongFr, corpsHtml, variant = 'members', icones = ICONES_SITE,
  enTete = 'https://journaltrader360.fr/assets/brief-header-v3.jpg', titre = true }) {
  const prospects = variant === 'prospects';
  const archive = variant === 'archive';
  const corps = String(corpsHtml).replace(/^\s*<div class="brief-marche">/, '').replace(/<\/div>\s*$/, '');
  const hi = firstName ? `Bonjour ${firstName},` : 'Bonjour,';
  const lignes = [
    '<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><style>:root{color-scheme:light only;supported-color-schemes:light only;}' + STYLE_TELEPHONE + '</style>'
      + (titre ? `<title>${esc(sujetV22(dateLongFr))}</title>` : '')
      + '</head><body style="margin:0; padding:0; background:#fdfaf3;"><div class="b-page" style="background:#fdfaf3; padding:30px 16px; font-family:' + SANS + '; font-size:16px; color:#1a1208;">',
    '<table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" style="width:100%; max-width:600px; margin:0 auto; background:#ffffff; border:1px solid #d4af37; border-radius:14px;">',
    `<tr><td style="padding:0; line-height:0; font-size:0;"><img src="${enTete}" width="600" alt="Trader 360 · Brief marché" style="display:block; width:100%; max-width:600px; height:auto; border:0; border-radius:14px 14px 0 0;"></td></tr>`,
    '<tr><td class="b-main" style="padding:32px;">',
    `<p style="text-align:center; color:#5a5040; font-style:italic; margin:0 0 20px; font-size:16px;">${capitaliser(dateLongFr)}</p>`,
    `<p style="font-size:16px; line-height:1.6; margin:0 0 16px;">${archive ? 'Bonjour,' : hi}</p>`
      + (archive ? '<div class="brief-marche">' : '')
      + corps
      + blocPartenairesV22()
      + blocChecklist(prospects)
      + (archive ? '' : blocParrainage(prospects))
      + (archive ? '</div>' : ''),
    (archive ? '' : blocReseaux(icones))
      + `<div style="text-align:center; margin-top:24px; padding-top:20px; border-top:1px solid rgba(212,175,55,0.30); color:#7a6b50; font-size:13px; line-height:1.5;">Trader 360 · brief du ${dateLongFr}<br><em>Le trading comporte des risques de perte en capital. Ce brief est informatif et ne constitue pas un conseil en investissement (AMF).</em></div>`,
    (archive ? '' : '<p style="text-align:center; font-size:12px; color:#7a6b50; margin:12px 0 0;"><a href="{{ unsubscribe }}" style="color:#7a6b50;">Se désinscrire</a></p>')
      + '</td></tr></table></div></body></html>',
  ];
  return lignes.join('\n');
}

export { formatDateLongFr };
