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
-- ⚠️ 0. UNE SEULE TRANSACTION, ET CE N'EST PAS UNE PRÉCAUTION DE STYLE
-- ============================================================================
-- Ce fichier SUPPRIME 61 politiques avant d'en recréer 46. ⛔ Entre les deux, les
-- tables n'ont aucune politique, donc PERSONNE n'y accède : avec RLS actif et
-- aucune politique, tout est refusé. Un échec à cet instant laisserait 102 élèves
-- dehors, et la seule trace des 61 définitions serait le fichier de restauration.
--
-- ⚠️ POSTGRES SAIT ANNULER DU DDL, mais seulement si on le lui demande. Hors
-- transaction explicite, chaque instruction est validée seule : une erreur au
-- milieu ne défait rien de ce qui précède. Le `begin` ci-dessous et le `commit`
-- final ne sont donc pas décoratifs, ⛔ NE LES RETIRE PAS, et ne découpe pas ce
-- fichier en morceaux exécutés séparément.
--
-- ⚠️ Le bloc `do $$` est de toute façon atomique à lui seul, puisqu'une exception
-- y annule tout son contenu. Ce qu'ajoute la transaction, c'est de couvrir AUSSI
-- la création de la table, des fonctions et le remplissage : soit le lot entier
-- passe, soit la base reste exactement comme avant.

-- ============================================================================
-- ⚠️ ETAT REEL DE LA BASE AU 10/10/2026, A LIRE AVANT D'EXECUTER
-- ============================================================================
-- La PARTIE ADDITIVE de ce fichier a deja ete appliquee en production par Nadir :
--
--     public.acces_membre        102 lignes, 102 formation, 98 journal
--     public.a_acces_journal()   public.a_acces_formation()
--     acces_membre_select        la politique de lecture de la table des droits
--
-- ⚠️ CE FICHIER EST DONC REJOUABLE, ET IL DOIT LE RESTER. `create table if not
-- exists`, `create or replace function`, `on conflict do nothing` et le
-- `drop policy if exists` plus bas couvrent chacun leur cas. Rejoue, il ne
-- reinsere rien et ne casse rien.
--
-- ⛔ LES 61 POLITIQUES DES TABLES DE JOURNAL N'ONT PAS BOUGE : `trades` en porte
-- toujours huit, verifie. La partie risquee est entierement devant nous.

begin;

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
-- ⚠️ `drop ... if exists` D'ABORD : Postgres n'a pas de `create policy if not
-- exists`, et la partie additive de ce fichier a DEJA ete appliquee en production
-- le 10/10/2026. Sans cette ligne, rejouer le fichier echouerait ici, donc avant
-- la partie risquee, en laissant croire que rien n'a ete fait.
drop policy if exists acces_membre_select on public.acces_membre;
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

-- ── ⛔ D. UNE QUATRIÈME GÉNÉRALISATION, TROUVÉE EN CHERCHANT LA TROISIÈME ────
--
-- La version précédente imposait `or is_coach()` à TOUTES les politiques de
-- lecture. Relevé du 10/10/2026, expression par expression, sur les 61 :
--
--     is_coach()            7 tables   account_costs, accounts, checklist_validations,
--                                      gamification_state, journal_entries, payouts, trades
--     can_view_replays()    1 table    replay_views
--     AUCUNE branche large  4 tables   daily_fees, tradovate_credentials,
--                                      tradovate_sync_state, user_motivation
--
-- ⛔ DEUX DÉFAUTS, PAS UN SEUL.
--   1. Sur `replay_views`, `is_coach()` REMPLAÇAIT `can_view_replays()`. Ce sont
--      deux fonctions différentes : `can_view_replays()` rend vrai pour TOUT compte
--      de `public.users` dont le `status` est actif ou approuvé, donc pour les
--      élèves aussi, pas seulement pour les coachs. Lue, pas supposée.
--   2. Sur les QUATRE tables sans branche large, `or is_coach()` ÉLARGISSAIT :
--      il aurait donné aux coachs une lecture qu'ils n'ont pas aujourd'hui, dont
--      celle de `tradovate_credentials`. Une migration qui ouvre un accès en
--      passant est pire qu'une qui en ferme un : personne ne s'en plaint.
--
-- ⚠️ Aucun contrôle n'aurait échoué dans les deux cas. Les tables restaient
-- lisibles par leur propriétaire et par les coachs, donc tout passait au vert.
--
-- LA BRANCHE LARGE EST DONC RELEVÉE DANS LE CATALOGUE, TABLE PAR TABLE, au même
-- moment que la surface, et réécrite telle quelle. ⛔ Et si une expression ne
-- correspond à aucune des deux formes connues, le bloc ÉCHOUE au lieu de
-- deviner : refuser l'inconnu vaut mieux que le généraliser.

do $$
declare
  cible      text;
  commande   "char";
  nom        text;
  -- ⚠️ `"char"` ENTRE GUILLEMETS, ET PAS `char`. `pg_policy.polcmd` est du type
  -- interne `"char"`, un seul octet, distinct de `character`. Une premiere version
  -- declarait `char[]` : la requete echouait avec
  -- « CASE/WHEN could not convert type character[] to "char"[] ».
  -- ⛔ Elle aurait fait exploser la migration a l application. Trouvee en eprouvant
  -- la partie risquee EN LECTURE SEULE avant d ecrire quoi que ce soit.
  surface    "char"[];
  large      text;
  lecture    text;
  inconnues  int;
  supprimees int := 0;
  creees     int := 0;
  -- ⚠️ `user_preferences` N'EST PAS DANS CETTE LISTE, ET CE N'EST PAS UN OUBLI.
  -- Elle porte `theme` et `accent_color`. L'y inclure ferait perdre son mode clair
  -- ou sombre a un eleve qui n'a que la formation, et ⛔ RIEN NE LE SIGNALERAIT :
  -- la page s'afficherait simplement dans l'autre theme. C'est la SEULE table hors
  -- liste portant une colonne `user_id`, verifie sur le schema entier le 10/10/2026.
  -- ⛔ NE L'AJOUTE PAS POUR « HARMONISER ».
  --
  -- `nutrition_logs` n'y est pas non plus : pas de colonne `user_id`, une seule
  -- politique `is_coach()`. Ce n'est pas une table d'eleve.
  CIBLES constant text[] := array[
    'trades', 'journal_entries', 'accounts', 'account_costs', 'daily_fees',
    'payouts', 'checklist_validations', 'gamification_state', 'user_motivation',
    'replay_views', 'tradovate_credentials', 'tradovate_sync_state'
  ];
begin
  foreach cible in array CIBLES loop
    -- ⛔ GARDE-FOU D'ABORD. Toute expression dont la forme n'est pas reconnue fait
    -- echouer la migration entiere. On ne devine pas une autorisation.
    select count(*) into inconnues
      from pg_policy p
      join pg_class c on c.oid = p.polrelid
      join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relname = cible
       and coalesce(pg_get_expr(p.polqual, p.polrelid), '') <> 'is_coach()'
       and (
         (p.polcmd in ('r','*')
          and pg_get_expr(p.polqual, p.polrelid) !~ '^\(auth\.uid\(\) = user_id\)$'
          and pg_get_expr(p.polqual, p.polrelid) !~ '^\(\(auth\.uid\(\) = user_id\) OR (.+)\)$')
         or (p.polcmd in ('a','w','d')
             and coalesce(pg_get_expr(p.polqual, p.polrelid), '(auth.uid() = user_id)')
                 !~ '^\(auth\.uid\(\) = user_id\)$')
         or (p.polcmd in ('a','w','d','*')
             and coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '(auth.uid() = user_id)')
                 !~ '^\(auth\.uid\(\) = user_id\)$')
       );
    if inconnues > 0 then
      raise exception '⛔ % : % politique(s) de forme inconnue. Relis-les avant d appliquer.',
        cible, inconnues;
    end if;

    -- La surface des commandes autorisees aux eleves. `ALL` compte pour quatre.
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
           and coalesce(pg_get_expr(p.polqual, p.polrelid), '') <> 'is_coach()'
      ) s;

    -- La branche large PROPRE A LA TABLE, telle qu'elle existe aujourd'hui.
    select string_agg(distinct b, ' or ')
      into large
      from (
        select substring(pg_get_expr(p.polqual, p.polrelid)
                         from '^\(\(auth\.uid\(\) = user_id\) OR (.+)\)$') as b
          from pg_policy p
          join pg_class c on c.oid = p.polrelid
          join pg_namespace n on n.oid = c.relnamespace
         where n.nspname = 'public' and c.relname = cible
           and p.polcmd in ('r','*')
           and coalesce(pg_get_expr(p.polqual, p.polrelid), '') <> 'is_coach()'
           and substring(pg_get_expr(p.polqual, p.polrelid)
                         from '^\(\(auth\.uid\(\) = user_id\) OR (.+)\)$') is not null
      ) s;

    -- ── ⛔ E. UNE EXCEPTION, ET UNE SEULE : `replay_views` ──────────────────
    --
    -- ⚠️ PRÉSERVER UNE EXPRESSION N'EST PAS PLUS NEUTRE QUE LA GÉNÉRALISER.
    -- C'est une décision, et elle se prend expression par expression. Sur les
    -- douze tables, « préserver » est juste onze fois. Ici, cela ouvrirait la
    -- porte que toute cette migration pose.
    --
    -- La branche d'origine est `can_view_replays()`, et les deux branches sont
    -- reliées par OU : il suffirait qu'elle rende vrai pour que la ligne soit
    -- lisible, QUEL QUE SOIT le droit journal. Or elle rend vrai pour tout compte
    -- `active` ou `approved`, élèves compris. ⛔ Le droit journal n'aurait eu
    -- AUCUN effet sur cette table, la migration se serait exécutée, les 46
    -- politiques posées et le contrôle de couverture au vert.
    --
    -- ⚠️ CE REMPLACEMENT EST UNE CORRECTION ASSUMÉE, PAS UN EFFET DE BORD.
    -- `can_view_replays()` est une politique de CATALOGUE appliquée par erreur à
    -- une table de VUES INDIVIDUELLES. Mesuré le 10/10/2026, et c'est le seul
    -- autre usage de la fonction sur TOUT le schéma :
    --
    --     replays        catalogue, vu par tous   replays_select        correct
    --     replay_views   vues de chacun           replay_views_select   copie fautive
    --
    -- Aujourd'hui, n'importe quel élève actif lit la progression de visionnage de
    -- tous les autres : 121 lignes, 20 élèves. Tâche #47.
    --
    -- ⛔ NE TOUCHE PAS À `replays`, le catalogue : sa politique est correcte, tous
    -- les élèves doivent voir la liste des replays. Elle n'est pas dans CIBLES.
    if cible = 'replay_views' then
      raise notice '⚠️  replay_views : branche large REMPLACEE, % -> is_coach()', coalesce(large, '(aucune)');
      large := 'is_coach()';
    end if;

    if surface is null then
      raise notice '⚠️  % : aucune politique eleve, rien a faire', cible;
      continue;
    end if;

    -- ⚠️ L'ECRITURE N'A DE BRANCHE LARGE SUR AUCUNE TABLE, verifie : les 61
    -- politiques d'ecriture portent toutes `(auth.uid() = user_id)` seul. Le
    -- garde-fou plus haut echouerait si ce n'etait plus vrai.
    lecture := format('((auth.uid() = user_id) and a_acces_journal())%s',
                      case when large is null then '' else ' or ' || large end);

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

    foreach commande in array surface loop
      if commande = 'r' then
        execute format('create policy %I on public.%I for select to authenticated using (%s)',
                       cible || '_droit_journal_select', cible, lecture);
      elsif commande = 'a' then
        execute format('create policy %I on public.%I for insert to authenticated '
                       'with check ((auth.uid() = user_id) and a_acces_journal())',
                       cible || '_droit_journal_insert', cible);
      elsif commande = 'w' then
        -- ⚠️ `using` ET `with check` : le premier controle la ligne AVANT, le
        -- second la ligne APRES. Sans le second, on reattribuerait sa ligne.
        execute format('create policy %I on public.%I for update to authenticated '
                       'using ((auth.uid() = user_id) and a_acces_journal()) '
                       'with check ((auth.uid() = user_id) and a_acces_journal())',
                       cible || '_droit_journal_update', cible);
      elsif commande = 'd' then
        execute format('create policy %I on public.%I for delete to authenticated '
                       'using ((auth.uid() = user_id) and a_acces_journal())',
                       cible || '_droit_journal_delete', cible);
      end if;
      creees := creees + 1;
    end loop;

    raise notice '%  surface %  branche large %  ->  posee',
      cible, surface, coalesce(large, '(aucune)');
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

-- ============================================================================
-- ⚠️ FIN DE LA TRANSACTION
-- ============================================================================
-- ⛔ Avant de valider, LIS LES `notice` du bloc : 61 supprimées, 46 créées, et la
-- branche large attendue table par table. Si un nombre diffère, `rollback;` au
-- lieu de `commit;` et la base reste intacte.

commit;
