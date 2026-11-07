// Oráculos de templates-fi.js. Cada uno llega al resultado por otro camino: geometría con coordenadas,
// búsqueda numérica de raíces, integración numérica, derivadas finitas o sustitución directa.
import assert from 'node:assert/strict';
import { assertClose, close, compileLatex, diff, simpson, solveLinear, stripC, parseCplx } from './common.js';

const D2R = Math.PI / 180;
/** Complejo escrito como A + B·i (A y B pueden llevar fracciones o π): se evalúa tratando i como variable. */
function cval(latex) {
  const g = compileLatex(latex);
  const re = g({ i: 0 });
  return [re, g({ i: 1 }) - re];
}
/** r·cis θ° → [r, θ]. */
function parseCis(latex) {
  const m = /^(\d*)(?:\\,)?\\text\{cis\}\\,(\d+)\^\{\\circ\}$/.exec(latex);
  assert.ok(m, `forma polar no interpretable: ${latex}`);
  return [m[1] === '' ? 1 : Number(m[1]), Number(m[2])];
}
const cisXY = ([r, t]) => [r * Math.cos(t * D2R), r * Math.sin(t * D2R)];
const cmul = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];
const cdiv = ([a, b], [c, d]) => {
  const q = c * c + d * d;
  return [(a * c + b * d) / q, (b * c - a * d) / q];
};
const closeC = (u, v, tol = 1e-6) => close(u[0], v[0], tol) && close(u[1], v[1], tol);
const assertCloseC = (u, v, msg, tol) => assert.ok(closeC(u, v, tol), `${msg}: obtenido ${u}, esperado ${v}`);

/** F′ = f en varios puntos (F es la respuesta sin + C, f el integrando). */
function antideriv(ex, pts, tol = 1e-5) {
  const f = compileLatex(ex.expr);
  const F = compileLatex(stripC(ex.answer.latex));
  for (const x of pts) assertClose(diff((u) => F({ x: u }), x), f({ x }), `F′ = integrando en x=${x}`, tol);
}

/** Raíces reales de un polinomio (coeficientes por grado) buscando cambios de signo y mínimos de |p|. */
function realRoots(c, lo = -12, hi = 12, N = 24000) {
  const P = (x) => c.reduce((s, v, i) => s + v * x ** i, 0);
  const roots = [];
  const h = (hi - lo) / N;
  for (let i = 0; i < N; i++) {
    let a = lo + i * h;
    let b = a + h;
    if (P(a) === 0) roots.push(a);
    if (P(b) === 0) continue;
    if (P(a) * P(b) < 0) {
      for (let k = 0; k < 80; k++) {
        const m = (a + b) / 2;
        if (P(a) * P(m) <= 0) b = m;
        else a = m;
      }
      roots.push((a + b) / 2);
    }
  }
  return roots.filter((x, i) => roots.findIndex((y) => Math.abs(x - y) < 1e-7) === i);
}

export const ORACLES_FI = {
  'trig-ley-senos'(ex) {
    const { A, B, a } = ex.params;
    // B en el origen, C en (a, 0); A es la intersección de los rayos desde B y C.
    const C = 180 - A - B;
    const tB = Math.tan(B * D2R);
    const tC = Math.tan(C * D2R);
    // y = tB·x  y  y = tC·(a − x)
    const x = (tC * a) / (tB + tC);
    const y = tB * x;
    const b = Math.hypot(x - a, y);
    assertClose(b, ex.answer.value, 'lado b con coordenadas', 4e-3);
    assert.ok(Math.abs(b - ex.answer.value) <= 0.005 + 1e-9, 'redondeo a dos decimales');
  },
  'trig-ley-cosenos'(ex) {
    const { p, q, th } = ex.params;
    const d = Math.hypot(q * Math.cos(th * D2R) - p, q * Math.sin(th * D2R));
    assert.ok(Math.abs(d - ex.answer.value) <= 0.005 + 1e-9, `distancia con coordenadas ${d} vs ${ex.answer.value}`);
  },
  'trig-ecuacion'(ex) {
    const { p, q } = ex.params;
    const g = (x) => Math.abs((2 * Math.sin(x) - p) * (2 * Math.sin(x) - q));
    const N = 20000;
    const T = 2 * Math.PI;
    const sols = [];
    for (let i = 0; i < N; i++) {
      const x0 = (T * (i - 1)) / N;
      const x1 = (T * i) / N;
      const x2 = (T * (i + 1)) / N;
      if (g(x1) <= g(x0) && g(x1) <= g(x2)) {
        let [a, b] = [x0, x2];
        for (let k = 0; k < 200; k++) {
          const m1 = a + (b - a) / 3;
          const m2 = b - (b - a) / 3;
          if (g(m1) < g(m2)) b = m2;
          else a = m1;
        }
        let x = (a + b) / 2;
        if (g(x) < 1e-9) {
          if (x < 0) x += T;
          if (x > T - 1e-7) x = 0;
          if (!sols.some((s) => Math.abs(s - x) < 1e-5)) sols.push(x);
        }
      }
    }
    assertClose(sols.reduce((s, v) => s + v, 0), ex.answer.value, `suma de ${sols.length} soluciones`, 1e-5);
  },
  'trig-identidad'(ex) {
    const f = compileLatex(ex.expr);
    const g = compileLatex(ex.answer.latex);
    for (const x of [0.37, 0.81, 1.13, -0.43, 2.05]) assertClose(g({ x }), f({ x }), `identidad en x=${x}`, 1e-9);
  },
  're-desigualdad-abs'(ex) {
    const m = /^\\left\((.+), (.+)\\right\)$/.exec(ex.answer.latex);
    assert.ok(m, `intervalo no interpretable: ${ex.answer.latex}`);
    const lo = compileLatex(m[1])({});
    const hi = compileLatex(m[2])({});
    const L = ex.statement.latex;
    const inner = /^\\left\|(.+)\\right\|<(.+)$/.exec(L);
    const fx = compileLatex(inner[1]);
    const c = compileLatex(inner[2])({});
    for (let x = -40; x <= 40; x += 0.0137) {
      if (Math.abs(x - lo) < 1e-6 || Math.abs(x - hi) < 1e-6) continue;
      const v = fx({ x });
      if (!Number.isFinite(v)) continue;
      assert.equal(Math.abs(v) < c, x > lo && x < hi, `x=${x}`);
    }
  },
  're-suma-induccion'(ex) {
    const F = compileLatex(ex.answer.latex);
    const p = ex.params;
    let s = 0;
    for (let n = 1; n <= 7; n++) {
      s += p.geo ? p.c * p.r ** (n - 1) : p.a * n + p.b;
      assertClose(F({ n }), s, `suma hasta n=${n}`, 1e-12);
    }
  },
  'cx-polar-operaciones'(ex) {
    const { prod, r1, t1, r2, t2 } = ex.params;
    const z1 = cisXY([r1, t1]);
    const z2 = cisXY([r2, t2]);
    const want = prod ? cmul(z1, z2) : cdiv(z1, z2);
    const [r, t] = parseCis(ex.answer.latex);
    assert.ok(t >= 0 && t < 360, 'ángulo en [0°, 360°)');
    assertCloseC(cisXY([r, t]), want, 'resultado en cartesianas', 1e-9);
  },
  'cx-demoivre'(ex) {
    const { a, b, n } = ex.params;
    const R = Math.hypot(a, b) ** n;
    const T = Math.atan2(b, a) * n;
    const got = parseCplx(ex.answer.latex);
    assertCloseC(got, [R * Math.cos(T), R * Math.sin(T)], 'De Moivre con flotantes', 1e-9);
  },
  'cx-raices'(ex) {
    const { n, R, th } = ex.params;
    const w = cisXY([R, th]);
    const pow = (z) => {
      let p = [1, 0];
      for (let i = 0; i < n; i++) p = cmul(p, z);
      return p;
    };
    assertCloseC(pow(cisXY(parseCis(ex.answer.latex))), w, 'zⁿ = w', 1e-9);
    for (const d of ex.distractors) assert.ok(!closeC(pow(cisXY(parseCis(d.latex))), w, 1e-9), `el distractor ${d.latex} también es raíz`);
  },
  'cx-ecuacion'(ex) {
    const { form, r, alpha, beta, gamma } = ex.params;
    const al = form === 'bin' ? alpha : cisXY([r, { i90: 90, i180: 180, i270: 270 }[form]]);
    const z = parseCplx(ex.answer.latex);
    const lhs = cmul(al, z);
    assertCloseC([lhs[0] + beta[0], lhs[1] + beta[1]], gamma, 'αz + β = γ', 1e-9);
  },
  'pol-residuo'(ex) {
    const { c, a } = ex.params;
    // División larga entre (x − a), de mayor a menor grado.
    const r = [...c].reverse();
    for (let i = 0; i < r.length - 1; i++) {
      const q = r[i];
      r[i] -= q;
      r[i + 1] += q * a;
    }
    assert.equal(ex.answer.value, r[r.length - 1]);
  },
  'pol-parametro'(ex) {
    const { r, b, c } = ex.params;
    const k = ex.answer.value;
    assert.equal(r ** 3 + k * r * r + b * r + c, 0, 'p(r) = 0');
  },
  'pol-raiz-racional'(ex) {
    const roots = realRoots(ex.params.coefs);
    const nonInt = roots.filter((x) => Math.abs(x - Math.round(x)) > 1e-6);
    assert.equal(nonInt.length, 1, `raíces: ${roots}`);
    assertClose(nonInt[0], ex.answer.value, 'raíz no entera', 1e-9);
  },
  'pol-raiz-compleja'(ex) {
    const { coefs, a, b } = ex.params;
    // la raíz dada anula el polinomio
    let p = [0, 0];
    for (let i = coefs.length - 1; i >= 0; i--) p = [p[0] * a - p[1] * b + coefs[i], p[0] * b + p[1] * a];
    assert.ok(Math.hypot(...p) < 1e-9, 'a + bi es raíz');
    const roots = realRoots(coefs);
    assertClose(Math.max(...roots), ex.answer.value, 'mayor raíz real', 1e-9);
  },
  'pol-descartes'(ex) {
    const signs = [];
    for (let i = ex.params.c.length - 1; i >= 0; i--) if (ex.params.c[i] !== 0) signs.push(ex.params.c[i] > 0);
    let v = 0;
    for (let i = 1; i < signs.length; i++) if (signs[i] !== signs[i - 1]) v++;
    assert.equal(ex.answer.value, v);
  },
  'alg-sistema-3x3'(ex) {
    const { M, rhs, idx } = ex.params;
    assertClose(solveLinear(M, rhs)[idx], ex.answer.value, 'eliminación gaussiana', 1e-9);
  },
  'al-ecuacion-matricial'(ex) {
    const { A, B, C, D, i, j } = ex.params;
    // (AXB)_{rs} = Σ A_{rp} X_{pq} B_{qs}: sistema lineal de 4 incógnitas.
    const M = [];
    const rhs = [];
    for (let r = 0; r < 2; r++) {
      for (let s = 0; s < 2; s++) {
        M.push([0, 1].flatMap((p) => [0, 1].map((q) => A[r][p] * B[q][s])));
        rhs.push(D[r][s] - C[s][r]);
      }
    }
    assertClose(solveLinear(M, rhs)[i * 2 + j], ex.answer.value, 'sistema vectorizado', 1e-9);
  },
  'int-partes'(ex) {
    antideriv(ex, [0.4, 0.9, 1.3, 1.7]);
  },
  'int-fracciones-parciales'(ex) {
    antideriv(ex, [0.37, 1.41, 2.73, -1.37, 4.61, -4.63]);
  },
  'int-trig-potencias'(ex) {
    antideriv(ex, [0.31, 0.77, 1.21, -0.52, 2.3]);
  },
  'int-sust-trig'(ex) {
    antideriv(ex, [0.4, 0.9, 1.3, 1.7, 2.1, -1.1]);
  },
  'int-volumen-disco'(ex) {
    const f = compileLatex(ex.params.fTex);
    assertClose(simpson((x) => Math.PI * f({ x }) ** 2, 0, ex.params.b, 4000), ex.answer.value, 'discos numéricos', 1e-7);
  },
  'int-volumen-region'(ex) {
    const { variant, k } = ex.params;
    let V;
    if (variant === 'x') V = simpson((y) => 2 * Math.PI * y * (Math.sqrt(y) - y / k), 0, k * k, 4000); // cascarones en y
    else if (variant === 'y') V = simpson((y) => Math.PI * (y - (y / k) ** 2), 0, k * k, 4000); // arandelas en y
    else V = simpson((y) => 2 * Math.PI * y * 2 * Math.sqrt(y), 0, k * k, 4000); // cascarones horizontales
    assertClose(V, ex.answer.value, 'volumen por otro método', 1e-4);
  },
  'int-valor-medio'(ex) {
    const { a, c, L } = ex.params;
    assertClose(simpson((x) => a * x * x + c, 0, L) / L, ex.answer.value, 'promedio numérico', 1e-9);
  },
  'int-riemann'(ex) {
    const { a, c, b, n, right } = ex.params;
    let s = 0;
    for (let i = 0; i < n; i++) {
      const x = ((right ? i + 1 : i) * b) / n;
      s += (a * x * x + c) * (b / n);
    }
    assertClose(s, ex.answer.value, 'suma directa', 1e-12);
  },
  'suc-limite'(ex) {
    const p = ex.params;
    if (p.kind === 'e') {
      const n = 1e9;
      assertClose(Math.exp(p.m * n * Math.log1p(p.k / n)), ex.answer.value, 'n grande', 1e-6);
    } else {
      const n = 1e7;
      assertClose((p.a * n * n + p.b * n + p.c) / (p.d * n * n + p.e), ex.answer.value, 'n grande', 1e-5);
    }
  },
  'suc-termino-general'(ex) {
    const F = compileLatex(ex.answer.latex);
    const terms = ex.statement.latex.split(',\\ ').filter((t) => t !== '\\dots');
    assert.equal(terms.length, 4);
    terms.forEach((t, i) => assertClose(F({ n: i + 1 }), compileLatex(t)({}), `término ${i + 1}`, 1e-12));
  },
  'ser-criterio-razon'(ex) {
    const p = ex.params;
    const n = 4000;
    const lnFact = (m) => {
      let s = 0;
      for (let i = 2; i <= m; i++) s += Math.log(i);
      return s;
    };
    const lnA = (m) => (p.kind === 'pot' ? p.k * Math.log(m) + m * Math.log(p.c / p.d) : 2 * lnFact(m) - lnFact(2 * m) + m * Math.log(p.c));
    assertClose(Math.exp(lnA(n + 1) - lnA(n)), ex.answer.value, 'cociente con n grande', 2e-3);
  },
  'int-impropia'(ex) {
    const p = ex.params;
    let v;
    if (p.variant === 'pot') v = simpson((t) => p.k * t ** (p.p - 2), 0, 1, 4000); // x = 1/t
    else if (p.variant === 'exp') v = simpson((x) => p.k * Math.exp(-p.a * x), 0, 60 / p.a, 20000);
    else v = simpson((x) => p.k * x * Math.exp(-p.a * x), 0, 80 / p.a, 20000);
    assertClose(v, ex.answer.value, 'integral numérica', 1e-6);
  },
  'vec-plano-tangente'(ex) {
    const { a, b, c, x0, y0 } = ex.params;
    const f = (x, y) => a * x * x + b * x * y + c * y * y;
    const h = 1e-5;
    const fx = (f(x0 + h, y0) - f(x0 - h, y0)) / (2 * h);
    const fy = (f(x0, y0 + h) - f(x0, y0 - h)) / (2 * h);
    const P = compileLatex(ex.answer.latex);
    for (const [x, y] of [[0.3, -1.2], [2.1, 0.7], [-1.4, 1.9]]) assertClose(P({ x, y }), f(x0, y0) + fx * (x - x0) + fy * (y - y0), 'plano numérico', 1e-6);
  },
  'fou-coef-seno'(ex) {
    const { sq, k, L, n } = ex.params;
    const f = (x) => (sq ? (x < 0 ? -k : k) : k * x);
    const g = (x) => f(x) * Math.sin((n * Math.PI * x) / L);
    const bn = (simpson(g, -L, 0, 4000) + simpson(g, 0, L, 4000)) / L;
    assertClose(bn, ex.answer.value, 'bₙ numérico', 1e-7);
    assertClose(compileLatex(ex.answer.latex)({}), ex.answer.value, 'LaTeX = valor', 1e-12);
  },
  'fou-coef-coseno'(ex) {
    const { cuad, k, L, n } = ex.params;
    const f = (x) => (cuad ? k * x * x : k * Math.abs(x));
    const g = (x) => f(x) * Math.cos((n * Math.PI * x) / L);
    const an = (simpson(g, -L, 0, 4000) + simpson(g, 0, L, 4000)) / L;
    assertClose(an, ex.answer.value, 'aₙ numérico', 1e-7);
    assertClose(compileLatex(ex.answer.latex)({}), ex.answer.value, 'LaTeX = valor', 1e-12);
  },
  'fou-complejo'(ex) {
    const { rampa, A, n } = ex.params;
    const [fl, fr_] = rampa ? [(t) => A * t, (t) => A * t] : [() => 0, () => A]; // tramos izquierdo y derecho
    const part = (trig) => simpson((t) => fl(t) * trig(n * t), -Math.PI, 0, 4000) + simpson((t) => fr_(t) * trig(n * t), 0, Math.PI, 4000);
    const re = part(Math.cos) / (2 * Math.PI);
    const im = -part(Math.sin) / (2 * Math.PI);
    const got = cval(ex.answer.latex);
    assert.ok(Math.abs(got[0] - re) < 1e-7 && Math.abs(got[1] - im) < 1e-7, `cₙ: obtenido ${got}, esperado ${[re, im]}`);
    for (const d of ex.distractors) {
      const v = cval(d.latex);
      assert.ok(Math.abs(v[0] - re) > 1e-6 || Math.abs(v[1] - im) > 1e-6, `distractor igual: ${d.latex}`);
    }
  },
  'fou-transformada'(ex) {
    const { variant, A, a } = ex.params;
    const F = compileLatex(ex.answer.latex);
    for (const w of [0.5, 1.3, 2.1]) {
      let v;
      if (variant === 'rect') v = simpson((t) => A * Math.cos(w * t), -a, a, 4000);
      else if (variant === 'exp') v = 2 * simpson((t) => A * Math.exp(-a * t) * Math.cos(w * t), 0, 50 / a, 40000);
      else v = 2 * simpson((t) => A * t * t * Math.exp(-a * t) * Math.cos(w * t), 0, 70 / a, 40000);
      assertClose(F({ w }), v, `F(${w}) numérico`, 1e-6);
    }
  },
  'fou-espectro'(ex) {
    const { a, w, A } = ex.params;
    const T = 60 / a;
    const re = simpson((t) => A * Math.exp(-a * t) * Math.cos(w * t), 0, T, 40000);
    const im = -simpson((t) => A * Math.exp(-a * t) * Math.sin(w * t), 0, T, 40000);
    assertClose(Math.hypot(re, im), ex.answer.value, '|F(ω)| numérico', 1e-6);
  },
  'vc-integral-linea'(ex) {
    const p = ex.params;
    const N = 4000;
    let acc = [0, 0];
    // Regla del punto medio sobre el camino parametrizado.
    for (let i = 0; i < N; i++) {
      const t = (i + 0.5) / N;
      let z, dz, f;
      if (p.kind === 'conj') {
        const d = [p.z2[0] - p.z1[0], p.z2[1] - p.z1[1]];
        z = [p.z1[0] + d[0] * t, p.z1[1] + d[1] * t];
        dz = [d[0] / N, d[1] / N];
        f = [z[0], -z[1]];
      } else {
        const x = p.m * t;
        z = [x, x * x];
        dz = [p.m / N, (2 * x * p.m) / N];
        const z2 = cmul(z, z);
        f = [3 * p.a * z2[0] + p.b, 3 * p.a * z2[1]];
      }
      const fd = cmul(f, dz);
      acc = [acc[0] + fd[0], acc[1] + fd[1]];
    }
    const got = cval(ex.answer.latex);
    assert.ok(Math.abs(got[0] - acc[0]) < 1e-5 && Math.abs(got[1] - acc[1]) < 1e-5, `integral: obtenido ${got}, esperado ${acc}`);
  },
  'vc-cauchy-derivada'(ex) {
    const { m, z0, R, p, q } = ex.params;
    const N = 20000;
    let acc = [0, 0];
    for (let i = 0; i < N; i++) {
      const t = (2 * Math.PI * i) / N;
      const z = [R * Math.cos(t), R * Math.sin(t)];
      const z2 = cmul(z, z);
      const g = [z2[0] * z[0] - z2[1] * z[1] + p * z2[0] + q * z[0], z2[0] * z[1] + z2[1] * z[0] + p * z2[1] + q * z[1]];
      let den = [1, 0];
      for (let k = 0; k <= m; k++) den = cmul(den, [z[0] - z0, z[1]]);
      const dz = [(-z[1] * 2 * Math.PI) / N, (z[0] * 2 * Math.PI) / N];
      const v = cmul(cdiv(g, den), dz);
      acc = [acc[0] + v[0], acc[1] + v[1]];
    }
    const got = cval(ex.answer.latex);
    assert.ok(Math.abs(got[0] - acc[0]) < 1e-6 && Math.abs(got[1] - acc[1]) < 1e-6, `contorno: obtenido ${got}, esperado ${acc}`);
  },
  'vc-mapeo-z2'(ex) {
    const { vertical, a } = ex.params;
    const curve = (latex) => {
      const [lhs, rhs] = latex.split(' = ');
      const g = compileLatex(rhs);
      return ([u, v]) => (lhs === 'u' ? Math.abs(u - g({ v })) : Math.abs(v - g({ u })));
    };
    const pts = [-2.3, -0.7, 0.4, 1.8].map((t) => cmul(vertical ? [a, t] : [t, a], vertical ? [a, t] : [t, a]));
    const ok = curve(ex.answer.latex);
    for (const w of pts) assert.ok(ok(w) < 1e-9, `la imagen no está en la curva: ${w}`);
    for (const d of ex.distractors) assert.ok(pts.some((w) => curve(d.latex)(w) > 1e-6), `distractor también contiene la imagen: ${d.latex}`);
  },
  'vc-mobius'(ex) {
    const { a, b, c, d, z } = ex.params;
    const w = cdiv([a * z[0] + b, a * z[1]], [c * z[0] + d, c * z[1]]);
    assertCloseC(cval(ex.answer.latex), w, 'imagen de z₀', 1e-9);
    for (const dd of ex.distractors) assert.ok(!closeC(cval(dd.latex), w, 1e-9), `distractor igual: ${dd.latex}`);
  },
  'vc-inversion'(ex) {
    const { vertical, k } = ex.params;
    const pts = [-1.7, 0.3, 2.9].map((t) => cdiv([1, 0], vertical ? [k, t] : [t, k]));
    // circuncentro de tres puntos
    const [[x1, y1], [x2, y2], [x3, y3]] = pts;
    const D = 2 * (x1 * (y2 - y3) + x2 * (y3 - y1) + x3 * (y1 - y2));
    const s = (x, y) => x * x + y * y;
    const ux = (s(x1, y1) * (y2 - y3) + s(x2, y2) * (y3 - y1) + s(x3, y3) * (y1 - y2)) / D;
    const uy = (s(x1, y1) * (x3 - x2) + s(x2, y2) * (x1 - x3) + s(x3, y3) * (x2 - x1)) / D;
    assertCloseC(cval(ex.answer.latex), [ux, uy], 'centro por circuncentro', 1e-9);
  },
};
