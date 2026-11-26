#!/usr/bin/env node
// ========================================================================
// LE BRIEF V22, ÉTAPE PAR ÉTAPE (appelé par .github/workflows/daily-brief.yml).
//
//   collecte  <date> <donnees.json>                  → 0 complet · 3 incomplet
//   alerte    <donnees.json> [run] [tentative]       → alerte Discord de collecte
//   prompt    <donnees.json>                         → bloc de données pour le modèle
//   assembler <donnees.json> <sortie-modele> <corps.html> [motifs.txt] → 0 · 4 refusé
//   alerte-controle <date> <motifs.txt> [run]        → alerte Discord de contrôle
//   apercu    <donnees.json> <sortie-modele> <courriel.html> [members|prospects|archive] [essai]
//
// Webhook : variable DISCORD_ALERTE_URL (absente → l'alerte est seulement journalisée).
// ========================================================================
import fs from 'node:fs';
import { collecterTout, texteAlerteCollecte, texteAlerteControle, alerterDiscord, versPromptV22, lireProse, assembler } from '../api/_lib/brief-cycle.js';
import { rendreCourriel, ICONES_ESSAI, ICONES_SITE } from '../api/_lib/brief-v22.js';
import { notionDuJour } from '../api/_lib/culture-marche.js';
import { formatDateLongFr } from '../api/_lib/date-fr.js';

const [cmd, ...a] = process.argv.slice(2);
const lire = (p) => JSON.parse(fs.readFileSync(p, 'utf8'));
const webhook = process.env.DISCORD_ALERTE_URL || '';

function resume(d) {
  const out = [`Collecte du brief du ${d.dateBrief} (${d.collecteLe})`];
  for (const v of Object.values(d.hier)) {
    if (v.nd) out.push(`  ✗ ${v.nom} séance ${v.seance} : ${v.motif}`);
    else out.push(`  ✓ ${v.nom} séance ${v.seance} : ${v.cloture} (${v.variation > 0 ? '+' : ''}${v.variation} ${v.unite === 'pt' ? 'pt' : '%'}) · ${v.sources.map((s) => `${s.nom} = ${s.cloture} / veille ${s.precedente}`).join(' ; ')}`);
    for (const e of v.essais.filter((x) => x.statut !== 'ok')) out.push(`      · ${e.nom} : ${e.statut}`);
  }
  for (const [k, nom] of [['es', `ES ${d.zones.contrat}`], ['cfd', 'S&P 500 comptant (CFD)']]) {
    const z = d.detailZones[k];
    if (z.nd) out.push(`  ✗ ${nom} séance ${d.zones.seance} : ${z.motif}`);
    else out.push(`  ✓ ${nom} séance ${d.zones.seance} : H ${z.haut} · B ${z.bas} · C ${z.cloture} · ${z.sources.map((s) => `${s.nom} = H ${s.haut} B ${s.bas} C ${s.cloture}`).join(' ; ')}`);
    for (const e of (z.essais || []).filter((x) => x.statut !== 'ok')) out.push(`      · ${e.nom} : ${e.statut}`);
  }
  const es = d.zones.es; const cfd = d.zones.cfd;
  if (typeof es.P === 'number') out.push(`  ES  : clôture ${es.cloture} · POC ${es.poc ?? 'MANQUANT'} · R2 ${es.R2} · R1 ${es.R1} · P ${es.P} · S1 ${es.S1} · S2 ${es.S2}`);
  if (typeof cfd.P === 'number') out.push(`  CFD : clôture ${cfd.cloture} · R2 ${cfd.R2} · R1 ${cfd.R1} · P ${cfd.P} · S1 ${cfd.S1} · S2 ${cfd.S2}`);
  if (d.detailZones.poc) out.push(`  POC : ${d.detailZones.poc.valeur ?? d.detailZones.poc.motif} (${d.detailZones.poc.minutes || 0} minutes, ${d.detailZones.poc.source || 'CNBC'})`);
  out.push(d.complet ? '  → COMPLET' : `  → INCOMPLET : ${d.manquants.map((m) => m.valeur).join(' ; ')}`);
  return out.join('\n');
}

async function main() {
  if (cmd === 'collecte') {
    const d = await collecterTout(a[0]);
    fs.writeFileSync(a[1], JSON.stringify(d, null, 1));
    console.log(resume(d));
    process.exit(d.complet ? 0 : 3);
  }
  if (cmd === 'resume') { console.log(resume(lire(a[0]))); return; }
  if (cmd === 'alerte') {
    const d = lire(a[0]);
    const r = await alerterDiscord(webhook, texteAlerteCollecte(d, { run: a[1] || null, tentative: Number(a[2]) || 1 }));
    console.log(`alerte collecte : ${JSON.stringify(r)}`);
    return;
  }
  if (cmd === 'alerte-controle') {
    const motifs = fs.readFileSync(a[1], 'utf8').split('\n').filter(Boolean);
    const r = await alerterDiscord(webhook, texteAlerteControle(a[0], motifs, { run: a[2] || null }));
    console.log(`alerte contrôle : ${JSON.stringify(r)}`);
    return;
  }
  if (cmd === 'prompt') { process.stdout.write(versPromptV22(lire(a[0]))); return; }
  if (cmd === 'assembler' || cmd === 'apercu') {
    const d = lire(a[0]);
    const notion = notionDuJour(d.dateBrief);
    let prose;
    try { prose = lireProse(fs.readFileSync(a[1], 'utf8')); } catch (e) {
      const m = [`sortie du modèle illisible (${e.message})`];
      if (a[3] && cmd === 'assembler') fs.writeFileSync(a[3], m.join('\n'));
      console.error(m[0]); process.exit(4);
    }
    const r = assembler(d, prose, { urlSchema: notion?.urlSchema, notion });
    if (!r.ok) {
      console.error(`❌ Contrôle refusé (${r.motifs.length}) :\n${r.motifs.map((m) => `  • ${m}`).join('\n')}`);
      if (a[3] && cmd === 'assembler') fs.writeFileSync(a[3], r.motifs.join('\n'));
      process.exit(4);
    }
    if (cmd === 'assembler') {
      fs.writeFileSync(a[2], r.corps);
      console.log(`✅ Corps assemblé et contrôlé (${Buffer.byteLength(r.corps)} octets)`);
      return;
    }
    const variant = a[3] || 'members';
    const html = rendreCourriel({ firstName: variant === 'members' ? 'Emmanuel' : null, dateLongFr: formatDateLongFr(d.dateBrief),
      corpsHtml: r.corps, variant, icones: a[4] === 'essai' ? ICONES_ESSAI : ICONES_SITE });
    fs.writeFileSync(a[2], html);
    console.log(`✅ Aperçu ${variant} : ${a[2]}`);
    return;
  }
  console.error('commande inconnue (collecte | resume | alerte | alerte-controle | prompt | assembler | apercu)');
  process.exit(2);
}
main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
