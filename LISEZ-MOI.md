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

Un fichier par notion, `textes/<slug>.md`, avec la date de publication, le schéma
correspondant, et le texte découpé **une phrase par ligne** : les différences d'une
version à l'autre se lisent alors ligne à ligne plutôt qu'en un seul pâté.

## Comment il se remplit

Automatiquement, par l'étape « Archiver la notion de culture » de
`.github/workflows/daily-brief.yml`. Chaque brief dépose sa notion ici au passage.
Une notion qui repasse écrase sa version précédente : l'historique git conserve les
deux, et c'est là qu'il faut regarder pour comparer.

## Cette branche n'est jamais fusionnée

Elle ne contient que des données. Aucun code n'en vient, rien n'y est construit, et
elle ne rejoint pas `main`. Même dispositif que `donnees-marche`, pour les mêmes
raisons : une écriture quotidienne par la CI ne doit jamais toucher à `main`.
