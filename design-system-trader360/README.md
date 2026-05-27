# Design System Trader 360 — "Bourse à l'Aube"

> Identité visuelle de la marque Trader 360, construite à travers la refonte du Journal Trader 360 V2.
> Ce dossier est **portable** : copie-le dans n'importe quel nouveau projet (site marketing, app, futurs produits) et tu pars d'un baseline visuel cohérent.

---

## Vision

**"Bourse à l'Aube"** — la salle de trading privée d'un sniper de marché. Atmosphère feutrée, lumière dorée tamisée, NYC heure dorée, bronze bull, livres référence, mug Trader 360. Le sentiment d'entrer dans un bureau Bloomberg redesigné par Aesop, à 6h du matin, café en main. Du temps qui ralentit. Du sérieux. Aucun gadget. Tout vit doucement.

Ce n'est pas un thème — c'est une **atmosphère cohérente** où chaque pixel raconte la même histoire.

---

## Philosophie de design

### 1. Premium sans clinquant
On évite l'or saturé partout, les ombres exagérées, les animations clinquantes. La premium tier vient de la précision (cadres fin 1px, espacements millimétrés, easings de qualité, typographie travaillée) — pas du volume.

### 2. Profondeur via glass + backdrop blur
Tout ce qui est card, modale, sidebar utilise un fond translucide + `backdrop-filter: blur(...)`. Ça crée de la profondeur sans alourdir visuellement. L'image de fond (bg image) doit toujours transparaître subtilement.

### 3. Or comme accent, navy comme socle
- Le **navy** (`#000B25`) est la base de tous les fonds, textes secondaires sombres, ambiance globale.
- L'**or ambré** (`#d4af37` / variations) est l'accent. Il marque ce qui mérite l'attention : titres, labels importants, bordures de cadres, hover states, P&L hero.
- **Jamais d'or en aplat sur toute la surface** — toujours en accent (bordures fines, halos, glow, lettres).

### 4. Easing universel
**`cubic-bezier(0.16, 1, 0.3, 1)`** partout (inspiré de Linear). C'est ce qui donne ce sentiment "soyeux premium" sur tous les hover, transitions, micro-interactions. Ne pas mélanger avec d'autres easings.

### 5. Dual-theme natif
Dark mode est le défaut, mais TOUT doit fonctionner aussi en light mode ("aube claire" crème, pas un dark inversé). Si une couleur est codée en dur (genre `color: white`), elle casse le light mode.

### 6. Sémantique conservée
- Vert (`#10b981`) = positif (P&L gain, succès)
- Rouge (`#ef4444`) = négatif (P&L perte, erreur)
- Les indicateurs sémantiques restent vert/rouge même dans le langage doré — pas de "tout en or" qui détruirait la lisibilité métier.

---

## Comment utiliser ce design system

### Pour un nouveau projet (site marketing, nouvelle app)

1. **Copie tout le dossier** `design-system-trader360/` à la racine du nouveau projet.
2. **Importe les tokens** : `<link rel="stylesheet" href="design-system-trader360/01-tokens.css">` dans ton HTML.
3. **Charge les fonts** : voir `03-typography.md` pour les imports Google Fonts.
4. **Place l'image bg** : copie `06-assets/executive-bg.png` quelque part dans tes assets et applique-la en background.
5. **Utilise les recettes** : `04-components.md` te donne les patterns prêts à copier pour cards, modales, boutons, etc.
6. **Adapte selon contexte** : si ton nouveau projet est plus minimaliste (site marketing one-page), tu peux simplifier. Si plus dense (autre app), tu peux étendre.

### Pour modifier le Journal Trader 360 V2

Le design system EST déjà appliqué via `assets/aube.css` + `assets/aube.js` + `assets/aube-bg.js` + `assets/candles-bg.js`. Ce dossier `design-system-trader360/` est la **documentation centralisée** de ce qui a été construit — pour t'y référer ou exporter ailleurs.

---

## Structure du dossier

| Fichier | Contenu |
|---------|---------|
| `01-tokens.css` | Toutes les variables CSS prêtes à importer (couleurs, espacements, radius, easings, blurs) |
| `02-palette.md` | Codes hex exacts + cas d'usage pour chaque couleur |
| `03-typography.md` | Fonts (Fraunces, JetBrains Mono, Inter), tailles, weights, usages |
| `04-components.md` | Recettes : cards glass forge, modales, boutons, hover states, etc. |
| `05-animations.md` | Easings, durées, micro-interactions, choreographies |
| `06-assets/` | Logo clean + image executive-bg + icônes éventuelles |
| `07-examples/` | Fichiers HTML/CSS standalone prêts à copier pour démarrer rapidement |

---

## Historique de construction

Ce design system a été construit progressivement à travers la refonte du Journal Trader 360 V2 sur la branche `claude/feature-polish-layer-v2`, à travers les bundles 1 → 1.7. Itérations longues, beaucoup de tests visuels, beaucoup d'arbitrages avec Trader 360. Le résultat est mature, validé visuellement, et prêt à servir d'identité visuelle pour tous les futurs produits Trader 360.

**Inspirations majeures** : Linear (motion + sobriété), Vercel dashboard (dark premium), Stripe (typo + espacement), Aesop (sérigraphie italique éditoriale), TradingView Premium (atmosphère salle de marché), Rauno Freiberg (motion craft), Aceternity UI (effets glass/aurora).
