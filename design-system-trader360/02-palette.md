# Palette Trader 360 — Codes hex + cas d'usage

## Couleurs sacrées (logo, ne jamais changer)

| Token | Hex | Usage |
|-------|-----|-------|
| `--trader-navy` | `#000B25` | Couleur navy du logo, base de tous les fonds dark, identité de la marque |
| `--trader-gold` | `#d4af37` | Or du logo, accent principal de la marque |

---

## Or étendu (3 niveaux)

| Token | Hex | Usage typique |
|-------|-----|---------------|
| `--gold-aurum` | `#d4af37` | **Primaire** — cards bordures hover, boutons primaires (Valider, Enregistrer), titres importants, P&L hero, halo doré |
| `--gold-champagne` | `#f4e4c1` | **Highlights** — texte clair sur dark glass, accents subtils, hover lift glow |
| `--gold-bronze` | `#7b6018` | **Subtle** — bordures discrètes, séparateurs, texte gold en light mode, dividers |

**Versions rgba couramment utilisées :**
- `rgba(212, 175, 55, 0.95)` — texte gold-accent (labels CAPS)
- `rgba(212, 175, 55, 0.85)` — sous-titres dorés
- `rgba(212, 175, 55, 0.6)` — focus borders, glow
- `rgba(212, 175, 55, 0.45)` — halos subtils
- `rgba(201, 162, 75, 0.55)` — cadre photo "encadré"
- `rgba(201, 162, 75, 0.35)` — bordures cards standard
- `rgba(201, 162, 75, 0.18)` — bordures presque invisibles (sidebar)

---

## Sémantique trading (intouchable)

| Token | Hex | Usage |
|-------|-----|-------|
| `--trading-emerald` | `#10b981` | **Positif** — P&L gain (vert vif), succès, validation |
| `--trading-emerald-glow` | `#34d399` | Version glow plus claire pour effets lumineux sur fond dark |
| `--trading-coral` | `#ef4444` | **Négatif** — P&L perte (rouge vif), erreur, alerte |
| `--trading-coral-glow` | `#f87171` | Version glow plus claire |

**Règle d'or** : ces 2 couleurs (vert/rouge) sont **réservées aux indicateurs P&L et alertes sémantiques**. Ne JAMAIS les utiliser pour des CTA, des hover states, ou des éléments décoratifs. Si un bouton "Valider" est vert, il est hors charte (doit être en `--gold-aurum`).

---

## Navy étendu (surfaces dark)

| Token | Valeur | Usage |
|-------|--------|-------|
| `--navy-deep` | `#00050f` | Profondeur extrême (bord du gradient bg radial) |
| `--navy-base` | `#000B25` | Base navy standard |
| `--navy-mid` | `#001a4d` | Milieu de gradient (centre lumineux) |
| `--navy-card` | `rgba(10, 15, 24, 0.55)` | **Fond standard cards** (glass forge) |
| `--navy-card-hover` | `rgba(5, 10, 20, 0.80)` | **Hover cards** (plus dense, reste translucide) |
| `--navy-modal` | `rgba(10, 15, 24, 0.92)` | **Modale isolated focus** (presque opaque pour masquer contenu derrière) |
| `--navy-section` | `rgba(20, 25, 40, 0.6)` | Sections internes des modales (sub-blocks) |
| `--navy-sidebar` | `rgba(0, 11, 37, 0.55)` | Sidebar translucide (+ blur(14px)) |

**Pourquoi ces opacités précises ?**
- 0.55 = "calendrier-tier" — assez transparent pour laisser respirer l'image, assez opaque pour le contenu reste lisible
- 0.80 = "hover dense" — marqué visuellement mais glass préservé
- 0.92 = "modale isolated" — focus dur, contenu derrière masqué

---

## Crème étendu (surfaces light = "aube claire")

| Token | Valeur | Usage |
|-------|--------|-------|
| `--creme-base` | `#fbf6ec` | Base claire chaude |
| `--creme-deep` | `#f2ead7` | Version plus profonde (gradient bg light) |
| `--creme-card` | `rgba(255, 250, 240, 0.75)` | Fond standard cards light |
| `--creme-card-hover` | `rgba(245, 235, 215, 0.85)` | Hover cards light |
| `--creme-modal` | `rgba(255, 250, 240, 0.95)` | Modale light |
| `--creme-sidebar` | `rgba(255, 250, 240, 0.65)` | Sidebar light |

**Important** : light mode n'est PAS un dark inversé. C'est une vraie "aube claire" éditoriale — pense Aesop, papier crème, lumière du matin. Pas un blanc froid Tailwind par défaut.

---

## Textes

### Dark mode

| Token | Valeur | Usage |
|-------|--------|-------|
| `--text-primary-dark` | `rgba(255, 255, 255, 0.95)` | Titres, valeurs importantes |
| `--text-secondary-dark` | `rgba(255, 255, 255, 0.75)` | Corps de texte, descriptions |
| `--text-tertiary-dark` | `rgba(255, 255, 255, 0.6)` | Hint, aide, captions |
| `--text-gold-accent` | `rgba(212, 175, 55, 0.95)` | Labels importants en CAPS |
| `--text-gold-subtle` | `rgba(201, 162, 75, 0.7)` | Labels secondaires |

### Light mode

| Token | Valeur | Usage |
|-------|--------|-------|
| `--text-primary-light` | `rgba(15, 23, 42, 0.95)` | Navy foncé pour titres |
| `--text-secondary-light` | `rgba(15, 23, 42, 0.75)` | Corps de texte |
| `--text-tertiary-light` | `rgba(15, 23, 42, 0.6)` | Hint, aide |
| `--text-gold-accent-light` | `rgba(123, 96, 24, 0.95)` | Bronze pour labels CAPS |

---

## Anti-patterns (ce qu'il NE faut PAS faire)

❌ **Or saturé sur grandes surfaces** — l'or est un accent, pas un fond. Un bouton or solide oui, une page or non.

❌ **`color: white` codé en dur** — utiliser les tokens (`--text-primary`) qui switchent en dual-theme. Le `color: white` casse le light mode.

❌ **Bleus génériques (Tailwind `bg-blue-500`)** — hors charte. Tout doit être navy ou or.

❌ **Verts/rouges Tailwind vifs sur CTA** — réservé aux indicateurs P&L. Un bouton "Valider" en `#10b981` est hors charte (doit être or).

❌ **Fonds blancs purs (#FFFFFF)** — utiliser `--creme-base` ou variantes crème. Le blanc pur est froid et générique.

❌ **Ombres exagérées (`box-shadow: 0 20px 80px rgba(0,0,0,0.8)`)** — la premium tier vient de la subtilité, pas du volume.
