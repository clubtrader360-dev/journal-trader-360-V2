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
-- ⚠️ LA SOLUTION N'EST PAS UNE POLITIQUE PLUS FINE : RLS NE SAIT PAS RESTREINDRE
-- PAR COLONNE. Une politique d'`update` autorise la ligne entière, et un
-- `with check` ne peut pas empêcher de changer `journal_actif` en même temps,
-- puisqu'il n'évalue que le résultat. ⛔ Un `with check (journal_actif = false)`
-- semblerait suffire et ne suffirait pas : il bloquerait l'auto-octroi, mais
-- laisserait modifier `formation_actif`, `journal_fin` et le reste.
--
-- Ce qui restreint par colonne, c'est le GRANT. `grant update (colonne)` est la
-- seule barrière qui nomme une colonne, et elle s'applique AVANT les politiques.

grant update (journal_demande_le) on public.acces_membre to authenticated;

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
