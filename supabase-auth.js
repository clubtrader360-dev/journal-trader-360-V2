// ========================================
// SUPABASE AUTH - VERSION IIFE (ISOLÉE)
// ========================================

(() => {
    console.log('[LOAD] Chargement supabase-auth.js...');

    // Récupérer le client depuis window.supabaseClient (pas window.supabase)
    const supabase = window.supabaseClient; // Référence locale, pas redéclaration
    
    if (!supabase) {
        console.error('[ERROR] ERREUR : window.supabaseClient manquant (config non chargée ?)');
        throw new Error('supabaseClient manquant');
    }

    console.log('[OK] Client Supabase récupéré depuis window.supabaseClient');

    // ========================================
    // FONCTION : LOGIN ÉLÈVE
    // ========================================
    async function login() {
        const loginEmail = document.getElementById('loginEmail').value.trim();
        const loginPassword = document.getElementById('loginPassword').value;

        if (!loginEmail || !loginPassword) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        try {
            console.log('[EMAIL] Tentative de connexion élève:', loginEmail);

            const { data, error } = await supabase.auth.signInWithPassword({
                email: loginEmail,
                password: loginPassword
            });

            if (error) {
                console.error('[ERROR] Erreur auth:', error.message);
                alert('Email ou mot de passe incorrect');
                return;
            }

            console.log('[OK] Authentification réussie');
            console.log('[USER] UUID utilisateur:', data.user.id);

            // Store the Auth UUID globally (source of truth)
            window.currentUserAuthId = data.user.id;

            const { data: userData, error: userError } = await supabase
                .from('users')
                .select('*')
                .eq('uuid', data.user.id)
                .single();

            if (userError) {
                console.error('[ERROR] Erreur récupération user:', userError);
                alert('Erreur lors de la récupération des données utilisateur');
                await supabase.auth.signOut();
                return;
            }

            // Vérifier le statut de l'utilisateur
            if (userData.status === 'revoked') {
                console.warn('[WARN] Compte révoqué');
                alert('Votre compte a été désactivé. Contactez un administrateur.');
                await supabase.auth.signOut();
                return;
            }

            if (userData.status === 'pending') {
                console.warn('[WARN] Compte en attente de validation');
                alert('Votre compte est en attente de validation par un coach. Vous recevrez une notification une fois approuvé.');
                await supabase.auth.signOut();
                return;
            }

            window.currentUser = userData;
            window.currentUserUuid = userData && userData.uuid ? userData.uuid : window.currentUserAuthId;
            console.log('[OK] Connexion élève réussie:', userData.email);
            // #19 — vérifier l'acceptation légale (modal bloquant si périmée / jamais acceptée).
            setTimeout(() => window.maybePromptLegalConsent && window.maybePromptLegalConsent(), 500);

            // Affichage de l'interface (version simple sans showMainApp)
            const authScreen = document.getElementById('authScreen');
            const mainApp = document.getElementById('mainApp');
            const coachApp = document.getElementById('coachApp');
            const userInfo = document.getElementById('userInfo');
            
            // Masquer l'écran d'authentification
            if (authScreen) authScreen.style.display = 'none';
            
            // ✅ NETTOYAGE COMPLET de l'interface Coach
            if (coachApp) {
                coachApp.style.display = 'none';
                coachApp.style.visibility = 'hidden';
                coachApp.style.opacity = '0';
            }
            
            // ✅ RÉINITIALISATION FORCÉE de l'interface Élève
            if (mainApp) {
                mainApp.style.display = 'flex';
                mainApp.style.visibility = 'visible';
                mainApp.style.opacity = '1';
                console.log('[DEBUG] mainApp réinitialisé:', {
                    display: mainApp.style.display,
                    visibility: mainApp.style.visibility,
                    opacity: mainApp.style.opacity
                });

                // Appliquer la route depuis l'URL si présente (refresh / lien direct),
                // sinon laisser la section par défaut (dashboard).
                if (typeof window.routeFromHash === 'function') {
                    window.routeFromHash();
                }
            }
            
            // Afficher le nom (ou email si pas de nom) sous le logo
            if (userInfo) {
                const displayName = window.currentUser.name || window.currentUser.email;
                userInfo.textContent = displayName;
                console.log('[OK] Nom affiché:', displayName);
            }
            
            // ✅ CHARGER ET AFFICHER LES DONNÉES AUTOMATIQUEMENT APRÈS LA CONNEXION
            console.log('[AUTH] 🔄 Chargement automatique des données après connexion...');
            
            // Attendre un peu que l'UI soit prête, puis rafraîchir tout
            setTimeout(async () => {
                if (typeof window.refreshAllModules === 'function') {
                    console.log('[AUTH] ✅ Appel refreshAllModules()...');
                    await window.refreshAllModules();
                    console.log('[AUTH] ✅ Données chargées et affichées automatiquement');
                } else {
                    console.warn('[AUTH] ⚠️ refreshAllModules non disponible, chargement manuel...');

                    // Fallback : charger manuellement
                    if (typeof window.loadAccounts === 'function') {
                        console.log('[OK] Appel window.loadAccounts()');
                        await window.loadAccounts();
                    }

                    if (typeof window.loadTrades === 'function') {
                        console.log('[OK] Appel window.loadTrades()');
                        await window.loadTrades();
                    }

                    if (typeof window.loadJournalEntries === 'function') {
                        console.log('[OK] Appel window.loadJournalEntries()');
                        await window.loadJournalEntries();
                    }
                }

                // Autosync Tradovate (fire-and-forget). Si l'élève n'a pas
                // de connexion Tradovate, le backend renvoie 200 avec
                // synced={} — pas d'effet de bord.
                if (typeof window.tradovateAutosync === 'function') {
                    console.log('[AUTH] 🔄 Déclenchement autosync Tradovate...');
                    window.tradovateAutosync();
                }
            }, 500); // Attendre 500ms que l'UI soit prête

        } catch (err) {
            console.error('[ERROR] Erreur inattendue login:', err);
            alert('Erreur lors de la connexion');
        }
    }

    // ========================================
    // FONCTION : LOGIN COACH
    // ========================================
    async function coachLogin() {
        const coachEmail = document.getElementById('coachEmail').value.trim();
        const coachPassword = document.getElementById('coachCode').value;

        if (!coachEmail || !coachPassword) {
            const errorElement = document.getElementById('coachError');
            if (errorElement) {
                errorElement.textContent = 'Veuillez remplir tous les champs';
                errorElement.classList.remove('hidden');
            }
            return;
        }

        try {
            console.log('[COACH] Tentative de connexion coach:', coachEmail);

            const { data, error } = await supabase.auth.signInWithPassword({
                email: coachEmail,
                password: coachPassword
            });

            if (error) {
                console.error('[ERROR] Erreur auth coach:', error.message);
                const errorElement = document.getElementById('coachError');
                if (errorElement) {
                    errorElement.textContent = 'Email ou mot de passe incorrect';
                    errorElement.classList.remove('hidden');
                }
                return;
            }

            console.log('[OK] Authentification coach réussie');
            console.log('[USER] UUID coach:', data.user.id);

            const { data: coachData, error: coachError } = await supabase
                .from('users')
                .select('*')
                .eq('uuid', data.user.id)
                .eq('role', 'coach')
                .single();

            if (coachError || !coachData) {
                console.error('[ERROR] Utilisateur non coach ou erreur:', coachError);
                const errorElement = document.getElementById('coachError');
                if (errorElement) {
                    errorElement.textContent = 'Cet utilisateur n\'est pas un coach';
                    errorElement.classList.remove('hidden');
                }
                await supabase.auth.signOut();
                return;
            }

            window.currentUser = coachData;
            console.log('[OK] Connexion coach réussie:', coachData.email);
            // #19 — le coach est aussi soumis aux conditions (sur son propre compte).
            setTimeout(() => window.maybePromptLegalConsent && window.maybePromptLegalConsent(), 500);

            const authScreen = document.getElementById('authScreen');
            const mainApp = document.getElementById('mainApp');
            const coachApp = document.getElementById('coachApp');
            
            console.log('[DEBUG] Elements trouvés:', {
                authScreen: authScreen ? 'OUI' : 'NON',
                mainApp: mainApp ? 'OUI' : 'NON',
                coachApp: coachApp ? 'OUI' : 'NON'
            });
            
            // ✅ NETTOYAGE COMPLET : Réinitialiser l'état de coachApp
            if (coachApp) {
                // Forcer la visibilité et réinitialiser le style
                coachApp.style.display = 'none';  // D'abord cacher
                coachApp.style.visibility = 'visible';
                coachApp.style.opacity = '1';
                
                // Réinitialiser toutes les sections
                const sections = coachApp.querySelectorAll('.section');
                sections.forEach(section => {
                    section.classList.add('hidden');
                });
                
                console.log('[COACH] ✅ Nettoyage de coachApp effectué');
            }
            
            if (authScreen) authScreen.style.display = 'none';
            if (mainApp) {
                mainApp.style.display = 'none';  // Masquer l'interface élève
                mainApp.style.visibility = 'hidden';  // Forcer masquage complet
            }
            if (coachApp) coachApp.style.display = 'flex';  // Afficher l'interface COACH

            console.log('[DEBUG] showCoachSection existe?', typeof showCoachSection);
            console.log('[DEBUG] loadCoachDashboard existe?', typeof window.loadCoachDashboard);
            
            // Appliquer la route depuis l'URL si présente, sinon dashboard par défaut
            const routedFromUrl = typeof window.routeFromHash === 'function' && window.routeFromHash();
            if (!routedFromUrl) {
                if (typeof showCoachSection === 'function') {
                    console.log('[DEBUG] Appel de showCoachSection(coachDashboard)...');
                    await showCoachSection('coachDashboard');
                } else {
                    console.error('[ERROR] showCoachSection n\'existe pas !');
                }
            }

            if (typeof loadCoachRegistrationsFromSupabase === 'function') {
                await loadCoachRegistrationsFromSupabase();
            }
            // ⚠️ NE PAS appeler refreshAllModules() pour le Coach !
            // refreshAllModules() est uniquement pour les élèves

        } catch (err) {
            console.error('[ERROR] Erreur inattendue coach login:', err);
            const errorElement = document.getElementById('coachError');
            if (errorElement) {
                errorElement.textContent = 'Erreur lors de la connexion coach';
                errorElement.classList.remove('hidden');
            }
        }
    }

    // ========================================
    // FONCTION : REGISTER
    // ========================================
    async function register() {
        const registerName = document.getElementById('registerName').value.trim();
        const registerEmail = document.getElementById('registerEmail').value.trim();
        const registerPassword = document.getElementById('registerPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;

        if (!registerName || !registerEmail || !registerPassword || !confirmPassword) {
            alert('Veuillez remplir tous les champs');
            return;
        }

        if (registerPassword !== confirmPassword) {
            alert('Les mots de passe ne correspondent pas');
            return;
        }

        if (registerPassword.length < 6) {
            alert('Le mot de passe doit contenir au moins 6 caractères');
            return;
        }

        // #19 — Acceptation légale obligatoire.
        const legalAccept = document.getElementById('registerLegalAccept');
        if (!legalAccept || !legalAccept.checked) {
            alert('Vous devez accepter les CGV, CGU et la politique de confidentialité pour créer un compte.');
            return;
        }

        try {
            console.log('[REGISTER] Tentative d\'inscription:', registerEmail);

            const { data, error } = await supabase.auth.signUp({
                email: registerEmail,
                password: registerPassword
            });

            // Récupérer l'UUID même si il y a une erreur (l'utilisateur peut être créé quand même)
            let userUuid = data?.user?.id;

            if (error) {
                // Ignorer l'erreur "Database error saving new user" car on crée l'utilisateur manuellement après
                if (error.message.includes('Database error saving new user') || error.message.includes('User already registered')) {
                    console.warn('[WARN] Erreur Supabase Auth ignorée (on crée l\'utilisateur manuellement):', error.message);
                    
                    // L'utilisateur est créé malgré l'erreur, récupérer la session
                    const { data: sessionData } = await supabase.auth.getSession();
                    if (sessionData?.session?.user?.id) {
                        userUuid = sessionData.session.user.id;
                        console.log('[INFO] UUID récupéré depuis la session:', userUuid);
                    }
                } else if (!error.message.includes('email') && !error.message.includes('password')) {
                    // Ne pas afficher l'alerte si l'erreur est liée à l'email ou au mot de passe
                    console.warn('[WARN] Erreur inscription (ignorée):', error.message);
                } else {
                    console.error('[ERROR] Erreur inscription:', error.message);
                    alert('Erreur lors de l\'inscription: ' + error.message);
                    return;
                }
            }

            // Vérifier que l'UUID existe
            if (!userUuid) {
                console.error('[ERROR] UUID utilisateur manquant après inscription');
                alert('Erreur lors de l\'inscription: impossible de récupérer l\'identifiant utilisateur');
                return;
            }

            console.log('[OK] Inscription Supabase réussie');
            console.log('[USER] UUID:', userUuid);

            const { error: insertError } = await supabase
                .from('users')
                .insert({
                    uuid: userUuid,
                    name: registerName,
                    email: registerEmail,
                    role: 'student',
                    status: 'pending',
                    legal_accepted_at: new Date().toISOString()  // #19 consentement au signup
                });

            if (insertError) {
                console.error('[ERROR] Erreur insertion user:', insertError);
                console.error('[ERROR] Code:', insertError.code);
                console.error('[ERROR] Message:', insertError.message);
                console.error('[ERROR] Details:', insertError.details);
                
                // Si l'erreur est "duplicate key", c'est que l'utilisateur existe déjà
                if (insertError.code === '23505' || insertError.message.includes('duplicate')) {
                    console.log('[INFO] L\'utilisateur existe déjà dans users, connexion automatique...');
                    alert('Inscription réussie ! Connexion en cours...');
                    
                    // Remplir les champs de connexion et appeler login()
                    document.getElementById('loginEmail').value = registerEmail;
                    document.getElementById('loginPassword').value = registerPassword;
                    await login();
                    return;
                }
                
                alert('Erreur lors de la création du profil utilisateur: ' + insertError.message);
                return;
            }

            console.log('[OK] Profil utilisateur créé dans la base');
            alert('Inscription réussie ! Vous pouvez maintenant vous connecter.');

            if (typeof showLoginForm === 'function') {
                showLoginForm();
            }

        } catch (err) {
            console.error('[ERROR] Erreur inattendue register:', err);
            alert('Erreur lors de l\'inscription');
        }
    }

    // ========================================
    // FONCTION : LOGOUT
    // ========================================
    async function logout() {
        console.log('[LOGOUT] Déconnexion...');

        // 1. signOut local-only — kill la session client + storage sans appel réseau.
        //    Le scope 'global' par défaut attend le serveur ; s'il échoue, autoRefreshToken
        //    peut réécrire le jeton dans le storage juste après notre purge manuelle.
        try {
            const { error } = await supabase.auth.signOut({ scope: 'local' });
            if (error) console.warn('[LOGOUT] signOut error (on continue):', error);
        } catch (e) {
            console.warn('[LOGOUT] signOut a throw (on continue):', e);
        }

        // 2. Purge MANUELLE — couvre les cas où le custom adapter n'a pas nettoyé.
        try {
            [sessionStorage, localStorage].forEach(store => {
                Object.keys(store).forEach(k => {
                    if (/^sb-.*-auth-token/.test(k) || k === 'supabase.auth.token') {
                        store.removeItem(k);
                    }
                });
            });
        } catch (_) {}

        // 3. Reset état JS
        window.currentUser = null;
        window.currentUserAuthId = null;
        window.currentUserUuid = null;

        // 4. Reset URL — sinon routeFromHash() rebascule sur la dernière section.
        try { history.replaceState(null, '', '/'); } catch (_) {}

        // 5. Reload propre
        location.reload();
    }

    // ========================================
    // FONCTIONS UI
    // ========================================
    function showLoginForm() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const coachLoginForm = document.getElementById('coachLoginForm');
        
        if (loginForm) loginForm.style.display = 'block';
        if (registerForm) registerForm.style.display = 'none';
        if (coachLoginForm) coachLoginForm.style.display = 'none';
        
        console.log(' Formulaire login affiché');
    }

    function showRegisterForm() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const coachLoginForm = document.getElementById('coachLoginForm');
        
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'block';
        if (coachLoginForm) coachLoginForm.style.display = 'none';
        
        console.log(' Formulaire register affiché');
    }

    function showCoachLogin() {
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        const coachLoginForm = document.getElementById('coachLoginForm');
        
        if (loginForm) loginForm.style.display = 'none';
        if (registerForm) registerForm.style.display = 'none';
        if (coachLoginForm) coachLoginForm.style.display = 'block';
        
        console.log(' Formulaire coach login affiché');
    }

    // ========================================
    // FONCTION : RESTAURER LA SESSION AU CHARGEMENT
    // (la BDD reste la source de vérité — chaque requête est validée
    //  par RLS côté Supabase via le JWT que la lib gère pour nous)
    // ========================================
    async function restoreSession() {
        const authScreen = document.getElementById('authScreen');
        const mainApp = document.getElementById('mainApp');
        const coachApp = document.getElementById('coachApp');
        const userInfo = document.getElementById('userInfo');

        // 🛟 Garantie absolue : si on plante n'importe où, on remet la home en place.
        const ensureHomeVisibleOnFailure = () => {
            if (authScreen) authScreen.style.display = 'flex';
            if (mainApp) mainApp.style.display = 'none';
            if (coachApp) coachApp.style.display = 'none';
        };

        try {
            const { data: { session }, error } = await supabase.auth.getSession();
            if (error) {
                console.warn('[AUTH] getSession error:', error.message);
                ensureHomeVisibleOnFailure();
                return false;
            }
            if (!session || !session.user) {
                console.log('[AUTH] Aucune session active');
                ensureHomeVisibleOnFailure();
                return false;
            }

            // Source de vérité : BDD. Validation profil + statut AVANT tout changement d'UI.
            const { data: userData, error: userError } = await supabase
                .from('users').select('*').eq('uuid', session.user.id).single();

            if (userError || !userData) {
                console.warn('[AUTH] Profil introuvable / token invalide → signOut');
                try { await supabase.auth.signOut(); } catch (_) {}
                ensureHomeVisibleOnFailure();
                return false;
            }
            if (userData.status === 'revoked' || userData.status === 'pending') {
                console.warn('[AUTH] Statut bloquant:', userData.status);
                try { await supabase.auth.signOut(); } catch (_) {}
                ensureHomeVisibleOnFailure();
                return false;
            }

            // À partir d'ici, la session est validée par la BDD. On hydrate l'état.
            // authId reste TOUJOURS celui du compte loggé (le JWT ne change pas).
            window.currentUserAuthId = session.user.id;

            // ── COACH VIEW (#80) : override central. Si un state coach-view est actif ET
            //    que le compte loggé est bien un coach/admin, on hydrate currentUser avec la
            //    ligne de l'ÉLÈVE consulté → toutes les requêtes .eq('user_id', currentUser.uuid)
            //    pointent l'élève. Lecture seule garantie par la garde du client Supabase + CSS.
            let effectiveUser = userData;
            let coachViewing = false;
            if (window.CoachView && window.CoachView.isActive()) {
                // Le statut est déjà validé plus haut (revoked/pending → signOut) : on se fie au rôle.
                const isCoachAccount = ['coach', 'admin'].includes(userData.role);
                if (!isCoachAccount) {
                    console.warn('[COACH-VIEW] state présent mais compte non-coach → purge.');
                    window.CoachView.exit();
                    return false;
                }
                const viewedUuid = window.CoachView.getViewedUuid();
                const { data: studentRow, error: sErr } = await supabase
                    .from('users').select('*').eq('uuid', viewedUuid).single();
                if (sErr || !studentRow) {
                    console.warn('[COACH-VIEW] élève introuvable → purge.', viewedUuid);
                    window.CoachView.exit();
                    return false;
                }
                effectiveUser = studentRow;
                coachViewing = true;
                console.log('[COACH-VIEW] ✅ vue lecture seule du journal de', studentRow.email);
            }

            window.currentUser = effectiveUser;
            window.currentUserUuid = effectiveUser.uuid || session.user.id;
            // #19 — check légal (la fonction s'auto-skippe en coach-view via CoachView.isActive()).
            setTimeout(() => window.maybePromptLegalConsent && window.maybePromptLegalConsent(), 600);

            // En coach-view on force le rendu de la vue ÉLÈVE, quel que soit le rôle réel.
            const renderRole = coachViewing ? 'student' : userData.role;

            // Étape critique : on bascule l'UI. On encapsule pour pouvoir rollback.
            try {
                if (renderRole === 'coach') {
                    if (mainApp) mainApp.style.display = 'none';
                    if (coachApp) {
                        coachApp.style.display = 'flex';
                        coachApp.style.visibility = 'visible';
                        coachApp.style.opacity = '1';
                    }
                    if (authScreen) authScreen.style.display = 'none';
                    // Best-effort : si le routing échoue, ce n'est pas bloquant.
                    try {
                        const routedFromUrl = typeof window.routeFromHash === 'function' && window.routeFromHash();
                        if (!routedFromUrl && typeof showCoachSection === 'function') {
                            await showCoachSection('coachDashboard');
                        }
                    } catch (e) { console.warn('[AUTH] showCoachSection a échoué:', e); }
                    try {
                        if (typeof loadCoachRegistrationsFromSupabase === 'function') {
                            await loadCoachRegistrationsFromSupabase();
                        }
                    } catch (e) { console.warn('[AUTH] loadCoachRegistrations a échoué:', e); }
                } else {
                    if (coachApp) coachApp.style.display = 'none';
                    if (mainApp) {
                        mainApp.style.display = 'flex';
                        mainApp.style.visibility = 'visible';
                        mainApp.style.opacity = '1';
                    }
                    if (authScreen) authScreen.style.display = 'none';
                    if (userInfo) userInfo.textContent = effectiveUser.name || effectiveUser.email;
                    // Coach-view : bandeau lecture seule + grisage des écritures.
                    if (coachViewing && window.CoachView) {
                        try { window.CoachView.activateUI(); } catch (_) {}
                    }
                    try { if (typeof window.routeFromHash === 'function') window.routeFromHash(); }
                    catch (e) { console.warn('[AUTH] routeFromHash a échoué:', e); }
                    setTimeout(() => {
                        if (typeof window.refreshAllModules === 'function') {
                            window.refreshAllModules().catch(e => console.warn('[AUTH] refreshAllModules:', e));
                        }
                    }, 300);
                }
            } catch (uiErr) {
                console.error('[AUTH] Échec basculement UI → rollback vers home:', uiErr);
                ensureHomeVisibleOnFailure();
                return false;
            }

            console.log('[AUTH] ✅ Session restaurée pour:', userData.email, '(role:', userData.role + ')');
            return true;
        } catch (err) {
            console.error('[AUTH] Erreur restoreSession:', err);
            ensureHomeVisibleOnFailure();
            return false;
        }
    }

    // ========================================
    // ÉCOUTER LES CHANGEMENTS DE SESSION
    // (gère le refresh auto du token, signOut multi-onglets, etc.)
    // ========================================
    supabase.auth.onAuthStateChange((event, session) => {
        console.log('[AUTH] État:', event, session ? '(session active)' : '(pas de session)');
        if (event === 'SIGNED_OUT') {
            window.currentUser = null;
            window.currentUserAuthId = null;
            window.currentUserUuid = null;
            // Filet de sécurité — purge même en cas de signOut depuis un autre onglet.
            try {
                [sessionStorage, localStorage].forEach(store => {
                    Object.keys(store).forEach(k => {
                        if (/^sb-.*-auth-token/.test(k)) store.removeItem(k);
                    });
                });
            } catch (_) {}
        }
        // SIGNED_IN, TOKEN_REFRESHED : rien à faire, la lib gère le token automatiquement
    });

    // ========================================
    // EXPORT DES FONCTIONS
    // ========================================
    window.login = login;
    window.register = register;
    window.coachLogin = coachLogin;
    window.logout = logout;
    window.showLoginForm = showLoginForm;
    window.showRegisterForm = showRegisterForm;
    window.showCoachLogin = showCoachLogin;
    window.restoreSession = restoreSession;

    console.log('[OK] supabase-auth.js chargé - Fonctions exportées:',
        'login, register, coachLogin, logout, restoreSession, show*');
})();
