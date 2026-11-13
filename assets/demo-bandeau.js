/**
 * Le bandeau de la démo : il dit que les données sont fictives, et passe d'un
 * profil à l'autre. ⚠️ Discret, en bas à gauche, pour ne pas gêner le tournage ;
 * la croix le masque jusqu'au rechargement, et Maj + D le fait revenir.
 */
(() => {
  'use strict';
  const D = window.__DEMO_JOURNAL__;
  if (!D) return;
  const LIBELLES = { alex: 'Alex · discipliné', sam: 'Sam · surtrading', lea: 'Léa · clôture veille' };
  const bandeau = document.createElement('div');
  bandeau.id = 'demoBandeau';
  bandeau.setAttribute('role', 'note');
  bandeau.style.cssText = 'position:fixed;left:12px;bottom:12px;z-index:2147483000;display:flex;align-items:center;gap:6px;'
    + 'padding:6px 8px 6px 12px;border-radius:999px;background:rgba(5,5,6,.88);border:1px solid rgba(212,175,55,.45);'
    + 'color:#e8e3d6;font:12px/1.2 -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;backdrop-filter:blur(6px);';
  const titre = document.createElement('span');
  titre.textContent = 'Démo · données fictives';
  titre.style.cssText = 'color:#d4af37;font-weight:700;letter-spacing:.04em;margin-right:4px;';
  bandeau.appendChild(titre);
  Object.entries(LIBELLES).forEach(([cle, libelle]) => {
    const a = document.createElement('a');
    a.href = `?profil=${cle}`;
    a.textContent = libelle;
    const actif = cle === D.profil;
    a.style.cssText = `padding:4px 9px;border-radius:999px;text-decoration:none;color:${actif ? '#050506' : '#e8e3d6'};`
      + `background:${actif ? '#d4af37' : 'transparent'};border:1px solid ${actif ? '#d4af37' : 'rgba(255,255,255,.15)'};`;
    if (actif) a.setAttribute('aria-current', 'true');
    bandeau.appendChild(a);
  });
  const fermer = document.createElement('button');
  fermer.type = 'button';
  fermer.textContent = '×';
  fermer.setAttribute('aria-label', 'Masquer le bandeau de démo (Maj + D pour le réafficher)');
  fermer.style.cssText = 'background:none;border:0;color:#9b9586;font-size:16px;cursor:pointer;padding:0 4px;';
  fermer.onclick = () => bandeau.style.setProperty('display', 'none', 'important');
  bandeau.appendChild(fermer);
  document.addEventListener('keydown', (e) => {
    if (e.shiftKey && (e.key === 'D' || e.key === 'd')) bandeau.style.setProperty('display', 'flex', 'important');
  });
  const poser = () => document.body.appendChild(bandeau);
  if (document.body) poser(); else document.addEventListener('DOMContentLoaded', poser);
})();
