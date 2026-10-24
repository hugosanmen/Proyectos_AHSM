// Oráculos del Nivel 4.
import assert from 'node:assert/strict';
import { assertClose, diff, simpson, compileLatex } from './common.js';

const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));

/** Transformada de Laplace numérica en s0: ∫₀^T e^{−s0 t} f(t) dt. */
const laplace = (f, s0, T = 30) => simpson((t) => Math.exp(-s0 * t) * f(t), 0, T, 30000);

function ftOf(p) {
  if (p.variant === 'potencia') return (t) => p.k * t ** p.n;
  if (p.variant === 'exp') return (t) => p.k * Math.exp(p.a * t);
  if (p.variant === 'seno') return (t) => p.k * Math.sin(p.b * t);
  return (t) => p.k * Math.cos(p.b * t);
}
const polo = (p) => (p.variant === 'exp' ? Math.max(p.a, 0) : 0);

export const ORACLES_N4 = {
  'ma-laplace'(ex) {
    const p = ex.params;
    const F = compileLatex(ex.answer.latex);
    for (const s0 of [polo(p) + 2.5, polo(p) + 4]) assertClose(laplace(ftOf(p), s0), F({ s: s0 }), `L{f}(${s0}) por integración numérica`, 1e-6);
  },

  'ma-laplace-inv'(ex) {
    const p = ex.params;
    const g = compileLatex(ex.answer.latex);
    const F = { exp: (s) => p.k / (s - p.a), seno: (s) => (p.k * p.b) / (s * s + p.b * p.b), potencia: (s) => (p.k * fact(p.n)) / s ** (p.n + 1) }[p.variant];
    for (const s0 of [polo(p) + 2.5, polo(p) + 4]) assertClose(laplace((t) => g({ t }), s0), F(s0), `L{f}(${s0}) = F(${s0})`, 1e-6);
  },

  'ma-geometrica'(ex) {
    const { a, m, neg } = ex.params;
    const r = (neg ? -1 : 1) / m;
    let s = 0;
    for (let n = 0; n < 400; n++) s += a * r ** n;
    assertClose(s, ex.answer.value, 'suma parcial de 400 términos', 1e-9);
  },

  'ma-radio'(ex) {
    const { k, variant } = ex.params;
    const a = { simple: (n) => 1 / k ** n, lineal: (n) => n / k ** n, armonica: (n) => 1 / (n * k ** n) }[variant];
    const n = 200;
    assertClose(Math.abs(a(n) / a(n + 1)), ex.answer.value, 'límite de |a_n / a_{n+1}|', 1e-2);
    assert.ok(Number.isInteger(ex.answer.value));
  },

  'ma-taylor'(ex) {
    const { variant, a, k } = ex.params;
    const c = [1];
    if (variant === 'exp') for (let j = 1; j <= 60; j++) c[j] = (c[j - 1] * a) / j;
    else {
      c[0] = 0;
      for (let j = 1; j <= 60; j++) c[j] = (((-a) ** (j - 1)) * a) / j; // integral de la geométrica 1/(1+ax)
    }
    const f = variant === 'exp' ? (x) => Math.exp(a * x) : (x) => Math.log(1 + a * x);
    const x = 0.2 / Math.abs(a);
    assertClose(c.reduce((s, cj, j) => s + cj * x ** j, 0), f(x), 'la serie reproduce f', 1e-12);
    assertClose(c[k], ex.answer.value, `coeficiente de x^${k}`, 1e-12);
  },

  'ss-periodo'(ex) {
    const { variant } = ex.params;
    const x = variant === 'simple' ? (t) => Math.sin(ex.params.w * t) : (t) => Math.sin(ex.params.a * t) + Math.cos(ex.params.b * t);
    const T = ex.answer.value;
    const ts = [0.1, 0.7, 1.3, 2.9, 4.4];
    for (const t of ts) assertClose(x(t + T), x(t), 'x(t+T) = x(t)', 1e-9);
    for (let d = 2; d <= 12; d++) assert.ok(ts.some((t) => Math.abs(x(t + T / d) - x(t)) > 1e-6), `T/${d} no puede ser periodo: T no es el fundamental`);
  },

  'ss-convolucion'(ex) {
    const { x, h, n } = ex.params;
    const y = Array(x.length + h.length - 1).fill(0);
    x.forEach((xi, i) => h.forEach((hj, j) => (y[i + j] += xi * hj)));
    assertClose(y[n], ex.answer.value, 'convolución completa', 1e-12);
  },

  'ss-ganancia'(ex) {
    const m = /^H\(s\)=\\frac\{(\d+)\}\{(.*)\}$/.exec(ex.statement.latex);
    const den = compileLatex(m[2]);
    assertClose(Number(m[1]) / den({ s: 0 }), ex.answer.value, 'H(0) del enunciado', 1e-12);
  },

  'ss-estabilidad'(ex) {
    const { p1, p2 } = ex.params;
    // respuesta impulsiva h(t): acotada y decreciente → estable; acotada sin decaer → marginal; crece → inestable
    const h = (t) => (p1 !== p2 ? (Math.exp(p1 * t) - Math.exp(p2 * t)) / (p1 - p2) : t * Math.exp(p1 * t));
    const big = Math.abs(h(2000));
    const verdict = !Number.isFinite(big) || big > 100 ? 'Inestable' : big > 1e-6 ? 'Marginalmente estable' : 'Estable';
    assert.equal(ex.answer.latex, `\\text{${verdict}}`);
  },

  'ss-nyquist'(ex) {
    const { a, b } = ex.params;
    // muestrear justo a 2·fmax distingue ambas senoidales; probar que 2·fmax es entero y mayor que cada una
    assert.equal(ex.answer.value, 2 * Math.max(a, b));
    assert.ok(ex.answer.value > 2 * Math.min(a, b));
  },

  'op-cuadratica'(ex) {
    const { a, b, c, ask } = ex.params;
    const f = (x) => a * x * x + b * x + c;
    const s = a > 0 ? 1 : -1;
    let lo = -100;
    let hi = 100;
    for (let i = 0; i < 300; i++) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      if (s * f(m1) < s * f(m2)) hi = m2;
      else lo = m1;
    }
    const x = (lo + hi) / 2;
    assertClose(ask === 'posicion' ? x : f(x), ex.answer.value, 'extremo por búsqueda ternaria', 1e-6);
  },

  'op-gradiente'(ex) {
    const { a, b, x0, m } = ex.params;
    const f = (x) => a * x * x + b * x;
    assertClose(x0 - diff(f, x0) / m, ex.answer.value, 'paso de gradiente con derivada numérica', 1e-6);
  },

  'op-lagrange'(ex) {
    const { a, b, c } = ex.params;
    const g = (t) => t * t + ((c - a * t) / b) ** 2; // y despejada de la restricción
    let lo = -200;
    let hi = 200;
    for (let i = 0; i < 400; i++) {
      const m1 = lo + (hi - lo) / 3;
      const m2 = hi - (hi - lo) / 3;
      if (g(m1) < g(m2)) hi = m2;
      else lo = m1;
    }
    assertClose(g((lo + hi) / 2), ex.answer.value, 'mínimo sobre la recta', 1e-6);
  },

  'op-lineal'(ex) {
    const { A, B, S, p, q } = ex.params;
    let best = -Infinity;
    for (let x = 0; x <= A; x++) for (let y = 0; y <= B; y++) if (x + y <= S) best = Math.max(best, p * x + q * y);
    assert.equal(best, ex.answer.value, 'máximo por fuerza bruta en la región entera (los vértices son enteros)');
  },

  'op-hessiana'(ex) {
    const { a, b, c } = ex.params;
    const f = (x, y) => a * x * x + b * y * y + c * x * y;
    let pos = 0;
    let neg = 0;
    for (let i = 0; i < 360; i++) {
      const th = (i * Math.PI) / 180;
      const v = f(0.01 * Math.cos(th), 0.01 * Math.sin(th));
      if (v > 1e-12) pos++;
      else if (v < -1e-12) neg++;
    }
    const verdict = pos && neg ? 'punto silla' : pos ? 'mínimo local' : 'máximo local';
    assert.equal(ex.answer.latex, `\\text{${verdict}}`);
  },
};
