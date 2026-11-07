// founders.js — los primeros correos que se registran (20 por defecto, FOUNDERS_LIMIT) quedan como «fundadores»:
// Pro permanente, sin fecha de fin, con todo desbloqueado aunque después se active el cobro.
//
// founders:n lleva la cuenta. La primera vez que hace falta (cuentas creadas antes de esta función), se reparte el
// lugar entre las cuentas que ya existen, por fecha de registro. founders:init evita que dos llamadas lo hagan a la vez.
// El admin puede quitarlo con admin/plan → free, como cualquier Pro.

const COUNT = 'founders:n';
const INIT = 'founders:init';

/** Usuario con acceso de fundador (Pro sin vencimiento). */
export function asFounder(user) {
  const u = { ...user, plan: 'pro', founder: true };
  delete u.proUntil;
  delete u.trialUntil;
  return u;
}

/** Marca como fundadores a las primeras cuentas que ya existían, una sola vez. */
export async function ensureFounders({ store, config }) {
  const limit = config.foundersLimit ?? 20;
  if ((await store.get(COUNT)) !== null) return;
  if ((await store.incr(INIT)) !== 1) return; // otra llamada ya lo está haciendo
  const keys = await store.scan('user:');
  const raws = keys.length ? await store.mget(keys) : [];
  const users = [];
  raws.forEach((raw, i) => {
    try {
      const u = JSON.parse(raw);
      if (u?.email) users.push([keys[i], u]);
    } catch {
      /* registro dañado: se ignora */
    }
  });
  users.sort((a, b) => (Date.parse(a[1].createdAt) || 0) - (Date.parse(b[1].createdAt) || 0));
  const first = users.slice(0, Math.max(0, limit));
  for (const [key, u] of first) await store.set(key, JSON.stringify(asFounder(u)));
  await store.set(COUNT, String(first.length));
}

/** Para una cuenta nueva: ¿le toca lugar de fundador? Ocupa el lugar si lo hay. */
export async function claimFounderSeat({ store, config }) {
  const limit = config.foundersLimit ?? 20;
  if (limit <= 0) return false;
  const n = await store.incr(COUNT);
  if (n > limit) {
    await store.decr(COUNT); // no pasa del límite: el contador queda en el número real de fundadores
    return false;
  }
  return true;
}

export async function foundersCount({ store }) {
  return Math.max(0, parseInt((await store.get(COUNT)) ?? '0', 10) || 0);
}
