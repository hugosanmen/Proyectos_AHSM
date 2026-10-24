// Utilidades compartidas por las pruebas del servidor.

import { loadConfig } from '../server/config.js';
import { MemoryStore } from '../server/store.js';

export const SECRET = 's3cret-'.repeat(6);
export const ADMIN = 'admin-token-de-prueba-1234567890';

export function makeClock(start = Date.parse('2026-10-20T16:00:00Z')) {
  const c = { t: start, now: () => c.t, advance: (ms) => (c.t += ms) };
  return c;
}

/** Respuesta simulada de la API de Anthropic o de Groq (según la URL). `reply` puede ser una función (call) => texto. */
export function mockAnthropic({ reply = 'Mira, aquí el truco es $x$.', status = 200, throwNetwork = false } = {}) {
  const calls = [];
  const fetchFn = async (url, init) => {
    const call = { url, init, body: JSON.parse(init.body), headers: init.headers };
    calls.push(call);
    if (throwNetwork) throw new TypeError('network down');
    if (status !== 200) return { ok: false, status, json: async () => ({ error: 'x' }) };
    const text = typeof reply === 'function' ? reply(call) : reply;
    if (/groq\.com/.test(url)) return { ok: true, status: 200, json: async () => ({ choices: [{ message: { role: 'assistant', content: text } }], usage: { prompt_tokens: 10, completion_tokens: 20 } }) };
    return { ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text }], usage: { input_tokens: 10, output_tokens: 20 } }) };
  };
  return { fetchFn, calls };
}

export function makeDeps({ env = {}, anthropic = {}, clock = makeClock(), mailerFails = false } = {}) {
  const config = loadConfig({
    SESSION_SECRET: SECRET,
    APP_URL: 'https://elamath.test',
    ANTHROPIC_API_KEY: 'sk-ant-test',
    RESEND_API_KEY: 're_test',
    EMAIL_FROM: 'ElaMath <hola@elamath.test>',
    ADMIN_TOKEN: ADMIN,
    BILLING_ENABLED: '1', // las pruebas de cobro/prueba gratis parten de cobro activo; las de etapa de pruebas lo apagan
    ...env,
  });
  const store = new MemoryStore({ now: clock.now });
  const sent = [];
  const mailer = mailerFails
    ? { send: async () => { throw new Error('email_failed'); } }
    : { send: async (m) => void sent.push(m) };
  const ai = mockAnthropic(anthropic);
  const deps = { config, store, storeKind: 'memory', mailer, fetchFn: ai.fetchFn, now: clock.now };
  return { deps, sent, ai, clock, store, config };
}

export const tokenFromEmail = (mail) => /\?login=([\w-]+)/.exec(mail.text)[1];

/** Hace login completo y devuelve { session, headers }. */
export async function loginAs(routes, deps, sent, email = 'ana@correo.com') {
  await routes.authRequest({ body: { email }, headers: {}, ip: '1.1.1.1' }, deps);
  const token = tokenFromEmail(sent[sent.length - 1]);
  const out = await routes.authVerify({ body: { token }, headers: {}, ip: '1.1.1.1' }, deps);
  return { session: out.body.session, headers: { authorization: `Bearer ${out.body.session}` } };
}

export async function grantPro(routes, deps, email = 'ana@correo.com', days) {
  return routes.adminPlan({ body: { email, plan: 'pro', days }, headers: { authorization: `Bearer ${ADMIN}` }, ip: '9.9.9.9' }, deps);
}

/** JPEG mínimo válido (solo la firma importa para el servidor) en base64. */
export const TINY_JPEG_B64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0xff, 0xd9]).toString('base64');
export const GROQ_ENV = { ANTHROPIC_API_KEY: '', GROQ_API_KEY: 'gsk_test' };
