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
-- 4. LE REMPLISSAGE INITIAL
-- ============================================================================
-- ⛔ LE POINT IRRATTRAPABLE. Les comptes existants ont aujourd'hui les deux
-- accès. Créer le modèle sans les leur accorder les priverait tous du journal.
--
-- ⚠️ LES RÉVOCATIONS SONT RESPECTÉES. Arbitrage de Nadir du 10/10/2026 : les
-- comptes dont `public.users.status` vaut `revoked` gardent le journal FERMÉ.
-- Une révocation est une décision de coach ; la défaire par effet de bord d'une
-- migration serait exactement l'erreur silencieuse qu'on traque. Ils gardent en
-- revanche l'accès formation, qui n'a jamais été révoqué.
--
-- ⛔ IL N'Y A PLUS DE VARIANTE EN COMMENTAIRE. Une insertion commentée qui traîne
-- finit par être décommentée un jour de fatigue. Celle-ci est la seule.
--
-- ⚠️ `coalesce(..., 'active')` : les 14 comptes sans ligne dans `public.users` ne
-- sont pas révoqués, ils sont simplement absents de cette table. Sans ce
-- `coalesce`, leur `status` vaudrait NULL, la comparaison rendrait NULL, et
-- `journal_actif` deviendrait NULL puis refusé par le `not null`. Ces quatorze
-- personnes perdraient le journal, et c'est le défaut que tout ce fichier évite.
--
-- `on conflict do nothing` : rejouable sans écraser un droit réglé à la main.

insert into public.acces_membre (user_id, formation_actif, journal_actif)
select au.id,
       true,
       coalesce((select pu.status from public.users pu where pu.uuid = au.id), 'active') <> 'revoked'
  from auth.users au
on conflict (user_id) do nothing;

-- ============================================================================
-- 5. ⚠️ LE CONTRÔLE QUI TRANCHE, À LIRE APRÈS LE POINT 4
-- ============================================================================
-- Attendu, relevé le 10/10/2026 : 102 comptes, 102 lignes, 102 avec formation,
-- 98 avec journal, 4 sans journal (les révoqués), 0 sans droits du tout.
-- ⛔ Si `sans_droits` n'est pas zéro, N'APPLIQUE PAS LA SUITE.
--
--   select (select count(*) from auth.users)                                as comptes,
--          (select count(*) from public.acces_membre)                       as lignes,
--          (select count(*) from public.acces_membre where formation_actif) as formation,
--          (select count(*) from public.acces_membre where journal_actif)   as journal,
--          (select count(*) from auth.users au
--            where not exists (select 1 from public.acces_membre a
--                               where a.user_id = au.id))                   as sans_droits;

-- ============================================================================
-- 6. LES DONNÉES DU JOURNAL EXIGENT LE DROIT JOURNAL
-- ============================================================================
-- ⚠️ C'EST ICI QUE LA PROTECTION EXISTE VRAIMENT. Masquer un bouton n'en est pas
-- une : qui connaît l'adresse entre quand même, et rien ne lève d'erreur.
--
-- ── ⛔ TROIS DÉFAUTS DE LA VERSION PRÉCÉDENTE, ET CE QUI LES REMPLACE ────────
--
-- A. UNE POLITIQUE `ALL` COUVRE DÉJÀ LE SELECT. Ajouter une politique SELECT à
--    côté ne restreint rien : les politiques permissives se combinent par OU. La
--    version précédente aurait pu s'exécuter entièrement en laissant la lecture
--    ouverte, sans qu'aucun contrôle n'échoue.
--
--    ⚠️ Relevé du 10/10/2026 sur LE SCHÉMA ENTIER, pas sur une liste de noms :
--    quatre politiques `ALL` existent, et elles ne posent pas toutes le problème.
--
--      tradovate_credentials_self_modify   (auth.uid() = user_id)   ⛔ OUVRE la lecture
--      tradovate_sync_state_self           (auth.uid() = user_id)   ⛔ OUVRE la lecture
--      nutrition_logs_coach_all            is_coach()               coach seul, inoffensive
--      replays_write                       can_manage_replays()     hors périmètre élève
--
--    ⚠️ `nutrition_logs` N'A MÊME PAS DE COLONNE `user_id`, vérifié. Elle n'est
--    pas une table d'élève : seul un coach y accède, et il n'y a rien à fermer.
--    Le défaut annoncé pour trois tables n'en concerne donc que DEUX.
--
--    Ce que je propose, et c'est ce qu'écrit le bloc ci-dessous : REMPLACER les
--    deux `ALL` par des politiques PAR COMMANDE portant le droit. Une politique
--    par commande se relit, se compte et se contrôle ; une `ALL` cache dans un
--    seul objet quatre autorisations dont une seule nous intéresse.
--
-- B. L'ÉCRITURE EST FERMÉE POUR DE VRAI, CETTE FOIS. La version précédente
--    affirmait la fermer et ne créait que des politiques `for select`.
--    ⚠️ C'est le motif du 8 octobre à l'identique : un commentaire qui dit ce que
--    le code ne fait pas, et qui passe la relecture parce qu'on lit le
--    commentaire. Le raisonnement était juste, c'est le code qui manquait : sans
--    cela, une personne privée du droit écrirait encore dans un journal qu'elle
--    ne peut plus relire.
--
-- C. LES ANCIENNES POLITIQUES SONT SUPPRIMÉES, ET LEURS NOMS NE SONT PAS ÉCRITS
--    EN DUR. Six tables portent deux jeux hérités. ⚠️ Le bloc les relève DANS LE
--    CATALOGUE AU MOMENT DE S'EXÉCUTER : une liste recopiée serait périmée si une
--    politique était ajoutée entre-temps, et une suppression nommée au jugé sur
--    une base vivante est précisément ce qu'il ne faut pas exécuter à l'aveugle.
--
-- ⛔ AUCUNE DONNÉE N'EST SUPPRIMÉE. Un droit éteint ferme la porte, il ne vide
-- pas la pièce. Arbitrage de Nadir : on masque entièrement, pas de lecture seule.
--
-- ⚠️ LA SURFACE D'AUTORISATION EST PRÉSERVÉE À L'IDENTIQUE. On ne recrée que les
-- commandes qui existaient déjà. `checklist_validations` et `replay_views` n'ont
-- pas de politique DELETE aujourd'hui : elles n'en auront pas davantage. Ajouter
-- une permission en passant serait un effet de bord, pas une migration.

do $$
declare
  cible      text;
  -- ⚠️ `"char"` ENTRE GUILLEMETS, ET PAS `char`. `pg_policy.polcmd` est du type
  -- interne `"char"`, un seul octet, distinct de `character`. Une premiere version
  -- declarait `char[]` : la requete echouait avec
  -- « CASE/WHEN could not convert type character[] to "char"[] ».
  -- ⛔ Elle aurait fait exploser la migration a l application. Trouvee en eprouvant
  -- la partie risquee EN LECTURE SEULE avant d ecrire quoi que ce soit.
  commande   "char";
  nom        text;
  surface    "char"[];
  supprimees int := 0;
  creees     int := 0;
  CIBLES constant text[] := array[
    'trades', 'journal_entries', 'accounts', 'account_costs', 'daily_fees',
    'payouts', 'checklist_validations', 'gamification_state', 'user_motivation',
    'replay_views', 'tradovate_credentials', 'tradovate_sync_state'
  ];
begin
  foreach cible in array CIBLES loop
    -- ⚠️ LA SURFACE EST RELEVÉE AVANT TOUTE SUPPRESSION. Une politique `ALL`
    -- compte pour les quatre commandes, puisque c'est ce qu'elle autorise.
    select array_agg(distinct c2)
      into surface
      from (
        select unnest(case when p.polcmd = '*'
                           then array['r','a','w','d']::"char"[]
                           else array[p.polcmd] end) as c2
          from pg_policy p
          join pg_class c on c.oid = p.polrelid
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = cible
           -- ⛔ Les politiques purement coach ne décrivent pas la surface ÉLÈVE.
           and coalesce(pg_get_expr(p.polqual, p.polrelid), '') <> 'is_coach()'
      ) s;

    if surface is null then
      raise notice '⚠️  % : aucune politique eleve, rien a faire', cible;
      continue;
    end if;

    -- Suppression de tout ce qui existait, coach excepté.
    for nom in
      select p.polname
        from pg_policy p
        join pg_class c on c.oid = p.polrelid
        join pg_namespace n on n.oid = c.relnamespace
       where n.nspname = 'public' and c.relname = cible
         and coalesce(pg_get_expr(p.polqual, p.polrelid), '') <> 'is_coach()'
    loop
      execute format('drop policy %I on public.%I', nom, cible);
      supprimees := supprimees + 1;
    end loop;

    -- Recréation, une politique par commande, avec le droit.
    foreach commande in array surface loop
      if commande = 'r' then
        execute format(
          'create policy %I on public.%I for select to authenticated '
          'using (((auth.uid() = user_id) and a_acces_journal()) or is_coach())',
          cible || '_droit_journal_select', cible);
      elsif commande = 'a' then
        execute format(
          'create policy %I on public.%I for insert to authenticated '
          'with check ((auth.uid() = user_id) and a_acces_journal())',
          cible || '_droit_journal_insert', cible);
      elsif commande = 'w' then
        -- ⚠️ `using` ET `with check` : le premier contrôle la ligne AVANT, le
        -- second la ligne APRÈS. Sans le second, on réattribuerait sa ligne.
        execute format(
          'create policy %I on public.%I for update to authenticated '
          'using ((auth.uid() = user_id) and a_acces_journal()) '
          'with check ((auth.uid() = user_id) and a_acces_journal())',
          cible || '_droit_journal_update', cible);
      elsif commande = 'd' then
        execute format(
          'create policy %I on public.%I for delete to authenticated '
          'using ((auth.uid() = user_id) and a_acces_journal())',
          cible || '_droit_journal_delete', cible);
      end if;
      creees := creees + 1;
    end loop;

    raise notice '%  surface %  ->  politiques posees', cible, surface;
  end loop;

  raise notice '== % politique(s) supprimee(s), % creee(s) ==', supprimees, creees;
end $$;

-- ============================================================================
-- 7. ⚠️ LE CONTRÔLE DE COUVERTURE, AVEC SON TÉMOIN
-- ============================================================================
-- ⛔ Il ne suffit pas que les nouvelles politiques existent : il faut qu'il n'en
-- reste AUCUNE autre qui ouvre la lecture sans le droit. Cette requête liste
-- toute politique de lecture d'une table de journal dont l'expression ne mentionne
-- pas `a_acces_journal`. Attendu : AUCUNE LIGNE, sauf le témoin.
--
-- ⚠️ LE TÉMOIN EST OBLIGATOIRE. `replays` est volontairement HORS périmètre :
-- c'est du contenu partagé, pas le journal de quelqu'un. Elle DOIT apparaître
-- dans le résultat. Si elle n'apparaît pas, c'est que la requête dit oui à tout
-- et qu'un « aucune ligne » ne prouverait rien.
--
--   select c.relname, p.polname, pg_get_expr(p.polqual, p.polrelid) as expr,
--          case when c.relname = 'replays' then '← TEMOIN, doit apparaitre'
--               else '⛔ FAILLE' end as verdict
--     from pg_policy p
--     join pg_class c on c.oid = p.polrelid
--     join pg_namespace n on n.oid = c.relnamespace
--    where n.nspname = 'public'
--      and p.polcmd in ('r', '*')
--      and c.relname in (
--        'trades', 'journal_entries', 'accounts', 'account_costs', 'daily_fees',
--        'payouts', 'checklist_validations', 'gamification_state', 'user_motivation',
--        'replay_views', 'tradovate_credentials', 'tradovate_sync_state',
--        'replays')
--      and coalesce(pg_get_expr(p.polqual, p.polrelid), '') not like '%a_acces_journal%'
--      and coalesce(pg_get_expr(p.polqual, p.polrelid), '') <> 'is_coach()'
--    order by 1, 2;
--
-- ⚠️ `nutrition_logs` n'est pas dans cette liste, et c'est volontaire : elle n'a
-- pas de colonne `user_id` et sa seule politique est `is_coach()`. Il n'y a rien
-- à fermer, et l'y mettre ferait apparaître une fausse faille à chaque contrôle.
