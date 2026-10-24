// engine.test.js — pruebas del motor paramétrico (node --test)
//
// Idea central: cada plantilla se prueba contra un ORÁCULO INDEPENDIENTE que reconstruye el
// problema solo a partir de los parámetros y lo resuelve numéricamente (diferencias finitas,
// límites numéricos, búsqueda por fuerza bruta). Además, el LaTeX que verá el estudiante
// (enunciado y respuesta) se compila y se evalúa, así que un error de tipografía matemática
// también rompe las pruebas.
//
// Número de semillas por plantilla: SEEDS=5000 npm test  (por defecto 1000)

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { baseTemplates as templates, generateExercise, generateSet, toMultipleChoice } from '../js/engine/index.js';
import { Fraction, polyLatex, createRng } from '../js/engine/utils.js';
import { compileLatex } from './latexEval.js';

const SEEDS = Number(process.env.SEEDS ?? 1000);

// ── Ayudas numéricas ────────────────────────────────────────────
const close = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
const assertClose = (a, b, msg, tol) => assert.ok(close(a, b, tol), `${msg}: obtenido ${a}, esperado ${b}`);
const diff = (f, x, h = 1e-5) => (f(x + h) - f(x - h)) / (2 * h);
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

// ── Oráculos independientes (uno por plantilla) ─────────────────
const ORACLES = {
  'lim-factorizacion'(ex) {
    const { a, r } = ex.params;
    const f = compileLatex(ex.expr);
    for (const dx of [0.7, -1.3, 2.1]) assertClose(f({ x: a + dx }), a + dx - r, 'expr del enunciado', 1e-9);
    const h = 1e-3;
    assertClose((f({ x: a + h }) + f({ x: a - h })) / 2, ex.answer.value, 'límite numérico');
  },

  'lim-trigonometrico'(ex) {
    const { k, m } = ex.params;
    const f = compileLatex(ex.expr);
    for (const x of [0.37, -0.81, 1.9]) assertClose(f({ x }), Math.sin(k * x) / (m * x), 'expr del enunciado', 1e-9);
    const h = 1e-5;
    assertClose((f({ x: h }) + f({ x: -h })) / 2, ex.answer.value, 'límite numérico');
  },

  'lim-infinito'(ex) {
    const { a, b, c, d, e } = ex.params;
    const g = (x) => (a * x * x + b * x + c) / (d * x * x + e);
    const f = compileLatex(ex.expr);
    for (const x of [2.3, -1.7, 0.4]) assertClose(f({ x }), g(x), 'expr del enunciado', 1e-9);
    assertClose(g(1e8), ex.answer.value, 'límite numérico en +∞');
    assertClose(g(-1e8), ex.answer.value, 'límite numérico en −∞');
  },

  'derivada-cadena'(ex) {
    const { outer, n, a, b } = ex.params;
    const F = { sin: Math.sin, cos: Math.cos, exp: Math.exp, ln: Math.log };
    const f = (x) => F[outer](a * x ** n + b);
    const fe = compileLatex(ex.expr);
    const fd = compileLatex(ex.answer.latex);
    for (const x of [0.4, 0.8, 1.2]) {
      assertClose(fe({ x }), f(x), 'expr del enunciado', 1e-9);
      assertClose(fd({ x }), diff(f, x), `f'(${x})`);
    }
  },

  'derivada-cociente'(ex) {
    const { p, q, r } = ex.params;
    const f = (x) => (p * x * x + q) / (x + r);
    const fe = compileLatex(ex.expr);
    const fd = compileLatex(ex.answer.latex);
    let probados = 0;
    for (let x = -6; x <= 6; x += 0.53) {
      if (Math.abs(x + r) < 0.5) continue;
      assertClose(fe({ x }), f(x), 'expr del enunciado', 1e-9);
      assertClose(fd({ x }), diff(f, x), `f'(${x})`);
      probados++;
    }
    assert.ok(probados > 10);
  },

  'derivada-implicita'(ex) {
    const { x0, y0, R } = ex.params;
    assert.equal(compileLatex(ex.expr)({ x: x0, y: y0 }), R * R, 'el punto debe estar en la curva');
    const general = compileLatex(ex.answer.general);
    const rama = (sy) => (x) => sy * Math.sqrt(R * R - x * x);
    assertClose(diff(rama(Math.sign(y0)), x0), ex.answer.value, 'pendiente numérica en el punto');
    assertClose(general({ x: x0, y: y0 }), ex.answer.value, 'fórmula general en el punto');
    assertClose(compileLatex(ex.answer.latex)({}), ex.answer.value, 'latex de la respuesta');
    for (const th of [0.3, 0.9, 2.0, 2.8, 4.0, 5.5]) {
      const x = R * Math.cos(th);
      const y = R * Math.sin(th);
      assertClose(general({ x, y }), diff(rama(Math.sign(y)), x), `pendiente en θ=${th}`, 1e-5);
    }
  },

  'extremos-cubica'(ex) {
    const { p, q } = ex.params;
    const fx = compileLatex(ex.expr);
    const F = (x) => fx({ x });
    const maximos = [];
    const minimos = [];
    const paso = 0.001;
    // Se rastrea el último signo NO nulo de f': si la malla cae justo en un punto crítico
    // (f' = 0 exacto), el cambio de signo se detecta en la siguiente muestra.
    let ultimo = 0;
    for (let x = p - 3; x <= q + 3; x += paso) {
      const s = Math.sign(diff(F, x));
      if (s === 0) continue;
      if (ultimo > 0 && s < 0) maximos.push(x);
      if (ultimo < 0 && s > 0) minimos.push(x);
      ultimo = s;
    }
    assert.equal(maximos.length, 1, 'debe haber exactamente un máximo local');
    assert.equal(minimos.length, 1, 'debe haber exactamente un mínimo local');
    assert.ok(Math.abs(maximos[0] - ex.answer.max.x) < 0.002, `máximo numérico en ${maximos[0]}`);
    assert.ok(Math.abs(minimos[0] - ex.answer.min.x) < 0.002, `mínimo numérico en ${minimos[0]}`);
    assertClose(F(ex.answer.max.x), ex.answer.max.y, 'valor del máximo', 1e-9);
    assertClose(F(ex.answer.min.x), ex.answer.min.y, 'valor del mínimo', 1e-9);
    assert.ok(ex.answer.max.y > ex.answer.min.y);
  },

  'optimizacion-area'(ex) {
    const { variant, k } = ex.params;
    const [w, l] = ex.answer.dims;
    // la solución propuesta debe usar exactamente la cerca disponible
    if (variant === 'perimetro') assert.equal(2 * (w + l), 4 * k, 'usa todo el perímetro');
    else assert.equal(2 * w + l, 4 * k, 'usa los tres lados con cerca');
    assert.equal(w * l, ex.answer.area, 'área = base × altura');
    // búsqueda por fuerza bruta del ancho óptimo
    const area = variant === 'perimetro' ? (x) => x * (2 * k - x) : (x) => x * (4 * k - 2 * x);
    let mejorX = 0;
    let mejorA = -Infinity;
    for (let x = 0; x <= 2 * k; x += 0.25) {
      if (area(x) > mejorA) {
        mejorA = area(x);
        mejorX = x;
      }
    }
    assert.equal(mejorX, w, 'ancho óptimo por fuerza bruta');
    assert.equal(mejorA, ex.answer.area, 'área máxima por fuerza bruta');
    assert.ok(ex.answer.latex.includes(`A=${mejorA}`));
  },

  'razones-relacionadas'(ex) {
    const { L, b, h, v } = ex.params;
    assert.equal(b * b + h * h, L * L, 'terna pitagórica válida');
    const y = (t) => Math.sqrt(L * L - (b + v * t) ** 2);
    assertClose(y(0), h, 'altura inicial');
    const dt = 1e-6;
    assertClose((y(dt) - y(-dt)) / (2 * dt), ex.answer.value, 'dy/dt numérico');
    assertClose(compileLatex(ex.answer.latex)({}), ex.answer.value, 'latex de la respuesta');
    assert.ok(ex.answer.value < 0, 'la altura debe disminuir');
  },

  'derivada-logaritmica'(ex) {
    const { variant, k } = ex.params;
    const g = variant === 'lineal' ? (x) => k * x : variant === 'potencia' ? (x) => x ** k : (x) => Math.sin(k * x);
    const f = (x) => Math.pow(x, g(x));
    const fe = compileLatex(ex.expr);
    const fd = compileLatex(ex.answer.latex);
    for (const x of [0.5, 1, 1.7, 2.4]) {
      assertClose(fe({ x }), f(x), 'expr del enunciado', 1e-9);
      assertClose(fd({ x }), diff(f, x), `f'(${x})`);
    }
  },
};

// Plantillas cuya respuesta es una expresión: los distractores deben ser DISTINTOS numéricamente.
const EXPRESIONES = {
  'derivada-cadena': () => [0.4, 0.8, 1.2].map((x) => ({ x })),
  'derivada-cociente': (ex) => [1.3, 2.1, -1.7].map((d) => ({ x: -ex.params.r + d })),
  'derivada-logaritmica': () => [0.5, 1.7, 2.4].map((x) => ({ x })),
};
// Plantillas con respuesta numérica pura: su LaTeX debe valer lo mismo que `value`.
const NUMERICAS = ['lim-factorizacion', 'lim-trigonometrico', 'lim-infinito', 'derivada-implicita', 'razones-relacionadas'];

// ── Pruebas de utilidades ───────────────────────────────────────
describe('utilidades', () => {
  it('RNG: determinista y dentro de rango', () => {
    const a = createRng(42);
    const b = createRng(42);
    for (let i = 0; i < 100; i++) {
      const v = a.int(-5, 5);
      assert.equal(v, b.int(-5, 5));
      assert.ok(v >= -5 && v <= 5);
    }
    assert.notEqual(createRng(1).next(), createRng(2).next());
  });

  it('Fraction: reduce, normaliza signo y formatea', () => {
    assert.equal(new Fraction(6, -4).toLatex(), '-\\frac{3}{2}');
    assert.equal(new Fraction(8, 2).toLatex(), '4');
    assert.equal(new Fraction(0, 5).toLatex(), '0');
    assert.equal(new Fraction(-0, 3).n, 0);
    assert.throws(() => new Fraction(1, 0));
  });

  it('polyLatex: signos, coeficientes 1 y términos nulos', () => {
    assert.equal(polyLatex([2, 0, -3, 1]), 'x^{3} - 3x^{2} + 2');
    assert.equal(polyLatex([-3, 1]), 'x - 3');
    assert.equal(polyLatex([0, 2]), '2x');
    assert.equal(polyLatex([0, 0, 0]), '0');
    assert.equal(polyLatex([-1, 0, -1]), '-x^{2} - 1');
  });
});

describe('evaluador de LaTeX (herramienta de pruebas)', () => {
  const ev = (s, env = {}) => compileLatex(s)(env);
  it('aritmética básica y multiplicación implícita', () => {
    assert.equal(ev('2x+3', { x: 4 }), 11);
    assert.equal(ev('3x^{2}-x', { x: 2 }), 10);
    assert.equal(ev('-\\frac{3}{4}'), -0.75);
    assert.equal(ev('\\frac{x^{2}-4}{x-2}', { x: 5 }), 7);
  });
  it('funciones y exponentes', () => {
    assertClose(ev('2x\\cos(x^{2}+1)', { x: 1 }), 2 * Math.cos(2), 'cos', 1e-12);
    assertClose(ev('x^{x}(\\ln x+1)', { x: 2 }), 4 * (Math.log(2) + 1), 'x^x', 1e-12);
    assertClose(ev('2x\\cdot e^{x^{2}+1}', { x: 1 }), 2 * Math.exp(2), 'exp', 1e-12);
    assertClose(ev('\\cos x\\ln x+\\frac{\\sin x}{x}', { x: 2 }), Math.cos(2) * Math.log(2) + Math.sin(2) / 2, 'trig', 1e-12);
  });
  it('rechaza lo que no entiende', () => {
    assert.throws(() => ev('x=2'), /no soportados/);
    assert.throws(() => ev('\\sqrt{x}'), /no soportado/i);
    assert.throws(() => ev('x+'), /incompleta/);
    assert.throws(() => ev('x', {}), /no definida/);
  });
});

// ── Pruebas por plantilla ───────────────────────────────────────
describe('catálogo', () => {
  it('hay 10 plantillas con id único y un oráculo cada una', () => {
    assert.equal(templates.length, 10);
    assert.equal(new Set(templates.map((t) => t.id)).size, 10);
    for (const t of templates) assert.equal(typeof ORACLES[t.id], 'function', `falta oráculo de ${t.id}`);
  });
});

for (const t of templates) {
  describe(`plantilla ${t.id}`, () => {
    it(`es reproducible (misma semilla → mismo ejercicio)`, () => {
      for (let seed = 1; seed <= 50; seed++) {
        assert.deepEqual(generateExercise(t.id, seed), generateExercise(t.id, seed));
      }
    });

    it(`estructura válida en ${SEEDS} semillas`, () => {
      forEachSeed(t.id, (ex) => {
        assert.ok(ex.statement.text.length > 10);
        assert.ok(ex.answer.latex.length > 0);
        assert.ok(ex.steps.length >= 2, 'al menos 2 pasos');
        for (const s of ex.steps) {
          assert.ok(typeof s.latex === 'string' && s.latex.length > 0);
          assert.ok(typeof s.note === 'string' && s.note.length > 0);
        }
        const blob = JSON.stringify(ex);
        assert.ok(!/NaN|undefined|null|Infinity/.test(blob), 'valores inválidos en el ejercicio');
        const latexes = [ex.statement.latex, ex.answer.latex, ...ex.steps.map((s) => s.latex), ...ex.distractors.map((d) => d.latex)];
        for (const l of latexes) assert.ok(balanced(l), `llaves desbalanceadas: ${l}`);
      });
    });

    it(`la respuesta coincide con el oráculo independiente en ${SEEDS} semillas`, () => {
      forEachSeed(t.id, (ex) => ORACLES[t.id](ex));
    });

    it('tiene 3 distractores únicos, distintos de la respuesta y con retroalimentación', () => {
      forEachSeed(t.id, (ex) => {
        assert.equal(ex.distractors.length, 3);
        const todos = [ex.answer.latex, ...ex.distractors.map((d) => d.latex)];
        assert.equal(new Set(todos).size, 4, 'opciones repetidas');
        for (const d of ex.distractors) assert.ok(d.feedback.length > 10);
      });
    });

    if (EXPRESIONES[t.id]) {
      it('los distractores son numéricamente distintos de la respuesta correcta', () => {
        forEachSeed(t.id, (ex) => {
          const puntos = EXPRESIONES[t.id](ex);
          const correcta = compileLatex(ex.answer.latex);
          for (const d of ex.distractors) {
            const f = compileLatex(d.latex);
            const distinto = puntos.some((p) => !close(f(p), correcta(p), 1e-9));
            assert.ok(distinto, `distractor equivalente a la respuesta: ${d.latex}`);
          }
        });
      });
    }

    if (NUMERICAS.includes(t.id)) {
      it('los distractores numéricos valen distinto que la respuesta', () => {
        forEachSeed(t.id, (ex) => {
          for (const d of ex.distractors) {
            if (d.latex.includes('\\infty')) continue;
            assert.ok(!close(compileLatex(d.latex)({}), ex.answer.value, 1e-12), `distractor igual a la respuesta: ${d.latex}`);
          }
        });
      });
    }

    it('genera variedad real de ejercicios', () => {
      const enunciados = new Set();
      forEachSeed(t.id, (ex) => enunciados.add(ex.statement.text + ex.statement.latex));
      assert.ok(enunciados.size >= 10, `solo ${enunciados.size} enunciados distintos`);
    });
  });
}

// ── API de alto nivel ───────────────────────────────────────────
describe('API', () => {
  it('toMultipleChoice: 4 opciones, exactamente 1 correcta y orden reproducible', () => {
    for (const t of templates) {
      for (let seed = 1; seed <= 100; seed++) {
        const mc = toMultipleChoice(generateExercise(t.id, seed));
        assert.equal(mc.options.length, 4);
        assert.equal(mc.options.filter((o) => o.correct).length, 1);
        assert.equal(mc.options.find((o) => o.correct).latex, mc.answer.latex);
        assert.deepEqual(mc, toMultipleChoice(generateExercise(t.id, seed)));
      }
    }
  });

  it('toMultipleChoice no siempre deja la correcta en la misma posición', () => {
    const posiciones = new Set();
    for (let seed = 1; seed <= 200; seed++) {
      const mc = toMultipleChoice(generateExercise('lim-trigonometrico', seed));
      posiciones.add(mc.options.findIndex((o) => o.correct));
    }
    assert.equal(posiciones.size, 4);
  });

  it('generateSet: respeta filtros y es reproducible', () => {
    const a = generateSet({ count: 20, topic: 'Límites', seed: 7 });
    assert.equal(a.length, 20);
    assert.ok(a.every((e) => e.topic === 'Límites'));
    assert.deepEqual(a, generateSet({ count: 20, topic: 'Límites', seed: 7 }));
    assert.ok(generateSet({ count: 30, maxDifficulty: 2, seed: 1 }).every((e) => e.difficulty <= 2));
    assert.throws(() => generateSet({ topic: 'Inexistente' }), /No hay plantillas/);
  });

  it('generateExercise: plantilla desconocida lanza error claro', () => {
    assert.throws(() => generateExercise('no-existe', 1), /desconocida/);
  });
});
