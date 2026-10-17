# Le chemin critique de l'espace membre

Ce qui reste entre aujourd'hui, 12/10/2026, et le jour où un élève utilise
l'espace membre pour de vrai.

⚠️ **Ordonné par ce qui débloque le plus en aval**, pas par difficulté. Les trois
premiers points tiennent tout le reste.

---

## 1. La liste des domaines Vimeo

**Qui** : Nadir, dans l'interface Vimeo, vidéo `1229950174` pour commencer.
**Bloque** : les 63 vidéos restantes, la reprise de lecture, et donc la
manipulation 3 du protocole de persistance.

Les 64 vidéos sont en `embed: whitelist`, mesuré. ⛔ La liste des domaines
autorisés n'est lisible ni par l'API disponible ni par aucun test indirect : j'ai
essayé d'interroger `player.vimeo.com` avec différents `Referer`, et le témoin a
montré que le test ne discriminait rien, une vidéo **publique** recevant le même
403 que les autres.

⚠️ **Et le raisonnement « les replays marchent donc le domaine est autorisé » ne
tient pas** : la liste se règle vidéo par vidéo, et 99 replays sont en intégration
publique, donc ils jouent partout sans aucune liste.

**Le geste** : ouvrir les réglages de confidentialité de la vidéo, lire la liste,
et dire si `journaltrader360.fr` y est. ⛔ Rien d'autre tant qu'on ne sait pas.

---

## 2. L'export de la progression LearnyBox

**Qui** : Nadir, **avant** toute coupure.
**Bloque** : rien techniquement, et c'est bien le danger.

⛔ **Cette donnée n'existe nulle part ailleurs.** Le jour où LearnyBox est coupé,
l'historique de ce que chaque élève a déjà vu disparaît. Personne ne s'en
apercevra le jour même : on le découvrira quand un élève dira qu'il a tout perdu.

⚠️ Placé en deuxième parce qu'il est **irrattrapable**, pas parce qu'il bloque
quelque chose. Tous les autres points de cette liste peuvent se refaire.

---

## 3. L'export des comptes LearnyBox

**Qui** : Nadir.
**Bloque** : la bascule, le mail à tous, et la liste des élèves qui perdraient
l'accès.

Un élève a deux identités : son compte LearnyBox et son compte journal, et
⚠️ **les adresses ne sont pas forcément les mêmes**. Trois situations, et la
troisième fait mal :

```
meme adresse des deux cotes      il entre
adresses differentes             il entre, mais cherche ses identifiants LearnyBox
compte LearnyBox sans journal    ⛔ IL N ENTRE PAS
```

Le rapprochement des trois sources, LearnyBox, le tableur de Manu et les 102
comptes du journal, ne peut se faire qu'avec cet export.

---

## 4. La correspondance des dix modules

**Qui** : Nadir, le tableau est prêt.
**Bloque** : le pourcentage de progression, et l'import des 63 vidéos.

`formation-rapprochement-modules.md`, deux colonnes côte à côte. Les huit
correspondances évidentes sont marquées ; deux divergences restent : le module 07
que Vimeo sépare en `MODULE 7` et `7BIS`, et le module 10 sans dossier face à
« Bienvenue à Trader 360 » sans module.

⚠️ Tant que ce n'est pas tranché, **le dénominateur n'existe pas** : le pourcentage
reste caché, et la mention le dit à l'élève plutôt que de mentir.

---

## 5. Les descriptions des leçons

**Qui** : Nadir, depuis LearnyBox, petit à petit.
**Bloque** : rien. Une leçon sans description affiche son titre, proprement.

Le gabarit est documenté dans `assets/formation-donnees.js`, une ligne suffit :

```js
{ id: 'm01-l3', titre: 'Développer sa discipline', description: 'Le texte ici.' },
```

⚠️ Aucune des 64 vidéos ne porte de description sur Vimeo, vérifié : elles ne
peuvent donc pas être récupérées automatiquement.

---

## 6. Le mail de réinitialisation à tous les membres

**Qui** : Nadir, après avoir vérifié le SMTP.
**Bloque** : la bascule des identifiants.

⛔ **LE PIÈGE, ET IL EST MESURÉ.** Le SMTP intégré de Supabase est limité à
quelques messages par heure. Au-delà du quota, les envois échouent **en silence** :
les élèves concernés ne reçoivent rien, et aucune erreur ne remonte.

⚠️ Ce que j'ai pu mesurer, et ce que je n'ai pas pu lire. La configuration SMTP
elle-même n'est pas accessible à mon outillage : aucun outil ne l'expose, et elle
ne vit pas en base. **Ce qui est observable, en revanche, est éloquent** :

```
102 comptes, tous avec une adresse confirmee, aucun jamais connecte
  7 mails de confirmation envoyes depuis la creation du projet
  2 mails de recuperation de mot de passe, le dernier le 18/08/2026
```

⛔ **Le chemin d'envoi n'a donc quasiment jamais servi.** Envoyer 102
réinitialisations d'un coup serait **cinquante fois plus de courrier que ce projet
n'en a jamais envoyé**. On ne peut pas déduire de deux envois réussis que cent
deux passeront.

**Le geste** : dans Supabase, *Project Settings → Authentication → SMTP Settings*,
vérifier si un SMTP personnalisé est configuré. ⚠️ Précédent connu : un mail de
confirmation jamais reçu par Manu. S'il n'y en a pas, en poser un avant d'envoyer
quoi que ce soit en nombre.

---

## 7. La fusion du correctif mobile

**Qui** : Nadir.
**Bloque** : l'usage de l'espace membre sur téléphone, donc la majorité des
lectures de leçons.

PR #112, en attente depuis le 10/10. Sous 1024 pixels, les deux interfaces
restent empilées après connexion : un **élève** y voit l'ossature de l'espace
coach sous son journal. Mesuré, avec captures avant et après.

---

## 8. Le bouton du brief pointe vers la V1

**Qui** : dépendance de la bascule, pas une action isolée.
**Bloque** : rien aujourd'hui.

`api/cron/daily-brief.js` porte un bouton « Ouvrir mon journal → » vers
`https://journaltrader360.fr`, qui sert la **V1**. ⚠️ Un élève qui n'a que la
formation y atterrit sur un journal qui ignore complètement le modèle de droits.
⛔ Non corrigé : il faudra le changer le jour de la bascule, pas avant, sinon il
pointerait vers une V2 que les élèves n'utilisent pas encore.

---

# ⚠️ Ce que j'ajoute, et que la liste initiale ne contenait pas

## 9. Les notes et la progression des 64 leçons passeront par une seule requête

**Qui** : moi, quand les leçons seront remplies.
**Bloque** : rien tant qu'il n'y a qu'un module.

`charger()` lit **toutes** les notes et **toute** la progression d'un élève à
chaque ouverture de l'espace. À sept leçons c'est invisible ; à soixante-quatre,
avec des notes longues, c'est une requête qui grossit à chaque visite alors que
le sommaire n'a besoin que des booléens `vue`.

⚠️ Ce n'est pas urgent et je ne l'ai pas optimisé : optimiser ce qu'on n'a pas
mesuré est une mauvaise habitude. Mais c'est à surveiller le jour de l'import.

## 10. La citation ne suit pas l'élève d'un appareil à l'autre

**Qui** : décision de Nadir, puis moi.
**Bloque** : rien.

La citation vient de `localStorage` **des deux côtés**, journal compris. Un élève
qui change d'ordinateur perd la sienne, et un élève qui n'a que la formation n'en
saisira jamais aucune, ne passant pas par le journal. Une citation par défaut
comble le vide aujourd'hui.

⚠️ La migrer vers la base touche aussi le journal : c'est un lot à part.

## 11. Personne ne sait qu'une demande d'accès attend

**Qui** : décision de Nadir.
**Bloque** : rien, mais l'attente peut durer.

La liste côté coach existe depuis le 11/10, et elle est la source de vérité. ⛔ Il
n'y a aucune notification : si un coach n'ouvre pas cet écran, une demande peut
attendre des jours sans que personne ne le sache.

⚠️ Une notification viendra plus tard, en **rappel**, jamais comme seul signal.
Mais tant qu'elle n'existe pas, quelqu'un doit ouvrir l'écran régulièrement.

## 12. Un vrai refus de demande n'existe pas

**Qui** : décision de Nadir, c'est du produit.
**Bloque** : rien.

Deux actions existent : accorder, et « Plus tard » qui efface la demande. ⛔ Il n'y
a pas de refus motivé, ni de message à l'élève. Quelqu'un à qui on répond « plus
tard » trois fois ne le saura jamais autrement qu'en redemandant.

## 13. Les notes ne sont ni exportables ni sauvegardées

**Qui** : décision de Nadir.
**Bloque** : rien.

Les notes de cours d'un élève vivent dans `formation_notes` et nulle part
ailleurs. ⚠️ Il n'a aucun moyen de les récupérer s'il quitte la formation, et
aucun export n'existe. Ce n'est pas un défaut technique, c'est un choix implicite
que personne n'a pris explicitement.

## 14. Le coach ne voit pas la progression d'un élève dans la formation

**Qui** : décision de Nadir.
**Bloque** : rien.

Les politiques le lui permettent, `is_coach()` est dans les trois branches de
lecture. ⛔ Mais aucun écran ne l'affiche. Un coach ne peut donc pas savoir où en
est un élève, ce qui est pourtant la première question qu'il se posera.

## 15. Les 99 replays en intégration publique

**Qui** : tâche #45, déjà ouverte.
**Bloque** : rien ici.

Relevé en passant : 99 des 291 replays sont en `embed: public`, donc intégrables
sur n'importe quel site par qui connaît leur identifiant. ⛔ Hors de ce chantier,
inscrit pour mémoire.

---

# L'ordre, en une phrase

**1** débloque la vidéo, **4** débloque le pourcentage et l'import, **3** débloque
la bascule, **6** débloque le mail. **2** ne débloque rien et doit pourtant être
fait en premier, parce qu'il est le seul à être irrattrapable.
