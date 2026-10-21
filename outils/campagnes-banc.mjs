/**
 * BANC DES EMAILS MARKETING : tous les modèles, un par un (règle du 21/10 : une
 * famille se parcourt en entier). Pour chacun : rendu final et aperçu, logo hébergé
 * et jamais `cid:`, aucun tiret cadratin, `{{prenom}}` traduit en variable Brevo avec
 * repli, texte saisi échappé, repères [À VALIDER] qui bloquent l'envoi.
 * Chaque sonde de présence ou d'absence porte un témoin qui doit la faire tomber.
 * Usage : node outils/campagnes-banc.mjs   (code 1 si un défaut)
 */
import { MODELES, CHAMPS, manquants, rendreCampagne, LOGO } from '../api/_lib/campagnes.js';

const dire = (ok, msg, val) => { console.log(`  ${ok ? 'ok ' : '⛔ '} ${msg}${val !== undefined ? '  ' + val : ''}`); if (!ok) process.exitCode = 1; };
const MEMBRE = /journaltrader360|espace membre|ta formation|ton module|chapitre/i;
const VAR = '{{ contact.PRENOM | default : "à toi" }}';

const LIBRE = MODELES.find((m) => m.cle === 'libre');
dire(MODELES.length >= 2 && !!LIBRE, `${MODELES.length} modèles trouvés, dont « composer librement »`);
for (const m of MODELES) {
  console.log(`\nmodèle ${m.cle} : ${m.nom}`);
  const html = rendreCampagne(m.exemple);
  const apercu = rendreCampagne(m.exemple, { apercu: true });
  dire(html.includes(`src="${LOGO}"`) && !/cid:/i.test(html), 'logo hébergé, aucun cid:');
  dire(!/[–—]/.test(html) && !/[–—]/.test(m.nom + m.resume), 'aucun tiret cadratin ni demi-cadratin (rendu, nom, résumé)');
  dire(/risque de perte en capital/.test(html), 'mention du risque de perte en capital');
  // ⛔ Règle du 21/10 : l'email marketing parle aux prospects, jamais aux membres.
  dire(!MEMBRE.test(JSON.stringify(m)), 'ne s adresse pas aux membres (ni espace membre, ni module, ni chapitre)');
  const aPrenom = JSON.stringify(m.exemple).includes('{{prenom}}');
  if (aPrenom) {
    dire(html.includes(VAR) && !html.includes('{{prenom}}'), '{{prenom}} devient la variable Brevo avec repli');
    dire(apercu.includes('Nadir') && !apercu.includes('contact.PRENOM'), 'aperçu : prénom d exemple, aucune variable Brevo');
  }
  const manq = manquants(m.exemple);
  const aRepere = JSON.stringify(m.exemple).includes('[À VALIDER]');
  dire(aRepere ? manq.some((x) => /repère/.test(x)) : true, aRepere ? 'les repères [À VALIDER] bloquent l envoi' : 'aucun repère dans l exemple', manq.join(' · '));
  // Rempli proprement, le modèle devient envoyable (sauf si son exemple est vide par conception).
  const propre = Object.fromEntries(CHAMPS.map((c) => [c.cle, c.genre === 'liste' ? ['Salut {{prenom}},', 'Un paragraphe.'] : c.genre === 'url' ? 'https://www.journaltrader360.fr/' : 'Texte']));
  dire(manquants(propre).length === 0, 'tous les champs remplis proprement : envoyable', manquants(propre).join(' · '));
}

console.log('\ncontrôles transverses');
const piege = { ...MODELES[0].exemple, titre: '<script>alert(1)</script>', paragraphes: ['a & b < c'] };
const h = rendreCampagne(piege);
dire(!h.includes('<script>alert') && h.includes('&lt;script&gt;') && h.includes('a &amp; b &lt; c'), 'texte saisi échappé (balise et esperluette)');
dire(manquants({ ...LIBRE.exemple }).includes('Objet du mail') && manquants({ ...LIBRE.exemple }).includes('Titre'), 'composer librement : objet et titre manquants signalés');
dire(MEMBRE.test('Voir le chapitre') && MEMBRE.test('https://www.journaltrader360.fr/'), 'témoin : la sonde « membres » reconnaît le vocabulaire membre');
dire(manquants({ objet: 'a', titre: 'b', paragraphes: ['c'], bouton_texte: 'Go', bouton_lien: 'http://x.fr' }).some((x) => /https/.test(x)), 'bouton sans lien https : bloqué');
dire(manquants({ objet: 'a', titre: 'b', paragraphes: ['c'], bouton_texte: '', bouton_lien: '' }).length === 0, 'sans bouton : pas de lien exigé');
dire(manquants({ objet: 'a — b', titre: 'b', paragraphes: ['c'] }).some((x) => /cadratin/.test(x)), 'tiret cadratin saisi : bloqué');
dire(!rendreCampagne({ objet: 'a', titre: 'b', paragraphes: ['c'], bouton_texte: '', bouton_lien: '' }).includes('t-bouton" style="display:block'), 'sans texte de bouton : aucun bouton rendu');
// Témoins : chaque sonde doit savoir dire non.
dire(/cid:/i.test('<img src="cid:logo">') && /[–—]/.test('a — b') && 'x{{prenom}}'.includes('{{prenom}}'), 'témoins positifs des sondes (cid, cadratin, prénom brut)');
console.log(process.exitCode ? '\n⛔ des défauts' : '\nbanc vert');
