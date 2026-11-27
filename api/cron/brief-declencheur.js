// ========================================
// API ROUTE : DÉCLENCHEUR FIABLE DU BRIEF MARCHÉ (v22)
// Route : /api/cron/brief-declencheur?saison=hiver|ete
// Cron Vercel : 3h15 Paris du lundi au vendredi (2h15 UTC en hiver, 1h15 UTC en été).
// ========================================
// Pourquoi : les crons GitHub du brief partent avec 1 à 4 h de retard, ou pas du tout
// (27/11/2026 : jamais parti, relance à la main à 7h18). Vercel Pro déclenche à la
// minute : cet endpoint lance daily-brief.yml (workflow_dispatch, ref main,
// mode=production). Le cron GitHub reste en secours : un doublon est arrêté par
// l'étiquette brief-envoye-<date> et par la file de concurrence du workflow.
//
// Avant de lancer : rien le week-end, rien hors saison (même règle que le workflow),
// rien si l'étiquette du jour existe (brief parti) ou si un run est en cours.
//
// Test : ?mode=apercu lance un run en mode apercu (aucun envoi aux listes), sans
// garde de saison, de week-end ni d'étiquette ; la réponse dit ce que la production
// aurait fait (champ `production`).
//
// Env : CRON_SECRET, GITHUB_DISPATCH_TOKEN (Actions en écriture, ce dépôt seulement).
// Sans GITHUB_DISPATCH_TOKEN, les deux endpoints sortent en 200 sans rien faire.
// ========================================

export const DEPOT = 'clubtrader360-dev/journal-trader-360-V2';
export const WORKFLOW = 'daily-brief.yml';
const API = 'https://api.github.com';
const ACTIFS = new Set(['queued', 'in_progress', 'waiting', 'requested', 'pending']);

/** Date du jour à Paris (AAAA-MM-JJ), jour ISO (1 = lundi … 7 = dimanche), saison. */
export function infosParis(maintenant = new Date()) {
  const tz = 'Europe/Paris';
  const date = new Intl.DateTimeFormat('fr-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).format(maintenant);
  const jour = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
    .indexOf(new Intl.DateTimeFormat('en-US', { timeZone: tz, weekday: 'short' }).format(maintenant)) + 1;
  const decalage = new Intl.DateTimeFormat('en-US', { timeZone: tz, timeZoneName: 'shortOffset' })
    .formatToParts(maintenant).find((p) => p.type === 'timeZoneName').value; // « GMT+1 » ou « GMT+2 »
  const saison = decalage === 'GMT+2' ? 'ete' : 'hiver';
  const heure = new Intl.DateTimeFormat('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(maintenant);
  return { date, jour, saison, heure };
}

/** Garde commune aux crons Vercel : secret, saison, week-end. Renvoie null si on continue. */
export function garde(req, res, { nom }) {
  const secret = process.env.CRON_SECRET;
  if (!secret) { res.status(500).json({ error: 'Missing CRON_SECRET' }); return 'stop'; }
  if (req.headers.authorization !== `Bearer ${secret}`) { res.status(401).json({ error: 'Unauthorized' }); return 'stop'; }
  // Sans jeton (Manu, 27/11/2026 : déclenchement assuré par une tâche planifiée Claude),
  // l'endpoint sort proprement : une ligne de log, réponse 200, aucune alerte.
  if (!process.env.GITHUB_DISPATCH_TOKEN) {
    console.log(`[${nom}] GITHUB_DISPATCH_TOKEN absent : rien à faire`);
    res.status(200).json({ ignore: true, raison: 'GITHUB_DISPATCH_TOKEN absent' }); return 'stop';
  }
  return null;
}

async function gh(chemin, options = {}) {
  const r = await fetch(`${API}${chemin}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_DISPATCH_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'User-Agent': 'trader360-brief-cron',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  return r;
}

/** L'étiquette brief-envoye-<date> existe-t-elle ? (posée par le workflow après l'envoi) */
export async function briefDejaParti(date) {
  const r = await gh(`/repos/${DEPOT}/git/ref/tags/brief-envoye-${date}`);
  if (r.status === 404) return false;
  if (!r.ok) throw new Error(`étiquette : GitHub ${r.status}`);
  return true;
}

/**
 * Runs du brief pas encore terminés sur main. Les entrées d'un workflow_dispatch ne
 * sont pas exposées par l'API : un run d'aperçu en cours compte aussi. Sans gravité :
 * au pire on ne relance pas pendant un aperçu ; un doublon de production, lui, attend
 * dans la file de concurrence puis s'arrête sur l'étiquette.
 */
export async function runsEnCours() {
  const r = await gh(`/repos/${DEPOT}/actions/workflows/${WORKFLOW}/runs?branch=main&per_page=30`);
  if (!r.ok) throw new Error(`runs : GitHub ${r.status}`);
  const { workflow_runs: runs = [] } = await r.json();
  return runs.filter((x) => ACTIFS.has(x.status))
    .map((x) => ({ id: x.id, status: x.status, event: x.event, cree: x.created_at, url: x.html_url }));
}

/** Lance daily-brief.yml sur main et renvoie l'URL du run créé (null si introuvable). */
export async function lancerBrief(mode) {
  const depart = Date.now();
  const r = await gh(`/repos/${DEPOT}/actions/workflows/${WORKFLOW}/dispatches`, {
    method: 'POST',
    body: JSON.stringify({ ref: 'main', inputs: { mode }, return_run_details: true }),
  });
  if (!r.ok) throw new Error(`dispatch : GitHub ${r.status} ${await r.text()}`);
  if (r.status === 200) {
    const d = await r.json().catch(() => ({}));
    if (d.html_url) return d.html_url;
  }
  // Repli (204 sans détails) : le run apparaît dans la liste en quelques secondes.
  for (let i = 0; i < 6; i++) {
    await new Promise((ok) => setTimeout(ok, 2000));
    const l = await gh(`/repos/${DEPOT}/actions/workflows/${WORKFLOW}/runs?event=workflow_dispatch&branch=main&per_page=5`);
    if (!l.ok) continue;
    const { workflow_runs: runs = [] } = await l.json();
    const run = runs.find((x) => Date.parse(x.created_at) >= depart - 10_000);
    if (run) return run.html_url;
  }
  return null;
}

/** Ce que ferait la production maintenant : { agir, raison, etat }. */
export async function decisionProduction({ saisonCron, ignorerSaison = false }) {
  const p = infosParis();
  const etat = { ...p };
  if (!ignorerSaison && saisonCron && saisonCron !== p.saison) {
    return { agir: false, raison: `cron « ${saisonCron} » hors saison (Paris en ${p.saison}) : l'autre cron s'en charge`, etat };
  }
  if (p.jour > 5) return { agir: false, raison: `${p.date} est un week-end : aucun brief`, etat };
  etat.etiquette = await briefDejaParti(p.date);
  if (etat.etiquette) return { agir: false, raison: `brief du ${p.date} déjà parti (étiquette brief-envoye-${p.date})`, etat };
  etat.runs = await runsEnCours();
  if (etat.runs.length) return { agir: false, raison: `run déjà en cours (${etat.runs.map((x) => x.url).join(', ')})`, etat };
  return { agir: true, raison: `aucune étiquette ni run en cours pour le ${p.date}`, etat };
}

export default async function handler(req, res) {
  const nom = 'BRIEF-DECLENCHEUR';
  if (garde(req, res, { nom })) return;
  const apercu = req.query?.mode === 'apercu';
  try {
    const d = await decisionProduction({ saisonCron: req.query?.saison });
    console.log(`[${nom}] production : ${d.agir ? 'lancement' : 'rien'} (${d.raison})`);
    if (apercu) {
      const run = await lancerBrief('apercu');
      console.log(`[${nom}] 🧪 run d'aperçu lancé : ${run}`);
      return res.status(200).json({ mode: 'apercu', run, production: d });
    }
    if (!d.agir) return res.status(200).json({ lance: false, raison: d.raison, etat: d.etat });
    const run = await lancerBrief('production');
    console.log(`[${nom}] ✅ brief lancé : ${run}`);
    return res.status(200).json({ lance: true, run, raison: d.raison, etat: d.etat });
  } catch (e) {
    console.error(`[${nom}] ❌ ${e.message}`);
    return res.status(500).json({ error: e.message });
  }
}
