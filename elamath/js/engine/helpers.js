// helpers.js — utilidades compartidas por las plantillas de las materias de los niveles 1–5.

import { Fraction, polyLatex, uniqueDistractors, numericDistractors } from './utils.js';

export { Fraction, polyLatex, uniqueDistractors, numericDistractors };

export const fr = (n, d = 1) => new Fraction(n, d);
/** Fracción o null si el denominador es 0 (para candidatos a distractor que podrían dividir entre cero). */
export const safeFr = (n, d) => (d === 0 ? null : new Fraction(n, d));
/** Respuesta numérica exacta: { latex, value }. */
export const ansOf = (f) => ({ latex: f.toLatex(), value: f.value });
/** Número entre paréntesis si es negativo. */
export const num = (n) => (n < 0 ? `(${n})` : `${n}`);
/** Distractor { latex, feedback } desde una fracción (null → se descarta). */
export const dFr = (f, feedback) => (f ? { latex: f.toLatex(), feedback } : null);
export const compact = (list) => list.filter(Boolean);

export const comb = (n, k) => {
  let r = 1;
  for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i;
  return Math.round(r);
};
export const perm = (n, k) => {
  let r = 1;
  for (let i = 0; i < k; i++) r *= n - i;
  return r;
};
export const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));

/** Términos con letra: terms([[3,'x'],[-1,'y'],[5,'']]) → "3x - y + 5". Omite ceros. */
export function terms(list) {
  let out = '';
  for (const [c, v] of list) {
    if (c === 0) continue;
    const abs = Math.abs(c);
    const body = v && abs === 1 ? v : `${abs}${v ?? ''}`;
    out += out === '' ? (c < 0 ? '-' : '') + body : (c < 0 ? ' - ' : ' + ') + body;
  }
  return out || '0';
}

/** Coeficiente delante de una expresión: co(1,'x')→'x', co(-1,'x')→'-x', co(3,'x')→'3x'. */
export const co = (c, body) => (c === 1 ? body : c === -1 ? `-${body}` : `${c}${body}`);

/** (v − c) en LaTeX. */
export const lin = (c, v = 'x') => polyLatex([-c, 1], v);

/** Complejo a+bi en LaTeX. */
export function cplx(re, im) {
  if (im === 0) return String(re);
  const part = Math.abs(im) === 1 ? 'i' : `${Math.abs(im)}i`;
  if (re === 0) return (im < 0 ? '-' : '') + part;
  return `${re} ${im < 0 ? '-' : '+'} ${part}`;
}

/** Ternas pitagóricas primitivas. */
export const TRIPLES = [
  [3, 4, 5],
  [5, 12, 13],
  [8, 15, 17],
  [7, 24, 25],
  [20, 21, 29],
];

/** Entero en [min, max] distinto de todos los valores de `not`. */
export function intNot(rng, min, max, ...not) {
  let v;
  do {
    v = rng.int(min, max);
  } while (not.includes(v));
  return v;
}
