// tools/dev-server.mjs — servidor local: sirve public/ con los MISMOS encabezados de vercel.json
// y monta las funciones de api/ tal cual las ejecutaría Vercel.
// Uso:  npm run dev   (construye public/ y abre http://localhost:3000)
// Sin GROQ_API_KEY ni ANTHROPIC_API_KEY el tutor y el escáner responden con un texto simulado; sin RESEND_API_KEY el enlace de acceso
// aparece en pantalla (modo desarrollo). NO usar en producción.

import { createServer } from 'node:http';
import { createServer as netServer } from 'node:net';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from './build.mjs';
import { loadConfig } from '../server/config.js';
import { createMailer } from '../server/mail.js';
import { createStore } from '../server/store.js';
import { setDeps } from '../server/http.js';
import { llmConfigured } from '../server/llm.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json' };
const API = ['health', 'me', 'tutor', 'report', 'auth/request', 'auth/verify', 'admin/plan', 'admin/reports', 'admin/promo', 'promo/redeem', 'scan'];

const vercel = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
const headerRules = vercel.headers.map((r) => ({ re: new RegExp(`^${r.source.replace(/\(\.\*\)/g, '.*')}$`), headers: r.headers }));

/** Respuesta simulada de la IA (formato Anthropic y Groq a la vez) cuando no hay clave: probar la interfaz sin gastar. */
const FAKE_TEXT = 'Piensa en la **regla de la cadena**: deriva primero lo de afuera y luego multiplica por la derivada de lo de adentro, $f(g(x))$.';
const fakeLlm = async () => ({ ok: true, status: 200, json: async () => ({ content: [{ type: 'text', text: FAKE_TEXT }], choices: [{ message: { content: FAKE_TEXT } }], usage: {} }) });

export async function startDevServer({ port = 3000, publicDir = 'public', env = process.env, quiet = false } = {}) {
  if (port === 0) {
    // puerto libre: APP_URL (enlaces de acceso) necesita conocerlo antes de arrancar
    port = await new Promise((ok) => { const t = netServer().listen(0, '127.0.0.1', () => { const { port: f } = t.address(); t.close(() => ok(f)); }); });
  }
  build({ out: publicDir });
  const full = { ELAMATH_DEV: '1', SESSION_SECRET: 'dev-secret-dev-secret-dev-secret-0123456789', ADMIN_TOKEN: 'dev-admin-token-0123456789', ...env };
  full.APP_URL = full.APP_URL || `http://localhost:${port}`;
  const config = loadConfig(full);
  const { kind, store } = createStore(config);
  const deps = {
    config, store, storeKind: kind, mailer: createMailer(config), now: () => Date.now(),
    fetchFn: llmConfigured(config) ? (...a) => globalThis.fetch(...a) : fakeLlm,
  };
  if (!llmConfigured(config)) Object.assign(config.llm, { provider: 'anthropic', key: 'dev-fake-key' });
  setDeps(deps);

  const handlers = {};
  for (const r of API) handlers[`/api/${r}`] = (await import(pathToFileURL(join(ROOT, 'api', `${r}.js`)).href)).default;

  const base = join(ROOT, publicDir);
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    for (const rule of headerRules) if (rule.re.test(url.pathname)) for (const h of rule.headers) res.setHeader(h.key, h.value);
    const handler = handlers[url.pathname];
    if (handler) return handler(req, res);
    let rel = decodeURIComponent(url.pathname);
    if (rel.endsWith('/')) rel += 'index.html';
    const file = normalize(join(base, rel));
    if (!file.startsWith(base) || !existsSync(file) || !statSync(file).isFile()) {
      res.statusCode = 404;
      return res.end('No encontrado');
    }
    res.setHeader('Content-Type', TYPES[extname(file)] ?? 'application/octet-stream');
    res.end(readFileSync(file));
  });
  await new Promise((ok) => server.listen(port, '127.0.0.1', ok));
  const { port: p } = server.address();
  if (!quiet) console.log(`ElaMath en http://localhost:${p}  (modo desarrollo, admin: ${full.ADMIN_TOKEN})`);
  return { server, url: `http://localhost:${p}`, deps, adminToken: full.ADMIN_TOKEN, close: () => new Promise((ok) => server.close(ok)) };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await startDevServer({ port: Number(process.env.PORT) || 3000 });
