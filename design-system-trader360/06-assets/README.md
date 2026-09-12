# Assets Trader 360

## Fichiers disponibles

| Fichier | Taille | Usage |
|---------|--------|-------|
| `t360-logo.svg` | 7,8 Ko | Le verrou : hexagone et logotype. Couleur pilotée par le CSS. Source. |
| `t360-monogramme.svg` | 4,2 Ko | L'hexagone seul, pour les espaces étroits et la favicon. Source. |
| `t360-logo-or.png` | 14 Ko | Verrou doré, 800 px de large. Dérivé, pour le courriel et le canvas. |
| `t360-monogramme-or.png` | 4,1 Ko | Monogramme doré, 192 px. Dérivé, pour la favicon. |
| `executive-bg.png` | 2 MB | Image cinématique "Bourse à l'Aube" — bureau exécutif privé NYC heure dorée. À utiliser comme `background-image` plein écran sur login + dashboard. |

## Usage du logo

Deux fichiers source, copies octet pour octet de ceux du dépôt du site
(`src/marque/`) : `t360-logo.svg` (le verrou complet, hexagone et logotype) et
`t360-monogramme.svg` (l'hexagone seul, pour les espaces étroits et la favicon).

Ils portent `fill="currentColor"` : **leur couleur vient du CSS**, ce qui leur permet
de suivre le thème clair ou sombre. Posés dans une balise `<img>`, ils seraient rendus
dans un document isolé où cette couleur retombe sur le NOIR — donc invisibles sur le
fond marine. On les pose en **masque CSS** :

```html
<span class="marque" role="img" aria-label="Trader 360"></span>
```

```css
.marque {
  display: block;
  width: 190px;
  aspect-ratio: 1211 / 224;   /* le viewBox du verrou ; 459 / 446 pour le monogramme */
  background-color: currentColor;
  -webkit-mask: url('t360-logo.svg') no-repeat center / contain;
  mask: url('t360-logo.svg') no-repeat center / contain;
}
```

Deux contextes ne peuvent pas utiliser de masque, et reçoivent donc un PNG doré :
le **courriel**, qu'aucun client ne rend en SVG, et le **canvas de partage**, où
`drawImage` d'un SVG sans dimensions intrinsèques est rendu à une taille par défaut.
Ce sont `t360-logo-or.png` et `t360-monogramme-or.png`, régénérables par
`node assets/marque/generer.mjs`.

L'ancien `trader360-logo-clean.png` a été retiré d'ici. Il reste servi à
`/assets/trader360-logo-clean.png`, et uniquement pour cette raison : les rapports
hebdomadaires déjà partis le pointent par URL absolue dans les boîtes de réception des
élèves. Il n'est plus envoyé à personne.

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
