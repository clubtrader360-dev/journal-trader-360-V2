// ========================================
// CHIFFREMENT CREDS TRADOVATE — AES-256-GCM
// ========================================
// La clé TRADOVATE_ENCRYPTION_KEY est un hex de 64 caractères (32 bytes),
// générée une fois avec : openssl rand -hex 32
// Stockée en env var Vercel — JAMAIS dans la DB ni dans le repo.
//
// Format de stockage par champ chiffré :
//   - encrypted_<champ>      : ciphertext (base64)
//   - <champ>_iv             : IV unique de 12 bytes (base64)
//   - <champ>_auth_tag       : auth tag GCM 16 bytes (base64)
//
// Si quelqu'un dump la DB sans la clé : ne peut rien lire ni forger.
// Si la clé fuit : il faut rotater (désactiver les connexions, regénérer
// la clé, demander aux élèves de se reconnecter).
// ========================================

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;          // recommandé pour GCM
const KEY_LEN_BYTES = 32;   // AES-256

function getKey() {
  const hex = process.env.TRADOVATE_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error('TRADOVATE_ENCRYPTION_KEY manquante (env var Vercel)');
  }
  if (hex.length !== 64) {
    throw new Error(
      'TRADOVATE_ENCRYPTION_KEY doit faire 64 caractères hex (32 bytes). ' +
      'Génère-la avec : openssl rand -hex 32'
    );
  }
  const buf = Buffer.from(hex, 'hex');
  if (buf.length !== KEY_LEN_BYTES) {
    throw new Error('TRADOVATE_ENCRYPTION_KEY hex invalide');
  }
  return buf;
}

export function encrypt(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encrypt: plaintext doit être une string non vide');
  }
  const key = getKey();
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final()
  ]);
  const authTag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64')
  };
}

export function decrypt({ ciphertext, iv, authTag }) {
  const key = getKey();
  const decipher = createDecipheriv(
    ALGO,
    key,
    Buffer.from(iv, 'base64')
  );
  decipher.setAuthTag(Buffer.from(authTag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64')),
    decipher.final()
  ]);
  return plaintext.toString('utf8');
}
