/**
 * =================================================================
 * JOURNAL TRADER 360 - JOURNAL MODULE
 * Version: FINALE PRO - IIFE isolée
 * Convention: TOUJOURS utiliser user_id = currentUser.uuid
 * =================================================================
 */

(() => {
    console.log('[REGISTER] Chargement supabase-journal.js...');
    
    // Récupérer le client Supabase depuis window.supabaseClient (créé par config.js)
    const supabase = window.supabaseClient || window.supabase;
    
    if (!supabase) {
        console.error('[ERROR] window.supabaseClient manquant (config non chargée ?)');
        throw new Error('supabaseClient manquant');
    }

    // ===== FONCTION AJOUT/MODIFICATION NOTE =====
    async function addNote() {
        console.log('[JOURNAL] addNote() - START');
        
        // Vérification utilisateur
        if (!window.currentUser || !window.currentUser.uuid) {
            console.error('[JOURNAL] ❌ Utilisateur non connecté');
            alert('❌ Vous devez être connecté pour ajouter une note.');
            return { data: null, error: 'User not logged in' };
        }
        
        // Vérifier si on est en mode édition
        const modal = document.getElementById('addNoteModal');
        const editingIdRaw = modal?.dataset.editingId;
        const editingId = editingIdRaw ? parseInt(editingIdRaw, 10) : null;
        const isEditing = editingId && !isNaN(editingId);
        
        console.log('[JOURNAL] Mode:', isEditing ? 'ÉDITION' : 'AJOUT', 'ID (brut):', editingIdRaw, 'ID (converti):', editingId);
        
        // Récupération des données du formulaire
        const noteDate = document.getElementById('noteDate')?.value;
        const noteText = document.getElementById('noteText')?.value;
        const emotionBefore = document.getElementById('emotionBefore')?.value;
        const emotionAfter = document.getElementById('emotionAfter')?.value;
        const sessionRating = document.getElementById('sessionRating')?.value;
        const imageFile = document.getElementById('noteImage')?.files[0];
        const imageFile2 = document.getElementById('noteImage2')?.files[0];
        const noTradeToday = document.getElementById('noTradeToday')?.checked || false;
        
        // ✅ NOUVEAUX CHAMPS : Points positifs & Erreurs
        const selectedPositives = Array.from(
            document.querySelectorAll('.positive-checkbox:checked')
        ).map(cb => cb.value);
        
        const selectedErrors = Array.from(
            document.querySelectorAll('.error-checkbox:checked')
        ).map(cb => cb.value);
        
        // Validation
        if (!noteDate || !noteText) {
            console.error('[JOURNAL] ❌ Champs obligatoires manquants');
            alert('⚠️ Veuillez remplir la date et le texte de la note.');
            return { data: null, error: 'Missing required fields' };
        }
        
        console.log('[JOURNAL] Données collectées:', { 
            noteDate, 
            noteText, 
            emotionBefore, 
            emotionAfter, 
            sessionRating, 
            hasImage: !!imageFile, 
            hasImage2: !!imageFile2, 
            noTradeToday,
            positivePoints: selectedPositives.length,
            errors: selectedErrors.length
        });
        
        // Upload de l'image si présente
        let imageUrl = null;
        let imageUrl2 = null;
        
        // ✅ Si on est en mode édition, charger l'ancienne image
        if (isEditing) {
            console.log('[JOURNAL] 🔍 Mode édition - Chargement de l\'ancienne image...');
            try {
                const { data: oldEntry, error: loadError } = await supabase
                    .from('journal_entries')
                    .select('image_url, image_url_2')
                    .eq('id', editingId)
                    .eq('user_id', window.currentUser.uuid)
                    .single();
                
                if (!loadError && oldEntry) {
                    imageUrl = oldEntry.image_url;
                    // ✅ image_url_2 peut ne pas exister si la colonne n'est pas encore créée
                    imageUrl2 = oldEntry.image_url_2 || null;
                    console.log('[JOURNAL] ✅ Anciennes images chargées:', imageUrl, imageUrl2);
                } else {
                    // ⚠️ Si l'erreur est liée à image_url_2 manquante, on l'ignore
                    if (loadError && loadError.message && loadError.message.includes('image_url_2')) {
                        console.warn('[JOURNAL] ⚠️ Colonne image_url_2 non disponible (ignorée)');
                        // Réessayer sans image_url_2
                        const { data: oldEntry2, error: loadError2 } = await supabase
                            .from('journal_entries')
                            .select('image_url')
                            .eq('id', editingId)
                            .eq('user_id', window.currentUser.uuid)
                            .single();
                        
                        if (!loadError2 && oldEntry2) {
                            imageUrl = oldEntry2.image_url;
                            console.log('[JOURNAL] ✅ Ancienne image chargée (sans image_url_2):', imageUrl);
                        }
                    } else {
                        console.warn('[JOURNAL] ⚠️ Impossible de charger l\'ancienne image:', loadError);
                    }
                }
            } catch (err) {
                console.error('[JOURNAL] ❌ Exception chargement ancienne image:', err);
            }
        }
        
        // ✅ Si une nouvelle image est uploadée, elle remplace l'ancienne
        if (imageFile) {
            console.log('[JOURNAL] 📤 Upload de l\'image:', imageFile.name);
            
            try {
                // Créer un nom de fichier unique
                const fileExt = imageFile.name.split('.').pop();
                const fileName = `${window.currentUser.uuid}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
                
                console.log('[JOURNAL] Nom du fichier:', fileName);
                
                // Upload vers Supabase Storage
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('journal-images') // Nom du bucket (à créer dans Supabase)
                    .upload(fileName, imageFile, {
                        cacheControl: '3600',
                        upsert: false
                    });
                
                if (uploadError) {
                    console.error('[JOURNAL] ❌ Erreur upload image:', uploadError);
                    alert('⚠️ Erreur lors de l\'upload de l\'image. La note sera enregistrée sans image.');
                } else {
                    console.log('[JOURNAL] ✅ Image uploadée:', uploadData);
                    
                    // Construire l'URL publique manuellement à partir de l'URL du client
                    const supabaseUrl = supabase.supabaseUrl || 'https://zgihbpgoorymomtsbxpz.supabase.co';
                    imageUrl = `${supabaseUrl}/storage/v1/object/public/journal-images/${fileName}`;
                    
                    console.log('[JOURNAL] 🔗 URL publique (manuelle):', imageUrl);
                }
            } catch (uploadErr) {
                console.error('[JOURNAL] ❌ Exception upload:', uploadErr);
                alert('⚠️ Erreur lors de l\'upload de l\'image. La note sera enregistrée sans image.');
            }
        }
        
        // ✅ Upload de la 2ème image si présente
        if (imageFile2) {
            console.log('[JOURNAL] 📤 Upload de la 2ème image:', imageFile2.name);
            
            try {
                // Créer un nom de fichier unique
                const fileExt2 = imageFile2.name.split('.').pop();
                const fileName2 = `${window.currentUser.uuid}/${Date.now()}_${Math.random().toString(36).substring(7)}_2.${fileExt2}`;
                
                console.log('[JOURNAL] Nom du fichier 2:', fileName2);
                
                // Upload vers Supabase Storage
                const { data: uploadData2, error: uploadError2 } = await supabase.storage
                    .from('journal-images') // Nom du bucket (à créer dans Supabase)
                    .upload(fileName2, imageFile2, {
                        cacheControl: '3600',
                        upsert: false
                    });
                
                if (uploadError2) {
                    console.error('[JOURNAL] ❌ Erreur upload image 2:', uploadError2);
                    alert('⚠️ Erreur lors de l\'upload de la 2ème image. La note sera enregistrée sans cette image.');
                } else {
                    console.log('[JOURNAL] ✅ Image 2 uploadée:', uploadData2);
                    
                    // Construire l'URL publique manuellement à partir de l'URL du client
                    const supabaseUrl = supabase.supabaseUrl || 'https://zgihbpgoorymomtsbxpz.supabase.co';
                    imageUrl2 = `${supabaseUrl}/storage/v1/object/public/journal-images/${fileName2}`;
                    
                    console.log('[JOURNAL] 🔗 URL publique 2 (manuelle):', imageUrl2);
                }
            } catch (uploadErr2) {
                console.error('[JOURNAL] ❌ Exception upload 2:', uploadErr2);
                alert('⚠️ Erreur lors de l\'upload de la 2ème image. La note sera enregistrée sans cette image.');
            }
        }
        
        // Construction du payload
        const noteData = {
            user_id: window.currentUser.uuid,
            entry_date: noteDate,
            content: noteText.trim(),
            emotion_before: emotionBefore || null,
            emotion_after: emotionAfter || null,
            session_rating: sessionRating ? parseInt(sessionRating) : null,
            image_url: imageUrl,
            no_trade: noTradeToday,
            positive_points: selectedPositives,  // ✅ NOUVEAU
            errors_committed: selectedErrors     // ✅ NOUVEAU
        };
        
        // ✅ Ajouter image_url_2 UNIQUEMENT si elle existe (pour compatibilité)
        if (imageUrl2) {
            noteData.image_url_2 = imageUrl2;
        }
        
        console.log('[JOURNAL] Payload final:', noteData);
        
        try {
            let data, error;
            
            if (isEditing) {
                // MODE ÉDITION : Update
                console.log('[JOURNAL] 🔄 Mise à jour de l\'entrée ID:', editingId);
                
                const result = await supabase
                    .from('journal_entries')
                    .update(noteData)
                    .eq('id', editingId)
                    .eq('user_id', window.currentUser.uuid)
                    .select('*')
                    .single();
                
                data = result.data;
                error = result.error;
                
                if (!error) {
                    alert('✅ Note modifiée avec succès !');
                }
            } else {
                // MODE AJOUT : Insert
                console.log('[JOURNAL] ➕ Ajout d\'une nouvelle entrée');
                
                const result = await supabase
                    .from('journal_entries')
                    .insert([noteData])
                    .select('*')
                    .single();
                
                data = result.data;
                error = result.error;
                
                if (!error) {
                    alert('✅ Note ajoutée avec succès !');
                }
            }
            
            if (error) {
                console.error('[JOURNAL] ❌ Erreur:', error);
                alert(`❌ Erreur : ${error.message}`);
                return { data: null, error };
            }
            
            console.log('[JOURNAL] ✅ Opération réussie:', data);

            // #48 : rafraîchir les alertes d'erreurs redondantes (l'élève vient peut-être de cocher une erreur)
            if (typeof window.loadRedundantErrors === 'function') window.loadRedundantErrors();

            // Fermer la modale et réinitialiser
            if (modal) {
                modal.style.display = 'none';
                delete modal.dataset.editingId; // Nettoyer le mode édition
            }
            
            const form = document.getElementById('noteForm');
            if (form) {
                form.reset();
            }
            
            // ✅ NOUVEAU : Réinitialiser les checkboxes points positifs & erreurs
            document.querySelectorAll('.positive-checkbox').forEach(cb => cb.checked = false);
            document.querySelectorAll('.error-checkbox').forEach(cb => cb.checked = false);
            if (window.updatePositiveCount) window.updatePositiveCount();
            if (window.updateErrorsCount) window.updateErrorsCount();
            console.log('[JOURNAL] ✅ Checkboxes réinitialisées');
            
            // Réinitialiser l'aperçu de l'image
            const imagePreview = document.getElementById('imagePreview');
            if (imagePreview) {
                imagePreview.classList.add('hidden');
            }
            
            const imagePreview2 = document.getElementById('imagePreview2');
            if (imagePreview2) {
                imagePreview2.classList.add('hidden');
            }
            
            // Réinitialiser les étoiles
            document.querySelectorAll('.star-rating').forEach(star => {
                star.style.opacity = '0.3';
                star.style.color = '#ccc';
            });
            
            // Réinitialiser le texte du bouton
            const submitBtn = modal?.querySelector('.trader-btn');
            if (submitBtn) {
                submitBtn.textContent = 'Ajouter la Note';
            }
            
            // Rafraîchir l'affichage
            await loadJournalEntries();
            
            // ✅ Rafraîchir le calendrier pour afficher les jours "no trade"
            if (window.updateCalendar) {
                window.updateCalendar();
            }
            
            return { data, error: null };
        } catch (err) {
            console.error('[JOURNAL] ❌ Exception addNote:', err);
            alert(`❌ Erreur critique : ${err.message}`);
            return { data: null, error: err };
        }
    }
    
    // ===== FONCTION AJOUT ENTRÉE JOURNAL (ANCIENNE - RÉTRO-COMPATIBILITÉ) =====
    async function addJournalEntry() {
        console.log('[JOURNAL] addJournalEntry() - DEPRECATED - Utiliser addNote()');
        return await addNote();
    }

    // ===== FONCTION CHARGEMENT ENTRÉES JOURNAL =====
    async function loadJournalEntries() {
        console.log('[JOURNAL] loadJournalEntries() - START');
        
        if (!window.currentUser || !window.currentUser.uuid) {
            console.warn('[JOURNAL] ⚠️ Utilisateur non connecté. Aucune entrée à charger.');
            return { data: [], error: null };
        }

        console.log('[JOURNAL] Chargement des entrées pour UUID:', window.currentUser.uuid);

        try {
            const { data, error } = await supabase
                .from('journal_entries')
                .select('*')
                .eq('user_id', window.currentUser.uuid)
                .order('entry_date', { ascending: false });

            if (error) {
                console.error('[JOURNAL] ❌ Erreur chargement:', error);
                return { data: [], error };
            }

            console.log(`[JOURNAL] ✅ ${data.length} entrée(s) chargée(s)`);
            
            // ✅ Stocker dans window.journalEntries pour le calendrier
            window.journalEntries = data;
            
            // Afficher les entrées dans le DOM
            displayJournalEntries(data);
            
            return { data, error: null };
        } catch (err) {
            console.error('[JOURNAL] ❌ Exception loadJournalEntries:', err);
            return { data: [], error: err };
        }
    }

    // ===== FONCTION AFFICHAGE ENTRÉES JOURNAL =====
    function displayJournalEntries(entries) {
        const container = document.getElementById('journalEntries');
        
        if (!container) {
            console.warn('[JOURNAL] ⚠️ Container #journalEntries introuvable');
            return;
        }

        if (!entries || entries.length === 0) {
            container.innerHTML = '<p class="text-gray-500 text-center py-8">Aucune note ajoutée. Commencez par ajouter une entrée.</p>';
            return;
        }

        container.innerHTML = entries.map(entry => {
            const stars = '⭐'.repeat(entry.session_rating || 0);
            const hasEmotions = entry.emotion_before || entry.emotion_after;
            
            // Badge "Pas de trade" si no_trade est vrai
            const noTradeBadge = entry.no_trade ? `
                <span class="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 text-xs font-medium rounded-full border border-gray-300">
                    🚫 Pas de trade
                </span>
            ` : '';
            
            // DEBUG : Log pour chaque entrée
            console.log('[JOURNAL] 🖼️ Affichage note ID:', entry.id, 'Image URL:', entry.image_url, 'No Trade:', entry.no_trade);
            
            // ✅ NOUVEAU : Récupérer les trades de la même date
            const dayTrades = window.trades ? window.trades.filter(trade => trade.date === entry.entry_date) : [];
            console.log(`[JOURNAL] 📊 Trades du ${entry.entry_date}:`, dayTrades.length);
            
            // Générer le HTML des trades si présents
            let tradesHtml = '';
            if (dayTrades.length > 0) {
                const totalPnl = dayTrades.reduce((sum, t) => sum + (t.pnl || 0), 0);
                const totalPnlClass = totalPnl >= 0 ? 'text-green-600' : 'text-red-600';
                
                tradesHtml = `
                    <div class="mt-4 pt-4 border-t border-gray-200">
                        <div class="flex justify-between items-center mb-2">
                            <h5 class="text-sm font-semibold text-gray-700">
                                📊 Trades du jour (${dayTrades.length})
                            </h5>
                            <span class="text-sm font-bold ${totalPnlClass}">
                                ${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)} $
                            </span>
                        </div>
                        <div class="overflow-x-auto">
                            <table class="w-full text-xs">
                                <thead class="bg-gray-50">
                                    <tr>
                                        <th class="px-2 py-1 text-left text-gray-500">Heure</th>
                                        <th class="px-2 py-1 text-left text-gray-500">Type</th>
                                        <th class="px-2 py-1 text-left text-gray-500">Symbole</th>
                                        <th class="px-2 py-1 text-right text-gray-500">Entrée</th>
                                        <th class="px-2 py-1 text-right text-gray-500">Sortie</th>
                                        <th class="px-2 py-1 text-center text-gray-500">Qty</th>
                                        <th class="px-2 py-1 text-right text-gray-500">P&L</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${dayTrades.map(trade => {
                                        const pnlClass = trade.pnl >= 0 ? 'text-green-600' : 'text-red-600';
                                        const typeClass = trade.type && trade.type.toUpperCase().includes('LONG') ? 'text-blue-600' : 'text-orange-600';
                                        return `
                                            <tr class="border-b border-gray-100 hover:bg-gray-50">
                                                <td class="px-2 py-1">${window.escapeHtml(trade.entryTime || '-')}</td>
                                                <td class="px-2 py-1 ${typeClass} font-medium">${window.escapeHtml(trade.type || '-')}</td>
                                                <td class="px-2 py-1 font-medium">${window.escapeHtml(trade.symbol)}</td>
                                                <td class="px-2 py-1 text-right">${window.escapeHtml(trade.entryPrice)}</td>
                                                <td class="px-2 py-1 text-right">${window.escapeHtml(trade.exitPrice)}</td>
                                                <td class="px-2 py-1 text-center">${window.escapeHtml(trade.quantity)}</td>
                                                <td class="px-2 py-1 text-right font-semibold ${pnlClass}">
                                                    ${trade.pnl >= 0 ? '+' : ''}${trade.pnl.toFixed(2)}$
                                                </td>
                                            </tr>
                                        `;
                                    }).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>
                `;
            }
            
            return `
                <div class="border-b pb-4 mb-4 last:border-b-0">
                    <div class="flex justify-between items-start mb-2">
                        <div class="flex-1">
                            <div class="flex items-center gap-3 mb-1">
                                <h4 class="font-semibold text-gray-800">${window.escapeHtml(entry.entry_date)}</h4>
                                ${noTradeBadge}
                            </div>
                            ${stars ? `<span class="text-sm text-gray-500">${stars}</span>` : ''}
                        </div>
                        <div class="flex gap-2">
                            <button class="btn-view-journal text-gray-700 hover:text-gray-900 px-2 py-1 rounded hover:bg-gray-50" title="Voir" data-entry-id="${window.escapeHtml(entry.id)}">
                                👁️
                            </button>
                            <button class="btn-edit-journal px-2 py-1 rounded hover:bg-blue-50" style="color: #000B25;" title="Modifier" data-entry-id="${window.escapeHtml(entry.id)}">
                                ✏️
                            </button>
                            <button class="btn-delete-journal text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50" title="Supprimer" data-entry-id="${window.escapeHtml(entry.id)}">
                                🗑️
                            </button>
                        </div>
                    </div>
                    ${hasEmotions ? `
                        <div class="text-sm text-gray-600 mb-2">
                            ${entry.emotion_before ? `Avant: ${window.escapeHtml(entry.emotion_before)}` : ''}
                            ${entry.emotion_before && entry.emotion_after ? ' | ' : ''}
                            ${entry.emotion_after ? `Après: ${window.escapeHtml(entry.emotion_after)}` : ''}
                        </div>
                    ` : ''}
                    <p class="text-gray-700 whitespace-pre-wrap">${window.escapeHtml(entry.content)}</p>
                    ${entry.image_url ? `
                        <div class="mt-3">
                            <img src="${window.escapeHtml(entry.image_url)}" alt="Note image" class="max-w-full h-48 object-contain border rounded" title="Image de la note" onerror="this.style.display='none'; console.error('[JOURNAL] Erreur chargement image principale')">
                        </div>
                    ` : ''}
                    ${entry.image_url_2 ? `
                        <div class="mt-3">
                            <img src="${window.escapeHtml(entry.image_url_2)}" alt="Note image 2" class="max-w-full h-48 object-contain border rounded" title="Image 2 de la note" onerror="this.style.display='none'; console.error('[JOURNAL] Erreur chargement image secondaire')">
                        </div>
                    ` : ''}
                    ${tradesHtml}
                </div>
            `;
        }).join('');
        
        // Attacher les événements après le rendu HTML
        attachJournalEventListeners();
        
        // Mettre à jour les statistiques
        updateJournalStats(entries);
    }
    
    // ===== FONCTION ATTACHEMENT ÉVÉNEMENTS =====
    function attachJournalEventListeners() {
        console.log('[JOURNAL] Attachement des événements...');
        
        // Boutons Voir
        document.querySelectorAll('.btn-view-journal').forEach(btn => {
            btn.addEventListener('click', function() {
                const entryId = this.getAttribute('data-entry-id');
                console.log('[JOURNAL] Clic sur Voir, ID:', entryId);
                viewJournalEntry(entryId);
            });
        });
        
        // Boutons Modifier
        document.querySelectorAll('.btn-edit-journal').forEach(btn => {
            btn.addEventListener('click', function() {
                const entryId = this.getAttribute('data-entry-id');
                console.log('[JOURNAL] Clic sur Modifier, ID:', entryId);
                editJournalEntry(entryId);
            });
        });
        
        // Boutons Supprimer
        document.querySelectorAll('.btn-delete-journal').forEach(btn => {
            btn.addEventListener('click', function() {
                const entryId = this.getAttribute('data-entry-id');
                console.log('[JOURNAL] Clic sur Supprimer, ID:', entryId);
                deleteJournalEntry(entryId);
            });
        });
        
        console.log('[JOURNAL] ✅ Événements attachés');
    }
    
    // ===== FONCTION MISE À JOUR STATISTIQUES =====
    function updateJournalStats(entries) {
        const totalEntries = document.getElementById('totalEntries');
        const weeklyEntries = document.getElementById('weeklyEntries');
        const entriesWithImages = document.getElementById('entriesWithImages');
        
        if (totalEntries) {
            totalEntries.textContent = entries.length;
        }
        
        if (weeklyEntries) {
            const oneWeekAgo = new Date();
            oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
            const weeklyCount = entries.filter(e => new Date(e.entry_date) >= oneWeekAgo).length;
            weeklyEntries.textContent = weeklyCount;
        }
        
        if (entriesWithImages) {
            const imagesCount = entries.filter(e => e.image_url).length;
            entriesWithImages.textContent = imagesCount;
        }
    }
    
    // ===== FONCTION SUPPRESSION ENTRÉE =====
    async function deleteJournalEntry(entryId) {
        console.log('[JOURNAL] deleteJournalEntry() - START');
        console.log('[JOURNAL] entryId reçu (brut):', entryId, 'Type:', typeof entryId);
        
        // CORRECTION : Convertir l'ID en integer
        const id = parseInt(entryId, 10);
        console.log('[JOURNAL] entryId converti:', id, 'Type:', typeof id);
        
        if (!window.currentUser || !window.currentUser.uuid) {
            console.error('[JOURNAL] ❌ Utilisateur non connecté');
            return { data: null, error: 'User not logged in' };
        }
        
        if (!confirm('Êtes-vous sûr de vouloir supprimer cette note ?')) {
            return { data: null, error: 'Cancelled by user' };
        }
        
        try {
            const { error } = await supabase
                .from('journal_entries')
                .delete()
                .eq('id', id)
                .eq('user_id', window.currentUser.uuid);
            
            if (error) {
                console.error('[JOURNAL] ❌ Erreur suppression:', error);
                alert(`❌ Erreur : ${error.message}`);
                return { data: null, error };
            }
            
            console.log('[JOURNAL] ✅ Note supprimée');
            alert('✅ Note supprimée avec succès');
            
            // Rafraîchir l'affichage
            await loadJournalEntries();
            
            // ✅ Rafraîchir le calendrier pour afficher les jours "no trade"
            if (window.updateCalendar) {
                window.updateCalendar();
            }
            
            return { data: true, error: null };
        } catch (err) {
            console.error('[JOURNAL] ❌ Exception deleteJournalEntry:', err);
            alert(`❌ Erreur : ${err.message}`);
            return { data: null, error: err };
        }
    }
    
    // ===== FONCTION VISUALISATION ENTRÉE =====
    async function viewJournalEntry(entryId) {
        console.log('[JOURNAL] viewJournalEntry() - START');
        console.log('[JOURNAL] entryId reçu (brut):', entryId, 'Type:', typeof entryId);
        
        // CORRECTION : Convertir l'ID en integer
        const id = parseInt(entryId, 10);
        console.log('[JOURNAL] entryId converti:', id, 'Type:', typeof id);
        
        if (!window.currentUser || !window.currentUser.uuid) {
            console.error('[JOURNAL] ❌ Utilisateur non connecté');
            alert('❌ Vous devez être connecté');
            return;
        }
        
        console.log('[JOURNAL] User UUID:', window.currentUser.uuid);
        
        try {
            // Récupérer l'entrée depuis Supabase
            console.log('[JOURNAL] Requête Supabase avec id:', id);
            
            const { data, error } = await supabase
                .from('journal_entries')
                .select('*')
                .eq('id', id)
                .eq('user_id', window.currentUser.uuid)
                .single();
            
            console.log('[JOURNAL] Résultat Supabase - data:', data, 'error:', error);
            
            if (error) {
                console.error('[JOURNAL] ❌ Erreur Supabase:', error);
                alert(`❌ Erreur : ${error.message}`);
                return;
            }
            
            if (!data) {
                console.error('[JOURNAL] ❌ Aucune donnée retournée');
                alert('❌ Note non trouvée');
                return;
            }
            
            console.log('[JOURNAL] ✅ Entrée récupérée:', data);
            
            // Afficher dans la modale visuelle
            const modal = document.getElementById('viewNoteModal');
            const titleElement = document.getElementById('viewNoteTitle');
            const contentElement = document.getElementById('viewNoteContent');
            
            if (!modal || !contentElement) {
                console.error('[JOURNAL] ❌ Modale viewNoteModal introuvable');
                // Fallback : afficher dans un alert
                const stars = '⭐'.repeat(data.session_rating || 0);
                const emotions = [];
                if (data.emotion_before) emotions.push(`Avant: ${data.emotion_before}`);
                if (data.emotion_after) emotions.push(`Après: ${data.emotion_after}`);
                
                const message = `
📅 Date: ${data.entry_date}
${stars ? `⭐ Notation: ${stars}\n` : ''}
${emotions.length > 0 ? `😊 Émotions: ${emotions.join(' | ')}\n` : ''}

📝 Contenu:
${data.content}
                `.trim();
                
                alert(message);
                return;
            }
            
            // Construire le HTML de la modale
            const rating = data.session_rating || 0;
            const stars = rating > 0 ? '⭐'.repeat(rating) : '';
            
            console.log('[JOURNAL] 🌟 Rating:', rating, 'Stars:', stars);
            
            let emotionsHtml = '';
            
            if (data.emotion_before || data.emotion_after) {
                emotionsHtml = `
                    <div class="bg-blue-50 p-4 rounded-lg">
                        <h3 class="font-semibold text-blue-900 mb-2">😊 Émotions</h3>
                        <div class="text-sm text-blue-800">
                            ${data.emotion_before ? `<span><strong>Avant:</strong> ${window.escapeHtml(data.emotion_before)}</span>` : ''}
                            ${data.emotion_before && data.emotion_after ? ' <span class="mx-2">→</span> ' : ''}
                            ${data.emotion_after ? `<span><strong>Après:</strong> ${window.escapeHtml(data.emotion_after)}</span>` : ''}
                        </div>
                    </div>
                `;
            }

            let imageHtml = '';
            if (data.image_url) {
                console.log('[JOURNAL] 📸 Image URL:', data.image_url);
                imageHtml = `
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h3 class="font-semibold text-gray-800 mb-2">📸 Image</h3>
                        <img src="${window.escapeHtml(data.image_url)}" alt="Image de la note" class="max-w-full h-auto rounded-lg border shadow-sm cursor-pointer hover:opacity-90 transition" onclick="viewImageZoom(this.src)" title="Cliquer pour agrandir">
                    </div>
                `;
            } else {
                console.log('[JOURNAL] ℹ️ Aucune image pour cette note');
            }

            let imageHtml2 = '';
            if (data.image_url_2) {
                console.log('[JOURNAL] 📸 Image 2 URL:', data.image_url_2);
                imageHtml2 = `
                    <div class="bg-gray-50 p-4 rounded-lg">
                        <h3 class="font-semibold text-gray-800 mb-2">📸 Image 2</h3>
                        <img src="${window.escapeHtml(data.image_url_2)}" alt="Image 2 de la note" class="max-w-full h-auto rounded-lg border shadow-sm cursor-pointer hover:opacity-90 transition" onclick="viewImageZoom(this.src)" title="Cliquer pour agrandir">
                    </div>
                `;
            }
            
            // Construction du HTML avec section d'évaluation visible même si rating = 0
            let ratingHtml = '';
            if (rating > 0) {
                ratingHtml = `<div class="text-2xl mt-1" title="Évaluation de la session">${stars}</div>`;
            } else {
                ratingHtml = `<div class="text-sm text-gray-500 mt-1">Aucune évaluation</div>`;
            }
            
            contentElement.innerHTML = `
                <div class="bg-gray-50 p-4 rounded-lg">
                    <div class="flex justify-between items-start mb-3">
                        <div>
                            <h3 class="text-lg font-semibold text-gray-800">📅 ${window.escapeHtml(data.entry_date)}</h3>
                            ${ratingHtml}
                        </div>
                    </div>
                </div>

                ${emotionsHtml}

                <div class="bg-white p-4 rounded-lg border">
                    <h3 class="font-semibold text-gray-800 mb-2">📝 Contenu</h3>
                    <p class="text-gray-700 whitespace-pre-wrap">${window.escapeHtml(data.content)}</p>
                </div>

                ${imageHtml}
                ${imageHtml2}
            `;
            
            // Mettre à jour le titre
            if (titleElement) {
                titleElement.textContent = `📝 Note du ${data.entry_date}`;
            }
            
            // Ouvrir la modale
            modal.style.display = 'block';
            
        } catch (err) {
            console.error('[JOURNAL] ❌ Exception viewJournalEntry:', err);
            alert(`❌ Erreur : ${err.message}`);
        }
    }
    
    // ===== FONCTION ÉDITION ENTRÉE =====
    async function editJournalEntry(entryId) {
        console.log('[JOURNAL] editJournalEntry() - START');
        console.log('[JOURNAL] entryId reçu (brut):', entryId, 'Type:', typeof entryId);
        
        // CORRECTION : Convertir l'ID en integer
        const id = parseInt(entryId, 10);
        console.log('[JOURNAL] entryId converti:', id, 'Type:', typeof id);
        
        if (!window.currentUser || !window.currentUser.uuid) {
            console.error('[JOURNAL] ❌ Utilisateur non connecté');
            alert('❌ Vous devez être connecté');
            return;
        }
        
        console.log('[JOURNAL] User UUID:', window.currentUser.uuid);
        
        try {
            // Récupérer l'entrée depuis Supabase
            console.log('[JOURNAL] Requête Supabase avec id:', id);
            
            const { data, error } = await supabase
                .from('journal_entries')
                .select('*')
                .eq('id', id)
                .eq('user_id', window.currentUser.uuid)
                .single();
            
            console.log('[JOURNAL] Résultat Supabase - data:', data, 'error:', error);
            
            if (error) {
                console.error('[JOURNAL] ❌ Erreur Supabase:', error);
                alert(`❌ Erreur : ${error.message}`);
                return;
            }
            
            if (!data) {
                console.error('[JOURNAL] ❌ Aucune donnée retournée');
                alert('❌ Note non trouvée');
                return;
            }
            
            console.log('[JOURNAL] ✅ Entrée récupérée pour édition:', data);
            
            // Pré-remplir le formulaire
            document.getElementById('noteDate').value = data.entry_date;
            document.getElementById('noteText').value = data.content;
            document.getElementById('emotionBefore').value = data.emotion_before || '';
            document.getElementById('emotionAfter').value = data.emotion_after || '';
            document.getElementById('sessionRating').value = data.session_rating || 0;
            
            // ✅ Pré-remplir la checkbox "Pas de trade"
            const noTradeCheckbox = document.getElementById('noTradeToday');
            if (noTradeCheckbox) {
                noTradeCheckbox.checked = data.no_trade || false;
            }
            
            // ✅ NOUVEAU : Restaurer les points positifs
            document.querySelectorAll('.positive-checkbox').forEach(cb => cb.checked = false);
            if (data.positive_points && Array.isArray(data.positive_points)) {
                data.positive_points.forEach(value => {
                    const checkbox = Array.from(document.querySelectorAll('.positive-checkbox')).find(cb => cb.value === value);
                    if (checkbox) checkbox.checked = true;
                });
                updatePositiveCount();
                console.log('[JOURNAL] ✅ Points positifs restaurés:', data.positive_points.length);
            }
            
            // ✅ NOUVEAU : Restaurer les erreurs
            document.querySelectorAll('.error-checkbox').forEach(cb => cb.checked = false);
            if (data.errors_committed && Array.isArray(data.errors_committed)) {
                data.errors_committed.forEach(value => {
                    const checkbox = Array.from(document.querySelectorAll('.error-checkbox')).find(cb => cb.value === value);
                    if (checkbox) checkbox.checked = true;
                });
                updateErrorsCount();
                console.log('[JOURNAL] ✅ Erreurs restaurées:', data.errors_committed.length);
            }
            
            // Mettre à jour les étoiles visuellement
            const rating = data.session_rating || 0;
            document.querySelectorAll('.star-rating').forEach((s, index) => {
                if (index < rating) {
                    s.style.opacity = '1';
                    s.style.color = '#FFD700';
                } else {
                    s.style.opacity = '0.3';
                    s.style.color = '#ccc';
                }
            });
            
            // ✅ Afficher l'image existante si présente
            if (data.image_url) {
                console.log('[JOURNAL] 🖼️ Image existante détectée:', data.image_url);
                const previewImg = document.getElementById('previewImg');
                const imagePreview = document.getElementById('imagePreview');
                
                if (previewImg && imagePreview) {
                    previewImg.src = data.image_url;
                    imagePreview.classList.remove('hidden');
                    console.log('[JOURNAL] ✅ Image affichée dans le modal');
                } else {
                    console.warn('[JOURNAL] ⚠️ Éléments preview introuvables');
                }
            } else {
                console.log('[JOURNAL] ℹ️ Pas d\'image pour cette note');
                // Masquer la preview si pas d'image
                const imagePreview = document.getElementById('imagePreview');
                if (imagePreview) {
                    imagePreview.classList.add('hidden');
                }
            }
            
            // Ouvrir la modale en mode édition
            const modal = document.getElementById('addNoteModal');
            if (modal) {
                modal.dataset.editingId = id; // Stocker l'ID (converti) pour la sauvegarde
                modal.style.display = 'block';
            }
            
            // Changer le texte du bouton
            const submitBtn = modal.querySelector('.trader-btn');
            if (submitBtn) {
                submitBtn.textContent = 'Modifier la Note';
            }
            
        } catch (err) {
            console.error('[JOURNAL] ❌ Exception editJournalEntry:', err);
            alert(`❌ Erreur : ${err.message}`);
        }
    }

    // ===== EXPORT DES FONCTIONS =====
    window.addNote = addNote;
    window.addJournalEntry = addJournalEntry;
    window.loadJournalEntries = loadJournalEntries;
    window.deleteJournalEntry = deleteJournalEntry;
    window.viewJournalEntry = viewJournalEntry;
    window.editJournalEntry = editJournalEntry;

    console.log('[JOURNAL] ✅ Module chargé. Fonctions exposées: addNote, loadJournalEntries, deleteJournalEntry, viewJournalEntry, editJournalEntry');

})();
