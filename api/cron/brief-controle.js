// ========================================
// API ROUTE : CONTRÔLE DE 6H45 DU BRIEF MARCHÉ (v22)
// Route : /api/cron/brief-controle?saison=hiver|ete
// Cron Vercel : 6h45 Paris du lundi au vendredi (5h45 UTC en hiver, 4h45 UTC en été).
// ========================================
// 6h45 = échéance d'envoi du brief. Si l'étiquette brief-envoye-<date> manque et
// qu'aucun run n'est en cours, le brief n'est pas parti : on relance le workflow UNE
// fois (mode=production) et on poste UNE ligne sur Discord, même webhook que les
// alertes du brief (DISCORD_CRON_WEBHOOK_URL). Brief parti ou en cours : rien.
//
// Test : ?mode=apercu relance en mode apercu (aucun envoi aux listes) quel que soit
// l'état, et ne poste sur Discord que si &discord=oui (ligne marquée 🧪 TEST).
// La réponse dit ce que la production aurait fait (champ `production`).
// ========================================

import { garde, decisionProduction, lancerBrief, infosParis } from './brief-declencheur.js';

const MANU = '710969599948095581';

async function posterDiscord(ligne) {
  const url = process.env.DISCORD_CRON_WEBHOOK_URL;
  if (!url) throw new Error('DISCORD_CRON_WEBHOOK_URL manquant');
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: ligne, allowed_mentions: { users: [MANU] } }),
  });
  if (!r.ok) throw new Error(`Discord ${r.status}`);
}

function ligneDiscord(run, test) {
  const [, mm, jj] = infosParis().date.split('-');
  const lien = run ? ` [run](<${run}>)` : '';
  return `${test ? '🧪 TEST ' : ''}<@${MANU}> ❌ Brief du ${jj}/${mm} pas parti à 6h45, relance automatique lancée.${lien}`;
}

export default async function handler(req, res) {
  const nom = 'BRIEF-CONTROLE';
  if (garde(req, res, { nom })) return;
  const apercu = req.query?.mode === 'apercu';
  try {
    const d = await decisionProduction({ saisonCron: req.query?.saison });
    console.log(`[${nom}] production : ${d.agir ? 'relance' : 'rien'} (${d.raison})`);
    if (!apercu && !d.agir) return res.status(200).json({ relance: false, raison: d.raison, etat: d.etat });

    const run = await lancerBrief(apercu ? 'apercu' : 'production');
    console.log(`[${nom}] ${apercu ? '🧪 aperçu' : '🔁 relance'} lancée : ${run}`);
    let discord = 'non posté';
    if (!apercu || req.query?.discord === 'oui') {
      try { await posterDiscord(ligneDiscord(run, apercu)); discord = 'posté'; }
      catch (e) { discord = `échec : ${e.message}`; console.error(`[${nom}] ❌ Discord ${e.message}`); }
    }
    return res.status(200).json(apercu
      ? { mode: 'apercu', run, discord, production: d }
      : { relance: true, run, discord, raison: d.raison, etat: d.etat });
  } catch (e) {
    console.error(`[${nom}] ❌ ${e.message}`);
    // Contrôle ou relance impossible (GitHub, jeton) : on le dit quand même sur Discord.
    if (!apercu) {
      const [, mm, jj] = infosParis().date.split('-');
      await posterDiscord(`<@${MANU}> ❌ Brief du ${jj}/${mm} : contrôle de 6h45 impossible (${e.message}), vérifier à la main.`).catch(() => {});
    }
    return res.status(500).json({ error: e.message });
  }
}
