// crypto.js — tokens firmados (HMAC-SHA256), hashes y comparaciones en tiempo constante.
// Sin dependencias: solo node:crypto.

import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

export const sha256Hex = (s) => createHash('sha256').update(String(s)).digest('hex');
export const randomToken = (bytes = 32) => randomBytes(bytes).toString('base64url');

/** Compara dos cadenas en tiempo constante (se hashean antes para igualar longitudes). */
export function safeEqual(a, b) {
  const h = (x) => createHash('sha256').update(String(x)).digest();
  return timingSafeEqual(h(a), h(b));
}

/** Firma un objeto. `payload.exp` va en SEGUNDOS desde epoch. Formato: base64url(json).firma */
export function signToken(payload, secret) {
  if (!secret) throw new Error('missing_secret');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = createHmac('sha256', secret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

/** Devuelve el payload si la firma, el tipo (`typ`) y la caducidad son válidos; si no, null. */
export function verifyToken(token, secret, { typ, now = Date.now() } = {}) {
  if (!secret || typeof token !== 'string' || token.length > 2048) return null;
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [body, sig] = parts;
  const expected = createHmac('sha256', secret).update(body).digest('base64url');
  if (!safeEqual(sig, expected)) return null;
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
  if (!payload || typeof payload !== 'object') return null;
  if (typ && payload.typ !== typ) return null;
  if (typeof payload.exp !== 'number' || payload.exp * 1000 <= now) return null;
  return payload;
}
