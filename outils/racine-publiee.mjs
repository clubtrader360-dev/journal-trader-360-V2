/**
 * ⛔ CE QUE LA RACINE DU DÉPÔT PUBLIE, ET CE QUE `.vercelignore` EN RETIRE.
 *
 * ── ⚠️ LE MÉCANISME, ÉTABLI PAR MESURE ─────────────────────────────────────
 *
 * Ce projet n'a pas de dossier de sortie : son build est `echo 'Build complete'`
 * et Vercel sert les fichiers tels qu'ils sont déposés. ⛔ La réécriture de
 * `vercel.json`, `/((?!api/|.*\..*).*)`, exclut tout chemin CONTENANT UN POINT :
 * ces chemins tombent sur le fichier statique au lieu d'être renvoyés vers
 * `index.html`. Tout fichier à la racine portant une extension est donc public.
 *
 * ── ⛔ POURQUOI ON MESURE SUR LE DOMAINE PERSONNALISÉ ──────────────────────
 *
 * ⚠️ Pas sur un aperçu : le projet porte `ssoProtection: all_except_custom_
 * domains`, et une requête vers une URL d'aperçu mesure l'écran de connexion
 * Vercel, pas le fichier. Elle répondrait 200 sur du HTML de connexion, et on
 * prendrait une protection pour un succès. ⛔ `app.journaltrader360.fr` est un
 * domaine personnalisé : il échappe au SSO, et c'est le seul endroit où la
 * mesure veut dire quelque chose.
 *
 * ── ⚠️ DEUX TÉMOINS, ET AUCUN N'EST FACULTATIF ────────────────────────────
 *
 *   positif  `favicon.ico` DOIT répondre 200. Sans lui, un relevé qui ne verrait
 *            rien nulle part passerait pour un dépôt propre.
 *   négatif  `package.json` et `.env.example` DOIVENT répondre 404 : Vercel ne
 *            les sert jamais. Sans eux, « tout répond 200 » décrirait aussi un
 *            serveur qui rend la même page pour n'importe quelle adresse.
 *
 * Usage : node outils/racine-publiee.mjs
 */
import { execSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';

const DOMAINE = 'https://app.journaltrader360.fr';

let fautes = 0;
const dire = (nom, ok, detail) => {
  if (!ok) fautes += 1;
  console.log(`     ${ok ? 'ok ' : '⛔ '} ${nom}${detail ? `  ${detail}` : ''}`);
};
let n = 0;
const titre = (s) => { n += 1; console.log(`\n  ══ ${n}. ${s.toUpperCase()} ══`); };

const sh = (c) => execSync(c, { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });

/* ══ LES MOTIFS DE `.vercelignore`, LUS DANS LE FICHIER ═══════════════════ */
/**
 * ⛔ On LIT les motifs, on ne les recopie pas. ⚠️ Une liste recopiée ici
 * divergerait du fichier au premier ajout, et la sonde rassurerait sur un
 * fichier qu'elle ne décrit plus.
 */
const motifs = existsSync('.vercelignore')
  ? readFileSync('.vercelignore', 'utf8').split('\n')
    .map((l) => l.trim()).filter((l) => l && !l.startsWith('#'))
  : [];

/** `*.sql` → teste l'extension ; un nom nu → égalité. */
const exclu = (f) => motifs.some((m) => (m.startsWith('*.')
  ? f.endsWith(m.slice(1))
  : f === m));

/* ════════════════════════════════════════════════════════════════════════ */
titre('⚠️ l instrument s étalonne sur le domaine public');
const code = (chemin) => {
  try {
    return sh(`curl -s -o /dev/null -w '%{http_code}' --max-time 20 '${DOMAINE}/${chemin}'`).trim();
  } catch { return 'erreur'; }
};
{
  const positif = code('favicon.ico');
  dire('⚠️ TÉMOIN POSITIF : `favicon.ico` est bien servi', positif === '200', `HTTP ${positif}`);
  const negatif = code('package.json');
  dire('⚠️ TÉMOIN NÉGATIF : `package.json` ne l est jamais', negatif === '404', `HTTP ${negatif}`);
  const absurde = code('fichier-qui-n-existe-nulle-part.txt');
  dire('⚠️ TÉMOIN : une adresse inventée rend bien 404', absurde === '404', `HTTP ${absurde}`);
  if (positif !== '200' || negatif === positif) {
    console.log('\n  ⛔ ÉTALONNAGE RATÉ : le relevé ne distingue pas servi de non servi.\n');
    process.exit(1);
  }
}

/* ════════════════════════════════════════════════════════════════════════ */
titre('⛔ ce que la racine publie AUJOURD HUI, fichier par fichier');
const racine = sh('git ls-files --full-name .').split('\n')
  .filter((f) => f && !f.includes('/')).sort();
const servis = [];
const refuses = [];
for (const f of racine) {
  const c = code(f);
  (c === '200' ? servis : refuses).push({ f, c });
}
console.log(`     ${racine.length} fichier(s) suivis à la racine`);
console.log(`     ⇒ ${servis.length} servis, ${refuses.length} non servis`);

/**
 * ⛔ CE QUI EST SERVI ET NE DEVRAIT PAS L'ÊTRE.
 * ⚠️ Le critère n'est pas « ça me déplaît » : c'est « le motif de
 * `.vercelignore` le désigne ». Les deux listes doivent coïncider.
 */
const aRetirer = servis.filter(({ f }) => exclu(f));
console.log('');
for (const { f } of aRetirer) console.log(`     ⛔ servi, et à retirer : ${f}`);
dire('⛔ des fichiers servis sont désignés par `.vercelignore`', aRetirer.length > 0,
  `${aRetirer.length} fichier(s)`);

/* ════════════════════════════════════════════════════════════════════════ */
titre('⛔ et ce que l exclusion N EMPORTE PAS');
{
  /**
   * ⚠️ C'est la moitié qui peut casser le site. Un motif trop large retirerait
   * `index.html` ou un script, et la panne serait totale. ⛔ On vérifie donc la
   * liste de ce qui DOIT rester, nommément.
   */
  const indispensables = racine.filter((f) => /\.(html|js|png|ico|svg)$/.test(f))
    .concat(['vercel.json', 'package.json']);
  const casses = indispensables.filter((f) => exclu(f));
  dire('⛔ aucun .html, .js, icône, `vercel.json` ni `package.json` n est exclu',
    casses.length === 0, casses.length ? casses.join(', ') : `${indispensables.length} épargnés`);
  // ⚠️ TÉMOIN : le testeur de motif sait dire oui. Sinon « rien n est exclu »
  // décrirait aussi un testeur qui rend toujours faux.
  dire('⚠️ TÉMOIN : le testeur reconnaît bien un fichier visé',
    exclu('MIGRATION_COMPLETE.sql') && exclu('UPDATE.md')
    && exclu('formation-vimeo-releve.json'),
    'trois motifs de nature différente : extension, extension, nom nu');
  dire('⚠️ TÉMOIN : et il épargne bien un fichier voisin',
    !exclu('index.html') && !exclu('vercel.json'));
}

/* ════════════════════════════════════════════════════════════════════════ */
titre('⚠️ ce qui reste exposé TANT QUE LA BRANCHE N EST PAS FUSIONNÉE');
{
  /**
   * ⛔ `.vercelignore` ne protège rien avant la fusion. ⚠️ Les fichiers mesurés
   * 200 ci-dessus sont sur `main`, donc en ligne MAINTENANT. Le dire est le
   * seul moyen que la décision soit prise en connaissance de cause.
   */
  const surMain = aRetirer.filter(({ f }) => {
    try { sh(`git cat-file -e main:'${f}' 2>/dev/null`); return true; } catch { return false; }
  });
  console.log(`     ⛔ ${surMain.length} de ces fichiers sont DÉJÀ sur main, donc en ligne :`);
  for (const { f } of surMain) console.log(`        ${f}`);
  dire('⚠️ l exposition est ACTUELLE, pas hypothétique', surMain.length > 0,
    'la correction ne prend effet qu à la fusion');
}

console.log(fautes ? `\n  ⛔ ${fautes} CONTROLE(S) ROUGE(S).\n` : '\n  Tout est vert.\n');
process.exit(fautes ? 1 : 0);
