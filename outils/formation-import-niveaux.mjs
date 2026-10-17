/**
 * IMPORTE LE NIVEAU LEARNYBOX DE CHAQUE ELEVE DANS `formation_niveau_learnybox`.
 *
 * ── ⛔ POURQUOI CE NIVEAU, ET PAS LA PROGRESSION ───────────────────────────
 *
 * L export du back-office LearnyBox (14/10/2026) donne par membre ses GROUPES
 * (« Débutants, Intermédiaire, Confirmé »), sa progression globale en %, son
 * etat et ses dates. ⚠️ Il ne donne PAS le detail par module ni par chapitre,
 * et l API ne l expose pas non plus (mesure par le connecteur, meme jour).
 *
 * Le groupe le plus haut est le NIVEAU ACQUIS : c est ce que les coachs ont
 * ouvert a l eleve apres paiement, quiz et seances. ⛔ C est donc la source qui
 * remplace, pour les eleves existants, les trois conditions de niveau que
 * l espace formation ne sait pas encore lire. Un Confirmé voit 01 a 09.
 *
 * ── ⚠️ CE QUE L OUTIL NE FAIT PAS ───────────────────────────────────────────
 *
 * ⛔ Il n ecrit rien lui-meme : il PRODUIT le SQL, relu avant d etre joue par
 * le connecteur Supabase. Le fichier source porte des adresses postales et
 * des telephones : ⛔ seules les colonnes utiles sont lues, et le CSV ne va
 * jamais dans le depot.
 * ⛔ Il ne coche aucun chapitre : sans detail par chapitre, cocher serait
 * inventer. L eleve recoche ses videos a son rythme, ses niveaux sont ouverts.
 *
 * Usage :
 *   node outils/formation-import-niveaux.mjs chemin/export.csv > /tmp/niveaux.sql
 */
import { readFileSync } from 'node:fs';

const chemin = process.argv[2];
if (!chemin) { console.error('usage : node outils/formation-import-niveaux.mjs export.csv'); process.exit(1); }

/** Un CSV point-virgule, champs entre guillemets, BOM possible. */
function lireCsv(texte) {
  const lignes = texte.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const champs = (l) => {
    const out = [];
    let cur = '';
    let dans = false;
    for (let i = 0; i < l.length; i += 1) {
      const ch = l[i];
      if (ch === '"') {
        if (dans && l[i + 1] === '"') { cur += '"'; i += 1; } else dans = !dans;
      } else if (ch === ';' && !dans) { out.push(cur); cur = ''; } else cur += ch;
    }
    out.push(cur);
    return out;
  };
  const entetes = champs(lignes[0]);
  return lignes.slice(1).map((l) => Object.fromEntries(champs(l).map((v, i) => [entetes[i], v])));
}

const RANG = { debutants: 'debutant', débutants: 'debutant', débutant: 'debutant', intermédiaire: 'intermediaire', intermediaire: 'intermediaire', confirmé: 'confirme', confirme: 'confirme' };
const ORDRE = ['debutant', 'intermediaire', 'confirme'];
/** « Débutants, Confirmé, Intermédiaire » -> 'confirme'. « Aucun groupe » -> null. */
function niveauDe(groupes) {
  const cles = String(groupes || '').split(',').map((g) => RANG[g.trim().toLowerCase()]).filter(Boolean);
  if (!cles.length) return null;
  return ORDRE[Math.max(...cles.map((c) => ORDRE.indexOf(c)))];
}
const q = (v) => (v == null || v === '' ? 'null' : `'${String(v).replace(/'/g, "''")}'`);
const date = (v) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? `'${v.replace(' ', 'T')}+02:00'` : 'null');

const rows = lireCsv(readFileSync(chemin, 'utf8'));
const valeurs = [];
const comptes = { debutant: 0, intermediaire: 0, confirme: 0, aucun: 0, inactifs: 0 };
for (const r of rows) {
  const niveau = niveauDe(r.Groupes);
  const pct = parseInt(String(r.Progression).replace('%', ''), 10);
  const actif = r.Etat === 'Actif';
  if (!niveau) comptes.aucun += 1; else comptes[niveau] += 1;
  if (!actif) comptes.inactifs += 1;
  valeurs.push(`(${q(r.Id)}, ${q(r['Adresse email'].trim().toLowerCase())}, ${q(r['Prénom'].trim())}, ${q(r.Nom.trim())}, ${q(niveau)}, ${q(r.Groupes)}, ${Number.isFinite(pct) ? pct : 'null'}, ${actif}, ${date(r["Date d'inscription"])}, ${date(r['Date de dernière activité'])})`);
}
// ⚠️ TEMOIN : les trois formes de groupes se lisent, et « Aucun groupe » rend null.
const temoins = [niveauDe('Débutants, Confirmé, Intermédiaire') === 'confirme', niveauDe('Débutants, Intermédiaire') === 'intermediaire', niveauDe('Débutants') === 'debutant', niveauDe('Aucun groupe') === null];
if (!temoins.every(Boolean)) { console.error('⛔ temoin de niveau en echec', temoins); process.exit(1); }

console.error(`${rows.length} membres lus : ${comptes.debutant} debutant, ${comptes.intermediaire} intermediaire, ${comptes.confirme} confirme, ${comptes.aucun} sans groupe, ${comptes.inactifs} desactives`);
/*
 * ⛔ REGLE DES COACHS (16/10/2026) : un membre desactive dans LearnyBox perd la
 * formation ET le journal. Ses donnees restent, les cases du back-office les
 * rouvrent.
 * ⚠️ On ne ferme qu au PASSAGE actif -> desactive (ou a la premiere arrivee
 * deja desactive). Fermer a chaque import ecraserait une reouverture faite a la
 * main par un coach, sans la moindre erreur. `avant` lit l etat d AVANT
 * l insertion : dans une meme requete, toutes les sous-requetes voient le meme
 * instantane.
 */
console.log(`with avant as (
  select learnybox_id, actif from public.formation_niveau_learnybox
), maj as (
insert into public.formation_niveau_learnybox
  (learnybox_id, email, prenom, nom, niveau, groupes, progression_pct, actif, inscrit_le, derniere_activite)
values
${valeurs.join(',\n')}
on conflict (learnybox_id) do update set
  email = excluded.email, prenom = excluded.prenom, nom = excluded.nom, niveau = excluded.niveau,
  groupes = excluded.groupes, progression_pct = excluded.progression_pct, actif = excluded.actif,
  inscrit_le = excluded.inscrit_le, derniere_activite = excluded.derniere_activite, importe_le = now()
returning learnybox_id, email, actif
)
update public.acces_membre a
   set formation_actif = false, journal_actif = false, journal_retire_le = now(), updated_at = now()
  from maj
  join auth.users u on lower(u.email) = lower(maj.email)
  left join avant on avant.learnybox_id = maj.learnybox_id
 where a.user_id = u.id
   and maj.actif = false
   and coalesce(avant.actif, true) = true
returning u.email as ferme_pour;`);
