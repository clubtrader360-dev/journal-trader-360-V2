/**
 * Sonde : le nettoyage d'archive résiste-t-il à l'enrobage réel d'un envoi ?
 *
 *   node outils/verifier-archive-brief.mjs <dossier-de-briefs-md> [<campagne.html>…]
 *
 * ── CE QUE CETTE SONDE RÉPOND ────────────────────────────────────────────────
 * La consigne était de vérifier le nettoyage SUR LE DOCUMENT PRODUIT, pas sur le
 * script de nettoyage. Deux questions distinctes, deux contrôles séparés.
 *
 * 1. LE DOCUMENT PRODUIT EST-IL PROPRE ? (contrôle A)
 *    Balayage des fichiers `.md` d'archive avec une liste de motifs ÉCRITE ICI,
 *    volontairement distincte de celle d'`archiver-brief.mjs`. Deux listes tenues
 *    séparément : si celle du nettoyeur oublie un cas, celle-ci peut encore le
 *    voir. Une seule liste partagée n'aurait rien vérifié — elle aurait seulement
 *    confirmé que le nettoyeur est d'accord avec lui-même.
 *    Le contrôle porte aussi sur ce qui SURVIT : tout hôte d'URL et toute balise
 *    présents dans la sortie sont énumérés et comparés à une liste fermée. Un motif
 *    interdit qu'on n'aurait pas pensé à écrire se voit alors comme un hôte ou une
 *    balise inattendue.
 *
 *    ⛔ `style=` N'EST PLUS INTERDIT : le brief est archivé tel qu'il est parti,
 *    mise en page comprise. C'est son absence qui serait une anomalie.
 *
 * 2. CE QUE BREVO AJOUTE À L'ENVOI EST-IL BIEN ÉCARTÉ ? (contrôle B)
 *    Les fichiers d'archive sont produits depuis les SOURCES DE CAMPAGNE Brevo. Or
 *    ce n'est pas ce que reçoit un élève : à l'envoi, Brevo résout les balises de
 *    fusion et injecte le pixel de suivi, le lien de désinscription et son logo.
 *    Nettoyer la source de campagne ne prouve donc rien sur le courriel reçu — et
 *    c'est pourtant le courriel reçu que traitera l'archivage automatique.
 *
 *    ⚠️ CE CONTRÔLE FABRIQUE LA VERSION ENVOYÉE et la compare à la version source.
 *    Il remplace les balises de fusion par un vrai prénom, injecte les chaînes de
 *    suivi relevées dans un envoi réel du 28/08, puis exige que le corps nettoyé
 *    soit IDENTIQUE, caractère pour caractère, à celui tiré de la source. Pas
 *    « propre » — identique.
 *
 *    C'est ce contrôle qui interdit d'écrire la règle de salutation sur `{{` : la
 *    balise n'existe plus dans le courriel reçu, et une règle calée dessus
 *    laisserait passer « Bonjour Emmanuel, ». La sonde le verrait immédiatement.
 */
import fs from 'node:fs';
import path from 'node:path';
import { extraireCourriel, nettoyer } from './archiver-brief.mjs';
import * as api from '../api/cron/daily-brief.js';

/* ─── Contrôle A : liste tenue à part, exprès ──────────────────────────────── */
const SUSPECTS = [
  [/sendibm|sendinblue|brevo|sib_|mailin/i, 'trace Brevo'],
  [/utm_|\?u=|mk\/(?:cl|op|un)\//i, 'paramètre ou chemin de suivi'],
  [/\{\{|\}\}|%%[A-Z_]+%%/, 'balise de fusion'],
  [/[\w.+-]+@[\w-]+\.[a-z]{2,}/i, 'adresse e-mail'],
  [/d[ée]sinscri|unsubscribe|opt-?out/i, 'désinscription'],
  [/<!--|-->/, 'commentaire HTML'],
  // ⚠️ Motif volontairement ÉTROIT. La version large `/AUDIT/i` signalait
  // « Auditions de la BoE » dans deux briefs : une sonde qui crie sur du texte
  // rédigé est une sonde qu'on finit par ignorer.
  [/AUDIT QUALIT|audit interne|sources? retenues? et [ée]cart/i, 'note de sourcing interne'],
  // La salutation, sous ses deux formes : balise non résolue et prénom résolu.
  // Le motif exige la fin de paragraphe, pour ne pas confondre avec « Bonjour et
  // bon mercredi » qui ouvre deux briefs réels au milieu du corps.
  [/>\s*Bonjour\b[^<]{0,40}<\/p>/i, 'ligne de salutation'],
  [/<script|<iframe|<form\b|\son(?:click|load|error|mouse[a-z]+)\s*=|javascript:/i, 'élément actif'],
  [/CRON_SECRET|Bearer |api-key|BREVO_API/i, 'secret'],
];
const HOTES_ATTENDUS = new Set(['journaltrader360.fr', 'trader360.fr', 'www.trader360.fr']);
// Le vocabulaire d'un courriel : tableaux de mise en page, styles en ligne, rien de
// plus exotique. Une balise hors de cette liste signale que l'enveloppe a changé.
const BALISES_ATTENDUES = new Set(['div', 'table', 'tbody', 'thead', 'tr', 'td', 'th',
  'p', 'h1', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'b', 'em', 'i', 'span', 'br',
  'a', 'img', 'hr', 'small', 'sup', 'sub']);

function controleA(dossier) {
  const fichiers = fs.readdirSync(dossier).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort();
  if (!fichiers.length) return { fichiers: 0, echecs: ['aucun fichier d\'archive trouvé'] };
  const echecs = [];
  const hotes = new Set(); const balises = new Set();
  let stylesMin = Infinity;
  for (const f of fichiers) {
    // L'en-tête de collection est examiné avec le corps : un prénom passé dans la
    // description serait tout aussi publié.
    const brut = fs.readFileSync(path.join(dossier, f), 'utf8');
    for (const [motif, libelle] of SUSPECTS) {
      const m = motif.exec(brut);
      if (m) echecs.push(`${f} : ${libelle} → ${m[0].slice(0, 50).replace(/\s+/g, ' ')}`);
    }
    for (const m of brut.matchAll(/(?:href|src)="([^"]*)"/g)) {
      if (m[1].startsWith('/')) { hotes.add('(relatif)'); continue; }
      try { hotes.add(new URL(m[1]).hostname); }
      catch { echecs.push(`${f} : URL illisible → ${m[1].slice(0, 40)}`); }
    }
    for (const m of brut.matchAll(/<([a-z][a-z0-9]*)[\s>]/gi)) balises.add(m[1].toLowerCase());
    stylesMin = Math.min(stylesMin, (brut.match(/\bstyle\s*=/gi) || []).length);
  }
  for (const h of hotes) if (h !== '(relatif)' && !HOTES_ATTENDUS.has(h)) echecs.push(`hôte inattendu : ${h}`);
  for (const b of balises) if (!BALISES_ATTENDUES.has(b)) echecs.push(`balise inattendue : <${b}>`);
  // ⚠️ Contrôle POSITIF. Depuis le passage à la fidélité, un brief sans styles en
  // ligne serait un brief dont la mise en page a été perdue en route — défaut qui
  // ne déclencherait aucun des motifs interdits ci-dessus.
  if (stylesMin < 30) echecs.push(`un brief ne porte que ${stylesMin} style(s) en ligne : mise en page perdue`);
  return { fichiers: fichiers.length, echecs, hotes: [...hotes].sort(), balises: [...balises].sort(), stylesMin };
}

/* ─── Contrôle B : la version ENVOYÉE, fabriquée ───────────────────────────── */

// Relevé sur l'envoi réel du 28/08/2026 à la boîte du coach. Ces chaînes ne sont
// PAS inventées : ce sont celles que Brevo dépose autour du courriel, en frères du
// div d'enveloppe.
const SUIVI_BREVO_REEL = `
 <!--[if mso]> <img width="1" height="1" src="https://nwor1.r.ag.d.sendibm3.com/mk/op/sh/SMJz09hnzmooCAimqCECONYHZrST/PcDfKctxrceQ" /> <![endif]-->
 <!--[if !mso]> <!----> <img style="display:none" src="https://nwor1.r.ag.d.sendibm3.com/mk/op/sh/SMJz09hnzmooCAimqCECONYHZrST/PcDfKctxrceQ" /> <!-- <![endif]-->`;
const PIED_BREVO_REEL = `
 <div align="center" style="color: #727272; font-size: 10px;">Si vous souhaitez vous désinscrire de notre newsletter, cliquez <a style="color:#01a4c6;" target="_blank" href="https://nwor1.r.ag.d.sendibm3.com/mk/un/v2/sh/SMJz09a0vkbXq5F74S4PFafAK9qL/6rYisfevzAMy">ici</a></div>
 <div style="font:normal 10px Arial; color:#ccc; text-align:center;">
   <a href="https://nwor1.r.ag.d.sendibm3.com/tracking/?utm_campaign=2193ce755ee458e22fa0999e64b7d27c&amp;utm_medium=email&amp;utm_source=logo_mailin">
     <img alt="Mailin" src="https://nwor1.r.ag.d.sendibm3.com/public/images/logo_nb_en.png" width="129" height="48" />
   </a>
 </div>`;

/** Ce que Brevo fait de la source de campagne au moment de l'envoi. */
function commeEnvoye(source, prenom) {
  return source
    // Résolution des balises de fusion : c'est là que « {{ contact.PRENOM… }} »
    // devient un vrai prénom, et que toute règle calée sur `{{` cesse de mordre.
    .replace(/\{\{[^}]*\}\}/g, prenom)
    .replace(/(<body[^>]*>)/i, `$1${SUIVI_BREVO_REEL}`)
    .replace(/(<\/body>)/i, `${PIED_BREVO_REEL}$1`);
}

function controleB(sources) {
  const echecs = [];
  let compares = 0;
  for (const source of sources) {
    const nom = path.basename(source);
    const brut = fs.readFileSync(source, 'utf8');
    const enveloppe = extraireCourriel(brut);
    if (!enveloppe) { echecs.push(`${nom} : enveloppe introuvable, comparaison impossible`); continue; }
    const depuisLaSource = nettoyer(enveloppe);

    for (const prenom of ['Emmanuel', 'Coach', 'Jean-Luc']) {
      const envoye = commeEnvoye(brut, prenom);
      const env = extraireCourriel(envoye);
      if (!env) { echecs.push(`${nom} (${prenom}) : enveloppe perdue dans la version envoyée`); continue; }
      const depuisLEnvoi = nettoyer(env);
      compares += 1;

      if (depuisLEnvoi !== depuisLaSource) {
        const i = [...depuisLEnvoi].findIndex((c, k) => c !== depuisLaSource[k]);
        const ou = i < 0
          ? `longueurs différentes (${depuisLEnvoi.length} contre ${depuisLaSource.length})`
          : `divergence à l'octet ${i} → « ${depuisLEnvoi.slice(Math.max(0, i - 40), i + 50).replace(/\s+/g, ' ')} »`;
        echecs.push(`${nom} (${prenom}) : l'enrobage d'envoi laisse une trace — ${ou}`);
      }
      for (const [motif, libelle] of SUSPECTS) {
        if (motif.test(depuisLEnvoi)) echecs.push(`${nom} (${prenom}) : ${libelle} a survécu à l'envoi`);
      }
      if (depuisLEnvoi.includes(prenom)) echecs.push(`${nom} : le prénom « ${prenom} » survit dans l'archive`);
    }
  }
  return { compares, echecs };
}

/* ─── Contrôle C : les deux chemins produisent-ils le même document ? ───────
 *
 * ══ CE QUE CE CONTRÔLE EXISTE POUR ATTRAPER ═════════════════════════════════
 * Toute la conception tient à une phrase : UNE SEULE ROUTINE, deux appelants. Mais
 * les deux appelants ne partent pas de la même chose, et c'est là que ça casse.
 *
 *   · le RATTRAPAGE part d'une source de campagne Brevo : le courriel complet,
 *     enveloppe comprise ;
 *   · l'AUTOMATIQUE part de `/tmp/brief.html`, qui n'est QUE le corps. L'enveloppe
 *     est posée plus tard, par `wrapBriefHtml()`, au moment de l'envoi.
 *
 * Archiver `/tmp/brief.html` tel quel aurait produit un brief sans bandeau ni
 * carte, et le défaut ne se serait vu qu'au premier envoi réel, sur la page
 * publiée. Le workflow rejoue donc la chaîne de l'endpoint — stripLongDashes,
 * stripAuditComment, wrapBriefHtml — et c'est cela qu'on vérifie ici.
 *
 * ⚠️ Un écart RÉEL a été trouvé par ce chemin : l'endpoint écrit les séparateurs
 * de paramètres `&amp;`, Brevo les stocke `&`. `new URL()` lisait alors
 * « amp;utm_medium », qui ne commence pas par `utm_`, et le paramètre de campagne
 * survivait. Le rattrapage n'avait jamais rencontré la graphie échappée.
 *
 * Le critère est l'IDENTITÉ, caractère pour caractère. Deux documents « propres »
 * mais différents signifieraient que l'archive n'a pas la même tête selon le jour
 * où elle a été produite. */
function controleC(sources) {
  const echecs = [];
  const horsGabarit = [];
  let compares = 0;

  // ⚠️ LE GABARIT D'ENVELOPPE A CHANGÉ EN COURS DE ROUTE. Les briefs d'août
  // portaient un logo et un titre ; depuis, c'est un bandeau, versionné (-v2, -v3).
  // Reconstruire un brief d'août avec le gabarit d'aujourd'hui ne peut pas rendre
  // l'enveloppe d'août : la divergence serait réelle, mais elle ne dirait rien du
  // nettoyage. On repère donc le bandeau que produit le gabarit COURANT, et on
  // écarte explicitement les campagnes qui ne le portent pas — en le DISANT, plutôt
  // qu'en les comparant quand même ou en les ignorant en silence.
  // Le repère se met à jour tout seul : le jour du bandeau v4, les briefs v3
  // sortiront du champ sans qu'on touche à ce fichier.
  const temoin = api.wrapBriefHtml({ firstName: null, dateLongFr: 'lundi 1 janvier 2026', briefHtml: '<div class="brief-marche"></div>' });
  const bandeauCourant = (/assets\/(brief-header[^"']*)/i.exec(temoin) || [])[1] || null;

  for (const source of sources) {
    const nom = path.basename(source);
    const campagne = fs.readFileSync(source, 'utf8');
    if (bandeauCourant && !campagne.includes(bandeauCourant)) {
      horsGabarit.push(`${nom} : enveloppe antérieure au gabarit courant (${bandeauCourant} absent)`);
      continue;
    }

    // Ce que le workflow trouve dans /tmp/brief.html : le corps seul.
    const ouv = /<div[^>]*\bbrief-marche\b[^>]*>/i.exec(campagne);
    if (!ouv) { echecs.push(`${nom} : corps « brief-marche » introuvable`); continue; }
    let prof = 1; const bal = /<(\/?)div\b[^>]*>/gi; bal.lastIndex = ouv.index + ouv[0].length;
    let corps = null;
    for (let t; (t = bal.exec(campagne));) {
      prof += t[1] ? -1 : 1;
      if (prof === 0) { corps = campagne.slice(ouv.index, t.index + t[0].length); break; }
    }
    if (!corps) { echecs.push(`${nom} : corps non refermé`); continue; }

    // La date affichée dans l'enveloppe, reprise de la campagne : sans elle les
    // deux documents différeraient sur une ligne qui n'a rien à voir avec le sujet.
    const dateAff = /<p[^>]*font-style:italic[^>]*>([^<]+)<\/p>/i.exec(campagne);

    let auto;
    try {
      let h = corps;
      h = api.stripLongDashes(h).html;
      h = api.stripAuditComment(h).html;
      const courriel = api.wrapBriefHtml({
        firstName: null,
        dateLongFr: (dateAff ? dateAff[1] : '').replace(/^./, (c) => c.toLowerCase()).trim(),
        briefHtml: h,
      });
      auto = nettoyer(extraireCourriel(courriel) ?? '');
    } catch (e) { echecs.push(`${nom} : chaîne d'envoi impossible — ${e.message}`); continue; }

    const rattrapage = nettoyer(extraireCourriel(campagne) ?? '');
    compares += 1;

    if (auto !== rattrapage) {
      const n = Math.min(auto.length, rattrapage.length);
      let i = 0; while (i < n && auto[i] === rattrapage[i]) i += 1;
      echecs.push(`${nom} : les deux chemins divergent à l'octet ${i} — `
        + `auto « ${auto.slice(Math.max(0, i - 25), i + 45).replace(/\s+/g, ' ')} » / `
        + `rattrapage « ${rattrapage.slice(Math.max(0, i - 25), i + 45).replace(/\s+/g, ' ')} »`);
    }
    for (const [motif, libelle] of SUSPECTS) {
      if (motif.test(auto)) echecs.push(`${nom} : ${libelle} survit sur le chemin AUTOMATIQUE`);
    }
  }
  return { compares, echecs, horsGabarit };
}

/* ─── Exécution ───────────────────────────────────────────────────────────── */
const [dossier, ...sources] = process.argv.slice(2);
if (!dossier) {
  console.error('usage : node outils/verifier-archive-brief.mjs <dossier-md> [<campagne.html>…]');
  process.exit(2);
}

const a = controleA(dossier);
console.log(`── Contrôle A — ${a.fichiers} fichier(s) d'archive balayés`);
console.log(`   hôtes d'URL ....... ${a.hotes?.join(', ') || 'aucune URL'}`);
console.log(`   balises ........... ${a.balises?.join(' ') ?? ''}`);
console.log(`   styles en ligne ... ${a.stylesMin} au minimum par brief`);
console.log(`   ${a.echecs.length ? `❌ ${a.echecs.length} anomalie(s)` : '✅ rien à signaler'}`);
a.echecs.slice(0, 20).forEach((e) => console.log(`      · ${e}`));

let b = { compares: 0, echecs: [] };
if (sources.length) {
  b = controleB(sources);
  console.log(`\n── Contrôle B — ${b.compares} version(s) « telle qu'envoyée » fabriquée(s) et comparée(s)`);
  console.log(`   ${b.echecs.length ? `❌ ${b.echecs.length} anomalie(s)` : '✅ corps identique à celui tiré de la source, aucune trace d\'envoi'}`);
  b.echecs.slice(0, 20).forEach((e) => console.log(`      · ${e}`));
} else {
  console.log('\n── Contrôle B non exécuté : aucune source de campagne fournie.');
}

let c = { compares: 0, echecs: [] };
if (sources.length) {
  c = controleC(sources);
  console.log(`\n── Contrôle C — ${c.compares} document(s) produit(s) par les DEUX chemins et comparé(s)`);
  console.log(`   ${c.echecs.length ? `❌ ${c.echecs.length} anomalie(s)` : '✅ le chemin automatique rend exactement le même document que le rattrapage'}`);
  c.echecs.slice(0, 10).forEach((e) => console.log(`      · ${e}`));
  c.horsGabarit.forEach((e) => console.log(`      ⏭️ ${e}`));
}

process.exit(a.echecs.length + b.echecs.length + c.echecs.length ? 1 : 0);
