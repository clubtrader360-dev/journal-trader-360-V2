/**
 * LES GABARITS DE MAILS SUPABASE (Authentication > Email Templates), AU NOUVEAU LOGO.
 *
 * Un seul habillage pour tous, celui du mail de premiere connexion
 * (api/coach/membres.js) : noir, carte, logo or, bouton or, signature.
 * Usage : node assets/marque/mails-supabase.mjs  -> ecrit mail-supabase-*.html
 *
 * ⚠️ Supabase n envoie pas de piece jointe : le logo est une image distante,
 * servie par le site vitrine, public (pas de protection Vercel) :
 * https://www.trader360.fr/courriel/t360-logo-or.png
 * ⚠️ Les variables {{ .ConfirmationURL }}, {{ .Token }}, {{ .NewEmail }} sont
 * remplacees par Supabase : ne pas les traduire ni les echapper.
 */
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ICI = dirname(fileURLToPath(import.meta.url));
const LOGO = 'https://www.trader360.fr/courriel/t360-logo-or.png';

function gabarit({ surtitre, paragraphes, bouton, apres, pied }) {
  const p = paragraphes.map((t) => `  <p style="margin:0 0 14px">${t}</p>`).join('\n');
  const btn = bouton ? `<tr><td align="center" style="padding:14px 36px 10px">
  <a href="${bouton.lien}" style="display:inline-block;background:#e8b84b;color:#120e07;font-weight:700;font-size:16px;text-decoration:none;padding:15px 30px;border-radius:40px">${bouton.texte}</a>
</td></tr>` : '';
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"></head><body style="margin:0;padding:0;background:#0a0a0d;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#f7f6f3">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0d"><tr><td align="center" style="padding:40px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#111318;border:1px solid #1e2128;border-radius:22px">
<tr><td style="padding:36px 36px 8px;text-align:center">
  <img src="${LOGO}" alt="Trader 360" width="180" style="width:180px;height:auto;display:inline-block;border:0">
</td></tr>
<tr><td style="padding:16px 36px 0;font-size:12.5px;letter-spacing:.22em;text-transform:uppercase;color:#e8b84b;font-weight:700;text-align:center">${surtitre}</td></tr>
<tr><td style="padding:14px 36px 0;font-size:17px;line-height:1.65;color:#f7f6f3">
  <p style="margin:0 0 14px">Bonjour,</p>
${p}
</td></tr>
${btn}
<tr><td style="padding:6px 36px 0;font-size:14px;line-height:1.6;color:#9c9b94;text-align:center">${apres}</td></tr>
<tr><td style="padding:26px 36px 34px;font-size:15px;line-height:1.65;color:#bdbcb6">
  <p style="margin:0">À tout de suite,<br>Nadir et Manu</p>
</td></tr>
</table>
<p style="max-width:560px;margin:18px auto 0;font-size:12px;color:#6f6e68;line-height:1.5">${pied}</p>
</td></tr></table></body></html>
`;
}

const PIED = 'Trader 360 · Le trading comporte un risque de perte en capital. Ce message ne constitue pas un conseil en investissement.';
const UNE_FOIS = "Ce lien est personnel et ne sert qu'une fois.";

export const GABARITS = {
  confirmation: {
    nom: 'Confirm signup', objet: 'Confirme ton adresse Trader 360',
    html: gabarit({
      surtitre: 'Bienvenue',
      paragraphes: ['Ton inscription au journal Trader 360 est presque terminée. Confirme ton adresse email pour activer ton compte.'],
      bouton: { lien: '{{ .ConfirmationURL }}', texte: 'Confirmer mon adresse' },
      apres: `${UNE_FOIS} Si tu ne t'es pas inscrit, ignore ce message.`, pied: PIED,
    }),
  },
  invitation: {
    nom: 'Invite user', objet: 'Ton accès à Trader 360',
    html: gabarit({
      surtitre: 'Ton espace est ouvert',
      paragraphes: ['Un compte Trader 360 a été créé pour toi. Il te donne accès à la formation et au journal de trading.', 'Il te reste une seule chose à faire : choisir ton mot de passe.'],
      bouton: { lien: '{{ .ConfirmationURL }}', texte: 'Choisir mon mot de passe' },
      apres: UNE_FOIS, pied: PIED,
    }),
  },
  lien_magique: {
    nom: 'Magic Link', objet: 'Ton lien de connexion Trader 360',
    html: gabarit({
      surtitre: 'Connexion',
      paragraphes: ['Voici ton lien pour entrer dans ton espace Trader 360, sans mot de passe.'],
      bouton: { lien: '{{ .ConfirmationURL }}', texte: 'Me connecter' },
      apres: `${UNE_FOIS} Si tu n'es pas à l'origine de cette demande, ignore ce message.`, pied: PIED,
    }),
  },
  changement_email: {
    nom: 'Change Email Address', objet: 'Confirme ta nouvelle adresse Trader 360',
    html: gabarit({
      surtitre: 'Nouvelle adresse',
      paragraphes: ['Tu as demandé à remplacer ton adresse Trader 360 par <b style="color:#f7f6f3">{{ .NewEmail }}</b>. Confirme le changement pour qu\'il prenne effet.'],
      bouton: { lien: '{{ .ConfirmationURL }}', texte: 'Confirmer la nouvelle adresse' },
      apres: `${UNE_FOIS} Si tu n'es pas à l'origine de cette demande, ignore ce message : ton adresse reste inchangée.`, pied: PIED,
    }),
  },
  reinitialisation: {
    nom: 'Reset Password', objet: 'Ton mot de passe Trader 360',
    html: gabarit({
      surtitre: 'Ton mot de passe',
      paragraphes: ['Tu as demandé à changer ton mot de passe Trader 360. Clique sur le bouton, choisis-en un nouveau, et tu es de retour dans ton espace.'],
      bouton: { lien: '{{ .ConfirmationURL }}', texte: 'Choisir mon nouveau mot de passe' },
      apres: `${UNE_FOIS} Si tu n'es pas à l'origine de cette demande, ignore ce message : ton mot de passe reste inchangé.`, pied: PIED,
    }),
  },
  reauthentification: {
    nom: 'Reauthentication', objet: 'Ton code de vérification Trader 360',
    html: gabarit({
      surtitre: 'Code de vérification',
      paragraphes: ['Voici ton code pour confirmer cette action :', '<span style="display:inline-block;font-family:\'JetBrains Mono\',Menlo,Consolas,monospace;font-size:28px;letter-spacing:.3em;color:#e8b84b;font-weight:700">{{ .Token }}</span>'],
      bouton: null,
      apres: "Ce code est personnel. Si tu n'es pas à l'origine de cette demande, ignore ce message.", pied: PIED,
    }),
  },
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  for (const [cle, g] of Object.entries(GABARITS)) {
    writeFileSync(join(ICI, `mail-supabase-${cle}.html`), g.html);
    console.log(`mail-supabase-${cle}.html  ·  ${g.nom}  ·  objet : ${g.objet}`);
  }
}
