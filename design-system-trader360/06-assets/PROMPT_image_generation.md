# Prompt génération d'image — Background "Bourse à l'Aube"

Si tu veux générer de nouvelles variations atmosphériques (mode nuit, mode minimaliste, autres décors), utilise ces prompts dans Midjourney / DALL-E / Flux.

## Prompt original utilisé (executive-bg.png actuel)

```
Generate a cinematic photorealistic image, 16:9 widescreen, 1920x1080.
Scene: luxury private trader's office at sunset, viewed from inside.
Right: large floor-to-ceiling window opening on Manhattan skyline at golden hour, Empire State Building visible, warm orange and pink sky.
Foreground center: dark marble desk, polished black leather chair, brass desk lamp with warm glow, bronze Wall Street bull statue, stack of trading books "Trading in the Zone" / "Market Wizards" / "The Disciplined Trader", black ceramic mug with subtle gold logo, leather notebook, gold pen, small plant on the right side.
NO UI elements floating in space, NO login card, NO dashboard overlay, NO text boxes, NO badges, NO interface — just the pure environment.
Atmosphere: warm, premium, contemplative, late afternoon golden light, sophisticated, Bloomberg Terminal vibe meets Aesop interior. Cinematic depth, slight bokeh on background.
```

**Important** : "NO UI elements" est crucial — sinon on a un "ghost double-UI" quand on overlay le vrai contenu par-dessus.

---

## Variations possibles (à explorer)

### Variation "Mode Nuit"
Remplace "sunset" / "golden hour" / "warm orange and pink sky" par "deep midnight" / "city lights twinkling" / "starry sky" / "moody blue tones".

### Variation "Mode Minimaliste"
Garde la même scène mais retire la moitié des objets (bull, livres, plante) pour une ambiance plus sobre, plus respirée.

### Variation "Mode Européen"
Remplace "Manhattan skyline" par "Paris skyline at sunset, Eiffel Tower visible" ou "London skyline at sunset, Shard visible".

### Variation "Mode Crypto"
Ajoute des écrans subtils en arrière-plan avec graphes crypto, néons subtils, mood futuriste.

---

## Specs techniques

- **Aspect ratio** : 16:9 (1920x1080 minimum, 2560x1440 idéal)
- **Format** : PNG (pour transparence éventuelle) ou JPG (taille fichier réduite)
- **Optimisation** : compresser avec TinyPNG / Squoosh avant déploiement (~2 MB max recommandé)
- **Composition** : laisser le centre relativement vide pour que l'UI overlay puisse respirer

---

## Workflow recommandé pour générer

1. Génère 3-4 variations via ton outil AI préféré
2. Compare-les côte à côte
3. Choisis celle qui te plaît visuellement ET qui a la composition la moins chargée au centre (pour ne pas concurrencer l'UI)
4. Compresse via TinyPNG
5. Sauvegarde en `executive-bg-[variant].png` dans `06-assets/`
6. Tu peux ensuite faire un système multi-thèmes (Trader 360 le mentionne dans la tâche #38 future "multi-themes background utilisateur")
