/* ==========================================================================
   BLOC « SALLE LIVE TRADER 360 » du tableau de bord + retour après connexion
   (maquette v3 validée par Manu le 27/11/2026).
   --------------------------------------------------------------------------
   - État de la salle (EN DIRECT, sujet, depuis, connectés) lu toutes les
     30 s par /api/live/etat, avec le jeton de session du membre.
   - Checklist du jour x/10 : la même que la section Checklist (10 cases).
   - « Entrer › » ouvre la salle dans un nouvel onglet avec le jeton de session
     APRÈS LE # (#at=…). Le # n'est jamais envoyé au serveur ; la salle l'efface
     de l'adresse dès l'arrivée et ne l'envoie que dans un en-tête.
     Le jeton est préparé à l'avance : l'ouverture se fait pendant le clic, sans
     attente, sinon Safari bloque l'onglet.
   - Retour après connexion : SEULEMENT « ?retour=live » (aucune adresse libre).
     L'adresse de la salle vient du serveur du journal (T360_SALLE_URL).
   ⛔ Ne touche pas à l'ancien « Live membres » (assets/formation-live.js).
   ========================================================================== */
(function () {
  'use strict';

  const css = `
  .t360-live-rangee{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:16px;margin-bottom:24px;align-items:stretch}
  .t360-live-rangee.sans-live{grid-template-columns:minmax(0,1fr)}
  .t360-live-bloc{display:flex;align-items:center;gap:18px;padding:14px 18px;border:2px solid #ac862b;border-radius:12px;background:var(--surface,#fff);color:var(--text,#0f172a);min-width:0}
  .t360-live-bloc[hidden]{display:none}
  .t360-live-g{flex:1 1 auto;min-width:0}
  .t360-live-direct{display:flex;align-items:center;gap:6px;color:#ef4444;font-size:12px;font-weight:700;letter-spacing:.04em;margin-bottom:2px}
  .t360-live-direct[hidden]{display:none}
  .t360-live-pastille{width:9px;height:9px;border-radius:50%;background:#ef4444;box-shadow:0 0 0 0 rgba(239,68,68,.6);animation:t360LivePouls 1.6s ease-out infinite}
  @keyframes t360LivePouls{0%{box-shadow:0 0 0 0 rgba(239,68,68,.55)}70%{box-shadow:0 0 0 7px rgba(239,68,68,0)}100%{box-shadow:0 0 0 0 rgba(239,68,68,0)}}
  @media (prefers-reduced-motion:reduce){.t360-live-pastille{animation:none}}
  .t360-live-titre{font-size:18px;font-weight:700;color:#ac862b;line-height:1.25}
  .t360-live-seance{font-size:13px;color:var(--text-muted,#64748b);margin-top:2px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
  .t360-live-m{flex:0 1 230px;min-width:150px;padding-left:18px;border-left:1px solid var(--border,rgba(15,23,42,.08))}
  .t360-live-chk-l{display:flex;justify-content:space-between;align-items:baseline;font-size:13px;color:var(--text,#0f172a)}
  .t360-live-chk-l b{color:#ac862b;font-size:14px}
  .t360-live-barre{height:6px;border-radius:3px;background:var(--surface-3,#f1f3f8);margin:6px 0 6px;overflow:hidden}
  .t360-live-barre i{display:block;height:100%;background:#ac862b;border-radius:3px;transition:width .4s ease}
  .t360-live-faire{font-size:12px;font-weight:600;color:#ac862b;background:none;border:0;padding:6px 0;min-height:28px;cursor:pointer}
  .t360-live-faire:hover{text-decoration:underline}
  .t360-live-entrer{flex:0 0 auto;border:2px solid #ac862b;color:#ac862b;background:transparent;border-radius:10px;padding:9px 18px;font-weight:700;font-size:15px;cursor:pointer;transition:background .15s,color .15s}
  .t360-live-entrer:hover:not(:disabled),.t360-live-entrer:focus-visible{background:#ac862b;color:#fff}
  .t360-live-entrer:disabled{opacity:.5;cursor:default}
  .t360-citation-reduite{padding:12px 16px;border:1px solid var(--border,rgba(15,23,42,.08));box-shadow:none;margin-bottom:0;min-width:0}
  @media (max-width:900px){.t360-live-rangee{grid-template-columns:minmax(0,1fr)}}
  @media (max-width:560px){.t360-live-bloc{flex-wrap:wrap;gap:12px}.t360-live-m{flex:1 1 100%;order:3;border-left:0;padding-left:0}.t360-live-entrer{margin-left:auto}.t360-live-seance{white-space:normal}}
  `;
  const st = document.createElement('style'); st.id = 't360-live-style'; st.textContent = css; document.head.appendChild(st);

  const $ = (id) => document.getElementById(id);
  const etat = { jeton: '', salle: '', direct: false, timer: null, attente: null, lecture: false };
  const sb = () => window.supabaseClient;

  async function rafraichirJeton() {
    try { const { data } = await sb().auth.getSession(); etat.jeton = (data && data.session && data.session.access_token) || ''; } catch { etat.jeton = ''; }
    return etat.jeton;
  }
  async function lireEtat() {
    if (!(await rafraichirJeton())) return null;
    try {
      const r = await fetch('/api/live/etat', { headers: { Authorization: 'Bearer ' + etat.jeton }, cache: 'no-store' });
      if (!r.ok) return null;
      const d = await r.json();
      // L'adresse de la salle doit être une adresse https simple (aucun chemin, aucun paramètre).
      if (d && /^https:\/\/[a-z0-9.-]+$/i.test(String(d.salle_url || ''))) etat.salle = d.salle_url;
      return d;
    } catch { return null; }
  }
  const heure = (ms) => { const d = new Date(ms); return d.getHours() + 'h' + String(d.getMinutes()).padStart(2, '0'); };

  // Droits lus par supabase-acces.js (chargés après la connexion) : null tant qu'ils ne sont pas connus.
  function peutVoir() {
    const u = window.currentUser || {};
    if (u.role === 'coach') return true;
    const d = window.Acces && window.Acces.droits && window.Acces.droits();
    if (!d) return null;
    return !!d.formation;
  }

  function rendreChecklist() {
    const cases = document.querySelectorAll('.checklist-item');
    const total = cases.length || 10;
    let faits = 0;
    try {
      const jour = new Date().toISOString().split('T')[0];
      const v = JSON.parse(localStorage.getItem('checklist_validations') || '{}');
      faits = v[jour] && v[jour].completed ? total : [...cases].filter((c) => c.checked).length;
    } catch { faits = [...cases].filter((c) => c.checked).length; }
    $('t360LiveChkN').textContent = faits + '/' + total;
    $('t360LiveChkBarre').style.width = Math.round((faits / total) * 100) + '%';
  }

  async function rendre() {
    const bloc = $('t360LiveBloc'); if (!bloc) return;
    const voir = peutVoir();
    if (voir === null) {
      bloc.hidden = true; $('t360LiveRangee').classList.add('sans-live');
      // Droits pas encore lus (session restaurée au rechargement) : on les lit nous-mêmes (lecture seule), puis on réessaie.
      if (!etat.lecture && etat.jeton !== null && window.Acces && typeof window.Acces.charger === 'function' && (await rafraichirJeton())) {
        etat.lecture = true; try { await window.Acces.charger(); } catch {} etat.lecture = false;
        if (peutVoir() !== null) return rendre();
      }
      clearTimeout(etat.attente); etat.attente = setTimeout(rendre, 1500); return;
    }
    bloc.hidden = !voir; $('t360LiveRangee').classList.toggle('sans-live', !voir);
    if (!voir) return;
    rendreChecklist();
    const d = await lireEtat();
    $('t360LiveEntrer').disabled = !(etat.jeton && etat.salle);
    etat.direct = !!(d && d.en_direct);
    $('t360LiveDirect').hidden = !etat.direct;
    let t = 'Aucune séance en cours';
    if (d && d.en_direct) {
      const morceaux = [d.sujet ? 'Séance ' + d.sujet : 'Séance en cours'];
      if (d.depuis) morceaux.push('depuis ' + heure(d.depuis));
      morceaux.push(d.connectes + (d.connectes > 1 ? ' connectés' : ' connecté'));
      t = morceaux.join(' · ');
    } else if (d && !d.disponible) t = 'Salle momentanément injoignable';
    $('t360LiveSeance').textContent = t; $('t360LiveSeance').title = t;
  }

  // Ouverture PENDANT le clic (aucune attente) : jeton et adresse sont déjà prêts.
  function entrer() {
    if (!etat.jeton || !etat.salle) return;
    window.open(etat.salle + '/#at=' + encodeURIComponent(etat.jeton), '_blank', 'noopener');
    rafraichirJeton();
  }

  function boucle() {
    clearInterval(etat.timer);
    etat.timer = setInterval(() => { if (!document.hidden && $('dashboard') && !$('dashboard').classList.contains('hidden')) rendre(); }, 30000);
  }

  // Retour après connexion : uniquement ?retour=live. On retire le paramètre AVANT de partir (pas de boucle).
  let retourEnCours = false;
  async function retourLive() {
    const q = new URLSearchParams(location.search);
    if (q.get('retour') !== 'live' || retourEnCours) return;
    if (!(await rafraichirJeton())) return; // pas encore connecté : on attend la connexion
    retourEnCours = true;
    q.delete('retour');
    history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash);
    await lireEtat();
    if (etat.salle && etat.jeton) location.assign(etat.salle + '/#at=' + encodeURIComponent(etat.jeton));
    else retourEnCours = false;
  }

  function demarrer() {
    if (!sb() || !$('t360LiveBloc')) return setTimeout(demarrer, 300);
    $('t360LiveEntrer').addEventListener('click', entrer);
    document.querySelectorAll('.checklist-item').forEach((c) => c.addEventListener('change', rendreChecklist));
    sb().auth.onAuthStateChange((ev, session) => {
      etat.jeton = (session && session.access_token) || '';
      if (session) { retourLive(); setTimeout(rendre, 800); }
    });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) rendre(); });
    retourLive(); rendre(); boucle();
  }
  window.T360SalleLive = { rendre, entrer, _etat: etat };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', demarrer); else demarrer();
})();
