/**
 * LE MAIL DE RÉSULTAT DE QUIZ (mails aux membres, back-office · Académie).
 *
 * ⛔ SPÉCIFIÉ LE 14/10 (`_contenu-formation/specification-gamification.md`, §4),
 * JAMAIS CONSTRUIT AVANT LE 21/10. À la fin de CHAQUE quiz, réussi ou raté :
 *   - le score et le pourcentage ;
 *   - un retour sur ce qui est raté, avec le passage de la vidéo à revoir ;
 *   - le badge du module s'il est obtenu (depuis le 21/10 : quiz réussi = module terminé).
 * « Un mail vraiment propre et esthétique », les mots de Nadir. Un quiz raté donne
 * AUSSI un mail : c'est là qu'il sert le plus.
 * Les textes sont des propositions à valider par Nadir (spécification : « à proposer,
 * pas à figer »).
 *
 * ⛔ LA STRUCTURE N'EST PAS RECOPIÉE : les fichiers servis au navigateur sont évalués
 * ici, comme dans `formation-xp.js` et le rapport hebdomadaire. Ils accompagnent la
 * fonction par `includeFiles` (vercel.json) ; s'ils manquent, on LÈVE, on ne devine pas.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const FICHIERS = ['formation-donnees.js', 'formation-quiz.js', 'formation-certification.js'];
let _bac = null;
export function structure() {
  if (_bac) return _bac;
  const bac = {};
  bac.window = bac; bac.globalThis = bac;
  for (const f of FICHIERS) {
    let source;
    try { source = readFileSync(join(process.cwd(), 'assets', f), 'utf8'); }
    catch (e) { throw new Error(`fichier de formation absent de la fonction (${f}) : vérifier includeFiles dans vercel.json`); }
    // eslint-disable-next-line no-new-func
    new Function('window', 'globalThis', source)(bac, bac);
  }
  if (!bac.FormationDonnees || !bac.FORMATION_QUIZ) throw new Error('structure de formation illisible');
  _bac = bac;
  return bac;
}

/** Les données d'un quiz par sa clé de module : `null` si inconnu. */
export function donneesQuiz(cle, S = structure()) {
  if (cle === '10') return S.FORMATION_CERTIFICATION || null;
  return S.FORMATION_QUIZ[cle] || null;
}

/** Les réponses, quel que soit le moteur : classique (tableau) ou examen ({ questions, exercices }). */
export function reponsesQuestions(reponses) {
  if (Array.isArray(reponses)) return reponses;
  if (reponses && Array.isArray(reponses.questions)) return reponses.questions;
  return [];
}

const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/**
 * @param r { module_cle, score, total, reussi, reponses, premiere_reussite }
 * @param opts { prenom, origine, logo: { html, attachments } }
 */
export function mailResultatQuiz(r, { prenom, origine, logo }, S = structure()) {
  const D = S.FormationDonnees;
  const cle = String(r.module_cle);
  const Q = donneesQuiz(cle, S);
  if (!Q) throw new Error(`quiz inconnu pour le module ${cle}`);
  const mod = D.MODULES.find((m) => m.cle === cle) || { numero: cle, titre: '' };
  const cert = cle === '10';
  const nomModule = cert ? 'la certification Trader 360' : `module ${mod.numero}`;
  const pct = r.total > 0 ? Math.round((r.score / r.total) * 100) : 0;
  const unite = Q.exercices && Q.exercices.length ? 'points' : 'bonnes réponses';
  const seuil = Q.seuil ?? null;

  // Les questions ratées, avec le conseil et le passage à revoir.
  const parId = new Map((Q.questions || []).map((q) => [q.id, q]));
  const fautes = reponsesQuestions(r.reponses).filter((x) => x && x.choisie !== x.bonne).map((x) => parId.get(x.id)).filter(Boolean);
  const exercicesRates = (r.reponses && Array.isArray(r.reponses.exercices)) ? r.reponses.exercices.filter((x) => x && x.ok === false).length : 0;
  const lignesFautes = fautes.slice(0, 8).map((q) => {
    const lecon = q.renvoi && D.lecon(q.renvoi.lecon);
    const revoir = lecon ? `<div style="margin-top:8px;font-size:13.5px;color:#e8b84b">▶ Revoir « ${esc(lecon.titre)} », entre ${esc(q.renvoi.de)} et ${esc(q.renvoi.a)} min</div>` : '';
    return `<tr><td style="padding:14px 16px;border-top:1px solid #1e2128">
      <div style="font-size:14.5px;line-height:1.5;color:#f7f6f3;font-weight:600">${esc(q.enonce)}</div>
      <div style="margin-top:6px;font-size:14px;line-height:1.55;color:#bdbcb6">${esc(q.conseil || '')}</div>${revoir}</td></tr>`;
  }).join('');
  const plus = fautes.length > 8 ? `<tr><td style="padding:12px 16px;border-top:1px solid #1e2128;font-size:13.5px;color:#9c9b94">Et ${fautes.length - 8} autre${fautes.length - 8 > 1 ? 's' : ''} : le détail complet est dans ton espace, à la fin du quiz.</td></tr>` : '';
  const blocFautes = fautes.length
    ? `<tr><td style="padding:22px 36px 0"><div style="font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:#9c9b94;font-weight:700;margin-bottom:10px">${r.reussi ? 'À revoir quand même' : 'Ce qu’il faut revoir'}</div>
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #1e2128;border-radius:14px;background:#0d0f13">${lignesFautes}${plus}</table></td></tr>`
    : '';
  const ligneExercices = exercicesRates ? `<p style="margin:12px 0 0;font-size:14.5px;line-height:1.6;color:#bdbcb6">${exercicesRates} exercice${exercicesRates > 1 ? 's' : ''} sur graphique à reprendre : la correction, graphique à l’appui, t’attend à la fin du quiz.</p>` : '';

  // Le badge : depuis le 21/10, un quiz réussi termine le module.
  const badge = r.reussi
    ? `<tr><td align="center" style="padding:24px 36px 0">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr><td align="center" style="width:96px;height:96px;border-radius:48px;background:#1a1508;border:2px solid #e8b84b;font-size:30px;font-weight:800;color:#e8b84b;font-family:'SF Mono',Menlo,Consolas,monospace">${cert ? '360' : esc(mod.numero)}</td></tr></table>
      <div style="margin-top:12px;font-size:15px;font-weight:700;color:#f7f6f3">${cert ? 'Badge de certification' : `Badge du module ${esc(mod.numero)}`}</div>
      <div style="margin-top:4px;font-size:13.5px;color:#9c9b94">${cert ? 'Tu es certifié Trader 360.' : 'Module terminé : il est dans ta collection.'}</div></td></tr>`
    : '';

  const bonjour = prenom ? `Salut ${esc(prenom)},` : 'Salut,';
  const titre = cert
    ? (r.reussi ? 'Tu es certifié Trader 360.' : 'L’examen n’est pas encore validé.')
    : (r.reussi ? `Quiz du module ${esc(mod.numero)} validé.` : `Le quiz du module ${esc(mod.numero)} n’est pas encore validé.`);
  const message = r.reussi
    ? (cert
      ? 'Tu viens de réussir l’examen final. C’est toute la méthode qui est validée, questions et graphiques : bravo pour le travail que ça représente.'
      : (r.premiere_reussite === false ? 'Tu l’as repassé et réussi à nouveau : les bases sont solides.' : 'Bien joué : le module est terminé, et tu peux passer à la suite.'))
    : `Il fallait ${seuil != null ? `${esc(seuil)} ${unite}` : '80 %'} pour valider. Ce n’est pas un échec, c’est une carte : elle te dit exactement quoi revoir. Repasse-le quand tu veux, autant de fois que tu veux.`;
  const sujet = cert
    ? (r.reussi ? 'Tu es certifié Trader 360' : 'Ton examen de certification : ce qu’il faut revoir')
    : (r.reussi ? `Module ${mod.numero} validé : ${r.score} / ${r.total}` : `Quiz du module ${mod.numero} : ce qu’il faut revoir`);
  const lien = `${String(origine || 'https://www.journaltrader360.fr').replace(/\/$/, '')}/formation`;

  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><title>${esc(sujet)}</title></head><body style="margin:0;padding:0;background:#0a0a0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f7f6f3">
<div style="display:none;max-height:0;overflow:hidden">${esc(r.reussi ? `${r.score} / ${r.total} au ${nomModule}.` : `${r.score} / ${r.total} au ${nomModule} : voici quoi revoir.`)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0d"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111318;border:1px solid #1e2128;border-radius:22px">
<tr><td style="padding:36px 36px 8px;text-align:center">${logo.html}</td></tr>
<tr><td style="padding:16px 36px 0;font-size:12.5px;letter-spacing:.22em;text-transform:uppercase;color:#e8b84b;font-weight:700;text-align:center">${cert ? 'Certification' : `Quiz · module ${esc(mod.numero)}`}</td></tr>
<tr><td style="padding:12px 36px 0;text-align:center;font-size:23px;line-height:1.3;font-weight:800;color:#f7f6f3">${titre}</td></tr>
<tr><td align="center" style="padding:20px 36px 0">
  <table role="presentation" cellpadding="0" cellspacing="0" style="border:1px solid ${r.reussi ? '#e8b84b' : '#2a2d35'};border-radius:16px;background:#0d0f13"><tr>
    <td style="padding:16px 26px;text-align:center"><div style="font-family:'SF Mono',Menlo,Consolas,monospace;font-size:34px;font-weight:800;color:${r.reussi ? '#e8b84b' : '#f7f6f3'}">${esc(r.score)}<span style="font-size:18px;color:#9c9b94"> / ${esc(r.total)}</span></div>
    <div style="margin-top:4px;font-size:13px;color:#9c9b94">${pct} %${seuil != null ? ` · seuil ${esc(seuil)}` : ''}</div></td></tr></table></td></tr>
${badge}
<tr><td style="padding:24px 36px 0;font-size:16.5px;line-height:1.65;color:#f7f6f3"><p style="margin:0 0 12px">${bonjour}</p><p style="margin:0;color:#d9d8d2">${message}</p>${ligneExercices}</td></tr>
${blocFautes}
<tr><td align="center" style="padding:26px 36px 8px"><a href="${esc(lien)}" style="display:inline-block;background:#e8b84b;color:#120e07;font-weight:700;font-size:16px;text-decoration:none;padding:15px 30px;border-radius:40px">${r.reussi ? 'Continuer ma formation' : 'Revoir et repasser le quiz'}</a></td></tr>
<tr><td style="padding:18px 36px 34px;font-size:15px;line-height:1.65;color:#bdbcb6"><p style="margin:0">À très vite,<br>Emmanuel et Nadir</p></td></tr>
</table>
<p style="max-width:560px;margin:18px auto 0;font-size:12px;color:#6f6e68;line-height:1.5">Trader 360 · Le trading comporte un risque de perte en capital. Tu reçois ce message parce que tu viens de passer un quiz de ta formation Trader 360.</p>
</td></tr></table></body></html>`;
  return { sujet, html, attachments: logo.attachments || [] };
}
