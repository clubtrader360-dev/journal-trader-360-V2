/**
 * LE GRAPHIQUE DE FOND DE L ECRAN DE CONNEXION.
 *
 * Demande de Nadir du 14/10 : « en arrière-plan, un graphique ». Des
 * chandeliers dessines UNE fois au canvas, au meme trace que l emplacement
 * video de l espace membre (`dessinerChart` dans supabase-formation.js), pour
 * que la connexion et l espace membre se ressemblent.
 *
 * ⚠️ CE N EST PAS UNE BOUCLE : un seul passage, redessine seulement quand la
 * fenetre change de taille. ⛔ Une animation qui tournerait derriere un
 * ecran de connexion ouvert toute la journee viderait une batterie pour rien.
 * ⚠️ La graine est fixe : le meme graphique a chaque chargement, c est un
 * decor, pas une donnee. Et il ne monte ni ne descend franchement : un
 * graphique qui s effondre sur l ecran d accueil raconterait une histoire
 * qu on n a pas voulu raconter.
 */
(function () {
  'use strict';
  const GRAINE = 7;

  function dessiner() {
    const cv = document.getElementById('cxChart');
    if (!cv) return;
    const ecran = cv.parentElement;
    if (!ecran || getComputedStyle(ecran).display === 'none') return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = w * dpr;
    cv.height = h * dpr;
    const g = cv.getContext('2d');
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    let s = GRAINE;
    const rnd = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    const n = Math.max(24, Math.floor(w / 26));
    const pas = w / n;
    let p = h * 0.58;
    for (let i = 0; i < n; i += 1) {
      const o = p;
      // ⚠️ Un bruit centre, sans derive : le graphique respire, il ne tend pas.
      const cl = o + (rnd() - 0.5) * h * 0.07;
      const haut = Math.min(o, cl) - rnd() * h * 0.025;
      const bas = Math.max(o, cl) + rnd() * h * 0.025;
      const x = i * pas + pas / 2;
      g.globalAlpha = 0.16;
      g.strokeStyle = cl < o ? '#e8b84b' : '#7e7e77';
      g.fillStyle = g.strokeStyle;
      g.lineWidth = 1;
      g.beginPath();
      g.moveTo(x, haut);
      g.lineTo(x, bas);
      g.stroke();
      g.fillRect(i * pas + pas * 0.26, Math.min(o, cl), pas * 0.48, Math.max(1, Math.abs(cl - o)));
      p = Math.max(h * 0.3, Math.min(h * 0.8, cl));
    }
    g.globalAlpha = 1;
  }

  let minuteur = null;
  window.addEventListener('resize', () => { clearTimeout(minuteur); minuteur = setTimeout(dessiner, 120); });

  /**
   * ⚠️ L ecran de connexion est affiche par supabase-auth.js APRES le
   * chargement, une fois la session verifiee : on dessine quand il devient
   * visible, pas seulement au depart.
   * ⛔ CE FICHIER EST CHARGE DANS `<head>` : au moment ou il s execute,
   * `#authScreen` n existe pas encore. La premiere version posait l observateur
   * ici, sur `null`, sans erreur, et ne redessinait donc jamais : le canevas
   * restait vide des que l ecran arrivait apres le premier trace. C est le motif
   * « module ecrit, jamais cable » du depot. L observateur se pose quand le
   * document est la.
   */
  function brancher() {
    const racine = document.getElementById('authScreen');
    if (racine && window.MutationObserver) {
      new MutationObserver(dessiner).observe(racine, { attributes: true, attributeFilter: ['style', 'class'] });
    }
    dessiner();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', brancher);
  else brancher();
})();
