// ========================================
// TRADE GRAPH (#16) — graph du marché au moment d'un trade, flèches entrée/sortie collées
// aux bougies exactes (Lightweight Charts + proxy Yahoo Finance /api/market-data/ohlc).
// S'adapte au modèle client (camelCase) : trade.symbol (code instrument), trade.entryTimestamp,
// trade.exitTimestamp (timestamps bruts), trade.direction/type, entryPrice/exitPrice, quantity, pnl.
// ========================================
(function () {
  'use strict';

  const INSTRUMENT_MAP = {
    ES:  { name: 'S&P 500 Futures' },
    NQ:  { name: 'Nasdaq 100 Futures' },
    MES: { name: 'Micro S&P 500' },
    MNQ: { name: 'Micro Nasdaq' },
    GC:  { name: 'Gold Futures' },
    CL:  { name: 'Crude Oil' },
    RTY: { name: 'Russell 2000' },
    YM:  { name: 'Dow Jones' },
  };

  function notify(msg, type) { if (window.showNotification) window.showNotification(msg, type || 'info'); }

  // Résout un timestamp trade → epoch SECONDES. Priorité au timestamp brut, sinon date+heure.
  function resolveEpoch(rawTs, dateStr, timeStr) {
    if (rawTs) {
      const t = new Date(rawTs).getTime();
      if (!isNaN(t)) return Math.floor(t / 1000);
    }
    if (dateStr && timeStr) {
      // "2026-08-14" + "14:30" → interprété en heure locale (Paris pour les élèves FR), comme le reste de l'app.
      const t = new Date(`${dateStr}T${timeStr}:00`).getTime();
      if (!isNaN(t)) return Math.floor(t / 1000);
    }
    return null;
  }

  function fmtDuration(sec) {
    if (!sec || sec < 0) return '—';
    const m = Math.round(sec / 60);
    if (m < 60) return m + ' min';
    const h = Math.floor(m / 60), r = m % 60;
    return r ? `${h}h${String(r).padStart(2, '0')}` : `${h}h`;
  }

  const TradeGraph = {
    _chart: null, _series: null, _resizeHandler: null,

    async open(trade) {
      if (!trade) return;
      const instrument = String(trade.symbol || trade.instrument || '').toUpperCase();
      const mapped = INSTRUMENT_MAP[instrument];
      if (!mapped) {
        notify('Graph non disponible pour cet instrument (' + (instrument || '?') + ')', 'error');
        return;
      }

      const entryTs = resolveEpoch(trade.entryTimestamp, trade.date, trade.entryTime);
      const exitTs = resolveEpoch(trade.exitTimestamp, trade.date, trade.exitTime);
      if (!entryTs || !exitTs) {
        notify('Données trade incomplètes (heures d\'entrée/sortie manquantes).', 'error');
        return;
      }

      const isLong = ((window.getTradeDirection && window.getTradeDirection(trade.type))
        || String(trade.direction || '').toUpperCase()) !== 'SHORT';

      // Timeframe auto selon durée, puis bump si le trade est trop ancien (limites Yahoo).
      const durationSec = Math.max(0, exitTs - entryTs);
      let interval = durationSec < 1800 ? '1m' : durationSec < 7200 ? '5m' : durationSec < 28800 ? '15m' : '1h';
      const ageDays = (Date.now() / 1000 - entryTs) / 86400;
      let bumpNote = '';
      if (interval === '1m' && ageDays > 7) { interval = '5m'; bumpNote = 'Trade > 7 jours → bougies 5 min (limite Yahoo 1 min).'; }
      if ((interval === '5m' || interval === '15m') && ageDays > 60) { interval = '1h'; bumpNote = 'Trade > 60 jours → bougies 1 h (limite Yahoo).'; }

      const paddingSec = 30 * 60;
      const from = Math.floor(entryTs - paddingSec);
      const to = Math.ceil(exitTs + paddingSec);

      this._populateSidebar(trade, instrument, mapped, durationSec, bumpNote);

      const modal = document.getElementById('tradeGraphModal');
      const title = document.getElementById('tradeGraphTitle');
      const subtitle = document.getElementById('tradeGraphSubtitle');
      if (title) title.textContent = `${instrument} · ${mapped.name}`;
      if (subtitle) subtitle.textContent = `${trade.date || ''} · bougies ${interval}`;
      modal.style.display = 'flex';
      this._showLoading();

      if (!window.LightweightCharts) {
        this._showError('Bibliothèque graphique non chargée. Recharge la page.');
        return;
      }

      try {
        const headers = {};
        try {
          const { data } = await window.supabaseClient.auth.getSession();
          const token = data?.session?.access_token;
          if (token) headers['Authorization'] = 'Bearer ' + token;
        } catch (_) {}

        const url = `/api/market-data/ohlc?symbol=${encodeURIComponent(instrument)}&interval=${interval}&from=${from}&to=${to}`;
        const res = await fetch(url, { headers });
        if (res.status === 429) throw new Error('Trop de requêtes, réessaie dans 1 min.');
        if (!res.ok) {
          let msg = 'Erreur ' + res.status;
          try { const j = await res.json(); if (j.error) msg = j.error; } catch (_) {}
          throw new Error(msg);
        }
        const data = await res.json();
        if (!data.candles || data.candles.length === 0) throw new Error('Aucune donnée marché sur cette période.');
        if (data.fallback_used) {
          const note = document.getElementById('tgNote');
          if (note) note.textContent = (note.textContent ? note.textContent + ' ' : '')
            + `Micro indisponible chez Yahoo → contrat majeur (${data.yahoo}) affiché.`;
        }
        this._renderChart(data.candles, trade, entryTs, exitTs, isLong);
      } catch (e) {
        this._showError(e.message || 'Erreur inconnue');
      }
    },

    _renderChart(candles, trade, entryTs, exitTs, isLong) {
      const container = document.getElementById('tradeGraphChartWrap');
      container.innerHTML = '';

      this._chart = window.LightweightCharts.createChart(container, {
        layout: { background: { color: '#0F1C3D' }, textColor: '#FBF8F1' },
        grid: { vertLines: { color: '#1a2951' }, horzLines: { color: '#1a2951' } },
        crosshair: { mode: 1 },
        rightPriceScale: { borderColor: '#B8862A' },
        timeScale: { borderColor: '#B8862A', timeVisible: true, secondsVisible: false },
        width: container.clientWidth,
        height: container.clientHeight,
      });

      this._series = this._chart.addCandlestickSeries({
        upColor: '#10b981', downColor: '#ef4444',
        borderUpColor: '#10b981', borderDownColor: '#ef4444',
        wickUpColor: '#10b981', wickDownColor: '#ef4444',
      });
      this._series.setData(candles);

      this._series.setMarkers([
        {
          time: Math.floor(entryTs),
          position: isLong ? 'belowBar' : 'aboveBar',
          color: '#10b981',
          shape: isLong ? 'arrowUp' : 'arrowDown',
          text: 'ENTRÉE ' + (trade.entryPrice != null ? trade.entryPrice : ''),
        },
        {
          time: Math.floor(exitTs),
          position: isLong ? 'aboveBar' : 'belowBar',
          color: '#ef4444',
          shape: isLong ? 'arrowDown' : 'arrowUp',
          text: 'SORTIE ' + (trade.exitPrice != null ? trade.exitPrice : ''),
        },
      ]);

      // Auto-zoom sur la période du trade + 20 min de marge de part et d'autre.
      try { this._chart.timeScale().setVisibleRange({ from: entryTs - 20 * 60, to: exitTs + 20 * 60 }); }
      catch (_) { this._chart.timeScale().fitContent(); }

      const resize = () => this._chart && this._chart.applyOptions({ width: container.clientWidth, height: container.clientHeight });
      window.addEventListener('resize', resize);
      this._resizeHandler = resize;
    },

    _populateSidebar(trade, instrument, mapped, durationSec, bumpNote) {
      const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
      const isLong = ((window.getTradeDirection && window.getTradeDirection(trade.type))
        || String(trade.direction || '').toUpperCase()) !== 'SHORT';
      set('tgInstrument', `${instrument} · ${mapped.name}`);
      set('tgDirection', isLong ? 'LONG' : 'SHORT');
      set('tgEntry', (trade.entryTime || '—') + (trade.entryPrice != null ? ` @ ${trade.entryPrice}` : ''));
      set('tgExit', (trade.exitTime || '—') + (trade.exitPrice != null ? ` @ ${trade.exitPrice}` : ''));
      set('tgDuration', fmtDuration(durationSec));
      set('tgQty', trade.quantity != null ? String(trade.quantity) : '—');

      const pnl = Number(trade.pnl) || 0;
      const pnlEl = document.getElementById('tgPnl');
      if (pnlEl) {
        pnlEl.textContent = (pnl >= 0 ? '+' : '') + '$' + Math.abs(pnl).toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        pnlEl.style.color = pnl >= 0 ? '#10b981' : '#ef4444';
      }

      // Ratio R via risk_per_trade du compte, comme le modal détail.
      let rTxt = '—';
      try {
        const acc = (window.accounts || []).find((a) => a.id === trade.accountId);
        const risk = acc && parseFloat(acc.risk_per_trade);
        if (risk && risk > 0) { const r = pnl / risk; rTxt = (r >= 0 ? '+' : '') + r.toFixed(1) + 'R'; }
      } catch (_) {}
      set('tgR', rTxt);

      const note = document.getElementById('tgNote');
      if (note) note.textContent = bumpNote || '';
    },

    _showLoading() {
      const c = document.getElementById('tradeGraphChartWrap');
      if (c) c.innerHTML = '<div class="tg-state"><div class="tg-spinner"></div><span>Chargement du graphique…</span></div>';
    },
    _showError(msg) {
      const c = document.getElementById('tradeGraphChartWrap');
      if (c) c.innerHTML = '<div class="tg-state tg-error"><i class="fas fa-triangle-exclamation"></i><span>' + (msg || 'Erreur') + '</span></div>';
    },

    close() {
      const m = document.getElementById('tradeGraphModal');
      if (m) m.style.display = 'none';
      if (this._chart) { try { this._chart.remove(); } catch (_) {} this._chart = null; this._series = null; }
      if (this._resizeHandler) { window.removeEventListener('resize', this._resizeHandler); this._resizeHandler = null; }
    },
  };

  window.TradeGraph = TradeGraph;

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      const m = document.getElementById('tradeGraphModal');
      if (m && m.style.display !== 'none') TradeGraph.close();
    }
  });
})();
