// templates-n2.js — Nivel 2: Cálculo Vectorial, Álgebra Lineal y Ecuaciones Diferenciales.

import { fr, safeFr, ansOf, num, dFr, compact, terms, co, polyLatex, intNot, uniqueDistractors, numericDistractors } from './helpers.js';

const vec = (v) => `(${v.join(',')})`;
const mat = (rows) => `\\begin{pmatrix}${rows.map((r) => r.join(' & ')).join(' \\\\ ')}\\end{pmatrix}`;
const det2 = (a, b, c, d) => a * d - b * c;

export const templatesN2 = [
  // ═════════════ CÁLCULO VECTORIAL ═════════════
  {
    id: 'vec-punto',
    topic: 'Vectores',
    difficulty: 1,
    generate(rng) {
      const u = [rng.int(-5, 5), rng.int(-5, 5), rng.int(-5, 5)];
      const v = [rng.int(-5, 5), rng.int(-5, 5), rng.int(-5, 5)];
      const dot = u[0] * v[0] + u[1] * v[1] + u[2] * v[2];
      return {
        params: { u, v },
        statement: { text: 'Calcula el producto punto u · v:', latex: `\\vec{u}=${vec(u)},\\quad \\vec{v}=${vec(v)}` },
        answer: ansOf(fr(dot)),
        steps: [
          { latex: `u\\cdot v = (${num(u[0])})(${num(v[0])}) + (${num(u[1])})(${num(v[1])}) + (${num(u[2])})(${num(v[2])})`, note: 'Multiplica componente con componente y suma.' },
          { latex: `= ${u[0] * v[0]} + ${num(u[1] * v[1])} + ${num(u[2] * v[2])} = ${dot}`, note: 'El resultado es un escalar (un número), no un vector.' },
        ],
        distractors: numericDistractors(fr(dot), compact([
          dFr(fr(u[0] + v[0] + u[1] + v[1] + u[2] + v[2]), 'Sumaste las componentes en vez de multiplicarlas.'),
          dFr(fr(u[0] * v[0] + u[1] * v[1]), 'Te faltó la tercera componente.'),
          dFr(fr(u[0] * v[0] + u[1] * v[1] - u[2] * v[2]), 'Revisa los signos al multiplicar la tercera componente.'),
        ])),
      };
    },
  },
  {
    id: 'vec-cruz',
    topic: 'Vectores',
    difficulty: 2,
    generate(rng) {
      const u = [rng.int(-4, 4), rng.int(-4, 4), rng.int(-4, 4)];
      const v = [rng.int(-4, 4), rng.int(-4, 4), rng.int(-4, 4)];
      const comp = rng.pick(['i', 'j', 'k']);
      const cross = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
      const idx = { i: 0, j: 1, k: 2 }[comp];
      const val = cross[idx];
      const formula = { i: `u_2v_3-u_3v_2`, j: `u_3v_1-u_1v_3`, k: `u_1v_2-u_2v_1` }[comp];
      const wrongSign = { i: -val, j: -val, k: -val }[comp];
      return {
        params: { u, v, comp },
        statement: { text: `¿Cuál es la componente en ${comp} del producto cruz u × v?`, latex: `\\vec{u}=${vec(u)},\\quad \\vec{v}=${vec(v)}` },
        answer: ansOf(fr(val)),
        steps: [
          { latex: `(u\\times v)_${comp} = ${formula}`, note: comp === 'j' ? 'En j el orden está invertido (es el cofactor central del determinante).' : 'Usa el determinante simbólico y toma el cofactor correspondiente.' },
          { latex: `= ${val}`, note: 'Sustituye las componentes con cuidado con los signos.' },
        ],
        distractors: numericDistractors(fr(val), compact([
          dFr(fr(wrongSign), 'Probablemente intercambiaste el orden (u × v = −v × u) o el signo del cofactor.'),
          dFr(fr(cross[(idx + 1) % 3]), 'Esa es otra componente del producto cruz.'),
          dFr(fr(u[idx] * v[idx]), 'Eso es el producto de las mismas componentes; el cruz mezcla las otras dos.'),
        ])),
      };
    },
  },
  {
    id: 'vec-parcial',
    topic: 'Funciones de varias variables',
    difficulty: 2,
    generate(rng) {
      const a = rng.nonZero(-3, 3);
      const b = rng.nonZero(-3, 3);
      const c = rng.int(-5, 5);
      const d = rng.int(-5, 5);
      const x0 = rng.int(-3, 3);
      const y0 = rng.int(-3, 3);
      const wrt = rng.pick(['x', 'y']);
      const fx = 2 * a * x0 * y0 + b * y0 * y0 + c;
      const fy = a * x0 * x0 + 2 * b * x0 * y0 + d;
      const f0 = a * x0 * x0 * y0 + b * x0 * y0 * y0 + c * x0 + d * y0;
      const val = wrt === 'x' ? fx : fy;
      return {
        params: { a, b, c, d, x0, y0, wrt },
        expr: terms([[a, 'x^{2}y'], [b, 'xy^{2}'], [c, 'x'], [d, 'y']]),
        statement: { text: `Calcula la derivada parcial respecto de ${wrt} en el punto (${x0}, ${y0}):`, latex: `f(x,y)=${terms([[a, 'x^{2}y'], [b, 'xy^{2}'], [c, 'x'], [d, 'y']])}` },
        answer: ansOf(fr(val)),
        steps: [
          { latex: wrt === 'x' ? `f_x=${terms([[2 * a, 'xy'], [b, 'y^{2}'], [c, '']])}` : `f_y=${terms([[a, 'x^{2}'], [2 * b, 'xy'], [d, '']])}`, note: `Deriva respecto de ${wrt} y trata la otra letra como constante.` },
          { latex: `f_${wrt}(${x0},${y0}) = ${val}`, note: 'Sustituye el punto.' },
        ],
        distractors: numericDistractors(fr(val), compact([
          dFr(fr(wrt === 'x' ? fy : fx), 'Esa es la otra derivada parcial.'),
          dFr(fr(f0), 'Eso es f(x₀, y₀), el valor de la función, no de su derivada.'),
          dFr(fr(wrt === 'x' ? fx - c : fy - d), 'Olvidaste el término lineal: su derivada es su coeficiente.'),
        ])),
      };
    },
  },
  {
    id: 'vec-doble',
    topic: 'Integrales múltiples',
    difficulty: 3,
    generate(rng) {
      const c = rng.nonZero(-4, 4);
      const d = rng.nonZero(-4, 4);
      const A = rng.int(1, 4);
      const B = rng.int(1, 4);
      const val = fr(c * A * A * B + d * A * B * B, 2);
      return {
        params: { c, d, A, B },
        statement: { text: 'Calcula la integral doble sobre el rectángulo:', latex: `\\int_{0}^{${A}}\\!\\int_{0}^{${B}} \\left(${terms([[c, 'x'], [d, 'y']])}\\right)\\,dy\\,dx` },
        answer: ansOf(val),
        steps: [
          { latex: `\\int_{0}^{${B}} (${terms([[c, 'x'], [d, 'y']])})\\,dy = ${terms([[c * B, 'x']])} + ${fr(d * B * B, 2).toLatex()}`, note: 'Integra primero respecto de y (x se trata como constante).' },
          { latex: `\\int_{0}^{${A}} \\left(${terms([[c * B, 'x']])} + ${fr(d * B * B, 2).toLatex()}\\right)dx = ${val.toLatex()}`, note: 'Ahora integra respecto de x.' },
        ],
        distractors: numericDistractors(val, compact([
          dFr(fr(c * A * A * B + d * A * B * B), 'Olvidaste el 1/2 que aparece al integrar x o y.'),
          dFr(fr(c * B * B * A + d * B * A * A, 2), 'Intercambiaste los límites de x e y.'),
          dFr(fr(c * A + d * B), 'Eso sería evaluar el integrando en la esquina; falta integrar.'),
        ])),
      };
    },
  },
  {
    id: 'vec-divergencia',
    topic: 'Campos vectoriales',
    difficulty: 3,
    generate(rng) {
      const a = rng.nonZero(-3, 3);
      const b = rng.nonZero(-3, 3);
      const c = rng.nonZero(-3, 3);
      const x0 = rng.int(-3, 3);
      const y0 = rng.int(-3, 3);
      const div = 2 * a * x0 + b * x0 + c * y0;
      return {
        params: { a, b, c, x0, y0 },
        statement: { text: `Calcula la divergencia del campo en el punto (${x0}, ${y0}, 1):`, latex: `\\vec{F}(x,y,z)=\\left(${terms([[a, 'x^{2}']])},\; ${terms([[b, 'xy']])},\; ${terms([[c, 'yz']])}\\right)` },
        answer: ansOf(fr(div)),
        steps: [
          { latex: `\\nabla\\cdot F = \\frac{\\partial P}{\\partial x}+\\frac{\\partial Q}{\\partial y}+\\frac{\\partial R}{\\partial z}`, note: 'La divergencia suma la derivada de cada componente respecto de SU variable.' },
          { latex: `= ${terms([[2 * a, 'x']])} + ${terms([[b, 'x']])} + ${terms([[c, 'y']])} = ${div}`, note: `Evalúa en (${x0}, ${y0}, 1).` },
        ],
        distractors: numericDistractors(fr(div), compact([
          dFr(fr(a * x0 * x0 + b * x0 * y0 + c * y0), 'Eso es evaluar las componentes del campo; la divergencia usa sus derivadas.'),
          dFr(fr(2 * a * x0 + b * y0 + c), 'Derivaste respecto de la variable equivocada en Q y R.'),
          dFr(fr(2 * a * x0), 'Solo derivaste la primera componente.'),
        ])),
      };
    },
  },

  // ═════════════ ÁLGEBRA LINEAL ═════════════
  {
    id: 'al-det2',
    topic: 'Matrices',
    difficulty: 1,
    generate(rng) {
      const [a, b, c, d] = Array.from({ length: 4 }, () => rng.int(-7, 7));
      const D = det2(a, b, c, d);
      return {
        params: { a, b, c, d },
        statement: { text: 'Calcula el determinante:', latex: `\\det ${mat([[a, b], [c, d]])}` },
        answer: ansOf(fr(D)),
        steps: [
          { latex: `ad-bc=(${num(a)})(${num(d)})-(${num(b)})(${num(c)})`, note: 'Diagonal principal menos diagonal secundaria.' },
          { latex: `=${a * d}-${num(b * c)}=${D}`, note: 'Ojo con el doble signo al restar un producto negativo.' },
        ],
        distractors: numericDistractors(fr(D), compact([
          dFr(fr(a * d + b * c), 'Se RESTA la diagonal secundaria, no se suma.'),
          dFr(fr(b * c - a * d), 'Restaste al revés: es ad − bc.'),
          dFr(fr(a * d), 'Te faltó restar bc.'),
        ])),
      };
    },
  },
  {
    id: 'al-det3',
    topic: 'Matrices',
    difficulty: 3,
    generate(rng) {
      const m = Array.from({ length: 3 }, () => Array.from({ length: 3 }, () => rng.int(-4, 4)));
      const [[a, b, c], [d, e, f], [g, h, i]] = m;
      const D = a * (e * i - f * h) - b * (d * i - f * g) + c * (d * h - e * g);
      return {
        params: { m },
        statement: { text: 'Calcula el determinante:', latex: `\\det ${mat(m)}` },
        answer: ansOf(fr(D)),
        steps: [
          { latex: `a(ei-fh)-b(di-fg)+c(dh-eg)`, note: 'Expande por cofactores en la primera fila (signos + − +).' },
          { latex: `${num(a)}(${e * i - f * h})-${num(b)}(${d * i - f * g})+${num(c)}(${d * h - e * g}) = ${D}`, note: 'Calcula cada menor 2×2 y combina.' },
        ],
        distractors: numericDistractors(fr(D), compact([
          dFr(fr(a * (e * i - f * h) + b * (d * i - f * g) + c * (d * h - e * g)), 'Los signos de los cofactores alternan: + − +.'),
          dFr(fr(-D), 'Revisa el signo global del desarrollo.'),
          dFr(fr(a * e * i), 'Eso es solo el producto de la diagonal principal; hay más términos.'),
        ])),
      };
    },
  },
  {
    id: 'al-producto',
    topic: 'Matrices',
    difficulty: 2,
    generate(rng) {
      const A = Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => rng.int(-4, 4)));
      const B = Array.from({ length: 2 }, () => Array.from({ length: 2 }, () => rng.int(-4, 4)));
      const i = rng.int(0, 1);
      const j = rng.int(0, 1);
      const prod = (X, Y, r, c) => X[r][0] * Y[0][c] + X[r][1] * Y[1][c];
      const val = prod(A, B, i, j);
      return {
        params: { A, B, i, j },
        statement: { text: `Si C = AB, ¿cuánto vale la entrada c${i + 1}${j + 1} (fila ${i + 1}, columna ${j + 1})?`, latex: `A=${mat(A)},\\quad B=${mat(B)}` },
        answer: ansOf(fr(val)),
        steps: [
          { latex: `c_{${i + 1}${j + 1}} = \\text{(fila ${i + 1} de }A) \\cdot \\text{(columna ${j + 1} de }B)`, note: 'La entrada (i, j) es el producto punto de la fila i de A con la columna j de B.' },
          { latex: `= (${num(A[i][0])})(${num(B[0][j])}) + (${num(A[i][1])})(${num(B[1][j])}) = ${val}`, note: 'Multiplica y suma.' },
        ],
        distractors: numericDistractors(fr(val), compact([
          dFr(fr(prod(B, A, i, j)), 'Eso sale de BA; el producto de matrices no es conmutativo.'),
          dFr(fr(A[i][j] * B[i][j]), 'Multiplicaste entrada con entrada; el producto de matrices combina fila por columna.'),
          dFr(fr(prod(A, B, j, i)), 'Intercambiaste fila y columna (esa es la entrada traspuesta).'),
        ])),
      };
    },
  },
  {
    id: 'al-inversa',
    topic: 'Matrices',
    difficulty: 3,
    generate(rng) {
      let a, b, c, d;
      do {
        [a, b, c, d] = Array.from({ length: 4 }, () => rng.int(-5, 5));
      } while (det2(a, b, c, d) === 0);
      const D = det2(a, b, c, d);
      const entries = [[d, -b], [-c, a]];
      const i = rng.int(0, 1);
      const j = rng.int(0, 1);
      const val = fr(entries[i][j], D);
      return {
        params: { a, b, c, d, i, j },
        statement: { text: `En la matriz inversa A⁻¹, ¿cuánto vale la entrada de la fila ${i + 1}, columna ${j + 1}?`, latex: `A=${mat([[a, b], [c, d]])}` },
        answer: ansOf(val),
        steps: [
          { latex: `A^{-1}=\\frac{1}{ad-bc}${mat([['d', '-b'], ['-c', 'a']])},\\quad ad-bc=${D}`, note: 'Para 2×2: intercambia la diagonal, cambia el signo de la otra y divide entre el determinante.' },
          { latex: `(A^{-1})_{${i + 1}${j + 1}} = ${val.toLatex()}`, note: 'Toma la entrada que te piden.' },
        ],
        distractors: numericDistractors(val, compact([
          dFr(fr(entries[i][j]), 'Te faltó dividir entre el determinante.'),
          dFr(safeFr([[a, b], [c, d]][i][j], D), 'No intercambiaste la diagonal / no cambiaste los signos de la secundaria.'),
          dFr(fr(-entries[i][j], D), 'Revisa los signos: solo cambian los de la diagonal secundaria.'),
        ])),
      };
    },
  },
  {
    id: 'al-eigen',
    topic: 'Valores propios',
    difficulty: 3,
    generate(rng) {
      const variant = rng.pick(['simetrica', 'triangular']);
      let m, lambdas;
      if (variant === 'simetrica') {
        const a = rng.int(-5, 5);
        const b = rng.nonZero(-4, 4);
        m = [[a, b], [b, a]];
        lambdas = [a + b, a - b];
      } else {
        const a = rng.int(-6, 6);
        const d = intNot(rng, -6, 6, a);
        const b = rng.nonZero(-5, 5);
        m = [[a, b], [0, d]];
        lambdas = [a, d];
      }
      const big = Math.max(...lambdas);
      const small = Math.min(...lambdas);
      const tr = m[0][0] + m[1][1];
      const D = det2(m[0][0], m[0][1], m[1][0], m[1][1]);
      return {
        params: { variant, m },
        statement: { text: '¿Cuál es el valor propio MAYOR de la matriz?', latex: `A=${mat(m)}` },
        answer: ansOf(fr(big)),
        steps: [
          { latex: `\\det(A-\\lambda I)=\\lambda^{2}-${num(tr)}\\lambda+${num(D)}=0`, note: 'La ecuación característica es λ² − (traza)λ + (det) = 0.' },
          { latex: `\\lambda=${lambdas[0]}\\quad\\text{o}\\quad\\lambda=${lambdas[1]}`, note: 'Resuelve la cuadrática.' },
          { latex: `\\lambda_{\\max}=${big}`, note: 'Te piden el mayor.' },
        ],
        distractors: numericDistractors(fr(big), compact([
          dFr(fr(small), 'Ese es el valor propio menor.'),
          dFr(fr(tr), 'Esa es la traza (suma de los dos valores propios).'),
          dFr(fr(D), 'Ese es el determinante (producto de los valores propios).'),
        ])),
      };
    },
  },

  // ═════════════ ECUACIONES DIFERENCIALES ═════════════
  {
    id: 'ed-separable',
    topic: 'EDO de primer orden',
    difficulty: 2,
    generate(rng) {
      const k = rng.nonZero(-3, 3);
      const y0 = rng.nonZero(-6, 6);
      const e = `e^{${co(k, 'x')}}`;
      const answerLatex = co(y0, e);
      return {
        params: { k, y0 },
        vars: ['x'],
        expr: answerLatex,
        statement: { text: 'Resuelve el problema de valor inicial:', latex: `y' = ${co(k, 'y')},\\quad y(0) = ${y0}` },
        answer: { latex: answerLatex },
        steps: [
          { latex: `\\frac{dy}{y}=${k}\\,dx \;\\Rightarrow\; \\ln|y|=${co(k, 'x')}+C`, note: 'Separa variables e integra ambos lados.' },
          { latex: `y=Ae^{${co(k, 'x')}},\\quad y(0)=A=${y0}`, note: 'Usa la condición inicial para encontrar la constante.' },
          { latex: `y=${answerLatex}`, note: 'Esa es la solución particular.' },
        ],
        distractors: uniqueDistractors(answerLatex, [
          { latex: co(y0 * k, e), feedback: 'Multiplicaste por k: eso sería y′, no y.' },
          { latex: e, feedback: 'Se perdió la condición inicial: A debe valer y(0).' },
          { latex: co(y0, 'e^{x}'), feedback: 'El exponente debe llevar la constante k de la ecuación.' },
          { latex: co(y0, `e^{${co(-k, 'x')}}`), feedback: 'Cuidado con el signo del exponente: es el mismo de y′ = ky.' },
          { latex: terms([[k, 'x'], [y0, '']]), feedback: 'La solución de y′ = ky es exponencial, no una recta.' },
          { latex: co(y0, `e^{${co(k + (k > 0 ? 1 : -1), 'x')}}`), feedback: 'El exponente es exactamente kx, sin sumarle nada.' },
        ]),
      };
    },
  },
  {
    id: 'ed-pvi',
    topic: 'EDO de primer orden',
    difficulty: 2,
    generate(rng) {
      const a = 2 * rng.nonZero(-3, 3);
      const b = rng.int(-6, 6);
      const y0 = rng.int(-8, 8);
      const x1 = rng.int(1, 4);
      const val = (a / 2) * x1 * x1 + b * x1 + y0;
      return {
        params: { a, b, y0, x1 },
        statement: { text: `Si y(0) = ${y0}, ¿cuánto vale y(${x1})?`, latex: `y' = ${terms([[a, 'x'], [b, '']])}` },
        answer: ansOf(fr(val)),
        steps: [
          { latex: `y=\\int (${terms([[a, 'x'], [b, '']])})\\,dx=${polyLatex([0, b, a / 2])}+C`, note: 'Integra el lado derecho.' },
          { latex: `C=y(0)=${y0}\;\\Rightarrow\; y(${x1})=${val}`, note: 'Con la condición inicial sale C; luego evalúa.' },
        ],
        distractors: numericDistractors(fr(val), compact([
          dFr(fr(a * x1 + b), 'Eso es y′ evaluada en x; te piden y.'),
          dFr(fr(val - y0), 'Olvidaste sumar la constante de la condición inicial.'),
          dFr(fr(a * x1 * x1 + b * x1 + y0), 'Al integrar ax obtienes (a/2)x²; no olvides el 1/2.'),
        ])),
      };
    },
  },
  {
    id: 'ed-equilibrio',
    topic: 'EDO de primer orden',
    difficulty: 3,
    generate(rng) {
      const a = rng.int(1, 6);
      const b = rng.nonZero(-12, 12);
      const eq = fr(b, a);
      return {
        params: { a, b },
        statement: { text: 'Para la solución con y(0) = 0, ¿a qué valor tiende y(t) cuando t → ∞?', latex: `y' + ${co(a, 'y')} = ${b}` },
        answer: ansOf(eq),
        steps: [
          { latex: `y'=0 \;\\Rightarrow\; ${co(a, 'y')}=${b}`, note: 'En el equilibrio y deja de cambiar: y′ = 0.' },
          { latex: `y_{eq}=${eq.toLatex()}`, note: `Como a = ${a} > 0, el equilibrio es estable y la solución tiende a él.` },
        ],
        distractors: numericDistractors(eq, compact([
          dFr(safeFr(a, b), 'Invertiste: es b/a.'),
          dFr(fr(-b, a), 'El signo: y′ = 0 da a·y = b, sin cambiar de signo.'),
          dFr(fr(a * b), 'Dividir, no multiplicar: y = b/a.'),
        ])),
      };
    },
  },
  {
    id: 'ed-caracteristica',
    topic: 'EDO de segundo orden',
    difficulty: 3,
    generate(rng) {
      const r1 = rng.int(-6, 6);
      const r2 = intNot(rng, -6, 6, r1);
      const p = -(r1 + r2);
      const q = r1 * r2;
      const hi = Math.max(r1, r2);
      const lo = Math.min(r1, r2);
      return {
        params: { r1, r2, p, q },
        statement: { text: 'Esta ecuación tiene soluciones de la forma e^{rx}. ¿Cuál es la MAYOR raíz r de su ecuación característica?', latex: `y'' ${p < 0 ? '-' : '+'} ${Math.abs(p) === 1 ? '' : Math.abs(p)}y' ${q < 0 ? '-' : '+'} ${Math.abs(q) === 1 ? '' : Math.abs(q)}y = 0`.replace(/ \+ 0y| - 0y/, '').replace(/ \+ 0y' | - 0y' /, ' ') },
        answer: ansOf(fr(hi)),
        steps: [
          { latex: `r^{2}${p < 0 ? '-' : '+'}${Math.abs(p)}r${q < 0 ? '-' : '+'}${Math.abs(q)}=0`, note: 'Sustituye y = e^{rx}: cada derivada baja una potencia de r.' },
          { latex: `(r-${num(r1)})(r-${num(r2)})=0 \;\\Rightarrow\; r=${r1},\; r=${r2}`, note: 'Factoriza la cuadrática.' },
          { latex: `r_{\\max}=${hi}`, note: 'Te piden la mayor.' },
        ],
        distractors: numericDistractors(fr(hi), compact([
          dFr(fr(lo), 'Esa es la raíz menor.'),
          dFr(fr(-hi), 'Cuidado con el signo al factorizar: (r − r₁) = 0 da r = +r₁.'),
          dFr(fr(r1 + r2), 'Esa es la suma de las raíces.'),
        ])),
      };
    },
  },
  {
    id: 'ed-oscilador',
    topic: 'EDO de segundo orden',
    difficulty: 2,
    generate(rng) {
      const w = rng.int(2, 9);
      const variant = rng.pick(['simple', 'masa']);
      let latex, params;
      if (variant === 'simple') {
        latex = `y'' + ${w * w}y = 0`;
        params = { variant, w };
      } else {
        const m = rng.int(2, 5);
        latex = `${m}y'' + ${m * w * w}y = 0`;
        params = { variant, w, m };
      }
      return {
        params,
        statement: { text: 'Las soluciones oscilan como sen(ωt) y cos(ωt). ¿Cuánto vale la frecuencia angular ω?', latex },
        answer: ansOf(fr(w)),
        steps: [
          { latex: variant === 'simple' ? `y''+\\omega^{2}y=0` : `y''+\\frac{k}{m}\\,y=0,\\quad \\omega^{2}=\\frac{k}{m}=${w * w}`, note: variant === 'simple' ? 'Compara con la forma estándar y″ + ω²y = 0.' : 'Divide entre la masa para llegar a la forma estándar.' },
          { latex: `\\omega=\\sqrt{${w * w}}=${w}`, note: 'ω es la raíz cuadrada del coeficiente de y.' },
        ],
        distractors: numericDistractors(fr(w), compact([
          dFr(fr(w * w), 'Ese es ω²; te falta la raíz cuadrada.'),
          dFr(fr(2 * w), 'No hay factor 2: ω = √(coeficiente).'),
          dFr(safeFr(1, w), 'ω no es el recíproco; es la raíz del coeficiente.'),
        ])),
      };
    },
  },
];
