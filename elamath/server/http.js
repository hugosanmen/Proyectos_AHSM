// http.js — adaptador entre las funciones de Vercel (req, res de Node) y las rutas puras.

import { loadConfig } from './config.js';
import { createMailer } from './mail.js';
import { createStore } from './store.js';

const DEFAULT_MAX_BODY = 32 * 1024; // el escáner pide más (foto reducida en el navegador)

let cached = null;
export function getDeps() {
  if (!cached) {
    const config = loadConfig();
    const { kind, store } = createStore(config);
    cached = { config, store, storeKind: kind, mailer: createMailer(config), fetchFn: (...a) => globalThis.fetch(...a), now: () => Date.now() };
  }
  return cached;
}
/** Solo para pruebas. */
export const setDeps = (d) => (cached = d);

async function readBody(req, maxBody) {
  let raw = req.body;
  if (raw === undefined) {
    const chunks = [];
    let size = 0;
    for await (const c of req) {
      size += c.length;
      if (size > maxBody) throw Object.assign(new Error('too_large'), { status: 413 });
      chunks.push(c);
    }
    raw = Buffer.concat(chunks).toString('utf8');
  }
  if (raw === '' || raw === null) return undefined;
  if (Buffer.isBuffer(raw)) raw = raw.toString('utf8');
  if (typeof raw === 'string') {
    if (raw.length > maxBody) throw Object.assign(new Error('too_large'), { status: 413 });
    try {
      return JSON.parse(raw);
    } catch {
      throw Object.assign(new Error('bad_json'), { status: 400 });
    }
  }
  return raw;
}

const clientIp = (req) =>
  String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() || String(req.headers['x-real-ip'] || '') || req.socket?.remoteAddress || '';

/** Convierte una ruta pura en un handler de Vercel. */
export function wrap(route, { methods, maxBody = DEFAULT_MAX_BODY }) {
  return async function handler(req, res) {
    const send = (status, body) => {
      res.statusCode = status;
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Cache-Control', 'no-store');
      res.end(JSON.stringify(body));
    };
    if (!methods.includes(req.method)) {
      res.setHeader('Allow', methods.join(', '));
      return send(405, { code: 'method_not_allowed' });
    }
    try {
      const body = req.method === 'GET' ? undefined : await readBody(req, maxBody);
      const out = await route({ method: req.method, headers: req.headers, body, ip: clientIp(req) }, getDeps());
      return send(out.status, out.body);
    } catch (err) {
      if (err?.status === 413 || err?.status === 400) return send(err.status, { code: err.message });
      console.error('api_error', err?.message ?? 'unknown'); // nunca se registran cuerpos, correos ni claves
      return send(500, { code: 'server_error' });
    }
  };
}
