/**
 * Sonde : le nettoyage d'archive résiste-t-il à l'enrobage réel d'un envoi ?
 *
 *   node outils/verifier-archive-brief.mjs <dossier-de-briefs-md> [<brief.html>…]
 *
 * ── CE QUE CETTE SONDE RÉPOND ────────────────────────────────────────────────
 * La consigne était de vérifier le nettoyage SUR LE DOCUMENT PRODUIT, pas sur le
 * script de nettoyage. Deux questions distinctes, et deux contrôles séparés.
 *
 * 1. LE DOCUMENT PRODUIT EST-IL PROPRE ? (contrôle A)
 *    Balayage des fichiers `.md` d'archive avec une liste de motifs ÉCRITE ICI,
 *    volontairement distincte de celle d'`archiver-brief.mjs`. Deux listes tenues
 *    séparément : si celle du nettoyeur oublie un cas, celle-ci peut encore le
 *    voir. Une seule liste partagée n'aurait rien vérifié du tout — elle aurait
 *    seulement confirmé que le nettoyeur est d'accord avec lui-même.
 *    Le contrôle porte aussi sur ce qui SURVIT : tout hôte d'URL, tout attribut,
 *    toute balise présents dans la sortie sont énumérés et comparés à une liste
 *    fermée. Un motif interdit qu'on n'aurait pas pensé à écrire se voit alors
 *    comme un hôte ou un attribut inattendu.
 *
 * 2. L'ENROBAGE D'ENVOI EST-IL BIEN ÉCARTÉ ? (contrôle B)
 *    Les fichiers d'archive ont été produits depuis les campagnes Brevo, dont le
 *    HTML ne porte PAS encore le pixel de suivi, le lien de désinscription ni le
 *    prénom résolu : Brevo les injecte à l'envoi. Nettoyer ce HTML-là ne prouve
 *    donc rien sur ce que reçoit un élève.
 *
 *    ⚠️ Ce contrôle ne recopie pas un courriel reçu : il RECONSTRUIT l'enrobage en
 *    appelant `wrapBriefHtml()`, la fonction d'envoi elle-même, puis y ajoute les
 *    chaînes de suivi telles qu'elles ont été relevées dans un envoi réel du
 *    28/08 (pixel `sendibm3`, lien de désinscription, logo Mailin, utm_campaign).
 *    Deux avantages sur une copie : la sonde suit le gabarit d'envoi quand il
 *    change, et elle reste rejouable.
 *
 *    Le critère est strict : le corps nettoyé de l'enrobage complet doit être
 *    IDENTIQUE, caractère pour caractère, au corps nettoyé du brief seul. Pas
 *    « propre » — identique. Un enrobage qui laisserait la moindre trace ferait
 *    diverger les deux chaînes, même si la trace n'était dans aucune liste.
 */
import fs from 'node:fs';
import path from 'node:path';
import { extraireBrief, nettoyer } from './archiver-brief.mjs';

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
  // rédigé est une sonde qu'on finit par ignorer. On cherche le marqueur réel du
  // bloc interne, tel qu'il apparaît dans les briefs du 28, 29, 31/08 et 01/09.
  [/AUDIT QUALIT|audit interne|sources? retenues? et [ée]cart/i, 'note de sourcing interne'],
  [/Bonjour\s+[A-ZÀ-Ý][\p{L}'-]+\s*[,!]/u, 'adresse nominative'],
  [/style=|bgcolor=|cellpadding=|role="presentation"/i, 'balisage de courriel'],
  [/<script|<iframe|<form|on(?:click|load|error)=/i, 'élément actif'],
  [/CRON_SECRET|Bearer |api-key/i, 'secret'],
];
const HOTES_ATTENDUS = new Set(['journaltrader360.fr', 'trader360.fr']);
const BALISES_ATTENDUES = new Set(['p', 'h2', 'h3', 'ul', 'ol', 'li', 'strong', 'em', 'br',
  'aside', 'div', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'img', 'a']);
const ATTRIBUTS_ATTENDUS = new Set(['class', 'src', 'alt', 'loading', 'href', 'colspan']);

function controleA(dossier) {
  const fichiers = fs.readdirSync(dossier).filter((f) => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort();
  if (!fichiers.length) return { fichiers: 0, echecs: ['aucun fichier d\'archive trouvé'] };
  const echecs = [];
  const hotes = new Set(); const balises = new Set(); const attributs = new Set();
  for (const f of fichiers) {
    const brut = fs.readFileSync(path.join(dossier, f), 'utf8');
    // L'en-tête de collection est examiné avec le corps : un « Bonjour Prénom »
    // passé dans la description serait tout aussi publié.
    for (const [motif, libelle] of SUSPECTS) {
      const m = motif.exec(brut);
      if (m) echecs.push(`${f} : ${libelle} → ${m[0].slice(0, 50)}`);
    }
    for (const m of brut.matchAll(/(?:href|src)="([^"]*)"/g)) {
      try { hotes.add(new URL(m[1], 'https://journaltrader360.fr').hostname); }
      catch { echecs.push(`${f} : URL illisible → ${m[1].slice(0, 40)}`); }
    }
    for (const m of brut.matchAll(/<([a-z][a-z0-9]*)((?:\s[^>]*)?)>/gi)) {
      balises.add(m[1].toLowerCase());
      for (const a of m[2].matchAll(/\b([a-z-]+)=/gi)) attributs.add(a[1].toLowerCase());
    }
  }
  for (const h of hotes) if (!HOTES_ATTENDUS.has(h)) echecs.push(`hôte inattendu dans une URL : ${h}`);
  for (const b of balises) if (!BALISES_ATTENDUES.has(b)) echecs.push(`balise inattendue : <${b}>`);
  for (const a of attributs) if (!ATTRIBUTS_ATTENDUS.has(a)) echecs.push(`attribut inattendu : ${a}=`);
  return { fichiers: fichiers.length, echecs, hotes: [...hotes], balises: [...balises].sort(),
           attributs: [...attributs].sort() };
}

/* ─── Contrôle B : l'enrobage d'envoi, reconstruit ─────────────────────────── */

// Relevé sur l'envoi réel du 28/08/2026 à clubtrader360@gmail.com. Ces chaînes ne
// sont PAS inventées : ce sont celles que Brevo ajoute autour du courriel.
const SUIVI_BREVO_REEL = `
 <!--[if mso]> <img width="1" height="1" src="https://nwor1.r.ag.d.sendibm3.com/mk/op/sh/SMJz09hnzmooCAimqCECONYHZrST/PcDfKctxrceQ" /> <![endif]-->
 <!--[if !mso]> <!----> <img style="display:none" src="https://nwor1.r.ag.d.sendibm3.com/mk/op/sh/SMJz09hnzmooCAimqCECONYHZrST/PcDfKctxrceQ" /> <!-- <![endif]-->
 <div align="center" style="color: #727272; font-size: 10px;">Si vous souhaitez vous désinscrire de notre newsletter, cliquez <a style="color:#01a4c6;" target="_blank" href="https://nwor1.r.ag.d.sendibm3.com/mk/un/v2/sh/SMJz09a0vkbXq5F74S4PFafAK9qL/6rYisfevzAMy">ici</a></div>
 <div style="font:normal 10px Arial; color:#ccc; text-align:center;">
   <a href="https://nwor1.r.ag.d.sendibm3.com/tracking/?utm_campaign=2193ce755ee458e22fa0999e64b7d27c&amp;utm_medium=email&amp;utm_source=logo_mailin">
     <img alt="Mailin" src="https://nwor1.r.ag.d.sendibm3.com/public/images/logo_nb_en.png" width="129" height="48" />
   </a>
 </div>`;

async function controleB(sources) {
  const { wrapBriefHtml } = await import('../api/cron/daily-brief.js');
  const echecs = [];
  let compares = 0;
  for (const source of sources) {
    const nom = path.basename(source);
    const interieur = extraireBrief(fs.readFileSync(source, 'utf8'));
    if (!interieur) { echecs.push(`${nom} : wrapper introuvable, comparaison impossible`); continue; }
    // ⚠️ Le wrapper est REMIS avant l'enrobage. `extraireBrief` rend l'INTÉRIEUR du
    // <div class="brief-marche">, et l'envoyer tel quel à `wrapBriefHtml` produisait
    // un courriel sans wrapper : l'extraction rendait alors une chaîne vide, et la
    // comparaison la déclarait « préfixe » du brief nu. Symptôme : une divergence
    // annoncée à l'octet -1, c'est-à-dire nulle part. Une sonde qui compare du vide
    // à du contenu ne teste rien, et elle l'annonce en vert si on lit mal.
    const brief = `<div class="brief-marche">${interieur}</div>`;
    const nu = nettoyer(interieur);

    for (const prenom of ['Emmanuel', 'Coach', 'Jean-Luc']) {
      const enrobe = wrapBriefHtml({
        firstName: prenom, dateLongFr: 'lundi 28 septembre 2026', briefHtml: brief,
      }) + SUIVI_BREVO_REEL;
      const habille = nettoyer(extraireBrief(enrobe) ?? '');
      if (habille !== nu) {
        const i = [...habille].findIndex((c, k) => c !== nu[k]);
        echecs.push(`${nom} (prénom ${prenom}) : l'enrobage laisse une trace, divergence à l'octet ${i} `
          + `→ « ${habille.slice(Math.max(0, i - 30), i + 40)} »`);
      }
      compares += 1;
      // Contrôle direct, en plus de l'égalité : aucune des chaînes de suivi ne
      // doit apparaître, et le prénom injecté ne doit nulle part ressortir.
      for (const [motif, libelle] of SUSPECTS) {
        if (motif.test(habille)) echecs.push(`${nom} (prénom ${prenom}) : ${libelle} a survécu à l'enrobage`);
      }
      if (habille.includes(prenom)) echecs.push(`${nom} : le prénom « ${prenom} » survit dans l'archive`);
    }
  }
  return { compares, echecs };
}

/* ─── Exécution ───────────────────────────────────────────────────────────── */
const [dossier, ...sources] = process.argv.slice(2);
if (!dossier) {
  console.error('usage : node outils/verifier-archive-brief.mjs <dossier-md> [<brief.html>…]');
  process.exit(2);
}

const a = controleA(dossier);
console.log(`── Contrôle A — ${a.fichiers} fichier(s) d'archive balayés`);
console.log(`   hôtes d'URL ....... ${a.hotes?.length ? a.hotes.join(', ') : 'aucune URL'}`);
console.log(`   balises ........... ${a.balises?.join(' ') ?? ''}`);
console.log(`   attributs ......... ${a.attributs?.join(' ') ?? 'aucun'}`);
console.log(`   ${a.echecs.length ? `❌ ${a.echecs.length} anomalie(s)` : '✅ rien à signaler'}`);
a.echecs.slice(0, 20).forEach((e) => console.log(`      · ${e}`));

let b = { compares: 0, echecs: [] };
if (sources.length) {
  b = await controleB(sources);
  console.log(`\n── Contrôle B — ${b.compares} enrobage(s) reconstruit(s) et comparé(s)`);
  console.log(`   ${b.echecs.length ? `❌ ${b.echecs.length} anomalie(s)` : '✅ corps identique au brief nu, aucune trace d\'enrobage'}`);
  b.echecs.slice(0, 20).forEach((e) => console.log(`      · ${e}`));
} else {
  console.log('\n── Contrôle B non exécuté : aucun fichier source fourni.');
}

process.exit(a.echecs.length + b.echecs.length ? 1 : 0);
