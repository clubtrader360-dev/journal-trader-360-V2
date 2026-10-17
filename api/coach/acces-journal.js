/**
 * ACCORDER OU DIFFERER L'ACCES AU JOURNAL.
 *
 * ── ⛔ POURQUOI UNE ROUTE SERVEUR, ET PAS UN APPEL DEPUIS LE NAVIGATEUR ──────
 *
 * Le dashboard coach ecrit aujourd'hui directement depuis le navigateur :
 * `supabase.from('users').update({ status: 'active' })`. Cela fonctionne parce
 * que `public.users` a une politique qui autorise un coach a le faire.
 *
 * ⛔ CE CHEMIN N'EST PAS DISPONIBLE POUR `acces_membre`, ET C'EST VOULU. Le role
 * `authenticated` n'y a plus qu'une seule colonne ecrivable, `journal_demande_le`,
 * depuis la migration 03. Mesure du 11/10/2026 : les trois autres tentatives sont
 * refusees au niveau du privilege, avant meme RLS.
 *
 * ⚠️ ET LA SOLUTION N'EST SURTOUT PAS DE RENDRE `journal_actif` ECRIVABLE. Un
 * `grant` de colonne porte sur le ROLE, pas sur la personne : l'accorder a
 * `authenticated` le donnerait aussi a chaque eleve. La politique
 * `acces_membre_demande` leur permet deja d'ecrire leur propre ligne quand
 * `journal_actif` est faux ; avec le privilege de colonne en plus, ils pourraient
 * effacer `journal_retire_le` et repasser de « tu n'es plus abonne » a « demander
 * l'acces ». ⛔ Ce serait rouvrir exactement le trou qu'on vient de fermer.
 *
 * L'ecriture passe donc par la cle de service, qui contourne RLS, derriere une
 * verification de coach. C'est le seul chemin qui donne le droit a une personne
 * sans le donner a un role.
 *
 * ── ⚠️ CE QUE FAIT « DIFFERER », ET POURQUOI PAS « REFUSER » ────────────────
 *
 * `accorder` ouvre le journal. `differer` efface seulement la demande : l'eleve
 * repasse en « jamais demande » et peut redemander plus tard.
 *
 * ⛔ UNE DEMANDE QUI NE PEUT QU'ETRE ACCEPTEE RESTE ETERNELLEMENT EN ATTENTE
 * QUAND LA REPONSE EST NON. C'est pour cela que la seconde action existe.
 *
 * ⚠️ CE N'EST PAS UN REFUS DEFINITIF, ET C'EST DELIBERE : un vrai refus demande
 * un motif, une trace et probablement un message a l'eleve. C'est du produit, pas
 * de la technique. ⛔ Je propose, je ne tranche pas : voir le rapport.
 */
import { requireCoach, httpError } from '../vimeo/_lib/coach-auth.js';
import { getServiceClient } from '../tradovate/_lib/auth.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, motif: 'POST attendu' });
  }

  let coach;
  try {
    coach = await requireCoach(req);
  } catch (e) {
    const code = e?.statusCode || e?.status || 401;
    return res.status(code).json({ ok: false, motif: e?.message || 'non autorise' });
  }

  const corps = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
  const cible = String(corps.user_id || '').trim();
  const action = String(corps.action || '').trim();

  // ⚠️ Forme de l'identifiant verifiee ICI : une chaine libre partirait telle
  // quelle dans un filtre PostgREST, et un identifiant mal forme rend une erreur
  // obscure cote base plutot qu'un refus clair ici.
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cible)) {
    return res.status(400).json({ ok: false, motif: 'user_id absent ou mal forme' });
  }
  if (!['accorder', 'differer'].includes(action)) {
    return res.status(400).json({ ok: false, motif: 'action doit valoir accorder ou differer' });
  }

  const sb = getServiceClient();

  /**
   * ⛔ ON N'ACCORDE QUE SUR UNE DEMANDE EXISTANTE. Sans cette lecture prealable,
   * un coach pourrait ouvrir le journal a quelqu'un qui n'a rien demande, par un
   * identifiant copie de travers, et personne ne s'en apercevrait.
   */
  const { data: avant, error: lectureErr } = await sb
    .from('acces_membre')
    .select('user_id, journal_actif, journal_demande_le')
    .eq('user_id', cible)
    .maybeSingle();

  if (lectureErr) {
    console.error('[ACCES-JOURNAL] ⚠️ lecture impossible :', lectureErr.message);
    return res.status(500).json({ ok: false, motif: 'lecture impossible' });
  }
  if (!avant) return res.status(404).json({ ok: false, motif: 'aucun droit pour cet identifiant' });
  if (!avant.journal_demande_le) {
    return res.status(409).json({ ok: false, motif: 'aucune demande en cours pour cette personne' });
  }

  /**
   * ⛔ `public.users.status` N'EST PAS TOUCHE, NI ICI NI AILLEURS DANS CE CHEMIN.
   * Le retrait du journal et la fermeture du compte sont deux notions distinctes,
   * et les melanger ferait fermer un compte paye en croyant retirer un journal.
   * ⛔ `formation_actif` n'est pas touche non plus : accorder le journal ne dit
   * rien de la formation.
   */
  const champs = action === 'accorder'
    ? { journal_actif: true, journal_demande_le: null, journal_retire_le: null, updated_at: new Date().toISOString() }
    : { journal_demande_le: null, updated_at: new Date().toISOString() };

  const { error: ecritureErr } = await sb
    .from('acces_membre')
    .update(champs)
    .eq('user_id', cible);

  if (ecritureErr) {
    console.error('[ACCES-JOURNAL] ⚠️ ecriture refusee :', ecritureErr.message);
    return res.status(500).json({ ok: false, motif: 'ecriture refusee' });
  }

  console.log(`[ACCES-JOURNAL] ✅ ${action} pour ${cible} par ${coach.email}`);
  return res.status(200).json({ ok: true, action, user_id: cible });
}
