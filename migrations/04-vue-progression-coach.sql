-- ============================================================================
-- LA PROGRESSION DES ELEVES DANS LA FORMATION, VUE PAR UN COACH
-- ⛔ NON APPLIQUE. Soumis a Nadir.
-- ============================================================================
--
-- ── ⚠️ POURQUOI UNE VUE, ET PAS UNE REQUETE PAR ELEVE ───────────────────────
--
-- Il y a 102 comptes. ⛔ Une requete par eleve en ferait 102 a chaque ouverture
-- de l'ecran, et ce depot a deja paye ce defaut : le tableau de bord coach est
-- passe de 281 requetes a 4 par une vue consolidee. On reprend cette approche.
--
-- ⚠️ `security_invoker = true`, COMME LES CINQ VUES EXISTANTES, verifie le
-- 12/10/2026. Sans cette option, la vue s'executerait avec les droits de son
-- proprietaire et contournerait RLS : n'importe quel compte authentifie lirait
-- la progression de tout le monde. ⛔ Avec elle, les politiques s'appliquent :
-- un coach voit tout par sa branche `is_coach()`, un eleve ne voit que sa ligne.
--
-- ── ⛔ AUCUN TEXTE DE NOTE N'EST EXPOSE, ET C'EST UNE DECISION ──────────────
--
-- Les politiques autorisent un coach a lire les notes. Le produit, non. Une note
-- est un espace personnel, et un eleve qui se doute qu'elle est lue cesse d'en
-- ecrire. La vue ne porte donc qu'un COMPTE de notes, jamais leur contenu, et
-- ⛔ `formation_notes.texte` n'apparait nulle part ci-dessous.

create or replace view public.coach_formation_overview
with (security_invoker = true) as
select
  u.uuid                                           as user_id,
  u.name,
  u.email,
  coalesce(p.lecons_vues, 0)                       as lecons_vues,
  coalesce(n.notes_ecrites, 0)                     as notes_ecrites,
  -- ⚠️ LA DERNIERE VISITE COMPTE AUTANT QUE L'AVANCEMENT. Un eleve a 40 % venu
  -- hier et un eleve a 40 % disparu depuis six semaines n'appellent pas le meme
  -- geste, et c'est le second qu'on veut reperer. `greatest` ignore les nulls,
  -- donc une seule des deux sources suffit.
  greatest(p.derniere_lecture, n.derniere_note, v.derniere_ouverture) as derniere_activite,
  a.formation_actif,
  a.journal_actif
from public.users u
  left join (
    select user_id,
           count(*) filter (where vue) as lecons_vues,
           max(last_watched_at)        as derniere_lecture
      from public.formation_progression
     group by user_id
  ) p on p.user_id = u.uuid
  left join (
    -- ⛔ `count(*)`, JAMAIS le texte.
    select user_id, count(*) as notes_ecrites, max(updated_at) as derniere_note
      from public.formation_notes
     group by user_id
  ) n on n.user_id = u.uuid
  left join (
    select user_id, vue_le as derniere_ouverture
      from public.formation_parcours_vu
  ) v on v.user_id = u.uuid
  left join public.acces_membre a on a.user_id = u.uuid
 where u.role = 'student'
   and coalesce(u.status, 'active') <> 'revoked';

comment on view public.coach_formation_overview is
  'Progression de chaque eleve dans la formation, agregee. ⛔ Ne porte AUCUN texte '
  'de note : seulement leur nombre. Decision de produit, pas de technique.';

grant select on public.coach_formation_overview to authenticated;

-- ============================================================================
-- ⚠️ CONTROLE APRES APPLICATION
-- ============================================================================
-- Le compte de lignes doit valoir le nombre d'eleves actifs, et la vue doit
-- rendre zero plutot que rien pour un eleve qui n'a jamais ouvert la formation.
--
--   select count(*) as lignes,
--          count(*) filter (where lecons_vues > 0)       as ont_commence,
--          count(*) filter (where derniere_activite is null) as jamais_venus
--     from public.coach_formation_overview;
--
-- ⚠️ ET LE TEMOIN D'ISOLATION, qui est le seul a prouver que `security_invoker`
-- fait son travail. Sous l'identite d'un eleve, la vue ne doit rendre QU'UNE
-- ligne, la sienne. ⛔ Si elle en rend 102, l'option n'a pas pris.
--
--   set local role authenticated;
--   set local request.jwt.claims to '{"sub":"<uuid d un eleve>"}';
--   select count(*) from public.coach_formation_overview;   -- attendu : 1
--   reset role;
