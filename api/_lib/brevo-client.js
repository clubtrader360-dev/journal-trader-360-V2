// ========================================
// Client minimal API Brevo v3 — synchronisation de la liste du brief quotidien.
//
// Périmètre STRICT : gérer UNE liste dédiée, alimentée depuis le tableur.
//   - Ne touche à AUCUNE liste existante (MEMBRES T360 id 7, PROSPECTS id 6, etc.) :
//     elles sont alimentées par les scripts de Manu.
//   - Ne SUPPRIME jamais un contact de Brevo (pas de DELETE /v3/contacts) : un contact
//     retiré de notre liste peut appartenir aux listes de Manu. On le retire de la
//     nôtre, rien de plus.
//
// Deux listes gérées, aux régimes OPPOSÉS :
//   - LIST_NAME (membres)          : synchronisée depuis le tableur par syncList()
//   - PROSPECTS_LIST_NAME          : alimentée À LA MAIN, JAMAIS synchronisée
// ========================================

const BREVO_BASE = 'https://api.brevo.com/v3';

// Liste dédiée. Le suffixe "(auto)" signale à Manu qu'elle est gérée par le code
// et qu'elle ne doit pas être éditée à la main : toute modif manuelle serait
// écrasée au prochain sync.
export const LIST_NAME = 'BRIEF QUOTIDIEN T360 (auto)';

// Liste prospects. PAS de suffixe "(auto)" À DESSEIN : contrairement à la liste
// membres, elle est alimentée À LA MAIN dans l'interface Brevo et n'est JAMAIS
// synchronisée. Lui appliquer syncList() la viderait pour la conformer au tableur,
// qui ne contient que des élèves.
export const PROSPECTS_LIST_NAME = 'BRIEF PROSPECTS T360';

const LIST_FOLDER_ID = 1;

// Attribut portant le statut col D du tableur, pour permettre la segmentation plus tard.
const STATUT_ATTR = 'STATUT_T360';

// Bornes API Brevo.
const LIST_PAGE_LIMIT = 50;     // GET /contacts/lists
const CONTACTS_PAGE_LIMIT = 500; // GET /contacts/lists/{id}/contacts (max autorisé)
const REMOVE_BATCH = 150;        // POST .../contacts/remove

function apiKey() {
  const key = process.env.BREVO_API_KEY;
  if (!key || !key.trim()) {
    // Message explicite plutôt qu'un 401 opaque plus loin dans la chaîne.
    throw new Error('BREVO_API_KEY manquante (config Vercel : Production + Preview + Development).');
  }
  return key.trim();
}

// Appel HTTP Brevo. Retourne { status, body }. Ne jette PAS sur statut non-2xx :
// certains appels ont des non-2xx légitimes (attribut déjà existant), l'appelant tranche.
async function brevo(path, { method = 'GET', body } = {}) {
  const res = await fetch(`${BREVO_BASE}${path}`, {
    method,
    headers: {
      'api-key': apiKey(),
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  let parsed = null;
  if (text) { try { parsed = JSON.parse(text); } catch { parsed = { raw: text }; } }
  return { status: res.status, body: parsed };
}

// Erreur enrichie du contexte HTTP — sans quoi un échec partiel d'import est illisible.
function fail(action, status, body) {
  const detail = body && (body.message || body.code || body.raw)
    ? ` — ${body.message || body.code || body.raw}`
    : '';
  throw new Error(`Brevo ${action} a échoué (HTTP ${status})${detail}`);
}

// L'attribut STATUT_T360 existe-t-il déjà ? Lecture de l'état réel, pas d'inférence.
async function attributeExists() {
  const { status, body } = await brevo('/contacts/attributes');
  if (status < 200 || status >= 300) fail('lecture des attributs', status, body);
  const attrs = (body && body.attributes) || [];
  // Brevo normalise les noms en majuscules ; comparaison insensible à la casse par sûreté.
  return attrs.some(a => a && String(a.name).toUpperCase() === STATUT_ATTR.toUpperCase());
}

// ---- Attribut STATUT_T360 : créé s'il n'existe pas. Idempotent. ----
// Check-then-act, par symétrie avec ensureList(). La version précédente déduisait
// l'existence du LIBELLÉ d'erreur du POST ("already exists") ; Brevo répond en réalité
// "Attribute name must be unique", donc tout appel après le premier échouait en 500 et
// bloquait la synchro entière — ensureAttribute() étant la 1re étape de syncList().
// On ne se fie plus à une chaîne que Brevo peut reformuler à tout moment.
export async function ensureAttribute() {
  if (await attributeExists()) return { attribute: STATUT_ATTR, created: false };

  const { status, body } = await brevo(`/contacts/attributes/normal/${STATUT_ATTR}`, {
    method: 'POST',
    body: { type: 'text' },
  });
  if (status >= 200 && status < 300) return { attribute: STATUT_ATTR, created: true };

  // Filet de sécurité : entre le GET et le POST, une exécution concurrente a pu créer
  // l'attribut. On relit l'état réel plutôt que d'interpréter le message d'erreur.
  if (await attributeExists()) return { attribute: STATUT_ATTR, created: false };

  // Absent malgré le GET de contrôle → échec authentique, on propage.
  fail(`création de l'attribut ${STATUT_ATTR}`, status, body);
}

// ---- Liste dédiée : recherchée par nom EXACT, créée si absente. Idempotent. ----
// `listName` par défaut = liste membres, pour ne rien changer aux appels existants.
export async function ensureList(listName = LIST_NAME) {
  let offset = 0;
  // La réponse est paginée : sans pagination on manquerait la liste au-delà de la
  // 1re page et on en recréerait une en double à chaque sync.
  for (;;) {
    const { status, body } = await brevo(`/contacts/lists?limit=${LIST_PAGE_LIMIT}&offset=${offset}`);
    if (status < 200 || status >= 300) fail('lecture des listes', status, body);

    const lists = (body && body.lists) || [];
    const match = lists.find(l => l && l.name === listName);
    if (match) return { listId: match.id, listName: match.name, created: false };

    offset += LIST_PAGE_LIMIT;
    const total = (body && typeof body.count === 'number') ? body.count : 0;
    if (lists.length === 0 || offset >= total) break;
  }

  const { status, body } = await brevo('/contacts/lists', {
    method: 'POST',
    body: { name: listName, folderId: LIST_FOLDER_ID },
  });
  if (status < 200 || status >= 300) fail(`création de la liste "${listName}"`, status, body);
  return { listId: body.id, listName, created: true };
}

// ---- Tous les emails de la liste (paginé), en minuscules. ----
export async function getListContacts(listId) {
  const emails = new Set();
  let offset = 0;
  for (;;) {
    const { status, body } = await brevo(
      `/contacts/lists/${listId}/contacts?limit=${CONTACTS_PAGE_LIMIT}&offset=${offset}`
    );
    if (status < 200 || status >= 300) fail(`lecture des contacts de la liste ${listId}`, status, body);

    const contacts = (body && body.contacts) || [];
    for (const c of contacts) {
      if (c && c.email) emails.add(String(c.email).trim().toLowerCase());
    }
    if (contacts.length < CONTACTS_PAGE_LIMIT) break;
    offset += CONTACTS_PAGE_LIMIT;
  }
  return emails;
}

// ---- Campagne email ----
// Expéditeur : id 2 = contact@trader360.fr (validé côté Brevo). L'adresse actuelle
// noreply@mail.journaltrader360.fr n'y est PAS validée, et une adresse joignable
// passe mieux les filtres.
const SENDER_ID = 2;

// Crée la campagne et retourne son id. AUCUNE logique basée sur un libellé d'erreur :
// on ne juge que le statut HTTP et la présence effective du champ `id`.
// Un nom déjà pris fait échouer la création → une seule nouvelle tentative avec un nom
// horodaté, sans chercher à savoir POURQUOI le premier a échoué.
export async function createCampaign({ name, subject, htmlContent, listId }) {
  const payload = (campaignName) => ({
    name: campaignName,
    subject,
    sender: { id: SENDER_ID },
    type: 'classic',
    htmlContent,
    recipients: { listIds: [listId] },
  });

  let attempt = await brevo('/emailCampaigns', { method: 'POST', body: payload(name) });

  // Retry sur nom horodaté. Déclenché par le STATUT, pas par le message.
  if (attempt.status < 200 || attempt.status >= 300 || !attempt.body || !attempt.body.id) {
    const stamped = `${name} (${new Date().toISOString().slice(11, 19).replace(/:/g, 'h')})`;
    attempt = await brevo('/emailCampaigns', { method: 'POST', body: payload(stamped) });
    if (attempt.status >= 200 && attempt.status < 300 && attempt.body && attempt.body.id) {
      return { campaignId: attempt.body.id, name: stamped };
    }
    fail('création de la campagne', attempt.status, attempt.body);
  }
  return { campaignId: attempt.body.id, name };
}

// Déclenche l'envoi. 204 attendu ; tout non-2xx lève.
export async function sendCampaignNow(campaignId) {
  const { status, body } = await brevo(`/emailCampaigns/${campaignId}/sendNow`, { method: 'POST' });
  if (status < 200 || status >= 300) fail(`envoi de la campagne ${campaignId}`, status, body);
  return { campaignId, sent: true };
}

// ---- Synchronisation de la liste sur le tableur ----
// recipients : sortie de getBriefRecipients() → [{ email, prenom, nom, statut, name }]
export async function syncList({ recipients, dryRun = false }) {
  const startedAt = Date.now();

  // GARDE CRITIQUE — une panne transitoire de l'API Sheets renvoie une liste vide.
  // Sans ce garde, le diff conclurait « tout retirer » et purgerait la liste Brevo.
  // On refuse la synchro plutôt que de propager une lecture dégradée.
  if (!Array.isArray(recipients) || recipients.length === 0) {
    throw new Error(
      'Synchro refusée : 0 destinataire en entrée. Un tableur vide ou une lecture Sheets ' +
      'en échec ne doit jamais vider la liste Brevo. Vérifier getBriefRecipients().'
    );
  }

  // Normalisation en minuscules des DEUX côtés : sans ça, une casse différente
  // produirait un ajout + un retrait du même contact à chaque run, en boucle.
  const desired = new Map();
  for (const r of recipients) {
    const email = String(r.email || '').trim().toLowerCase();
    if (!email) continue;
    desired.set(email, {
      email,
      attributes: {
        PRENOM: r.prenom || '',
        NOM: r.nom || '',
        [STATUT_ATTR]: r.statut || '',
      },
    });
  }
  if (desired.size === 0) {
    throw new Error('Synchro refusée : aucun email exploitable après normalisation.');
  }

  const attribute = await ensureAttribute();
  const { listId, listName, created } = await ensureList();

  // Liste fraîchement créée → vide, donc tout le tableur part en ajout. Cas nominal.
  const current = await getListContacts(listId);

  const toUpsert = [...desired.values()];
  const toAdd = toUpsert.filter(c => !current.has(c.email)).map(c => c.email);
  const toUpdate = toUpsert.filter(c => current.has(c.email)).map(c => c.email);
  const toRemove = [...current].filter(e => !desired.has(e));

  const report = {
    listId, listName, listCreated: created, attribute,
    before: current.size,
    added: toAdd.length,
    updated: toUpdate.length,
    removed: toRemove.length,
    after: desired.size,
    dryRun,
    duration_ms: 0,
  };

  if (dryRun) {
    // Échantillons pour inspection avant application — pas la liste entière, un extrait suffit.
    report.sample = { add: toAdd.slice(0, 10), remove: toRemove.slice(0, 10) };
    report.duration_ms = Date.now() - startedAt;
    return report;
  }

  // Ajouts + mises à jour en UN import : 76 appels unitaires satureraient le rate
  // limit Brevo (~10 req/s).
  if (toUpsert.length > 0) {
    const { status, body } = await brevo('/contacts/import', {
      method: 'POST',
      body: {
        listIds: [listId],
        updateExistingContacts: true,
        emailBlacklist: false,
        smsBlacklist: false,
        jsonBody: toUpsert,
      },
    });
    // Un import partiel ne doit pas passer pour un succès : la liste serait
    // silencieusement incomplète.
    if (status < 200 || status >= 300) fail('import des contacts', status, body);
    if (body && body.processId) report.importProcessId = body.processId;
  }

  // Retraits par lots — retrait de NOTRE liste uniquement, jamais de suppression de contact.
  for (let i = 0; i < toRemove.length; i += REMOVE_BATCH) {
    const batch = toRemove.slice(i, i + REMOVE_BATCH);
    const { status, body } = await brevo(`/contacts/lists/${listId}/contacts/remove`, {
      method: 'POST',
      body: { emails: batch },
    });
    if (status < 200 || status >= 300) {
      fail(`retrait de ${batch.length} contact(s) de la liste ${listId}`, status, body);
    }
  }

  report.duration_ms = Date.now() - startedAt;
  return report;
}
