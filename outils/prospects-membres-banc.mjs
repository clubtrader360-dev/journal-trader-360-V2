/**
 * BANC : un membre sort de la liste PROSPECTS (Manu, 21/10). Le double de Brevo imite les
 * routes réellement appelées (GET /contacts/lists/{id}, GET .../contacts, POST .../remove) et
 * REFUSE ce que Brevo refuse (lot de plus de 150 adresses, liste inconnue).
 * Usage : node outils/prospects-membres-banc.mjs
 */
const dire = (ok, msg, v) => { console.log(`  ${ok ? 'ok ' : '⛔ '} ${msg}${v !== undefined ? '  ' + JSON.stringify(v) : ''}`); if (!ok) process.exitCode = 1; };
process.env.BREVO_API_KEY = 'test';
let etat; let appels;
const rep = (status, body) => ({ ok: status < 300, status, text: async () => JSON.stringify(body), json: async () => body });
globalThis.fetch = async (url, o = {}) => {
  const u = new URL(url); const m = (o.method || 'GET').toUpperCase(); appels.push(`${m} ${u.pathname}`);
  let x;
  if ((x = u.pathname.match(/\/contacts\/lists\/(\d+)$/)) && m === 'GET') { const l = etat[x[1]]; return l ? rep(200, { id: +x[1], name: l.nom }) : rep(404, { code: 'document_not_found' }); }
  if ((x = u.pathname.match(/\/contacts\/lists\/(\d+)\/contacts$/)) && m === 'GET') { const l = etat[x[1]]; const off = +u.searchParams.get('offset') || 0; const lim = +u.searchParams.get('limit') || 50; return rep(200, { contacts: [...l.emails].slice(off, off + lim).map((email) => ({ email })), count: l.emails.size }); }
  if ((x = u.pathname.match(/\/contacts\/lists\/(\d+)\/contacts\/remove$/)) && m === 'POST') { const b = JSON.parse(o.body); if (!Array.isArray(b.emails) || b.emails.length > 150) return rep(400, { code: 'invalid_parameter' }); b.emails.forEach((e) => etat[x[1]].emails.delete(e)); return rep(201, {}); }
  return rep(404, {});
};
const { retirerMembresDesProspects, aRetirer } = await import('../api/_lib/prospects-membres.js');
const remettre = (p, mb, n6 = 'PROSPECTS', n7 = 'MEMBRES T360') => { etat = { 6: { nom: n6, emails: new Set(p) }, 7: { nom: n7, emails: new Set(mb) } }; appels = []; };

remettre(['a@x.fr', 'b@x.fr', 'c@x.fr'], ['b@x.fr', 'z@x.fr']);
let r = await retirerMembresDesProspects();
dire(JSON.stringify(r.retires) === '["b@x.fr"]' && etat[6].emails.size === 3 && !appels.some((a) => a.startsWith('POST')), 'à blanc : compte 1, ne retire rien', r.retires);
r = await retirerMembresDesProspects({ appliquer: true });
dire(!etat[6].emails.has('b@x.fr') && etat[6].emails.size === 2, 'appliqué : b sort de PROSPECTS');
dire(etat[7].emails.has('b@x.fr') && etat[7].emails.size === 2, 'MEMBRES intacte');
r = await retirerMembresDesProspects({ appliquer: true });
dire(r.retires.length === 0, 'relancé : plus rien à retirer (idempotent)');
const gros = Array.from({ length: 640 }, (_, i) => `m${i}@x.fr`);
remettre([...gros, 'p@x.fr'], gros);
r = await retirerMembresDesProspects({ appliquer: true });
dire(r.retires.length === 640 && etat[6].emails.size === 1 && etat[6].emails.has('p@x.fr'), '640 membres : retirés par lots de 150, le prospect reste', [...etat[6].emails]);
remettre(['a@x.fr'], ['a@x.fr'], 'BRIEF PROSPECTS T360');
let leve = null; try { await retirerMembresDesProspects({ appliquer: true }); } catch (e) { leve = e.message; }
dire(!!leve && etat[6].emails.has('a@x.fr'), 'liste 6 nommée « BRIEF PROSPECTS T360 » (celle du brief) : aucun retrait', leve);
remettre(['a@x.fr'], ['a@x.fr'], 'CLIENTS', 'MEMBRES T360');
leve = null; try { await retirerMembresDesProspects({ appliquer: true }); } catch (e) { leve = e.message; }
dire(!!leve && etat[6].emails.has('a@x.fr'), 'liste 6 ne s appelle plus PROSPECT : aucun retrait', leve);
remettre(['a@x.fr'], ['a@x.fr'], 'PROSPECTS', 'ANCIENS');
leve = null; try { await retirerMembresDesProspects({ appliquer: true }); } catch (e) { leve = e.message; }
dire(!!leve && etat[6].emails.has('a@x.fr'), 'liste 7 ne s appelle plus MEMBRE : aucun retrait', leve);
dire(aRetirer(new Set(['a']), new Set(['b'])).length === 0 && aRetirer(new Set(['a']), new Set(['a'])).length === 1, 'témoin : l intersection discrimine');
console.log(process.exitCode ? '\n⛔ défauts' : '\nbanc vert');
