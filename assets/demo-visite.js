/**
 * VISITE GUIDÉE AUTOMATIQUE DE LA DÉMO, pour tourner la vidéo de présentation.
 *
 * Lancée par `demo-journal.html?visite=1`. Une souris dessinée se déplace, survole,
 * clique et saisit dans le VRAI journal, chargé avec les données fictives. Nadir
 * enregistre l'écran avec OBS et lit le script `DEMO_JOURNAL_script-video.md`, dont
 * les repères [1], [2]… correspondent aux étapes ci-dessous.
 *
 * ── COMMANDES PENDANT LE TOURNAGE ─────────────────────────────────────────────
 *   Entrée        démarre la visite (l'écran d'attente laisse le temps de lancer OBS)
 *   Espace        pause / reprise
 *   Flèche droite étape suivante tout de suite
 *   Flèche gauche recommence l'étape en cours
 *   H             masque / affiche les incrustations (badge, titres)
 *
 * ── DURÉES ────────────────────────────────────────────────────────────────────
 * Chaque étape a une durée calée sur le texte du script lu à un rythme posé (environ
 * 140 mots par minute). Si Nadir parle plus lentement, Espace met en pause ; s'il a
 * fini avant, la flèche droite passe à la suite. Total visé : environ 20 minutes.
 *
 * ── CHANGEMENT DE PROFIL ──────────────────────────────────────────────────────
 * Passer d'Alex à Sam puis à Léa recharge la page (les données sont fabriquées au
 * chargement). La visite reprend seule à la bonne étape grâce à `&etape=` dans
 * l'adresse. Un écran de transition couvre le rechargement.
 *
 * ⛔ Les incrustations obligatoires pour YouTube sont posées ici : « Démonstration ·
 * données fictives » en permanence, et l'écran final avec le rappel du risque de
 * perte en capital. Elles ne se retirent qu'avec H, volontairement.
 */
(() => {
  'use strict';
  const params = new URLSearchParams(location.search);
  if (!params.has('visite') || !window.__DEMO_JOURNAL__) return;

  const OR = '#d4af37';
  const EASE = 'cubic-bezier(0.16, 1, 0.3, 1)';
  const attendre = (ms) => new Promise((r) => setTimeout(r, ms));

  // ════════════════════════════════════════════════════════════════════════
  // INCRUSTATIONS
  // ════════════════════════════════════════════════════════════════════════
  const style = document.createElement('style');
  style.textContent = `
    #dv-souris { position: fixed; left: 0; top: 0; width: 26px; height: 26px; z-index: 2147483646;
      pointer-events: none; transition: transform 900ms ${EASE}; filter: drop-shadow(0 2px 4px rgba(0,0,0,.6)); }
    #dv-onde { position: fixed; width: 44px; height: 44px; margin: -22px 0 0 -22px; border-radius: 50%;
      border: 2px solid ${OR}; z-index: 2147483645; pointer-events: none; opacity: 0; transform: scale(.3); }
    #dv-onde.go { animation: dvOnde 600ms ${EASE}; }
    @keyframes dvOnde { 0% { opacity: .9; transform: scale(.3); } 100% { opacity: 0; transform: scale(1.4); } }
    #dv-badge { position: fixed; top: 14px; right: 16px; z-index: 2147483644; pointer-events: none;
      padding: 7px 14px; border-radius: 999px; background: rgba(5,5,6,.82); border: 1px solid rgba(212,175,55,.55);
      color: ${OR}; font: 700 13px/1 -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; letter-spacing: .04em; }
    #dv-titre { position: fixed; left: 50%; bottom: 46px; transform: translate(-50%, 20px); z-index: 2147483644;
      pointer-events: none; opacity: 0; transition: opacity 600ms ${EASE}, transform 600ms ${EASE};
      padding: 14px 26px; border-radius: 16px; background: rgba(5,5,6,.9); border: 1px solid rgba(212,175,55,.55);
      text-align: center; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #dv-titre.on { opacity: 1; transform: translate(-50%, 0); }
    #dv-titre small { display: block; color: ${OR}; font-size: 12px; font-weight: 700; letter-spacing: .2em; text-transform: uppercase; }
    #dv-titre span { display: block; color: #f4f1ea; font-size: 26px; font-weight: 700; margin-top: 6px; }
    #dv-ecran { position: fixed; inset: 0; z-index: 2147483647; display: grid; place-items: center; text-align: center;
      background: #050506; color: #e8e3d6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
    #dv-ecran h1 { color: ${OR}; font-size: 44px; margin: 0 0 14px; }
    #dv-ecran p { margin: 8px 0; color: #b9b4a8; font-size: 18px; }
    #dv-ecran .petit { font-size: 14px; color: #7e7a70; }
    #dv-pause { position: fixed; left: 16px; top: 14px; z-index: 2147483644; display: none; padding: 6px 12px;
      border-radius: 8px; background: rgba(5,5,6,.85); color: #e8e3d6; font: 600 12px -apple-system, sans-serif; }
    .dv-masque #dv-badge, .dv-masque #dv-titre { display: none !important; }
    #demoBandeau { display: none !important; }
  `;
  document.head.appendChild(style);

  const souris = document.createElement('div');
  souris.id = 'dv-souris';
  souris.innerHTML = '<svg viewBox="0 0 24 24" width="26" height="26"><path d="M3 2 L3 20 L8 15 L11.5 22 L14.5 20.6 L11 13.6 L18 13.6 Z" fill="#fff" stroke="#000" stroke-width="1.4" stroke-linejoin="round"/></svg>';
  const onde = document.createElement('div'); onde.id = 'dv-onde';
  const badge = document.createElement('div'); badge.id = 'dv-badge'; badge.textContent = 'Démonstration · données fictives';
  const titre = document.createElement('div'); titre.id = 'dv-titre';
  const pause = document.createElement('div'); pause.id = 'dv-pause'; pause.textContent = 'Pause · Espace pour reprendre';
  [souris, onde, badge, titre, pause].forEach((e) => document.body.appendChild(e));

  let sx = innerWidth / 2, sy = innerHeight / 2;
  souris.style.transform = `translate(${sx}px, ${sy}px)`;

  // ════════════════════════════════════════════════════════════════════════
  // PRIMITIVES
  // ════════════════════════════════════════════════════════════════════════
  let enPause = false, sauter = false, recommencer = false;

  async function temps(ms) {
    // Une attente qui respecte la pause et les flèches.
    const pas = 100;
    for (let t = 0; t < ms;) {
      if (sauter || recommencer) return;
      if (!enPause) t += pas;
      await attendre(pas);
    }
  }

  function trouver(cible) {
    if (!cible) return null;
    if (typeof cible === 'function') return cible();
    if (cible.texte) {
      const tous = [...document.querySelectorAll(cible.dans || 'button, a, h2, h3, h4, div, span, td, label')];
      return tous.filter((e) => e.offsetParent !== null && e.textContent.trim().replace(/\s+/g, ' ').includes(cible.texte))
        .sort((a, b) => a.textContent.length - b.textContent.length)[0] || null;
    }
    const e = document.querySelector(cible);
    return e && e.offsetParent !== null ? e : document.querySelector(cible);
  }

  async function aller(cible, ms = 900) {
    const e = trouver(cible);
    if (!e) { console.warn('[VISITE] cible introuvable', cible); return null; }
    const r0 = e.getBoundingClientRect();
    if (r0.top < 70 || r0.bottom > innerHeight - 70) {
      e.scrollIntoView({ behavior: 'smooth', block: 'center' });
      await attendre(700);
    }
    const r = e.getBoundingClientRect();
    sx = r.left + Math.min(r.width / 2, 60); sy = r.top + Math.min(r.height / 2, 22);
    souris.style.transitionDuration = ms + 'ms';
    souris.style.transform = `translate(${sx}px, ${sy}px)`;
    await attendre(ms + 80);
    return e;
  }

  async function survoler(cible, ms = 2200) {
    const e = await aller(cible);
    if (!e) return;
    ['pointerover', 'mouseover', 'mouseenter'].forEach((t) => e.dispatchEvent(new MouseEvent(t, { bubbles: t !== 'mouseenter' })));
    e.classList.add('dv-survol');
    await temps(ms);
    ['pointerout', 'mouseout', 'mouseleave'].forEach((t) => e.dispatchEvent(new MouseEvent(t, { bubbles: t !== 'mouseleave' })));
  }

  async function clic(cible) {
    const e = await aller(cible);
    if (!e) return null;
    onde.style.left = sx + 'px'; onde.style.top = sy + 'px';
    onde.classList.remove('go'); void onde.offsetWidth; onde.classList.add('go');
    await attendre(180);
    e.click();
    await attendre(450);
    return e;
  }

  async function taper(cible, texte, parCar = 75) {
    const e = await clic(cible);
    if (!e) return;
    e.focus();
    e.value = '';
    for (const c of String(texte)) {
      e.value += c;
      e.dispatchEvent(new Event('input', { bubbles: true }));
      await attendre(parCar);
    }
    e.dispatchEvent(new Event('change', { bubbles: true }));
  }

  async function valeur(cible, v) {
    const e = await clic(cible);
    if (!e) return;
    e.value = v;
    e.dispatchEvent(new Event('input', { bubbles: true }));
    e.dispatchEvent(new Event('change', { bubbles: true }));
    await attendre(300);
  }

  async function cocher(cible) {
    const e = await aller(cible, 600);
    if (!e) return;
    onde.style.left = sx + 'px'; onde.style.top = sy + 'px';
    onde.classList.remove('go'); void onde.offsetWidth; onde.classList.add('go');
    if (!e.checked) e.click();
    await attendre(350);
  }

  async function section(nom) {
    await clic(`#mainApp [onclick="showSection('${nom}')"]`);
    await attendre(900);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const main = document.querySelector('#mainApp main, #mainApp .main-content');
    if (main) main.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function defiler(px) {
    const zones = [document.scrollingElement, ...document.querySelectorAll('#mainApp main, #mainApp .main-content, #mainApp [class*="overflow-y-auto"]')];
    const z = zones.find((x) => x && x.scrollHeight > x.clientHeight + 40) || document.scrollingElement;
    z.scrollBy({ top: px, behavior: 'smooth' });
    await attendre(900);
  }

  function annoncer(chap, texte) {
    titre.innerHTML = `<small>${chap}</small><span>${texte}</span>`;
    titre.classList.add('on');
    setTimeout(() => titre.classList.remove('on'), 4200);
  }

  function fermerModales() {
    document.querySelectorAll('.modal').forEach((m) => { if (getComputedStyle(m).display !== 'none') m.style.display = 'none'; });
  }

  function changerProfil(profil, etape) {
    const u = new URL(location.href);
    u.searchParams.set('profil', profil);
    u.searchParams.set('visite', '1');
    u.searchParams.set('etape', String(etape));
    u.searchParams.set('auto', '1');
    const ecran = document.createElement('div');
    ecran.id = 'dv-ecran';
    ecran.innerHTML = '<div><p class="petit">Changement de profil</p></div>';
    document.body.appendChild(ecran);
    setTimeout(() => { location.href = u.toString(); }, 400);
    return new Promise(() => {}); // la page part
  }

  // Le fichier d'import de la démo, construit ici : un vrai sélecteur de fichier ne
  // peut pas s'ouvrir dans une visite automatique.
  function deposerCsv() {
    const contenu = 'symbol,_priceFormat,_priceFormatType,_tickSize,buyFillId,sellFillId,qty,buyPrice,sellPrice,pnl,boughtTimestamp,soldTimestamp,duration\n'
      + 'MESZ6,-2,0,0.25,900001,900002,2,7318.25,7327.50,$92.50,11/06/2026 15:34:12,11/06/2026 15:51:40,17min 28sec\n'
      + 'MESZ6,-2,0,0.25,900004,900003,2,7323.75,7329.00,$52.50,11/06/2026 16:12:05,11/06/2026 16:02:31,9min 34sec\n'
      + 'MESZ6,-2,0,0.25,900005,900006,2,7331.50,7327.00,$(45.00),11/06/2026 16:40:22,11/06/2026 16:47:10,6min 48sec\n';
    const input = document.getElementById('csvFileInput');
    if (!input) return;
    const dt = new DataTransfer();
    dt.items.add(new File([contenu], 'export-tradovate.csv', { type: 'text/csv' }));
    input.files = dt.files;
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }

  const hier = (() => { const d = new Date(); d.setDate(d.getDate() - 1); while ([0, 6].includes(d.getDay())) d.setDate(d.getDate() - 1); return d.toISOString().slice(0, 10); })();

  // ════════════════════════════════════════════════════════════════════════
  // LES ÉTAPES · les numéros sont ceux du script
  // ════════════════════════════════════════════════════════════════════════
  const ETAPES = [
    { n: 1, profil: 'alex', duree: 46800, faire: async () => { await section('dashboard'); annoncer('Trader 360', 'Le journal de trading'); await aller({ texte: 'Net P&L' }); } },
    { n: 2, profil: 'alex', duree: 64560, faire: async () => { await aller('#warningsBanner, #calendarGrid'); await defiler(250); await defiler(-250); } },
    { n: 3, profil: 'alex', duree: 49199, faire: async () => { await aller('#mainApp nav'); await temps(6000); await survoler('#mainApp .formation-acces', 6000); } },
    { n: 4, profil: 'alex', duree: 21840, faire: async () => { annoncer('1', 'Le tableau de bord'); await survoler({ texte: 'Net P&L' }, 6000); } },
    { n: 5, profil: 'alex', duree: 56400, faire: async () => { await survoler({ texte: 'Trade win %' }, 7000); await survoler({ texte: 'Day win %' }, 6000); } },
    { n: 6, profil: 'alex', duree: 35760, faire: async () => { await survoler({ texte: 'Profit factor' }, 5000); await survoler({ texte: 'Avg win/loss trade' }, 5000); await survoler({ texte: 'RR1/RR2 atteint' }, 5000); } },
    { n: 7, profil: 'alex', duree: 23279, faire: async () => { await survoler({ texte: 'Trades Méthode' }, 5000); await survoler({ texte: 'Trades Hors Méthode' }, 5000); } },
    { n: 8, profil: 'alex', duree: 44880, faire: async () => { await aller('#calendarGrid'); await survoler(() => [...document.querySelectorAll('#calendarGrid > div')].find((d) => /\$/.test(d.textContent)), 5000); await clic('button[onclick="previousMonth()"]'); await temps(3000); await clic('button[onclick="nextMonth()"]'); } },
    { n: 9, profil: 'alex', duree: 20880, faire: async () => { await clic('#accountsList input[type="checkbox"]'); await temps(4000); await clic('#accountsList input[type="checkbox"]'); } },
    { n: 10, profil: 'alex', duree: 41040, faire: async () => { await defiler(500); await survoler('#traderScoreChart', 9000); await defiler(-500); } },
    { n: 11, profil: 'alex', duree: 18000, faire: async () => { await survoler({ texte: 'Partager mes performances' }, 6000); } },
    { n: 12, profil: 'alex', duree: 14639, faire: async () => { annoncer('2', 'Enregistrer un trade'); await section('tradelog'); await clic('button[onclick="showAddTradeModal()"]'); } },
    { n: 13, profil: 'alex', duree: 29520, faire: async () => {
      await clic('#tradeAccountDropdown'); await cocher('.trade-account-checkbox[value="36002"]'); await clic('#tradeAccountDropdown');
      await valeur('#tradeDate', hier); await valeur('#entryTime', '15:36'); await valeur('#exitTime', '16:05');
      await valeur('#symbol', 'ES'); await valeur('#tradeType', 'Long (RR1 atteint)');
      await taper('#entryPrice', '7312.25'); await taper('#exitPrice', '7318.50'); await taper('#quantity', '1');
    } },
    { n: 14, profil: 'alex', duree: 49199, faire: async () => {
      await valeur('#setup', 'Pullback');
      await cocher('#protectionVWAP'); await cocher('#protectionLiquidite');
      await cocher('#tradeTendance'); await cocher('#tradeMethode');
      await taper('#tradeNotes', 'Rejet de la VWAP avec la liquidité 30 min derrière. Sortie au RR1.', 35);
    } },
    { n: 15, profil: 'alex', duree: 14639, faire: async () => { await clic('#addTradeBtn'); await temps(2500); fermerModales(); await section('dashboard'); } },
    { n: 16, profil: 'alex', duree: 18960, faire: async () => { annoncer('3', 'Importer ses trades'); await section('tradelog'); await clic('button[onclick="showImportCSVModal()"]'); } },
    { n: 17, profil: 'alex', duree: 20400, faire: async () => {
      await clic('#csvAccountDropdown'); await cocher('.csv-account-checkbox[value="36002"]'); await clic('#csvAccountDropdown');
      await aller({ texte: 'Cliquez pour sélectionner' }); deposerCsv(); await temps(3000); await aller('#csvPreviewTable');
    } },
    { n: 18, profil: 'alex', duree: 31439, faire: async () => { await clic('#csvImportBtn'); await temps(3000); fermerModales(); await aller('#tradesTableBody, #mainApp table'); } },
    { n: 19, profil: 'sam', duree: 45840, faire: async () => { await section('dashboard'); annoncer('4', 'Les points à surveiller'); await aller('#warningsBanner'); } },
    { n: 20, profil: 'sam', duree: 37680, faire: async () => { await survoler({ texte: 'revenge', dans: '#warningsContainer div' }, 9000); } },
    { n: 21, profil: 'sam', duree: 21360, faire: async () => { await survoler({ texte: 'journée(s) avec', dans: '#warningsContainer div' }, 9000); } },
    { n: 22, profil: 'sam', duree: 19920, faire: async () => { await survoler({ texte: 'Streak', dans: '#warningsContainer div' }, 6000); await survoler({ texte: 'hors méthode', dans: '#warningsContainer div' }, 6000); } },
    { n: 23, profil: 'sam', duree: 18479, faire: async () => { await survoler({ texte: 'sans protection', dans: '#warningsContainer div' }, 8000); } },
    { n: 24, profil: 'sam', duree: 28080, faire: async () => { await clic('button[onclick="previousMonth()"]'); await aller('#calendarGrid'); await temps(4000); await survoler(() => [...document.querySelectorAll('#calendarGrid > div')].filter((d) => /-\d/.test(d.textContent)).sort((a, b) => b.textContent.length - a.textContent.length)[0], 6000); await clic('button[onclick="nextMonth()"]'); } },
    { n: 25, profil: 'sam', duree: 15120, faire: async () => { annoncer('5', 'Le journal quotidien'); await section('dailyjournal'); await aller('.btn-view-journal'); } },
    { n: 26, profil: 'sam', duree: 39120, faire: async () => {
      const tilt = [...document.querySelectorAll('.btn-view-journal')].find((b) => /au-delà du R/.test(b.closest('[class*="border"]')?.textContent || ''))
        || document.querySelector('.btn-view-journal');
      await clic(() => tilt); await temps(9000); await defiler(300); await temps(6000); fermerModales();
    } },
    { n: 27, profil: 'sam', duree: 26160, faire: async () => { await clic('button[onclick="showAddNoteModal()"]'); await temps(4000); await aller('#emotionBefore'); await temps(3000); await aller('.error-checkbox'); await temps(3000); fermerModales(); } },
    { n: 28, profil: 'lea', duree: 48720, faire: async () => { await section('dashboard'); annoncer('6', 'Une protection qui ne protège plus'); await survoler({ texte: 'Clôture veille', dans: '#warningsContainer div' }, 12000); } },
    { n: 29, profil: 'lea', duree: 22320, faire: async () => { await survoler({ texte: 'atteints mais', dans: '#warningsContainer div' }, 10000); } },
    { n: 30, profil: 'lea', duree: 18000, faire: async () => {
      await section('dailyjournal');
      const cv = [...document.querySelectorAll('.btn-view-journal')].find((b) => (b.closest('[class*="border"]')?.querySelector('img')));
      await clic(() => cv || document.querySelector('.btn-view-journal')); await temps(8000); fermerModales();
    } },
    { n: 31, profil: 'lea', duree: 16079, faire: async () => { annoncer('7', 'Avant la séance'); await section('checklist'); await cocher('.checklist-item[data-item="coherence"]'); await cocher('.checklist-item[data-item="regles"]'); await cocher('.checklist-item[data-item="news"]'); } },
    { n: 32, profil: 'lea', duree: 17520, faire: async () => { await section('motivation'); await aller('#motivation'); } },
    { n: 33, profil: 'lea', duree: 39120, faire: async () => { annoncer('8', 'La comptabilité'); await section('accounting'); await survoler({ texte: 'Total Investi' }, 4000); await survoler({ texte: 'Total Payouts' }, 4000); await defiler(420); await temps(5000); await defiler(-420); } },
    { n: 34, profil: 'lea', duree: 24240, faire: async () => {
      annoncer('9', 'Les replays'); await section('replays'); await temps(1500);
      const jour = [...document.querySelectorAll('[data-replay-date]')].filter((d) => /replay/.test(d.textContent)).pop();
      await clic(() => jour); await temps(1500); await clic({ texte: 'Regarder', dans: 'button' }); await temps(12000); fermerModales();
    } },
    { n: 35, profil: 'lea', duree: 31919, faire: async () => { annoncer('10', 'L\'analyse par intelligence artificielle'); await survoler('#mainApp [onclick="exportAllDataToPDF()"]', 7000); await aller('#exportPeriodSelect'); } },
    { n: 36, profil: 'lea', duree: 35280, faire: async () => { await survoler({ texte: 'Analyse IA', dans: '#mainApp .sidebar-item' }, 9000); } },
    { n: 37, profil: 'lea', duree: 23279, faire: async () => { await section('dashboard'); await aller('#warningsBanner'); } },
    { n: 38, profil: 'lea', duree: 25200, faire: async () => { annoncer('11', 'Régler son espace'); await clic('#mainApp [onclick*="personnaliserDashboard"]'); await temps(9000); await clic({ texte: 'Annuler', dans: 'button' }); } },
    { n: 39, profil: 'lea', duree: 26639, faire: async () => { await clic('#themeToggle'); await temps(5000); await clic('#themeToggle'); await clic('#mainApp [onclick="zoomIn()"]'); await clic('#mainApp [onclick="zoomIn()"]'); await temps(3000); await clic('#mainApp [onclick="zoomReset()"]'); } },
    { n: 40, profil: 'lea', duree: 31919, faire: async () => { await clic('#vacationToggle'); await temps(7000); await clic('#vacationToggle'); } },
    { n: 41, profil: 'alex', duree: 43440, faire: async () => { await section('dashboard'); annoncer('12', 'Au quotidien'); await aller('#warningsBanner, #calendarGrid'); await temps(8000); await aller('#calendarGrid'); } },
    { n: 42, profil: 'alex', duree: 42000, faire: async () => { annoncer('Trader 360', 'Le journal de trading'); await aller({ texte: 'Net P&L' }); } },
    { n: 43, profil: 'alex', duree: 17520, fin: true, faire: async () => { ecranFinal(); } },
  ];

  function ecranFinal() {
    const e = document.createElement('div');
    e.id = 'dv-ecran';
    e.innerHTML = `<div><h1>Trader 360</h1>
      <p>Le journal est inclus dans l'accompagnement.</p>
      <p>Pour candidater : <strong style="color:${OR}">trader360.fr</strong></p>
      <p class="petit" style="margin-top:28px">Démonstration réalisée avec des données fictives.<br>
      Le trading comporte un risque de perte en capital. Ce contenu ne constitue pas un conseil en investissement.</p></div>`;
    document.body.appendChild(e);
  }

  // ════════════════════════════════════════════════════════════════════════
  // DÉROULÉ
  // ════════════════════════════════════════════════════════════════════════
  document.addEventListener('keydown', (ev) => {
    if (ev.code === 'Space') { ev.preventDefault(); enPause = !enPause; pause.style.display = enPause ? 'block' : 'none'; }
    if (ev.code === 'ArrowRight') { ev.preventDefault(); sauter = true; }
    if (ev.code === 'ArrowLeft') { ev.preventDefault(); recommencer = true; }
    if (ev.key === 'h' || ev.key === 'H') document.documentElement.classList.toggle('dv-masque');
  }, true);

  async function derouler(depuis) {
    for (let i = depuis; i < ETAPES.length; i++) {
      const e = ETAPES[i];
      if (e.profil !== window.__DEMO_JOURNAL__.profil) { await changerProfil(e.profil, i); return; }
      sauter = false; recommencer = false;
      console.log(`[VISITE] étape [${e.n}]`);
      const debut = Date.now();
      try { await e.faire(); } catch (err) { console.warn('[VISITE] étape', e.n, err); }
      if (e.fin) return;
      await temps(Math.max(0, e.duree - (Date.now() - debut)));
      if (recommencer) { recommencer = false; i -= 1; continue; }
      while (enPause) await attendre(150);
    }
  }

  async function attendreJournal() {
    for (let k = 0; k < 120; k++) {
      const m = document.getElementById('mainApp');
      if (m && getComputedStyle(m).display !== 'none' && (window.trades || []).length) return;
      await attendre(250);
    }
  }

  async function demarrer() {
    await attendreJournal();
    await attendre(1200);
    const etape = Math.max(0, parseInt(params.get('etape') || '0', 10) || 0);
    if (params.get('auto') === '1') { derouler(etape); return; }
    const accueil = document.createElement('div');
    accueil.id = 'dv-ecran';
    accueil.innerHTML = `<div><h1>Visite du journal</h1><p>Lance l'enregistrement OBS, puis appuie sur <strong>Entrée</strong>.</p>
      <p class="petit">Espace : pause · Flèche droite : étape suivante · Flèche gauche : recommencer l'étape · H : masquer les incrustations</p></div>`;
    document.body.appendChild(accueil);
    const go = (ev) => { if (ev.key !== 'Enter') return; document.removeEventListener('keydown', go, true); accueil.remove(); derouler(etape); };
    document.addEventListener('keydown', go, true);
  }
  demarrer();
})();
