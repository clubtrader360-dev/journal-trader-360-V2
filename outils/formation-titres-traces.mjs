/**
 * ⛔ LES TITRES QUI PORTENT UNE TRACE DE NOM DE FICHIER.
 *
 * ── ⚠️ CE QUE CETTE SONDE FAIT, ET CE QU'ELLE NE FAIT PAS ──────────────────
 *
 * Elle RELÈVE, elle ne corrige rien. ⛔ Les titres se corrigent DANS VIMEO, qui
 * est la source unique : l'import les reprendra. Les corriger ici créerait une
 * seconde vérité, et c'est la vérité d'ici qui serait écrasée au prochain import.
 *
 * ── ⛔ LE SIGNAL, ET POURQUOI IL A FALLU L'AFFINER TROIS FOIS ──────────────
 *
 *   1. Chercher des extensions, tirets bas et suffixes de version : ZÉRO trouvé.
 *      ⚠️ Et c'était juste : aucun titre n'en porte. Mais le défaut connu,
 *      « Créer ta routine mentale se préparer mentalement », passait aussi.
 *   2. Chercher le titre du MODULE recopié dans le titre du chapitre : sept
 *      trouvés, dont cinq légitimes. ⛔ Un chapitre d'introduction reprend
 *      normalement le titre de son module, c'est son rôle.
 *   3. Le signal juste est le titre du module COLLÉ EN FIN d'un titre qui a déjà
 *      son propre sujet. ⚠️ C'est la signature d'un nom de fichier d'export, où
 *      le monteur accole le dossier au nom de la vidéo.
 *
 * ⛔ Le discriminant est donc : le titre du chapitre VAUT-IL à peu près celui du
 * module ? Alors c'est l'introduction, et on le laisse. Sinon, c'est une trace.
 *
 * Usage : node outils/formation-titres-traces.mjs
 */
import { readFileSync } from 'node:fs';

let fautes = 0;
const dire = (nom, ok, detail) => {
  if (!ok) fautes += 1;
  console.log(`     ${ok ? 'ok ' : '⛔ '} ${nom}${detail ? `  ${detail}` : ''}`);
};

const src = readFileSync('assets/formation-donnees.js', 'utf8');

/** Les titres des dix modules. */
const modules = {};
for (const m of src.matchAll(/\{\s*numero:\s*'(\d\d)',\s*titre:\s*'((?:[^'\\]|\\.)*)'/g)) {
  modules[m[1]] = m[2];
}

/** Les chapitres, module par module. */
const chapitres = [];
for (const bloc of src.matchAll(/'(\d\d)'\s*:\s*\[([\s\S]*?)\n\s*\]/g)) {
  for (const c of bloc[2].matchAll(/\{\s*id:\s*'([^']*)',\s*titre:\s*"((?:[^"\\]|\\.)*)"/g)) {
    chapitres.push({ module: bloc[1], id: c[1], titre: c[2].replace(/\\"/g, '"') });
  }
}

/** Les mots significatifs, sans accents ni casse. */
const mots = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
  .match(/[a-z0-9]+/g)?.filter((m) => m.length > 2) ?? [];

/** Part de mots du module présents dans le titre du chapitre. */
const recouvrement = (titre, titreModule) => {
  const a = mots(titre); const b = mots(titreModule);
  if (!b.length) return 0;
  return b.filter((m) => a.includes(m)).length / b.length;
};

function traces(ch) {
  const r = [];
  const t = ch.titre;
  if (/\.(mp4|mov|avi|m4v)\b/i.test(t)) r.push('extension de fichier');
  if (t.includes('_')) r.push('tiret bas');
  if (/\s{2,}/.test(t)) r.push('espaces multiples');
  if (/\bcopie\b|\bfinal\b|\bV\d\b|\bbis\b/i.test(t)) r.push('suffixe de version');
  if (/^\d+[-_. ]/.test(t)) r.push('numérotation en tête');

  const titreModule = modules[ch.module] ?? '';
  /**
   * ⛔ LE DISCRIMINANT. Un chapitre d'introduction recouvre LARGEMENT le titre
   * de son module : c'est son rôle, et ce n'est pas une trace. ⚠️ Au-delà de
   * 70 %, on considère que le chapitre EST l'introduction du module.
   */
  const introDuModule = recouvrement(t, titreModule) > 0.7;
  if (!introDuModule) {
    const mt = mots(titreModule); const mc = mots(t);
    for (let n = 0; n + 3 <= mt.length; n += 1) {
      const frag = mt.slice(n, n + 3).join(' ');
      for (let k = 1; k + 3 <= mc.length; k += 1) {
        // ⚠️ « collé en fin » : le fragment termine le titre, ou presque.
        if (mc.slice(k, k + 3).join(' ') === frag && k + 3 >= mc.length - 1 && !t.includes(':')) {
          r.push(`titre du module collé en fin : « ${frag} »`);
          n = mt.length; break;
        }
      }
    }
  }
  // ⚠️ Une racine répétée sous deux formes trahit aussi une concaténation.
  const mc = mots(t);
  for (let i = 0; i < mc.length; i += 1) {
    for (let j = i + 1; j < mc.length; j += 1) {
      const [a, b] = [mc[i], mc[j]];
      if (a !== b && a.length >= 6 && (b.startsWith(a.slice(0, 6)) || a.startsWith(b.slice(0, 6)))) {
        r.push(`racine répétée : « ${a} » et « ${b} »`);
        i = mc.length; break;
      }
    }
  }
  return [...new Set(r)];
}

/* ════════════════════════════════════════════════════════════════════════ */
console.log('\n  ══ ⚠️ L ÉTALONNAGE DU DÉTECTEUR ══');
{
  const faux = { module: '01', id: 'x', titre: 'Mon export_final.mp4' };
  dire('⚠️ TÉMOIN : un vrai nom de fichier est reconnu', traces(faux).length >= 2,
    traces(faux).join(' ; '));
  const propre = { module: '04', id: 'y', titre: 'Installer TradingView' };
  dire('⚠️ TÉMOIN : un titre propre est épargné', traces(propre).length === 0,
    traces(propre).join(' ; ') || 'aucune trace');
  const intro = { module: '04', id: 'm04-l0', titre: modules['04'] ?? '' };
  dire('⛔ TÉMOIN : un chapitre d introduction est épargné', traces(intro).length === 0,
    `« ${intro.titre} » → ${traces(intro).join(' ; ') || 'aucune trace'}`);
}
if (fautes) { console.log('\n  ⛔ ÉTALONNAGE RATÉ.\n'); process.exit(1); }

console.log(`\n  ══ LE RELEVÉ : ${chapitres.length} chapitres ══\n`);
const suspects = chapitres.map((c) => ({ ...c, r: traces(c) })).filter((c) => c.r.length);
for (const c of suspects) {
  console.log(`     module ${c.module}  [${c.id}]`);
  console.log(`       « ${c.titre} »`);
  console.log(`       → ${c.r.join(' ; ')}\n`);
}
console.log(`  ⇒ ${suspects.length} titre(s) à corriger DANS VIMEO, aucun corrigé ici.\n`);

/**
 * ⛔ ET LA SONDE VÉRIFIE QU'ELLE N'A RIEN CORRIGÉ. ⚠️ Un outil qui relève et un
 * outil qui écrit ne doivent pas se confondre : celui-ci ne sait pas écrire.
 */
/**
 * ⚠️ LE MOTIF EST ASSEMBLÉ, PAS ÉCRIT EN CLAIR. Écrit d'une pièce, il se
 * trouverait LUI-MÊME dans cette source et le contrôle serait rouge en
 * permanence sur une sonde parfaitement innocente. ⛔ Même famille que le
 * contrôle des tirets, qui écrit ses deux caractères en échappement.
 */
const ECRITURE = new RegExp(['write', 'File', 'Sync'].join('')
  + '|' + ['append', 'File', 'Sync'].join('')
  + '|' + ['create', 'Write', 'Stream'].join(''));
const ecrit = ECRITURE.test(readFileSync('outils/formation-titres-traces.mjs', 'utf8'));
dire('⛔ cette sonde ne sait pas écrire : elle relève, elle ne corrige pas',
  ecrit === false, 'aucune écriture de fichier dans sa propre source');
// ⚠️ TÉMOIN : le motif assemblé reconnaît bien une écriture quand il y en a une.
dire('⚠️ TÉMOIN : le motif assemblé n est pas aveugle',
  ECRITURE.test('fs.' + 'write' + 'File' + 'Sync(x)'), 'contrôle du motif lui-même');

process.exit(fautes ? 1 : 0);
