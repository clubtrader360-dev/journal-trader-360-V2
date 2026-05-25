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
        const urlInput = document.getElementById('replayVimeoUrl');
        const feedback = document.getElementById('replayAddFeedback');
        if (!urlInput) return;

        const rawUrl = urlInput.value.trim();
        if (!rawUrl) {
            clearReplayPreview();
            return;
        }

        const parsed = extractVimeoIdAndHash(rawUrl);
        if (!parsed) {
            showFeedback(feedback, 'error', 'URL Vimeo invalide. Exemple : https://vimeo.com/123456789');
            return;
        }

        showFeedback(feedback, 'info', 'Récupération des infos Vimeo...');

        try {
            const meta = await window.getVimeoMetadata(parsed.id, parsed.hash);
            fillReplayFormFromMeta(meta);
            showFeedback(feedback, 'success', `Infos récupérées : "${meta.title || '(sans titre)'}"`);
        } catch (e) {
            console.error('[REPLAYS] getVimeoMetadata error:', e);
            const msg = e.status === 404 ? 'Vidéo introuvable sur Vimeo.'
                      : e.status === 403 ? 'Accès refusé (réservé aux coachs).'
                      : e.status === 502 ? 'Erreur Vimeo. Réessaye dans un instant.'
                      : 'Impossible de récupérer les infos — vérifie l\'URL.';
            showFeedback(feedback, 'error', msg);
        }
    }

    function fillReplayFormFromMeta({ video_id, hash, title, duration, thumbnail }) {
        const url = hash ? `https://vimeo.com/${video_id}/${hash}` : `https://vimeo.com/${video_id}`;
        const urlInput   = document.getElementById('replayVimeoUrl');
        const titleInput = document.getElementById('replayTitle');
        if (urlInput) urlInput.value = url;
        if (titleInput && title) titleInput.value = title;

        window._replayAddThumb    = thumbnail || null;
        window._replayAddDuration = (typeof duration === 'number' && duration > 0) ? duration : null;

        const box = document.getElementById('replayPreview');
        const img = document.getElementById('replayPreviewThumb');
        const ttl = document.getElementById('replayPreviewTitle');
        const dur = document.getElementById('replayPreviewDuration');
        if (!box || !img || !ttl || !dur) return;

        img.src = thumbnail || '';
        img.style.display = thumbnail ? '' : 'none';
        ttl.textContent = title || '';
        dur.textContent = window._replayAddDuration ? `Durée : ${formatDuration(window._replayAddDuration)}` : '';
        box.classList.remove('hidden');
    }

    function clearReplayPreview() {
        document.getElementById('replayPreview')?.classList.add('hidden');
        window._replayAddThumb    = null;
        window._replayAddDuration = null;
    }

    function formatDuration(seconds) {
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        return `${m}:${String(s).padStart(2, '0')}`;
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
            vimeo_video_id:   parsed.id,
            vimeo_hash:       parsed.hash || null,
            thumbnail_url:    window._replayAddThumb || null,
            duration_seconds: window._replayAddDuration || null,
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
        clearReplayPreview();
        document.getElementById('replayVimeoUrl').value = '';
        document.getElementById('replayTitle').value = '';
        document.getElementById('replayDescription').value = '';
        document.getElementById('replayDate').value = '';
    }

    // ===== BROWSE BIBLIOTHÈQUE VIMEO (dossier REPLAY LIVE) =====

    let _vimeoBrowseState = { page: 1, hasNext: false };
    const _vimeoBrowseCache = {};

    async function openVimeoBrowseModal() {
        document.getElementById('replayBrowseModal')?.classList.remove('hidden');
        _vimeoBrowseState = { page: 1, hasNext: false };
        await loadVimeoBrowsePage();
    }

    function closeVimeoBrowseModal() {
        document.getElementById('replayBrowseModal')?.classList.add('hidden');
    }

    async function changeVimeoBrowsePage(delta) {
        const next = _vimeoBrowseState.page + delta;
        if (next < 1) return;
        if (delta > 0 && !_vimeoBrowseState.hasNext) return;
        _vimeoBrowseState.page = next;
        await loadVimeoBrowsePage();
    }

    async function loadVimeoBrowsePage() {
        const list      = document.getElementById('replayBrowseList');
        const pageLabel = document.getElementById('replayBrowsePageLabel');
        const prevBtn   = document.getElementById('replayBrowsePrev');
        const nextBtn   = document.getElementById('replayBrowseNext');
        if (!list) return;

        list.innerHTML = '<p class="text-gray-500 text-center py-4">Chargement...</p>';
        if (pageLabel) pageLabel.textContent = `Page ${_vimeoBrowseState.page}`;

        try {
            const { videos, has_next_page } = await window.listVimeoVideos(_vimeoBrowseState.page);
            _vimeoBrowseState.hasNext = !!has_next_page;
            if (prevBtn) { prevBtn.disabled = _vimeoBrowseState.page <= 1; prevBtn.classList.toggle('opacity-40', prevBtn.disabled); }
            if (nextBtn) { nextBtn.disabled = !_vimeoBrowseState.hasNext;  nextBtn.classList.toggle('opacity-40', nextBtn.disabled); }

            if (!videos || videos.length === 0) {
                list.innerHTML = '<p class="text-gray-500 text-center py-4">Aucune vidéo dans le dossier REPLAY LIVE.</p>';
                return;
            }

            videos.forEach(v => { _vimeoBrowseCache[v.video_id] = v; });
            list.innerHTML = `<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">${videos.map(renderVimeoBrowseCard).join('')}</div>`;
        } catch (e) {
            console.error('[REPLAYS] listVimeoVideos error:', e);
            const msg = e.status === 404 ? 'Dossier REPLAY LIVE introuvable sur le compte Vimeo.'
                      : e.status === 403 ? 'Accès refusé (réservé aux coachs).'
                      : 'Erreur de chargement de la bibliothèque Vimeo.';
            list.innerHTML = `<p class="text-red-600 text-center py-4">${escHtml(msg)}</p>`;
        }
    }

    function renderVimeoBrowseCard(v) {
        const dur   = (typeof v.duration === 'number' && v.duration > 0) ? formatDuration(v.duration) : '';
        const thumb = v.thumbnail || '';
        return `
        <div onclick="pickVimeoVideo('${v.video_id}')"
             class="cursor-pointer border border-gray-200 rounded overflow-hidden hover:border-blue-500 hover:shadow transition">
            <div class="aspect-video bg-gray-100">
                ${thumb ? `<img src="${thumb}" class="w-full h-full object-cover" loading="lazy" />` : ''}
            </div>
            <div class="p-3">
                <p class="text-sm font-medium text-gray-900 line-clamp-2">${escHtml(v.title)}</p>
                ${dur ? `<p class="text-xs text-gray-500 mt-1">${dur}</p>` : ''}
            </div>
        </div>`;
    }

    function pickVimeoVideo(videoId) {
        const v = _vimeoBrowseCache[videoId];
        if (!v) return;
        fillReplayFormFromMeta(v);
        closeVimeoBrowseModal();
        showFeedback(document.getElementById('replayAddFeedback'), 'success', `Vidéo sélectionnée : "${v.title || '(sans titre)'}"`);
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
    window.openVimeoBrowseModal  = openVimeoBrowseModal;
    window.closeVimeoBrowseModal = closeVimeoBrowseModal;
    window.changeVimeoBrowsePage = changeVimeoBrowsePage;
    window.pickVimeoVideo        = pickVimeoVideo;

    console.log('[REPLAYS] ✅ Module chargé.');
})();
