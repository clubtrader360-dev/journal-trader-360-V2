/**
 * LES DEUX DROITS : formation et journal.
 *
 * ── ⛔ CE FICHIER NE PROTÈGE RIEN ────────────────────────────────────────────
 *
 * Il décide quels boutons montrer, et rien d'autre. ⛔ MASQUER UN BOUTON N'EST
 * PAS UNE PROTECTION : qui connaît l'adresse entre quand même, et cela ne lève
 * d'erreur chez personne. La barrière réelle est dans les politiques RLS, posées
 * par `migrations/01-acces-membre.sql` : une donnée de journal n'est lisible que
 * si `a_acces_journal()` rend vrai, quel que soit ce que fait l'interface.
 *
 * Ce module sert donc le confort, pas la sécurité, et c'est dit ici pour que
 * personne ne s'appuie dessus en croyant s'appuyer sur une serrure.
 *
 * ── ⚠️ UNE LIGNE ABSENTE VAUT REFUS. UNE ERREUR DE REQUÊTE, NON ─────────────
 *
 * Les deux cas se ressemblent et ne veulent pas dire la même chose :
 *
 *   requête réussie, aucune ligne  →  la personne n'a pas le droit  →  REFUS
 *   requête en erreur              →  on ne SAIT pas                →  pas un refus
 *
 * ⚠️ LA SECONDE BRANCHE EST UNE PRÉCAUTION DE TRANSITION, ET ELLE EST TEMPORAIRE.
 * Tant que `acces_membre` n'est pas appliquée en base, toute requête échoue avec
 * `42P01 relation inexistante`. Traiter cela comme un refus fermerait le journal
 * aux 102 élèves au premier déploiement, pour une table pas encore créée.
 *
 * ⛔ À RETIRER UNE FOIS LA MIGRATION APPLIQUÉE ET VÉRIFIÉE (102 lignes). Tant que
 * cette branche existe, une panne de base ouvre les deux portes. Le défaut est
 * borné par les politiques RLS, qui elles ne cèdent pas : sans droit, l'interface
 * s'ouvre mais les données ne viennent pas.
 */
(function () {
  'use strict';

  /** Ce qu'on sait des droits de la personne connectée. */
  let _droits = null;

  /** ⛔ Transition. Voir l'en-tête : à retirer après application de la migration. */
  const TOLERER_TABLE_ABSENTE = true;

  async function charger() {
    let uid = null;
    try {
      const { data } = await supabase.auth.getUser();
      uid = data?.user?.id || null;
    } catch { uid = null; }

    if (!uid) {
      _droits = { formation: false, journal: false, connu: true, motif: 'aucune session' };
      return _droits;
    }

    const { data, error } = await supabase
      .from('acces_membre')
      .select('formation_actif, journal_actif')
      .eq('user_id', uid)
      .maybeSingle();

    if (error) {
      const absente = error.code === '42P01' || /acces_membre/i.test(error.message || '');
      console.error(`[ACCES] ⚠️ droits illisibles : ${error.message}`);
      if (absente && TOLERER_TABLE_ABSENTE) {
        console.warn('[ACCES] ⛔ table absente : les deux espaces sont ouverts par TOLÉRANCE '
          + 'de transition. Les politiques RLS restent la vraie barrière.');
        _droits = { formation: true, journal: true, connu: false, motif: 'table absente' };
      } else {
        // ⛔ Une erreur qui n'est pas « table absente » ne s'interprète pas : on ne
        // sait pas, donc on ne prétend pas savoir.
        _droits = { formation: false, journal: false, connu: false, motif: 'erreur' };
      }
      return _droits;
    }

    // ⚠️ Requête réussie SANS ligne : c'est un refus, pas une inconnue.
    _droits = {
      formation: !!(data && data.formation_actif),
      journal: !!(data && data.journal_actif),
      connu: true,
      motif: data ? 'lu en base' : 'aucune ligne',
    };
    return _droits;
  }

  /** Applique les droits à l'interface : les portes fermées ne se montrent pas. */
  function appliquer() {
    const d = _droits || { formation: false, journal: false };
    document.querySelectorAll('[data-droit="formation"]').forEach((el) => {
      el.hidden = !d.formation;
    });
    document.querySelectorAll('[data-droit="journal"]').forEach((el) => {
      el.hidden = !d.journal;
    });
  }

  /**
   * ⛔ `setProperty(..., 'important')` ET PAS `style.display = ...`.
   * `index.html` porte `#mainApp.flex, #coachApp.flex { display: block !important }`.
   * Un style en ligne ordinaire PERD contre `!important` : l'interface resterait
   * affichee alors que l'attribut `style` dirait « none », et ⛔ RIEN NE LE
   * SIGNALERAIT. C'est la meme classe de defaut que `[hidden]` neutralise par une
   * classe d'auteur, rencontree deux fois sur ces deux depots.
   */
  const montrer = (id, oui) => {
    const el = document.getElementById(id);
    if (el) el.style.setProperty('display', oui ? 'flex' : 'none', 'important');
  };

  /** D'ou l'on venait avant d'entrer dans la formation : 'coach' ou 'journal'. */
  let _origine = 'journal';

  /**
   * Fait entrer dans un espace. ⛔ Ne vérifie rien : la vérification a eu lieu
   * avant, et surtout elle a lieu en base. Cette fonction n'est qu'un aiguillage.
   */
  function entrer(espace) {
    const coach = document.getElementById('coachApp');
    // ⚠️ On retient d'ou l'on vient AVANT de masquer : le bouton de retour de la
    // formation ne mene pas au meme endroit pour un coach et pour un eleve.
    _origine = (coach && getComputedStyle(coach).display !== 'none') ? 'coach' : 'journal';
    montrer('choixEspace', false);
    montrer('authScreen', false);
    // ⛔ `#coachApp` AUSSI : la formation vit dans `#mainApp`, et l'interface coach
    // resterait posee par-dessus. Oubli attrape en capturant la formation et en
    // voyant « Performance par Heure (tous eleves) » a la place.
    montrer('coachApp', false);
    montrer('mainApp', true);
    appliquer();
    majRetour();
    if (window.showSection) window.showSection(espace === 'formation' ? 'formation' : 'dashboard');
  }

  /** Le bouton de retour de la formation, selon d'ou l'on vient. */
  function majRetour() {
    const versJournal = document.querySelector('.formation-retour-journal');
    const versCoach = document.querySelector('.formation-retour-coach');
    if (versJournal) versJournal.hidden = _origine === 'coach' || !aJournal();
    if (versCoach) versCoach.hidden = _origine !== 'coach';
  }

  /** Ramene le coach a son espace. ⛔ Ne touche pas aux droits : il n'en a pas. */
  function retourCoach() {
    montrer('mainApp', false);
    montrer('coachApp', true);
  }

  /**
   * Oriente après l'ouverture d'une session.
   *
   * ⚠️ LE COACH N'EST PAS CONCERNÉ. Son interface est `#coachApp`, distincte, et
   * ce lot ne la touche pas : si elle est déjà à l'écran, on ne la déloge pas.
   * ⚠️ Il a en revanche son entrée « Formation » depuis le 10/10/2026, arbitrage de
   * Nadir : il relit les leçons telles qu'un élève les voit. Elle appelle
   * `entrer('formation')` directement, sans passer par ici.
   */
  async function orienter() {
    // ⚠️ STYLE CALCULE, pas attribut : la regle `!important` d'`index.html` peut
    // imposer `block` alors que l'attribut `style` dit « none ». Lire l'attribut,
    // c'est deloger l'interface coach en croyant qu'elle etait deja masquee.
    const coach = document.getElementById('coachApp');
    if (coach && getComputedStyle(coach).display !== 'none') return;

    await charger();
    const d = _droits;
    const aucun = !d.formation && !d.journal;

    // ⛔ Jamais de page blanche : le cas « aucun droit » a son message et une
    // adresse pour écrire. C'est la situation qu'on ne teste jamais et qui arrive.
    const bloc = document.getElementById('choixAucunDroit');
    if (bloc) bloc.hidden = !aucun;

    if (aucun) {
      montrer('authScreen', false);
      montrer('mainApp', false);
      montrer('choixEspace', true);
      appliquer();
      return;
    }

    // ⚠️ Un seul droit : on entre directement. Faire choisir entre une porte et
    // un mur serait une question dont on connaît déjà la réponse.
    if (d.formation !== d.journal) {
      montrer('authScreen', false);
      entrer(d.formation ? 'formation' : 'journal');
      return;
    }

    montrer('authScreen', false);
    montrer('mainApp', false);
    montrer('choixEspace', true);
    appliquer();
  }

  const aJournal = () => !!(_droits && _droits.journal);

  window.Acces = {
    charger,
    appliquer,
    orienter,
    entrer,
    retourCoach,
    majRetour,
    droits: () => _droits,
    aFormation: () => !!(_droits && _droits.formation),
    aJournal: () => !!(_droits && _droits.journal),
    /** Pour la sonde uniquement. ⛔ Ne pas appeler depuis l'interface. */
    _poser: (d) => { _droits = Object.assign({ connu: true, motif: 'sonde' }, d); },
  };
})();
