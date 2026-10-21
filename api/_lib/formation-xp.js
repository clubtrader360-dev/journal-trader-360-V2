// ========================================
// XP de formation par membre, calculé côté serveur pour le tableur de Manu.
//
// ⛔ LE TOTAL D'XP N'EST STOCKÉ NULLE PART. `public.gamification_state` existe mais est vide
// (relevé du 21/10/2026) : l'espace formation le recalcule à l'affichage, dans `xpTotal()` de
// `supabase-formation.js`, à partir de `formation_progression` et `formation_quiz_resultats`.
// Ce module reproduit `xpTotal()` À L'IDENTIQUE. S'il diverge, le tableur affiche un autre
// chiffre que l'écran de l'élève, sans aucune erreur.
//
// ⛔ LA STRUCTURE N'EST PAS RECOPIÉE. Les trois fichiers servis au navigateur
// (`formation-donnees.js`, `formation-quiz.js`, `formation-certification.js`) sont évalués
// ici comme dans `api/cron/weekly-report.js` : un module ajouté côté formation est compté
// ici au déploiement suivant.
//
// Règles reproduites (arbitrage Nadir du 14/10) :
//   - chaque module vaut 100 XP répartis entre ses chapitres, quiz compris (`partsXp`) ;
//   - un chapitre vidéo compte quand `formation_progression.vue` est vrai, un quiz quand il
//     existe une ligne `reussi` dans `formation_quiz_resultats` pour sa clé de module ;
//   - +250 par module terminé, 1000 à la place pour le module de certification ;
//   - l'Introduction et le module bonus rapportent zéro.
// ========================================

import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const XP_MODULE = 100;
const XP_MOD = 250;
const XP_CERT = 1000;
const FICHIERS = ['formation-donnees.js', 'formation-quiz.js', 'formation-certification.js'];

let _mods = null;
let _D = null;

// Évalue les fichiers du navigateur dans un bac à sable dont `window` et `globalThis` sont le
// même objet, puis reconstruit `mods()` comme `supabase-formation.js` (quiz et examen ajoutés
// en fin de module).
export function modulesFormation() {
  if (_mods) return _mods;
  const ici = path.dirname(fileURLToPath(import.meta.url));
  const bac = {};
  bac.window = bac;
  bac.globalThis = bac;
  for (const f of FICHIERS) {
    const source = readFileSync(path.join(ici, '../../assets', f), 'utf8');
    // eslint-disable-next-line no-new-func
    new Function('window', 'globalThis', source)(bac, bac);
  }
  const D = bac.FormationDonnees;
  _D = D;
  if (!D || !Array.isArray(D.MODULES) || !D.MODULES.length) {
    throw new Error('structure de formation illisible (FormationDonnees.MODULES absent)');
  }
  const Q = bac.FORMATION_QUIZ || {};
  const C = bac.FORMATION_CERTIFICATION || null;
  _mods = D.MODULES.map((m) => {
    if (m.certification && C && C.questions && C.questions.length) {
      return { ...m, lecons: [...m.lecons, { id: `m${m.cle}-quiz`, quiz: true }] };
    }
    const q = Q[m.cle];
    if (!q || !q.questions || !q.questions.length) return m;
    return { ...m, lecons: [...m.lecons, { id: `m${m.cle}-quiz`, quiz: true }] };
  });
  return _mods;
}

// Copie conforme de `partsXp` : part entière, unités restantes aux premiers chapitres.
export function partsXp(nbChapitres) {
  if (!nbChapitres) return [];
  const base = Math.floor(XP_MODULE / nbChapitres);
  const reste = XP_MODULE - base * nbChapitres;
  return Array.from({ length: nbChapitres }, (_, i) => base + (i < reste ? 1 : 0));
}

// `vues` = Set des lecon_id vus, `quizReussis` = Set des module_cle réussis.
export function xpTotal(vues, quizReussis) {
  const estVue = (id) => (/-quiz$/.test(String(id))
    ? quizReussis.has(String(id).replace(/^m/, '').replace(/-quiz$/, ''))
    : vues.has(id));
  const mods = modulesFormation();
  let x = 0;
  mods.forEach((m) => {
    const parts = partsXp(m.lecons.length);
    m.lecons.forEach((l, i) => { if (estVue(l.id) && !m.introduction && !m.bonus) x += parts[i]; });
  });
  mods.forEach((m) => {
    // ⛔ Plus de copie de la règle : celle de formation-donnees.js, comme l'écran de l'élève (21/10).
    const fini = _D.moduleTermine(m, estVue, (cle) => quizReussis.has(cle));
    if (fini && !m.introduction && !m.bonus) x += m.certification ? XP_CERT : XP_MOD;
  });
  return x;
}

// Détail par module, pour la fiche membre du back-office (demande de Nadir du 21/10).
// ⛔ Même règle que `xpTotal` ci-dessus, module par module : le banc
// `outils/formation-xp-detail-banc.mjs` prouve que la somme des parts rend `xpTotal` à
// l'unité, sur des parcours tirés au hasard. Si l'un change sans l'autre, il échoue.
export function xpDetail(vues, quizReussis) {
  const estVue = (id) => (/-quiz$/.test(String(id))
    ? quizReussis.has(String(id).replace(/^m/, '').replace(/-quiz$/, ''))
    : vues.has(id));
  const modules = [];
  let total = 0;
  for (const m of modulesFormation()) {
    const compte = !m.introduction && !m.bonus;
    const parts = partsXp(m.lecons.length);
    let xp = 0;
    m.lecons.forEach((l, i) => { if (compte && estVue(l.id)) xp += parts[i]; });
    const fini = _D.moduleTermine(m, estVue, (cle) => quizReussis.has(cle));
    const prime = fini && compte ? (m.certification ? XP_CERT : XP_MOD) : 0;
    const max = compte && m.lecons.length ? XP_MODULE + (m.certification ? XP_CERT : XP_MOD) : 0;
    total += xp + prime;
    modules.push({ cle: m.cle, numero: m.numero, titre: m.titre || '', xp: xp + prime, max, fini: !!fini, compte });
  }
  return { total, modules };
}

// Les chapitres vus et les quiz réussis de CHAQUE compte, lus par pages.
// @returns {Promise<Map<string, { vues: Set<string>, quiz: Set<string> }>>} par user_id
export async function parcoursParUtilisateur(sb) {
  const [prog, quiz] = await Promise.all([
    toutLire(() => sb.from('formation_progression').select('user_id, lecon_id').eq('vue', true).order('user_id').order('lecon_id')),
    toutLire(() => sb.from('formation_quiz_resultats').select('user_id, module_cle').eq('reussi', true).order('user_id').order('module_cle')),
  ]);
  const out = new Map();
  const de = (u) => { if (!out.has(u)) out.set(u, { vues: new Set(), quiz: new Set() }); return out.get(u); };
  prog.forEach((r) => de(r.user_id).vues.add(r.lecon_id));
  quiz.forEach((r) => de(r.user_id).quiz.add(String(r.module_cle)));
  return out;
}

// Maximum atteignable, calculé comme `xpMaximum()` de l'espace formation : 100 par module
// compté (intro et bonus exclus) + 250 par module terminé, 1000 pour la certification.
export function xpMaximum() {
  let max = 0;
  for (const m of modulesFormation()) {
    if (m.introduction || m.bonus || !m.lecons.length) continue;
    max += XP_MODULE + (m.certification ? XP_CERT : XP_MOD);
  }
  return max;
}

// Lit toutes les lignes d'une requête PostgREST, par pages de 1000 (plafond Supabase).
async function toutLire(construire) {
  const out = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await construire().range(from, from + 999);
    if (error) throw error;
    out.push(...(data || []));
    if (!data || data.length < 1000) return out;
  }
}

// Pour chaque compte (email en minuscules) : { xp, lastSignIn }.
// `lastSignIn` = auth.users.last_sign_in_at, la même source que `api/coach/membres.js`
// (journal et formation partagent la même authentification).
export async function xpParEmail(sb) {
  const comptes = [];
  for (let page = 1; ; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const lot = (data && data.users) || [];
    comptes.push(...lot);
    if (lot.length < 1000) break;
  }
  const [prog, quiz] = await Promise.all([
    toutLire(() => sb.from('formation_progression').select('user_id, lecon_id').eq('vue', true).order('user_id').order('lecon_id')),
    toutLire(() => sb.from('formation_quiz_resultats').select('user_id, module_cle').eq('reussi', true).order('user_id').order('module_cle')),
  ]);
  const vues = new Map();
  prog.forEach((r) => { if (!vues.has(r.user_id)) vues.set(r.user_id, new Set()); vues.get(r.user_id).add(r.lecon_id); });
  const quizOk = new Map();
  quiz.forEach((r) => { if (!quizOk.has(r.user_id)) quizOk.set(r.user_id, new Set()); quizOk.get(r.user_id).add(String(r.module_cle)); });

  const parEmail = new Map();
  for (const c of comptes) {
    if (!c.email) continue;
    parEmail.set(String(c.email).trim().toLowerCase(), {
      xp: xpTotal(vues.get(c.id) || new Set(), quizOk.get(c.id) || new Set()),
      lastSignIn: c.last_sign_in_at || null,
    });
  }
  return parEmail;
}

// 'JJ/MM/AAAA' au jour de Paris, '' sans connexion.
export function dateParis(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('fr-FR', { timeZone: 'Europe/Paris', day: '2-digit', month: '2-digit', year: 'numeric' });
}
