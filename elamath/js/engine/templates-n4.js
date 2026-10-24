// templates-n4.js — Nivel 4: Matemáticas Avanzadas para Ingeniería, Análisis de Sistemas y Señales, Optimización.

import { fr, safeFr, ansOf, num, dFr, compact, fact, terms, co, lin, polyLatex, intNot, uniqueDistractors, numericDistractors } from './helpers.js';

const gcd = (a, b) => (b === 0 ? Math.abs(a) : gcd(b, a % b));
/** (n/d)·π en LaTeX, reducido. */
function piFrac(n, d = 1) {
  const g = gcd(n, d);
  const [N, D] = [n / g, d / g];
  const top = N === 1 ? '\\pi' : `${N}\\pi`;
  return D === 1 ? top : `\\frac{${top}}{${D}}`;
}

export const templatesN4 = [
  // ═════════════ MATEMÁTICAS AVANZADAS PARA INGENIERÍA ═════════════
  {
    id: 'ma-laplace',
    topic: 'Transformada de Laplace',
    difficulty: 3,
    generate(rng) {
      const variant = rng.pick(['potencia', 'exp', 'seno', 'coseno']);
      const k = rng.int(1, 6);
      let ftex, ans, wrong;
      let params;
      if (variant === 'potencia') {
        const n = rng.int(3, 5);
        params = { variant, k, n };
        ftex = co(k, `t^{${n}}`);
        ans = `\\frac{${k * fact(n)}}{s^{${n + 1}}}`;
        wrong = [[`\\frac{${k * fact(n)}}{s^{${n}}}`, 'El exponente del denominador es n + 1, no n.'], [`\\frac{${k}}{s^{${n + 1}}}`, 'Te faltó el factorial: L{tⁿ} = n!/sⁿ⁺¹.'], [`\\frac{${k * n}}{s^{${n + 1}}}`, 'El numerador es n! (factorial), no n.'], [`\\frac{${k * fact(n)}}{s^{${n + 2}}}`, 'El exponente del denominador es n + 1 exactamente.']];
      } else if (variant === 'exp') {
        const a = rng.nonZero(-4, 4);
        params = { variant, k, a };
        ftex = co(k, `e^{${co(a, 't')}}`);
        ans = `\\frac{${k}}{${lin(a, 's')}}`;
        wrong = [[`\\frac{${k}}{${lin(-a, 's')}}`, 'El signo: L{e^{at}} = 1/(s − a).'], [`\\frac{1}{${lin(a, 's')}}`, 'Se te perdió la constante que multiplica.'], [`\\frac{${k}}{s}`, 'Eso es la transformada de una constante; falta desplazar por a.'], [`\\frac{${k + 1}}{${lin(a, 's')}}`, 'La constante k sale multiplicando tal cual.']];
      } else if (variant === 'seno') {
        const b = rng.int(2, 6);
        params = { variant, k, b };
        ftex = co(k, `\\sin(${b}t)`);
        ans = `\\frac{${k * b}}{s^{2}+${b * b}}`;
        wrong = [[`\\frac{${k * b}}{s^{2}-${b * b}}`, 'El denominador es s² + b² (con suma), eso es seno hiperbólico.'], [`\\frac{${k}s}{s^{2}+${b * b}}`, 'Esa es la transformada del coseno; el seno lleva b en el numerador.'], [`\\frac{${k}}{s^{2}+${b * b}}`, 'Te faltó la b del numerador: L{sen(bt)} = b/(s² + b²).'], [`\\frac{${k * b}}{s^{2}+${b}}`, 'En el denominador va b² (el cuadrado), no b.']];
      } else {
        const b = rng.int(2, 6);
        params = { variant, k, b };
        ftex = co(k, `\\cos(${b}t)`);
        ans = `\\frac{${co(k, 's')}}{s^{2}+${b * b}}`;
        wrong = [[`\\frac{${k * b}}{s^{2}+${b * b}}`, 'Esa es la transformada del seno; el coseno lleva s en el numerador.'], [`\\frac{${co(k, 's')}}{s^{2}-${b * b}}`, 'El denominador es s² + b², con suma.'], [`\\frac{${k}}{s^{2}+${b * b}}`, 'Falta la s del numerador: L{cos(bt)} = s/(s² + b²).'], [`\\frac{${co(k, 's')}}{s^{2}+${b}}`, 'En el denominador va b² (el cuadrado), no b.']];
      }
      return {
        params,
        vars: ['s'],
        statement: { text: 'Calcula la transformada de Laplace:', latex: `\\mathcal{L}\\left\\{${ftex}\\right\\}` },
        answer: { latex: ans },
        steps: [
          { latex: variant === 'potencia' ? '\\mathcal{L}\\{t^{n}\\}=\\frac{n!}{s^{n+1}}' : variant === 'exp' ? '\\mathcal{L}\\{e^{at}\\}=\\frac{1}{s-a}' : variant === 'seno' ? '\\mathcal{L}\\{\\sin(bt)\\}=\\frac{b}{s^{2}+b^{2}}' : '\\mathcal{L}\\{\\cos(bt)\\}=\\frac{s}{s^{2}+b^{2}}', note: 'Esta es la pareja de la tabla básica.' },
          { latex: ans, note: 'La transformada es lineal: la constante k sale multiplicando.' },
        ],
        distractors: uniqueDistractors(ans, wrong.map(([latex, feedback]) => ({ latex, feedback }))),
      };
    },
  },
  {
    id: 'ma-laplace-inv',
    topic: 'Transformada de Laplace',
    difficulty: 4,
    generate(rng) {
      const variant = rng.pick(['exp', 'seno', 'potencia']);
      const k = rng.int(1, 6);
      let F, ans, wrong, params;
      if (variant === 'exp') {
        const a = rng.nonZero(-4, 4);
        params = { variant, k, a };
        F = `\\frac{${k}}{${lin(a, 's')}}`;
        ans = co(k, `e^{${co(a, 't')}}`);
        wrong = [[co(k, `e^{${co(-a, 't')}}`, 1), 'El signo del exponente es el de a en (s − a).'], ['e^{' + co(a, 't') + '}', 'Se perdió la constante k del numerador.'], [co(k * a, `e^{${co(a, 't')}}`), 'No se multiplica por a: L⁻¹{1/(s−a)} = e^{at}.'], [co(k, `e^{${co(a + 1, 't')}}`), 'El exponente es exactamente at, con el mismo a de (s − a).'], [co(k + 1, `e^{${co(a, 't')}}`), 'La constante k sale multiplicando tal cual.'], [co(-k, `e^{${co(a, 't')}}`), 'El signo de k se conserva al invertir la transformada.']];
      } else if (variant === 'seno') {
        const b = rng.int(2, 6);
        params = { variant, k, b };
        F = `\\frac{${k * b}}{s^{2}+${b * b}}`;
        ans = co(k, `\\sin(${b}t)`);
        wrong = [[co(k * b, `\\sin(${b}t)`), 'El numerador ya incluye la b de sen(bt): no la repitas.'], [co(k, `\\cos(${b}t)`), 'El coseno llevaría s en el numerador.'], [co(k, `\\sin(${b * b}t)`), 'La frecuencia es b (la raíz de b²), no b².'], [co(k + 1, `\\sin(${b}t)`), 'La constante k sale multiplicando tal cual.']];
      } else {
        const n = rng.int(3, 5);
        params = { variant, k, n };
        F = `\\frac{${k * fact(n)}}{s^{${n + 1}}}`;
        ans = co(k, `t^{${n}}`);
        wrong = [[co(k * fact(n), `t^{${n}}`), 'Debes dividir entre el factorial: L{tⁿ} = n!/sⁿ⁺¹.'], [co(k, `t^{${n + 1}}`), 'El exponente es n = (potencia de s) − 1.'], [co(k, `\\frac{t^{${n}}}{${fact(n)}}`), 'El factorial ya está en el numerador y se cancela con el de la tabla.'], [co(k, `t^{${n + 2}}`), 'El exponente es n = (potencia de s) − 1.']];
      }
      return {
        params,
        vars: ['t'],
        statement: { text: 'Calcula la transformada inversa de Laplace:', latex: `\\mathcal{L}^{-1}\\left\\{${F}\\right\\}` },
        answer: { latex: ans },
        steps: [
          { latex: 'F(s)\;\\longleftrightarrow\; f(t)', note: 'Reconoce la forma en la tabla de transformadas.' },
          { latex: `f(t)=${ans}`, note: 'Ajusta la constante que sobra para que coincida con la tabla.' },
        ],
        distractors: uniqueDistractors(ans, wrong.map(([latex, feedback]) => ({ latex, feedback }))),
      };
    },
  },
  {
    id: 'ma-geometrica',
    topic: 'Series',
    difficulty: 2,
    generate(rng) {
      const a = rng.int(1, 9);
      const m = rng.int(2, 6);
      const neg = rng.pick([true, false]);
      const r = fr(neg ? -1 : 1, m);
      const S = fr(a * m, neg ? m + 1 : m - 1);
      return {
        params: { a, m, neg },
        statement: { text: 'Calcula la suma de la serie geométrica (converge porque |r| < 1):', latex: `\\sum_{n=0}^{\\infty} ${a}\\left(${neg ? '-' : ''}\\tfrac{1}{${m}}\\right)^{n}` },
        answer: ansOf(S),
        steps: [
          { latex: `r=${r.toLatex()},\\quad |r|<1`, note: 'Identifica la razón r y verifica que |r| < 1.' },
          { latex: `S=\\frac{a}{1-r}=\\frac{${a}}{1-\\left(${r.toLatex()}\\right)}=${S.toLatex()}`, note: 'Suma de una geométrica: primer término entre (1 − r).' },
        ],
        distractors: numericDistractors(S, compact([
          dFr(fr(a * m, neg ? m - 1 : m + 1), 'Cuidado con el signo de r: el denominador es 1 − r.'),
          dFr(fr(a), 'Ese es solo el primer término de la serie.'),
          dFr(fr(neg ? -a : a, neg ? m + 1 : m - 1), 'Esa es la suma empezando en n = 1 (sin el primer término); la serie empieza en n = 0.'),
        ])),
      };
    },
  },
  {
    id: 'ma-radio',
    topic: 'Series',
    difficulty: 3,
    generate(rng) {
      const k = rng.int(2, 9);
      const variant = rng.pick(['simple', 'lineal', 'armonica']);
      const c = variant === 'simple' ? rng.int(-3, 3) : 0;
      const base = c === 0 ? 'x' : `(${lin(c)})`;
      const term = { simple: `\\frac{${base}^{n}}{${k}^{n}}`, lineal: `\\frac{n\\,x^{n}}{${k}^{n}}`, armonica: `\\frac{x^{n}}{n\\,${k}^{n}}` }[variant];
      return {
        params: { k, variant, c },
        statement: { text: 'Usa el criterio de la razón para hallar el radio de convergencia R:', latex: `\\sum_{n=1}^{\\infty} ${term}` },
        answer: ansOf(fr(k)),
        steps: [
          { latex: `\\left|\\frac{a_{n+1}}{a_n}\\right| \\to \\frac{|${c === 0 ? 'x' : lin(c)}|}{${k}}`, note: 'El factor n/(n+1) o (n+1)/n tiende a 1; solo queda la razón entre potencias.' },
          { latex: `\\frac{|${c === 0 ? 'x' : lin(c)}|}{${k}}<1\;\\Rightarrow\; R=${k}`, note: 'La serie converge cuando ese límite es menor que 1.' },
        ],
        distractors: numericDistractors(fr(k), compact([
          dFr(fr(1, k), 'Invertiste: |x|/k < 1 da |x| < k, no |x| < 1/k.'),
          dFr(fr(k * k), 'Ese es k²; el radio es k.'),
          dFr(fr(1), 'Ese sería el radio sin el denominador kⁿ.'),
        ])),
      };
    },
  },
  {
    id: 'ma-taylor',
    topic: 'Series',
    difficulty: 3,
    generate(rng) {
      const variant = rng.pick(['exp', 'ln']);
      const a = rng.nonZero(-3, 3);
      const k = variant === 'exp' ? rng.int(2, 5) : rng.int(2, 6);
      const val = variant === 'exp' ? fr(a ** k, fact(k)) : fr((k % 2 === 0 ? -1 : 1) * a ** k, k);
      return {
        params: { variant, a, k },
        statement: { text: `¿Cuál es el coeficiente de x^${k} en la serie de Maclaurin?`, latex: variant === 'exp' ? `f(x)=e^{${co(a, 'x')}}` : `f(x)=\\ln(1${a < 0 ? '-' : '+'}${Math.abs(a) === 1 ? '' : Math.abs(a)}x)` },
        answer: ansOf(val),
        steps: variant === 'exp'
          ? [{ latex: 'e^{u}=\\sum_{n\\ge 0}\\frac{u^{n}}{n!}', note: 'Sustituye u = ax en la serie conocida de eᵘ.' }, { latex: `\\frac{(${a})^{${k}}}{${k}!}=${val.toLatex()}`, note: `El coeficiente de x^${k} es a^${k}/${k}!.` }]
          : [{ latex: '\\ln(1+u)=\\sum_{n\\ge 1}\\frac{(-1)^{n+1}u^{n}}{n}', note: 'Sustituye u = ax en la serie conocida de ln(1 + u).' }, { latex: `\\frac{(-1)^{${k + 1}}(${a})^{${k}}}{${k}}=${val.toLatex()}`, note: `El coeficiente de x^${k} es (−1)^{k+1}aᵏ/k.` }],
        distractors: numericDistractors(val, compact(variant === 'exp'
          ? [dFr(fr(a ** k), 'Falta dividir entre k!.'), dFr(fr(a, fact(k)), 'La a también va elevada a la k.'), dFr(fr(a ** k, k), 'Dividiste entre k, no entre k! (factorial).')]
          : [dFr(fr(a ** k, k), 'Revisa el signo alternante (−1)^{k+1}.'), dFr(fr((k % 2 === 0 ? -1 : 1) * a ** k, fact(k)), 'Eso es el patrón de eˣ (k!); en ln(1+u) se divide entre k.'), dFr(fr((k % 2 === 0 ? -1 : 1) * a, k), 'La a va elevada a la k.')])),
      };
    },
  },

  // ═════════════ ANÁLISIS DE SISTEMAS Y SEÑALES ═════════════
  {
    id: 'ss-periodo',
    topic: 'Señales y sistemas',
    difficulty: 2,
    generate(rng) {
      const variant = rng.pick(['simple', 'suma']);
      let latex, T, params, specifics;
      if (variant === 'simple') {
        const w = rng.int(2, 12);
        params = { variant, w };
        latex = `x(t)=\\sin(${w}t)`;
        T = [2, w];
        specifics = [piFrac(1, w), piFrac(2 * w, 1), `\\frac{${w}}{2\\pi}`, piFrac(4, w), piFrac(2, w + 1), piFrac(2, w + 2)];
      } else {
        const g = rng.int(1, 4);
        const a = g * rng.int(1, 4);
        let b;
        do {
          b = g * rng.int(1, 4);
        } while (b === a || gcd(a, b) !== g);
        params = { variant, a, b, g };
        latex = `x(t)=\\sin(${a}t)+\\cos(${b}t)`;
        T = [2, g];
        const lcm = (a * b) / g;
        specifics = [piFrac(2, lcm), piFrac(2, a + b), piFrac(2, Math.max(a, b)), piFrac(2, Math.min(a, b)), piFrac(4, g), piFrac(1, g)];
      }
      const ansLatex = piFrac(T[0], T[1]);
      return {
        params,
        statement: { text: '¿Cuál es el periodo fundamental de la señal?', latex },
        answer: { latex: ansLatex, value: (T[0] * Math.PI) / T[1] },
        steps: variant === 'simple'
          ? [{ latex: `\\sin(\\omega t)\;\\text{ tiene periodo }\; T=\\frac{2\\pi}{\\omega}`, note: 'El periodo es el tiempo en que el argumento avanza 2π.' }, { latex: `T=\\frac{2\\pi}{${params.w}}=${ansLatex}`, note: 'Simplifica.' }]
          : [{ latex: `T_1=${piFrac(2, params.a)},\\quad T_2=${piFrac(2, params.b)}`, note: 'Cada término tiene su propio periodo.' }, { latex: `T=\\operatorname{mcm}(T_1,T_2)=\\frac{2\\pi}{\\gcd(${params.a},${params.b})}=${ansLatex}`, note: 'El periodo de la suma es el mínimo común múltiplo de los periodos (si existe).' }],
        distractors: uniqueDistractors(ansLatex, specifics.map((l, i) => ({ latex: l, feedback: ['Revisa la fórmula T = 2π/ω (te faltó el 2 o lo duplicaste).', 'Piensa en cuánto tarda el argumento en avanzar 2π.', 'Eso se parece a la frecuencia f = ω/2π, no al periodo T = 2π/ω.', 'El periodo no es un múltiplo arbitrario: revisa T = 2π/ω.', 'Revisa la fórmula T = 2π/ω.', 'Revisa la fórmula T = 2π/ω.'][i] }))),
      };
    },
  },
  {
    id: 'ss-convolucion',
    topic: 'Señales y sistemas',
    difficulty: 3,
    generate(rng) {
      const x = [rng.int(-3, 4), rng.int(-3, 4), rng.int(-3, 4)];
      const h = [rng.nonZero(-3, 3), rng.int(-3, 3)];
      const n = rng.int(1, 2);
      const y = (m) => (x[m] ?? 0) * h[0] + (x[m - 1] ?? 0) * h[1];
      return {
        params: { x, h, n },
        statement: { text: `Calcula y[${n}] = (x ∗ h)[${n}] para las señales discretas (n = 0, 1, 2…):`, latex: `x=\\{${x.join(',\\,')}\\},\\quad h=\\{${h.join(',\\,')}\\}` },
        answer: ansOf(fr(y(n))),
        steps: [
          { latex: 'y[n]=\\sum_{k} x[k]\\,h[n-k]', note: 'La convolución voltea h, la desliza y suma los productos.' },
          { latex: `y[${n}] = x[${n}]h[0] + x[${n - 1}]h[1] = ${num(x[n])}\\cdot ${num(h[0])} + ${num(x[n - 1])}\\cdot ${num(h[1])} = ${y(n)}`, note: 'Solo contribuyen los índices donde ambas señales existen.' },
        ],
        distractors: numericDistractors(fr(y(n)), compact([
          dFr(fr(y(n === 1 ? 2 : 1)), 'Esa es otra muestra de la salida; revisa el índice n.'),
          dFr(fr(x[n] * h[0]), 'Eso es solo el producto punto a punto; falta el término desplazado.'),
          dFr(fr(x[n] * h[1] + x[n - 1] * h[0]), 'Cruzaste los índices: es x[n]h[0] + x[n−1]h[1].'),
        ])),
      };
    },
  },
  {
    id: 'ss-ganancia',
    topic: 'Señales y sistemas',
    difficulty: 2,
    generate(rng) {
      const order = rng.pick([1, 2]);
      const K = rng.int(1, 12);
      let den, q;
      if (order === 1) {
        q = rng.int(1, 9);
        den = lin(-q, 's');
      } else {
        const p = rng.int(1, 8);
        q = rng.int(1, 10);
        den = polyLatex([q, p, 1], 's');
      }
      const val = fr(K, q);
      return {
        params: { order, K, q },
        statement: { text: '¿Cuál es la ganancia en continua (DC) del sistema, es decir H(0)?', latex: `H(s)=\\frac{${K}}{${den}}` },
        answer: ansOf(val),
        steps: [
          { latex: 'H(0)\;=\;\\text{ganancia a frecuencia cero}', note: 'En régimen permanente con entrada constante, s = 0.' },
          { latex: `H(0)=\\frac{${K}}{${q}}=${val.toLatex()}`, note: 'Sustituye s = 0 en el denominador.' },
        ],
        distractors: numericDistractors(val, compact([
          dFr(fr(K * q), 'Multiplicaste en vez de dividir.'),
          dFr(safeFr(q, K), 'Invertiste la razón: H(0) = K / (valor del denominador en 0).'),
          dFr(fr(K), 'Olvidaste dividir entre el denominador evaluado en s = 0.'),
        ])),
      };
    },
  },
  {
    id: 'ss-estabilidad',
    topic: 'Señales y sistemas',
    difficulty: 3,
    generate(rng) {
      const p1 = rng.int(-5, 5);
      const p2 = rng.int(-5, 5);
      const re = [p1, p2];
      const verdict = re.some((p) => p > 0) || (p1 === 0 && p2 === 0) ? 'Inestable' : re.some((p) => p === 0) ? 'Marginalmente estable' : 'Estable';
      const options = ['Estable', 'Inestable', 'Marginalmente estable', 'No se puede determinar'];
      const tex = (t) => `\\text{${t}}`;
      return {
        params: { p1, p2 },
        statement: { text: 'Un sistema LTI continuo tiene la función de transferencia con polos reales. ¿Cómo es su estabilidad (entrada–salida)?', latex: `H(s)=\\frac{1}{(${lin(p1, 's')})(${lin(p2, 's')})}` },
        answer: { latex: tex(verdict) },
        steps: [
          { latex: `\\text{Polos: } s=${p1},\; s=${p2}`, note: 'Los polos son las raíces del denominador.' },
          { latex: tex(verdict), note: 'Estable: todos los polos con parte real negativa. Inestable: alguno con parte real positiva. Marginal: un polo simple en 0 y ninguno positivo (un polo doble en 0 ya es inestable).' },
        ],
        distractors: options.filter((o) => o !== verdict).map((o) => ({ latex: tex(o), feedback: 'Revisa el signo de la parte real de los polos: <0 estable, >0 inestable, =0 marginal.' })),
      };
    },
  },
  {
    id: 'ss-nyquist',
    topic: 'Señales y sistemas',
    difficulty: 2,
    generate(rng) {
      const a = rng.int(2, 40) * 50;
      const b = intNot(rng, 2, 40, a / 50) * 50;
      const hi = Math.max(a, b);
      return {
        params: { a, b },
        statement: { text: '¿Cuál es la frecuencia de muestreo MÍNIMA (en Hz) que permite reconstruir la señal sin aliasing (criterio de Nyquist)?', latex: `x(t)=\\cos(2\\pi\\cdot ${a}\\,t)+\\cos(2\\pi\\cdot ${b}\\,t)` },
        answer: ansOf(fr(2 * hi)),
        steps: [
          { latex: `f_{\\max}=\\max(${a},${b})=${hi}\\text{ Hz}`, note: 'Identifica la frecuencia más alta de la señal (el argumento es 2πf·t).' },
          { latex: `f_s\\ge 2f_{\\max}=${2 * hi}\\text{ Hz}`, note: 'Nyquist: muestrear al menos al doble de la frecuencia máxima.' },
        ],
        distractors: numericDistractors(fr(2 * hi), compact([
          dFr(fr(hi), 'Esa es la frecuencia máxima; hay que muestrear al DOBLE.'),
          dFr(fr(a + b), 'No se suman las frecuencias; solo importa la mayor.'),
          dFr(fr(2 * Math.min(a, b)), 'Usaste la frecuencia menor: la que manda es la mayor.'),
        ])),
      };
    },
  },

  // ═════════════ OPTIMIZACIÓN ═════════════
  {
    id: 'op-cuadratica',
    topic: 'Optimización sin restricciones',
    difficulty: 2,
    generate(rng) {
      const a = rng.nonZero(-5, 5);
      const b = rng.int(-10, 10);
      const c = rng.int(-10, 10);
      const ask = rng.pick(['posicion', 'valor']);
      const xs = fr(-b, 2 * a);
      const fv = fr(4 * a * c - b * b, 4 * a);
      const kind = a > 0 ? 'mínimo' : 'máximo';
      const val = ask === 'posicion' ? xs : fv;
      return {
        params: { a, b, c, ask },
        statement: { text: ask === 'posicion' ? `¿En qué valor de x la función alcanza su ${kind}?` : `¿Cuál es el valor ${kind} de la función?`, latex: `f(x)=${polyLatex([c, b, a])}` },
        answer: ansOf(val),
        steps: [
          { latex: `f'(x)=${terms([[2 * a, 'x'], [b, '']])}=0\;\\Rightarrow\; x^{*}=${xs.toLatex()}`, note: `Como a ${a > 0 ? '> 0 abre hacia arriba' : '< 0 abre hacia abajo'}, el punto crítico es un ${kind}.` },
          ask === 'posicion' ? { latex: `x^{*}=-\\frac{b}{2a}=${xs.toLatex()}`, note: 'Vértice de la parábola.' } : { latex: `f(x^{*})=${fv.toLatex()}`, note: 'Sustituye x* en f.' },
        ],
        distractors: numericDistractors(val, compact(ask === 'posicion'
          ? [dFr(fr(b, 2 * a), 'Cuidado con el signo: x* = −b/(2a).'), dFr(fr(-b, a), 'El denominador es 2a, no a.'), dFr(fv, 'Ese es el valor de f en x*, no la posición.')]
          : [dFr(xs, 'Esa es la posición x*; te piden el valor de f ahí.'), dFr(fr(c), 'f(0) = c no es el extremo; evalúa en x*.'), dFr(fr(c - b * b, 4 * a), 'Revisa el cálculo del valor en el vértice: c − b²/(4a).')])),
      };
    },
  },
  {
    id: 'op-gradiente',
    topic: 'Optimización sin restricciones',
    difficulty: 2,
    generate(rng) {
      const a = rng.int(1, 4);
      const b = rng.int(-8, 8);
      const x0 = rng.int(-6, 6);
      const m = rng.int(2, 10);
      const g = 2 * a * x0 + b;
      const x1 = fr(m * x0 - g, m);
      return {
        params: { a, b, x0, m },
        statement: { text: `Aplica UN paso de descenso por gradiente con tasa α = 1/${m} partiendo de x₀ = ${x0}:`, latex: `f(x)=${terms([[a, 'x^{2}'], [b, 'x']])}` },
        answer: ansOf(x1),
        steps: [
          { latex: `f'(x_0)=${terms([[2 * a, 'x']])}${b >= 0 ? '+' : '-'}${Math.abs(b)}\\Big|_{x_0=${x0}}=${g}`, note: 'Calcula la derivada (el gradiente en 1D) en x₀.' },
          { latex: `x_1=x_0-\\alpha f'(x_0)=${x0}-\\frac{1}{${m}}(${g})=${x1.toLatex()}`, note: 'Camina en sentido contrario al gradiente.' },
        ],
        distractors: numericDistractors(x1, compact([
          dFr(fr(m * x0 + g, m), 'Fue un paso de ASCENSO: para minimizar se resta α·f′.'),
          dFr(fr(x0 - g), 'Olvidaste multiplicar por la tasa α.'),
          dFr(fr(m * x0 - (a * x0 * x0 + b * x0), m), 'Usaste f(x₀) en vez de f′(x₀).'),
        ])),
      };
    },
  },
  {
    id: 'op-lagrange',
    topic: 'Optimización con restricciones',
    difficulty: 4,
    generate(rng) {
      const a = rng.nonZero(-5, 5);
      const b = rng.nonZero(-5, 5);
      const c = rng.nonZero(-9, 9);
      const val = fr(c * c, a * a + b * b);
      return {
        params: { a, b, c },
        statement: { text: 'Con multiplicadores de Lagrange, ¿cuál es el valor mínimo de f sujeto a la restricción?', latex: `f(x,y)=x^{2}+y^{2},\\qquad ${terms([[a, 'x'], [b, 'y']])}=${c}` },
        answer: ansOf(val),
        steps: [
          { latex: `\\nabla f=\\lambda\\nabla g:\; 2x=\\lambda ${num(a)},\; 2y=\\lambda ${num(b)}`, note: 'En el óptimo los gradientes son paralelos.' },
          { latex: `x=\\frac{${num(a)}\\lambda}{2},\; y=\\frac{${num(b)}\\lambda}{2}\;\\Rightarrow\; \\lambda=\\frac{2\\cdot ${num(c)}}{${a * a + b * b}}`, note: 'Sustituye en la restricción para despejar λ.' },
          { latex: `f_{\\min}=\\frac{${c * c}}{${a * a + b * b}}=${val.toLatex()}`, note: 'Es el cuadrado de la distancia del origen a la recta.' },
        ],
        distractors: numericDistractors(val, compact([
          dFr(fr(c, a * a + b * b), 'Te faltó elevar c al cuadrado: f es la distancia AL CUADRADO.'),
          dFr(safeFr(c * c, (a + b) ** 2), 'El denominador es a² + b², no (a + b)².'),
          dFr(fr(c * c), 'Falta dividir entre a² + b².'),
        ])),
      };
    },
  },
  {
    id: 'op-lineal',
    topic: 'Optimización con restricciones',
    difficulty: 3,
    generate(rng) {
      const A = rng.int(3, 8);
      const B = rng.int(3, 8);
      const S = rng.int(Math.max(A, B) + 1, A + B - 1);
      const p = rng.int(1, 9);
      const q = intNot(rng, 1, 9, p);
      const feasible = (x, y) => x >= 0 && y >= 0 && x <= A && y <= B && x + y <= S;
      const verts = [[0, 0], [A, 0], [0, B], [A, S - A], [S - B, B]].filter(([x, y]) => feasible(x, y));
      const z = (v) => p * v[0] + q * v[1];
      const best = verts.reduce((m, v) => (z(v) > z(m) ? v : m), verts[0]);
      return {
        params: { A, B, S, p, q },
        statement: { text: 'Maximiza la función objetivo sujeta a las restricciones (con x, y ≥ 0):', latex: `Z=${terms([[p, 'x'], [q, 'y']])},\\quad x\\le ${A},\; y\\le ${B},\; x+y\\le ${S}` },
        answer: ansOf(fr(z(best))),
        steps: [
          { latex: verts.map((v) => `(${v[0]},${v[1]})`).join(',\;'), note: 'El máximo de un problema lineal está en un vértice de la región factible.' },
          { latex: verts.map((v) => `Z${`(${v[0]},${v[1]})`}=${z(v)}`).join(',\;'), note: 'Evalúa Z en cada vértice y compara.' },
          { latex: `Z_{\\max}=${z(best)}\\text{ en }(${best[0]},${best[1]})`, note: 'Ese es el máximo.' },
        ],
        distractors: numericDistractors(fr(z(best)), compact([
          dFr(fr(p * A + q * B), 'El punto (x, y) = (A, B) viola x + y ≤ S: no es factible.'),
          dFr(fr(Math.max(p * A, q * B)), 'Te quedaste con un solo eje; revisa todos los vértices de la región.'),
          dFr(fr(Math.min(...verts.filter((v) => v[0] + v[1] > 0).map(z))), 'Ese es el menor valor entre vértices; buscas el mayor.'),
        ])),
      };
    },
  },
  {
    id: 'op-hessiana',
    topic: 'Optimización sin restricciones',
    difficulty: 4,
    generate(rng) {
      let a, b, c;
      do {
        a = rng.nonZero(-4, 4);
        b = rng.nonZero(-4, 4);
        c = rng.int(-5, 5);
      } while (4 * a * b - c * c === 0);
      const det = 4 * a * b - c * c;
      const verdict = det < 0 ? 'punto silla' : a > 0 ? 'mínimo local' : 'máximo local';
      const options = ['mínimo local', 'máximo local', 'punto silla', 'no se puede determinar'];
      const tex = (t) => `\\text{${t}}`;
      return {
        params: { a, b, c },
        statement: { text: 'El origen es punto crítico de f. Con la prueba de la segunda derivada, ¿qué tipo de punto es?', latex: `f(x,y)=${terms([[a, 'x^{2}'], [b, 'y^{2}'], [c, 'xy']])}` },
        answer: { latex: tex(verdict) },
        steps: [
          { latex: `H=${'\\begin{pmatrix}'}${2 * a} & ${c} \\\\ ${c} & ${2 * b}${'\\end{pmatrix}'},\\quad \\det H=${det}`, note: 'Hessiana: segundas derivadas. El determinante es 4ab − c².' },
          { latex: tex(verdict), note: 'det < 0: silla. det > 0: mínimo si f_xx > 0, máximo si f_xx < 0.' },
        ],
        distractors: options.filter((o) => o !== verdict).map((o) => ({ latex: tex(o), feedback: 'Revisa el signo de det H = 4ab − c² y de f_xx = 2a.' })),
      };
    },
  },
];
