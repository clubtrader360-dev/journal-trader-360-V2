# Ce qui change, en clair

Pour Nadir. ⛔ Pas une liste de commits : ce document dit ce qui change dans
l'usage, et ce qui ne change pas.

---

## 1. Pour un élève existant, qui a les deux droits

**Presque rien, et c'est voulu.** Les 82 élèves qui reçoivent le rapport ont
aujourd'hui les deux droits, mesuré : aucun n'est dans une situation nouvelle.

Ce qu'il verra de différent :

- à la connexion, un écran de plus : **« Où veux-tu aller ? »**, avec deux
  boutons, Formation et Journal. Un clic, et il est dans son journal comme avant.
- dans la barre latérale du journal, sous son nom, une entrée **Formation**.
- rien d'autre. Son journal, ses trades, ses comptes, ses replays sont inchangés.

⚠️ **Le seul vrai changement d'habitude est ce clic de plus.** Si cela te semble
de trop pour quelqu'un qui vient surtout pour son journal, on peut mémoriser son
dernier choix et le proposer par défaut. ⛔ Je ne l'ai pas fait : c'est un
arbitrage d'usage, pas une évidence.

## 2. Pour toi, côté coach

Trois choses nouvelles, toutes dans l'écran **Inscriptions** :

- **Progression dans la formation** : chaque élève, où il en est, combien de notes
  il a écrites, et quand il est venu la dernière fois. Les absents depuis plus de
  trois semaines remontent en premier et se signalent.
- **Demandes d'accès au journal** : qui attend, depuis quand, et deux boutons,
  *Accorder le journal* et *Plus tard*.
- un **compteur** à côté d'« Inscriptions » dans ta barre latérale, qui n'apparaît
  que lorsqu'une demande attend.

Et une entrée **Formation** dans ta barre latérale : tu relis les leçons comme un
élève les voit. ⚠️ Tes notes y sont les tiennes, séparées des leurs.

⛔ **Tu ne vois aucune note d'élève, nulle part.** Les politiques te le
permettraient, le produit non : une note est un espace personnel, et quelqu'un qui
se doute qu'elle est lue cesse d'en écrire. Tu vois combien il en a écrites, pas
ce qu'elles disent.

## 3. Ce qui ne bouge pas

- **le journal** : trades, comptes, journal quotidien, comptabilité, checklist,
  gamification. Rien n'est touché ;
- **le brief du matin** : mêmes destinataires, même contenu, même heure ;
- **les replays** : inchangés ;
- **l'approbation des inscriptions** : le mécanisme existant n'a pas bougé d'une
  ligne ;
- **les quatre comptes fermés** : ils le restent, formation comprise.

⚠️ Une seule chose change dans le rapport du dimanche, et elle ne concerne
personne aujourd'hui : un élève qui aurait la formation **sans** le journal
recevra une troisième variante, qui parle de sa formation. Les 82 destinataires
actuels ne sont pas concernés.

## 4. Ce qui reste à faire avant que cela serve

Par ordre de ce qui débloque le plus. Le détail est dans
`formation-chemin-critique.md`.

| | qui | bloque |
|---|---|---|
| **1. La liste des domaines Vimeo** | toi, dans Vimeo | les 63 vidéos, la reprise de lecture |
| **2. L'export de la progression LearnyBox** | toi | ⛔ rien, et c'est le danger : irrattrapable |
| **3. L'export des comptes LearnyBox** | toi | la bascule, le mail à tous |
| **4. La correspondance des dix modules** | toi, tableau prêt | le pourcentage, l'import des vidéos |
| **5. Les descriptions des leçons** | toi, depuis LearnyBox | rien, elles arrivent au fil de l'eau |
| **6. Le SMTP avant le mail à tous** | toi, dans Supabase | la bascule des identifiants |
| **7. La fusion du correctif mobile** | toi, PR #112 | l'usage sur téléphone |
| **8. Les migrations 03 et 04** | ⛔ déjà appliquées | rien |

⚠️ **Le point 2 ne bloque rien et doit pourtant passer en premier.** Tout le reste
peut se refaire ; ce que tes élèves ont déjà parcouru chez LearnyBox n'existe
nulle part ailleurs. L'outil qui l'importera est prêt et attend son fichier :
le format qu'il attend est écrit en tête de `outils/formation-import-progression.mjs`.

## 5. ⚠️ Ce qu'il faudra regarder à l'œil, et qu'aucune sonde ne voit

Une sonde mesure ce qu'on lui demande de mesurer. Ces cinq choses, elle ne les
voit pas.

**Le premier écran après connexion.** J'ai mesuré qu'il apparaît et que les bons
boutons s'y trouvent. ⛔ Je n'ai pas pu mesurer s'il est **agréable** : s'il
s'affiche vite, s'il ne clignote pas, si on comprend en une seconde ce qu'on doit
cliquer. Connecte-toi et regarde.

**La fenêtre de parcours, la première fois.** C'est elle qui accueille chaque
nouvel élève. ⚠️ Mes captures la montrent à zéro pour cent, et elle m'a l'air
juste, mais c'est toi qui sais si elle donne envie de commencer ou si elle fait
« encore une fenêtre à fermer ».

**Les dix phrases du parcours.** Elles parlent en ton nom, une par module. ⛔ Je
les ai écrites conformes, sans aucune promesse de gain, mais je ne sais pas si
elles te ressemblent. Elles sont dans `assets/formation-donnees.js`, bloc
`PHRASES`.

**Le texte du rapport du dimanche, troisième variante.** Même remarque, et plus
important encore : il part chaque semaine. Il est dans
`api/cron/_lib/weekly-expert-system.js`, fonction `generateFormationReportHTML`.

**La lecture d'une leçon sur ton téléphone.** J'ai des captures à 390 pixels et
elles tiennent. ⚠️ Mais lire une leçon, prendre une note au pouce et revenir au
sommaire est une suite de gestes, pas une image. ⛔ Personne ne l'a encore faite
en vrai.

---

## Et les trois choses que je n'ai pas pu mesurer du tout

⛔ Je les redis ici pour qu'elles ne se perdent pas dans les rapports.

1. **Les notes survivent-elles à un changement de navigateur ?** Le protocole est
   écrit pour toi dans `formation-protocole-persistance.md`, avec la requête SQL
   que je jouerai après.
2. **La reprise de lecture**, qui demande une vidéo qui joue, donc le point 1 du
   chemin critique.
3. **Le mail à 102 personnes.** Ce projet n'a jamais envoyé plus de 7 courriels
   depuis sa création. ⛔ On ne peut pas déduire de deux envois réussis que cent
   deux passeront.

