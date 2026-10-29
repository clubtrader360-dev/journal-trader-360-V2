/**
 * BANC DU POC ES (29/10/2026) : api/_lib/marche/poc.js, la vraie.
 * Séances synthétiques dont le POC est connu par construction.
 * Usage : node outils/poc-banc.mjs
 */
import { calculerPoc, pocControle, minutesSeance } from '../api/_lib/marche/poc.js';
let ko = 0; const dire = (ok, m, v) => { console.log((ok ? 'ok  ' : '⛔  ') + m + (v !== undefined ? '  ' + JSON.stringify(v).slice(0, 200) : '')); if (!ok) ko++; };

// Une séance régulière de 390 minutes : le prix oscille entre 7 750 et 7 790, et passe
// beaucoup de temps (et de volume) autour de `centre`.
function seance(centre = 7771.25, { manque = 0, sansVolume = 0, derniere = 7783.25, decalage = 0 } = {}) {
  const b = [];
  let n = 0;
  for (let h = 9; h < 16; h++) for (let m = 0; m < 60; m++) {
    const hhmm = h * 100 + m;
    if (hhmm < 930) continue;
    n++;
    if (n <= manque) continue;
    const proche = n % 3 === 0;                      // un tiers des minutes collent au centre
    const milieu = proche ? centre : 7750 + ((n * 7) % 160) * 0.25;
    b.push({ hhmm, haut: milieu + (proche ? 0 : 0.5) + decalage, bas: milieu - (proche ? 0 : 0.5) + decalage, cloture: milieu + decalage, volume: n <= manque + sansVolume ? 0 : (proche ? 900 : 300) });
  }
  b[b.length - 1].cloture = derniere;
  return b;
}

dire(minutesSeance(seance()).length === 390, 'la séance régulière compte 390 minutes');
let r = calculerPoc(seance());
dire(r.poc === 7771.25, 'POC = le prix où le volume s est concentré', r.poc);
dire(calculerPoc(seance(7760.5)).poc === 7760.5, 'TÉMOIN : déplacer le volume déplace le POC (7 760,50)', calculerPoc(seance(7760.5)).poc);
dire(calculerPoc([{ haut: 7700, bas: 7700, volume: 10 }]).poc === 7700, 'une minute sans amplitude : tout son volume sur un seul tick');
dire(calculerPoc([{ haut: 7701, bas: 7700, volume: 50 }, { haut: 7700, bas: 7700, volume: 1 }]).poc === 7700, 'répartition par tick : 7 700 cumule plus que ses voisins');
const egal = [{ haut: 7700, bas: 7700, volume: 5 }, { haut: 7710, bas: 7710, volume: 5 }, { haut: 7709, bas: 7709, volume: 1 }];
dire(calculerPoc(egal).poc === 7710 && calculerPoc([...egal].reverse()).poc === 7710, 'égalité : règle fixe (le plus proche du prix moyen), indépendante de l ordre');
// Les minutes hors séance régulière ne comptent pas, même avec un volume énorme.
const avecNuit = [{ hhmm: 400, haut: 7700.25, bas: 7700, cloture: 7700, volume: 1e9 }, ...seance(), { hhmm: 1630, haut: 7700.25, bas: 7700, cloture: 7700, volume: 1e9 }];
dire(pocControle(avecNuit, { reglement: 7783.25 }).valeur === 7771.25, 'minutes de nuit et d après 16 h ignorées');

const avecRecap = seance(); avecRecap.splice(200, 1, { hhmm: avecRecap[200].hhmm, haut: 7700.25, bas: 7700, cloture: 7700, volume: 5e7 });
dire(minutesSeance(avecRecap).length === 389 && calculerPoc(minutesSeance(avecRecap)).poc === 7771.25, 'récapitulatif de journée (volume aberrant) écarté');
const ctl = { reglement: 7783.25, hautJour: 7819.5, basJour: 7742.75 };
let p = pocControle(seance(), ctl);
dire(p.valeur === 7771.25 && p.minutes === 390, 'séance complète et cohérente : POC publié', p);
p = pocControle(seance(7771.25, { manque: 30 }), ctl);
dire(!p.valeur && /360 minutes/.test(p.motif), 'trente minutes manquantes : refusé', p.motif);
p = pocControle(seance(7771.25, { sansVolume: 40 }), ctl);
dire(!p.valeur && /volume absent/.test(p.motif), 'volume absent sur 40 minutes : refusé', p.motif);
p = pocControle(seance(7771.25, { derniere: 7753.5 }), ctl);
dire(!p.valeur && /règlement/.test(p.motif), 'dernière minute à 30 points du règlement : refusé (autre contrat)', p.motif);
p = pocControle(seance(7771.25, { decalage: 40 }), ctl);
dire(!p.valeur && /haut du jour/.test(p.motif), 'minutes au-dessus du haut du jour : refusé (contrat décalé)', p.motif);
p = pocControle(seance(), { reglement: 7783.25 });
dire(p.valeur === 7771.25, 'barre du jour indisponible : les autres contrôles suffisent');

console.log(ko ? `\n⛔ ${ko} défaut(s)` : '\nbanc vert'); process.exitCode = ko ? 1 : 0;
