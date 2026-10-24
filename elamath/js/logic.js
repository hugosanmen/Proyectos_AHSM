// logic.js — reglas de la app como funciones PURAS (sin DOM, sin almacenamiento, sin reloj).
// Todo lo que depende de la fecha recibe `today` ("YYYY-MM-DD") para poder probarse.

// ── Niveles y XP ────────────────────────────────────────────────
export const LEVEL_THRESHOLDS = [0, 40, 100, 180, 280, 400, 550, 730, 940, 1180];
export const LEVEL_TITLES = [
  'Aspirante', 'Principiante', 'Calculista', 'Derivador', 'Optimizador',
  'Analista', 'Estratega', 'Maestro de límites', 'Arquitecto', 'Leyenda',
];

export function levelInfo(xp) {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
  const isMax = level === LEVEL_THRESHOLDS.length;
  const base = LEVEL_THRESHOLDS[level - 1];
  const next = isMax ? base : LEVEL_THRESHOLDS[level];
  return {
    level,
    title: LEVEL_TITLES[level - 1],
    xpInto: xp - base,
    xpNeeded: isMax ? 0 : next - base,
    progress: isMax ? 1 : (xp - base) / (next - base),
    isMax,
  };
}

/** XP por respuesta: solo suma si es correcta; con ayuda (paso a paso antes de responder) vale la mitad. */
export function xpForAnswer({ correct, difficulty, helped = false }) {
  if (!correct) return 0;
  const base = 10 + 5 * (difficulty - 1);
  return helped ? Math.floor(base / 2) : base;
}

// ── Dominio por tema ────────────────────────────────────────────
export const MASTERY_WINDOW = 10;
export const MASTERY_MIN_ATTEMPTS = 8;
export const MASTERY_THRESHOLD = 0.8;

export const recordResult = (recent, correct) => [...recent, !!correct].slice(-MASTERY_WINDOW);
export const masteryRatio = (recent) => (recent.length ? recent.filter(Boolean).length / recent.length : 0);
export const isMastered = (recent) => recent.length >= MASTERY_MIN_ATTEMPTS && masteryRatio(recent) >= MASTERY_THRESHOLD;

// ── Créditos (consultas de paso a paso) ─────────────────────────
export const DAILY_LIMITS = { free: 10, pro: 150 }; // Pro: "uso justo", no ilimitado real

export function normalizeCredits(credits, today) {
  return !credits || credits.date !== today ? { date: today, used: 0 } : credits;
}

export function creditsStatus(credits, today, plan) {
  const c = normalizeCredits(credits, today);
  const limit = DAILY_LIMITS[plan] ?? DAILY_LIMITS.free;
  return { used: c.used, limit, remaining: Math.max(0, limit - c.used), plan };
}

/** Intenta gastar un crédito. Devuelve { ok, credits } sin mutar nada. */
export function consumeCredit(credits, today, plan) {
  const c = normalizeCredits(credits, today);
  const { remaining } = creditsStatus(c, today, plan);
  if (remaining <= 0) return { ok: false, credits: c };
  return { ok: true, credits: { ...c, used: c.used + 1 } };
}

// ── Racha (días consecutivos practicando) ───────────────────────
const toUtcDay = (s) => {
  const [y, m, d] = s.split('-').map(Number);
  return Date.UTC(y, m - 1, d);
};
export const dayDiff = (a, b) => Math.round((toUtcDay(b) - toUtcDay(a)) / 86400000);

export function localDateString(date = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

export function updateStreak(streak, today) {
  if (!streak?.last) return { count: 1, last: today };
  const d = dayDiff(streak.last, today);
  if (d <= 0) return streak;
  return d === 1 ? { count: streak.count + 1, last: today } : { count: 1, last: today };
}

/** Racha vigente para mostrar: si pasó más de un día sin practicar, se considera rota (0). */
export function currentStreak(streak, today) {
  if (!streak?.last) return 0;
  return dayDiff(streak.last, today) > 1 ? 0 : streak.count;
}

// ── Estado de la app ────────────────────────────────────────────
export const STATE_VERSION = 1;
export const EXAM_HISTORY = 20;

/** Limpia el historial de exámenes guardado (datos del navegador: nunca se confía en su forma). */
export function normalizeExams(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((e) => e && typeof e.label === 'string' && Number.isFinite(e.score) && e.score >= 0 && e.score <= 10 && Number.isInteger(e.correct) && Number.isInteger(e.total))
    .map((e) => ({ at: String(e.at ?? '').slice(0, 10), label: e.label.slice(0, 80), score: e.score, correct: e.correct, total: e.total, seconds: Number.isFinite(e.seconds) ? e.seconds : 0 }))
    .slice(-EXAM_HISTORY);
}

export const defaultState = () => ({
  version: STATE_VERSION,
  xp: 0,
  plan: 'free', // 'free' | 'pro' (en esta fase es solo una demo local, NO segura)
  credits: null,
  streak: null,
  topics: {}, // { [tema]: { recent: boolean[] } }
  stats: { answered: 0, correct: 0 },
  exams: [], // historial de exámenes simulados (últimos 20)
});

/** Mezcla lo guardado con los valores por defecto; descarta estados de versión desconocida. */
export function normalizeState(raw) {
  const base = defaultState();
  if (!raw || typeof raw !== 'object' || raw.version !== STATE_VERSION) return base;
  return {
    ...base,
    ...raw,
    plan: raw.plan === 'pro' ? 'pro' : 'free',
    xp: Number.isFinite(raw.xp) && raw.xp >= 0 ? raw.xp : 0,
    topics: raw.topics && typeof raw.topics === 'object' ? raw.topics : {},
    stats: { ...base.stats, ...(raw.stats ?? {}) },
    exams: normalizeExams(raw.exams),
  };
}

/** Aplica una respuesta al estado. Devuelve { state, xpGained, leveledUp, level }. */
export function applyAnswer(state, { topic, correct, difficulty, helped = false, today }) {
  const xpGained = xpForAnswer({ correct, difficulty, helped });
  const before = levelInfo(state.xp).level;
  const xp = state.xp + xpGained;
  const prev = state.topics[topic]?.recent ?? [];
  const next = {
    ...state,
    xp,
    streak: updateStreak(state.streak, today),
    topics: { ...state.topics, [topic]: { recent: recordResult(prev, correct) } },
    stats: {
      answered: state.stats.answered + 1,
      correct: state.stats.correct + (correct ? 1 : 0),
    },
  };
  const after = levelInfo(xp).level;
  return { state: next, xpGained, leveledUp: after > before, level: after };
}
