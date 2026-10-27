/* ══ CRM : LA RECOPIE DE BREVO, EN LECTURE SEULE (27/10) ═══════════════════
 * Arbitrage de Nadir, 27/10/2026 : « le CRM dans notre back-office, c'est juste une
 * recopie de Brevo ». ⛔ AUCUNE ÉCRITURE ICI : pas d'ajout, de retrait ni de
 * désinscription. Brevo reste la source ; on s'y rend par le lien de la fiche.
 * ⚠️ Les contacts se lisent EN ENTIER (pages de 1000) puis se filtrent dans
 * l'écran : l'API ne cherche qu'une adresse exacte, et la base compte quelques
 * centaines de contacts. Au-delà de 20 000, l'écran le dit au lieu de tronquer
 * en silence.
 * ⛔ Les IP d'ouverture que Brevo renvoie dans `statistics` ne sortent pas d'ici.
 */
export const CRM_SOUS_ACTIONS = ['listes', 'contacts', 'contact'];
const CRM_PLAFOND = 20000;
async function crmMembres(sb, httpError) {
  const { data, error } = await sb.from('users').select('email, role');
  if (error) throw httpError(500, `comptes illisibles : ${error.message}`);
  const m = new Map();
  for (const u of data || []) if (u.email) m.set(String(u.email).trim().toLowerCase(), u.role === 'coach' ? 'coach' : 'membre');
  return m;
}
function crmLigne(c, membres) {
  const a = c.attributes || {};
  const email = String(c.email || '').toLowerCase();
  return {
    id: c.id, email, prenom: a.PRENOM || a.FIRSTNAME || '', nom: a.NOM || a.LASTNAME || '', telephone: a.SMS || '',
    listes: c.listIds || [], desinscrit_listes: c.listUnsubscribed || [], bloque: !!c.emailBlacklisted,
    cree_le: c.createdAt || null, modifie_le: c.modifiedAt || null, compte: membres.get(email) || null,
  };
}
export async function crm(sb, corps, { brevoOk, httpError }) {
  const sous = String(corps.sous_action || '');
  if (!CRM_SOUS_ACTIONS.includes(sous)) throw httpError(400, 'sous_action inconnue');
  if (sous === 'listes') {
    const toutes = [];
    for (let offset = 0; offset < 1000; offset += 50) {
      const b = await brevoOk(`/contacts/lists?limit=50&offset=${offset}&sort=desc`, {}, 'lecture des listes');
      toutes.push(...(b.lists || []));
      if (!b.lists || b.lists.length < 50) break;
    }
    return toutes.map((l) => ({ id: l.id, nom: l.name, dossier: l.folderId ?? null, contacts: l.uniqueSubscribers ?? null }));
  }
  if (sous === 'contacts') {
    const [membres, lus] = await Promise.all([crmMembres(sb, httpError), (async () => {
      const out = []; let total = null;
      for (let offset = 0; offset < CRM_PLAFOND; offset += 1000) {
        const b = await brevoOk(`/contacts?limit=1000&offset=${offset}&sort=desc`, {}, 'lecture des contacts');
        total = b.count ?? total;
        out.push(...(b.contacts || []));
        if (!b.contacts || b.contacts.length < 1000) break;
      }
      return { out, total };
    })()]);
    return { total: lus.total ?? lus.out.length, tronque: (lus.total ?? 0) > lus.out.length, contacts: lus.out.map((c) => crmLigne(c, membres)) };
  }
  // sous === 'contact' : la fiche, avec l'activité des campagnes.
  const ident = String(corps.id ?? corps.email ?? '').trim();
  if (!/^\d+$/.test(ident) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ident)) throw httpError(400, 'identifiant ou adresse attendu');
  const [membres, c] = await Promise.all([crmMembres(sb, httpError), brevoOk(`/contacts/${encodeURIComponent(ident.toLowerCase())}`, {}, 'lecture du contact')]);
  const st = c.statistics || {};
  const n = (x) => (Array.isArray(x) ? x.length : 0);
  const dernier = (x) => (Array.isArray(x) && x.length ? x.map((e) => e.eventTime).filter(Boolean).sort().pop() || null : null);
  const campagnes = (x) => new Set((Array.isArray(x) ? x : []).map((e) => e.campaignId)).size;
  const desinsc = st.unsubscriptions || {};
  return {
    ...crmLigne(c, membres),
    attributs: Object.fromEntries(Object.entries(c.attributes || {}).filter(([, v]) => v !== '' && v != null)),
    activite: {
      envoyes: n(st.messagesSent), delivres: n(st.delivered),
      ouverts: campagnes(st.opened), cliques: campagnes(st.clicked),
      rebonds: n(st.hardBounces) + n(st.softBounces),
      desinscriptions: n(desinsc.userUnsubscription) + n(desinsc.adminUnsubscription),
      dernier_envoi: dernier(st.messagesSent), derniere_ouverture: dernier(st.opened),
    },
  };
}
