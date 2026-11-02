-- Banc des lives membres SUR LA VRAIE BASE (29/10/2026). Tout se passe dans un bloc
-- qui se termine par une exception : rien n'est écrit, le rapport est le message.
-- On joue trois personnes réelles (un coach, deux membres formation, un sans droit),
-- choisies par la requête, jamais écrites en dur. À lancer dans l'éditeur SQL.
do $$
declare
  C uuid; M1 uuid; M2 uuid; S uuid;
  r text := ''; lid bigint; lid2 bigint; j jsonb; mid bigint; d1 bigint; d2 bigint; cle text;
begin
  select u.uuid into C from users u where role in ('coach','admin') and coalesce(status,'active') in ('active','approved') and uuid is not null limit 1;
  select a.user_id into M1 from acces_membre a join users u on u.uuid = a.user_id where a.formation_actif and u.role not in ('coach','admin') order by a.user_id limit 1;
  select a.user_id into M2 from acces_membre a join users u on u.uuid = a.user_id where a.formation_actif and u.role not in ('coach','admin') and a.user_id <> M1 order by a.user_id limit 1;
  select a.user_id into S from acces_membre a join users u on u.uuid = a.user_id where not a.formation_actif and u.role not in ('coach','admin') limit 1;

  perform set_config('request.jwt.claims', json_build_object('sub', C)::text, true);
  lid := (live_enregistrer(jsonb_build_object('titre','Essai banc','debut', now() + interval '10 minutes','youtube_id','AbCdEfGh123','publie',true))->>'id')::bigint;
  lid2 := (live_enregistrer(jsonb_build_object('titre','Brouillon','debut', now() + interval '1 day','publie',false))->>'id')::bigint;
  begin perform live_enregistrer(jsonb_build_object('titre','x','debut', now(),'youtube_id','https://youtu.be/x')); r := r || 'KO youtube invalide accepté; '; exception when others then r := r || 'ok youtube refusé; '; end;

  if S is not null then
    perform set_config('request.jwt.claims', json_build_object('sub', S)::text, true);
    begin perform live_courant(); r := r || 'KO sans droit lit; '; exception when others then r := r || 'ok sans droit refusé; '; end;
  end if;

  perform set_config('request.jwt.claims', json_build_object('sub', M1)::text, true);
  j := live_courant();
  r := r || format('courant=%s (attendu %s) etat=%s brouillon_visible=%s; ', j->'live'->>'id', lid, j->'live'->>'etat', (j::text like '%Brouillon%'));
  begin perform live_regie(lid); r := r || 'KO régie membre; '; exception when others then r := r || 'ok régie refusée; '; end;
  begin perform live_commande(lid, '{"fin":true}'); r := r || 'KO commande membre; '; exception when others then r := r || 'ok commande refusée; '; end;
  begin perform live_salle(lid2); r := r || 'KO brouillon ouvert; '; exception when others then r := r || 'ok brouillon caché; '; end;
  j := live_ecrire(lid, '  Bonjour   à tous '); mid := (j->>'id')::bigint;
  r := r || format('msg [%s] coach=%s; ', j->>'texte', j->>'coach');
  begin perform live_ecrire(lid, 'encore'); r := r || 'KO anti-rafale; '; exception when others then r := r || 'ok anti-rafale; '; end;
  begin perform live_parole_membre(lid, 'demander'); r := r || 'KO parole fermée; '; exception when others then r := r || 'ok parole fermée; '; end;
  j := live_salle(lid); r := r || format('fuite_uid=%s; ', (j::text like '%'||M1::text||'%'));

  perform set_config('request.jwt.claims', json_build_object('sub', C)::text, true);
  perform live_commande(lid, '{"parole_on":true}');
  perform live_commande(lid, jsonb_build_object('ecran', mid));
  perform live_commande(lid, '{"sondage":{"question":"Q ?","choix":["ES","NQ"," ",""]}}');

  perform set_config('request.jwt.claims', json_build_object('sub', M1)::text, true);
  d1 := (live_parole_membre(lid, 'demander')->>'id')::bigint;
  r := r || format('double clic même id=%s; ', (live_parole_membre(lid, 'demander')->>'id')::bigint = d1);
  j := live_salle(lid);
  perform live_voter((j->'sondage'->>'id')::bigint, 1); perform live_voter((j->'sondage'->>'id')::bigint, 0);
  begin perform live_voter((j->'sondage'->>'id')::bigint, 5); r := r || 'KO choix 5; '; exception when others then r := r || 'ok choix hors liste; '; end;
  r := r || format('choix nettoyés=%s; ', j->'sondage'->'choix');

  perform set_config('request.jwt.claims', json_build_object('sub', M2)::text, true);
  d2 := (live_parole_membre(lid, 'demander')->>'id')::bigint;
  perform live_pouls(lid);

  perform set_config('request.jwt.claims', json_build_object('sub', C)::text, true);
  perform live_commande(lid, jsonb_build_object('inviter', d1));
  perform live_commande(lid, jsonb_build_object('inviter', d2));
  begin perform live_commande(lid, jsonb_build_object('inviter', d2)); r := r || 'KO réinviter; '; exception when others then r := r || 'ok déjà traitée; '; end;
  j := live_regie(lid);
  r := r || format('scene=%s votes=%s resultats=%s connectes=%s; ', jsonb_array_length(j->'scene'), j->'sondage'->>'total', j->'sondage'->'resultats', j->'stats'->>'connectes');
  cle := j->>'cle_obs';

  perform set_config('request.jwt.claims', json_build_object('sub', M1)::text, true);
  j := live_parole_membre(lid, 'etat'); r := r || format('invite place=%s; ', j->>'place');
  perform live_parole_membre(lid, 'rejoindre');

  perform set_config('request.jwt.claims', '{}', true);
  r := r || format('obs tuiles=%s flux_ok=%s mauvaise_cle=%s chat_fuite=%s; ', jsonb_array_length(live_obs(cle,'colonne')->'tuiles'), (live_obs(cle,'colonne')->'tuiles'->0->>'flux') = (j->'vdo'->>'flux'), live_obs('x','colonne'), (live_obs(cle,'chat')::text like '%'||M1::text||'%'));

  perform set_config('request.jwt.claims', json_build_object('sub', C)::text, true);
  perform live_commande(lid, '{"fin":true}');
  j := live_regie(lid); r := r || format('FIN ouvert=%s parole=%s scene=%s; ', j->>'ouvert', j->>'parole', jsonb_array_length(j->'scene'));
  perform set_config('request.jwt.claims', json_build_object('sub', M2)::text, true);
  begin perform live_ecrire(lid, 'après fin'); r := r || 'KO écrit après fin; '; exception when others then r := r || 'ok chat fermé; '; end;
  r := r || format('courant après fin=%s; ', live_courant()->'live'->>'etat');
  raise exception 'BANC (rien n''est écrit) : %', r;
end $$;
