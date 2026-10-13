/**
 * ⛔ CHAQUE MODULE VAUT EXACTEMENT 100 XP.
 *
 * ── ⚠️ POURQUOI CE CONTROLE EXISTE ─────────────────────────────────────────
 *
 * Les divisions ne tombent pas rondes : 100 / 7 = 14,28. ⛔ Arrondir chapitre
 * par chapitre donne 7 x 14 = 98, et le module ne vaut plus 100. L ecart est de
 * deux points sur un module, invisible a l oeil, et il s accumule sur dix.
 *
 * ⚠️ TEMOIN OBLIGATOIRE : un module ampute d un chapitre ne doit PLUS totaliser
 * 100 avec la repartition calculee pour son nombre d origine. Sans lui, « la
 * somme fait 100 » decrirait aussi une fonction qui rend toujours 100.
 *
 * Usage : node outils/formation-xp.mjs
 */
import { readFileSync } from 'node:fs';
const PPTR = '/Users/nadirkasmi/Projets/trader360-site/node_modules/'
  + 'puppeteer-core/lib/esm/puppeteer/puppeteer-core.js';
const { default: puppeteer } = await import(PPTR);

let fautes = 0;
const dire = (n, ok, d) => { if (!ok) fautes += 1;
  console.log(`     ${ok ? 'ok ' : '⛔ '} ${n}${d ? `  ${d}` : ''}`); };

const nav = await puppeteer.launch({
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  headless: 'new', args: ['--no-first-run'] });
const p = await nav.newPage();
await p.setContent('<!doctype html><html><body><div id="formationApp"><div id="formation"></div></div></body></html>');
await p.evaluate(() => {
  window.supabaseClient = { from: () => ({ select: () => ({ eq: () => ({
    maybeSingle: () => Promise.resolve({ data: null, error: null }),
    then: (r) => Promise.resolve({ data: [], error: null }).then(r) }) }) }),
    auth: { getUser: () => Promise.resolve({ data: { user: { id: 'x' } } }) } };
});
await p.addScriptTag({ content: readFileSync('assets/formation-donnees.js', 'utf8') });
await p.addScriptTag({ content: readFileSync('supabase-formation.js', 'utf8') });

console.log('\n  ══ 1. ⚠️ L ÉTALONNAGE ══');
const expose = await p.evaluate(() => typeof window.Formation?._calcul?.partsXp === 'function');
dire('le calcul est exposé', expose === true);
const essais = await p.evaluate(() => {
  const f = window.Formation._calcul.partsXp;
  return { sept: f(7), trois: f(3), un: f(1), zero: f(0), douze: f(12) };
});
dire('⚠️ TÉMOIN : 7 chapitres donnent 7 parts', essais.sept.length === 7, essais.sept.join('+'));
dire('⚠️ TÉMOIN : 1 chapitre prend les 100', essais.un.join() === '100', essais.un.join());
dire('⚠️ TÉMOIN : 0 chapitre ne donne rien', essais.zero.length === 0);
if (fautes) { console.log('\n  ⛔ ÉTALONNAGE RATÉ.\n'); process.exit(1); }

console.log('\n  ══ 2. ⛔ LA SOMME EFFECTIVE, MODULE PAR MODULE ══');
/**
 * ⛔ ON MESURE `xpDe`, PAS `partsXp`. ⚠️ `partsXp` ne connait que le nombre de
 * chapitres : il rend 100 pour le bonus comme pour les autres. C est `xpDe` qui
 * applique les regles, et c est lui que l eleve voit. Mesurer la repartition
 * aurait rendu un module 9 a 100 XP sur un code qui en donne zero.
 */
const mods = await p.evaluate(() => window.FormationDonnees.MODULES.map((m) => ({
  numero: m.numero, n: m.lecons.length,
  intro: !!m.introduction, cert: !!m.certification, bonus: !!m.bonus,
  effectif: m.lecons.map((l) => window.Formation._calcul.xpDe(l.id)),
  parts: window.Formation._calcul.partsXp(m.lecons.length),
})));
let general = 0;
for (const m of mods) {
  const somme = m.effectif.reduce((a, b) => a + b, 0);
  const attendu = (m.intro || m.bonus || m.n === 0) ? 0 : 100;
  general += somme;
  const quoi = m.intro ? 'introduction' : m.bonus ? 'BONUS' : m.cert ? 'certification' : '';
  dire(`module ${String(m.numero).padEnd(5)} : ${String(m.n).padStart(2)} chapitre(s) → ${String(somme).padStart(3)} XP${quoi ? ` (${quoi})` : ''}`,
    somme === attendu, m.n ? m.effectif.join(' + ') : 'aucun chapitre');
}

console.log('\n  ══ 3. ⛔ LE TOTAL GÉNÉRAL, ET UNE CONTRADICTION À SIGNALER ══');
const comptes = mods.filter((m) => !m.intro && !m.bonus && m.n > 0).length;
/**
 * ── ⛔ 900, PAS 1100, ET CE N EST PAS UN DÉFAUT DE CALCUL ──────────────────
 *
 * Le lot 14 annonce « le total general passe de 1000 a 1100 XP, hors bonus ».
 * ⚠️ Ce chiffre suppose ONZE modules a 100 XP chacun. Or deux des onze ne
 * peuvent rien rapporter :
 *
 *   module 09   BONUS, mis a zero par l arbitrage 0.2 du meme lot
 *   module 10   CERTIFICATION, qui n a AUCUN chapitre : aucun dossier Vimeo
 *               ne lui correspond, et on ne lui en invente pas
 *
 * ⛔ Il reste donc NEUF modules qui rapportent, soit 900 XP de chapitres.
 * ⚠️ Afficher « x / 1100 » donnerait un total inatteignable, et un eleve qui
 * finit tout verrait 900 sur 1100 sans comprendre ce qui manque.
 *
 * ⛔ CE CONTROLE MESURE CE QUE LE CODE FAIT. Le chiffre affiche a l eleve est
 * un arbitrage de Nadir, pas une correction a faire ici.
 */
dire('⛔ le total EFFECTIF des chapitres', general === 900, `${general} XP`);
dire('⛔ répartis sur NEUF modules qui rapportent', comptes === 9,
  `${comptes} modules à 100 XP`);
console.log('     ⚠️ ÉCART AVEC LE LOT 14, À TRANCHER :');
console.log('        annonce  1100 XP, soit onze modules à 100');
console.log('        mesuré    900 XP, soit neuf : le 09 est à zéro par');
console.log('                  l arbitrage 0.2, et le 10 n a aucun chapitre');
console.log('        ⛔ Avec les bonus de fin de module, le total atteignable');
console.log(`        monte à ${general + comptes * 250} XP. Dire lequel s affiche.`);
dire('⚠️ et le module 10 n a aucun chapitre : la certification est une condition',
  mods.find((m) => m.numero === '10').n === 0);

console.log('\n  ══ 4. ⚠️ LE TÉMOIN : un module amputé ne fait plus 100 ══');
{
  const r = await p.evaluate(() => {
    const f = window.Formation._calcul.partsXp;
    const neuf2 = f(9);
    return { ampute: neuf2.slice(0, 8).reduce((a, b) => a + b, 0),
      entier: neuf2.reduce((a, b) => a + b, 0) };
  });
  dire('⛔ huit parts sur neuf ne font PAS 100', r.ampute !== 100, `${r.ampute}`);
  dire('⚠️ et les neuf, si', r.entier === 100, `${r.entier}`);
}

console.log('\n  ══ 5. ⛔ LE MODULE 7 BIS EST AUTONOME, SANS CASSER DE PROGRESSION ══');
{
  const r = await p.evaluate(() => {
    const D = window.FormationDonnees;
    const sept = D.MODULES.find((m) => m.numero === '07');
    const bis = D.MODULES.find((m) => m.numero === '7 bis');
    return {
      sept: sept.lecons.map((l) => l.id),
      bis: bis ? bis.lecons.map((l) => l.id) : null,
      total: D.MODULES.length,
      // ⚠️ Les identifiants restent uniques dans tout le parcours.
      doublons: (() => {
        const v = D.MODULES.flatMap((m) => m.lecons.map((l) => l.id));
        return v.length - new Set(v).size;
      })(),
    };
  });
  dire('⛔ le module 07 est revenu à NEUF chapitres', r.sept.length === 9, r.sept.join(', '));
  dire('⛔ le 7 bis en porte QUATRE', r.bis && r.bis.length === 4, (r.bis || []).join(', '));
  /**
   * ⛔ LA PREUVE QU AUCUNE PROGRESSION NE CASSE, et elle tient en une phrase :
   * la progression est enregistree par `lecon_id` dans `formation_progression`,
   * et AUCUN identifiant n a change. ⚠️ Les quatre chapitres deplaces portent
   * toujours `m07-l9` a `m07-l12` : une ligne deja en base les retrouve.
   * ⛔ Les renumeroter en `m7b-l0` aurait laisse quatre lignes orphelines et
   * quatre chapitres redevenus a faire, sans la moindre erreur.
   */
  dire('⛔ et ses identifiants sont INCHANGÉS, donc la progression suit',
    JSON.stringify(r.bis) === JSON.stringify(['m07-l9', 'm07-l10', 'm07-l11', 'm07-l12']),
    (r.bis || []).join(', '));
  dire('⚠️ aucun identifiant en double dans tout le parcours', r.doublons === 0, `${r.doublons}`);
  /**
   * ⚠️ DOUZE ENTRÉES : l introduction, les modules 01 a 08, le 7 bis, le 09 et
   * le 10. ⛔ « Onze modules » compte ceux que l eleve parcourt, 01 a 10 plus le
   * 7 bis ; l introduction n en est pas un.
   */
  dire('⛔ DOUZE entrées : onze modules, plus l introduction',
    r.total === 12, `${r.total}`);
}

console.log('\n  ══ 6. ⛔ LES TROIS NIVEAUX ══');
{
  const n = await p.evaluate(() => {
    const D = window.FormationDonnees;
    return {
      niveaux: D.NIVEAUX_PARCOURS.map((x) => ({ nom: x.nom, modules: x.modules })),
      sept: D.niveauDuModule('07')?.cle,
      bis: D.niveauDuModule('07bis')?.cle,
      quatre: D.niveauDuModule('04')?.cle,
      cinq: D.niveauDuModule('05')?.cle,
      inconnu: D.niveauDuModule('99'),
    };
  });
  for (const x of n.niveaux) console.log(`        ${x.nom.padEnd(14)} ${x.modules.join(', ')}`);
  dire('⛔ le module 07 est CONFIRMÉ', n.sept === 'confirme', String(n.sept));
  dire('⛔ le 7 bis aussi', n.bis === 'confirme', String(n.bis));
  dire('⛔ le 04 est débutant, le 05 intermédiaire',
    n.quatre === 'debutant' && n.cinq === 'intermediaire', `${n.quatre} / ${n.cinq}`);
  // ⚠️ TÉMOIN : un module inconnu ne tombe dans aucun niveau.
  dire('⚠️ TÉMOIN : un module inexistant ne reçoit aucun niveau', n.inconnu === null);
}

await nav.close();
console.log(fautes ? `\n  ⛔ ${fautes} CONTROLE(S) ROUGE(S).\n` : '\n  Tout est vert.\n');
process.exit(fautes ? 1 : 0);
