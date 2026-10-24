// utils.js — utilidades puras, sin dependencias (funcionan igual en Node y en el navegador)

/** Generador pseudoaleatorio determinista (mulberry32): misma semilla → mismo ejercicio. */
export function createRng(seed) {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng = {
    next,
    /** Entero en [min, max], ambos incluidos. */
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    pick: (arr) => arr[Math.floor(next() * arr.length)],
    /** Entero en [min, max] distinto de cero. */
    nonZero: (min, max) => {
      let v;
      do {
        v = rng.int(min, max);
      } while (v === 0);
      return v;
    },
  };
  return rng;
}

/** Fisher-Yates con el RNG determinista. */
export function shuffle(rng, arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));

/** Fracción exacta (siempre reducida, denominador positivo). */
export class Fraction {
  constructor(n, d = 1) {
    if (d === 0) throw new Error('Denominador cero');
    if (d < 0) {
      n = -n;
      d = -d;
    }
    const g = gcd(n, d) || 1;
    this.n = n / g || 0; // `|| 0` evita -0
    this.d = d / g;
  }
  get value() {
    return this.n / this.d;
  }
  toLatex() {
    if (this.d === 1) return String(this.n);
    return `${this.n < 0 ? '-' : ''}\\frac{${Math.abs(this.n)}}{${this.d}}`;
  }
}

/**
 * Polinomio en LaTeX. coefs[i] es el coeficiente de x^i.
 * polyLatex([2, 0, -3, 1]) → "x^{3} - 3x^{2} + 2"
 */
export function polyLatex(coefs, v = 'x') {
  let out = '';
  for (let p = coefs.length - 1; p >= 0; p--) {
    const c = coefs[p];
    if (c === 0) continue;
    const abs = Math.abs(c);
    let body;
    if (p === 0) body = String(abs);
    else {
      const coef = abs === 1 ? '' : String(abs);
      body = coef + (p === 1 ? v : `${v}^{${p}}`);
    }
    if (out === '') out = (c < 0 ? '-' : '') + body;
    else out += (c < 0 ? ' - ' : ' + ') + body;
  }
  return out || '0';
}

/**
 * Elige `n` distractores distintos entre sí y distintos de la respuesta correcta.
 * Cada candidato: { latex, feedback } (el feedback explica el error típico).
 */
export function uniqueDistractors(correctLatex, candidates, n = 3) {
  const seen = new Set([correctLatex]);
  const out = [];
  for (const c of candidates) {
    if (seen.has(c.latex)) continue;
    seen.add(c.latex);
    out.push(c);
    if (out.length === n) break;
  }
  return out;
}

/** Igual que uniqueDistractors, con relleno genérico (correcta ±1, ±2) para respuestas numéricas. */
export function numericDistractors(correct, specifics, n = 3) {
  const pad = [1, -1, 2, -2].map((k) => ({
    latex: new Fraction(correct.n + k * correct.d, correct.d).toLatex(),
    feedback: 'Revisa la aritmética del último paso.',
  }));
  return uniqueDistractors(correct.toLatex(), [...specifics, ...pad], n);
}
