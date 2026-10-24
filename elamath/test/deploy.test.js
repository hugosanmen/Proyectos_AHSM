// Pruebas de la configuración de despliegue: vercel.json, carpeta pública, API y service worker.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, listAppFiles } from '../tools/build.mjs';
import { routes } from '../server/routes.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const read = (f) => readFileSync(join(ROOT, f), 'utf8');
const vercel = JSON.parse(read('vercel.json'));

function walk(dir, base = dir) {
  const out = [];
  for (const n of readdirSync(dir)) {
    const full = join(dir, n);
    if (statSync(full).isDirectory()) out.push(...walk(full, base));
    else out.push(full.slice(base.length + 1).split('\\').join('/'));
  }
  return out.sort();
}

describe('vercel.json', () => {
  it('publica solo public/ y la construye con --out public', () => {
    assert.equal(vercel.outputDirectory, 'public');
    assert.match(vercel.buildCommand, /node tools\/build\.mjs --out public/);
    assert.equal(vercel.framework, null);
  });
  it('encabezados de seguridad: CSP estricta, nosniff, sin marcos', () => {
    const all = vercel.headers.find((h) => h.source === '/(.*)').headers;
    const get = (k) => all.find((h) => h.key === k)?.value;
    const csp = get('Content-Security-Policy');
    for (const d of ["default-src 'self'", "script-src 'self'", "object-src 'none'", "base-uri 'self'", "frame-ancestors 'none'", "connect-src 'self'", "font-src 'self'"]) {
      assert.ok(csp.includes(d), `CSP sin ${d}`);
    }
    assert.ok(!/script-src[^;]*unsafe/.test(csp), 'los scripts no permiten inline ni eval');
    assert.ok(!/https?:/.test(csp), 'la CSP no abre dominios externos');
    assert.equal(get('X-Content-Type-Options'), 'nosniff');
    assert.equal(get('X-Frame-Options'), 'DENY');
    assert.ok(get('Referrer-Policy'));
  });
  it('sw.js nunca se cachea en el navegador', () => {
    const sw = vercel.headers.find((h) => h.source === '/sw.js');
    assert.equal(sw.headers[0].value, 'no-cache');
  });
  it('las funciones configuradas existen', () => {
    for (const f of Object.keys(vercel.functions)) assert.ok(existsSync(join(ROOT, f)), f);
    assert.ok(vercel.functions['api/tutor.js'].maxDuration >= 20, 'la IA puede tardar');
  });
  it('index.html no usa scripts ni estilos en línea (compatible con la CSP)', () => {
    const html = read('index.html');
    assert.ok(!/<script(?![^>]*\bsrc=)[^>]*>/i.test(html), 'hay <script> en línea');
    assert.ok(!/\son[a-z]+\s*=/i.test(html), 'hay manejadores on* en línea');
    assert.ok(!/<style[\s>]/i.test(html), 'hay <style> en línea');
  });
});

describe('funciones de la API', () => {
  const files = walk(join(ROOT, 'api'));
  it('cada archivo de api/ exporta un handler ligado a una ruta existente', () => {
    assert.ok(files.length >= 8);
    for (const f of files) {
      const src = read(`api/${f}`);
      const m = /wrap\(routes\.(\w+),\s*\{\s*methods:\s*\[([^\]]+)\]/.exec(src);
      assert.ok(m, `${f}: no usa wrap(routes.x, { methods })`);
      assert.equal(typeof routes[m[1]], 'function', `${f}: routes.${m[1]} no existe`);
      assert.match(src, /export default/);
    }
  });
  it('no pasa de 12 funciones (límite del plan gratuito de Vercel)', () => {
    assert.ok(files.length <= 12, `hay ${files.length}`);
  });
  it('cada ruta pública de la API tiene su archivo', () => {
    for (const r of ['health', 'me', 'tutor', 'report', 'scan', 'auth/request', 'auth/verify', 'admin/plan', 'admin/reports', 'admin/promo', 'promo/redeem']) {
      assert.ok(files.includes(`${r}.js`), r);
    }
  });
  it('el escáner (foto) tiene más tiempo y más cuerpo permitido que el resto; las demás rutas siguen con 32 KB', () => {
    const cfg = JSON.parse(read('vercel.json')).functions;
    assert.equal(cfg['api/scan.js'].maxDuration, 30);
    assert.match(read('api/scan.js'), /maxBody:\s*2\.2 \* 1024 \* 1024/);
    for (const f of files.filter((x) => x !== 'scan.js')) assert.doesNotMatch(read(`api/${f}`), /maxBody/, `${f} no debe aceptar cuerpos grandes`);
  });
  it('el código del servidor no depende de paquetes externos (sin npm en producción)', () => {
    const imports = [...files.map((f) => read(`api/${f}`)), ...walk(join(ROOT, 'server')).map((f) => read(`server/${f}`))]
      .flatMap((s) => [...s.matchAll(/from\s+'([^']+)'/g)].map((m) => m[1]));
    for (const i of imports) assert.ok(i.startsWith('.') || i.startsWith('node:'), `dependencia externa: ${i}`);
  });
  it('ningún archivo del servidor ni de la app contiene claves o secretos escritos en el código', () => {
    const bad = /sk-ant-[A-Za-z0-9_-]{10,}|gsk_[A-Za-z0-9]{20,}|re_[A-Za-z0-9]{16,}|-----BEGIN [A-Z ]*PRIVATE KEY/;
    for (const f of [...walk(join(ROOT, 'server')).map((x) => `server/${x}`), ...walk(join(ROOT, 'api')).map((x) => `api/${x}`), ...listAppFiles().filter((x) => /\.(js|html|json|css)$/.test(x) && !x.startsWith('vendor/'))]) {
      assert.ok(!bad.test(read(f)), `posible secreto en ${f}`);
    }
  });
});

describe('carpeta pública (build --out)', () => {
  it('contiene la app y el service worker, pero ningún código de servidor ni de pruebas', () => {
    const out = '.build-test-public';
    try {
      build({ out, updateSw: false }); // no reescribe sw.js: otras pruebas lo leen en paralelo
      const pub = walk(join(ROOT, out));
      for (const need of ['index.html', 'sw.js', 'manifest.json', 'styles.css', 'js/app.js', 'js/api.js', 'js/exam.js', 'js/image.js', 'js/engine/index.js', 'vendor/katex/katex.min.js', 'icons/icon-192.png']) {
        assert.ok(pub.includes(need), `falta ${need}`);
      }
      for (const f of pub) {
        assert.ok(!/^(api|server|test|tools|node_modules|public)\//.test(f), `no debe publicarse: ${f}`);
        assert.ok(!['package.json', 'package-lock.json', 'vercel.json', 'README.md', '.gitignore'].includes(f), `no debe publicarse: ${f}`);
      }
      assert.equal(readFileSync(join(ROOT, out, 'sw.js'), 'utf8'), read('sw.js'), 'sw.js público = sw.js actualizado');
    } finally {
      rmSync(join(ROOT, out), { recursive: true, force: true });
    }
  });
  it('el precaché nunca incluye api/ ni server/', () => {
    const sw = read('sw.js');
    const list = JSON.parse(sw.match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]);
    assert.ok(list.length > 30);
    for (const f of list) assert.ok(!/^\.\/(api|server|test|tools)\//.test(f), f);
  });
  it('rechaza carpetas de salida peligrosas (no borra el proyecto)', () => {
    for (const bad of ['.', './', '..', '../fuera', '/tmp']) assert.throws(() => build({ out: bad, updateSw: false }), /inválido/, bad);
    assert.ok(existsSync(join(ROOT, 'js/app.js')), 'el proyecto sigue intacto');
  });
});

describe('service worker y la API', () => {
  function sw() {
    const listeners = {};
    const cached = { match: async () => ({ body: 'cache' }) }; // simula que TODO está en caché
    const ctx = { self: { location: { origin: 'https://elamath.test' }, addEventListener: (t, f) => (listeners[t] = f) }, caches: cached, fetch: async () => ({ ok: true }), URL, Promise };
    vm.runInNewContext(read('sw.js'), ctx);
    return (path, extra = {}) => {
      let responded = false;
      listeners.fetch({ request: { url: `https://elamath.test${path}`, method: 'GET', mode: 'cors', ...extra }, respondWith: () => (responded = true) });
      return responded;
    };
  }
  it('no intercepta /api/*, aunque haya algo parecido en caché', () => {
    const handles = sw();
    for (const p of ['/api/me', '/api/health', '/api/tutor', '/api/auth/verify', '/api/admin/reports?x=1']) assert.equal(handles(p), false, p);
  });
  it('sigue sirviendo la app y sus recursos desde la caché', () => {
    const handles = sw();
    assert.equal(handles('/js/app.js'), true);
    assert.equal(handles('/styles.css'), true);
    assert.equal(handles('/', { mode: 'navigate' }), true);
    assert.equal(handles('/apiary.js'), true, 'solo se excluye la carpeta /api/');
  });
});

describe('main.js: primera instalación del service worker', () => {
  it('no recarga la página cuando el SW toma el control por primera vez', () => {
    const src = read('js/main.js');
    assert.match(src, /const hadController = Boolean\(navigator\.serviceWorker\.controller\)/);
    assert.match(src, /if \(reloading \|\| !hadController\) return;/);
  });
});
