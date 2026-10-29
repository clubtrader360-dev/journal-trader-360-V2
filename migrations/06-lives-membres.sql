-- ============================================================================
-- 06 · LES LIVES MEMBRES (Nadir, 29/10/2026)
-- ============================================================================
-- « La même chose que le webinaire, mais pour nos lives membres, dans l'espace
-- membre. » Arbitrages de Nadir : vidéo YouTube non répertoriée, bloquée comme
-- pour le webinaire (lecteur intégré, aucun lien vers YouTube), ouverte à tous les
-- membres dont le droit formation est actif.
--
-- ── ⛔ AUCUNE POLITIQUE RLS SUR CES TABLES, ET C'EST VOULU ──────────────────
-- RLS activée, zéro politique : personne ne lit ni n'écrit ces tables en direct,
-- ni un membre, ni un coach. Tout passe par les fonctions ci-dessous (security
-- definer), qui portent chacune leur barrière :
--   · membre : a_acces_formation()   (la même que les leçons, les notes, les quiz)
--   · coach  : is_coach()
--   · OBS    : la clé des sources OBS (live_reglages), pour les deux pages sans
--              session que lit OBS (colonne des caméras, chat du replay).
-- Raison : un message de chat ne doit jamais exposer l'identifiant ni l'e-mail de
-- son auteur, seulement son prénom. Une politique de lecture sur live_messages
-- exposerait user_id à tout membre. La fonction choisit les colonnes.
--
-- ── ⛔ AUCUNE HEURE DE FIN ───────────────────────────────────────────────────
-- Comme le webinaire : le live est terminé quand la régie clique « Terminer le
-- live » (fin_le). La durée ne sert à rien côté salle.
-- ============================================================================

create table if not exists public.lives (
  id          bigserial primary key,
  titre       text        not null check (char_length(titre) between 1 and 160),
  debut       timestamptz not null,
  -- L'identifiant de la vidéo YouTube (11 caractères), jamais le lien complet.
  youtube_id  text        check (youtube_id ~ '^[A-Za-z0-9_-]{11}$'),
  publie      boolean     not null default false,
  fin_le      timestamptz,
  parole_on   boolean     not null default false,
  question_id bigint,
  coanim_le   timestamptz,
  -- Le secret d'où se déduisent la salle VDO.Ninja et son mot de passe.
  cle_scene   uuid        not null default gen_random_uuid(),
  created_at  timestamptz not null default now(),
  maj         timestamptz not null default now()
);
create index if not exists lives_debut on public.lives (debut);

create table if not exists public.live_messages (
  id          bigserial primary key,
  live_id     bigint      not null references public.lives (id) on delete cascade,
  user_id     uuid        references auth.users (id) on delete set null,
  auteur      text        not null check (char_length(auteur) between 1 and 60),
  coach       boolean     not null default false,
  texte       text        not null check (char_length(texte) between 1 and 400),
  created_at  timestamptz not null default now(),
  masque_le   timestamptz,
  epingle_le  timestamptz
);
create index if not exists live_messages_live on public.live_messages (live_id, id desc);
create index if not exists live_messages_user on public.live_messages (user_id, created_at desc);

create table if not exists public.live_parole (
  id          bigserial primary key,
  live_id     bigint      not null references public.lives (id) on delete cascade,
  user_id     uuid        not null references auth.users (id) on delete cascade,
  auteur      text        not null check (char_length(auteur) between 1 and 60),
  statut      text        not null default 'attente' check (statut in ('attente', 'invite', 'termine', 'refuse', 'annule')),
  place       smallint    check (place in (1, 2)),
  demande_le  timestamptz not null default now(),
  invite_le   timestamptz,
  rejoint_le  timestamptz,
  fini_le     timestamptz,
  constraint live_parole_place_statut check ((statut = 'invite') = (place is not null))
);
create unique index if not exists live_parole_ouverte on public.live_parole (live_id, user_id) where statut in ('attente', 'invite');
create unique index if not exists live_parole_place on public.live_parole (live_id, place) where statut = 'invite';

create table if not exists public.live_sondages (
  id        bigserial primary key,
  live_id   bigint      not null references public.lives (id) on delete cascade,
  question  text        not null check (char_length(question) between 1 and 200),
  choix     jsonb       not null check (jsonb_typeof(choix) = 'array' and jsonb_array_length(choix) between 2 and 4),
  ouvert_le timestamptz not null default now(),
  clos_le   timestamptz
);

create table if not exists public.live_votes (
  sondage_id bigint      not null references public.live_sondages (id) on delete cascade,
  user_id    uuid        not null references auth.users (id) on delete cascade,
  choix      smallint    not null check (choix between 0 and 3),
  created_at timestamptz not null default now(),
  primary key (sondage_id, user_id)
);

create table if not exists public.live_presences (
  live_id   bigint      not null references public.lives (id) on delete cascade,
  user_id   uuid        not null references auth.users (id) on delete cascade,
  premier_le timestamptz not null default now(),
  vu_le     timestamptz not null default now(),
  secondes  integer     not null default 0,
  primary key (live_id, user_id)
);

-- La clé des deux sources OBS. Une seule ligne, tirée au hasard une fois.
create table if not exists public.live_reglages (
  id      smallint primary key default 1 check (id = 1),
  cle_obs text     not null default encode(extensions.gen_random_bytes(12), 'hex')
);
insert into public.live_reglages (id) values (1) on conflict do nothing;

alter table public.lives          enable row level security;
alter table public.live_messages  enable row level security;
alter table public.live_parole    enable row level security;
alter table public.live_sondages  enable row level security;
alter table public.live_votes     enable row level security;
alter table public.live_presences enable row level security;
alter table public.live_reglages  enable row level security;

-- ============================================================================
-- LES OUTILS INTERNES
-- ============================================================================

/**
 * Le prénom affiché dans le chat, jamais l'e-mail. Certains noms sont saisis
 * « NOM Prénom » (15 sur 106 le 29/10) : un premier mot tout en capitales suivi
 * d'un second qui ne l'est pas est le nom de famille, on prend le second.
 */
create or replace function public.live_prenom(p_uid uuid) returns text
language sql stable security definer set search_path = public as $$
  select coalesce(nullif(left(initcap(lower(
    case when w1 ~ '^[[:upper:]-]{2,}$' and w2 <> '' and w2 !~ '^[[:upper:]-]{2,}$' then w2 else w1 end)), 60), ''), 'Membre')
  from (select split_part(regexp_replace(btrim(coalesce(u.name, '')), '\s+', ' ', 'g'), ' ', 1) w1,
               split_part(regexp_replace(btrim(coalesce(u.name, '')), '\s+', ' ', 'g'), ' ', 2) w2
        from (select 1) x left join public.users u on u.uuid = p_uid limit 1) n;
$$;

/** La salle VDO.Ninja d'un live : déduite de son secret, rien à stocker. */
create or replace function public.live_vdo(p_live bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('room', 'm360' || left(h, 12), 'password', substr(h, 13, 16))
  from (select encode(extensions.digest('t360-live:' || l.cle_scene::text, 'sha256'), 'hex') h
        from public.lives l where l.id = p_live) s;
$$;

/** Le chat est ouvert 30 min avant le début, jusqu'à « Terminer le live ». */
create or replace function public.live_chat_ouvert(l public.lives) returns boolean
language sql stable set search_path = public as $$
  select l.publie and l.fin_le is null and now() >= l.debut - interval '30 minutes';
$$;

/** Ma prise de parole sur un live : statut, rang dans la file, place et flux. */
create or replace function public.live_ma_parole(p_live bigint, p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.live_parole; d public.live_parole; rang int;
begin
  select * into p from public.live_parole where live_id = p_live and user_id = p_uid and statut in ('attente', 'invite') limit 1;
  if p.id is null then
    select * into d from public.live_parole where live_id = p_live and user_id = p_uid order by id desc limit 1;
    return jsonb_build_object('statut', coalesce(d.statut, 'aucune'), 'id', d.id);
  end if;
  if p.statut = 'invite' then
    return jsonb_build_object('statut', 'invite', 'id', p.id, 'place', p.place, 'auteur', p.auteur,
      'vdo', public.live_vdo(p_live) || jsonb_build_object('flux', (public.live_vdo(p_live)->>'room') || 'p' || p.place || 'd' || p.id));
  end if;
  select count(*) into rang from public.live_parole where live_id = p_live and statut = 'attente' and demande_le <= p.demande_le;
  return jsonb_build_object('statut', 'attente', 'id', p.id, 'rang', rang);
end $$;

/** L'état public d'un live : ce que voit chaque membre. Ni user_id ni e-mail. */
create or replace function public.live_etat_public(p_live bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l public.lives; s public.live_sondages; q record; res jsonb;
begin
  select * into l from public.lives where id = p_live;
  if l.id is null then return null; end if;
  select * into s from public.live_sondages where live_id = p_live and (clos_le is null or clos_le > now() - interval '10 minutes') order by id desc limit 1;
  select id, auteur, texte into q from public.live_messages where id = l.question_id and live_id = p_live and masque_le is null;
  res := jsonb_build_object(
    'id', l.id, 'titre', l.titre, 'debut', l.debut, 'fin', l.fin_le,
    'ouvert', public.live_chat_ouvert(l),
    'parole', l.parole_on and l.fin_le is null,
    'messages', coalesce((select jsonb_agg(m order by m.id) from (
        select id, auteur, coach, texte, created_at as at, epingle_le is not null as epingle
        from public.live_messages where live_id = p_live and masque_le is null order by id desc limit 120) m), '[]'::jsonb),
    'epingle', (select jsonb_build_object('id', id, 'auteur', auteur, 'coach', coach, 'texte', texte)
        from public.live_messages where live_id = p_live and masque_le is null and epingle_le is not null order by epingle_le desc limit 1),
    'question', case when q.id is null then null else jsonb_build_object('id', q.id, 'auteur', q.auteur, 'texte', q.texte) end,
    'sondage', case when s.id is null then null else jsonb_build_object(
        'id', s.id, 'question', s.question, 'choix', s.choix, 'clos', s.clos_le is not null,
        'total', (select count(*) from public.live_votes v where v.sondage_id = s.id),
        'resultats', (select jsonb_agg((select count(*) from public.live_votes v where v.sondage_id = s.id and v.choix = k) order by k)
                      from generate_series(0, jsonb_array_length(s.choix) - 1) k)) end
  );
  return res;
end $$;

-- ============================================================================
-- CÔTÉ MEMBRE
-- ============================================================================

/**
 * Le live à afficher dans l'espace membre, et les prochains.
 * Le « live courant » : publié, pas terminé et commencé il y a moins de 12 h, ou
 * terminé il y a moins de 2 h (l'écran de fin reste visible). Les non terminés
 * d'abord, le plus tôt en premier.
 * ⛔ L'identifiant YouTube n'est rendu qu'à partir de 30 min avant le début.
 */
create or replace function public.live_courant() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l public.lives;
begin
  if not (public.a_acces_formation() or public.is_coach()) then
    raise exception 'acces refuse' using errcode = '42501';
  end if;
  select * into l from public.lives
   where publie and ((fin_le is null and debut > now() - interval '12 hours') or fin_le > now() - interval '2 hours')
   order by (fin_le is not null), debut limit 1;
  return jsonb_build_object(
    'live', case when l.id is null then null else jsonb_build_object(
      'id', l.id, 'titre', l.titre, 'debut', l.debut, 'fin', l.fin_le,
      'etat', case when l.fin_le is not null then 'termine' when now() >= l.debut - interval '30 minutes' then 'direct' else 'bientot' end,
      'youtube', case when l.fin_le is null and now() >= l.debut - interval '30 minutes' then l.youtube_id end) end,
    'prochains', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'titre', titre, 'debut', debut) order by debut)
      from (select id, titre, debut from public.lives where publie and fin_le is null and debut > now() and id is distinct from l.id order by debut limit 4) p), '[]'::jsonb)
  );
end $$;

/** L'état de la salle pour un membre, avec sa prise de parole. */
create or replace function public.live_salle(p_live bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l public.lives;
begin
  if not (public.a_acces_formation() or public.is_coach()) then raise exception 'acces refuse' using errcode = '42501'; end if;
  select * into l from public.lives where id = p_live and (publie or public.is_coach());
  if l.id is null then raise exception 'live introuvable' using errcode = 'P0002'; end if;
  return public.live_etat_public(p_live) || jsonb_build_object('ma_parole', public.live_ma_parole(p_live, auth.uid()));
end $$;

/** Écrire dans le chat. Un coach écrit au nom de Trader 360, à tout moment. */
create or replace function public.live_ecrire(p_live bigint, p_texte text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l public.lives; t text; coach boolean := public.is_coach(); dernier timestamptz; m public.live_messages;
begin
  if not (coach or public.a_acces_formation()) then raise exception 'acces refuse' using errcode = '42501'; end if;
  select * into l from public.lives where id = p_live and (publie or coach);
  if l.id is null then raise exception 'live introuvable' using errcode = 'P0002'; end if;
  t := btrim(regexp_replace(coalesce(p_texte, ''), '\s+', ' ', 'g'));
  if t = '' then raise exception 'message vide' using errcode = '22023'; end if;
  if char_length(t) > 400 then raise exception '400 caractères au plus' using errcode = '22023'; end if;
  if not coach then
    if l.fin_le is not null then raise exception 'le live est terminé, le chat est fermé' using errcode = 'P0001'; end if;
    if not public.live_chat_ouvert(l) then raise exception 'le chat ouvre 30 minutes avant le début' using errcode = 'P0001'; end if;
    select max(created_at) into dernier from public.live_messages where user_id = auth.uid();
    if dernier is not null and now() - dernier < interval '3 seconds' then raise exception 'doucement : un message toutes les trois secondes' using errcode = 'P0001'; end if;
  end if;
  insert into public.live_messages (live_id, user_id, auteur, coach, texte)
  values (p_live, auth.uid(), case when coach then 'Trader 360' else public.live_prenom(auth.uid()) end, coach, t)
  returning * into m;
  return jsonb_build_object('id', m.id, 'auteur', m.auteur, 'coach', m.coach, 'texte', m.texte, 'at', m.created_at, 'epingle', false);
end $$;

/** Demander la parole, annuler, signaler qu'on a rejoint, ou relire sa demande. */
create or replace function public.live_parole_membre(p_live bigint, p_quoi text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare l public.lives; uid uuid := auth.uid();
begin
  if not public.a_acces_formation() then raise exception 'acces refuse' using errcode = '42501'; end if;
  select * into l from public.lives where id = p_live and publie;
  if l.id is null then raise exception 'live introuvable' using errcode = 'P0002'; end if;
  if p_quoi = 'rejoindre' then
    update public.live_parole set rejoint_le = now() where live_id = p_live and user_id = uid and statut = 'invite' and rejoint_le is null;
  elsif p_quoi = 'annuler' then
    update public.live_parole set statut = 'annule', place = null, fini_le = now() where live_id = p_live and user_id = uid and statut in ('attente', 'invite');
  elsif p_quoi = 'demander' then
    -- ⛔ C'est la régie qui ouvre la parole, pas l'horloge.
    if not l.parole_on or l.fin_le is not null then raise exception 'la prise de parole est fermée pour le moment' using errcode = 'P0001'; end if;
    insert into public.live_parole (live_id, user_id, auteur) values (p_live, uid, public.live_prenom(uid))
    on conflict (live_id, user_id) where statut in ('attente', 'invite') do nothing;
  elsif p_quoi <> 'etat' then
    raise exception 'action inconnue' using errcode = '22023';
  end if;
  return public.live_ma_parole(p_live, uid);
end $$;

/** Voter au sondage ouvert. Un vote par personne : le second est ignoré. */
create or replace function public.live_voter(p_sondage bigint, p_choix int) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.live_sondages;
begin
  if not public.a_acces_formation() then raise exception 'acces refuse' using errcode = '42501'; end if;
  select so.* into s from public.live_sondages so join public.lives l on l.id = so.live_id and l.publie where so.id = p_sondage;
  if s.id is null then raise exception 'sondage introuvable' using errcode = 'P0002'; end if;
  if s.clos_le is not null then raise exception 'le sondage est clos' using errcode = 'P0001'; end if;
  if p_choix is null or p_choix < 0 or p_choix >= jsonb_array_length(s.choix) then raise exception 'réponse inconnue' using errcode = '22023'; end if;
  insert into public.live_votes (sondage_id, user_id, choix) values (s.id, auth.uid(), p_choix) on conflict do nothing;
  return jsonb_build_object('ok', true);
end $$;

/** Le pouls : présent et durée de visionnage. Une absence ne compte pas. */
create or replace function public.live_pouls(p_live bigint) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.a_acces_formation() or public.is_coach() then return; end if;
  if not exists (select 1 from public.lives where id = p_live and publie and fin_le is null) then return; end if;
  insert into public.live_presences (live_id, user_id) values (p_live, auth.uid())
  on conflict (live_id, user_id) do update set
    secondes = live_presences.secondes + case when now() - live_presences.vu_le < interval '90 seconds'
      then least(60, greatest(0, extract(epoch from now() - live_presences.vu_le)::int)) else 0 end,
    vu_le = now();
end $$;

-- ============================================================================
-- CÔTÉ COACH (back-office)
-- ============================================================================

create or replace function public.live_exiger_coach() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_coach() then raise exception 'réservé aux coachs' using errcode = '42501'; end if;
end $$;

/** La liste des lives, du plus récent au plus ancien, avec leurs chiffres. */
create or replace function public.live_lister() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  perform public.live_exiger_coach();
  return coalesce((select jsonb_agg(jsonb_build_object(
      'id', l.id, 'titre', l.titre, 'debut', l.debut, 'youtube_id', l.youtube_id, 'publie', l.publie, 'fin', l.fin_le,
      'presents', (select count(*) from public.live_presences p where p.live_id = l.id),
      'messages', (select count(*) from public.live_messages m where m.live_id = l.id and not m.coach)) order by l.debut desc)
    from public.lives l), '[]'::jsonb);
end $$;

/** Créer ou modifier un live. p : { id?, titre, debut, youtube_id, publie }. */
create or replace function public.live_enregistrer(p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id bigint;
begin
  perform public.live_exiger_coach();
  if coalesce(btrim(p->>'titre'), '') = '' then raise exception 'titre manquant' using errcode = '22023'; end if;
  if p->>'debut' is null then raise exception 'date de début manquante' using errcode = '22023'; end if;
  if nullif(p->>'youtube_id', '') is not null and (p->>'youtube_id') !~ '^[A-Za-z0-9_-]{11}$' then
    raise exception 'lien YouTube non reconnu' using errcode = '22023';
  end if;
  if (p->>'id') is null then
    insert into public.lives (titre, debut, youtube_id, publie)
    values (btrim(p->>'titre'), (p->>'debut')::timestamptz, nullif(p->>'youtube_id', ''), coalesce((p->>'publie')::boolean, false))
    returning id into v_id;
  else
    update public.lives set titre = btrim(p->>'titre'), debut = (p->>'debut')::timestamptz,
      youtube_id = nullif(p->>'youtube_id', ''), publie = coalesce((p->>'publie')::boolean, publie), maj = now()
    where id = (p->>'id')::bigint returning id into v_id;
    if v_id is null then raise exception 'live introuvable' using errcode = 'P0002'; end if;
  end if;
  return jsonb_build_object('id', v_id);
end $$;

/** La régie : l'état public, la scène, les chiffres et les liens. */
create or replace function public.live_regie(p_live bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l public.lives;
begin
  perform public.live_exiger_coach();
  select * into l from public.lives where id = p_live;
  if l.id is null then raise exception 'live introuvable' using errcode = 'P0002'; end if;
  return public.live_etat_public(p_live) || jsonb_build_object(
    'publie', l.publie, 'youtube', l.youtube_id, 'parole_on', l.parole_on,
    'attente', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'auteur', auteur, 'demande_le', demande_le) order by demande_le)
        from public.live_parole where live_id = p_live and statut = 'attente'), '[]'::jsonb),
    'scene', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'auteur', auteur, 'place', place, 'invite_le', invite_le, 'rejoint', rejoint_le is not null) order by place)
        from public.live_parole where live_id = p_live and statut = 'invite'), '[]'::jsonb),
    'vdo', public.live_vdo(p_live),
    'cle_obs', (select cle_obs from public.live_reglages where id = 1),
    'stats', jsonb_build_object(
        'connectes', (select count(*) from public.live_presences where live_id = p_live and vu_le > now() - interval '75 seconds'),
        'presents', (select count(*) from public.live_presences where live_id = p_live),
        'minutes', coalesce((select round(avg(secondes) / 60.0) from public.live_presences where live_id = p_live), 0),
        'messages', (select count(*) from public.live_messages where live_id = p_live and not coach))
  );
end $$;

/**
 * Les commandes de la régie. p : un seul des champs suivants.
 *   masquer, epingler (id) · desepingler · ecran (id ou null) · sondage {question, choix} · clore
 *   parole_on (bool) · inviter, refuser, terminer (id de demande) · fin (bool) · coanim (battement)
 * ⛔ live_id dans chaque filtre : une commande d'un live ne touche jamais un autre.
 */
create or replace function public.live_commande(p_live bigint, p jsonb) returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_id bigint; libre smallint; n int; q text; ch jsonb;
begin
  perform public.live_exiger_coach();
  if not exists (select 1 from public.lives where id = p_live) then raise exception 'live introuvable' using errcode = 'P0002'; end if;

  if p ? 'coanim' then
    update public.lives set coanim_le = now() where id = p_live; return jsonb_build_object('ok', true);
  elsif p ? 'parole_on' then
    update public.lives set parole_on = (p->>'parole_on')::boolean, maj = now() where id = p_live;
  elsif p ? 'fin' then
    if (p->>'fin')::boolean then
      update public.lives set fin_le = now(), parole_on = false, question_id = null, maj = now() where id = p_live;
      update public.live_parole set statut = 'termine', place = null, fini_le = now() where live_id = p_live and statut = 'invite';
      update public.live_parole set statut = 'annule', fini_le = now() where live_id = p_live and statut = 'attente';
    else
      update public.lives set fin_le = null, maj = now() where id = p_live;
    end if;
  elsif p ? 'masquer' or p ? 'epingler' then
    v_id := coalesce(p->>'masquer', p->>'epingler')::bigint;
    if p ? 'masquer' then update public.live_messages set masque_le = now() where id = v_id and live_id = p_live;
    else update public.live_messages set epingle_le = now() where id = v_id and live_id = p_live; end if;
    get diagnostics n = row_count;
    if n = 0 then raise exception 'message introuvable' using errcode = 'P0002'; end if;
  elsif p ? 'desepingler' then
    update public.live_messages set epingle_le = null where live_id = p_live and epingle_le is not null;
  elsif p ? 'ecran' then
    v_id := nullif(p->>'ecran', '')::bigint;
    if v_id is not null and not exists (select 1 from public.live_messages where id = v_id and live_id = p_live) then
      raise exception 'message introuvable' using errcode = 'P0002';
    end if;
    update public.lives set question_id = v_id, maj = now() where id = p_live;
  elsif p ? 'sondage' then
    q := left(btrim(coalesce(p->'sondage'->>'question', '')), 200);
    select coalesce(jsonb_agg(to_jsonb(left(btrim(x), 80))), '[]'::jsonb) into ch
      from jsonb_array_elements_text(coalesce(p->'sondage'->'choix', '[]'::jsonb)) x where btrim(x) <> '';
    if q = '' then raise exception 'question du sondage vide' using errcode = '22023'; end if;
    if jsonb_array_length(ch) not between 2 and 4 then raise exception 'de 2 à 4 réponses' using errcode = '22023'; end if;
    update public.live_sondages set clos_le = now() where live_id = p_live and clos_le is null;
    insert into public.live_sondages (live_id, question, choix) values (p_live, q, ch);
  elsif p ? 'clore' then
    update public.live_sondages set clos_le = now() where live_id = p_live and clos_le is null;
  elsif p ? 'refuser' then
    update public.live_parole set statut = 'refuse', fini_le = now() where id = (p->>'refuser')::bigint and live_id = p_live and statut = 'attente';
    get diagnostics n = row_count; if n = 0 then raise exception 'demande introuvable ou déjà traitée' using errcode = 'P0002'; end if;
  elsif p ? 'terminer' then
    update public.live_parole set statut = 'termine', place = null, fini_le = now() where id = (p->>'terminer')::bigint and live_id = p_live and statut = 'invite';
    get diagnostics n = row_count; if n = 0 then raise exception 'personne sur scène avec ce numéro' using errcode = 'P0002'; end if;
  elsif p ? 'inviter' then
    v_id := (p->>'inviter')::bigint;
    -- Deux invitations au même instant : la ligne du live est verrouillée le temps de choisir la place.
    perform 1 from public.lives where id = p_live for update;
    if not exists (select 1 from public.live_parole where id = v_id and live_id = p_live and statut = 'attente') then
      raise exception 'demande introuvable ou déjà traitée' using errcode = 'P0002';
    end if;
    select k into libre from unnest(array[1, 2]::smallint[]) k
     where not exists (select 1 from public.live_parole where live_id = p_live and statut = 'invite' and place = k) order by k limit 1;
    if libre is null then raise exception 'les deux places sont occupées : termine une prise de parole d''abord' using errcode = 'P0001'; end if;
    update public.live_parole set statut = 'invite', place = libre, invite_le = now() where id = v_id and live_id = p_live and statut = 'attente';
  else
    raise exception 'commande inconnue' using errcode = '22023';
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- ============================================================================
-- LES DEUX SOURCES OBS (sans session : la clé seule)
-- ============================================================================
/**
 * p_quoi = 'colonne' : les caméras à empiler (co-animateur si sa page bat depuis
 * moins de 45 s, puis chaque invité qui a cliqué « Rejoindre »).
 * p_quoi = 'chat' : les 8 derniers messages visibles.
 * Le live suivi : publié, non terminé, commencé ou à moins de 3 h de commencer ;
 * le plus proche de maintenant. Mauvaise clé : rien, sans erreur parlante.
 */
create or replace function public.live_obs(p_cle text, p_quoi text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l public.lives; v jsonb;
begin
  if p_cle is null or p_cle <> (select cle_obs from public.live_reglages where id = 1) then return jsonb_build_object('live', null); end if;
  select * into l from public.lives where publie and fin_le is null and now() >= debut - interval '3 hours'
   order by abs(extract(epoch from now() - debut)) limit 1;
  if l.id is null then return jsonb_build_object('live', null); end if;
  if p_quoi = 'chat' then
    return jsonb_build_object('live', l.id, 'messages', coalesce((select jsonb_agg(m order by m.id) from (
      select id, auteur, coach, texte from public.live_messages where live_id = l.id and masque_le is null order by id desc limit 8) m), '[]'::jsonb));
  end if;
  v := public.live_vdo(l.id);
  return jsonb_build_object('live', l.id, 'room', v->>'room', 'password', v->>'password', 'tuiles',
    (case when l.coanim_le > now() - interval '45 seconds' then jsonb_build_array(jsonb_build_object('id', 'c1', 'flux', (v->>'room') || 'c1')) else '[]'::jsonb end)
    || coalesce((select jsonb_agg(jsonb_build_object('id', 'p' || place, 'flux', (v->>'room') || 'p' || place || 'd' || id) order by place)
        from public.live_parole where live_id = l.id and statut = 'invite' and rejoint_le is not null), '[]'::jsonb));
end $$;

-- ── Les droits d'exécution ──────────────────────────────────────────────────
-- ⛔ Les outils internes ne sont appelables par personne de l'extérieur.
revoke all on function public.live_prenom(uuid), public.live_vdo(bigint), public.live_chat_ouvert(public.lives),
  public.live_ma_parole(bigint, uuid), public.live_etat_public(bigint), public.live_exiger_coach() from public, anon, authenticated;
revoke all on function public.live_courant(), public.live_salle(bigint), public.live_ecrire(bigint, text),
  public.live_parole_membre(bigint, text), public.live_voter(bigint, int), public.live_pouls(bigint),
  public.live_lister(), public.live_enregistrer(jsonb), public.live_regie(bigint), public.live_commande(bigint, jsonb),
  public.live_obs(text, text) from public, anon;
grant execute on function public.live_courant(), public.live_salle(bigint), public.live_ecrire(bigint, text),
  public.live_parole_membre(bigint, text), public.live_voter(bigint, int), public.live_pouls(bigint),
  public.live_lister(), public.live_enregistrer(jsonb), public.live_regie(bigint), public.live_commande(bigint, jsonb) to authenticated;
-- La seule fonction ouverte sans session : OBS n'a pas de compte. Elle exige la clé.
grant execute on function public.live_obs(text, text) to anon, authenticated;

-- ============================================================================
-- RÉVISION DU 29/10 (revue indépendante avant livraison), appliquée en base
-- ============================================================================
-- Les définitions ci-dessous REMPLACENT celles du même nom plus haut.
--  · Flux imprévisibles : un ancien invité connaît la salle et son mot de passe ;
--    s'il connaissait aussi les noms de flux, il pourrait prendre la place du
--    co-animateur ou du prochain invité (VDO.Ninja refuse un second envoi sous le
--    même nom). Le co-animateur et l'animateur ont désormais un nom tiré d'une autre
--    partie de l'empreinte (jamais rendue à un membre), et chaque invitation un jeton
--    aléatoire.
--  · OBS suit le live le plus récemment COMMENCÉ, pas le plus proche dans le temps :
--    sinon, un live à 14 h et un à 17 h, OBS basculait sur le second à 15 h 31.
--  · Le membre voit dans l'ordre : le live en cours, puis l'écran de fin récent, puis
--    le prochain. Avant, un live publié pour demain masquait l'écran de fin.
--  · Deux invitations au même instant : la ligne du live est verrouillée.

alter table public.live_parole add column if not exists jeton uuid not null default gen_random_uuid();

create or replace function public.live_vdo_coach(p_live bigint) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('room', 'm360' || left(h, 12), 'password', substr(h, 13, 16),
                            'animateur', 'm360' || left(h, 12) || 'a' || substr(h, 29, 10),
                            'coanimateur', 'm360' || left(h, 12) || 'c' || substr(h, 39, 10))
  from (select encode(extensions.digest('t360-live:' || l.cle_scene::text, 'sha256'), 'hex') h
        from public.lives l where l.id = p_live) s;
$$;
create or replace function public.live_flux_invite(p_live bigint, p_place smallint, p_jeton uuid) returns text
language sql stable security definer set search_path = public as $$
  select (public.live_vdo(p_live)->>'room') || 'p' || p_place || 'x' || left(replace(p_jeton::text, '-', ''), 12);
$$;
revoke all on function public.live_vdo_coach(bigint), public.live_flux_invite(bigint, smallint, uuid) from public, anon, authenticated;

create or replace function public.live_ma_parole(p_live bigint, p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare p public.live_parole; d public.live_parole; rang int;
begin
  select * into p from public.live_parole where live_id = p_live and user_id = p_uid and statut in ('attente', 'invite') limit 1;
  if p.id is null then
    select * into d from public.live_parole where live_id = p_live and user_id = p_uid order by id desc limit 1;
    return jsonb_build_object('statut', coalesce(d.statut, 'aucune'), 'id', d.id);
  end if;
  if p.statut = 'invite' then
    return jsonb_build_object('statut', 'invite', 'id', p.id, 'place', p.place, 'auteur', p.auteur,
      'vdo', public.live_vdo(p_live) || jsonb_build_object('flux', public.live_flux_invite(p_live, p.place, p.jeton)));
  end if;
  select count(*) into rang from public.live_parole where live_id = p_live and statut = 'attente' and demande_le <= p.demande_le;
  return jsonb_build_object('statut', 'attente', 'id', p.id, 'rang', rang);
end $$;

create or replace function public.live_courant() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l public.lives;
begin
  if not (public.a_acces_formation() or public.is_coach()) then
    raise exception 'acces refuse' using errcode = '42501';
  end if;
  select * into l from public.lives
   where publie and ((fin_le is null and debut > now() - interval '12 hours') or fin_le > now() - interval '2 hours')
   order by case when fin_le is null and now() >= debut - interval '30 minutes' then 1 when fin_le is not null then 2 else 3 end,
            case when fin_le is null and debut > now() + interval '30 minutes' then debut end asc,
            debut desc
   limit 1;
  return jsonb_build_object(
    'maintenant', now(),
    'live', case when l.id is null then null else jsonb_build_object(
      'id', l.id, 'titre', l.titre, 'debut', l.debut, 'fin', l.fin_le,
      'etat', case when l.fin_le is not null then 'termine' when now() >= l.debut - interval '30 minutes' then 'direct' else 'bientot' end,
      'youtube', case when l.fin_le is null and now() >= l.debut - interval '30 minutes' then l.youtube_id end) end,
    'prochains', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'titre', titre, 'debut', debut) order by debut)
      from (select id, titre, debut from public.lives where publie and fin_le is null and debut > now() and id is distinct from l.id order by debut limit 4) p), '[]'::jsonb)
  );
end $$;

create or replace function public.live_regie(p_live bigint) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l public.lives;
begin
  perform public.live_exiger_coach();
  select * into l from public.lives where id = p_live;
  if l.id is null then raise exception 'live introuvable' using errcode = 'P0002'; end if;
  return public.live_etat_public(p_live) || jsonb_build_object(
    'publie', l.publie, 'youtube', l.youtube_id, 'parole_on', l.parole_on,
    'attente', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'auteur', auteur, 'demande_le', demande_le) order by demande_le)
        from public.live_parole where live_id = p_live and statut = 'attente'), '[]'::jsonb),
    'scene', coalesce((select jsonb_agg(jsonb_build_object('id', id, 'auteur', auteur, 'place', place, 'invite_le', invite_le, 'rejoint', rejoint_le is not null) order by place)
        from public.live_parole where live_id = p_live and statut = 'invite'), '[]'::jsonb),
    'vdo', public.live_vdo_coach(p_live),
    'cle_obs', (select cle_obs from public.live_reglages where id = 1),
    'stats', jsonb_build_object(
        'connectes', (select count(*) from public.live_presences where live_id = p_live and vu_le > now() - interval '75 seconds'),
        'presents', (select count(*) from public.live_presences where live_id = p_live),
        'minutes', coalesce((select round(avg(secondes) / 60.0) from public.live_presences where live_id = p_live), 0),
        'messages', (select count(*) from public.live_messages where live_id = p_live and not coach))
  );
end $$;

create or replace function public.live_obs(p_cle text, p_quoi text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare l public.lives; v jsonb;
begin
  if p_cle is null or p_cle <> (select cle_obs from public.live_reglages where id = 1) then return jsonb_build_object('live', null); end if;
  select * into l from public.lives where publie and fin_le is null and now() >= debut - interval '3 hours' and debut > now() - interval '12 hours'
   order by (debut > now()), case when debut <= now() then debut end desc, debut limit 1;
  if l.id is null then return jsonb_build_object('live', null); end if;
  if p_quoi = 'chat' then
    return jsonb_build_object('live', l.id, 'messages', coalesce((select jsonb_agg(m order by m.id) from (
      select id, auteur, coach, texte from public.live_messages where live_id = l.id and masque_le is null order by id desc limit 8) m), '[]'::jsonb));
  end if;
  v := public.live_vdo_coach(l.id);
  return jsonb_build_object('live', l.id, 'room', v->>'room', 'password', v->>'password', 'tuiles',
    (case when l.coanim_le > now() - interval '45 seconds' then jsonb_build_array(jsonb_build_object('id', 'c1', 'flux', v->>'coanimateur')) else '[]'::jsonb end)
    || coalesce((select jsonb_agg(jsonb_build_object('id', 'p' || place, 'flux', public.live_flux_invite(l.id, place, jeton)) order by place)
        from public.live_parole where live_id = l.id and statut = 'invite' and rejoint_le is not null), '[]'::jsonb));
end $$;
