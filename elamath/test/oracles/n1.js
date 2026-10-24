// Oráculos del Nivel 1: cada uno reconstruye el problema SOLO desde los parámetros y lo resuelve por otro camino.
import assert from 'node:assert/strict';
import { assertClose, close, diff, simpson, stripC, sides, compileLatex, POINTS } from './common.js';

export const ORACLES_N1 = {
  'alg-lineal'(ex) {
    const { a, b, c, d } = ex.params;
    const [L, R] = sides(ex.statement.latex);
    for (const x of [-3, 0.5, 4]) {
      assertClose(L({ x }), a * x + b, 'lado izquierdo del enunciado', 1e-9);
      assertClose(R({ x }), c * x + d, 'lado derecho del enunciado', 1e-9);
    }
    const x = ex.answer.value;
    assertClose(a * x + b, c * x + d, 'la solución satisface la ecuación');
  },

  'alg-cuadratica'(ex) {
    const { r, s } = ex.params;
    const lhs = compileLatex(ex.statement.latex.replace(/\s*=\s*0$/, ''));
    const raices = [];
    for (let x = -30; x <= 30; x++) {
      assertClose(lhs({ x }), x * x - (r + s) * x + r * s, 'polinomio del enunciado', 1e-9);
      if (lhs({ x }) === 0) raices.push(x);
    }
    assert.equal(raices.length, 2, 'dos raíces enteras por fuerza bruta');
    assert.equal(Math.max(...raices), ex.answer.value);
  },

  'alg-sistema'(ex) {
    const { a, b, c, d, e, f } = ex.params;
    const sol = [];
    for (let x = -30; x <= 30; x++) for (let y = -30; y <= 30; y++) if (a * x + b * y === e && c * x + d * y === f) sol.push([x, y]);
    assert.equal(sol.length, 1, 'solución única por fuerza bruta');
    assert.equal(sol[0][0], ex.answer.value);
    assert.ok(ex.statement.latex.includes(`= ${e}`) && ex.statement.latex.includes(`= ${f}`));
  },

  'alg-log'(ex) {
    const { b, variant } = ex.params;
    const lg = (x) => Math.log(x) / Math.log(b);
    let v;
    if (variant === 'potencia') v = lg(b ** ex.params.k);
    else if (variant === 'inverso') v = lg(1 / b ** ex.params.k);
    else v = lg(b ** ex.params.m) + lg(b ** ex.params.n);
    assertClose(v, ex.answer.value, 'logaritmo numérico', 1e-9);
  },

  'alg-binomio'(ex) {
    const { n, k, a } = ex.params;
    let poly = [1]; // 1
    for (let i = 0; i < n; i++) {
      const next = new Array(poly.length + 1).fill(0);
      poly.forEach((c, p) => {
        next[p] += c * a; // · a
        next[p + 1] += c; // · x
      });
      poly = next;
    }
    assert.equal(poly[k], ex.answer.value);
    const f = compileLatex(ex.statement.latex);
    for (const x of [-1.5, 0.7, 2]) assertClose(f({ x }), (x + a) ** n, 'binomio del enunciado', 1e-9);
  },

  'ga-distancia'(ex) {
    const { x1, y1, x2, y2 } = ex.params;
    assertClose(Math.hypot(x2 - x1, y2 - y1), ex.answer.value, 'distancia');
    assert.ok(Number.isInteger(ex.answer.value));
  },

  'ga-pendiente'(ex) {
    const { x1, y1, x2, y2 } = ex.params;
    // la recta por los dos puntos pasa por ambos: y = m(x − x1) + y1
    const m = ex.answer.value;
    assertClose(m * (x2 - x1) + y1, y2, 'la recta pasa por Q');
  },

  'ga-dist-punto-recta'(ex) {
    const { A, B, C, x0, y0 } = ex.params;
    // otro camino: pie de la perpendicular y distancia euclidiana
    const t = (A * x0 + B * y0 + C) / (A * A + B * B);
    const fx = x0 - A * t;
    const fy = y0 - B * t;
    assertClose(A * fx + B * fy + C, 0, 'el pie está sobre la recta', 1e-9);
    assertClose(Math.hypot(x0 - fx, y0 - fy), ex.answer.value, 'distancia al pie');
    const rec = compileLatex(ex.statement.latex.split('\\quad')[1].replace(/=\s*0$/, ''));
    assertClose(rec({ x: 1.3, y: -0.7 }), A * 1.3 + B * -0.7 + C, 'recta del enunciado', 1e-9);
  },

  'ga-circulo'(ex) {
    const { h, k, r } = ex.params;
    const g = compileLatex(ex.statement.latex.replace(/\s*=\s*0$/, ''));
    for (let i = 0; i < 12; i++) {
      const th = (i * Math.PI) / 6 + 0.1;
      assertClose(g({ x: h + r * Math.cos(th), y: k + r * Math.sin(th) }), 0, 'puntos de la circunferencia anulan la ecuación', 1e-9);
    }
    // un punto fuera del radio dado NO la anula → el radio es único
    assert.ok(Math.abs(g({ x: h + (r + 1), y: k })) > 1e-6);
    assert.equal(ex.answer.value, r);
  },

  'ga-parabola'(ex) {
    const { p } = ex.params;
    const F = ex.answer.value;
    // propiedad focal: distancia al foco = distancia a la directriz x = −F
    for (const t of [0.5, 1, 2.3, -1.7, 4]) {
      const y = t;
      const x = (y * y) / (4 * p);
      assertClose(Math.hypot(x - F, y), Math.abs(x + F), 'foco por definición', 1e-9);
    }
    assert.ok(ex.statement.latex.includes(`${4 * p}x`));
  },

  'int-potencia'(ex) {
    const f = compileLatex(ex.expr);
    const F = compileLatex(stripC(ex.answer.latex));
    for (const x of POINTS) assertClose(diff((u) => F({ x: u }), x), f({ x }), 'F′ = integrando', 1e-6);
    assert.ok(ex.answer.latex.endsWith('+ C'));
  },

  'int-definida'(ex) {
    const { lo, hi } = ex.params;
    const f = compileLatex(ex.expr);
    assertClose(simpson((x) => f({ x }), lo, hi), ex.answer.value, 'integral numérica', 1e-9);
  },

  'int-sustitucion'(ex) {
    const f = compileLatex(ex.expr);
    const F = compileLatex(stripC(ex.answer.latex));
    for (const x of [0.4, 0.9, 1.3, -0.7]) assertClose(diff((u) => F({ x: u }), x), f({ x }), 'F′ = integrando', 1e-5);
  },

  'int-exp-trig'(ex) {
    const f = compileLatex(ex.expr);
    const F = compileLatex(stripC(ex.answer.latex));
    for (const x of POINTS) assertClose(diff((u) => F({ x: u }), x), f({ x }), 'F′ = integrando', 1e-5);
  },
};
