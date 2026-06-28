/* Dashboard COACH personnalisable (#33 commit 3) — "Bourse à l'Aube"
   Port du système élève (assets/dashboard-customizer.js, #27) vers le mode coach.
   Cible #coachDashboard. Réorganise uniquement le DOM (move de blocs), ne touche pas
   loadCoachDashboard / Chart.js / les agrégats. Persistance Supabase :
   user_preferences.coach_dashboard_layout (colonne séparée de l'élève).
   Entrée : bouton "Personnaliser mon dashboard" dans la sidebar coach (#coachUserInfo).
   Périmètre : 5 KPI globaux (reorder horizontal + show/hide) + grands blocs (reorder vertical
   + show/hide). Le bloc "Points à surveiller" garde sa visibilité pilotée par le JS (alertes). */
(function () {
  'use strict';

  // ---------- Helpers ----------
  function SUPA() { return window.supabaseClient || window.supabase || null; }
  function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function motionOk() { return !reducedMotion() && document.body.dataset.animations !== 'off'; }
  function toast(msg) { if (typeof window.showNotification === 'function') window.showNotification(msg, 'success'); }
  function DASH() { return document.getElementById('coachDashboard'); }
  function blockEl(id) { return document.querySelector('#coachDashboard [data-block-id="' + id + '"]'); }
  // Remonte jusqu'à l'enfant direct de #coachDashboard.
  function rowOf(node) {
    var dash = DASH(); if (!node || !dash) return null;
    var n = node; while (n && n.parentElement && n.parentElement !== dash) n = n.parentElement;
    return (n && n.parentElement === dash) ? n : null;
  }

  // 5 KPI globaux (catalogue, masquables + reorder horizontal)
  var KPI_IDS = ['c-pnl', 'c-active', 'c-winrate', 'c-pf', 'c-trades'];
  // Grands blocs masquables (hors kpi-banner conteneur, hors points-watch piloté par le JS)
  var ROW_HIDEABLE = ['cal', 'hourly', 't360-reg', 'engagement', 'dur-pnl', 'disc-prot'];
  var LABELS = {
    'c-pnl': 'P&L global', 'c-active': 'Élèves actifs', 'c-winrate': 'Win Rate moyen',
    'c-pf': 'Profit Factor', 'c-trades': 'Total Trades',
    'cal': 'Calendrier global', 'hourly': 'Performance par heure',
    't360-reg': 'Trader 360 Score + Régularité', 'engagement': 'Engagement quotidien',
    'dur-pnl': 'Durée + P&L cumulé', 'disc-prot': 'Discipline + Protections'
  };
  var CATALOG = KPI_IDS.concat(ROW_HIDEABLE);
  var DEFAULT_HIDDEN = []; // le coach voit tout par défaut

  var HANDLE_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>';

  // ---------- État ----------
  var _editMode = false, _tagged = false, _snapshot = null, _saved = null, _sortables = [], _toolbar = null, _catalogue = null;

  // Containers Sortable : id -> { el, sel }
  function containers() {
    var dash = DASH(); if (!dash) return {};
    var banner = dash.querySelector('.coach-kpi-5');
    return {
      'kpi-head': { el: banner, sel: '.metric-item' },
      'rows':     { el: dash,   sel: '[data-row-block]' }
    };
  }

  // ---------- Tagging (1×) ----------
  function tagBlocks() {
    var dash = DASH(); if (!dash) return false;
    if (_tagged) return true;

    // KPI head : les 5 .metric-item du banner .coach-kpi-5
    var banner = dash.querySelector('.coach-kpi-5');
    if (banner) {
      var cards = banner.querySelectorAll(':scope > .metric-item');
      cards.forEach(function (c, i) { if (KPI_IDS[i]) { c.setAttribute('data-block-id', KPI_IDS[i]); c.setAttribute('data-kpi', '1'); } });
      var brow = rowOf(banner); if (brow) { brow.setAttribute('data-block-id', 'kpi-banner'); brow.setAttribute('data-row-block', '1'); }
    }

    // Grands blocs (enfants directs de #coachDashboard), repérés par un élément-ancre
    function tagRow(node, id) { var r = rowOf(node); if (r) { r.setAttribute('data-block-id', id); r.setAttribute('data-row-block', '1'); } }
    tagRow(document.getElementById('globalCalendarGrid'), 'cal');
    tagRow(document.getElementById('globalHourlyChart'), 'hourly');
    tagRow(document.getElementById('coachT360Radar'), 't360-reg');
    tagRow(document.getElementById('coachEngagementChart'), 'engagement');
    tagRow(document.getElementById('globalDurationChart'), 'dur-pnl');
    tagRow(document.getElementById('globalDisciplineContainer'), 'disc-prot');
    // Points à surveiller : reorderable mais NON masquable (visibilité pilotée par renderSecondary)
    var pts = document.getElementById('coachWarningsBanner');
    if (pts) { pts.setAttribute('data-block-id', 'points-watch'); pts.setAttribute('data-row-block', '1'); }

    _tagged = true;
    return true;
  }

  // ---------- Visibilité ----------
  function setHidden(id, flag, opts) {
    var b = blockEl(id); if (!b) return;
    b.dataset.dashHidden = flag ? '1' : '0';
    b.style.display = flag ? 'none' : '';
    if (!opts || !opts.silent) { syncCatalogue(); resizeCharts(); }
  }
  function currentHidden() {
    return CATALOG.filter(function (id) { var b = blockEl(id); return b && b.dataset.dashHidden === '1'; });
  }
  function applyHidden(hiddenArr) {
    var set = {}; (hiddenArr || []).forEach(function (id) { set[id] = true; });
    CATALOG.forEach(function (id) { setHidden(id, !!set[id], { silent: true }); });
  }

  // ---------- Sérialisation / application ----------
  function serialize() {
    var c = containers(), out = { version: 1, containers: {}, hidden: currentHidden() };
    Object.keys(c).forEach(function (cid) {
      var def = c[cid]; if (!def.el) return;
      out.containers[cid] = Array.prototype.slice.call(def.el.querySelectorAll(':scope > ' + def.sel))
        .map(function (b) { return b.getAttribute('data-block-id'); }).filter(Boolean);
    });
    return out;
  }
  function applyLayout(layout) {
    var c = containers();
    if (layout && layout.containers) {
      Object.keys(layout.containers).forEach(function (cid) {
        var def = c[cid]; if (!def || !def.el) return;
        layout.containers[cid].forEach(function (bid) {
          var b = blockEl(bid);
          if (b && b.parentElement === def.el) def.el.appendChild(b); // reorder in-place
        });
      });
    }
    applyHidden(layout && layout.hidden ? layout.hidden : DEFAULT_HIDDEN);
    resizeCharts();
  }

  function resizeCharts() {
    if (!window.Chart || !window.Chart.getChart) return;
    ['globalHourlyChart', 'coachEngagementChart', 'globalDurationChart', 'globalDrawdownChart'].forEach(function (id) {
      var ch = window.Chart.getChart(id); if (ch) { try { ch.resize(); } catch (e) {} }
    });
  }

  // ---------- Persistance Supabase ----------
  function userId() { return (window.currentUser && window.currentUser.uuid) || null; }
  function loadLayout() {
    var s = SUPA(), uid = userId();
    if (!s || !uid) return Promise.resolve(null);
    return s.from('user_preferences').select('coach_dashboard_layout').eq('user_id', uid).maybeSingle()
      .then(function (r) { return r && r.data ? r.data.coach_dashboard_layout : null; })
      .catch(function (e) { console.warn('[COACH-DASH] loadLayout', e); return null; });
  }
  function persist(layout) {
    var s = SUPA(), uid = userId();
    if (!s || !uid) { return Promise.resolve(false); }
    return s.from('user_preferences').upsert({ user_id: uid, coach_dashboard_layout: layout, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .then(function (r) { return !r.error; })
      .catch(function (e) { console.warn('[COACH-DASH] persist', e); return false; });
  }

  // ---------- Affordances mode édition ----------
  function handleClassFor(b) {
    if (b.hasAttribute('data-kpi')) return 'dash-handle-kpi';
    return 'dash-handle-row';
  }
  function addAffordances() {
    document.querySelectorAll('#coachDashboard [data-block-id]').forEach(function (b) {
      if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
      if (!b.querySelector(':scope > .dash-handle')) {
        var h = document.createElement('div'); h.className = 'dash-handle ' + handleClassFor(b); h.setAttribute('aria-hidden', 'true');
        h.innerHTML = HANDLE_SVG; b.appendChild(h);
      }
    });
    CATALOG.forEach(function (id) {
      var b = blockEl(id); if (!b || b.querySelector(':scope > .dash-remove')) return;
      var x = document.createElement('button'); x.className = 'dash-remove'; x.type = 'button';
      x.title = 'Masquer ce bloc'; x.innerHTML = '&times;';
      x.addEventListener('click', function (e) { e.stopPropagation(); setHidden(id, true); });
      b.appendChild(x);
    });
  }
  function removeAffordances() {
    document.querySelectorAll('#coachDashboard .dash-handle, #coachDashboard .dash-remove').forEach(function (n) { n.remove(); });
  }

  // ---------- Sortable ----------
  function initSortables() {
    if (!window.Sortable) { console.warn('[COACH-DASH] Sortable.js absent'); return; }
    destroySortables();
    var base = { animation: motionOk() ? 150 : 0, ghostClass: 'dash-ghost', onEnd: function () { resizeCharts(); } };
    var c = containers();
    function mk(cid, handle, extra) {
      var def = c[cid]; if (!def || !def.el) return;
      _sortables.push(window.Sortable.create(def.el, Object.assign({}, base, { draggable: def.sel, group: cid, handle: handle }, extra || {})));
    }
    mk('kpi-head', '.dash-handle-kpi', { direction: 'horizontal' });
    mk('rows', '.dash-handle-row');
  }
  function destroySortables() { _sortables.forEach(function (s) { try { s.destroy(); } catch (e) {} }); _sortables = []; }

  // ---------- Catalogue ----------
  function buildCatalogue() {
    if (_catalogue) return _catalogue;
    var ov = document.createElement('div'); ov.id = 'coachDashCatalogueModal'; ov.className = 'dash-cat-overlay hidden';
    var rows = CATALOG.map(function (id) {
      return '<label class="dash-cat-row"><span>' + (LABELS[id] || id) + '</span>' +
        '<input type="checkbox" data-cat="' + id + '"></label>';
    }).join('');
    ov.innerHTML = '<div class="dash-cat-card"><h3>Ajouter / masquer des blocs</h3>' +
      '<div class="dash-cat-list">' + rows + '</div>' +
      '<div class="dash-cat-actions"><button type="button" class="dash-btn dash-btn-ghost" data-cat-close>Fermer</button></div></div>';
    document.body.appendChild(ov);
    ov.addEventListener('click', function (e) { if (e.target === ov || e.target.hasAttribute('data-cat-close')) closeCatalogue(); });
    ov.querySelectorAll('input[data-cat]').forEach(function (cb) {
      cb.addEventListener('change', function () { setHidden(cb.getAttribute('data-cat'), !cb.checked); });
    });
    _catalogue = ov; return ov;
  }
  function syncCatalogue() {
    if (!_catalogue) return;
    _catalogue.querySelectorAll('input[data-cat]').forEach(function (cb) {
      var b = blockEl(cb.getAttribute('data-cat'));
      cb.checked = !!(b && b.dataset.dashHidden !== '1');
    });
  }
  function openCatalogue() { buildCatalogue(); syncCatalogue(); _catalogue.classList.remove('hidden'); }
  function closeCatalogue() { if (_catalogue) _catalogue.classList.add('hidden'); }

  // ---------- Toolbar d'édition (injectée seulement en mode édition) ----------
  function injectToolbar() {
    if (_toolbar) return;
    var dash = DASH(); if (!dash) return;
    var bar = document.createElement('div'); bar.className = 'dash-toolbar'; _toolbar = bar;
    bar.innerHTML = '<span class="dash-edit-tag">Mode édition</span>' +
      '<div class="dash-toolbar-actions">' +
      '<button type="button" class="dash-btn dash-btn-ghost" data-act="add"><i class="fas fa-plus"></i> Ajouter / masquer</button>' +
      '<button type="button" class="dash-btn dash-btn-ghost" data-act="reset">Restaurer l\'origine</button>' +
      '<button type="button" class="dash-btn dash-btn-ghost" data-act="cancel">Annuler</button>' +
      '<button type="button" class="dash-btn dash-btn-gold" data-act="save">Sauvegarder</button>' +
      '</div>';
    bar.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-act');
        if (a === 'add') openCatalogue();
        else if (a === 'reset') resetDefault();
        else if (a === 'cancel') cancelEdit();
        else if (a === 'save') saveEdit();
      });
    });
    dash.insertBefore(bar, dash.firstChild);
  }
  function removeToolbar() { if (_toolbar) { _toolbar.remove(); _toolbar = null; } }

  // ---------- Cycle édition ----------
  function enterEdit() {
    if (_editMode) return;
    if (!tagBlocks()) return;
    _editMode = true;
    _snapshot = serialize();
    DASH().classList.add('dash-edit');
    injectToolbar();
    addAffordances();
    initSortables();
    // S'assurer que la section dashboard est visible (si le coach était sur un autre onglet)
    if (typeof window.showCoachSection === 'function') window.showCoachSection('coachDashboard');
  }
  function leaveEdit() {
    _editMode = false;
    destroySortables();
    removeAffordances();
    closeCatalogue();
    removeToolbar();
    DASH().classList.remove('dash-edit');
    resizeCharts();
  }
  function cancelEdit() { applyLayout(_snapshot || _saved); leaveEdit(); }
  function saveEdit() {
    var layout = serialize();
    persist(layout).then(function (ok) {
      if (ok) { _saved = layout; toast('Disposition coach sauvegardée'); }
      else { toast('Échec de la sauvegarde'); }
      leaveEdit();
    });
  }
  function resetDefault() {
    if (!window.confirm('Restaurer la disposition par défaut du dashboard coach ?')) return;
    persist(null).then(function () {
      _saved = null;
      applyHidden(DEFAULT_HIDDEN);
      leaveEdit();
      toast('Disposition d\'origine restaurée');
      // Reload pour restaurer l'ordre DOM natif (les blocs déplacés ne reviennent pas seuls).
      setTimeout(function () { window.location.reload(); }, 600);
    });
  }

  // ---------- Bootstrap ----------
  function boot() {
    if (!tagBlocks()) return;
    var tries = 0;
    (function waitApply() {
      if (userId() && SUPA()) {
        loadLayout().then(function (l) { _saved = l; applyLayout(l); });
      } else if (tries++ < 40) { setTimeout(waitApply, 300); }
      else { applyLayout(null); }
    })();
  }

  // API publique : le bouton sidebar appelle enterCoachDashboardEdit().
  window.enterCoachDashboardEdit = enterEdit;
  window.initCoachDashboardCustomizer = boot;
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
