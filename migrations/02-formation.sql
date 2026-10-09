-- ============================================================================
-- ESPACE FORMATION : les deux tables de l'élève
-- ⛔ NON APPLIQUÉ. À exécuter APRÈS `01-acces-membre.sql`, qui crée `a_acces_formation()`.
-- ============================================================================
--
-- ⚠️ LES NOMS DE COLONNES SONT REPRIS DE `replay_views`, PAS INVENTÉS.
-- `progress_seconds`, `completed` et `last_watched_at` y portent déjà exactement
-- ces notions, et la reprise de lecture de la formation reprend le mécanisme de
-- `supabase-replays-student.js`. Deux noms différents pour la même notion dans la
-- même base se paieraient au premier rapprochement, et rien ne le signalerait.
--
-- ── ⚠️ LE MODÈLE RLS EST CELUI DES TABLES ÉLÈVE EXISTANTES ────────────────────
-- Relevé le 09/10/2026 sur `journal_entries`, `user_preferences` et
-- `gamification_state` :
--
--     SELECT                  (auth.uid() = user_id) OR is_coach()
--     INSERT/UPDATE/DELETE    auth.uid() = user_id          rôle `authenticated`
--
-- ⛔ `is_coach()` N'APPARAÎT DANS AUCUNE POLITIQUE D'ÉCRITURE. C'est une décision
-- prise sur les tables existantes : le coach lit, il ne modifie rien. Ne la refais
-- pas à l'envers en ajoutant `OR is_coach()` à un WITH CHECK.
--
-- ⚠️ `with check` EST POSÉ SUR L'UPDATE EN PLUS DU `using`. Sans lui, un élève
-- pourrait modifier une de ses lignes pour la réattribuer à quelqu'un d'autre :
-- le `using` contrôle la ligne AVANT, le `with check` la ligne APRÈS. L'omission
-- ne lève aucune erreur et ouvre un trou que personne ne voit.

-- ============================================================================
-- 1. LES NOTES DE COURS
-- ============================================================================
create table if not exists public.formation_notes (
  user_id     uuid        not null references auth.users (id) on delete cascade,
  lecon_id    text        not null,
  texte       text        not null default '',
  updated_at  timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  primary key (user_id, lecon_id)
);

-- ⚠️ La clé primaire est (user_id, lecon_id) et NON un identifiant de ligne : une
-- note par élève et par leçon, ce qui rend l'`upsert` du client correct par
-- construction. Avec une clé technique, deux enregistrements concurrents
-- créeraient deux notes pour la même leçon sans qu'aucune erreur ne le signale.

alter table public.formation_notes enable row level security;

-- ⚠️ `a_acces_formation()` EST LA BARRIÈRE, pas le bouton de l'interface. Une
-- personne dont le droit formation s'est éteint ne relit plus ses notes, même en
-- appelant l'API directement. ⛔ Ses notes ne sont pas supprimées pour autant :
-- le droit rendu, elle les retrouve toutes.
create policy formation_notes_select on public.formation_notes
  for select using (((auth.uid() = user_id) and a_acces_formation()) or is_coach());

create policy formation_notes_insert_strict on public.formation_notes
  for insert to authenticated with check ((auth.uid() = user_id) and a_acces_formation());

create policy formation_notes_update_strict on public.formation_notes
  for update to authenticated
  using ((auth.uid() = user_id) and a_acces_formation())
  with check ((auth.uid() = user_id) and a_acces_formation());

create policy formation_notes_delete_strict on public.formation_notes
  for delete to authenticated using (auth.uid() = user_id);

-- ============================================================================
-- 2. LA PROGRESSION ET LA POSITION DE LECTURE
-- ============================================================================
create table if not exists public.formation_progression (
  user_id          uuid        not null references auth.users (id) on delete cascade,
  lecon_id         text        not null,
  vue              boolean     not null default false,
  progress_seconds integer     not null default 0,
  last_watched_at  timestamptz not null default now(),
  primary key (user_id, lecon_id)
);

-- ⚠️ `vue` ET `progress_seconds` SONT DEUX CHOSES DISTINCTES, et les confondre est
-- le piège de cette table. `progress_seconds` sert la REPRISE de lecture ; `vue`
-- sert la COMPLÉTION, et ⛔ l'élève seul la coche. `replay_views` déduit son
-- `completed` de 90 % de durée écoulée : ici c'est volontairement différent, parce
-- qu'une leçon ouverte puis laissée de côté serait comptée comme vue et que
-- l'élève perdrait confiance dans sa propre barre de progression.
-- La colonne s'appelle donc `vue` et non `completed` : le nom dit la différence.

alter table public.formation_progression enable row level security;

create policy formation_progression_select on public.formation_progression
  for select using (((auth.uid() = user_id) and a_acces_formation()) or is_coach());

create policy formation_progression_insert_strict on public.formation_progression
  for insert to authenticated with check ((auth.uid() = user_id) and a_acces_formation());

create policy formation_progression_update_strict on public.formation_progression
  for update to authenticated
  using ((auth.uid() = user_id) and a_acces_formation())
  with check ((auth.uid() = user_id) and a_acces_formation());

create policy formation_progression_delete_strict on public.formation_progression
  for delete to authenticated using (auth.uid() = user_id);

-- ============================================================================
-- 3. CONTRÔLE APRÈS APPLICATION
-- ============================================================================
-- ⚠️ À exécuter APRÈS, et à lire : une table créée sans RLS est indiscernable
-- d'une table protégée tant qu'on ne regarde pas. Les deux lignes doivent porter
-- `rls = true` et quatre politiques chacune.
--
--   select c.relname, c.relrowsecurity as rls, count(p.polname) as politiques
--     from pg_class c
--     join pg_namespace n on n.oid = c.relnamespace
--     left join pg_policy p on p.polrelid = c.oid
--    where n.nspname = 'public'
--      and c.relname in ('formation_notes', 'formation_progression')
--    group by 1, 2;
