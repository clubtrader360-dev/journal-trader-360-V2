# Quiz du module 4 : Prendre en main ta plateforme de trading

Écrit le 14/10/2026 depuis les cinq transcriptions Vimeo du module 4 (4.0, 4.1,
4.2.1, 4.2.2 le live complément, 4.3).

```
15 questions    12 a choix unique, 3 vrai / faux
seuil 80 %      12 bonnes reponses sur 15
```

⚠️ Aucune question sur le processus « envoie un mail pour débloquer la suite »
du 4.3 : ce processus est celui de LearnyBox, et son sort dans le journal est à
trancher à la bascule.

---

## Q1 · Chapitre 4.1 · choix unique

**Une plateforme de trading, c'est :**

- L'entreprise qui détient ton compte et exécute tes ordres.
- L'outil qui te sert à analyser le marché et envoyer tes ordres, sans détenir tes fonds. ✅
- La société qui finance ton compte.
- L'organisme qui régule les brokers.

Renvoi : `m04-l1`, entre 0 et 2 minutes.
Conseil : La plateforme analyse et envoie, le broker détient et exécute. Les deux sont complémentaires, et c'est le broker qui prend les frais.

## Q2 · Chapitre 4.1 · choix unique

**Pourquoi Manu déconseille-t-il les brokers Market Maker ?**

- Leurs commissions sont trop élevées.
- Ils ne proposent pas de CFD.
- Ils prennent la contrepartie de tes trades, donc ils gagnent quand tu perds. ✅
- Ils n'acceptent pas les prop firms.

Renvoi : `m04-l1`, entre 2 et 5 minutes.
Conseil : Le Market Maker ne transmet pas toujours au marché réel, d'où un conflit d'intérêt et une manipulation possible des prix. Le broker ECN / STP transmet au marché, sans conflit, mais coûte plus cher.

## Q3 · Chapitre 4.1 · choix unique

**Entre les CFD et les futures, lequel est le marché réel, avec un carnet d'ordres centralisé, le DOM ?**

- Les CFD.
- Les deux.
- Les futures. ✅
- Aucun des deux.

Renvoi : `m04-l1`, entre 7 et 10 minutes.
Conseil : Les CFD reproduisent le prix d'un actif hors marché, avec des cotations qui varient selon les brokers. Les futures sont des contrats standardisés cotés sur un marché réglementé. C'est pour ça que tes prix en démo CFD diffèrent de ceux des lives.

## Q4 · Chapitre 4.1 · vrai / faux

**Tradovate fournit un compte de démonstration illimité pour apprendre.**

- Vrai
- Faux ✅

Renvoi : `m04-l1`, entre 1 et 2 minutes.
Conseil : Tradovate n'offre qu'une démo de quatorze jours environ. C'est l'une des raisons pour lesquelles on apprend sur TradingView, gratuit et illimité.

## Q5 · Chapitre 4.2.1 · choix unique

**Quel symbole choisit-on sur TradingView pour s'entraîner ?**

- ES1!, le future.
- SPY, l'ETF.
- SPX 500, chez FXCM. ✅
- US500, chez n'importe quel fournisseur.

Renvoi : `m04-l2`, entre 1 et 2 minutes.
Conseil : Dans la recherche, tape SPX 500 et prends la ligne FXCM, puis « Lancer graphique ».

## Q6 · Chapitre 4.2.1 · choix unique

**Combien d'indicateurs la version gratuite de TradingView autorise-t-elle ?**

- Deux. ✅
- Trois.
- Cinq.
- Autant qu'on veut.

Renvoi : `m04-l2`, entre 10 et 12 minutes.
Conseil : Deux, et c'est suffisant : l'indicateur Trader 360, qui regroupe tout, plus la VWAP. Au troisième, TradingView propose le plan payant.

## Q7 · Chapitre 4.2.1 · choix unique

**Où trouve-t-on le code de l'indicateur Trader 360 à coller dans l'éditeur Pine ?**

- Sur le site de TradingView, dans la bibliothèque publique.
- Dans le salon Discord « Code indicateur Club Trader 360 ». ✅
- Dans les réglages de TradingView, il est préinstallé.
- Dans l'onglet Trade de TradingView.

Renvoi : `m04-l2`, entre 7 et 9 minutes.
Conseil : Éditeur Pine, Créer, Nouveau, Indicateur, on supprime toutes les lignes, on colle le code entier, on enregistre, puis on ferme l'onglet pour ne plus y toucher.

## Q8 · Chapitre 4.2.1 · choix unique

**Que regroupe l'indicateur Trader 360, appelé Multi Pro ?**

- La VWAP et le POC.
- La moyenne mobile 100 et le RSI.
- Les points pivots, la moyenne mobile 20 et les bandes de Bollinger. ✅
- Le Market Profile et la clôture de la veille.

Renvoi : `m04-l2`, entre 8 et 10 minutes.
Conseil : Sa VWAP intégrée n'est pas bonne, on la décoche. La vraie VWAP s'ajoute à part : « prix moyen pondéré par le volume », pas « VWAP auto-ancrée ».

## Q9 · Chapitre 4.2.1 · choix unique

**À combien règle-t-on le compte Paper Trading ?**

- 100 000 $, la valeur par défaut.
- 50 000 $. ✅
- 10 000 $.
- 25 000 $.

Renvoi : `m04-l2`, entre 12 et 13 minutes.
Conseil : On crée un compte nommé par exemple « challenge1 » à 50 000 $, comme un compte de challenge, et pas les 100 000 $ par défaut.

## Q10 · Chapitre 4.2.1 · vrai / faux

**Si tu prends un ordre sans placer ton stop et ton objectif dans le même ordre, le marché peut taper ton stop et laisser ton objectif actif, qui ouvrira alors une position inverse.**

- Vrai ✅
- Faux

Renvoi : `m04-l2`, entre 13 et 15 minutes.
Conseil : Quand SL et TP sont liés, le premier touché annule l'autre. Sinon, l'ordre restant devient un ordre de vente ou d'achat qui se déclenche tout seul. Oublier de fermer ses ordres peut coûter cher.

## Q11 · Chapitre 4.3 · choix unique

**À quelles heures ont lieu les lives trading sur le Discord ?**

- 8 h à 10 h, et 14 h à 16 h.
- 7 h à 9 h, 9 h à 11 h, et 15 h à 17 h. ✅
- 9 h à 12 h seulement.
- 15 h 30 à 22 h.

Renvoi : `m04-l3`, entre 8 et 9 minutes.
Conseil : Trois créneaux, et le replay de chaque live est dans le salon dédié si tu l'as manqué.

## Q12 · Chapitre 4.2.2 · choix unique

**Quel stop maximal, en points, Nadir fixe-t-il sur le S&P 500 ?**

- 2 points.
- 10 points.
- 5,5 points, 6 grand maximum. ✅
- 20 points.

Renvoi : `m04-l4`, entre 19 et 25 minutes.
Conseil : La plupart des trades tournent autour de 3,5 à 4 points. À 4,75 ou 5, le trade commence à être cher : pour garder le même risque en dollars, il faut moins de contrats.

## Q13 · Chapitre 4.2.2 · choix unique

**Pourquoi Nadir met-il 125 $ de risque par trade ?**

- C'est le minimum imposé par TradingView.
- C'est 1 % du compte.
- C'est 0,25 % d'un compte de 50 000 $, soit deux cartouches par jour. ✅
- C'est le prix d'un contrat ES.

Renvoi : `m04-l4`, entre 26 et 29 minutes.
Conseil : 0,25 % par trade, donc pas plus de 0,5 % de perte par jour. Avec plus de goût du risque, 1 % par jour revient à 250 $ par trade. Deux cartouches, et une fois la seconde passée, c'est terminé.

## Q14 · Chapitre 4.2.2 · choix unique

**Pour tracer la clôture de la veille sur la bougie de 21 h 30, on prend :**

- La mèche basse.
- Le corps de la bougie, c'est-à-dire sa fermeture. ✅
- Le plus haut de la bougie.
- La moyenne entre ouverture et fermeture.

Renvoi : `m04-l4`, entre 33 et 37 minutes.
Conseil : Toujours le corps, jamais la mèche. Sur une bougie vendeuse, c'est le bas du corps ; sur une acheteuse, le haut. Toujours en 30 minutes, et on la trace en orange.

## Q15 · Chapitre 4.2.2 · vrai / faux

**Le rectangle vert de l'outil position doit être au moins deux fois plus grand que le rouge.**

- Vrai ✅
- Faux

Renvoi : `m04-l4`, entre 21 et 24 minutes.
Conseil : C'est le ratio de 2 minimum, pour un objectif cohérent. Si tu agrandis le stop, le ratio baisse et il faut réajuster l'objectif.

---

# Ce que j'ai écarté, et pourquoi

```
« Sur quel timeframe prend-on position ? »  -> le 4.2.1 dit 5 minutes,
                                                le 2.5 dit 1 minute en
                                                scalping ; question
                                                ambigue, a trancher par
                                                Nadir avant de la poser
« Que faire a la fin du niveau debutant ? »  -> processus LearnyBox (mail),
                                                a trancher a la bascule
« Qui sont les trois coachs ? »              -> pas une competence
```
