// templates.js — plantillas paramétricas de Cálculo Diferencial (Nivel 1)
//
// Cada plantilla expone:
//   id, topic, difficulty
//   generate(rng) → {
//     params,                      // parámetros aleatorios usados (para auditar y probar)
//     statement: { text, latex },  // enunciado
//     expr,                        // (opcional) función del enunciado en LaTeX, verificable por las pruebas
//     answer: { latex, ... },      // respuesta exacta calculada por código
//     steps: [{ latex, note }],    // paso a paso básico (tono de compañero)
//     distractors: [{ latex, feedback }]  // 3 errores típicos con su explicación
//   }

import { Fraction, polyLatex, uniqueDistractors, numericDistractors } from './utils.js';

const fr = (n, d = 1) => new Fraction(n, d);
/** (x - c) en LaTeX */
const lin = (c) => polyLatex([-c, 1]);
/** Número entre paréntesis si es negativo, para sustituir sin ambigüedad. */
const num = (n) => (n < 0 ? `(${n})` : `${n}`);

export const templates = [
  // 1 ──────────────────────────────────────────────────────────────
  {
    id: 'lim-factorizacion',
    topic: 'Límites',
    difficulty: 2,
    generate(rng) {
      const a = rng.int(-9, 9);
      let r;
      do {
        r = rng.int(-9, 9);
      } while (r === a);
      const expr = `\\frac{${polyLatex([a * r, -(a + r), 1])}}{${lin(a)}}`;
      const ans = fr(a - r);
      return {
        params: { a, r },
        statement: { text: 'Calcula el límite:', latex: `\\lim_{x\\to ${a}} ${expr}` },
        expr,
        answer: { latex: ans.toLatex(), value: ans.value },
        steps: [
          {
            latex: `\\frac{(${lin(a)})(${lin(r)})}{${lin(a)}}`,
            note: 'Si sustituyes directo te queda 0/0. Mejor factoriza el numerador.',
          },
          {
            latex: lin(r),
            note: `Cancela (${lin(a)}): se vale porque x se acerca a ${a} pero nunca es ${a}.`,
          },
          { latex: `${num(a)} - ${num(r)} = ${a - r}`, note: 'Ahora sí, sustituye.' },
        ],
        distractors: numericDistractors(ans, [
          { latex: fr(a + r).toLatex(), feedback: 'Cuidado con el signo: el otro factor es (x − r), no (x + r).' },
          { latex: fr(r - a).toLatex(), feedback: 'Revisa el orden de la resta al sustituir.' },
          { latex: fr(0).toLatex(), feedback: '0/0 es una indeterminación, no el valor del límite.' },
        ]),
      };
    },
  },

  // 2 ──────────────────────────────────────────────────────────────
  {
    id: 'lim-trigonometrico',
    topic: 'Límites',
    difficulty: 2,
    generate(rng) {
      const k = rng.int(2, 9);
      const m = rng.int(1, 9);
      const den = m === 1 ? 'x' : `${m}x`;
      const expr = `\\frac{\\sin(${k}x)}{${den}}`;
      const ans = fr(k, m);
      return {
        params: { k, m },
        statement: { text: 'Calcula el límite:', latex: `\\lim_{x\\to 0} ${expr}` },
        expr,
        answer: { latex: ans.toLatex(), value: ans.value },
        steps: [
          {
            latex: `${expr} = \\frac{${k}}{${m}}\\cdot\\frac{\\sin(${k}x)}{${k}x}`,
            note: 'Acomoda la expresión para que aparezca el límite notable sen(u)/u.',
          },
          {
            latex: '\\lim_{u\\to 0}\\frac{\\sin u}{u}=1',
            note: `Aquí u = ${k}x, y u → 0 cuando x → 0.`,
          },
          { latex: `\\frac{${k}}{${m}}\\cdot 1 = ${ans.toLatex()}`, note: 'Y listo, simplifica si se puede.' },
        ],
        distractors: numericDistractors(ans, [
          { latex: fr(m, k).toLatex(), feedback: 'Invertiste la razón: es k/m, no m/k.' },
          { latex: fr(k).toLatex(), feedback: 'Te faltó dividir entre el número que acompaña a x en el denominador.' },
          { latex: fr(1).toLatex(), feedback: 'sen(u)/u → 1 solo cuando u es exactamente el denominador; aquí hay que ajustar con k/m.' },
          { latex: fr(k * m).toLatex(), feedback: 'Multiplicaste en lugar de dividir.' },
        ]),
      };
    },
  },

  // 3 ──────────────────────────────────────────────────────────────
  {
    id: 'lim-infinito',
    topic: 'Límites',
    difficulty: 2,
    generate(rng) {
      const a = rng.int(1, 9);
      const d = rng.int(1, 9);
      const b = rng.int(-9, 9);
      const c = rng.int(-9, 9);
      const e = rng.int(1, 9);
      const expr = `\\frac{${polyLatex([c, b, a])}}{${polyLatex([e, 0, d])}}`;
      const ans = fr(a, d);
      return {
        params: { a, b, c, d, e },
        statement: { text: 'Calcula el límite:', latex: `\\lim_{x\\to\\infty} ${expr}` },
        expr,
        answer: { latex: ans.toLatex(), value: ans.value },
        steps: [
          {
            latex: `\\frac{${a} + \\frac{${b}}{x} + \\frac{${c}}{x^{2}}}{${d} + \\frac{${e}}{x^{2}}}`,
            note: 'Divide numerador y denominador entre la mayor potencia de x (aquí x²).',
          },
          {
            latex: `\\frac{${a} + 0 + 0}{${d} + 0} = ${ans.toLatex()}`,
            note: 'Cuando x es enorme, los términos con x en el denominador se vuelven despreciables.',
          },
        ],
        distractors: numericDistractors(ans, [
          { latex: fr(a).toLatex(), feedback: 'Olvidaste dividir entre el coeficiente de x² del denominador.' },
          { latex: fr(d, a).toLatex(), feedback: 'Invertiste la razón de coeficientes.' },
          { latex: '\\infty', feedback: 'Los grados son iguales, así que el límite es finito: compara coeficientes líderes.' },
          { latex: fr(0).toLatex(), feedback: 'Eso pasaría si el grado del denominador fuera mayor; aquí son iguales.' },
        ]),
      };
    },
  },

  // 4 ──────────────────────────────────────────────────────────────
  {
    id: 'derivada-cadena',
    topic: 'Derivadas',
    difficulty: 2,
    generate(rng) {
      const outer = rng.pick(['sin', 'cos', 'exp', 'ln']);
      const n = rng.pick([2, 3]);
      const a = rng.int(1, 4);
      const b = rng.int(1, 9);
      const u = polyLatex([b, ...Array(n - 1).fill(0), a]);
      const du = polyLatex([...Array(n - 1).fill(0), n * a]);
      const forms = {
        sin: {
          f: `\\sin(${u})`,
          d: `${du}\\cos(${u})`,
          wrong: [
            { latex: `\\cos(${u})`, feedback: 'Te faltó multiplicar por la derivada de lo de adentro (regla de la cadena).' },
            { latex: `-${du}\\cos(${u})`, feedback: 'El signo está mal: la derivada de seno es +coseno.' },
            { latex: `${du}\\sin(${u})`, feedback: 'La derivada de seno es coseno, no seno.' },
          ],
        },
        cos: {
          f: `\\cos(${u})`,
          d: `-${du}\\sin(${u})`,
          wrong: [
            { latex: `-\\sin(${u})`, feedback: 'Te faltó multiplicar por la derivada de lo de adentro (regla de la cadena).' },
            { latex: `${du}\\sin(${u})`, feedback: 'Se te fue el signo: la derivada de coseno es −seno.' },
            { latex: `-${du}\\cos(${u})`, feedback: 'La derivada de coseno es −seno, no −coseno.' },
          ],
        },
        exp: {
          f: `e^{${u}}`,
          d: `${du}\\cdot e^{${u}}`,
          wrong: [
            { latex: `e^{${u}}`, feedback: 'Te faltó multiplicar por la derivada del exponente (regla de la cadena).' },
            { latex: `(${u})e^{${u}-1}`, feedback: 'Esa es la regla de potencia; aquí la variable está en el exponente.' },
            { latex: `${du}\\cdot e^{${du}}`, feedback: 'El exponente no se deriva dentro de e: se queda igual y se multiplica por su derivada.' },
          ],
        },
        ln: {
          f: `\\ln(${u})`,
          d: `\\frac{${du}}{${u}}`,
          wrong: [
            { latex: `\\frac{1}{${u}}`, feedback: 'Te faltó multiplicar por la derivada de lo de adentro (regla de la cadena).' },
            { latex: `\\frac{${u}}{${du}}`, feedback: 'Invertiste la fracción: u′ va arriba y u abajo.' },
            { latex: `${du}\\ln(${u})`, feedback: 'La derivada de ln(u) es u′/u, no u′·ln(u).' },
          ],
        },
      };
      const form = forms[outer];
      return {
        params: { outer, n, a, b },
        statement: { text: 'Deriva la función:', latex: `f(x)=${form.f}` },
        expr: form.f,
        answer: { latex: form.d },
        steps: [
          { latex: `u = ${u}`, note: 'Identifica la función de afuera y la de adentro.' },
          { latex: `u' = ${du}`, note: 'Deriva lo de adentro.' },
          { latex: `f'(x) = ${form.d}`, note: 'Derivada de afuera evaluada en u, por la derivada de adentro.' },
        ],
        distractors: uniqueDistractors(form.d, form.wrong),
      };
    },
  },

  // 5 ──────────────────────────────────────────────────────────────
  {
    id: 'derivada-cociente',
    topic: 'Derivadas',
    difficulty: 3,
    generate(rng) {
      const p = rng.int(1, 5);
      const q = rng.nonZero(-9, 9);
      const r = rng.nonZero(-9, 9);
      const numL = polyLatex([q, 0, p]);
      const denL = polyLatex([r, 1]);
      const expr = `\\frac{${numL}}{${denL}}`;
      const dNum = polyLatex([-q, 2 * p * r, p]);
      const answerLatex = `\\frac{${dNum}}{(${denL})^{2}}`;
      return {
        params: { p, q, r },
        statement: { text: 'Deriva la función:', latex: `f(x)=${expr}` },
        expr,
        answer: { latex: answerLatex },
        steps: [
          {
            latex: `f'(x)=\\frac{(${polyLatex([0, 2 * p])})(${denL}) - (${numL})(1)}{(${denL})^{2}}`,
            note: 'Regla del cociente: (arriba′·abajo − arriba·abajo′) entre abajo al cuadrado.',
          },
          { latex: `f'(x)=${answerLatex}`, note: 'Desarrolla el numerador y reduce términos semejantes.' },
        ],
        distractors: uniqueDistractors(answerLatex, [
          {
            latex: `\\frac{${polyLatex([q, 2 * p * r, 3 * p])}}{(${denL})^{2}}`,
            feedback: 'En la regla del cociente va una resta: f′g − fg′, no una suma.',
          },
          { latex: `\\frac{${dNum}}{${denL}}`, feedback: 'El denominador se eleva al cuadrado.' },
          {
            latex: `\\frac{${polyLatex([0, 2 * p])}}{${denL}}`,
            feedback: 'Derivar arriba y dividir entre abajo no funciona; usa la regla del cociente completa.',
          },
          { latex: `\\frac{${polyLatex([-q, 0, p])}}{(${denL})^{2}}`, feedback: 'Te faltó el término que viene de 2x·(x + r).' },
        ]),
      };
    },
  },

  // 6 ──────────────────────────────────────────────────────────────
  {
    id: 'derivada-implicita',
    topic: 'Derivadas',
    difficulty: 3,
    generate(rng) {
      const TRIPLES = [
        [3, 4, 5], [4, 3, 5], [6, 8, 10], [8, 6, 10], [5, 12, 13], [12, 5, 13],
        [8, 15, 17], [15, 8, 17], [9, 12, 15], [12, 9, 15], [7, 24, 25], [24, 7, 25],
      ];
      const [ax, ay, R] = rng.pick(TRIPLES);
      const x0 = ax * rng.pick([-1, 1]);
      const y0 = ay * rng.pick([-1, 1]);
      const ans = fr(-x0, y0);
      const expr = 'x^{2}+y^{2}';
      return {
        params: { x0, y0, R },
        statement: {
          text: `Con derivación implícita, calcula dy/dx y evalúala en el punto (${x0}, ${y0}):`,
          latex: `${expr}=${R * R}`,
        },
        expr,
        answer: { latex: ans.toLatex(), value: ans.value, general: '-\\frac{x}{y}' },
        steps: [
          { latex: "2x + 2y\\,y' = 0", note: 'Deriva ambos lados respecto a x; ojo: y depende de x, así que sale y′.' },
          { latex: "y' = -\\frac{x}{y}", note: 'Despeja y′.' },
          { latex: `-\\frac{${num(x0)}}{${num(y0)}} = ${ans.toLatex()}`, note: 'Sustituye el punto.' },
        ],
        distractors: numericDistractors(ans, [
          { latex: fr(x0, y0).toLatex(), feedback: 'Se te perdió el signo menos al despejar y′.' },
          { latex: fr(y0, x0).toLatex(), feedback: 'Invertiste la razón: es −x/y.' },
          { latex: fr(-y0, x0).toLatex(), feedback: 'Invertiste la razón: es −x/y, no −y/x.' },
        ]),
      };
    },
  },

  // 7 ──────────────────────────────────────────────────────────────
  {
    id: 'extremos-cubica',
    topic: 'Aplicaciones de la derivada',
    difficulty: 3,
    generate(rng) {
      let p, q;
      do {
        p = rng.int(-6, 6);
        q = rng.int(-6, 8);
      } while (q - p < 2 || (q - p) % 2 !== 0);
      const m = (p + q) / 2;
      const c = rng.int(-9, 9);
      const coefs = [c, 3 * p * q, -3 * m, 1];
      const f = (x) => coefs.reduce((acc, co, i) => acc + co * x ** i, 0);
      const yp = f(p);
      const yq = f(q);
      const expr = polyLatex(coefs);
      const label = (x, kind) => `x=${x}\\ \\text{(${kind})}`;
      const answerLatex = `${label(p, 'máximo')},\\quad ${label(q, 'mínimo')}`;
      return {
        params: { p, q, c },
        statement: { text: 'Encuentra los máximos y mínimos locales de:', latex: `f(x)=${expr}` },
        expr,
        answer: { latex: answerLatex, max: { x: p, y: yp }, min: { x: q, y: yq } },
        steps: [
          {
            latex: `f'(x)=${polyLatex([3 * p * q, -6 * m, 3])}=3(${lin(p)})(${lin(q)})`,
            note: 'Deriva y factoriza para ver dónde se anula.',
          },
          { latex: `x=${p},\\quad x=${q}`, note: 'Estos son los puntos críticos.' },
          {
            latex: `f''(x)=${polyLatex([-6 * m, 6])}:\\ f''(${p})=${6 * p - 6 * m}<0,\\ f''(${q})=${6 * q - 6 * m}>0`,
            note: 'Segunda derivada: negativa → máximo, positiva → mínimo.',
          },
          { latex: `f(${p})=${yp},\\quad f(${q})=${yq}`, note: 'Evalúa para dar los valores.' },
        ],
        distractors: uniqueDistractors(answerLatex, [
          {
            latex: `${label(p, 'mínimo')},\\quad ${label(q, 'máximo')}`,
            feedback: 'Invertiste el criterio de la segunda derivada: f″ < 0 es máximo.',
          },
          {
            latex: `${label(m, 'máximo')},\\quad ${label(q, 'mínimo')}`,
            feedback: 'x = (p+q)/2 es el punto de inflexión (f″ = 0), no un extremo.',
          },
          {
            latex: `${label(-p, 'máximo')},\\quad ${label(-q, 'mínimo')}`,
            feedback: 'Cuidado con el signo al resolver (x − p) = 0: la raíz es +p.',
          },
          {
            latex: '\\text{No tiene extremos locales}',
            feedback: 'Una cúbica sí tiene extremos cuando f′ tiene dos raíces reales distintas.',
          },
        ]),
      };
    },
  },

  // 8 ──────────────────────────────────────────────────────────────
  {
    id: 'optimizacion-area',
    topic: 'Aplicaciones de la derivada',
    difficulty: 3,
    generate(rng) {
      const variant = rng.pick(['perimetro', 'pared']);
      const k = rng.int(5, 40);
      const fmt = (w, l, area) => `${w}\\times ${l}\\ \\text{m},\\quad A=${area}\\ \\text{m}^{2}`;
      if (variant === 'perimetro') {
        const answerLatex = fmt(k, k, k * k);
        return {
          params: { variant, k },
          statement: {
            text: `Con ${4 * k} m de cerca se quiere encerrar un terreno rectangular. ¿Qué dimensiones dan el área máxima y cuál es esa área?`,
            latex: '',
          },
          answer: { latex: answerLatex, dims: [k, k], area: k * k },
          steps: [
            { latex: `2x+2y=${4 * k}\\Rightarrow y=${2 * k}-x`, note: 'Usa el perímetro para dejar todo en una variable.' },
            { latex: `A(x)=x(${2 * k}-x)`, note: 'Área = base por altura.' },
            { latex: `A'(x)=${2 * k}-2x=0\\Rightarrow x=${k}`, note: 'Deriva e iguala a cero.' },
            { latex: `A''(x)=-2<0,\\quad y=${k}`, note: 'Segunda derivada negativa: es un máximo. Y sale un cuadrado.' },
          ],
          distractors: uniqueDistractors(answerLatex, [
            { latex: fmt(2 * k, 2 * k, 4 * k * k), feedback: 'Usaste el perímetro completo como si fuera el semiperímetro: cada lado mide P/4.' },
            { latex: fmt(k - 1, k + 1, k * k - 1), feedback: 'Ese rectángulo usa toda la cerca, pero no es el de área máxima.' },
            { latex: fmt(k, k, 4 * k), feedback: 'Confundiste el área con el perímetro.' },
          ]),
        };
      }
      const answerLatex = fmt(k, 2 * k, 2 * k * k);
      return {
        params: { variant, k },
        statement: {
          text: `Con ${4 * k} m de cerca se quiere cercar un terreno rectangular junto a un muro (el muro no necesita cerca). ¿Qué dimensiones dan el área máxima y cuál es esa área? Escribe primero el lado perpendicular al muro.`,
          latex: '',
        },
        answer: { latex: answerLatex, dims: [k, 2 * k], area: 2 * k * k },
        steps: [
          { latex: `2x+y=${4 * k}\\Rightarrow y=${4 * k}-2x`, note: 'Solo hay tres lados con cerca: dos perpendiculares (x) y uno paralelo (y).' },
          { latex: `A(x)=x(${4 * k}-2x)`, note: 'Área = base por altura.' },
          { latex: `A'(x)=${4 * k}-4x=0\\Rightarrow x=${k}`, note: 'Deriva e iguala a cero.' },
          { latex: `y=${2 * k},\\quad A=${2 * k * k}`, note: 'Segunda derivada negativa: es máximo.' },
        ],
        distractors: uniqueDistractors(answerLatex, [
          { latex: fmt(k, k, k * k), feedback: 'No es un cuadrado: solo hay tres lados con cerca.' },
          { latex: fmt(2 * k, k, 2 * k * k), feedback: 'Revisa la restricción 2x + y = L: con x = 2k no queda cerca para el lado paralelo.' },
          { latex: fmt(k + 1, 2 * k - 2, (k + 1) * (2 * k - 2)), feedback: 'Cumple la restricción, pero no maximiza el área.' },
        ]),
      };
    },
  },

  // 9 ──────────────────────────────────────────────────────────────
  {
    id: 'razones-relacionadas',
    topic: 'Aplicaciones de la derivada',
    difficulty: 3,
    generate(rng) {
      const TRIPLES = [
        [5, 3, 4], [5, 4, 3], [13, 5, 12], [13, 12, 5], [10, 6, 8], [10, 8, 6],
        [15, 9, 12], [17, 8, 15], [17, 15, 8], [25, 7, 24], [25, 15, 20], [25, 20, 15],
      ];
      const [L, b, h] = rng.pick(TRIPLES);
      const v = rng.int(1, 4);
      const ans = fr(-b * v, h);
      return {
        params: { L, b, h, v },
        statement: {
          text: `Una escalera de ${L} m está apoyada en una pared. La base se aleja de la pared a ${v} m/s. ¿Qué tan rápido cambia la altura de la parte superior (dy/dt, en m/s) en el instante en que la base está a ${b} m de la pared?`,
          latex: '',
        },
        answer: { latex: ans.toLatex(), value: ans.value, unit: 'm/s' },
        steps: [
          { latex: `x^{2}+y^{2}=${L * L}`, note: 'Pitágoras: x es la base, y es la altura.' },
          { latex: "2x\\,x' + 2y\\,y' = 0 \\Rightarrow y' = -\\frac{x}{y}\\,x'", note: 'Deriva respecto al tiempo y despeja y′.' },
          { latex: `y=\\sqrt{${L * L}-${b * b}}=${h}`, note: 'Saca la altura en ese instante.' },
          { latex: `y'=-\\frac{${b}}{${h}}(${v})=${ans.toLatex()}`, note: 'El signo negativo dice que la parte superior baja.' },
        ],
        distractors: numericDistractors(ans, [
          { latex: fr(b * v, h).toLatex(), feedback: 'El signo: la altura disminuye, así que dy/dt es negativa.' },
          { latex: fr(-h * v, b).toLatex(), feedback: 'Invertiste x/y: es base entre altura.' },
          { latex: fr(-v).toLatex(), feedback: 'La altura no baja a la misma velocidad que se aleja la base; hay que usar x/y.' },
        ]),
      };
    },
  },

  // 10 ─────────────────────────────────────────────────────────────
  {
    id: 'derivada-logaritmica',
    topic: 'Derivadas',
    difficulty: 4,
    generate(rng) {
      // f(x) = x^g(x) con g(x) = kx, x^k o sen(kx). `k` es el parámetro propio de cada variante.
      const variant = rng.pick(['lineal', 'potencia', 'seno']);
      let k, g, gp, answerLatex;
      if (variant === 'lineal') {
        k = rng.int(1, 6);
        g = k === 1 ? 'x' : `${k}x`;
        gp = String(k);
        answerLatex = `x^{${g}}\\cdot ${k === 1 ? '' : k}(\\ln x+1)`;
      } else if (variant === 'potencia') {
        k = rng.int(2, 3);
        g = `x^{${k}}`;
        gp = k === 2 ? '2x' : `${k}x^{${k - 1}}`;
        const gx = k === 2 ? 'x' : `x^{${k - 1}}`; // g(x)/x
        answerLatex = `x^{${g}}\\cdot(${gp}\\ln x+${gx})`;
      } else {
        k = rng.int(1, 4);
        g = k === 1 ? '\\sin x' : `\\sin(${k}x)`;
        gp = k === 1 ? '\\cos x' : `${k}\\cos(${k}x)`;
        answerLatex = `x^{${g}}\\cdot(${gp}\\ln x+\\frac{${g}}{x})`;
      }
      const expr = `x^{${g}}`;
      return {
        params: { variant, k },
        statement: { text: 'Deriva con derivación logarítmica:', latex: `f(x)=${expr}` },
        expr,
        answer: { latex: answerLatex },
        steps: [
          { latex: `\\ln f = ${g}\\,\\ln x`, note: 'Toma ln a ambos lados para bajar el exponente.' },
          { latex: `\\frac{f'}{f} = ${gp}\\ln x + \\frac{${g}}{x}`, note: 'Deriva ambos lados: lado derecho es un producto.' },
          { latex: `f'(x) = ${answerLatex}`, note: 'Multiplica por f para despejar f′.' },
        ],
        distractors: uniqueDistractors(answerLatex, [
          { latex: `${g}\\cdot x^{${g}-1}`, feedback: 'Esa es la regla de potencia, pero aquí el exponente también depende de x.' },
          { latex: `x^{${g}}\\ln x`, feedback: 'Esa es la regla de aˣ; aquí la base también varía. Usa derivación logarítmica.' },
          { latex: `x^{${g}}\\cdot ${gp}`, feedback: 'Solo derivaste el exponente; falta la parte de ln x y g/x.' },
          { latex: `x^{${g}}(${gp}\\ln x)`, feedback: 'Te faltó el término g(x)/x que sale de derivar ln x.' },
        ]),
      };
    },
  },
];
