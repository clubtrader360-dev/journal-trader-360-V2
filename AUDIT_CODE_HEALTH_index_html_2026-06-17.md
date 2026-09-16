# Audit Code Health — `index.html` 2026-06-17

> Audit demandé par Trader 360 pour identifier ce qui peut être nettoyé **sans aucune régression** sur la V2.
> Cible : `index.html` (~15 331 lignes : HTML + CSS + ~12k lignes JS inline).

## 🚦 Verdict global : **bon état général, 3 nids de dead code à nettoyer + bruit debug à réduire**

| Catégorie | État | Action |
|-----------|------|--------|
| 🟢 ES6+ moderne | 0 `var`, 0 `eval`, 0 `new Function` | Rien à faire |
| 🟢 Comparaisons | 0 `==` laxiste, 2 `!=` (à corriger) | Mini-fix |
| 🟢 Markers | 0 `TODO`/`FIXME`/`HACK` | Codebase propre |
| 🟢 Catch | 1 catch vide seulement | Mini-fix |
| 🟡 XSS | 49 `innerHTML` vs 80 `escapeHtml` | Audit ratio OK, vérifier cas par cas |
| 🟠 Pollution debug | 429 `console.log` + 32 `console.warn` + 90 `console.error` | Élaguer les `console.log` purs debug |
| 🟠 Mauvaise UX | 105 `alert()` natifs (laid en prod) | P2 — laisser pour plus tard |
| 🔴 **Dead code certain** | 3 fonctions `_DISABLED` + 2 fonctions à `return;` immédiat + 1 bloc commenté 60+ lignes | **À nettoyer** |
| 🟡 Memory leaks possibles | 51 `addEventListener` vs 1 `removeEventListener` | Audit ciblé si symptômes |

---

## 1. 🔴 Dead code CERTAIN — à supprimer

### 1.1 Fonctions `*_DISABLED` (3 occurrences — pattern volontaire de désactivation)

```
ligne 10670 : function addTrade_DISABLED() { return; // DÉSACTIVÉ - Voir supabase-trades.js
ligne ?     : function deleteAccount_DISABLED() { ... }
ligne ?     : function deleteTrade_DISABLED() { ... }
```

Ces fonctions sont des **placeholders** laissés après migration vers `supabase-trades.js`. Elles font `return;` immédiat et ne sont jamais appelées (vérifié : 1 occurrence chacune dans tout le fichier = juste leur définition).

**Action** : supprimer les 3 fonctions complètes (signature + corps).

### 1.2 `loadCoachAccounting()` — code mort explicite (ligne 14305-14310+)

```js
function loadCoachAccounting() {
    loadCoachAccountingFromSupabase();
    return; // Exit early - fonction Supabase gère tout

    // Code ancien (ne s'exécute plus):
    const studentsData = getAllStudentsData();
    console.log('[MONEY] Nombre d\'étudiants actifs:', studentsData.length);
    let totalInvested = 0;
    // ... ~50 lignes de code mort ...
}
```

**Action** : supprimer tout après `return;`, ou même refactor en `function loadCoachAccounting() { loadCoachAccountingFromSupabase(); }`.

### 1.3 `addNote()` — bloc commenté 60+ lignes (ligne 11160-11220)

```js
// ========================================
/*
function addNote() {
    const modal = document.getElementById('addNoteModal');
    // ... 60 lignes commentées ...
}
*/
// NOUVEAU : addNote() est maintenant dans supabase-journal.js
```

**Action** : supprimer le bloc commenté `/* function addNote() { … } */` (garder éventuellement la note explicative "addNote() déplacée dans supabase-journal.js" en 1 ligne).

### 1.4 Fonctions définies UNE seule fois (potentiellement dead code — à VÉRIFIER avant action)

```
calculateProfitFactor   — 1 occurrence (probablement remplacée par #66 helpers)
formatAccountSize       — 1 occurrence
generateDrawdownData    — 1 occurrence
generateScatterData     — 1 occurrence
showError               — 1 occurrence
```

⚠️ **Attention** : "1 occurrence" peut signifier :
- Soit la fonction est définie mais jamais appelée (dead code)
- Soit elle est appelée via un mécanisme dynamique (`window['nom']()`, dispatcher, event listener inline HTML)

**Action** : Claude Code doit vérifier chaque cas avant de supprimer.

---

## 2. 🟠 Pollution debug — réduire les `console.log`

**Volume** :
- 429 `console.log` ← réduction massive possible
- 32 `console.warn` ← garder (utiles)
- 90 `console.error` ← garder (utiles)

**Stratégie** : ne pas tout supprimer aveuglément. Distinguer :

- **À GARDER** : les `console.log('[SHARE] ✅ Image générée')`, `console.log('[VACATION] Mode Pause sauvegardé')` — logs préfixés `[MODULE]` qui servent de traçabilité event-driven en cas d'incident
- **À SUPPRIMER** : les `console.log(payload)`, `console.log('🔍 DEBUG ...')`, `console.log(variable)` purs debug oubliés

⚠️ **Règle conservatrice** : si Claude Code hésite, **garder**. Le coût d'un log dans la console est nul, le coût d'un log supprimé qui aurait sauvé un debug est élevé.

---

## 3. 🟡 Audit XSS — 49 `innerHTML` vs 80 `escapeHtml`

Le ratio suggère que la plupart des `innerHTML` sont escapées correctement (les 80 `escapeHtml()` couvrent plus que les 49 `innerHTML`, dont certaines incluent du HTML statique sans data utilisateur).

**Action** : audit ciblé. Pour chaque `innerHTML = ...`, vérifier :
- Si la chaîne contient du texte utilisateur (`${user.name}`, `${trade.notes}`, etc.) → DOIT être passé par `escapeHtml()`
- Si la chaîne est 100% statique ou contient uniquement des valeurs numériques contrôlées → OK

---

## 4. 🟡 Memory leaks — 51 `addEventListener` vs 1 `removeEventListener`

Suspicion légère. Risque réel uniquement si :
- Listeners attachés à des éléments DOM ré-créés régulièrement (modales, calendrier qui se redessine)
- Listeners qui closure-trap des données importantes

**Action** : pas d'urgence. Audit ciblé uniquement si Trader 360 ou un élève remarque une dégradation perf après usage prolongé.

---

## 5. 🟢 Mini-fixes (15 minutes)

- 2× `!=` à transformer en `!==` (strict equality, prévient les bugs subtils de coercion)
- 1× `catch (e) {}` à compléter avec au moins un `console.warn(...)`

---

## 6. 🟢 alert() natifs — laissés volontairement

105 `alert(...)` dans le code. Mauvaise UX (popup système, laid, bloquant). Mais **fonctionnel**.

**Décision** : laisser pour l'instant. Migration vers toast/modal cohérent Bourse à l'Aube = chantier dédié (P2 plus tard, après la migration des élèves).

---

## 7. 📝 Recommandation : nettoyage en 2 phases

### Phase 1 — SAFE (avant migration des élèves)

Supprimer uniquement les éléments **manifestement morts** :
- Les 3 fonctions `_DISABLED`
- Le code après `return;` dans `loadCoachAccounting()`
- Le bloc commenté `addNote()` (60+ lignes)
- Les 2 `!=` → `!==`
- Le catch vide

**Volume estimé** : ~150 lignes supprimées, 0 régression possible (code mort par définition).

### Phase 2 — Ciblé (post-migration, sereinement)

- Audit XSS exhaustif (innerHTML par innerHTML)
- Élagage console.log (avec règles strictes)
- Vérification listeners orphelins
- Vérification des 5 fonctions "1 occurrence" suspectes
- Refonte alert() → toasts cohérents Bourse à l'Aube

**Volume estimé** : ~500-800 lignes nettoyées, à faire calmement.

---

## Annexes

### Méthodologie

Audit via grep ciblés sur les patterns à risque dans `index.html`. Read des zones suspectes pour confirmer (gros blocs commentés, fonctions `_DISABLED`).

### Volumes globaux

```
Lignes totales      : 15 331
console.log         :   429   (réduction ciblée — voir Phase 2)
console.warn        :    32   (garder)
console.error       :    90   (garder)
alert()             :   105   (laisser, P2)
innerHTML           :    49   (audit XSS Phase 2)
escapeHtml() calls  :    80   (ratio sain)
addEventListener    :    51   (audit perf si symptômes)
removeEventListener :     1
fonctions définies  :   190
window.X exposées   :   140
== laxiste          :     0   ✅
!= laxiste          :     2   (mini-fix)
catch vide          :     1   (mini-fix)
TODO/FIXME/HACK     :     0   ✅
var legacy          :     0   ✅
eval/Function       :     0   ✅
```
