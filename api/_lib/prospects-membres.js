// ========================================
// UN MEMBRE N'EST PLUS UN PROSPECT : retrait de la liste PROSPECTS (6) de toute adresse
// présente dans la liste MEMBRES T360 (7).
//
// Demande de Manu, relayée par Nadir le 21/10/2026 : « s'ils deviennent membres et qu'ils
// étaient dans la liste prospect, les enlever de prospect et les laisser dans membres ».
//
// ⚠️ ON REGARDE LE RÉSULTAT, PAS LE CHEMIN. On devient membre par le tableur de Manu, par une
// création de compte, demain par la page de commande. Brancher le retrait sur un seul de ces
// chemins laisserait les autres membres recevoir les campagnes de vente, sans erreur. On
// compare donc les deux listes, chaque jour : quiconque est dans la 7 sort de la 6.
//
// ⛔ CE QUI N'EST JAMAIS FAIT : supprimer un contact, le désinscrire, le retirer de la liste
// MEMBRES ou de toute autre liste. Un retrait de liste se défait d'un clic dans Brevo.
//
// ⛔ GARDE-FOU SUR LES NUMÉROS : avant d'agir, on relit le NOM des deux listes. Si la 6 ne
// s'appelle plus « PROSPECTS » ou la 7 plus « MEMBRES », rien n'est retiré : une liste
// renumérotée ou renommée ne doit pas devenir la cible d'un retrait massif.
// ========================================

import { brevo, fail, getListContacts } from './brevo-client.js';

export const LISTE_PROSPECTS = 6;
export const LISTE_MEMBRES = 7;
const LOT = 150; // Brevo accepte 150 adresses par appel de retrait.

const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/** Les adresses à retirer : présentes dans les deux listes. Pure, pour le banc. */
export function aRetirer(prospects, membres) {
  return [...prospects].filter((e) => membres.has(e)).sort();
}

/**
 * @param {{ appliquer?: boolean }} o  sans `appliquer: true`, ne fait que compter.
 * @returns {Promise<{ prospects: number, membres: number, retires: string[], applique: boolean }>}
 */
export async function retirerMembresDesProspects({ appliquer = false } = {}) {
  // ⚠️ NOM EXACT, pas « contient » : « BRIEF PROSPECTS T360 » (liste 18) contient
  // « PROSPECT », et un `includes` l aurait acceptee. Attrape par le banc le 21/10.
  for (const [id, attendu, ok] of [
    [LISTE_PROSPECTS, 'PROSPECTS', (n) => n === 'PROSPECTS'],
    [LISTE_MEMBRES, 'MEMBRES T360', (n) => n === 'MEMBRES T360'],
  ]) {
    const { status, body } = await brevo(`/contacts/lists/${id}`);
    if (status < 200 || status >= 300) fail(`lecture de la liste ${id}`, status, body);
    if (!ok(norm(body && body.name).trim())) {
      throw new Error(`liste ${id} nommée « ${body && body.name} », attendu « ${attendu} » : aucun retrait`);
    }
  }
  const [prospects, membres] = await Promise.all([getListContacts(LISTE_PROSPECTS), getListContacts(LISTE_MEMBRES)]);
  const retires = aRetirer(prospects, membres);
  if (appliquer) {
    for (let i = 0; i < retires.length; i += LOT) {
      const lot = retires.slice(i, i + LOT);
      const { status, body } = await brevo(`/contacts/lists/${LISTE_PROSPECTS}/contacts/remove`, { method: 'POST', body: { emails: lot } });
      // ⚠️ `fetch` ne lève pas sur un 4xx : le statut est lu, un refus n'est pas un succès.
      if (status < 200 || status >= 300) fail(`retrait de ${lot.length} membre(s) de la liste PROSPECTS`, status, body);
    }
  }
  console.log(`[PROSPECTS] ${retires.length} membre(s) ${appliquer ? 'retiré(s) de' : 'à retirer de'} la liste PROSPECTS (prospects ${prospects.size}, membres ${membres.size})`);
  return { prospects: prospects.size, membres: membres.size, retires, applique: appliquer };
}
