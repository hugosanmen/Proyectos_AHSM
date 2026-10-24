// templates-n3.js — Nivel 3: Métodos Numéricos, Probabilidad y Estadística, Variable Compleja.

import { fr, safeFr, ansOf, num, dFr, compact, comb, perm, terms, polyLatex, cplx, TRIPLES, intNot, uniqueDistractors, numericDistractors } from './helpers.js';

const interval = (lo, hi) => `\\left[${lo.toLatex()},\; ${hi.toLatex()}\\right]`;
const poly = (cs, x) => cs.reduce((s, c, i) => s + c * x ** i, 0);

export const templatesN3 = [
  // ═════════════ MÉTODOS NUMÉRICOS ═════════════
  {
    id: 'mn-biseccion',
    topic: 'Raíces de ecuaciones',
    difficulty: 2,
    generate(rng) {
      let c;
      do {
        c = rng.int(2, 40);
      } while (Number.isInteger(Math.sqrt(c)));
      const root = Math.sqrt(c);
      const a = Math.max(0, Math.floor(root) - rng.int(0, 2));
      const b = Math.ceil(root) + rng.int(0, 2);
      const m = fr(a + b, 2);
      const fm = m.value ** 2 - c;
      const keepLeft = fm > 0; // f(m) > 0 → la raíz está en [a, m]
      const lo = keepLeft ? fr(a) : m;
      const hi = keepLeft ? m : fr(b);
      const other = keepLeft ? interval(m, fr(b)) : interval(fr(a), m);
      const ansLatex = interval(lo, hi);
      return {
        params: { c, a, b },
        statement: { text: `Aplica UNA iteración de bisección a f(x) = x² − ${c} en el intervalo [${a}, ${b}]. ¿Qué intervalo contiene a la raíz?`, latex: `f(x)=x^{2}-${c}` },
        answer: { latex: ansLatex, interval: [lo.value, hi.value] },
        steps: [
          { latex: `m=\\frac{${a}+${b}}{2}=${m.toLatex()}`, note: 'Calcula el punto medio del intervalo.' },
          { latex: `f(m)=\\left(${m.toLatex()}\\right)^{2}-${c}=${fr(m.n * m.n - c * m.d * m.d, m.d * m.d).toLatex()}`, note: `Evalúa f en m: f(${a}) y f(${b}) tienen signos opuestos, así que la raíz está donde cambie el signo.` },
          { latex: ansLatex, note: fm > 0 ? 'f(m) > 0 tiene el mismo signo que f(b): la raíz queda en [a, m].' : 'f(m) < 0 tiene el mismo signo que f(a): la raíz queda en [m, b].' },
        ],
        distractors: uniqueDistractors(ansLatex, [
          { latex: other, feedback: 'Escogiste la mitad equivocada: conserva la mitad donde f cambia de signo.' },
          { latex: interval(fr(a), fr(b)), feedback: 'Esa es la lista original; una iteración debe reducir el intervalo a la mitad.' },
          { latex: interval(fr(a - 1), m), feedback: 'El intervalo se acorta con el punto medio; no se agranda hacia afuera.' },
          { latex: interval(m, fr(b + 1)), feedback: 'El intervalo se acorta con el punto medio; no se agranda hacia afuera.' },
        ]),
      };
    },
  },
  {
    id: 'mn-newton',
    topic: 'Raíces de ecuaciones',
    difficulty: 2,
    generate(rng) {
      const c = rng.int(2, 60);
      const x0 = rng.int(1, 9);
      const x1 = fr(x0 * x0 + c, 2 * x0);
      return {
        params: { c, x0 },
        statement: { text: `Calcula x₁ con UNA iteración del método de Newton–Raphson para aproximar √${c}:`, latex: `f(x)=x^{2}-${c},\\quad x_0=${x0}` },
        answer: ansOf(x1),
        steps: [
          { latex: `x_1=x_0-\\frac{f(x_0)}{f'(x_0)}=${x0}-\\frac{${x0 * x0 - c}}{${2 * x0}}`, note: "Newton: x₁ = x₀ − f(x₀)/f′(x₀), con f′(x) = 2x." },
          { latex: `x_1=${x1.toLatex()}`, note: 'Resta con cuidado el signo de f(x₀).' },
        ],
        distractors: numericDistractors(x1, compact([
          dFr(fr(x0 * x0 - c, 2 * x0), 'Eso es solo f(x₀)/f′(x₀); falta restarlo a x₀.'),
          dFr(fr(x0 - (x0 * x0 - c)), 'Olvidaste dividir entre la derivada f′(x₀).'),
          dFr(fr(x0 + (x0 * x0 - c), 2 * x0), 'La resta cambia de signo: x₁ = x₀ − f/f′, no x₀ + f/f′.'),
        ])),
      };
    },
  },
  {
    id: 'mn-trapecio',
    topic: 'Integración y EDO numéricas',
    difficulty: 3,
    generate(rng) {
      const p = rng.int(1, 3);
      const q = rng.int(-4, 4);
      const r = rng.int(-5, 5);
      const a = rng.int(-2, 2);
      const h = rng.int(1, 3);
      const m = a + h;
      const b = a + 2 * h;
      const f = (x) => poly([r, q, p], x);
      const T = (h * (f(a) + 2 * f(m) + f(b))) / 2;
      const S = fr(h * (f(a) + 4 * f(m) + f(b)), 3);
      return {
        params: { p, q, r, a, h },
        expr: polyLatex([r, q, p]),
        statement: { text: `Aproxima la integral con la regla del trapecio usando 2 subintervalos (h = ${h}):`, latex: `\\int_{${a}}^{${b}} \\left(${polyLatex([r, q, p])}\\right)dx` },
        answer: ansOf(fr(T)),
        steps: [
          { latex: `x_0=${a},\; x_1=${m},\; x_2=${b}`, note: 'Los nodos están separados por h.' },
          { latex: `T=\\frac{h}{2}\\left[f(x_0)+2f(x_1)+f(x_2)\\right]=\\frac{${h}}{2}\\left[${f(a)}+2(${f(m)})+${f(b)}\\right]=${T}`, note: 'Los extremos pesan 1 y el nodo interior pesa 2.' },
        ],
        distractors: numericDistractors(fr(T), compact([
          dFr(S, 'Esos son los pesos 1-4-1 de Simpson, no los del trapecio (1-2-1).'),
          dFr(fr(h * (f(a) + 2 * f(m) + f(b))), 'Olvidaste el factor 1/2: T = (h/2)[…].'),
          dFr(fr(h * (f(a) + f(b))), 'Solo usaste los extremos; el nodo interior también cuenta (con peso 2).'),
        ])),
      };
    },
  },
  {
    id: 'mn-simpson',
    topic: 'Integración y EDO numéricas',
    difficulty: 3,
    generate(rng) {
      const cs = [rng.int(-4, 4), rng.int(-4, 4), rng.int(-3, 3), rng.nonZero(-2, 2)];
      const a = rng.int(-2, 2);
      const h = rng.int(1, 3);
      const m = a + h;
      const b = a + 2 * h;
      const f = (x) => poly(cs, x);
      const S = fr(h * (f(a) + 4 * f(m) + f(b)), 3);
      const T = fr(h * (f(a) + 2 * f(m) + f(b)), 2);
      return {
        params: { cs, a, h },
        expr: polyLatex(cs),
        statement: { text: `Aproxima la integral con la regla de Simpson 1/3 usando 2 subintervalos (h = ${h}):`, latex: `\\int_{${a}}^{${b}} \\left(${polyLatex(cs)}\\right)dx` },
        answer: ansOf(S),
        steps: [
          { latex: `x_0=${a},\; x_1=${m},\; x_2=${b}`, note: 'Simpson usa un número par de subintervalos.' },
          { latex: `S=\\frac{h}{3}\\left[f(x_0)+4f(x_1)+f(x_2)\\right]=\\frac{${h}}{3}\\left[${f(a)}+4(${f(m)})+${f(b)}\\right]=${S.toLatex()}`, note: 'Pesos 1-4-1. Para polinomios hasta grado 3 el resultado es exacto.' },
        ],
        distractors: numericDistractors(S, compact([
          dFr(T, 'Esos son los pesos 1-2-1 del trapecio; Simpson usa 1-4-1 y h/3.'),
          dFr(fr(f(a) + 4 * f(m) + f(b)), 'Te faltó el factor h/3.'),
          dFr(fr(h * (f(a) + 2 * f(m) + f(b)), 3), 'El nodo central pesa 4, no 2.'),
        ])),
      };
    },
  },
  {
    id: 'mn-euler',
    topic: 'Integración y EDO numéricas',
    difficulty: 3,
    generate(rng) {
      const p = rng.int(-3, 3);
      const q = rng.nonZero(-3, 3);
      const y0 = rng.int(-4, 4);
      const h = rng.int(1, 3);
      const f = (x, y) => p * x + q * y;
      const y1 = y0 + h * f(0, y0);
      const y2 = y1 + h * f(h, y1);
      const back = y0 + h * f(h, y0);
      return {
        params: { p, q, y0, h },
        statement: { text: `Con el método de Euler y paso h = ${h}, calcula y(${2 * h}) (dos pasos):`, latex: `y' = ${terms([[p, 'x'], [q, 'y']])},\\quad y(0)=${y0}` },
        answer: ansOf(fr(y2)),
        steps: [
          { latex: `y_1=y_0+h\\,f(x_0,y_0)=${y0}+${h}\\,(${f(0, y0)})=${y1}`, note: 'Euler: y_{n+1} = y_n + h·f(x_n, y_n).' },
          { latex: `y_2=y_1+h\\,f(x_1,y_1)=${num(y1)}+${h}\\,(${f(h, y1)})=${y2}`, note: `Segundo paso con x₁ = ${h}.` },
        ],
        distractors: numericDistractors(fr(y2), compact([
          dFr(fr(y1), 'Ese es y₁ (un solo paso); te piden dos.'),
          dFr(fr(back + h * f(h, back)), 'Evaluaste f en x_{n+1}; Euler usa el punto actual x_n.'),
          dFr(fr(y1 + f(h, y1)), 'Te faltó multiplicar por h.'),
        ])),
      };
    },
  },

  // ═════════════ PROBABILIDAD Y ESTADÍSTICA ═════════════
  {
    id: 'pe-combinatoria',
    topic: 'Combinatoria y probabilidad',
    difficulty: 1,
    generate(rng) {
      const n = rng.int(5, 12);
      const k = rng.int(2, Math.min(4, n - 1));
      const ordered = rng.pick([true, false]);
      const val = ordered ? perm(n, k) : comb(n, k);
      const other = ordered ? comb(n, k) : perm(n, k);
      return {
        params: { n, k, ordered },
        statement: { text: ordered ? `De un grupo de ${n} estudiantes se eligen ${k} para ocupar, en orden, los puestos de presidente, secretario, etc. ¿De cuántas formas puede hacerse?` : `De un grupo de ${n} estudiantes se elige un equipo de ${k} personas (sin importar el orden). ¿Cuántos equipos distintos hay?`, latex: ordered ? `P(${n},${k})` : `\\binom{${n}}{${k}}` },
        answer: ansOf(fr(val)),
        steps: ordered
          ? [{ latex: `P(n,k)=\\frac{n!}{(n-k)!}=${Array.from({ length: k }, (_, i) => n - i).join('\\cdot ')}`, note: 'El orden importa: cada lugar se llena con una opción menos.' }, { latex: `=${val}`, note: 'Multiplica.' }]
          : [{ latex: `\\binom{n}{k}=\\frac{n!}{k!\\,(n-k)!}=\\frac{${Array.from({ length: k }, (_, i) => n - i).join('\\cdot ')}}{${k}!}`, note: 'El orden no importa: divide entre las k! formas de ordenar al equipo.' }, { latex: `=${val}`, note: 'Simplifica.' }],
        distractors: numericDistractors(fr(val), compact([
          dFr(fr(other), ordered ? 'Esa cuenta sin importar el orden; aquí el orden SÍ importa.' : 'Esa cuenta el orden; aquí el orden NO importa (hay que dividir entre k!).'),
          dFr(fr(n ** k), 'No se puede repetir a la misma persona: es n·(n−1)·…, no n^k.'),
          dFr(fr(n * k), 'No es n·k: hay que multiplicar k factores decrecientes.'),
        ])),
      };
    },
  },
  {
    id: 'pe-condicional',
    topic: 'Combinatoria y probabilidad',
    difficulty: 2,
    generate(rng) {
      const both = rng.int(3, 20);
      const onlyA = rng.int(2, 20);
      const onlyC = rng.int(2, 20);
      const none = rng.int(1, 15);
      const N = both + onlyA + onlyC + none;
      const val = fr(both, both + onlyA);
      return {
        params: { both, onlyA, onlyC, none },
        statement: { text: `En un grupo de ${N} estudiantes: ${both} aprobaron Álgebra y Cálculo, ${onlyA} solo Álgebra, ${onlyC} solo Cálculo y ${none} ninguna. Si un estudiante aprobó Álgebra, ¿cuál es la probabilidad de que también haya aprobado Cálculo?`, latex: 'P(C\\mid A)' },
        answer: ansOf(val),
        steps: [
          { latex: `P(C\\mid A)=\\frac{P(A\\cap C)}{P(A)}=\\frac{${both}}{${both + onlyA}}`, note: 'El universo se reduce a quienes aprobaron Álgebra.' },
          { latex: `=${val.toLatex()}`, note: 'Simplifica.' },
        ],
        distractors: numericDistractors(val, compact([
          dFr(fr(both, both + onlyC), 'Esa es P(A | C): condicionaste al revés.'),
          dFr(fr(both, N), 'Esa es P(A ∩ C) sobre todo el grupo; ya sabes que aprobó Álgebra.'),
          dFr(fr(both, onlyA), 'Dividiste entre quienes aprobaron SOLO Álgebra; el universo es todo A (incluye a los que aprobaron ambas).'),
        ])),
      };
    },
  },
  {
    id: 'pe-varianza',
    topic: 'Estadística descriptiva',
    difficulty: 2,
    generate(rng) {
      const n = rng.int(4, 6);
      const xs = Array.from({ length: n }, () => rng.int(1, 12));
      const S = xs.reduce((a, b) => a + b, 0);
      const Q = xs.reduce((a, b) => a + b * b, 0);
      const ss = n * Q - S * S; // n·Σ(x−μ)²
      if (ss === 0) xs[0] += 1; // evita varianza nula
      const S2 = xs.reduce((a, b) => a + b, 0);
      const Q2 = xs.reduce((a, b) => a + b * b, 0);
      const ss2 = n * Q2 - S2 * S2;
      const v = fr(ss2, n * n);
      return {
        params: { xs },
        statement: { text: 'Calcula la varianza POBLACIONAL de los datos:', latex: xs.join(',\; ') },
        answer: ansOf(v),
        steps: [
          { latex: `\\mu=\\frac{${S2}}{${n}}=${fr(S2, n).toLatex()}`, note: 'Primero la media.' },
          { latex: `\\sigma^{2}=\\frac{\\sum (x_i-\\mu)^{2}}{n}=\\frac{\\sum x_i^{2}}{n}-\\mu^{2}=\\frac{${Q2}}{${n}}-\\left(${fr(S2, n).toLatex()}\\right)^{2}=${v.toLatex()}`, note: 'Atajo: promedio de cuadrados menos cuadrado del promedio.' },
        ],
        distractors: numericDistractors(v, compact([
          dFr(fr(ss2, n * (n - 1)), 'Eso es la varianza MUESTRAL (÷ n−1); pedían la poblacional (÷ n).'),
          dFr(fr(ss2, n), 'Te faltó dividir entre n: eso es la suma de cuadrados de las desviaciones.'),
          dFr(fr(Q2, n), 'Te faltó restar el cuadrado de la media.'),
        ])),
      };
    },
  },
  {
    id: 'pe-binomial',
    topic: 'Distribuciones',
    difficulty: 3,
    generate(rng) {
      const n = rng.int(3, 6);
      const k = rng.int(1, n - 1);
      const m = rng.pick([2, 3, 4]); // p = 1/m
      const val = fr(comb(n, k) * (m - 1) ** (n - k), m ** n);
      return {
        params: { n, k, m },
        statement: { text: `Un experimento tiene probabilidad de éxito p = 1/${m}. Si se repite ${n} veces de forma independiente, ¿cuál es la probabilidad de exactamente ${k} éxitos?`, latex: `P(X=${k}),\\quad X\\sim \\text{Bin}\\left(${n},\\tfrac{1}{${m}}\\right)` },
        answer: ansOf(val),
        steps: [
          { latex: `P(X=k)=\\binom{n}{k}p^{k}(1-p)^{n-k}`, note: 'Fórmula binomial.' },
          { latex: `=\\binom{${n}}{${k}}\\left(\\tfrac{1}{${m}}\\right)^{${k}}\\left(\\tfrac{${m - 1}}{${m}}\\right)^{${n - k}}=${val.toLatex()}`, note: 'Sustituye y simplifica.' },
        ],
        distractors: numericDistractors(val, compact([
          dFr(fr(comb(n, k) * (m - 1) ** k, m ** n), 'Intercambiaste p y 1−p: éxito va con p^k, fracaso con (1−p)^(n−k).'),
          dFr(fr(1, m ** k), 'Solo calculaste p^k; falta el combinatorio y la parte de fracasos.'),
          dFr(fr((m - 1) ** (n - k), m ** n), 'Te faltó el coeficiente binomial C(n, k).'),
        ])),
      };
    },
  },
  {
    id: 'pe-zscore',
    topic: 'Distribuciones',
    difficulty: 1,
    generate(rng) {
      const mu = rng.int(40, 100);
      const sigma = rng.int(2, 15);
      const x = mu + rng.nonZero(-3 * sigma, 3 * sigma);
      const z = fr(x - mu, sigma);
      return {
        params: { mu, sigma, x },
        statement: { text: `Las calificaciones de un examen tienen media ${mu} y desviación estándar ${sigma}. ¿Cuál es el puntaje estándar (z) de una calificación de ${x}?`, latex: 'z=\\frac{x-\\mu}{\\sigma}' },
        answer: ansOf(z),
        steps: [
          { latex: `z=\\frac{${x}-${mu}}{${sigma}}=\\frac{${x - mu}}{${sigma}}`, note: 'Resta la media y divide entre la desviación estándar.' },
          { latex: `z=${z.toLatex()}`, note: 'Positivo = por encima de la media; negativo = por debajo.' },
        ],
        distractors: numericDistractors(z, compact([
          dFr(fr(mu - x, sigma), 'Invertiste la resta: es x − μ.'),
          dFr(fr(x - mu, sigma * sigma), 'Se divide entre σ, no entre σ².'),
          dFr(fr(x, sigma), 'Olvidaste restar la media antes de dividir.'),
        ])),
      };
    },
  },

  // ═════════════ FUNCIONES DE VARIABLE COMPLEJA ═════════════
  {
    id: 'vc-modulo',
    topic: 'Números complejos',
    difficulty: 1,
    generate(rng) {
      const [p, q, h] = rng.pick(TRIPLES.slice(0, 4));
      const m = rng.int(1, 2);
      const swap = rng.pick([true, false]);
      const a = (swap ? q : p) * m * rng.pick([-1, 1]);
      const b = (swap ? p : q) * m * rng.pick([-1, 1]);
      return {
        params: { a, b },
        statement: { text: 'Calcula el módulo del número complejo:', latex: `|z|,\\quad z=${cplx(a, b)}` },
        answer: ansOf(fr(h * m)),
        steps: [
          { latex: `|z|=\\sqrt{a^{2}+b^{2}}=\\sqrt{(${a})^{2}+(${b})^{2}}`, note: 'El módulo es la longitud del vector (a, b).' },
          { latex: `=\\sqrt{${a * a + b * b}}=${h * m}`, note: 'Suma los cuadrados y saca la raíz.' },
        ],
        distractors: numericDistractors(fr(h * m), compact([
          dFr(fr(Math.abs(a) + Math.abs(b)), 'Sumaste las partes; el módulo es la hipotenusa.'),
          dFr(fr(a * a + b * b), 'Te faltó la raíz cuadrada.'),
          dFr(fr(Math.abs(a) - Math.abs(b)), 'Las partes se elevan al cuadrado y se SUMAN.'),
        ])),
      };
    },
  },
  {
    id: 'vc-producto',
    topic: 'Números complejos',
    difficulty: 2,
    generate(rng) {
      const a = rng.nonZero(-6, 6);
      const b = rng.nonZero(-6, 6);
      const c = rng.nonZero(-6, 6);
      const d = rng.nonZero(-6, 6);
      const part = rng.pick(['real', 'imaginaria']);
      const re = a * c - b * d;
      const im = a * d + b * c;
      const val = part === 'real' ? re : im;
      return {
        params: { a, b, c, d, part },
        statement: { text: `Calcula la parte ${part} del producto:`, latex: `(${cplx(a, b)})(${cplx(c, d)})` },
        answer: ansOf(fr(val)),
        steps: [
          { latex: `(${cplx(a, b)})(${cplx(c, d)}) = ${a * c} + ${num(a * d)}i + ${num(b * c)}i + ${num(b * d)}i^{2}`, note: 'Distribuye como en álgebra normal.' },
          { latex: `= (${a * c} ${b * d >= 0 ? '-' : '+'} ${Math.abs(b * d)}) + (${num(a * d)} + ${num(b * c)})i = ${cplx(re, im)}`, note: 'Recuerda que i² = −1, así que −bd cambia de signo.' },
        ],
        distractors: numericDistractors(fr(val), compact([
          dFr(fr(part === 'real' ? a * c + b * d : a * d - b * c), 'Con i² = −1 el término bd se RESTA en la parte real (y en la imaginaria se suman ad + bc).'),
          dFr(fr(part === 'real' ? im : re), 'Esa es la otra parte del resultado.'),
          dFr(fr(part === 'real' ? a * c : a * d), 'Te faltó el otro término de esa parte.'),
        ])),
      };
    },
  },
  {
    id: 'vc-potencia-i',
    topic: 'Números complejos',
    difficulty: 2,
    generate(rng) {
      const n = rng.int(5, 98);
      const forms = ['1', 'i', '-1', '-i'];
      const r = n % 4;
      const ansLatex = forms[r];
      return {
        params: { n },
        statement: { text: 'Simplifica la potencia de la unidad imaginaria:', latex: `i^{${n}}` },
        answer: { latex: ansLatex },
        steps: [
          { latex: 'i^{1}=i,\; i^{2}=-1,\; i^{3}=-i,\; i^{4}=1', note: 'Las potencias de i se repiten en ciclos de 4.' },
          { latex: `${n} = 4\\cdot ${Math.floor(n / 4)} + ${r}\;\\Rightarrow\; i^{${n}} = (i^{4})^{${Math.floor(n / 4)}}\\, i^{${r}} = ${ansLatex}`, note: 'Divide el exponente entre 4: solo importa el residuo.' },
        ],
        distractors: forms.filter((f) => f !== ansLatex).map((f) => ({ latex: f, feedback: `Divide ${n} entre 4 y mira el residuo (${r}): las potencias se repiten cada 4.` })),
      };
    },
  },
  {
    id: 'vc-division',
    topic: 'Números complejos',
    difficulty: 3,
    generate(rng) {
      const p = rng.int(-5, 5);
      const q = rng.nonZero(-5, 5);
      const c = rng.nonZero(-4, 4);
      const d = rng.nonZero(-4, 4);
      const nr = p * c - q * d;
      const ni = p * d + q * c;
      const ans = cplx(p, q);
      return {
        params: { p, q, c, d },
        statement: { text: 'Calcula el cociente y escríbelo en la forma a + bi:', latex: `\\frac{${cplx(nr, ni)}}{${cplx(c, d)}}` },
        answer: { latex: ans },
        steps: [
          { latex: `\\frac{${cplx(nr, ni)}}{${cplx(c, d)}}\\cdot\\frac{${cplx(c, -d)}}{${cplx(c, -d)}}`, note: 'Multiplica arriba y abajo por el conjugado del denominador.' },
          { latex: `=\\frac{${cplx(nr * c + ni * d, ni * c - nr * d)}}{${c * c + d * d}}=${ans}`, note: 'El denominador queda real: c² + d².' },
        ],
        distractors: uniqueDistractors(ans, [
          { latex: cplx(p, -q), feedback: 'Cambiaste el signo de la parte imaginaria (conjugado del resultado).' },
          { latex: cplx(q, p), feedback: 'Intercambiaste parte real e imaginaria.' },
          { latex: cplx(p * (c * c + d * d), q * (c * c + d * d)), feedback: 'Olvidaste dividir entre c² + d² al final.' },
          { latex: cplx(-p, -q), feedback: 'Revisa los signos: el resultado completo cambió de signo.' },
        ]),
      };
    },
  },
  {
    id: 'vc-derivada',
    topic: 'Funciones analíticas',
    difficulty: 3,
    generate(rng) {
      const a = rng.int(-4, 4);
      const b = rng.nonZero(-4, 4);
      const c = rng.int(-4, 4);
      const d = rng.nonZero(-4, 4);
      const re = 2 * a + c;
      const im = 2 * b + d;
      const ans = cplx(re, im);
      // f(z0) = z0² + α z0
      const f0re = a * a - b * b + (c * a - d * b);
      const f0im = 2 * a * b + (c * b + d * a);
      return {
        params: { a, b, c, d },
        statement: { text: `Calcula f′(z₀) para la función analítica, con z₀ = ${cplx(a, b)}:`, latex: `f(z)=z^{2}+(${cplx(c, d)})\\,z` },
        answer: { latex: ans },
        steps: [
          { latex: "f'(z)=2z+(" + cplx(c, d) + ')', note: 'Las reglas de derivación de siempre valen para funciones analíticas.' },
          { latex: `f'(z_0)=2(${cplx(a, b)})+(${cplx(c, d)})=${ans}`, note: 'Sustituye z₀ y suma parte real con parte real, imaginaria con imaginaria.' },
        ],
        distractors: uniqueDistractors(ans, [
          { latex: cplx(2 * a, 2 * b), feedback: 'Se te perdió la derivada del término (c + di)z, que es la constante c + di.' },
          { latex: cplx(a + c, b + d), feedback: 'La derivada de z² es 2z, no z.' },
          { latex: cplx(f0re, f0im), feedback: 'Eso es f(z₀), el valor de la función, no su derivada.' },
          { latex: cplx(re, -im), feedback: 'Cambiaste el signo de la parte imaginaria.' },
        ]),
      };
    },
  },
];
