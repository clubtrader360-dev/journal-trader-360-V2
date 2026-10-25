// ========================================
// RAPPORT HEBDOMADAIRE DES COACHS (25/10/2026)
//
// Part en même temps que les rapports des élèves, le dimanche soir, vers la boîte
// des coachs (clubtrader360@gmail.com, ou RAPPORT_COACHS_DESTINATAIRE).
// Il reprend, élève par élève, ce que l'élève a reçu : son T360 Score, l'écart avec
// la semaine d'avant, son axe le plus faible et le plan d'action pour la semaine
// suivante. En tête, les moyennes du groupe et les élèves à surveiller.
//
// ⛔ LES CHIFFRES VIENNENT DES MÊMES FONCTIONS QUE LE RAPPORT DE L'ÉLÈVE
// (weekly-expert-system.js). Recalculer ici avec une formule à part ferait dire au
// coach un score que l'élève n'a pas reçu.
//
// ⚠️ Usage interne : il porte des noms et des montants. Il ne part qu'aux coachs.
// ========================================

import {
  computeWinRate, computeProfitFactor, computeTraderScore,
  findWeakestComponent, runExpertSystem, buildActionPlan, formatDate, COMPONENT_RECOMMENDATIONS,
} from './weekly-expert-system.js';

const pnlOf = (t) => parseFloat(t.pnl) || 0;
const r1 = (v) => Math.round(v * 10) / 10;

/** La date ISO `jours` jours avant `dateIso` (calcul en UTC, sans dérive d'heure). */
export function joursAvant(dateIso, jours) {
  const d = new Date(`${dateIso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() - jours);
  return d.toISOString().slice(0, 10);
}

/**
 * Le résumé d'UN élève actif (au moins un trade dans la semaine).
 * `historicalTrades` = ses trades antérieurs au lundi : la semaine précédente en est
 * extraite pour mesurer la progression du score.
 */
export function resumeEleve({ user, trades, journalEntries, accounts, historicalTrades, startDate }) {
  const score = computeTraderScore(trades, accounts);
  const faible = findWeakestComponent(score.components);
  const insights = runExpertSystem(trades, journalEntries, score, accounts, historicalTrades);
  const actions = buildActionPlan(insights, faible);

  const debutPrec = joursAvant(startDate, 7);
  const tradesPrec = (historicalTrades || []).filter((t) => {
    const d = String(t.trade_date || '').slice(0, 10);
    return d >= debutPrec && d < startDate;
  });
  const prec = tradesPrec.length ? computeTraderScore(tradesPrec, accounts) : null;

  // L'axe qui a le plus progressé d'une semaine sur l'autre (s'il a progressé).
  let progres = null;
  if (prec) {
    for (const [k, v] of Object.entries(score.components)) {
      const gain = v - (prec.components[k] || 0);
      if (gain > 0 && (!progres || gain > progres.gain)) {
        progres = { cle: k, label: (COMPONENT_RECOMMENDATIONS[k] || { label: k }).label, gain };
      }
    }
  }

  const jours = new Set((journalEntries || []).map((e) => String(e.entry_date || '').slice(0, 10)).filter(Boolean));
  return {
    nom: user.name || user.email,
    email: user.email,
    score: score.globalScore,
    scorePrecedent: prec ? prec.globalScore : null,
    ecart: prec ? r1(score.globalScore - prec.globalScore) : null,
    trades: trades.length,
    pnl: Math.round(trades.reduce((s, t) => s + pnlOf(t), 0) * 100) / 100,
    winRate: computeWinRate(trades),
    profitFactor: computeProfitFactor(trades),
    joursJournal: jours.size,
    faible: faible ? { cle: faible.name, label: faible.label, score: faible.score } : null,
    progres,
    alertes: insights.filter((i) => i.severity === 'high').map((i) => i.message),
    actions,
  };
}

/** Moyenne d'une liste de nombres, `null` si la liste est vide (jamais 0 par défaut). */
const moyenne = (xs) => (xs.length ? r1(xs.reduce((s, x) => s + x, 0) / xs.length) : null);

/** Les chiffres du groupe. Exportée pour le banc d'essai. */
export function statsGroupe(resumes) {
  const avecEcart = resumes.filter((r) => r.ecart !== null);
  const axes = {};
  for (const r of resumes) if (r.faible) axes[r.faible.label] = (axes[r.faible.label] || 0) + 1;
  const axeCommun = Object.entries(axes).sort((a, b) => b[1] - a[1])[0] || null;
  return {
    actifs: resumes.length,
    scoreMoyen: moyenne(resumes.map((r) => r.score)),
    // ⚠️ Écart moyen sur les SEULS élèves présents les deux semaines : comparer la
    // moyenne de cette semaine à celle d'un autre groupe d'élèves ne mesurerait rien.
    ecartMoyen: moyenne(avecEcart.map((r) => r.ecart)),
    comparables: avecEcart.length,
    winRateMoyen: moyenne(resumes.map((r) => r.winRate)),
    tradesTotal: resumes.reduce((s, r) => s + r.trades, 0),
    journalTenu: resumes.filter((r) => r.joursJournal > 0).length,
    axeCommun: axeCommun ? { label: axeCommun[0], nombre: axeCommun[1] } : null,
  };
}

/** À surveiller : score en baisse d'au moins 10 points, ou alerte forte, ou aucun journal. */
export function aSurveiller(r) {
  const raisons = [];
  if (r.ecart !== null && r.ecart <= -10) raisons.push(`score en baisse de ${Math.abs(r.ecart).toFixed(1).replace('.', ',')} pts`);
  if (r.alertes.length) raisons.push(r.alertes.length === 1 ? '1 alerte forte' : `${r.alertes.length} alertes fortes`);
  if (r.joursJournal === 0) raisons.push('aucun journal rempli');
  return raisons;
}

// ---- Mise en forme ----
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nb = (v, d = 1) => (v === null || v === undefined ? 'n/d' : Number(v).toFixed(d).replace('.', ','));
const signe = (v) => (v === null ? 'n/d' : `${v > 0 ? '+' : ''}${nb(v)}`);
const euros = (v) => `${v < 0 ? '−' : ''}${Math.abs(v).toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 }).replace(/ | /g, ' ')} $`;
const C = { fond: '#f6f3ec', carte: '#ffffff', texte: '#1e222d', doux: '#6a6d78', or: '#ac862b', ligne: '#ece6d8', vert: '#067a4f', rouge: '#c62828' };
const MONO = "'JetBrains Mono',ui-monospace,Menlo,monospace";
const couleurEcart = (v) => (v === null ? C.doux : v > 0 ? C.vert : v < 0 ? C.rouge : C.doux);

function kpi(label, valeur, sous) {
  return `<td style="padding:6px;" width="25%"><div style="background:${C.carte};border:1px solid ${C.ligne};border-radius:10px;padding:12px 10px;text-align:center;">
    <div style="font-size:11px;color:${C.doux};text-transform:uppercase;letter-spacing:.06em;">${label}</div>
    <div style="font-family:${MONO};font-size:22px;font-weight:700;color:${C.texte};margin-top:4px;">${valeur}</div>
    ${sous ? `<div style="font-size:11px;color:${C.doux};margin-top:2px;">${sous}</div>` : ''}</div></td>`;
}

/**
 * Le mail des coachs.
 * `autres` : élèves sans rapport chiffré cette semaine, { nom, email, reportType, entriesWeek }.
 */
export function genererRapportCoachs({ periode, resumes, autres = [] }) {
  const g = statsGroupe(resumes);
  const tries = [...resumes].sort((a, b) => b.score - a.score);
  const surveiller = tries.map((r) => ({ r, raisons: aSurveiller(r) })).filter((x) => x.raisons.length);
  const progressions = tries.filter((r) => r.ecart !== null && r.ecart >= 10).sort((a, b) => b.ecart - a.ecart);
  const passifs = autres.filter((a) => a.reportType === 'passive');
  const formation = autres.filter((a) => a.reportType === 'formation');

  const titreSemaine = `semaine du ${formatDate(periode.startDateStr)} au ${formatDate(periode.endDateStr)}`;
  const objet = `Rapport coachs : ${g.actifs} élève(s) actif(s), score moyen ${nb(g.scoreMoyen)}, ${titreSemaine}`;

  const section = (titre, contenu) => `<tr><td style="padding:22px 6px 6px;"><div style="font-size:13px;font-weight:700;color:${C.or};text-transform:uppercase;letter-spacing:.08em;">${titre}</div></td></tr><tr><td style="padding:0 6px;">${contenu}</td></tr>`;

  const ligneSurveiller = surveiller.length
    ? surveiller.map(({ r, raisons }) => `<div style="padding:8px 0;border-bottom:1px solid ${C.ligne};font-size:14px;"><strong>${esc(r.nom)}</strong> <span style="color:${C.rouge};">${esc(raisons.join(' · '))}</span>${r.alertes.length ? `<div style="font-size:12px;color:${C.doux};margin-top:3px;">${r.alertes.map(esc).join('<br>')}</div>` : ''}</div>`).join('')
    : `<div style="font-size:14px;color:${C.doux};">Personne cette semaine.</div>`;

  const ligneProgres = progressions.length
    ? progressions.map((r) => `<div style="padding:6px 0;font-size:14px;"><strong>${esc(r.nom)}</strong> <span style="font-family:${MONO};color:${C.vert};">${signe(r.ecart)} pts</span>${r.progres ? ` <span style="color:${C.doux};">(surtout ${esc(r.progres.label)})</span>` : ''}</div>`).join('')
    : `<div style="font-size:14px;color:${C.doux};">Aucune progression de 10 points ou plus.</div>`;

  const cartes = tries.map((r) => `<div style="background:${C.carte};border:1px solid ${C.ligne};border-radius:10px;padding:14px 16px;margin-bottom:10px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
      <td style="font-size:15px;font-weight:700;color:${C.texte};">${esc(r.nom)}<div style="font-size:12px;font-weight:400;color:${C.doux};">${esc(r.email)}</div></td>
      <td align="right" style="font-family:${MONO};white-space:nowrap;"><span style="font-size:22px;font-weight:700;color:${C.or};">${nb(r.score)}</span><span style="font-size:12px;color:${C.doux};"> / 100</span><div style="font-size:12px;color:${couleurEcart(r.ecart)};">${r.ecart === null ? 'pas de trade la semaine d’avant' : `${signe(r.ecart)} pts vs semaine d’avant`}</div></td>
    </tr></table>
    <div style="font-family:${MONO};font-size:12px;color:${C.doux};margin:8px 0;">${r.trades} trade(s) · WR ${r.winRate} % · PF ${r.profitFactor >= 99.99 ? '∞' : nb(r.profitFactor, 2)} · P&amp;L <span style="color:${r.pnl >= 0 ? C.vert : C.rouge};">${euros(r.pnl)}</span> · journal ${r.joursJournal} j</div>
    ${r.faible ? `<div style="font-size:13px;color:${C.texte};"><strong>Axe le plus faible :</strong> ${esc(r.faible.label)} (${r.faible.score}/100)${r.progres ? ` · <span style="color:${C.vert};">en progrès : ${esc(r.progres.label)}</span>` : ''}</div>` : ''}
    <div style="font-size:13px;color:${C.texte};margin-top:6px;"><strong>Pour la semaine prochaine :</strong><ol style="margin:4px 0 0 18px;padding:0;color:${C.texte};">${r.actions.map((a) => `<li style="margin:2px 0;">${esc(a)}</li>`).join('')}</ol></div>
  </div>`).join('');

  const listeNoms = (xs, detail) => (xs.length ? xs.map((a) => `${esc(a.nom)}${detail ? detail(a) : ''}`).join(', ') : 'aucun');

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;background:${C.fond};font-family:Inter,-apple-system,Segoe UI,Roboto,Arial,sans-serif;color:${C.texte};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.fond};"><tr><td align="center" style="padding:24px 12px;">
<table role="presentation" width="640" cellpadding="0" cellspacing="0" style="max-width:640px;width:100%;">
  <tr><td style="padding:0 6px 4px;"><div style="font-size:12px;color:${C.or};font-weight:700;letter-spacing:.12em;text-transform:uppercase;">Trader 360 · Rapport coachs</div>
    <div style="font-size:22px;font-weight:700;margin-top:4px;">Les élèves, ${esc(titreSemaine)}</div>
    <div style="font-size:13px;color:${C.doux};margin-top:4px;">Mêmes chiffres que les rapports reçus par les élèves ce soir.</div></td></tr>
  <tr><td><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
    ${kpi('Score moyen', nb(g.scoreMoyen), g.comparables ? `<span style="color:${couleurEcart(g.ecartMoyen)};">${signe(g.ecartMoyen)} pts</span> sur ${g.comparables} élève(s)` : 'pas de comparaison')}
    ${kpi('Élèves actifs', String(g.actifs), `${passifs.length} sans trade`)}
    ${kpi('Win rate moyen', g.winRateMoyen === null ? 'n/d' : `${nb(g.winRateMoyen, 0)} %`, `${g.tradesTotal} trades`)}
    ${kpi('Journal tenu', `${g.journalTenu}/${g.actifs}`, 'élèves actifs')}
  </tr></table></td></tr>
  ${g.axeCommun ? section('Axe à travailler en groupe', `<div style="font-size:14px;line-height:1.5;"><strong>${esc(g.axeCommun.label)}</strong> est l’axe le plus faible de ${g.axeCommun.nombre} élève(s) sur ${g.actifs}. Un bon sujet de live cette semaine.</div>`) : ''}
  ${section('À surveiller', ligneSurveiller)}
  ${section('En progrès', ligneProgres)}
  ${section(`Chaque élève actif (${g.actifs}), du meilleur score au plus faible`, cartes || `<div style="font-size:14px;color:${C.doux};">Aucun élève n’a tradé cette semaine.</div>`)}
  ${section('Sans rapport chiffré', `<div style="font-size:14px;line-height:1.6;"><strong>Pas de trade cette semaine (${passifs.length}) :</strong> ${listeNoms(passifs, (a) => (a.entriesWeek ? ` (journal ${a.entriesWeek} j)` : ''))}<br><strong>Formation seule (${formation.length}) :</strong> ${listeNoms(formation)}</div>`)}
  <tr><td style="padding:24px 6px;font-size:11px;color:${C.doux};">Usage interne, ne pas transférer : ce rapport contient des données personnelles d’élèves.</td></tr>
</table></td></tr></table></body></html>`;

  const texte = [
    `Rapport coachs, ${titreSemaine}`, '',
    `Score moyen : ${nb(g.scoreMoyen)} (${g.comparables ? `${signe(g.ecartMoyen)} pts sur ${g.comparables} élève(s)` : 'pas de comparaison'})`,
    `Élèves actifs : ${g.actifs}, sans trade : ${passifs.length}, formation seule : ${formation.length}`,
    `Win rate moyen : ${g.winRateMoyen === null ? 'n/d' : `${nb(g.winRateMoyen, 0)} %`}, journal tenu : ${g.journalTenu}/${g.actifs}`,
    g.axeCommun ? `Axe commun : ${g.axeCommun.label} (${g.axeCommun.nombre} élève(s))` : '', '',
    'À surveiller :', ...(surveiller.length ? surveiller.map(({ r, raisons }) => `- ${r.nom} : ${raisons.join(', ')}`) : ['- personne']), '',
    `Pas de trade cette semaine : ${passifs.map((a) => a.nom).join(', ') || 'aucun'}`,
    `Formation seule : ${formation.map((a) => a.nom).join(', ') || 'aucun'}`, '',
    ...tries.map((r) => `${r.nom} : ${nb(r.score)}/100 (${signe(r.ecart)}), ${r.trades} trades, WR ${r.winRate} %, axe faible ${r.faible ? r.faible.label : 'n/d'}\n  ${r.actions.map((a, i) => `${i + 1}. ${a}`).join('\n  ')}`),
  ].filter((l) => l !== '').join('\n');

  return { objet, html, texte, stats: g };
}
