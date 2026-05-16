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

    async function renderReplayCalendar(year, month) {
        const label = document.getElementById('replayCurrentMonthLabel');
        const grid  = document.getElementById('replayCalendarGrid');
        if (!grid) return;

        if (label) label.textContent = `${MONTHS_FR[month]} ${year}`;
        grid.innerHTML = '<p class="col-span-7 text-center text-gray-500 py-4">Chargement...</p>';

        const firstDay = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const lastDay  = new Date(year, month + 1, 0).toISOString().slice(0, 10);

        const { data: replays, error: errReplays } = await supabase
            .from('replays')
            .select('id, title, replay_date, youtube_video_id')
            .gte('replay_date', firstDay)
            .lte('replay_date', lastDay)
            .order('replay_date', { ascending: true });

        if (errReplays) {
            console.error('[REPLAYS-STUDENT] renderReplayCalendar error:', errReplays?.message || errReplays?.code, errReplays);
            grid.innerHTML = '<p class="col-span-7 text-center text-gray-400 py-4">Aucun replay disponible ce mois-ci.</p>';
            return;
        }

        let viewsByReplayId = {};
        if (replays && replays.length > 0) {
            const ids = replays.map(r => r.id);
            const { data: views, error: errViews } = await supabase
                .from('replay_views')
                .select('replay_id, completed, progress_seconds')
                .in('replay_id', ids);

            if (!errViews && views) {
                views.forEach(v => { viewsByReplayId[v.replay_id] = v; });
            }
        }

        // Groupe replays par date ISO "YYYY-MM-DD"
        const byDate = {};
        (replays || []).forEach(r => {
            if (!byDate[r.replay_date]) byDate[r.replay_date] = [];
            byDate[r.replay_date].push({ ...r, view: viewsByReplayId[r.id] || null });
        });

        const today     = new Date();
        const todayStr  = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        const startDate = new Date(year, month, 1);
        startDate.setDate(1 - startDate.getDay()); // recule au dimanche de la semaine du 1er

        let html = '';

        for (let i = 0; i < 42; i++) {
            const cell          = new Date(startDate);
            cell.setDate(startDate.getDate() + i);
            const isCurrentMonth = cell.getMonth() === month && cell.getFullYear() === year;
            const dy            = cell.getDate();
            const dateStr       = `${cell.getFullYear()}-${String(cell.getMonth() + 1).padStart(2, '0')}-${String(dy).padStart(2, '0')}`;
            const dayItems      = isCurrentMonth ? (byDate[dateStr] || []) : [];
            const hasItems      = dayItems.length > 0;
            const isToday       = dateStr === todayStr;
            const todayRing     = isToday ? ' ring-2 ring-amber-500' : '';

            if (!isCurrentMonth) {
                html += `<div class="text-center py-3 rounded text-gray-300"><div class="font-semibold">${dy}</div></div>`;
            } else if (hasItems) {
                const count = dayItems.length;
                html += `
                <div onclick="openReplayDayModal('${dateStr}')"
                    class="text-center py-3 cursor-pointer rounded transition-all bg-amber-100 text-amber-800 hover:bg-amber-200${todayRing}">
                    <div class="font-semibold">${dy}</div>
                    <div class="text-xl font-bold">${count}</div>
                    <div class="text-xs opacity-75">${count === 1 ? 'replay' : 'replays'}</div>
                </div>`;
            } else {
                const todayRingEmpty = isToday ? ' ring-2 ring-blue-300' : '';
                html += `
                <div class="text-center py-3 rounded text-gray-700 hover:bg-gray-100${todayRingEmpty}">
                    <div class="font-semibold">${dy}</div>
                </div>`;
            }
        }

        grid.innerHTML = html;
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
            .select('id, title, youtube_video_id')
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

    function openReplayPlayer(replayId) {
        alert('Player vidéo — À venir Phase 5');
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

    window.loadStudentReplays  = loadStudentReplays;
    window.changeReplayMonth   = changeReplayMonth;
    window.renderReplayCalendar = renderReplayCalendar;
    window.openReplayDayModal  = openReplayDayModal;
    window.closeReplayDayModal = closeReplayDayModal;
    window.openReplayPlayer    = openReplayPlayer;

    console.log('[REPLAYS-STUDENT] ✅ Module chargé.');
})();
