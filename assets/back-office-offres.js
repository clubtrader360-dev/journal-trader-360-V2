/**
 * VENTES · OFFRES : LES OFFRES DE LA PAGE DE COMMANDE (21/10/2026, maquette validée par Nadir).
 *
 * Ce que l'équipe y fait :
 *   - créer et modifier une offre : nom, type, formation ou tunnel rattaché, ce qui est
 *     inclus, modes de paiement proposés et leurs prix ;
 *   - la mettre en ligne, l'aperçu en brouillon, la mettre hors ligne ;
 *   - gérer les codes de réduction (montant ou pourcentage, offre, modes, date de fin) ;
 *   - ENVOYER LE LIEN de commande après le rendez-vous : l'adresse de l'élève, l'offre,
 *     le lien (avec ou sans code), et le mail part tout seul (demande de Nadir) ;
 *   - suivre les commandes et cocher « Virement reçu ».
 *
 * ⛔ Tout passe par `/api/coach/membres` action `offres`, qui relaie vers le site avec
 * la clé partagée. Ce fichier ne voit jamais la clé ni la base du site.
 * ⚠️ Aucun accès n'est ouvert d'ici (arbitrage du 21/10) : Académie · Membres.
 *
 * Branché par `back-office.js` : `window.OffresCommande.bloc()` rend le HTML de la liste,
 * `window.OffresCommande.apres()` câble l'écran une fois le HTML posé.
 */
(function () {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const txt = (s) => { const d = document.createElement('div'); d.textContent = s == null ? '' : String(s); return d.innerHTML; };
  const eur = (n) => new Intl.NumberFormat('fr-FR', { minimumFractionDigits: Math.round(Number(n) * 100) % 100 ? 2 : 0, maximumFractionDigits: 2 }).format(Number(n || 0)) + ' €';
  const dateFr = (iso, h) => { if (!iso) return '·'; const d = new Date(iso); return d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) + (h ? ` ${d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : ''); };
  const dire = (m, t) => (window.showNotification ? window.showNotification(m, t) : console.log(m));

  async function OF(sous_action, corps) {
    const { data: s } = await window.supabaseClient.auth.getSession();
    const jeton = s?.session?.access_token;
    if (!jeton) throw new Error('Session expirée, reconnecte-toi.');
    const r = await fetch('/api/coach/membres', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jeton}` }, body: JSON.stringify({ action: 'offres', sous_action, ...(corps || {}) }) });
    const c = await r.json().catch(() => ({}));
    // ⛔ `r.ok` ET `c.ok` : un refus arrive en 4xx sans lever.
    if (!r.ok || !c.ok) throw new Error(c.motif || `réponse ${r.status}`);
    return c.resultat;
  }

  const TYPES = { formation: 'Formation', presentiel: 'Présentiel', autre: 'Autre' };
  const STATUTS = { brouillon: ['Brouillon', 'attend'], en_ligne: ['En ligne', 'ok'], hors_ligne: ['Hors ligne', 'non'] };
  const STATUTS_CMD = { attente_virement: ['Virement attendu', 'attend'], attente_paiement: ['Paiement attendu', 'attend'], en_cours: ['Échéances en cours', 'attend'], payee: ['Payée', 'ok'], annulee: ['Annulée', 'non'] };
  let E = { ref: null, d: null, commandes: [], envois: [], edition: null, erreur: null };

  const slugDe = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80);
  const lienApercu = (o) => `${E.ref.site}/commande/${o.slug}?apercu=${o.jeton_apercu}`;
  const nomMode = (k) => ((E.ref && E.ref.modes.find((m) => m.cle === k)) || { nom: k }).nom;
  function resumeModes(o) {
    return E.ref.modes.filter((m) => o.modes?.[m.cle]?.actif).map((m) => {
      const t = Number(o.modes[m.cle].total);
      return m.echeances > 1 ? `${m.nom.replace('Carte bancaire', 'CB')} : ${m.echeances} × ${eur(t / m.echeances)}` : `${m.nom.replace('Carte bancaire', 'CB')} : ${eur(t)}`;
    }).join('<br>');
  }
  function rattachement(o) {
    if (o.type === 'formation') { const f = E.ref.formations.find((x) => x.cle === o.formation_cle); return f ? `Formation ${txt(f.nom)}` : '<span class="bo-erreur">formation à choisir</span>'; }
    const t = E.d.tunnels.find((x) => x.id === o.tunnel_id);
    return t ? `Tunnel « ${txt(t.titre)} »` : '·';
  }
  /** Les codes qui valent pour une offre (toutes offres ou celle-ci), actifs et non expirés. */
  function codesDe(o) {
    const auj = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(new Date());
    return E.d.codes.filter((k) => k.actif && (!k.fin || k.fin >= auj) && (k.offre_id == null || k.offre_id === o.id)
      && (!k.modes || k.modes.some((m) => o.modes?.[m]?.actif)) && !complet(k));
  }
  /** L'état d'un lien envoyé : [libellé, couleur, révocable]. */
  function etatLien(x) {
    if (x.erreur) return ['Mail non parti', 'non', false];
    if (x.utilise_le) return ['Utilisé : commande passée', 'ok', false];
    if (x.revoque_le) return ['Désactivé', 'non', false];
    if (x.expire_le && new Date(x.expire_le) < new Date()) return ['Expiré', 'non', false];
    return [`Valable jusqu au ${new Date(x.expire_le).toLocaleDateString('fr-FR')}`, 'attend', true];
  }
  const valeurCode = (k) => (k.type === 'pourcent' ? `${Number(k.valeur)} %` : eur(k.valeur));
  const places = (k) => (k.max_utilisations ? `${k.utilisations || 0} / ${k.max_utilisations} place${k.max_utilisations > 1 ? 's' : ''}` : `${k.utilisations || 0} utilisation${(k.utilisations || 0) > 1 ? 's' : ''}, sans limite`);
  const complet = (k) => k.max_utilisations != null && (k.utilisations || 0) >= k.max_utilisations;

  /* ══ LE RENDU ═══════════════════════════════════════════════════════════════ */
  async function charger() {
    E.erreur = null;
    try {
      const [ref, d, commandes, envois] = await Promise.all([E.ref || OF('reference'), OF('lister'), OF('commandes'), OF('envois')]);
      Object.assign(E, { ref, d, commandes: commandes || [], envois: envois || [] });
    } catch (e) { E.erreur = e.message; }
  }

  async function bloc() {
    await charger();
    if (E.erreur) return `<div class="bo-carte"><h2>Offres de la page de commande</h2><p class="bo-vide bo-erreur">Lecture impossible : ${txt(E.erreur)}</p></div>`;
    if (E.edition) return editeur(E.edition);
    const offres = E.d.offres;
    const enLigne = offres.filter((o) => o.statut === 'en_ligne');
    const attente = E.commandes.filter((c) => c.statut === 'attente_virement');
    return `
    <div class="bo-carte"><div class="bo-carte__tete"><h2><b>${offres.length}</b> Offre${offres.length > 1 ? 's' : ''} de la page de commande</h2><button type="button" class="bo-btn bo-btn--or" data-of-nouvelle><i class="fas fa-plus"></i> Créer une offre</button></div>
      <div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Offre</th><th>Rattachée à</th><th>Modes et prix</th><th>Codes</th><th class="num">Commandes</th><th>État</th><th></th></tr></thead><tbody>
      ${offres.map((o) => { const [st, c] = STATUTS[o.statut] || [o.statut, 'attend']; const k = codesDe(o);
        return `<tr><td><b>${txt(o.nom)}</b><br><small class="of-pale">${txt(TYPES[o.type] || o.type)} · ${o.acces === 'public' ? 'page publique' : 'sur invitation'} · /commande/${txt(o.slug)}</small></td><td>${rattachement(o)}</td><td class="of-mono">${resumeModes(o) || '<span class="bo-erreur">aucun mode</span>'}</td>
          <td>${k.length ? k.map((x) => `<span class="bo-pill bo-pill--ok">${txt(x.code)} · moins ${txt(valeurCode(x))}</span>`).join(' ') : '·'}</td><td class="num">${o.commandes}</td>
          <td><span class="bo-pill bo-pill--${c}">${st}</span>${o.problemes.length ? `<br><small class="bo-erreur">${txt(o.problemes.join(', '))}</small>` : ''}</td>
          <td class="of-actions"><button type="button" class="bo-btn bo-btn--fantome" data-of-modifier="${o.id}">Modifier</button><a class="bo-btn bo-btn--fantome" href="${txt(lienApercu(o))}" target="_blank" rel="noopener" title="Aperçu de l équipe : l élève, lui, n ouvre la page qu avec son lien personnel">Aperçu</a></td></tr>`; }).join('') || '<tr><td colspan="7" class="bo-vide">Aucune offre.</td></tr>'}
      </tbody></table></div></div>

    <div class="of-grille">
      <div class="bo-carte"><h2>Envoyer la page de commande</h2>
        ${enLigne.length ? `<p class="bo-source" style="margin-top:0">Après le rendez-vous : l'adresse de l'élève, l'offre, le lien. Le mail « Bienvenue dans le club Trader 360 » part tout seul, avec le bouton vers la page.</p>
        <div class="of-champs">
          <label class="bo-tun-champ"><span>E-mail de l'élève</span><input type="email" data-of-env-email placeholder="eleve@exemple.fr" inputmode="email"></label>
          <label class="bo-tun-champ"><span>Prénom <small class="of-pale">(facultatif)</small></span><input data-of-env-prenom placeholder="pour « Salut … »"></label>
          <label class="bo-tun-champ"><span>Lien valable</span><select data-of-env-jours><option value="3">3 jours</option><option value="7" selected>7 jours</option><option value="15">15 jours</option><option value="30">30 jours</option></select></label>
          <label class="bo-tun-champ"><span>Offre</span><select data-of-env-offre>${enLigne.map((o) => `<option value="${o.id}">${txt(o.nom)}</option>`).join('')}</select></label>
        </div>
        <fieldset class="of-liens" data-of-env-liens></fieldset>
        <button type="button" class="bo-btn bo-btn--or" data-of-envoyer><i class="fas fa-paper-plane"></i> Envoyer le mail</button>`
        : '<p class="bo-vide">Aucune offre en ligne : mets une offre en ligne pour pouvoir envoyer son lien.</p>'}
        ${E.envois.length ? `<h3 class="of-sous">Liens envoyés</h3><div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Élève</th><th>Offre</th><th>Envoyé</th><th>État du lien</th><th></th></tr></thead><tbody>${E.envois.slice(0, 15).map((x) => { const e = etatLien(x);
          return `<tr><td>${txt(x.email)}</td><td>${txt((offres.find((o) => o.id === x.offre_id) || {}).nom || '·')}${x.code ? `<br><small class="of-pale">code ${txt(x.code)}</small>` : ''}</td><td>${txt(dateFr(x.created_at, true))}</td><td><span class="bo-pill bo-pill--${e[1]}" ${x.erreur ? `title="${txt(x.erreur)}"` : ''}>${e[0]}</span></td><td>${e[2] ? `<button type="button" class="bo-btn bo-btn--fantome" data-of-revoquer="${x.id}" title="Le lien ne pourra plus servir">Désactiver</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>` : ''}
      </div>

      <div class="bo-carte"><div class="bo-carte__tete"><h2>Codes de réduction</h2></div>
        <div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Code</th><th>Réduction</th><th>Offre</th><th>Modes</th><th>Jusqu'au</th><th>Places</th><th>Actif</th><th></th></tr></thead><tbody>
        ${E.d.codes.map((k) => `<tr><td class="of-mono"><b>${txt(k.code)}</b></td><td class="of-mono">moins ${txt(valeurCode(k))}</td><td>${k.offre_id ? txt((offres.find((o) => o.id === k.offre_id) || {}).nom || '?') : 'Toutes'}</td><td>${k.modes ? k.modes.map(nomMode).map(txt).join(', ') : 'Tous'}</td><td>${k.fin ? txt(new Date(k.fin + 'T12:00:00Z').toLocaleDateString('fr-FR')) : '·'}</td><td class="of-mono">${txt(places(k))}${complet(k) ? '<br><span class="bo-pill bo-pill--non">Complet</span>' : ''}</td>
          <td><label class="am-switch"><input type="checkbox" data-of-code-actif="${k.id}" ${k.actif ? 'checked' : ''}><i></i></label></td><td><button type="button" class="bo-btn bo-btn--fantome" data-of-code-suppr="${k.id}" title="Supprimer (désactivé seulement s'il a déjà servi)">Supprimer</button></td></tr>`).join('') || '<tr><td colspan="8" class="bo-vide">Aucun code.</td></tr>'}
        </tbody></table></div>
        <h3 class="of-sous">Nouveau code</h3>
        <div class="of-champs">
          <label class="bo-tun-champ"><span>Code</span><input data-of-k-code placeholder="REC360" maxlength="30" style="text-transform:uppercase"></label>
          <label class="bo-tun-champ"><span>Réduction</span><span class="of-ligne"><input type="number" min="1" step="0.01" data-of-k-valeur placeholder="500"><select data-of-k-type><option value="montant">€</option><option value="pourcent">%</option></select></span></label>
          <label class="bo-tun-champ"><span>Offre</span><select data-of-k-offre><option value="">Toutes les offres</option>${offres.map((o) => `<option value="${o.id}">${txt(o.nom)}</option>`).join('')}</select></label>
          <label class="bo-tun-champ"><span>Jusqu'au <small class="of-pale">(facultatif)</small></span><input type="date" data-of-k-fin></label>
          <label class="bo-tun-champ"><span>Nombre de places <small class="of-pale">(vide = illimité)</small></span><input type="number" min="1" step="1" data-of-k-places placeholder="10"></label>
          <div class="bo-tun-champ of-large"><span>Modes concernés <small class="of-pale">(aucun coché = tous)</small></span><span class="of-ligne">${E.ref.modes.map((m) => `<label class="of-coche"><input type="checkbox" data-of-k-mode value="${m.cle}"> ${txt(m.nom)}</label>`).join('')}</span></div>
        </div>
        <button type="button" class="bo-btn bo-btn--fantome" data-of-k-creer><i class="fas fa-plus"></i> Créer le code</button>
      </div>
    </div>

    <div class="bo-carte"><div class="bo-carte__tete"><h2>Commandes ${attente.length ? `<span class="bo-pill bo-pill--attend">${attente.length} virement${attente.length > 1 ? 's' : ''} attendu${attente.length > 1 ? 's' : ''}</span>` : ''}</h2></div>
      ${E.commandes.length ? `<div class="bo-enveloppe"><table class="bo-table"><thead><tr><th>Référence</th><th>Date</th><th>Client</th><th>Offre</th><th>Mode</th><th class="num">Total</th><th>État</th><th></th></tr></thead><tbody>
      ${E.commandes.map((c) => { const [st, cl] = STATUTS_CMD[c.statut] || [c.statut, 'attend'];
        return `<tr><td class="of-mono"><b>${txt(c.reference)}</b></td><td>${txt(dateFr(c.created_at, true))}</td><td>${txt(c.prenom)} ${txt(c.nom)}<br><small class="of-pale">${txt(c.email)}${c.telephone ? ` · ${txt(c.telephone)}` : ''}</small></td><td>${txt(c.offre_nom)}</td><td>${txt(nomMode(c.mode))}${c.code ? `<br><small class="of-pale">code ${txt(c.code)}</small>` : ''}</td>
          <td class="num of-mono"><b>${eur(c.total)}</b>${c.echeances > 1 ? `<br><small class="of-pale">${c.paiements_recus} / ${c.echeances} échéances</small>` : ''}</td><td><span class="bo-pill bo-pill--${cl}">${st}</span>${c.mail_erreur ? '<br><small class="bo-erreur">bon de commande non parti</small>' : ''}</td>
          <td class="of-actions">${c.statut === 'attente_virement' ? `<button type="button" class="bo-btn bo-btn--or" data-of-recu="${c.id}">Virement reçu</button><button type="button" class="bo-btn bo-btn--fantome" data-of-annuler="${c.id}">Annuler</button>` : ''}</td></tr>`; }).join('')}
      </tbody></table></div>` : '<p class="bo-vide">Aucune commande pour l instant.</p>'}
      <p class="bo-source">« Virement reçu » passe la commande en payée. Les accès s'ouvrent ensuite à la main dans Académie · Membres.</p>
    </div>
    <h2 class="of-titre-hist">Historique LearnyBox</h2>`;
  }

  function editeur(o) {
    const neuve = !o.id;
    const tunnels = E.d.tunnels;
    const modes = E.ref.modes.map((m) => { const v = (o.modes && o.modes[m.cle]) || { actif: false, total: '' };
      return `<div class="of-mode"><label class="am-switch"><input type="checkbox" data-of-mode-actif="${m.cle}" ${v.actif ? 'checked' : ''}><i></i></label><span><b>${txt(m.nom)}</b><small class="of-pale">${txt(m.aide)}</small></span>
        <input type="number" min="1" step="0.01" class="of-prix" data-of-mode-total="${m.cle}" value="${v.total === '' ? '' : Number(v.total)}" placeholder="total"><span class="of-pale of-mono" data-of-mode-detail="${m.cle}"></span></div>`; }).join('');
    const [st] = STATUTS[o.statut || 'brouillon'];
    return `<div class="am-fiche__tete"><button type="button" class="bo-btn bo-btn--fantome" data-of-retour>&larr; Retour aux offres</button><span class="am-fiche__fil">Ventes · Offre · ${neuve ? 'nouvelle' : txt(st)}</span></div>
    <div class="of-grille">
      <div class="bo-carte"><h2>${neuve ? 'Nouvelle offre' : txt(o.nom)}</h2>
        <div class="of-champs">
          <label class="bo-tun-champ of-large"><span>Nom affiché à l'élève</span><input data-of-nom value="${txt(o.nom || '')}" maxlength="200" placeholder="Formation Trader 360"></label>
          <label class="bo-tun-champ of-large"><span>Adresse de la page</span><span class="of-ligne"><span class="of-pale">${txt(E.ref.site)}/commande/</span><input data-of-slug value="${txt(o.slug || '')}" placeholder="formation" ${neuve ? '' : 'data-touche="1"'}></span></label>
          <label class="bo-tun-champ of-large"><span>Accès à la page</span><select data-of-acces><option value="invitation" ${o.acces !== 'public' ? 'selected' : ''}>Sur invitation : lien personnel, une seule commande, envoyé depuis cet écran</option><option value="public" ${o.acces === 'public' ? 'selected' : ''}>Publique : page ouverte à tous (offre liée à un tunnel, présentiel…)</option></select></label>
          <label class="bo-tun-champ"><span>Type</span><select data-of-type>${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${o.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
          <label class="bo-tun-champ" data-of-bloc-formation><span>Formation</span><select data-of-formation>${E.ref.formations.map((f) => `<option value="${f.cle}" ${o.formation_cle === f.cle ? 'selected' : ''}>${txt(f.nom)}</option>`).join('')}</select></label>
          <label class="bo-tun-champ of-large"><span>Tunnel de vente lié <small class="of-pale">(bouton « Je m'inscris et je paie » sur sa page, seulement si l offre est publique)</small></span><select data-of-tunnel><option value="">Aucun</option>${tunnels.map((t) => `<option value="${t.id}" ${o.tunnel_id === t.id ? 'selected' : ''}>${txt(t.titre)} (${txt(t.type)}, ${t.statut === 'publie' ? 'publié' : txt(t.statut)})</option>`).join('')}</select></label>
          <label class="bo-tun-champ of-large"><span>Ce qui est inclus <small class="of-pale">(une ligne par point, affiché dans le récapitulatif)</small></span><textarea rows="4" data-of-inclus>${txt((o.inclus || []).join('\n'))}</textarea></label>
        </div>
        <h3 class="of-sous">Modes de paiement proposés</h3>
        <p class="bo-source" style="margin-top:0">Le prix est le TOTAL payé par l'élève dans ce mode. En plusieurs fois, l'échéance se calcule toute seule.</p>
        ${modes}
        <div class="of-actions" style="margin-top:16px">
          <button type="button" class="bo-btn bo-btn--or" data-of-enregistrer>Enregistrer</button>
          ${neuve ? '' : `<a class="bo-btn bo-btn--fantome" href="${txt(lienApercu(o))}" target="_blank" rel="noopener" title="Aperçu de l équipe : l élève, lui, n ouvre la page qu avec son lien personnel">Aperçu</a>`}
          ${neuve ? '' : o.statut === 'en_ligne' ? `<button type="button" class="bo-btn bo-btn--fantome" data-of-statut="hors_ligne">Mettre hors ligne</button>` : `<button type="button" class="bo-btn bo-btn--fantome" data-of-statut="en_ligne">Mettre en ligne</button>`}
          ${neuve || o.statut === 'en_ligne' ? '' : '<button type="button" class="bo-btn bo-btn--fantome" data-of-supprimer>Supprimer</button>'}
        </div>
      </div>
      <div class="bo-carte"><h2>Codes qui s'appliquent</h2>${neuve ? '<p class="bo-vide">Enregistre l offre pour lui rattacher des codes.</p>' : (codesDe(o).map((k) => `<p><span class="bo-pill bo-pill--ok">${txt(k.code)}</span> moins ${txt(valeurCode(k))}${k.modes ? ` · ${k.modes.map(nomMode).map(txt).join(', ')}` : ''}${k.fin ? ` · jusqu au ${txt(new Date(k.fin + 'T12:00:00Z').toLocaleDateString('fr-FR'))}` : ''}</p>`).join('') || '<p class="bo-vide">Aucun code actif pour cette offre.</p>')}
        <p class="bo-source">Les codes se créent dans la liste des offres, carte « Codes de réduction ».</p></div>
    </div>`;
  }

  /* ══ LE CÂBLAGE ═════════════════════════════════════════════════════════════ */
  function majDetails() {
    document.querySelectorAll('[data-of-mode-total]').forEach((i) => {
      const m = E.ref.modes.find((x) => x.cle === i.dataset.ofModeTotal);
      const t = Number(i.value);
      const el = document.querySelector(`[data-of-mode-detail="${m.cle}"]`);
      if (el) el.textContent = t > 0 && m.echeances > 1 ? `= ${m.echeances} × ${eur(Math.floor((t * 100) / m.echeances) / 100)}` : '';
    });
    const type = document.querySelector('[data-of-type]');
    const f = document.querySelector('[data-of-bloc-formation]');
    // ⛔ Pas `hidden` : `.bo-tun-champ` pose un `display` d auteur qui l emporte sur
    // l attribut (regle du depot, quatre fois rencontree). Masquer = `!important`.
    if (type && f) { if (type.value === 'formation') f.style.removeProperty('display'); else f.style.setProperty('display', 'none', 'important'); }
  }
  function majLiens() {
    const z = document.querySelector('[data-of-env-liens]');
    const sel = document.querySelector('[data-of-env-offre]');
    if (!z || !sel) return;
    const o = E.d.offres.find((x) => String(x.id) === sel.value);
    if (!o) return;
    const k = codesDe(o);
    z.innerHTML = `<legend>Lien envoyé</legend>
      <label class="of-coche"><input type="radio" name="of-lien" value="" checked> Lien personnel, prix normal</label>
      ${k.map((x) => `<label class="of-coche"><input type="radio" name="of-lien" value="${txt(x.code)}"> Lien personnel avec le code ${txt(x.code)} déjà appliqué <small class="of-pale">moins ${txt(valeurCode(x))} · ${txt(places(x))}</small></label>`).join('')}`;
  }
  function apres() {
    majDetails();
    majLiens();
  }
  function lireEditeur() {
    const v = (s) => (document.querySelector(s) || {}).value || '';
    const modes = {};
    E.ref.modes.forEach((m) => { modes[m.cle] = { actif: !!(document.querySelector(`[data-of-mode-actif="${m.cle}"]`) || {}).checked, total: Number(v(`[data-of-mode-total="${m.cle}"]`)) || 0 }; });
    return { id: E.edition.id || null, nom: v('[data-of-nom]'), slug: v('[data-of-slug]'), type: v('[data-of-type]'), acces: v('[data-of-acces]') || 'invitation', formation_cle: v('[data-of-formation]'), tunnel_id: v('[data-of-tunnel]') || null, inclus: v('[data-of-inclus]'), modes };
  }
  async function rafraichir() {
    const z = $('boOffresCommande');
    if (!z) return;
    z.innerHTML = await bloc();
    apres();
    const hist = document.getElementById('boOffresHistorique');
    if (hist) { if (E.edition) hist.style.setProperty('display', 'none', 'important'); else hist.style.removeProperty('display'); }
  }

  document.addEventListener('input', (e) => {
    if (e.target.matches('[data-of-mode-total]')) majDetails();
    if (e.target.matches('[data-of-nom]')) { const s = document.querySelector('[data-of-slug]'); if (s && !s.dataset.touche) s.value = slugDe(e.target.value); }
    if (e.target.matches('[data-of-slug]')) e.target.dataset.touche = '1';
  });
  document.addEventListener('change', async (e) => {
    const t = e.target;
    if (t.matches('[data-of-type]')) majDetails();
    if (t.matches('[data-of-env-offre]')) majLiens();
    if (t.matches('[data-of-code-actif]')) {
      const k = E.d.codes.find((x) => String(x.id) === t.dataset.ofCodeActif);
      try { await OF('code_enregistrer', { ...k, actif: t.checked }); dire(`Code ${k.code} ${t.checked ? 'activé' : 'désactivé'}.`); } catch (er) { t.checked = !t.checked; dire(er.message, 'error'); }
    }
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-of-nouvelle],[data-of-modifier],[data-of-retour],[data-of-enregistrer],[data-of-statut],[data-of-supprimer],[data-of-envoyer],[data-of-k-creer],[data-of-code-suppr],[data-of-recu],[data-of-annuler],[data-of-revoquer]');
    if (!b) return;
    try {
      if (b.matches('[data-of-nouvelle]')) { E.edition = { type: 'formation', formation_cle: 'trader360', inclus: [], modes: {} }; return rafraichir(); }
      if (b.matches('[data-of-modifier]')) { E.edition = E.d.offres.find((o) => String(o.id) === b.dataset.ofModifier); return rafraichir(); }
      if (b.matches('[data-of-retour]')) { E.edition = null; return rafraichir(); }
      if (b.matches('[data-of-enregistrer]')) {
        b.disabled = true;
        const r = await OF('enregistrer', lireEditeur());
        dire(`Offre « ${r.nom} » enregistrée.`);
        await charger(); E.edition = E.d.offres.find((o) => o.id === r.id) || null; return rafraichir();
      }
      if (b.matches('[data-of-statut]')) {
        const statut = b.dataset.ofStatut;
        if (statut === 'en_ligne' && !window.confirm(`Mettre « ${E.edition.nom} » en ligne ? Sa page de commande devient accessible à toute personne qui a le lien.`)) return;
        b.disabled = true;
        await OF('statut', { id: E.edition.id, statut });
        dire(statut === 'en_ligne' ? 'Offre en ligne.' : 'Offre hors ligne : sa page n est plus accessible.');
        await charger(); E.edition = E.d.offres.find((o) => o.id === E.edition.id) || null; return rafraichir();
      }
      if (b.matches('[data-of-supprimer]')) {
        if (!window.confirm(`Supprimer définitivement l'offre « ${E.edition.nom} » ? Impossible si elle a des commandes.`)) return;
        await OF('supprimer', { id: E.edition.id });
        dire('Offre supprimée.'); E.edition = null; return rafraichir();
      }
      if (b.matches('[data-of-envoyer]')) {
        const email = document.querySelector('[data-of-env-email]').value.trim();
        const prenom = document.querySelector('[data-of-env-prenom]').value.trim();
        const offre_id = Number(document.querySelector('[data-of-env-offre]').value);
        const code = (document.querySelector('input[name="of-lien"]:checked') || {}).value || null;
        const jours = Number((document.querySelector('[data-of-env-jours]') || {}).value || 7);
        const o = E.d.offres.find((x) => x.id === offre_id);
        if (!email) { dire('L adresse de l élève est nécessaire.', 'error'); return; }
        if (!window.confirm(`Envoyer à ${email} son lien personnel de commande « ${o.nom} »${code ? ` avec le code ${code}` : ''} ?\n\nLe lien ne sert qu à cette adresse, une seule fois, pendant ${jours} jours.`)) return;
        b.disabled = true;
        await OF('envoyer_lien', { email, prenom, offre_id, code, jours });
        dire(`Mail parti à ${email}.`);
        return rafraichir();
      }
      if (b.matches('[data-of-k-creer]')) {
        const v = (s) => (document.querySelector(s) || {}).value || '';
        const modes = [...document.querySelectorAll('[data-of-k-mode]:checked')].map((i) => i.value);
        b.disabled = true;
        const r = await OF('code_enregistrer', { code: v('[data-of-k-code]'), valeur: v('[data-of-k-valeur]'), type: v('[data-of-k-type]'), offre_id: v('[data-of-k-offre]') || null, fin: v('[data-of-k-fin]') || null, max_utilisations: v('[data-of-k-places]') || null, modes, actif: true });
        dire(`Code ${r.code} créé.`);
        return rafraichir();
      }
      if (b.matches('[data-of-code-suppr]')) {
        const k = E.d.codes.find((x) => String(x.id) === b.dataset.ofCodeSuppr);
        if (!window.confirm(`Supprimer le code ${k.code} ? S'il a déjà servi, il est seulement désactivé.`)) return;
        const r = await OF('code_supprimer', { id: k.id });
        dire(r.desactive ? `${k.code} a déjà servi : désactivé.` : `${k.code} supprimé.`);
        return rafraichir();
      }
      if (b.matches('[data-of-recu]')) {
        const c = E.commandes.find((x) => String(x.id) === b.dataset.ofRecu);
        if (!window.confirm(`Virement de ${eur(c.total)} reçu pour ${c.reference} (${c.prenom} ${c.nom}) ?\n\nLa commande passe en payée. Pense ensuite à ouvrir ses accès dans Académie · Membres.`)) return;
        b.disabled = true;
        await OF('virement_recu', { id: c.id });
        dire(`${c.reference} payée. Ouvre ses accès dans Académie · Membres.`);
        return rafraichir();
      }
      if (b.matches('[data-of-revoquer]')) {
        const x = E.envois.find((y) => String(y.id) === b.dataset.ofRevoquer);
        if (!window.confirm(`Désactiver le lien envoyé à ${x.email} ? Il ne pourra plus servir ; tu pourras lui en renvoyer un nouveau.`)) return;
        await OF('revoquer_lien', { id: x.id });
        dire('Lien désactivé.');
        return rafraichir();
      }
      if (b.matches('[data-of-annuler]')) {
        const c = E.commandes.find((x) => String(x.id) === b.dataset.ofAnnuler);
        if (!window.confirm(`Annuler la commande ${c.reference} ?`)) return;
        await OF('annuler', { id: c.id });
        dire(`${c.reference} annulée.`);
        return rafraichir();
      }
    } catch (er) {
      dire(er.message, 'error');
      b.disabled = false;
    }
  });

  /** Ouvre l éditeur (null = retour à la liste). Utilisé par les clics et par le banc. */
  function editer(o) { E.edition = o; }
  window.OffresCommande = { bloc, apres, rafraichir, editer };
})();
