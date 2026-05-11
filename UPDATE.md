# UPDATE.md — Brief de passation pour une nouvelle instance Claude

**Destinataire** : prochaine instance Claude qui reprend ce projet.
**Auteur** : instance Claude précédente, fin de session 2026-05-11.
**Objectif** : tout ce qu'il faut savoir pour continuer sans recommencer l'exploration.

---

## 1. Identité du projet

**Nom** : Journal Trader 360 (alias "Club Trader 360")
**Type** : Journal de trading + plateforme de coaching (1 coach → N élèves traders).
**Repo (privé)** : `clubtrader360-dev/journal-trader-360-V2` (poussé en fin de session).
**Ancien repo** : `clubtrader360-dev/journal-trader-360` (V1, public, à NE PLUS utiliser — il contient un secret leakée dans son historique).
**Working directory local** : `/Users/daoud/Desktop/Desktop/Website`
**Git user local** : `Hend Daoud <henddaoud1011@gmail.com>` (mais le user qui pilote Claude est metoui.greg.j@gmail.com — c'est une machine partagée).

---

## 2. Stack technique

| Couche | Tech |
|---|---|
| Frontend | SPA monolithique HTML/CSS/JS vanilla dans `index.html` (~2 MB, ~13.5k lignes) |
| Backend | **Aucun backend custom** — tout passe par Supabase depuis le client |
| DB + Auth + Storage | Supabase (PostgreSQL, RLS, Supabase Auth, bucket `journal-images`) |
| Charts | Chart.js (CDN) |
| Cron | Vercel cron → `api/cron/weekly-report.js` → email via Resend |
| Tradovate | Routes serverless Vercel `api/tradovate/*` (ajouté récemment par le user) |
| Hosting prod | Vercel (statique + serverless functions) |
| Dev local | `dev-server.py` (Python SPA-friendly, voir §10) |

CDN externes utilisés (lignes en haut d'`index.html`) :
- `@supabase/supabase-js@2.39.0`
- `chart.js@4.5.0`
- `html2canvas@1.4.1`

---

## 3. Structure du repo

```
.
├── index.html                    # SPA complet, ~2 MB, ~13500+ lignes
├── coach-dashboard.js            # Dashboard coach (KPIs, graphes)
├── supabase-config.js            # Init du client Supabase + escapeHtml helper
├── supabase-auth.js              # Login/register/coachLogin/restoreSession/logout
├── supabase-trades.js            # CRUD trades + comptes de trading
├── supabase-journal.js           # Notes quotidiennes (texte, émotions, images)
├── supabase-payouts.js           # Retraits/paiements
├── supabase-motivation.js        # "Mon Pourquoi" (texte + image)
├── supabase-account-costs.js     # Coûts d'accès comptes (FTMO, challenges)
├── supabase-daily-fees.js        # Frais quotidiens (commissions)
├── supabase-coach.js             # Logique coach (élèves, stats consolidées)
├── supabase-tradovate.js         # NEW : intégration Tradovate (ajout user récent)
├── api/cron/weekly-report.js     # Vercel cron : email hebdo via Resend
├── api/tradovate/                # NEW : routes serverless Tradovate
│   ├── connect.js                # Stocke creds élève (chiffrement AES-256-GCM)
│   ├── disconnect.js
│   ├── status.js
│   ├── sync.js                   # Sync auto des trades depuis Tradovate
│   └── _lib/
│       ├── auth.js               # Auth Tradovate API
│       ├── client.js             # HTTP client Tradovate
│       ├── crypto.js             # AES-256-GCM, clé via TRADOVATE_ENCRYPTION_KEY
│       └── aggregator.js         # Aggrégation des positions → trades
├── supabase-migrations/          # Migrations versionnées
│   ├── add_no_trade_column.sql
│   └── add_user_motivation_table.sql   # SEUL fichier où on voit RLS activé
├── MIGRATION_COMPLETE.sql        # Migration master (à passer dans Supabase SQL Editor)
├── migration_*.sql               # Migrations incrémentales (méthode, journal, trades)
├── migration_tradovate.sql       # NEW : tables tradovate_credentials, tradovate_sync_state
├── add_methode_columns.sql       # Ajout colonnes méthode
├── add_image_url_2_column.sql
├── fix_pnl_with_fees_v2.sql      # Fix P&L (v1 supprimée — v2 est la bonne)
├── recalculate_all_pnl.sql
├── vercel.json                   # Crons + rewrites SPA
├── dev-server.py                 # Serveur dev local SPA-aware
├── package.json
├── .gitignore                    # Créé en session — voir §10
├── .env.example                  # Créé en session — voir §10
└── trader360-logo.png            # Asset source du logo (le logo est déjà bakké en base64 dans index.html)
```

---

## 4. Routing — URLs propres (changement majeur de cette session)

Avant cette session : pas d'URL, la navigation passait par `display: none/block` JS, le refresh ramenait toujours sur la même section.

Maintenant : **History API + URLs propres**.

### Schéma d'URLs

| URL | Section HTML |
|---|---|
| `/` | Défaut (login si pas authed, dashboard si authed) |
| `/dashboard` | `#dashboard` |
| `/tradelog` | `#tradelog` |
| `/dailyjournal` | `#dailyjournal` |
| `/accounting` | `#accounting` |
| `/checklist` | `#checklist` |
| `/motivation` | `#motivation` |
| `/playbook`, `/calendar`, `/insights` | Sections existantes mais sans entrée sidebar |
| `/connections` | NEW (user a ajouté la section ; voir §8) |
| `/coach/dashboard` | `#coachDashboard` |
| `/coach/students` | `#coachStudents` |
| `/coach/accounting` | `#coachAccounting` |
| `/coach/registrations` | `#coachRegistrations` |

### Implémentation

- **`showSection(name)`** dans `index.html` ~ligne 8158 (`async function showSection`). Refacto : remplace `event.target.classList.add('active')` (fragile) par `querySelector('.sidebar-item[data-section="X"]')`. Push `/<name>` via `history.pushState`.
- **`showCoachSection(name)`** ~ligne 12343. Idem, push `/coach/<sub>` (où sub = name sans préfixe `coach` en lowercase).
- **`window.routeFromUrl()`** ~ligne 8047. Lit `window.location.pathname`, mappe vers la section, appelle la bonne fonction. Alias `window.routeFromHash` conservé pour compat avec les appels existants dans `supabase-auth.js`.
- **Listener `popstate`** ~ligne 8084. Gère back/forward navigateur.
- **`supabase-auth.js`** — `routeFromUrl()` appelé après chaque set `display = 'flex'` de `mainApp` / `coachApp` (login, login coach, restoreSession × 2 branches). Permet de refresh sur n'importe quelle URL et retomber sur la bonne section après auth.
- **`<script src>` rendus absolus** : `<script src="/X.js">` partout. Sinon le navigateur résout en relatif depuis l'URL profonde (ex: depuis `/coach/students`, `supabase-config.js` → `/coach/supabase-config.js` qui ne marche pas).

### ⚠️ Bug connu non résolu — double définition de `showSection`

**`index.html` ligne 2356** redéfinit `window.showSection = function(sectionId) { ... }` *après* l'init (à l'intérieur du callback `window.load`, après détection des modules Supabase chargés). Cette version :
- Utilise `style.display = 'none'/'block'` au lieu de `classList.add/remove('hidden')`
- Utilise `event.target.closest('.sidebar-item')` (fragile)
- **NE PUSH PAS l'URL**

Donc en pratique, **quand l'utilisateur clique dans la sidebar, l'URL ne change pas** (parce que c'est cette version-là qui gagne la race). Le routing marche **uniquement** sur :
- Refresh d'une URL (parce que `restoreSession` appelle `routeFromUrl` qui appelle `showSection` AVANT que l'override prenne effet — race conditionnelle).
- Back/forward navigateur (popstate → routeFromUrl → ma showSection mais l'override l'écrase à nouveau dès qu'on re-clique).

**Fix recommandé** : soit supprimer l'override ligne 2356, soit la faire déléguer à ma version (`window.showSection = showSection;`). Attention à ne pas perdre la logique `aria-current="page"` qui est dans l'override mais pas dans ma version.

---

## 5. Modules métier (fichiers `supabase-*.js`)

| Fichier | Rôle |
|---|---|
| `supabase-auth.js` | `login()`, `register()`, `coachLogin()`, `logout()`, `restoreSession()` |
| `supabase-trades.js` | CRUD trades, gestion comptes (FTMO/Tradeday), calcul P&L |
| `supabase-journal.js` | Notes quotidiennes : texte, émotions before/after, rating, 2 images (upload Supabase Storage bucket `journal-images`) |
| `supabase-payouts.js` | Retraits |
| `supabase-motivation.js` | Section "Mon Pourquoi" |
| `supabase-account-costs.js` | Coûts d'accès comptes |
| `supabase-daily-fees.js` | Frais quotidiens |
| `supabase-coach.js` | Liste élèves, approbations, stats consolidées (⚠️ N+1 queries) |
| `supabase-tradovate.js` | NEW — UI Tradovate côté client |

Toutes ces fonctions sont exposées sur `window.*` (le code attache à `window` partout, pas de modules ES).

**Statuts utilisateurs** (`users.status`) :
- `pending` : attente validation coach
- `active` : OK
- `revoked` : bloqué (signOut auto)

**Rôles** (`users.role`) : `student` ou `coach`.

---

## 6. Modèle de données (Supabase Postgres)

Tables identifiées depuis le code + migrations :

| Table | Rôle |
|---|---|
| `users` | uuid, email, name, role, status, created_at |
| `accounts` | comptes de trading (user_id, account_name, account_size, type, date_opened) |
| `trades` | trades individuels (user_id, account_id, symbol, entry/exit_price, quantity, manual_pnl, direction_multiplier, date) |
| `journal_entries` | notes (user_id, entry_date, content, emotion_before/after, session_rating, image_url(_2), no_trade_today, positive_points, errors JSON) |
| `daily_fees` | frais quotidiens |
| `account_costs` | coûts d'accès comptes |
| `payouts` | retraits |
| `user_motivation` | "Mon Pourquoi" |
| `tradovate_credentials` | NEW — creds Tradovate des élèves, chiffrées AES-256-GCM |
| `tradovate_sync_state` | NEW — état de sync (last_sync_at, etc.) |

Bucket Storage : `journal-images` (public).

### ⚠️ RLS — état à vérifier impérativement

Dans les migrations versionnées (`supabase-migrations/`), **seule `user_motivation` a des policies RLS** (`auth.uid() = user_id` pour SELECT/INSERT/UPDATE/DELETE).

**Toutes les autres tables n'ont aucune migration documentant leurs policies.** Soit elles ont été créées manuellement dans le dashboard Supabase (vraisemblable, le user a dit "tout est enabled"), soit elles n'ont pas de RLS.

**Requête à exécuter dans Supabase SQL Editor pour vérifier** :
```sql
SELECT tablename, policyname, cmd, qual AS using_expr, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

Toute table sans policy `auth.uid() = user_id` (ou équivalent côté coach) = **fuite de données possible** avec la clé Supabase anon publique.

---

## 7. Backend / Vercel

### `vercel.json`
```json
{
  "crons": [
    { "path": "/api/cron/weekly-report", "schedule": "0 19 * * 0" }
  ],
  "rewrites": [
    { "source": "/((?!api/|.*\\..*).*)", "destination": "/index.html" }
  ]
}
```

- **Cron** : email hebdo dimanche 19h UTC.
- **Rewrites** : toute URL non-`/api/*` et sans extension → `/index.html` (indispensable pour que `/dashboard`, `/coach/students` etc. fonctionnent en refresh).

### `api/cron/weekly-report.js`
Vercel function. Lit env vars `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (admin), `RESEND_API_KEY`, optionnellement `CRON_SECRET` pour auth header.

### `api/tradovate/*` (NEW, ajouté en parallèle par le user)
Routes serverless. Lit env var `TRADOVATE_ENCRYPTION_KEY` (clé AES-256-GCM, 64 hex chars). Si perdue : tous les credentials chiffrés en DB deviennent illisibles. Si leakée : creds en DB déchiffrables → faire rotater immédiatement.

---

## 8. Intégration Tradovate (entièrement codée par le user, pas par moi)

**Disclaimer** : je n'ai PAS écrit cette intégration. Le user l'a ajoutée en parallèle de mes modifs de routing/cleanup. Je la documente ici après l'avoir lue.

### Vue d'ensemble

Le flow est : un élève rentre ses identifiants Tradovate (demo ou live) → on chiffre les creds côté serveur (AES-256-GCM) → on les stocke en DB → un cron/sync va chercher les fills Tradovate, les agrège en trades, et les push dans la table `trades` de l'élève.

```
[Frontend]                    [Vercel serverless]            [Tradovate API]    [Supabase DB]
supabase-tradovate.js  ──→   api/tradovate/connect   ──→   POST /auth         ──→  tradovate_credentials (chiffré)
                       ──→   api/tradovate/status            (validation)
                       ──→   api/tradovate/sync     ──→   GET /fills          ──→  tradovate_sync_state + trades
                       ──→   api/tradovate/disconnect
```

### Routes serverless (`api/tradovate/*.js`)

Toutes auth via **Bearer Supabase JWT** dans le header `Authorization`. Helper `requireUser(req)` dans `_lib/auth.js` : envoie le token à `supabase.auth.getUser(token)` côté serveur — si Supabase renvoie un user, le token est valide. Pas de vérif de signature manuelle.

| Route | Méthode | Body | Effet |
|---|---|---|---|
| `/api/tradovate/connect` | POST | `{ env: 'demo'\|'live', username, password }` | 1) Appelle Tradovate `/auth/accesstokenrequest` pour valider les creds. 2) Si OK, chiffre `username` + `password` (AES-256-GCM, 3 champs par champ : ciphertext+iv+authTag, tous en base64). 3) Upsert dans `tradovate_credentials` avec onConflict `(user_id, env)`. Renvoie `{ ok, env, expiresAt }`. |
| `/api/tradovate/status` | GET | — | Renvoie l'état des connexions par env (sans les creds) + comptes synchronisés. Forme : `{ envs: { demo: { connected, last_synced_at, last_sync_status, accounts: [...] }, live: {...} } }` |
| `/api/tradovate/sync` | POST | (vide) | Déchiffre les creds, demande un fresh token à Tradovate, paginé : récupère les `fills` depuis `last_fill_id`, les agrège en trades via `_lib/aggregator.js`, INSERT dans `trades` + UPDATE `tradovate_sync_state.last_fill_id`. Renvoie `{ total_trades }`. |
| `/api/tradovate/disconnect` | POST | `{ env }` ou `{ all: true }` | DELETE des creds + sync_state. **Ne touche pas aux trades déjà importés** — l'élève garde son historique. |

### Backend libs (`api/tradovate/_lib/`)

| Fichier | Rôle |
|---|---|
| `auth.js` | `requireUser(req)`, `getServiceClient()` (Supabase service_role, bypass RLS — filtrage manuel par `user_id`), `httpError(status, msg)`, `readJson(req)` (parse stream, marche en `vercel dev` et en prod). |
| `crypto.js` | `encrypt(plaintext)` → `{ ciphertext, iv, authTag }` (base64). `decrypt({ciphertext, iv, authTag})` → plaintext. AES-256-GCM via `node:crypto`. Clé hex 64-char dans `process.env.TRADOVATE_ENCRYPTION_KEY`. Throw si manquante ou de mauvaise taille. |
| `client.js` | HTTP client Tradovate : `requestAccessToken({env, username, password})`, `listFills(...)`, `listAccounts(...)`. Gère le base URL différent selon env (`demo.tradovateapi.com` vs `live.tradovateapi.com`). Custom `TradovateError` pour distinguer une 401 de l'API d'une erreur réseau. |
| `aggregator.js` | Transforme une liste de `fills` Tradovate (chaque exécution partielle) en `trades` (entry+exit complets) côté front. Logique de matching open/close par compte+symbol+side. |

### Schéma DB Tradovate (`migration_tradovate.sql`)

Deux tables (RLS À VÉRIFIER en dashboard Supabase) :

- **`tradovate_credentials`** : `(user_id, env)` primary key composite. Colonnes chiffrées : `encrypted_username/password`, `username_iv`, `username_auth_tag`, `password_iv`, `password_auth_tag` (tout en base64). + cache du dernier token Tradovate + statut sync.
- **`tradovate_sync_state`** : `(user_id, env, tradovate_account_id)` — par compte Tradovate. Garde `last_fill_id`, `last_synced_at`, `fills_imported_total`, `trades_created_total` pour la pagination incrémentale.

### Frontend (`supabase-tradovate.js`)

**Section UI** : `#connections` (`index.html:3681+`). Item sidebar `#connections` data-section="connections" (ligne 2614). Quand l'utilisateur clique ou navigue à `/connections`, le handler dans `showSection` ligne ~8225 appelle `window.tradovateRefreshStatusUI()`.

**Architecture du module** :

```js
authedFetch(path, { method, body })
  ├── lit la session Supabase via window.supabaseClient.auth.getSession()
  ├── envoie `Authorization: Bearer ${session.access_token}` à /api/tradovate${path}
  └── throw err.status / err.detail sur non-2xx
```

**Fonctions principales** (toutes IIFE-scopées, pas exposées sauf API publique en bas) :
- `refreshStatus()` — GET `/status`, render dans `#tradovateStatusContainer`.
- `renderStatus(container, byEnv)` — génère les cartes par env (demo/live), bouton Sync + Disconnect par env. Utilise `window.escapeHtml` (depuis `supabase-config.js`) pour échapper tout texte qui vient de la DB.
- `handleConnect(event)` — bind sur `#tradovateConnectForm`. Lit env/username/password, POST `/connect`, en cas de succès → reset form + `runSync({silent: false})` + `refreshStatus()`.
- `runSync({silent})` — POST `/sync`. Guard `syncInFlight` pour éviter double-sync concurrent. Toast UI si non-silent. Appelle `window.refreshAllModules()` pour que le journal voie les nouveaux trades.
- `handleDisconnect(env)` — confirm dialog, POST `/disconnect`, refresh status.
- `showToast(message, kind, autoCloseMs)` — toast minimal sans dépendance (DOM élément fixed bottom-right).
- Délégation de clic globale : `document.addEventListener('click')` qui intercepte `[data-action="tradovate-sync"]` et `[data-action="tradovate-disconnect"]`.

**API publique exposée sur `window`** :
```js
window.tradovateAutosync()         // fire-and-forget runSync silencieux
                                    // appelé par supabase-auth.js après login
window.tradovateRefreshStatusUI()  // rebind form + refresh status
                                    // appelé par showSection quand on entre dans /connections
```

### Comment ça s'utilise côté front

1. **L'élève se connecte** (Supabase login) → `supabase-auth.js` doit appeler `window.tradovateAutosync()` quelque part dans le flow post-login si on veut sync auto. **À VÉRIFIER** : je ne suis pas sûr que cet appel soit posé. Recherche `tradovateAutosync` dans `supabase-auth.js`.
2. **L'élève va sur l'onglet Connexions** (`/connections`) → showSection charge la section, appelle `tradovateRefreshStatusUI()` → fetch `/status` → affiche cartes Demo/Live.
3. **Si non connecté pour cet env** → carte "Non connecté", l'élève remplit le `#tradovateConnectForm` (radio env + username + password). Submit → POST `/connect` → si OK, sync immédiat lancé + statut rafraîchi.
4. **Si connecté** → carte "Tradovate connecté" + liste comptes Tradovate + bouton "Sync maintenant" + "Déconnecter".
5. **Bouton Sync maintenant** → POST `/sync` avec toast progress. À la fin appelle `refreshAllModules()` pour que les nouveaux trades apparaissent dans le tradelog.

### Sécurité

- Les creds Tradovate **ne quittent jamais le serveur en clair**. Chiffrement AES-256-GCM avec une clé en env var Vercel (`TRADOVATE_ENCRYPTION_KEY`).
- Authentification via Supabase JWT — le frontend ne stocke pas de secret Tradovate.
- Les routes serverless utilisent `service_role` (bypass RLS) MAIS filtrent toujours par `user_id == auth.uid` extrait du JWT. C'est sain à condition que personne n'ajoute une query sans ce filtre.
- ⚠️ **À vérifier** : les policies RLS sur `tradovate_credentials` et `tradovate_sync_state`. Comme les routes utilisent service_role, RLS n'est pas appelé par l'API. Mais si quelqu'un fait un `supabaseClient.from('tradovate_credentials').select(...)` côté FRONT avec la clé anon, il faut absolument que RLS bloque (sinon les `encrypted_username` etc. sont lisibles).

### `supabase-config.js` — helper ajouté par le user

```js
window.escapeHtml = function(value) {
    // échappe & < > " ' ` / pour neutraliser XSS stockées
};
```
Utilisé partout dans `supabase-tradovate.js` (et probablement ailleurs dans le code récent du user) pour interpoler du contenu DB dans des template strings de `innerHTML`. **Bonne pratique à généraliser** sur le reste du code legacy.

---

## 9. Sécurité — état détaillé

### ✅ Fait
- `.gitignore` créé (exclut `.env*` sauf `.env.example`, `node_modules`, `.vercel`, OS junk).
- `.env.example` créé avec toutes les vraies variables à définir.
- Clé Resend hardcodée retirée de `test-email.js` (fichier ensuite supprimé entièrement).
- Commentaire SECURITY dans `supabase-config.js` clarifiant que la clé anon est publique by design (vraie défense = RLS).

### ⚠️ À faire impérativement par le owner
1. **Révoquer la clé Resend `re_fKHnUNaD_GUGaLdbGP7bsoxapnLSWUwJ6`** sur https://resend.com/api-keys. Elle est dans l'historique git public de **V1** (commit `93261d0` du 2026-04-27), donc compromise. Générer une nouvelle clé et la mettre **uniquement dans Vercel Env Vars**.
2. **Auditer RLS** sur Supabase via la requête `pg_policies` ci-dessus (§6).
3. **Vérifier `TRADOVATE_ENCRYPTION_KEY`** : doit être en env var Vercel, pas dans le code.
4. **Le repo V2 a un historique propre** (un seul commit créé en cette session, sans l'ancien `93261d0` polluant). Mais V1 reste public avec la clé visible — il faudrait soit supprimer/archiver V1 soit purger l'historique.

### Clé Supabase anon dans `supabase-config.js`
```
https://zgihbpgoorymomtsbxpz.supabase.co
eyJhbG...role:"anon"...
```
**N'est PAS un secret.** Exposée par design. Sa sécurité dépend des policies RLS (§6).

---

## 10. Dev local

### Démarrer le serveur
```bash
python3 dev-server.py 8000
```
→ http://localhost:8000

Le `dev-server.py` est un serveur HTTP Python qui fait :
- Sert les fichiers statiques normalement (avec bon `Content-Type`).
- **SPA fallback** : pour toute URL qui n'a pas d'extension (ex: `/dashboard`, `/coach/students`) ET qui ne commence pas par `/api/`, renvoie `index.html`. Permet le refresh sur n'importe quelle route.
- **NE PAS rewrite** les URLs avec extension (`/foo.js`, `/img/x.png`) — renvoie 404 propre. Sinon le navigateur reçoit du HTML quand il attend du JS et tout casse silencieusement.

⚠️ Pour les fonctions serverless `api/cron/*`, `api/tradovate/*` : Python http.server ne sait pas les exécuter. Pour les tester en local, il faut `vercel dev` (port 3000, défini dans `package.json`).

```bash
npm install
npx vercel dev
```

### `.env.example` (template)
Variables à définir en local dans un `.env` (jamais commité) ou en prod dans Vercel Env Vars :
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (admin DB, ⚠️ CONFIDENTIEL)
- `RESEND_API_KEY` (⚠️ CONFIDENTIEL)
- `CRON_SECRET` (recommandé pour auth header cron)
- `TRADOVATE_ENCRYPTION_KEY` (⚠️ CONFIDENTIEL — 64 hex chars via `openssl rand -hex 32`)

---

## 11. Changelog de la session (ce que j'ai fait)

### Cleanup
- Supprimé 31 fichiers :
  - 3 scripts test JS (`test-email.js`, `test-email-new.js`, `test-weekly-report-backup.js`)
  - 3 build artifacts logo (`trader360-logo-base64.txt`, `temp-logo-section.txt`, `insert-logo.sh`)
  - 1 CSV vide (`tradovate_example.csv`)
  - 22 fichiers `.md` de doc (TOUS les guides/notes/correctifs hérités du V1)
  - 2 SQL obsolètes (`fix_pnl_with_fees.sql` v1, `diagnostic_methode.sql`)
- Logo PNG (`trader360-logo.png`) conservé comme asset source (mais déjà bakké en base64 dans `index.html`).

### Sécurité
- `.gitignore` créé.
- `.env.example` créé.
- Clé Resend leakée retirée de `test-email.js` (puis le fichier a été supprimé).
- Commentaire SECURITY dans `supabase-config.js`.

### Routing (clean URLs via History API)
- Ajout `data-section="X"` sur chaque item sidebar trader (`index.html:2596-2614`).
- Refacto `showSection` (`index.html:8158`) — push URL, pas de dépendance `event.target`.
- Refacto `showCoachSection` (`index.html:12343`) — push URL `/coach/<sub>`.
- Ajout `routeFromUrl` + listener `popstate` (`index.html:8042-8094`).
- Modif `supabase-auth.js` aux 3 endroits où `mainApp`/`coachApp` deviennent visibles (login élève, login coach, restoreSession × 2 branches) pour appeler `routeFromUrl` après.
- `<script src="X.js">` → `<script src="/X.js">` partout (10 scripts).

### Infra
- `vercel.json` : ajout des `rewrites` SPA.
- `dev-server.py` créé (serveur Python avec SPA fallback intelligent).

### Git
- Tous les changements commités en un seul commit (`chore: cleanup + clean-URL routing + Tradovate integration + dev tooling`).
- Remote changé de V1 vers V2.
- Push vers `clubtrader360-dev/journal-trader-360-V2` réussi sur `main`.

---

## 12. Problèmes ouverts / à investiguer

### 🔥 Bloquant pour l'utilisateur
Le user a signalé en fin de session : **"la page d'accueil ne s'affiche plus ni le form de connexion, uniquement en responsive"**. Je n'ai PAS résolu ce bug. Hypothèses non confirmées :

1. **Cache navigateur** — le user devrait essayer Cmd+Shift+R (hard reload).
2. **Double définition `showSection`** (§4) — la version override (ligne 2356) écrase la mienne. Si une erreur survient dans le code init (par exemple à cause de l'ajout `connections` ou de l'init Tradovate), la chaîne `attach()` des handlers de login peut casser → boutons morts (effectivement déjà observé : "[ERROR] Timeout : Les fonctions n'ont pas ete chargees apres 10 secondes" dans la console).
3. **Règle CSS responsive `#mainApp.flex, #coachApp.flex { display: block !important; }`** à `index.html:1325` — en responsive (<1024px) ça force `mainApp`/`coachApp` à display:block même quand `style="display:none"`. Ça pourrait expliquer pourquoi quelque chose s'affiche en responsive et pas en desktop : peut-être que dans la sidebar fermée de coachApp (en mode mobile sans authed), on voit du contenu qui en desktop reste masqué parce que l'inline `display:none` s'applique correctement.
4. **JS error** dans un des fichiers ajoutés par le user (Tradovate, `connections`) qui empêche `window.login`, `window.register`, `window.coachLogin` d'exister → le check init au load timeout après 10s.

**Approche recommandée pour la prochaine instance** :
1. Ouvrir DevTools console et lire les vraies erreurs JS au refresh.
2. Vérifier la séquence d'init : est-ce que les 10 scripts loadent en 200 ? Est-ce que `window.login` est défini après ? Si non, lequel fail ?
3. Inspecter `authScreen.style.display` et `getComputedStyle(authScreen).display` en console.
4. Vérifier si une erreur d'exécution dans `supabase-tradovate.js` ou un des modules cassse l'init.

### 🟡 Bugs latents identifiés
- **Double `showSection`** : voir §4. À fixer en supprimant l'override ligne 2356 ou en la faisant déléguer à la version refacto.
- **Perf coach dashboard** : N+1 queries (1 + 250×4 requêtes pour 250 élèves), filtrage côté client, P&L recalculé en boucle. Documenté dans l'ancien `AUDIT_REPORT.md` (supprimé, mais le diagnostic reste).
- **RLS partielle** : à vérifier impérativement (§6).
- **Section `connections` ajoutée mais routing non testé** par moi en bout de session.

### 🟢 Améliorations possibles
- Découper `index.html` (2 MB monolithique → modules).
- Migrer P&L côté serveur (vue Postgres ou trigger).
- Versioning propre des migrations SQL (actuellement éparpillées entre racine et `supabase-migrations/`).

---

## 13. Commandes utiles

```bash
# Démarrer dev server
python3 dev-server.py 8000

# Tester routes (depuis terminal)
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:8000/dashboard
curl -s -o /dev/null -w "%{http_code} %{content_type}\n" http://localhost:8000/coach/students

# Voir tous les scripts chargés par index.html
grep -oE '<script[^>]*src="[^"]+"' index.html | grep -v 'https://'

# Chercher une fonction
grep -n "function showSection" index.html

# Rappel : NE PAS lire index.html en entier (2 MB, dépasse les limites de tokens).
# Toujours utiliser grep -n pour trouver la ligne puis Read avec offset/limit.

# Logs serveur
tail -f /tmp/jt360-server.log

# Statut git
git status
git log --oneline -10

# Push
git push origin main
```

---

## 14. Style / préférences du user

- **Très direct, peu de patience pour les hedges**. Si tu proposes plusieurs options, choisis-en une et présente-la — ne demande pas systématiquement quelle option.
- **Aggressif sur le cleanup** : quand il dit "supprime tout X", il veut TOUT X, pas une sous-sélection prudentielle. Une feedback memory est sauvée à ce sujet dans `~/.claude/projects/-Users-daoud-Desktop-Desktop-Website/memory/feedback_aggressive_cleanup.md`.
- Code écrit en JS vanilla, pas de framework. Pas de TS. Style direct (pas de surcommentaires, pas d'abstractions inutiles).
- Réponses courtes, factuelles. Pas d'emojis sauf si le user en met.

---

## 15. TL;DR pour reprendre la main

1. **Ouvrir** `/Users/daoud/Desktop/Desktop/Website/` dans Claude Code.
2. **Lire ce fichier** (`UPDATE.md`) en intégralité.
3. **Démarrer** `python3 dev-server.py 8000`.
4. **Ouvrir** http://localhost:8000 dans Chrome, DevTools console ouverte.
5. **Diagnostiquer le bug actuel** : pourquoi la page d'accueil ne s'affiche pas en desktop ? Voir §12.
6. **Vérifier RLS** : faire passer la requête `pg_policies` (§6) au user, lui demander le résultat.
7. **Ne PAS lire `index.html` en entier** — toujours grep + offset/limit.
8. **Ne PAS recommiter les .md supprimés** — le user les veut HORS du repo (sauf celui-ci, demandé explicitement).
