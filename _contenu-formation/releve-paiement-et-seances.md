# Relevé : le paiement et les vingt séances

⛔ **Relevé, non construit.** ⚠️ Les deux conditions vivent hors de l'espace
formation, et ce lot n'y touche pas.

---

## 1. Le paiement, dans le tableur de Manu

⚠️ **Relevé dans `src/Code.js` du dépôt Apps Script, le 14/10.**

```
COL.AB_CONTRAT = 28   colonne AB   « À envoyer » / état du contrat
COL.AC_MONTANT = 29   colonne AC   le MONTANT, formaté « #,##0 € »
```

⛔ **La colonne AC porte le montant**, pas un état « payé / pas payé ». ⚠️ Il
existe des contrôles nommés `c_montant_illisible` et `c_montant_nul`, et une
fonction `syncMontantsColAB` qui aligne AB sur LearnyBox. ⛔ Donc : le tableur
sait **combien**, il ne dit pas directement **si le solde est à zéro**.

### ⚠️ Ce que cela implique, et c'est le point délicat

⛔ « A tout payé » ne se lit pas dans une colonne. ⚠️ Il faudrait soit comparer
le montant versé au montant dû, soit que Manu tienne une colonne d'état.
⛔ **C'est une décision pour Manu et Nadir, pas une question technique.**

### Par quel chemin le journal le lirait

⚠️ **Le chemin existe déjà, en sens inverse** : le site expose
`GET /api/tableur/candidatures`, et le script Apps Script vient chercher.
⛔ Pour le paiement, il faudrait l'inverse : le tableur **expose**, le journal
vient chercher.

```
1. une action lecture seule dans le dispatcher doGet du script,
   protegee par le meme AGENT_TOKEN que le reste
2. elle rend, par eleve : identifiant ou courriel, et l etat de paiement
3. le journal l appelle depuis une fonction serveur, jamais depuis
   le navigateur : le jeton ne doit pas atteindre le client
4. et il met en cache : une lecture par eleve et par chargement
   ferait un appel Apps Script a chaque ouverture de page
```

⛔ **Rien de tout cela n'est construit.** ⚠️ Et le tableur ne se touche pas.

---

## 2. Les vingt séances, dans le journal

⚠️ **Relevé dans `supabase-journal.js`, le 14/10.**

Une séance est une ligne de `journal_entries`, une par **date**. Elle porte un
drapeau `no_trade`, alimenté par la case « Pas de trade » du formulaire.

```
journal_entries   une ligne par jour
no_trade          booleen, « je n ai pas tradé aujourd hui »
```

### ⛔ Quatre questions sans réponse, et aucune n'est technique

```
1. une « seance remplie », c est quoi ?
   une ligne existe ? une ligne avec au moins un trade ?
   une ligne dont la checklist est complete ?

2. les journees sans trade comptent-elles ?
   ⚠️ `no_trade` existe deja, donc la question est tranchable
   ⛔ mais elle ne l est pas : une journee sans trade est une
      discipline, ou une journee vide, selon ce qu on veut mesurer

3. vingt d affilee, ou vingt en tout ?
   ⚠️ « d affilee » punit une semaine de vacances

4. que se passe-t-il si l eleve en efface apres coup ?
   ⛔ un compteur qui redescend rouvrirait un niveau deja ouvert
   ⚠️ un compteur qui ne redescend jamais se triche en une soiree
```

### ⚠️ Ce que je proposerais, si on me le demandait

⛔ **Vingt lignes distinctes, `no_trade` comprises, jamais décrémenté.**

⚠️ Raisons : `no_trade` est une discipline, pas une absence : l'élève a ouvert
son journal et constaté qu'il ne tradait pas. ⛔ Et ne jamais décrémenter évite
le pire cas, un élève qui perd un accès déjà ouvert à cause d'un ménage dans son
journal.

⚠️ **Le risque assumé** : vingt lignes se créent en une soirée. ⛔ Si cela compte,
il faut vingt dates **distinctes**, ce que la structure permet déjà puisqu'il y a
une ligne par jour.

⛔ **Je ne tranche pas.** ⚠️ Ce point est rattaché à la refonte du journal, pas à
l'espace formation.
