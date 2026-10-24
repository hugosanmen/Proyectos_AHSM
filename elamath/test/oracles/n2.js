// Oráculos del Nivel 2.
import assert from 'node:assert/strict';
import { assertClose, close, diff, simpson, gaussDet, solveLinear, compileLatex } from './common.js';

export const ORACLES_N2 = {
  'vec-punto'(ex) {
    const { u, v } = ex.params;
    assertClose(u.map((x, i) => x * v[i]).reduce((a, b) => a + b, 0), ex.answer.value, 'producto punto', 1e-12);
    // identidad independiente: u·v = (|u+v|² − |u|² − |v|²)/2
    const n2 = (w) => w.reduce((s, x) => s + x * x, 0);
    assertClose((n2(u.map((x, i) => x + v[i])) - n2(u) - n2(v)) / 2, ex.answer.value, 'identidad de polarización');
  },

  'vec-cruz'(ex) {
    const { u, v, comp } = ex.params;
    const e = { i: [1, 0, 0], j: [0, 1, 0], k: [0, 0, 1] }[comp];
    // (u×v)·e = triple producto = det[e; u; v]
    assertClose(gaussDet([e, u, v]), ex.answer.value, 'triple producto');
  },

  'vec-parcial'(ex) {
    const { a, b, c, d, x0, y0, wrt } = ex.params;
    const fx = compileLatex(ex.expr);
    const f = (x, y) => a * x * x * y + b * x * y * y + c * x + d * y;
    for (const [x, y] of [[0.7, 1.3], [-1.1, 2.2]]) assertClose(fx({ x, y }), f(x, y), 'f del enunciado', 1e-9);
    const num = wrt === 'x' ? diff((x) => f(x, y0), x0) : diff((y) => f(x0, y), y0);
    assertClose(num, ex.answer.value, `∂f/∂${wrt} numérica`, 1e-6);
  },

  'vec-doble'(ex) {
    const { c, d, A, B } = ex.params;
    const n = 400;
    let s = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) s += c * ((i + 0.5) * A / n) + d * ((j + 0.5) * B / n);
    assertClose(s * (A / n) * (B / n), ex.answer.value, 'suma de Riemann', 1e-6);
  },

  'vec-divergencia'(ex) {
    const { a, b, c, x0, y0 } = ex.params;
    const z0 = 1;
    const P = (x) => a * x * x;
    const Q = (x, y) => b * x * y;
    const R = (y, z) => c * y * z;
    const div = diff(P, x0) + diff((y) => Q(x0, y), y0) + diff((z) => R(y0, z), z0);
    assertClose(div, ex.answer.value, 'divergencia numérica', 1e-6);
  },

  'al-det2'(ex) {
    const { a, b, c, d } = ex.params;
    assertClose(gaussDet([[a, b], [c, d]]), ex.answer.value, 'determinante por eliminación', 1e-9);
  },

  'al-det3'(ex) {
    assertClose(gaussDet(ex.params.m), ex.answer.value, 'determinante por eliminación', 1e-9);
  },

  'al-producto'(ex) {
    const { A, B, i, j } = ex.params;
    // fila i de A · (A aplicada a columna j de B) calculado por columnas
    const col = [B[0][j], B[1][j]];
    const Acol = [A[0][0] * col[0] + A[0][1] * col[1], A[1][0] * col[0] + A[1][1] * col[1]];
    assertClose(Acol[i], ex.answer.value, 'entrada (i,j) de AB por columnas', 1e-12);
  },

  'al-inversa'(ex) {
    const { a, b, c, d, i, j } = ex.params;
    // columna j de A⁻¹ = solución de A x = e_j
    const x = solveLinear([[a, b], [c, d]], j === 0 ? [1, 0] : [0, 1]);
    assertClose(x[i], ex.answer.value, 'entrada de la inversa por Gauss-Jordan', 1e-9);
  },

  'al-eigen'(ex) {
    const { m } = ex.params;
    const tr = m[0][0] + m[1][1];
    const D = m[0][0] * m[1][1] - m[0][1] * m[1][0];
    const disc = tr * tr - 4 * D;
    assert.ok(disc >= 0);
    const hi = (tr + Math.sqrt(disc)) / 2;
    assertClose(hi, ex.answer.value, 'mayor valor propio');
    assertClose(gaussDet([[m[0][0] - hi, m[0][1]], [m[1][0], m[1][1] - hi]]), 0, 'det(A − λI) = 0', 1e-9);
  },

  'ed-separable'(ex) {
    const { k, y0 } = ex.params;
    const y = compileLatex(ex.answer.latex);
    assertClose(y({ x: 0 }), y0, 'condición inicial', 1e-9);
    for (const x of [-0.5, 0.3, 0.9]) assertClose(diff((u) => y({ x: u }), x), k * y({ x }), "y′ = ky", 1e-5);
  },

  'ed-pvi'(ex) {
    const { a, b, y0, x1 } = ex.params;
    assertClose(y0 + simpson((x) => a * x + b, 0, x1), ex.answer.value, 'y(x1) por integración numérica', 1e-9);
  },

  'ed-equilibrio'(ex) {
    const { a, b } = ex.params;
    // Euler con paso pequeño hasta t grande
    let y = 0;
    const h = 1e-3;
    for (let t = 0; t < 40 / a; t += h) y += h * (b - a * y);
    assertClose(y, ex.answer.value, 'simulación', 1e-3);
  },

  'ed-caracteristica'(ex) {
    const { p, q } = ex.params;
    const disc = p * p - 4 * q;
    assert.ok(disc > 0 && Number.isInteger(Math.sqrt(disc)));
    const hi = (-p + Math.sqrt(disc)) / 2;
    assertClose(hi, ex.answer.value, 'raíz mayor');
    // e^{rx} resuelve la EDO: r² + p r + q = 0
    assertClose(hi * hi + p * hi + q, 0, 'ecuación característica', 1e-9);
    const expected = `${p === 0 ? '' : ''}`;
    assert.ok(ex.statement.latex.startsWith("y''") && ex.statement.latex.endsWith('= 0'), expected);
  },

  'ed-oscilador'(ex) {
    const { w, variant } = ex.params;
    const k = variant === 'simple' ? w * w : ex.params.m * w * w;
    const m = variant === 'simple' ? 1 : ex.params.m;
    const y = (t) => Math.sin(Math.sqrt(k / m) * t);
    for (const t of [0.3, 1.1]) {
      const ypp = (y(t + 1e-4) - 2 * y(t) + y(t - 1e-4)) / 1e-8;
      assertClose(m * ypp + k * y(t), 0, 'y es solución', 1e-4);
    }
    assert.equal(Math.sqrt(k / m), ex.answer.value);
  },
};
