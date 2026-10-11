/**
 * LES DEMANDES D'ACCES AU JOURNAL, COTE COACH.
 *
 * ── ⛔ POURQUOI CE FICHIER EXISTE ────────────────────────────────────────────
 *
 * Un eleve pouvait cliquer « Demander l'acces au journal », la date s'ecrivait
 * dans `acces_membre.journal_demande_le`, et ⛔ AUCUN ECRAN NE LA MONTRAIT JAMAIS
 * A UN COACH. Mesure du 11/10/2026 : zero occurrence de `journal_demande_le` dans
 * `supabase-coach.js`. La demande tombait dans le vide, l'eleve attendait, et
 * personne ne savait qu'il attendait.
 *
 * ⚠️ C'est le motif de ce projet : une action qui reussit, qui ne leve aucune
 * erreur, et qui ne produit rien. Le bouton marchait parfaitement et la
 * fonctionnalite etait inexistante.
 *
 * ── ⚠️ LECTURE DEPUIS LE NAVIGATEUR, ECRITURE PAR LE SERVEUR ────────────────
 *
 * La LECTURE passe par le client : `acces_membre_select` autorise un coach a
 * lire toutes les lignes, grace a sa branche `is_coach()`.
 *
 * ⛔ L'ECRITURE NON. Depuis la migration 03, `authenticated` n'a plus qu'une
 * colonne ecrivable sur cette table, `journal_demande_le`, et c'est voulu : un
 * `grant` de colonne porte sur le ROLE, donc l'ouvrir pour les coachs l'ouvrirait
 * pour les eleves. L'octroi passe donc par `/api/coach/acces-journal`, qui ecrit
 * avec la cle de service derriere une verification de coach.
 */
(function () {
  'use strict';

  /** Resolu a chaque appel : voir la note de `supabase-acces.js`. */
  const cli = () => {
    const c = window.supabaseClient;
    if (!c) console.error('[DEMANDES] ⛔ window.supabaseClient manquant');
    return c;
  };

  const txt = (s) => {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
  };

  /** « il y a 3 jours », plutot qu'une date brute : l'attente est l'information. */
  function depuis(iso) {
    const ms = Date.now() - Date.parse(iso);
    const jours = Math.floor(ms / 86400000);
    if (jours >= 2) return `depuis ${jours} jours`;
    if (jours === 1) return 'depuis hier';
    const heures = Math.floor(ms / 3600000);
    return heures >= 1 ? `depuis ${heures} h` : "a l'instant";
  }

  async function charger() {
    const zone = document.getElementById('coachDemandesJournal');
    if (!zone) return;

    const { data, error } = await cli()
      .from('acces_membre')
      .select('user_id, journal_demande_le')
      .not('journal_demande_le', 'is', null)
      .order('journal_demande_le', { ascending: true });

    if (error) {
      // ⛔ Dit a l'ecran, pas seulement dans la console : un coach qui ne voit
      // rien doit savoir si c'est « aucune demande » ou « lecture impossible ».
      console.error('[DEMANDES] ⚠️ lecture impossible :', error.message);
      zone.innerHTML = '<p class="text-red-600 text-center py-4">'
        + 'Les demandes n ont pas pu etre lues. Recharge la page.</p>';
      return;
    }

    if (!data || data.length === 0) {
      zone.innerHTML = '<p class="text-gray-500 text-center py-4">Aucune demande en cours</p>';
      return;
    }

    // ⚠️ Les noms viennent de `public.users`, et la jointure se fait ICI : les
    // deux tables ne sont pas liees par une cle etrangere, `acces_membre` etant
    // clavetee sur `auth.users` et non sur `public.users`. C'est voulu, et c'est
    // ce qui garantit que les 14 comptes sans ligne publique ont quand meme des
    // droits. ⛔ Leur nom peut donc manquer : on affiche l'identifiant, jamais rien.
    const ids = data.map((d) => d.user_id);
    const { data: gens } = await cli()
      .from('users').select('uuid, name, email').in('uuid', ids);
    const parId = new Map((gens || []).map((g) => [g.uuid, g]));

    zone.innerHTML = data.map((d) => {
      const g = parId.get(d.user_id);
      return `
      <div class="flex items-center justify-between p-4 bg-blue-50 rounded-lg border border-blue-200 mb-3">
        <div>
          <p class="font-semibold">${txt(g && g.name ? g.name : 'Nom non renseigne')}</p>
          <p class="text-sm text-gray-600">${txt(g && g.email ? g.email : d.user_id)}</p>
          <p class="text-sm text-gray-500">Demande ${txt(depuis(d.journal_demande_le))}</p>
        </div>
        <div class="space-x-2">
          <button onclick="DemandesJournal.repondre('${txt(d.user_id)}', 'accorder')"
                  class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
            Accorder le journal
          </button>
          <button onclick="DemandesJournal.repondre('${txt(d.user_id)}', 'differer')"
                  class="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 transition">
            Plus tard
          </button>
        </div>
      </div>`;
    }).join('');
  }

  async function repondre(userId, action) {
    const quoi = action === 'accorder'
      ? 'Ouvrir le journal a cette personne ?'
      : 'Retirer cette demande de la liste ? Elle pourra redemander.';
    if (!window.confirm(quoi)) return;

    const { data: s } = await cli().auth.getSession();
    const jeton = s?.session?.access_token;
    if (!jeton) { window.alert('Session expiree, reconnecte-toi.'); return; }

    try {
      const r = await fetch('/api/coach/acces-journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` },
        body: JSON.stringify({ user_id: userId, action }),
      });
      const c = await r.json().catch(() => ({}));
      // ⛔ On distingue le succes de l'echec sur `r.ok`, jamais sur l'absence
      // d'exception : une reponse 403 arrive sans lever quoi que ce soit.
      if (!r.ok || !c.ok) {
        console.error('[DEMANDES] ⚠️ refus du serveur :', r.status, c.motif);
        window.alert(`L action n a pas abouti : ${c.motif || r.status}`);
        return;
      }
      await charger();
    } catch (e) {
      console.error('[DEMANDES] ⚠️ appel impossible :', e && e.message);
      window.alert('L action n a pas abouti. Verifie ta connexion.');
    }
  }

  window.DemandesJournal = { charger, repondre };
})();
