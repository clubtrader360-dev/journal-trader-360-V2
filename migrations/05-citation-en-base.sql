-- ============================================================================
-- LA CITATION PASSE EN BASE, POUR LE JOURNAL ET LA FORMATION
-- ⛔ NON APPLIQUE. Soumis a Nadir.
-- ============================================================================
--
-- ── ⚠️ CE QUE LE STOCKAGE LOCAL COUTE AUJOURD'HUI ───────────────────────────
--
-- `loadMantra()` lit `localStorage.userMantra` et `localStorage.userMantraAuthor`.
-- Trois consequences, dans l'ordre de gravite :
--
--   1. ⛔ ELLE EST PERDUE LE JOUR OU L'ELEVE VIDE SON NAVIGATEUR, sans le
--      moindre avertissement. C'est le point le plus grave : il n'a rien fait de
--      mal, et il ne saura meme pas qu'il y avait quelque chose a sauver.
--   2. Elle ne le suit pas d'un appareil a l'autre : celle de son ordinateur
--      n'existe pas sur son telephone.
--   3. Un eleve qui n'a QUE la formation n'en aura jamais, puisqu'il ne passe
--      pas par le journal pour la saisir.
--
-- ── ⚠️ POURQUOI `user_preferences` ET PAS UNE TABLE NEUVE ───────────────────
--
-- Elle existe deja et porte exactement cela : `theme`, `accent_color`,
-- `animations_enabled`, `vacation_mode`. ⛔ Une table de plus pour deux colonnes
-- ferait un second endroit ou chercher les reglages d'un eleve, et le jour ou
-- quelqu'un en ajoutera un troisieme, personne ne saura plus lequel fait foi.
--
-- Ses politiques sont deja les bonnes : lecture par le proprietaire ou un coach,
-- ecriture par le proprietaire seul. ⛔ Rien a ajouter de ce cote.

alter table public.user_preferences
  add column if not exists mantra_texte  text,
  add column if not exists mantra_auteur text;

comment on column public.user_preferences.mantra_texte is
  'La citation choisie par l''eleve, affichee dans le journal ET dans la formation. '
  'Null = aucune, et la formation affiche alors une citation Trader 360 par defaut.';

-- ============================================================================
-- ⚠️ LA REPRISE DE L'EXISTANT, ET C'EST LE POINT DELICAT
-- ============================================================================
-- ⛔ AUCUNE REQUETE SQL NE PEUT RECUPERER CES CITATIONS. Elles vivent dans le
-- navigateur de chaque eleve, et la base ne les a jamais vues. Une migration qui
-- se contenterait de creer les colonnes effacerait silencieusement ce que des
-- gens ont ecrit : au premier chargement apres la bascule, le code lirait la
-- base, n'y trouverait rien, et afficherait la citation par defaut. L'eleve
-- croirait la sienne perdue.
--
-- ⚠️ LA REPRISE SE FAIT DONC DANS LE NAVIGATEUR, PAS ICI. `supabase-formation.js`
-- et le journal appliquent la regle suivante, dans cet ordre :
--
--   1. lire `mantra_texte` en base
--   2. si la base est VIDE et que `localStorage` porte une citation,
--      la TELEVERSER puis l'afficher          ← la reprise, une seule fois
--   3. si les deux sont vides, citation par defaut
--
-- ⛔ ET `localStorage` N'EST PAS EFFACE, meme apres televersement. Tant que tous
-- les eleves ne se sont pas reconnectes, c'est la seule copie de la citation de
-- ceux qui ne sont pas revenus. ⚠️ On ne jette pas la seule copie d'une donnee
-- parce qu'on vient d'en faire une autre.
--
-- ⚠️ Et la base GAGNE des qu'elle porte quelque chose : sinon une citation
-- changee sur un appareil serait ecrasee par l'ancienne valeur d'un autre.

-- ============================================================================
-- ⚠️ CONTROLE APRES APPLICATION
-- ============================================================================
-- Juste apres, tout est a zero : personne ne s'est encore reconnecte.
--
--   select count(*) as lignes,
--          count(*) filter (where mantra_texte is not null) as citations_reprises
--     from public.user_preferences;
--
-- ⚠️ ET LE CONTROLE QUI COMPTE EST CELUI D'APRES, quelques jours plus tard : le
-- nombre de citations reprises doit MONTER a mesure que les eleves reviennent.
-- ⛔ S'il reste a zero alors que des eleves se sont connectes, la reprise cote
-- navigateur ne fonctionne pas, et elle echoue en silence.
