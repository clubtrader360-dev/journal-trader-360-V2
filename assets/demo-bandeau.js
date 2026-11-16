/**
 * Le choix du profil de la démo, DANS LE MENU DE GAUCHE (Nadir, 16/11/2026, pour le
 * tournage) : un bloc « Démo · données fictives » juste au-dessus de « Tableau de bord »,
 * avec les trois profils comme des entrées du menu. Le profil affiché est surligné.
 *
 * ⚠️ Le bloc porte l'id `demoBandeau` : la visite automatique (demo-visite.js) le masque
 *    déjà par cet id, rien à changer de son côté.
 * ⚠️ Si le menu n'est pas trouvé (structure du journal modifiée), on retombe sur l'ancien
 *    bandeau flottant en bas à gauche : le choix du profil ne disparaît jamais en silence.
 */
(() => {
  'use strict';
  const D = window.__DEMO_JOURNAL__;
  if (!D) return;
  const PROFILS = [
    ['alex', 'Alex', 'discipliné', 'fa-user-check'],
    ['sam', 'Sam', 'surtrading', 'fa-fire'],
    ['lea', 'Léa', 'clôture veille', 'fa-shield-alt'],
  ];
  const lienProfil = (cle) => {
    const p = new URLSearchParams(location.search);
    p.set('profil', cle);
    p.delete('etape'); p.delete('auto');
    return `${location.pathname}?${p.toString()}`;
  };

  function blocMenu() {
    const bloc = document.createElement('div');
    bloc.id = 'demoBandeau';
    bloc.setAttribute('role', 'navigation');
    bloc.setAttribute('aria-label', 'Profil de démonstration');
    bloc.style.cssText = 'margin:0 0 14px;padding:10px 0 12px;border-top:1px solid rgba(212,175,55,.35);border-bottom:1px solid rgba(212,175,55,.35);';
    const titre = document.createElement('div');
    titre.textContent = 'Démo · données fictives';
    titre.style.cssText = 'padding:0 16px 8px;color:#d4af37;font-size:11px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;';
    bloc.appendChild(titre);
    PROFILS.forEach(([cle, nom, trait, icone]) => {
      const a = document.createElement('a');
      a.href = lienProfil(cle);
      a.className = 'sidebar-item' + (cle === D.profil ? ' active' : '');
      a.style.cssText = 'display:flex;align-items:center;text-decoration:none;';
      if (cle === D.profil) a.setAttribute('aria-current', 'true');
      a.innerHTML = `<i class="fas ${icone} mr-3"></i><span>${nom}</span><span style="margin-left:6px;opacity:.65;font-size:.85em">· ${trait}</span>`;
      bloc.appendChild(a);
    });
    return bloc;
  }

  function bandeauFlottant() {
    const bandeau = document.createElement('div');
    bandeau.id = 'demoBandeau';
    bandeau.setAttribute('role', 'note');
    bandeau.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483000;display:flex;align-items:center;gap:6px;'
      + 'padding:6px 8px 6px 12px;border-radius:999px;background:rgba(5,5,6,.88);border:1px solid rgba(212,175,55,.45);'
      + 'color:#e8e3d6;font:12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;backdrop-filter:blur(6px);';
    const t = document.createElement('span');
    t.textContent = 'Démo · données fictives';
    t.style.cssText = 'color:#d4af37;font-weight:700;letter-spacing:.04em;margin-right:4px;';
    bandeau.appendChild(t);
    PROFILS.forEach(([cle, nom, trait]) => {
      const a = document.createElement('a');
      a.href = lienProfil(cle);
      a.textContent = `${nom} · ${trait}`;
      const actif = cle === D.profil;
      a.style.cssText = `padding:4px 9px;border-radius:999px;text-decoration:none;color:${actif ? '#050506' : '#e8e3d6'};`
        + `background:${actif ? '#d4af37' : 'transparent'};border:1px solid ${actif ? '#d4af37' : 'rgba(255,255,255,.15)'};`;
      bandeau.appendChild(a);
    });
    document.body.appendChild(bandeau);
  }

  let essais = 0;
  function poser() {
    if (document.getElementById('demoBandeau')) return;
    const premier = document.querySelector('.sidebar-item[data-section="dashboard"]');
    if (premier && premier.parentElement) {
      premier.parentElement.insertBefore(blocMenu(), premier);
      return;
    }
    if (essais++ < 40) { setTimeout(poser, 250); return; }
    console.warn('[DÉMO] menu de gauche introuvable : bandeau flottant à la place');
    if (document.body) bandeauFlottant();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', poser); else poser();
})();
