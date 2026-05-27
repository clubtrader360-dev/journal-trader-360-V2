# Assets Trader 360

## Fichiers disponibles

| Fichier | Taille | Usage |
|---------|--------|-------|
| `trader360-logo-clean.png` | 402 KB | Logo hexagonal Trader 360 sans fond bleu (PNG transparent). À utiliser sur fond dark ou clair. |
| `executive-bg.png` | 2 MB | Image cinématique "Bourse à l'Aube" — bureau exécutif privé NYC heure dorée. À utiliser comme `background-image` plein écran sur login + dashboard. |

## Usage du logo

```html
<img src="design-system-trader360/06-assets/trader360-logo-clean.png"
     alt="Trader 360"
     width="100"
     height="100"
     style="display: block; margin: 0 auto;">
```

## Usage de l'image de fond

```css
body, html {
  background-image: url('design-system-trader360/06-assets/executive-bg.png');
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
  background-repeat: no-repeat;
  min-height: 100vh;
}

/* Overlay subtile pour la lisibilité du contenu par-dessus */
body::before {
  content: '';
  position: fixed;
  inset: 0;
  background: rgba(0, 11, 37, 0.35); /* navy léger pour Login */
  /* OU rgba(0, 11, 37, 0.50) pour Dashboard (plus de contenu UI = plus opaque) */
  z-index: -1;
  pointer-events: none;
}
```

## Notes

- **Le logo `clean`** est sans fond bleu (transparent) — il s'adapte donc à n'importe quel fond.
- **L'image executive-bg** a été spécifiquement générée pour être **environment-only** (pas d'UI bakée dedans), donc le contenu UI peut être placé par-dessus sans risque de "ghost double-UI".
- Pour des variations atmosphériques futures (mode nuit, mode minimaliste), tu peux générer d'autres images du même type via Midjourney / DALL-E / Flux avec un prompt similaire (cf. `06-assets/PROMPT_image_generation.md` ci-dessous).
