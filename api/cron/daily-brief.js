// ========================================
// API ROUTE : ENVOI QUOTIDIEN DU BRIEF MARCHÉ (#91 V2)
// Route : /api/cron/daily-brief
// Déclenché par GitHub Actions (Lun-Ven 6h Paris) : Claude Code CLI génère le brief
// marché en HTML puis POST ce HTML ici. L'endpoint le wrap dans le layout email
// "Bourse à l'Aube" (cohérent avec weekly-report) et l'envoie via Resend.
// Body JSON : { date, date_long_fr, brief_html, only_user_id?, test_emails?: string[] }
//  - test_emails présent  → envoi UNIQUEMENT à ces adresses (rodage)
//  - only_user_id présent → envoi UNIQUEMENT à cet élève éligible (test ciblé)
//  - sinon                → envoi à tous les élèves éligibles (production)
// ========================================

import { createClient } from '@supabase/supabase-js';
import { getBriefRecipients } from '../_lib/tableur-recipients.js';
import { syncList, createCampaign, sendCampaignNow, ensureList, PROSPECTS_LIST_NAME } from '../_lib/brevo-client.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://zgihbpgoorymomtsbxpz.supabase.co';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Sécurité de test : si DAILY_BRIEF_DRY_RUN = '1', on sélectionne mais on N'ENVOIE PAS.
const DRY_RUN = process.env.DAILY_BRIEF_DRY_RUN === '1';

export function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
}

// ---- Prénom à partir du champ `name` (nom complet) ----
export function firstNameOf(name) {
  return name && name.trim() ? name.trim().split(/\s+/)[0] : null;
}

// ---- Élèves éligibles : role=student, status=active, email non vide, NON en vacation_mode.
//      Mêmes filtres que weekly-report (le brief marché est générique → tous les actifs).
//      Pas de filtre d'activité journal : le contenu ne dépend pas des trades de l'élève. ----
export async function fetchEligibleStudents(supabase) {
  const { data: users, error } = await supabase
    .from('users')
    .select('id, uuid, email, name, role, status')
    .eq('role', 'student')
    .eq('status', 'active')
    .not('email', 'is', null);
  if (error) throw error;

  const uuids = (users || []).map(u => u.uuid).filter(Boolean);
  let vacationIds = new Set();
  if (uuids.length) {
    const { data: prefs } = await supabase
      .from('user_preferences')
      .select('user_id, vacation_mode')
      .in('user_id', uuids);
    vacationIds = new Set((prefs || []).filter(p => p.vacation_mode === true).map(p => p.user_id));
  }
  return (users || []).filter(u => u.uuid && !vacationIds.has(u.uuid));
}

// ---- Sujet ----
// Tag de personnalisation Brevo (Brevo Template Language). Interprété par Brevo à
// l'envoi de la campagne, JAMAIS par nous. Le filtre `default` fournit le repli des
// contacts sans PRENOM. Réservé au chemin campagne : sur Resend, il s'afficherait tel quel.
export const BREVO_FIRSTNAME_TAG = '{{ contact.PRENOM|default:"Trader" }}';

// ---- Pré-remplissage des formulaires prospects ----
// Les valeurs viennent de tags Brevo, interprétés à l'envoi de la campagne. La variante
// prospects n'a PAS de repli Resend (cf sendProspectsCampaign) : elle passe toujours par
// une campagne, donc les tags sont toujours résolus. Pas de double gestion à prévoir
// comme pour le prénom en #85.
//
// |urlencode est INDISPENSABLE ici, et le danger n'est PAS celui qu'on croit : les
// accents (Émilie) et les apostrophes passent en UTF-8 brut, les parseurs d'URL les
// tolèrent. Le vrai piège est le '+' des emails — sans encodage, 'a+trading@gmail.com'
// se relit 'a trading@gmail.com', le '+' devenant une espace. Le formulaire se
// pré-remplirait alors avec une adresse FAUSSE, sans la moindre erreur visible.
// Le filtre existe bien en BTL — le moteur est Pongo2, réimplémentation de Django en Go,
// d'où aussi la syntaxe sans espaces autour de | et :.
//
// PAS de |default ici, à la différence de l'accroche : pré-remplir un formulaire avec
// "Trader" en guise de prénom injecterait une fausse donnée. Un tag vide laisse
// simplement le champ vide, ce qui est le comportement voulu.
const PREFILL_PARAMS =
  'email={{ contact.EMAIL|urlencode }}' +
  '&amp;prenom={{ contact.PRENOM|urlencode }}' +
  '&amp;nom={{ contact.NOM|urlencode }}';

const UTM_PROSPECTS = 'utm_source=brief&amp;utm_medium=email&amp;utm_campaign=prospects';

// URL prospect complète : base + pré-remplissage + UTM.
function prospectUrl(base, utmContent) {
  return `${base}?${PREFILL_PARAMS}&amp;${UTM_PROSPECTS}&amp;utm_content=${utmContent}`;
}

const URL_QUESTIONNAIRE = 'https://www.trader360.fr/sondages/inscription/quel-est-ton-profil-de-depart-dans-le-trading/';

// ---- Campagne PROSPECTS — toujours secondaire, toujours isolée ----
// Ne lève JAMAIS : toute erreur est capturée et retournée dans le rapport. Les membres
// sont déjà servis quand cette fonction s'exécute ; rien de ce qui se passe ici ne doit
// remettre leur envoi en cause, ni déclencher le repli Resend qui leur est réservé.
// La liste prospects n'est JAMAIS synchronisée : elle est alimentée à la main.
async function sendProspectsCampaign({ date, subject, briefHtml, dateLongFr }) {
  try {
    const { listId, listName, created } = await ensureList(PROSPECTS_LIST_NAME);
    if (created) console.log(`[DAILY-BRIEF] 📋 Liste prospects "${listName}" créée (id ${listId})`);

    const campaign = await createCampaign({
      name: `Brief T360 PROSPECTS — ${date}`,
      subject, // même sujet que les membres : c'est le même brief
      htmlContent: wrapBriefHtml({
        firstName: BREVO_FIRSTNAME_TAG,
        dateLongFr,
        briefHtml,
        variant: 'prospects',
      }),
      listId,
    });
    await sendCampaignNow(campaign.campaignId);
    console.log(`[DAILY-BRIEF] 📣 Campagne PROSPECTS ${campaign.campaignId} envoyée à la liste ${listId}`);
    return { campaignId: campaign.campaignId, listId, listName, sent: true };
  } catch (e) {
    // Journalisé et remonté, jamais propagé : les membres ont déjà reçu le brief.
    console.error('[DAILY-BRIEF] ⚠️ Campagne PROSPECTS échouée (sans incidence sur les membres):', e);
    return { campaignId: null, sent: false, error: e.message };
  }
}

// ---- Filet anti tirets longs ----
// Les cadratins sont une signature d'IA et ne correspondent pas à l'usage français
// courant. Le prompt système les interdit ; ce filet rattrape ce qui passe malgré tout,
// et JOURNALISE le nombre de remplacements pour qu'on sache si la consigne tient.
//
// Ne touche QUE le texte, jamais le markup : le remplacement ne s'applique qu'aux
// segments situés entre '>' et '<'. Un cadratin présent dans un attribut, une URL ou
// une valeur de style est donc laissé intact.
// Le trait d'union ordinaire (U+002D) n'est JAMAIS visé : il est légitime dans
// « Nasdaq-100 », « au-dessus », « sur-performance ».
export function stripLongDashes(html) {
  if (!html) return { html: html, count: 0 };
  let count = 0;
  const fix = (txt) => txt
    // Entités équivalentes : &mdash; / &ndash; afficheraient le même caractère.
    // Les espaces alentour sont absorbés, sinon on laisse une double espace.
    .replace(/\s*&[mn]dash;\s*/g, () => { count++; return ', '; })
    // INTERVALLE entre deux nombres (« 09:30–16:00 », « 7 650–7 700 ») : la virgule
    // serait un contresens, c'est une plage. « à » est la forme française correcte.
    .replace(/(\d)\s*[\u2014\u2013]\s*(\d)/g, (m, a, b) => { count++; return a + ' à ' + b; })
    // Cadratin en TÊTE de segment (usage de type liste) : retiré, plutôt que d'ouvrir
    // la phrase par une virgule orpheline.
    .replace(/^(\s*)[\u2014\u2013]\s*/, (m, sp) => { count++; return sp; })
    // Cas courant « mot — mot » : la virgule est la substitution la plus sûre en français.
    .replace(/\s*[\u2014\u2013]\s*/g, () => { count++; return ', '; });

  const out = html.replace(/>([^<]*)</g, (m, txt) => '>' + fix(txt) + '<');
  return { html: out, count };
}

export function emailSubject(dateLongFr) {
  return `📊 Brief marché — ${dateLongFr}`;
}

// ========================================================================
// DESIGN EMAIL — Bourse à l'Aube (light, table-based, compat clients mail).
// Même palette que weekly-report. Pas de radar (c'est un brief marché, pas un
// rapport individuel). Le brief_html (généré par Claude) est injecté tel quel.
// ========================================================================
const PALETTE = {
  bgPage: '#fdfaf3', bgCard: '#ffffff', bgInside: '#fdf8ed',
  gold: '#ac862b', goldBright: '#d4af37', goldFrame: '#d4af37',
  textPrimary: '#1a1208', textSecondary: '#5a5040', textMuted: '#7a6b50', navy: '#000B25',
  // Fond or doux du « mot de la communauté » : le cadre de partage l'adopte pour que
  // les deux encarts de fin forment une paire visuelle, au lieu d'un bloc de second rang.
  bgAccent: '#fdf3d6',
};

// ---- Wrap le brief HTML dans le layout email "Bourse à l'Aube" ----
// variant : 'members' (défaut) | 'prospects'. Le CORPS du brief est identique dans les
// deux cas — c'est tout l'intérêt : le prospect voit exactement ce que reçoit un membre.
// Seul le bloc final diffère (CTA journal + encart).
export function wrapBriefHtml({ firstName, dateLongFr, briefHtml, variant = 'members' }) {
  const isProspects = variant === 'prospects';
  const hi = firstName ? `Bonjour ${firstName},` : 'Bonjour,';
  const hairline = `<div style="height:1px; background:linear-gradient(to right, transparent, ${PALETTE.goldFrame} 50%, transparent); margin:24px 0;"></div>`;
  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Brief marché — Trader 360</title></head>
<body style="margin:0; padding:0; background:${PALETTE.bgPage};">
<div style="background:${PALETTE.bgPage}; padding:40px 16px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; color:${PALETTE.textPrimary};">
  <table role="presentation" width="600" align="center" cellspacing="0" cellpadding="0" style="max-width:600px; margin:0 auto; background:${PALETTE.bgCard}; border:1px solid ${PALETTE.goldFrame}; border-radius:14px;">
    <!-- Bandeau : ligne de tableau DÉDIÉE, sans padding, pour que l'image touche les
         bords de la carte et épouse ses coins arrondis. La placer dans le <td> à
         padding:32px l'aurait laissée flotter au milieu.
         line-height:0 sur le <td> : sans ça, certains clients ajoutent une bande sous
         l'image. display:block joue le même rôle côté Gmail.
         width en ATTRIBUT ET en style : Outlook ignore le CSS.
         alt renseigné : beaucoup de clients bloquent les images, l'alt est alors tout
         ce que le lecteur voit. -->
    <tr><td style="padding:0; line-height:0; font-size:0;">
      <img src="https://journaltrader360.fr/assets/brief-header.jpg" width="600" alt="Trader 360 — Brief marché"
           style="display:block; width:100%; max-width:600px; height:auto; border:0; border-radius:14px 14px 0 0;">
    </td></tr>
    <tr><td style="padding:32px;">

      <!-- Logo et <h1> retirés : le visuel porte DÉJÀ le logo et le mot « Brief marché ».
           Seule la date reste, elle n'est pas dans l'image. -->
      <div style="text-align:center; margin-bottom:24px;">
        <p style="color:${PALETTE.textSecondary}; font-style:italic; margin:0; font-size:14px;">${dateLongFr}</p>
      </div>

      <p style="color:${PALETTE.textPrimary}; font-size:15px; line-height:1.6; margin:0 0 8px;">${hi}</p>

      ${hairline}

      <div class="brief-body" style="color:${PALETTE.textPrimary}; font-size:14px; line-height:1.65;">
        ${briefHtml}
      </div>

      ${hairline}

      ${isProspects ? `
      <!-- Version PROSPECTS — bouton journal VERROUILLÉ.
           Volontairement un <div> et non un <a> : rien à cliquer, donc aucune page
           d'erreur ni redirection vers un login. Traitement atténué (fond crème,
           contour discret, gris chaud) pour se lire comme une porte fermée, pas
           comme un bouton cassé. -->
      <div style="text-align:center; margin-top:28px;">
        <div style="display:inline-block; background:${PALETTE.bgInside}; color:${PALETTE.textMuted}; border:1px solid rgba(212,175,55,0.35); padding:14px 32px; border-radius:10px; font-weight:600; letter-spacing:0.04em;">🔒 Ouvrir mon journal</div>
        <div style="margin-top:8px; color:${PALETTE.textMuted}; font-size:12px; font-style:italic;">Réservé aux membres Trader 360</div>
      </div>` : `
      <div style="text-align:center; margin-top:28px;">
        <a href="https://journaltrader360.fr" style="display:inline-block; background:${PALETTE.goldBright}; color:${PALETTE.navy}; padding:14px 32px; border-radius:10px; text-decoration:none; font-weight:600; letter-spacing:0.04em;">Ouvrir mon journal →</a>
      </div>`}

      <!-- Encart Ambassadeur — action SECONDAIRE, volontairement en retrait du CTA journal :
           fond or doux, texte réduit, bouton en contour et non plein. L'élève voit d'abord
           son journal, puis pense à recommander.
           Aucun tag de personnalisation ici : le bloc est rigoureusement identique sur le
           chemin campagne Brevo et sur le repli Resend. Les UTM tracent la provenance,
           pas le destinataire.
           Table plutôt que div : compatibilité Outlook, aucun flexbox. -->
      ${isProspects ? `
      <!-- Version PROSPECTS — encart d'INVITATION. Ce bouton est la SEULE action
           possible pour un prospect : il reçoit donc le poids visuel qu'avait
           "Ouvrir mon journal" chez les membres (goldBright plein, texte navy). -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;">
        <tr><td style="background:${PALETTE.bgAccent}; border:1px solid ${PALETTE.navy}; border-radius:10px; padding:18px 20px; text-align:center;">
          <p style="margin:0 0 14px; color:${PALETTE.textSecondary}; font-size:13px; line-height:1.6;">
            Si tu veux en savoir plus, réponds au questionnaire de positionnement — tu accéderas ensuite à notre présentation et pourras prendre rendez-vous.
          </p>
          <!-- CTA UNIQUE. Le questionnaire mène déjà, en aval, à la présentation puis au
               lien Calendly : proposer la vidéo ici ouvrirait une seconde porte vers un
               tunnel qui n'en a qu'une, et court-circuiterait l'étape de qualification.
               Le texte annonce la suite du parcours, ce qui donne une raison de cliquer. -->
          <a href="${prospectUrl(URL_QUESTIONNAIRE, 'questionnaire')}"
             style="display:inline-block; background:${PALETTE.goldBright}; color:${PALETTE.navy}; padding:14px 30px; border-radius:10px; text-decoration:none; font-weight:600; font-size:14px; letter-spacing:0.04em;">Répondre au questionnaire →</a>
        </td></tr>
      </table>` : `
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;">
        <tr><td style="background:${PALETTE.bgAccent}; border:1px solid ${PALETTE.navy}; border-radius:10px; padding:18px 20px; text-align:center;">
          <p style="margin:0 0 14px; color:${PALETTE.textSecondary}; font-size:13px; line-height:1.6;">
            Si tu connais quelqu'un d'intéressé, partage-lui le lien du questionnaire — il devra indiquer ton nom dans l'une des questions, on saura que ça vient de toi.
          </p>
          <a href="https://www.trader360.fr/sondages/inscription/quel-est-ton-profil-de-depart-dans-le-trading/?utm_source=brief&amp;utm_medium=email&amp;utm_campaign=ambassadeur"
             style="display:inline-block; background:${PALETTE.bgCard}; color:${PALETTE.gold}; border:1px solid ${PALETTE.goldBright}; padding:10px 22px; border-radius:8px; text-decoration:none; font-weight:600; font-size:13px; letter-spacing:0.03em;">Partager le questionnaire →</a>
        </td></tr>
      </table>`}

      <div style="text-align:center; margin-top:24px; padding-top:20px; border-top:1px solid rgba(212,175,55,0.30); color:${PALETTE.textMuted}; font-size:11px;">
        Trader 360 · brief du ${dateLongFr}<br>
        <em>Le trading comporte des risques de perte en capital. Ce brief est informatif et ne constitue pas un conseil en investissement (AMF).</em>
      </div>

    </td></tr>
  </table>
</div>
</body></html>`;
}

// ---- Envoi via Resend REST (HTML seul, plus de pièce jointe PDF) ----
export async function sendBriefEmail({ to, subject, html }) {
  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: 'Trader 360 <noreply@mail.journaltrader360.fr>', to: [to], subject, html }),
    });
    const data = await response.json();
    if (!response.ok) return { success: false, error: data.message || 'Unknown error' };
    return { success: true, id: data.id };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

// ========================================
// HANDLER (POST, Bearer CRON_SECRET — déclenché par GitHub Actions)
// ========================================
export default async function handler(req, res) {
  console.log('[DAILY-BRIEF] ========== START ==========', DRY_RUN ? '(DRY_RUN)' : '');

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth : Bearer obligatoire en production ; relâché en preview (URL protégée par Vercel Auth).
  const isPreview = process.env.VERCEL_ENV !== 'production';
  const cronSecret = process.env.CRON_SECRET;
  if (!isPreview) {
    if (!cronSecret) return res.status(500).json({ error: 'Missing CRON_SECRET' });
    if (req.headers.authorization !== `Bearer ${cronSecret}`) return res.status(401).json({ error: 'Unauthorized' });
  }
  if (!SUPABASE_SERVICE_KEY) return res.status(500).json({ error: 'Missing SUPABASE_SERVICE_ROLE_KEY' });

  // #20 — dry run des destinataires tableur (validation avant envoi, aucun brief_html requis).
  if (req.body && req.body.dry_recipients === true) {
    try {
      const { recipients, stats } = await getBriefRecipients();
      console.log(`[DAILY-BRIEF] 📋 DRY recipients tableur: ${JSON.stringify(stats)}`);
      return res.status(200).json({ ok: true, mode: 'dry_recipients', stats, count: recipients.length, sample: recipients.slice(0, 8) });
    } catch (e) {
      return res.status(500).json({ ok: false, error: e.message });
    }
  }

  // ---- Synchro de la liste Brevo dédiée depuis le tableur ----
  // Modes greffés sur cet endpoint plutôt que sur une nouvelle route : on est à 10/12
  // fonctions serverless sur le plan Vercel, autant garder la marge.
  // Aucune incidence sur l'envoi : le brief part toujours via Resend. Ces deux modes
  // court-circuitent la génération et l'envoi, comme dry_recipients.
  const syncBrevoDry = req.body && req.body.dry_sync_brevo === true;
  const syncBrevoApply = req.body && req.body.sync_brevo === true;
  if (syncBrevoDry || syncBrevoApply) {
    const dryRun = syncBrevoDry;
    try {
      const { recipients, stats } = await getBriefRecipients();
      console.log(`[DAILY-BRIEF] 🔄 Sync Brevo (dryRun=${dryRun}) — tableur: ${JSON.stringify(stats)}`);
      const report = await syncList({ recipients, dryRun });
      console.log(`[DAILY-BRIEF] 🔄 Sync Brevo rapport: ${JSON.stringify(report)}`);
      return res.status(200).json({
        ok: true,
        mode: dryRun ? 'dry_sync_brevo' : 'sync_brevo',
        tableur_stats: stats,
        report,
      });
    } catch (e) {
      // Remontée explicite : une liste incomplète ou une synchro refusée doit se voir.
      console.error('[DAILY-BRIEF] ❌ Sync Brevo:', e);
      return res.status(500).json({ ok: false, mode: dryRun ? 'dry_sync_brevo' : 'sync_brevo', error: e.message });
    }
  }

  if (!RESEND_API_KEY && !DRY_RUN) return res.status(500).json({ error: 'Missing RESEND_API_KEY' });

  let { date, date_long_fr, brief_html, only_user_id, test_emails } = req.body || {};
  if (!date || !date_long_fr || !brief_html) {
    return res.status(400).json({ error: 'Champs requis : date, date_long_fr, brief_html' });
  }

  // Défense finale anti-méta-commentaire (bug prod P1) : rejette AVANT tout appel Resend,
  // pour qu'un workflow buggé ne puisse jamais expédier un mail cassé aux élèves.
  // Motif tolérant : le wrapper peut porter un style inline (compat email).
  // Symétrique du garde du workflow (daily-brief.yml:104) — les deux DOIVENT rester alignés.
  // Historique : le run du 2026-08-21 a produit '<div class="brief-marche" style="font-family:Arial;…">',
  // brief valide rejeté par le motif littéral '<div class="brief-marche">' avec le '>' collé.
  if (!/<div[^>]*brief-marche/.test(brief_html)) {
    return res.status(400).json({ error: 'brief_html invalide : wrapper brief-marche absent' });
  }
  if (/^\s*(le brief|voici|j['´’]?ai|points cl|sauvegard|\/tmp\/)/i.test(brief_html)) {
    return res.status(400).json({ error: 'brief_html contient un méta-commentaire suspect' });
  }

  // Filet appliqué UNE fois, après validation : les deux variantes (membres et
  // prospects) partent du même brief_html, la correction vaut donc pour les deux.
  const _dash = stripLongDashes(brief_html);
  if (_dash.count > 0) {
    console.warn(`[DAILY-BRIEF] ✂️ ${_dash.count} tiret(s) long(s) remplacé(s) — la consigne du prompt système n'a pas tenu`);
  } else {
    console.log('[DAILY-BRIEF] ✂️ aucun tiret long à corriger');
  }
  brief_html = _dash.html;

  const onlyUserId = (only_user_id && String(only_user_id).trim()) || null;
  const t0 = Date.now();

  try {
    const supabase = createServiceClient();

    // Sélection des destinataires
    let recipients;
    if (Array.isArray(test_emails) && test_emails.length) {
      // Rodage : envoi ciblé à des adresses de test (source DB par email).
      const { data: u } = await supabase.from('users').select('uuid, email, name').in('email', test_emails);
      recipients = u || test_emails.map(e => ({ email: e, name: null }));
    } else if (onlyUserId) {
      // Test ciblé sur un élève : source DB (dispose de l'uuid pour le filtre).
      recipients = (await fetchEligibleStudents(supabase)).filter(u => u.uuid === onlyUserId);
      if (!recipients.length) {
        return res.status(404).json({ error: `User ${onlyUserId} non trouvé dans les éligibles (student actif, non en pause)`, date });
      }
    } else {
      // PRODUCTION (#20) : source de vérité = tableur Manu (col T prioritaire, fallback U).
      const { recipients: fromTableur, stats } = await getBriefRecipients();
      console.log(`[DAILY-BRIEF] 📋 tableur: rows=${stats.rows} inactifs=${stats.inactifs} no_email=${stats.no_valid_email} dup=${stats.duplicates} → kept=${stats.kept}`);
      recipients = fromTableur;
    }
    console.log(`[DAILY-BRIEF] 👥 ${recipients.length} destinataire(s)`);

    const subject = emailSubject(date_long_fr);

    // ================================================================
    // ENVOI VIA CAMPAGNE BREVO — production uniquement
    // ================================================================
    // Restreint au mode production À DESSEIN : une campagne s'adresse à la LISTE
    // entière (listId 17). L'utiliser avec test_emails ou only_user_id enverrait le
    // brief aux 76 destinataires au lieu de la seule adresse ciblée — exactement
    // l'inverse d'un test. Ces deux modes, et DRY_RUN, restent sur Resend.
    const isProduction = !(Array.isArray(test_emails) && test_emails.length) && !onlyUserId;
    let fallbackReason = null;
    let campaignId = null;

    if (isProduction && !DRY_RUN) {
      try {
        // 1. La liste doit refléter le tableur AU MOMENT de l'envoi, pas la veille.
        const syncReport = await syncList({ recipients, dryRun: false });
        console.log(`[DAILY-BRIEF] 🔄 Sync avant envoi: ${JSON.stringify(syncReport)}`);

        // 2. Création. Tant que campaignId est null, le repli Resend reste autorisé.
        const campaign = await createCampaign({
          name: `Brief T360 — ${date}`,
          subject,
          // Personnalisation déléguée à Brevo : une campagne envoie UN html unique, le
          // prénom ne peut donc pas être injecté côté serveur comme sur Resend.
          // Le filtre `default` couvre les lignes du tableur sans prénom → "Bonjour Trader,".
          // Syntaxe SANS espaces autour de | et : — Brevo documente {{ contact.ATTR|filter }},
          // son langage dérive de Django, dont le parseur rejette les espaces.
          // Ce tag n'existe QUE sur ce chemin : sur le repli Resend il s'afficherait
          // littéralement, faute d'interpréteur.
          htmlContent: wrapBriefHtml({
            firstName: BREVO_FIRSTNAME_TAG,
            dateLongFr: date_long_fr,
            briefHtml: brief_html,
          }),
          listId: syncReport.listId,
        });
        campaignId = campaign.campaignId;
        console.log(`[DAILY-BRIEF] 📣 Campagne ${campaignId} créée ("${campaign.name}")`);

        // 3. Envoi. À partir d'ici, PLUS AUCUN REPLI possible (cf catch).
        await sendCampaignNow(campaignId);
        console.log(`[DAILY-BRIEF] ✅ Campagne ${campaignId} envoyée à la liste ${syncReport.listId}`);

        // 4. PROSPECTS — seulement une fois les membres servis. Isolé dans son propre
        //    try/catch : un échec ici est journalisé et remonté, mais n'interrompt rien
        //    et ne déclenche AUCUN repli. Le repli Resend reste réservé aux membres.
        const prospects = await sendProspectsCampaign({ date, subject, briefHtml: brief_html, dateLongFr: date_long_fr });

        console.log('[DAILY-BRIEF] ========== DONE ==========');
        return res.status(200).json({
          ok: true, date, mode: 'brevo', dry_run: false,
          members: { mode: 'brevo', campaignId, listId: syncReport.listId, recipients: syncReport.after },
          prospects,
          campaignId, listId: syncReport.listId,
          recipients: syncReport.after,
          fallbackReason: null,
          sync: syncReport,
          duration_ms: Date.now() - t0,
        });
      } catch (e) {
        // RÈGLE STRICTE : le repli n'est permis QUE si la campagne n'existe pas.
        // Une campagne créée puis doublée par Resend enverrait DEUX briefs aux 76
        // destinataires. Un échec après création (sendNow KO, timeout) se solde donc
        // par une erreur explicite : l'envoi se déclenche à la main depuis Brevo.
        if (campaignId) {
          console.error(`[DAILY-BRIEF] ❌ Campagne ${campaignId} créée mais NON envoyée:`, e);
          return res.status(500).json({
            ok: false, date, mode: 'brevo', campaignId,
            error: `Campagne ${campaignId} CRÉÉE mais envoi échoué : ${e.message}. ` +
                   `AUCUN repli Resend (risque de double envoi). Déclencher l'envoi à la main ` +
                   `depuis l'interface Brevo, campagne ${campaignId}.`,
            duration_ms: Date.now() - t0,
          });
        }
        // Aucun destinataire exploitable → rien à envoyer, par Brevo comme par Resend.
        if (!recipients.length) {
          console.error('[DAILY-BRIEF] ❌ 0 destinataire, envoi refusé:', e);
          return res.status(500).json({
            ok: false, date, mode: 'brevo', campaignId: null,
            error: `Envoi refusé : 0 destinataire (${e.message}). Aucune campagne créée, aucun repli.`,
            duration_ms: Date.now() - t0,
          });
        }
        // Campagne non créée + destinataires valides → repli Resend, sans risque de doublon.
        fallbackReason = e.message;
        console.warn(`[DAILY-BRIEF] ⚠️ Campagne non créée → repli Resend. Raison: ${e.message}`);
      }
    }

    const results = [];
    let sent = 0, failed = 0;
    for (const u of recipients) {
      if (DRY_RUN) { results.push({ email: u.email, status: 'dry_run' }); continue; }
      const html = wrapBriefHtml({ firstName: firstNameOf(u.name), dateLongFr: date_long_fr, briefHtml: brief_html });
      const r = await sendBriefEmail({ to: u.email, subject, html });
      if (r.success) { sent++; results.push({ email: u.email, status: 'sent', id: r.id }); }
      else { failed++; results.push({ email: u.email, status: 'error', error: r.error }); }
      await new Promise(r => setTimeout(r, 120)); // throttle anti rate-limit
    }

    console.log(`[DAILY-BRIEF] ${date} sent to ${sent} students (${failed} failed)`);
    console.log('[DAILY-BRIEF] ========== DONE ==========');
    return res.status(200).json({
      ok: true,
      date,
      mode: fallbackReason
        ? 'resend_fallback'
        : ((Array.isArray(test_emails) && test_emails.length) ? 'test_emails' : (onlyUserId ? 'test_user' : 'production')),
      dry_run: DRY_RUN,
      campaignId: null,
      // Repli / modes de test : aucune campagne, ni membres ni prospects.
      members: { mode: fallbackReason ? 'resend_fallback' : 'resend', campaignId: null, recipients: recipients.length, fallbackReason },
      prospects: { campaignId: null, sent: false, skipped: fallbackReason ? 'repli Resend réservé aux membres' : 'mode de test — aucune campagne' },
      fallbackReason,
      destinataires: recipients.length,
      recipients: recipients.length,
      sent,
      failed,
      results,
      duration_ms: Date.now() - t0,
    });
  } catch (e) {
    console.error('[DAILY-BRIEF] ❌', e);
    return res.status(500).json({ ok: false, error: e.message });
  }
}
