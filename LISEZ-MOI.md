# Prose des notions de culture de marché

Une rubrique « culture de marché » part dans chaque brief quotidien. Son texte est
rédigé au moment de l'envoi, à partir d'un angle d'une ligne défini dans
`api/_lib/culture-marche.js` sur `main`. Ce dossier conserve ce texte.

## Pourquoi cette branche existe

Le texte n'était conservé nulle part. Il vivait dans l'artefact `brief-html` du run,
à **quatorze jours de rétention**, et dans les courriels envoyés. Passé ce délai, la
seule copie durable était une boîte mail, ce qui n'est pas un archivage.

Une notion tombe chaque jour ouvré. Sans ce dossier, la prose des vingt notions aurait
été perdue au fil de l'eau, et il aurait fallu la réécrire pour les articles de la
section Ressources du site.

## Ce que contient un fichier

Un fichier par notion, `textes/<slug>.md`, avec le nom lisible, la date de publication,
le schéma correspondant, et le texte découpé **une phrase par ligne** : les différences
d'une version à l'autre se lisent alors ligne à ligne plutôt qu'en un seul pâté.

## Comment il se remplit

**Aujourd'hui : à la main, et seulement quand quelqu'un y pense.**

L'étape « Archiver la notion de culture » qui devait remplir cette branche
automatiquement a été écrite dans la **PR #106**, ouverte le 23 septembre 2026. Elle
n'a jamais été fusionnée. Le workflow `daily-brief.yml` exécuté chaque nuit sur `main`
ne porte donc aucune étape d'archivage.

⚠️ **Ce paragraphe affirmait le contraire jusqu'au 28 septembre 2026.** Il disait :
« Automatiquement, par l'étape "Archiver la notion de culture" de
`.github/workflows/daily-brief.yml`. Chaque brief dépose sa notion ici au passage. »
C'était l'intention de la PR, écrite au présent comme si elle était déjà en service.
Personne n'est allé vérifier, puisque le document disait que c'était fait.

Coût mesuré : neuf notions ont été publiées dans les briefs entre le 16 et le 28
septembre. Cinq figuraient ici, déposées à la main le 23 septembre. **Quatre avaient
disparu** avec l'expiration de leurs artefacts, sans qu'aucun signal ne le dise. Elles
ont été récupérées le 28 septembre depuis les campagnes Brevo, qui conservent le HTML
envoyé.

Le texte de `support-resistance.md` a été remplacé à cette occasion : la version
déposée à la main différait de celle réellement publiée dans le brief du 21 septembre.
C'est le texte envoyé aux élèves qui fait foi.

**Demain, si la PR #108 est fusionnée :** automatiquement, par l'étape « Archiver le
brief et la notion de culture », APRÈS l'envoi du brief. Et surtout, un second
workflow, `verif-archive.yml`, vérifie chaque matin que chaque brief parti a bien
rejoint l'archive — sans rien demander à l'archivage lui-même, en partant des
artefacts de brief. C'est ce qui permet de détecter un dispositif qui n'a jamais été
branché : du code absent ne lève pas d'erreur, et c'est exactement ce qui s'est passé
ici.

Tant que ce n'est pas fusionné, **ce paragraphe reste vrai au présent** : rien ne
remplit cette branche tout seul.

## Une notion qui repasse

La rotation revient sur les mêmes notions. Un texte réécrit écrase le précédent :
l'historique git conserve les deux, et c'est là qu'il faut regarder pour comparer.

## Cette branche n'est jamais fusionnée

Elle ne contient que des données. Aucun code n'en vient, rien n'y est construit, et
elle ne rejoint pas `main`. Même dispositif que `donnees-marche`, pour les mêmes
raisons : une écriture quotidienne par la CI ne doit jamais toucher à `main`.
