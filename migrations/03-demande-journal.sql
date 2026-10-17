-- ============================================================================
-- LA TRACE DE DEMANDE ET DE RETRAIT DU JOURNAL
-- ⛔ NON APPLIQUÉ. Soumis à Nadir.
-- ============================================================================
--
-- ── ⚠️ POURQUOI DEUX COLONNES, ET PAS UN SEUL BOOLÉEN ────────────────────────
--
-- Quatre états doivent se distinguer, et aujourd'hui deux d'entre eux sont
-- confondus : « n'a jamais demandé le journal » et « l'a eu et perdu » valent
-- tous les deux `journal_actif = false`. ⛔ Les confondre afficherait « demander
-- l'accès » à quelqu'un dont l'abonnement vient de s'arrêter, ce qui est à la
-- fois faux et vexant.
--
--     journal_actif = true                              il entre
--     false, demande null,  retire null                 jamais demandé
--     false, demande posée, retire null                 demande en attente
--     false, retire posé                                droit retiré
--
-- ⚠️ `journal_retire_le` PRIME sur `journal_demande_le` dans la lecture : qui a
-- perdu le droit puis redemande reste dans le cas « retiré », parce que c'est le
-- message qui le concerne.

alter table public.acces_membre
  add column if not exists journal_demande_le timestamptz,
  add column if not exists journal_retire_le  timestamptz;

comment on column public.acces_membre.journal_demande_le is
  'Date de la demande d''acces au journal, posee par l''eleve lui-meme. '
  'Null = jamais demande.';
comment on column public.acces_membre.journal_retire_le is
  'Date du retrait du droit journal. ⛔ N''A RIEN A VOIR avec public.users.status : '
  'un retrait de journal laisse la connexion ET la formation ouvertes. La fermeture '
  'du compte entier, elle, reste status = revoked, et c''est un cas distinct.';

-- ============================================================================
-- ⚠️ L'ÉLÈVE PEUT POSER SA DEMANDE, ET RIEN D'AUTRE
-- ============================================================================
-- ⛔ `acces_membre` n'a volontairement AUCUNE politique d'écriture : si un élève
-- pouvait écrire sa ligne, il s'accorderait ses droits lui-même. Mais il doit
-- pouvoir demander le journal d'un clic.
--
-- ⚠️ RLS NE SAIT PAS RESTREINDRE PAR COLONNE. Une politique d'`update` autorise
-- la ligne entière, et un `with check` n'évalue que le résultat.
--
-- ── ⛔ ET VOICI LA FAUTE QUE CE FICHIER PORTAIT, CORRIGÉE LE 11/10/2026 ──────
--
-- La version précédente écrivait seulement :
--
--     grant update (journal_demande_le) on public.acces_membre to authenticated;
--
-- et affirmait en commentaire que « le grant fait que c'est la seule colonne qui
-- PUISSE l'être ». ⛔ C'EST FAUX. UN `GRANT` DONNE, IL NE RETIRE JAMAIS.
--
-- Mesure des privilèges réels, le 11/10/2026, avant toute application :
--
--     authenticated   UPDATE sur la table entiere
--     authenticated   UPDATE sur user_id, formation_actif, formation_fin,
--                            journal_actif, journal_fin, updated_at, created_at
--     anon            les memes
--
-- Ces privilèges viennent des defauts de Supabase à la création de la table. La
-- politique `acces_membre_demande` aurait donc ouvert TOUTES les colonnes à un
-- élève sans journal, la seule barrière restant son `with check` :
--
--     journal_actif = true     refuse, le with check travaille
--     journal_retire_le = null AUTORISE : il efface la trace de sa revocation
--     journal_fin              AUTORISE : la colonne qui portera l abonnement
--     formation_actif = false  AUTORISE : absurde, mais la porte etait ouverte
--
-- ⚠️ C'est le motif du 8 octobre, dans mon propre fichier : un commentaire qui
-- affirme ce que le code ne fait pas, et qui passe la relecture parce qu'on lit
-- le commentaire.
--
-- ⚠️ L'ORDRE COMPTE : on révoque D'ABORD, on accorde ENSUITE. L'inverse
-- effacerait le grant fin qu'on vient de poser.
--
-- ⛔ `service_role` ET `postgres` NE SONT PAS TOUCHÉS, vérifié : ils gardent
-- leurs privilèges propres. L'octroi des droits par un coach passe par la clé de
-- service, ce chemin n'est donc pas affecté. Mesuré, pas supposé.

revoke update, insert, delete on public.acces_membre from authenticated, anon;
grant  update (journal_demande_le) on public.acces_membre to authenticated;

-- ⚠️ `insert` et `delete` sont révoqués aussi. Aucune politique ne les autorise
-- aujourd'hui, donc RLS les bloque déjà ; mais un privilège inutile est une arme
-- chargée qui attend sa politique. ⛔ Les lignes naissent par la clé de service.

create policy acces_membre_demande on public.acces_membre
  for update to authenticated
  using ((auth.uid() = user_id) and not journal_actif)
  with check ((auth.uid() = user_id) and not journal_actif);

-- ⚠️ `not journal_actif` DES DEUX CÔTÉS. Qui a déjà le droit n'a rien à demander,
-- et surtout : si un jour quelqu'un ajoutait une colonne au `grant`, la politique
-- limiterait encore les dégâts à une ligne qui n'a pas le droit actif.

-- ============================================================================
-- ⛔ CE QUE CE FICHIER NE FAIT PAS, ET NE DOIT PAS FAIRE
-- ============================================================================
-- Il ne touche pas aux 4 comptes `revoked`. Arbitrage de Nadir : ce sont des
-- comptes FERMÉS, formation comprise, et ils le restent. Leur `journal_actif`
-- vaut déjà faux, mais ⛔ ILS NE DOIVENT PAS RECEVOIR `journal_retire_le` :
-- sinon ils basculeraient dans le cas « tu n'es plus abonné », alors qu'ils
-- n'atteignent même pas cet écran, `supabase-auth.js` les déconnectant avant.
--
-- ⚠️ C'est exactement l'effet de bord contre lequel le lot met en garde, et c'est
-- pourquoi aucune ligne de mise à jour n'est écrite ici. Les deux colonnes
-- naissent nulles pour tout le monde, y compris pour eux.

-- ============================================================================
-- ⚠️ CONTRÔLE APRÈS APPLICATION
-- ============================================================================
--   select count(*) filter (where journal_actif)                              as actifs,
--          count(*) filter (where not journal_actif and journal_demande_le is null
--                             and journal_retire_le is null)                  as jamais_demande,
--          count(*) filter (where journal_demande_le is not null
--                             and journal_retire_le is null)                  as en_attente,
--          count(*) filter (where journal_retire_le is not null)              as retires
--     from public.acces_membre;
--
-- Attendu juste après application : 98 actifs, 4 jamais demandé, 0 en attente,
-- 0 retirés. ⚠️ Les 4 sont les comptes fermés : ils apparaissent ici en « jamais
-- demandé » par construction, et c'est sans effet puisqu'ils ne se connectent pas.

-- ============================================================================
-- ⚠️ LE CONTRÔLE QUI TRANCHE, ET IL NE LISTE PAS DES GRANTS
-- ============================================================================
-- ⛔ Un contrôle qui liste les privilèges ne prouve rien : il dit ce qui est
-- écrit, pas ce qui est possible. On ÉPROUVE LA TENTATIVE, sous l'identité d'un
-- compte sans journal. Les trois premières doivent être REFUSÉES, la quatrième
-- doit RÉUSSIR. ⚠️ Sans cette quatrième, un refus universel ressemblerait à une
-- protection.
--
--   set local role authenticated;
--   set local request.jwt.claims to '{"sub":"<uuid d un compte sans journal>"}';
--
--   update public.acces_membre set journal_retire_le = null where user_id = auth.uid();
--   update public.acces_membre set journal_fin       = now()  where user_id = auth.uid();
--   update public.acces_membre set formation_actif   = false  where user_id = auth.uid();
--   -- ⚠️ TEMOIN, doit reussir :
--   update public.acces_membre set journal_demande_le = now() where user_id = auth.uid();
--
--   reset role;
--
-- Attendu : « permission denied for column ... » sur les trois premières,
-- UPDATE 1 sur la quatrième.

-- ============================================================================
-- ⚠️ LA CLASSE, PAS L'INSTANCE : LES TROIS TABLES DE FORMATION
-- ============================================================================
-- Elles hériteront des MÊMES privilèges par défaut à leur création. Relevé fait,
-- et la réponse n'est pas la même pour elles :
--
--   formation_notes          texte, updated_at          toutes sont a l eleve
--   formation_progression    vue, progress_seconds, ... toutes sont a l eleve
--   formation_parcours_vu    lecons_vues..., vue_le     toutes sont a l eleve
--
-- ⚠️ AUCUNE DE LEURS COLONNES NE DIT UN DROIT. Un élève qui écrit n'importe quoi
-- dans `progress_seconds` ou dans `vue` ne fait que mentir à sa propre barre de
-- progression. Leurs politiques, qui bornent la LIGNE à `auth.uid() = user_id`
-- et exigent `a_acces_formation()`, suffisent donc.
--
-- ⛔ `acces_membre` EST LA SEULE EXCEPTION, et pour une raison précise : c'est la
-- seule dont une colonne décide d'un ACCÈS. C'est pour cela qu'elle seule reçoit
-- une restriction par colonne, et c'est écrit ici pour que personne ne
-- « harmonise » les quatre un jour de ménage.
