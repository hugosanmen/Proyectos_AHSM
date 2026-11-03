import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import * as L from '../js/logic.js';

describe('niveles y XP', () => {
  it('levelInfo: umbrales exactos y progreso', () => {
    assert.equal(L.levelInfo(0).level, 1);
    assert.equal(L.levelInfo(39).level, 1);
    assert.equal(L.levelInfo(40).level, 2);
    assert.equal(L.levelInfo(99).level, 2);
    assert.equal(L.levelInfo(100).level, 3);
    const i = L.levelInfo(70); // nivel 2: 40..100
    assert.deepEqual([i.xpInto, i.xpNeeded, i.progress], [30, 60, 0.5]);
  });

  it('levelInfo: nivel máximo no se desborda', () => {
    const top = L.levelInfo(1_000_000);
    assert.equal(top.level, L.LEVEL_THRESHOLDS.length);
    assert.equal(top.isMax, true);
    assert.equal(top.progress, 1);
    assert.equal(top.title, L.LEVEL_TITLES.at(-1));
  });

  it('hay un título por cada nivel y umbrales estrictamente crecientes', () => {
    assert.equal(L.LEVEL_TITLES.length, L.LEVEL_THRESHOLDS.length);
    for (let i = 1; i < L.LEVEL_THRESHOLDS.length; i++) assert.ok(L.LEVEL_THRESHOLDS[i] > L.LEVEL_THRESHOLDS[i - 1]);
  });

  it('xpForAnswer: crece con la dificultad, 0 si falla, mitad con ayuda', () => {
    assert.equal(L.xpForAnswer({ correct: true, difficulty: 1 }), 10);
    assert.equal(L.xpForAnswer({ correct: true, difficulty: 3 }), 20);
    assert.equal(L.xpForAnswer({ correct: true, difficulty: 3, helped: true }), 10);
    assert.equal(L.xpForAnswer({ correct: false, difficulty: 5 }), 0);
  });
});

describe('dominio por tema', () => {
  it('ventana de 10 intentos', () => {
    let r = [];
    for (let i = 0; i < 15; i++) r = L.recordResult(r, i % 2 === 0);
    assert.equal(r.length, L.MASTERY_WINDOW);
  });

  it('dominado: ≥ 8 intentos y ≥ 80 % de aciertos', () => {
    assert.equal(L.isMastered(Array(7).fill(true)), false, 'muy pocos intentos');
    assert.equal(L.isMastered(Array(8).fill(true)), true);
    assert.equal(L.isMastered([...Array(8).fill(true), false, false]), true, '8/10 = 80 %');
    assert.equal(L.isMastered([...Array(7).fill(true), false, false, false]), false, '7/10');
    assert.equal(L.masteryRatio([]), 0);
  });
});

describe('racha', () => {
  it('dayDiff cruza meses y años', () => {
    assert.equal(L.dayDiff('2026-10-31', '2026-11-01'), 1);
    assert.equal(L.dayDiff('2026-12-31', '2027-01-01'), 1);
    assert.equal(L.dayDiff('2028-02-28', '2028-03-01'), 2, 'año bisiesto');
    assert.equal(L.dayDiff('2026-10-20', '2026-10-20'), 0);
  });

  it('updateStreak: primera vez, mismo día, día siguiente y ruptura', () => {
    let s = L.updateStreak(null, '2026-10-20');
    assert.deepEqual(s, { count: 1, last: '2026-10-20' });
    assert.equal(L.updateStreak(s, '2026-10-20'), s, 'mismo día no cambia');
    s = L.updateStreak(s, '2026-10-21');
    assert.equal(s.count, 2);
    s = L.updateStreak(s, '2026-10-23'); // se saltó un día
    assert.deepEqual(s, { count: 1, last: '2026-10-23' });
  });

  it('currentStreak: se considera rota si pasó más de un día', () => {
    const s = { count: 5, last: '2026-10-20' };
    assert.equal(L.currentStreak(s, '2026-10-20'), 5);
    assert.equal(L.currentStreak(s, '2026-10-21'), 5, 'aún se puede continuar hoy');
    assert.equal(L.currentStreak(s, '2026-10-22'), 0);
    assert.equal(L.currentStreak(null, '2026-10-22'), 0);
  });

  it('localDateString usa la fecha local con ceros a la izquierda', () => {
    assert.equal(L.localDateString(new Date(2026, 0, 5, 23, 59)), '2026-01-05');
  });
});

describe('estado', () => {
  it('normalizeState: valores inválidos o de otra versión vuelven al estado por defecto', () => {
    assert.deepEqual(L.normalizeState(null), L.defaultState());
    assert.deepEqual(L.normalizeState({ version: 999, xp: 5000 }), L.defaultState());
    assert.deepEqual(L.normalizeState('basura'), L.defaultState());
  });

  it('normalizeState: sanea xp negativo, plan desconocido y campos faltantes', () => {
    const s = L.normalizeState({ version: L.STATE_VERSION, xp: -5, plan: 'vip' });
    assert.equal(s.xp, 0);
    assert.equal(s.plan, 'free');
    assert.deepEqual(s.stats, { answered: 0, correct: 0 });
    assert.deepEqual(s.topics, {});
  });

  it('applyAnswer: suma XP, registra tema, racha y no muta el estado original', () => {
    const s0 = L.defaultState();
    const copia = JSON.stringify(s0);
    const r = L.applyAnswer(s0, { topic: 'Límites', correct: true, difficulty: 2, today: '2026-10-20' });
    assert.equal(JSON.stringify(s0), copia, 'inmutable');
    assert.equal(r.xpGained, 15);
    assert.equal(r.state.xp, 15);
    assert.deepEqual(r.state.topics['Límites'].recent, [true]);
    assert.deepEqual(r.state.stats, { answered: 1, correct: 1 });
    assert.deepEqual(r.state.streak, { count: 1, last: '2026-10-20' });
    assert.equal(r.leveledUp, false);
  });

  it('applyAnswer: fallo no da XP pero sí cuenta el intento', () => {
    const r = L.applyAnswer(L.defaultState(), { topic: 'Derivadas', correct: false, difficulty: 3, today: '2026-10-20' });
    assert.equal(r.state.xp, 0);
    assert.deepEqual(r.state.stats, { answered: 1, correct: 0 });
    assert.deepEqual(r.state.topics['Derivadas'].recent, [false]);
  });

  it('applyAnswer: detecta la subida de nivel justo en el umbral', () => {
    const s = { ...L.defaultState(), xp: 30 };
    const sube = L.applyAnswer(s, { topic: 'Límites', correct: true, difficulty: 1, today: '2026-10-20' }); // 30 + 10 = 40
    assert.equal(sube.leveledUp, true);
    assert.equal(sube.level, 2);
    const no = L.applyAnswer({ ...s, xp: 29 }, { topic: 'Límites', correct: true, difficulty: 1, today: '2026-10-20' }); // 39
    assert.equal(no.leveledUp, false);
  });
});

describe('examen en curso guardado', () => {
  const ex = { topic: 'Límites', statement: { text: 'x' }, options: [{ latex: '1', correct: true }] };
  const exam = { topics: ['Límites'], label: 'Cálculo', questions: 10, startedAt: 1, deadline: 2, target: 2, items: [], finished: false };
  it('conserva uno válido y descarta formas inválidas', () => {
    const ok = { exam, item: { ex, picked: null, correct: null }, minDifficulty: 3 };
    assert.deepEqual(L.normalizeActiveExam(ok), ok);
    for (const bad of [null, {}, { exam: { ...exam, topics: [] } }, { exam: { ...exam, deadline: 'x' } }, { exam: { ...exam, finished: true } }, { exam, item: { ex: {}, picked: null } }, { exam: { ...exam, items: [{}] } }]) {
      assert.equal(L.normalizeActiveExam(bad), null);
    }
  });
});

describe('avance de dominio visible', () => {
  it('un solo acierto no llena la barra; con 8 o más intentos coincide con el dominio real', () => {
    assert.equal(L.masteryShown([true]), 1 / 8);
    assert.equal(L.masteryShown([]), 0);
    const ocho = [true, true, true, true, true, true, false, false];
    assert.equal(L.masteryShown(ocho), L.masteryRatio(ocho));
  });
});

describe('estado anterior', () => {
  it('quita el contador obsoleto de paso a paso y conserva el progreso', () => {
    const s = L.normalizeState({ ...L.defaultState(), xp: 25, credits: { date: '2026-11-01', used: 10 } });
    assert.equal(s.xp, 25);
    assert.equal('credits' in s, false);
  });
});

describe('preferencias de inicio', () => {
  it('valida semestre y última práctica guardados', () => {
    const ok = L.normalizeState({ ...L.defaultState(), homeLevel: 3, welcomed: true, lastPractice: { subjectId: 'algebra', topic: null } });
    assert.deepEqual([ok.homeLevel, ok.welcomed, ok.lastPractice], [3, true, { subjectId: 'algebra', topic: null }]);
    const mal = L.normalizeState({ ...L.defaultState(), homeLevel: 9, welcomed: 'si', lastPractice: { subjectId: 7 } });
    assert.deepEqual([mal.homeLevel, mal.welcomed, mal.lastPractice], [null, false, null]);
  });
});

describe('temas para repasar', () => {
  const t = (...r) => ({ recent: r });
  it('exige 3 intentos, menos de 70 % y ordena del más débil al menos débil', () => {
    const topics = { A: t(true, true, false), B: t(false, false, false), C: t(false, false), D: t(true, true, true), E: t(true, false, false) };
    assert.deepEqual(L.weakTopics(topics).map((x) => x.topic), ['B', 'E', 'A']);
  });
  it('limita la lista y puede filtrar por temas', () => {
    const topics = { A: t(false, false, false), B: t(false, false, false), C: t(false, false, false), D: t(false, false, false) };
    assert.equal(L.weakTopics(topics).length, 3);
    assert.deepEqual(L.weakTopics(topics, { only: ['D'] }).map((x) => x.topic), ['D']);
    assert.deepEqual(L.weakTopics(null), []);
  });
});
