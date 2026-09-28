/**
 * Où va l'archive des briefs. UN SEUL ENDROIT.
 *
 * ── POURQUOI CE FICHIER EXISTE ───────────────────────────────────────────────
 * Trois codes ont besoin de cette réponse : l'étape d'archivage de
 * `daily-brief.yml`, qui écrit ; `verifier-couverture-archive.mjs`, qui relit pour
 * vérifier que l'écriture a eu lieu ; et quiconque rejouera l'un ou l'autre à la
 * main.
 *
 * ⚠️ S'ILS RÉPONDENT DIFFÉREMMENT, LA PANNE EST INVISIBLE ET ELLE EST VERTE.
 * Le cas s'est présenté, et il a été pris de justesse. L'étape d'archivage faisait
 * `git clone` SANS `--branch` : git prend alors la branche par défaut du dépôt,
 * `main`. Le contrôleur, lui, interrogeait l'API de contenus sans `ref`, donc
 * `main` aussi. Les deux étaient d'accord — et tous les deux se trompaient : la
 * page qui rend un brief archivé vit sur `chantier/ossature-site`. Le brief aurait
 * été déposé là où rien ne le rend, le contrôleur l'aurait trouvé, et la
 * notification aurait annoncé « archive à jour » pendant que la page n'existait
 * pas. Un accord entre deux lecteurs ne vaut pas une vérité.
 *
 * ── CE QU'IL FAUT CHANGER, ET QUAND ──────────────────────────────────────────
 * Le jour où `chantier/ossature-site` rejoint `main`, cette ligne devient `main`.
 * C'est le seul endroit à toucher, et le contrôleur du lendemain matin dira tout
 * de suite si on a oublié : il cherchera les briefs sur la branche nommée ici.
 */
export const CIBLE = {
  depot: 'clubtrader360-dev/trader360-site',

  // La branche où vit la structure d'accueil de l'archive : la collection
  // `src/contenu/briefs`, le gabarit de page, et les fichiers du courriel sous
  // `public/courriel/`. Tant que la refonte du site n'est pas fusionnée, c'est
  // cette branche de chantier, et pas la branche par défaut.
  branche: 'chantier/ossature-site',

  // Chemins, relatifs à la racine du dépôt du site.
  dossierBriefs: 'src/contenu/briefs',
  dossierRessources: 'public/courriel',
};

// Appelable depuis un script shell :
//   node -e "import('./outils/cible-archive.mjs').then(m=>process.stdout.write(m.CIBLE.branche))"
export default CIBLE;
