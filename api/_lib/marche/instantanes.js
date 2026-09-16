// ========================================================================
// Les instantanés de clôture, RELUS.
//
// ⚠️ POURQUOI CE FICHIER EXISTE. Le prélèvement de 17h05 déposait ses instantanés sur
// la branche `donnees-marche`, le workflow du brief allait les chercher… et personne
// ne les lisait. `collecterMarche` accepte bien un paramètre `historique`, mais aucun
// appelant ne le remplissait : le `git fetch` se contentait d'imprimer une ligne de
// log rassurante. Les hauts et bas d'ES seraient donc restés en n/d indéfiniment, et
// le matin où le tableau devait être complet ne serait jamais venu.
//
// C'est le défaut le plus instructif de toute cette refonte : le mécanisme était
// écrit, testé isolément, déployé — et débranché. Aucun test ne l'a vu parce qu'aucun
// test n'allait de bout en bout ; celui de la reprise des chiffres, lui, ne pouvait
// pas le voir non plus, puisqu'une valeur n/d y est légitimement exclue du contrôle.
// ========================================================================
import fs from 'node:fs';
import path from 'node:path';

/**
 * L'instantané d'une séance donnée, ou `null`.
 *
 * La date est LUE DANS LE FICHIER et comparée à celle demandée. Se fier au nom du
 * fichier reviendrait à faire confiance à ce que le prélèvement a bien voulu écrire ;
 * un instantané périmé publié sous la date d'aujourd'hui serait exactement l'erreur
 * que toute cette refonte cherche à rendre impossible.
 */
function lireSeance(dossier, dateIso) {
  const f = path.join(dossier, `${dateIso}.json`);
  if (!fs.existsSync(f)) return null;
  let j;
  try { j = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; }
  if (j?.date !== dateIso) return null;
  // Un prélèvement forcé a été pris hors de l'interruption du Globex : ses hauts et
  // bas décrivent une séance en cours. Il est refusé, pas corrigé.
  if (j.force) return null;
  const nb = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const haut = nb(j.esHaut), bas = nb(j.esBas);
  if (haut === null || bas === null || !(haut > bas)) return null;
  return { date: dateIso, haut, bas, contrat: j.contrat || null, preleveA: j.preleveA || null };
}

/**
 * Ce que les instantanés apportent au brief : hauts et bas d'ES, séance et semaine.
 *
 * La semaine va du lundi à la séance de référence INCLUSE, jamais au-delà — même règle
 * que pour le comptant. Une semaine incomplète est rendue quand même, avec le nombre
 * de séances réellement présentes : trois séances sur quatre valent mieux qu'un n/d,
 * à condition de dire combien. Ce compte remonte dans l'audit.
 *
 * ⚠️ LE CONTRAT DES INSTANTANÉS EST VÉRIFIÉ. Un haut de semaine qui mélangerait deux
 * échéances de part et d'autre d'un roulement serait une fourchette qui n'a jamais
 * existé. Les séances portant un autre contrat que celui du jour sont écartées, et
 * l'écart est signalé.
 */
export function historiqueInstantanes(dossier, seanceIso, contratAttendu) {
  const vide = { presents: 0, ecartes: [], motif: null };
  if (!dossier || !fs.existsSync(dossier)) {
    return { ...vide, motif: `aucun dossier d'instantanés (${dossier || 'chemin non fourni'})` };
  }
  const [a, m, j] = seanceIso.split('-').map(Number);
  const fin = Date.UTC(a, m - 1, j);
  const debut = fin - ((new Date(fin).getUTCDay() + 6) % 7) * 86400000;

  const retenues = [];
  const ecartes = [];
  for (let t = debut; t <= fin; t += 86400000) {
    const s = lireSeance(dossier, new Date(t).toISOString().slice(0, 10));
    if (!s) continue;
    if (contratAttendu && s.contrat && s.contrat !== contratAttendu) {
      ecartes.push(`${s.date} (contrat ${s.contrat})`);
      continue;
    }
    retenues.push(s);
  }

  const duJour = retenues.find((s) => s.date === seanceIso);
  const res = { presents: retenues.length, ecartes, motif: null };
  if (duJour) { res.esHautSeance = duJour.haut; res.esBasSeance = duJour.bas; res.preleveA = duJour.preleveA; }
  else res.motif = `aucun instantané retenu pour la séance du ${seanceIso}`
    + (ecartes.length ? ` (écartés : ${ecartes.join(', ')})` : '');
  // ⚠️ PAS DE SEMAINE SANS LA SÉANCE DE RÉFÉRENCE. Si l'instantané du jour visé manque
  // ou a été rejeté, le haut de semaine ne couvrirait que les séances précédentes : il
  // exclurait précisément celle dont le brief parle, sans que le lecteur puisse le
  // voir. Une fourchette hebdomadaire amputée de son dernier jour est une fourchette
  // fausse, pas une fourchette partielle.
  if (retenues.length && duJour) {
    res.esHautSemaine = Math.max(...retenues.map((s) => s.haut));
    res.esBasSemaine = Math.min(...retenues.map((s) => s.bas));
    res.seancesSemaine = retenues.length;
  }
  return res;
}
