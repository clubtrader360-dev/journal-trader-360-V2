-- ============================================================================
-- LES DEUX DROITS : formation et journal
-- ⛔ NON APPLIQUÉ. Soumis à Nadir, qui l'exécutera après lecture.
-- ============================================================================
--
-- ── ⚠️ POURQUOI UNE TABLE DÉDIÉE, ET PAS DES COLONNES SUR `public.users` ─────
--
-- `public.users` existe et porte déjà `role` et `status`. Elle semblait le bon
-- endroit. ⛔ ELLE NE L'EST PAS, et c'est une MESURE qui le dit, pas un goût.
-- Relevé le 09/10/2026 sur ce projet :
--
--     auth.users                                    102
--     public.users                                   92
--     dont l'uuid correspond à un compte auth        88
--     comptes auth SANS AUCUNE ligne publique        14
--     lignes publiques sans compte auth               4
--
-- Quatorze comptes sur cent deux n'ont aucune ligne dans `public.users`. Des
-- droits portés par cette table les laisserait sans droits, et comme l'absence
-- vaut REFUS, ces quatorze personnes perdraient le journal du jour au lendemain.
-- ⛔ C'est exactement le défaut irrattrapable à éviter : on ne l'apprendrait que
-- par leurs messages.
--
-- La table ci-dessous est donc clavetée sur `auth.users(id)`, la seule liste qui
-- fasse foi, et la migration la remplit depuis `auth.users`.
--
-- ── ⚠️ L'ABSENCE VAUT REFUS, ET C'EST VOULU ─────────────────────────────────
-- Les fonctions plus bas rendent `false` quand la ligne manque. Un droit oublié
-- ferme donc la porte au lieu de l'ouvrir. ⚠️ C'est précisément pour cela que le
-- remplissage initial doit couvrir les 102, et que son compte est contrôlé.

-- ============================================================================
-- 1. LA TABLE
-- ============================================================================
create table if not exists public.acces_membre (
  user_id          uuid        primary key references auth.users (id) on delete cascade,
  formation_actif  boolean     not null default false,
  formation_fin    timestamptz,
  journal_actif    boolean     not null default false,
  journal_fin      timestamptz,
  updated_at       timestamptz not null default now(),
  created_at       timestamptz not null default now()
);

comment on table public.acces_membre is
  'Les deux droits d''un membre. Formation souvent definitive, journal souvent lie a un abonnement.';
comment on column public.acces_membre.formation_fin is
  'Date de fin eventuelle. ⛔ AUCUNE LOGIQUE D''EXPIRATION AUTOMATIQUE ne la lit aujourd''hui : '
  'un droit qui s''eteindrait seul sur une date mal remplie fermerait l''acces a quelqu''un qui a paye.';
comment on column public.acces_membre.journal_fin is
  'Idem. Prevue pour l''abonnement a venir, inerte dans ce lot.';

-- ============================================================================
-- 2. LES DEUX FONCTIONS QUE LIRONT LES POLITIQUES
-- ============================================================================
-- ⚠️ `security definer` ET `search_path` figé, comme `is_coach()` : sans le
-- second, un schéma posé par un appelant pourrait détourner la résolution des
-- noms. C'est la même précaution, prise pour la même raison.
--
-- ⛔ `date de fin` N'EST PAS TESTÉE ICI. Elle est enregistrée, elle n'agit pas.
-- Le jour où l'abonnement arrivera, ce sera un changement VOULU de ces deux
-- fonctions, pas un effet de bord d'une colonne remplie entre-temps.

create or replace function public.a_acces_journal()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.acces_membre a
     where a.user_id = auth.uid() and a.journal_actif
  );
$$;

create or replace function public.a_acces_formation()
returns boolean
language sql
stable
security definer
set search_path to 'public', 'pg_temp'
as $$
  select exists (
    select 1 from public.acces_membre a
     where a.user_id = auth.uid() and a.formation_actif
  );
$$;

-- ============================================================================
-- 3. RLS SUR LA TABLE DES DROITS ELLE-MÊME
-- ============================================================================
alter table public.acces_membre enable row level security;

-- Chacun lit ses propres droits : l'interface en a besoin pour savoir quels
-- boutons montrer. Le coach lit tout le monde.
create policy acces_membre_select on public.acces_membre
  for select using ((auth.uid() = user_id) or is_coach());

-- ⛔ AUCUNE POLITIQUE D'ÉCRITURE, VOLONTAIREMENT, ET C'EST LE POINT LE PLUS
-- IMPORTANT DE CE FICHIER. Si un élève pouvait écrire sa propre ligne, il
-- s'accorderait ses droits lui-même et toute la barrière tomberait sans qu'aucune
-- erreur ne le signale. L'octroi passe donc par le serveur, avec la clé de
-- service, qui contourne RLS. C'est le mécanisme d'approbation actuel, inchangé.
--
-- ⛔ ET L'ACCÈS JOURNAL RESTE ACCORDÉ À LA MAIN PAR UN COACH. Décision de Nadir.
-- Ne le déduis d'aucun paiement, ne le lie à aucun événement, ne l'unifie pas
-- avec l'accès formation : les deux droits se ressemblent, ils ne s'accordent pas
-- de la même façon, et c'est le genre d'économie qui se paie cher.

-- ============================================================================
-- 4. LE REMPLISSAGE INITIAL : LES 102 COMPTES GARDENT TOUT
-- ============================================================================
-- ⛔ LE POINT IRRATTRAPABLE. Les comptes existants ont aujourd'hui les deux
-- accès. Créer le modèle sans les leur accorder les priverait tous du journal.
--
-- `on conflict do nothing` : la migration est rejouable sans écraser un droit
-- déjà réglé à la main entre-temps.
--
-- ⚠️ CE QUE CETTE LIGNE FAIT AUSSI, ET QUI MÉRITE TON ARBITRAGE : elle rend le
-- journal à 4 comptes dont `public.users.status` vaut `revoked`. Ce sont des
-- révocations décidées par un coach, et les ressusciter n'est peut-être pas
-- voulu. Le lot dit « les deux droits à vrai pour TOUS les comptes existants »,
-- donc c'est écrit ainsi. ⚠️ La variante qui respecte les révocations est juste
-- en dessous, en commentaire : choisis, ne laisse pas le hasard choisir.

insert into public.acces_membre (user_id, formation_actif, journal_actif)
select au.id, true, true
  from auth.users au
on conflict (user_id) do nothing;

-- -- VARIANTE, à n'utiliser QU'À LA PLACE de l'insertion ci-dessus :
-- -- le journal n'est pas rendu aux comptes révoqués.
-- insert into public.acces_membre (user_id, formation_actif, journal_actif)
-- select au.id,
--        true,
--        coalesce((select pu.status from public.users pu where pu.uuid = au.id), 'active') <> 'revoked'
--   from auth.users au
-- on conflict (user_id) do nothing;

-- ============================================================================
-- 5. ⚠️ LE CONTRÔLE QUI TRANCHE, À LIRE APRÈS APPLICATION
-- ============================================================================
-- Les trois nombres doivent être 102, 102, 102. ⛔ Si `sans_droits` n'est pas
-- zéro, N'APPLIQUE PAS LA SUITE : des comptes perdraient le journal.
--
--   select (select count(*) from auth.users)                                   as comptes,
--          (select count(*) from public.acces_membre)                          as lignes_droits,
--          (select count(*) from public.acces_membre
--             where formation_actif and journal_actif)                         as les_deux_droits,
--          (select count(*) from auth.users au
--            where not exists (select 1 from public.acces_membre a
--                               where a.user_id = au.id))                      as sans_droits;

-- ============================================================================
-- 6. LES DONNÉES DU JOURNAL EXIGENT LE DROIT JOURNAL
-- ============================================================================
-- ⚠️ C'EST ICI QUE LA PROTECTION EXISTE VRAIMENT. Masquer un bouton n'en est pas
-- une : qui connaît l'adresse entre quand même, et rien ne lève d'erreur. Les
-- politiques sont la seule barrière.
--
-- Chaque politique de LECTURE des tables de journal est remplacée par la même,
-- augmentée de `and a_acces_journal()`. ⛔ La branche `is_coach()` n'est PAS
-- touchée : un coach lit le journal de ses élèves, c'est son métier.
--
-- ⚠️ L'ÉCRITURE EST FERMÉE AUSSI. Sans cela, une personne privée du droit
-- pourrait encore écrire dans son propre journal sans jamais le relire, ce qui
-- est une incohérence silencieuse.
--
-- ⛔ AUCUNE DONNÉE N'EST SUPPRIMÉE, NI MAINTENANT NI PLUS TARD. Un droit éteint
-- ferme la porte, il ne vide pas la pièce. Qui revient six mois plus tard
-- retrouve tout.

do $$
declare
  t text;
begin
  -- Les tables dont le contenu EST le journal de l'élève.
  foreach t in array array[
    'trades', 'journal_entries', 'accounts', 'account_costs', 'daily_fees',
    'payouts', 'checklist_validations', 'gamification_state', 'user_motivation',
    'nutrition_logs', 'replay_views', 'tradovate_credentials', 'tradovate_sync_state'
  ] loop
    execute format(
      'create policy %I on public.%I for select using '
      '(((auth.uid() = user_id) and a_acces_journal()) or is_coach())',
      t || '_select_droit_journal', t);
  end loop;
end $$;

-- ⚠️ LES ANCIENNES POLITIQUES DE LECTURE RESTENT EN PLACE ET DOIVENT ÊTRE
-- SUPPRIMÉES, SINON CE LOT NE SERT À RIEN. Plusieurs politiques `select` sur une
-- même table se COMBINENT PAR OU : il suffit qu'une seule autorise pour que la
-- ligne soit lisible. ⛔ Ajouter la nouvelle sans retirer les anciennes laisse
-- donc la porte grande ouverte, et tous les contrôles passeraient au vert.
--
-- Les noms exacts à supprimer se relèvent AVANT, parce qu'ils diffèrent d'une
-- table à l'autre (certaines portent deux jeux hérités) :
--
--   select c.relname, p.polname
--     from pg_policy p
--     join pg_class c on c.oid = p.polrelid
--     join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public' and p.polcmd = 'r'
--      and p.polname not like '%_droit_journal'
--    order by 1, 2;
--
-- ⛔ Je ne les écris pas en dur ici : une suppression de politique nommée au
-- jugé, sur une base vivante, est exactement le genre d'instruction qu'il ne faut
-- pas exécuter sans avoir lu la liste réelle le jour même.
