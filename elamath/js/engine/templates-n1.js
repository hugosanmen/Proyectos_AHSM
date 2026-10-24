// templates-n1.js — Nivel 1: Álgebra, Geometría Analítica y Cálculo Integral.
// Misma forma que templates.js. Las respuestas simbólicas añaden `vars: ['x']` (variables libres) para que
// las pruebas puedan compararlas numéricamente.

import { fr, safeFr, ansOf, num, dFr, compact, comb, terms, co, lin, TRIPLES, intNot, polyLatex, uniqueDistractors, numericDistractors } from './helpers.js';

export const templatesN1 = [
  // ═════════════ ÁLGEBRA ═════════════
  {
    id: 'alg-lineal',
    topic: 'Ecuaciones y sistemas',
    difficulty: 1,
    generate(rng) {
      const a = rng.nonZero(-9, 9);
      const c = intNot(rng, -9, 9, 0, a);
      const b = rng.int(-12, 12);
      const d = rng.int(-12, 12);
      const ans = fr(d - b, a - c);
      return {
        params: { a, b, c, d },
        statement: { text: 'Resuelve para x:', latex: `${terms([[a, 'x'], [b, '']])} = ${terms([[c, 'x'], [d, '']])}` },
        answer: ansOf(ans),
        steps: [
          { latex: `${terms([[a - c, 'x']])} = ${d - b}`, note: 'Junta las x de un lado y los números del otro (cambian de signo al cruzar el =).' },
          { latex: `x = \\frac{${d - b}}{${a - c}} = ${ans.toLatex()}`, note: 'Divide entre el coeficiente de x y simplifica.' },
        ],
        distractors: numericDistractors(ans, compact([
          dFr(fr(b - d, a - c), 'Al pasar los números al otro lado cambian de signo: te quedó el signo al revés.'),
          dFr(fr(d + b, a - c), 'Al pasar el término independiente debes restarlo, no sumarlo.'),
          dFr(safeFr(d - b, a + c), 'Las x se restan al juntarlas (a − c), no se suman.'),
        ])),
      };
    },
  },
  {
    id: 'alg-cuadratica',
    topic: 'Ecuaciones y sistemas',
    difficulty: 2,
    generate(rng) {
      const r = rng.int(-9, 9);
      const s = intNot(rng, -9, 9, r);
      const hi = Math.max(r, s);
      const lo = Math.min(r, s);
      const poly = polyLatex([r * s, -(r + s), 1]);
      return {
        params: { r, s },
        statement: { text: 'Resuelve la ecuación y da la raíz MAYOR:', latex: `${poly} = 0` },
        answer: ansOf(fr(hi)),
        steps: [
          { latex: `(${lin(r)})(${lin(s)}) = 0`, note: `Busca dos números que sumen ${r + s} y multipliquen ${r * s}: son ${-r} y ${-s} en los paréntesis.` },
          { latex: `x = ${r}\\quad\\text{o}\\quad x = ${s}`, note: 'Un producto es 0 solo si algún factor es 0.' },
          { latex: `x_{\\max} = ${hi}`, note: 'Te piden la mayor de las dos.' },
        ],
        distractors: numericDistractors(fr(hi), compact([
          dFr(fr(lo), 'Esa es la raíz menor; te piden la mayor.'),
          dFr(fr(-hi), 'Cuidado: (x − r) = 0 da x = +r, no −r.'),
          dFr(fr(r + s), 'Esa es la suma de las raíces, no una raíz.'),
          dFr(fr(r * s), 'Esa es el producto de las raíces, no una raíz.'),
        ])),
      };
    },
  },
  {
    id: 'alg-sistema',
    topic: 'Ecuaciones y sistemas',
    difficulty: 2,
    generate(rng) {
      const x0 = rng.int(-6, 6);
      const y0 = rng.int(-6, 6);
      let a, b, c, d;
      do {
        a = rng.nonZero(-5, 5);
        b = rng.nonZero(-5, 5);
        c = rng.nonZero(-5, 5);
        d = rng.nonZero(-5, 5);
      } while (a * d - b * c === 0);
      const e = a * x0 + b * y0;
      const f = c * x0 + d * y0;
      const det = a * d - b * c;
      return {
        params: { a, b, c, d, e, f },
        statement: { text: 'Resuelve el sistema y da el valor de x:', latex: `\\begin{cases} ${terms([[a, 'x'], [b, 'y']])} = ${e} \\\\ ${terms([[c, 'x'], [d, 'y']])} = ${f} \\end{cases}` },
        answer: ansOf(fr(x0)),
        steps: [
          { latex: `${d}(${terms([[a, 'x'], [b, 'y']])}) - ${num(b)}(${terms([[c, 'x'], [d, 'y']])}) = ${d}\\cdot ${num(e)} - ${num(b)}\\cdot ${num(f)}`, note: 'Elimina y: multiplica la ecuación 1 por d y la 2 por b, y réstalas.' },
          { latex: `${det}x = ${d * e - b * f}`, note: 'Se cancela la y y queda una ecuación con solo x.' },
          { latex: `x = ${x0}`, note: 'Divide entre el coeficiente de x.' },
        ],
        distractors: numericDistractors(fr(x0), compact([
          dFr(fr(y0), 'Ese es el valor de y; te pedían x.'),
          dFr(fr(-x0), 'Revisa el signo al dividir entre el determinante.'),
          dFr(fr(x0 + y0), 'Eso es x + y; te pedían solo x.'),
        ])),
      };
    },
  },
  {
    id: 'alg-log',
    topic: 'Exponentes y logaritmos',
    difficulty: 2,
    generate(rng) {
      const b = rng.pick([2, 3, 5, 10]);
      const variant = rng.pick(['potencia', 'inverso', 'producto']);
      let latex, ans, steps, specifics, p;
      if (variant === 'potencia') {
        const k = rng.int(2, 5);
        const N = b ** k;
        p = { b, variant, k };
        latex = `\\log_{${b}}(${N})`;
        ans = fr(k);
        steps = [
          { latex: `${N} = ${b}^{${k}}`, note: `Escribe ${N} como potencia de ${b}.` },
          { latex: `\\log_{${b}}(${b}^{${k}}) = ${k}`, note: 'log_b(b^k) = k: el logaritmo "deshace" la potencia.' },
        ];
        specifics = [dFr(fr(N), 'Ese es el número del argumento; el logaritmo pide el exponente.'), dFr(fr(b * k), 'No multipliques base y exponente: el logaritmo es solo el exponente.'), dFr(fr(k * k), 'Revisa: el resultado es el exponente tal cual.')];
      } else if (variant === 'inverso') {
        const k = rng.int(1, 4);
        const N = b ** k;
        p = { b, variant, k };
        latex = `\\log_{${b}}\\left(\\frac{1}{${N}}\\right)`;
        ans = fr(-k);
        steps = [
          { latex: `\\frac{1}{${N}} = ${b}^{-${k}}`, note: 'Un recíproco es la misma potencia con exponente negativo.' },
          { latex: `\\log_{${b}}(${b}^{-${k}}) = -${k}`, note: 'log_b(b^k) = k, aquí con k = −' + k + '.' },
        ];
        specifics = [dFr(fr(k), 'El argumento es menor que 1, así que el logaritmo sale negativo.'), dFr(fr(-1, k), 'No inviertas el exponente: el recíproco solo le cambia el signo.'), dFr(fr(-N), 'Ese es el número, no el exponente.')];
      } else {
        const m = rng.int(1, 4);
        const n = rng.int(1, 4);
        p = { b, variant, m, n };
        latex = `\\log_{${b}}(${b ** m}) + \\log_{${b}}(${b ** n})`;
        ans = fr(m + n);
        steps = [
          { latex: `\\log_{${b}}(${b ** m}) = ${m},\\quad \\log_{${b}}(${b ** n}) = ${n}`, note: 'Calcula cada logaritmo por separado.' },
          { latex: `${m} + ${n} = ${m + n}`, note: 'Y los sumas (también sale con log(AB) = log A + log B).' },
        ];
        specifics = [dFr(fr(m * n), 'Los logaritmos se SUMAN al multiplicar los argumentos; no se multiplican entre sí.'), dFr(fr(b ** m + b ** n), 'Esa es la suma de los argumentos, no de los logaritmos.')];
      }
      return { params: p, statement: { text: 'Calcula el valor de esta expresión:', latex }, answer: ansOf(ans), steps, distractors: numericDistractors(ans, compact(specifics)) };
    },
  },
  {
    id: 'alg-binomio',
    topic: 'Binomio de Newton',
    difficulty: 3,
    generate(rng) {
      const n = rng.int(3, 6);
      const k = rng.int(1, n - 1);
      const a = rng.nonZero(-3, 3);
      const coef = comb(n, k) * a ** (n - k);
      return {
        params: { n, k, a },
        statement: { text: `¿Cuál es el coeficiente de x^${k} en el desarrollo de este binomio?`, latex: `(${polyLatex([a, 1])})^{${n}}` },
        answer: ansOf(fr(coef)),
        steps: [
          { latex: `\\binom{${n}}{${k}}\\, x^{${k}}\\, (${a})^{${n - k}}`, note: 'El término con x^k es C(n,k) · x^k · a^(n−k).' },
          { latex: `${comb(n, k)}\\cdot ${num(a ** (n - k))} = ${coef}`, note: 'Calcula el combinatorio y la potencia de a, y multiplica.' },
        ],
        distractors: numericDistractors(fr(coef), compact([
          dFr(fr(comb(n, k)), 'Te faltó multiplicar por a elevado a (n − k).'),
          dFr(fr(a ** (n - k)), 'Te faltó el coeficiente combinatorio C(n, k).'),
          dFr(fr(comb(n, k) * a ** k), 'Intercambiaste los exponentes: a va elevado a (n − k), no a k.'),
        ])),
      };
    },
  },

  // ═════════════ GEOMETRÍA ANALÍTICA ═════════════
  {
    id: 'ga-distancia',
    topic: 'Rectas y distancias',
    difficulty: 1,
    generate(rng) {
      const [p, q, h] = rng.pick(TRIPLES.slice(0, 3));
      const m = rng.int(1, 3);
      const swap = rng.int(0, 1) === 1;
      const dx = (swap ? q : p) * m * rng.pick([-1, 1]);
      const dy = (swap ? p : q) * m * rng.pick([-1, 1]);
      const x1 = rng.int(-6, 6);
      const y1 = rng.int(-6, 6);
      const x2 = x1 + dx;
      const y2 = y1 + dy;
      const D = h * m;
      return {
        params: { x1, y1, x2, y2 },
        statement: { text: 'Calcula la distancia entre los puntos:', latex: `A(${x1},${y1}),\; B(${x2},${y2})` },
        answer: ansOf(fr(D)),
        steps: [
          { latex: `d=\\sqrt{(${num(x2)}-${num(x1)})^{2}+(${num(y2)}-${num(y1)})^{2}}`, note: 'Fórmula de distancia: Pitágoras con las diferencias en x y en y.' },
          { latex: `d=\\sqrt{${dx * dx}+${dy * dy}}=\\sqrt{${D * D}}=${D}`, note: 'Eleva al cuadrado, suma y saca la raíz.' },
        ],
        distractors: numericDistractors(fr(D), compact([
          dFr(fr(Math.abs(dx) + Math.abs(dy)), 'Sumaste los catetos; la distancia es la hipotenusa (con raíz).'),
          dFr(fr(D * D), 'Te faltó sacar la raíz cuadrada.'),
          dFr(fr(Math.max(Math.abs(dx), Math.abs(dy))), 'Solo tomaste la mayor diferencia; usa las dos.'),
        ])),
      };
    },
  },
  {
    id: 'ga-pendiente',
    topic: 'Rectas y distancias',
    difficulty: 1,
    generate(rng) {
      const x1 = rng.int(-8, 8);
      const x2 = intNot(rng, -8, 8, x1);
      const y1 = rng.int(-8, 8);
      const y2 = intNot(rng, -8, 8, y1);
      const m = fr(y2 - y1, x2 - x1);
      return {
        params: { x1, y1, x2, y2 },
        statement: { text: 'Calcula la pendiente de la recta que pasa por los puntos:', latex: `P(${x1},${y1}),\; Q(${x2},${y2})` },
        answer: ansOf(m),
        steps: [
          { latex: `m=\\frac{y_2-y_1}{x_2-x_1}=\\frac{${num(y2)}-${num(y1)}}{${num(x2)}-${num(x1)}}`, note: 'Cambio en y entre cambio en x (en el mismo orden arriba y abajo).' },
          { latex: `m=${m.toLatex()}`, note: 'Simplifica.' },
        ],
        distractors: numericDistractors(m, compact([
          dFr(safeFr(x2 - x1, y2 - y1), 'Invertiste la razón: es Δy/Δx, no Δx/Δy.'),
          dFr(fr(y1 - y2, x2 - x1), 'Restaste las y en un orden y las x en el otro: sale con el signo cambiado.'),
          dFr(safeFr(y2 + y1, x2 + x1), 'Son restas (diferencias), no sumas.'),
        ])),
      };
    },
  },
  {
    id: 'ga-dist-punto-recta',
    topic: 'Rectas y distancias',
    difficulty: 3,
    generate(rng) {
      const [A0, B0, N] = rng.pick([[3, 4, 5], [4, 3, 5], [5, 12, 13], [12, 5, 13], [8, 15, 17]]);
      const A = A0 * rng.pick([-1, 1]);
      const B = B0 * rng.pick([-1, 1]);
      const x0 = rng.int(-5, 5);
      const y0 = rng.int(-5, 5);
      const n = rng.int(1, 6);
      const s = rng.pick([-1, 1]);
      const C = s * n * N - A * x0 - B * y0;
      const numer = Math.abs(A * x0 + B * y0 + C);
      return {
        params: { A, B, C, x0, y0 },
        statement: { text: 'Calcula la distancia del punto a la recta:', latex: `P(${x0},${y0}),\\quad ${terms([[A, 'x'], [B, 'y'], [C, '']])} = 0` },
        answer: ansOf(fr(n)),
        steps: [
          { latex: `d=\\frac{|Ax_0+By_0+C|}{\\sqrt{A^{2}+B^{2}}}=\\frac{|${num(A)}(${x0})+${num(B)}(${y0})+${num(C)}|}{\\sqrt{${A * A}+${B * B}}}`, note: 'Fórmula de distancia punto–recta.' },
          { latex: `d=\\frac{${numer}}{${N}}=${n}`, note: `El denominador es √${A * A + B * B} = ${N}.` },
        ],
        distractors: numericDistractors(fr(n), compact([
          dFr(fr(numer), 'Te faltó dividir entre √(A² + B²).'),
          dFr(fr(numer, N * N), 'Dividiste entre A² + B² sin sacar la raíz.'),
          dFr(fr(s * n), 'Una distancia nunca es negativa: usa el valor absoluto del numerador.'),
        ])),
      };
    },
  },
  {
    id: 'ga-circulo',
    topic: 'Cónicas',
    difficulty: 2,
    generate(rng) {
      const h = rng.int(-6, 6);
      const k = rng.int(-6, 6);
      const r = rng.int(1, 9);
      const c = h * h + k * k - r * r;
      return {
        params: { h, k, r },
        statement: { text: 'La ecuación describe una circunferencia. ¿Cuál es su radio?', latex: `${terms([[1, 'x^{2}'], [1, 'y^{2}'], [-2 * h, 'x'], [-2 * k, 'y'], [c, '']])} = 0` },
        answer: ansOf(fr(r)),
        steps: [
          { latex: `(${lin(h)})^{2}+(${lin(k, 'y')})^{2} = ${h * h + k * k - c}`, note: 'Completa cuadrados en x y en y (suma h² y k² a ambos lados).' },
          { latex: `r^{2}=${r * r}\;\\Rightarrow\; r=${r}`, note: 'El lado derecho es r²: saca la raíz.' },
        ],
        distractors: numericDistractors(fr(r), compact([
          dFr(fr(r * r), 'Ese es r², te falta la raíz cuadrada.'),
          dFr(fr(Math.abs(c)), 'El término independiente no es el radio; completa cuadrados.'),
          dFr(safeFr(h * h + k * k, 1) && fr(h * h + k * k), 'Eso es h² + k²; el radio sale de h² + k² − c.'),
        ])),
      };
    },
  },
  {
    id: 'ga-parabola',
    topic: 'Cónicas',
    difficulty: 2,
    generate(rng) {
      const p = rng.nonZero(-9, 9);
      return {
        params: { p },
        statement: { text: 'Para esta parábola con vértice en el origen, ¿cuál es la abscisa (coordenada x) de su foco?', latex: `y^{2} = ${4 * p}x` },
        answer: ansOf(fr(p)),
        steps: [
          { latex: `y^{2}=4px \;\\Rightarrow\; 4p=${4 * p}`, note: 'Compara con la forma estándar y² = 4px.' },
          { latex: `p=${p}\;\\Rightarrow\; F(${p},0)`, note: 'El foco está en (p, 0).' },
        ],
        distractors: numericDistractors(fr(p), compact([
          dFr(fr(4 * p), 'Ese es 4p, el coeficiente; el foco está en p.'),
          dFr(fr(2 * p), 'No dupliques: 4p = coeficiente, así que p = coeficiente/4.'),
          dFr(fr(-p), 'El signo de p es el del coeficiente: la parábola abre hacia ese lado.'),
        ])),
      };
    },
  },

  // ═════════════ CÁLCULO INTEGRAL ═════════════
  {
    id: 'int-potencia',
    topic: 'Integral indefinida',
    difficulty: 2,
    generate(rng) {
      const n = rng.int(1, 4);
      const m = intNot(rng, 0, 3, n);
      const al = rng.nonZero(-4, 4);
      const be = rng.nonZero(-4, 4);
      const integrand = [];
      integrand[n] = al * (n + 1);
      integrand[m] = be * (m + 1);
      const F = [];
      F[n + 1] = al;
      F[m + 1] = be;
      const fill = (arr, len) => Array.from({ length: len }, (_, i) => arr[i] ?? 0);
      const answerLatex = `${polyLatex(fill(F, Math.max(n, m) + 2))} + C`;
      const dist = fill(integrand, Math.max(n, m) + 2).map((c, i) => c * i).slice(1); // derivada del integrando
      const noDiv = [];
      noDiv[n + 1] = al * (n + 1);
      noDiv[m + 1] = be * (m + 1);
      const onlyFirst = [];
      onlyFirst[n + 1] = al;
      const expr = polyLatex(fill(integrand, Math.max(n, m) + 1));
      return {
        params: { n, m, al, be },
        expr,
        vars: ['x'],
        statement: { text: 'Calcula la integral indefinida:', latex: `\\int \\left(${expr}\\right)\\,dx` },
        answer: { latex: answerLatex },
        steps: [
          { latex: `\\int x^{k}\\,dx=\\frac{x^{k+1}}{k+1}`, note: 'Regla de la potencia: sube el exponente en 1 y divide entre el nuevo exponente.' },
          { latex: answerLatex, note: 'Aplícala a cada término y no olvides la constante +C.' },
        ],
        distractors: uniqueDistractors(answerLatex, [
          { latex: `${polyLatex(fill(noDiv, Math.max(n, m) + 2))} + C`, feedback: 'Subiste el exponente pero olvidaste dividir entre el nuevo exponente.' },
          { latex: `${polyLatex(fill(dist, Math.max(n, m) + 1))} + C`, feedback: 'Derivaste en vez de integrar: aquí el exponente SUBE.' },
          { latex: `${polyLatex(fill(onlyFirst, n + 2))} + C`, feedback: 'Integraste solo un término; hay que integrar cada uno.' },
          { latex: `${polyLatex(fill(F, Math.max(n, m) + 2).map((c) => -c))} + C`, feedback: 'Al integrar no cambian los signos.' },
        ]),
      };
    },
  },
  {
    id: 'int-definida',
    topic: 'Integral definida',
    difficulty: 3,
    generate(rng) {
      const ga = rng.nonZero(-3, 3);
      const de = rng.int(-4, 4);
      const e = rng.int(-6, 6);
      const lo = rng.int(-3, 2);
      const hi = rng.int(lo + 1, lo + 4);
      const F = (x) => ga * x ** 3 + de * x ** 2 + e * x;
      const f = (x) => 3 * ga * x * x + 2 * de * x + e;
      const expr = polyLatex([e, 2 * de, 3 * ga]);
      const val = F(hi) - F(lo);
      return {
        params: { ga, de, e, lo, hi },
        expr,
        statement: { text: 'Calcula la integral definida:', latex: `\\int_{${lo}}^{${hi}} \\left(${expr}\\right)\\,dx` },
        answer: ansOf(fr(val)),
        steps: [
          { latex: `F(x)=${polyLatex([0, e, de, ga])}`, note: 'Encuentra una antiderivada término por término.' },
          { latex: `F(${hi})-F(${lo})=${F(hi)}-${num(F(lo))}=${val}`, note: 'Teorema fundamental: evalúa en el límite superior y resta el inferior.' },
        ],
        distractors: numericDistractors(fr(val), compact([
          dFr(fr(F(hi)), 'Te faltó restar F en el límite inferior.'),
          dFr(fr(F(lo) - F(hi)), 'Restaste al revés: es F(superior) − F(inferior).'),
          dFr(fr(f(hi) - f(lo)), 'Evaluaste el integrando, no la antiderivada.'),
        ])),
      };
    },
  },
  {
    id: 'int-sustitucion',
    topic: 'Integral indefinida',
    difficulty: 3,
    generate(rng) {
      const n = rng.int(2, 3);
      const c = rng.nonZero(-5, 5);
      const m = rng.int(2, 5);
      const inner = polyLatex(n === 2 ? [c, 0, 1] : [c, 0, 0, 1]);
      const du = n === 2 ? '2x' : '3x^{2}';
      const answerLatex = `\\frac{(${inner})^{${m + 1}}}{${m + 1}} + C`;
      return {
        params: { n, c, m },
        expr: `${du}(${inner})^{${m}}`,
        vars: ['x'],
        statement: { text: 'Calcula con sustitución:', latex: `\\int ${du}\\,(${inner})^{${m}}\\,dx` },
        answer: { latex: answerLatex },
        steps: [
          { latex: `u=${inner},\\quad du=${du}\\,dx`, note: 'Elige u como lo de adentro; su derivada ya aparece multiplicando.' },
          { latex: `\\int u^{${m}}\\,du=\\frac{u^{${m + 1}}}{${m + 1}}+C`, note: 'Ahora es una integral de potencia sencilla.' },
          { latex: answerLatex, note: 'Regresa a x sustituyendo u.' },
        ],
        distractors: uniqueDistractors(answerLatex, [
          { latex: `(${inner})^{${m + 1}} + C`, feedback: 'Subiste el exponente pero faltó dividir entre m + 1.' },
          { latex: `\\frac{(${inner})^{${m}}}{${m}} + C`, feedback: 'El exponente debe subir en 1 antes de dividir.' },
          { latex: `\\frac{(${inner})^{${m + 1}}}{${n * (m + 1)}} + C`, feedback: 'Dividiste otra vez entre n: la du ya estaba en el integrando.' },
        ]),
      };
    },
  },
  {
    id: 'int-exp-trig',
    topic: 'Integral indefinida',
    difficulty: 3,
    generate(rng) {
      const variant = rng.pick(['exp', 'cos', 'sin']);
      const k = rng.int(2, 6);
      const al = rng.nonZero(-4, 4);
      let integrand, answerLatex, distractors;
      const kx = `${k}x`;
      if (variant === 'exp') {
        integrand = co(k * al, `e^{${kx}}`);
        answerLatex = `${co(al, `e^{${kx}}`)} + C`;
        distractors = [
          { latex: `${integrand} + C`, feedback: 'Te faltó dividir entre k: ∫e^{kx}dx = e^{kx}/k.' },
          { latex: `${co(k * k * al, `e^{${kx}}`)} + C`, feedback: 'Multiplicaste por k en vez de dividir (eso es derivar).' },
          { latex: `${co(-al, `e^{${kx}}`)} + C`, feedback: 'La exponencial no cambia de signo al integrar.' },
        ];
      } else if (variant === 'cos') {
        integrand = co(k * al, `\\cos(${kx})`);
        answerLatex = `${co(al, `\\sin(${kx})`)} + C`;
        distractors = [
          { latex: `${co(k * al, `\\sin(${kx})`)} + C`, feedback: 'Te faltó dividir entre k por la regla de la cadena inversa.' },
          { latex: `${co(-al, `\\sin(${kx})`)} + C`, feedback: 'La integral de coseno es +seno (el signo menos aparece en la derivada).' },
          { latex: `${co(al, `\\cos(${kx})`)} + C`, feedback: 'La integral de coseno es seno, no coseno.' },
        ];
      } else {
        integrand = co(k * al, `\\sin(${kx})`);
        answerLatex = `${co(-al, `\\cos(${kx})`)} + C`;
        distractors = [
          { latex: `${co(al, `\\cos(${kx})`)} + C`, feedback: 'La integral de seno lleva signo menos: −cos.' },
          { latex: `${co(-k * al, `\\cos(${kx})`)} + C`, feedback: 'Te faltó dividir entre k.' },
          { latex: `${co(-al, `\\sin(${kx})`)} + C`, feedback: 'La integral de seno es −coseno, no seno.' },
        ];
      }
      return {
        params: { variant, k, al },
        expr: integrand,
        vars: ['x'],
        statement: { text: 'Calcula la integral indefinida:', latex: `\\int ${integrand}\\,dx` },
        answer: { latex: answerLatex },
        steps: [
          { latex: `u=${kx},\; du=${k}\\,dx`, note: 'Cambio de variable lineal: ∫f(kx)dx = (1/k)∫f(u)du.' },
          { latex: answerLatex, note: 'Integra la función básica, divide entre k y agrega +C.' },
        ],
        distractors: uniqueDistractors(answerLatex, distractors),
      };
    },
  },
];
