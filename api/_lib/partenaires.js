// ========================================================================
// CODES PARTENAIRES DES PROP FIRMS : le bloc compact du brief (membres ET prospects).
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

export const REMISES_RELEVEES_LE = '7 novembre 2026';

// Relevés le 07/11/2026 : Apex (Discord, annonce du 05/10 ; -90 % au bandeau du site),
// Topstep (code de parrainage de Manu du 09/10 ; -15 % sur le 1er challenge, Nadir),
// Earn2Trade (annonce du 16/09 ; -50 %, mail affiliés du 31/10 et bandeau du site).
export const PARTENAIRES = [
  { nom: 'Apex Trader Funding', code: 'TRADER360', remise: '-90 %', portee: 'évaluations', url: 'https://apextraderfunding.com/' },
  { nom: 'Topstep', code: 'TS-7EMRN3KBRPXYC', remise: '-15 %', portee: '1er challenge', url: 'https://www.topstep.com/' },
  { nom: 'Earn2Trade', code: 'T360', remise: '-50 %', portee: 'évaluations', url: 'https://www.earn2trade.com/' },
  { nom: 'Tradeify', code: null },
  { nom: 'Lucid Trading', code: null },
  { nom: 'Take Profit Trader', code: null },
];

const P = {
  gold: '#ac862b', goldBright: '#d4af37', textPrimary: '#1a1208',
  textSecondary: '#5a5040', textMuted: '#7a6b50', bgInside: '#fdf8ed', navy: '#000B25',
};
const MONO = "'JetBrains Mono',ui-monospace,Menlo,Consolas,monospace";

// Le bloc. Tables et styles en ligne uniquement : compatibilité Outlook et Gmail,
// aucune feuille de style, aucun flexbox.
export function blocPartenaires() {
  const actifs = PARTENAIRES.filter((p) => p.code);
  const aVenir = PARTENAIRES.filter((p) => !p.code).map((p) => p.nom);
  const lignes = actifs.map((p, i) => `
          <tr>
            <td style="padding:7px 0;${i ? ' border-top:1px solid rgba(212,175,55,0.25);' : ''} font-size:13px; line-height:1.3;">
              <a href="${p.url}" style="color:${P.textPrimary}; text-decoration:none; font-weight:700;">${p.nom}</a><br>
              <span style="font-family:${MONO}; font-weight:700; color:${P.gold};">${p.remise}</span>
              <span style="color:${P.textMuted}; font-size:11px;">${p.portee}</span>
            </td>
            <td align="right" style="padding:7px 0 7px 8px;${i ? ' border-top:1px solid rgba(212,175,55,0.25);' : ''} text-align:right; white-space:nowrap;">
              <span style="display:inline-block; font-family:${MONO}; font-size:12px; font-weight:700; color:${P.navy}; border:1px dashed ${P.goldBright}; border-radius:6px; padding:5px 8px; white-space:nowrap;">${p.code}</span>
            </td>
          </tr>`).join('');
  return `
      <!-- CODES PARTENAIRES : bloc compact, après les actions et avant le pied de page. -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:20px;">
        <tr><td style="background:${P.bgInside}; border:1px solid rgba(212,175,55,0.45); border-radius:10px; padding:12px 16px;">
          <div style="color:${P.gold}; font-size:10px; letter-spacing:0.14em; text-transform:uppercase; font-weight:700; margin-bottom:4px;">Nos codes partenaires</div>
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">${lignes}
          </table>
          <p style="margin:6px 0 0; font-size:11px; line-height:1.5; color:${P.textMuted};">
            Bientôt : ${aVenir.join(', ')}.<br>
            Chaque semaine, une évaluation offerte au membre le plus impliqué.
          </p>
          <p style="margin:6px 0 0; font-size:10px; line-height:1.5; color:${P.textMuted};">
            Réductions relevées le ${REMISES_RELEVEES_LE}, selon les promotions de chaque partenaire. Trader 360 peut percevoir une commission ou un avantage, sans surcoût pour toi. Une évaluation n'est pas un compte financé.
          </p>
        </td></tr>
      </table>`;
}
