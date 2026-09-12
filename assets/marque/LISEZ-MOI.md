# La marque

## Deux sources, et rien d'autre à éditer

| Fichier | Ce que c'est |
|---|---|
| `t360-logo.svg` | Le **verrou** : hexagone et logotype. `viewBox` 1211 × 224. |
| `t360-monogramme.svg` | L'**hexagone seul**, pour les espaces étroits et la favicon. `viewBox` 459 × 446. |

Ce sont des copies **octet pour octet** des fichiers du dépôt du site
(`trader360-site/src/marque/`), vérifiables par empreinte :

```sh
shasum -a 256 assets/marque/t360-logo.svg ../trader360-site/src/marque/t360-logo.svg
```

Changer le logo, c'est remplacer ces deux fichiers puis relancer :

```sh
node assets/marque/generer.mjs
```

## Pourquoi un masque CSS et pas une balise `<img>`

Les deux sources portent `fill="currentColor"` : leur couleur vient du CSS. C'est ce
qui permet à la marque de suivre le thème clair ou sombre sans maintenir deux fichiers.

Posées dans une balise `<img>`, elles sont rendues dans un document **isolé**, où
`currentColor` retombe sur le **noir**. Ce n'est pas une précaution théorique : les
deux fichiers ont été affichés en `<img>` sur le fond marine du journal, et le logo y
ressort noir sur marine, donc invisible.

Elles sont donc posées en **masque** : seule la forme du fichier est utilisée, et la
couleur est celle de `background-color`.

```html
<span class="marque marque--verrou" role="img" aria-label="Trader 360"></span>
```

Le rapport de forme doit être déclaré (`aspect-ratio`) : un élément vide n'a aucune
hauteur propre.

## Les deux exceptions, qui reçoivent un PNG

| Contexte | Pourquoi pas de masque |
|---|---|
| **Courriel** | Aucun client ne rend le SVG de façon fiable : Gmail, Outlook et Yahoo l'ignorent ou le bloquent. Le rapport hebdomadaire envoie donc un PNG, en **pièce jointe inline `cid:`** — une image distante reste soumise au blocage des images externes, une pièce jointe non. |
| **Canvas de partage** | `drawImage` d'un SVG sans largeur ni hauteur intrinsèques est rendu à une taille par défaut qui dépend du navigateur, quand il n'échoue pas. |

Les deux PNG sont **dérivés** et régénérables ; ils ne se modifient pas à la main.

| Fichier | Taille de rendu | Où |
|---|---|---|
| `t360-logo-or.png` | 800 px de large | courriel (affiché 200) et canvas (dessiné 400) |
| `t360-monogramme-or.png` | 192 px | favicon |

`api/cron/_lib/marque.js` est lui aussi généré : il embarque le SVG source sous forme
de chaîne, parce que la fonction d'envoi tourne sur Vercel, où seuls les fichiers
déclarés dans `includeFiles` accompagnent le code. Un oubli de déclaration ne se
verrait qu'à l'envoi réel du lundi matin.

## L'ancien logo n'est pas supprimé

`assets/trader360-logo-clean.png` reste servi à son URL d'origine, et **uniquement**
pour cette raison : les rapports hebdomadaires déjà partis le pointent par URL absolue
dans les boîtes de réception des élèves. Le supprimer casserait le logo dans des
courriels déjà reçus. Il n'est plus envoyé à personne et n'est plus référencé par le
code.
