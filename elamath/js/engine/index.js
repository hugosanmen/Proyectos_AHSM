// index.js — API pública del motor paramétrico de ElaMath

import { templates as baseTemplates } from './templates.js';
import { templatesN1 } from './templates-n1.js';
import { templatesN2 } from './templates-n2.js';
import { templatesN3 } from './templates-n3.js';
import { templatesN4 } from './templates-n4.js';
import { templatesN5 } from './templates-n5.js';
import { createRng, shuffle } from './utils.js';

/** Plantillas de Cálculo Diferencial (las de la primera versión). */
export { baseTemplates };
/** Plantillas de las demás materias, en orden de nivel. */
export const extraTemplates = [...templatesN1, ...templatesN2, ...templatesN3, ...templatesN4, ...templatesN5];
/** Todas las plantillas del motor. */
export const templates = [...baseTemplates, ...extraTemplates];
export { createRng, Fraction, polyLatex } from './utils.js';

export const getTemplate = (id) => templates.find((t) => t.id === id);

/** Genera un ejercicio reproducible: la misma (id, seed) siempre da el mismo ejercicio. */
export function generateExercise(id, seed) {
  const t = getTemplate(id);
  if (!t) throw new Error(`Plantilla desconocida: ${id}`);
  const ex = t.generate(createRng(seed));
  return { templateId: t.id, topic: t.topic, difficulty: t.difficulty, seed, ...ex };
}

/** Serie de ejercicios variados, filtrable por tema y dificultad máxima. */
export function generateSet({ count = 10, topic, maxDifficulty = 5, seed = Date.now() } = {}) {
  const pool = templates.filter((t) => (!topic || t.topic === topic) && t.difficulty <= maxDifficulty);
  if (pool.length === 0) throw new Error('No hay plantillas para esos filtros');
  const rng = createRng(seed);
  return Array.from({ length: count }, () => generateExercise(rng.pick(pool).id, rng.int(1, 2 ** 31 - 1)));
}

/** Convierte un ejercicio en opción múltiple (4 opciones, 1 correcta) con orden reproducible. */
export function toMultipleChoice(exercise, seed = exercise.seed) {
  const options = [
    { latex: exercise.answer.latex, correct: true, feedback: '¡Va! Ese es el resultado.' },
    ...exercise.distractors.map((d) => ({ ...d, correct: false })),
  ];
  return { ...exercise, options: shuffle(createRng(seed), options) };
}
