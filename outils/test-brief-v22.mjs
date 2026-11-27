#!/usr/bin/env node
// ========================================================================
// TEST DE CONFORMITÉ VISUELLE DU BRIEF V22 : le rendu du code contre la référence.
//
// Le contenu (textes, chiffres) est EXTRAIT de outils/reference/brief_reference_v22.html,
// rendu par api/_lib/brief-v22.js, puis comparé OCTET PAR OCTET au fichier de référence.
// Seule différence admise : l'adresse du bouton « Mon lien » (voir plus bas). Les URL d'images (bandeau et schéma, hébergés chez
// Brevo dans la référence) sont reprises de la référence pour la comparaison.
// Un écart affiche le premier octet divergent avec son contexte, et le test échoue.
// ========================================================================
import fs from 'node:fs';
import { rendreCorps, rendreCourriel, ICONES_ESSAI, LIEN_PARRAINAGE, URL_QUESTIONNAIRE_PROSPECTS } from '../api/_lib/brief-v22.js';

const REF = new URL('./reference/brief_reference_v22.html', import.meta.url);
// ⚠️ UN SEUL ÉCART ADMIS, exigé par le point 5 du cahier des charges : le bouton
// « Mon lien » pointe vers la rubrique Parrainage (la référence porte l'accueil du site).
const refBrut = fs.readFileSync(REF, 'utf8');
const LIEN_REF = '<a href="https://journaltrader360.fr" style="display:inline-block; border:1px solid #000B25;';
if (refBrut.split(LIEN_REF).length !== 2) throw new Error('bouton « Mon lien » introuvable (ou en double) dans la référence');
const ref = refBrut.replace(LIEN_REF, LIEN_REF.replace('https://journaltrader360.fr', LIEN_PARRAINAGE));
const dec = (t) => t.replace(/&amp;/g, '&').replace(/&nbsp;/g, '\u00a0');
const un = (re, s = ref) => { const m = s.match(re); if (!m) throw new Error(`motif absent de la référence : ${re}`); return m[1]; };
const tous = (re, s = ref) => [...s.matchAll(re)].map((m) => m[1]);

// Espacements en cellules (27/11/2026) : chaque paragraphe est une cellule <td>.
const intro = dec(un(/Bonjour Emmanuel,<\/td><\/tr><\/table>.*?<td style="padding:0 0 0px; font-size:16px; line-height:1.6; color:#1a1208;">(.*?)<\/td>/));
const psy = dec(un(/La psychologie du jour<\/td><\/tr><\/table><table[^>]*><tr><td[^>]*>(.*?)<\/td>/));
const vixLecture = dec(un(/>28,29<\/td><\/tr><\/table><table[^>]*><tr><td[^>]*><table[^>]*><tr><td[^>]*>(.*?)<\/td>/));
const agendaZone = un(/(<table[^>]*border-collapse:separate;">.*?<\/table>)/);
const agenda = tous(/<tr>(.*?)<\/tr>/g, agendaZone).map((tr) => ({
  heure: un(/white-space:nowrap;">(\d\d:\d\d)<\/td>/, tr),
  impact: un(/<span style="color:#d4af37;">(★*)<\/span>/, tr).length,
  pays: 'US',
  theme: dec(un(/color:#1a1208;">([^<]*)<\/td>$/, tr)),
}));
// Actualité : une cellule de titre (18 px gras) puis une cellule par paragraphe.
const actuZone = un(/Actualité éco<\/span><\/td><\/tr><\/table>(.*?)<\/table>/);
const actualite = actuZone.split(/(?=<tr><td style="padding:0 0 \d+px; color:#000B25; font-size:18px;)/).filter((b) => b.includes("font-size:18px;")).map((bloc) => {
  const [titre, ...paras] = tous(/<td[^>]*>(.*?)<\/td>/g, bloc);
  return { titre: dec(titre), texteHtml: paras };
});
const retenir = tous(/<td valign="top" style="padding:0 0 \d+px; font-size:16px; line-height:1.6; color:#1a1208;">(.*?)<\/td>/g).map(dec);
const cultZone = un(/Culture de marché<\/td>(.*?)<img/);
const cultParas = tous(/<td style="padding:0 0 \d+px; font-size:16px; line-height:1.6;">(.*?)<\/td>/g, cultZone);
const culture = {
  titre: dec(un(/font-size:18px; line-height:1.4; font-weight:700;">(.*?)<\/span>/, cultZone)),
  definition: dec(cultParas[0]),
  usage: dec(cultParas[1]),
};
const urlSchema = un(/<img src="([^"]*)" width="\d+" alt="Schéma/);
const enTete = un(/<img src="([^"]*)" width="\d+" alt="Trader 360/);

const s = (cloture, variation, seance = '2026-11-25') => ({ cloture, variation, seance });
const hier = {
  spx: s(7182.78, -0.25), nasdaq: s(23585.80, -0.62), dax: s(24702.13, -1.26),
  cac: s(7980.57, -0.75), oat: s(4.73, -0.04), btc: s(60384, 1.08),
};
const zones = {
  es: { cloture: 7195.75, poc: 7203.25, R2: 7375.58, R1: 7285.67, P: 7134.08, S1: 7044.17, S2: 6892.58 },
  cfd: { cloture: 7182.78, R2: 7346.60, R1: 7264.69, P: 7117.40, S1: 7035.49, S2: 6888.20 },
  psy: [7250, 7200, 7150, 7100],
  vix: { cloture: 28.29, seance: '2026-11-25' },
};
const corps = rendreCorps({ hier, zones, urlSchema,
  prose: { intro, psychologie: [psy], vix_lecture: vixLecture, agenda, actualite, retenir, culture } });
const rendu = rendreCourriel({ firstName: 'Emmanuel', dateLongFr: 'jeudi 26 novembre 2026', corpsHtml: corps,
  icones: ICONES_ESSAI, enTete, titre: false });

function comparer(nom, rendu, ref) {
  if (rendu === ref) {
    console.log(`✅ ${nom} : rendu identique à la référence, octet pour octet (${Buffer.byteLength(ref)} octets).`);
    return true;
  }
  let i = 0;
  while (i < rendu.length && rendu[i] === ref[i]) i++;
  console.error(`❌ ${nom} : écart au caractère ${i} (rendu ${rendu.length}, référence ${ref.length}).`);
  console.error(`   référence : …${ref.slice(Math.max(0, i - 120), i + 160)}`);
  console.error(`   rendu     : …${rendu.slice(Math.max(0, i - 120), i + 160)}`);
  return false;
}

// ── PROSPECTS (référence validée par Manu le 26/11/2026, test Brevo reçu) ──────────────
// Même contenu ; seul écart admis : le bouton « Répondre au questionnaire » porte les UTM
// prospects du questionnaire actuel (Manu : « trader360.fr/candidater/ avec les UTM »).
const refProBrut = fs.readFileSync(new URL('./reference/brief_reference_prospects_v22.html', import.meta.url), 'utf8');
const Q_REF = '<a href="https://trader360.fr/candidater/" style="display:inline-block; background:#d4af37;';
if (refProBrut.split(Q_REF).length !== 2) throw new Error('bouton du questionnaire introuvable (ou en double) dans la référence prospects');
const refPro = refProBrut.replace(Q_REF, Q_REF.replace('https://trader360.fr/candidater/', URL_QUESTIONNAIRE_PROSPECTS));
const renduPro = rendreCourriel({ firstName: 'Emmanuel', dateLongFr: 'jeudi 26 novembre 2026', corpsHtml: corps,
  variant: 'prospects', icones: ICONES_ESSAI, enTete, titre: false });

// ── PROSE SURVOLABLE : paragraphes courts, AUCUN gras dans la prose (27/11/2026) ──────
const { proseHtml } = await import('../api/_lib/brief-v22.js');
const { normaliserProse } = await import('../api/_lib/brief-gras.js');
const { controlerSansGras } = await import('../api/_lib/brief-garde.js');
const n = normaliserProse({ intro: ['<strong>Bref.</strong> a', 'b <strong>c d</strong> e\nf'], psychologie: 'g', vix_lecture: [], actualite: [{ titre: 't', texte: ['<STRONG class="x">h</STRONG> i'] }], retenir: ['j <strong>k</strong>'] });
const verifs = [
  ['toute balise échappée au rendu', proseHtml('<strong>a</strong> <b>x</b> <script>y</script>'), '&lt;strong&gt;a&lt;/strong&gt; &lt;b&gt;x&lt;/b&gt; &lt;script&gt;y&lt;/script&gt;'],
  ['gras retiré de la prose', JSON.stringify([n.prose.intro, n.prose.actualite[0].texte, n.prose.retenir]), JSON.stringify([['Bref. a', 'b c d e', 'f'], ['h i'], ['j k']])],
  ['paragraphes d\'une chaîne', JSON.stringify(n.prose.psychologie), JSON.stringify(['g'])],
  ['contrôle · sans gras admis', String(controlerSansGras('<p><b style="x">Titre</b><br>Texte.</p>').length), '0'],
  ['contrôle · <strong> refusé', String(controlerSansGras('<p><strong style="font-weight:700;">Bref.</strong> x</p>').length), '1'],
  ['contrôle · <strong> échappé refusé', String(controlerSansGras('<p>&lt;strong&gt;Bref.&lt;/strong&gt; x</p>').length), '1'],
];
// Un seul « Bonjour » : salutation d'ouverture retirée, et refusée si elle restait.
const { sansSalutation } = await import('../api/_lib/brief-gras.js');
const { controlerProse } = await import('../api/_lib/brief-garde.js');
verifs.push(
  ['salutation · « Bonjour à toi. » retiré', JSON.stringify(sansSalutation(['Bonjour à toi. Wall Street rouvre.']).intro), JSON.stringify(['Wall Street rouvre.'])],
  ['salutation · « Bonjour, » retiré', JSON.stringify(sansSalutation(['Bonjour, la séance est courte.']).intro), JSON.stringify(['La séance est courte.'])],
  ['salutation · texte sans salutation intact', JSON.stringify(sansSalutation(['Wall Street rouvre. Bonjour.']).intro), JSON.stringify(['Wall Street rouvre. Bonjour.'])],
  ['salutation · contrôle refuse', String(controlerProse({ intro: 'Bonjour à toi, la séance…' }).some((m) => m.startsWith('salutation'))), 'true'],
);
let okG = true;
for (const [nom, obtenu, attendu] of verifs) {
  if (obtenu === attendu) console.log(`✅ Gras · ${nom}`);
  else { okG = false; console.error(`❌ Gras · ${nom}\n   attendu : ${attendu}\n   obtenu  : ${obtenu}`); }
}

const okM = comparer('Membres', rendu, ref);
const okP = comparer('Prospects', renduPro, refPro);
process.exit(okM && okP && okG ? 0 : 1);
