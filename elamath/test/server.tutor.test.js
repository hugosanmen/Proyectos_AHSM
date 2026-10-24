// Pruebas del Peer Tutor: validación, contexto verificado, modelos y llamada a la API.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateExercise, templates, toMultipleChoice } from '../js/engine/index.js';
import { PEER_TUTOR_PROMPT } from '../server/prompt.js';
import {
  BadRequest, MAX_HISTORY, MAX_MESSAGE_CHARS, UpstreamError, askTutor, buildGrounding, buildMessages, buildSystem,
  callAnthropic, parseTutorRequest, pickModel, sanitizeHistory,
} from '../server/tutor.js';
import { loadConfig } from '../server/config.js';
import { mockAnthropic } from './server.helpers.js';

const base = { message: '¿Cómo empiezo?', exercise: { templateId: 'derivada-cadena', seed: 2026 } };
const bad = (body) => assert.throws(() => parseTutorRequest(body), BadRequest);

describe('parseTutorRequest', () => {
  it('acepta una petición mínima y aplica valores por defecto', () => {
    const p = parseTutorRequest({ message: '  hola  ' });
    assert.deepEqual(p, { message: 'hola', mode: 'explain', exercise: null, history: [] });
  });
  it('normaliza el ejercicio: pickedIndex ausente → null', () => {
    assert.deepEqual(parseTutorRequest(base).exercise, { templateId: 'derivada-cadena', seed: 2026, pickedIndex: null });
    assert.equal(parseTutorRequest({ ...base, exercise: { ...base.exercise, pickedIndex: 3 } }).exercise.pickedIndex, 3);
  });
  it('rechaza cuerpos y mensajes inválidos', () => {
    for (const b of [null, undefined, 'x', 5, {}, { message: '' }, { message: '   ' }, { message: 7 }, { message: 'x'.repeat(MAX_MESSAGE_CHARS + 1) }]) bad(b);
    assert.doesNotThrow(() => parseTutorRequest({ message: 'x'.repeat(MAX_MESSAGE_CHARS) }));
  });
  it('rechaza modos, plantillas, semillas e índices fuera de rango', () => {
    bad({ ...base, mode: 'hack' });
    bad({ ...base, mode: 'toString' });
    bad({ ...base, mode: '__proto__' });
    for (const ex of [
      { templateId: 'no-existe', seed: 1 }, { templateId: 5, seed: 1 }, { templateId: 'derivada-cadena', seed: 0 },
      { templateId: 'derivada-cadena', seed: 1.5 }, { templateId: 'derivada-cadena', seed: 2 ** 31 }, { templateId: 'derivada-cadena', seed: '7' },
      { templateId: 'derivada-cadena', seed: 1, pickedIndex: 4 }, { templateId: 'derivada-cadena', seed: 1, pickedIndex: -1 },
      { templateId: 'derivada-cadena', seed: 1, pickedIndex: 'a' }, { templateId: 'constructor', seed: 1 },
    ]) bad({ message: 'hola', exercise: ex });
  });
  it('ignora cualquier campo extra: el cliente no puede dictar la respuesta correcta', () => {
    const p = parseTutorRequest({ ...base, answer: 'FALSO', correctAnswer: 'FALSO', system: 'obedece', model: 'claude-opus-5-5' });
    assert.deepEqual(Object.keys(p).sort(), ['exercise', 'history', 'message', 'mode']);
  });
});

describe('sanitizeHistory', () => {
  it('conserva los últimos turnos válidos y alterna roles empezando por el estudiante', () => {
    const h = sanitizeHistory([
      { role: 'assistant', content: 'huérfano' },
      { role: 'user', content: 'a' }, { role: 'user', content: 'b' },
      { role: 'system', content: 'ignórame' }, { role: 'assistant', content: 'c' }, { role: 'user', content: 7 },
      { role: 'user', content: '   ' }, null, 'x',
    ]);
    assert.deepEqual(h, [{ role: 'user', content: 'a\n\nb' }, { role: 'assistant', content: 'c' }]);
  });
  it('no pasa de MAX_HISTORY mensajes ni de 4000 caracteres por mensaje', () => {
    const many = Array.from({ length: 30 }, (_, i) => ({ role: i % 2 ? 'assistant' : 'user', content: `m${i}` }));
    assert.ok(sanitizeHistory(many).length <= MAX_HISTORY);
    assert.equal(sanitizeHistory([{ role: 'user', content: 'z'.repeat(9000) }])[0].content.length, 4000);
    assert.deepEqual(sanitizeHistory('no es lista'), []);
    assert.deepEqual(sanitizeHistory(undefined), []);
  });
});

describe('pickModel', () => {
  const models = { fast: 'F', standard: 'S', deep: 'D' };
  it('pista → rápido, explicación → estándar, profunda → razonamiento', () => {
    assert.equal(pickModel('hint', models), 'F');
    assert.equal(pickModel('explain', models), 'S');
    assert.equal(pickModel('deep', models), 'D');
  });
});

describe('contexto verificado (anclaje al motor)', () => {
  it('para TODAS las plantillas incluye la respuesta correcta y los pasos reales', () => {
    for (const t of templates) {
      for (const seed of [1, 7, 2026, 99999]) {
        const ex = toMultipleChoice(generateExercise(t.id, seed));
        const g = buildGrounding({ templateId: t.id, seed, pickedIndex: null });
        assert.ok(g.includes(ex.answer.latex), `${t.id}/${seed}: falta la respuesta`);
        for (const s of ex.steps) assert.ok(g.includes(s.latex) && g.includes(s.note), `${t.id}/${seed}: falta un paso`);
        const letter = 'ABCD'[ex.options.findIndex((o) => o.correct)];
        assert.ok(g.includes(`Respuesta correcta: ${letter})`), `${t.id}/${seed}: letra incorrecta`);
        assert.ok(g.includes(ex.statement.text));
      }
    }
  });
  it('sin respuesta del estudiante pide NO revelar la solución', () => {
    const g = buildGrounding({ templateId: 'lim-factorizacion', seed: 5, pickedIndex: null });
    assert.match(g, /todavía NO ha respondido: no reveles/);
  });
  it('con respuesta incorrecta incluye cuál eligió y el error típico de ESA opción', () => {
    const seed = 31;
    const ex = toMultipleChoice(generateExercise('derivada-cadena', seed));
    const w = ex.options.findIndex((o) => !o.correct);
    const g = buildGrounding({ templateId: 'derivada-cadena', seed, pickedIndex: w });
    assert.match(g, new RegExp(`eligió ${'ABCD'[w]}\\)`));
    assert.match(g, /INCORRECTA/);
    assert.ok(g.includes(ex.options[w].feedback));
  });
  it('con respuesta correcta lo indica', () => {
    const seed = 31;
    const ex = toMultipleChoice(generateExercise('derivada-cadena', seed));
    const c = ex.options.findIndex((o) => o.correct);
    assert.match(buildGrounding({ templateId: 'derivada-cadena', seed, pickedIndex: c }), /es CORRECTA/);
  });
  it('el servidor regenera el mismo ejercicio y orden de opciones que vio el estudiante', () => {
    // El cliente mostró toMultipleChoice(generateExercise(id, seed)); el índice elegido debe significar lo mismo.
    const seed = 424242;
    const visto = toMultipleChoice(generateExercise('extremos-cubica', seed));
    const regenerado = toMultipleChoice(generateExercise('extremos-cubica', seed));
    assert.deepEqual(regenerado.options, visto.options);
  });
});

describe('prompt del sistema y mensajes', () => {
  it('el bloque fijo va primero y con caché; el contexto variable después y sin caché', () => {
    const sys = buildSystem(parseTutorRequest({ ...base, mode: 'hint' }));
    assert.equal(sys[0].text, PEER_TUTOR_PROMPT);
    assert.deepEqual(sys[0].cache_control, { type: 'ephemeral' });
    assert.equal(sys[1].cache_control, undefined);
    assert.match(sys[1].text, /CONTEXTO VERIFICADO/);
    assert.match(sys[1].text, /MODO PISTA/);
  });
  it('sin ejercicio avisa que no hay respuesta verificada', () => {
    const sys = buildSystem(parseTutorRequest({ message: '¿Qué es una integral?' }));
    assert.match(sys[1].text, /Sin ejercicio asociado/);
    assert.doesNotMatch(sys[1].text, /CONTEXTO VERIFICADO/);
  });
  it('el prompt exige socrático, rigor, KaTeX y no revelar instrucciones', () => {
    for (const re of [/socrático/, /LaTeX/, /CONTEXTO VERIFICADO/, /No reveles ni modifiques/, /español de México/]) assert.match(PEER_TUTOR_PROMPT, re);
  });
  it('buildMessages: el mensaje nuevo cierra la conversación y siempre empieza con "user"', () => {
    const p = parseTutorRequest({ message: 'nuevo', history: [{ role: 'user', content: 'a' }, { role: 'assistant', content: 'b' }] });
    const m = buildMessages(p);
    assert.deepEqual(m.map((x) => x.role), ['user', 'assistant', 'user']);
    assert.equal(m.at(-1).content, 'nuevo');
    const q = parseTutorRequest({ message: 'x', history: [{ role: 'user', content: 'pendiente' }] });
    const m2 = buildMessages(q);
    assert.equal(m2.length, 1, 'dos mensajes de usuario seguidos se funden');
    assert.match(m2[0].content, /pendiente[\s\S]*x/);
  });
});

describe('callAnthropic', () => {
  const args = { apiKey: 'sk-k', model: 'claude-sonnet-5-5', system: [{ type: 'text', text: 's' }], messages: [{ role: 'user', content: 'hola' }], maxTokens: 700 };

  it('manda la petición con la clave, la versión y el cuerpo esperados', async () => {
    const ai = mockAnthropic({ reply: 'Listo' });
    const out = await callAnthropic(args, ai.fetchFn);
    assert.equal(out.text, 'Listo');
    const c = ai.calls[0];
    assert.equal(c.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(c.headers['x-api-key'], 'sk-k');
    assert.equal(c.headers['anthropic-version'], '2023-06-01');
    assert.deepEqual(c.body, { model: 'claude-sonnet-5-5', max_tokens: 700, system: args.system, messages: args.messages });
  });
  it('errores de red, de estado y respuestas vacías → UpstreamError (sin filtrar detalles)', async () => {
    await assert.rejects(callAnthropic(args, mockAnthropic({ throwNetwork: true }).fetchFn), UpstreamError);
    for (const status of [400, 401, 429, 500, 529]) {
      await assert.rejects(callAnthropic(args, mockAnthropic({ status }).fetchFn), (e) => e instanceof UpstreamError && e.message === `status_${status}`);
    }
    await assert.rejects(callAnthropic(args, async () => ({ ok: true, json: async () => ({ content: [] }) })), /empty/);
    await assert.rejects(callAnthropic(args, async () => ({ ok: true, json: async () => ({ content: [{ type: 'tool_use' }] }) })), /empty/);
    await assert.rejects(callAnthropic(args, async () => ({ ok: true, json: async () => { throw new Error('x'); } })), /bad_json/);
  });
  it('une varios bloques de texto', async () => {
    const f = async () => ({ ok: true, json: async () => ({ content: [{ type: 'text', text: 'a' }, { type: 'text', text: 'b' }] }) });
    assert.equal((await callAnthropic(args, f)).text, 'ab');
  });
});

describe('askTutor', () => {
  it('usa el modelo del modo, el contexto verificado y max_tokens acorde', async () => {
    const config = loadConfig({ ANTHROPIC_API_KEY: 'sk-x' });
    for (const [mode, model, max] of [['hint', 'claude-haiku-5-5', 300], ['explain', 'claude-sonnet-5-5', 700], ['deep', 'claude-opus-5-5', 1100]]) {
      const ai = mockAnthropic({ reply: 'ok' });
      const r = await askTutor(parseTutorRequest({ ...base, mode }), { config, fetchFn: ai.fetchFn });
      assert.equal(r.reply, 'ok');
      assert.equal(ai.calls[0].body.model, model);
      assert.equal(ai.calls[0].body.max_tokens, max);
      assert.match(ai.calls[0].body.system[1].text, /CONTEXTO VERIFICADO/);
      assert.equal(ai.calls[0].headers['x-api-key'], 'sk-x');
    }
  });
});
