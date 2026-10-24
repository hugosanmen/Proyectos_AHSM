// Pruebas de la capa de proveedores de IA: Groq hoy, Anthropic mañana, sin que el resto del servidor lo note.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../server/config.js';
import { UpstreamError, callAnthropic, callGroq, chat, llmConfigured } from '../server/llm.js';
import { askTutor } from '../server/tutor.js';
import { routes } from '../server/routes.js';
import { GROQ_ENV, loginAs, grantPro, makeDeps } from './server.helpers.js';

const cap = (reply) => {
  const calls = [];
  return { calls, fetchFn: async (url, init) => (calls.push({ url, init, body: JSON.parse(init.body) }), reply(url)) };
};
const groqOk = (text) => () => ({ ok: true, status: 200, json: async () => ({ choices: [{ message: { content: text } }] }) });
const base = { SESSION_SECRET: 'x'.repeat(40), APP_URL: 'https://e.test' };

describe('selección de proveedor (config)', () => {
  it('sin claves no hay proveedor; con GROQ_API_KEY se usa Groq; solo ANTHROPIC_API_KEY usa Anthropic', () => {
    assert.equal(loadConfig(base).llm.provider, '');
    assert.equal(llmConfigured(loadConfig(base)), false);
    const g = loadConfig({ ...base, GROQ_API_KEY: 'gsk_1' });
    assert.deepEqual([g.llm.provider, g.llm.key, llmConfigured(g)], ['groq', 'gsk_1', true]);
    const a = loadConfig({ ...base, ANTHROPIC_API_KEY: 'sk-ant-1' });
    assert.deepEqual([a.llm.provider, a.llm.key], ['anthropic', 'sk-ant-1']);
  });
  it('con las dos claves gana Groq, salvo que LLM_PROVIDER=anthropic (el cambio futuro es solo una variable)', () => {
    const both = { ...base, GROQ_API_KEY: 'gsk_1', ANTHROPIC_API_KEY: 'sk-ant-1' };
    assert.equal(loadConfig(both).llm.provider, 'groq');
    const c = loadConfig({ ...both, LLM_PROVIDER: 'anthropic' });
    assert.deepEqual([c.llm.provider, c.llm.key, c.models.standard], ['anthropic', 'sk-ant-1', 'claude-sonnet-5-5']);
    // un LLM_PROVIDER sin su clave deja el tutor apagado en vez de mandar una clave a otro proveedor
    const sinClave = loadConfig({ ...base, GROQ_API_KEY: 'gsk_1', LLM_PROVIDER: 'anthropic' });
    assert.equal(llmConfigured(sinClave), false);
    assert.doesNotMatch(JSON.stringify(sinClave.llm), /gsk_1/);
  });
  it('modelos por defecto y reemplazables por variables de entorno', () => {
    const g = loadConfig({ ...base, GROQ_API_KEY: 'k' });
    assert.deepEqual(g.models, { fast: 'llama-3.1-8b-instant', standard: 'llama-3.3-70b-versatile', deep: 'openai/gpt-oss-120b', vision: 'qwen/qwen3.8-27b' });
    const o = loadConfig({ ...base, GROQ_API_KEY: 'k', GROQ_MODEL_STANDARD: 'otro/modelo', GROQ_MODEL_VISION: 'v/ision' });
    assert.deepEqual([o.models.standard, o.models.vision], ['otro/modelo', 'v/ision']);
    const a = loadConfig({ ...base, ANTHROPIC_API_KEY: 'k', MODEL_STANDARD: 'legacy' });
    assert.equal(a.models.standard, 'legacy', 'MODEL_* anteriores siguen funcionando');
  });
});

describe('callGroq', () => {
  it('manda formato OpenAI: Bearer, system como texto, max_completion_tokens y temperatura baja', async () => {
    const m = cap(groqOk('  hola  '));
    const out = await callGroq({ apiKey: 'gsk_x', model: 'llama-3.3-70b-versatile', system: [{ type: 'text', text: 'A', cache_control: { type: 'ephemeral' } }, { type: 'text', text: 'B' }], messages: [{ role: 'user', content: 'q' }], maxTokens: 300 }, m.fetchFn);
    assert.equal(out.text, 'hola');
    const [c] = m.calls;
    assert.equal(c.url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(c.init.headers.authorization, 'Bearer gsk_x');
    assert.deepEqual(c.body.messages[0], { role: 'system', content: 'A\n\nB' });
    assert.deepEqual(c.body.messages[1], { role: 'user', content: 'q' });
    assert.equal(c.body.max_completion_tokens, 300);
    assert.ok(c.body.temperature <= 0.5);
    assert.equal(c.body.reasoning_effort, undefined);
    assert.doesNotMatch(JSON.stringify(c.body), /cache_control/, 'Groq no recibe campos de Anthropic');
  });
  it('modelos de razonamiento (gpt-oss): esfuerzo medio, sin razonamiento en la respuesta y más margen de tokens', async () => {
    const m = cap(groqOk('ok'));
    await callGroq({ apiKey: 'k', model: 'openai/gpt-oss-120b', system: 's', messages: [{ role: 'user', content: 'q' }], maxTokens: 400 }, m.fetchFn);
    const b = m.calls[0].body;
    assert.deepEqual([b.reasoning_effort, b.include_reasoning], ['medium', false]);
    assert.ok(b.max_completion_tokens > 400);
  });
  it('imágenes viajan como image_url con data URL', async () => {
    const m = cap(groqOk('ok'));
    await callGroq({ apiKey: 'k', model: 'v', system: 's', messages: [{ role: 'user', content: [{ type: 'image', mediaType: 'image/jpeg', data: 'AAAA' }, { type: 'text', text: 'mira' }] }], maxTokens: 100 }, m.fetchFn);
    assert.deepEqual(m.calls[0].body.messages[1].content, [{ type: 'image_url', image_url: { url: 'data:image/jpeg;base64,AAAA' } }, { type: 'text', text: 'mira' }]);
  });
  it('errores de red, estado, JSON o respuesta vacía → UpstreamError sin detalles', async () => {
    const call = (fetchFn) => callGroq({ apiKey: 'secreta', model: 'm', system: 's', messages: [{ role: 'user', content: 'q' }], maxTokens: 10 }, fetchFn);
    await assert.rejects(call(async () => { throw new TypeError('boom secreta'); }), (e) => e instanceof UpstreamError && !/secreta/.test(e.message));
    await assert.rejects(call(async () => ({ ok: false, status: 429, json: async () => ({}) })), UpstreamError);
    await assert.rejects(call(async () => ({ ok: true, json: async () => { throw new SyntaxError('x'); } })), UpstreamError);
    await assert.rejects(call(groqOk('   ')), UpstreamError);
    await assert.rejects(call(async () => ({ ok: true, json: async () => ({ choices: [] }) })), UpstreamError);
  });
});

describe('callAnthropic con imágenes y chat()', () => {
  it('Anthropic recibe bloques base64 y cabeceras propias', async () => {
    const m = cap(() => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: 'listo' }] }) }));
    const out = await callAnthropic({ apiKey: 'sk-ant-1', model: 'claude-sonnet-5-5', system: [{ type: 'text', text: 'S' }], messages: [{ role: 'user', content: [{ type: 'image', mediaType: 'image/png', data: 'QQ' }, { type: 'text', text: 't' }] }], maxTokens: 50 }, m.fetchFn);
    assert.equal(out.text, 'listo');
    const c = m.calls[0];
    assert.equal(c.url, 'https://api.anthropic.com/v1/messages');
    assert.equal(c.init.headers['x-api-key'], 'sk-ant-1');
    assert.equal(c.init.headers['anthropic-version'], '2023-06-01');
    assert.deepEqual(c.body.messages[0].content[0], { type: 'image', source: { type: 'base64', media_type: 'image/png', data: 'QQ' } });
  });
  it('chat() enruta según el proveedor y falla si no hay ninguno', async () => {
    const g = cap(groqOk('de groq'));
    const cg = loadConfig({ ...base, GROQ_API_KEY: 'gsk_1' });
    assert.equal((await chat({ config: cg, model: 'm', system: 's', messages: [{ role: 'user', content: 'q' }], maxTokens: 10 }, g.fetchFn)).text, 'de groq');
    assert.match(g.calls[0].url, /groq\.com/);
    await assert.rejects(chat({ config: loadConfig(base), model: 'm', system: 's', messages: [], maxTokens: 1 }, g.fetchFn), UpstreamError);
  });
});

describe('el tutor con Groq de punta a punta', () => {
  it('askTutor usa el modelo de Groq del modo y el contexto verificado', async () => {
    const { deps, ai } = makeDeps({ env: GROQ_ENV, anthropic: { reply: 'Pista con Groq' } });
    const out = await askTutor({ message: 'ayuda', mode: 'hint', history: [], exercise: { templateId: 'derivada-cadena', seed: 7, pickedIndex: null } }, deps);
    assert.equal(out.reply, 'Pista con Groq');
    assert.match(ai.calls[0].url, /groq\.com/);
    assert.equal(ai.calls[0].body.model, 'llama-3.1-8b-instant');
    assert.match(ai.calls[0].body.messages[0].content, /CONTEXTO VERIFICADO/);
  });
  it('por la ruta: entra, tiene prueba gratis, pregunta y la API de Groq recibe la clave (solo en el servidor)', async () => {
    const { deps, sent, ai } = makeDeps({ env: GROQ_ENV });
    const { headers } = await loginAs(routes, deps, sent);
    const r = await routes.tutor({ headers, body: { message: 'hola' }, ip: '1.1.1.1' }, deps);
    assert.equal(r.status, 200);
    assert.equal(ai.calls[0].init.headers.authorization, 'Bearer gsk_test');
    assert.doesNotMatch(JSON.stringify(r.body), /gsk_|groq|llama/i, 'la respuesta no expone clave, proveedor ni modelo');
    const h = (await routes.health({}, deps)).body;
    assert.deepEqual([h.tutor, h.provider], [true, 'groq']);
    assert.doesNotMatch(JSON.stringify(h), /gsk_/);
  });
  it('si se agrega ANTHROPIC_API_KEY + LLM_PROVIDER=anthropic, la misma ruta usa Anthropic', async () => {
    const { deps, sent, ai } = makeDeps({ env: { GROQ_API_KEY: 'gsk_test', LLM_PROVIDER: 'anthropic' } });
    const { headers } = await loginAs(routes, deps, sent);
    await grantPro(routes, deps);
    const r = await routes.tutor({ headers, body: { message: 'hola' }, ip: '1.1.1.1' }, deps);
    assert.equal(r.status, 200);
    assert.match(ai.calls[0].url, /anthropic\.com/);
    assert.equal(ai.calls[0].init.headers['x-api-key'], 'sk-ant-test');
  });
});
