// templates-fi.js — plantillas basadas en los temarios, series y exámenes finales de Ciencias Básicas
// (Álgebra, Cálculo Integral, Matemáticas Avanzadas y Variable Compleja). Se usan los temas y el estilo de los
// reactivos, nunca sus enunciados. Cada plantilla tiene un oráculo independiente en test/oracles/fi.js
// y su idea clave en ideas.js.

import { fr, ansOf, dFr, co, terms, polyLatex, cplx, intNot, uniqueDistractors, numericDistractors, TRIPLES } from './helpers.js';

// ───────────── utilidades locales ─────────────
const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
const rad = (d) => (d * Math.PI) / 180;
const sinD = (d) => Math.sin(rad(d));
const cosD = (d) => Math.cos(rad(d));
const r2 = (x) => Math.round(x * 100) / 100 + 0;
const decTex = (x) => String(r2(x));
const dec = (x) => ({ latex: decTex(x), value: r2(x) });
const add = (f, g) => fr(f.n * g.d + g.n * f.d, f.d * g.d);
const mul = (f, g) => fr(f.n * g.n, f.d * g.d);
const neg = (f) => fr(-f.n, f.d);
const sumFr = (list) => list.reduce(add, fr(0));

/** Respuesta decimal con relleno de distractores cercanos (todos con dos decimales como máximo). */
function decDistractors(ans, specifics) {
  const pad = [0.5, -0.5, 1, -1].map((k) => ({
    latex: decTex(ans.value + k),
    feedback: `Tu resultado queda ${Math.abs(k)} por ${k > 0 ? 'encima' : 'debajo'}: revisa que la calculadora esté en grados.`,
  }));
  return uniqueDistractors(ans.latex, [...specifics, ...pad]);
}

/** Múltiplo racional de π. */
function piFr(f) {
  if (f.n === 0) return '0';
  if (f.d === 1) return co(f.n, '\\pi');
  return `${f.n < 0 ? '-' : ''}\\frac{${Math.abs(f.n) === 1 ? '' : Math.abs(f.n)}\\pi}{${f.d}}`;
}
const piAns = (f) => ({ latex: piFr(f), value: f.value * Math.PI });
/** Relleno para respuestas en múltiplos de π. */
function piDistractors(ans, specifics) {
  const pad = [
    [fr(1, 2), 'Tu resultado queda π/2 por encima del correcto: revisa la cuenta final.'],
    [fr(-1, 2), 'Tu resultado queda π/2 por debajo del correcto: algo se quedó fuera.'],
    [fr(1), 'Tu resultado queda π por encima del correcto: sobra un término.'],
  ].map(([k, feedback]) => ({ latex: piFr(add(ans, k)), feedback }));
  return uniqueDistractors(piFr(ans), [...specifics, ...pad]);
}

/** f/π y f/π² en LaTeX. */
const overPiK = (f, k) => {
  if (f.n === 0) return '0';
  const piTex = k === 2 ? '\\pi^{2}' : '\\pi';
  return `${f.n < 0 ? '-' : ''}\\frac{${Math.abs(f.n)}}{${f.d === 1 ? '' : f.d}${piTex}}`;
};
const overPi = (f) => overPiK(f, 1);
const overPi2 = (f) => overPiK(f, 2);
/** Respuesta f/π^k con relleno: doble, mitad y signo contrario. */
function overPiDistractors(f, k, specifics) {
  const tex = (g) => overPiK(g, k);
  const pad = [
    [mul(f, fr(2)), 'Es el doble del resultado: revisa el factor 2/L.'],
    [mul(f, fr(1, 2)), 'Es la mitad del resultado: la integral sobre todo el periodo se duplica por simetría.'],
    [neg(f), 'Tiene el signo contrario: revisa el valor de cos(nπ) = (−1)ⁿ.'],
  ].map(([g, feedback]) => ({ latex: tex(g), feedback }));
  return uniqueDistractors(tex(f), [...specifics, ...pad]);
}

/** Complejo con partes racionales: cfr(fr(1,2), fr(-3)) → "\frac{1}{2} - 3i". */
function cfr(re, im) {
  const imTex = (f) => {
    const a = Math.abs(f.n);
    return f.d === 1 ? (a === 1 ? 'i' : `${a}i`) : `\\frac{${a}}{${f.d}}i`;
  };
  if (im.n === 0) return re.toLatex();
  if (re.n === 0) return (im.n < 0 ? '-' : '') + imTex(im);
  return `${re.toLatex()} ${im.n < 0 ? '-' : '+'} ${imTex(im)}`;
}
/** (a + bi)/(c + di) con enteros → [re, im] como fracciones. */
const cdivFr = ([a, b], [c, d]) => [fr(a * c + b * d, c * c + d * d), fr(b * c - a * d, c * c + d * d)];
const cmulI = ([a, b], [c, d]) => [a * c - b * d, a * d + b * c];

const normDeg = (d) => ((d % 360) + 360) % 360;
const cis = (r, d) => `${r === 1 ? '' : `${r}\\,`}\\text{cis}\\,${normDeg(d)}^{\\circ}`;
const pmatrix = (m) => `\\begin{pmatrix}${m.map((r) => r.join(' & ')).join(' \\\\ ')}\\end{pmatrix}`;
const det2 = (m) => m[0][0] * m[1][1] - m[0][1] * m[1][0];
const det3 = (m) =>
  m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
const mm2 = (A, B) => [0, 1].map((i) => [0, 1].map((j) => A[i][0] * B[0][j] + A[i][1] * B[1][j]));
const madd = (A, B, s = 1) => A.map((r, i) => r.map((v, j) => v + s * B[i][j]));
const tr2 = (A) => [[A[0][0], A[1][0]], [A[0][1], A[1][1]]];
const inv2 = (A) => {
  const d = det2(A);
  return [[A[1][1] * d, -A[0][1] * d], [-A[1][0] * d, A[0][0] * d]]; // d = ±1, así 1/d = d
};
/** Matriz entera 2×2 con determinante ±1. */
function unimodular(rng) {
  const s = rng.int(-2, 2);
  const t = rng.nonZero(-2, 2);
  const M = [[1 + s * t, s], [t, 1]];
  return rng.next() < 0.5 ? M : [M[1], M[0]];
}
/** "+ t" o "- t" para encadenar términos tras otro ya escrito. */
const tail = (t) => (t === '0' ? '' : t.startsWith('-') ? ` - ${t.slice(1)}` : ` + ${t}`);
const fracTerm = (num, den) => (den === 1 ? num : `\\frac{${num}}{${den}}`);
const powF = (f, p, u) => (p === 1 ? `\\${f}(${u})` : `\\${f}^{${p}}(${u})`);
const kx = (k) => (k === 1 ? 'x' : `${k}x`);

export const templatesFI = [
  // ═════════════ TRIGONOMETRÍA ═════════════
  {
    id: 'trig-ley-senos',
    topic: 'Trigonometría',
    difficulty: 3,
    generate(rng) {
      const A = 5 * rng.int(5, 16);
      const B = 5 * rng.int(6, Math.min(19, (150 - A) / 5));
      const a = rng.int(5, 20);
      const C = 180 - A - B;
      const ans = dec((a * sinD(B)) / sinD(A));
      return {
        params: { A, B, a },
        statement: {
          text: 'En un triángulo, el lado a está frente al ángulo A y el lado b frente al ángulo B. ¿Cuánto mide b? Redondea a dos decimales.',
          latex: `A=${A}^{\\circ},\\quad B=${B}^{\\circ},\\quad a=${a}`,
        },
        answer: ans,
        steps: [
          { latex: `\\frac{a}{\\sin A}=\\frac{b}{\\sin B}`, note: 'Ley de senos: cada lado entre el seno de su ángulo opuesto da lo mismo.' },
          { latex: `b=\\frac{${a}\\sin ${B}^{\\circ}}{\\sin ${A}^{\\circ}}`, note: 'Despeja b.' },
          { latex: `b\\approx ${ans.latex}`, note: 'Evalúa con la calculadora en grados.' },
        ],
        distractors: decDistractors(ans, [
          { latex: decTex((a * sinD(A)) / sinD(B)), feedback: 'Invertiste el cociente: b = a·sen B / sen A.' },
          { latex: decTex((a * sinD(C)) / sinD(A)), feedback: `Usaste el ángulo C = ${C}°, pero el lado b está frente a B.` },
          { latex: decTex(a * sinD(B)), feedback: 'Faltó dividir entre sen A.' },
        ]),
      };
    },
  },
  {
    id: 'trig-ley-cosenos',
    topic: 'Trigonometría',
    difficulty: 3,
    generate(rng) {
      const reloj = rng.next() < 0.5;
      let p, q, th, hr, statement;
      if (reloj) {
        p = rng.int(3, 8);
        q = p + rng.int(1, 6);
        hr = intNot(rng, 1, 11, 3, 6, 9);
        th = 30 * Math.min(hr, 12 - hr);
        statement = {
          text: `Las manecillas de un reloj miden ${p} cm (horaria) y ${q} cm (minutero). ¿Qué distancia hay entre sus puntas a esta hora? Redondea a dos decimales.`,
          latex: `${hr}{:}00`,
        };
      } else {
        p = rng.int(3, 12);
        q = rng.int(3, 12);
        th = 10 * intNot(rng, 2, 16, 9);
        statement = { text: 'Dos lados de un triángulo miden a y b, y forman el ángulo θ. ¿Cuánto mide el tercer lado? Redondea a dos decimales.', latex: `a=${p},\\quad b=${q},\\quad \\theta=${th}^{\\circ}` };
      }
      const c2 = p * p + q * q - 2 * p * q * cosD(th);
      const ans = dec(Math.sqrt(c2));
      return {
        params: { p, q, th, hr: hr ?? 0 },
        statement,
        answer: ans,
        steps: [
          ...(reloj ? [{ latex: `\\theta=${th}^{\\circ}`, note: 'Cada hora del reloj abarca 30°; toma el ángulo menor entre las manecillas.' }] : []),
          { latex: `c^{2}=a^{2}+b^{2}-2ab\\cos\\theta`, note: 'Ley de cosenos con el ángulo que forman los dos lados conocidos.' },
          { latex: `c^{2}=${p * p}+${q * q}-${2 * p * q}\\cos ${th}^{\\circ}`, note: 'Sustituye los datos.' },
          { latex: `c\\approx ${ans.latex}`, note: 'Saca la raíz cuadrada.' },
        ],
        distractors: decDistractors(ans, [
          { latex: decTex(Math.sqrt(p * p + q * q + 2 * p * q * cosD(th))), feedback: 'El término 2ab·cos θ se resta, no se suma.' },
          { latex: decTex(c2), feedback: 'Ese es c²: faltó sacar la raíz cuadrada.' },
          { latex: decTex(Math.hypot(p, q)), feedback: 'Pitágoras solo sirve si el ángulo es recto.' },
        ]),
      };
    },
  },
  {
    id: 'trig-ecuacion',
    topic: 'Trigonometría',
    difficulty: 4,
    generate(rng) {
      // sen x = p/2 y sen x = q/2; p, q ∈ [−2, 4] (3 y 4 dan valores imposibles).
      const p = rng.int(-2, 2);
      const q = intNot(rng, -2, 4, p);
      const SUM = { '-2': fr(3, 2), '-1': fr(3), 0: fr(1), 1: fr(1), 2: fr(1, 2) };
      const PRIN = { '-2': fr(-1, 2), '-1': fr(-1, 6), 0: fr(0), 1: fr(1, 6), 2: fr(1, 2) };
      const COS = { '-2': fr(1), '-1': fr(2), 0: fr(2), 1: fr(2), 2: fr(0) };
      const SOLS = { '-2': ['\\frac{3\\pi}{2}'], '-1': ['\\frac{7\\pi}{6}', '\\frac{11\\pi}{6}'], 0: ['0', '\\pi'], 1: ['\\frac{\\pi}{6}', '\\frac{5\\pi}{6}'], 2: ['\\frac{\\pi}{2}'] };
      const valid = [p, q].filter((v) => Math.abs(v) <= 2);
      const S = sumFr(valid.map((v) => SUM[v]));
      const g = gcd(gcd(4, Math.abs(2 * (p + q))), Math.abs(p * q)) || 4;
      const eq = terms([[4 / g, '\\sin^{2}x'], [(-2 * (p + q)) / g, '\\sin x'], [(p * q) / g, '']]);
      const fct = (v) => `(${polyLatex([-v, 2], '\\sin x')})`;
      const cands = [
        { latex: piFr(sumFr(valid.map((v) => PRIN[v]))), feedback: 'Solo tomaste el valor principal de arcsen; en [0, 2π) hay más soluciones.' },
        { latex: piFr(sumFr(valid.map((v) => COS[v]))), feedback: 'Esas son las soluciones de cos x, no de sen x.' },
      ];
      if (valid.includes(0)) cands.push({ latex: piFr(add(S, fr(2))), feedback: 'El intervalo [0, 2π) no incluye 2π.' });
      return {
        params: { p, q },
        statement: { text: 'Resuelve en el intervalo [0, 2π) y da la suma de todas las soluciones:', latex: `${eq}=0` },
        answer: piAns(S),
        steps: [
          { latex: `${fct(p)}${fct(q)}=0`, note: 'Factoriza como una cuadrática en sen x.' },
          {
            latex: `\\sin x=${fr(p, 2).toLatex()}\\quad\\text{o}\\quad\\sin x=${fr(q, 2).toLatex()}`,
            note: valid.length < 2 ? 'El seno solo toma valores entre −1 y 1: descarta el valor imposible.' : 'Iguala cada factor a cero.',
          },
          { latex: `x\\in\\left\\{${valid.flatMap((v) => SOLS[v]).join(',\\ ')}\\right\\}`, note: 'Busca en la circunferencia unitaria todos los ángulos con ese seno.' },
          { latex: `\\text{suma}=${piFr(S)}`, note: 'Suma las soluciones.' },
        ],
        distractors: piDistractors(S, cands),
      };
    },
  },
  {
    id: 'trig-identidad',
    topic: 'Trigonometría',
    difficulty: 2,
    generate(rng) {
      const k = rng.int(1, 3);
      const u = kx(k);
      const u2 = kx(2 * k);
      const ITEMS = [
        [`\\frac{1-\\cos^{2}(${u})}{\\sin(${u})}`, `\\sin(${u})`, [
          [`\\cos(${u})`, 'Confundiste la identidad: 1 − cos²u = sen²u.'],
          [`\\sin^{2}(${u})`, 'Faltó cancelar un sen u con el denominador.'],
          ['1', 'No se cancela todo: queda un factor sen u.'],
        ]],
        [`\\tan(${u})\\cos(${u})`, `\\sin(${u})`, [
          ['1', 'tan u no es 1/cos u: es sen u / cos u.'],
          [`\\cot(${u})`, 'tan u = sen u / cos u; al multiplicar por cos u queda sen u.'],
          [`\\cos^{2}(${u})`, 'El coseno no se multiplica por sí mismo: se cancela con el de tan u.'],
        ]],
        [`(\\sec^{2}(${u})-1)\\cos^{2}(${u})`, `\\sin^{2}(${u})`, [
          [`\\tan^{2}(${u})`, 'sec²u − 1 = tan²u, pero aún falta multiplicar por cos²u.'],
          [`\\cos^{2}(${u})`, 'sec²u·cos²u = 1, así que queda 1 − cos²u = sen²u.'],
          ['1', 'Distribuye: sec²u·cos²u − cos²u = 1 − cos²u.'],
        ]],
        [`\\frac{\\sin(${u2})}{2\\sin(${u})}`, `\\cos(${u})`, [
          [`\\sin(${u})`, 'sen 2u = 2 sen u cos u: al cancelar 2 sen u queda cos u.'],
          ['1', 'sen 2u no es 2 sen u.'],
          [`\\cos^{2}(${u})`, 'Solo hay un cos u en el desarrollo de sen 2u.'],
        ]],
        [`(\\sin(${u})+\\cos(${u}))^{2}-1`, `\\sin(${u2})`, [
          ['0', '(a + b)² ≠ a² + b²: falta el doble producto.'],
          [`\\cos(${u2})`, 'El doble producto 2 sen u cos u es sen 2u, no cos 2u.'],
          [`\\sin(${u})\\cos(${u})`, 'Faltó el 2 del doble producto.'],
        ]],
        [`\\cos^{4}(${u})-\\sin^{4}(${u})`, `\\cos(${u2})`, [
          ['1', 'Diferencia de cuadrados: (cos² − sen²)(cos² + sen²); solo el segundo factor vale 1.'],
          [`\\sin(${u2})`, 'cos²u − sen²u es cos 2u, no sen 2u.'],
          [`\\cos^{2}(${u})`, 'No se cancela sen²u: los dos factores se multiplican.'],
        ]],
        [`\\frac{\\tan(${u})}{\\sec(${u})}`, `\\sin(${u})`, [
          [`\\cos(${u})`, 'Dividir entre sec u es multiplicar por cos u: tan u·cos u = sen u.'],
          ['1', 'tan u y sec u no son la misma función.'],
          [`\\csc(${u})`, 'Invertiste el resultado: queda sen u, no su recíproco.'],
        ]],
        [`\\frac{1}{1+\\cos(${u})}+\\frac{1}{1-\\cos(${u})}`, `2\\csc^{2}(${u})`, [
          [`\\frac{2}{\\cos^{2}(${u})}`, 'El denominador común es 1 − cos²u = sen²u, no cos²u.'],
          ['2', 'Las fracciones no se suman sumando denominadores.'],
          [`\\csc^{2}(${u})`, 'Faltó el 2 del numerador: (1 − cos u) + (1 + cos u) = 2.'],
        ]],
      ];
      const idx = rng.int(0, ITEMS.length - 1);
      const [expr, ans, ds] = ITEMS[idx];
      return {
        params: { k, idx },
        expr,
        vars: ['x'],
        statement: { text: 'Simplifica la expresión con identidades trigonométricas:', latex: expr },
        answer: { latex: ans },
        steps: [
          { latex: '\\sin^{2}u+\\cos^{2}u=1,\\quad \\tan u=\\frac{\\sin u}{\\cos u},\\quad \\sin 2u=2\\sin u\\cos u', note: 'Ten a la mano las identidades básicas.' },
          { latex: `${expr}=${ans}`, note: 'Reescribe todo en senos y cosenos y simplifica.' },
        ],
        distractors: uniqueDistractors(ans, ds.map(([latex, feedback]) => ({ latex, feedback }))),
      };
    },
  },

  // ═════════════ NÚMEROS REALES ═════════════
  {
    id: 're-desigualdad-abs',
    topic: 'Números reales',
    difficulty: 3,
    generate(rng) {
      const cociente = rng.next() < 0.5;
      let lo, hi, latex, steps, swap;
      if (!cociente) {
        const a = rng.pick([2, 3, 4, 5]) * rng.pick([1, -1]);
        const b = rng.nonZero(-9, 9);
        const c = rng.int(1, 9);
        const e1 = fr(-c - b, a);
        const e2 = fr(c - b, a);
        [lo, hi] = e1.value < e2.value ? [e1, e2] : [e2, e1];
        const s1 = fr(-c + b, a);
        const s2 = fr(c + b, a);
        swap = s1.value < s2.value ? [s1, s2] : [s2, s1];
        latex = `\\left|${polyLatex([b, a])}\\right|<${c}`;
        steps = [
          { latex: `-${c}<${polyLatex([b, a])}<${c}`, note: '|u| < c equivale a −c < u < c.' },
          { latex: `${-c - b}<${co(a, 'x')}<${c - b}`, note: 'Resta el término constante en las tres partes.' },
          { latex: `${lo.toLatex()}<x<${hi.toLatex()}`, note: a < 0 ? 'Al dividir entre un número negativo, las desigualdades se invierten.' : 'Divide entre el coeficiente de x.' },
        ];
      } else {
        const p = rng.int(2, 3);
        let q, d, r1, r2;
        do {
          q = rng.int(-6, 6);
          d = rng.int(-5, 5);
          r1 = fr(-(q + d), p - 1);
          r2 = fr(d - q, p + 1);
        } while (p * d + q === 0 || r1.value === r2.value);
        [lo, hi] = r1.value < r2.value ? [r1, r2] : [r2, r1];
        swap = [neg(hi), neg(lo)];
        latex = `\\left|\\frac{${polyLatex([q, p])}}{${polyLatex([-d, 1])}}\\right|<1`;
        steps = [
          { latex: `(${polyLatex([q, p])})^{2}<(${polyLatex([-d, 1])})^{2},\\quad x\\neq ${d}`, note: 'Ambos lados son positivos: eleva al cuadrado sin cambiar la desigualdad.' },
          { latex: `(${polyLatex([q + d, p - 1])})(${polyLatex([q - d, p + 1])})<0`, note: 'Pasa todo a un lado y factoriza como diferencia de cuadrados.' },
          { latex: `${lo.toLatex()}<x<${hi.toLatex()}`, note: 'El producto es negativo entre las dos raíces.' },
        ];
      }
      const iv = (l, h) => `\\left(${l}, ${h}\\right)`;
      const ans = iv(lo.toLatex(), hi.toLatex());
      return {
        params: { cociente },
        statement: { text: 'Resuelve la desigualdad y escribe el conjunto solución como intervalo:', latex },
        answer: { latex: ans },
        steps,
        distractors: uniqueDistractors(ans, [
          { latex: `\\left[${lo.toLatex()}, ${hi.toLatex()}\\right]`, feedback: 'La desigualdad es estricta: los extremos no se incluyen.' },
          { latex: `\\left(-\\infty, ${lo.toLatex()}\\right)\\cup\\left(${hi.toLatex()}, \\infty\\right)`, feedback: 'Ese es el conjunto donde el valor absoluto es mayor, no menor.' },
          { latex: iv(swap[0].toLatex(), swap[1].toLatex()), feedback: 'Cambiaste un signo al despejar: revisa el término constante.' },
          { latex: `\\left(${lo.toLatex()}, \\infty\\right)`, feedback: 'Solo resolviste una de las dos desigualdades.' },
        ]),
      };
    },
  },
  {
    id: 're-suma-induccion',
    topic: 'Números reales',
    difficulty: 3,
    generate(rng) {
      const geo = rng.next() < 0.4;
      if (!geo) {
        const a = rng.int(1, 6);
        const b = rng.nonZero(-5, 5);
        if (a + 2 * b === 0) return this.generate(rng);
        const ans = `\\frac{n(${polyLatex([a + 2 * b, a], 'n')})}{2}`;
        const bn = `${b < 0 ? '-' : '+'} ${co(Math.abs(b), 'n')}`;
        return {
          params: { geo, a, b },
          vars: ['n'],
          statement: { text: 'Con inducción matemática se prueba una fórmula cerrada para esta suma. ¿Cuál es?', latex: `\\sum_{k=1}^{n} (${terms([[a, 'k'], [b, '']])})` },
          answer: { latex: ans },
          steps: [
            { latex: `${a}\\cdot\\frac{n(n+1)}{2}${b < 0 ? '-' : '+'}${Math.abs(b)}n`, note: 'Separa la suma: 1 + 2 + … + n = n(n + 1)/2 y la constante se suma n veces.' },
            { latex: `n=1:\\ ${a + b}=\\frac{1\\cdot ${a + a + 2 * b}}{2}`, note: 'Caso base: la fórmula da el primer término.' },
            { latex: ans, note: 'Paso inductivo: al sumar el término n + 1 a la fórmula de n se obtiene la de n + 1.' },
          ],
          distractors: uniqueDistractors(ans, [
            { latex: `\\frac{${a}n(n+1)}{2}${b < 0 ? '-' : '+'}${Math.abs(b)}`, feedback: 'El término constante se suma n veces: aporta bn, no b.' },
            { latex: `${co(a, 'n')}(n+1) ${bn}`, feedback: 'Faltó dividir entre 2: 1 + 2 + … + n = n(n + 1)/2.' },
            { latex: `\\frac{n(${polyLatex([2 * b - a, a], 'n')})}{2}`, feedback: 'Usaste n(n − 1)/2 en lugar de n(n + 1)/2.' },
          ]),
        };
      }
      const r = rng.int(2, 5);
      const c = rng.int(1, 5);
      const g = gcd(c, r - 1);
      const [cn, cd] = [c / g, (r - 1) / g];
      const pw = (e) => `${r}^{${e}}-1`;
      const closed = (e, den) => {
        const num = cn === 1 ? pw(e) : `${cn}(${pw(e)})`;
        return den === 1 ? num : `\\frac{${num}}{${den}}`;
      };
      const ans = closed('n', cd);
      return {
        params: { geo, r, c },
        vars: ['n'],
        statement: { text: 'Con inducción matemática se prueba una fórmula cerrada para esta suma. ¿Cuál es?', latex: `\\sum_{k=1}^{n} ${c === 1 ? '' : `${c}\\cdot `}${r}^{k-1}` },
        answer: { latex: ans },
        steps: [
          { latex: `${c}\\cdot\\frac{${r}^{n}-1}{${r}-1}`, note: 'Es una suma geométrica de razón r que empieza en exponente 0.' },
          { latex: `n=1:\\ ${c}=${c}\\cdot\\frac{${r}-1}{${r}-1}`, note: 'Caso base.' },
          { latex: ans, note: 'Paso inductivo: sumar c·rⁿ a la fórmula de n da la fórmula de n + 1.' },
        ],
        distractors: uniqueDistractors(ans, [
          { latex: closed('n+1', cd), feedback: 'La suma tiene n términos, con exponentes de 0 a n − 1.' },
          { latex: `\\frac{${c === 1 ? '' : c}(${pw('n')})}{${r}}`, feedback: 'El denominador de la suma geométrica es r − 1, no r.' },
          { latex: `${c === 1 ? '' : `${c}\\cdot `}${r}^{n}`, feedback: 'Faltó restar 1 y dividir entre r − 1.' },
        ]),
      };
    },
  },

  // ═════════════ COMPLEJOS EN FORMA POLAR ═════════════
  {
    id: 'cx-polar-operaciones',
    topic: 'Complejos en forma polar',
    difficulty: 2,
    generate(rng) {
      const prod = rng.next() < 0.5;
      const r2_ = rng.int(1, 4);
      const m = rng.int(1, 4);
      const r1 = prod ? rng.int(1, 5) : r2_ * m;
      const t1 = 15 * rng.int(1, 23);
      const t2 = 15 * rng.int(1, 23);
      const R = prod ? r1 * r2_ : m;
      const T = normDeg(prod ? t1 + t2 : t1 - t2);
      const ans = cis(R, T);
      const cands = prod
        ? [
            { latex: cis(r1 + r2_, T), feedback: 'Los módulos se multiplican, no se suman.' },
            { latex: cis(R, t1 - t2), feedback: 'Al multiplicar, los ángulos se suman.' },
            { latex: cis(R, T + 180), feedback: 'Sobra media vuelta: revisa la suma de ángulos.' },
            { latex: cis(R, T + 90), feedback: 'Sobra un cuarto de vuelta en el ángulo.' },
            { latex: cis(R + 1, T), feedback: 'El módulo no cuadra: multiplica los módulos.' },
            { latex: cis(R, T + 270), feedback: 'Falta un cuarto de vuelta en el ángulo.' },
          ]
        : [
            { latex: cis(m, t2 - t1), feedback: 'Se resta el ángulo del divisor al del dividendo, no al revés.' },
            { latex: cis(r1 * r2_, T), feedback: 'Al dividir, los módulos se dividen.' },
            { latex: cis(m, t1 + t2), feedback: 'Al dividir, los ángulos se restan.' },
            { latex: cis(m, T + 90), feedback: 'Sobra un cuarto de vuelta en el ángulo.' },
            { latex: cis(m + 1, T), feedback: 'El módulo no cuadra: divide los módulos.' },
            { latex: cis(m, T + 270), feedback: 'Falta un cuarto de vuelta en el ángulo.' },
          ];
      return {
        params: { prod, r1, t1, r2: r2_, t2 },
        statement: { text: prod ? 'Calcula el producto z₁·z₂ y exprésalo en forma polar:' : 'Calcula el cociente z₁ / z₂ y exprésalo en forma polar:', latex: `z_1=${cis(r1, t1)},\\quad z_2=${cis(r2_, t2)}` },
        answer: { latex: ans },
        steps: [
          { latex: prod ? `|z_1z_2|=${r1}\\cdot ${r2_}=${R}` : `\\left|\\frac{z_1}{z_2}\\right|=\\frac{${r1}}{${r2_}}=${R}`, note: prod ? 'El módulo del producto es el producto de los módulos.' : 'El módulo del cociente es el cociente de los módulos.' },
          { latex: prod ? `${t1}^{\\circ}+${t2}^{\\circ}\\equiv ${T}^{\\circ}` : `${t1}^{\\circ}-${t2}^{\\circ}\\equiv ${T}^{\\circ}`, note: 'Suma (o resta) los ángulos y llévalos a [0°, 360°).' },
          { latex: ans, note: 'Escribe el resultado en forma polar.' },
        ],
        distractors: uniqueDistractors(ans, cands),
      };
    },
  },
  {
    id: 'cx-demoivre',
    topic: 'Complejos en forma polar',
    difficulty: 3,
    generate(rng) {
      const [a0, b0] = rng.pick([[1, 1], [1, -1], [-1, 1], [-1, -1]]);
      const k = rng.int(1, 2);
      const n = rng.int(2, k === 2 ? 6 : 8);
      const z = [k * a0, k * b0];
      const pow = (e) => {
        let w = [1, 0];
        for (let i = 0; i < e; i++) w = cmulI(w, z);
        return w;
      };
      const [re, im] = pow(n);
      const [pr, pi] = pow(n - 1);
      const ans = cplx(re, im);
      const mod = k * k; // |z|² = 2k²
      const ang = normDeg((Math.atan2(b0, a0) * 180) / Math.PI);
      return {
        params: { a: z[0], b: z[1], n },
        statement: { text: 'Usa el teorema de De Moivre y da el resultado en forma binómica:', latex: `(${cplx(z[0], z[1])})^{${n}}` },
        answer: { latex: ans },
        steps: [
          { latex: `${cplx(z[0], z[1])}=\\sqrt{${2 * mod}}\\,\\text{cis}\\,${ang}^{\\circ}`, note: 'Pasa a forma polar: módulo y ángulo.' },
          { latex: `(\\sqrt{${2 * mod}})^{${n}}\\,\\text{cis}\\,${normDeg(n * ang)}^{\\circ}`, note: 'De Moivre: eleva el módulo y multiplica el ángulo por n.' },
          { latex: ans, note: 'Regresa a forma binómica.' },
        ],
        distractors: uniqueDistractors(ans, [
          { latex: cplx(z[0] ** n, z[1] ** n), feedback: 'No se eleva cada parte por separado: (a + b)ⁿ ≠ aⁿ + bⁿ.' },
          { latex: cplx(re, -im), feedback: 'Ese es el conjugado: revisa el signo del ángulo.' },
          { latex: cplx(-re, -im), feedback: 'Sobra media vuelta: revisa el ángulo n·θ.' },
          { latex: cplx(pr, pi), feedback: `Ese es el resultado con exponente ${n - 1}: multiplica el ángulo por n.` },
          { latex: cplx(re + 1, im), feedback: 'La parte real no cuadra: revisa el coseno de n·θ.' },
        ]),
      };
    },
  },
  {
    id: 'cx-raices',
    topic: 'Complejos en forma polar',
    difficulty: 4,
    generate(rng) {
      const n = rng.int(2, 4);
      const r = rng.int(1, n === 4 ? 2 : 3);
      const R = r ** n;
      const f0 = 10 * rng.int(1, Math.floor(36 / n) - 1);
      const th = n * f0;
      const k = rng.int(0, n - 1);
      const phi = normDeg(f0 + (360 / n) * k);
      const ans = cis(r, phi);
      const isRoot = (rr, a) => rr === r && normDeg(n * a - th) === 0;
      const cand = [
        [R, phi, 'No sacaste la raíz n-ésima al módulo.'],
        [r, phi + 180 / n, `Las raíces se separan 360°/${n}, no 180°/${n}.`],
        [r, th, 'Faltó dividir el ángulo entre n.'],
        [r, -phi, 'Ese es el conjugado de una raíz; no satisface la ecuación.'],
        [r + 1, phi, 'El módulo es la raíz n-ésima del módulo de w.'],
        [r, phi + 30, 'El ángulo no cuadra: n veces el ángulo debe dar el de w (más vueltas completas).'],
      ]
        .filter(([rr, a]) => !isRoot(rr, normDeg(a)))
        .map(([rr, a, feedback]) => ({ latex: cis(rr, a), feedback }));
      const NAMES = { 2: 'cuadradas', 3: 'cúbicas', 4: 'cuartas' };
      return {
        params: { n, R, th },
        statement: { text: `¿Cuál de estos números es una de las raíces ${NAMES[n]} de w?`, latex: `w=${cis(R, th)}` },
        answer: { latex: ans },
        steps: [
          { latex: `z_k=\\sqrt[${n}]{${R}}\\,\\text{cis}\\,\\frac{${th}^{\\circ}+360^{\\circ}k}{${n}}`, note: 'Las raíces n-ésimas tienen módulo ⁿ√R y ángulos separados 360°/n.' },
          { latex: `k=${k}:\\ ${ans}`, note: 'Cada valor de k da una raíz distinta.' },
        ],
        distractors: uniqueDistractors(ans, cand),
      };
    },
  },
  {
    id: 'cx-ecuacion',
    topic: 'Complejos en forma polar',
    difficulty: 3,
    generate(rng) {
      let z;
      do z = [rng.int(-4, 4), rng.int(-4, 4)];
      while (z[0] === 0 && z[1] === 0);
      const form = rng.pick(['i90', 'i180', 'i270', 'bin']);
      const r = rng.int(2, 3);
      let alpha, aTex;
      if (form === 'i90') [alpha, aTex] = [[0, r], `${r}e^{i\\frac{\\pi}{2}}`];
      else if (form === 'i180') [alpha, aTex] = [[-r, 0], `${r}e^{i\\pi}`];
      else if (form === 'i270') [alpha, aTex] = [[0, -r], `${r}\\,\\text{cis}\\,270^{\\circ}`];
      else {
        alpha = [rng.nonZero(-3, 3), rng.nonZero(-3, 3)];
        aTex = `(${cplx(alpha[0], alpha[1])})`;
      }
      const beta = [rng.int(-5, 5), rng.nonZero(-5, 5)];
      const az = cmulI(alpha, z);
      const gamma = [az[0] + beta[0], az[1] + beta[1]];
      const ans = cplx(z[0], z[1]);
      return {
        params: { form, r, alpha, beta, gamma },
        statement: { text: 'Resuelve para z y da el resultado en forma binómica:', latex: `${aTex}\\,z+(${cplx(beta[0], beta[1])})=${cplx(gamma[0], gamma[1])}` },
        answer: { latex: ans },
        steps: [
          { latex: `${aTex}=${cplx(alpha[0], alpha[1])}`, note: 'Pasa el coeficiente a forma binómica.' },
          { latex: `${aTex}\\,z=${cplx(az[0], az[1])}`, note: 'Resta el término independiente en ambos lados.' },
          { latex: `z=\\frac{${cplx(az[0], az[1])}}{${cplx(alpha[0], alpha[1])}}=${ans}`, note: 'Divide multiplicando por el conjugado del denominador.' },
        ],
        distractors: uniqueDistractors(ans, [
          { latex: cplx(az[0], az[1]), feedback: 'Faltó dividir entre el coeficiente de z.' },
          { latex: cplx(z[0], -z[1]), feedback: 'Al dividir se multiplica por el conjugado del denominador: revisa el signo de la parte imaginaria.' },
          { latex: cplx(-z[0], -z[1]), feedback: 'Te sobró un signo: revisa el valor del coeficiente en forma binómica.' },
          { latex: cplx(z[0] + 1, z[1]), feedback: 'La parte real no cuadra: revisa la resta del término independiente.' },
          { latex: cplx(z[0], z[1] + 1), feedback: 'La parte imaginaria no cuadra: revisa la resta del término independiente.' },
        ]),
      };
    },
  },

  // ═════════════ POLINOMIOS ═════════════
  {
    id: 'pol-residuo',
    topic: 'Polinomios',
    difficulty: 2,
    generate(rng) {
      const deg = rng.int(3, 4);
      const c = Array.from({ length: deg + 1 }, () => rng.int(-5, 5));
      c[deg] = rng.nonZero(-3, 3);
      const a = rng.nonZero(-3, 3);
      const P = (x) => c.reduce((s, v, i) => s + v * x ** i, 0);
      const val = fr(P(a));
      return {
        params: { c, a },
        statement: { text: 'Sin hacer la división, ¿cuál es el residuo de dividir p(x) entre el binomio?', latex: `p(x)=${polyLatex(c)},\\qquad ${polyLatex([-a, 1])}` },
        answer: ansOf(val),
        steps: [
          { latex: `r=p(${a})`, note: 'Teorema del residuo: dividir entre x − a deja como residuo p(a).' },
          { latex: `p(${a})=${val.toLatex()}`, note: 'Evalúa el polinomio.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(P(-a)), `Evaluaste en ${-a}; el divisor se anula en x = ${a}.`),
          dFr(fr(P(1)), 'Sumar los coeficientes da p(1), no el residuo.'),
          dFr(fr(c[0]), 'Ese es el término independiente.'),
        ]),
      };
    },
  },
  {
    id: 'pol-parametro',
    topic: 'Polinomios',
    difficulty: 3,
    generate(rng) {
      const r = rng.nonZero(-3, 3);
      const k = rng.nonZero(-5, 5);
      const b = rng.int(-6, 6);
      const c = -(r ** 3 + k * r * r + b * r);
      const rest = terms([[b, 'x'], [c, '']]);
      const kWrong = fr(r ** 3 + b * r - c, r * r);
      return {
        params: { r, b, c },
        statement: { text: `¿Qué valor debe tener k para que p(x) sea divisible entre ${polyLatex([-r, 1])}?`, latex: `p(x)=x^{3}+kx^{2}${tail(rest)}` },
        answer: ansOf(fr(k)),
        steps: [
          { latex: `p(${r})=0`, note: `Divisible entre x − a significa que p(a) = 0 (teorema del factor).` },
          { latex: `${r ** 3}+${r * r}k${tail(String(b * r))}${tail(String(c))}=0`, note: 'Sustituye x y deja una ecuación en k.' },
          { latex: `k=${k}`, note: 'Despeja k.' },
        ],
        distractors: numericDistractors(fr(k), [
          dFr(kWrong, `Sustituiste x = ${-r}; el divisor se anula en x = ${r}.`),
          dFr(fr(-k), 'Revisa el signo al despejar k.'),
          dFr(fr(k * r * r), 'Faltó dividir entre el coeficiente de k.'),
        ]),
      };
    },
  },
  {
    id: 'pol-raiz-racional',
    topic: 'Polinomios',
    difficulty: 3,
    generate(rng) {
      const p = rng.pick([1, 3, 5]) * rng.pick([1, -1]);
      const r2_ = rng.int(-3, 3);
      const r3 = intNot(rng, -3, 3, r2_);
      // (2x − p)(x − r2)(x − r3)
      const s = r2_ + r3;
      const q = r2_ * r3;
      const coefs = [-p * q, 2 * q + p * s, -2 * s - p, 2];
      const val = fr(p, 2);
      return {
        params: { coefs },
        statement: { text: 'El polinomio tiene una raíz racional que no es entera. ¿Cuál es?', latex: `p(x)=${polyLatex(coefs)}` },
        answer: ansOf(val),
        steps: [
          { latex: `\\pm\\frac{\\text{divisores de }${Math.abs(coefs[0]) || 'a_0'}}{\\text{divisores de }2}`, note: 'Las raíces racionales posibles son p/q con p divisor del término independiente y q del coeficiente principal.' },
          { latex: `p(x)=(${polyLatex([-p, 2])})(${polyLatex([-r2_, 1])})(${polyLatex([-r3, 1])})`, note: 'Prueba candidatas con división sintética hasta factorizar.' },
          { latex: `x=${val.toLatex()}`, note: 'El factor con coeficiente 2 da la raíz no entera.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(-p, 2), 'Cambiaste el signo de la raíz.'),
          dFr(fr(p), 'Faltó dividir entre el coeficiente principal.'),
          dFr(fr(2, p), 'Invertiste el cociente: el numerador divide al término independiente.'),
        ]),
      };
    },
  },
  {
    id: 'pol-raiz-compleja',
    topic: 'Polinomios',
    difficulty: 4,
    generate(rng) {
      const a = rng.int(-2, 2);
      const b = rng.int(1, 3);
      const r1 = rng.int(-4, 3);
      const r2_ = rng.int(r1 + 1, 4);
      const quad = [a * a + b * b, -2 * a, 1];
      const lin2 = [r1 * r2_, -(r1 + r2_), 1];
      const coefs = [0, 0, 0, 0, 0];
      quad.forEach((u, i) => lin2.forEach((v, j) => (coefs[i + j] += u * v)));
      return {
        params: { coefs, a, b },
        statement: { text: `El polinomio de coeficientes reales tiene la raíz ${cplx(a, b).replace(/\s/g, '')}. ¿Cuál es su mayor raíz real?`, latex: `p(x)=${polyLatex(coefs)}` },
        answer: ansOf(fr(r2_)),
        steps: [
          { latex: `x=${cplx(a, -b)}\\ \\text{también es raíz}`, note: 'Con coeficientes reales, las raíces complejas vienen en pares conjugados.' },
          { latex: `(x-(${cplx(a, b)}))(x-(${cplx(a, -b)}))=${polyLatex(quad)}`, note: 'Su producto es un factor cuadrático real.' },
          { latex: `\\frac{p(x)}{${polyLatex(quad)}}=${polyLatex(lin2)}=(${polyLatex([-r1, 1])})(${polyLatex([-r2_, 1])})`, note: 'Divide y factoriza el cociente.' },
        ],
        distractors: numericDistractors(fr(r2_), [
          dFr(fr(r1), 'Esa es la otra raíz real, la menor.'),
          dFr(fr(-r2_), 'Cambiaste el signo de la raíz.'),
          dFr(fr(a), 'Esa es la parte real de la raíz compleja, no una raíz real.'),
        ]),
      };
    },
  },
  {
    id: 'pol-descartes',
    topic: 'Polinomios',
    difficulty: 2,
    generate(rng) {
      const deg = rng.int(4, 6);
      const c = Array.from({ length: deg + 1 }, () => (rng.next() < 0.2 ? 0 : rng.nonZero(-9, 9)));
      c[deg] = rng.nonZero(-5, 5);
      c[0] = rng.nonZero(-9, 9);
      const changes = (arr) => {
        const s = arr.filter((v) => v !== 0).map(Math.sign);
        return s.slice(1).filter((v, i) => v !== s[i]).length;
      };
      const pos = changes([...c].reverse());
      const negC = changes(c.map((v, i) => (i % 2 ? -v : v)).reverse());
      return {
        params: { c },
        statement: { text: 'Según la regla de los signos de Descartes, ¿cuál es el número máximo de raíces reales positivas?', latex: `p(x)=${polyLatex(c)}` },
        answer: ansOf(fr(pos)),
        steps: [
          { latex: polyLatex(c), note: 'Recorre los coeficientes de mayor a menor grado, sin contar los ceros.' },
          { latex: `\\text{cambios de signo}=${pos}`, note: 'El número de raíces positivas es ese máximo o menor en un número par.' },
        ],
        distractors: numericDistractors(fr(pos), [
          dFr(fr(negC), 'Esos son los cambios de p(−x): acotan las raíces negativas.'),
          dFr(fr(deg), 'El grado acota el total de raíces, no las positivas.'),
          dFr(fr(pos + 1), 'Cuenta solo los cambios entre coeficientes consecutivos distintos de cero.'),
        ]),
      };
    },
  },

  // ═════════════ SISTEMAS Y MATRICES ═════════════
  {
    id: 'alg-sistema-3x3',
    topic: 'Ecuaciones y sistemas',
    difficulty: 3,
    generate(rng) {
      let M, D;
      do {
        M = [0, 1, 2].map(() => [0, 1, 2].map(() => rng.int(-3, 3)));
        D = det3(M);
      } while (D === 0 || M.some((r) => r.every((v) => v === 0)));
      const sol = [0, 1, 2].map(() => rng.int(-4, 4));
      const rhs = M.map((r) => r[0] * sol[0] + r[1] * sol[1] + r[2] * sol[2]);
      const idx = rng.int(0, 2);
      const V = ['x', 'y', 'z'];
      const Mi = M.map((r, i) => r.map((v, j) => (j === idx ? rhs[i] : v)));
      const rows = M.map((r, i) => `${terms(r.map((v, j) => [v, V[j]]))} = ${rhs[i]}`).join(' \\\\ ');
      return {
        params: { M, rhs, idx },
        statement: { text: `Resuelve el sistema. ¿Cuánto vale ${V[idx]}?`, latex: `\\begin{cases} ${rows} \\end{cases}` },
        answer: ansOf(fr(sol[idx])),
        steps: [
          { latex: `\\Delta=${D}`, note: 'Calcula el determinante del sistema; si no es cero, la solución es única.' },
          { latex: `\\Delta_{${V[idx]}}=${det3(Mi)}`, note: `Cambia la columna de ${V[idx]} por los términos independientes (regla de Cramer).` },
          { latex: `${V[idx]}=\\frac{${det3(Mi)}}{${D}}=${sol[idx]}`, note: 'Divide los determinantes.' },
        ],
        distractors: numericDistractors(fr(sol[idx]), [
          ...V.map((v, j) => (j === idx ? null : dFr(fr(sol[j]), `Ese es el valor de ${v}.`))),
          dFr(fr(-sol[idx]), 'Revisa el signo del determinante.'),
        ].filter(Boolean)),
      };
    },
  },
  {
    id: 'al-ecuacion-matricial',
    topic: 'Matrices',
    difficulty: 4,
    generate(rng) {
      const A = unimodular(rng);
      const B = unimodular(rng);
      const X = [0, 1].map(() => [0, 1].map(() => rng.int(-3, 3)));
      const C = [0, 1].map(() => [0, 1].map(() => rng.int(-3, 3)));
      const D = madd(mm2(mm2(A, X), B), tr2(C));
      const [i, j] = [rng.int(0, 1), rng.int(0, 1)];
      const Ai = inv2(A);
      const Bi = inv2(B);
      const E = madd(D, tr2(C), -1);
      const noT = mm2(mm2(Ai, madd(D, C, -1)), Bi);
      const swapped = mm2(mm2(Bi, E), Ai);
      const noB = mm2(Ai, E);
      return {
        params: { A, B, C, D, i, j },
        statement: {
          text: `Despeja X de la ecuación matricial. ¿Cuánto vale la entrada de la fila ${i + 1}, columna ${j + 1} de X?`,
          latex: `\\begin{gathered} AXB+C^{T}=D \\\\ A=${pmatrix(A)},\\ B=${pmatrix(B)} \\\\ C=${pmatrix(C)},\\ D=${pmatrix(D)} \\end{gathered}`,
        },
        answer: ansOf(fr(X[i][j])),
        steps: [
          { latex: 'X=A^{-1}(D-C^{T})B^{-1}', note: 'Resta Cᵀ y multiplica por las inversas: A⁻¹ por la izquierda y B⁻¹ por la derecha.' },
          { latex: `A^{-1}=${pmatrix(Ai)},\\quad B^{-1}=${pmatrix(Bi)}`, note: 'Inversa de 2×2: intercambia la diagonal, cambia signos fuera de ella y divide entre el determinante.' },
          { latex: `X=${pmatrix(X)}`, note: 'Multiplica en ese orden: el producto de matrices no conmuta.' },
        ],
        distractors: numericDistractors(fr(X[i][j]), [
          dFr(fr(noT[i][j]), 'Restaste C en lugar de su transpuesta Cᵀ.'),
          dFr(fr(swapped[i][j]), 'Multiplicaste las inversas en el orden contrario.'),
          dFr(fr(noB[i][j]), 'Faltó multiplicar por B⁻¹ a la derecha.'),
        ]),
      };
    },
  },

  // ═════════════ MÉTODOS DE INTEGRACIÓN ═════════════
  {
    id: 'int-partes',
    topic: 'Métodos de integración',
    difficulty: 3,
    generate(rng) {
      const variant = rng.pick(['exp', 'cos', 'sin', 'ln']);
      const k = rng.int(2, 5);
      const u = `${k}x`;
      let expr, ans, ds, st;
      if (variant === 'exp') {
        expr = `x e^{${u}}`;
        ans = `\\frac{x e^{${u}}}{${k}} - \\frac{e^{${u}}}{${k * k}} + C`;
        ds = [
          [`\\frac{x e^{${u}}}{${k}} + \\frac{e^{${u}}}{${k * k}} + C`, 'Al integrar por partes se resta ∫v du.'],
          [`\\frac{x e^{${u}}}{${k}} - \\frac{e^{${u}}}{${k}} + C`, 'La segunda integral vuelve a dividir entre k: queda k².'],
          [`\\frac{x e^{${u}}}{${k}} + C`, 'Faltó restar la integral ∫v du.'],
        ];
        st = ['u=x,\\quad dv=e^{' + u + '}dx', `v=\\frac{e^{${u}}}{${k}}`];
      } else if (variant === 'cos') {
        expr = `x\\cos(${u})`;
        ans = `\\frac{x\\sin(${u})}{${k}} + \\frac{\\cos(${u})}{${k * k}} + C`;
        ds = [
          [`\\frac{x\\sin(${u})}{${k}} - \\frac{\\cos(${u})}{${k * k}} + C`, '−∫sen = +cos: revisa el signo del segundo término.'],
          [`\\frac{x\\sin(${u})}{${k}} + \\frac{\\cos(${u})}{${k}} + C`, 'La segunda integral vuelve a dividir entre k: queda k².'],
          [`\\frac{x\\sin(${u})}{${k}} + C`, 'Faltó restar la integral ∫v du.'],
        ];
        st = [`u=x,\\quad dv=\\cos(${u})dx`, `v=\\frac{\\sin(${u})}{${k}}`];
      } else if (variant === 'sin') {
        expr = `x\\sin(${u})`;
        ans = `-\\frac{x\\cos(${u})}{${k}} + \\frac{\\sin(${u})}{${k * k}} + C`;
        ds = [
          [`-\\frac{x\\cos(${u})}{${k}} - \\frac{\\sin(${u})}{${k * k}} + C`, 'Restar ∫(−cos)/k da +sen/k²: revisa el signo.'],
          [`\\frac{x\\cos(${u})}{${k}} + \\frac{\\sin(${u})}{${k * k}} + C`, 'La integral de sen es −cos: falta el signo menos.'],
          [`-\\frac{x\\cos(${u})}{${k}} + C`, 'Faltó restar la integral ∫v du.'],
        ];
        st = [`u=x,\\quad dv=\\sin(${u})dx`, `v=-\\frac{\\cos(${u})}{${k}}`];
      } else {
        const n = k - 1; // 1..4
        const m = n + 1;
        expr = `x^{${n}}\\ln(x)`;
        ans = `\\frac{x^{${m}}\\ln(x)}{${m}} - \\frac{x^{${m}}}{${m * m}} + C`;
        ds = [
          [`\\frac{x^{${m}}\\ln(x)}{${m}} + \\frac{x^{${m}}}{${m * m}} + C`, 'Al integrar por partes se resta ∫v du.'],
          [`\\frac{x^{${m}}\\ln(x)}{${m}} - \\frac{x^{${m}}}{${m}} + C`, `La segunda integral es ∫xⁿ/${m} dx: vuelve a dividir entre ${m}.`],
          [`\\frac{x^{${m}}\\ln(x)}{${m}} + C`, 'Faltó restar la integral ∫v du.'],
        ];
        st = [`u=\\ln(x),\\quad dv=x^{${n}}dx`, `v=\\frac{x^{${m}}}{${m}}`];
      }
      return {
        params: { variant, k },
        expr,
        vars: ['x'],
        statement: { text: 'Calcula integrando por partes:', latex: `\\int ${expr}\\,dx` },
        answer: { latex: ans },
        steps: [
          { latex: st[0], note: variant === 'ln' ? 'Elige u = ln x: su derivada es más sencilla que la función.' : 'Elige u = x: al derivarla desaparece.' },
          { latex: `du=${variant === 'ln' ? '\\frac{dx}{x}' : 'dx'},\\quad ${st[1]}`, note: 'Deriva u e integra dv.' },
          { latex: `uv-\\int v\\,du=${ans}`, note: 'Aplica la fórmula de integración por partes.' },
        ],
        distractors: uniqueDistractors(ans, ds.map(([latex, feedback]) => ({ latex, feedback }))),
      };
    },
  },
  {
    id: 'int-fracciones-parciales',
    topic: 'Métodos de integración',
    difficulty: 4,
    generate(rng) {
      const a = rng.int(-4, 4);
      const b = intNot(rng, -4, 4, a);
      const A = rng.nonZero(-4, 4);
      const B = rng.nonZero(-4, 4);
      const num = polyLatex([-(A * b + B * a), A + B]);
      const den = polyLatex([a * b, -(a + b), 1]);
      const ln = (c) => `\\ln|${polyLatex([-c, 1])}|`;
      const pair = (p, q) => `${co(p, ln(a))} ${q < 0 ? '-' : '+'} ${co(Math.abs(q), ln(b))} + C`;
      const ans = pair(A, B);
      const expr = `\\frac{${num}}{${den}}`;
      return {
        params: { a, b, A, B },
        expr,
        vars: ['x'],
        statement: { text: 'Calcula con fracciones parciales:', latex: `\\int ${expr}\\,dx` },
        answer: { latex: ans },
        steps: [
          { latex: `${expr}=\\frac{A}{${polyLatex([-a, 1])}}+\\frac{B}{${polyLatex([-b, 1])}}`, note: 'Factoriza el denominador y separa en fracciones simples.' },
          { latex: `A=${A},\\quad B=${B}`, note: 'Multiplica por el denominador y evalúa en cada raíz para despejar A y B.' },
          { latex: ans, note: 'Cada fracción simple se integra como un logaritmo.' },
        ],
        distractors: uniqueDistractors(ans, [
          { latex: pair(B, A), feedback: 'Cada constante va con su propio factor: evalúa el numerador en la raíz de ese factor.' },
          { latex: pair(-A, -B), feedback: 'Al evaluar en cada raíz, cuida el signo de la diferencia de raíces.' },
          { latex: `${co(A, ln(a))} + C`, feedback: 'Faltó integrar la segunda fracción simple.' },
          ...(b !== -a ? [{ latex: `${co(A, ln(-a))} ${B < 0 ? '-' : '+'} ${co(Math.abs(B), ln(-b))} + C`, feedback: 'Los factores son (x − raíz): revisa el signo dentro de cada logaritmo.' }] : []),
          { latex: `${co(A + B === 0 ? A : A + B, `\\ln|${den}|`)} + C`, feedback: 'La integral de un cociente no es el logaritmo del denominador si el numerador no es su derivada.' },
        ]),
      };
    },
  },
  {
    id: 'int-trig-potencias',
    topic: 'Métodos de integración',
    difficulty: 4,
    generate(rng) {
      const m = rng.int(1, 4);
      const k = rng.int(1, 3);
      const sinCase = rng.next() < 0.5; // sen^m · cos³ → u = sen; cos^m · sen³ → u = cos
      const u = kx(k);
      const [f, g] = sinCase ? ['sin', 'cos'] : ['cos', 'sin'];
      const expr = `${powF(f, m, u)}${powF(g, 3, u)}`;
      const term = (fn, p, den) => fracTerm(powF(fn, p, u), den);
      const build = (fn, e1, d1, e2, d2, sgnFirst, sgnSecond) => `${sgnFirst < 0 ? '-' : ''}${term(fn, e1, d1)} ${sgnSecond < 0 ? '-' : '+'} ${term(fn, e2, d2)} + C`;
      const s1 = sinCase ? 1 : -1;
      const ans = build(f, m + 1, k * (m + 1), m + 3, k * (m + 3), s1, -s1);
      return {
        params: { m, k, sinCase },
        expr,
        vars: ['x'],
        statement: { text: 'Calcula la integral:', latex: `\\int ${expr}\\,dx` },
        answer: { latex: ans },
        steps: [
          { latex: `${powF(g, 3, u)}=${powF(g, 1, u)}\\,(1-${powF(f, 2, u)})`, note: `La potencia impar es la de ${g === 'cos' ? 'coseno' : 'seno'}: separa un factor y cambia el resto con sen² + cos² = 1.` },
          { latex: `w=\\${f}(${u}),\\quad dw=${sinCase ? '' : '-'}${k === 1 ? '' : k}\\${g}(${u})\\,dx`, note: 'Sustituye la otra función.' },
          { latex: `${sinCase ? '' : '-'}\\frac{1}{${k}}\\int (w^{${m}}-w^{${m + 2}})\\,dw`, note: 'Queda una integral de potencias.' },
          { latex: ans, note: 'Integra y regresa a x.' },
        ],
        distractors: uniqueDistractors(ans, [
          { latex: build(f, m + 1, m + 1, m + 3, m + 3, s1, -s1), feedback: 'Faltó dividir entre k por el cambio de variable.' },
          { latex: build(f, m + 1, k * (m + 1), m + 3, k * (m + 3), s1, s1), feedback: 'Al usar 1 − w², el segundo término lleva el signo contrario.' },
          { latex: build(g, m + 1, k * (m + 1), m + 3, k * (m + 3), s1, -s1), feedback: 'La sustitución es la función con potencia par; integraste con la otra.' },
          { latex: build(f, m + 2, k * (m + 2), m + 4, k * (m + 4), s1, -s1), feedback: 'Al integrar wᵐ el exponente sube en 1, no en 2.' },
        ]),
      };
    },
  },
  {
    id: 'int-sust-trig',
    topic: 'Métodos de integración',
    difficulty: 5,
    generate(rng) {
      const variant = rng.pick(['tan32', 'sin', 'tan']);
      const a = variant === 'sin' ? rng.int(3, 5) : rng.int(2, 5);
      const A = a * a;
      let expr, stmt, ans, ds, sub;
      if (variant === 'tan32') {
        expr = `\\frac{1}{(x^{2}+${A})^{\\frac{3}{2}}}`;
        stmt = `\\int \\frac{dx}{(x^{2}+${A})^{\\frac{3}{2}}}`;
        ans = `\\frac{x}{${A}\\sqrt{x^{2}+${A}}} + C`;
        sub = `x=${a}\\tan\\theta`;
        ds = [
          [`\\frac{x}{\\sqrt{x^{2}+${A}}} + C`, `Faltó el factor 1/a² = 1/${A} que sale de la sustitución.`],
          [`\\frac{1}{${A}\\sqrt{x^{2}+${A}}} + C`, 'Al regresar a x, sen θ = x/√(x² + a²): falta la x del numerador.'],
          [`\\frac{\\sqrt{x^{2}+${A}}}{${A}x} + C`, 'Regresaste con el recíproco de sen θ.'],
        ];
      } else if (variant === 'sin') {
        expr = `\\frac{1}{x^{2}\\sqrt{${A}-x^{2}}}`;
        stmt = `\\int \\frac{dx}{x^{2}\\sqrt{${A}-x^{2}}}`;
        ans = `-\\frac{\\sqrt{${A}-x^{2}}}{${A}x} + C`;
        sub = `x=${a}\\sin\\theta`;
        ds = [
          [`\\frac{\\sqrt{${A}-x^{2}}}{${A}x} + C`, 'Signo: ∫csc²θ dθ = −cot θ.'],
          [`-\\frac{\\sqrt{${A}-x^{2}}}{x} + C`, `Faltó el factor 1/a² = 1/${A} que sale de la sustitución.`],
          [`-\\frac{x}{${A}\\sqrt{${A}-x^{2}}} + C`, 'Invertiste cot θ: es √(a² − x²)/x.'],
        ];
      } else {
        expr = `\\frac{1}{x^{2}\\sqrt{x^{2}+${A}}}`;
        stmt = `\\int \\frac{dx}{x^{2}\\sqrt{x^{2}+${A}}}`;
        ans = `-\\frac{\\sqrt{x^{2}+${A}}}{${A}x} + C`;
        sub = `x=${a}\\tan\\theta`;
        ds = [
          [`\\frac{\\sqrt{x^{2}+${A}}}{${A}x} + C`, 'Signo: la integral de cos θ/sen²θ es −1/sen θ.'],
          [`-\\frac{\\sqrt{x^{2}+${A}}}{x} + C`, `Faltó el factor 1/a² = 1/${A} que sale de la sustitución.`],
          [`-\\frac{x}{${A}\\sqrt{x^{2}+${A}}} + C`, 'Invertiste csc θ: es √(x² + a²)/x.'],
        ];
      }
      return {
        params: { variant, a },
        expr,
        vars: ['x'],
        statement: { text: 'Calcula con sustitución trigonométrica:', latex: stmt },
        answer: { latex: ans },
        steps: [
          { latex: sub, note: variant === 'sin' ? 'Con √(a² − x²) usa x = a sen θ.' : 'Con √(x² + a²) usa x = a tan θ.' },
          { latex: variant === 'tan32' ? `\\frac{1}{${A}}\\int\\cos\\theta\\,d\\theta` : variant === 'sin' ? `\\frac{1}{${A}}\\int\\csc^{2}\\theta\\,d\\theta` : `\\frac{1}{${A}}\\int\\frac{\\cos\\theta}{\\sin^{2}\\theta}\\,d\\theta`, note: 'Simplifica la raíz con la identidad pitagórica.' },
          { latex: ans, note: 'Integra y regresa a x con un triángulo rectángulo.' },
        ],
        distractors: uniqueDistractors(ans, ds.map(([latex, feedback]) => ({ latex, feedback }))),
      };
    },
  },

  // ═════════════ APLICACIONES DE LA INTEGRAL ═════════════
  {
    id: 'int-volumen-disco',
    topic: 'Aplicaciones de la integral',
    difficulty: 3,
    generate(rng) {
      const raiz = rng.next() < 0.3;
      const b = rng.int(1, 3);
      let fTex, V, intTex, ds;
      if (raiz) {
        const k = rng.int(1, 6);
        fTex = `\\sqrt{${k === 1 ? '' : k}x}`;
        V = fr(k * b * b, 2);
        intTex = `\\pi\\int_{0}^{${b}} ${k === 1 ? '' : k}x\\,dx`;
        ds = [
          { latex: piFr(fr(k * b * b)), feedback: 'Al integrar x se divide entre 2.' },
          { latex: piFr(fr(k * b ** 3, 3)), feedback: 'Elevaste de más: [√(kx)]² = kx, no kx².' },
        ];
      } else {
        const c = rng.int(1, 3);
        const m = rng.int(1, 2);
        fTex = co(c, m === 1 ? 'x' : 'x^{2}');
        V = fr(c * c * b ** (2 * m + 1), 2 * m + 1);
        intTex = `\\pi\\int_{0}^{${b}} ${c * c === 1 ? '' : c * c}x^{${2 * m}}\\,dx`;
        ds = [
          { latex: piFr(fr(c * b ** (m + 1), m + 1)), feedback: 'El radio se eleva al cuadrado: el área del disco es π·r².' },
          { latex: piFr(fr(2 * c * b ** (m + 2), m + 2)), feedback: 'Usaste cascarones (2πx·f), que corresponde a girar alrededor del eje y.' },
        ];
      }
      return {
        params: { raiz, b, fTex },
        statement: { text: `Calcula el volumen del sólido que se genera al girar alrededor del eje x la región bajo la curva, entre x = 0 y x = ${b}:`, latex: `y=${fTex}` },
        answer: piAns(V),
        steps: [
          { latex: 'V=\\pi\\int_{a}^{b}[f(x)]^{2}\\,dx', note: 'Método de discos: cada corte es un disco de radio f(x).' },
          { latex: intTex, note: 'Eleva la función al cuadrado.' },
          { latex: `V=${piFr(V)}`, note: 'Integra y evalúa.' },
        ],
        distractors: piDistractors(V, [{ latex: V.toLatex(), feedback: 'Faltó el factor π del área de cada disco.' }, ...ds]),
      };
    },
  },
  {
    id: 'int-volumen-region',
    topic: 'Aplicaciones de la integral',
    difficulty: 4,
    generate(rng) {
      const variant = rng.pick(['x', 'y', 'h']);
      const k = rng.int(1, 4);
      let text, latex, V, ds, steps;
      if (variant === 'x') {
        V = fr(2 * k ** 5, 15);
        text = 'Calcula el volumen al girar alrededor del eje x la región entre las curvas:';
        latex = `y=${co(k, 'x')},\\qquad y=x^{2}`;
        steps = [
          { latex: `x^{2}=${co(k, 'x')}\\Rightarrow x=0,\\ x=${k}`, note: 'Las curvas se cortan en los extremos de la región.' },
          { latex: `V=\\pi\\int_{0}^{${k}}\\left[(${co(k, 'x')})^{2}-(x^{2})^{2}\\right]dx`, note: 'Arandelas: radio exterior la recta, interior la parábola.' },
          { latex: `V=${piFr(V)}`, note: 'Integra y evalúa.' },
        ];
        ds = [
          { latex: piFr(fr(k ** 5, 30)), feedback: '(R − r)² ≠ R² − r²: se restan las áreas de los discos.' },
          { latex: piFr(fr(k ** 5, 3)), feedback: 'Faltó restar el hueco que deja la parábola.' },
          { latex: V.toLatex(), feedback: 'Faltó el factor π.' },
        ];
      } else if (variant === 'y') {
        V = fr(k ** 4, 6);
        text = 'Calcula el volumen al girar alrededor del eje y la región entre las curvas:';
        latex = `y=${co(k, 'x')},\\qquad y=x^{2}`;
        steps = [
          { latex: `x=0,\\ x=${k}`, note: 'Puntos de corte de las curvas.' },
          { latex: `V=2\\pi\\int_{0}^{${k}} x\\,(${co(k, 'x')}-x^{2})\\,dx`, note: 'Cascarones: radio x y altura la diferencia de las curvas.' },
          { latex: `V=${piFr(V)}`, note: 'Integra y evalúa.' },
        ];
        ds = [
          { latex: piFr(fr(k ** 4, 12)), feedback: 'La circunferencia del cascarón es 2πx: faltó el 2.' },
          { latex: piFr(fr(2 * k ** 5, 15)), feedback: 'Ese volumen corresponde a girar alrededor del eje x.' },
          { latex: V.toLatex(), feedback: 'Faltó el factor π.' },
        ];
      } else {
        V = fr(8 * k ** 5, 5);
        text = 'Calcula el volumen al girar alrededor del eje x la región entre las curvas:';
        latex = `y=${k * k},\\qquad y=x^{2}`;
        steps = [
          { latex: `x=\\pm ${k}`, note: 'Puntos de corte de la recta horizontal con la parábola.' },
          { latex: `V=\\pi\\int_{-${k}}^{${k}}\\left[${k ** 4}-x^{4}\\right]dx`, note: 'Arandelas: radio exterior la recta, interior la parábola.' },
          { latex: `V=${piFr(V)}`, note: 'Por simetría, es el doble de la integral de 0 a k.' },
        ];
        ds = [
          { latex: piFr(fr(16 * k ** 5, 15)), feedback: '(R − r)² ≠ R² − r²: se restan las áreas de los discos.' },
          { latex: piFr(fr(4 * k ** 5, 5)), feedback: 'Integraste solo de 0 a k: la región va de −k a k.' },
          { latex: V.toLatex(), feedback: 'Faltó el factor π.' },
        ];
      }
      return { params: { variant, k }, statement: { text, latex }, answer: piAns(V), steps, distractors: piDistractors(V, ds) };
    },
  },
  {
    id: 'int-valor-medio',
    topic: 'Aplicaciones de la integral',
    difficulty: 2,
    generate(rng) {
      const a = rng.int(1, 4);
      const c = rng.int(-5, 5);
      const L = rng.int(1, 6);
      const val = fr(a * L * L + 3 * c, 3);
      const f = polyLatex([c, 0, a]);
      return {
        params: { a, c, L },
        statement: { text: `¿Cuál es el valor promedio de la función en el intervalo [0, ${L}]?`, latex: `f(x)=${f}` },
        answer: ansOf(val),
        steps: [
          { latex: `\\bar f=\\frac{1}{b-a}\\int_{a}^{b} f(x)\\,dx`, note: 'Teorema del valor medio para integrales: el promedio es la integral entre la longitud.' },
          { latex: `\\frac{1}{${L}}\\left[${fracTerm(`${a === 1 ? '' : a}x^{3}`, 3)}${c ? tail(co(c, 'x')) : ''}\\right]_{0}^{${L}}`, note: 'Integra.' },
          { latex: `\\bar f=${val.toLatex()}`, note: 'Evalúa y divide.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(a * L ** 3 + 3 * c * L, 3), 'Esa es la integral; falta dividir entre la longitud del intervalo.'),
          dFr(fr(a * L * L + 4 * c, 4), 'El valor en el punto medio no es el promedio de una función no lineal.'),
          dFr(fr(a * L * L + 2 * c, 2), 'Promediar los extremos solo sirve para funciones lineales.'),
        ]),
      };
    },
  },
  {
    id: 'int-riemann',
    topic: 'Aplicaciones de la integral',
    difficulty: 3,
    generate(rng) {
      const a = rng.int(1, 3);
      const c = rng.int(0, 5);
      const b = rng.int(1, 4);
      const n = rng.int(2, 6);
      const right = rng.next() < 0.5;
      const sumR = fr(a * b ** 3 * (n + 1) * (2 * n + 1) + 6 * n * n * c * b, 6 * n * n);
      const sumL = fr(a * b ** 3 * (n - 1) * (2 * n - 1) + 6 * n * n * c * b, 6 * n * n);
      const val = right ? sumR : sumL;
      const dx = fr(b, n);
      return {
        params: { a, c, b, n, right },
        statement: { text: `Aproxima la integral con una suma de Riemann de ${n} rectángulos iguales, evaluando en el extremo ${right ? 'derecho' : 'izquierdo'} de cada uno:`, latex: `\\int_{0}^{${b}} (${polyLatex([c, 0, a])})\\,dx` },
        answer: ansOf(val),
        steps: [
          { latex: `\\Delta x=\\frac{${b}}{${n}}`, note: 'Divide el intervalo en partes iguales.' },
          { latex: `S=\\sum_{i=${right ? 1 : 0}}^{${right ? n : n - 1}} f(x_i)\\,\\Delta x,\\quad x_i=i\\,\\Delta x`, note: `Extremos ${right ? 'derechos: i va de 1 a n' : 'izquierdos: i va de 0 a n − 1'}.` },
          { latex: `S=${val.toLatex()}`, note: 'Suma las áreas de los rectángulos.' },
        ],
        distractors: numericDistractors(val, [
          dFr(right ? sumL : sumR, `Usaste los extremos ${right ? 'izquierdos' : 'derechos'}.`),
          dFr(fr(a * b ** 3 + 3 * c * b, 3), 'Ese es el valor exacto de la integral, no la suma de Riemann.'),
          dFr(fr(val.n * dx.d, val.d * dx.n), 'Faltó multiplicar cada altura por la base Δx.'),
        ]),
      };
    },
  },

  // ═════════════ SUCESIONES Y SERIES ═════════════
  {
    id: 'suc-limite',
    topic: 'Sucesiones y series',
    difficulty: 2,
    generate(rng) {
      if (rng.next() < 0.5) {
        const k = rng.int(1, 4);
        const m = rng.int(1, 3);
        const ans = { latex: `e^{${k * m}}`, value: Math.exp(k * m) };
        return {
          params: { kind: 'e', k, m },
          statement: { text: 'Calcula el límite de la sucesión:', latex: `\\lim_{n\\to\\infty}\\left(1+\\frac{${k}}{n}\\right)^{${m === 1 ? 'n' : `${m}n`}}` },
          answer: ans,
          steps: [
            { latex: '1^{\\infty}', note: 'Sustituir da una indeterminación.' },
            { latex: `\\left[\\left(1+\\frac{${k}}{n}\\right)^{n}\\right]^{${m}}\\to (e^{${k}})^{${m}}`, note: 'Usa el límite notable (1 + k/n)ⁿ → eᵏ.' },
            { latex: ans.latex, note: 'Multiplica los exponentes.' },
          ],
          distractors: uniqueDistractors(ans.latex, [
            { latex: `e^{${k}}`, feedback: 'Faltó el factor del exponente.' },
            { latex: '1', feedback: '1^∞ es una indeterminación, no vale 1.' },
            { latex: `e^{${k + m}}`, feedback: 'Los exponentes se multiplican, no se suman.' },
            { latex: `e^{${k * m + 1}}`, feedback: 'Revisa el exponente final: es k·m.' },
            { latex: `e^{${k * m + 2}}`, feedback: 'Sobra un factor en el exponente.' },
          ]),
        };
      }
      const a = rng.nonZero(-6, 6);
      const b = rng.int(-5, 5);
      const c = rng.int(-5, 5);
      const d = rng.int(1, 6);
      const e = rng.int(1, 9);
      const val = fr(a, d);
      return {
        params: { kind: 'q', a, b, c, d, e },
        statement: { text: 'Calcula el límite de la sucesión:', latex: `\\lim_{n\\to\\infty}\\frac{${polyLatex([c, b, a], 'n')}}{${polyLatex([e, 0, d], 'n')}}` },
        answer: ansOf(val),
        steps: [
          { latex: `\\frac{${a}+\\frac{${b}}{n}+\\frac{${c}}{n^{2}}}{${d}+\\frac{${e}}{n^{2}}}`, note: 'Divide numerador y denominador entre n².' },
          { latex: val.toLatex(), note: 'Los términos con n en el denominador tienden a cero.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(0), 'El numerador y el denominador tienen el mismo grado: el límite no es cero.'),
          dFr(fr(a), 'Falta dividir entre el coeficiente principal del denominador.'),
          dFr(fr(c, e), 'Esos son los términos independientes; cuando n crece mandan los de mayor grado.'),
        ]),
      };
    },
  },
  {
    id: 'suc-termino-general',
    topic: 'Sucesiones y series',
    difficulty: 2,
    generate(rng) {
      const p = rng.int(1, 4);
      const q = rng.int(0, 5);
      const num = polyLatex([q, p], 'n');
      if (rng.next() < 0.5) {
        let s, t;
        do {
          s = rng.int(1, 4);
          t = rng.int(0, 5);
        } while (p * t === q * s);
        const den = polyLatex([t, s], 'n');
        const list = [1, 2, 3, 4].map((n) => `\\frac{${p * n + q}}{${s * n + t}}`).join(',\\ ');
        const ans = `\\frac{${num}}{${den}}`;
        return {
          params: { kind: 'q', p, q, s, t },
          vars: ['n'],
          statement: { text: '¿Cuál es el término general aₙ de la sucesión (n = 1, 2, 3, …)?', latex: `${list},\\ \\dots` },
          answer: { latex: ans },
          steps: [
            { latex: `${p * 1 + q},\\ ${p * 2 + q},\\ ${p * 3 + q},\\ \\dots`, note: `Los numeradores aumentan de ${p} en ${p}: son ${num}.` },
            { latex: `${s + t},\\ ${2 * s + t},\\ ${3 * s + t},\\ \\dots`, note: `Los denominadores aumentan de ${s} en ${s}: son ${den}.` },
            { latex: `a_n=${ans}`, note: 'Comprueba con n = 1.' },
          ],
          distractors: uniqueDistractors(ans, [
            { latex: `\\frac{${polyLatex([q + p, p], 'n')}}{${polyLatex([t + s, s], 'n')}}`, feedback: 'Con n = 1 debe salir el primer término; esa fórmula empieza en el segundo.' },
            { latex: `\\frac{${den}}{${num}}`, feedback: 'Invertiste numerador y denominador.' },
            { latex: `\\frac{${num}}{${s + t}}`, feedback: 'El denominador también cambia con n.' },
          ]),
        };
      }
      const r = rng.int(2, 3);
      const list = [1, 2, 3, 4].map((n) => `\\frac{${p * n + q}}{${r ** n}}`).join(',\\ ');
      const ans = `\\frac{${num}}{${r}^{n}}`;
      return {
        params: { kind: 'g', p, q, r },
        vars: ['n'],
        statement: { text: '¿Cuál es el término general aₙ de la sucesión (n = 1, 2, 3, …)?', latex: `${list},\\ \\dots` },
        answer: { latex: ans },
        steps: [
          { latex: `${p + q},\\ ${2 * p + q},\\ ${3 * p + q},\\ \\dots`, note: `Los numeradores aumentan de ${p} en ${p}: son ${num}.` },
          { latex: `${r},\\ ${r * r},\\ ${r ** 3},\\ \\dots`, note: `Cada denominador es ${r} veces el anterior: son potencias de ${r}.` },
          { latex: `a_n=${ans}`, note: 'Comprueba con n = 1.' },
        ],
        distractors: uniqueDistractors(ans, [
          { latex: `\\frac{${num}}{${r}n}`, feedback: 'El denominador crece multiplicando: es una potencia, no un múltiplo.' },
          { latex: `\\frac{${num}}{${r}^{n+1}}`, feedback: 'Con n = 1 el denominador debe ser el primero de la lista.' },
          { latex: `\\frac{${polyLatex([p, q], 'n')}}{${r}^{n}}`, feedback: 'Intercambiaste el coeficiente de n y el término constante.' },
          { latex: `\\frac{${polyLatex([q + p, p], 'n')}}{${r}^{n}}`, feedback: 'Con n = 1 debe salir el primer numerador.' },
        ]),
      };
    },
  },
  {
    id: 'ser-criterio-razon',
    topic: 'Sucesiones y series',
    difficulty: 4,
    generate(rng) {
      if (rng.next() < 0.6) {
        const k = rng.int(1, 3);
        const c = rng.int(1, 7);
        const d = intNot(rng, 2, 8, c);
        const L = fr(c, d);
        const nk = k === 1 ? 'n' : `n^{${k}}`;
        return {
          params: { kind: 'pot', k, c, d },
          statement: { text: 'Aplica el criterio de la razón. ¿Cuánto vale L = lím |aₙ₊₁ / aₙ|?', latex: `\\sum_{n=1}^{\\infty} \\frac{${nk}${c === 1 ? '' : `\\,${c}^{n}`}}{${d}^{n}}` },
          answer: ansOf(L),
          steps: [
            { latex: `\\frac{a_{n+1}}{a_n}=\\left(\\frac{n+1}{n}\\right)^{${k}}\\cdot\\frac{${c}}{${d}}`, note: 'Divide el término n + 1 entre el término n y cancela las potencias.' },
            { latex: `L=${L.toLatex()}`, note: '((n + 1)/n)ᵏ tiende a 1.' },
            { latex: `L${L.value < 1 ? '<' : '>'}1`, note: L.value < 1 ? 'Como L < 1, la serie converge.' : 'Como L > 1, la serie diverge.' },
          ],
          distractors: numericDistractors(L, [
            dFr(fr(d, c), 'Invertiste el cociente: aₙ₊₁ va en el numerador.'),
            dFr(fr(c), 'Las potencias del denominador también cuentan.'),
            dFr(fr(1), 'El factor nᵏ tiende a 1 en el cociente, pero las potencias no se cancelan.'),
          ]),
        };
      }
      const c = rng.int(1, 7);
      const L = fr(c, 4);
      return {
        params: { kind: 'fact', c },
        statement: { text: 'Aplica el criterio de la razón. ¿Cuánto vale L = lím |aₙ₊₁ / aₙ|?', latex: `\\sum_{n=1}^{\\infty} \\frac{(n!)^{2}${c === 1 ? '' : `\\,${c}^{n}`}}{(2n)!}` },
        answer: ansOf(L),
        steps: [
          { latex: `\\frac{a_{n+1}}{a_n}=\\frac{(n+1)^{2}\\cdot ${c}}{(2n+1)(2n+2)}`, note: '(n + 1)! = (n + 1)·n! y (2n + 2)! = (2n + 2)(2n + 1)·(2n)!' },
          { latex: `L=\\frac{${c}}{4}${L.d === 1 ? `=${L.n}` : ''}`, note: 'Compara los coeficientes de n²: 1 arriba y 4 abajo.' },
          { latex: `L${L.value < 1 ? '<' : L.value > 1 ? '>' : '='}1`, note: L.value < 1 ? 'Como L < 1, la serie converge.' : L.value > 1 ? 'Como L > 1, la serie diverge.' : 'Con L = 1 el criterio no decide.' },
        ],
        distractors: numericDistractors(L, [
          dFr(fr(c), 'Faltó el límite de (n + 1)²/((2n + 1)(2n + 2)), que es 1/4.'),
          dFr(fr(c, 2), '(2n + 2)! / (2n)! tiene dos factores, (2n + 1)(2n + 2), no uno.'),
          dFr(fr(4, c), 'Invertiste el cociente: aₙ₊₁ va en el numerador.'),
        ]),
      };
    },
  },
  {
    id: 'int-impropia',
    topic: 'Integral definida',
    difficulty: 4,
    generate(rng) {
      const variant = rng.pick(['pot', 'exp', 'xexp']);
      const k = rng.int(1, 9);
      if (variant === 'pot') {
        const p = rng.int(2, 4);
        const val = fr(k, p - 1);
        return {
          params: { variant, k, p },
          statement: { text: 'Calcula la integral impropia:', latex: `\\int_{1}^{\\infty} \\frac{${k}}{x^{${p}}}\\,dx` },
          answer: ansOf(val),
          steps: [
            { latex: `\\lim_{b\\to\\infty}\\int_{1}^{b} ${k}x^{-${p}}\\,dx`, note: 'Una integral impropia es el límite de integrales con límite finito.' },
            { latex: `\\lim_{b\\to\\infty}\\left[-\\frac{${k}}{${p - 1}x^{${p - 1}}}\\right]_{1}^{b}`, note: 'Integra la potencia: el exponente sube a −p + 1.' },
            { latex: val.toLatex(), note: 'En el infinito el término se anula; queda el valor en x = 1.' },
          ],
          distractors: numericDistractors(val, [
            dFr(fr(k, p), 'Al integrar x^(−p) se divide entre −p + 1, no entre p.'),
            dFr(fr(k, p + 1), 'El exponente sube en 1: de −p a −p + 1.'),
            dFr(fr(k * (p - 1)), 'Multiplicaste por p − 1 en vez de dividir.'),
          ]),
        };
      }
      const a = rng.int(1, 5);
      const val = variant === 'exp' ? fr(k, a) : fr(k, a * a);
      return {
        params: { variant, k, a },
        statement: { text: 'Calcula la integral impropia:', latex: `\\int_{0}^{\\infty} ${variant === 'exp' ? (k === 1 ? '' : k) : co(k, 'x')}\\,e^{-${a === 1 ? '' : a}x}\\,dx` },
        answer: ansOf(val),
        steps: [
          { latex: `\\lim_{b\\to\\infty}\\int_{0}^{b}\\cdots`, note: 'Escribe la integral como un límite.' },
          { latex: variant === 'exp' ? `\\left[-\\frac{${k}}{${a}}e^{-${a}x}\\right]_{0}^{b}` : `\\left[-\\frac{${k}x}{${a}}e^{-${a}x}-\\frac{${k}}{${a * a}}e^{-${a}x}\\right]_{0}^{b}`, note: variant === 'exp' ? 'Integra la exponencial dividiendo entre −a.' : 'Integra por partes con u = x.' },
          { latex: val.toLatex(), note: 'La exponencial decreciente se anula en el infinito.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(k * a), 'Al integrar e^(−ax) se divide entre a, no se multiplica.'),
          dFr(neg(val), 'Signo: el valor en el infinito es 0 y se resta el valor en 0.'),
          dFr(variant === 'exp' ? fr(k) : fr(k, a), variant === 'exp' ? 'Faltó dividir entre a.' : 'La integración por partes divide otra vez entre a: queda a².'),
        ]),
      };
    },
  },
  {
    id: 'vec-plano-tangente',
    topic: 'Funciones de varias variables',
    difficulty: 3,
    generate(rng) {
      const a = rng.nonZero(-3, 3);
      const b = rng.int(-3, 3);
      const c = rng.nonZero(-3, 3);
      let x0, y0, fx, fy;
      do {
        x0 = rng.int(-2, 2);
        y0 = rng.int(-2, 2);
        fx = 2 * a * x0 + b * y0;
        fy = b * x0 + 2 * c * y0;
      } while (fx === 0 && fy === 0);
      const f0 = a * x0 * x0 + b * x0 * y0 + c * y0 * y0;
      const k = f0 - fx * x0 - fy * y0;
      const plane = ([px, py, pk]) => terms([[px, 'x'], [py, 'y'], [pk, '']]);
      const ans = plane([fx, fy, k]);
      const seen = new Set([`${fx + fy}|${k}`]);
      const cands = [
        [[fx, fy, f0], 'Faltó restar ∂f/∂x·x₀ + ∂f/∂y·y₀: el plano pasa por el punto, no por el origen.'],
        [[fy, fx, f0 - fy * x0 - fx * y0], 'Intercambiaste ∂f/∂x y ∂f/∂y.'],
        [[-fx, -fy, f0 + fx * x0 + fy * y0], 'Signo de las diferencias: es (x − x₀), no (x₀ − x).'],
        [[fx, fy, k + 2], 'El término independiente no cuadra: en el punto, z debe valer f(x₀, y₀).'],
        [[fx, fy, k - 1], 'Revisa el valor de f en el punto: el término independiente queda corrido.'],
        [[fx, fy, k + 3], 'El término independiente sale de f(x₀, y₀) − fₓx₀ − f_y y₀; revisa esa resta.'],
      ].filter(([t]) => {
        const key = `${t[0] + t[1]}|${t[2]}`; // la prueba compara con x = y: descarta lo indistinguible ahí
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      return {
        params: { a, b, c, x0, y0 },
        vars: ['x', 'y'],
        statement: { text: `El plano tangente a la superficie en el punto con x = ${x0}, y = ${y0} es z = …  ¿Qué expresión completa la ecuación?`, latex: `z=${terms([[a, 'x^{2}'], [b, 'xy'], [c, 'y^{2}']])}` },
        answer: { latex: ans },
        steps: [
          { latex: `f(${x0},${y0})=${f0}`, note: 'Evalúa la función en el punto.' },
          { latex: `f_x=${fx},\\quad f_y=${fy}`, note: 'Calcula las derivadas parciales en el punto.' },
          { latex: `z=${f0}${tail(co(fx, `(${polyLatex([-x0, 1])})`))}${tail(co(fy, `(${polyLatex([-y0, 1], 'y')})`))}=${ans}`, note: 'z = f + fₓ(x − x₀) + f_y(y − y₀).' },
        ],
        distractors: uniqueDistractors(ans, cands.map(([t, feedback]) => ({ latex: plane(t), feedback }))),
      };
    },
  },

  // ═════════════ SERIES DE FOURIER ═════════════
  {
    id: 'fou-coef-seno',
    topic: 'Series de Fourier',
    difficulty: 3,
    generate(rng) {
      const sq = rng.next() < 0.5;
      const k = rng.int(1, 5);
      const L = rng.int(1, 3);
      let n, F, latex, ds, mid;
      if (sq) {
        n = rng.pick([1, 3, 5, 7]);
        F = fr(4 * k, n);
        latex = `f(x)=\\begin{cases} -${k}, & -${L}<x<0 \\\\ ${k}, & 0<x<${L} \\end{cases}`;
        mid = `b_n=\\frac{2}{${L}}\\int_{0}^{${L}} ${k}\\sin\\frac{n\\pi x}{${L}}\\,dx=\\frac{${2 * k}(1-(-1)^{n})}{n\\pi}`;
        ds = [
          { latex: overPi(fr(2 * k, n)), feedback: 'Para n impar, 1 − (−1)ⁿ vale 2, no 1.' },
          { latex: fr(4 * k, n).toLatex(), feedback: 'Faltó π en el denominador: viene de integrar sen(nπx/L).' },
        ];
      } else {
        n = rng.int(1, 5);
        F = fr(2 * k * L * (n % 2 ? 1 : -1), n);
        latex = `f(x)=${co(k, 'x')},\\quad -${L}<x<${L}`;
        mid = `b_n=\\frac{2}{${L}}\\int_{0}^{${L}} ${co(k, 'x')}\\sin\\frac{n\\pi x}{${L}}\\,dx=\\frac{${2 * k * L}(-1)^{n+1}}{n\\pi}`;
        ds = [
          { latex: overPi(neg(F)), feedback: 'El signo es (−1)ⁿ⁺¹: revisa el valor de cos(nπ).' },
          { latex: overPi(fr(k * L * (n % 2 ? 1 : -1), n)), feedback: 'Faltó el 2 de la fórmula 2/L∫₀ᴸ para una función impar.' },
        ];
      }
      return {
        params: { sq, k, L, n },
        statement: { text: `La función es impar y tiene periodo ${2 * L}. ¿Cuánto vale el coeficiente b${'₀₁₂₃₄₅₆₇'[n]} de su serie de Fourier?`, latex },
        answer: { latex: overPi(F), value: F.value / Math.PI },
        steps: [
          { latex: 'a_0=a_n=0', note: 'Una función impar solo tiene términos en seno.' },
          { latex: mid, note: 'Integra por partes (o directamente) usando la simetría.' },
          { latex: `b_{${n}}=${overPi(F)}`, note: 'Sustituye n.' },
        ],
        distractors: overPiDistractors(F, 1, ds),
      };
    },
  },
  {
    id: 'fou-coef-coseno',
    topic: 'Series de Fourier',
    difficulty: 4,
    generate(rng) {
      const cuad = rng.next() < 0.5;
      const k = rng.int(1, 4);
      const L = rng.int(1, 3);
      let n, F, latex, ds, mid;
      if (cuad) {
        n = rng.int(1, 4);
        F = fr(4 * k * L * L * (n % 2 ? -1 : 1), n * n);
        latex = `f(x)=${co(k, 'x^{2}')},\\quad -${L}<x<${L}`;
        mid = `a_n=\\frac{2}{${L}}\\int_{0}^{${L}} ${co(k, 'x^{2}')}\\cos\\frac{n\\pi x}{${L}}\\,dx=\\frac{${4 * k * L * L}(-1)^{n}}{n^{2}\\pi^{2}}`;
        ds = [
          { latex: overPi(F), feedback: 'Integrar por partes dos veces deja n²π² en el denominador, no nπ.' },
          { latex: overPi2(fr(k * L * L * (n % 2 ? -1 : 1), n * n)), feedback: 'Faltó el factor 4 que sale de las dos integraciones por partes.' },
        ];
      } else {
        n = rng.pick([1, 3, 5]);
        F = fr(-4 * k * L, n * n);
        latex = `f(x)=${co(k, '|x|')},\\quad -${L}<x<${L}`;
        mid = `a_n=\\frac{2}{${L}}\\int_{0}^{${L}} ${co(k, 'x')}\\cos\\frac{n\\pi x}{${L}}\\,dx=\\frac{${2 * k * L}((-1)^{n}-1)}{n^{2}\\pi^{2}}`;
        ds = [
          { latex: '0', feedback: 'Para n impar, (−1)ⁿ − 1 vale −2, no 0.' },
          { latex: overPi(F), feedback: 'Al integrar por partes queda n²π² en el denominador, no nπ.' },
        ];
      }
      return {
        params: { cuad, k, L, n },
        statement: { text: `La función es par y tiene periodo ${2 * L}. ¿Cuánto vale el coeficiente a${'₀₁₂₃₄₅'[n]} de su serie de Fourier?`, latex },
        answer: { latex: overPi2(F), value: F.value / Math.PI ** 2 },
        steps: [
          { latex: 'b_n=0', note: 'Una función par solo tiene términos en coseno.' },
          { latex: mid, note: 'Usa la simetría e integra por partes.' },
          { latex: `a_{${n}}=${overPi2(F)}`, note: 'Sustituye n.' },
        ],
        distractors: overPiDistractors(F, 2, ds),
      };
    },
  },
  {
    id: 'fou-complejo',
    topic: 'Series de Fourier',
    difficulty: 4,
    generate(rng) {
      const rampa = rng.next() < 0.5;
      const A = rng.int(1, 6);
      const sgn = rng.pick([1, -1]);
      const n = sgn * (rampa ? rng.int(1, 4) : rng.pick([1, 3]));
      const imTex = (f, piDen) => {
        if (f.n === 0) return '0';
        const den = `${f.d === 1 ? '' : f.d}${piDen ? '\\pi' : ''}`;
        const body = den === '' ? (Math.abs(f.n) === 1 ? 'i' : `${Math.abs(f.n)}i`) : `\\frac{${Math.abs(f.n)}}{${den}}i`;
        return `${f.n < 0 ? '-' : ''}${body}`;
      };
      let F, latex, mid, ds;
      if (rampa) {
        F = fr(A * (n % 2 ? -1 : 1), n);
        latex = `f(t)=${co(A, 't')},\\quad -\\pi<t<\\pi`;
        mid = `c_n=\\frac{1}{2\\pi}\\int_{-\\pi}^{\\pi} ${co(A, 't')}\\,e^{-int}\\,dt=\\frac{${A}(-1)^{n}}{n}\\,i`;
        ds = [
          { latex: imTex(neg(F), false), feedback: 'Signo: el exponente es −int; revisa el conjugado.' },
          { latex: F.toLatex(), feedback: 'Una función real e impar tiene coeficientes imaginarios puros.' },
          { latex: imTex(mul(F, fr(2)), false), feedback: 'El factor es 1/(2π), no 1/π.' },
        ];
      } else {
        F = fr(-A, n);
        latex = `f(t)=\\begin{cases} 0, & -\\pi<t<0 \\\\ ${A}, & 0<t<\\pi \\end{cases}`;
        mid = `c_n=\\frac{1}{2\\pi}\\int_{0}^{\\pi} ${A}\\,e^{-int}\\,dt=\\frac{${A}(1-(-1)^{n})}{2\\pi i n}`;
        ds = [
          { latex: imTex(neg(F), true), feedback: '1/i = −i: revisa el signo.' },
          { latex: imTex(fr(-A, 2 * n), true), feedback: 'Para n impar, 1 − (−1)ⁿ vale 2, no 1.' },
          { latex: overPi(fr(A, n)), feedback: 'Falta la unidad imaginaria: 1/i = −i.' },
        ];
      }
      const ans = imTex(F, !rampa);
      return {
        params: { rampa, A, n },
        statement: { text: `La función tiene periodo 2π. ¿Cuánto vale el coeficiente complejo cₙ de su serie de Fourier para n = ${String(n).replace('-', '−')}?`, latex },
        answer: { latex: ans },
        steps: [
          { latex: 'c_n=\\frac{1}{2\\pi}\\int_{-\\pi}^{\\pi} f(t)\\,e^{-int}\\,dt', note: 'Coeficientes de la forma compleja de la serie.' },
          { latex: mid, note: rampa ? 'Integra por partes y usa e^{±inπ} = (−1)ⁿ.' : 'Integra la exponencial y usa e^{−inπ} = (−1)ⁿ.' },
          { latex: `c_{${n}}=${ans}`, note: 'Sustituye n.' },
        ],
        distractors: uniqueDistractors(ans, ds),
      };
    },
  },

  // ═════════════ TRANSFORMADA DE FOURIER ═════════════
  {
    id: 'fou-transformada',
    topic: 'Transformada de Fourier',
    difficulty: 4,
    generate(rng) {
      const variant = rng.pick(['rect', 'exp', 't2']);
      const A = rng.int(1, variant === 't2' ? 3 : 4);
      const a = rng.int(1, 3);
      const aw = a === 1 ? '\\omega' : `${a}\\omega`;
      const den = `${a * a}+\\omega^{2}`;
      let latex, ans, ds, mid;
      if (variant === 'rect') {
        latex = `f(t)=\\begin{cases} ${A}, & |t|<${a} \\\\ 0, & |t|>${a} \\end{cases}`;
        ans = `\\frac{${2 * A}\\sin(${aw})}{\\omega}`;
        mid = `\\int_{-${a}}^{${a}} ${A}\\,e^{-i\\omega t}\\,dt=${A}\\,\\frac{e^{i${aw}}-e^{-i${aw}}}{i\\omega}`;
        ds = [
          [`\\frac{${A}\\sin(${aw})}{\\omega}`, 'Faltó el 2: e^{iaω} − e^{−iaω} = 2i·sen(aω).'],
          [`\\frac{${2 * A}\\cos(${aw})}{\\omega}`, 'La diferencia de exponenciales da seno, no coseno.'],
          [`${2 * A}\\sin(${aw})`, 'Falta dividir entre ω, que sale al integrar la exponencial.'],
        ];
      } else if (variant === 'exp') {
        latex = `f(t)=${A === 1 ? '' : A}e^{-${a === 1 ? '' : a}|t|}`;
        ans = `\\frac{${2 * A * a}}{${den}}`;
        mid = `${A}\\left(\\frac{1}{${a}+i\\omega}+\\frac{1}{${a}-i\\omega}\\right)`;
        ds = [
          [`\\frac{${A * a}}{${den}}`, 'Faltó la mitad t < 0: la función es par y las dos mitades se suman.'],
          [`\\frac{${2 * A * a}}{${a * a}-\\omega^{2}}`, 'Signo: (a + iω)(a − iω) = a² + ω².'],
          [`\\frac{${2 * A * a}}{(${den})^{2}}`, 'El denominador no va al cuadrado: es el producto de dos conjugados.'],
        ];
      } else {
        latex = `f(t)=${A === 1 ? '' : A}t^{2}e^{-${a === 1 ? '' : a}|t|}`;
        ans = `\\frac{${4 * a * A}(${a * a}-3\\omega^{2})}{(${den})^{3}}`;
        mid = `${A}\\cdot(-1)\\frac{d^{2}}{d\\omega^{2}}\\left[\\frac{${2 * a}}{${den}}\\right]`;
        ds = [
          [`\\frac{${4 * a * A}(${a * a}+3\\omega^{2})}{(${den})^{3}}`, 'Revisa el signo al derivar dos veces.'],
          [`\\frac{${2 * a * A}(${a * a}-3\\omega^{2})}{(${den})^{3}}`, 'Faltó el factor 2 de sumar las dos mitades de la función par.'],
          [`\\frac{${4 * a * A}(${a * a}-3\\omega^{2})}{(${den})^{2}}`, 'La segunda derivada de 1/(a² + ω²) deja el denominador al cubo.'],
        ];
      }
      return {
        params: { variant, A, a },
        vars: ['w'],
        statement: { text: 'Calcula la transformada de Fourier, con F(ω) = ∫ f(t)·e^(−iωt) dt sobre toda la recta:', latex },
        answer: { latex: ans },
        steps: [
          { latex: 'F(\\omega)=\\int_{-\\infty}^{\\infty} f(t)\\,e^{-i\\omega t}\\,dt', note: 'Definición de la transformada.' },
          { latex: mid, note: variant === 't2' ? 'Multiplicar por t² equivale a derivar dos veces respecto a ω (con signo −).' : 'Integra en cada tramo.' },
          { latex: `F(\\omega)=${ans}`, note: 'Simplifica.' },
        ],
        distractors: uniqueDistractors(ans, ds.map(([l, feedback]) => ({ latex: l, feedback }))),
      };
    },
  },
  {
    id: 'fou-espectro',
    topic: 'Transformada de Fourier',
    difficulty: 3,
    generate(rng) {
      const [p, q, h] = rng.pick(TRIPLES.slice(0, 3));
      const [a, w] = rng.next() < 0.5 ? [p, q] : [q, p];
      const A = rng.int(1, 9);
      const val = fr(A, h);
      return {
        params: { a, w, A },
        statement: { text: `Calcula la magnitud del espectro |F(ω)| en ω = ${w}, con F(ω) = ∫ f(t)·e^(−iωt) dt:`, latex: `f(t)=${A === 1 ? '' : A}e^{-${a}t}\\,u(t)` },
        answer: ansOf(val),
        steps: [
          { latex: `F(\\omega)=\\int_{0}^{\\infty} ${A}e^{-(${a}+i\\omega)t}\\,dt=\\frac{${A}}{${a}+i\\omega}`, note: 'El escalón u(t) deja solo t > 0.' },
          { latex: `|F(${w})|=\\frac{${A}}{\\sqrt{${a}^{2}+${w}^{2}}}=\\frac{${A}}{${h}}`, note: 'El módulo de un cociente es el cociente de los módulos.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(A, a), 'Ese es |F(0)|; en ω ≠ 0 el denominador crece.'),
          dFr(fr(A, a + w), '|a + iω| = √(a² + ω²), no a + ω.'),
          dFr(fr(A, h * h), 'Faltó sacar la raíz cuadrada del módulo.'),
        ]),
      };
    },
  },

  // ═════════════ INTEGRACIÓN COMPLEJA ═════════════
  {
    id: 'vc-integral-linea',
    topic: 'Integración compleja',
    difficulty: 3,
    generate(rng) {
      if (rng.next() < 0.5) {
        let z1, z2;
        do {
          z1 = [rng.int(-2, 2), rng.int(-2, 2)];
          z2 = [rng.int(-2, 3), rng.int(-2, 3)];
        } while (z1[0] === z2[0] && z1[1] === z2[1]);
        const d = [z2[0] - z1[0], z2[1] - z1[1]];
        const re = fr(2 * (z1[0] * d[0] + z1[1] * d[1]) + d[0] * d[0] + d[1] * d[1], 2);
        const im = fr(z1[0] * d[1] - z1[1] * d[0]);
        const ans = cfr(re, im);
        const zz = [fr(z2[0] ** 2 - z2[1] ** 2 - z1[0] ** 2 + z1[1] ** 2, 2), fr(2 * z2[0] * z2[1] - 2 * z1[0] * z1[1], 2)];
        return {
          params: { kind: 'conj', z1, z2 },
          statement: { text: `Calcula la integral de línea sobre el segmento recto que va de ${cplx(...z1).replace(/\s/g, '')} a ${cplx(...z2).replace(/\s/g, '')}:`, latex: '\\int_{C} \\bar{z}\\,dz' },
          answer: { latex: ans },
          steps: [
            { latex: `z(t)=(${cplx(...z1)})+(${cplx(...d)})t,\\quad 0\\le t\\le 1`, note: 'Parametriza el segmento.' },
            { latex: `\\int_{0}^{1}\\overline{z(t)}\\,z'(t)\\,dt`, note: 'z̄ no es analítica: no hay antiderivada y hay que integrar sobre el camino.' },
            { latex: ans, note: 'Integra en t y simplifica.' },
          ],
          distractors: uniqueDistractors(ans, [
            { latex: cfr(...zz), feedback: 'Usaste z²/2 como antiderivada, pero z̄ no es analítica.' },
            { latex: cfr(re, neg(im)), feedback: 'Revisa el signo de la parte imaginaria: el conjugado afecta a z, no a dz.' },
            { latex: cfr(add(re, fr(-(d[0] * d[0] + d[1] * d[1]), 2)), im), feedback: 'Faltó el término ∫ t·|z₂ − z₁|² dt.' },
            { latex: cfr(add(re, fr(1)), im), feedback: 'La parte real no cuadra: revisa la integral de t.' },
            { latex: cfr(re, add(im, fr(1))), feedback: 'La parte imaginaria no cuadra: revisa el producto z̄·dz.' },
          ]),
        };
      }
      const a = rng.nonZero(-2, 2);
      const b = rng.int(-3, 3);
      const m = rng.int(1, 2);
      const z2 = [m, m * m];
      const z3 = cmulI(cmulI(z2, z2), z2);
      const val = [a * z3[0] + b * z2[0], a * z3[1] + b * z2[1]];
      const ans = cplx(...val);
      return {
        params: { kind: 'poly', a, b, m },
        statement: { text: `Calcula la integral a lo largo de la parábola y = x², desde z = 0 hasta z = ${cplx(...z2).replace(/\s/g, '')}:`, latex: `\\int_{C} (${terms([[3 * a, 'z^{2}'], [b, '']])})\\,dz` },
        answer: { latex: ans },
        steps: [
          { latex: `F(z)=${terms([[a, 'z^{3}'], [b, 'z']])}`, note: 'El integrando es un polinomio, analítico en todo el plano: la integral no depende del camino.' },
          { latex: `F(${cplx(...z2)})-F(0)`, note: 'Evalúa la antiderivada en los extremos.' },
          { latex: ans, note: `(${cplx(...z2)})³ = ${cplx(...z3)}.` },
        ],
        distractors: uniqueDistractors(ans, [
          { latex: cplx(a * z3[0], a * z3[1]), feedback: 'Faltó integrar el término constante.' },
          { latex: cplx(3 * a * z3[0] + b * z2[0], 3 * a * z3[1] + b * z2[1]), feedback: 'La antiderivada de 3z² es z³: el 3 se cancela.' },
          { latex: cplx(val[0], -val[1]), feedback: 'Ese es el conjugado: revisa el cubo del extremo.' },
          { latex: cplx(val[0] + 1, val[1]), feedback: 'La parte real no cuadra: revisa el cubo del extremo.' },
          { latex: cplx(val[0], val[1] + 1), feedback: 'La parte imaginaria no cuadra: revisa el cubo del extremo.' },
        ]),
      };
    },
  },
  {
    id: 'vc-cauchy-derivada',
    topic: 'Integración compleja',
    difficulty: 5,
    generate(rng) {
      const m = rng.int(1, 2);
      const z0 = rng.int(-2, 2);
      const R = Math.abs(z0) + rng.int(1, 2);
      let p, q, D;
      do {
        p = rng.int(-3, 3);
        q = rng.int(-4, 4);
        D = m === 1 ? 3 * z0 * z0 + 2 * p * z0 + q : 3 * z0 + p;
      } while (D === 0);
      const N = 2 * D;
      const g0 = z0 ** 3 + p * z0 * z0 + q * z0;
      const g = terms([[1, 'z^{3}'], [p, 'z^{2}'], [q, 'z']]);
      const den = z0 === 0 ? `z^{${m + 1}}` : `(${polyLatex([-z0, 1], 'z')})^{${m + 1}}`;
      const ans = co(N, '\\pi i');
      const cands = [
        g0 !== 0 ? { latex: co(2 * g0, '\\pi i'), feedback: 'Con potencia m + 1 en el denominador se usa la derivada m-ésima, no g(z₀).' } : null,
        m === 2 ? { latex: co(2 * N, '\\pi i'), feedback: 'Faltó dividir entre m! = 2.' } : { latex: co(D, '\\pi i'), feedback: 'El factor es 2πi, no πi.' },
        { latex: co(N, '\\pi'), feedback: 'Faltó la i de 2πi.' },
        { latex: '0', feedback: 'Daría cero solo si el punto quedara fuera del contorno.' },
      ].filter(Boolean);
      return {
        params: { m, z0, R, p, q },
        statement: { text: 'Calcula la integral recorriendo la circunferencia en sentido antihorario:', latex: `\\oint_{|z|=${R}} \\frac{${g}}{${den}}\\,dz` },
        answer: { latex: ans },
        steps: [
          { latex: `z_0=${z0},\\quad |z_0|<${R}`, note: 'El punto singular queda dentro del contorno.' },
          { latex: `\\oint\\frac{g(z)}{(z-z_0)^{${m + 1}}}\\,dz=\\frac{2\\pi i}{${m}!}\\,g^{(${m})}(z_0)`, note: 'Fórmula integral de Cauchy para derivadas.' },
          { latex: `g^{(${m})}(${z0})=${m === 1 ? D : 2 * D}\\Rightarrow ${ans}`, note: 'Deriva el numerador y evalúa.' },
        ],
        distractors: uniqueDistractors(ans, cands),
      };
    },
  },

  // ═════════════ MAPEOS ═════════════
  {
    id: 'vc-mapeo-z2',
    topic: 'Mapeos',
    difficulty: 3,
    generate(rng) {
      const vertical = rng.next() < 0.5;
      const a = rng.nonZero(-3, 3);
      const A2 = a * a;
      const frac = (s) => `\\frac{v^{2}}{${s}}`;
      const ans = vertical ? `u = ${A2} - ${frac(4 * A2)}` : `u = ${frac(4 * A2)} - ${A2}`;
      return {
        params: { vertical, a },
        statement: { text: `¿En qué curva transforma w = z² = u + iv a la recta ${vertical ? 'Re z' : 'Im z'} = ${a}?`, latex: vertical ? `z=${a}+iy` : `z=x${a < 0 ? '-' : '+'}${Math.abs(a)}i` },
        answer: { latex: ans },
        steps: [
          { latex: vertical ? `w=(${a}+iy)^{2}=${A2}-y^{2}+${2 * a}iy` : `w=(x+${a}i)^{2}=x^{2}-${A2}+${2 * a}ix`, note: 'Sustituye la recta en z².' },
          { latex: vertical ? `u=${A2}-y^{2},\\quad v=${2 * a}y` : `u=x^{2}-${A2},\\quad v=${2 * a}x`, note: 'Separa parte real e imaginaria.' },
          { latex: ans, note: 'Elimina el parámetro despejándolo de v.' },
        ],
        distractors: uniqueDistractors(ans, [
          { latex: vertical ? `u = ${A2} + ${frac(4 * A2)}` : `u = -${frac(4 * A2)} - ${A2}`, feedback: 'Revisa el signo: i² = −1.' },
          { latex: vertical ? `u = ${A2} - ${frac(2 * Math.abs(a))}` : `u = ${frac(2 * Math.abs(a))} - ${A2}`, feedback: 'Al despejar el parámetro de v, el denominador queda (2a)² = 4a².' },
          { latex: `u = ${vertical ? A2 : -A2}`, feedback: 'Bajo z² las rectas se vuelven parábolas, no rectas.' },
        ]),
      };
    },
  },
  {
    id: 'vc-mobius',
    topic: 'Mapeos',
    difficulty: 4,
    generate(rng) {
      let a, b, c, d, z, D;
      do {
        a = rng.int(-3, 3);
        b = rng.int(-3, 3);
        c = rng.nonZero(-2, 2);
        d = rng.int(-3, 3);
        z = [rng.int(-2, 2), rng.nonZero(-2, 2)];
        D = [c * z[0] + d, c * z[1]];
      } while (a * d - b * c === 0);
      const N = [a * z[0] + b, a * z[1]];
      const w = cdivFr(N, D);
      const ans = cfr(...w);
      const zc = [z[0], -z[1]];
      const wc = cdivFr([a * zc[0] + b, a * zc[1]], [c * zc[0] + d, c * zc[1]]);
      const q = D[0] * D[0] + D[1] * D[1];
      const noConj = [fr(N[0] * D[0] - N[1] * D[1], q), fr(N[0] * D[1] + N[1] * D[0], q)];
      return {
        params: { a, b, c, d, z },
        statement: { text: 'Calcula la imagen de z₀ bajo la transformación de Möbius:', latex: `w=\\frac{${polyLatex([b, a], 'z')}}{${polyLatex([d, c], 'z')}},\\qquad z_0=${cplx(...z)}` },
        answer: { latex: ans },
        steps: [
          { latex: `w=\\frac{${cplx(...N)}}{${cplx(...D)}}`, note: 'Sustituye z₀ en numerador y denominador.' },
          { latex: `w=\\frac{(${cplx(...N)})(${cplx(D[0], -D[1])})}{${q}}`, note: 'Multiplica por el conjugado del denominador.' },
          { latex: ans, note: 'Separa parte real e imaginaria.' },
        ],
        distractors: uniqueDistractors(ans, [
          { latex: cfr(w[0], neg(w[1])), feedback: 'Ese es el conjugado de la imagen: revisa los signos al multiplicar.' },
          { latex: cfr(...noConj), feedback: 'Multiplicaste por el denominador sin conjugarlo.' },
          { latex: cfr(...wc), feedback: 'Sustituiste el conjugado de z₀.' },
          { latex: cfr(neg(w[0]), neg(w[1])), feedback: 'Te sobró un signo menos en todo el resultado.' },
          { latex: cfr(add(w[0], fr(1)), w[1]), feedback: 'La parte real no cuadra: revisa el producto del numerador.' },
          { latex: cfr(w[0], add(w[1], fr(1))), feedback: 'La parte imaginaria no cuadra: revisa el producto del numerador.' },
          { latex: cfr(w[1], w[0]), feedback: 'Intercambiaste la parte real y la imaginaria.' },
          { latex: cfr(add(w[0], fr(-1)), w[1]), feedback: 'La parte real queda corrida: revisa el término independiente del numerador.' },
        ]),
      };
    },
  },
  {
    id: 'vc-inversion',
    topic: 'Mapeos',
    difficulty: 4,
    generate(rng) {
      const vertical = rng.next() < 0.5;
      const k = rng.nonZero(-6, 6);
      const h = fr(1, 2 * k);
      const center = vertical ? cfr(h, fr(0)) : cfr(fr(0), neg(h));
      return {
        params: { vertical, k },
        statement: {
          text: `Bajo la inversión w = 1/z, la recta ${vertical ? 'Re z' : 'Im z'} = ${k} se transforma en una circunferencia que pasa por el origen. ¿Cuál es su centro?`,
          latex: `w=\\frac{1}{z},\\qquad ${vertical ? 'x' : 'y'}=${k}`,
        },
        answer: { latex: center },
        steps: [
          { latex: vertical ? `z=${k}+iy\\Rightarrow w=\\frac{${k}-iy}{${k * k}+y^{2}}` : `z=x+${k}i\\Rightarrow w=\\frac{x-${k}i}{x^{2}+${k * k}}`, note: 'Sustituye la recta y multiplica por el conjugado.' },
          { latex: vertical ? `u^{2}+v^{2}=\\frac{u}{${k}}` : `u^{2}+v^{2}=-\\frac{v}{${k}}`, note: 'Elimina el parámetro: queda la ecuación de una circunferencia.' },
          { latex: `\\text{centro}=${center},\\quad r=${fr(1, 2 * Math.abs(k)).toLatex()}`, note: 'Completa el cuadrado.' },
        ],
        distractors: uniqueDistractors(center, vertical
          ? [
              { latex: cfr(fr(1, k), fr(0)), feedback: 'El diámetro va de 0 a 1/k: el centro está a la mitad.' },
              { latex: cfr(neg(h), fr(0)), feedback: 'Revisa el signo: la imagen queda del mismo lado que la recta.' },
              { latex: cfr(fr(0), h), feedback: 'Una recta vertical se transforma en un círculo con centro en el eje real.' },
            ]
          : [
              { latex: cfr(fr(0), h), feedback: 'Al invertir, la parte imaginaria cambia de signo.' },
              { latex: cfr(fr(0), fr(-1, k)), feedback: 'El diámetro va de 0 a −i/k: el centro está a la mitad.' },
              { latex: cfr(h, fr(0)), feedback: 'Una recta horizontal se transforma en un círculo con centro en el eje imaginario.' },
            ]),
      };
    },
  },
];
