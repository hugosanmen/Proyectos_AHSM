// auth.js — cuentas sin contraseña: el estudiante recibe un enlace de un solo uso por correo.
//
//   requestLogin → guarda un token aleatorio (solo su hash, 15 min) y lo envía por correo
//   verifyLogin  → canjea el token UNA sola vez y entrega una sesión firmada (30 días)
//   authenticate → valida el `Authorization: Bearer <sesión>` de cada petición
//
// La sesión viaja en una cabecera (no en cookie), así que no hay riesgo de CSRF.

import { randomToken, sha256Hex, signToken, verifyToken } from './crypto.js';

export const LOGIN_TTL_S = 15 * 60;
export const SESSION_TTL_S = 30 * 24 * 3600;
const EMAIL_RE = /^[^\s@<>()"',;:\\]+@[^\s@<>()"',;:\\]+\.[^\s@<>()"',;:\\]{2,}$/;

export function normalizeEmail(raw) {
  if (typeof raw !== 'string') return null;
  const e = raw.trim().toLowerCase();
  return e.length <= 254 && EMAIL_RE.test(e) ? e : null;
}

export const uidFor = (email) => sha256Hex(email).slice(0, 24);

/** Limitador de ritmo: true si todavía se permite la acción. */
export async function allow(store, key, max, windowS) {
  const n = await store.incr(key, { ex: windowS });
  return n <= max;
}

export async function requestLogin({ email: rawEmail, ip }, { store, config, mailer }) {
  const email = normalizeEmail(rawEmail);
  if (!email) return { status: 400, body: { code: 'bad_email' } };
  if (!config.sessionSecret || !config.appUrl) return { status: 503, body: { code: 'not_configured' } };
  if (!config.devMode && !mailer) return { status: 503, body: { code: 'email_not_configured' } };

  const uid = uidFor(email);
  const okEmail = await allow(store, `rl:login:email:${uid}`, 5, 3600);
  const okIp = await allow(store, `rl:login:ip:${sha256Hex(ip || 'unknown').slice(0, 16)}`, 20, 3600);
  if (!okEmail || !okIp) return { status: 429, body: { code: 'rate_limited' } };

  const token = randomToken();
  await store.set(`login:${sha256Hex(token)}`, JSON.stringify({ email, uid }), { ex: LOGIN_TTL_S });
  const link = `${config.appUrl}/?login=${token}`;

  if (config.devMode) return { status: 200, body: { ok: true, devLink: link } };
  try {
    await mailer.send({
      to: email,
      subject: 'Tu enlace para entrar a ElaMath',
      text:
        `Hola,\n\nEntra a ElaMath con este enlace (vale 15 minutos y solo se puede usar una vez):\n\n${link}\n\n` +
        'Si no lo pediste tú, ignora este correo.\n\nElaMath · proyecto independiente, no afiliado a la UNAM.',
    });
  } catch {
    await store.del(`login:${sha256Hex(token)}`);
    return { status: 502, body: { code: 'email_failed' } };
  }
  return { status: 200, body: { ok: true } };
}

export async function verifyLogin({ token }, { store, config, now = () => Date.now() }) {
  if (typeof token !== 'string' || token.length < 20 || token.length > 200) return { status: 400, body: { code: 'bad_token' } };
  if (!config.sessionSecret) return { status: 503, body: { code: 'not_configured' } };

  const raw = await store.getdel(`login:${sha256Hex(token)}`); // un solo uso
  if (!raw) return { status: 401, body: { code: 'invalid_or_expired' } };
  const { email, uid } = JSON.parse(raw);

  let user = await getUser(store, uid);
  if (!user) {
    user = { email, createdAt: new Date(now()).toISOString(), plan: 'free' };
    await store.set(`user:${uid}`, JSON.stringify(user));
  }
  const session = signToken({ typ: 'session', uid, exp: Math.floor(now() / 1000) + SESSION_TTL_S }, config.sessionSecret);
  return { status: 200, body: { session, user: { email: user.email } } };
}

export async function getUser(store, uid) {
  const raw = await store.get(`user:${uid}`);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** Devuelve { uid, user } si la sesión es válida y la cuenta existe; si no, null. */
export async function authenticate(headers, { store, config, now = () => Date.now() }) {
  const h = headers?.authorization || headers?.Authorization || '';
  const m = /^Bearer\s+(\S+)$/i.exec(h);
  if (!m) return null;
  const payload = verifyToken(m[1], config.sessionSecret, { typ: 'session', now: now() });
  if (!payload || typeof payload.uid !== 'string') return null;
  const user = await getUser(store, payload.uid);
  return user ? { uid: payload.uid, user } : null;
}
