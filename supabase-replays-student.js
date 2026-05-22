/**
 * =================================================================
 * JOURNAL TRADER 360 - REPLAYS MODULE ÉLÈVE (#42)
 * Version: 1.0.0
 * Description: Calendrier mensuel + modal vidéos du jour (côté élève)
 * =================================================================
 */

(() => {
    console.log('[REPLAYS-STUDENT] Chargement supabase-replays-student.js...');

    const supabase = window.supabaseClient || window.supabase;

    if (!supabase) {
        console.error('[REPLAYS-STUDENT] ❌ window.supabaseClient manquant');
        throw new Error('supabaseClient manquant');
    }

    const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin',
                       'Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

    let currentReplayYear  = new Date().getFullYear();
    let currentReplayMonth = new Date().getMonth(); // 0-indexed

    const _replayCacheById = {};

    let _activePlayer    = null;
    let _activeReplayId  = null;
    let _lastUpsertTime  = 0;

    // ===== ENTRY POINT =====

    async function loadStudentReplays() {
        currentReplayYear  = new Date().getFullYear();
        currentReplayMonth = new Date().getMonth();
        await renderReplayCalendar(currentReplayYear, currentReplayMonth);
    }

    // ===== NAVIGATION MOIS =====

    async function changeReplayMonth(delta) {
        currentReplayMonth += delta;
        if (currentReplayMonth > 11) { currentReplayMonth = 0;  currentReplayYear++; }
        if (currentReplayMonth < 0)  { currentReplayMonth = 11; currentReplayYear--; }
        await renderReplayCalendar(currentReplayYear, currentReplayMonth);
    }

    // ===== CALENDRIER =====

    function buildCalendarSkeleton(year, month) {
        const grid = document.getElementById('replayCalendarGrid');
        if (!grid) return;

        const today    = new Date();
        const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const startDate = new Date(year, month, 1);
        startDate.setDate(1 - startDate.getDay()); // recule au dimanche

        let html = '';
        for (let i = 0; i < 42; i++) {
            const cell = new Date(startDate);
            cell.setDate(startDate.getDate() + i);
            const isCurrentMonth = cell.getMonth() === month && cell.getFullYear() === year;
            const dy      = cell.getDate();
            const dateStr = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(dy).padStart(2, '0')}`;
            const isToday = dateStr === todayStr;

            if (!isCurrentMonth) {
                html += `<div class="text-center py-3 cursor-pointer rounded transition-all text-gray-300"><div class="font-semibold">${dy}</div></div>`;
            } else {
                const ring      = isToday ? ' ring-2 ring-blue-300' : '';
                const todayAttr = isToday ? ' data-today="true"' : '';
                html += `<div data-replay-date="${dateStr}"${todayAttr} class="text-center py-3 cursor-pointer rounded transition-all text-gray-700 hover:bg-gray-100${ring}"><div class="font-semibold">${dy}</div></div>`;
            }
        }
        grid.innerHTML = html;
    }

    function markCellsWithReplays(byDate) {
        Object.entries(byDate).forEach(([dateStr, items]) => {
            const cell = document.querySelector(`[data-replay-date="${dateStr}"]`);
            if (!cell) return;
            const count   = items.length;
            const isToday = cell.hasAttribute('data-today');
            const ring    = isToday ? ' ring-2 ring-amber-500' : '';
            const day     = parseInt(dateStr.split('-')[2], 10);
            cell.className = `text-center py-3 cursor-pointer rounded transition-all bg-amber-100 text-amber-800 hover:bg-amber-200${ring}`;
            cell.setAttribute('onclick', `openReplayDayModal('${dateStr}')`);
            cell.innerHTML = `<div class="font-semibold">${day}</div><div class="text-xs mt-1 space-y-0.5"><div class="font-bold text-xl">${count}</div><div class="opacity-75">${count === 1 ? 'replay' : 'replays'}</div></div>`;
        });
    }

    async function renderReplayCalendar(year, month) {
        const label = document.getElementById('replayCurrentMonthLabel');
        if (!document.getElementById('replayCalendarGrid')) return;

        if (label) label.textContent = `${MONTHS_FR[month]} ${year}`;

        // Squelette toujours rendu en premier — calendrier visible même sans données
        buildCalendarSkeleton(year, month);

        const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDay  = new Date(year, month + 1, 0).toISOString().slice(0, 10);

        const { data: replays, error: errReplays } = await supabase
            .from('replays')
            .select('id, title, replay_date, vimeo_video_id, vimeo_hash')
            .gte('replay_date', firstDay)
            .lte('replay_date', lastDay)
            .order('replay_date', { ascending: true });

        if (errReplays) {
            console.error('[REPLAYS-STUDENT] renderReplayCalendar error:', errReplays?.message || errReplays?.code, errReplays);
            // Le squelette reste visible — les marqueurs amber n'apparaîtront pas
            return;
        }

        if (!replays || replays.length === 0) {
            updateReplayStatsHeader({});
            updateReplayWeekSummary({}, year, month);
            return;
        }

        const ids = replays.map(r => r.id);
        const { data: views, error: errViews } = await supabase
            .from('replay_views')
            .select('replay_id, completed, progress_seconds')
            .in('replay_id', ids);

        const viewsByReplayId = {};
        if (!errViews && views) {
            views.forEach(v => { viewsByReplayId[v.replay_id] = v; });
        }

        const byDate = {};
        replays.forEach(r => {
            if (!byDate[r.replay_date]) byDate[r.replay_date] = [];
            byDate[r.replay_date].push({ ...r, view: viewsByReplayId[r.id] || null });
        });

        markCellsWithReplays(byDate);
        updateReplayStatsHeader(byDate);
        updateReplayWeekSummary(byDate, year, month);
    }

    // ===== STATS HEADER =====

    function updateReplayStatsHeader(byDate) {
        let total = 0;
        const activeDays = new Set();
        Object.entries(byDate).forEach(([dateStr, items]) => {
            total += items.length;
            activeDays.add(dateStr);
        });
        const daysCount = activeDays.size;
        const totalEl = document.getElementById('replayMonthTotal');
        const daysEl  = document.getElementById('replayMonthDays');
        if (totalEl) {
            totalEl.textContent = total === 1 ? '1 replay' : `${total} replays`;
            totalEl.className   = 'font-semibold ' + (total > 0 ? 'text-amber-600' : 'text-gray-600');
        }
        if (daysEl) {
            daysEl.textContent = daysCount <= 1 ? `${daysCount} jour actif` : `${daysCount} jours actifs`;
        }
    }

    // ===== WEEK SUMMARY CARDS =====

    function updateReplayWeekSummary(byDate, year, month) {
        const startOfGrid = new Date(year, month, 1);
        startOfGrid.setDate(1 - startOfGrid.getDay()); // recule au dimanche

        const weekData = Array.from({ length: 5 }, () => ({ count: 0, days: new Set() }));

        Object.entries(byDate).forEach(([dateStr, items]) => {
            const d    = new Date(dateStr + 'T12:00:00');
            const base = new Date(startOfGrid);
            base.setHours(12, 0, 0, 0);
            const row = Math.floor((d - base) / (7 * 24 * 3600 * 1000));
            if (row >= 0 && row < 5) {
                weekData[row].count += items.length;
                weekData[row].days.add(dateStr);
            }
        });

        for (let i = 0; i < 5; i++) {
            const countEl = document.getElementById(`replayWeek${i + 1}Count`);
            const daysEl  = document.getElementById(`replayWeek${i + 1}Days`);
            if (!countEl || !daysEl) continue;
            const c = weekData[i].count;
            const d = weekData[i].days.size;
            countEl.textContent = c === 1 ? '1 replay' : `${c} replays`;
            countEl.className   = 'text-xl font-bold mb-1 ' + (c > 0 ? 'text-amber-600' : 'text-gray-400');
            daysEl.textContent  = d <= 1 ? `${d} jour` : `${d} jours`;
        }
    }

    // ===== MODAL VIDÉOS DU JOUR =====

    async function openReplayDayModal(dateStr) {
        const modal     = document.getElementById('replayDayModal');
        const titleEl   = document.getElementById('replayDayModalTitle');
        const listEl    = document.getElementById('replayDayModalList');
        if (!modal || !titleEl || !listEl) return;

        const [y, m, d] = dateStr.split('-');
        titleEl.textContent = `Vidéos du ${d}/${m}/${y}`;
        listEl.innerHTML    = '<p class="text-gray-500 text-center py-4">Chargement...</p>';
        modal.classList.remove('hidden');

        const { data: replays, error: errReplays } = await supabase
            .from('replays')
            .select('id, title, vimeo_video_id, vimeo_hash')
            .eq('replay_date', dateStr)
            .order('created_at', { ascending: true });

        if (errReplays || !replays || replays.length === 0) {
            listEl.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun replay pour ce jour.</p>';
            return;
        }

        const ids = replays.map(r => r.id);
        const { data: views } = await supabase
            .from('replay_views')
            .select('replay_id, completed, progress_seconds')
            .in('replay_id', ids);

        const viewMap = {};
        (views || []).forEach(v => { viewMap[v.replay_id] = v; });

        replays.forEach(r => { _replayCacheById[r.id] = r; });

        listEl.innerHTML = replays.map(r => {
            const v    = viewMap[r.id];
            let badge  = '';
            if (v?.completed) {
                badge = '<span class="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-100 px-2 py-0.5 rounded-full">✓ Terminé</span>';
            } else if (v?.progress_seconds > 0) {
                badge = '<span class="inline-flex items-center gap-1 text-xs font-medium text-yellow-700 bg-yellow-100 px-2 py-0.5 rounded-full">⏳ En cours</span>';
            }

            return `
            <div class="flex items-center justify-between gap-3 py-3 border-b border-gray-100 last:border-0">
                <div class="min-w-0 flex-1">
                    <p class="text-sm font-medium text-gray-900 line-clamp-2">${escHtml(r.title)}</p>
                    ${badge ? `<div class="mt-1">${badge}</div>` : ''}
                </div>
                <button onclick="openReplayPlayer(${r.id})"
                    class="flex-shrink-0 px-3 py-1.5 bg-blue-600 text-white text-xs font-semibold rounded hover:bg-blue-700 whitespace-nowrap">
                    Regarder
                </button>
            </div>`;
        }).join('');
    }

    function closeReplayDayModal() {
        document.getElementById('replayDayModal')?.classList.add('hidden');
    }

    // ===== PLAYER (Phase 5) =====

    async function openReplayPlayer(replayId) {
        const replay  = _replayCacheById[replayId];
        if (!replay) return;

        const modal   = document.getElementById('replayPlayerModal');
        const titleEl = document.getElementById('replayPlayerTitle');
        const slotEl  = document.getElementById('replayPlayerIframeSlot');
        const wmEl    = document.getElementById('replayPlayerWatermark');
        if (!modal || !titleEl || !slotEl || !wmEl) return;

        // Watermark
        const u     = window.currentUser || {};
        const name  = u.name  || 'Utilisateur Trader 360';
        const email = u.email || '';
        wmEl.innerHTML = escHtml(name) + (email ? '<br>' + escHtml(email) : '');

        // Titre
        titleEl.textContent = replay.title || 'Replay';

        // Iframe Vimeo avec player épuré
        const params = new URLSearchParams({ title: '0', byline: '0', portrait: '0', dnt: '1' });
        if (replay.vimeo_hash) params.set('h', replay.vimeo_hash);
        const src = `https://player.vimeo.com/video/${replay.vimeo_video_id}?${params}`;
        slotEl.innerHTML = `<iframe id="replayPlayerIframe"
            src="${src}"
            style="position:absolute;top:0;left:0;width:100%;height:100%;border:0;"
            allow="autoplay; fullscreen; picture-in-picture"
            allowfullscreen></iframe>`;

        // Masquer la liste du jour, afficher le player
        document.getElementById('replayDayModal')?.classList.add('hidden');
        modal.classList.remove('hidden');

        // Tracking
        const uid = (await supabase.auth.getUser()).data?.user?.id;

        const { data: existingView } = await supabase
            .from('replay_views')
            .select('progress_seconds, completed')
            .eq('replay_id', replay.id)
            .eq('user_id', uid)
            .maybeSingle();

        _activePlayer   = new Vimeo.Player(document.getElementById('replayPlayerIframe'));
        _activeReplayId = replay.id;
        _lastUpsertTime = 0;

        _activePlayer.ready().then(() => {
            if (existingView?.progress_seconds > 0 && !existingView?.completed)
                _activePlayer.setCurrentTime(existingView.progress_seconds);
        });

        _activePlayer.on('timeupdate', async ({ seconds, duration }) => {
            const now = Date.now();
            if (now - _lastUpsertTime < 10000) return;
            _lastUpsertTime = now;
            await upsertReplayProgress(_activeReplayId, uid, Math.floor(seconds),
                duration > 0 && seconds / duration >= 0.9);
        });

        _activePlayer.on('ended', async () => {
            const dur = await _activePlayer.getDuration();
            await upsertReplayProgress(_activeReplayId, uid, Math.floor(dur), true);
        });
    }

    async function closeReplayPlayer() {
        if (_activePlayer && _activeReplayId) {
            const uid      = (await supabase.auth.getUser()).data?.user?.id;
            const seconds  = await _activePlayer.getCurrentTime().catch(() => 0);
            const duration = await _activePlayer.getDuration().catch(() => 0);
            await upsertReplayProgress(_activeReplayId, uid, Math.floor(seconds),
                duration > 0 && seconds / duration >= 0.9);
            _activePlayer.destroy();
            _activePlayer   = null;
            _activeReplayId = null;
        }
        const slotEl = document.getElementById('replayPlayerIframeSlot');
        if (slotEl) slotEl.innerHTML = '';
        document.getElementById('replayPlayerModal')?.classList.add('hidden');
    }

    // ===== TRACKING =====

    async function upsertReplayProgress(replayId, userId, progressSeconds, completed) {
        if (!userId) return;
        await supabase.from('replay_views').upsert({
            replay_id:        replayId,
            user_id:          userId,
            progress_seconds: progressSeconds,
            completed,
            last_watched_at:  new Date().toISOString(),
        }, { onConflict: 'replay_id,user_id' });
    }

    // ===== UTILITAIRES =====

    function escHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    // ===== EXPORTS =====

    window.loadStudentReplays      = loadStudentReplays;
    window.changeReplayMonth       = changeReplayMonth;
    window.renderReplayCalendar    = renderReplayCalendar;
    window.openReplayDayModal      = openReplayDayModal;
    window.closeReplayDayModal     = closeReplayDayModal;
    window.openReplayPlayer        = openReplayPlayer;
    window.closeReplayPlayer       = closeReplayPlayer;
    window.updateReplayStatsHeader = updateReplayStatsHeader;
    window.updateReplayWeekSummary = updateReplayWeekSummary;

    console.log('[REPLAYS-STUDENT] ✅ Module chargé.');
})();
