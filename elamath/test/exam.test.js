// Lógica de los exámenes simulados (js/exam.js) y del selector de imagen (js/image.js).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as X from '../js/exam.js';
import * as L from '../js/logic.js';
import { generateExercise, templates, toMultipleChoice } from '../js/engine/index.js';
import { createRng } from '../js/engine/utils.js';
import { ImageError, MAX_B64, prepareImage } from '../js/image.js';

const rnd = (seed) => createRng(seed).next;
const make = (id, seed) => toMultipleChoice(generateExercise(id, seed));
const T0 = 1_000_000;
const topicsOf = (n) => [...new Set(templates.map((t) => t.topic))].slice(0, n);

function play(exam, picker, rand = rnd(5)) {
  while (!exam.finished) {
    const item = X.nextItem(exam, { templates, make, rand });
    if (!item) break;
    exam = X.answerItem(exam, item, picker(item, exam));
    if (exam.items.length >= exam.questions) break;
  }
  return X.finishExam(exam, T0 + 1000);
}
const right = (item) => item.ex.options.findIndex((o) => o.correct);
const wrong = (item) => item.ex.options.findIndex((o) => !o.correct);

describe('examen: selección y adaptación', () => {
  it('pickTemplate elige la dificultad más cercana al objetivo, de los temas pedidos, y evita repetidas', () => {
    const topics = topicsOf(2);
    const rng = rnd(1);
    for (let target = 1; target <= 5; target++) {
      const t = X.pickTemplate(templates, topics, target, [], rng);
      assert.ok(topics.includes(t.topic));
      const pool = templates.filter((x) => topics.includes(x.topic));
      assert.equal(Math.abs(t.difficulty - target), Math.min(...pool.map((x) => Math.abs(x.difficulty - target))));
    }
    const pool = templates.filter((x) => topics.includes(x.topic));
    const once = X.pickTemplate(templates, topics, 3, [], rng);
    for (let i = 0; i < 30; i++) assert.notEqual(X.pickTemplate(templates, topics, 3, [once.id], rng).id, once.id, 'si hay alternativas no repite');
    // con una sola plantilla disponible, repetir es mejor que fallar
    const solo = pool.slice(0, 1);
    assert.equal(X.pickTemplate(solo, topics, 3, [solo[0].id], rng).id, solo[0].id);
    assert.equal(X.pickTemplate(templates, ['tema que no existe'], 3, [], rng), null);
  });

  it('acierto sube la dificultad objetivo, error la baja, siempre entre 1 y 5', () => {
    let exam = X.startExam({ topics: topicsOf(3), label: 'x', now: T0 });
    assert.equal(exam.target, 2);
    const rng = rnd(2);
    const step = (pick) => {
      const item = X.nextItem(exam, { templates, make, rand: rng });
      exam = X.answerItem(exam, item, pick(item));
      return exam.target;
    };
    assert.equal(step(right), 3);
    assert.equal(step(right), 4);
    assert.equal(step(right), 5);
    assert.equal(step(right), 5, 'tope en 5');
    assert.equal(step(wrong), 4);
    for (let i = 0; i < 5; i++) step(wrong);
    assert.equal(exam.target, 1, "piso en 1");
    // 10 reactivos ya contestados: no sigue
    assert.equal(X.nextItem(exam, { templates, make, rand: rng }), null);
  });

  it('responder dos veces el mismo reactivo o una opción inexistente no cambia nada', () => {
    let exam = X.startExam({ topics: topicsOf(2), label: 'x', now: T0 });
    const item = X.nextItem(exam, { templates, make, rand: rnd(3) });
    assert.equal(X.answerItem(exam, item, 9), exam);
    exam = X.answerItem(exam, item, right(item));
    assert.equal(exam.items.length, 1);
    const again = X.answerItem(exam, exam.items[0], wrong(exam.items[0]));
    assert.equal(again, exam, 'ya contestado: ignorado');
  });

  it('no se repite la misma plantilla en reactivos seguidos cuando hay variedad', () => {
    const topics = topicsOf(6);
    const exam = play(X.startExam({ topics, label: 'x', now: T0 }), right);
    const ids = exam.items.map((i) => i.ex.templateId);
    for (let i = 1; i < ids.length; i++) assert.notEqual(ids[i], ids[i - 1]);
    assert.equal(exam.items.length, 10);
  });
});

describe('examen: tiempo, calificación y efectos', () => {
  it('reloj: 20 minutos desde el inicio, nunca negativo', () => {
    const exam = X.startExam({ topics: topicsOf(1), label: 'x', now: T0 });
    assert.equal(exam.deadline - exam.startedAt, 20 * 60_000);
    assert.equal(X.timeLeftMs(exam, T0), 1_200_000);
    assert.equal(X.isExpired(exam, T0 + 1_199_999), false);
    assert.equal(X.isExpired(exam, T0 + 1_200_000), true);
    assert.equal(X.timeLeftMs(exam, T0 + 9_999_999), 0);
    assert.equal(X.formatClock(1_200_000), '20:00');
    assert.equal(X.formatClock(61_000), '01:01');
    assert.equal(X.formatClock(0), '00:00');
    assert.equal(X.formatClock(999), '00:01', 'redondea hacia arriba: no muestra 00:00 con tiempo');
  });
  it('finishExam fija la hora de entrega sin pasar del límite y es idempotente', () => {
    const exam = X.startExam({ topics: topicsOf(1), label: 'x', now: T0 });
    const f = X.finishExam(exam, T0 + 5_000_000);
    assert.equal(f.finishedAt, exam.deadline);
    assert.equal(X.finishExam(f, T0), f);
  });
  it('calificación 0–10 sobre los 10 reactivos; sin contestar cuenta como error; aprueba con 6', () => {
    const all = X.gradeExam(play(X.startExam({ topics: topicsOf(4), label: 'x', now: T0 }), right));
    assert.deepEqual([all.correct, all.score, all.passed, all.answered], [10, 10, true, 10]);
    const none = X.gradeExam(play(X.startExam({ topics: topicsOf(4), label: 'x', now: T0 }), wrong));
    assert.deepEqual([none.correct, none.score, none.passed], [0, 0, false]);
    let k = 0;
    const six = X.gradeExam(play(X.startExam({ topics: topicsOf(4), label: 'x', now: T0 }), (it) => (k++ < 6 ? right(it) : wrong(it))));
    assert.deepEqual([six.correct, six.score, six.passed], [6, 6, true]);
    k = 0;
    const five = X.gradeExam(play(X.startExam({ topics: topicsOf(4), label: 'x', now: T0 }), (it) => (k++ < 5 ? right(it) : wrong(it))));
    assert.equal(five.passed, false);
    // entregado a la mitad: 4 de 4 contestadas = 4/10, no 10/10
    let exam = X.startExam({ topics: topicsOf(4), label: 'x', now: T0 });
    const rng = rnd(8);
    for (let i = 0; i < 4; i++) {
      const it = X.nextItem(exam, { templates, make, rand: rng });
      exam = X.answerItem(exam, it, right(it));
    }
    const half = X.gradeExam(X.finishExam(exam, T0));
    assert.equal(half.total, 10);
    assert.equal(half.answered, 4);
    assert.equal(half.score, 4, '4 correctas de 10 reactivos = 4.0, no 10');
    assert.equal(half.passed, false);
  });
  it('applyExam: aplica XP y dominio por reactivo contestado y guarda historial (máx. 20)', () => {
    const exam = play(X.startExam({ topics: topicsOf(4), label: 'Cálculo', now: T0 }), right);
    const r = X.applyExam(L.defaultState(), exam, '2026-10-21');
    assert.ok(r.xpGained > 0);
    assert.equal(r.state.xp, r.xpGained);
    assert.equal(r.state.stats.answered, 10);
    assert.equal(r.state.stats.correct, 10);
    assert.equal(r.state.exams.length, 1);
    assert.deepEqual([r.entry.label, r.entry.score, r.entry.correct, r.entry.total, r.entry.at], ['Cálculo', 10, 10, 10, '2026-10-21']);
    // sin ayuda: los puntos no se reducen a la mitad como en práctica con paso a paso
    const expected = exam.items.reduce((a, i) => a + L.xpForAnswer({ correct: true, difficulty: i.ex.difficulty }), 0);
    assert.equal(r.xpGained, expected);
    let s = r.state;
    for (let i = 0; i < 25; i++) s = X.applyExam(s, exam, '2026-10-21').state;
    assert.equal(s.exams.length, 20);
    // incorrectos: sin XP pero cuentan intentos
    const bad = X.applyExam(L.defaultState(), play(X.startExam({ topics: topicsOf(4), label: 'x', now: T0 }), wrong), '2026-10-21');
    assert.deepEqual([bad.xpGained, bad.state.stats.answered, bad.state.stats.correct], [0, 10, 0]);
  });
  it('el historial se limpia al cargar el estado guardado (datos del navegador no son de fiar)', () => {
    const good = { at: '2026-10-21', label: 'Álgebra', score: 7.5, correct: 7, total: 10, seconds: 300 };
    const s = L.normalizeState({ ...L.defaultState(), exams: [good, null, 'x', { label: 3 }, { ...good, score: 11 }, { ...good, score: -1 }, { ...good, correct: 1.5 }, { ...good, label: 'L'.repeat(500) }] });
    assert.equal(s.exams.length, 2);
    assert.deepEqual(s.exams[0], good);
    assert.equal(s.exams[1].label.length, 80);
    assert.deepEqual(L.normalizeState({ ...L.defaultState(), exams: 'basura' }).exams, []);
    assert.deepEqual(L.normalizeState({ ...L.defaultState(), exams: undefined }).exams, []);
    assert.deepEqual(L.defaultState().exams, []);
  });
});

describe('prepareImage', () => {
  const file = (type = 'image/png', size = 1000) => ({ type, size });
  const loader = (w, h) => async () => ({ width: w, height: h, source: {}, release() { this.released = true; } });

  it('rechaza lo que no es imagen o es enorme, sin intentar decodificarlo', async () => {
    let called = false;
    const load = async () => ((called = true), { width: 1, height: 1, source: {} });
    for (const f of [null, file('application/pdf'), file('text/html'), file('image/svg+xml'), file('image/png', 30 * 1024 * 1024)]) {
      await assert.rejects(prepareImage(f, { load, encode: () => 'x' }), ImageError);
    }
    assert.equal(called, false);
  });
  it('escala a máx. 1280 px conservando la proporción y devuelve JPEG', async () => {
    const seen = [];
    const out = await prepareImage(file(), { load: loader(4000, 3000), encode: (_s, w, h, q) => (seen.push([w, h, q]), 'AAAA') });
    assert.deepEqual([out.mediaType, out.width, out.height, out.data], ['image/jpeg', 1280, 960, 'AAAA']);
    assert.deepEqual(seen, [[1280, 960, 0.82]]);
    const small = await prepareImage(file(), { load: loader(800, 600), encode: () => 'BBBB' });
    assert.deepEqual([small.width, small.height], [800, 600], 'no agranda imágenes chicas');
    const tall = await prepareImage(file(), { load: loader(1000, 5000), encode: () => 'C' });
    assert.deepEqual([tall.width, tall.height], [256, 1280]);
  });
  it('si todavía pesa de más reduce más; si nunca cabe, falla; siempre libera la imagen', async () => {
    const widths = [];
    const l = loader(3000, 3000);
    const out = await prepareImage(file(), { load: l, encode: (_s, w) => (widths.push(w), widths.length < 3 ? 'A'.repeat(MAX_B64 + 1) : 'ok') });
    assert.deepEqual(widths, [1280, 960, 720]);
    assert.equal(out.data, 'ok');
    let released = false;
    await assert.rejects(prepareImage(file(), { load: async () => ({ width: 3000, height: 3000, source: {}, release: () => (released = true) }), encode: () => 'A'.repeat(MAX_B64 + 1) }), (e) => e.code === 'too_big');
    assert.equal(released, true);
    await assert.rejects(prepareImage(file(), { load: async () => { throw new Error('corrupta'); }, encode: () => 'x' }), (e) => e.code === 'decode');
  });
});
