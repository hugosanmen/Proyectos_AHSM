// Oráculos del Nivel 3.
import assert from 'node:assert/strict';
import { assertClose, simpson, compileLatex, parseCplx, cmul, cadd } from './common.js';

const combos = (n, k, start = 0) => (k === 0 ? 1 : Array.from({ length: n - start }, (_, i) => combos(n, k - 1, start + i + 1)).reduce((a, b) => a + b, 0));
const perms = (n, k) => (k === 0 ? 1 : n * perms(n - 1, k - 1));

export const ORACLES_N3 = {
  'mn-biseccion'(ex) {
    const { c, a, b } = ex.params;
    const f = (x) => x * x - c;
    const [lo, hi] = ex.answer.interval;
    const m = (a + b) / 2;
    assert.ok(f(a) < 0 && f(b) > 0, 'el intervalo original encierra la raíz');
    assert.ok(f(lo) * f(hi) < 0, 'cambio de signo en el nuevo intervalo');
    assert.ok([a, m].includes(lo) || lo === m);
    assertClose(hi - lo, (b - a) / 2, 'el intervalo se reduce a la mitad', 1e-12);
    assert.ok(lo < Math.sqrt(c) && Math.sqrt(c) < hi);
  },

  'mn-newton'(ex) {
    const { c, x0 } = ex.params;
    const f = (x) => x * x - c;
    const fp = (f(x0 + 1e-6) - f(x0 - 1e-6)) / 2e-6;
    assertClose(x0 - f(x0) / fp, ex.answer.value, 'paso de Newton con derivada numérica', 1e-6);
  },

  'mn-trapecio'(ex) {
    const { a, h } = ex.params;
    const f = compileLatex(ex.expr);
    const g = (x) => f({ x });
    let T = 0;
    for (let i = 0; i < 2; i++) T += ((g(a + i * h) + g(a + (i + 1) * h)) / 2) * h; // trapecio compuesto, tramo por tramo
    assertClose(T, ex.answer.value, 'trapecio compuesto', 1e-9);
  },

  'mn-simpson'(ex) {
    const { a, h } = ex.params;
    const f = compileLatex(ex.expr);
    const exacta = simpson((x) => f({ x }), a, a + 2 * h, 4000);
    assertClose(exacta, ex.answer.value, 'Simpson es exacto en cúbicas: debe igualar la integral', 1e-9);
  },

  'mn-euler'(ex) {
    const { p, q, y0, h } = ex.params;
    let x = 0;
    let y = y0;
    for (let i = 0; i < 2; i++) {
      y += h * (p * x + q * y);
      x += h;
    }
    assertClose(y, ex.answer.value, 'Euler iterado', 1e-12);
  },

  'pe-combinatoria'(ex) {
    const { n, k, ordered } = ex.params;
    assert.equal(ordered ? perms(n, k) : combos(n, k), ex.answer.value);
  },

  'pe-condicional'(ex) {
    const { both, onlyA, onlyC, none } = ex.params;
    const grupo = [...Array(both).fill('AC'), ...Array(onlyA).fill('A'), ...Array(onlyC).fill('C'), ...Array(none).fill('N')];
    const conA = grupo.filter((g) => g.includes('A'));
    assertClose(conA.filter((g) => g.includes('C')).length / conA.length, ex.answer.value, 'frecuencia condicional', 1e-12);
    assert.ok(ex.statement.text.includes(`${grupo.length} estudiantes`));
  },

  'pe-varianza'(ex) {
    const { xs } = ex.params;
    const mu = xs.reduce((a, b) => a + b, 0) / xs.length;
    assertClose(xs.reduce((s, x) => s + (x - mu) ** 2, 0) / xs.length, ex.answer.value, 'varianza por definición', 1e-12);
    assert.equal(ex.statement.latex, xs.join(',\; '));
  },

  'pe-binomial'(ex) {
    const { n, k, m } = ex.params;
    const p = 1 / m;
    let total = 0;
    for (let mask = 0; mask < 2 ** n; mask++) {
      let succ = 0;
      let prob = 1;
      for (let i = 0; i < n; i++) {
        const s = (mask >> i) & 1;
        succ += s;
        prob *= s ? p : 1 - p;
      }
      if (succ === k) total += prob;
    }
    assertClose(total, ex.answer.value, 'suma de probabilidades de todos los resultados', 1e-12);
  },

  'pe-zscore'(ex) {
    const { mu, sigma, x } = ex.params;
    assertClose(mu + ex.answer.value * sigma, x, 'x = μ + zσ', 1e-12);
  },

  'vc-modulo'(ex) {
    const { a, b } = ex.params;
    assertClose(Math.hypot(a, b), ex.answer.value, 'módulo');
    assert.ok(Number.isInteger(ex.answer.value));
  },

  'vc-producto'(ex) {
    const { a, b, c, d, part } = ex.params;
    // truco de Karatsuba: otro camino para el producto complejo
    const k1 = c * (a + b);
    const k2 = a * (d - c);
    const k3 = b * (c + d);
    const [re, im] = [k1 - k3, k1 + k2];
    assert.deepEqual([re + 0, im + 0], cmul([a, b], [c, d]));
    assertClose(part === 'real' ? re : im, ex.answer.value, 'parte pedida', 1e-12);
  },

  'vc-potencia-i'(ex) {
    let z = [1, 0];
    for (let i = 0; i < ex.params.n; i++) z = cmul(z, [0, 1]);
    const [re, im] = z;
    const latex = re === 1 ? '1' : re === -1 ? '-1' : im === 1 ? 'i' : '-i';
    assert.equal(ex.answer.latex, latex);
  },

  'vc-division'(ex) {
    const { p, q, c, d } = ex.params;
    const num = cmul([p, q], [c, d]);
    const den = c * c + d * d;
    const cociente = [((num[0] * c + num[1] * d) / den), ((num[1] * c - num[0] * d) / den)];
    assert.deepEqual(cociente.map((v) => Math.round(v * 1e9) / 1e9 + 0), [p + 0, q + 0]);
    assert.deepEqual(parseCplx(ex.answer.latex), [p, q]);
    // el numerador del enunciado vale (p+qi)(c+di)
    const stmt = ex.statement.latex.match(/\\frac\{(.*)\}\{(.*)\}/);
    assert.deepEqual(parseCplx(stmt[1]), num);
    assert.deepEqual(parseCplx(stmt[2]), [c, d]);
  },

  'vc-derivada'(ex) {
    const { a, b, c, d } = ex.params;
    const f = (z) => cadd(cmul(z, z), cmul([c, d], z));
    for (const h of [[1e-6, 0], [0, 1e-6]]) {
      const dz = f(cadd([a, b], h));
      const f0 = f([a, b]);
      const q = [(dz[0] - f0[0]) / (h[0] || h[1]), (dz[1] - f0[1]) / (h[0] || h[1])];
      // dividir entre h (real o imaginario): para h imaginario, (x+iy)/(i·ε) = (y − i x)/ε
      const der = h[0] ? q : [(dz[1] - f0[1]) / h[1], -(dz[0] - f0[0]) / h[1]];
      const [re, im] = parseCplx(ex.answer.latex);
      assertClose(der[0], re, 'Re f′ (cociente incremental)', 1e-4);
      assertClose(der[1], im, 'Im f′ (cociente incremental)', 1e-4);
    }
  },
};
