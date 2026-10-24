// quota.js — plan del usuario y cuota diaria del Peer Tutor, decididos SIEMPRE en el servidor.
//
// El tutor es lo que cuesta dinero (cada mensaje llama a un modelo), así que es lo que se limita aquí.
// El "paso a paso básico" del plan gratis es contenido local y se sigue contando en el navegador.

const DAY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit' });

/** Fecha "YYYY-MM-DD" en horario de Ciudad de México (el día de los estudiantes, no el de UTC). */
export const todayMx = (now = Date.now()) => DAY.format(new Date(now));

const DAY_MS = 86_400_000;

/** Fin de la prueba gratis: `trialUntil` si el admin lo fijó; si no, createdAt + trialDays. null si no se puede saber. */
export function trialEnd(user, trialDays = 30) {
  if (user?.trialUntil) {
    const t = Date.parse(user.trialUntil);
    return Number.isNaN(t) ? null : t;
  }
  const c = Date.parse(user?.createdAt ?? '');
  return Number.isNaN(c) ? null : c + trialDays * DAY_MS;
}

/**
 * 'pro'   → plan Pro vigente (pago manual, código promocional o admin; `proUntil` si existe).
 * 'trial' → los primeros `trialDays` días desde que se creó la cuenta: todo desbloqueado.
 * 'open'  → cobro apagado (BILLING_ENABLED sin activar): todo desbloqueado para cuentas.
 * 'free'  → todo lo demás (la práctica básica sigue gratis; el tutor, el escáner y los exámenes requieren trial/pro).
 */
export function effectivePlan(user, now = Date.now(), trialDays = 30, billingEnabled = true) {
  if (!billingEnabled && user) return 'open'; // etapa de pruebas: todo abierto para quien tenga cuenta
  if (user?.plan === 'pro' && !(user.proUntil && Date.parse(user.proUntil) <= now)) return 'pro';
  const end = trialEnd(user, trialDays);
  if (end !== null && now < end) return 'trial';
  return 'free';
}

/** Datos de la prueba para el cliente. */
export function trialInfo(user, now = Date.now(), trialDays = 30) {
  const end = trialEnd(user, trialDays);
  if (end === null) return { endsAt: null, daysLeft: 0, active: false };
  return { endsAt: new Date(end).toISOString(), daysLeft: Math.max(0, Math.ceil((end - now) / DAY_MS)), active: now < end };
}

export const tutorLimit = (plan, config) => (plan === 'pro' ? config.limits.tutorPro : plan === 'trial' || plan === 'open' ? config.limits.tutorTrial : config.limits.tutorFree);

const key = (uid, day) => `q:tutor:${uid}:${day}`;
const globalKey = (day) => `q:tutor:global:${day}`;
const TTL = 2 * 24 * 3600;

export async function quotaStatus(uid, plan, { store, config, now = () => Date.now() }) {
  const limit = tutorLimit(plan, config);
  const used = Math.max(0, parseInt((await store.get(key(uid, todayMx(now())))) ?? '0', 10) || 0);
  return { used: Math.min(used, limit), limit, remaining: Math.max(0, limit - used) };
}

/**
 * Reserva un mensaje del tutor. { ok:true } o { ok:false, reason: 'plan' | 'daily' | 'capacity' }.
 * Si luego falla la llamada al modelo, hay que llamar a `refund` para no cobrarle al estudiante.
 */
export async function reserve(uid, plan, { store, config, now = () => Date.now() }) {
  const limit = tutorLimit(plan, config);
  if (limit <= 0) return { ok: false, reason: 'plan' };
  const day = todayMx(now());

  const g = await store.incr(globalKey(day), { ex: TTL });
  if (g > config.limits.tutorGlobal) {
    await store.decr(globalKey(day));
    return { ok: false, reason: 'capacity' };
  }
  const n = await store.incr(key(uid, day), { ex: TTL });
  if (n > limit) {
    await store.decr(key(uid, day));
    await store.decr(globalKey(day));
    return { ok: false, reason: 'daily' };
  }
  return { ok: true };
}

export async function refund(uid, { store, now = () => Date.now() }) {
  const day = todayMx(now());
  await store.decr(key(uid, day));
  await store.decr(globalKey(day));
}
