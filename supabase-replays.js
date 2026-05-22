/**
 * =================================================================
 * JOURNAL TRADER 360 - REPLAYS MODULE (#42)
 * Version: 1.0.0
 * Description: Gestion des replays côté coach (bibliothèque, ajout, stats)
 * =================================================================
 */

(() => {
    console.log('[REPLAYS] Chargement supabase-replays.js...');

    const supabase = window.supabaseClient || window.supabase;

    if (!supabase) {
        console.error('[REPLAYS] ❌ window.supabaseClient manquant');
        throw new Error('supabaseClient manquant');
    }

    const TAB_MAP = {
        library: { panel: 'coachReplaysPanelLibrary', btn: 'coachReplaysTabLib' },
        add:     { panel: 'coachReplaysPanelAdd',     btn: 'coachReplaysTabAdd' },
        stats:   { panel: 'coachReplaysPanelStats',   btn: 'coachReplaysTabStats' },
    };

    // ===== CHARGEMENT PRINCIPAL =====

    async function loadCoachReplays() {
        switchReplayTab('library');
    }

    // ===== TABS =====

    function switchReplayTab(tab) {
        Object.entries(TAB_MAP).forEach(([key, { panel, btn }]) => {
            const panelEl = document.getElementById(panel);
            const btnEl   = document.getElementById(btn);
            if (!panelEl || !btnEl) return;
            if (key === tab) {
                panelEl.classList.remove('hidden');
                btnEl.className = 'px-4 py-2 rounded font-semibold text-sm bg-blue-600 text-white';
            } else {
                panelEl.classList.add('hidden');
                btnEl.className = 'px-4 py-2 rounded font-semibold text-sm bg-white border border-gray-300 text-gray-700';
            }
        });

        if (tab === 'library') loadReplayLibrary();
        if (tab === 'stats')   loadReplayStats();
    }

    // ===== BIBLIOTHÈQUE =====

    async function loadReplayLibrary() {
        const container = document.getElementById('coachReplaysLibraryList');
        if (!container) return;
        container.innerHTML = '<p class="text-gray-500 text-center py-4">Chargement...</p>';

        const { data: replays, error } = await supabase
            .from('replays')
            .select('*')
            .order('replay_date', { ascending: false });

        if (error) {
            console.error('[REPLAYS] loadReplayLibrary error:', error);
            container.innerHTML = '<p class="text-red-500 text-center py-4">Erreur de chargement.</p>';
            return;
        }

        if (!replays || replays.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun replay pour l\'instant.</p>';
            return;
        }

        container.innerHTML = replays.map(r => renderReplayCard(r)).join('');
    }

    function renderReplayCard(r) {
        const thumb    = r.thumbnail_url || '';
        const date     = r.replay_date ? new Date(r.replay_date).toLocaleDateString('fr-FR') : '—';
        const desc     = r.description ? `<p class="text-sm text-gray-500 mt-1 line-clamp-2">${escHtml(r.description)}</p>` : '';
        const vimeoUrl = `https://vimeo.com/${r.vimeo_video_id}`;

        return `
        <div class="flex gap-4 py-4 border-b border-gray-100 last:border-0">
            <a href="${vimeoUrl}" target="_blank" rel="noopener noreferrer" class="flex-shrink-0">
                <img src="${thumb}" alt="${escHtml(r.title)}"
                    class="w-32 h-20 object-cover rounded bg-gray-100" loading="lazy"
                    onerror="this.style.display='none'" />
            </a>
            <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between gap-2">
                    <div class="min-w-0">
                        <a href="${vimeoUrl}" target="_blank" rel="noopener noreferrer"
                            class="font-semibold text-gray-900 hover:text-blue-600 line-clamp-2 block">
                            ${escHtml(r.title)}
                        </a>
                        <p class="text-xs text-gray-400 mt-0.5">${date}</p>
                        ${desc}
                    </div>
                    <div class="flex gap-2 flex-shrink-0 mt-0.5">
                        <button onclick="openEditReplayModal(${JSON.stringify(r).replace(/"/g, '&quot;')})"
                            class="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50">
                            Modifier
                        </button>
                        <button onclick="confirmDeleteReplay(${r.id}, '${escHtml(r.title).replace(/'/g, "\\'")}')"
                            class="px-3 py-1 text-xs border border-red-300 text-red-600 rounded hover:bg-red-50">
                            Supprimer
                        </button>
                    </div>
                </div>
            </div>
        </div>`;
    }

    // ===== MÉTADONNÉES VIMEO =====

    async function fetchVimeoMetadata() {
        const urlInput   = document.getElementById('replayVimeoUrl');
        const titleInput = document.getElementById('replayTitle');
        const feedback   = document.getElementById('replayAddFeedback');
        if (!urlInput) return;

        const rawUrl = urlInput.value.trim();
        if (!rawUrl) return;

        showFeedback(feedback, 'info', 'Récupération des infos Vimeo...');

        const parsed = extractVimeoIdAndHash(rawUrl);
        if (!parsed) {
            showFeedback(feedback, 'error', 'URL Vimeo invalide. Exemple : https://vimeo.com/123456789');
            return;
        }

        const vimeoUrl = parsed.hash
            ? `https://vimeo.com/${parsed.id}/${parsed.hash}`
            : `https://vimeo.com/${parsed.id}`;
        try {
            const res = await fetch(`https://vimeo.com/api/oembed.json?url=${encodeURIComponent(vimeoUrl)}`);
            if (res.ok) {
                const data = await res.json();
                if (data.title && titleInput) titleInput.value = data.title;
                window._replayAddThumb = data.thumbnail_url || null;
                showFeedback(feedback, 'success', `Titre récupéré : "${data.title}"`);
                return;
            }
        } catch (e) {
            console.warn('[REPLAYS] Vimeo oEmbed error:', e);
        }

        window._replayAddThumb = null;
        showFeedback(feedback, 'warning', 'Titre non récupéré — saisis-le manuellement puis valide.');
    }

    function extractVimeoIdAndHash(url) {
        const m = url.match(/vimeo\.com\/(\d+)(?:\/([a-zA-Z0-9]+))?/);
        if (m) return { id: m[1], hash: m[2] || null };
        const m2 = url.match(/player\.vimeo\.com\/video\/(\d+)/);
        if (m2) return { id: m2[1], hash: null };
        return null;
    }

    // ===== AJOUTER UN REPLAY =====

    async function submitAddReplay() {
        const feedback = document.getElementById('replayAddFeedback');
        const urlRaw   = (document.getElementById('replayVimeoUrl')?.value || '').trim();
        const title    = (document.getElementById('replayTitle')?.value || '').trim();
        const desc     = (document.getElementById('replayDescription')?.value || '').trim();
        const date     = (document.getElementById('replayDate')?.value || '').trim();

        if (!urlRaw || !title || !date) {
            showFeedback(feedback, 'error', 'URL Vimeo, titre et date sont obligatoires.');
            return;
        }

        const parsed = extractVimeoIdAndHash(urlRaw);
        if (!parsed) {
            showFeedback(feedback, 'error', 'URL Vimeo invalide. Exemple : https://vimeo.com/123456789');
            return;
        }

        showFeedback(feedback, 'info', 'Enregistrement...');

        const { error } = await supabase.from('replays').insert({
            vimeo_video_id: parsed.id,
            vimeo_hash:     parsed.hash || null,
            thumbnail_url:  window._replayAddThumb || null,
            title,
            description: desc || null,
            replay_date: date,
            created_by: (await supabase.auth.getUser()).data?.user?.id || null,
        });

        if (error) {
            console.error('[REPLAYS] submitAddReplay error:', error);
            showFeedback(feedback, 'error', 'Erreur lors de l\'enregistrement. Réessayez.');
            return;
        }

        showFeedback(feedback, 'success', 'Replay ajouté avec succès !');
        window._replayAddThumb = null;
        document.getElementById('replayVimeoUrl').value = '';
        document.getElementById('replayTitle').value = '';
        document.getElementById('replayDescription').value = '';
        document.getElementById('replayDate').value = '';
    }

    // ===== MODAL ÉDITION =====

    function openEditReplayModal(replay) {
        document.getElementById('replayEditId').value        = replay.id;
        document.getElementById('replayEditTitle').value     = replay.title || '';
        document.getElementById('replayEditDescription').value = replay.description || '';
        document.getElementById('replayEditDate').value      = replay.replay_date || '';
        const fb = document.getElementById('replayEditFeedback');
        if (fb) { fb.classList.add('hidden'); fb.textContent = ''; }
        document.getElementById('replayEditModal')?.classList.remove('hidden');
    }

    function closeReplayEditModal() {
        document.getElementById('replayEditModal')?.classList.add('hidden');
    }

    async function submitEditReplay() {
        const feedback = document.getElementById('replayEditFeedback');
        const id    = document.getElementById('replayEditId')?.value;
        const title = (document.getElementById('replayEditTitle')?.value || '').trim();
        const desc  = (document.getElementById('replayEditDescription')?.value || '').trim();
        const date  = (document.getElementById('replayEditDate')?.value || '').trim();

        if (!title || !date) {
            showFeedback(feedback, 'error', 'Titre et date sont obligatoires.');
            return;
        }

        showFeedback(feedback, 'info', 'Enregistrement...');

        const { error } = await supabase
            .from('replays')
            .update({ title, description: desc || null, replay_date: date, updated_at: new Date().toISOString() })
            .eq('id', id);

        if (error) {
            console.error('[REPLAYS] submitEditReplay error:', error);
            showFeedback(feedback, 'error', 'Erreur lors de la modification.');
            return;
        }

        closeReplayEditModal();
        loadReplayLibrary();
    }

    // ===== SUPPRESSION =====

    async function confirmDeleteReplay(id, title) {
        if (!confirm(`Supprimer le replay "${title}" ? Cette action est irréversible.`)) return;

        const { error } = await supabase.from('replays').delete().eq('id', id);

        if (error) {
            console.error('[REPLAYS] confirmDeleteReplay error:', error);
            alert('Erreur lors de la suppression.');
            return;
        }

        loadReplayLibrary();
    }

    // ===== STATISTIQUES =====

    async function loadReplayStats() {
        const container = document.getElementById('coachReplaysStatsContent');
        if (!container) return;
        container.innerHTML = '<p class="text-gray-500 text-center py-4">Chargement...</p>';

        const { data: replays, error: errReplays } = await supabase
            .from('replays')
            .select('id, title, replay_date')
            .order('replay_date', { ascending: false });

        if (errReplays || !replays || replays.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun replay disponible.</p>';
            return;
        }

        const { data: views, error: errViews } = await supabase
            .from('replay_views')
            .select('replay_id, completed');

        if (errViews) {
            console.error('[REPLAYS] loadReplayStats views error:', errViews);
            container.innerHTML = '<p class="text-red-500 text-center py-4">Erreur de chargement des stats.</p>';
            return;
        }

        const viewMap = {};
        (views || []).forEach(v => {
            if (!viewMap[v.replay_id]) viewMap[v.replay_id] = { total: 0, completed: 0 };
            viewMap[v.replay_id].total++;
            if (v.completed) viewMap[v.replay_id].completed++;
        });

        const rows = replays.map(r => {
            const s = viewMap[r.id] || { total: 0, completed: 0 };
            const date = r.replay_date ? new Date(r.replay_date).toLocaleDateString('fr-FR') : '—';
            return `
            <tr class="border-b border-gray-100 hover:bg-gray-50">
                <td class="py-3 pr-4 text-sm font-medium text-gray-900">${escHtml(r.title)}</td>
                <td class="py-3 pr-4 text-sm text-gray-500 whitespace-nowrap">${date}</td>
                <td class="py-3 pr-4 text-sm text-center">${s.total}</td>
                <td class="py-3 text-sm text-center">${s.completed}</td>
            </tr>`;
        }).join('');

        container.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-left">
                <thead>
                    <tr class="border-b border-gray-200">
                        <th class="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide">Replay</th>
                        <th class="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">Date</th>
                        <th class="pb-3 pr-4 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Vus</th>
                        <th class="pb-3 text-xs font-semibold text-gray-500 uppercase tracking-wide text-center">Terminés</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        </div>`;
    }

    // ===== UTILITAIRES =====

    function escHtml(str) {
        return String(str ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function showFeedback(el, type, msg) {
        if (!el) return;
        el.classList.remove('hidden', 'text-green-700', 'bg-green-50', 'text-red-700', 'bg-red-50',
                            'text-blue-700', 'bg-blue-50', 'text-yellow-700', 'bg-yellow-50');
        const styles = {
            success: 'text-green-700 bg-green-50',
            error:   'text-red-700 bg-red-50',
            info:    'text-blue-700 bg-blue-50',
            warning: 'text-yellow-700 bg-yellow-50',
        };
        el.className = `text-sm py-2 px-3 rounded ${styles[type] || styles.info}`;
        el.textContent = msg;
    }

    // ===== EXPORTS =====

    window.loadCoachReplays      = loadCoachReplays;
    window.switchReplayTab       = switchReplayTab;
    window.loadReplayLibrary     = loadReplayLibrary;
    window.loadReplayStats       = loadReplayStats;
    window.fetchVimeoMetadata    = fetchVimeoMetadata;
    window.submitAddReplay       = submitAddReplay;
    window.openEditReplayModal   = openEditReplayModal;
    window.closeReplayEditModal  = closeReplayEditModal;
    window.submitEditReplay      = submitEditReplay;
    window.confirmDeleteReplay   = confirmDeleteReplay;

    console.log('[REPLAYS] ✅ Module chargé.');
})();
