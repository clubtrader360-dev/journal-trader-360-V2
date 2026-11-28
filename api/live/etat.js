// ========================================
// ÉTAT DE LA SALLE LIVE (bloc « Salle live Trader 360 » du tableau de bord)
// ========================================
// GET, avec le jeton de session du membre (Authorization: Bearer …), comme les routes tradovate.
// Lit directement sur le serveur LiveKit (API d'administration, en lecture seule) :
//   - séance ouverte ou non (métadonnées de la salle, écrites par la salle elle-même) et son sujet ;
//   - nombre de connectés (hors enregistrement OBS) ;
//   - heure d'arrivée du coach (« depuis 15h02 »).
// Renvoie aussi l'adresse de la salle (variable T360_SALLE_URL : la production par défaut).
// Variables (projet Vercel du journal) : T360_LIVE_URL, T360_LIVE_API_KEY, T360_LIVE_API_SECRET, T360_LIVE_ROOM, T360_SALLE_URL.
// Aucune écriture, ni dans LiveKit ni dans la base.
import crypto from 'crypto';
import { requireUser } from '../tradovate/_lib/auth.js';

const SALLE_URL = () => String(process.env.T360_SALLE_URL || 'https://t360-live-test.vercel.app').replace(/\/+$/, '');
const ROOM = () => String(process.env.T360_LIVE_ROOM || '').trim() || 't360-salle-live-test';
const b64u = (x) => Buffer.from(typeof x === 'string' ? x : JSON.stringify(x)).toString('base64url');

// Jeton d'administration LiveKit (HS256), valable 1 minute, limité à la liste des salles et à CETTE salle.
function jetonAdmin(room) {
  const now = Math.floor(Date.now() / 1000);
  const corps = { iss: process.env.T360_LIVE_API_KEY, nbf: now - 5, exp: now + 60, video: { roomList: true, roomAdmin: true, room } };
  const tete = b64u({ alg: 'HS256', typ: 'JWT' }) + '.' + b64u(corps);
  return tete + '.' + crypto.createHmac('sha256', String(process.env.T360_LIVE_API_SECRET)).update(tete).digest('base64url');
}
async function twirp(methode, corps) {
  const base = String(process.env.T360_LIVE_URL || '').replace(/^ws/, 'http').replace(/\/+$/, '');
  const r = await fetch(base + '/twirp/livekit.RoomService/' + methode, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + jetonAdmin(ROOM()) },
    body: JSON.stringify(corps), signal: AbortSignal.timeout(4000),
  });
  if (!r.ok) throw new Error('LiveKit ' + r.status);
  return r.json();
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'GET uniquement' });
  try { await requireUser(req); } catch (e) { return res.status(e.status || 401).json({ error: 'Connexion requise' }); }
  return res.status(200).json(await lireEtat());
}

export async function lireEtat() {
  const base = { salle_url: SALLE_URL(), en_direct: false, sujet: '', connectes: 0, depuis: null, disponible: false };
  if (!process.env.T360_LIVE_URL || !process.env.T360_LIVE_API_KEY || !process.env.T360_LIVE_API_SECRET) return base;
  try {
    const { rooms = [] } = await twirp('ListRooms', { names: [ROOM()] });
    const salle = rooms[0];
    if (!salle) return { ...base, disponible: true };
    let meta = {}; try { meta = JSON.parse(salle.metadata || '{}') || {}; } catch {}
    const { participants = [] } = await twirp('ListParticipants', { room: ROOM() });
    const visibles = participants.filter((p) => !/^obs-/.test(p.identity || ''));
    const coach = visibles.filter((p) => /^coach-/.test(p.identity || '')).map((p) => Number(p.joinedAt || p.joined_at || 0)).filter(Boolean).sort((a, b) => a - b)[0];
    return {
      ...base, disponible: true, en_direct: meta.open === true,
      sujet: typeof meta.topic === 'string' ? meta.topic.slice(0, 140) : '',
      connectes: visibles.length, depuis: coach ? coach * 1000 : null,
    };
  } catch (e) {
    return base; // salle injoignable : le bloc reste affiché, sans « EN DIRECT »
  }
}
