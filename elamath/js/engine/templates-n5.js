// templates-n5.js — Nivel 5: Modelado Matemático Aplicado.
// (Exámenes de Preparación y Retos de Grado no tienen plantillas propias: mezclan las de otras materias.)

import { fr, safeFr, ansOf, dFr, compact, intNot, numericDistractors } from './helpers.js';

export const templatesN5 = [
  {
    id: 'mo-poblacion',
    topic: 'Crecimiento y decaimiento',
    difficulty: 2,
    generate(rng) {
      const P0 = rng.int(2, 50) * 10;
      const T = rng.int(2, 8);
      const m = rng.int(2, 6);
      const t = m * T;
      return {
        params: { P0, T, m },
        statement: { text: `Un cultivo tiene ${P0} bacterias y su población se duplica cada ${T} horas. ¿Cuántas bacterias habrá a las ${t} horas?`, latex: 'P(t)=P_0\\cdot 2^{t/T}' },
        answer: ansOf(fr(P0 * 2 ** m)),
        steps: [
          { latex: `\\frac{t}{T}=\\frac{${t}}{${T}}=${m}\\text{ duplicaciones}`, note: 'Cuenta cuántas veces se duplica en ese tiempo.' },
          { latex: `P=${P0}\\cdot 2^{${m}}=${P0 * 2 ** m}`, note: 'Cada duplicación multiplica por 2.' },
        ],
        distractors: numericDistractors(fr(P0 * 2 ** m), compact([
          dFr(fr(P0 * 2 * m), 'Eso sería crecimiento lineal; duplicar repetidamente es exponencial (2^m).'),
          dFr(fr(P0 * 2 ** t), 'El exponente es el número de duplicaciones (t/T), no las horas.'),
          dFr(fr(P0 + P0 * m), 'Sumaste P₀ m veces; cada duplicación multiplica por 2.'),
        ])),
      };
    },
  },
  {
    id: 'mo-enfriamiento',
    topic: 'Crecimiento y decaimiento',
    difficulty: 3,
    generate(rng) {
      const Ta = rng.int(10, 25);
      const m = rng.int(2, 4);
      const d = rng.int(1, 9);
      const D = d * 2 ** m;
      const T0 = Ta + D;
      const tau = rng.int(5, 20);
      const val = Ta + d;
      return {
        params: { Ta, T0, tau, m },
        statement: { text: `Un objeto a ${T0} °C se enfría en un cuarto a ${Ta} °C. La diferencia de temperatura con el ambiente se reduce a la mitad cada ${tau} minutos. ¿Qué temperatura tiene a los ${m * tau} minutos?`, latex: 'T(t)=T_a+(T_0-T_a)\\left(\\tfrac{1}{2}\\right)^{t/\\tau}' },
        answer: ansOf(fr(val)),
        steps: [
          { latex: `T_0-T_a=${D},\\quad \\frac{t}{\\tau}=${m}`, note: 'La diferencia con el ambiente se divide entre 2 por cada periodo.' },
          { latex: `T=${Ta}+\\frac{${D}}{2^{${m}}}=${Ta}+${d}=${val}`, note: 'No olvides sumar la temperatura ambiente al final.' },
        ],
        distractors: numericDistractors(fr(val), compact([
          dFr(fr(d), 'Esa es solo la diferencia restante; falta sumar la temperatura ambiente.'),
          dFr(fr(Ta + D / 2), 'Solo la dividiste entre 2 una vez; son m periodos (2^m).'),
          dFr(fr(T0 - d), 'Restaste al revés: el objeto se acerca al ambiente, no se aleja de él.'),
        ])),
      };
    },
  },
  {
    id: 'mo-tanque',
    topic: 'Sistemas dinámicos',
    difficulty: 3,
    generate(rng) {
      const V = rng.int(2, 20) * 50;
      const r = rng.int(2, 10) * 5;
      const c = rng.int(1, 9);
      return {
        params: { V, r, c },
        statement: { text: `Un tanque de ${V} L contiene agua pura. Entra salmuera de ${c} g/L a ${r} L/min y sale la mezcla (bien agitada) a ${r} L/min. ¿Hacia cuántos gramos de sal tiende la cantidad en el tanque a largo plazo?`, latex: "S'(t)=c\\,r-\\frac{r}{V}S(t)" },
        answer: ansOf(fr(c * V)),
        steps: [
          { latex: "S'=0\;\\Rightarrow\; c\\,r=\\frac{r}{V}S", note: 'En equilibrio la sal que entra es igual a la que sale.' },
          { latex: `S_{eq}=c\\,V=${c}\\cdot ${V}=${c * V}`, note: 'El flujo r se cancela: el equilibrio solo depende de la concentración y el volumen.' },
        ],
        distractors: numericDistractors(fr(c * V), compact([
          dFr(fr(c * r), 'Esa es la sal que entra por minuto, no la cantidad de equilibrio.'),
          dFr(fr(r * V), 'No depende del flujo r; es concentración por volumen.'),
          dFr(safeFr(c * V, r), 'El flujo se cancela en el equilibrio; no divides entre r.'),
        ])),
      };
    },
  },
  {
    id: 'mo-rc',
    topic: 'Sistemas dinámicos',
    difficulty: 2,
    generate(rng) {
      const variant = rng.pick(['tau', 'C', 'R']);
      const R = rng.int(2, 20);
      const C = rng.int(2, 20);
      const tau = R * C;
      let text, ans, wrong;
      if (variant === 'tau') {
        text = `Un circuito RC tiene R = ${R} kΩ y C = ${C} µF. ¿Cuál es su constante de tiempo τ (en ms)?`;
        ans = tau;
        wrong = [[R + C, 'La constante de tiempo se obtiene multiplicando: τ = R·C.'], [fr(R, C), 'τ = R·C, no R/C.'], [R * C * 1000, 'kΩ · µF ya da milisegundos directamente (10³ · 10⁻⁶ = 10⁻³ s).']];
      } else if (variant === 'C') {
        text = `Un circuito RC con R = ${R} kΩ debe tener τ = ${tau} ms. ¿Cuánto debe valer C (en µF)?`;
        ans = C;
        wrong = [[tau * R, 'Despeja con una división: C = τ/R.'], [fr(R, tau), 'Invertiste la razón: C = τ/R.'], [tau - R, 'No se resta: τ = R·C, así que C = τ/R.']];
      } else {
        text = `Un circuito RC con C = ${C} µF debe tener τ = ${tau} ms. ¿Cuánto debe valer R (en kΩ)?`;
        ans = R;
        wrong = [[tau * C, 'Despeja con una división: R = τ/C.'], [fr(C, tau), 'Invertiste la razón: R = τ/C.'], [tau - C, 'No se resta: τ = R·C, así que R = τ/C.']];
      }
      return {
        params: { variant, R, C },
        statement: { text, latex: '\\tau = R\\,C' },
        answer: ansOf(fr(ans)),
        steps: [
          { latex: '\\tau = RC,\\qquad \\text{k}\\Omega\\cdot\\mu\\text{F}=\\text{ms}', note: 'Las unidades kΩ y µF dan milisegundos directamente.' },
          { latex: variant === 'tau' ? `\\tau=${R}\\cdot ${C}=${tau}\\text{ ms}` : variant === 'C' ? `C=\\frac{\\tau}{R}=\\frac{${tau}}{${R}}=${C}\;\\mu\\text{F}` : `R=\\frac{\\tau}{C}=\\frac{${tau}}{${C}}=${R}\;\\text{k}\\Omega`, note: 'Sustituye y calcula.' },
        ],
        distractors: numericDistractors(fr(ans), compact(wrong.map(([v, fb]) => dFr(typeof v === 'number' ? fr(v) : v, fb)))),
      };
    },
  },
  {
    id: 'mo-interes',
    topic: 'Sistemas dinámicos',
    difficulty: 2,
    generate(rng) {
      const r = rng.pick([5, 10]);
      const n = rng.int(2, 3);
      const P = (r === 10 ? 1000 : 8000) * rng.int(1, 5);
      const A = (P * (100 + r) ** n) / 100 ** n;
      return {
        params: { P, r, n },
        statement: { text: `Se invierten $${P} a una tasa anual del ${r}% con interés compuesto anual. ¿Cuánto dinero (en pesos) habrá después de ${n} años?`, latex: 'A=P\\left(1+\\tfrac{r}{100}\\right)^{n}' },
        answer: ansOf(fr(A)),
        steps: [
          { latex: `A=${P}\\,(1+${r / 100})^{${n}}`, note: 'El interés se calcula sobre el monto acumulado de cada año.' },
          { latex: `A=${P}\\cdot ${((100 + r) ** n / 100 ** n).toFixed(n === 2 ? 4 : 6).replace(/0+$/, '')}=${A}`, note: 'Eleva el factor de crecimiento y multiplica.' },
        ],
        distractors: numericDistractors(fr(A), compact([
          dFr(fr(P + (P * r * n) / 100), 'Eso es interés SIMPLE; con interés compuesto cada año ganas sobre lo ya acumulado.'),
          dFr(fr((P * (100 + r) ** (n - 1)) / 100 ** (n - 1)), 'Faltó un año de capitalización.'),
          dFr(fr(P * (1 + r) ** 1), 'La tasa se usa como decimal (r/100), no como número entero.'),
        ])),
      };
    },
  },
];
