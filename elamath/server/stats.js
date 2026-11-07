// stats.js — estadísticas agregadas para el panel de administración. Nunca salen correos ni identificadores:
// solo conteos. Los contadores diarios se escriben al sincronizar progreso; el resto se calcula al consultar.

import { effectivePlan, todayMx } from './quota.js';
import { normalizeProgress } from '../js/logic.js';
import { listReports } from './reports.js';

export const STATS_DAYS = 30;
const DAY_MS = 86_400_000;
const KEEP_S = 400 * 24 * 3600; // poco más de un año de historial diario
const MAX_KEYS = 20_000;

export const statsKey = {
  active: (day) => `stats:active:${day}`,
  answered: (day) => `stats:answered:${day}`,
  seen: (day, uid) => `stats:seen:${day}:${uid}`,
};

/** Cuenta al alumno como activo hoy y suma los ejercicios nuevos. Falla en silencio: nunca impide guardar. */
export async function recordActivity({ uid, saved, merged }, { store, now = () => Date.now() }) {
  try {
    const day = todayMx(now());
    if ((await store.incr(statsKey.seen(day, uid), { ex: 2 * 24 * 3600 })) === 1) await store.incr(statsKey.active(day), { ex: KEEP_S });
    // Sin registro previo, el avance es historial, no actividad de hoy. Un reinicio tampoco cuenta.
    if (saved && merged.epoch === saved.epoch) {
      const delta = merged.stats.answered - saved.stats.answered;
      if (delta > 0) await store.incrby(statsKey.answered(day), Math.min(delta, 500), { ex: KEEP_S });
    }
  } catch {
    /* las estadísticas son secundarias */
  }
}

const parse = (raw) => {
  if (!raw) return null;
  try {
    return typeof raw === 'string' ? JSON.parse(raw) : raw;
  } catch {
    return null;
  }
};
const num = (v) => Math.max(0, parseInt(v ?? '0', 10) || 0);

export async function buildStats({ store, config, now = () => Date.now() }) {
  const t = now();
  const days = Array.from({ length: STATS_DAYS }, (_, i) => todayMx(t - (STATS_DAYS - 1 - i) * DAY_MS));
  const index = new Map(days.map((d, i) => [d, i]));
  const series = async (keyOf) => (await store.mget(days.map(keyOf))).map(num);
  const [active, answered, tutor] = await Promise.all([series(statsKey.active), series(statsKey.answered), series((d) => `q:tutor:global:${d}`)]);

  const userKeys = await store.scan('user:', { limit: MAX_KEYS });
  const users = (await store.mget(userKeys)).map(parse).filter(Boolean);
  const progressKeys = await store.scan('progress:', { limit: MAX_KEYS });
  const progress = (await store.mget(progressKeys)).map(parse).filter(Boolean).map(normalizeProgress);

  const newAccounts = days.map(() => 0);
  const plans = {};
  for (const u of users) {
    const created = Date.parse(u.createdAt ?? '');
    const i = Number.isNaN(created) ? undefined : index.get(todayMx(created));
    if (i !== undefined) newAccounts[i]++;
    const base = effectivePlan(u, t, config.billing.trialDays, config.billing.enabled);
    const plan = base === 'pro' && u.founder ? 'founder' : base;
    plans[plan] = (plans[plan] ?? 0) + 1;
  }

  const examsByDay = days.map(() => 0);
  let examTotal = 0;
  let scoreSum = 0;
  let passed = 0;
  const topics = new Map();
  const totals = { answered: 0, correct: 0 };
  for (const p of progress) {
    totals.answered += p.stats.answered;
    totals.correct += p.stats.correct;
    for (const e of p.exams) {
      examTotal++;
      scoreSum += e.score;
      if (e.score >= 6) passed++;
      const i = index.get(e.at);
      if (i !== undefined) examsByDay[i]++;
    }
    for (const [topic, { recent }] of Object.entries(p.topics)) {
      if (!recent.length) continue;
      const row = topics.get(topic) ?? { topic, attempts: 0, correct: 0, students: 0 };
      row.attempts += recent.length;
      row.correct += recent.filter(Boolean).length;
      row.students++;
      topics.set(topic, row);
    }
  }

  const reports = (await listReports({ store }, 15)).map((r) => ({ ts: r.ts, kind: r.kind, note: String(r.note ?? '').slice(0, 200), templateId: r.exercise?.templateId ?? null }));

  return {
    generatedAt: new Date(t).toISOString(),
    days,
    accounts: users.length,
    withProgress: progress.length,
    plans,
    totals,
    exams: { total: examTotal, average: examTotal ? Math.round((scoreSum / examTotal) * 10) / 10 : null, passRate: examTotal ? passed / examTotal : null },
    series: { active, answered, tutor, newAccounts, exams: examsByDay },
    topics: [...topics.values()].map((r) => ({ ...r, accuracy: r.correct / r.attempts })).sort((a, b) => b.attempts - a.attempts),
    reports,
    truncated: userKeys.length >= MAX_KEYS || progressKeys.length >= MAX_KEYS,
  };
}
