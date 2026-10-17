# La gamification de l'espace formation

Dicté par Nadir le 14/10/2026. ⛔ Document de référence.

---

# 1. Les XP par chapitre

```
chaque chapitre termine rapporte des XP
les XP d un module se repartissent sur ses chapitres
exemple de Nadir : un module de 10 chapitres, 10 XP chacun
```

⚠️ **L'exemple est illustratif**, les chiffres ne sont pas arrêtés.

## ⛔ Tranché par Nadir le 14/10 : 100 XP par module

```
chaque MODULE vaut 100 XP
les 100 XP se divisent par le nombre de chapitres du module
```

⚠️ **Donc un chapitre ne vaut pas la même chose partout**, et c'est voulu : c'est
l'avancement dans le parcours qui est récompensé, pas le temps passé.

```
module 1    7 chapitres   ->  14,3 XP par chapitre
module 2   10             ->  10
module 3    5             ->  20
module 4    5             ->  20
module 5   12             ->   8,3
module 6    5 + quiz      ->  20
module 7    9             ->  11,1
module 7bis 4             ->  25
module 8    3             ->  33,3
module 9    3  (bonus)    ->  33,3
```

⛔ **Les divisions ne tombent pas rondes.** ⚠️ Afficher « 14,3 XP » est laid, et
arrondir chapitre par chapitre fait que le module ne totalise plus 100.

⛔ **Répartir les arrondis plutôt que de les subir** : donner l'XP restant au
dernier chapitre, de sorte que **le total du module fasse exactement 100**.
⚠️ Exemple du module 1 : six chapitres à 14 et un à 16.

⛔ **Et le prouver** : pour chacun des dix modules, la somme des chapitres vaut
100. ⚠️ Avec son témoin : un module dont on retire un chapitre ne doit plus
totaliser 100.

⚠️ **Le module 9 est un bonus** : ⛔ dire s'il rapporte des XP ou non. Un bonus qui
rapporte autant qu'un module obligatoire pousse à le faire en premier.

# 2. L'animation à la fin d'un chapitre

```
un curseur, un rail, qui se remplit
le nombre d XP gagnes apparait
le total du profil s incremente
```

⛔ **Mot de Nadir** : *« un truc animé avec un genre de rail où il gagne 10 XP et
ça se rajoute dans son profil ».*

⚠️ **Le total doit bouger à l'écran**, pas seulement être recalculé au
rechargement. ⛔ C'est ce qui donne la sensation de gain.

⚠️ **Et l'animation ne doit pas bloquer** : un élève qui enchaîne dix chapitres ne
doit pas attendre dix fois. ⛔ Courte, et interrompable par un clic.

⛔ **`prefers-reduced-motion`** : l'animation se réduit à l'affichage du résultat
pour qui l'a demandé. ⚠️ Même règle que pour le défilement du questionnaire.

# 3. Le badge à la fin d'un module

```
une fenetre qui s ouvre
une animation qui fait APPARAITRE le badge
un son, a verifier
```

⛔ **Référence donnée par Nadir : les récompenses de Tradify**, où l'on ouvre des
sortes de coffres. ⚠️ L'idée est l'attente puis la révélation, pas l'affichage sec
d'une image.

## Le son : on le met, tant pis s'il ne passe pas

⛔ **Tranché par Nadir le 14/10** : *« tu peux le mettre, au pire s'il n'apparaît
pas, ce n'est rien ».*

⚠️ Un navigateur bloque tout son qui ne suit pas une action de l'utilisateur.
⛔ Ici le badge arrive après un clic de fin de chapitre, donc il faut le
déclencher **dans ce geste**, pas après un délai : c'est ce qui lui donne le plus
de chances de passer.

⛔ **Et son échec ne casse rien** : l'animation se joue de la même façon, avec ou
sans son.

```
court, deux secondes au plus
jamais si l onglet n est pas au premier plan
coupable, et le choix retenu
```

⚠️ **Quelqu'un qui suit la formation au bureau ou tard le soir** ne veut pas d'un
son surprise. ⛔ Le réglage se prévoit dès le départ, pas après une plainte.

# 4. ⛔ Le mail après chaque quiz

⚠️ Demande de Nadir du 14/10. ⛔ À la fin de chaque quiz, l'élève reçoit un
courriel :

```
son pourcentage de reussite
un retour sur ce qu il a rate
son badge en image, s il l a obtenu
```

⛔ **« Un mail vraiment propre et esthétique »**, ses mots. ⚠️ La maquette des
courriels de candidature est la référence de forme :
`_maquette-mails-candidature/apercu-mails-candidature.html`.

⛔ **Le logo part en pièce jointe liée**, pas en image distante. ⚠️ Et le badge
suit la même règle, pour la même raison : Gmail bloque les images distantes.

⚠️ **Le retour reprend les renvois vidéo** du quiz : s'il a raté trois questions,
le courriel dit lesquelles et où les revoir. ⛔ C'est ce qui le rend utile plutôt
que décoratif.

⛔ **Un quiz raté donne aussi un courriel.** ⚠️ C'est même là qu'il sert le plus :
sans lui, l'élève qui ferme l'onglet après son échec n'a plus rien pour revenir.

⚠️ **Ton à trouver pour un échec** : encourageant sans être faux. ⛔ Textes à
proposer, pas à figer.

# 5. ⛔ Le passage automatique au niveau confirmé

⚠️ Demande de Nadir du 14/10 : un élève au niveau **intermédiaire** qui remplit
**au moins 20 séances** dans son journal passe automatiquement au niveau
**confirmé**, avec une fenêtre de félicitations.

```
« Felicitations, tu as rempli tes 20 seances,
  tu peux passer au niveau confirme. »
```

## ⛔ Mais cela contredit la règle des niveaux, et il faut le trancher

⚠️ **Les niveaux sont un droit d'accès lié au paiement**, décidé le 13/10 :
quelqu'un qui n'a pas payé la formation entière ne doit pas avoir accès à tout.

⛔ **Un passage automatique à 20 séances ouvre donc le niveau confirmé à quelqu'un
qui ne l'a peut-être pas acheté.**

⚠️ Trois lectures possibles, ⛔ et c'est à Nadir de dire laquelle :

```
A. les 20 seances remplacent le quiz, mais le droit d acces
   reste exige  ->  deux verrous, l un s ouvre tout seul
B. les 20 seances ouvrent vraiment tout, et le paiement
   n est verifie qu ailleurs
C. la regle ne vaut que pour les eleves ayant deja paye
   la formation complete
```

⚠️ **C est probablement l'intention**, mais elle n'a pas été dite. ⛔ Ne rien
construire avant la réponse : ouvrir du contenu payant à quelqu'un qui ne l'a pas
acheté ne se rattrape pas en silence.

## ⛔ Règle posée par Nadir le 14/10 : le journal est obligatoire dès l'intermédiaire

> « Normalement, arrivé au module intermédiaire, tout le monde a demandé l'accès
> au journal. Obligatoirement. »

⛔ **Conséquence** : la condition des 20 séances ne pose pas de cas particulier.
⚠️ Un élève intermédiaire sans journal n'est pas un cas à gérer, c'est une
anomalie : l'écran lui propose de demander son accès, par le mécanisme qui existe
déjà (`journal_demande_le`), et c'est tout.

⚠️ **Et cela éclaire le passage débutant → intermédiaire** : il suppose que
l'accès au journal a été demandé. ⛔ À vérifier le jour où ce passage sera
construit, et à faire figurer dans les trois conditions si c'est bien le cas.

## Ce qui reste à préciser dans tous les cas

```
une « seance remplie », c est quoi exactement ?
les journees sans trade comptent-elles ?
20 seances d affilee, ou 20 en tout ?
que se passe-t-il s il efface des seances apres coup ?
```

⚠️ **Ce chantier est rattaché à la refonte esthétique du journal**, pas à l'espace
formation. ⛔ Noté ici pour ne pas le perdre.

# 6. ⚠️ Ce qui existe déjà et qu'il ne faut pas doubler

⛔ **L'espace formation porte déjà XP, niveaux, badges et série**, dérivés de la
progression, sans table nouvelle. ⚠️ Posé au lot 9 du chantier espace membre.

⛔ **Tout ce qui précède s'y raccroche**, et ne se construit pas à côté. ⚠️ Deux
systèmes d'XP qui comptent différemment seraient pires que pas de gamification du
tout.

# 5. ⛔ La règle qui vaut pour tout ce document

⚠️ **La gamification récompense ce qui est fait, elle ne ment pas sur ce qui est
acquis.**

⛔ Un badge obtenu en laissant défiler une vidéo sans la regarder ne vaut rien, et
l'élève le sait. ⚠️ C'est le quiz qui valide la compétence, les XP ne mesurent que
l'avancement.

⛔ **Ne pas confondre les deux dans l'affichage** : « tu as parcouru 60 % du
module » et « tu maîtrises 60 % du module » ne disent pas la même chose.
