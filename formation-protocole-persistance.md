# Éprouver la persistance : trois manipulations pour Nadir

⚠️ **Pourquoi toi et pas moi.** Les trois contrôles demandent une session réelle.
Ton compte coach porte `formation_actif = true`, mesuré : tu peux donc ouvrir
l'espace membre, écrire, et rien de cela ne touche les données d'un élève,
puisque tout est clavé sur ton identifiant d'authentification.

⛔ **Pas de capture d'écran comme preuve.** Une note affichée après rechargement
peut venir du cache du navigateur. Ce sont les requêtes SQL, en bas de chaque
manipulation, qui prouvent la persistance. Les gestes prouvent l'interface, la
requête prouve la base, et seule la seconde distingue Supabase d'un stockage
local.

---

## Manipulation 1 : la note survit au changement de navigateur

**Ce que tu fais**

1. Ouvre l'aperçu, connecte-toi, et va dans **Formation** (barre latérale gauche,
   sous ton nom).
2. Ferme la fenêtre « Ton parcours » avec le bouton **Continuer**.
3. Clique la carte **Module 01**, puis la première leçon.
4. Dans **Mes notes**, écris une phrase reconnaissable, par exemple
   `essai de persistance du 12 octobre`.

**Ce que tu dois voir, et c'est le point de cette manipulation**

⚠️ À droite du titre « Mes notes », un petit texte change tout seul :

```
Enregistrement…     pendant que tu tapes, et une seconde après
Enregistré          quand c'est fait   ← c'est à ce moment que tu peux fermer
⚠️ Non enregistré    si quelque chose a échoué : ne ferme pas, dis-le-moi
```

⛔ **Ne ferme pas avant d'avoir lu « Enregistré ».** Si tu fermes pendant
« Enregistrement… », la dernière phrase peut ne pas être partie.

5. Ferme complètement la fenêtre. Ouvre un **autre navigateur**, ou une fenêtre
   de navigation privée, connecte-toi, reviens sur la même leçon.

**Ce que cela prouve** : la note n'est pas dans le navigateur, puisqu'un autre
navigateur ne partage ni son stockage local ni son cache.

**La requête que je jouerai**

```sql
select lecon_id, left(texte, 60) as debut, updated_at
  from public.formation_notes
 where user_id = (select id from auth.users where email = 'clubtrader360@gmail.com');
```

Attendu : une ligne, `lecon_id = 'm01-l0'`, le début de ta phrase, et un
`updated_at` de l'heure où tu l'as écrite.

---

## Manipulation 2 : la fenêtre de parcours suit l'appareil

**Ce que tu fais**

1. Toujours dans **Formation**, si la fenêtre « Ton parcours » est ouverte,
   ferme-la avec **Continuer**.
2. Recharge la page. ⚠️ Elle ne doit **pas** se rouvrir.
3. Ouvre un **autre navigateur**, connecte-toi, va dans Formation.

**Ce que tu dois voir** : elle ne se rouvre pas davantage, alors que c'est un
appareil qui ne l'a jamais vue.

**Ce que cela prouve** : l'état est en base et non en stockage local. ⚠️ C'est
exactement la différence qui compte : un repère local aurait rouvert la fenêtre
sur le second navigateur, et tu aurais fini par la fermer sans la lire.

**La requête que je jouerai**

```sql
select lecons_vues_au_dernier_affichage, vue_le
  from public.formation_parcours_vu
 where user_id = (select id from auth.users where email = 'clubtrader360@gmail.com');
```

Attendu : une ligne, avec l'heure de ta fermeture.

---

## Manipulation 3 : la lecture reprend où elle s'est arrêtée

⛔ **Celle-ci est bloquée aujourd'hui**, et il faut le dire plutôt que de te faire
perdre dix minutes. Elle demande une vidéo qui joue, donc que `journaltrader360.fr`
figure dans la liste des domaines autorisés de la vidéo `1229950174`. Cette liste
n'est lisible que dans l'interface Vimeo, et je n'ai pas pu la lire.

**Le jour où ce sera réglé, voici la manipulation**

1. Formation, Module 01, première leçon.
2. Lance la vidéo et laisse-la tourner **au moins une minute**, en vérifiant que
   le temps avance dans le lecteur.
3. ⚠️ Attends encore **dix secondes** après avoir dépassé la minute : la position
   n'est enregistrée qu'une fois toutes les dix secondes, et non en continu.
4. Reviens au sommaire. La ligne de reprise doit dire quelque chose comme
   `Tu en es à Module 01 · leçon 1 · à 1 min`.
5. Ferme tout, rouvre dans un autre navigateur, retourne sur la leçon : le
   lecteur doit **démarrer à la position atteinte**, pas au début.

**La requête que je jouerai**

```sql
select lecon_id, vue, progress_seconds, last_watched_at
  from public.formation_progression
 where user_id = (select id from auth.users where email = 'clubtrader360@gmail.com');
```

Attendu : `progress_seconds` supérieur à 55 environ, et non zéro.

---

## ⚠️ Ce que ces trois manipulations ne prouveront pas

Elles prouvent que **tes** données persistent et te reviennent. ⛔ Elles ne
prouvent pas qu'un élève ne voit pas celles d'un autre : cela demande deux
comptes distincts, et c'est un contrôle à part. Les politiques RLS sont écrites
pour, et leur expression a été relue, mais relire n'est pas mesurer.

## ⛔ Après coup, pour ne rien laisser traîner

Tes lignes d'essai resteront en base. Elles sont sur ton compte et sans
conséquence, mais si tu veux les effacer, dis-le-moi et je te donnerai les trois
suppressions. ⚠️ Je ne les écris pas ici : une requête de suppression qui traîne
dans un document finit par être copiée un jour de fatigue.
