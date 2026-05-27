# Typographie Trader 360

## Trois familles, trois usages stricts

| Famille | Usage | Personnalité |
|---------|-------|--------------|
| **Fraunces** (serif) | Citations, titres éditoriaux, italic | Gravité éditoriale, sensation "article Bloomberg" |
| **JetBrains Mono** (monospace) | TOUS les chiffres, data tabular | Tech premium, parfaitement aligné colonnes |
| **Inter** (sans-serif) | UI, boutons, body, labels | Neutre moderne, lisible |

---

## Import dans le projet

### Option 1 — Google Fonts (recommandé, plus simple)

Dans `<head>` de ton HTML :

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700;1,9..144,400..700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap" rel="stylesheet">
```

### Option 2 — Self-host (perf maximale)

Télécharge les fonts depuis Google Fonts, place-les dans `assets/fonts/`, et utilise `@font-face` dans ton CSS.

---

## Application via tokens

Tous les tokens font-family sont définis dans `01-tokens.css` :

```css
--font-serif: 'Fraunces', 'Spectral', 'Georgia', serif;
--font-mono: 'JetBrains Mono', 'Berkeley Mono', 'SF Mono', monospace;
--font-ui: 'Inter', system-ui, -apple-system, sans-serif;
```

Usage :

```css
/* Citations / titres éditoriaux */
.citation, .quote, h1.editorial {
  font-family: var(--font-serif);
  font-style: italic;
}

/* Chiffres / data */
.pnl-value, .stat-number, td.numeric {
  font-family: var(--font-mono);
  font-feature-settings: 'tnum' 1; /* tabular numbers — colonnes alignées */
  letter-spacing: -0.02em;
}

/* UI standard (boutons, body, etc.) */
body, button, input, label {
  font-family: var(--font-ui);
}
```

---

## Échelle des tailles (tokens dans 01-tokens.css)

| Token | Valeur | Cas d'usage |
|-------|--------|-------------|
| `--text-xs` | `0.7rem` (~11px) | Mini-labels, badges count |
| `--text-sm` | `0.85rem` (~14px) | Aide, descriptions, captions, tooltips |
| `--text-base` | `1rem` (~16px) | Body, paragraphes |
| `--text-md` | `1.05rem` (~17px) | Valeurs importantes (data détaillée) |
| `--text-lg` | `1.25rem` (~20px) | Sous-titres, valeurs P&L secondaires |
| `--text-xl` | `1.5rem` (~24px) | Titres de section |
| `--text-2xl` | `2rem` (~32px) | Hero secondaire |
| `--text-3xl` | `2.25rem` (~36px) | Hero principal (titre CONNEXION login) |
| `--text-4xl` | `3rem` (~48px) | P&L hero, gros chiffres mis en avant |

---

## Weights

| Token | Valeur | Usage |
|-------|--------|-------|
| `--weight-regular` | `400` | Body, captions |
| `--weight-medium` | `500` | Labels secondaires, sous-textes |
| `--weight-semibold` | `600` | Labels importants, sous-titres |
| `--weight-bold` | `700` | Titres, hero, accents forts |

---

## Letter-spacing

| Token | Valeur | Usage |
|-------|--------|-------|
| `--tracking-tight` | `-0.02em` | Gros chiffres (P&L hero) — esthétique premium |
| `--tracking-normal` | `0` | Body standard |
| `--tracking-wide` | `0.05em` | CAPS labels (DATE D'ACHAT, MONTANT…) |
| `--tracking-wider` | `0.08em` | CAPS très espacé (sous-titre "JOURNAL DE TRADING PROFESSIONNEL") |

---

## Recettes typographiques (à copier)

### Titre Hero (style CONNEXION)
```css
.hero-title {
  font-family: var(--font-ui);
  font-size: var(--text-3xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  color: rgba(212, 175, 55, 1);
  text-shadow:
    0 0 20px rgba(212, 175, 55, 0.4),
    0 0 40px rgba(212, 175, 55, 0.25);
}
```

### Sous-titre éditorial (style "JOURNAL DE TRADING PROFESSIONNEL")
```css
.editorial-subtitle {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  letter-spacing: var(--tracking-wider);
  text-transform: uppercase;
  color: var(--gold-aurum);
}
```

### Citation italique (style "Le succès est la somme...")
```css
.quote {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: var(--text-lg);
  font-weight: var(--weight-regular);
  line-height: 1.5;
  color: var(--text-primary);
}
.quote-author {
  font-family: var(--font-ui);
  font-size: var(--text-sm);
  color: var(--text-secondary);
  margin-top: var(--space-2);
}
```

### Label CAPS doré (style "DATE D'ACHAT")
```css
.label-gold {
  font-family: var(--font-ui);
  font-size: var(--text-xs);
  font-weight: var(--weight-semibold);
  text-transform: uppercase;
  letter-spacing: var(--tracking-wide);
  color: var(--text-label);
}
```

### Chiffre P&L hero (style "$74727.50")
```css
.pnl-hero {
  font-family: var(--font-mono);
  font-size: var(--text-4xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
  color: var(--text-primary);
  text-shadow:
    0 0 40px rgba(212, 175, 55, 0.45),
    0 0 20px rgba(212, 175, 55, 0.25);
  font-feature-settings: 'tnum' 1;
}
```

### Chiffre data tabular (lignes de tableau)
```css
td.numeric, .stat-value {
  font-family: var(--font-mono);
  font-weight: var(--weight-semibold);
  font-feature-settings: 'tnum' 1;
  text-align: right;
}
```

---

## Notes anti-patterns

❌ **Ne JAMAIS forcer un titre en `text-transform: uppercase` dans un tooltip ou paragraphe court explicatif** — la lecture devient pénible. Garder UPPERCASE pour labels courts (1-3 mots).

❌ **Ne pas mélanger Fraunces partout** — son usage est réservé aux citations et quelques titres éditoriaux. Sur les boutons, labels, body : Inter. Sur les chiffres : JetBrains Mono.

❌ **Ne pas oublier `font-feature-settings: 'tnum' 1`** sur les chiffres en colonnes (tableaux, listes financières). Sans ça, les chiffres ne s'alignent pas verticalement.
