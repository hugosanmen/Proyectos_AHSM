// engine.extra.test.js — pruebas de las plantillas de las demás materias (niveles 1–5).
// Misma filosofía que engine.test.js: cada plantilla se verifica contra un oráculo independiente.
//   SEEDS=5000 npm test   (por defecto 600)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { extraTemplates, templates, generateExercise, toMultipleChoice } from '../js/engine/index.js';
import { CURRICULUM } from '../js/curriculum.js';
import { close, compileLatex, stripC, POINTS } from './oracles/common.js';
import { ORACLES_N1 } from './oracles/n1.js';
import { ORACLES_N2 } from './oracles/n2.js';
import { ORACLES_N3 } from './oracles/n3.js';
import { ORACLES_N4 } from './oracles/n4.js';
import { ORACLES_N5 } from './oracles/n5.js';

const ORACLES = { ...ORACLES_N1, ...ORACLES_N2, ...ORACLES_N3, ...ORACLES_N4, ...ORACLES_N5 };
// Respuestas cuyo LaTeX no puede evaluar el compilador de pruebas (π, i, intervalos…): se verifican con su oráculo.
const NO_COMPILE = new Set(['mn-biseccion', 'vc-potencia-i', 'vc-division', 'vc-derivada', 'ss-periodo', 'ss-estabilidad', 'op-hessiana']);

const SEEDS = Number(process.env.SEEDS ?? 600);
const balanced = (s) => (s.match(/{/g) ?? []).length === (s.match(/}/g) ?? []).length;

function forEachSeed(id, fn) {
  for (let seed = 1; seed <= SEEDS; seed++) {
    const ex = generateExercise(id, seed);
    try {
      fn(ex, seed);
    } catch (err) {
      throw new Error(`[${id} seed=${seed}] ${err.message}`, { cause: err });
    }
  }
}

describe('catálogo ampliado', () => {
  it('ids únicos en todo el motor y un oráculo por plantilla', () => {
    assert.equal(new Set(templates.map((t) => t.id)).size, templates.length);
    for (const t of extraTemplates) assert.equal(typeof ORACLES[t.id], 'function', `falta oráculo de ${t.id}`);
    for (const id of Object.keys(ORACLES)) assert.ok(extraTemplates.some((t) => t.id === id), `oráculo huérfano ${id}`);
  });

  it('cada materia del temario está disponible y todos sus temas tienen plantillas', () => {
    const topics = new Set(templates.map((t) => t.topic));
    for (const lvl of CURRICULUM) {
      for (const s of lvl.subjects) {
        assert.ok(s.available, `${s.name} sigue sin activar`);
        assert.ok(s.topics?.length >= 1, `${s.name} sin temas`);
        for (const tp of s.topics) assert.ok(topics.has(tp), `${s.name}: el tema «${tp}» no tiene plantillas`);
      }
    }
  });

  it('cada materia tiene al menos 4 plantillas distintas en sus temas (cobertura básica)', () => {
    for (const lvl of CURRICULUM) {
      for (const s of lvl.subjects) {
        const n = templates.filter((t) => s.topics.includes(t.topic)).length;
        assert.ok(n >= 4, `${s.name}: solo ${n} plantillas`);
      }
    }
  });
});

for (const t of extraTemplates) {
  describe(`plantilla ${t.id}`, () => {
    it('es reproducible', () => {
      for (let seed = 1; seed <= 50; seed++) assert.deepEqual(generateExercise(t.id, seed), generateExercise(t.id, seed));
    });

    it(`estructura válida en ${SEEDS} semillas`, () => {
      assert.ok(t.difficulty >= 1 && t.difficulty <= 5);
      forEachSeed(t.id, (ex) => {
        assert.ok(ex.statement.text.length > 10);
        assert.ok(ex.answer.latex.length > 0);
        assert.ok(ex.steps.length >= 2, 'al menos 2 pasos');
        for (const s of ex.steps) assert.ok(s.latex.length > 0 && s.note.length > 0);
        assert.ok(!/NaN|undefined|null|Infinity/.test(JSON.stringify(ex)), 'valores inválidos');
        const latexes = [ex.statement.latex, ex.answer.latex, ...ex.steps.map((s) => s.latex), ...ex.distractors.map((d) => d.latex)].filter(Boolean);
        for (const l of latexes) assert.ok(balanced(l), `llaves desbalanceadas: ${l}`);
      });
    });

    it(`la respuesta coincide con el oráculo independiente en ${SEEDS} semillas`, () => {
      forEachSeed(t.id, (ex) => ORACLES[t.id](ex));
    });

    it('3 distractores únicos, con retroalimentación, y numéricamente distintos de la respuesta', () => {
      forEachSeed(t.id, (ex) => {
        assert.equal(ex.distractors.length, 3);
        assert.equal(new Set([ex.answer.latex, ...ex.distractors.map((d) => d.latex)]).size, 4, 'opciones repetidas');
        for (const d of ex.distractors) assert.ok(d.feedback.length > 10);
        if (NO_COMPILE.has(t.id)) return;
        if (ex.vars) {
          const mk = (latex) => compileLatex(stripC(latex));
          const correcta = mk(ex.answer.latex);
          const env = (v) => Object.fromEntries(ex.vars.map((n) => [n, v]));
          for (const d of ex.distractors) {
            const f = mk(d.latex);
            assert.ok(POINTS.some((p) => !close(f(env(p)), correcta(env(p)), 1e-9)), `distractor equivalente: ${d.latex}`);
          }
        } else {
          const v = compileLatex(ex.answer.latex)({});
          assert.ok(close(v, ex.answer.value, 1e-9), `latex de la respuesta (${v}) ≠ value (${ex.answer.value})`);
          for (const d of ex.distractors) assert.ok(!close(compileLatex(d.latex)({}), ex.answer.value, 1e-12), `distractor igual a la respuesta: ${d.latex}`);
        }
      });
    });

    it('genera variedad real de ejercicios', () => {
      const set = new Set();
      forEachSeed(t.id, (ex) => set.add(ex.statement.text + ex.statement.latex));
      assert.ok(set.size >= 10, `solo ${set.size} enunciados distintos`);
    });

    it('toMultipleChoice: 4 opciones con exactamente 1 correcta', () => {
      for (let seed = 1; seed <= 100; seed++) {
        const mc = toMultipleChoice(generateExercise(t.id, seed));
        assert.equal(mc.options.length, 4);
        assert.equal(mc.options.filter((o) => o.correct).length, 1);
      }
    });
  });
}
