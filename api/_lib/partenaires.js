// ========================================================================
// CODES PARTENAIRES DES PROP FIRMS : le bloc du brief (membres ET prospects).
//
// ── ⚠️ CETTE LISTE EXISTE EN DEUX EXEMPLAIRES ──────────────────────────────
// L'autre vit sur le site public : `src/donnees/organisation.ts` (PARTENAIRES et
// REMISES_RELEVEES_LE) du dépôt trader360-site. Les deux dépôts ne partagent aucun
// code, et rien ne préviendra d'une divergence. ⛔ Un code ou une réduction qui
// change se reporte DANS LES DEUX, le même jour.
//
// ── POURQUOI LA DATE EST AFFICHÉE ──────────────────────────────────────────
// Les réductions suivent les promotions des partenaires : celle d'Apex relevée le
// 07/11 se terminait trois jours plus tard. Un pourcentage sans date devient une
// promesse fausse sans que rien ne le signale. Mettre à jour un chiffre, c'est
// mettre à jour la date.
//
// ── POURQUOI UNE TABLE À TROIS LIGNES ET PAS TROIS COLONNES ────────────────
// Sur téléphone, la carte du mail descend vers 340 px : trois colonnes laisseraient
// une centaine de pixels par code, et « TS-7EMRN3KBRPXYC » se couperait sur son
// trait d'union. Un visiteur recopierait « TS- ». Une ligne par partenaire, code à
// droite et insécable, tient à toutes les largeurs.
// ========================================================================

export const REMISES_RELEVEES_LE = '25 novembre 2026';

// Relevés le 07/11/2026 : Apex (Discord, annonce du 05/10 ; -90 % au bandeau du site),
// Topstep (code de parrainage de Manu du 09/10 ; -15 % sur le 1er challenge, Nadir),
// Earn2Trade (annonce du 16/09 ; -50 %, mail affiliés du 31/10 et bandeau du site).
// Ajoutés le 14/11/2026 sur consigne écrite de Nadir : Tradeify et Phidias, code TRADER360.
// Refonte du 25/11/2026 (Manu) : Apex et Tradeify EN HAUT et en gros (`principal`), les
// autres codes en dessous, une ligne courte chacun, sans saut de ligne ; Apex à -80 % (Manu,
// 24/11) ; Phidias résumé en « -50 à -80 % selon le programme » ; Lucid Trading et Take
// Profit Trader retirés (on les ajoutera quand on aura leurs codes) ; phrase « commission »
// retirée (interdite par Manu le 10/10) ; ligne cadeau jusqu'au 15/12 inclus, puis masquée seule.
// ⚠️ Plusieurs réductions par partenaire : `offres` est une LISTE, une ligne par offre.
export const PARTENAIRES = [
  // EN HAUT (Manu, 25/11/2026) : les deux partenaires principaux.
  { nom: 'Apex Trader Funding', code: 'TRADER360', url: 'https://apextraderfunding.com/', principal: true,
    offres: [{ remise: '-80 %', portee: 'évaluations' }] },
  { nom: 'Tradeify', code: 'TRADER360', url: 'https://tradeify.co/', principal: true,
    offres: [{ remise: '-40 %', portee: 'Growth' }, { remise: '-30 %', portee: 'Select et Lightning Funded' }] },
  // EN DESSOUS : les autres codes, une ligne courte chacun.
  { nom: 'Topstep', code: 'TS-7EMRN3KBRPXYC', url: 'https://www.topstep.com/',
    offres: [{ remise: '-15 %', portee: '1er challenge' }] },
  { nom: 'Earn2Trade', code: 'T360', url: 'https://www.earn2trade.com/',
    offres: [{ remise: '-50 %', portee: 'évaluations' }] },
  { nom: 'Phidias', code: 'TRADER360', url: 'https://phidiaspropfirm.com/',
    offres: [{ remise: '-50 à -80 %', portee: 'selon le programme' }] },
];

const P = {
  gold: '#ac862b', goldBright: '#d4af37', textPrimary: '#1a1208',
  textSecondary: '#5a5040', textMuted: '#7a6b50', bgInside: '#fdf8ed', navy: '#000B25',
};
const MONO = "'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace";
const FILET = 'border-top:1px solid rgba(212,175,55,0.25);';

// Le bloc. Tables et styles en ligne uniquement : compatibilité Outlook et Gmail,
// aucune feuille de style, aucun flexbox. Deux colonnes, pas trois : le code reste
// à droite et insécable, les réductions s'empilent à gauche (voir plus haut).
export function blocPartenaires() {
  const actifs = PARTENAIRES.filter((p) => p.code);
  const ligne = (p, grand) => `
          <tr>
            <td valign="top" style="padding:${grand ? '4px 0' : '2px 0'}; font-size:${grand ? '14px' : '12px'}; line-height:1.35;">
              <a href="${p.url}" style="color:${P.textPrimary}; text-decoration:none; font-weight:700;">${p.nom}</a>
              ${grand
                ? p.offres.map((o) => `<br><span style="font-family:${MONO}; font-weight:700; color:${P.gold};">${o.remise}</span> <span style="color:${P.textSecondary}; font-size:12px;">${o.portee}</span>`).join('')
                : p.offres.map((o) => `<span style="color:${P.textSecondary}; font-size:11px;"> (<span style="font-family:${MONO}; font-weight:700; color:${P.gold};">${o.remise}</span> ${o.portee})</span>`).join('')}
            </td>
            <td align="right" valign="top" style="padding:${grand ? '4px 0 4px 8px' : '2px 0 2px 8px'}; text-align:right; white-space:nowrap;">
              <span style="display:inline-block; font-family:${MONO}; font-size:${grand ? '13px' : '11px'}; font-weight:700; color:${P.navy}; border:1px dashed ${P.goldBright}; border-radius:6px; padding:${grand ? '6px 9px' : '1px 6px'}; white-space:nowrap;">${p.code}</span>
            </td>
          </tr>`;
  const principaux = actifs.filter((p) => p.principal).map((p) => ligne(p, true)).join('');
  const autres = actifs.filter((p) => !p.principal).map((p) => ligne(p, false)).join('');
  const lignes = `${principaux}
          <tr><td colspan="2" style="padding:12px 0 4px; border-bottom:1px solid rgba(212,175,55,0.25); font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:${P.textMuted}; font-weight:700;">Autres codes</td></tr>${autres}`;
  return `
      <!-- CODES PARTENAIRES : à la place de l'ancien « mot de la communauté », avant la checklist. -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:24px 0;">
        <tr><td style="background:${P.bgInside}; border:1px solid rgba(212,175,55,0.45); border-radius:10px; padding:14px 16px;">
          <div style="color:${P.gold}; font-size:15px; letter-spacing:0.08em; text-transform:uppercase; font-weight:700; margin-bottom:8px;">Nos codes partenaires</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
          <tr>
            <td style="padding:0 0 6px; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:${P.textMuted}; font-weight:700;">Prop firm et réduction</td>
            <td align="right" style="padding:0 0 6px; text-align:right; font-size:10px; letter-spacing:0.12em; text-transform:uppercase; color:${P.textMuted}; font-weight:700;">Code</td>
          </tr>${lignes}
          </table>
          <p style="margin:8px 0 0; font-size:12px; line-height:1.5; color:${P.textSecondary};">
            Le code se saisit sur la page de paiement, avant de valider. Avant de t'inscrire, lis bien leurs règles sur leur site.
          </p>
          <p style="margin:10px 0 0; font-size:13px; line-height:1.5; color:${P.textPrimary}; font-weight:600;">
            ${new Date() <= new Date('2026-12-15T23:59:59+01:00') ? "🎁&nbsp; Chaque semaine jusqu'au 15 décembre, une évaluation offerte au membre le plus impliqué." : ''}
          </p>
          <p style="margin:6px 0 0; font-size:10px; line-height:1.5; color:${P.textMuted};">
            Réductions relevées le ${REMISES_RELEVEES_LE}, selon les promotions de chaque partenaire. Une évaluation n'est pas un compte financé. Trader 360 ne peut être tenu responsable des règles, décisions, paiements ni changements de conditions des prop firms. Vérifie toujours leurs conditions avant de t'inscrire.
          </p>
        </td></tr>
      </table>`;
}

// Place le bloc DANS le corps du brief, juste avant le titre de la checklist
// pré-séance, là où se trouvait « Le mot de la communauté » (retiré le 14/11/2026,
// Nadir : « un peu bateau », et les codes arrivaient trop bas dans le mail).
// ⚠️ Le corps est rédigé par Claude : on cherche le <h2> dont le TEXTE contient
// « checklist », pas une forme exacte. Sans checklist trouvée, le bloc se place à la
// fin du corps : il ne disparaît jamais en silence, et `place` dit lequel des deux.
export function insererPartenaires(briefHtml) {
  // ⛔ IDEMPOTENT : outils/verifier-archive-brief.mjs relit le corps d'une campagne
  // DÉJÀ envoyée (bloc compris) et le repasse dans wrapBriefHtml. Sans ce garde, le
  // bloc serait posé deux fois et la vérification de l'archive crierait à tort.
  // Repère par le TEXTE et non par le commentaire : un envoi peut retirer les commentaires.
  if (/Nos codes partenaires/.test(briefHtml)) return { html: briefHtml, place: 'deja-present' };
  const bloc = blocPartenaires();
  const re = /<h[23]\b[^>]*>(?:(?!<\/h[23]>)[\s\S])*?checklist[\s\S]*?<\/h[23]>/i;
  const m = re.exec(briefHtml);
  if (m) return { html: briefHtml.slice(0, m.index) + bloc + briefHtml.slice(m.index), place: 'avant-checklist' };
  return { html: briefHtml + bloc, place: 'fin-du-corps' };
}
