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
import { IDEAS } from '../js/engine/ideas.js';
import { Fraction, numericDistractors } from '../js/engine/utils.js';
import { ORACLES_N4 } from './oracles/n4.js';
import { ORACLES_N5 } from './oracles/n5.js';
import { ORACLES_PLUS } from './oracles/plus.js';
import { ORACLES_FI } from './oracles/fi.js';

const ORACLES = { ...ORACLES_N1, ...ORACLES_N2, ...ORACLES_N3, ...ORACLES_N4, ...ORACLES_N5, ...ORACLES_PLUS, ...ORACLES_FI };
// Respuestas cuyo LaTeX no puede evaluar el compilador de pruebas (π, i, intervalos…): se verifican con su oráculo.
const NO_COMPILE = new Set(['mn-biseccion', 'vc-potencia-i', 'vc-division', 'vc-derivada', 'ss-periodo', 'ss-estabilidad', 'op-hessiana', 'vec-polar', 'vc-cauchy', 'ma-laplace-edo', 'mo-sistema-lineal',
  're-desigualdad-abs', 'cx-polar-operaciones', 'cx-demoivre', 'cx-raices', 'cx-ecuacion', 'fou-complejo', 'vc-integral-linea', 'vc-cauchy-derivada', 'vc-mapeo-z2', 'vc-mobius', 'vc-inversion']);

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

describe('calidad del LaTeX y de ss-estabilidad', () => {
  it('ningún texto matemático trae un ; suelto', () => {
    for (const t of templates) {
      forEachSeed(t.id, (ex) => {
        const all = [ex.statement.latex, ex.answer.latex, ...ex.steps.map((s) => s.latex), ...ex.distractors.map((d) => d.latex)];
        for (const tex of all) if (tex) assert.doesNotMatch(tex, /(?<!\\);/, tex);
      });
    }
  });
  it('ss-estabilidad: las tres clases aparecen parejas y cada opción tiene su explicación', () => {
    const count = {};
    forEachSeed('ss-estabilidad', (ex) => {
      count[ex.answer.latex] = (count[ex.answer.latex] ?? 0) + 1;
      assert.equal(new Set(ex.distractors.map((d) => d.feedback)).size, 3);
    });
    assert.equal(Object.keys(count).length, 3);
    for (const n of Object.values(count)) assert.ok(n / SEEDS > 0.25 && n / SEEDS < 0.42, JSON.stringify(count));
  });
});

describe('redacción de enunciados', () => {
  it('sin x^n en texto, sin coeficiente 1 suelto, sin (s) y sin 1 éxitos', () => {
    forEachSeed('alg-binomio', (ex) => assert.doesNotMatch(ex.statement.text, /\^/));
    forEachSeed('ma-taylor', (ex) => assert.doesNotMatch(ex.statement.text, /\^/));
    forEachSeed('ma-geometrica', (ex) => assert.doesNotMatch(ex.statement.latex, /infty\} 1/));
    forEachSeed('ss-estabilidad', (ex) => assert.doesNotMatch(ex.statement.latex, /[{)]\(s\)/));
    forEachSeed('pe-binomial', (ex) => assert.doesNotMatch(ex.statement.text, /\b1 éxitos/));
  });
});

describe('retroalimentación', () => {
  it('cada plantilla tiene una idea clave breve y no sobran ideas', () => {
    for (const t of templates) {
      const { idea } = generateExercise(t.id, 11);
      assert.ok(typeof idea === 'string' && idea.length >= 20 && idea.length <= 130, `${t.id}: ${idea}`);
    }
    assert.deepEqual(Object.keys(IDEAS).sort(), templates.map((t) => t.id).sort());
  });
  it('todas las opciones explican su error sin mensajes genéricos', () => {
    for (const t of templates) {
      forEachSeed(t.id, (ex) => {
        for (const d of ex.distractors) {
          assert.ok(d.feedback?.length > 5);
          assert.doesNotMatch(d.feedback, /Revisa la aritmética/);
        }
        assert.equal(new Set(ex.distractors.map((d) => d.feedback)).size, ex.distractors.length, 'cada opción explica su propio error');
      });
    }
  });
  it('el mensaje de cercanía dice la distancia real al resultado', () => {
    const [arriba] = numericDistractors(new Fraction(5), [], 1);
    assert.equal(arriba.latex, '6');
    assert.match(arriba.feedback, /1 por encima/);
    const pad = numericDistractors(new Fraction(5), [], 4);
    assert.deepEqual(pad.map((d) => d.latex), ['6', '4', '7', '3']);
    assert.equal(new Set(pad.map((d) => d.feedback)).size, 4);
  });
});

describe('variedad y escala de dificultad', () => {
  it('cada tema tiene al menos 2 plantillas', () => {
    const n = {};
    for (const t of templates) n[t.topic] = (n[t.topic] ?? 0) + 1;
    for (const lvl of CURRICULUM) for (const s of lvl.subjects) for (const tp of s.topics) assert.ok(n[tp] >= 2, `${tp}: solo ${n[tp]}`);
  });
  it('existen ejercicios de dificultad 4 y 5 en cantidad útil', () => {
    const at = (d) => templates.filter((t) => t.difficulty === d).length;
    assert.ok(at(4) >= 12, `dificultad 4: ${at(4)}`);
    assert.ok(at(5) >= 12, `dificultad 5: ${at(5)}`);
    for (const lvl of CURRICULUM.slice(0, 4)) {
      const topics = lvl.subjects.flatMap((s) => s.topics);
      assert.ok(templates.some((t) => t.difficulty === 5 && topics.includes(t.topic)), `nivel ${lvl.level} sin dificultad 5`);
    }
  });
  it('derivada-logaritmica ya tiene variantes suficientes', () => {
    const set = new Set();
    for (let seed = 1; seed <= 600; seed++) set.add(generateExercise('derivada-logaritmica', seed).statement.latex);
    assert.ok(set.size >= 18, `solo ${set.size}`);
  });
});

describe('revisión de redacción', () => {
  it('concordancia y exponentes bien escritos', () => {
    forEachSeed('al-traza-det', (ex) => assert.doesNotMatch(ex.statement.text, /el suma/));
    forEachSeed('ed-lineal', (ex) => assert.doesNotMatch(ex.statement.text, /−1t/));
    forEachSeed('ed-pvi-segundo', (ex) => assert.doesNotMatch(ex.steps[1].latex, /\b0C_|\b1C_/));
  });
});
