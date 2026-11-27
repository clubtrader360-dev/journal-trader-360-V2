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
//   ── Échéance de 6h45 (Manu, 26/11/2026 21h : le brief n'est plus jamais bloqué) ──
//   figer     <donnees.json> [run]                   → marque l'échéance, alerte n/d en UNE ligne
//   secours   <donnees.json> <corps.html> [motifs.txt] [run] → brief « données seules » + alerte
//   apercu-corps <donnees.json> <corps.html> <courriel.html> [variant] [essai]
//   nd        <donnees.json>                         → les n/d du brief, une ligne (Discord)
//
// Webhook : variable DISCORD_ALERTE_URL (absente → l'alerte est seulement journalisée).
// L'alerte de l'heure limite (figer) lit DISCORD_ALERTE_ECHEANCE_URL : le workflow la
// renseigne même quand il vide DISCORD_ALERTE_URL (une ligne par run, Manu 27/11/2026).
// ========================================================================
import fs from 'node:fs';
import { collecterTout, texteAlerteCollecte, texteAlerteControle, texteAlerteNd, texteAlerteSecours, alerterDiscord, versPromptV22, lireProse, assembler, assemblerSecours } from '../api/_lib/brief-cycle.js';
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
    else out.push(`  ✓ ${v.nom} séance ${v.seance} : ${v.cloture} / veille ${v.precedente} (${v.variation > 0 ? '+' : ''}${v.variation} ${v.unite === 'pt' ? 'pt' : '%'}) · ${v.sources.map((s) => `${s.nom} [${s.role}]${s.cloture !== undefined ? ` clôture ${s.cloture}` : ''}${s.precedente !== undefined ? ` veille ${s.precedente}` : ''}`).join(' ; ')}`);
    for (const e of v.essais.filter((x) => x.statut !== 'ok')) out.push(`      · ${e.nom} : ${e.statut}`);
  }
  for (const [k, nom] of [['es', `ES ${d.zones.contrat}`], ['cfd', 'S&P 500 comptant (CFD)']]) {
    const z = d.detailZones[k];
    if (z.nd) out.push(`  ✗ ${nom} séance ${d.zones.seance} : ${z.motif}`);
    else out.push(`  ✓ ${nom} séance ${d.zones.seance} : H ${z.haut} · B ${z.bas} · C ${z.cloture} · ${z.sources.map((s) => `${s.nom} [${s.role}]`).join(' ; ')}`);
    for (const e of (z.essais || []).filter((x) => x.statut !== 'ok')) out.push(`      · ${e.nom} : ${e.statut}`);
  }
  const es = d.zones.es; const cfd = d.zones.cfd;
  if (typeof es.P === 'number') out.push(`  ES  : clôture ${es.cloture} · POC ${es.poc ?? 'MANQUANT'} · R2 ${es.R2} · R1 ${es.R1} · P ${es.P} · S1 ${es.S1} · S2 ${es.S2}`);
  if (typeof cfd.P === 'number') out.push(`  CFD : clôture ${cfd.cloture} · R2 ${cfd.R2} · R1 ${cfd.R1} · P ${cfd.P} · S1 ${cfd.S1} · S2 ${cfd.S2}`);
  if (d.detailZones.poc) out.push(`  POC : ${d.detailZones.poc.valeur ?? d.detailZones.poc.motif}${d.detailZones.poc.source ? ` (${d.detailZones.poc.minutes || 0} barres, ${d.detailZones.poc.source} [${d.detailZones.poc.role}])` : ''}`);
  out.push(d.complet ? '  → COMPLET' : `  → INCOMPLET${d.echeance ? ' À L\'ÉCHÉANCE, partent en n/d' : ''} : ${d.manquants.map((m) => m.valeur).join(' ; ')}`);
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
  if (cmd === 'figer') {
    const d = lire(a[0]);
    d.echeance = true;
    fs.writeFileSync(a[0], JSON.stringify(d, null, 1));
    console.log(resume(d));
    const webhookEcheance = process.env.DISCORD_ALERTE_ECHEANCE_URL || webhook;
    if (!d.complet) console.log(`alerte n/d : ${JSON.stringify(await alerterDiscord(webhookEcheance, texteAlerteNd(d, { run: a[1] || null })))}`);
    return;
  }
  if (cmd === 'nd') {
    const d = lire(a[0]);
    process.stdout.write(d.complet ? '' : d.manquants.map((m) => m.valeur).join(' ; '));
    return;
  }
  if (cmd === 'secours') {
    const d = lire(a[0]);
    d.echeance = true;
    const motifs = a[2] && fs.existsSync(a[2]) ? fs.readFileSync(a[2], 'utf8').split('\n').filter(Boolean) : ['aucune prose du modèle'];
    const r = assemblerSecours(d);
    if (!r.ok) { console.error(`❌ Brief de secours refusé :\n${r.motifs.map((m) => `  • ${m}`).join('\n')}`); process.exit(4); }
    fs.writeFileSync(a[1], r.corps);
    console.log(`🟠 Brief « données seules » assemblé et contrôlé (${Buffer.byteLength(r.corps)} octets)`);
    console.log(`alerte secours : ${JSON.stringify(await alerterDiscord(webhook, texteAlerteSecours(d.dateBrief, motifs, { run: a[3] || null })))}`);
    return;
  }
  if (cmd === 'apercu-corps') {
    const d = lire(a[0]);
    const variant = a[3] || 'members';
    fs.writeFileSync(a[2], rendreCourriel({ firstName: variant === 'members' ? 'Emmanuel' : null, dateLongFr: formatDateLongFr(d.dateBrief),
      corpsHtml: fs.readFileSync(a[1], 'utf8'), variant, icones: a[4] === 'essai' ? ICONES_ESSAI : ICONES_SITE }));
    console.log(`✅ Aperçu ${variant} : ${a[2]}`);
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
      // Prose survolable : mesures et corrections du gras, au journal (jamais un refus).
      if (r.mesures) console.log(`📏 Prose : ${JSON.stringify(r.mesures)}`);
      for (const c of r.corrections || []) console.log(`✂️ ${c}`);
      return;
    }
    const variant = a[3] || 'members';
    const html = rendreCourriel({ firstName: variant === 'members' ? 'Emmanuel' : null, dateLongFr: formatDateLongFr(d.dateBrief),
      corpsHtml: r.corps, variant, icones: a[4] === 'essai' ? ICONES_ESSAI : ICONES_SITE });
    fs.writeFileSync(a[2], html);
    console.log(`✅ Aperçu ${variant} : ${a[2]}`);
    return;
  }
  console.error('commande inconnue (collecte | resume | alerte | alerte-controle | figer | nd | secours | apercu-corps | prompt | assembler | apercu)');
  process.exit(2);
}
main().catch((e) => { console.error(e.stack || e.message); process.exit(1); });
