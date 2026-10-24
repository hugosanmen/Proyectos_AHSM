// exam.js — lógica pura de los exámenes simulados (sin DOM: se prueba con node:test).
//
// Reglas: 10 reactivos adaptativos, 20 minutos, sin retroalimentación hasta el final.
// La dificultad inicia en 2; acierto → sube 1, error → baja 1 (entre 1 y 5). Sin respuesta cuenta como error.
// Calificación 0–10 = aciertos / reactivos × 10; aprueba con 6. Al terminar se aplica XP/dominio por reactivo.

import { EXAM_HISTORY, applyAnswer } from './logic.js';

export const EXAM_QUESTIONS = 10;
export const EXAM_MINUTES = 20;
export const EXAM_PASS = 6;
const START_DIFFICULTY = 2;
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));

/** Elige la plantilla de los temas dados más cercana a la dificultad objetivo, evitando repetir las recientes. */
export function pickTemplate(templates, topics, target, recentIds, rand) {
  const inTopics = templates.filter((t) => topics.includes(t.topic));
  if (!inTopics.length) return null;
  const fresh = inTopics.filter((t) => !recentIds.includes(t.id));
  const pool = fresh.length ? fresh : inTopics;
  const best = Math.min(...pool.map((t) => Math.abs(t.difficulty - target)));
  const near = pool.filter((t) => Math.abs(t.difficulty - target) === best);
  return near[Math.floor(rand() * near.length)];
}

export function startExam({ topics, label, now, minutes = EXAM_MINUTES, questions = EXAM_QUESTIONS }) {
  return { topics, label, questions, startedAt: now, deadline: now + minutes * 60_000, target: START_DIFFICULTY, items: [], index: 0, finished: false, finishedAt: null };
}

/** Siguiente reactivo (o null si ya se contestaron todos). `make(templateId, seed)` devuelve el ejercicio de opción múltiple. */
export function nextItem(exam, { templates, make, rand }) {
  if (exam.finished || exam.items.length >= exam.questions) return null;
  const recent = exam.items.slice(-4).map((i) => i.ex.templateId);
  const t = pickTemplate(templates, exam.topics, exam.target, recent, rand);
  if (!t) return null;
  const seed = 1 + Math.floor(rand() * (2 ** 31 - 2));
  return { ex: make(t.id, seed), picked: null, correct: null };
}

/** Registra la respuesta del reactivo actual y ajusta la dificultad. Devuelve un examen nuevo. */
export function answerItem(exam, item, pickedIndex) {
  if (exam.finished || item.picked !== null) return exam;
  const opt = item.ex.options[pickedIndex];
  if (!opt) return exam;
  const done = { ...item, picked: pickedIndex, correct: opt.correct === true };
  const target = clamp(exam.target + (done.correct ? 1 : -1), 1, 5);
  return { ...exam, items: [...exam.items, done], target };
}

export const timeLeftMs = (exam, now) => Math.max(0, exam.deadline - now);
export const isExpired = (exam, now) => now >= exam.deadline;

export function finishExam(exam, now) {
  return exam.finished ? exam : { ...exam, finished: true, finishedAt: Math.min(now, exam.deadline) };
}

export function gradeExam(exam) {
  const correct = exam.items.filter((i) => i.correct).length;
  const total = exam.questions;
  const score = Math.round((correct / total) * 100) / 10;
  return { correct, answered: exam.items.length, total, score, passed: score >= EXAM_PASS };
}

/** Aplica el examen terminado al estado: XP y dominio por cada reactivo contestado + historial. */
export function applyExam(state, exam, today) {
  let s = state;
  let xpGained = 0;
  let leveledUp = false;
  let level = null;
  for (const it of exam.items) {
    const r = applyAnswer(s, { topic: it.ex.topic, correct: it.correct, difficulty: it.ex.difficulty, today });
    s = r.state;
    xpGained += r.xpGained;
    leveledUp ||= r.leveledUp;
    level = r.level;
  }
  const g = gradeExam(exam);
  const entry = { at: today, label: exam.label, score: g.score, correct: g.correct, total: g.total, seconds: Math.round(((exam.finishedAt ?? exam.deadline) - exam.startedAt) / 1000) };
  s = { ...s, exams: [...(s.exams ?? []), entry].slice(-EXAM_HISTORY) };
  return { state: s, xpGained, leveledUp, level, entry };
}

export const formatClock = (ms) => {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};
