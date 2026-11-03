// progress.js — progreso de práctica guardado en la cuenta. El servidor fusiona: dos dispositivos pueden enviar
// a la vez sin pisarse más allá de las reglas de mergeProgress. Solo se guarda progreso, nunca datos del examen en curso.

import { allow, authenticate } from './auth.js';
import { mergeProgress, normalizeProgress } from '../js/logic.js';

const key = (uid) => `progress:${uid}`;

export async function syncProgress(ctx, deps) {
  const { store } = deps;
  const auth = await authenticate(ctx.headers, deps);
  if (!auth) return { status: 401, body: { code: 'unauthorized' } };
  if (!ctx.body?.progress || typeof ctx.body.progress !== 'object') return { status: 400, body: { code: 'bad_progress' } };
  if (!(await allow(store, `rl:progress:${auth.uid}`, 240, 3600))) return { status: 429, body: { code: 'rate_limited' } };

  let saved = null;
  try {
    const raw = await store.get(key(auth.uid));
    saved = raw ? normalizeProgress(typeof raw === 'string' ? JSON.parse(raw) : raw) : null;
  } catch {
    saved = null; // un registro dañado no debe impedir guardar el progreso actual
  }
  const merged = mergeProgress(saved, normalizeProgress(ctx.body.progress));
  const text = JSON.stringify(merged);
  if (!saved || JSON.stringify(saved) !== text) await store.set(key(auth.uid), text);
  return { status: 200, body: { progress: merged } };
}
