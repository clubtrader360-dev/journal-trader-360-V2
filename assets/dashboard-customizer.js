/* Dashboard personnalisable (#27) — "Bourse à l'Aube"
   Mode édition explicite + drag (Sortable.js) + persistance Supabase (user_preferences.dashboard_layout).
   Ne touche PAS updateBanner/updateDashboard/Chart.js/sparklines : réorganise uniquement le DOM (move de containers).
   Périmètre : KPI head (reorder horizontal + show/hide via catalogue), rangées full-width (reorder vertical),
   pile latérale (calendrier/insights) et grille charts. Mobile = hors scope (#26). */
(function () {
  'use strict';

  // ---------- Helpers ----------
  function SUPA() { return window.supabaseClient || window.supabase || null; }
  function reducedMotion() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }
  function motionOk() { return !reducedMotion() && document.body.dataset.animations !== 'off'; }
  function toast(msg) { if (typeof window.showNotification === 'function') window.showNotification(msg, 'success'); }
  function DASH() { return document.getElementById('dashboard'); }
  function blockEl(id) { return document.querySelector('#dashboard [data-block-id="' + id + '"]'); }
  function closestCard(node) { return node ? node.closest('.trader-card') : null; }
  // Remonte jusqu'à l'enfant direct de #dashboard.
  function rowOf(node) {
    var dash = DASH(); if (!node || !dash) return null;
    var n = node; while (n && n.parentElement && n.parentElement !== dash) n = n.parentElement;
    return (n && n.parentElement === dash) ? n : null;
  }

  // KPI head + bloc Score = blocs masquables (catalogue).
  var KPI_IDS = ['net-pnl', 'trade-win', 'day-win', 'profit-factor', 'avg-winloss', 'rr1-rr2', 'trades-method', 'trades-no-method'];
  var LABELS = {
    'net-pnl': 'Net P&L', 'trade-win': 'Trade win %', 'day-win': 'Day win %', 'profit-factor': 'Profit factor',
    'avg-winloss': 'Avg win/loss', 'rr1-rr2': 'RR1/RR2 atteint', 'trades-method': 'Trades Méthode',
    'trades-no-method': 'Trades Hors Méthode', 'trader-score': 'Trader 360 Score'
  };
  var CATALOG = KPI_IDS.concat(['trader-score']);
  var DEFAULT_HIDDEN = ['trader-score']; // Score masqué par défaut (état actuel du V2)

  var HANDLE_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="6" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="18" r="1"/><circle cx="15" cy="6" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="18" r="1"/></svg>';

  // ---------- État ----------
  var _editMode = false, _tagged = false, _snapshot = null, _saved = null, _sortables = [], _toolbar = null, _catalogue = null;

  // Containers Sortable : id -> { el, sel } (sel = sélecteur des items draggables, enfants directs)
  function containers() {
    var dash = DASH(); if (!dash) return {};
    var banner = dash.querySelector('.traderzella-banner');
    var sideStack = (document.getElementById('warningsBanner') || {}).parentElement || null;
    var gridCharts = rowOf(document.getElementById('dailyPnlChart'));
    return {
      'kpi-head':    { el: banner,    sel: '.metric-item' },
      'rows':        { el: dash,      sel: '[data-row-block]' },
      'side-stack':  { el: sideStack, sel: '[data-side]' },
      'charts-grid': { el: gridCharts, sel: '[data-chartcell]' }
    };
  }

  // ---------- Tagging (1×) ----------
  function tagBlocks() {
    var dash = DASH(); if (!dash) return false;
    if (_tagged) return true;

    // KPI head
    var banner = dash.querySelector('.traderzella-banner');
    if (banner) {
      var cards = banner.querySelectorAll(':scope > .metric-item');
      cards.forEach(function (c, i) { if (KPI_IDS[i]) { c.setAttribute('data-block-id', KPI_IDS[i]); c.setAttribute('data-kpi', '1'); } });
    }

    // Rangées top-level (enfants directs de #dashboard)
    function tagRow(node, id) { var r = rowOf(node); if (r) { r.setAttribute('data-block-id', id); r.setAttribute('data-row-block', '1'); } }
    tagRow(document.getElementById('mantraContainer'), 'mantra');
    tagRow(banner, 'kpi-banner');
    tagRow(document.getElementById('calendarGrid'), 'grid-main');
    tagRow(document.getElementById('dailyPnlChart'), 'grid-charts');
    tagRow(document.getElementById('pnlDrawdownChart'), 'pnl-dd');

    // Pile latérale (colonne droite de la grille calendrier)
    function tagSide(node, id) { var c = closestCard(node) || node; if (c) { c.setAttribute('data-block-id', id); c.setAttribute('data-side', '1'); } }
    var pts = document.getElementById('warningsBanner');
    if (pts) { pts.setAttribute('data-block-id', 'points-watch'); pts.setAttribute('data-side', '1'); }
    tagSide(document.getElementById('recentTradesContainer'), 'recent-trades');
    tagSide(document.getElementById('protectionAnalysisContainer'), 'protection');
    tagSide(document.getElementById('trendAnalysisContainer'), 'trend');

    // Grille charts (cellules directes)
    function tagCell(node, id) { var c = closestCard(node); if (c) { c.setAttribute('data-block-id', id); c.setAttribute('data-chartcell', '1'); } }
    tagCell(document.getElementById('traderScoreChart'), 'trader-score');
    tagCell(document.getElementById('tradeTimeChart'), 'trade-time');
    tagCell(document.getElementById('consistencyRatio'), 'consistency');
    tagCell(document.getElementById('dailyPnlChart'), 'daily-pnl');
    tagCell(document.getElementById('durationChart'), 'duration'); // désormais cellule de la grille charts (#27, carré)

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
          if (b && b.parentElement === def.el) def.el.appendChild(b); // reorder in-place (même container)
        });
      });
    }
    applyHidden(layout && layout.hidden ? layout.hidden : DEFAULT_HIDDEN);
    resizeCharts();
  }

  function resizeCharts() {
    if (!window.Chart || !window.Chart.getChart) return;
    ['traderScoreChart', 'tradeTimeChart', 'dailyPnlChart', 'pnlDrawdownChart', 'durationChart'].forEach(function (id) {
      var ch = window.Chart.getChart(id); if (ch) { try { ch.resize(); } catch (e) {} }
    });
  }

  // ---------- Persistance Supabase ----------
  function userId() { return (window.currentUser && window.currentUser.uuid) || null; }
  function loadLayout() {
    var s = SUPA(), uid = userId();
    if (!s || !uid) return Promise.resolve(null);
    return s.from('user_preferences').select('dashboard_layout').eq('user_id', uid).maybeSingle()
      .then(function (r) { return r && r.data ? r.data.dashboard_layout : null; })
      .catch(function (e) { console.warn('[DASH] loadLayout', e); return null; });
  }
  function persist(layout) {
    var s = SUPA(), uid = userId();
    if (!s || !uid) { return Promise.resolve(false); }
    return s.from('user_preferences').upsert({ user_id: uid, dashboard_layout: layout, updated_at: new Date().toISOString() }, { onConflict: 'user_id' })
      .then(function (r) { return !r.error; })
      .catch(function (e) { console.warn('[DASH] persist', e); return false; });
  }

  // ---------- Affordances mode édition ----------
  // Handle dédié par rôle → évite qu'un Sortable imbriqué démarre sur le handle d'un autre niveau.
  function handleClassFor(b) {
    if (b.hasAttribute('data-row-block')) return 'dash-handle-row';
    if (b.hasAttribute('data-kpi')) return 'dash-handle-kpi';
    if (b.hasAttribute('data-side')) return 'dash-handle-side';
    if (b.hasAttribute('data-chartcell')) return 'dash-handle-cell';
    return 'dash-handle-row';
  }
  function addAffordances() {
    document.querySelectorAll('#dashboard [data-block-id]').forEach(function (b) {
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
    document.querySelectorAll('#dashboard .dash-handle, #dashboard .dash-remove').forEach(function (n) { n.remove(); });
  }

  // ---------- Sortable ----------
  function initSortables() {
    if (!window.Sortable) { console.warn('[DASH] Sortable.js absent'); return; }
    destroySortables();
    var base = { animation: motionOk() ? 150 : 0, ghostClass: 'dash-ghost', onEnd: function () { resizeCharts(); } };
    var c = containers();
    function mk(cid, handle, extra) {
      var def = c[cid]; if (!def || !def.el) return;
      _sortables.push(window.Sortable.create(def.el, Object.assign({}, base, { draggable: def.sel, group: cid, handle: handle }, extra || {})));
    }
    mk('kpi-head', '.dash-handle-kpi', { direction: 'horizontal' });
    mk('rows', '.dash-handle-row');
    mk('side-stack', '.dash-handle-side');
    mk('charts-grid', '.dash-handle-cell');
  }
  function destroySortables() { _sortables.forEach(function (s) { try { s.destroy(); } catch (e) {} }); _sortables = []; }

  // ---------- Catalogue ----------
  function buildCatalogue() {
    if (_catalogue) return _catalogue;
    var ov = document.createElement('div'); ov.id = 'dashCatalogueModal'; ov.className = 'dash-cat-overlay hidden';
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

  // ---------- Toolbar ----------
  function injectToolbar() {
    if (_toolbar) return;
    var dash = DASH(); if (!dash) return;
    var bar = document.createElement('div'); bar.className = 'dash-toolbar'; _toolbar = bar;
    renderToolbar();
    dash.insertBefore(bar, dash.firstChild);
  }
  function renderToolbar() {
    if (!_toolbar) return;
    if (!_editMode) {
      _toolbar.innerHTML = '<button type="button" class="dash-btn dash-btn-ghost" data-act="edit">' +
        '<i class="fas fa-sliders-h"></i> Personnaliser mon dashboard</button>';
    } else {
      _toolbar.innerHTML = '<span class="dash-edit-tag">Mode édition</span>' +
        '<div class="dash-toolbar-actions">' +
        '<button type="button" class="dash-btn dash-btn-ghost" data-act="add"><i class="fas fa-plus"></i> Ajouter une métrique</button>' +
        '<button type="button" class="dash-btn dash-btn-ghost" data-act="reset">Restaurer l\'origine</button>' +
        '<button type="button" class="dash-btn dash-btn-ghost" data-act="cancel">Annuler</button>' +
        '<button type="button" class="dash-btn dash-btn-gold" data-act="save">Sauvegarder</button>' +
        '</div>';
    }
    _toolbar.querySelectorAll('[data-act]').forEach(function (b) {
      b.addEventListener('click', function () {
        var a = b.getAttribute('data-act');
        if (a === 'edit') enterEdit();
        else if (a === 'add') openCatalogue();
        else if (a === 'reset') resetDefault();
        else if (a === 'cancel') cancelEdit();
        else if (a === 'save') saveEdit();
      });
    });
  }

  // ---------- Cycle édition ----------
  function enterEdit() {
    if (_editMode) return;
    _editMode = true;
    _snapshot = serialize();
    DASH().classList.add('dash-edit');
    addAffordances();
    initSortables();
    renderToolbar();
  }
  function leaveEdit() {
    _editMode = false;
    destroySortables();
    removeAffordances();
    closeCatalogue();
    DASH().classList.remove('dash-edit');
    renderToolbar();
    resizeCharts();
  }
  function cancelEdit() { applyLayout(_snapshot || _saved); leaveEdit(); }
  function saveEdit() {
    var layout = serialize();
    persist(layout).then(function (ok) {
      if (ok) { _saved = layout; toast('Disposition sauvegardée'); }
      else { toast('Échec de la sauvegarde'); }
      leaveEdit();
    });
  }
  function resetDefault() {
    if (!window.confirm('Restaurer la disposition par défaut du dashboard ?')) return;
    persist(null).then(function () {
      // Recharge l'ordre DOM par défaut : on réapplique le snapshot d'entrée d'édition n'est pas "default".
      // Le plus sûr = reload léger de la page pour repartir du DOM d'origine.
      _saved = null;
      applyHidden(DEFAULT_HIDDEN);
      leaveEdit();
      toast('Disposition d\'origine restaurée');
      // Reload pour restaurer l'ordre DOM natif (les blocs déjà déplacés ne reviennent pas seuls).
      setTimeout(function () { window.location.reload(); }, 600);
    });
  }

  // ---------- Bootstrap ----------
  function boot() {
    if (!tagBlocks()) return;
    injectToolbar();
    var tries = 0;
    (function waitApply() {
      if (userId() && SUPA()) {
        loadLayout().then(function (l) { _saved = l; applyLayout(l); });
      } else if (tries++ < 40) { setTimeout(waitApply, 300); }
      else { applyLayout(null); } // défaut si pas de session
    })();
  }

  window.initDashboardCustomizer = boot;
  if (document.readyState !== 'loading') boot();
  else document.addEventListener('DOMContentLoaded', boot);
})();
