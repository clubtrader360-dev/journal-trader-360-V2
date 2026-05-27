# Animations Trader 360 — Motion Language

## Principe directeur

Le mouvement doit **servir le sens**, jamais décorer pour décorer. L'inspiration vient de Linear / Rauno Freiberg / Arc browser : motion design où chaque animation a une raison fonctionnelle (feedback hover, retour visuel d'action, célébration d'un moment fort).

**Pas d'animation tape-à-l'œil.** Pas de bounce, pas de scale aggressive, pas de rotation inutile. Du restraint, de la précision, de l'élégance.

---

## Easing universel (LE token le plus important)

```css
--ease-premium: cubic-bezier(0.16, 1, 0.3, 1);
```

**Cette courbe doit être utilisée pour TOUTES les transitions UI**. C'est ce qui donne le sentiment "soyeux Linear-tier". Ne pas mélanger avec `ease-in`, `ease-out`, `cubic-bezier(0.4, 0, 0.2, 1)` (Material) ou autres easings standards.

Pour les count-up de chiffres : `--ease-out-expo: cubic-bezier(0.19, 1, 0.22, 1);` — encore plus prononcé en sortie, parfait pour donner "matière" aux compteurs.

---

## Durations standards

| Token | Valeur | Cas d'usage |
|-------|--------|-------------|
| `--duration-fast` | `200ms` | Hover boutons, focus inputs, color transitions |
| `--duration-base` | `280ms` | Cards hover, transform translateY, shadow changes |
| `--duration-slow` | `380ms` | Indicateur nav qui glisse, transitions de page |
| `--duration-slower` | `1400ms` | Count-up chiffres (P&L, KPI au load) |
| `--duration-slowest` | `1500ms` | Fade-in card login |

**Règle pratique** : si l'utilisateur attend la fin de l'animation pour interagir, garde-la SOUS 300ms. Si l'animation est "ambient" (count-up qui s'affiche au load, pas bloquante), tu peux aller jusqu'à 1500ms.

---

## Bibliothèque d'animations

### 1. Hover lift (boutons, cards)

```css
.lift-on-hover {
  transition: transform var(--duration-base) var(--ease-premium);
}
.lift-on-hover:hover {
  transform: translateY(-1px); /* boutons */
  /* OU translateY(-2px) pour cards (plus prononcé) */
}
```

### 2. Hover brightness (boutons or)

```css
.btn-primary {
  transition: filter var(--duration-fast) var(--ease-premium);
}
.btn-primary:hover {
  filter: brightness(1.08);
}
```

### 3. Glass forge hover (cards premium)

Combinaison lift + glow + border qui s'intensifie :

```css
.card {
  transition:
    transform var(--duration-base) var(--ease-premium),
    border-color var(--duration-base) var(--ease-premium),
    box-shadow var(--duration-base) var(--ease-premium);
}
.card:hover {
  transform: translateY(-2px);
  border-color: var(--border-gold-hover);
  box-shadow: var(--shadow-card-hover);
}
```

### 4. Count-up chiffres (au load des KPI)

JavaScript vanilla (compatible avec GSAP si dispo) :

```js
function countUp(element, target, duration = 1400) {
  const start = performance.now();
  const initial = 0;
  function easeOutExpo(t) {
    return t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
  }
  function step(now) {
    const elapsed = now - start;
    const progress = Math.min(elapsed / duration, 1);
    const eased = easeOutExpo(progress);
    const current = initial + (target - initial) * eased;
    element.textContent = formatNumber(current);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
```

### 5. Fade-in + scale léger (card login au mount)

```css
@keyframes fade-scale-in {
  from {
    opacity: 0;
    transform: scale(0.98) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.auth-card {
  animation: fade-scale-in var(--duration-slowest) var(--ease-out-expo);
}
```

### 6. Stagger arrivée cards (séquence au load)

Plutôt qu'animer toutes les cards d'un coup, les faire arriver en cascade avec un délai entre chaque :

```css
@keyframes card-enter {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.cards-grid > * {
  opacity: 0;
  animation: card-enter 500ms var(--ease-premium) forwards;
}

/* Stagger : 50ms entre chaque card */
.cards-grid > *:nth-child(1) { animation-delay: 0ms; }
.cards-grid > *:nth-child(2) { animation-delay: 50ms; }
.cards-grid > *:nth-child(3) { animation-delay: 100ms; }
.cards-grid > *:nth-child(4) { animation-delay: 150ms; }
.cards-grid > *:nth-child(5) { animation-delay: 200ms; }
/* etc. */
```

### 7. Pulse subtile (P&L hero, breathing)

Pour faire "respirer" un élément clé sans agressivité :

```css
@keyframes breathe {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.005); }
}

.pnl-hero {
  animation: breathe 4s ease-in-out infinite;
}
```

### 8. Border pulse (alertes "Points à surveiller")

```css
@keyframes alert-pulse {
  0%, 100% {
    border-color: rgba(239, 68, 68, 0.25);
    box-shadow: 0 0 0 rgba(239, 68, 68, 0);
  }
  50% {
    border-color: rgba(239, 68, 68, 0.7);
    box-shadow: 0 0 24px rgba(239, 68, 68, 0.3);
  }
}

.alert-card {
  border: 1px solid rgba(239, 68, 68, 0.35);
  animation: alert-pulse 2.4s ease-in-out infinite;
}
```

### 9. Nav indicator qui glisse (sous l'onglet actif)

```css
.nav-indicator {
  position: absolute;
  bottom: 0;
  height: 2px;
  background: var(--gold-aurum);
  box-shadow: 0 0 8px rgba(212, 175, 55, 0.6);
  transition: transform var(--duration-slow) var(--ease-premium),
              width var(--duration-slow) var(--ease-premium);
}
```

JavaScript pour mettre à jour position/width au changement d'onglet :

```js
function updateNavIndicator(activeTab) {
  const indicator = document.querySelector('.nav-indicator');
  const rect = activeTab.getBoundingClientRect();
  const navRect = activeTab.parentElement.getBoundingClientRect();
  indicator.style.transform = `translateX(${rect.left - navRect.left}px)`;
  indicator.style.width = `${rect.width}px`;
}
```

### 10. Tracé SVG animé (courbe P&L au load)

Avec GSAP DrawSVG ou vanilla `stroke-dashoffset` :

```css
.pnl-line {
  stroke-dasharray: 1000;
  stroke-dashoffset: 1000;
  animation: draw-line 1500ms var(--ease-out-expo) forwards;
}

@keyframes draw-line {
  to { stroke-dashoffset: 0; }
}
```

### 11. Sparkline trace au load (mini-courbes dans KPI cards)

Similaire au tracé SVG mais sur 1 seconde, plus rapide :

```css
.sparkline-path {
  stroke-dasharray: 200;
  stroke-dashoffset: 200;
  animation: trace-sparkline 1s var(--ease-out-expo) forwards;
}

@keyframes trace-sparkline {
  to { stroke-dashoffset: 0; }
}
```

### 12. Glow doré permanent sur boutons hero

Pas une animation, mais un effet visuel toujours présent :

```css
.btn-hero {
  box-shadow:
    0 4px 16px rgba(212, 175, 55, 0.25),
    0 0 24px -4px rgba(212, 175, 55, 0.35);
}
```

---

## Garde-fous accessibilité

### Reduced motion (obligatoire)

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

### Toggle global (pour permettre de désactiver toutes les anims)

```css
[data-animations="off"] *,
[data-animations="off"] *::before,
[data-animations="off"] *::after {
  animation: none !important;
  transition: none !important;
}
```

```js
// Pour désactiver/réactiver via JS
document.body.dataset.animations = 'off';  // tout désactivé
document.body.dataset.animations = 'on';   // ou simplement retirer l'attribut
```

---

## Anti-patterns à éviter

❌ **Easings standards génériques** (`ease`, `linear`, `ease-in-out`) — utilise `var(--ease-premium)`.

❌ **Animations > 500ms** sur des interactions bloquantes (hover, click) — l'utilisateur attend.

❌ **Bounce / spring effects** — pas dans l'esprit "salle de trading sérieuse".

❌ **Animations infinies sur la majeure partie de l'écran** — fatigue l'œil et tue le focus.

❌ **Translations / scales > 5%** sur hover — trop agressif, casse la sensation de précision.

❌ **Oublier `prefers-reduced-motion`** — c'est obligatoire pour l'accessibilité.
