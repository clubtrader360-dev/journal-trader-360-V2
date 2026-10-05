/**
 * Un brief est-il parti sans rejoindre l'archive ?
 *
 *   GITHUB_TOKEN=… SITE_ARCHIVE_TOKEN=… node outils/verifier-couverture-archive.mjs
 *
 * Rend un verdict sur stdout et sort en code 1 si quelque chose manque.
 *
 * ══ POURQUOI CE CONTRÔLE EXISTE SÉPARÉMENT ═══════════════════════════════════
 *
 * L'étape d'archivage signale déjà ses propres échecs dans la notification Discord
 * du run. Cela couvre UN cas : le dispositif a tourné et il a raté.
 *
 * ⚠️ Cela ne couvre PAS l'autre cas, qui est celui qui s'est réellement produit.
 * La PR #106 ajoutait l'archivage de la culture. Elle n'a jamais été fusionnée. Le
 * workflow de `main` n'a donc jamais porté d'étape d'archivage, aucune étape n'a
 * échoué, aucune notification n'a rien signalé — et la branche `donnees-culture`
 * est restée à deux commits déposés à la main le 23 septembre. Neuf notions ont été
 * publiées dans les briefs entre le 16 et le 28 septembre ; cinq seulement figurent
 * sur la branche. Quatre ont été perdues, sans le moindre signal.
 *
 * Un dispositif qui n'a JAMAIS rien produit doit se signaler au même titre qu'un
 * dispositif qui a cessé de produire. C'est impossible à faire depuis l'intérieur
 * du dispositif : un code absent ne lève pas d'erreur.
 *
 * ══ LE PRINCIPE ══════════════════════════════════════════════════════════════
 *
 * Ce contrôle ne demande RIEN à l'archivage. Il ne lit ni son journal, ni son code,
 * ni le résultat de son étape. Il part d'un fait extérieur — DES BRIEFS SONT PARTIS
 * À CES DATES — et va vérifier que l'archive les porte.
 *
 * La preuve qu'un brief est parti est l'artefact `brief-html-AAAA-MM-JJ` du run, qui
 * porte sa date dans son nom et vit quatorze jours. C'est une preuve indépendante :
 * elle existait avant l'archivage, elle est produite par une autre étape, et elle
 * continuerait d'exister si tout le dispositif d'archivage était retiré du dépôt.
 * C'est ce qui permet de détecter un archivage qui n'a jamais été branché.
 */

import { CIBLE } from './cible-archive.mjs';

const DEPOT_JOURNAL = 'clubtrader360-dev/journal-trader-360-V2';
const BRANCHE_CULTURE = 'donnees-culture';

// ⚠️ LA CIBLE VIENT DU MÊME FICHIER QUE POUR L'ÉCRITURE. Un contrôleur qui
// interroge une autre branche que celle où l'on dépose est pire qu'absent : il rend
// un verdict, et le verdict est faux dans les deux sens. Soit il ne trouve rien et
// crie à tort, soit — le cas qui s'est présenté — il trouve sur `main` ce qu'on y a
// déposé par erreur, et déclare « à jour » une archive que personne ne rend.
const { depot: DEPOT_SITE, branche: BRANCHE_SITE, dossierBriefs: DOSSIER_BRIEFS } = CIBLE;

const jetonJournal = process.env.GITHUB_TOKEN;
const jetonSite = process.env.SITE_ARCHIVE_TOKEN;

async function gh(chemin, jeton) {
  const r = await fetch(`https://api.github.com${chemin}`, {
    headers: {
      accept: 'application/vnd.github+json',
      'x-github-api-version': '2022-11-28',
      ...(jeton ? { authorization: `Bearer ${jeton}` } : {}),
    },
  });
  if (r.status === 404) return { absent: true };
  if (!r.ok) throw new Error(`GET ${chemin} → HTTP ${r.status} ${(await r.text()).slice(0, 160)}`);
  return r.json();
}

/* ─── 1. LES DATES OÙ UN BRIEF EST PARTI ──────────────────────────────────────
   Les artefacts non expirés, dont le nom porte la date. On pagine : cent par page
   suffisent largement pour quatorze jours, mais le dépôt porte d'autres artefacts. */
async function briefsEnvoyes() {
  const parDate = new Map();
  for (let page = 1; page <= 3; page += 1) {
    const r = await gh(`/repos/${DEPOT_JOURNAL}/actions/artifacts?per_page=100&page=${page}`, jetonJournal);
    if (r.absent || !r.artifacts?.length) break;
    for (const a of r.artifacts) {
      const m = /^brief-html-(\d{4}-\d{2}-\d{2})$/.exec(a.name);
      // Le plus RÉCENT gagne : un même jour peut porter plusieurs artefacts si le
      // workflow a été relancé à la main, et c'est le dernier run qui a envoyé.
      if (m && !a.expired && !parDate.has(m[1])) parDate.set(m[1], a.id);
    }
    if (r.artifacts.length < 100) break;
  }
  return [...parDate.entries()].map(([date, id]) => ({ date, id })).sort((a, b) => a.date < b.date ? -1 : 1);
}

/* ─── 2. CE QUE L'ARCHIVE PORTE ─────────────────────────────────────────────── */
async function datesArchivees() {
  // `?ref=` EXPLICITE : sans lui l'API rend le contenu de la branche par défaut.
  const r = await gh(`/repos/${DEPOT_SITE}/contents/${DOSSIER_BRIEFS}?ref=${encodeURIComponent(BRANCHE_SITE)}`, jetonSite);
  if (r.absent) return { jamais: true, dates: [] };
  return {
    jamais: false,
    dates: r.filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f.name)).map((f) => f.name.slice(0, 10)).sort(),
  };
}

async function notionsArchivees() {
  const r = await gh(`/repos/${DEPOT_JOURNAL}/contents/textes?ref=${BRANCHE_CULTURE}`, jetonJournal);
  if (r.absent) return { jamais: true, slugs: [] };
  return { jamais: false, slugs: r.filter((f) => f.name.endsWith('.md')).map((f) => f.name.slice(0, -3)).sort() };
}

/* ─── 3. LA NOTION RÉELLEMENT PUBLIÉE CE JOUR-LÀ ──────────────────────────────
   ⚠️ LUE DANS LE BRIEF, PAS CALCULÉE PAR LA ROTATION.
   La première version appelait `notionDuJour(date)`, la fonction qui CHOISIT la
   notion. Elle a signalé « vwap (2026-09-15) » comme notion perdue : la rotation
   prévoyait bien une notion ce jour-là, mais la rubrique culture n'existait pas
   encore dans le gabarit du brief, et rien n'a été publié. L'audit reprochait donc
   à l'archivage de n'avoir pas conservé un texte qui n'a jamais existé.
   C'est le défaut classique : interroger son modèle de la chose au lieu de la
   chose. On télécharge l'artefact du jour et on y cherche le schéma. Un brief sans
   schéma n'a pas publié de notion, point final. */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

function notionPubliee(artefactId) {
  try {
    const dossier = mkdtempSync(join(tmpdir(), 'archive-audit-'));
    const zip = join(dossier, 'a.zip');
    const octets = execFileSync('curl', ['-sSL', '--max-time', '60',
      '-H', `authorization: Bearer ${jetonJournal}`,
      '-H', 'accept: application/vnd.github+json',
      `https://api.github.com/repos/${DEPOT_JOURNAL}/actions/artifacts/${artefactId}/zip`,
    ], { maxBuffer: 32 * 1024 * 1024, encoding: 'buffer' });
    writeFileSync(zip, octets);
    const html = execFileSync('unzip', ['-p', zip], { maxBuffer: 32 * 1024 * 1024, encoding: 'utf8' });
    const m = /assets\/culture\/([a-z0-9-]+)\.png/.exec(html);
    return m ? m[1] : null;
  } catch (e) {
    // Un artefact illisible n'est pas une notion perdue : on ne sait pas. Le dire.
    return { inconnu: String(e.message).slice(0, 80) };
  }
}

/* ─── VERDICT ─────────────────────────────────────────────────────────────── */
const briefs = await briefsEnvoyes();
const envoyes = briefs.map((b) => b.date);
const archive = await datesArchivees();
const culture = await notionsArchivees();

const lignes = [];
const alertes = [];

lignes.push(`Briefs partis sur la fenêtre des artefacts (14 j) : ${envoyes.length}`
  + (envoyes.length ? ` — du ${envoyes[0]} au ${envoyes.at(-1)}` : ''));
lignes.push(`Briefs archivés sur ${DEPOT_SITE}@${BRANCHE_SITE} : ${archive.dates.length}`
  + (archive.dates.length ? ` — dernier ${archive.dates.at(-1)}` : ''));
lignes.push(`Notions archivées sur ${BRANCHE_CULTURE} : ${culture.slugs.length}`);

if (!envoyes.length) {
  // Pas de reproche à faire à l'archivage : c'est le brief lui-même qui n'est pas
  // parti. Le dire, plutôt que de rendre un vert qui ne veut rien dire.
  alertes.push('AUCUN brief produit depuis 14 jours — ce n\'est pas un défaut d\'archivage, '
    + 'c\'est le brief quotidien qui ne tourne plus. Vérifier le cron de daily-brief.yml.');
} else {
  /* ── Le cas « jamais branché » ──────────────────────────────────────────────
     Traité AVANT le décompte des manquants, et formulé autrement : une archive
     vide alors que des briefs sont partis ne se lit pas comme « trois briefs
     manquent », elle se lit comme « le dispositif n'a jamais rien produit ». */
  const couverts = envoyes.filter((d) => archive.dates.includes(d));
  if (archive.jamais) {
    alertes.push(`ARCHIVE DES BRIEFS INEXISTANTE : le dossier ${DOSSIER_BRIEFS} est absent de `
      + `${DEPOT_SITE}@${BRANCHE_SITE}, alors que ${envoyes.length} brief(s) sont partis. Le dispositif n'a JAMAIS rien produit — `
      + `vérifier qu'il est branché, pas qu'il a échoué.`);
  } else if (couverts.length === 0) {
    alertes.push(`ARCHIVAGE DES BRIEFS JAMAIS DÉCLENCHÉ : aucune des ${envoyes.length} date(s) de la fenêtre `
      + `n'est archivée, alors que l'archive contient ${archive.dates.length} fichier(s) plus anciens. `
      + `L'étape d'archivage ne tourne pas — elle n'échoue pas, elle n'existe pas dans le workflow exécuté.`);
  } else {
    const manquants = envoyes.filter((d) => !archive.dates.includes(d));
    if (manquants.length) {
      alertes.push(`${manquants.length} brief(s) parti(s) et non archivé(s) : ${manquants.join(', ')}`);
    }
  }

  /* ── La culture, même raisonnement ─────────────────────────────────────── */
  const attendues = [];
  const illisibles = [];
  for (const b of briefs) {
    const slug = notionPubliee(b.id);
    if (slug && slug.inconnu) illisibles.push(`${b.date} (${slug.inconnu})`);
    else if (slug) attendues.push({ date: b.date, slug });
  }
  lignes.push(`Notions réellement publiées sur la fenêtre : ${attendues.length}`
    + (illisibles.length ? ` — ${illisibles.length} artefact(s) illisible(s)` : ''));
  if (illisibles.length) {
    alertes.push(`${illisibles.length} artefact(s) de brief illisible(s), la couverture de la culture `
      + `n'a pas pu être vérifiée pour : ${illisibles.join(', ')}`);
  }
  if (attendues.length) {
    const presentes = attendues.filter((a) => culture.slugs.includes(a.slug));
    if (culture.jamais) {
      alertes.push(`ARCHIVE DE CULTURE INEXISTANTE : la branche ${BRANCHE_CULTURE} n'a pas de dossier textes/, `
        + `alors que ${attendues.length} notion(s) ont été publiée(s). Le dispositif n'a JAMAIS rien produit.`);
    } else if (presentes.length === 0) {
      alertes.push(`ARCHIVAGE DE CULTURE JAMAIS DÉCLENCHÉ : aucune des ${attendues.length} notion(s) publiée(s) `
        + `sur la fenêtre n'est sur ${BRANCHE_CULTURE} (qui en porte ${culture.slugs.length}, plus anciennes). `
        + `L'étape ne tourne pas.`);
    } else {
      const perdues = attendues.filter((a) => !culture.slugs.includes(a.slug));
      if (perdues.length) {
        alertes.push(`${perdues.length} notion(s) publiée(s) et non archivée(s) : `
          + perdues.map((a) => `${a.slug} (${a.date})`).join(', '));
      }
    }
  }
}

console.log(lignes.map((l) => `  ${l}`).join('\n'));
if (alertes.length) {
  console.log('\n  ANOMALIES :');
  alertes.forEach((a) => console.log(`   · ${a}`));
} else {
  console.log('\n  ✅ Chaque brief parti est archivé, chaque notion publiée est conservée.');
}

// Sorties destinées au workflow. Écrites même en cas d'anomalie.
if (process.env.GITHUB_OUTPUT) {
  const fs = await import('node:fs');
  fs.appendFileSync(process.env.GITHUB_OUTPUT, [
    `anomalies=${alertes.length}`,
    `resume<<FIN\n${lignes.join('\n')}${alertes.length ? '\n\n' + alertes.map((a) => `· ${a}`).join('\n') : ''}\nFIN`,
    `envoyes=${envoyes.length}`,
    `archives=${archive.dates.length}`,
    '',
  ].join('\n'));
}

process.exit(alertes.length ? 1 : 0);
