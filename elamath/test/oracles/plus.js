// Oráculos de templates-plus.js. Cada uno llega al resultado por otro camino: simulación, integración numérica,
// derivadas finitas o búsqueda directa, nunca repitiendo la fórmula de la plantilla.
import assert from 'node:assert/strict';
import { assertClose, close, compileLatex, gaussDet, simpson, solveLinear } from './common.js';

/** RK4 para y′ = f(t, y), donde y es un arreglo. */
function rk4(f, y0, T, n = 4000) {
  const h = T / n;
  let y = [...y0];
  const add = (v, w, k) => v.map((a, i) => a + w[i] * k);
  for (let i = 0; i < n; i++) {
    const t = i * h;
    const k1 = f(t, y);
    const k2 = f(t + h / 2, add(y, k1, h / 2));
    const k3 = f(t + h / 2, add(y, k2, h / 2));
    const k4 = f(t + h, add(y, k3, h));
    y = y.map((a, j) => a + (h / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
  }
  return y;
}
const coefOfPower = (factors, k) => {
  // Multiplica polinomios término a término, sin usar el binomio.
  let poly = [1];
  for (const [c0, c1] of factors) {
    const next = Array(poly.length + 1).fill(0);
    poly.forEach((v, i) => {
      next[i] += v * c0;
      next[i + 1] += v * c1;
    });
    poly = next;
  }
  return poly[k] ?? 0;
};
const line = (P, Q, A, B, n = 2000) => simpson((s) => {
  const x = A[0] + s * (B[0] - A[0]);
  const y = A[1] + s * (B[1] - A[1]);
  return P(x, y) * (B[0] - A[0]) + Q(x, y) * (B[1] - A[1]);
}, 0, 1, n);

export const ORACLES_PLUS = {
  'alg-exp-ecuacion'(ex) {
    const { b, k, c } = ex.params;
    assertClose(b ** (ex.answer.value + c), b ** k, 'sustituir x en la ecuación');
  },
  'alg-log-ecuacion'(ex) {
    const { b, n, k } = ex.params;
    const x = ex.answer.value;
    assert.ok(x > 0 && x - k > 0, 'argumentos positivos');
    assertClose(Math.log(x) / Math.log(b) + Math.log(x - k) / Math.log(b), n, 'sustituir x', 1e-9);
  },
  'alg-binomio-general'(ex) {
    const { p, q, n, k } = ex.params;
    assert.equal(coefOfPower(Array(n).fill([q, p]), k), ex.answer.value);
  },
  'alg-binomio-independiente'(ex) {
    const { n, a } = ex.params;
    // (x + a/x)ⁿ = (x² + a)ⁿ / xⁿ: el término independiente es el coeficiente de xⁿ en (x² + a)ⁿ
    let poly = [1];
    for (let i = 0; i < n; i++) {
      const next = Array(poly.length + 2).fill(0);
      poly.forEach((v, j) => {
        next[j] += v * a;
        next[j + 2] += v;
      });
      poly = next;
    }
    assert.equal(poly[n], ex.answer.value);
  },
  'int-area-curvas'(ex) {
    const { a, k } = ex.params;
    assertClose(simpson((x) => Math.abs(k * x - a * x * x), 0, k / a), ex.answer.value, 'área numérica', 1e-8);
  },
  'int-definida-abs'(ex) {
    const { a, b, c } = ex.params;
    const left = simpson((x) => Math.abs(x - c), a, c);
    const right = simpson((x) => Math.abs(x - c), c, b);
    assertClose(left + right, ex.answer.value, 'integral numérica', 1e-9);
  },
  'int-definida-partes'(ex) {
    const { k, n } = ex.params;
    assertClose(simpson((x) => k * x * (1 - x) ** n, 0, 1, 4000), ex.answer.value, 'integral numérica', 1e-8);
  },
  'vec-gradiente-norma'(ex) {
    const { a, x0, y0 } = ex.params;
    const h = 1e-5;
    const f = (x, y) => a * x * y;
    assertClose(Math.hypot((f(x0 + h, y0) - f(x0 - h, y0)) / (2 * h), (f(x0, y0 + h) - f(x0, y0 - h)) / (2 * h)), ex.answer.value, 'gradiente numérico', 1e-7);
  },
  'vec-direccional'(ex) {
    const { a, b, x0, y0, A, B } = ex.params;
    const f = (x, y) => a * x * x + b * y * y;
    const n = Math.hypot(A, B);
    const h = 1e-5;
    assertClose((f(x0 + (h * A) / n, y0 + (h * B) / n) - f(x0 - (h * A) / n, y0 - (h * B) / n)) / (2 * h), ex.answer.value, 'derivada a lo largo de la recta', 1e-7);
  },
  'vec-mixta'(ex) {
    const { a, m, n, x0, y0 } = ex.params;
    const f = (x, y) => a * x ** m * y ** n;
    const h = 1e-3;
    const v = (f(x0 + h, y0 + h) - f(x0 + h, y0 - h) - f(x0 - h, y0 + h) + f(x0 - h, y0 - h)) / (4 * h * h);
    assertClose(v, ex.answer.value, 'diferencia finita mixta', 1e-4);
  },
  'vec-doble-triangulo'(ex) {
    const { p, q, A } = ex.params;
    const v = simpson((x) => simpson((y) => p * x + q * y, 0, x, 40), 0, A, 400);
    assertClose(v, ex.answer.value, 'integral iterada numérica', 1e-8);
  },
  'vec-triple'(ex) {
    const { k, A, B, C } = ex.params;
    const n = 40;
    let s = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let l = 0; l < n; l++) {
      s += k * ((i + 0.5) * A / n) * ((j + 0.5) * B / n) * ((l + 0.5) * C / n);
    }
    assertClose(s * ((A * B * C) / n ** 3), ex.answer.value, 'punto medio en la caja', 1e-9);
  },
  'vec-polar'(ex) {
    const { k, R } = ex.params;
    // en cartesianas, sin pasar a polares
    const v = simpson((x) => {
      const Y = Math.sqrt(Math.max(0, R * R - x * x));
      return simpson((y) => k * (x * x + y * y), -Y, Y, 60);
    }, -R, R, 4000);
    assertClose(v, ex.answer.value, 'integral en cartesianas', 1e-4);
    assert.match(ex.answer.latex, /\\pi/);
  },
  'vec-rotacional'(ex) {
    const { a, b, c, d, x0, y0 } = ex.params;
    const P = (x, y) => a * x * y + b * y;
    const Q = (x) => c * x * x + d * x;
    const r = 1e-3;
    // circulación por unidad de área en un cuadrito alrededor del punto
    const [L, R, D, U] = [x0 - r, x0 + r, y0 - r, y0 + r];
    const v = line(P, Q, [L, D], [R, D], 8) + line(P, Q, [R, D], [R, U], 8) + line(P, Q, [R, U], [L, U], 8) + line(P, Q, [L, U], [L, D], 8);
    assertClose(v / (4 * r * r), ex.answer.value, 'circulación local', 1e-5);
  },
  'vec-trabajo-potencial'(ex) {
    const { a, b, c, x1, y1, x2, y2 } = ex.params;
    const P = (x, y) => 2 * a * x + c * y;
    const Q = (x, y) => 2 * b * y + c * x;
    assertClose(line(P, Q, [x1, y1], [x2, y2]), ex.answer.value, 'integral de línea recta', 1e-9);
    // otro camino, en L: debe dar lo mismo
    assertClose(line(P, Q, [x1, y1], [x2, y1]) + line(P, Q, [x2, y1], [x2, y2]), ex.answer.value, 'integral de línea en L', 1e-9);
  },
  'vec-green'(ex) {
    const { a, b, A, B } = ex.params;
    const P = (x, y) => a * y;
    const Q = (x) => b * x;
    const v = line(P, Q, [0, 0], [A, 0], 20) + line(P, Q, [A, 0], [A, B], 20) + line(P, Q, [A, B], [0, B], 20) + line(P, Q, [0, B], [0, 0], 20);
    assertClose(v, ex.answer.value, 'circulación por los cuatro lados', 1e-9);
  },
  'al-traza-det'(ex) {
    const { a, b, c, d, ask } = ex.params;
    // raíces del polinomio det(A − λI), halladas con la fórmula general desde dos evaluaciones del determinante
    const p = (l) => gaussDet([[a - l, b], [c, d - l]]);
    const B = p(1) - p(0) - 1;
    const C = p(0);
    const s = Math.sqrt(Math.max(0, B * B - 4 * C)); // una raíz doble puede dar −ε por redondeo
    const [r1, r2] = [(-B + s) / 2, (-B - s) / 2];
    assertClose(ask === 'suma' ? r1 + r2 : r1 * r2, ex.answer.value, 'valores propios', 1e-9);
  },
  'al-eigenvector'(ex) {
    const { a, b, c, d, l } = ex.params;
    const y = ex.answer.value;
    assertClose(a + b * y, l, 'primera fila de Av = λv', 1e-12);
    assertClose(c + d * y, l * y, 'segunda fila de Av = λv', 1e-12);
  },
  'al-eigen-3'(ex) {
    const { a, b, c } = ex.params;
    const A = [[a, b, 0], [b, a, 0], [0, 0, c]];
    assertClose(gaussDet(A.map((r, i) => r.map((v, j) => v - (i === j ? ex.answer.value : 0)))) + 1, 1, 'es valor propio', 1e-9);
    // iteración de potencia con desplazamiento: converge al valor propio algebraicamente mayor
    const S = 30;
    let v = [0.31, 0.73, 0.59];
    let lambda = 0;
    for (let i = 0; i < 6000; i++) {
      const w = A.map((r, k) => r.reduce((p, x, j) => p + x * v[j], 0) + S * v[k]);
      const n = Math.hypot(...w);
      lambda = n - S;
      v = w.map((x) => x / n);
    }
    assertClose(lambda, ex.answer.value, 'iteración de potencia', 1e-6);
  },
  'pe-mediana'(ex) {
    const { xs } = ex.params;
    const m = ex.answer.value;
    // definición: al menos la mitad de los datos a cada lado
    assert.ok(xs.filter((x) => x <= m).length >= xs.length / 2);
    assert.ok(xs.filter((x) => x >= m).length >= xs.length / 2);
    if (xs.length % 2) assert.ok(xs.includes(m));
  },
  'pe-media-ponderada'(ex) {
    const { w, g } = ex.params;
    // repetir cada calificación tantas veces como su peso y promediar
    const all = g.flatMap((x, i) => Array(w[i]).fill(x));
    assert.equal(all.length, 100);
    assertClose(all.reduce((a, b) => a + b, 0) / 100, ex.answer.value, 'promedio expandido', 1e-12);
  },
  'pe-varianza-muestral'(ex) {
    const { xs } = ex.params;
    // promedio de (xᵢ − xⱼ)²/2 entre pares distintos: fórmula equivalente sin usar la media
    let s = 0;
    let n = 0;
    for (let i = 0; i < xs.length; i++) for (let j = 0; j < xs.length; j++) if (i !== j) {
      s += (xs[i] - xs[j]) ** 2 / 2;
      n++;
    }
    assertClose(s / n, ex.answer.value, 'varianza por pares', 1e-12);
  },
  'vc-armonica-conjugada'(ex) {
    const { a, b, x0, y0 } = ex.params;
    const h = 1e-4;
    const u = (x, y) => a * (x * x - y * y) + b * x;
    const ux = (x, y) => (u(x + h, y) - u(x - h, y)) / (2 * h);
    const uy = (x, y) => (u(x, y + h) - u(x, y - h)) / (2 * h);
    // v se reconstruye integrando Cauchy–Riemann por un camino en L desde el origen
    const v = simpson((x) => -uy(x, 0), 0, x0, 200) + simpson((y) => ux(x0, y), 0, y0, 200);
    assertClose(v, ex.answer.value, 'v integrada', 1e-6);
  },
  'vc-residuo'(ex) {
    const { a, b, k } = ex.params;
    // (1/2πi)∮ f(z) dz sobre un círculo pequeño alrededor de a
    const r = 0.25;
    const n = 4000;
    let re = 0;
    for (let i = 0; i < n; i++) {
      const t = (2 * Math.PI * i) / n;
      const [c, s] = [Math.cos(t), Math.sin(t)];
      // f(z)·(z − a) con z = a + r·e^{it}: el promedio sobre el círculo es el residuo
      const [dx, dy] = [a - b + r * c, r * s];
      re += (k * dx) / (dx * dx + dy * dy);
    }
    assertClose(re / n, ex.answer.value, 'residuo por contorno', 1e-8);
  },
  'vc-cauchy'(ex) {
    const { a, c, R, n } = ex.params;
    assert.ok(Math.abs(a) < R, 'el polo queda dentro');
    const N = 20000;
    let re = 0;
    let im = 0;
    for (let i = 0; i < N; i++) {
      const t = (2 * Math.PI * i) / N;
      const [x, y] = [R * Math.cos(t), R * Math.sin(t)];
      const [nr, ni] = [x * x - y * y + c, 2 * x * y];
      const [dr, di] = [x - a, y];
      const q = dr * dr + di * di;
      const [fr, fi] = [(nr * dr + ni * di) / q, (ni * dr - nr * di) / q];
      // dz = i·z·dθ
      const [zr, zi] = [-y, x];
      re += (fr * zr - fi * zi) * ((2 * Math.PI) / N);
      im += (fr * zi + fi * zr) * ((2 * Math.PI) / N);
    }
    assert.ok(Math.abs(re) < 1e-7, 'parte real nula');
    assertClose(im / Math.PI, n, 'integral de contorno', 1e-7);
    assert.match(ex.answer.latex, /\\pi i/);
  },
  'lim-doble-lhopital'(ex) {
    const { variant, k, m } = ex.params;
    const f = (x) => (variant === 'cos' ? 2 * Math.sin((k * x) / 2) ** 2 : Math.expm1(k * x) - k * x) / (m * x * x);
    assertClose((f(1e-4) + f(-1e-4)) / 2, ex.answer.value, 'límite numérico', 1e-6);
  },
  'derivada-implicita-segunda'(ex) {
    const { x0, y0, r } = ex.params;
    const y = (x) => Math.sign(y0) * Math.sqrt(r * r - x * x);
    assertClose(y(x0), y0, 'el punto está en la curva', 1e-12);
    const h = 1e-3;
    assertClose((y(x0 + h) - 2 * y(x0) + y(x0 - h)) / (h * h), ex.answer.value, 'segunda diferencia', 1e-4);
  },
  'ed-lineal'(ex) {
    const { a, K, y0 } = ex.params;
    const [y1] = rk4((_t, [y]) => [a * K - a * y], [y0], 1);
    assertClose(K + ex.answer.value * Math.exp(-a), y1, 'simulación', 1e-8);
  },
  'ed-pvi-segundo'(ex) {
    const { r1, r2, y0, v0 } = ex.params;
    assert.ok(r1 > r2);
    const [p, q] = [-(r1 + r2), r1 * r2];
    const [y1] = rk4((_t, [y, v]) => [v, -p * v - q * y], [y0, v0], 1);
    const C1 = ex.answer.value;
    assertClose(C1 * Math.exp(r1) + (y0 - C1) * Math.exp(r2), y1, 'simulación', 1e-7);
  },
  'ma-laplace-edo'(ex) {
    const { a, y0, k } = ex.params;
    // ∫₀^∞ e^{−st} y(t) dt, con y(t) simulada, comparado con el Y(s) que se muestra
    const s = 2;
    const T = 25;
    const [, I] = rk4((t, [y]) => [k - a * y, Math.exp(-s * t) * y], [y0, 0], T, 40000);
    const shown = ex.answer.latex.match(/^\\frac\{(.+)\}\{s\(s \+ (\d+)\)\}$/);
    assert.ok(shown, ex.answer.latex);
    const num = compileLatex(shown[1].replace(/s/g, 'x'))({ x: s });
    assertClose(num / (s * (s + Number(shown[2]))), I, 'Laplace numérica', 1e-5);
  },
  'op-lagrange-producto'(ex) {
    const { S } = ex.params;
    let best = 0;
    const n = 300;
    for (let i = 1; i < n; i++) for (let j = 1; i + j < n; j++) {
      const [x, y] = [(S * i) / n, (S * j) / n];
      best = Math.max(best, x * y * (S - x - y));
    }
    assert.ok(best <= ex.answer.value + 1e-9, 'nada supera al máximo');
    assertClose(best, ex.answer.value, 'búsqueda en malla', 1e-3);
  },
  'pe-bayes'(ex) {
    const { d, s, f } = ex.params;
    const N = 1_000_000;
    const con = (N * d) / 1000;
    const sanas = N - con;
    const verdaderos = (con * s) / 100;
    const falsos = (sanas * f) / 100;
    assertClose(verdaderos / (verdaderos + falsos), ex.answer.value, 'conteo de piezas', 1e-12);
  },
  'ss-potencia'(ex) {
    const { A, B, w } = ex.params;
    const T = (2 * Math.PI) / w;
    assertClose(simpson((t) => (A * Math.cos(w * t) + B) ** 2, 0, T, 2000) / T, ex.answer.value, 'promedio en un periodo', 1e-9);
  },
  'mn-newton-doble'(ex) {
    const { c, x0 } = ex.params;
    // forma babilónica: promedio de x y c/x
    const step = (x) => (x + c / x) / 2;
    assertClose(step(step(x0)), ex.answer.value, 'dos pasos babilónicos', 1e-12);
  },
  'al-inversa-3'(ex) {
    const { m, i, j } = ex.params;
    const e = [0, 0, 0];
    e[j] = 1;
    assertClose(solveLinear(m, e)[i], ex.answer.value, 'columna de la inversa', 1e-9);
  },
  'mo-logistica'(ex) {
    const { m, K } = ex.params;
    let best = 0;
    for (let i = 0; i <= 10000; i++) {
      const P = (K * i) / 10000;
      best = Math.max(best, (P / m) * (1 - P / K));
    }
    assertClose(best, ex.answer.value, 'máximo por búsqueda', 1e-9);
  },
  'mo-sistema-lineal'(ex) {
    const { a, b, c, d } = ex.params;
    const f = (_t, [x, y]) => [a * x + b * y, c * x + d * y];
    const [x, y] = rk4(f, [0.9, 0.7], 8, 16000);
    const final = Math.hypot(x, y);
    const start = Math.hypot(0.9, 0.7);
    const det = a * d - b * c;
    const tr = a + d;
    const v = ex.answer.latex.slice(6, -1);
    if (v === 'Punto silla') assert.ok(det < 0);
    if (v === 'Nodo estable') {
      assert.ok(det > 0 && tr < 0 && tr * tr - 4 * det >= 0);
      assert.ok(final < start / 2, 'la trayectoria decae');
    }
    if (v === 'Nodo inestable') {
      assert.ok(det > 0 && tr > 0 && tr * tr - 4 * det >= 0);
      assert.ok(final > start * 2, 'la trayectoria crece');
    }
    if (v === 'Centro') {
      assert.ok(close(tr, 0, 1e-12) && det > 0);
      assert.ok(final < 20 * start && final > start / 20, 'la trayectoria queda acotada');
    }
  },
};
