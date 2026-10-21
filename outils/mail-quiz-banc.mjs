/**
 * BANC DU MAIL DE RÉSULTAT DE QUIZ : TOUS les quiz (règle du 21/10 : une famille se
 * parcourt en entier), chacun réussi puis raté. La liste vient des fichiers de la
 * formation, pas d'ici : un quiz ajouté entre dans le banc sans qu'on y touche.
 * Usage (depuis la racine du dépôt) : node outils/mail-quiz-banc.mjs   (code 1 si un défaut)
 */
import { structure, donneesQuiz, mailResultatQuiz } from '../api/_lib/mail-quiz.js';

const dire = (ok, msg, val) => { console.log(`  ${ok ? 'ok ' : '⛔ '} ${msg}${val !== undefined ? '  ' + val : ''}`); if (!ok) process.exitCode = 1; };
const S = structure();
const FD = S.FormationDonnees;
const cles = FD.MODULES.filter((m) => FD.aUnQuiz(m)).map((m) => m.cle);
const logo = { html: '<img src="cid:logo-t360" alt="Trader 360">', attachments: [{ filename: 'l.png' }] };
dire(cles.length >= 11, `${cles.length} quiz trouvés dans la structure : ${cles.join(', ')}`);

function exemple(cle, cas) {
  const Q = donneesQuiz(cle, S);
  const qs = Q.questions;
  const fautes = cas === 'rate' ? Math.min(qs.length, 5) : 0;
  const questions = qs.map((q, i) => ({ id: q.id, bonne: q.bonne, choisie: i < fautes ? (q.bonne + 1) % q.options.length : q.bonne }));
  const ex = (Q.exercices || []).map((e) => ({ id: e.id, type: e.type, ok: cas !== 'rate' }));
  const pts = ex.length ? (Q.points_par_exercice || 2) : 0;
  return { id: `x-${cle}-${cas}`, module_cle: cle, score: questions.filter((x) => x.choisie === x.bonne).length + ex.filter((x) => x.ok).length * pts, total: qs.length + ex.length * pts, reussi: cas !== 'rate', reponses: ex.length ? { questions, exercices: ex } : questions, premiere_reussite: true, fautes, Q };
}

for (const cle of cles) {
  for (const cas of ['reussi', 'rate']) {
    const r = exemple(cle, cas);
    let m;
    try { m = mailResultatQuiz(r, { prenom: 'Nadir', origine: 'https://www.journaltrader360.fr', logo }, S); }
    catch (e) { dire(false, `${cle} ${cas} : aucune exception`, e.message); continue; }
    const h = m.html;
    const etiquette = `${cle} ${cas === 'reussi' ? 'réussi' : 'raté'}`;
    dire(!/undefined|NaN|\[object Object\]/.test(h + m.sujet), `${etiquette} : ni undefined, ni NaN, ni objet brut`);
    dire(!/[–—]/.test(h + m.sujet), `${etiquette} : aucun tiret cadratin ni demi-cadratin`);
    dire(h.includes(`${r.score}<span`) && h.includes(`/ ${r.total}`), `${etiquette} : score ${r.score} / ${r.total} affiché`);
    dire(/risque de perte en capital/.test(h) && h.includes('cid:logo-t360') && m.attachments.length === 1, `${etiquette} : risque mentionné, logo joint`);
    if (cas === 'reussi') {
      dire(/Badge (du module|de certification)/.test(h) && !/Ce qu’il faut revoir/.test(h), `${etiquette} : badge présent, aucune faute listée`);
    } else {
      const avecRenvoi = r.Q.questions.slice(0, r.fautes).filter((q) => q.renvoi && FD.lecon(q.renvoi.lecon)).length;
      const lignes = (h.match(/▶ Revoir « /g) || []).length;
      dire(!/Badge (du module|de certification)/.test(h) && /Ce qu’il faut revoir/.test(h), `${etiquette} : pas de badge, fautes listées`);
      dire(lignes === avecRenvoi, `${etiquette} : ${avecRenvoi} passage(s) vidéo à revoir`, `${lignes} trouvé(s)`);
      if (r.Q.exercices && r.Q.exercices.length) dire(/exercices? sur graphique à reprendre/.test(h), `${etiquette} : exercices ratés signalés`);
    }
  }
}
console.log('\ncontrôles transverses');
const piege = exemple('01', 'rate');
const hp = mailResultatQuiz(piege, { prenom: '<b>Nadir</b>', origine: 'https://x.fr', logo }, S).html;
dire(!hp.includes('<b>Nadir</b>') && hp.includes('&lt;b&gt;Nadir'), 'prénom échappé');
const sansPrenom = mailResultatQuiz(exemple('02', 'reussi'), { prenom: '', origine: 'https://x.fr', logo }, S).html;
dire(sansPrenom.includes('Salut,') && !/Salut ,/.test(sansPrenom), 'sans prénom : « Salut, »');
const cert = mailResultatQuiz(exemple('10', 'reussi'), { prenom: 'N', origine: 'https://x.fr', logo }, S);
dire(/certifié/.test(cert.sujet) && /Badge de certification/.test(cert.html), 'certification réussie : sujet et badge de certification');
let leve = false; try { mailResultatQuiz({ module_cle: 'zz', score: 1, total: 2, reussi: false, reponses: [] }, { prenom: 'N', origine: 'x', logo }, S); } catch { leve = true; }
dire(leve, 'quiz inconnu : refusé (lève), pas de mail vide');
dire(/undefined/.test('x undefined') && /[–—]/.test('a — b') && (/▶ Revoir « /g).test('▶ Revoir « a'), 'témoins positifs des sondes');
console.log(process.exitCode ? '\n⛔ des défauts' : '\nbanc vert');
