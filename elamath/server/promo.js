// promo.js — códigos promocionales: el admin los crea, el estudiante los canjea y recibe días de Pro.
// Reglas (todas en el servidor): un uso por cuenta, tope global de usos, caducidad del código,
// límite de intentos por hora (para que nadie adivine códigos a fuerza bruta).

import { randomBytes } from 'node:crypto';
import { allow, getUser } from './auth.js';

export const normalizeCode = (raw) => String(raw ?? '').toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 24);
const CODE_RE = /^[A-Z0-9][A-Z0-9-]{3,23}$/;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O/1/I para que se pueda dictar
const DAY_MS = 86_400_000;

export const generateCode = () => {
  const b = randomBytes(8);
  let s = '';
  for (const x of b) s += ALPHABET[x % ALPHABET.length];
  return `ELA-${s.slice(0, 4)}-${s.slice(4)}`;
};

/** Admin: crea un código. { code?, days, maxUses, expiresInDays?, note? } */
export async function createPromo(body, { store, now = () => Date.now() }) {
  const days = body?.days;
  const maxUses = body?.maxUses ?? 1;
  const exp = body?.expiresInDays;
  if (!Number.isInteger(days) || days < 1 || days > 3650) return { status: 400, body: { code: 'bad_days' } };
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 100000) return { status: 400, body: { code: 'bad_max_uses' } };
  if (exp !== undefined && !(Number.isInteger(exp) && exp >= 1 && exp <= 3650)) return { status: 400, body: { code: 'bad_expiry' } };
  const code = body?.code === undefined ? generateCode() : normalizeCode(body.code);
  if (!CODE_RE.test(code)) return { status: 400, body: { code: 'bad_code' } };
  if (await store.get(`promo:${code}`)) return { status: 409, body: { code: 'code_exists' } };
  const promo = {
    code,
    days,
    maxUses,
    expiresAt: exp ? new Date(now() + exp * DAY_MS).toISOString() : null,
    note: typeof body?.note === 'string' ? body.note.slice(0, 120) : '',
    createdAt: new Date(now()).toISOString(),
  };
  await store.set(`promo:${code}`, JSON.stringify(promo));
  await store.lpush('promos', code, { max: 500 });
  return { status: 200, body: { ok: true, promo } };
}

export async function listPromos({ store }) {
  const codes = [...new Set(await store.lrange('promos', 0, 99))];
  const out = [];
  for (const code of codes) {
    const raw = await store.get(`promo:${code}`);
    if (!raw) continue;
    const promo = JSON.parse(raw);
    out.push({ ...promo, uses: Math.max(0, parseInt((await store.get(`promo:uses:${code}`)) ?? '0', 10) || 0) });
  }
  return out;
}

/** Estudiante: canjea un código. Suma días de Pro a partir de hoy o del fin de su Pro actual. */
export async function redeemPromo({ uid, user, code: rawCode }, { store, now = () => Date.now() }) {
  if (!(await allow(store, `rl:promo:${uid}`, 10, 3600))) return { status: 429, body: { code: 'rate_limited' } };
  const code = normalizeCode(rawCode);
  if (!CODE_RE.test(code)) return { status: 404, body: { code: 'invalid_code' } };
  const raw = await store.get(`promo:${code}`);
  if (!raw) return { status: 404, body: { code: 'invalid_code' } }; // misma respuesta exista o no: no filtra códigos
  const promo = JSON.parse(raw);
  if (promo.expiresAt && Date.parse(promo.expiresAt) <= now()) return { status: 410, body: { code: 'code_expired' } };

  // Un uso por cuenta (incr atómico: si dos pestañas canjean a la vez, solo una gana).
  if ((await store.incr(`promo:used:${code}:${uid}`)) > 1) return { status: 409, body: { code: 'already_used' } };
  // Tope global; si se rebasa se devuelve el uso (y el de la cuenta, para que no quede "gastado").
  if ((await store.incr(`promo:uses:${code}`)) > promo.maxUses) {
    await store.decr(`promo:uses:${code}`);
    await store.decr(`promo:used:${code}:${uid}`);
    return { status: 410, body: { code: 'code_exhausted' } };
  }

  const fresh = (await getUser(store, uid)) ?? user;
  const cur = fresh.plan === 'pro' && fresh.proUntil ? Date.parse(fresh.proUntil) : 0;
  const base = Math.max(now(), Number.isNaN(cur) ? 0 : cur);
  fresh.plan = 'pro';
  fresh.proUntil = new Date(base + promo.days * DAY_MS).toISOString();
  await store.set(`user:${uid}`, JSON.stringify(fresh));
  return { status: 200, body: { ok: true, days: promo.days, proUntil: fresh.proUntil } };
}
