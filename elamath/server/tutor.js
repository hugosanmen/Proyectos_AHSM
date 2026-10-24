// tutor.js — Peer Tutor con IA.
//
// Idea clave anti-alucinaciones: el cliente NO manda la respuesta correcta; manda solo
// { templateId, seed, pickedIndex }. El servidor REGENERA el ejercicio con el mismo motor
// paramétrico (determinista) y le entrega al modelo la respuesta, los pasos y los errores típicos
// ya verificados por las pruebas. El modelo explica; no calcula de memoria.

import { generateExercise, getTemplate, toMultipleChoice } from '../js/engine/index.js';
import { MODE_INSTRUCTIONS, PEER_TUTOR_PROMPT } from './prompt.js';
import { chat } from './llm.js';

export class BadRequest extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
export { UpstreamError, callAnthropic, callGroq } from './llm.js';

export const MAX_MESSAGE_CHARS = 1000;
export const MAX_HISTORY = 6;
const LETTERS = 'ABCD';
const MAX_TOKENS = { hint: 300, explain: 700, deep: 1100 };

/** Valida y normaliza el cuerpo de la petición. Lanza BadRequest si algo no cuadra. */
export function parseTutorRequest(body) {
  if (!body || typeof body !== 'object') throw new BadRequest('bad_request');
  const message = typeof body.message === 'string' ? body.message.trim() : '';
  if (!message || message.length > MAX_MESSAGE_CHARS) throw new BadRequest('bad_message');
  const mode = body.mode === undefined ? 'explain' : body.mode;
  if (!Object.hasOwn(MODE_INSTRUCTIONS, mode)) throw new BadRequest('bad_mode');

  let exercise = null;
  if (body.exercise !== undefined && body.exercise !== null) {
    const { templateId, seed, pickedIndex } = body.exercise;
    if (typeof templateId !== 'string' || !getTemplate(templateId)) throw new BadRequest('bad_exercise');
    if (!Number.isInteger(seed) || seed < 1 || seed > 2 ** 31 - 1) throw new BadRequest('bad_exercise');
    if (pickedIndex !== undefined && pickedIndex !== null && !(Number.isInteger(pickedIndex) && pickedIndex >= 0 && pickedIndex <= 3)) {
      throw new BadRequest('bad_exercise');
    }
    exercise = { templateId, seed, pickedIndex: pickedIndex ?? null };
  }
  return { message, mode, exercise, history: sanitizeHistory(body.history) };
}

/** Últimos turnos válidos, empezando por un mensaje del estudiante y alternando roles. */
export function sanitizeHistory(history) {
  if (!Array.isArray(history)) return [];
  let clean = [];
  // Se limpia primero (los inválidos no ocupan lugar) y se recorta después; el tope de 50 evita trabajo inútil.
  for (const m of history.slice(-50)) {
    if (!m || (m.role !== 'user' && m.role !== 'assistant') || typeof m.content !== 'string') continue;
    const content = m.content.trim().slice(0, 4000);
    if (!content) continue;
    const last = clean[clean.length - 1];
    if (last && last.role === m.role) last.content += `\n\n${content}`;
    else clean.push({ role: m.role, content });
  }
  clean = clean.slice(-MAX_HISTORY);
  while (clean.length && clean[0].role !== 'user') clean.shift();
  return clean;
}

/** Elige el modelo según el modo: pista → rápido; explicación → estándar; profunda → razonamiento. */
export function pickModel(mode, models) {
  return mode === 'hint' ? models.fast : mode === 'deep' ? models.deep : models.standard;
}

/** Texto de contexto verificado a partir del ejercicio regenerado por el motor. */
export function buildGrounding(ref) {
  const ex = toMultipleChoice(generateExercise(ref.templateId, ref.seed));
  const correct = ex.options.findIndex((o) => o.correct);
  const lines = [
    'CONTEXTO VERIFICADO DEL EJERCICIO (calculado por el motor de ElaMath; es la verdad, no lo contradigas):',
    `Tema: ${ex.topic} (dificultad ${ex.difficulty}/5)`,
    `Enunciado: ${ex.statement.text}${ex.statement.latex ? ` $$${ex.statement.latex}$$` : ''}`,
    'Opciones:',
    ...ex.options.map((o, i) => `  ${LETTERS[i]}) $${o.latex}$`),
    `Respuesta correcta: ${LETTERS[correct]}) $${ex.answer.latex}$`,
    'Pasos verificados:',
    ...ex.steps.map((s, i) => `  ${i + 1}. $${s.latex}$ — ${s.note}`),
  ];
  if (ref.pickedIndex === null) {
    lines.push('El estudiante todavía NO ha respondido: no reveles la respuesta correcta.');
  } else {
    const p = ex.options[ref.pickedIndex];
    lines.push(
      p.correct
        ? `El estudiante eligió ${LETTERS[ref.pickedIndex]}) y es CORRECTA.`
        : `El estudiante eligió ${LETTERS[ref.pickedIndex]}) $${p.latex}$ y es INCORRECTA. Error típico asociado: ${p.feedback}`,
    );
  }
  return lines.join('\n');
}

const UNGROUNDED = 'Sin ejercicio asociado: no hay respuesta verificada para esta pregunta. Sé prudente, razona con calma y advierte si no estás seguro de algún resultado.';

/** Bloques de system: el prompt fijo va primero y con caché; lo variable (contexto, modo) después. */
export function buildSystem(parsed) {
  const dynamic = `${parsed.exercise ? buildGrounding(parsed.exercise) : UNGROUNDED}\n\n${MODE_INSTRUCTIONS[parsed.mode]}`;
  return [
    { type: 'text', text: PEER_TUTOR_PROMPT, cache_control: { type: 'ephemeral' } },
    { type: 'text', text: dynamic },
  ];
}

export function buildMessages(parsed) {
  const msgs = [...parsed.history];
  const last = msgs[msgs.length - 1];
  if (last && last.role === 'user') last.content += `\n\n${parsed.message}`;
  else msgs.push({ role: 'user', content: parsed.message });
  return msgs;
}

/** Pregunta al tutor. Lanza BadRequest / UpstreamError; la cuota la gestiona la ruta. */
export async function askTutor(parsed, { config, fetchFn }) {
  const model = pickModel(parsed.mode, config.models);
  const { text } = await chat({ config, model, system: buildSystem(parsed), messages: buildMessages(parsed), maxTokens: MAX_TOKENS[parsed.mode] }, fetchFn);
  return { reply: text, model };
}
