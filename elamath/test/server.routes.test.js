// Pruebas de las rutas de la API de punta a punta (con almacén en memoria y la IA simulada)
// y del adaptador HTTP que las conecta con las funciones de Vercel.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { generateExercise, toMultipleChoice } from '../js/engine/index.js';
import { routes } from '../server/routes.js';
import { setDeps, wrap } from '../server/http.js';
import { ADMIN, grantPro, loginAs, makeDeps } from './server.helpers.js';

const ex = { templateId: 'derivada-cadena', seed: 2026, pickedIndex: 0 };
const tutor = (deps, headers, body) => routes.tutor({ headers, body, ip: '2.2.2.2' }, deps);
const admin = { authorization: `Bearer ${ADMIN}` };

describe('GET /api/health', () => {
  it('indica qué piezas están configuradas, sin revelar secretos', async () => {
    const { deps } = makeDeps();
    const r = await routes.health({}, deps);
    assert.deepEqual(r.body, {
      ok: true, store: 'memory', auth: true, email: true, tutor: true, provider: 'anthropic', scan: true, admin: true,
      billing: { enabled: true, priceMxn: 50, trialDays: 30, instructions: '' },
    });
    assert.doesNotMatch(JSON.stringify(r.body), /sk-ant|re_test|s3cret/);
    const sinNada = makeDeps({ env: { SESSION_SECRET: '', ANTHROPIC_API_KEY: '', RESEND_API_KEY: '', ADMIN_TOKEN: '' } });
    const vacio = (await routes.health({}, sinNada.deps)).body;
    assert.deepEqual([vacio.auth, vacio.email, vacio.tutor, vacio.scan, vacio.provider, vacio.admin], [false, false, false, false, null, false]);
  });
});

describe('flujo completo: login → plan → tutor', () => {
  it('un estudiante gratis entra, ve su plan y el tutor le pide pasar a Pro (402) SIN llamar a la IA', async () => {
    const { deps, sent, ai } = makeDeps();
    const { headers } = await loginAs(routes, deps, sent);
    await routes.adminPlan({ headers: admin, body: { email: 'ana@correo.com', plan: 'free' } }, deps); // termina la prueba
    const me = await routes.me({ headers }, deps);
    assert.equal(me.body.email, 'ana@correo.com');
    assert.equal(me.body.plan, 'free');
    assert.deepEqual(me.body.tutor, { used: 0, limit: 0, remaining: 0 });
    assert.equal(me.body.trial.active, false);
    const r = await tutor(deps, headers, { message: 'ayuda', exercise: ex });
    assert.deepEqual([r.status, r.body.code], [402, 'upgrade_required']);
    assert.equal(ai.calls.length, 0);
  });

  it('con Pro: responde con el contexto verificado, descuenta 1 y devuelve la cuota', async () => {
    const { deps, sent, ai } = makeDeps({ anthropic: { reply: 'Mira, la derivada de afuera es $\\cos$.' } });
    const { headers } = await loginAs(routes, deps, sent);
    assert.equal((await grantPro(routes, deps)).status, 200);
    assert.equal((await routes.me({ headers }, deps)).body.plan, 'pro');

    const r = await tutor(deps, headers, { message: '¿Por qué me equivoqué?', exercise: ex, mode: 'explain' });
    assert.equal(r.status, 200);
    assert.equal(r.body.reply, 'Mira, la derivada de afuera es $\\cos$.');
    assert.deepEqual(r.body.tutor, { used: 1, limit: 40, remaining: 39 });
    assert.equal(ai.calls.length, 1);
    const sys = ai.calls[0].body.system.map((b) => b.text).join('\n');
    const real = toMultipleChoice(generateExercise(ex.templateId, ex.seed));
    assert.ok(sys.includes(real.answer.latex), 'la IA recibió la respuesta verificada');
    assert.doesNotMatch(JSON.stringify(r.body), /claude-|sk-ant/, 'no expone modelo ni claves');
  });

  it('la conversación previa viaja a la IA y termina con el mensaje nuevo', async () => {
    const { deps, sent, ai } = makeDeps();
    const { headers } = await loginAs(routes, deps, sent);
    await grantPro(routes, deps);
    await tutor(deps, headers, { message: 'y luego?', history: [{ role: 'user', content: 'hola' }, { role: 'assistant', content: 'dime' }] });
    assert.deepEqual(ai.calls[0].body.messages.map((m) => m.role), ['user', 'assistant', 'user']);
    assert.equal(ai.calls[0].body.messages[2].content, 'y luego?');
  });

  it('límite diario → 429 y el mensaje rechazado no llama a la IA', async () => {
    const { deps, sent, ai } = makeDeps({ env: { TUTOR_PRO_DAILY: '2' } });
    const { headers } = await loginAs(routes, deps, sent);
    await grantPro(routes, deps);
    for (let i = 0; i < 2; i++) assert.equal((await tutor(deps, headers, { message: 'x' })).status, 200);
    const r = await tutor(deps, headers, { message: 'x' });
    assert.deepEqual([r.status, r.body.code], [429, 'daily_limit']);
    assert.deepEqual(r.body.tutor, { used: 2, limit: 2, remaining: 0 });
    assert.equal(ai.calls.length, 2);
  });

  it('si la IA falla → 502 y NO se descuenta el mensaje', async () => {
    for (const anthropic of [{ status: 500 }, { throwNetwork: true }, { status: 429 }]) {
      const { deps, sent } = makeDeps({ anthropic });
      const { headers } = await loginAs(routes, deps, sent);
      await grantPro(routes, deps);
      const r = await tutor(deps, headers, { message: 'x' });
      assert.deepEqual([r.status, r.body.code], [502, 'upstream_error']);
      assert.equal((await routes.me({ headers }, deps)).body.tutor.used, 0);
    }
  });

  it('freno global del servicio → 503 capacity', async () => {
    const { deps, sent } = makeDeps({ env: { TUTOR_GLOBAL_DAILY: '1' } });
    const a = await loginAs(routes, deps, sent, 'a@correo.com');
    const b = await loginAs(routes, deps, sent, 'b@correo.com');
    await grantPro(routes, deps, 'a@correo.com');
    await grantPro(routes, deps, 'b@correo.com');
    assert.equal((await tutor(deps, a.headers, { message: 'x' })).status, 200);
    const r = await tutor(deps, b.headers, { message: 'x' });
    assert.deepEqual([r.status, r.body.code], [503, 'capacity']);
  });

  it('exige sesión válida (401) y valida la petición (400) antes de gastar nada', async () => {
    const { deps, sent, ai } = makeDeps();
    assert.equal((await tutor(deps, {}, { message: 'x' })).status, 401);
    assert.equal((await tutor(deps, { authorization: 'Bearer basura' }, { message: 'x' })).status, 401);
    const { headers } = await loginAs(routes, deps, sent);
    await grantPro(routes, deps);
    for (const body of [{}, { message: '' }, { message: 'x', mode: 'zzz' }, { message: 'x', exercise: { templateId: 'no', seed: 1 } }]) {
      assert.equal((await tutor(deps, headers, body)).status, 400);
    }
    assert.equal(ai.calls.length, 0);
    assert.equal((await routes.me({ headers }, deps)).body.tutor.used, 0);
  });

  it('sin ANTHROPIC_API_KEY → 503 y no gasta cuota', async () => {
    const { deps, sent } = makeDeps({ env: { ANTHROPIC_API_KEY: '' } });
    const { headers } = await loginAs(routes, deps, sent);
    await grantPro(routes, deps);
    assert.deepEqual([(await tutor(deps, headers, { message: 'x' })).status], [503]);
    assert.equal((await routes.me({ headers }, deps)).body.tutor.used, 0);
  });

  it('Pro con vencimiento: deja de ser Pro cuando pasa la fecha', async () => {
    const { deps, sent, clock } = makeDeps();
    const { headers } = await loginAs(routes, deps, sent);
    const g = await grantPro(routes, deps, 'ana@correo.com', 30);
    assert.match(g.body.proUntil, /^2026-11-19/);
    assert.equal((await routes.me({ headers }, deps)).body.plan, 'pro');
    clock.advance(31 * 86_400_000);
    // la sesión caduca a los 30 días; se inicia una nueva
    const again = await loginAs(routes, deps, sent);
    assert.equal((await routes.me({ headers: again.headers }, deps)).body.plan, 'free');
    assert.equal((await tutor(deps, again.headers, { message: 'x' })).status, 402);
  });

  it('GET /api/me sin sesión → 401', async () => {
    const { deps } = makeDeps();
    assert.equal((await routes.me({ headers: {} }, deps)).status, 401);
  });
});

describe('rutas de autenticación', () => {
  it('authRequest/authVerify delegan correctamente y no filtran si el correo existe', async () => {
    const { deps, sent } = makeDeps();
    const a = await routes.authRequest({ body: { email: 'nuevo@correo.com' }, ip: '1.1.1.1' }, deps);
    await loginAs(routes, deps, sent, 'existente@correo.com');
    const b = await routes.authRequest({ body: { email: 'existente@correo.com' }, ip: '1.1.1.2' }, deps);
    assert.deepEqual(a.body, b.body, 'misma respuesta exista o no la cuenta');
    assert.equal((await routes.authRequest({ body: undefined, ip: 'x' }, deps)).status, 400);
    assert.equal((await routes.authVerify({ body: undefined }, deps)).status, 400);
  });
});

describe('rutas de administración', () => {
  it('sin ADMIN_TOKEN configurado quedan deshabilitadas (503)', async () => {
    const { deps } = makeDeps({ env: { ADMIN_TOKEN: '' } });
    assert.equal((await routes.adminPlan({ headers: { authorization: 'Bearer ' }, body: {} }, deps)).status, 503);
    assert.equal((await routes.adminReports({ headers: {} }, deps)).status, 503);
  });
  it('exige el token exacto', async () => {
    const { deps } = makeDeps();
    const body = { email: 'a@b.mx', plan: 'pro' };
    for (const authorization of [undefined, 'Bearer mal', `Bearer ${ADMIN}x`, ADMIN, `Basic ${ADMIN}`]) {
      assert.equal((await routes.adminPlan({ headers: { authorization }, body }, deps)).status, 401, String(authorization));
      assert.equal((await routes.adminReports({ headers: { authorization } }, deps)).status, 401);
    }
  });
  it('un token de sesión de estudiante NO sirve como admin', async () => {
    const { deps, sent } = makeDeps();
    const { headers } = await loginAs(routes, deps, sent);
    assert.equal((await routes.adminPlan({ headers, body: { email: 'ana@correo.com', plan: 'pro' } }, deps)).status, 401);
  });
  it('valida el cuerpo y permite dar Pro antes de que la persona haya entrado', async () => {
    const { deps, sent } = makeDeps();
    const call = (body) => routes.adminPlan({ headers: admin, body }, deps);
    for (const body of [undefined, {}, { email: 'malo', plan: 'pro' }, { email: 'a@b.mx', plan: 'vip' }, { email: 'a@b.mx', plan: 'pro', days: 0 }, { email: 'a@b.mx', plan: 'pro', days: 1.5 }, { email: 'a@b.mx', plan: 'pro', days: 99999 }]) {
      assert.equal((await call(body)).status, 400, JSON.stringify(body));
    }
    assert.equal((await call({ email: 'Tester@Correo.com', plan: 'pro' })).status, 200);
    const { headers } = await loginAs(routes, deps, sent, 'tester@correo.com');
    assert.equal((await routes.me({ headers }, deps)).body.plan, 'pro');
    assert.equal((await call({ email: 'tester@correo.com', plan: 'free' })).body.proUntil, null);
    assert.equal((await routes.me({ headers }, deps)).body.plan, 'free');
  });
});

describe('reportes de errores', () => {
  const rep = (deps, body, headers = {}, ip = '3.3.3.3') => routes.report({ headers, body, ip }, deps);

  it('guarda el reporte con el ejercicio exacto y el admin lo puede leer', async () => {
    const { deps } = makeDeps();
    const r = await rep(deps, { kind: 'math_error', note: 'La opción B se ve rara', exercise: ex });
    assert.deepEqual([r.status, r.body], [200, { ok: true }]);
    const list = (await routes.adminReports({ headers: admin }, deps)).body.reports;
    assert.equal(list.length, 1);
    assert.deepEqual(list[0].exercise, ex);
    assert.equal(list[0].kind, 'math_error');
    assert.equal(list[0].uid, null);
  });
  it('si el estudiante tiene sesión, el reporte lleva su identificador (no su correo)', async () => {
    const { deps, sent } = makeDeps();
    const { headers } = await loginAs(routes, deps, sent);
    await rep(deps, { note: 'no carga', kind: 'ui' }, headers);
    const [r] = (await routes.adminReports({ headers: admin }, deps)).body.reports;
    assert.match(r.uid, /^[0-9a-f]{24}$/);
    assert.doesNotMatch(JSON.stringify(r), /ana@correo/);
  });
  it('valida tipo, ejercicio y que no esté vacío; recorta notas largas', async () => {
    const { deps } = makeDeps();
    assert.equal((await rep(deps, undefined)).status, 400);
    assert.equal((await rep(deps, { kind: 'otro', note: 'x' })).status, 400);
    assert.equal((await rep(deps, { exercise: { templateId: 'no', seed: 1 } })).status, 400);
    assert.equal((await rep(deps, { exercise: { templateId: 'derivada-cadena', seed: -1 } })).status, 400);
    assert.equal((await rep(deps, { kind: 'ui' })).body.code, 'empty_report');
    await rep(deps, { note: 'x'.repeat(5000) });
    assert.equal((await routes.adminReports({ headers: admin }, deps)).body.reports[0].note.length, 500);
  });
  it('límite de 10 reportes por hora por IP', async () => {
    const { deps } = makeDeps();
    for (let i = 0; i < 10; i++) assert.equal((await rep(deps, { note: `n${i}` })).status, 200);
    assert.equal((await rep(deps, { note: 'n' })).status, 429);
    assert.equal((await rep(deps, { note: 'n' }, {}, '4.4.4.4')).status, 200, 'otra IP sí puede');
  });
});

// ── Adaptador HTTP ───────────────────────────────────────────────
function fakeRes() {
  const res = { statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k] = v; }, end(b) { this.body = b; } };
  return res;
}
const fakeReq = (over = {}) => Object.assign({ method: 'POST', headers: {}, socket: { remoteAddress: '8.8.8.8' } }, over);

describe('adaptador HTTP (wrap)', () => {
  it('responde JSON con Cache-Control: no-store y pasa método, cabeceras, cuerpo e IP a la ruta', async () => {
    let seen;
    const { deps } = makeDeps();
    setDeps(deps);
    const h = wrap(async (ctx) => { seen = ctx; return { status: 201, body: { ok: 1 } }; }, { methods: ['POST'] });
    const res = fakeRes();
    await h(fakeReq({ body: { a: 1 }, headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8', authorization: 'Bearer t' } }), res);
    assert.equal(res.statusCode, 201);
    assert.equal(res.headers['Cache-Control'], 'no-store');
    assert.match(res.headers['Content-Type'], /application\/json/);
    assert.deepEqual(JSON.parse(res.body), { ok: 1 });
    assert.deepEqual([seen.method, seen.body, seen.ip, seen.headers.authorization], ['POST', { a: 1 }, '1.2.3.4', 'Bearer t']);
  });
  it('405 con cabecera Allow para métodos no permitidos', async () => {
    setDeps(makeDeps().deps);
    const res = fakeRes();
    await wrap(async () => ({ status: 200, body: {} }), { methods: ['GET'] })(fakeReq({ method: 'POST' }), res);
    assert.equal(res.statusCode, 405);
    assert.equal(res.headers.Allow, 'GET');
  });
  it('lee el cuerpo desde cadena, Buffer o flujo; rechaza JSON inválido (400) y cuerpos enormes (413)', async () => {
    setDeps(makeDeps().deps);
    const echo = wrap(async (ctx) => ({ status: 200, body: { got: ctx.body ?? null } }), { methods: ['POST'] });
    const run = async (req) => { const r = fakeRes(); await echo(req, r); return r; };
    assert.deepEqual(JSON.parse((await run(fakeReq({ body: '{"x":1}' }))).body), { got: { x: 1 } });
    assert.deepEqual(JSON.parse((await run(fakeReq({ body: Buffer.from('{"y":2}') }))).body), { got: { y: 2 } });
    const stream = Readable.from([Buffer.from('{"z"'), Buffer.from(':3}')]);
    stream.method = 'POST'; stream.headers = {}; stream.socket = {};
    assert.deepEqual(JSON.parse((await run(stream)).body), { got: { z: 3 } });
    assert.deepEqual(JSON.parse((await run(fakeReq({ body: '' }))).body), { got: null });
    const bad = await run(fakeReq({ body: '{no json' }));
    assert.deepEqual([bad.statusCode, JSON.parse(bad.body).code], [400, 'bad_json']);
    const big = await run(fakeReq({ body: 'x'.repeat(40_000) }));
    assert.equal(big.statusCode, 413);
    const bigStream = Readable.from([Buffer.alloc(40_000, 97)]);
    bigStream.method = 'POST'; bigStream.headers = {}; bigStream.socket = {};
    assert.equal((await run(bigStream)).statusCode, 413);
  });
  it('un error inesperado devuelve 500 genérico, sin filtrar el mensaje interno', async () => {
    setDeps(makeDeps().deps);
    const orig = console.error;
    const logs = [];
    console.error = (...a) => logs.push(a.join(' '));
    try {
      const res = fakeRes();
      await wrap(async () => { throw new Error('clave sk-ant-SECRETA en la base'); }, { methods: ['POST'] })(fakeReq({ body: {} }), res);
      assert.equal(res.statusCode, 500);
      assert.deepEqual(JSON.parse(res.body), { code: 'server_error' });
      assert.doesNotMatch(res.body, /SECRETA/);
    } finally {
      console.error = orig;
    }
  });
  it('las peticiones GET no leen cuerpo', async () => {
    setDeps(makeDeps().deps);
    let body = 'marca';
    await wrap(async (ctx) => { body = ctx.body; return { status: 200, body: {} }; }, { methods: ['GET'] })(fakeReq({ method: 'GET' }), fakeRes());
    assert.equal(body, undefined);
  });
});
