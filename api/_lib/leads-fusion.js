/**
 * CRM · LEADS : la fusion des sources, par adresse e-mail (Nadir, 27/10/2026).
 * « Je n'ai que les tests, pas les prospects des autres listes. » Un lead est donc une
 * PERSONNE, réunie depuis :
 *  - le site : candidatures (regroupées), étape, contacts notés, commandes ;
 *  - le site : prospects (inscrits au brief, à la présentation) ;
 *  - Brevo : tous les contacts, avec leurs listes.
 * ⛔ Un membre du club n'est pas un lead, SAUF s'il a candidaté, payé, ou s'il a déjà
 * une étape ou un contact noté : on ne fait pas disparaître un suivi en cours.
 * ⚠️ Les coachs, leurs alias (+test…) et les adresses de test sont marqués `interne` :
 * l'écran les masque par défaut, sans les supprimer.
 */
const EQUIPE = ['clubtrader360@gmail.com', 'nkasmi59@gmail.com', 'emmanuel.galiano@gmail.com', 'manugaliano@gmail.com'];
const norm = (e) => String(e ?? '').trim().toLowerCase();
/** « a+test@x.fr » → « a@x.fr » : un alias de l'équipe reste l'équipe. */
const sansAlias = (e) => { const [u, d] = norm(e).split('@'); return d ? `${u.split('+')[0]}@${d}` : norm(e); };

export function estInterne(email, nom, coachs = []) {
  const e = norm(email), base = sansAlias(e);
  if ([...EQUIPE, ...coachs.map(norm)].includes(base)) return true;
  return /test/i.test(e) || /\btest\b/i.test(String(nom || ''));
}

export function fusionnerLeads({ site = [], prospects = [], brevo = [], listes = [], coachs = [] }) {
  const nomListe = new Map(listes.map((l) => [l.id, l.nom]));
  const m = new Map();
  const de = (e) => {
    if (!m.has(e)) m.set(e, { email: e, prenom: '', nom: '', telephone: '', statut: 'nouvelle', candidatures: 0, interactions: 0, dernier_contact: null, client: false, montant: 0, listes: [], entre_le: null, compte: null, bloque: false });
    return m.get(e);
  };
  const plusTot = (a, b) => (!a ? b : !b ? a : (a < b ? a : b));
  for (const l of site) {
    const x = de(norm(l.email));
    Object.assign(x, { ...l, email: norm(l.email), listes: x.listes });
    x.entre_le = plusTot(x.entre_le, l.premiere_candidature || null);
  }
  for (const p of prospects) {
    const e = norm(p.email); if (!e) continue;
    const x = de(e);
    if (!x.prenom) x.prenom = p.prenom || '';
    x.entre_le = plusTot(x.entre_le, p.created_at || null);
    if (!x.page_origine) x.page_origine = p.page_origine || null;
  }
  for (const c of brevo) {
    const e = norm(c.email); if (!e) continue;
    const dejaSite = m.has(e);
    // Un membre sans suivi commercial n'est pas un lead.
    if (c.compte === 'coach') continue;
    if (c.compte === 'membre' && !dejaSite) continue;
    const x = de(e);
    if (!x.prenom) x.prenom = c.prenom || '';
    if (!x.nom) x.nom = c.nom || '';
    if (!x.telephone) x.telephone = c.telephone || '';
    x.listes = (c.listes || []).map((id) => nomListe.get(id) || `Liste ${id}`);
    x.compte = c.compte || null;
    x.bloque = !!c.bloque;
    x.brevo_id = c.id;
    x.entre_le = plusTot(x.entre_le, c.cree_le || null);
  }
  // Un membre venu du site sans candidature, paiement, étape ni contact : pas un lead.
  return [...m.values()]
    .filter((x) => !(x.compte === 'membre' && !x.candidatures && !x.client && x.statut === 'nouvelle' && !x.interactions))
    .map((x) => ({ ...x, interne: estInterne(x.email, `${x.prenom} ${x.nom}`, coachs) }));
}

/** La source affichée : affilié, live, campagne, réponse au questionnaire, puis listes. */
export function sourceDe(x) {
  if (x.affilies) return `Lien de ${x.affilies.nom}`;
  if (x.utm_source === 'webinaire') return `Live ${x.utm_campaign || ''}`.trim();
  if (x.utm_source) return x.utm_source;
  if (x.recommande_par) return x.recommande_par;
  if (x.listes && x.listes.length) return x.listes[0];
  if (x.page_origine) return x.page_origine;
  return 'Direct';
}
