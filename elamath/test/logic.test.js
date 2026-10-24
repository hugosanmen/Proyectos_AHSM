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

describe('créditos diarios', () => {
  const D1 = '2026-10-20';
  const D2 = '2026-10-21';

  it('estado inicial: 10/10 en plan gratis', () => {
    assert.deepEqual(L.creditsStatus(null, D1, 'free'), { used: 0, limit: 10, remaining: 10, plan: 'free' });
  });

  it('consume hasta agotar y luego rechaza sin mutar', () => {
    let c = null;
    for (let i = 0; i < 10; i++) {
      const r = L.consumeCredit(c, D1, 'free');
      assert.equal(r.ok, true);
      c = r.credits;
    }
    assert.equal(L.creditsStatus(c, D1, 'free').remaining, 0);
    const antes = JSON.stringify(c);
    const r = L.consumeCredit(c, D1, 'free');
    assert.equal(r.ok, false);
    assert.equal(JSON.stringify(r.credits), antes);
  });

  it('se reinician al cambiar de día', () => {
    const agotado = { date: D1, used: 10 };
    assert.equal(L.creditsStatus(agotado, D2, 'free').remaining, 10);
    assert.equal(L.consumeCredit(agotado, D2, 'free').ok, true);
  });

  it('Pro tiene un tope de uso justo mayor, no ilimitado', () => {
    assert.equal(L.creditsStatus(null, D1, 'pro').limit, 150);
    assert.equal(L.consumeCredit({ date: D1, used: 150 }, D1, 'pro').ok, false);
    assert.equal(L.consumeCredit({ date: D1, used: 11 }, D1, 'pro').ok, true);
  });

  it('plan desconocido se trata como gratis', () => {
    assert.equal(L.creditsStatus(null, D1, 'otro').limit, 10);
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
