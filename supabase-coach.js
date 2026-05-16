/**
 * =================================================================
 * JOURNAL TRADER 360 - COACH MODULE
 * Version: FINALE PRO - IIFE isolée
 * Convention: TOUJOURS utiliser UUID pour les requêtes
 * =================================================================
 */

(() => {
    console.log('[COACH] Chargement supabase-coach.js...');
    
    // Récupérer le client Supabase depuis window.supabaseClient (créé par config.js)
    const supabase = window.supabaseClient || window.supabase;
    
    if (!supabase) {
        console.error('[ERROR] window.supabaseClient manquant (config non chargée ?)');
        throw new Error('supabaseClient manquant');
    }

    // ===== FONCTION CHARGEMENT INSCRIPTIONS =====
    async function loadCoachRegistrationsFromSupabase() {
        console.log(' Chargement inscriptions depuis Supabase...');
        
        try {
            // Récupérer TOUS les utilisateurs
            const { data: allUsers, error } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) {
                console.error('[ERROR] Erreur chargement registrations:', error);
                return;
            }

            console.log('[DATA] Utilisateurs récupérés:', allUsers.length);

            // Filtrer par statut et rôle
            const pendingUsers = allUsers.filter(u => u.status === 'pending' && u.role === 'student');
            const activeUsers = allUsers.filter(u => u.status === 'active' && u.role === 'student');
            const revokedUsers = allUsers.filter(u => u.status === 'revoked' && u.role === 'student');

            console.log('⏳ Pending:', pendingUsers.length, '[OK] Active:', activeUsers.length, ' Revoked:', revokedUsers.length);

            // Afficher les inscriptions en attente
            const pendingContainer = document.getElementById('coachPendingUsers');
            if (pendingContainer) {
                if (pendingUsers.length === 0) {
                    pendingContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Aucune demande en attente</p>';
                } else {
                    pendingContainer.innerHTML = pendingUsers.map(u => `
                        <div class="flex items-center justify-between p-4 bg-yellow-50 rounded-lg border border-yellow-200 mb-3">
                            <div>
                                <p class="font-semibold">${window.escapeHtml(u.name || 'Nom non renseigné')}</p>
                                <p class="text-sm text-gray-600">${window.escapeHtml(u.email)}</p>
                                <p class="text-sm text-gray-500">Inscrit le ${new Date(u.created_at).toLocaleDateString('fr-FR')}</p>
                            </div>
                            <div class="space-x-2">
                                <button onclick="approveRegistration('${window.escapeHtml(u.uuid)}')" class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
                                     Approuver
                                </button>
                                <button onclick="rejectRegistration('${window.escapeHtml(u.uuid)}')" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                                     Refuser
                                </button>
                            </div>
                        </div>
                    `).join('');
                }
            }

            // Afficher les utilisateurs actifs
            const activeContainer = document.getElementById('coachActiveUsers');
            if (activeContainer) {
                if (activeUsers.length === 0) {
                    activeContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun utilisateur actif</p>';
                } else {
                    activeContainer.innerHTML = activeUsers.map(u => `
                        <div class="flex items-center justify-between p-4 bg-green-50 rounded-lg border border-green-200 mb-3">
                            <div>
                                <p class="font-semibold">${window.escapeHtml(u.name || 'Nom non renseigné')}</p>
                                <p class="text-sm text-gray-600">${window.escapeHtml(u.email)}</p>
                                <p class="text-sm text-gray-500">Actif depuis ${new Date(u.created_at).toLocaleDateString('fr-FR')}</p>
                            </div>
                            <button onclick="revokeAccess('${window.escapeHtml(u.uuid)}')" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition">
                                 Révoquer
                            </button>
                        </div>
                    `).join('');
                }
            }

            // Afficher les utilisateurs révoqués
            const revokedContainer = document.getElementById('coachRevokedUsers');
            if (revokedContainer) {
                if (revokedUsers.length === 0) {
                    revokedContainer.innerHTML = '<p class="text-gray-500 text-center py-4">Aucun utilisateur révoqué</p>';
                } else {
                    revokedContainer.innerHTML = revokedUsers.map(u => `
                        <div class="flex items-center justify-between p-4 bg-red-50 rounded-lg border border-red-200 mb-3">
                            <div>
                                <p class="font-semibold">${window.escapeHtml(u.name || 'Nom non renseigné')}</p>
                                <p class="text-sm text-gray-600">${window.escapeHtml(u.email)}</p>
                                <p class="text-sm text-gray-500">Révoqué</p>
                            </div>
                            <button onclick="reactivateUser('${window.escapeHtml(u.uuid)}')" class="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition">
                                 Réactiver
                            </button>
                        </div>
                    `).join('');
                }
            }

        } catch (err) {
            console.error('[ERROR] Exception loadCoachRegistrations:', err);
        }
    }

    // ===== FONCTION APPROBATION =====
    async function approveRegistration(uuid) {
        if (!confirm('Confirmer l\'approbation de cet utilisateur ?')) {
            return;
        }

        console.log('[OK] Approbation utilisateur UUID:', uuid);

        try {
            const { data, error } = await supabase
                .from('users')
                .update({ status: 'active' })
                .eq('uuid', uuid)
                .select()
                .single();

            if (error) {
                console.error('[ERROR] Erreur approbation:', error);
                alert('[ERROR] Erreur lors de l\'approbation: ' + error.message);
                return;
            }

            console.log('[OK] Utilisateur approuvé:', data);
            alert('[OK] Utilisateur approuvé avec succès !');

            // Rafraîchir
            loadCoachRegistrationsFromSupabase();

        } catch (err) {
            console.error('[ERROR] Exception approveRegistration:', err);
            alert('[ERROR] Erreur système: ' + err.message);
        }
    }

    // ===== FONCTION REJET =====
    async function rejectRegistration(uuid) {
        if (!confirm('Confirmer le rejet de cet utilisateur ? (Cette action supprimera définitivement l\'utilisateur)')) {
            return;
        }

        console.log(' Rejet utilisateur UUID:', uuid);

        try {
            const { data, error } = await supabase
                .from('users')
                .delete()
                .eq('uuid', uuid)
                .select();

            if (error) {
                console.error('[ERROR] Erreur rejet:', error);
                alert('[ERROR] Erreur lors du rejet: ' + error.message);
                return;
            }

            console.log('[OK] Utilisateur rejeté:', data);
            alert('[OK] Utilisateur rejeté');

            // Rafraîchir
            loadCoachRegistrationsFromSupabase();

        } catch (err) {
            console.error('[ERROR] Exception rejectRegistration:', err);
            alert('[ERROR] Erreur système: ' + err.message);
        }
    }

    // ===== FONCTION RÉVOCATION =====
    async function revokeAccess(uuid) {
        if (!confirm('Confirmer la révocation de cet utilisateur ?')) {
            return;
        }

        console.log(' Révocation utilisateur UUID:', uuid);

        try {
            const { data, error } = await supabase
                .from('users')
                .update({ status: 'revoked' })
                .eq('uuid', uuid)
                .select()
                .single();

            if (error) {
                console.error('[ERROR] Erreur révocation:', error);
                alert('[ERROR] Erreur lors de la révocation: ' + error.message);
                return;
            }

            console.log('[OK] Accès révoqué:', data);
            alert('[OK] Accès révoqué');

            // Rafraîchir
            loadCoachRegistrationsFromSupabase();

        } catch (err) {
            console.error('[ERROR] Exception revokeAccess:', err);
            alert('[ERROR] Erreur système: ' + err.message);
        }
    }

    // ===== FONCTION RÉACTIVATION =====
    async function reactivateUser(uuid) {
        if (!confirm('Confirmer la réactivation de cet utilisateur ?')) {
            return;
        }

        console.log('[OK] Réactivation utilisateur UUID:', uuid);

        try {
            const { data, error } = await supabase
                .from('users')
                .update({ status: 'active' })
                .eq('uuid', uuid)
                .select()
                .single();

            if (error) {
                console.error('[ERROR] Erreur réactivation:', error);
                alert('[ERROR] Erreur lors de la réactivation: ' + error.message);
                return;
            }

            console.log('[OK] Utilisateur réactivé:', data);
            alert('[OK] Utilisateur réactivé avec succès !');

            // Rafraîchir
            loadCoachRegistrationsFromSupabase();

        } catch (err) {
            console.error('[ERROR] Exception reactivateUser:', err);
            alert('[ERROR] Erreur système: ' + err.message);
        }
    }

    // ===== FONCTION STATISTIQUES =====
    async function loadCoachStats() {
        console.log('[DATA] Chargement statistiques coach...');

        try {
            // Compter les utilisateurs par statut
            const { data: allUsers, error } = await supabase
                .from('users')
                .select('uuid, status, role')
                .eq('role', 'student');

            if (error) {
                console.error('[ERROR] Erreur chargement stats:', error);
                return;
            }

            const stats = {
                total: allUsers.length,
                active: allUsers.filter(u => u.status === 'active').length,
                pending: allUsers.filter(u => u.status === 'pending').length,
                revoked: allUsers.filter(u => u.status === 'revoked').length
            };

            console.log('[DATA] Statistiques:', stats);

            // Afficher dans le dashboard
            const statsContainer = document.getElementById('coachStats');
            if (statsContainer) {
                statsContainer.innerHTML = `
                    <div class="grid grid-cols-4 gap-4">
                        <div class="p-4 bg-blue-100 rounded-lg text-center">
                            <p class="text-3xl font-bold text-blue-600">${stats.total}</p>
                            <p class="text-sm text-gray-600">Total</p>
                        </div>
                        <div class="p-4 bg-green-100 rounded-lg text-center">
                            <p class="text-3xl font-bold text-green-600">${stats.active}</p>
                            <p class="text-sm text-gray-600">Actifs</p>
                        </div>
                        <div class="p-4 bg-yellow-100 rounded-lg text-center">
                            <p class="text-3xl font-bold text-yellow-600">${stats.pending}</p>
                            <p class="text-sm text-gray-600">En attente</p>
                        </div>
                        <div class="p-4 bg-red-100 rounded-lg text-center">
                            <p class="text-3xl font-bold text-red-600">${stats.revoked}</p>
                            <p class="text-sm text-gray-600">Révoqués</p>
                        </div>
                    </div>
                `;
            }

        } catch (err) {
            console.error('[ERROR] Exception loadCoachStats:', err);
        }
    }

    // ===== FONCTION RÉCUPÉRER TOUS LES ÉLÈVES AVEC LEURS DONNÉES =====
    async function getAllStudentsData() {
        console.log('[COACH] 📊 Chargement données de tous les élèves...');

        try {
            // Récupérer tous les élèves actifs
            const { data: students, error: studentsError } = await supabase
                .from('users')
                .select('*')
                .eq('role', 'student')
                .eq('status', 'active');

            if (studentsError) {
                console.error('[ERROR] Erreur récupération élèves:', studentsError);
                return [];
            }

            console.log('[COACH] ✅ Élèves actifs trouvés:', students.length);

            // Pour chaque élève, récupérer ses trades et comptes
            const studentsWithData = await Promise.all(students.map(async (student) => {
                const uuid = student.uuid;

                // Récupérer trades
                const { data: trades, error: tradesError } = await supabase
                    .from('trades')
                    .select('*')
                    .eq('user_id', uuid);

                // Calculer le P&L avec la MÊME formule que côté élève
                if (trades && trades.length > 0) {
                    trades.forEach(trade => {
                        // Calculer le P&L
                        const entryPrice = parseFloat(trade.entry_price) || 0;
                        const exitPrice = parseFloat(trade.exit_price) || 0;
                        const quantity = parseFloat(trade.quantity) || 1;
                        const direction = trade.direction || 'LONG';
                        const instrument = trade.instrument || 'ES';
                        
                        // Formule : (exit - entry) * quantity * direction * multiplier
                        const directionMultiplier = direction === 'LONG' ? 1 : -1;
                        const instrumentMultiplier = instrument === 'ES' ? 50 : 
                                                     instrument === 'NQ' ? 20 : 
                                                     instrument === 'MES' ? 5 : 
                                                     instrument === 'GC' ? 100 : 1;
                        
                        const calculatedPnl = (exitPrice - entryPrice) * quantity * directionMultiplier * instrumentMultiplier;
                        
                        // Utiliser manual_pnl si disponible, sinon le calculé
                        trade.pnl = parseFloat(trade.manual_pnl) || calculatedPnl;
                        
                        console.log(`[COACH] 🔧 Trade ${trade.id} (${instrument} ${direction}): ${trade.pnl.toFixed(2)}`);
                    });
                }

                // Récupérer accounts
                const { data: accounts, error: accountsError } = await supabase
                    .from('accounts')
                    .select('*')
                    .eq('user_id', uuid);

                // Récupérer account_costs
                const { data: accountCosts, error: costsError } = await supabase
                    .from('account_costs')
                    .select('*')
                    .eq('user_id', uuid);

                // Récupérer payouts
                const { data: payouts, error: payoutsError } = await supabase
                    .from('payouts')
                    .select('*')
                    .eq('user_id', uuid);

                console.log(`[COACH] 📈 ${student.email}: ${trades?.length || 0} trades, ${accounts?.length || 0} comptes`);

                return {
                    user: student,
                    data: {
                        trades: trades || [],
                        accounts: accounts || [],
                        accountCosts: accountCosts || [],
                        payouts: payouts || []
                    }
                };
            }));

            console.log('[COACH] ✅ Données complètes chargées pour', studentsWithData.length, 'élèves');
            return studentsWithData;

        } catch (err) {
            console.error('[ERROR] Exception getAllStudentsData:', err);
            return [];
        }
    }

    // ===== FONCTION COMPTABILITÉ COACH =====
    async function loadCoachAccountingFromSupabase() {
        console.log('[COACH] 💰 Chargement comptabilité globale...');

        // ✅ RESET COMPLET de tous les éléments AVANT de charger
        try {
            const totalInvestedEl = document.getElementById('coachTotalInvested');
            const totalPayoutsEl = document.getElementById('coachTotalPayouts');
            const totalProfitEl = document.getElementById('coachNetProfit');
            const roiEl = document.getElementById('coachROI');
            const detailTableBody = document.getElementById('coachAccountingBreakdown');
            const costsTableBody = document.getElementById('coachAllCostsTable');
            const payoutsTableBody = document.getElementById('coachAllPayoutsTable');
            
            // Reset KPIs
            if (totalInvestedEl) totalInvestedEl.textContent = '0.00';
            if (totalPayoutsEl) totalPayoutsEl.textContent = '0.00';
            if (totalProfitEl) {
                totalProfitEl.textContent = '$0.00';
                totalProfitEl.style.color = '#6b7280';
            }
            if (roiEl) roiEl.textContent = '0%';
            
            // Reset tableaux
            if (detailTableBody) {
                detailTableBody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Chargement...</td></tr>';
            }
            if (costsTableBody) {
                costsTableBody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Chargement...</td></tr>';
            }
            if (payoutsTableBody) {
                payoutsTableBody.innerHTML = '<tr><td colspan="4" class="px-6 py-4 text-center text-gray-500"><i class="fas fa-spinner fa-spin mr-2"></i>Chargement...</td></tr>';
            }
            
            console.log('[COACH] ✅ Reset complet effectué');
        } catch (err) {
            console.error('[COACH] ❌ Erreur lors du reset:', err);
        }

        try {
            const studentsData = await getAllStudentsData();
            
            if (studentsData.length === 0) {
                console.log('[COACH] Aucun élève actif pour la comptabilité');
                // Mettre à jour les KPIs à 0
                const totalInvestedEl = document.getElementById('coachTotalInvested');
                const totalPayoutsEl = document.getElementById('coachTotalPayouts');
                const totalProfitEl = document.getElementById('coachTotalProfit');
                
                if (totalInvestedEl) totalInvestedEl.textContent = '0.00';
                if (totalPayoutsEl) totalPayoutsEl.textContent = '0.00';
                if (totalProfitEl) totalProfitEl.textContent = '0.00';
                
                return;
            }

            let totalInvested = 0;
            let totalPayouts = 0;
            let allCosts = [];
            let allPayouts = [];

            // Agréger les données
            studentsData.forEach(studentData => {
                const costs = studentData.data.accountCosts || [];
                const payouts = studentData.data.payouts || [];

                console.log(`[COACH] 💵 ${studentData.user.email}: ${costs.length} coûts, ${payouts.length} payouts`);

                costs.forEach(cost => {
                    // Accepter 'amount' OU 'cost' OU 'price'
                    const costAmount = parseFloat(cost.amount || cost.cost || cost.price || 0);
                    console.log(`[COACH]   📤 Coût: ${cost.account_name || 'N/A'} - $${costAmount}`);
                    totalInvested += costAmount;
                    allCosts.push({
                        ...cost,
                        studentEmail: studentData.user.email,
                        amount: costAmount  // Normaliser le montant
                    });
                });

                payouts.forEach(payout => {
                    const payoutAmount = parseFloat(payout.amount || 0);
                    console.log(`[COACH]   📥 Payout: $${payoutAmount} le ${payout.date || 'N/A'}`);
                    totalPayouts += payoutAmount;
                    allPayouts.push({
                        ...payout,
                        studentEmail: studentData.user.email
                    });
                });
            });

            console.log('[COACH] 💰 Total investi:', totalInvested);
            console.log('[COACH] 💰 Total payouts:', totalPayouts);
            console.log('[COACH] 💰 Profit net:', totalPayouts - totalInvested);

            // Afficher les KPIs
            const totalInvestedEl = document.getElementById('coachTotalInvested');
            const totalPayoutsEl = document.getElementById('coachTotalPayouts');
            const totalProfitEl = document.getElementById('coachNetProfit');  // ✅ BON ID
            const roiEl = document.getElementById('coachROI');
            
            if (totalInvestedEl) totalInvestedEl.textContent = totalInvested.toFixed(2);
            if (totalPayoutsEl) totalPayoutsEl.textContent = totalPayouts.toFixed(2);
            if (totalProfitEl) {
                const profit = totalPayouts - totalInvested;
                totalProfitEl.textContent = '$' + profit.toFixed(2);
                totalProfitEl.style.color = profit >= 0 ? '#10b981' : '#ef4444';  // Vert si positif, rouge si négatif
            }
            if (roiEl && totalInvested > 0) {
                const roi = ((totalPayouts - totalInvested) / totalInvested * 100).toFixed(1);
                roiEl.textContent = roi + '%';
            }

            // Afficher le tableau "Détail par Élève"
            const detailTableBody = document.getElementById('coachAccountingBreakdown');  // ✅ BON ID
            console.log('[COACH] 🔍 Element coachAccountingBreakdown:', detailTableBody ? 'TROUVÉ' : '❌ INTROUVABLE');
            
            if (detailTableBody) {
                // Filtrer les élèves qui ont au moins un coût OU un payout
                const studentsWithAccounting = studentsData.filter(studentData => {
                    const costs = studentData.data.accountCosts || [];
                    const payouts = studentData.data.payouts || [];
                    return costs.length > 0 || payouts.length > 0;
                });

                console.log('[COACH] 👥 Élèves avec comptabilité:', studentsWithAccounting.length);

                if (studentsWithAccounting.length === 0) {
                    detailTableBody.innerHTML = `
                        <tr>
                            <td colspan="5" class="px-6 py-4 text-center text-gray-500">Aucune donnée comptable</td>
                        </tr>
                    `;
                } else {
                    try {
                        const detailRows = studentsWithAccounting.map(studentData => {
                            const costs = studentData.data.accountCosts || [];
                            const payouts = studentData.data.payouts || [];
                            const totalCosts = costs.reduce((sum, c) => sum + parseFloat(c.amount || c.cost || c.price || 0), 0);
                            const totalPayoutsStudent = payouts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
                            const balance = totalPayoutsStudent - totalCosts;
                            const roiStudent = totalCosts > 0 ? ((balance / totalCosts) * 100).toFixed(1) : '0.0';
                            
                            // Protections contre les données manquantes
                            const email = studentData?.user?.email || 'Email inconnu';
                            const name = studentData?.user?.name || email.split('@')[0];
                            
                            return `
                                <tr class="border-b border-gray-200 hover:bg-gray-50">
                                    <td class="px-6 py-4">
                                        <div class="font-medium">${window.escapeHtml(name)}</div>
                                        <div class="text-sm text-gray-500">${window.escapeHtml(email)}</div>
                                    </td>
                                    <td class="px-6 py-4 text-red-600">$${totalCosts.toFixed(2)}</td>
                                    <td class="px-6 py-4 text-green-600">$${totalPayoutsStudent.toFixed(2)}</td>
                                    <td class="px-6 py-4 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}">$${balance.toFixed(2)}</td>
                                    <td class="px-6 py-4">${roiStudent}%</td>
                                </tr>
                            `;
                        }).join('');
                        
                        console.log('[COACH] 📋 HTML généré pour', studentsWithAccounting.length, 'élève(s)');
                        console.log('[COACH] 📋 Premier élève:', studentsWithAccounting[0]?.user?.email);
                        detailTableBody.innerHTML = detailRows;
                        console.log('[COACH] ✅ Tableau Détail par Élève mis à jour');
                    } catch (err) {
                        console.error('[COACH] ❌ Erreur génération tableau Détail par Élève:', err);
                        detailTableBody.innerHTML = `
                            <tr>
                                <td colspan="5" class="px-6 py-4 text-center text-red-500">
                                    Erreur lors de la génération du tableau
                                </td>
                            </tr>
                        `;
                    }
                }
            } else {
                console.error('[COACH] ❌ Element coachAccountingBreakdown NOT FOUND in DOM');
            }

            // Afficher les tableaux "Tous les Comptes Achetés" et "Tous les Payouts"
            const costsTableBody = document.getElementById('coachAllCostsTable');
            if (costsTableBody) {
                if (allCosts.length === 0) {
                    costsTableBody.innerHTML = `
                        <tr>
                            <td colspan="4" class="px-6 py-4 text-center text-gray-500">Aucun coût enregistré</td>
                        </tr>
                    `;
                } else {
                    const costsRows = allCosts.map(cost => `
                        <tr class="border-b border-gray-200 hover:bg-gray-50">
                            <td class="px-6 py-4">${new Date(cost.purchase_date || cost.date || Date.now()).toLocaleDateString('fr-FR')}</td>
                            <td class="px-6 py-4">${window.escapeHtml(cost.studentEmail)}</td>
                            <td class="px-6 py-4">${window.escapeHtml(cost.account_name || cost.name || 'N/A')}</td>
                            <td class="px-6 py-4 text-red-600">$${cost.amount.toFixed(2)}</td>
                        </tr>
                    `).join('');
                    costsTableBody.innerHTML = costsRows;
                }
            }

            const payoutsTableBody = document.getElementById('coachAllPayoutsTable');
            if (payoutsTableBody) {
                if (allPayouts.length === 0) {
                    payoutsTableBody.innerHTML = `
                        <tr>
                            <td colspan="4" class="px-6 py-4 text-center text-gray-500">Aucun payout enregistré</td>
                        </tr>
                    `;
                } else {
                    const payoutsRows = allPayouts.map(payout => `
                        <tr class="border-b border-gray-200 hover:bg-gray-50">
                            <td class="px-6 py-4">${new Date(payout.payout_date || payout.date || Date.now()).toLocaleDateString('fr-FR')}</td>
                            <td class="px-6 py-4">${window.escapeHtml(payout.studentEmail)}</td>
                            <td class="px-6 py-4">${window.escapeHtml(payout.account_name || payout.account || 'N/A')}</td>
                            <td class="px-6 py-4 text-green-600">$${parseFloat(payout.amount).toFixed(2)}</td>
                        </tr>
                    `).join('');
                    payoutsTableBody.innerHTML = payoutsRows;
                }
            }

            updateCoachAccountingChart(allCosts, allPayouts);

        } catch (err) {
            console.error('[ERROR] Exception loadCoachAccountingFromSupabase:', err);
        }
    }

    let coachAccountingChartInstance = null;

    function updateCoachAccountingChart(allCosts, allPayouts) {
        const ctx = document.getElementById('coachAccountingChart');
        if (!ctx) return;

        const monthData = {};
        allCosts.forEach(c => {
            const d = c.date;
            if (!d) return;
            const m = d.slice(0, 7);
            if (!monthData[m]) monthData[m] = { costs: 0, payouts: 0 };
            monthData[m].costs += parseFloat(c.cost || 0);
        });
        allPayouts.forEach(p => {
            const d = p.date;
            if (!d) return;
            const m = d.slice(0, 7);
            if (!monthData[m]) monthData[m] = { costs: 0, payouts: 0 };
            monthData[m].payouts += parseFloat(p.amount || 0);
        });

        const months = Object.keys(monthData).sort();
        if (months.length === 0) return;

        const labels = months.map(m => {
            const [y, mo] = m.split('-');
            return new Date(y, mo - 1).toLocaleDateString('fr-FR', { month: 'short', year: 'numeric' });
        });

        if (coachAccountingChartInstance) coachAccountingChartInstance.destroy();

        coachAccountingChartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    {
                        label: 'Coûts',
                        data: months.map(m => monthData[m].costs),
                        backgroundColor: 'rgba(220, 38, 38, 0.7)',
                        borderColor: '#dc2626',
                        borderWidth: 1
                    },
                    {
                        label: 'Payouts',
                        data: months.map(m => monthData[m].payouts),
                        backgroundColor: 'rgba(16, 185, 129, 0.7)',
                        borderColor: '#10b981',
                        borderWidth: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: true, position: 'top' },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                        callbacks: {
                            label: ctx => `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}`
                        }
                    }
                },
                scales: {
                    x: { grid: { display: false } },
                    y: {
                        beginAtZero: true,
                        ticks: { callback: v => '$' + v.toLocaleString('fr-FR') }
                    }
                }
            }
        });
    }

    // ===== VARIABLES GLOBALES POUR NAVIGATION CALENDRIER MODAL =====
    let modalCalendarMonth = new Date().getMonth();
    let modalCalendarYear = new Date().getFullYear();
    let currentStudentData = null;
    
    // ===== FONCTION VOIR DÉTAILS ÉLÈVE =====
    function viewStudentDetails(studentData) {
        // Stocker les données de l'élève pour la navigation
        currentStudentData = studentData;
        
        // Réinitialiser au mois courant
        const now = new Date();
        modalCalendarMonth = now.getMonth();
        modalCalendarYear = now.getFullYear();
        
        const student = studentData.user;
        const trades = studentData.data.trades || [];
        const accounts = studentData.data.accounts || [];
        const accountCosts = studentData.data.accountCosts || [];
        const payouts = studentData.data.payouts || [];
        
        // Calculer les statistiques
        const wins = trades.filter(t => t.pnl > 0).length;
        const losses = trades.filter(t => t.pnl < 0).length;
        const winRate = trades.length > 0 ? ((wins / trades.length) * 100).toFixed(1) : 0;
        const totalPnl = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
        const avgPnl = trades.length > 0 ? (totalPnl / trades.length).toFixed(2) : 0;
        const totalCosts = accountCosts.reduce((sum, c) => sum + parseFloat(c.amount || c.cost || c.price || 0), 0);
        const totalPayouts = payouts.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);
        const netProfit = totalPayouts - totalCosts;
        const roi = totalCosts > 0 ? ((netProfit / totalCosts) * 100).toFixed(1) : 0;
        
        // Préparer les variables pour le calendrier
        const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
            "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
        
        const daysOfWeek = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        
        // Créer le modal HTML avec layout VERTICAL scrollable
        const modalHTML = `
            <div id="studentDetailsModal" class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onclick="closeStudentDetailsModal(event)">
                <div class="bg-white rounded-lg shadow-2xl w-full max-w-6xl max-h-[85vh] overflow-hidden flex flex-col" onclick="event.stopPropagation()">
                    
                    <!-- Header -->
                    <div class="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-4 flex-shrink-0">
                        <div class="flex justify-between items-center">
                            <div>
                                <h2 class="text-2xl font-bold">${window.escapeHtml(student.name)}</h2>
                                <p class="text-blue-100">${window.escapeHtml(student.email)}</p>
                            </div>
                            <button onclick="closeStudentDetailsModal()" class="text-white hover:text-gray-200 text-3xl font-bold leading-none">
                                &times;
                            </button>
                        </div>
                    </div>
                    
                    <!-- Body SCROLLABLE -->
                    <div class="overflow-y-auto flex-1 p-4 space-y-4">
                        
                        <!-- Grille 2 colonnes: Stats + Comptabilité | Calendrier + Infos -->
                        <div class="grid grid-cols-1 lg:grid-cols-2 gap-4">
                            
                            <!-- Colonne Gauche -->
                            <div class="space-y-4">
                                <!-- Statistiques de Trading -->
                                <div class="bg-white rounded-lg border border-gray-200 p-4">
                                    <h3 class="text-lg font-bold text-gray-800 mb-3 flex items-center border-b pb-2">
                                        <i class="fas fa-chart-line mr-2 text-blue-600"></i>
                                        Statistiques de Trading
                                    </h3>
                                    <div class="grid grid-cols-2 gap-3">
                                        <div class="text-center">
                                            <div class="text-xs text-gray-600 mb-1">Total</div>
                                            <div class="text-2xl font-bold text-gray-800">${trades.length}</div>
                                        </div>
                                        <div class="text-center">
                                            <div class="text-xs text-gray-600 mb-1">Win Rate</div>
                                            <div class="text-2xl font-bold ${parseFloat(winRate) >= 50 ? 'text-green-600' : 'text-red-600'}">${winRate}%</div>
                                        </div>
                                        <div class="text-center">
                                            <div class="text-xs text-gray-600 mb-1">Gagnants</div>
                                            <div class="text-2xl font-bold text-green-600">${wins}</div>
                                        </div>
                                        <div class="text-center">
                                            <div class="text-xs text-gray-600 mb-1">Perdants</div>
                                            <div class="text-2xl font-bold text-red-600">${losses}</div>
                                        </div>
                                    </div>
                                    <div class="grid grid-cols-2 gap-3 mt-3 pt-3 border-t">
                                        <div class="text-center">
                                            <div class="text-xs text-gray-600 mb-1">P&L Total</div>
                                            <div class="text-2xl font-bold ${totalPnl >= 0 ? 'text-green-600' : 'text-red-600'}">$${totalPnl.toFixed(2)}</div>
                                        </div>
                                        <div class="text-center">
                                            <div class="text-xs text-gray-600 mb-1">P&L Moyen</div>
                                            <div class="text-2xl font-bold ${avgPnl >= 0 ? 'text-green-600' : 'text-red-600'}">$${avgPnl}</div>
                                        </div>
                                    </div>
                                </div>
                                
                                <!-- Comptabilité -->
                                <div class="bg-white rounded-lg border border-gray-200 p-4">
                                    <h3 class="text-lg font-bold text-gray-800 mb-3 flex items-center border-b pb-2">
                                        <i class="fas fa-dollar-sign mr-2 text-green-600"></i>
                                        Comptabilité
                                    </h3>
                                    <div class="grid grid-cols-2 gap-3">
                                        <div class="text-center">
                                            <div class="text-xs text-gray-600 mb-1">Comptes</div>
                                            <div class="text-2xl font-bold text-gray-800">${accounts.length}</div>
                                        </div>
                                        <div class="text-center">
                                            <div class="text-xs text-gray-600 mb-1">Investi</div>
                                            <div class="text-xl font-bold text-red-600">$${totalCosts.toFixed(2)}</div>
                                        </div>
                                        <div class="text-center">
                                            <div class="text-xs text-gray-600 mb-1">Payouts</div>
                                            <div class="text-xl font-bold text-green-600">$${totalPayouts.toFixed(2)}</div>
                                        </div>
                                        <div class="text-center">
                                            <div class="text-xs text-gray-600 mb-1">Bénéfice</div>
                                            <div class="text-xl font-bold ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}">$${netProfit.toFixed(2)}</div>
                                        </div>
                                    </div>
                                    <div class="text-center mt-3 pt-3 border-t">
                                        <div class="text-xs text-gray-600 mb-1">ROI</div>
                                        <div class="text-3xl font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-600'}">${roi}%</div>
                                    </div>
                                </div>
                                
                                <!-- Informations -->
                                <div class="bg-white rounded-lg border border-gray-200 p-4">
                                    <h3 class="text-lg font-bold text-gray-800 mb-3 flex items-center border-b pb-2">
                                        <i class="fas fa-info-circle mr-2 text-purple-600"></i>
                                        Informations
                                    </h3>
                                    <div class="space-y-2 text-sm">
                                        <div class="flex justify-between py-2 border-b">
                                            <span class="text-gray-600">Inscription</span>
                                            <span class="font-bold">${new Date(student.created_at).toLocaleDateString('fr-FR')}</span>
                                        </div>
                                        <div class="flex justify-between py-2 border-b">
                                            <span class="text-gray-600">Statut</span>
                                            <span class="px-3 py-1 rounded-full text-xs bg-green-100 text-green-800 font-bold">Actif</span>
                                        </div>
                                        <div class="flex justify-between py-2">
                                            <span class="text-gray-600">UUID</span>
                                            <span class="font-mono text-xs text-gray-500">${student.uuid.substring(0, 8)}...</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Colonne Droite: Calendrier -->
                            <div>
                                <div class="bg-white rounded-lg border border-gray-200 p-4">
                                    <div class="flex justify-between items-center mb-4">
                                        <button onclick="previousModalMonth()" class="text-gray-600 hover:text-gray-800 p-2 rounded hover:bg-gray-100 transition">
                                            <i class="fas fa-chevron-left text-xl"></i>
                                        </button>
                                        <h3 id="modalCalendarTitle" class="text-lg font-bold text-gray-800 flex items-center">
                                            <i class="fas fa-calendar-alt mr-2 text-indigo-600"></i>
                                            <span id="modalMonthYear">${monthNames[modalCalendarMonth]} ${modalCalendarYear}</span>
                                        </h3>
                                        <button onclick="nextModalMonth()" class="text-gray-600 hover:text-gray-800 p-2 rounded hover:bg-gray-100 transition">
                                            <i class="fas fa-chevron-right text-xl"></i>
                                        </button>
                                    </div>
                                    
                                    <!-- Header jours de la semaine -->
                                    <div class="grid grid-cols-7 gap-2 mb-3">
                                        ${daysOfWeek.map(day => `<div class="text-center font-semibold text-gray-600 text-xs py-1">${day}</div>`).join('')}
                                    </div>
                                    
                                    <!-- Grille calendrier - Sera remplie par JavaScript -->
                                    <div id="modalCalendarGrid" class="grid grid-cols-7 gap-2">
                                        <!-- Les cellules seront ajoutées ici -->
                                    </div>
                                </div>
                            </div>
                            
                        </div>
                        
                    </div>
                    
                    <!-- Footer -->
                    <div class="bg-gray-50 px-6 py-4 flex-shrink-0 flex justify-end space-x-3 border-t">
                        <button onclick="closeStudentDetailsModal()" class="px-6 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition font-medium">
                            Fermer
                        </button>
                        <button onclick="closeStudentDetailsModal(); revokeAccess('${window.escapeHtml(student.uuid)}')" class="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium">
                            <i class="fas fa-ban mr-2"></i>Révoquer Accès
                        </button>
                    </div>
                    
                </div>
            </div>
        `;
        
        // Ajouter le modal au DOM
        const existingModal = document.getElementById('studentDetailsModal');
        if (existingModal) {
            existingModal.remove();
        }
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        
        // MAINTENANT remplir le calendrier
        updateModalCalendar();
    }
    
    // ===== FONCTION DE MISE À JOUR DU CALENDRIER MODAL =====
    function updateModalCalendar() {
        if (!currentStudentData) return;
        
        const trades = currentStudentData.data.trades || [];
        const monthNames = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
            "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
        const daysOfWeek = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
        
        // Mettre à jour le titre
        const monthYearSpan = document.getElementById('modalMonthYear');
        if (monthYearSpan) {
            monthYearSpan.textContent = `${monthNames[modalCalendarMonth]} ${modalCalendarYear}`;
        }
        
        const firstDay = new Date(modalCalendarYear, modalCalendarMonth, 1);
        const startDate = new Date(firstDay);
        startDate.setDate(startDate.getDate() - firstDay.getDay());
        
        const calendarGrid = document.getElementById('modalCalendarGrid');
        if (calendarGrid) {
            let calendarCells = '';
            let tradesFound = 0;
            
            for (let i = 0; i < 42; i++) {
                const date = new Date(startDate.getTime());
                date.setDate(date.getDate() + i);
                
                const isCurrentMonth = date.getMonth() === modalCalendarMonth;
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const dateString = `${year}-${month}-${day}`;
                
                const dayTrades = trades.filter(trade => {
                    // CORRECTION: utiliser trade_date au lieu de date
                    const tradeDate = (trade.trade_date || trade.date || '').split('T')[0];
                    return tradeDate === dateString;
                });
                
                if (dayTrades.length > 0) {
                    tradesFound++;
                }
                
                const dayPnl = dayTrades.reduce((sum, trade) => sum + (trade.pnl || 0), 0);
                
                let className = 'text-center py-3 cursor-pointer rounded transition-all';
                if (!isCurrentMonth) {
                    className += ' text-gray-300';
                } else if (dayTrades.length > 0) {
                    className += dayPnl > 0 ? ' bg-green-100 text-green-800 hover:bg-green-200' : ' bg-red-100 text-red-800 hover:bg-red-200';
                } else {
                    className += ' text-gray-700 hover:bg-gray-100';
                }
                
                let cellContent = `<div class="font-semibold">${date.getDate()}</div>`;
                
                if (dayTrades.length > 0 && isCurrentMonth) {
                    cellContent += '<div class="text-xs mt-1 space-y-0.5">';
                    cellContent += `<div class="font-semibold">${dayPnl > 0 ? '+' : ''}$${dayPnl.toFixed(0)}</div>`;
                    cellContent += '</div>';
                }
                
                calendarCells += `<div class="${className}">${cellContent}</div>`;
            }
            calendarGrid.innerHTML = calendarCells;
        }
    }
    
    // ===== FONCTIONS DE NAVIGATION CALENDRIER =====
    function previousModalMonth() {
        modalCalendarMonth--;
        if (modalCalendarMonth < 0) {
            modalCalendarMonth = 11;
            modalCalendarYear--;
        }
        updateModalCalendar();
    }
    
    function nextModalMonth() {
        modalCalendarMonth++;
        if (modalCalendarMonth > 11) {
            modalCalendarMonth = 0;
            modalCalendarYear++;
        }
        updateModalCalendar();
    }
    
    // Fermer le modal
    function closeStudentDetailsModal(event) {
        // Si event existe et que le click est sur le modal lui-même (pas sur le contenu)
        if (event && event.target.id !== 'studentDetailsModal') {
            return;
        }
        
        const modal = document.getElementById('studentDetailsModal');
        if (modal) {
            modal.remove();
            console.log('[COACH] 📊 Modal détails fermé');
        }
    }

    // ===== EXPORT DES FONCTIONS =====
    window.loadCoachRegistrationsFromSupabase = loadCoachRegistrationsFromSupabase;
    window.approveRegistration = approveRegistration;
    window.rejectRegistration = rejectRegistration;
    window.revokeAccess = revokeAccess;
    window.getAllStudentsData = getAllStudentsData;
    window.loadCoachAccountingFromSupabase = loadCoachAccountingFromSupabase;
    window.reactivateUser = reactivateUser;
    window.loadCoachStats = loadCoachStats;
    window.viewStudentDetails = viewStudentDetails;
    window.closeStudentDetailsModal = closeStudentDetailsModal;
    window.previousModalMonth = previousModalMonth;
    window.nextModalMonth = nextModalMonth;

    console.log('[OK] Fonctions coach exportées: loadCoachRegistrations, approveRegistration, rejectRegistration, revokeAccess, reactivateUser, loadCoachStats, getAllStudentsData, loadCoachAccountingFromSupabase, viewStudentDetails, closeStudentDetailsModal, previousModalMonth, nextModalMonth');

})();
