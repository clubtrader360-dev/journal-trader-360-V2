# Recettes Components Trader 360

Patterns prêts à copier-coller pour reproduire l'identité visuelle "Bourse à l'Aube".

---

## 1. Card "Glass Forge" (composant principal)

Le plus utilisé. Cards qui contiennent métriques, sections, contenu principal.

```css
.card {
  background: var(--bg-card); /* rgba(10, 15, 24, 0.55) en dark */
  backdrop-filter: var(--blur-glass); /* blur(16px) saturate(140%) */
  -webkit-backdrop-filter: var(--blur-glass);
  border: 1px solid var(--border-gold-medium); /* rgba(201, 162, 75, 0.35) */
  border-radius: var(--radius-lg); /* 12px */
  box-shadow: var(--shadow-card);
  padding: var(--space-6);
  transition: transform var(--duration-base) var(--ease-premium),
              border-color var(--duration-base) var(--ease-premium),
              box-shadow var(--duration-base) var(--ease-premium);
}

.card:hover {
  transform: translateY(-2px);
  border-color: var(--border-gold-hover); /* rgba(212, 175, 55, 0.6) */
  box-shadow: var(--shadow-card-hover);
}
```

**Variation : KPI Card (head metric)** — plus dense, sparkline en bas :
```css
.kpi-card {
  /* Hérite de .card */
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}
.kpi-card .kpi-title {
  font-size: var(--text-sm);
  color: var(--text-secondary);
  font-weight: var(--weight-medium);
}
.kpi-card .kpi-value {
  font-family: var(--font-mono);
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
  color: var(--text-primary);
}
.kpi-card .kpi-sparkline {
  height: 30px;
  width: 100%;
  /* SVG ou Canvas pour la mini-courbe */
}
```

---

## 2. Modale "Isolated Focus"

Pour les pop-ups (Ajouter trade, Importer CSV, Note Quotidienne, etc.). **Opacité forte pour vraiment masquer le contenu derrière** — différent des cards qui sont ambient.

```css
.modal-content {
  background: var(--bg-modal); /* rgba(10, 15, 24, 0.92) en dark */
  backdrop-filter: var(--blur-modal); /* blur(20px) saturate(140%) */
  -webkit-backdrop-filter: var(--blur-modal);
  border: 1px solid var(--border-gold-medium);
  border-radius: var(--radius-lg);
  color: var(--text-primary);
  box-shadow: var(--shadow-modal);
  padding: var(--space-6);
  max-width: 600px;
  width: 90vw;
  max-height: 90vh;
  overflow-y: auto;
}

/* Titre de modale (style "📝 Note du 2026-02-05") */
.modal-title {
  font-family: var(--font-ui);
  font-size: var(--text-xl);
  font-weight: var(--weight-bold);
  color: var(--gold-aurum);
  margin-bottom: var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

/* Section interne (sub-block dans la modale) */
.modal-section {
  background: var(--bg-section); /* rgba(20, 25, 40, 0.6) */
  border: 1px solid var(--border-gold-light);
  border-left: 3px solid var(--border-gold-strong); /* accent doré côté gauche */
  border-radius: var(--radius-sm);
  padding: var(--space-3) var(--space-4);
  margin-bottom: var(--space-3);
}

.modal-section .label {
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  color: var(--text-label);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  display: block;
  margin-bottom: var(--space-1);
}

.modal-section .value {
  font-size: var(--text-md);
  font-weight: var(--weight-semibold);
  color: var(--text-primary);
}
```

---

## 3. Boutons (système 2-tiers strict)

### Bouton primaire (CTA principal : Valider, Enregistrer, Confirmer)

```css
.btn-primary {
  background: var(--gold-aurum);
  color: var(--trader-navy); /* texte navy foncé sur fond or */
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-6);
  font-family: var(--font-ui);
  font-weight: var(--weight-semibold);
  font-size: var(--text-base);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-premium);
  box-shadow: var(--shadow-button-gold);
}

.btn-primary:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
  box-shadow: var(--shadow-button-gold-hover);
}

.btn-primary:active {
  transform: translateY(0);
  filter: brightness(0.95);
}
```

### Bouton secondaire (Annuler, Retour, Fermer)

```css
.btn-secondary {
  background: rgba(0, 11, 37, 0.4);
  color: var(--gold-aurum);
  border: 1px solid var(--border-gold-strong);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-6);
  font-family: var(--font-ui);
  font-weight: var(--weight-medium);
  font-size: var(--text-base);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-premium);
}

.btn-secondary:hover {
  border-color: var(--border-gold-focus);
  background: rgba(0, 11, 37, 0.55);
  transform: translateY(-1px);
}

/* Light mode */
body:not(.dark-mode) .btn-secondary {
  background: rgba(255, 250, 240, 0.6);
  color: var(--gold-bronze);
  border-color: rgba(123, 96, 24, 0.5);
}
```

### Bouton danger (Supprimer, Confirmer destruction)

Reste rouge (sémantique). Pas hors charte.

```css
.btn-danger {
  background: var(--trading-coral);
  color: white;
  border: none;
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-6);
  font-weight: var(--weight-semibold);
  cursor: pointer;
  transition: all var(--duration-fast) var(--ease-premium);
}
.btn-danger:hover {
  filter: brightness(1.1);
  transform: translateY(-1px);
}
```

---

## 4. Input / Textarea / Select

```css
input, textarea, select {
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border-gold-light);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  color: var(--text-primary);
  font-family: var(--font-ui);
  font-size: var(--text-base);
  width: 100%;
  transition: border-color var(--duration-fast) var(--ease-premium),
              box-shadow var(--duration-fast) var(--ease-premium);
}

input::placeholder, textarea::placeholder {
  color: rgba(255, 255, 255, 0.35);
}

input:focus, textarea:focus, select:focus {
  outline: none;
  border-color: var(--border-gold-focus);
  box-shadow: 0 0 0 3px rgba(212, 175, 55, 0.18);
}

/* Checkbox / radio en or */
input[type="checkbox"],
input[type="radio"] {
  accent-color: var(--gold-aurum);
  width: 18px;
  height: 18px;
  cursor: pointer;
}
```

**Pour les inputs login** (champ blanc + texte navy, gère l'autofill Chrome) :

```css
.auth-input {
  background: rgba(255, 255, 255, 0.92);
  color: rgba(15, 23, 42, 0.95);
  border: 1px solid rgba(212, 175, 55, 0.3);
}

/* Hack autofill Chrome — texte navy lisible au paste */
.auth-input:-webkit-autofill {
  -webkit-text-fill-color: rgba(15, 23, 42, 0.95) !important;
  -webkit-box-shadow: 0 0 0 1000px rgba(255, 255, 255, 0.92) inset !important;
  caret-color: rgba(15, 23, 42, 0.95) !important;
  transition: background-color 5000s ease-in-out 0s;
}
```

---

## 5. Hover states (universels)

### Sur boutons standard

```css
button {
  transition: all var(--duration-fast) var(--ease-premium);
}
button:hover {
  filter: brightness(1.08);
  transform: translateY(-1px);
}
```

### Sur icônes d'action (Voir/Modifier/Supprimer dans tables)

```css
.action-icon {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: var(--space-2);
  transition: transform var(--duration-fast) var(--ease-premium);
}
.action-icon:hover {
  transform: translateY(-1px);
  background: transparent !important; /* override Tailwind si nécessaire */
}
.action-icon:hover svg, .action-icon:hover i {
  filter: drop-shadow(0 0 4px rgba(212, 175, 55, 0.5));
}
```

### Sur lignes de tableau

```css
tr:hover {
  background: rgba(212, 175, 55, 0.08) !important; /* tint doré subtil */
}
tr:hover * {
  color: var(--text-primary) !important; /* préserver lisibilité */
}
```

### Sur cases de calendrier

```css
.calendar-day:hover {
  background: rgba(212, 175, 55, 0.12);
  color: var(--text-primary);
  cursor: pointer;
}
```

---

## 6. Tooltips info (ⓘ)

```css
.tooltip {
  background: rgba(5, 10, 20, 0.96);
  backdrop-filter: blur(8px) saturate(140%);
  -webkit-backdrop-filter: blur(8px) saturate(140%);
  border: 1px solid var(--border-gold-hover);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  font-size: var(--text-sm);
  line-height: 1.5;
  font-weight: var(--weight-regular);
  text-transform: none !important; /* CRITIQUE : pas de UPPERCASE forcé */
  letter-spacing: normal !important;
  max-width: 280px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}

.tooltip * {
  text-transform: none !important;
}
```

---

## 7. Toasts / Notifications

```css
.toast {
  background: rgba(10, 15, 24, 0.92);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border: 1px solid var(--border-gold-hover);
  color: var(--text-primary);
  border-radius: var(--radius-md);
  padding: var(--space-4) var(--space-5);
  box-shadow: var(--shadow-toast);
  position: fixed;
  bottom: var(--space-6);
  right: var(--space-6);
  z-index: var(--z-toast);
  max-width: 400px;
  animation: toast-slide-in 300ms var(--ease-premium);
}

/* Icône sémantique conservée (vert pour succès, rouge pour erreur) */
.toast.success .icon { color: var(--trading-emerald); }
.toast.error .icon { color: var(--trading-coral); }
.toast.info .icon { color: var(--gold-aurum); }

@keyframes toast-slide-in {
  from { opacity: 0; transform: translateX(20px); }
  to { opacity: 1; transform: translateX(0); }
}
```

---

## 8. Sidebar (navigation latérale)

```css
.sidebar {
  background: var(--bg-sidebar); /* rgba(0, 11, 37, 0.55) en dark */
  backdrop-filter: var(--blur-sidebar); /* blur(14px) saturate(120%) */
  -webkit-backdrop-filter: var(--blur-sidebar);
  border-right: 1px solid var(--border-gold-subtle);
  padding: var(--space-6) var(--space-4);
  min-height: 100vh;
  z-index: var(--z-overlay);
}

.sidebar-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  color: var(--text-secondary);
  font-weight: var(--weight-medium);
  border-radius: var(--radius-md);
  transition: all var(--duration-fast) var(--ease-premium);
  cursor: pointer;
}

.sidebar-item:hover {
  background: rgba(212, 175, 55, 0.08);
  color: var(--gold-aurum);
}

.sidebar-item.active {
  color: var(--gold-aurum);
  background: rgba(212, 175, 55, 0.12);
  border-left: 3px solid var(--gold-aurum);
}
```

---

## 9. Badge / Pill compteur

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: var(--space-1) var(--space-3);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  border-radius: var(--radius-full);
  border: 1px solid;
}

.badge.success {
  background: rgba(16, 185, 129, 0.18);
  color: var(--trading-emerald-glow);
  border-color: rgba(16, 185, 129, 0.3);
}

.badge.error {
  background: rgba(239, 68, 68, 0.15);
  color: var(--trading-coral-glow);
  border-color: rgba(239, 68, 68, 0.3);
}

.badge.gold {
  background: rgba(212, 175, 55, 0.15);
  color: var(--gold-aurum);
  border-color: rgba(212, 175, 55, 0.3);
}
```

---

## 10. État vide (empty state)

Pour "Aucun trade", "Aucune note", etc. — quand une liste est vide.

```css
.empty-state {
  background: var(--bg-card);
  border: 1px solid var(--border-gold-light);
  border-radius: var(--radius-md);
  color: var(--text-tertiary);
  padding: var(--space-6);
  text-align: center;
  font-style: italic;
}
```

---

## Astuce générale pour intégrer ce design system

1. **Commence par les tokens** — importer `01-tokens.css` est la première chose à faire.
2. **Utilise les variables CSS** plutôt que des valeurs codées en dur (`var(--gold-aurum)` au lieu de `#d4af37`).
3. **Préfère les composants documentés ici** plutôt que de réinventer un style.
4. **Respecte le dual-theme** — chaque composant doit avoir sa variante light si pertinent (utilise `body:not(.dark-mode) .composant`).
5. **Easing universel** — toutes les `transition` doivent utiliser `var(--ease-premium)`.
