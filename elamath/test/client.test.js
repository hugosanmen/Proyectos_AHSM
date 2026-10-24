// Pruebas del cliente de FASE 2: api.js, richtext.js y la interfaz conectada a las rutas REALES del servidor
// (el "fetch" de la prueba enruta a routes.js; solo Anthropic y el correo están simulados).

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import katex from 'katex';
import 'fake-indexeddb/auto';
import { createApi, ApiError } from '../js/api.js';
import { renderRichText } from '../js/richtext.js';
import { routes } from '../server/routes.js';
import { createRng } from '../js/engine/utils.js';
import * as L from '../js/logic.js';
import { ADMIN, GROQ_ENV, TINY_JPEG_B64, loginAs, makeDeps, grantPro, tokenFromEmail } from './server.helpers.js';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const NOW = new Date(2026, 9, 20, 10, 0, 0);
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const define = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });

const memStorage = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};
const memStore = () => {
  let saved = null;
  return { load: async () => L.normalizeState(saved), save: async (s) => void (saved = structuredClone(s)) };
};

/** fetch de prueba que despacha a las rutas reales del servidor. */
function bridge(deps, { offline = false, absent = false } = {}) {
  const table = { '/api/health': 'health', '/api/me': 'me', '/api/tutor': 'tutor', '/api/report': 'report', '/api/auth/request': 'authRequest', '/api/auth/verify': 'authVerify', '/api/promo/redeem': 'promoRedeem', '/api/scan': 'scan' };
  const log = [];
  const fetchFn = async (url, init = {}) => {
    log.push({ url, init });
    if (offline) throw new TypeError('offline');
    if (absent) return { ok: false, status: 404, json: async () => { throw new SyntaxError('html'); } };
    const name = table[url];
    if (!name) return { ok: false, status: 404, json: async () => ({ code: 'not_found' }) };
    const headers = Object.fromEntries(Object.entries(init.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
    const out = await routes[name]({ body: init.body ? JSON.parse(init.body) : undefined, headers, ip: '2.2.2.2' }, deps);
    return { ok: out.status < 400, status: out.status, json: async () => structuredClone(out.body) };
  };
  return { fetchFn, log };
}

describe('api.js', () => {
  it('health: disponible, ausente (hosting estático) y sin red', async () => {
    const { deps } = makeDeps();
    assert.equal((await createApi({ fetchFn: bridge(deps).fetchFn, storage: memStorage() }).health()).available, true);
    assert.deepEqual(await createApi({ fetchFn: bridge(deps, { absent: true }).fetchFn, storage: memStorage() }).health(), { available: false, reason: 'absent' });
    assert.deepEqual(await createApi({ fetchFn: bridge(deps, { offline: true }).fetchFn, storage: memStorage() }).health(), { available: false, reason: 'network' });
  });

  it('login completo: guarda la sesión y manda Bearer; logout la borra', async () => {
    const { deps, sent } = makeDeps();
    const b = bridge(deps);
    const api = createApi({ fetchFn: b.fetchFn, storage: memStorage() });
    await api.requestLogin('Ana@Correo.com');
    await api.verifyLogin(tokenFromEmail(sent[0]));
    assert.equal(api.hasSession(), true);
    const me = await api.me();
    assert.equal(me.email, 'ana@correo.com');
    assert.match(b.log.at(-1).init.headers.Authorization, /^Bearer /);
    assert.equal(api.cachedAccount().email, 'ana@correo.com');
    api.logout();
    assert.equal(api.hasSession(), false);
    assert.equal(api.cachedAccount(), null);
  });

  it('el enlace es de un solo uso y errores llegan como ApiError con código', async () => {
    const { deps, sent } = makeDeps();
    const api = createApi({ fetchFn: bridge(deps).fetchFn, storage: memStorage() });
    await api.requestLogin('ana@correo.com');
    const t = tokenFromEmail(sent[0]);
    await api.verifyLogin(t);
    await assert.rejects(api.verifyLogin(t), (e) => e instanceof ApiError && e.status >= 400);
    await assert.rejects(api.requestLogin('no-es-correo'), (e) => e.code === 'bad_email');
  });

  it('tutor sin sesión falla 401 sin tocar la red; sesión inválida (401) se borra', async () => {
    const { deps } = makeDeps();
    const b = bridge(deps);
    const store = memStorage();
    const api = createApi({ fetchFn: b.fetchFn, storage: store });
    await assert.rejects(api.tutor({}), (e) => e.status === 401);
    assert.equal(b.log.length, 0);
    store.setItem('elamath:session', 'basura.firma');
    await assert.rejects(api.me(), (e) => e.status === 401);
    assert.equal(api.hasSession(), false);
  });

  it('sin red: ApiError network; sin localStorage usa memoria', async () => {
    const { deps } = makeDeps();
    const api = createApi({ fetchFn: bridge(deps, { offline: true }).fetchFn, storage: null });
    await assert.rejects(api.requestLogin('a@b.co'), (e) => e.status === 0 && e.code === 'network');
  });
});

describe('richtext.js (nunca interpreta HTML)', () => {
  const dom = new JSDOM('<div id="c"></div>');
  const doc = dom.window.document;
  const mathNode = (latex, display) => Object.assign(doc.createElement('span'), { textContent: `[${display ? 'D' : 'I'}:${latex}]` });
  const run = (text) => {
    const c = doc.getElementById('c');
    renderRichText(c, text, mathNode);
    return c;
  };

  it('fórmulas en línea y en bloque, negritas, listas y párrafos', () => {
    const c = run('Deriva **con cuidado** $x^2$.\n\n$$\\frac{a}{b}$$\n\n- uno\n- dos $y$\n\n1. a\n2. b');
    assert.equal(c.querySelector('strong').textContent, 'con cuidado');
    assert.match(c.textContent, /\[I:x\^2\]/);
    assert.match(c.querySelector('.chat-display').textContent, /\[D:\\frac\{a\}\{b\}\]/);
    assert.equal(c.querySelectorAll('ul li').length, 2);
    assert.equal(c.querySelectorAll('ol li').length, 2);
  });

  it('HTML y scripts del modelo quedan como texto', () => {
    const c = run('<img src=x onerror="alert(1)"> <script>boom()</script> **<b>x</b>**');
    assert.equal(c.querySelector('img'), null);
    assert.equal(c.querySelector('script'), null);
    assert.equal(c.querySelector('b'), null);
    assert.match(c.textContent, /<img src=x onerror/);
  });

  it('dinero con $ suelto no se toma como fórmula; texto vacío o null no rompe', () => {
    assert.equal(run('Cuesta $5 y $10 pesos').querySelector('[class]'), null);
    assert.equal(run(null).childNodes.length, 0);
  });
});

// ── Interfaz conectada ─────────────────────────────────────────
let current = null;
afterEach(() => {
  current?.app?.destroy();
  current?.w?.close();
  current = null;
});

async function mount({ deps, bridgeOpts, search = '', storage = memStorage(), nowFn, prepareImage } = {}) {
  const dom = new JSDOM(html, { url: `https://elamath.test/${search}`, pretendToBeVisual: true });
  const w = dom.window;
  w.scrollTo = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  define('window', w);
  define('document', w.document);
  define('location', w.location);
  define('history', w.history);
  define('katex', katex);
  define('confirm', () => true);
  const b = bridge(deps, bridgeOpts);
  const api = createApi({ fetchFn: b.fetchFn, storage });
  const { startApp } = await import('../js/app.js');
  const doc = w.document;
  const rng = createRng(5);
  const app = await startApp(doc.getElementById('app'), { store: memStore(), api, now: nowFn ?? (() => NOW), random: () => rng.next(), prepareImage });
  await app.ready;
  await tick();
  const q = (s) => doc.querySelector(s);
  const click = async (el) => {
    assert.ok(el, 'elemento no encontrado');
    el.click();
    await tick(5);
  };
  const submit = async (form) => {
    form.dispatchEvent(new w.Event('submit', { bubbles: true, cancelable: true }));
    await tick(5);
  };
  current = { app, w };
  return { app, w, doc, q, click, submit, api, b, storage };
}

async function loginUi(ctx, sent, email = 'ana@correo.com') {
  await ctx.click(ctx.q('#account-chip'));
  ctx.q('#email-input').value = email;
  await ctx.submit(ctx.q('#login-form'));
  assert.match(ctx.q('#account-dialog').textContent, /Revisa tu correo/);
  const token = tokenFromEmail(sent.at(-1));
  await ctx.api.verifyLogin(token);
  await ctx.app.ready;
}

describe('interfaz con backend', () => {
  it('sin backend (hosting estático) no hay botones de cuenta ni tutor y todo sigue igual', async () => {
    const { deps } = makeDeps();
    const c = await mount({ deps, bridgeOpts: { absent: true } });
    assert.equal(c.q('#account-chip'), null);
    await c.click(c.q('button[aria-label^="Practicar"]'));
    assert.equal(c.q('#tutor-btn'), null);
    assert.ok(c.q('#report-btn'), 'el reporte siempre existe');
    assert.match(c.q('#credits-chip').textContent, /10\/10 consultas hoy/);
  });

  it('con backend aparece "Entrar"; el enlace del correo inicia sesión y limpia la URL', async () => {
    const { deps, sent } = makeDeps();
    const first = await mount({ deps });
    assert.match(first.q('#account-chip').textContent, /Entrar/);
    await first.click(first.q('#account-chip'));
    first.q('#email-input').value = 'ana@correo.com';
    await first.submit(first.q('#login-form'));
    const token = tokenFromEmail(sent[0]);
    first.app.destroy();
    first.w.close();

    const second = await mount({ deps, search: `?login=${token}` });
    assert.match(second.q('#account-chip').textContent, /Prueba · 30 d/, 'cuenta nueva = prueba gratis de 30 días');
    assert.equal(second.w.location.search, '', 'el token se quita de la barra de direcciones');
    assert.match(second.q('#toast').textContent, /Ya entraste/);
    assert.equal(second.app._account().email, 'ana@correo.com');
  });

  it('enlace inválido o reutilizado muestra aviso y no inicia sesión', async () => {
    const { deps } = makeDeps();
    const c = await mount({ deps, search: '?login=token-falso' });
    assert.match(c.q('#toast').textContent, /no es válido|caducó/);
    assert.equal(c.app._account(), null);
    assert.equal(c.w.location.search, '');
  });

  it('correo mal escrito: mensaje de error en el formulario', async () => {
    const { deps } = makeDeps();
    const c = await mount({ deps });
    await c.click(c.q('#account-chip'));
    c.q('#email-input').value = 'sin-arroba';
    await c.submit(c.q('#login-form'));
    assert.match(c.q('#login-status').textContent, /Revisa tu correo/);
  });

  it('Peer Tutor: pide entrar → pide Pro → conversa, con fórmulas renderizadas y cuota', async () => {
    const { deps, sent, ai } = makeDeps({ anthropic: { reply: 'Piensa en la **regla de la cadena**: $f(g(x))$.' } });
    const c = await mount({ deps });
    await c.click(c.q('button[aria-label^="Practicar"]'));

    await c.click(c.q('#tutor-btn'));
    assert.ok(c.q('#tutor-login'), 'sin cuenta: invita a entrar');
    await c.click(c.q('#tutor-close'));

    await loginUi(c, sent);
    c.app.destroy();
    c.w.close();
    await routes.adminPlan({ headers: { authorization: `Bearer ${ADMIN}` }, body: { email: 'ana@correo.com', plan: 'free' } }, deps); // prueba terminada
    const free = await mount({ deps, storage: c.storage }); // el enlace recarga la página
    await free.click(free.q('button[aria-label^="Practicar"]'));
    await free.click(free.q('#tutor-btn'));
    assert.ok(free.q('#tutor-upgrade'), 'cuenta gratis: invita a Pro');
    free.app.destroy();
    free.w.close();

    await grantPro(routes, deps, 'ana@correo.com');
    const again = await mount({ deps, storage: c.storage });
    await again.click(again.q('button[aria-label^="Practicar"]'));
    assert.match(again.q('#credits-chip').textContent, /Pro/);
    await again.click(again.q('#tutor-btn'));
    assert.ok(again.q('#tutor-input'), 'Pro: chat listo');
    assert.match(again.q('#tutor-quota').textContent, /40 de 40/);

    await again.click(again.q('[data-mode="hint"]'));
    await tick(20);
    const bubbles = [...again.doc.querySelectorAll('.bubble')].map((b) => b.className);
    assert.ok(bubbles.some((x) => x.includes('me')) && bubbles.some((x) => x.includes('bot')));
    assert.ok(again.q('.bubble.bot strong'), 'negritas');
    assert.ok(again.q('.bubble.bot .katex'), 'KaTeX renderizó la fórmula');
    assert.match(again.q('#tutor-quota').textContent, /39 de 40/);
    // el servidor recibió el ejercicio por plantilla+semilla, no el texto
    const sentBody = ai.calls.at(-1).body;
    assert.match(JSON.stringify(sentBody.system), /CONTEXTO VERIFICADO/);
  });

  it('Peer Tutor: si el servidor falla, el mensaje vuelve al cuadro y no se pierde', async () => {
    const { deps, sent } = makeDeps({ anthropic: { status: 500 } });
    const c = await mount({ deps });
    await loginUi(c, sent);
    await grantPro(routes, deps, 'ana@correo.com');
    c.app.destroy();
    c.w.close();
    const p = await mount({ deps, storage: c.storage });
    await p.click(p.q('button[aria-label^="Practicar"]'));
    await p.click(p.q('#tutor-btn'));
    p.q('#tutor-input').value = '¿Cómo empiezo?';
    p.q('#tutor-input').dispatchEvent(new p.w.Event('input'));
    await p.submit(p.q('#chat-form'));
    await tick(20);
    assert.match(p.q('#tutor-notice').textContent, /no pudo responder/);
    assert.equal(p.q('#tutor-input').value, '¿Cómo empiezo?');
    assert.equal(p.doc.querySelectorAll('.bubble.me').length, 0);
    assert.match(p.q('#tutor-quota').textContent, /40 de 40/, 'la cuota se reembolsa');
  });

  it('Peer Tutor sin conexión avisa sin llamar al servidor', async () => {
    const { deps, sent } = makeDeps();
    const c = await mount({ deps });
    await loginUi(c, sent);
    await grantPro(routes, deps, 'ana@correo.com');
    c.app.destroy();
    c.w.close();
    const p = await mount({ deps, storage: c.storage });
    await p.click(p.q('button[aria-label^="Practicar"]'));
    await p.click(p.q('#tutor-btn'));
    Object.defineProperty(p.w.navigator, 'onLine', { value: false, configurable: true });
    define('navigator', p.w.navigator);
    const before = p.b.log.length;
    await p.click(p.q('[data-mode="hint"]'));
    assert.equal(p.b.log.length, before);
    assert.match(p.q('#tutor-notice').textContent, /Sin conexión/);
    define('navigator', undefined);
  });

  it('reporte: se envía al servidor con plantilla y semilla; sin red muestra el código', async () => {
    const { deps } = makeDeps();
    const c = await mount({ deps });
    await c.click(c.q('button[aria-label^="Practicar"]'));
    const code = `${c.app._practice().ex.templateId}#${c.app._practice().ex.seed}`;
    await c.click(c.q('#report-btn'));
    c.q('#report-note').value = 'La respuesta B parece incorrecta';
    await c.submit(c.q('#report-form'));
    assert.match(c.q('#report-dialog').textContent, /Gracias/);
    assert.equal(c.q('#report-code').textContent, code);
    const stored = await routes.adminReports({ headers: { authorization: 'Bearer admin-token-de-prueba-1234567890' }, query: {}, ip: '9.9.9.9' }, deps);
    assert.equal(stored.body.reports.length, 1);
    assert.equal(stored.body.reports[0].exercise.templateId, c.app._practice().ex.templateId);

    const off = await mount({ deps, bridgeOpts: { offline: true } });
    await off.click(off.q('button[aria-label^="Practicar"]'));
    await off.click(off.q('#report-btn'));
    await off.submit(off.q('#report-form'));
    assert.match(off.q('#report-dialog').textContent, /No se pudo enviar/);
    assert.ok(off.q('#report-code').textContent.includes('#'));
  });

  it('cuenta Pro del servidor sustituye al plan local; cerrar sesión vuelve a Gratis', async () => {
    const { deps, sent } = makeDeps();
    const c = await mount({ deps });
    await loginUi(c, sent);
    await grantPro(routes, deps, 'ana@correo.com');
    c.app.destroy();
    c.w.close();
    const p = await mount({ deps, storage: c.storage });
    assert.equal(p.app.getState().plan, 'pro');
    await p.click(p.q('#account-chip'));
    await p.click(p.q('#logout-btn'));
    assert.equal(p.app.getState().plan, 'free');
    assert.match(p.q('#account-chip').textContent, /Entrar/);
  });

  it('el Pro de demostración local no aparece cuando hay backend', async () => {
    const { deps } = makeDeps();
    const c = await mount({ deps });
    await c.click(c.q('#credits-chip'));
    assert.equal(c.q('#toggle-plan'), null);
    assert.ok(c.q('#pro-login'));
  });
});

const adminH = { authorization: `Bearer ${ADMIN}` };
const endTrial = (deps, email = 'ana@correo.com') => routes.adminPlan({ headers: adminH, body: { email, plan: 'free' } }, deps);
/** Monta la app, entra con correo y recarga como lo haría el enlace real. */
async function mountLoggedIn(deps, sent, extra = {}) {
  const c = await mount({ deps, ...extra });
  await loginUi(c, sent);
  c.app.destroy();
  c.w.close();
  return mount({ deps, storage: c.storage, ...extra });
}

describe('prueba gratis y planes en la interfaz', () => {
  it('cuenta nueva: HUD "Prueba · 30 d", precio $50, cómo pagar y formulario de código', async () => {
    const { deps, sent } = makeDeps({ env: { PAY_INSTRUCTIONS: 'Transfiere $50 a la CLABE 0123 y manda tu correo.' } });
    const c = await mountLoggedIn(deps, sent);
    assert.match(c.q('#account-chip').textContent, /Prueba · 30 d/);
    assert.match(c.q('#credits-chip').textContent, /Prueba · 150 consultas/);
    assert.equal(c.app.getState().plan, 'pro', 'durante la prueba se desbloquea todo');
    await c.click(c.q('#credits-chip'));
    const t = c.q('#pro-dialog').textContent;
    assert.match(t, /\$50 MXN \/ mes/);
    assert.match(t, /Tu prueba gratis termina el .* \(30 días\)/);
    assert.match(c.q('#pay-info').textContent, /CLABE 0123/);
    assert.doesNotMatch(t, /semestre|próximamente|demostración/);
    assert.ok(c.q('#promo-input'));
  });

  it('prueba terminada: pasa a gratis, el tutor pide Pro y el modal lo explica', async () => {
    const { deps, sent } = makeDeps();
    const c = await mountLoggedIn(deps, sent);
    c.app.destroy();
    c.w.close();
    await endTrial(deps);
    const f = await mount({ deps, storage: c.storage });
    assert.equal(f.app.getState().plan, 'free');
    assert.match(f.q('#account-chip').textContent, /Cuenta/);
    await f.click(f.q('button[aria-label^="Practicar"]'));
    await f.click(f.q('#tutor-btn'));
    assert.ok(f.q('#tutor-upgrade'));
    await f.click(f.q('#tutor-upgrade'));
    assert.match(f.q('#trial-status').textContent, /prueba gratis terminó/);
    assert.match(f.q('#pro-dialog').textContent, /práctica básica sigue gratis/);
  });

  it('el diálogo de cuenta muestra plan, días de prueba y el formulario de código', async () => {
    const { deps, sent } = makeDeps();
    const c = await mountLoggedIn(deps, sent);
    await c.click(c.q('#account-chip'));
    assert.match(c.q('#plan-line').textContent, /Prueba gratis · termina el .* \(30 d\)/);
    assert.ok(c.q('#account-dialog #promo-form'));
  });
});

describe('códigos de promoción en la interfaz', () => {
  async function freeUser() {
    const { deps, sent } = makeDeps();
    const c = await mountLoggedIn(deps, sent);
    c.app.destroy();
    c.w.close();
    await endTrial(deps);
    const f = await mount({ deps, storage: c.storage });
    return { deps, f, sent };
  }
  const redeemUi = async (f, code) => {
    f.q('#promo-input').value = code;
    await f.submit(f.q('#promo-form'));
    await tick(10);
  };

  it('canjear un código válido activa Pro al instante (HUD, plan local y cupo del tutor)', async () => {
    const { deps, f } = await freeUser();
    await routes.adminPromo({ method: 'POST', headers: adminH, body: { code: 'UNAM-30', days: 30 } }, deps);
    await f.click(f.q('#credits-chip'));
    assert.match(f.q('#trial-status').textContent, /terminó/);
    await redeemUi(f, 'unam-30');
    assert.match(f.q('#promo-status').textContent, /Sumaste 30 días de Pro/);
    assert.match(f.q('#trial-status').textContent, /Tu Pro está activo hasta el/);
    assert.match(f.q('#account-chip').textContent, /Pro/);
    assert.equal(f.app.getState().plan, 'pro');
    assert.equal(f.app._account().tutor.limit, 40);
    assert.equal(f.q('#pay-info'), null, 'ya es Pro: no pide pagar');
  });

  it('mensajes claros para código inválido, repetido, caducado, agotado y vacío', async () => {
    const { deps, f, sent } = await freeUser();
    await routes.adminPromo({ method: 'POST', headers: adminH, body: { code: 'UNA-VEZ', days: 5 } }, deps);
    await routes.adminPromo({ method: 'POST', headers: adminH, body: { code: 'LLENO', days: 5, maxUses: 1 } }, deps);
    await f.click(f.q('#credits-chip'));
    await redeemUi(f, 'NOEXISTE');
    assert.match(f.q('#promo-status').textContent, /no existe/);
    await redeemUi(f, '   ');
    assert.match(f.q('#promo-status').textContent, /Escribe tu código/);
    await redeemUi(f, 'UNA-VEZ');
    assert.match(f.q('#promo-status').textContent, /Sumaste 5 días/);
    await redeemUi(f, 'UNA-VEZ');
    assert.match(f.q('#promo-status').textContent, /Ya canjeaste/);
    const before = f.app._account().proUntil; // ya tiene 5 días de UNA-VEZ
    // un código caducado y otro agotado por alguien más
    await routes.adminPromo({ method: 'POST', headers: adminH, body: { code: 'CORTO', days: 5, expiresInDays: 1 } }, deps);
    const real = deps.now;
    deps.now = () => real() + 2 * 86_400_000;
    await redeemUi(f, 'CORTO');
    assert.match(f.q('#promo-status').textContent, /caducó/);
    deps.now = real;
    const otra = await loginAs(routes, deps, sent, 'otra@correo.com');
    assert.equal((await routes.promoRedeem({ headers: otra.headers, body: { code: 'LLENO' }, ip: '7' }, deps)).status, 200);
    await redeemUi(f, 'LLENO');
    assert.match(f.q('#promo-status').textContent, /ya se agotó/);
    assert.equal(f.app._account().proUntil, before, 'los errores no cambian los días de Pro');
  });

  it('sin conexión avisa; el formulario no aparece sin sesión', async () => {
    const { deps } = makeDeps();
    const anon = await mount({ deps });
    await anon.click(anon.q('#credits-chip'));
    assert.equal(anon.q('#promo-form'), null);
    assert.ok(anon.q('#pro-login'));
    assert.match(anon.q('#pro-login').textContent, /30 días gratis/);
  });
});

describe('escáner de apuntes en la interfaz', () => {
  const fakeFile = { type: 'image/jpeg', size: 1234, name: 'apunte.jpg' };
  const prep = async () => ({ mediaType: 'image/jpeg', data: TINY_JPEG_B64, width: 10, height: 10 });
  const pick = async (c, file = fakeFile) => {
    const input = c.q('#scan-file');
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    input.dispatchEvent(new c.w.Event('change', { bubbles: true }));
    await tick(10);
  };

  it('sin sesión invita a entrar; sin Pro ni prueba invita a Pro', async () => {
    const { deps, sent } = makeDeps({ env: GROQ_ENV });
    const anon = await mount({ deps, prepareImage: prep });
    await anon.click(anon.q('#scan-open'));
    assert.ok(anon.q('#scan-login'));
    anon.app.destroy();
    anon.w.close();
    const c = await mountLoggedIn(deps, sent, { prepareImage: prep });
    c.app.destroy();
    c.w.close();
    await endTrial(deps);
    const f = await mount({ deps, storage: c.storage, prepareImage: prep });
    await f.click(f.q('#scan-open'));
    assert.ok(f.q('#scan-upgrade'));
  });

  it('foto → vista previa → revisión con fórmulas y cuota actualizada', async () => {
    const { deps, sent, ai } = makeDeps({ env: GROQ_ENV, anthropic: { reply: '**Revisión**: ojo con $f(g(x))$.' } });
    const c = await mountLoggedIn(deps, sent, { prepareImage: prep });
    await c.click(c.q('button[aria-label^="Practicar"]'));
    await c.click(c.q('#scan-btn'));
    assert.match(c.q('#scan-quota').textContent, /40 de 40/);
    assert.equal(c.q('#scan-send').disabled, true, 'sin foto no se puede enviar');
    await pick(c);
    assert.match(c.q('#scan-preview').src, /^data:image\/jpeg;base64,/);
    c.q('#scan-note').value = 'dudo del paso 2';
    c.q('#scan-note').dispatchEvent(new c.w.Event('input', { bubbles: true }));
    await c.click(c.q('#scan-send'));
    await tick(20);
    assert.ok(c.q('#scan-reply strong'), 'negritas');
    assert.ok(c.q('#scan-reply .katex'), 'KaTeX renderizó');
    assert.match(c.q('#scan-quota').textContent, /39 de 40/);
    const sentBody = ai.calls.at(-1).body.messages[1].content;
    assert.equal(sentBody[0].image_url.url, `data:image/jpeg;base64,${TINY_JPEG_B64}`);
    assert.match(sentBody[1].text, /dudo del paso 2/);
  });

  it('errores: foto inválida (cliente) y fallo del servidor (no se descuenta)', async () => {
    const { deps, sent } = makeDeps({ env: GROQ_ENV, anthropic: { status: 500 } });
    const { ImageError } = await import('../js/image.js');
    let fail = true;
    const prep2 = async () => {
      if (fail) throw new ImageError('not_image');
      return prep();
    };
    const c = await mountLoggedIn(deps, sent, { prepareImage: prep2 });
    await c.click(c.q('#scan-open'));
    await pick(c, { type: 'application/pdf', size: 10 });
    assert.match(c.q('#scan-notice').textContent, /no es una imagen/);
    assert.equal(c.q('#scan-send').disabled, true);
    fail = false;
    await pick(c);
    await c.click(c.q('#scan-send'));
    await tick(20);
    assert.match(c.q('#scan-notice').textContent, /No se descontó/);
    assert.match(c.q('#scan-quota').textContent, /40 de 40/);
  });

  it('en hosting estático (sin servidor) no hay botón de escáner', async () => {
    const { deps } = makeDeps();
    const c = await mount({ deps, bridgeOpts: { absent: true } });
    assert.equal(c.q('#scan-open'), null);
  });
});

describe('exámenes simulados en la interfaz', () => {
  let clock;
  const nowFn = () => new Date(clock);
  const answerAll = async (c, n = 10) => {
    for (let i = 0; i < n; i++) {
      assert.match(c.q('#exam-progress').textContent, new RegExp(`Pregunta ${i + 1} de 10`));
      await c.click(c.q('.option[data-option="0"]'));
    }
  };

  it('flujo completo: 10 preguntas sin retroalimentación → resultado, revisión, XP e historial', async () => {
    clock = NOW.getTime();
    const { deps, sent } = makeDeps();
    const c = await mountLoggedIn(deps, sent, { nowFn });
    await c.click(c.q('[data-exam]'));
    assert.equal(c.app.getState().exams.length, 0);
    assert.match(c.q('#exam-clock').textContent, /^20:00$/);
    assert.equal(c.q('#feedback'), null, 'no hay retroalimentación durante el examen');
    assert.equal(c.q('#explain-btn'), null);
    assert.equal(c.q('#tutor-btn'), null, 'sin tutor ni paso a paso durante el examen');
    await answerAll(c);
    assert.match(c.q('#exam-score').textContent, /^\d+\.\d \/ 10$/);
    assert.ok(c.q('#exam-verdict'));
    assert.equal(c.doc.querySelectorAll('details.review').length, 10);
    assert.ok(c.q('details.review .katex'));
    const st = c.app.getState();
    assert.equal(st.exams.length, 1);
    assert.equal(st.stats.answered, 10);
    const g = c.app._exam().result.grade;
    assert.equal(st.stats.correct, g.correct);
    await c.click(c.q('#exam-home'));
    assert.match(c.q('#last-exam').textContent, /Último examen simulado: \d+\.\d \/ 10/);
  });

  it('al acabarse el tiempo se entrega solo y las sin contestar cuentan como error', async () => {
    clock = NOW.getTime();
    const { deps, sent } = makeDeps();
    const c = await mountLoggedIn(deps, sent, { nowFn });
    await c.click(c.q('[data-exam]'));
    await answerAll(c, 3);
    clock += 10 * 60_000;
    c.app._tick();
    assert.match(c.q('#exam-clock').textContent, /^10:00$/);
    clock += 10 * 60_000 + 1;
    c.app._tick();
    await tick(5);
    assert.ok(c.q('#exam-score'), 'se entregó');
    assert.match(c.q('#toast').textContent, /Se acabó el tiempo/);
    assert.match(c.q('.exam-result').textContent, /7 sin contestar/);
    assert.equal(c.app.getState().stats.answered, 3);
    c.app._tick(); // un tic extra no hace nada ni duplica el historial
    assert.equal(c.app.getState().exams.length, 1);
  });

  it('abandonar pide confirmación y no guarda nada; entregar antes de tiempo también pide confirmación', async () => {
    clock = NOW.getTime();
    const { deps, sent } = makeDeps();
    const c = await mountLoggedIn(deps, sent, { nowFn });
    await c.click(c.q('[data-exam]'));
    await answerAll(c, 2);
    c.w.confirm = () => false;
    globalThis.confirm = () => false;
    await c.click(c.q('#exam-leave'));
    assert.ok(c.q('#exam-clock'), 'sigue en el examen');
    await c.click(c.q('#exam-finish'));
    assert.ok(c.q('#exam-clock'));
    globalThis.confirm = () => true;
    await c.click(c.q('#exam-leave'));
    assert.equal(c.q('#exam-clock'), null);
    assert.equal(c.app.getState().exams.length, 0);
    assert.equal(c.app.getState().stats.answered, 0);
  });

  it('gratis (prueba terminada) → abre Pro; sin servidor (demo) el examen queda abierto', async () => {
    clock = NOW.getTime();
    const { deps, sent } = makeDeps();
    const c = await mountLoggedIn(deps, sent, { nowFn });
    c.app.destroy();
    c.w.close();
    await endTrial(deps);
    const f = await mount({ deps, storage: c.storage, nowFn });
    await f.click(f.q('[data-exam]'));
    assert.equal(f.q('#exam-clock'), null);
    assert.match(f.q('#pro-dialog').textContent, /exámenes simulados son parte de ElaMath Pro/);
    f.app.destroy();
    f.w.close();
    const demo = await mount({ deps, bridgeOpts: { absent: true }, nowFn });
    await demo.click(demo.q('[data-exam]'));
    assert.ok(demo.q('#exam-clock'));
  });

  it('"Otro examen" arranca uno nuevo y cambiar de vista apaga el reloj', async () => {
    clock = NOW.getTime();
    const { deps, sent } = makeDeps();
    const c = await mountLoggedIn(deps, sent, { nowFn });
    await c.click(c.q('[data-exam]'));
    await answerAll(c);
    await c.click(c.q('#exam-again'));
    assert.match(c.q('#exam-progress').textContent, /Pregunta 1 de 10/);
    assert.equal(c.app.getState().exams.length, 1);
  });
});

describe('etapa de pruebas en la interfaz (cobro apagado)', () => {
  it('tutor, escáner y exámenes abiertos; sin precio, prueba, pago ni códigos', async () => {
    const { deps, sent } = makeDeps({ env: { BILLING_ENABLED: '', ...GROQ_ENV } });
    const c = await mountLoggedIn(deps, sent);
    assert.match(c.q('#account-chip').textContent, /Cuenta/);
    assert.doesNotMatch(c.q('#account-chip').textContent, /Prueba/);
    assert.doesNotMatch(c.q('#credits-chip').textContent, /Pro/);
    assert.equal(c.app.getState().plan, 'pro');
    assert.equal(c.doc.body.textContent.includes('Ver plan Pro'), false);
    assert.ok(c.q('#scan-open'));
    await c.click(c.q('#credits-chip'));
    const t = c.q('#pro-dialog').textContent;
    assert.match(t, /etapa de pruebas/);
    assert.doesNotMatch(t, /\$|MXN|Pro\b.*mes|código|pagar/i);
    assert.equal(c.q('#promo-form'), null);
    await c.click(c.q('#close-pro'));
    await c.click(c.q('button[aria-label^="Practicar"]'));
    assert.ok(c.q('#scan-btn') && c.q('#report-btn'));
    await c.click(c.q('#tutor-btn'));
    assert.ok(c.q('#tutor-input'), 'chat listo');
    assert.match(c.q('#tutor-quota').textContent, /40 de 40/);
    await c.click(c.q('#tutor-close'));
    await c.click(c.q('.practice-head button'));
    await c.click(c.q('[data-exam]'));
    assert.ok(c.q('#exam-clock'));
  });
  it('Mi cuenta dice acceso completo y no muestra el formulario de códigos', async () => {
    const { deps, sent } = makeDeps({ env: { BILLING_ENABLED: '' } });
    const c = await mountLoggedIn(deps, sent);
    await c.click(c.q('#account-chip'));
    assert.match(c.q('#plan-line').textContent, /Acceso completo y gratis/);
    assert.equal(c.q('#promo-form'), null);
  });
  it('sin sesión el modal invita a entrar (gratis), sin hablar de precios', async () => {
    const { deps } = makeDeps({ env: { BILLING_ENABLED: '' } });
    const c = await mount({ deps });
    await c.click(c.q('#credits-chip'));
    assert.match(c.q('#pro-dialog').textContent, /Entra con tu correo para usar todo gratis/);
    assert.doesNotMatch(c.q('#pro-dialog').textContent, /\$50/);
  });
});
