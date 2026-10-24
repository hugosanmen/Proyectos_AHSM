// reports.js — reportes de errores desde la app ("este ejercicio está mal", "no se ve bien").
// No exigen cuenta (que reportar sea fácil importa más), pero llevan límite por IP.

import { getTemplate } from '../js/engine/index.js';
import { allow } from './auth.js';
import { sha256Hex } from './crypto.js';

const KINDS = ['math_error', 'ui', 'other'];
export const MAX_REPORTS = 500;

export async function submitReport({ body, ip, uid }, { store, now = () => Date.now() }) {
  if (!body || typeof body !== 'object') return { status: 400, body: { code: 'bad_request' } };
  const kind = body.kind === undefined ? 'math_error' : body.kind;
  if (!KINDS.includes(kind)) return { status: 400, body: { code: 'bad_kind' } };
  const note = typeof body.note === 'string' ? body.note.trim().slice(0, 500) : '';

  let exercise = null;
  if (body.exercise) {
    const { templateId, seed, pickedIndex } = body.exercise;
    if (typeof templateId !== 'string' || !getTemplate(templateId) || !Number.isInteger(seed) || seed < 1 || seed > 2 ** 31 - 1) {
      return { status: 400, body: { code: 'bad_exercise' } };
    }
    exercise = { templateId, seed, pickedIndex: Number.isInteger(pickedIndex) && pickedIndex >= 0 && pickedIndex <= 3 ? pickedIndex : null };
  }
  if (!exercise && !note) return { status: 400, body: { code: 'empty_report' } };

  if (!(await allow(store, `rl:report:${sha256Hex(ip || 'unknown').slice(0, 16)}`, 10, 3600))) {
    return { status: 429, body: { code: 'rate_limited' } };
  }
  await store.lpush('reports', JSON.stringify({ ts: new Date(now()).toISOString(), kind, note, exercise, uid: uid ?? null }), { max: MAX_REPORTS });
  return { status: 200, body: { ok: true } };
}

export async function listReports({ store }, limit = 100) {
  const rows = await store.lrange('reports', 0, limit - 1);
  return rows.map((r) => {
    try {
      return JSON.parse(r);
    } catch {
      return null;
    }
  }).filter(Boolean);
}
