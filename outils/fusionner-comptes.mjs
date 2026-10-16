/**
 * FUSIONNE DEUX COMPTES D UNE MEME PERSONNE : l adresse LearnyBox fait foi, les
 * donnees du journal sont gardees.
 *
 * Arbitrage de Nadir du 16/10/2026 : « tu prends l email de LearnyBox qui fait
 * foi, mais tu gardes leurs donnees sur leur journal ».
 *
 * ── CE QUE FAIT LE SQL PRODUIT ───────────────────────────────────────────────
 * Le compte qui PORTE LES DONNEES (`--garder`) est conserve : meme identifiant
 * interne, donc tous ses trades, entrees, comptes, reglages restent attaches
 * sans qu une seule ligne bouge, et MEME MOT DE PASSE. Seule son adresse change
 * pour l adresse LearnyBox (`--adresse`).
 * Le compte cree a l adresse LearnyBox, s il existe, est supprime d abord
 * (l adresse doit etre libre). ⛔ Garde-fou : s il porte la moindre donnee de
 * journal, tout s arrete. Sa progression de formation n est pas perdue : elle
 * vient de LearnyBox et `appliquer_progression_learnybox()` la reporte sur le
 * compte garde, a la fin. Ses chapitres vus dans l espace formation sont
 * deplaces avant la suppression.
 * Un signalement « doublon » garde l ancienne adresse en memoire.
 *
 * ⚠️ L IDENTIFIANT DE CONNEXION CHANGE : la personne se connecte ensuite avec
 * l adresse LearnyBox. A jouer le jour de la bascule, AVEC le mail qui le lui
 * dit, jamais en silence : sinon elle tape son ancienne adresse et lit
 * « Email ou mot de passe incorrect ».
 *
 * Tout est dans une transaction : une erreur annule tout.
 *
 * Usage :
 *   node outils/fusionner-comptes.mjs --garder ancienne@x.fr --adresse learnybox@y.fr [--essai]
 *   --essai : le SQL se termine par une exception, donc rien n est ecrit ; le
 *             message dit ce qui aurait ete fait.
 */
const arg = (n) => { const i = process.argv.indexOf(n); return i > 0 ? process.argv[i + 1] : null; };
const garder = String(arg('--garder') || '').trim().toLowerCase();
const adresse = String(arg('--adresse') || '').trim().toLowerCase();
const essai = process.argv.includes('--essai');
const EMAIL = /^[^\s@'"]+@[^\s@'"]+\.[^\s@'"]+$/;
if (!EMAIL.test(garder) || !EMAIL.test(adresse) || garder === adresse) {
  console.error('usage : node outils/fusionner-comptes.mjs --garder ancienne@x.fr --adresse learnybox@y.fr [--essai]');
  process.exit(1);
}
const q = (v) => `'${v.replace(/'/g, "''")}'`;
const JOURNAL = ['journal_entries', 'trades', 'accounts', 'account_costs', 'checklist_validations', 'daily_fees', 'payouts', 'tradovate_credentials', 'tradovate_sync_state'];

console.log(`do $$
declare g uuid; l uuid; n bigint; bilan text := '';
begin
  select id into g from auth.users where lower(email) = ${q(garder)};
  if g is null then raise exception 'compte a garder introuvable : %', ${q(garder)}; end if;
  if not exists (select 1 from public.formation_niveau_learnybox where lower(email) = ${q(adresse)}) then
    raise exception 'adresse absente de LearnyBox : %', ${q(adresse)};
  end if;
  select id into l from auth.users where lower(email) = ${q(adresse)};
  if l is not null then
    -- garde-fou : le compte LearnyBox ne porte aucune donnee de journal
${JOURNAL.map((t) => `    select count(*) into n from public.${t} where user_id = l; if n > 0 then raise exception 'le compte LearnyBox porte % ligne(s) dans ${t} : fusion manuelle', n; end if;`).join('\n')}
    -- ses chapitres vus dans l espace formation passent sur le compte garde
    insert into public.formation_progression (user_id, lecon_id, vue, progress_seconds, last_watched_at, secondes_vues)
      select g, lecon_id, vue, progress_seconds, last_watched_at, secondes_vues from public.formation_progression where user_id = l
      on conflict (user_id, lecon_id) do nothing;
    update public.formation_quiz_resultats set user_id = g where user_id = l;
    delete from public.users where uuid = l;
    delete from auth.users where id = l;
    bilan := bilan || 'compte LearnyBox vide supprime ; ';
  end if;
  update auth.users set email = ${q(adresse)}, updated_at = now() where id = g;
  update auth.identities set identity_data = identity_data || jsonb_build_object('email', ${q(adresse)}), updated_at = now()
    where user_id = g and provider = 'email';
  update public.users set email = ${q(adresse)} where uuid = g;
  update public.membres_transactions set email = ${q(adresse)} where lower(email) = ${q(garder)};
  insert into public.membres_signalements (email, type, note, reference_email, cree_par)
    values (${q(garder)}, 'doublon', 'Fusionné : ce compte se connecte désormais avec l adresse LearnyBox, même mot de passe, journal intact.', ${q(adresse)}, 'fusionner-comptes');
  perform public.appliquer_progression_learnybox();
  select count(*) into n from public.journal_entries where user_id = g;
  bilan := bilan || 'adresse ' || ${q(garder)} || ' -> ' || ${q(adresse)} || ', ' || n || ' entrees de journal gardees';
  select count(*) into n from public.formation_progression where user_id = g and vue;
  bilan := bilan || ', ' || n || ' chapitres de formation';
  ${essai ? `raise exception 'ESSAI, rien n est ecrit : %', bilan;` : `raise notice '%', bilan;`}
end $$;`);
