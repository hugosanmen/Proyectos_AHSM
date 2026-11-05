// templates-plus.js — plantillas añadidas para dar variedad a los temas con poca oferta y cubrir las dificultades 4 y 5.
// Misma forma que los demás archivos. Cada una tiene un oráculo independiente en test/oracles/plus.js
// y su idea clave en ideas.js.

import { fr, ansOf, dFr, compact, comb, terms, co, xPow, polyLatex, intNot, uniqueDistractors, numericDistractors, TRIPLES } from './helpers.js';

const tex = (t) => `\\text{${t}}`;
const pmatrix = (rows) => `\\begin{pmatrix}${rows.map((r) => r.join(' & ')).join(' \\\\ ')}\\end{pmatrix}`;
/** Múltiplo racional de π en LaTeX. */
const piFr = (f) => (f.d === 1 ? co(f.n, '\\pi') : `${f.n < 0 ? '-' : ''}\\frac{${Math.abs(f.n) === 1 ? '' : Math.abs(f.n)}\\pi}{${f.d}}`);
/** (z − a) en LaTeX; si a = 0 queda solo z. */
const factor = (a, v = 'z') => (a === 0 ? v : `(${polyLatex([-a, 1], v)})`);
const det2 = (a, b, c, d) => a * d - b * c;
const det3 = (m) => m[0][0] * det2(m[1][1], m[1][2], m[2][1], m[2][2]) - m[0][1] * det2(m[1][0], m[1][2], m[2][0], m[2][2]) + m[0][2] * det2(m[1][0], m[1][1], m[2][0], m[2][1]);
const cofactor = (m, i, j) => {
  const r = [0, 1, 2].filter((x) => x !== i);
  const c = [0, 1, 2].filter((x) => x !== j);
  return (-1) ** (i + j) * det2(m[r[0]][c[0]], m[r[0]][c[1]], m[r[1]][c[0]], m[r[1]][c[1]]);
};

export const templatesPlus = [
  // ═════════════ EXPONENTES Y LOGARITMOS ═════════════
  {
    id: 'alg-exp-ecuacion',
    topic: 'Exponentes y logaritmos',
    difficulty: 2,
    generate(rng) {
      const b = rng.int(2, 5);
      const k = rng.int(2, b === 5 ? 3 : 4);
      const c = rng.nonZero(-3, 3);
      const val = fr(k - c);
      return {
        params: { b, k, c },
        statement: { text: 'Resuelve para x:', latex: `${b}^{${polyLatex([c, 1])}} = ${b ** k}` },
        answer: ansOf(val),
        steps: [
          { latex: `${b}^{${polyLatex([c, 1])}} = ${b}^{${k}}`, note: 'Escribe ambos lados con la misma base.' },
          { latex: `${polyLatex([c, 1])} = ${k} \\Rightarrow x = ${val.toLatex()}`, note: 'Con la misma base, los exponentes deben ser iguales.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(k + c), 'Al despejar x, el término constante cambia de signo.'),
          dFr(fr(k), 'Ese es el exponente completo; todavía falta despejar x.'),
          dFr(fr(b ** k - c), 'Igualaste contra la potencia; compara exponentes con la misma base.'),
        ]),
      };
    },
  },
  {
    id: 'alg-log-ecuacion',
    topic: 'Exponentes y logaritmos',
    difficulty: 4,
    generate(rng) {
      const b = rng.pick([2, 3, 5]);
      const q = rng.int(0, b === 5 ? 1 : 2);
      const p = q + rng.int(1, b === 5 ? 2 : 3);
      const n = p + q;
      const k = b ** p - b ** q;
      const x = b ** p;
      return {
        params: { b, p, q, n, k },
        statement: { text: 'Resuelve para x (solo sirve la raíz válida):', latex: `\\log_{${b}}(x)+\\log_{${b}}(x - ${k})=${n}` },
        answer: ansOf(fr(x)),
        steps: [
          { latex: `x(x - ${k}) = ${b}^{${n}} = ${b ** n}`, note: 'La suma de logaritmos es el logaritmo del producto.' },
          { latex: `x = ${x} \\quad\\text{o}\\quad x = ${-(b ** q)}`, note: 'Resuelve la cuadrática.' },
          { latex: `x = ${x}`, note: 'Un logaritmo necesita argumento positivo: se descarta la raíz negativa.' },
        ],
        distractors: numericDistractors(fr(x), [
          dFr(fr(-(b ** q)), 'Esa raíz vuelve negativos los argumentos del logaritmo: se descarta.'),
          dFr(fr(b ** n), 'Sumar logaritmos multiplica los argumentos; no basta con quitar el logaritmo.'),
          dFr(fr(k), 'Ese es el número que se resta a x, no la solución.'),
        ]),
      };
    },
  },

  // ═════════════ BINOMIO DE NEWTON ═════════════
  {
    id: 'alg-binomio-general',
    topic: 'Binomio de Newton',
    difficulty: 3,
    generate(rng) {
      const p = rng.int(2, 3);
      const q = rng.nonZero(-3, 3);
      const n = rng.int(3, 6);
      const k = rng.int(1, n - 1);
      const C = comb(n, k);
      const val = fr(C * p ** k * q ** (n - k));
      return {
        params: { p, q, n, k },
        statement: { text: `¿Cuál es el coeficiente de ${xPow(k)} en este desarrollo?`, latex: `(${terms([[p, 'x'], [q, '']])})^{${n}}` },
        answer: ansOf(val),
        steps: [
          { latex: `\\binom{${n}}{${k}} (${p}x)^{${k}} (${q})^{${n - k}}`, note: 'Toma el término con x elevada a la potencia pedida.' },
          { latex: `${C}\\cdot ${p ** k}\\cdot ${q < 0 && (n - k) % 2 ? `(${q ** (n - k)})` : q ** (n - k)} = ${val.toLatex()}`, note: 'El coeficiente de x también se eleva a esa potencia.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(C * q ** (n - k)), 'Faltó elevar el coeficiente de x a la potencia.'),
          dFr(fr(C * p ** k), 'Faltó el factor del segundo término del binomio.'),
          dFr(fr(C), 'Ese es solo el combinatorio.'),
        ]),
      };
    },
  },
  {
    id: 'alg-binomio-independiente',
    topic: 'Binomio de Newton',
    difficulty: 4,
    generate(rng) {
      const n = rng.pick([4, 6, 8]);
      const a = rng.nonZero(-3, 3);
      const h = n / 2;
      const C = comb(n, h);
      const val = fr(C * a ** h);
      return {
        params: { n, a },
        statement: { text: '¿Cuál es el término independiente de x en este desarrollo?', latex: `\\left(x ${a < 0 ? '-' : '+'} \\frac{${Math.abs(a)}}{x}\\right)^{${n}}` },
        answer: ansOf(val),
        steps: [
          { latex: `\\binom{${n}}{k} x^{${n}-k}\\left(\\frac{${a}}{x}\\right)^{k} = \\binom{${n}}{k}(${a})^{k} x^{${n}-2k}`, note: 'Escribe el término general y junta las potencias de x.' },
          { latex: `${n}-2k=0 \\Rightarrow k=${h}`, note: 'Independiente significa que la potencia de x es cero.' },
          { latex: `\\binom{${n}}{${h}}(${a})^{${h}} = ${val.toLatex()}`, note: 'Sustituye ese valor de k.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(C), 'Faltó elevar la constante del segundo término.'),
          dFr(fr(C * a), 'La constante se eleva a la potencia k, no queda con exponente 1.'),
          dFr(fr(a ** h), 'Faltó el coeficiente combinatorio.'),
        ]),
      };
    },
  },

  // ═════════════ INTEGRAL DEFINIDA ═════════════
  {
    id: 'int-area-curvas',
    topic: 'Integral definida',
    difficulty: 3,
    generate(rng) {
      const a = rng.int(1, 3);
      const k = rng.int(2, 9);
      const val = fr(k ** 3, 6 * a * a);
      return {
        params: { a, k },
        statement: { text: 'Calcula el área de la región encerrada por las curvas:', latex: `y=${co(a, 'x^{2}')},\\quad y=${k}x` },
        answer: ansOf(val),
        steps: [
          { latex: `${co(a, 'x^{2}')}=${k}x \\Rightarrow x=0,\\quad x=${fr(k, a).toLatex()}`, note: 'Las curvas se cortan en los límites de integración.' },
          { latex: `\\int_{0}^{${fr(k, a).toLatex()}} (${k}x-${co(a, 'x^{2}')})\\,dx = ${val.toLatex()}`, note: 'Integra la curva de arriba menos la de abajo.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(-(k ** 3), 6 * a * a), 'Restaste al revés: el área siempre es positiva.'),
          dFr(fr(k ** 3, 3 * a * a), 'Esa es solo el área bajo la parábola.'),
          dFr(fr(k ** 3, 2 * a * a), 'Esa es solo el área bajo la recta.'),
        ]),
      };
    },
  },
  {
    id: 'int-definida-abs',
    topic: 'Integral definida',
    difficulty: 4,
    generate(rng) {
      const c = rng.int(-3, 3);
      const l = rng.int(1, 5);
      const r = rng.int(1, 5);
      const a = c - l;
      const b = c + r;
      const val = fr(l * l + r * r, 2);
      return {
        params: { a, b, c },
        statement: { text: 'Calcula la integral definida:', latex: `\\int_{${a}}^{${b}} \\left|${polyLatex([-c, 1])}\\right|\\,dx` },
        answer: ansOf(val),
        steps: [
          { latex: `\\int_{${a}}^{${c}} (${terms([[-1, 'x'], [c, '']])})\\,dx + \\int_{${c}}^{${b}} (${polyLatex([-c, 1])})\\,dx`, note: 'Parte la integral donde el valor absoluto cambia de signo.' },
          { latex: `${fr(l * l, 2).toLatex()} + ${fr(r * r, 2).toLatex()} = ${val.toLatex()}`, note: 'Cada parte es el área de un triángulo.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(r * r - l * l, 2), 'Integraste sin valor absoluto: la parte negativa se restó.'),
          dFr(fr((l + r) ** 2, 2), 'Integraste todo el intervalo como un solo triángulo.'),
          dFr(fr(l * l + r * r), 'Faltó dividir entre 2 al integrar.'),
        ]),
      };
    },
  },
  {
    id: 'int-definida-partes',
    topic: 'Integral definida',
    difficulty: 5,
    generate(rng) {
      const k = rng.int(1, 4);
      const n = rng.int(2, 12);
      const val = fr(k, (n + 1) * (n + 2));
      return {
        params: { k, n },
        statement: { text: 'Calcula la integral definida:', latex: `\\int_{0}^{1} ${co(k, 'x')}(1-x)^{${n}}\\,dx` },
        answer: ansOf(val),
        steps: [
          { latex: `u=1-x,\\quad du=-dx,\\quad x=1-u`, note: 'Sustituye lo que está dentro de la potencia.' },
          { latex: `${k === 1 ? '' : k}\\int_{0}^{1} (1-u)u^{${n}}\\,du = ${k === 1 ? '' : k}\\left(\\frac{1}{${n + 1}}-\\frac{1}{${n + 2}}\\right)`, note: 'Al cambiar de variable se invierten los límites y el signo de du los compensa.' },
          { latex: `${val.toLatex()}`, note: 'Resta las fracciones.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(k, n + 1), 'Falta restar el segundo término de la integral.'),
          dFr(fr(k, n + 2), 'Ese es solo el segundo término.'),
          dFr(fr(k * (2 * n + 3), (n + 1) * (n + 2)), 'Sumaste las fracciones: al distribuir (1 − u) hay una resta.'),
        ]),
      };
    },
  },

  // ═════════════ FUNCIONES DE VARIAS VARIABLES ═════════════
  {
    id: 'vec-gradiente-norma',
    topic: 'Funciones de varias variables',
    difficulty: 3,
    generate(rng) {
      const [A, B, C] = rng.pick(TRIPLES);
      const a = rng.nonZero(-3, 3);
      const x0 = rng.pick([A, -A]);
      const y0 = rng.pick([B, -B]);
      const val = fr(Math.abs(a) * C);
      return {
        params: { a, x0, y0 },
        statement: { text: `Calcula la magnitud del gradiente en el punto (${x0}, ${y0}):`, latex: `f(x,y)=${co(a, 'xy')}` },
        answer: ansOf(val),
        steps: [
          { latex: `\\nabla f=(${co(a, 'y')},\\ ${co(a, 'x')})=(${a * y0},\\ ${a * x0})`, note: 'Deriva respecto de cada variable y evalúa.' },
          { latex: `\\|\\nabla f\\|=\\sqrt{${(a * y0) ** 2}+${(a * x0) ** 2}}=${val.toLatex()}`, note: 'La magnitud es la raíz de la suma de cuadrados.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(a * (x0 + y0)), 'Sumaste los componentes; la magnitud usa sus cuadrados.'),
          dFr(fr(C), 'Falta el factor que multiplica a xy.'),
          dFr(fr(a * a * C * C), 'Falta sacar la raíz cuadrada.'),
        ]),
      };
    },
  },
  {
    id: 'vec-direccional',
    topic: 'Funciones de varias variables',
    difficulty: 4,
    generate(rng) {
      const [A, B, C] = rng.pick(TRIPLES.slice(0, 3));
      const a = rng.nonZero(-3, 3);
      const b = rng.nonZero(-3, 3);
      const x0 = rng.nonZero(-3, 3);
      const y0 = rng.nonZero(-3, 3);
      const gx = 2 * a * x0;
      const gy = 2 * b * y0;
      const val = fr(gx * A + gy * B, C);
      return {
        params: { a, b, x0, y0, A, B, C },
        statement: { text: `Calcula la derivada direccional en (${x0}, ${y0}) en la dirección del vector v = (${A}, ${B}):`, latex: `f(x,y)=${terms([[a, 'x^{2}'], [b, 'y^{2}']])}` },
        answer: ansOf(val),
        steps: [
          { latex: `\\nabla f(${x0},${y0})=(${gx},\\ ${gy})`, note: 'Calcula el gradiente en el punto.' },
          { latex: `\\hat{u}=\\left(\\frac{${A}}{${C}},\\ \\frac{${B}}{${C}}\\right)`, note: 'Convierte la dirección en vector unitario: divide entre su longitud.' },
          { latex: `D_{\\hat{u}}f=\\nabla f\\cdot\\hat{u}=${val.toLatex()}`, note: 'La derivada direccional es el producto punto.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(gx * A + gy * B), 'Usaste v sin normalizar: la dirección debe ser unitaria.'),
          dFr(fr(gx + gy), 'Sumaste el gradiente sin proyectarlo sobre la dirección.'),
          dFr(fr(gx * B + gy * A, C), 'Cruzaste los componentes: x va con x, y va con y.'),
        ]),
      };
    },
  },
  {
    id: 'vec-mixta',
    topic: 'Funciones de varias variables',
    difficulty: 3,
    generate(rng) {
      const a = rng.nonZero(-4, 4);
      const m = rng.int(2, 3);
      const n = rng.int(2, 3);
      const x0 = rng.nonZero(-2, 2);
      const y0 = rng.nonZero(-2, 2);
      const val = fr(a * m * n * x0 ** (m - 1) * y0 ** (n - 1));
      const px = m === 2 ? 'x' : 'x^{2}';
      return {
        params: { a, m, n, x0, y0 },
        statement: { text: `Calcula la derivada parcial mixta f_xy en el punto (${x0}, ${y0}):`, latex: `f(x,y)=${co(a, `x^{${m}}y^{${n}}`)}` },
        answer: ansOf(val),
        steps: [
          { latex: `f_x=${co(a * m, `${px}y^{${n}}`)}`, note: 'Primero deriva respecto de x.' },
          { latex: `f_{xy}=${co(a * m * n, `${px}${n === 2 ? 'y' : 'y^{2}'}`)}`, note: 'Luego deriva ese resultado respecto de y.' },
          { latex: `f_{xy}(${x0},${y0})=${val.toLatex()}`, note: 'Sustituye el punto.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(a * m * x0 ** (m - 1) * y0 ** n), 'Esa es solo f_x: falta derivar respecto de y.'),
          dFr(fr(a * n * x0 ** m * y0 ** (n - 1)), 'Esa es solo f_y: falta derivar respecto de x.'),
          dFr(fr(a * m * n * x0 ** m * y0 ** n), 'Al derivar, cada exponente baja en uno.'),
        ]),
      };
    },
  },

  // ═════════════ INTEGRALES MÚLTIPLES ═════════════
  {
    id: 'vec-doble-triangulo',
    topic: 'Integrales múltiples',
    difficulty: 4,
    generate(rng) {
      const p = rng.nonZero(-4, 4);
      const q = intNot(rng, -4, 4, 0, -2 * p); // 2p + q = 0 daría un ejercicio trivial
      const A = rng.int(1, 4);
      const val = fr(A ** 3 * (2 * p + q), 6);
      return {
        params: { p, q, A },
        statement: { text: 'Calcula la integral doble sobre la región triangular:', latex: `\\int_{0}^{${A}}\\!\\int_{0}^{x} (${terms([[p, 'x'], [q, 'y']])})\\,dy\\,dx` },
        answer: ansOf(val),
        steps: [
          { latex: `\\int_{0}^{x} (${terms([[p, 'x'], [q, 'y']])})\\,dy = ${fr(2 * p + q, 2).toLatex()}x^{2}`, note: 'Integra respecto de y; el límite superior depende de x.' },
          { latex: `\\int_{0}^{${A}} ${fr(2 * p + q, 2).toLatex()}x^{2}\\,dx = ${val.toLatex()}`, note: 'Ahora integra respecto de x.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(A ** 3 * (p + q), 2), 'Integraste en el cuadrado: y llega hasta x, no hasta el valor fijo.'),
          dFr(fr(A ** 3 * p, 3), 'Faltó la parte del integrando que depende de y.'),
          dFr(fr(A ** 3 * (2 * p + q), 2), 'Faltó el 1/3 de integrar x².'),
        ]),
      };
    },
  },
  {
    id: 'vec-triple',
    topic: 'Integrales múltiples',
    difficulty: 3,
    generate(rng) {
      const k = rng.nonZero(-4, 4);
      const A = rng.int(1, 3);
      const B = rng.int(1, 3);
      const C = rng.int(1, 3);
      const val = fr(k * A * A * B * B * C * C, 8);
      return {
        params: { k, A, B, C },
        statement: { text: 'Calcula la integral triple sobre la caja:', latex: `\\int_{0}^{${A}}\\!\\int_{0}^{${B}}\\!\\int_{0}^{${C}} ${co(k, 'xyz')}\\,dz\\,dy\\,dx` },
        answer: ansOf(val),
        steps: [
          { latex: `${k}\\left(\\int_{0}^{${A}} x\\,dx\\right)\\left(\\int_{0}^{${B}} y\\,dy\\right)\\left(\\int_{0}^{${C}} z\\,dz\\right)`, note: 'En una caja, un producto de variables separadas se integra por factores.' },
          { latex: `${k}\\cdot ${fr(A * A, 2).toLatex()}\\cdot ${fr(B * B, 2).toLatex()}\\cdot ${fr(C * C, 2).toLatex()} = ${val.toLatex()}`, note: 'Cada factor da el cuadrado del límite entre 2.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(k * A * B * C), 'Multiplicaste los límites sin integrar.'),
          dFr(fr(k * A * A * B * B * C * C, 2), 'Dividiste entre 2 una sola vez; son tres integrales.'),
          dFr(fr(k * A * A * B * B * C * C, 4), 'Cada variable aporta su propio 1/2: son tres factores.'),
        ]),
      };
    },
  },
  {
    id: 'vec-polar',
    topic: 'Integrales múltiples',
    difficulty: 5,
    generate(rng) {
      const k = rng.int(1, 5);
      const R = rng.int(1, 4);
      const val = fr(k * R ** 4, 2);
      return {
        params: { k, R },
        statement: { text: `Calcula la integral sobre el disco de radio ${R} centrado en el origen (usa coordenadas polares):`, latex: `\\iint_{D} ${k === 1 ? '' : k}(x^{2}+y^{2})\\,dA` },
        answer: { latex: piFr(val), value: (Math.PI * k * R ** 4) / 2 },
        steps: [
          { latex: `x^{2}+y^{2}=r^{2},\\quad dA=r\\,dr\\,d\\theta`, note: 'En polares, el elemento de área lleva un factor r.' },
          { latex: `\\int_{0}^{2\\pi}\\!\\int_{0}^{${R}} ${k === 1 ? '' : k}r^{3}\\,dr\\,d\\theta`, note: 'Multiplica el integrando por r.' },
          { latex: `2\\pi\\cdot ${fr(k * R ** 4, 4).toLatex()} = ${piFr(val)}`, note: 'Integra r³ y después θ.' },
        ],
        distractors: uniqueDistractors(piFr(val), [
          { latex: piFr(fr(2 * k * R ** 3, 3)), feedback: 'Olvidaste el factor r de dA.' },
          { latex: piFr(fr(k * R ** 4, 4)), feedback: 'θ va de 0 a 2π; ese factor faltó.' },
          { latex: piFr(fr(k * R ** 4)), feedback: 'Integrar r³ da r⁴/4; revisa ese denominador.' },
          { latex: piFr(fr(k * R * R)), feedback: 'Eso sería multiplicar por el área del disco, sin integrar r².' },
        ]),
      };
    },
  },

  // ═════════════ CAMPOS VECTORIALES ═════════════
  {
    id: 'vec-rotacional',
    topic: 'Campos vectoriales',
    difficulty: 3,
    generate(rng) {
      const a = rng.nonZero(-3, 3);
      const b = rng.nonZero(-3, 3);
      const c = rng.nonZero(-3, 3);
      const d = rng.nonZero(-3, 3);
      const x0 = rng.nonZero(-3, 3);
      const y0 = rng.nonZero(-3, 3);
      const Qx = 2 * c * x0 + d;
      const Py = a * x0 + b;
      const val = fr(Qx - Py);
      return {
        params: { a, b, c, d, x0, y0 },
        statement: { text: `Calcula la componente en z del rotacional en el punto (${x0}, ${y0}):`, latex: `\\vec{F}=\\left(${terms([[a, 'xy'], [b, 'y']])},\\ ${terms([[c, 'x^{2}'], [d, 'x']])}\\right)` },
        answer: ansOf(val),
        steps: [
          { latex: `(\\nabla\\times\\vec{F})_z=\\frac{\\partial Q}{\\partial x}-\\frac{\\partial P}{\\partial y}`, note: 'P es la primera componente y Q la segunda.' },
          { latex: `${Qx}-(${Py})=${val.toLatex()}`, note: 'Deriva cada componente y evalúa en el punto.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(Py - Qx), 'El orden es ∂Q/∂x menos ∂P/∂y.'),
          dFr(fr(Qx + Py), 'Las dos derivadas se restan, no se suman.'),
          dFr(fr(Qx), 'Ese es solo ∂Q/∂x: falta restar ∂P/∂y.'),
        ]),
      };
    },
  },
  {
    id: 'vec-trabajo-potencial',
    topic: 'Campos vectoriales',
    difficulty: 4,
    generate(rng) {
      const a = rng.nonZero(-3, 3);
      const b = rng.nonZero(-3, 3);
      const c = rng.nonZero(-3, 3);
      const x1 = rng.int(-3, 3);
      const y1 = rng.int(-3, 3);
      const x2 = intNot(rng, -3, 3, x1);
      const y2 = rng.int(-3, 3);
      const phi = (x, y) => a * x * x + b * y * y + c * x * y;
      const val = fr(phi(x2, y2) - phi(x1, y1));
      return {
        params: { a, b, c, x1, y1, x2, y2 },
        statement: { text: `El campo es conservativo. Calcula su trabajo al ir de A(${x1}, ${y1}) a B(${x2}, ${y2}):`, latex: `\\vec{F}=\\left(${terms([[2 * a, 'x'], [c, 'y']])},\\ ${terms([[2 * b, 'y'], [c, 'x']])}\\right)` },
        answer: ansOf(val),
        steps: [
          { latex: `\\varphi(x,y)=${terms([[a, 'x^{2}'], [b, 'y^{2}'], [c, 'xy']])}`, note: 'Busca una función potencial: su gradiente debe dar el campo.' },
          { latex: `\\varphi(B)-\\varphi(A)=${phi(x2, y2)}-(${phi(x1, y1)})=${val.toLatex()}`, note: 'En un campo conservativo solo importan los extremos del camino.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(phi(x1, y1) - phi(x2, y2)), 'El orden es potencial del final menos potencial del inicio.'),
          dFr(fr(phi(x2, y2)), 'Faltó restar el potencial del punto inicial.'),
          dFr(fr(phi(x2, y2) + phi(x1, y1)), 'Los potenciales se restan, no se suman.'),
        ]),
      };
    },
  },
  {
    id: 'vec-green',
    topic: 'Campos vectoriales',
    difficulty: 5,
    generate(rng) {
      const a = rng.nonZero(-4, 4);
      const b = intNot(rng, -4, 4, a, 0);
      const A = rng.int(1, 5);
      const B = rng.int(1, 5);
      const val = fr((b - a) * A * B);
      return {
        params: { a, b, A, B },
        statement: { text: `Con el teorema de Green, calcula la circulación en sentido antihorario sobre el borde del rectángulo [0, ${A}] × [0, ${B}]:`, latex: `\\vec{F}=(${co(a, 'y')},\\ ${co(b, 'x')})` },
        answer: ansOf(val),
        steps: [
          { latex: `\\oint \\vec{F}\\cdot d\\vec{r}=\\iint_{R}\\left(\\frac{\\partial Q}{\\partial x}-\\frac{\\partial P}{\\partial y}\\right)dA`, note: 'Green cambia la integral de línea por una doble.' },
          { latex: `\\frac{\\partial Q}{\\partial x}-\\frac{\\partial P}{\\partial y}=${b}-(${a})=${b - a}`, note: 'El integrando resulta constante.' },
          { latex: `${b - a}\\cdot ${A * B}=${val.toLatex()}`, note: 'Multiplica por el área del rectángulo.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr((a - b) * A * B), 'El orden es ∂Q/∂x menos ∂P/∂y.'),
          dFr(fr((a + b) * A * B), 'Las derivadas se restan, no se suman.'),
          dFr(fr((b - a) * 2 * (A + B)), 'Se multiplica por el área, no por el perímetro.'),
        ]),
      };
    },
  },

  // ═════════════ VALORES PROPIOS ═════════════
  {
    id: 'al-traza-det',
    topic: 'Valores propios',
    difficulty: 2,
    generate(rng) {
      let a, b, c, d;
      do {
        a = rng.int(-4, 5);
        b = rng.int(-3, 4);
        c = rng.int(-3, 4);
        d = rng.int(-4, 5);
      } while ((a + d) ** 2 - 4 * (a * d - b * c) < 0 || a * d - b * c === a + d);
      const ask = rng.pick(['suma', 'producto']);
      const tr = a + d;
      const dt = a * d - b * c;
      const val = fr(ask === 'suma' ? tr : dt);
      return {
        params: { a, b, c, d, ask },
        statement: { text: `Sin calcularlos, ¿cuál es el ${ask} de los valores propios de la matriz?`, latex: `A=${pmatrix([[a, b], [c, d]])}` },
        answer: ansOf(val),
        steps: [
          { latex: `\\lambda_1+\\lambda_2=\\text{tr}(A),\\quad \\lambda_1\\lambda_2=\\det A`, note: 'Salen de los coeficientes de la ecuación característica.' },
          { latex: ask === 'suma' ? `\\text{tr}(A)=${tr}` : `\\det A=${dt}`, note: ask === 'suma' ? 'Suma la diagonal principal.' : 'Calcula ad − bc.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(ask === 'suma' ? dt : tr), ask === 'suma' ? 'Ese es el producto: la suma es la traza.' : 'Esa es la suma: el producto es el determinante.'),
          dFr(fr(b + c), 'La traza usa la diagonal principal, no la secundaria.'),
          dFr(fr(a * d + b * c), 'El determinante resta bc, no lo suma.'),
        ]),
      };
    },
  },
  {
    id: 'al-eigenvector',
    topic: 'Valores propios',
    difficulty: 4,
    generate(rng) {
      let l, m, b, d, a, c;
      do {
        l = rng.int(-4, 5);
        m = rng.nonZero(-3, 3);
        b = rng.nonZero(-3, 3);
        d = rng.int(-3, 4);
        a = l - b * m;
        c = m * (l - d);
      } while (d === l || a + d - l === l);
      return {
        params: { a, b, c, d, l, m },
        statement: { text: `El vector (1, y) es vector propio de A con valor propio λ = ${l}. ¿Cuánto vale y?`, latex: `A=${pmatrix([[a, b], [c, d]])}` },
        answer: ansOf(fr(m)),
        steps: [
          { latex: `(A-${l < 0 ? `(${l})` : l}I)\\vec{v}=\\vec{0}`, note: 'Un vector propio cumple Av = λv.' },
          { latex: `${a - l}\\cdot 1 + (${b})\\,y = 0`, note: 'Usa la primera fila del sistema.' },
          { latex: `y=${fr(l - a, b).toLatex()}`, note: 'Despeja y.' },
        ],
        distractors: numericDistractors(fr(m), [
          dFr(fr(-m), 'Revisa el signo al despejar y.'),
          dFr(fr(l - a), 'Faltó dividir entre el coeficiente de y.'),
          dFr(fr(1, m), 'Invertiste la razón entre componentes.'),
        ]),
      };
    },
  },
  {
    id: 'al-eigen-3',
    topic: 'Valores propios',
    difficulty: 5,
    generate(rng) {
      let a, b, c;
      do {
        a = rng.int(-3, 5);
        b = rng.nonZero(-4, 4);
        c = rng.int(-4, 7);
      } while (c === a || c === a + b || c === a - b);
      const hi = a + Math.abs(b);
      const val = fr(Math.max(hi, c));
      const zero = [0, 0];
      return {
        params: { a, b, c },
        statement: { text: '¿Cuál es el valor propio MAYOR de la matriz?', latex: `A=${pmatrix([[a, b, 0], [b, a, 0], [...zero, c]])}` },
        answer: ansOf(val),
        steps: [
          { latex: `\\det(A-\\lambda I)=(${c}-\\lambda)\\left[(${a}-\\lambda)^{2}-${b * b}\\right]=0`, note: 'La tercera fila y columna están separadas: el determinante se factoriza.' },
          { latex: `\\lambda=${c},\\quad \\lambda=${a - Math.abs(b)},\\quad \\lambda=${hi}`, note: 'Resuelve cada factor.' },
          { latex: `\\lambda_{\\max}=${val.toLatex()}`, note: 'Compara los tres valores.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(a - Math.abs(b)), 'Ese es el menor del bloque de 2×2.'),
          dFr(fr(Math.min(hi, c)), 'Compara los tres valores: ese no es el mayor.'),
          dFr(fr(a), 'Los valores propios del bloque son a ± b, no a.'),
        ]),
      };
    },
  },

  // ═════════════ ESTADÍSTICA DESCRIPTIVA ═════════════
  {
    id: 'pe-mediana',
    topic: 'Estadística descriptiva',
    difficulty: 1,
    generate(rng) {
      const n = rng.pick([5, 6]);
      const xs = Array.from({ length: n }, () => rng.int(1, 20));
      const s = [...xs].sort((a, b) => a - b);
      const val = n % 2 ? fr(s[(n - 1) / 2]) : fr(s[n / 2 - 1] + s[n / 2], 2);
      return {
        params: { xs },
        statement: { text: 'Calcula la mediana de los datos:', latex: xs.join(',\\ ') },
        answer: ansOf(val),
        steps: [
          { latex: s.join(',\\ '), note: 'Primero ordena los datos.' },
          { latex: `\\text{mediana}=${val.toLatex()}`, note: n % 2 ? 'Con cantidad impar, es el dato central.' : 'Con cantidad par, es el promedio de los dos datos centrales.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(xs.reduce((p, x) => p + x, 0), n), 'Esa es la media; la mediana es el valor central.'),
          dFr(fr(xs[Math.floor(n / 2)]), 'Tomaste el dato central sin ordenar.'),
          dFr(fr(s[0] + s[n - 1], 2), 'Ese es el punto medio entre el menor y el mayor.'),
        ]),
      };
    },
  },
  {
    id: 'pe-media-ponderada',
    topic: 'Estadística descriptiva',
    difficulty: 2,
    generate(rng) {
      const w = rng.pick([[30, 30, 40], [20, 30, 50], [25, 25, 50], [10, 40, 50], [20, 20, 60]]);
      const g = [rng.int(5, 10), rng.int(5, 10), rng.int(5, 10)];
      const total = w[0] * g[0] + w[1] * g[1] + w[2] * g[2];
      const val = fr(total, 100);
      return {
        params: { w, g },
        statement: { text: `Tus calificaciones son: tareas ${g[0]} (${w[0]}%), parcial ${g[1]} (${w[1]}%) y final ${g[2]} (${w[2]}%). ¿Cuál es tu promedio ponderado?`, latex: `\\bar{x}=\\sum_i w_i x_i` },
        answer: ansOf(val),
        steps: [
          { latex: `${w[0] / 100}\\cdot ${g[0]}+${w[1] / 100}\\cdot ${g[1]}+${w[2] / 100}\\cdot ${g[2]}`, note: 'Multiplica cada calificación por su peso en decimal.' },
          { latex: `\\bar{x}=${val.toLatex()}`, note: 'Suma los resultados.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(g[0] + g[1] + g[2], 3), 'Ese es el promedio simple: ignora los pesos.'),
          dFr(fr(total), 'Faltó dividir entre 100: los pesos son porcentajes.'),
          dFr(fr(g[2]), 'Esa es solo la calificación del final.'),
        ]),
      };
    },
  },
  {
    id: 'pe-varianza-muestral',
    topic: 'Estadística descriptiva',
    difficulty: 3,
    generate(rng) {
      const n = rng.int(4, 5);
      let xs;
      do {
        xs = Array.from({ length: n }, () => rng.int(1, 9));
      } while (xs.every((x) => x === xs[0]));
      const sum = xs.reduce((p, x) => p + x, 0);
      const sq = xs.reduce((p, x) => p + x * x, 0);
      const num = n * sq - sum * sum;
      const val = fr(num, n * (n - 1));
      return {
        params: { xs },
        statement: { text: 'Calcula la varianza MUESTRAL de los datos:', latex: xs.join(',\\ ') },
        answer: ansOf(val),
        steps: [
          { latex: `\\bar{x}=${fr(sum, n).toLatex()}`, note: 'Primero la media.' },
          { latex: `\\sum (x_i-\\bar{x})^{2}=${fr(num, n).toLatex()}`, note: 'Suma los cuadrados de las desviaciones.' },
          { latex: `s^{2}=\\frac{1}{${n - 1}}\\cdot ${fr(num, n).toLatex()}=${val.toLatex()}`, note: 'En la muestra se divide entre n − 1.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(num, n * n), 'Esa es la poblacional: en una muestra se divide entre n − 1.'),
          dFr(fr(num, n), 'Faltó dividir: esa es la suma de cuadrados.'),
          dFr(fr(sum, n), 'Esa es la media, no la varianza.'),
        ]),
      };
    },
  },

  // ═════════════ FUNCIONES ANALÍTICAS ═════════════
  {
    id: 'vc-armonica-conjugada',
    topic: 'Funciones analíticas',
    difficulty: 3,
    generate(rng) {
      const a = rng.nonZero(-3, 3);
      const b = rng.nonZero(-4, 4);
      const x0 = rng.nonZero(-3, 3);
      const y0 = rng.nonZero(-3, 3);
      const val = fr(2 * a * x0 * y0 + b * y0);
      return {
        params: { a, b, x0, y0 },
        statement: { text: `u es la parte real de una función analítica f = u + iv con v(0, 0) = 0. ¿Cuánto vale v(${x0}, ${y0})?`, latex: `u(x,y)=${terms([[a, 'x^{2}'], [-a, 'y^{2}'], [b, 'x']])}` },
        answer: ansOf(val),
        steps: [
          { latex: `v_y=u_x=${terms([[2 * a, 'x'], [b, '']])},\\quad v_x=-u_y=${co(2 * a, 'y')}`, note: 'Usa las ecuaciones de Cauchy–Riemann.' },
          { latex: `v=${terms([[2 * a, 'xy'], [b, 'y']])}`, note: 'Integra y fija la constante con v(0, 0) = 0.' },
          { latex: `v(${x0},${y0})=${val.toLatex()}`, note: 'Sustituye el punto.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(-(2 * a * x0 * y0 + b * y0)), 'Cauchy–Riemann pide v_y = u_x; revisa el signo.'),
          dFr(fr(2 * a * x0 * y0), 'Faltó el término que sale de bx.'),
          dFr(fr(a * x0 * x0 - a * y0 * y0 + b * x0), 'Ese es u en el punto, no v.'),
        ]),
      };
    },
  },
  {
    id: 'vc-residuo',
    topic: 'Funciones analíticas',
    difficulty: 4,
    generate(rng) {
      const a = rng.int(-5, 5);
      const b = intNot(rng, -5, 5, a);
      const k = rng.nonZero(-6, 6);
      const val = fr(k, a - b);
      return {
        params: { a, b, k },
        statement: { text: `Calcula el residuo de f en el polo simple z = ${a}:`, latex: `f(z)=\\frac{${k}}{${factor(a)}${factor(b)}}` },
        answer: ansOf(val),
        steps: [
          { latex: `\\text{Res}=\\lim_{z\\to ${a}} (z-${a < 0 ? `(${a})` : a})f(z)`, note: 'En un polo simple, multiplica por el factor y toma el límite.' },
          { latex: `\\frac{${k}}{${a}-(${b})}=${val.toLatex()}`, note: 'Se cancela el factor y queda evaluar el resto.' },
        ],
        distractors: numericDistractors(val, compact([
          dFr(fr(k, b - a), 'Ese es el residuo en el otro polo.'),
          dFr(a + b === 0 ? null : fr(k, a + b), 'En el denominador va la resta de los polos.'),
          dFr(fr(k), 'Falta dividir entre el factor que no se cancela.'),
        ])),
      };
    },
  },
  {
    id: 'vc-cauchy',
    topic: 'Funciones analíticas',
    difficulty: 5,
    generate(rng) {
      const a = rng.nonZero(-3, 3);
      const c = intNot(rng, -5, 5, -a * a);
      const R = Math.abs(a) + rng.int(1, 3);
      const n = 2 * (a * a + c);
      return {
        params: { a, c, R, n },
        statement: { text: 'Calcula con la fórmula integral de Cauchy, recorriendo el círculo en sentido antihorario:', latex: `\\oint_{|z|=${R}} \\frac{${terms([[1, 'z^{2}'], [c, '']])}}{${factor(a).replace(/[()]/g, '')}}\\,dz` },
        answer: { latex: co(n, '\\pi i'), value: n },
        steps: [
          { latex: `z=${a}\\ \\text{está dentro de}\\ |z|=${R}`, note: 'Comprueba que el polo queda dentro del contorno.' },
          { latex: `\\oint \\frac{g(z)}{z-z_0}\\,dz=2\\pi i\\,g(z_0)`, note: 'Aquí g(z) es el numerador.' },
          { latex: `2\\pi i\\,(${a * a + c})=${co(n, '\\pi i')}`, note: 'Evalúa g en el polo.' },
        ],
        distractors: uniqueDistractors(co(n, '\\pi i'), [
          { latex: co(n, '\\pi'), feedback: 'Faltó la i de 2πi.' },
          { latex: co(n / 2, '\\pi i'), feedback: 'El factor es 2πi, no πi.' },
          { latex: '0', feedback: 'Daría cero solo si el polo estuviera fuera del contorno.' },
        ]),
      };
    },
  },

  // ═════════════ NIVELES 4 Y 5 EN OTROS TEMAS ═════════════
  {
    id: 'lim-doble-lhopital',
    topic: 'Límites',
    difficulty: 4,
    generate(rng) {
      const variant = rng.pick(['cos', 'exp']);
      const k = rng.int(1, 6);
      const m = rng.int(1, 3);
      const kx = k === 1 ? 'x' : `${k}x`;
      const num = variant === 'cos' ? `1-\\cos(${kx})` : `e^{${kx}}-1-${kx}`;
      const den = m === 1 ? 'x^{2}' : `${m}x^{2}`;
      const val = fr(k * k, 2 * m);
      return {
        params: { variant, k, m },
        statement: { text: 'Calcula el límite:', latex: `\\lim_{x\\to 0} \\frac{${num}}{${den}}` },
        answer: ansOf(val),
        steps: [
          { latex: `\\frac{0}{0}`, note: 'Sustituir da una indeterminación: aplica L′Hôpital.' },
          { latex: `\\lim_{x\\to 0}\\frac{${variant === 'cos' ? `${k === 1 ? '' : k}\\sin(${kx})` : `${k === 1 ? '' : k}e^{${kx}}-${k}`}}{${2 * m}x}`, note: 'Sigue siendo 0/0: se aplica una segunda vez.' },
          { latex: `\\frac{${k * k}}{${2 * m}}=${val.toLatex()}`, note: 'Ahora sí se puede sustituir x = 0.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(k, 2 * m), 'Al derivar dos veces, k sale dos veces.'),
          dFr(fr(k * k, m), 'Faltó el 2 que baja al derivar x² en el denominador.'),
          dFr(fr(0), 'Que el numerador se anule no basta: el denominador también tiende a cero.'),
        ]),
      };
    },
  },
  {
    id: 'derivada-implicita-segunda',
    topic: 'Derivadas',
    difficulty: 5,
    generate(rng) {
      const [A, B, r] = rng.pick(TRIPLES);
      const x0 = rng.pick([A, -A]);
      const y0 = rng.pick([B, -B]);
      const val = fr(-(r * r), y0 ** 3);
      return {
        params: { x0, y0, r },
        statement: { text: `Con derivación implícita, calcula y″ en el punto (${x0}, ${y0}):`, latex: `x^{2}+y^{2}=${r * r}` },
        answer: ansOf(val),
        steps: [
          { latex: `y'=-\\frac{x}{y}`, note: 'Primera derivada implícita.' },
          { latex: `y''=-\\frac{y-xy'}{y^{2}}=-\\frac{x^{2}+y^{2}}{y^{3}}`, note: 'Deriva con la regla del cociente y sustituye y′.' },
          { latex: `y''=-\\frac{${r * r}}{${y0 < 0 ? `(${y0})` : y0}^{3}}=${val.toLatex()}`, note: 'Usa que x² + y² vale la constante y evalúa.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(r * r, y0 ** 3), 'Se perdió el signo negativo de y′.'),
          dFr(fr(-x0, y0), 'Esa es y′: falta derivar otra vez.'),
          dFr(fr(-1, y0), 'Al derivar −x/y también debes derivar y en el denominador.'),
        ]),
      };
    },
  },
  {
    id: 'ed-lineal',
    topic: 'EDO de primer orden',
    difficulty: 3,
    generate(rng) {
      const a = rng.int(1, 5);
      const K = rng.int(-4, 6);
      const y0 = intNot(rng, -4, 8, K);
      const b = a * K;
      const val = fr(y0 - K);
      return {
        params: { a, K, y0 },
        statement: { text: `La solución tiene la forma y(t) = K + C·e^(−${a}t). ¿Cuánto vale C?`, latex: `y' + ${a === 1 ? '' : a}y = ${b},\\quad y(0)=${y0}` },
        answer: ansOf(val),
        steps: [
          { latex: `K=\\frac{${b}}{${a}}=${K}`, note: 'K es la solución constante: sale de hacer y′ = 0.' },
          { latex: `y(0)=${K}+C=${y0}\\Rightarrow C=${val.toLatex()}`, note: 'La condición inicial fija C.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(y0), 'En t = 0 el valor es K + C, no solo C.'),
          dFr(fr(y0 + K), 'K se resta de y(0).'),
          dFr(fr(K - y0), 'Se invirtió la resta.'),
        ]),
      };
    },
  },
  {
    id: 'ed-pvi-segundo',
    topic: 'EDO de segundo orden',
    difficulty: 5,
    generate(rng) {
      const r1 = rng.int(0, 3);
      const r2 = rng.int(-3, r1 - 1);
      const y0 = rng.int(-3, 4);
      const v0 = rng.int(-4, 5);
      const val = fr(v0 - r2 * y0, r1 - r2);
      const C2 = fr(r1 * y0 - v0, r1 - r2);
      return {
        params: { r1, r2, y0, v0 },
        statement: { text: 'La solución es y = C₁·e^(r₁x) + C₂·e^(r₂x), con r₁ la raíz MAYOR. ¿Cuánto vale C₁?', latex: `${terms([[1, "y''"], [-(r1 + r2), "y'"], [r1 * r2, 'y']])}=0,\\quad y(0)=${y0},\\quad y'(0)=${v0}` },
        answer: ansOf(val),
        steps: [
          { latex: `r_1=${r1},\\quad r_2=${r2}`, note: 'Resuelve la ecuación característica.' },
          { latex: `C_1+C_2=${y0},\\quad ${r1}C_1+(${r2})C_2=${v0}`, note: 'Cada condición inicial da una ecuación.' },
          { latex: `C_1=${val.toLatex()}`, note: 'Resuelve el sistema.' },
        ],
        distractors: numericDistractors(val, [
          dFr(C2, 'Ese es C₂: te piden el coeficiente de la raíz mayor.'),
          dFr(fr(y0), 'y(0) es la suma C₁ + C₂, no solo C₁.'),
          dFr(fr(v0 + r2 * y0, r1 - r2), 'Revisa el signo al eliminar C₂.'),
        ]),
      };
    },
  },
  {
    id: 'ma-laplace-edo',
    topic: 'Transformada de Laplace',
    difficulty: 5,
    generate(rng) {
      const a = rng.int(1, 6);
      const y0 = rng.nonZero(-4, 5);
      const k = rng.nonZero(-6, 6);
      const den = `s(s + ${a})`;
      const num = terms([[y0, 's'], [k, '']]);
      const ans = `\\frac{${num}}{${den}}`;
      return {
        params: { a, y0, k },
        statement: { text: '¿Cuál es Y(s), la transformada de Laplace de la solución?', latex: `y' + ${a === 1 ? '' : a}y = ${k},\\quad y(0)=${y0}` },
        answer: { latex: ans },
        steps: [
          { latex: `sY(s)-${y0 < 0 ? `(${y0})` : y0}+${a === 1 ? '' : a}Y(s)=\\frac{${k}}{s}`, note: 'La derivada se transforma en sY(s) − y(0); una constante, en constante/s.' },
          { latex: `(s + ${a})Y(s)=\\frac{${k}}{s}+${y0 < 0 ? `(${y0})` : y0}`, note: 'Junta los términos con Y(s).' },
          { latex: `Y(s)=${ans}`, note: 'Despeja y escribe todo sobre un solo denominador.' },
        ],
        distractors: uniqueDistractors(ans, [
          { latex: `\\frac{${terms([[-y0, 's'], [k, '']])}}{${den}}`, feedback: 'La transformada de y′ es sY(s) − y(0): revisa el signo de y(0).' },
          { latex: `\\frac{${k}}{${den}}`, feedback: 'Se perdió la condición inicial.' },
          { latex: `\\frac{${num}}{s + ${a}}`, feedback: 'La constante se transforma en constante/s: falta ese factor s.' },
        ]),
      };
    },
  },
  {
    id: 'op-lagrange-producto',
    topic: 'Optimización con restricciones',
    difficulty: 5,
    generate(rng) {
      const t = rng.int(1, 12);
      const S = 3 * t;
      const val = fr(t ** 3);
      return {
        params: { t, S },
        statement: { text: 'Con multiplicadores de Lagrange, ¿cuál es el valor máximo de f = xyz con x, y, z > 0 sujeto a la restricción?', latex: `x+y+z=${S}` },
        answer: ansOf(val),
        steps: [
          { latex: `yz=\\lambda,\\quad xz=\\lambda,\\quad xy=\\lambda`, note: 'Iguala el gradiente de f con λ por el gradiente de la restricción.' },
          { latex: `x=y=z=${t}`, note: 'Dividir las ecuaciones muestra que las tres variables son iguales.' },
          { latex: `f=${t}^{3}=${val.toLatex()}`, note: 'Sustituye en f.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(S), 'Ese es el valor de la restricción, no de f.'),
          dFr(fr(t * t), 'En f se multiplican las tres variables.'),
          dFr(fr(3 * t ** 3), 'Las variables se multiplican entre sí; no hay un factor 3.'),
        ]),
      };
    },
  },
  {
    id: 'pe-bayes',
    topic: 'Combinatoria y probabilidad',
    difficulty: 5,
    generate(rng) {
      const d = rng.pick([10, 20, 50, 100]);
      const s = rng.pick([80, 90, 95]);
      const f = rng.pick([5, 10, 20]);
      const tp = d * s;
      const fp = (1000 - d) * f;
      const val = fr(tp, tp + fp);
      return {
        params: { d, s, f },
        statement: { text: `Una falla afecta a ${d} de cada 1000 piezas. Una prueba la detecta en ${s}% de las piezas con falla y marca ${f}% de las piezas sanas por error. Si una pieza da positivo, ¿cuál es la probabilidad de que tenga la falla?`, latex: `P(F\\mid +)` },
        answer: ansOf(val),
        steps: [
          { latex: `P(F\\mid +)=\\frac{P(+\\mid F)P(F)}{P(+)}`, note: 'Aplica el teorema de Bayes.' },
          { latex: `P(+)=\\frac{${s}}{100}\\cdot\\frac{${d}}{1000}+\\frac{${f}}{100}\\cdot\\frac{${1000 - d}}{1000}`, note: 'Hay positivos verdaderos y falsos: suma ambos casos.' },
          { latex: `P(F\\mid +)=${val.toLatex()}`, note: 'Divide los positivos verdaderos entre todos los positivos.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(s, 100), 'Esa es P(+ | F): la condición va al revés.'),
          dFr(fr(d, 1000), 'Esa es la probabilidad antes de la prueba.'),
          dFr(fr(tp, 100000), 'Esa es la probabilidad conjunta: falta dividir entre P(+).'),
        ]),
      };
    },
  },
  {
    id: 'ss-potencia',
    topic: 'Señales y sistemas',
    difficulty: 4,
    generate(rng) {
      const A = rng.int(1, 6);
      const B = rng.int(1, 4);
      const w = rng.int(1, 9);
      const val = fr(2 * B * B + A * A, 2);
      return {
        params: { A, B, w },
        statement: { text: '¿Cuál es la potencia media de la señal?', latex: `x(t)=${co(A, `\\cos(${co(w, 't')})`)} + ${B}` },
        answer: ansOf(val),
        steps: [
          { latex: `P=\\frac{1}{T}\\int_{0}^{T} x^{2}(t)\\,dt`, note: 'La potencia media es el promedio de x² en un periodo.' },
          { latex: `P=${B}^{2}+\\frac{${A}^{2}}{2}=${val.toLatex()}`, note: 'El promedio del coseno es 0 y el de cos² es 1/2, así que el término cruzado desaparece.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(A * A + B * B), 'El promedio de cos² es 1/2, no 1.'),
          dFr(fr((A + B) ** 2), 'Ese es el cuadrado del valor máximo, no su promedio.'),
          dFr(fr(A * A, 2), 'Faltó la potencia de la componente constante.'),
        ]),
      };
    },
  },
  {
    id: 'mn-newton-doble',
    topic: 'Raíces de ecuaciones',
    difficulty: 4,
    generate(rng) {
      const c = rng.int(2, 15);
      const x0 = intNot(rng, 1, 5, ...[1, 2, 3, 4, 5].filter((v) => v * v === c));
      const x1 = fr(x0 * x0 + c, 2 * x0);
      const x2 = fr(x1.n * x1.n + c * x1.d * x1.d, 2 * x1.n * x1.d);
      const stale = fr(2 * x0 * x1.n * x1.d - (x1.n * x1.n - c * x1.d * x1.d), 2 * x0 * x1.d * x1.d);
      return {
        params: { c, x0 },
        statement: { text: `Calcula x₂ con DOS iteraciones de Newton–Raphson para aproximar √${c}:`, latex: `f(x)=x^{2}-${c},\\quad x_0=${x0}` },
        answer: ansOf(x2),
        steps: [
          { latex: `x_1=x_0-\\frac{x_0^{2}-${c}}{2x_0}=${x1.toLatex()}`, note: 'Primera iteración.' },
          { latex: `x_2=x_1-\\frac{x_1^{2}-${c}}{2x_1}=${x2.toLatex()}`, note: 'Repite la fórmula partiendo de x₁.' },
        ],
        distractors: numericDistractors(x2, [
          dFr(x1, 'Ese es x₁: faltó la segunda iteración.'),
          dFr(stale, 'En cada iteración la derivada se evalúa en el punto nuevo.'),
          dFr(fr(x0 * x0 - c), 'Ese es f(x₀), no una aproximación de la raíz.'),
        ]),
      };
    },
  },
  {
    id: 'al-inversa-3',
    topic: 'Matrices',
    difficulty: 5,
    generate(rng) {
      let m, det;
      do {
        m = [0, 1, 2].map(() => [rng.int(-2, 3), rng.int(-2, 3), rng.int(-2, 3)]);
        det = det3(m);
      } while (det === 0);
      const i = rng.int(0, 2);
      const j = rng.int(0, 2);
      const cji = cofactor(m, j, i);
      const val = fr(cji, det);
      return {
        params: { m, i, j },
        statement: { text: `En la matriz inversa A⁻¹, ¿cuánto vale la entrada de la fila ${i + 1}, columna ${j + 1}?`, latex: `A=${pmatrix(m)}` },
        answer: ansOf(val),
        steps: [
          { latex: `\\det A=${det}`, note: 'Sin determinante distinto de cero no hay inversa.' },
          { latex: `(A^{-1})_{${i + 1}${j + 1}}=\\frac{C_{${j + 1}${i + 1}}}{\\det A}`, note: 'La inversa usa la adjunta: los cofactores van transpuestos.' },
          { latex: `\\frac{${cji}}{${det}}=${val.toLatex()}`, note: 'Calcula el cofactor con su signo y divide.' },
        ],
        distractors: numericDistractors(val, compact([
          dFr(i === j ? null : fr(cofactor(m, i, j), det), 'Los cofactores se transponen: los índices van invertidos.'),
          dFr(fr(cji), 'Faltó dividir entre el determinante.'),
          dFr(fr(-cji, det), 'Revisa el signo (−1)^(i+j) del cofactor.'),
        ])),
      };
    },
  },
  {
    id: 'mo-logistica',
    topic: 'Sistemas dinámicos',
    difficulty: 4,
    generate(rng) {
      const m = rng.pick([2, 4, 5, 10]);
      const K = rng.int(1, 12) * 100;
      const val = fr(K, 4 * m);
      return {
        params: { m, K },
        statement: { text: 'Una población sigue el modelo logístico. ¿Cuál es su tasa de crecimiento máxima?', latex: `P'=\\frac{1}{${m}}P\\left(1-\\frac{P}{${K}}\\right)` },
        answer: ansOf(val),
        steps: [
          { latex: `P^{*}=\\frac{${K}}{2}=${K / 2}`, note: 'P′ es una parábola en P: su máximo está a la mitad de la capacidad.' },
          { latex: `P'(P^{*})=\\frac{rK}{4}=${val.toLatex()}`, note: 'Sustituye ese valor en el modelo.' },
        ],
        distractors: numericDistractors(val, [
          dFr(fr(K, 2), 'Esa es la población donde el crecimiento es máximo, no la tasa.'),
          dFr(fr(K), 'Esa es la capacidad de carga: ahí el crecimiento es cero.'),
          dFr(fr(K, m), 'Falta el 1/4 que resulta de P*(1 − P*/K).'),
        ]),
      };
    },
  },
  {
    id: 'mo-sistema-lineal',
    topic: 'Sistemas dinámicos',
    difficulty: 5,
    generate(rng) {
      const kind = rng.int(0, 3);
      let a, b, c, d;
      if (kind === 3) {
        let p, q, r;
        do {
          p = rng.int(-2, 2);
          q = rng.int(1, 5);
          r = rng.int(1, 5);
        } while (q * r <= p * p);
        [a, b, c, d] = [p, q, -r, -p];
      } else {
        const l1 = kind === 1 ? rng.int(1, 4) : rng.int(-4, -1);
        const l2 = kind === 0 ? intNot(rng, -4, -1, l1) : kind === 1 ? intNot(rng, 1, 4, l1) : rng.int(1, 4);
        const s = rng.int(-2, 2);
        const t = rng.int(-1, 1);
        const u = rng.nonZero(-1, 1);
        // Semejanza entera P B P⁻¹: conserva los valores propios y oculta la forma triangular.
        const [p11, p12, p21, p22] = [1, t, u, 1 + t * u];
        const [i11, i12, i21, i22] = [1 + t * u, -t, -u, 1];
        const [m11, m12, m21, m22] = [p11 * l1, p11 * s + p12 * l2, p21 * l1, p21 * s + p22 * l2];
        [a, b, c, d] = [m11 * i11 + m12 * i21, m11 * i12 + m12 * i22, m21 * i11 + m22 * i21, m21 * i12 + m22 * i22];
      }
      const verdict = ['Nodo estable', 'Nodo inestable', 'Punto silla', 'Centro'][kind];
      const why = {
        'Nodo estable': 'Un nodo estable pide dos valores propios reales negativos.',
        'Nodo inestable': 'Un nodo inestable pide dos valores propios reales positivos.',
        'Punto silla': 'Una silla pide valores propios reales de signos opuestos: det A < 0.',
        Centro: 'Un centro pide valores propios imaginarios puros: traza 0 y det A > 0.',
      };
      const tr = a + d;
      const dt = a * d - b * c;
      return {
        params: { a, b, c, d, kind },
        statement: { text: 'Clasifica el punto de equilibrio en el origen del sistema x′ = Ax:', latex: `A=${pmatrix([[a, b], [c, d]])}` },
        answer: { latex: tex(verdict) },
        steps: [
          { latex: `\\text{tr}(A)=${tr},\\quad \\det A=${dt}`, note: 'La traza y el determinante deciden el tipo de equilibrio.' },
          { latex: `\\lambda^{2}-(${tr})\\lambda+(${dt})=0`, note: 'Sus raíces son los valores propios.' },
          { latex: tex(verdict), note: 'Reales negativos: nodo estable. Reales positivos: nodo inestable. Signos opuestos: silla. Imaginarios puros: centro.' },
        ],
        distractors: Object.keys(why).filter((o) => o !== verdict).map((o) => ({ latex: tex(o), feedback: why[o] })),
      };
    },
  },
];
