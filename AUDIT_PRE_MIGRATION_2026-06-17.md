# Audit Pré-Migration V2 — 2026-06-17

> Audit demandé par Trader 360 avant la mise en ligne pour les ~74 élèves payants prévue 2026-06-18.
> Scope : sécurité (RLS, secrets, auth), logique de calcul des métriques (P&L, win rate, PF, drawdown, R), parser/insertion trades, code health.

## 🚦 VERDICT GLOBAL : **GO avec 3 actions bloquantes avant migration**

La V2 est globalement saine. **3 problèmes méritent un fix avant la mise en ligne demain** (1 sécurité critique + 2 problèmes UX/data confiance). Le reste peut être traité post-migration sans risque.

### Actions bloquantes (P0 — à faire AVANT migration)

1. 🔴 **`nutrition_logs`** — table publique exposée sans RLS (potentiellement orphan, mais lisible/écrivable par n'importe quel anonyme). Soit la supprimer, soit activer RLS + créer policies.
2. 🔴 **Bug import CSV pnl=0** (#45) — déjà en cours côté Claude Code, à valider avant migration.
3. 🟠 **`student_statistics`** — vue en SECURITY DEFINER : peut leaker les stats de tous les élèves à n'importe quel user authentifié. À convertir en SECURITY INVOKER ou ajouter un filtre `WHERE user_id = auth.uid()` côté vue.

### Actions importantes (P1 — à faire dans la semaine post-migration)

4. 🟠 **Incohérence Win Rate** entre dashboard et export CSV (2 formules différentes — avec/sans exclusion break-even).
5. 🟠 **Incohérence Profit Factor** entre dashboard et export CSV (Avg PF vs Total PF, fallback différent).
6. 🟠 **`journal-images` bucket** : SELECT policy trop large permet de **lister tous les fichiers** des autres élèves (pas que d'y accéder par URL connue).

### Actions cosmétiques (P2 — quand tu auras le temps)

7. 6 fonctions PostgreSQL avec `search_path` mutable (vulnérabilité injection schéma — bas risque).
8. 4 fonctions SECURITY DEFINER exposées à `anon` (`can_manage_replays`, `can_view_replays`, `confirm_user_by_email`).
9. Policies dupliquées (rôles `{public}` ET `{authenticated}` simultanés sur `accounts`, `trades`, `journal_entries`) — résidu de migration, à nettoyer pour clarté.
10. Activer la protection "Leaked Password" (HaveIBeenPwned) dans Supabase Auth Settings.

---

## 1. SÉCURITÉ — Supabase RLS + secrets + auth

### 1.1 État global RLS

18 tables publiques inspectées. RLS activée sur **17/18**. Une seule exception : `nutrition_logs`.

| Table | RLS | Policies | Verdict |
|-------|-----|----------|---------|
| `nutrition_logs` | ❌ **DÉSACTIVÉE** | 0 | 🔴 **CRITIQUE** — exposée à tous |
| `account_costs`, `accounts`, `daily_fees`, `gamification_state`, `journal_entries`, `payouts`, `system_settings`, `trades`, `user_motivation`, `user_preferences`, `users` | ✅ | 4–8 par table | OK |
| `instrument_multipliers` | ✅ | 0 (intentionnel) | OK (table ref, accédée via trigger SECURITY DEFINER) |
| `trades_pnl_backup_20260514` | ✅ | 0 | OK (backup, bloquée volontairement) |
| `replay_views`, `replays`, `tradovate_credentials`, `tradovate_sync_state` | ✅ | 1–3 | OK |

### 1.2 Findings critiques Supabase Linter

#### 🔴 ERROR `rls_disabled_in_public` — `public.nutrition_logs`
Aucune référence à `nutrition_logs` dans le code (`grep` 0 résultat). Table probablement **orpheline** (héritée d'un autre projet ou test abandonné). **Action recommandée** : SUPPRIMER la table (`DROP TABLE public.nutrition_logs;`) plutôt que d'ajouter des policies sur du code mort.

#### 🔴 ERROR `security_definer_view` — `public.student_statistics`
Vue définie en SECURITY DEFINER → tourne avec les permissions du créateur (postgres), bypass les RLS de l'utilisateur. Si un élève appelle `SELECT * FROM student_statistics` → peut voir TOUS les students au lieu de soi-même.

**Action recommandée** : convertir en SECURITY INVOKER ET ajouter un check `is_coach()` ou filtre `user_id = auth.uid()` directement dans la vue.

Migration SQL suggérée :
```sql
ALTER VIEW public.student_statistics SET (security_invoker = true);
-- + ajouter une RLS appropriée à la vue si besoin
```

#### 🟠 WARN `public_bucket_allows_listing` — bucket `journal-images`
La policy "Public images are accessible to everyone" sur `storage.objects` permet à n'importe qui de **lister tous les fichiers** du bucket — pas juste d'y accéder par URL connue. Risque : un élève pourrait énumérer les screenshots de trades des autres.

**Action recommandée** : restreindre la SELECT policy aux URLs directes (ou à `owner = auth.uid()` pour la liste). Si les images sont déjà publiques par nature (logo, etc.), ignorer.

### 1.3 Findings WARN — Functions search_path

6 fonctions PostgreSQL ont un `search_path` mutable (vulnérabilité injection schéma, bas risque mais à corriger) :
- `calculate_winrate`
- `update_updated_at_column`
- `tradovate_credentials_touch_updated_at`
- `is_coach`
- `confirm_user_by_email`
- `calculate_trade_pnl`

Fix simple : pour chaque fonction, ajouter `SET search_path = public, pg_temp` dans la définition.

### 1.4 Findings WARN — SECURITY DEFINER exposées à anon

4 fonctions RPC SECURITY DEFINER appelables par `anon` :
- `can_manage_replays()`
- `can_view_replays()`
- `confirm_user_by_email(text)`

Si ces fonctions retournent des données sensibles ou écrivent en DB sans check d'authentification → fuite. **À auditer manuellement** : ouvrir chaque fonction et vérifier qu'elle ne fait rien de dangereux quand appelée par anon.

### 1.5 Auth

- 🟠 **Leaked Password Protection désactivée** — Supabase peut vérifier les mots de passe contre HaveIBeenPwned. À activer dans Auth Settings.
- Pas d'autres findings auth majeurs.

### 1.6 Policies dupliquées (cosmétique mais à nettoyer)

Sur `accounts`, `trades`, `journal_entries` : DOUBLE policies pour `{public}` ET `{authenticated}` (ex: `Users can view their own accounts` ET `accounts_select`). Probablement résidu de migration. Les `{authenticated}` sont plus restrictives, donc pas de risque sécurité. À nettoyer pour la lisibilité (supprimer les `{public}` redondantes).

### 1.7 Secrets dans le repo

✅ **`.gitignore` est correct** : `.env*`, `memory/`, `Roadmap_Journal_Trader360.md`, `CLAUDE.md`, `PROMPT_*.md` tous ignorés.
✅ Aucun secret en clair grepé (`sk_live_`, `re_*`, service keys, etc.) sauf dans `node_modules/` (lib externe, normal).

---

## 2. LOGIQUE DE CALCUL — métriques dashboard

### 2.1 Verdict général

⚠️ **Plusieurs implémentations des mêmes métriques** dans le code, avec des formules subtilement différentes. Aucun bug majeur, mais **risque d'incohérence visible** entre le dashboard, l'export CSV, et la card "Métriques du mois".

### 2.2 Win Rate — 2 formules en conflit

| Endroit | Formule | Inclut break-even ? |
|---------|---------|---------------------|
| Export CSV (l. 9592) | `wins.length / trades.length` | **OUI** (compte BE comme non-gagnés) |
| Dashboard header (l. 11818) | `winningTrades / decidedTrades` | **NON** (exclut BE du dénominateur) |
| Dashboard cards (l. 11896) | `winningTrades.length / filteredTrades.length` | **OUI** |
| Calendrier cellules (l. 12119) | `winningTrades / tradeCount` | **OUI** |
| Card "Métriques du mois" (l. 12551) | `wins.length / decided` | **NON** |

→ **Impact** : un élève qui voit "Win Rate 60%" en haut du dashboard et "Win Rate 55%" dans la card mois pourra se demander pourquoi.

**Recommandation** : aligner sur une seule définition (suggéré : exclure les break-even = plus juste tradeurement, comme Edgewonk/Tradervue) et créer un helper unique `computeWinRate(trades)`.

### 2.3 Profit Factor — 2 formules en conflit

| Endroit | Formule | Fallback si losses=0 |
|---------|---------|---------------------|
| Export CSV (l. 9593) | `avgWin / abs(avgLoss)` (**c'est l'Avg PF**) | `0` |
| Dashboard cards (l. 11900) | `grossProfit / grossLoss` (**Total PF**) | `99.99` |
| Dashboard barre (l. 11827) | `totalProfit / totalLoss` | `0` |
| Card "Métriques du mois" (l. 12563) | `totalProfit / totalLoss` | `Infinity` |

→ **Impact** : encore plus gênant que le win rate — l'export CSV peut afficher un PF complètement différent (Avg PF vs Total PF sont 2 concepts différents).

**Recommandation** : standardiser sur **Total PF** (`grossProfit / grossLoss`) partout, avec fallback explicite à `99.99` (et l'afficher comme "∞" si > 99).

### 2.4 Drawdown ✅

Une seule implémentation propre (ligne 13639+) :
```js
let maxDrawdown = 0;
const drawdown = maxPnl - cumulativePnl;
maxDrawdown = Math.max(maxDrawdown, drawdown);
```

Formule correcte (peak-to-trough sur cumulé). Pas de bug détecté.

### 2.5 Day Win % ✅

Plusieurs implémentations mais toutes alignées : `winningDays / totalTradedDays * 100`. Pas de bug.

### 2.6 R / RR (Risque par trade) ✅

Implémentation cohérente (livrée dans #55) :
- `monthRR = monthNetPnl / Σ(risk_per_trade des comptes actifs avec R défini)`
- Si pas de R défini → "— R" en gris
- Réutilisé dans canvas Instagram (#35) avec la même logique

Pas de bug. Bonne pratique.

### 2.7 Calcul P&L (côté trigger SQL + frontend)

🟡 **Architecture à 2 chemins** :
- **Manual_pnl envoyé** → le trigger SQL utilise directement la valeur (path 1)
- **Manual_pnl null** → le trigger calcule via `(exit-entry) × qty × multiplier - fees` (path 2)

Le bug #45 (en cours de fix) vient de cette dualité : pour ES/NQ/etc, le frontend force `manual_pnl=null` et compte sur le trigger pour calculer. C'est fragile.

**Recommandation post-migration** : faire que le frontend envoie TOUJOURS `manual_pnl` (déjà calculé côté JS, formule identique). Simplifierait la dette technique et éviterait des bugs futurs.

---

## 3. LOGIQUE DE CALCUL — trades (parser CSV + insertion)

### 3.1 Parser CSV multi-formats ✅

Le parser supporte 3 formats : **Tradeify**, **Trade Defy**, **TopStepX** (détection auto via header).

Mapping `symbol → instrument` : ✅ correctement géré (normalisation `ESH6 → ES`, `MNQ M5 → MNQ`, etc., lignes 6398-6406).

Détection LONG/SHORT : ✅ basée sur ordre temporel (`boughtTimestamp` vs `soldTimestamp`) pour Tradeify/Trade Defy, ou directe (`buy/sell`) pour TopStepX.

Fix #41 (recalcul P&L à l'édition) : ✅ déjà mergé, plus de bug.

### 3.2 Bug #45 — trade à P&L = 0$ (en cours de fix)

Voir prompt dédié : `PROMPT_chantier45_fix_csv_parser_trade_zero.md`. Cause complète identifiée (trigger SQL + politique frontend manual_pnl=null pour ES/NQ). Fix prévu en 2 couches (frontend + trigger).

### 3.3 Fees handling ✅

Logique correcte (ligne 6529-6557) : priorité aux frais du CSV, sinon fallback aux frais par défaut saisis par l'utilisateur. Soustraction propre (`pnl - abs(fees)`).

### 3.4 Merge duplicate trades ✅

Fonction `mergeDuplicateTrades()` (ligne 6587+) — bonne logique : fusionne les trades identiques (même date, symbol, type, prix, ±1 min sur l'heure d'entrée). Avec garde-fou anti-fusion cross-account.

### 3.5 Symbol normalization — un cas absent

Liste des préfixes normalisés : ES, MES, NQ, MNQ, GC, MGC. **Manquent** : RTY, MRTY, CL, MCL, SI, ZB, ZN, BTC, ETH (présents dans `instrument_multipliers` mais pas dans la normalisation).

**Impact** : un élève qui trade RTYH6 (Russell futures) va se retrouver avec `symbol='RTYH6'` au lieu de `RTY` → le trigger ne trouvera pas l'instrument → erreur "Instrument inconnu".

**Recommandation** : étendre la normalisation aux 9 instruments listés dans `instrument_multipliers` (P1).

---

## 4. CODE HEALTH — régressions, dead code, performance

### 4.1 Taille du monolithe

`index.html` = **~15 000 lignes**, contient HTML + CSS + ~12k lignes de JS inline.

⚠️ **Risque** : difficile à maintenir, scope hoisting global, conflits CSS, charge initiale lourde. Mais c'est **structurel V2**, pas à toucher dans le sprint actuel (#31 "Migration React" pour plus tard).

### 4.2 Console.logs en prod

Présents en grand nombre (`console.log`, `console.warn`, `console.error`). Pas critique mais pollution console pour les élèves qui ouvrent F12. À nettoyer post-migration (cibler les `console.log` purement debug, garder les `error/warn` utiles).

### 4.3 Anti-régression du sprint d'aujourd'hui

Les 2 features livrées aujourd'hui (#35 canvas Instagram, #59 mode Pause) ont été auditées au commit-par-commit :
- ✅ Calendrier dashboard 100% intact (vérifié sur le diff de #35)
- ✅ Dark/light toggle, slider opacité, dashboard customizer intacts (vérifiés sur le diff de #59)
- ✅ html2canvas retiré sans casser autre chose

### 4.4 Branches dormantes

3 branches Claude non-mergées listées dans la mémoire :
- `claude/feature-design-system-v2` (Atoms abandonnée — à DELETE)
- `claude/feature-polish-layer-v2` (mergée — à DELETE)
- `claude/design-coach-batch` (à arbitrer)

À nettoyer post-migration pour clarté Git.

### 4.5 Performance Vercel

✅ Plan Hobby OK. 1 cron/jour (`0 18 * * 1-5` pour Vimeo sync). Pas de risque limite.

---

## 5. RECOMMANDATIONS ORDONNÉES POUR LA MIGRATION

### Immédiat (avant 2026-06-18 — bloquant)

1. **Fixer #45** (déjà en cours côté Claude Code) → attendre le push + audit + merge
2. **`nutrition_logs`** → SQL : `DROP TABLE public.nutrition_logs;` (si confirmé orpheline) — quick win
3. **`student_statistics`** → SQL : `ALTER VIEW public.student_statistics SET (security_invoker = true);` + vérifier que le coach view fonctionne toujours après

### Cette semaine (post-migration, P1)

4. Aligner les formules Win Rate + Profit Factor sur une seule définition. Créer 2 helpers `computeWinRate(trades, { excludeBreakEven })` et `computeProfitFactor(trades)`.
5. Étendre la normalisation symboles dans parser CSV à RTY, MRTY, CL, MCL, SI, ZB, ZN, BTC, ETH (cf #45 — peut être groupé dans le même commit).
6. Restreindre la SELECT policy du bucket `journal-images` (interdire le listing massif).

### Ce mois (P2)

7. Fix `search_path` mutable sur les 6 fonctions PostgreSQL.
8. Auditer manuellement les 4 fonctions SECURITY DEFINER exposées à anon.
9. Nettoyer les policies dupliquées (10 à supprimer).
10. Activer la protection "Leaked Password" dans Supabase Auth.
11. Nettoyer les `console.log` de debug.
12. Supprimer les branches Git dormantes (`feature-design-system-v2`, `feature-polish-layer-v2`).

### Long terme (P3 / déjà dans le backlog)

13. Migration React (#31).
14. Refacto monolithe `index.html` (#8).

---

## Annexes

### Méthodologie
- Audit Supabase via MCP : `list_tables`, `get_advisors` (security), `execute_sql` direct sur prod (table `pg_policies`, `pg_tables`).
- Audit code via grep ciblés + Read sur les zones critiques.
- Vérification croisée code ↔ DB ↔ trigger ↔ runtime.

### Sources consultées
- `supabase-migrations/add_instrument_multipliers.sql`
- `fix_pnl_with_fees_v2.sql`
- `index.html` (sections : parser CSV 6282-6585, addTrade 2200-2310, métriques 11793-11935, drawdown 13639+)
- DB prod : tables `pg_policies`, `pg_tables`, `information_schema.columns`, advisor lint
