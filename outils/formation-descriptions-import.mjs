/**
 * ⛔ POSE LES 63 DESCRIPTIONS DEPUIS `_contenu-formation/`, MOT POUR MOT.
 *
 * ── ⚠️ POURQUOI UN OUTIL ET PAS UNE SAISIE ─────────────────────────────────
 *
 * 63 descriptions recopiees a la main, c est 63 occasions de perdre une
 * apostrophe typographique ou d avaler une phrase. ⛔ L outil lit le fichier
 * source et EMET les donnees : la comparaison mot pour mot devient alors une
 * tautologie, et c est exactement ce qu on veut.
 *
 * ── ⛔ LA CORRESPONDANCE EST VERIFIEE, PAS SUPPOSEE ────────────────────────
 *
 * LearnyBox numerote `1.0`, `4.2.2`, `7bis 1`. Le depot identifie `m01-l0`,
 * `m04-l4`. ⚠️ La correspondance se fait par POSITION dans le module, et
 * l outil REFUSE d apparier deux chapitres dont les titres ne se ressemblent
 * pas assez. ⛔ Sans ce garde-fou, un decalage d un rang collerait chaque
 * description sous le mauvais chapitre, et le resultat aurait l air juste.
 *
 * ⚠️ Les entrees de LearnyBox qui n ont PAS de video, comme « 6.5 QUIZZ », sont
 * ecartees : elles n ont pas de chapitre en face.
 *
 * Usage : node outils/formation-descriptions-import.mjs [--ecrire]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { demarquer, marqueursRestants } from './_demarquer.mjs';

const ECRIRE = process.argv.includes('--ecrire');
let fautes = 0;
const dire = (nom, ok, detail) => {
  if (!ok) fautes += 1;
  console.log(`     ${ok ? 'ok ' : '⛔ '} ${nom}${detail ? `  ${detail}` : ''}`);
};

const LB = readFileSync('_contenu-formation/descriptions-chapitres-learnybox.md', 'utf8');
const SRC = readFileSync('assets/formation-donnees.js', 'utf8');

/* ══ 1. LIRE LEARNYBOX ════════════════════════════════════════════════════ */
/**
 * ⚠️ Un chapitre va de son titre `## …` au suivant. Dans ce bloc :
 *   - la DESCRIPTION est le premier paragraphe qui ne commence ni par `⚠️`,
 *     ni par `⛔`, ni par `**`
 *   - une NOTE est introduite par `**Note …:**` ou citee dans un bloc `⛔ Note`
 *   - un SOUS-TITRE et un ENCART sont introduits par `**Sous-titre…:**` et
 *     `**Encart…:**`
 */
function lireLearnyBox() {
  const blocs = [];
  const re = /^## (.+)$/gm;
  const titres = [...LB.matchAll(re)];
  for (let i = 0; i < titres.length; i += 1) {
    const brut = titres[i][1].trim();
    const deb = titres[i].index + titres[i][0].length;
    const fin = i + 1 < titres.length ? titres[i + 1].index : LB.length;
    const corps = LB.slice(deb, fin);
    // ⛔ On ne garde que les titres qui portent une numerotation de chapitre.
    const m = brut.match(/^(\d+(?:\.[\dA-Za-z]+)*(?:\s+Bis)?|7bis(?:\s+\w+)?)\s*[-\u2013:]?\s*(.*)$/);
    /**
     * ⚠️ LES TROIS BONUS DU MODULE 9 N ONT PAS DE NUMERO : leurs titres sont en
     * capitales, sans « 9.1 » devant. ⛔ Les ecarter faute de numerotation
     * laisserait trois chapitres sans description et sans que rien ne le dise.
     */
    const BONUS = { 'MODULE ANTI-PERTE DE CONFIANCE': '9.1',
      'PROGRAMME MEMBRE & SYSTÈME DE RECOMMANDATION': '9.2',
      'TUTO "IMBALANCE"': '9.3' };
    let numero; let titre;
    if (BONUS[brut]) { numero = BONUS[brut]; titre = brut; }
    else if (m) {
      numero = m[1].trim(); titre = m[2].trim();
      /**
       * ⛔ `7bis Intro` SE LISAIT « numero 7, titre bis Intro ». ⚠️ Le motif
       * n acceptait que `Bis` avec une majuscule, hérité de `5.3 Bis` ; en
       * minuscules, « bis » retombait dans le titre et les quatre chapitres du
       * module 7 bis se rattachaient au module 07.
       */
      const bis = titre.match(/^bis\s*(.*)$/i);
      if (bis) { numero = `${numero}bis ${bis[1].split(/\s+/)[0]}`.trim(); titre = bis[1].replace(/^\S+\s*[-\u2013:]?\s*/, '').trim(); }
    }
    else continue;

    const paras = corps.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
    let description = null;
    const notes = [];
    let sousTitre = null;
    let encart = null;
    for (const p of paras) {
      const suivante = (bloc) => bloc.split('\n').slice(1).join('\n').trim();
      if (/^\*\*Sous-titre/i.test(p)) { sousTitre = demarquer(suivante(p)); continue; }
      if (/^\*\*Encart/i.test(p)) { encart = demarquer(suivante(p)); continue; }
      if (/^\*\*Note/i.test(p)) { notes.push(demarquer(suivante(p))); continue; }
      if (/^[⚠⛔]/.test(p)) {
        // ⚠️ Une note technique citee dans un bloc d annotation, entre guillemets.
        const g = p.match(/«\s*([^»]{20,})\s*»/);
        if (g && /[Nn]ote/.test(p)) notes.push(demarquer(g[1]));
        continue;
      }
      if (/^\*\*/.test(p)) continue;
      if (description === null) description = demarquer(p);
    }
    /**
     * ⛔ `7.3.1` : SON PREMIER PARAGRAPHE EST UN AVERTISSEMENT, PAS UNE
     * DESCRIPTION. Le fichier source le dit : « Ce n'est pas une description,
     * c'est un avertissement pratique », a poser comme note au meme titre que
     * 3.1 et 5.8.2. ⚠️ Pris pour une description, il aurait l air d un texte
     * d introduction, et il serait indelebile le jour ou la video sera refaite.
     *
     * ⛔ Le cas est NOMME plutot que devine : aucun motif ne distingue de
     * maniere fiable un avertissement d une description, et un detecteur
     * approximatif reclasserait des descriptions legitimes.
     */
    if (numero === '7.3.1' && description) { notes.unshift(description); description = null; }
    blocs.push({ numero, titre, description, notes, sousTitre, encart });
  }
  return blocs;
}

/* ══ 2. LES CHAPITRES DU DEPOT ════════════════════════════════════════════ */
function lireDepot() {
  const out = {};
  // ⛔ `'07bis'` N EST PAS UNE CLE A DEUX CHIFFRES. ⚠️ Un motif `\d\d` ne la
  // voyait pas, et le module entier disparaissait de l appariement sans erreur.
  for (const b of SRC.matchAll(/'(\d\d(?:bis)?)'\s*:\s*\[([\s\S]*?)\n\s*\]/g)) {
    out[b[1]] = [...b[2].matchAll(/\{\s*id:\s*'([^']*)',\s*titre:\s*"((?:[^"\\]|\\.)*)"/g)]
      .map((m) => ({ id: m[1], titre: m[2].replace(/\\"/g, '"') }));
  }
  return out;
}

/** Mots significatifs, sans accents ni casse. */
const mots = (s) => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().match(/[a-z0-9]+/g)?.filter((m) => m.length > 2) ?? [];

/** Part des mots du plus court presents dans le plus long. */
function ressemblance(a, b) {
  const x = mots(a); const y = mots(b);
  if (!x.length || !y.length) return 0;
  const [court, long] = x.length <= y.length ? [x, y] : [y, x];
  return court.filter((m) => long.includes(m)).length / court.length;
}

/* ══ 3. APPARIER ══════════════════════════════════════════════════════════ */
const lb = lireLearnyBox();
const depot = lireDepot();

console.log('\n  ══ 1. ⚠️ L ÉTALONNAGE DE L APPARIEUR ══');
dire('⚠️ TÉMOIN : deux titres identiques se ressemblent à 100 %',
  ressemblance('Installer TradingView', 'Installer TradingView') === 1);
dire('⚠️ TÉMOIN : deux titres étrangers ne se ressemblent pas',
  ressemblance('Installer TradingView', 'Comprendre la fiscalité du trading') < 0.4,
  ressemblance('Installer TradingView', 'Comprendre la fiscalité du trading').toFixed(2));
dire('⚠️ TÉMOIN : une variante proche se ressemble quand même',
  ressemblance('Installer TopstepX', 'Installer TOPSTEPX') > 0.9);
dire(`⚠️ ${lb.length} entrée(s) lues dans LearnyBox`, lb.length >= 57, `${lb.length}`);
if (fautes) { console.log('\n  ⛔ ÉTALONNAGE RATÉ.\n'); process.exit(1); }

console.log('\n  ══ 2. L APPARIEMENT, MODULE PAR MODULE ══');
const SEUIL = 0.5;
const carte = {};        // id du depot -> bloc LearnyBox
const sansVideo = [];    // entrees LearnyBox sans chapitre en face
/**
 * ── ⛔ APPARIEMENT PAR MEILLEURE RESSEMBLANCE, ET NON PAR POSITION ─────────
 *
 * ⚠️ Une premiere version avancait d un rang a chaque entree appariee, et
 * ECARTAIT celles sans description en les prenant pour des quiz. Or `4.2.2`,
 * `5.3 Bis`, `7.3` et `7.3.2` n ont pas de description ET sont de vraies
 * videos : les sauter decalait tout ce qui suivait, et dix-neuf chapitres se
 * retrouvaient apparies au mauvais voisin. ⛔ Le resultat avait l air d un
 * simple ecart de comptage, alors que c etait un decalage silencieux.
 *
 * ⚠️ Le seul vrai discriminant d une entree sans video est son TITRE : un quiz
 * le dit. Et l appariement cherche desormais, pour chaque entree, le chapitre
 * du module qui lui ressemble le PLUS, sans supposer l ordre.
 */
const estQuiz = (e) => /\bquiz{1,2}\b/i.test(e.titre) || /\bquiz{1,2}\b/i.test(e.numero);
for (const mod of Object.keys(depot).sort()) {
  if (mod === '00' || mod === '10') continue;
  /**
   * ⛔ LA CLE DU MODULE N EST PLUS FORCEMENT UN NOMBRE. ⚠️ Depuis que le 7 bis
   * est autonome, sa cle est `'07bis'` et `Number('07bis')` rend `NaN` : aucune
   * entree LearnyBox ne correspondait, et ses quatre chapitres perdaient leur
   * description en silence. Le fichier engendre passait de 63 a 59 entrees,
   * sans une erreur.
   */
  const estBis = /bis$/i.test(mod);
  const num = estBis ? '7bis' : String(Number(mod));
  const siennes = estBis
    ? lb.filter((x) => /^7\s*bis/i.test(x.numero))
    : lb.filter((x) => x.numero === num || x.numero.startsWith(`${num}.`));
  const libres = depot[mod].slice();
  for (const e of siennes) {
    if (estQuiz(e)) { sansVideo.push(e); continue; }
    let meilleur = null; let score = 0;
    for (const c of libres) {
      const r = ressemblance(e.titre, c.titre);
      if (r > score) { score = r; meilleur = c; }
    }
    if (!meilleur || score < SEUIL) {
      console.log(`     ⛔ module ${mod} : « ${e.numero} ${e.titre.slice(0, 44)} »`);
      console.log(`        aucun chapitre ne lui ressemble (meilleur ${score.toFixed(2)})`);
      fautes += 1;
      continue;
    }
    carte[meilleur.id] = { ...e, ressemblance: score };
    libres.splice(libres.indexOf(meilleur), 1);
  }
  const apparies = depot[mod].filter((c) => carte[c.id]).length;
  dire(`module ${mod} : ${apparies} / ${depot[mod].length} chapitres appariés`,
    apparies === depot[mod].length,
    apparies === depot[mod].length ? '' : `reste ${libres.map((c) => c.titre.slice(0, 26)).join(' | ')}`);
}
console.log(`\n     ⚠️ ${sansVideo.length} entrée(s) LearnyBox sans chapitre vidéo : `
  + sansVideo.map((x) => x.numero).join(', '));

/* ══ 4. CE QUI EST POSE ═══════════════════════════════════════════════════ */
console.log('\n  ══ 3. CE QUI EST POSÉ ══');
const avecDesc = Object.values(carte).filter((x) => x.description).length;
const sansDesc = Object.entries(carte).filter(([, x]) => !x.description);
const avecNote = Object.values(carte).filter((x) => x.notes.length).length;
const avecEncart = Object.values(carte).filter((x) => x.encart || x.sousTitre).length;
console.log(`     ${Object.keys(carte).length} chapitres appariés`);
console.log(`     ${avecDesc} avec description, ${sansDesc.length} EN ATTENTE`);
console.log(`     ${avecNote} avec note distincte, ${avecEncart} avec sous-titre ou encart`);
for (const [id, x] of sansDesc) console.log(`        en attente : ${id}  « ${x.numero} ${x.titre.slice(0, 44)} »`);

/* ══ 5. EMISSION ══════════════════════════════════════════════════════════ */
/**
 * ⛔ LES SAUTS DE LIGNE SONT ECHAPPES, et c est ce qui manquait.
 * ⚠️ L encart de 6.4 tient sur quatre lignes : insere tel quel dans une chaine
 * a guillemets doubles, il la cassait et le fichier engendre ne se chargeait
 * plus. ⛔ Et sa structure compte : ce sont des lignes d instruction, pas un
 * paragraphe. On les garde, echappees.
 */
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
  .replace(/\r/g, '').replace(/\n/g, '\\n');
const lignes = [];
for (const [id, x] of Object.entries(carte)) {
  const bouts = [];
  if (x.description) bouts.push(`description: "${esc(x.description)}"`);
  if (x.sousTitre) bouts.push(`sousTitre: "${esc(x.sousTitre)}"`);
  if (x.encart) bouts.push(`encart: "${esc(x.encart)}"`);
  if (x.notes.length) bouts.push(`notes: [${x.notes.map((n) => `"${esc(n)}"`).join(', ')}]`);
  bouts.push(`learnybox: "${esc(x.numero)}"`);
  lignes.push(`  '${id}': { ${bouts.join(', ')} },`);
}
const bloc = `/**
 * ⛔ ENGENDRÉ PAR \`outils/formation-descriptions-import.mjs\`. NE PAS ÉDITER.
 *
 * Source unique : \`_contenu-formation/descriptions-chapitres-learnybox.md\`,
 * relevé à la main par Nadir le 13/10 dans LearnyBox. ⚠️ Corriger ici serait
 * créer une seconde vérité, et c'est celle d'ici qui serait écrasée au prochain
 * import. ⛔ Les corrections se font dans le fichier source.
 *
 * ⚠️ \`notes\` est distinct de \`description\` : ce sont des avertissements liés à
 * la VIDÉO (coupure de son, version périmée), qui disparaîtront quand elle sera
 * refaite. ⛔ Les fondre dans la description les rendrait indélébiles.
 *
 * ⚠️ \`sousTitre\` et \`encart\` ne concernent que 4.3 et 6.4 : ils décrivent un
 * déblocage manuel par Discord qui n'existera pas dans le journal. ⛔ Posés tels
 * quels, Nadir tranche à la bascule.
 */
const CONTENU_CHAPITRES = {
${lignes.join('\n')}
};`;

/* ══ 6. LES DESCRIPTIONS DE MODULE ════════════════════════════════════════ */
/**
 * ⛔ CELLES DE LEARNYBOX REMPLACENT CELLES DU SITE, plus courtes. Decision de
 * Nadir du 13/10. ⚠️ Le site garde les siennes : ce remplacement ne concerne
 * que l espace formation du journal.
 */
const LBM = readFileSync('_contenu-formation/descriptions-modules-learnybox.md', 'utf8');
const descMod = {};
/**
 * ⛔ ON DECOUPE SUR LES TITRES, on n utilise pas de regard-avant avec `$`.
 * ⚠️ Avec le drapeau `m`, `$` vaut FIN DE LIGNE : la capture paresseuse
 * s arretait aussitot apres le titre et rendait zero description, sans erreur.
 */
const sections = LBM.split(/\n## /).map((s, i) => (i === 0 ? s : `## ${s}`));
for (const sec of sections) {
  /**
   * ⛔ `Module 7` ET `Module 7bis` SONT DEUX MODULES. ⚠️ Un motif qui rendait
   * `7` pour les deux faisait ecraser la description du 07 par celle du 7 bis,
   * silencieusement : les deux cles etaient identiques et la derniere gagnait.
   */
  const tete = sec.match(/^## Module (\d+)(\s*bis)?\s*:/i);
  if (!tete) continue;
  const cle = tete[2] ? '07bis' : tete[1].padStart(2, '0');
  const m = [null, cle, sec.slice(sec.indexOf('\n'))];
  const paras = m[2].split(/\n\s*\n/).map((x) => x.trim()).filter(Boolean);
  // ⚠️ Le premier paragraphe qui n est ni une annotation ni un bloc en gras.
  /**
   * ── ⛔ ET QUI N EST PAS UNE PHRASE *SUR* L ABSENCE DE DESCRIPTION ─────────
   *
   * ⚠️ DEFAUT MESURE LE 14/10 : le module 09 affichait « Aucune description
   * dans LearnyBox. » a l eleve, mot pour mot. Le fichier source disait cela
   * pour dire qu il n y avait rien a poser, et l import l a pose.
   * ⛔ C est pire qu une description manquante : la carte avait l air remplie,
   * la sonde de comparaison verbatim etait VERTE puisque la phrase se trouve
   * bien dans la source, et le garde-fou « module sans description » ne voyait
   * rien non plus. Trois instruments d accord sur un texte faux.
   */
  const META = /^(aucune description|pas de description|non capturée?|à venir)\b/i;
  const d = paras.find((x) => !/^[⚠⛔]/.test(x) && !/^\*\*/.test(x) && !META.test(x));
  /**
   * ── ⛔ LES MARQUEURS DE CITATION NE SONT PAS DU TEXTE ─────────────────────
   *
   * ⚠️ DEFAUT MESURE LE 14/10, et c est le MEME motif : les descriptions
   * ecrites en bloc de citation Markdown arrivaient a l eleve avec leurs
   * chevrons, un par ligne repliee : « ... les revenus que tu > percois d une
   * prop firm ». Six chapitres etaient touches, les trois du module 08 et les
   * trois du 09.
   * ⛔ ET LA SONDE VERBATIM ETAIT VERTE : elle compare au fichier source, qui
   * porte les memes chevrons. ⚠️ Un comparateur pris dans le meme moule que la
   * mesure ne discrimine rien, et c est exactement ce qui s est passe.
   */
  if (d) descMod[m[1]] = demarquer(d);
}
console.log(`\n  ══ 4. LES DESCRIPTIONS DE MODULE ══`);
console.log(`     ${Object.keys(descMod).length} description(s) de module lues : `
  + Object.keys(descMod).sort().join(', '));
/**
 * ⛔ LES ONZE MODULES DU PARCOURS ONT UNE DESCRIPTION, nommement.
 * ⚠️ Un compte seul ne suffit pas : neuf sur onze, c est onze moins les deux
 * qui manquaient, et le compte ne dit pas LESQUELLES.
 */
{
  const ATTENDUES = ['01', '02', '03', '04', '05', '06', '07', '07bis', '08', '09'];
  const absentes = ATTENDUES.filter((c) => !descMod[c]);
  dire('⛔ les dix modules de contenu ont leur description', absentes.length === 0,
    absentes.length ? `manquent : ${absentes.join(', ')}` : '10 sur 10');
  // ⚠️ `'10'`, la certification, n a pas de description LearnyBox : elle garde
  // la sienne, ecrite pour le site. ⛔ Ce n est pas un oubli, c est nomme.
  dire('⚠️ et la certification n en attend pas de LearnyBox', !descMod['10']);
}

/* ══ 6 bis. ⛔ AUCUN MARQUEUR MARKDOWN NE PART A L ECRAN ══════════════════ */
console.log('\n  ══ 5. ⛔ LE BALISAGE NE PASSE PAS ══');
{
  const sales = [];
  for (const [cle, d] of Object.entries(descMod)) {
    const r = marqueursRestants(d);
    if (r.length) sales.push(`module ${cle} (${r.join(', ')})`);
  }
  for (const b of lireLearnyBox()) {
    for (const t of [b.description, b.sousTitre, b.encart, ...b.notes].filter(Boolean)) {
      const r = marqueursRestants(t);
      if (r.length) sales.push(`chapitre ${b.numero} (${r.join(', ')})`);
    }
  }
  dire('⛔ aucune description, note, sous-titre ni encart ne porte de marqueur',
    sales.length === 0, sales.length ? [...new Set(sales)].join(' ; ') : 'tous propres');
  /**
   * ⚠️ LE TEMOIN, ET SANS LUI LE VERT CI-DESSUS NE VAUT RIEN. ⛔ Un detecteur
   * qui rendrait toujours « propre » passerait inapercu : six chapitres ont
   * vecu six jours avec leurs chevrons sous trois instruments verts.
   */
  const sale = '> Dans ce chapitre, tu vas comprendre pourquoi\n> ca compte.';
  dire('⚠️ TÉMOIN : un bloc de citation EST reconnu sale',
    marqueursRestants(sale).length > 0, marqueursRestants(sale).join(', '));
  dire('⚠️ TÉMOIN : debalise, il devient propre',
    marqueursRestants(demarquer(sale)).length === 0, `« ${demarquer(sale)} »`);
  dire('⚠️ TÉMOIN : et les mots, eux, n ont pas bouge',
    demarquer(sale) === 'Dans ce chapitre, tu vas comprendre pourquoi ca compte.');
}

if (ECRIRE) {
  const marque = 'const CONTENU_CHAPITRES = {';
  let t = SRC;
  if (t.includes(marque)) {
    const d = t.indexOf('/**\n * ⛔ ENGENDRÉ PAR');
    const f = t.indexOf('\n};', t.indexOf(marque)) + 3;
    t = t.slice(0, d) + bloc + t.slice(f);
  } else {
    t = t.replace('  const MODULES = [', `${bloc}\n\n  const MODULES = [`);
  }
  /**
   * ⛔ `DESCRIPTIONS` est le bloc existant, repris du SITE. On le remplace par
   * celui de LearnyBox, module par module, en gardant les cles absentes.
   * ⚠️ `'00'` et `'10'` n ont pas de description LearnyBox : l Introduction n en
   * a pas, et la certification n a pas ete capturee. Les leurs restent.
   */
  for (const [num, d] of Object.entries(descMod)) {
    /**
     * ⛔ LES DEUX FORMES DE GUILLEMETS. ⚠️ Le bloc existant melange apostrophes
     * simples et guillemets doubles selon que la valeur contient une apostrophe.
     * Un motif qui n acceptait que les doubles n a remplace qu une description
     * sur neuf, et a signale les huit autres comme « cle introuvable ».
     */
    const motif = new RegExp(`(\n\\s*'${num}':\\s*)("(?:[^"\\\\]|\\\\.)*"|'(?:[^'\\\\]|\\\\.)*')`);
    if (motif.test(t)) t = t.replace(motif, `$1${JSON.stringify(d)}`);
    else {
      // ⛔ `07bis` n existe pas encore dans le bloc : on l INSERE avant `'08'`,
      // a sa place dans l ordre du parcours.
      const ancre = "\n    '08':";
      if (t.includes(ancre)) {
        t = t.replace(ancre, `\n    '${num}': ${JSON.stringify(d)},${ancre}`);
        console.log(`     ⚠️ module ${num} : clé absente, insérée`);
      } else console.log(`     ⛔ module ${num} : impossible à poser`);
    }
  }
  writeFileSync('assets/formation-donnees.js', t, 'utf8');
  console.log('\n  ⇒ assets/formation-donnees.js réécrit.');
} else {
  console.log('\n  ⚠️ Essai à blanc. Relancer avec --ecrire pour poser.');
}

console.log(fautes ? `\n  ⛔ ${fautes} CONTROLE(S) ROUGE(S).\n` : '\n  Tout est vert.\n');
process.exit(fautes ? 1 : 0);
