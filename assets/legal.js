/**
 * LE RETOUR DES PAGES LEGALES.
 *
 * Demande de Nadir du 14/10 : « quand on est dans les CGV, il faudrait un bouton
 * retour qui ramène à la page précédente ». Les quatre pages (mentions legales,
 * CGV, CGU, confidentialite) partagent ce fichier.
 *
 * ⚠️ « Retour » revient D OU L ON VIENT quand on vient de chez nous : l ecran de
 * connexion, l espace membre, le journal, ou une autre page legale. Un eleve
 * arrive sur les CGV depuis le pied de page de l espace membre et doit y
 * retrouver l espace membre, pas l ecran de connexion.
 * ⛔ Sinon (lien colle dans un mail, onglet ouvert a part, premiere page de
 * l onglet) le lien ordinaire fait son travail : vers `/`, qui remet dans
 * l espace ou l on etait si une session existe.
 * ⚠️ Le referrer n est lu que pour son origine : jamais envoye, jamais ecrit.
 */
(function () {
  'use strict';
  function vientDeChezNous() {
    try {
      return !!document.referrer && new URL(document.referrer).origin === location.origin;
    } catch { return false; }
  }
  function brancher() {
    document.querySelectorAll('.legal-back').forEach((a) => {
      a.addEventListener('click', (e) => {
        if (vientDeChezNous() && history.length > 1) {
          e.preventDefault();
          history.back();
        }
      });
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', brancher);
  else brancher();
})();
