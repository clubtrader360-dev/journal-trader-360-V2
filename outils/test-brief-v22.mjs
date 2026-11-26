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
import { rendreCorps, rendreCourriel, ICONES_ESSAI, LIEN_PARRAINAGE } from '../api/_lib/brief-v22.js';

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

const intro = dec(un(/Bonjour Emmanuel,<\/p><p[^>]*>(.*?)<\/p>/));
const psy = dec(un(/La psychologie du jour<\/div><p[^>]*>(.*?)<\/p>/));
const vixLecture = dec(un(/>28,29<\/td><\/tr><\/table><p[^>]*>(.*?)<\/p>/));
const agendaZone = un(/(<table[^>]*border-collapse:separate;">.*?<\/table>)/);
const agenda = tous(/<tr>(.*?)<\/tr>/g, agendaZone).map((tr) => ({
  heure: un(/white-space:nowrap;">(\d\d:\d\d)<\/td>/, tr),
  impact: un(/<span style="color:#d4af37;">(★*)<\/span>/, tr).length,
  pays: 'US',
  theme: dec(un(/color:#1a1208;">([^<]*)<\/td>$/, tr)),
}));
const actuZone = un(/Actualité éco<\/span><\/div>(.*?)<div style="height:16px;">/);
const actualite = tous(/<p[^>]*>(<b.*?)<\/p>/g, actuZone).map((p) => ({
  titre: dec(un(/<b[^>]*>(.*?)<\/b>/, p)), texteHtml: un(/<br>(.*)$/, p),
}));
const retenir = tous(/<li>(.*?)<\/li>/g).map(dec);
const cultZone = un(/Culture de marché<\/div>(.*?)<\/td>/);
const culture = {
  titre: dec(un(/font-size:17px; font-weight:700;">(.*?)<\/div>/, cultZone)),
  definition: dec(un(/<p style="margin:8px 0 0;[^>]*>(.*?)<\/p>/, cultZone)),
  usage: dec(un(/<p style="margin:10px 0 0;[^>]*>(.*?)<\/p>/, cultZone)),
};
const urlSchema = un(/<img src="([^"]*)" width="600" alt="Schéma/);
const enTete = un(/<img src="([^"]*)" width="600" alt="Trader 360/);

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

if (rendu === ref) {
  console.log(`✅ Rendu identique à la référence, octet pour octet (${Buffer.byteLength(ref)} octets).`);
  process.exit(0);
}
let i = 0;
while (i < rendu.length && rendu[i] === ref[i]) i++;
console.error(`❌ Écart au caractère ${i} (rendu ${rendu.length}, référence ${ref.length}).`);
console.error(`   référence : …${ref.slice(Math.max(0, i - 120), i + 160)}`);
console.error(`   rendu     : …${rendu.slice(Math.max(0, i - 120), i + 160)}`);
process.exit(1);
