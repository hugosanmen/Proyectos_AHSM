// Ayudas compartidas por los oráculos de las plantillas de los niveles 1–5.
import assert from 'node:assert/strict';
import { compileLatex } from '../latexEval.js';

export { compileLatex };
export const close = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol * Math.max(1, Math.abs(a), Math.abs(b));
export const assertClose = (a, b, msg, tol) => assert.ok(close(a, b, tol), `${msg}: obtenido ${a}, esperado ${b}`);
export const diff = (f, x, h = 1e-5) => (f(x + h) - f(x - h)) / (2 * h);
export const stripC = (s) => s.replace(/\s*\+\s*C$/, '');
/** Regla de Simpson compuesta (n par). */
export function simpson(f, a, b, n = 2000) {
  const h = (b - a) / n;
  let s = f(a) + f(b);
  for (let i = 1; i < n; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
  return (s * h) / 3;
}
/** Lado izquierdo y derecho de una ecuación "A = B" ya compilados. */
export function sides(latex) {
  const [l, r] = latex.split('=');
  return [compileLatex(l.trim()), compileLatex(r.trim())];
}
export const POINTS = [0.3, 0.9, -0.6, 1.4, 2.2];

/** Determinante por eliminación gaussiana con pivoteo parcial (camino distinto al de cofactores). */
export function gaussDet(m) {
  const a = m.map((r) => r.map(Number));
  const n = a.length;
  let det = 1;
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
    if (Math.abs(a[p][c]) < 1e-12) return 0;
    if (p !== c) {
      [a[p], a[c]] = [a[c], a[p]];
      det = -det;
    }
    det *= a[c][c];
    for (let r = c + 1; r < n; r++) {
      const f = a[r][c] / a[c][c];
      for (let k = c; k < n; k++) a[r][k] -= f * a[c][k];
    }
  }
  return det;
}
/** Resuelve A x = b por Gauss-Jordan (matrices pequeñas e invertibles). */
export function solveLinear(A, b) {
  const n = A.length;
  const M = A.map((r, i) => [...r.map(Number), Number(b[i])]);
  for (let c = 0; c < n; c++) {
    let p = c;
    for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[p], M[c]] = [M[c], M[p]];
    for (let r = 0; r < n; r++) {
      if (r === c) continue;
      const f = M[r][c] / M[c][c];
      for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
    }
  }
  return M.map((row, i) => row[n] / row[i]);
}

/** Interpreta "a", "bi", "a + bi", "a - bi", "-i" → [re, im]. */
export function parseCplx(s) {
  const t = s.replace(/\s+/g, '');
  assert.ok(t.length, 'complejo vacío');
  const m = /^(.*?)([+-]?\d*)i$/.exec(t);
  if (!m) {
    assert.ok(/^-?\d+$/.test(t), `complejo no interpretable: ${s}`);
    return [Number(t), 0];
  }
  const [, rest, imStr] = m;
  const im = imStr === '' || imStr === '+' ? 1 : imStr === '-' ? -1 : Number(imStr);
  assert.ok(rest === '' || /^-?\d+$/.test(rest), `parte real no interpretable: ${s}`);
  return [rest === '' ? 0 : Number(rest), im];
}
export const cmul = ([a, b], [c, d]) => [a * c - b * d + 0, a * d + b * c + 0];
export const cadd = ([a, b], [c, d]) => [a + c, b + d];
