import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { computeBuild, listAppFiles } from '../tools/build.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const html = read('index.html');

/** Dimensiones de un PNG leyendo su cabecera IHDR. */
function pngSize(file) {
  const b = readFileSync(join(ROOT, file));
  assert.equal(b.subarray(1, 4).toString(), 'PNG', `${file} no es un PNG`);
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
}

describe('index.html', () => {
  const refs = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((r) => !r.startsWith('#') && !/^(https?:|data:)/.test(r));

  it('todo recurso local referenciado existe', () => {
    assert.ok(refs.length >= 6);
    for (const r of refs) assert.ok(existsSync(join(ROOT, r)), `no existe: ${r}`);
  });

  it('no depende de ningún recurso externo (funciona 100 % offline)', () => {
    assert.ok(!/(?:href|src)="https?:/.test(html), 'hay recursos externos');
  });

  it('tiene lo mínimo de una PWA accesible', () => {
    assert.match(html, /<html lang="es/);
    assert.match(html, /name="viewport"/);
    assert.match(html, /<link rel="manifest" href="manifest\.json">/);
    assert.match(html, /name="theme-color" content="#002B49"/);
    assert.match(html, /apple-touch-icon/);
    assert.match(html, /<main id="app"/);
    assert.match(html, /no está afiliado a la UNAM/);
  });

  it('carga KaTeX antes que el módulo de la app', () => {
    assert.ok(html.indexOf('katex.min.js') < html.indexOf('js/main.js'));
  });
});

describe('manifest.json', () => {
  const m = JSON.parse(read('manifest.json'));

  it('campos requeridos para poder instalarse', () => {
    assert.equal(m.short_name, 'ElaMath');
    assert.equal(m.display, 'standalone');
    assert.ok(m.name.length > 0);
    assert.equal(m.theme_color, '#002B49');
    assert.ok(!m.start_url.startsWith('/'), 'start_url relativo para funcionar en subrutas (GitHub Pages)');
    assert.ok(!m.scope.startsWith('/'));
  });

  it('íconos existen y miden lo declarado, con uno maskable', () => {
    assert.ok(m.icons.some((i) => i.purpose === 'maskable'));
    for (const i of m.icons) {
      const [w, h] = i.sizes.split('x').map(Number);
      assert.deepEqual(pngSize(i.src), [w, h], i.src);
    }
    assert.ok(m.icons.some((i) => i.sizes === '192x192') && m.icons.some((i) => i.sizes === '512x512'));
    assert.deepEqual(pngSize('icons/apple-touch-icon.png'), [180, 180]);
  });
});

describe('precaché', () => {
  it('sw.js está sincronizado con los archivos (corre `npm run build` si falla)', () => {
    const { sw } = computeBuild();
    assert.equal(read('sw.js'), sw);
  });

  it('incluye todo lo que necesita la app para funcionar sin conexión', () => {
    const files = new Set(listAppFiles().map((f) => `./${f}`));
    for (const needed of [
      './index.html', './styles.css', './manifest.json', './js/main.js', './js/app.js', './js/logic.js',
      './js/db.js', './js/credits.js', './js/curriculum.js', './js/engine/index.js', './js/engine/templates.js',
      './js/engine/utils.js', './vendor/katex/katex.min.js', './vendor/katex/katex.min.css', './icons/icon-192.png',
    ]) assert.ok(files.has(needed), `falta en precaché: ${needed}`);
  });

  it('toda fuente que pide el CSS de KaTeX está en el precaché', () => {
    const css = read('vendor/katex/katex.min.css');
    const fonts = [...css.matchAll(/url\(([^)]+\.woff2)\)/g)].map((m) => m[1]);
    assert.ok(fonts.length >= 15);
    const files = new Set(listAppFiles());
    for (const f of fonts) assert.ok(files.has(`vendor/katex/${f}`), `fuente no encontrada: ${f}`);
    assert.ok(!/\.woff\)|\.ttf/.test(css), 'quedaron formatos pesados innecesarios');
  });

  it('el precaché es liviano (< 1.5 MB)', () => {
    const total = listAppFiles().reduce((n, f) => n + readFileSync(join(ROOT, f)).length, 0);
    assert.ok(total < 1.5 * 1024 * 1024, `pesa ${(total / 1024).toFixed(0)} KB`);
  });
});

// ── Comportamiento del service worker en un entorno simulado ─────
function loadServiceWorker(swSource) {
  const origin = 'https://elamath.test';
  const listeners = {};
  const stores = new Map(); // nombre → Map(url → Response)
  const calls = { skipWaiting: 0, claim: 0, fetched: [] };
  let online = true;

  const abs = (u) => new URL(typeof u === 'string' ? u : u.url, `${origin}/`).href;
  const makeCache = (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const s = stores.get(name);
    return {
      addAll: async (urls) => urls.forEach((u) => s.set(abs(u), { body: `precache:${u}`, ok: true, clone() { return this; } })),
      put: async (req, res) => void s.set(abs(req), res),
    };
  };
  const caches = {
    open: async (n) => makeCache(n),
    keys: async () => [...stores.keys()],
    delete: async (n) => stores.delete(n),
    match: async (req) => {
      const u = new URL(abs(req));
      u.search = '';
      for (const s of stores.values()) if (s.has(u.href)) return s.get(u.href);
      return undefined;
    },
  };
  const self = {
    location: { origin },
    addEventListener: (type, fn) => (listeners[type] = fn),
    skipWaiting: () => calls.skipWaiting++,
    clients: { claim: async () => calls.claim++ },
  };
  const fetchFn = async (req) => {
    calls.fetched.push(abs(req));
    if (!online) throw new TypeError('offline');
    return { ok: true, body: `red:${abs(req)}`, clone() { return this; } };
  };
  vm.runInNewContext(swSource, { self, caches, fetch: fetchFn, URL, Promise });

  const dispatch = async (type, extra = {}) => {
    let p;
    const event = { waitUntil: (x) => (p = x), respondWith: (x) => (p = x), ...extra };
    listeners[type](event);
    return p === undefined ? undefined : await p;
  };
  return { stores, calls, dispatch, setOnline: (v) => (online = v), listeners };
}

describe('service worker', () => {
  const sw = read('sw.js');
  const req = (url, extra = {}) => ({ url: `https://elamath.test${url}`, method: 'GET', mode: 'cors', ...extra });

  it('install: precachea todos los archivos y NO se salta la espera sola', async () => {
    const w = loadServiceWorker(sw);
    await w.dispatch('install');
    const [cacheName] = [...w.stores.keys()];
    assert.match(cacheName, /^elamath-[0-9a-f]{12}$/);
    const precache = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
    assert.equal(w.stores.get(cacheName).size, new Set(precache.map((p) => new URL(p, 'https://elamath.test/').href)).size);
    assert.equal(w.calls.skipWaiting, 0);
  });

  it('SKIP_WAITING solo ocurre cuando la app lo pide', async () => {
    const w = loadServiceWorker(sw);
    await w.dispatch('message', { data: { type: 'OTRO' } });
    assert.equal(w.calls.skipWaiting, 0);
    await w.dispatch('message', { data: { type: 'SKIP_WAITING' } });
    assert.equal(w.calls.skipWaiting, 1);
  });

  it('activate: borra cachés viejas de ElaMath y respeta las ajenas', async () => {
    const w = loadServiceWorker(sw);
    await w.dispatch('install');
    w.stores.set('elamath-viejo', new Map());
    w.stores.set('otra-app', new Map());
    await w.dispatch('activate');
    const names = [...w.stores.keys()];
    assert.ok(!names.includes('elamath-viejo'));
    assert.ok(names.includes('otra-app'));
    assert.equal(names.filter((n) => n.startsWith('elamath-')).length, 1);
    assert.equal(w.calls.claim, 1);
  });

  it('sin conexión: la navegación y los recursos salen de la caché', async () => {
    const w = loadServiceWorker(sw);
    await w.dispatch('install');
    w.setOnline(false);
    const nav = await w.dispatch('fetch', { request: req('/algun/ruta?x=1', { mode: 'navigate' }) });
    assert.match(nav.body, /index\.html/);
    for (const f of ['/js/app.js', '/styles.css', '/vendor/katex/katex.min.js', '/vendor/katex/fonts/KaTeX_Main-Regular.woff2']) {
      const res = await w.dispatch('fetch', { request: req(f) });
      assert.match(res.body, /^precache:/, f);
    }
    assert.equal(w.calls.fetched.length, 0, 'no debió tocar la red');
  });

  it('un recurso no precacheado se pide a la red y se guarda para después', async () => {
    const w = loadServiceWorker(sw);
    await w.dispatch('install');
    const r1 = await w.dispatch('fetch', { request: req('/nuevo.json') });
    assert.match(r1.body, /^red:/);
    w.setOnline(false);
    const r2 = await w.dispatch('fetch', { request: req('/nuevo.json') });
    assert.match(r2.body, /^red:/, 'ahora sale de la caché aunque no haya red');
  });

  it('ignora peticiones que no le corresponden (POST y otros orígenes)', async () => {
    const w = loadServiceWorker(sw);
    await w.dispatch('install');
    assert.equal(await w.dispatch('fetch', { request: req('/js/app.js', { method: 'POST' }) }), undefined);
    assert.equal(await w.dispatch('fetch', { request: { url: 'https://otro.com/x.js', method: 'GET', mode: 'cors' } }), undefined);
  });
});
