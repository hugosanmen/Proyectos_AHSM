// Pruebas de los módulos base del servidor: config, cripto, almacenes, cuentas, cuota y correo.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { loadConfig } from '../server/config.js';
import { randomToken, safeEqual, sha256Hex, signToken, verifyToken } from '../server/crypto.js';
import { MemoryStore, UpstashStore, createStore } from '../server/store.js';
import { authenticate, normalizeEmail, requestLogin, uidFor, verifyLogin, LOGIN_TTL_S, SESSION_TTL_S } from '../server/auth.js';
import { effectivePlan, quotaStatus, refund, reserve, todayMx } from '../server/quota.js';
import { createMailer } from '../server/mail.js';
import { SECRET, makeClock, makeDeps, tokenFromEmail } from './server.helpers.js';

describe('config', () => {
  it('valores por defecto: tutor solo Pro, modelos por nivel, sin secretos', () => {
    const c = loadConfig({});
    assert.equal(c.limits.tutorFree, 0);
    assert.equal(c.limits.tutorPro, 40);
    assert.equal(c.models.fast, 'claude-haiku-5-5');
    assert.equal(c.models.standard, 'claude-sonnet-5-5');
    assert.equal(c.models.deep, 'claude-opus-5-5');
    assert.equal(c.sessionSecret, '');
    assert.equal(c.anthropicKey, '');
  });
  it('lee variables, tolera números inválidos y quita la barra final de APP_URL', () => {
    const c = loadConfig({ TUTOR_PRO_DAILY: '15', TUTOR_FREE_DAILY: 'abc', TUTOR_GLOBAL_DAILY: '-3', APP_URL: 'https://x.test///', MODEL_FAST: 'm1' });
    assert.equal(c.limits.tutorPro, 15);
    assert.equal(c.limits.tutorFree, 0, 'inválido → por defecto');
    assert.equal(c.limits.tutorGlobal, 2000, 'negativo → por defecto');
    assert.equal(c.appUrl, 'https://x.test');
    assert.equal(c.models.fast, 'm1');
  });
  it('APP_URL sale del entorno de Vercel, nunca de la petición', () => {
    assert.equal(loadConfig({ VERCEL_PROJECT_PRODUCTION_URL: 'elamath.vercel.app' }).appUrl, 'https://elamath.vercel.app');
    assert.equal(loadConfig({ APP_URL: 'https://mia.mx', VERCEL_PROJECT_PRODUCTION_URL: 'otra.vercel.app' }).appUrl, 'https://mia.mx');
  });
  it('acepta los nombres de variable de Upstash y de Vercel KV', () => {
    assert.equal(loadConfig({ UPSTASH_REDIS_REST_URL: 'u1', UPSTASH_REDIS_REST_TOKEN: 't1' }).store.url, 'u1');
    assert.equal(loadConfig({ KV_REST_API_URL: 'u2', KV_REST_API_TOKEN: 't2' }).store.token, 't2');
  });
});

describe('cripto y sesiones firmadas', () => {
  const exp = (s) => Math.floor(Date.now() / 1000) + s;

  it('firma y verifica; el payload viaja intacto', () => {
    const t = signToken({ typ: 'session', uid: 'abc', exp: exp(60) }, SECRET);
    const p = verifyToken(t, SECRET, { typ: 'session' });
    assert.equal(p.uid, 'abc');
  });
  it('rechaza firma incorrecta, secreto distinto y token manipulado', () => {
    const t = signToken({ typ: 'session', uid: 'abc', exp: exp(60) }, SECRET);
    assert.equal(verifyToken(t, 'otro-secreto'), null);
    const [body, sig] = t.split('.');
    const forged = Buffer.from(JSON.stringify({ typ: 'session', uid: 'victima', exp: exp(60) })).toString('base64url');
    assert.equal(verifyToken(`${forged}.${sig}`, SECRET), null, 'payload cambiado con la firma vieja');
    assert.equal(verifyToken(`${body}.${sig}x`, SECRET), null);
    assert.equal(verifyToken(`${body}`, SECRET), null);
    assert.equal(verifyToken('a.b.c', SECRET), null);
    assert.equal(verifyToken('', SECRET), null);
    assert.equal(verifyToken(null, SECRET), null);
    assert.equal(verifyToken('x'.repeat(5000), SECRET), null);
  });
  it('rechaza caducados y exige el tipo correcto', () => {
    const now = Date.parse('2026-10-20T00:00:00Z');
    const t = signToken({ typ: 'session', uid: 'a', exp: now / 1000 + 10 }, SECRET);
    assert.ok(verifyToken(t, SECRET, { typ: 'session', now }));
    assert.equal(verifyToken(t, SECRET, { typ: 'session', now: now + 10_000 }), null, 'justo en la caducidad ya no vale');
    assert.equal(verifyToken(t, SECRET, { typ: 'admin', now }), null);
    const sinExp = signToken({ typ: 'session', uid: 'a' }, SECRET);
    assert.equal(verifyToken(sinExp, SECRET, { typ: 'session' }), null);
  });
  it('sin secreto no firma ni valida', () => {
    assert.throws(() => signToken({ exp: 1 }, ''), /missing_secret/);
    assert.equal(verifyToken('a.b', ''), null);
  });
  it('safeEqual, hashes y tokens aleatorios', () => {
    assert.ok(safeEqual('abc', 'abc'));
    assert.ok(!safeEqual('abc', 'abd'));
    assert.ok(!safeEqual('abc', 'abcd'));
    assert.equal(sha256Hex('a').length, 64);
    assert.notEqual(randomToken(), randomToken());
    assert.ok(randomToken().length >= 40);
  });
});

describe('MemoryStore', () => {
  it('get/set/del, expiración y getdel de un solo uso', async () => {
    const clock = makeClock();
    const s = new MemoryStore({ now: clock.now });
    await s.set('k', 'v', { ex: 10 });
    assert.equal(await s.get('k'), 'v');
    clock.advance(10_001);
    assert.equal(await s.get('k'), null);
    await s.set('u', 'x');
    assert.equal(await s.getdel('u'), 'x');
    assert.equal(await s.getdel('u'), null);
    await s.set('d', '1');
    await s.del('d');
    assert.equal(await s.get('d'), null);
  });
  it('incr conserva la expiración de la primera vez; decr resta', async () => {
    const clock = makeClock();
    const s = new MemoryStore({ now: clock.now });
    assert.equal(await s.incr('c', { ex: 10 }), 1);
    clock.advance(6000);
    assert.equal(await s.incr('c', { ex: 10 }), 2);
    clock.advance(5000); // pasaron 11 s desde el primero
    assert.equal(await s.incr('c', { ex: 10 }), 1, 'la ventana se reinició');
    assert.equal(await s.decr('c'), 0);
  });
  it('listas: lpush con tope y lrange', async () => {
    const s = new MemoryStore();
    for (let i = 1; i <= 5; i++) await s.lpush('l', `v${i}`, { max: 3 });
    assert.deepEqual(await s.lrange('l', 0, -1), ['v5', 'v4', 'v3']);
    assert.deepEqual(await s.lrange('l', 0, 0), ['v5']);
    assert.deepEqual(await s.lrange('nada', 0, -1), []);
  });
});

describe('UpstashStore (REST)', () => {
  function mock(results = []) {
    const calls = [];
    const fetchFn = async (url, init) => {
      calls.push({ url, auth: init.headers.Authorization, cmd: JSON.parse(init.body) });
      const r = results.length ? results.shift() : { result: 'OK' };
      return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r };
    };
    return { calls, fetchFn };
  }
  const make = (m) => new UpstashStore({ url: 'https://r.upstash.io/', token: 'tok', fetchFn: m.fetchFn });

  it('traduce cada operación al comando Redis correcto, con autenticación', async () => {
    const m = mock([{ result: 'v' }, { result: 'OK' }, { result: 'OK' }, { result: 1 }, { result: 1 }]);
    const s = make(m);
    assert.equal(await s.get('a'), 'v');
    await s.set('a', 5, { ex: 60 });
    await s.set('b', 'x');
    await s.del('a');
    await s.getdel('b');
    assert.deepEqual(m.calls.map((c) => c.cmd), [['GET', 'a'], ['SET', 'a', '5', 'EX', 60], ['SET', 'b', 'x'], ['DEL', 'a'], ['GETDEL', 'b']]);
    assert.ok(m.calls.every((c) => c.url === 'https://r.upstash.io' && c.auth === 'Bearer tok'));
  });
  it('incr pone caducidad solo cuando la clave es nueva', async () => {
    const m = mock([{ result: 1 }, { result: 1 }, { result: 2 }]);
    const s = make(m);
    assert.equal(await s.incr('k', { ex: 100 }), 1);
    assert.equal(await s.incr('k', { ex: 100 }), 2);
    assert.deepEqual(m.calls.map((c) => c.cmd), [['INCR', 'k'], ['EXPIRE', 'k', 100], ['INCR', 'k']]);
  });
  it('listas: LPUSH + LTRIM con tope y LRANGE', async () => {
    const m = mock([{ result: 1 }, { result: 'OK' }, { result: ['b', 'a'] }]);
    const s = make(m);
    await s.lpush('l', 'x', { max: 500 });
    assert.deepEqual(await s.lrange('l', 0, 9), ['b', 'a']);
    assert.deepEqual(m.calls.map((c) => c.cmd), [['LPUSH', 'l', 'x'], ['LTRIM', 'l', 0, 499], ['LRANGE', 'l', 0, 9]]);
  });
  it('lanza ante errores HTTP o de Redis', async () => {
    await assert.rejects(make(mock([{ ok: false, status: 500 }])).get('a'), /store_http_500/);
    await assert.rejects(make(mock([{ error: 'ERR' }])).get('a'), /store_error/);
  });
  it('createStore elige Upstash solo si hay URL y token', () => {
    assert.equal(createStore(loadConfig({})).kind, 'memory');
    assert.equal(createStore(loadConfig({ UPSTASH_REDIS_REST_URL: 'u' })).kind, 'memory');
    assert.equal(createStore(loadConfig({ UPSTASH_REDIS_REST_URL: 'u', UPSTASH_REDIS_REST_TOKEN: 't' })).kind, 'upstash');
  });
});

describe('correo (Resend)', () => {
  it('sin credenciales no hay mailer', () => {
    assert.equal(createMailer(loadConfig({})), null);
    assert.equal(createMailer(loadConfig({ RESEND_API_KEY: 'k' })), null);
  });
  it('envía por REST con la clave y el remitente configurados', async () => {
    let seen;
    const mailer = createMailer(loadConfig({ RESEND_API_KEY: 'k', EMAIL_FROM: 'A <a@b.mx>' }), async (url, init) => {
      seen = { url, init };
      return { ok: true };
    });
    await mailer.send({ to: 'x@y.mx', subject: 'S', text: 'T' });
    assert.equal(seen.url, 'https://api.resend.com/emails');
    assert.equal(seen.init.headers.Authorization, 'Bearer k');
    assert.deepEqual(JSON.parse(seen.init.body), { from: 'A <a@b.mx>', to: ['x@y.mx'], subject: 'S', text: 'T' });
  });
  it('error de red o de Resend → email_failed', async () => {
    const cfg = loadConfig({ RESEND_API_KEY: 'k', EMAIL_FROM: 'a@b.mx' });
    await assert.rejects(createMailer(cfg, async () => ({ ok: false })).send({ to: 'x@y.mx', subject: 's', text: 't' }), /email_failed/);
    await assert.rejects(createMailer(cfg, async () => { throw new Error('boom'); }).send({ to: 'x@y.mx', subject: 's', text: 't' }), /email_failed/);
  });
});

describe('cuentas por enlace mágico', () => {
  it('normalizeEmail: limpia y rechaza lo inválido', () => {
    assert.equal(normalizeEmail('  Ana@Correo.COM '), 'ana@correo.com');
    for (const bad of ['a@b', 'a b@c.com', '<x>@y.com', 'sin-arroba.com', '', null, undefined, 42, `${'a'.repeat(250)}@x.com`, 'a@b.c', 'a@@b.com']) {
      assert.equal(normalizeEmail(bad), null, String(bad));
    }
    assert.equal(uidFor('ana@correo.com'), uidFor('ana@correo.com'));
    assert.notEqual(uidFor('ana@correo.com'), uidFor('bob@correo.com'));
  });

  it('requestLogin: guarda solo el HASH del token y manda un enlace a APP_URL', async () => {
    const { deps, sent, store } = makeDeps();
    const r = await requestLogin({ email: 'Ana@correo.com', ip: '1.2.3.4' }, deps);
    assert.deepEqual([r.status, r.body], [200, { ok: true }]);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to, 'ana@correo.com');
    const token = tokenFromEmail(sent[0]);
    assert.match(sent[0].text, /^.*https:\/\/elamath\.test\/\?login=/ms);
    assert.equal(await store.get(`login:${token}`), null, 'el token en claro no se guarda');
    assert.ok(await store.get(`login:${sha256Hex(token)}`));
  });
  it('requestLogin: valida correo, configuración y proveedor de correo', async () => {
    const a = makeDeps();
    assert.equal((await requestLogin({ email: 'malo', ip: 'x' }, a.deps)).status, 400);
    const b = makeDeps({ env: { SESSION_SECRET: '' } });
    assert.equal((await requestLogin({ email: 'a@b.mx', ip: 'x' }, b.deps)).status, 503);
    const c = makeDeps({ env: { APP_URL: '' } });
    assert.equal((await requestLogin({ email: 'a@b.mx', ip: 'x' }, c.deps)).status, 503);
    const d = makeDeps();
    d.deps.mailer = null;
    assert.equal((await requestLogin({ email: 'a@b.mx', ip: 'x' }, d.deps)).body.code, 'email_not_configured');
  });
  it('requestLogin: si falla el envío borra el token y avisa', async () => {
    const { deps, store } = makeDeps({ mailerFails: true });
    const r = await requestLogin({ email: 'a@b.mx', ip: 'x' }, deps);
    assert.deepEqual([r.status, r.body.code], [502, 'email_failed']);
    assert.equal([...store.m.keys()].filter((k) => k.startsWith('login:')).length, 0);
  });
  it('requestLogin: límite de 5 por correo y de 20 por IP cada hora', async () => {
    const { deps, clock } = makeDeps();
    for (let i = 0; i < 5; i++) assert.equal((await requestLogin({ email: 'a@b.mx', ip: `10.0.0.${i}` }, deps)).status, 200);
    assert.equal((await requestLogin({ email: 'a@b.mx', ip: '10.0.0.99' }, deps)).status, 429);
    clock.advance(3600_001);
    assert.equal((await requestLogin({ email: 'a@b.mx', ip: '10.0.0.99' }, deps)).status, 200, 'la ventana se renueva');
    const x = makeDeps();
    for (let i = 0; i < 20; i++) assert.equal((await requestLogin({ email: `u${i}@b.mx`, ip: '5.5.5.5' }, x.deps)).status, 200);
    assert.equal((await requestLogin({ email: 'otro@b.mx', ip: '5.5.5.5' }, x.deps)).status, 429);
  });
  it('modo desarrollo devuelve el enlace sin enviar correo', async () => {
    const { deps, sent } = makeDeps({ env: { ELAMATH_DEV: '1' } });
    deps.mailer = null;
    const r = await requestLogin({ email: 'a@b.mx', ip: 'x' }, deps);
    assert.match(r.body.devLink, /^https:\/\/elamath\.test\/\?login=/);
    assert.equal(sent.length, 0);
  });

  it('verifyLogin: canjea UNA sola vez, crea la cuenta y entrega sesión válida', async () => {
    const { deps, sent } = makeDeps();
    await requestLogin({ email: 'ana@correo.com', ip: 'x' }, deps);
    const token = tokenFromEmail(sent[0]);
    const r = await verifyLogin({ token }, deps);
    assert.equal(r.status, 200);
    assert.equal(r.body.user.email, 'ana@correo.com');
    const again = await verifyLogin({ token }, deps);
    assert.deepEqual([again.status, again.body.code], [401, 'invalid_or_expired']);
    const auth = await authenticate({ authorization: `Bearer ${r.body.session}` }, deps);
    assert.equal(auth.user.plan, 'free');
    assert.equal(auth.uid, uidFor('ana@correo.com'));
  });
  it('verifyLogin: el enlace caduca a los 15 minutos', async () => {
    const { deps, sent, clock } = makeDeps();
    await requestLogin({ email: 'a@b.mx', ip: 'x' }, deps);
    clock.advance(LOGIN_TTL_S * 1000 + 1);
    assert.equal((await verifyLogin({ token: tokenFromEmail(sent[0]) }, deps)).status, 401);
  });
  it('verifyLogin: tokens basura o ausentes', async () => {
    const { deps } = makeDeps();
    for (const t of [undefined, null, 5, 'corto', 'x'.repeat(300), 'a'.repeat(43)]) {
      assert.ok([400, 401].includes((await verifyLogin({ token: t }, deps)).status), String(t));
    }
    assert.equal((await verifyLogin({ token: 'a'.repeat(43) }, makeDeps({ env: { SESSION_SECRET: '' } }).deps)).status, 503);
  });
  it('verifyLogin conserva el plan de una cuenta existente (p. ej. Pro dado por el admin)', async () => {
    const { deps, sent, store } = makeDeps();
    await store.set(`user:${uidFor('pro@b.mx')}`, JSON.stringify({ email: 'pro@b.mx', plan: 'pro', createdAt: 'x' }));
    await requestLogin({ email: 'pro@b.mx', ip: 'x' }, deps);
    const r = await verifyLogin({ token: tokenFromEmail(sent[0]) }, deps);
    const auth = await authenticate({ authorization: `Bearer ${r.body.session}` }, deps);
    assert.equal(auth.user.plan, 'pro');
  });

  it('authenticate: rechaza formatos raros, sesión caducada, otro tipo y cuenta inexistente', async () => {
    const { deps, sent, clock, store } = makeDeps();
    await requestLogin({ email: 'a@b.mx', ip: 'x' }, deps);
    const { body } = await verifyLogin({ token: tokenFromEmail(sent[0]) }, deps);
    const ok = (h) => authenticate({ authorization: h }, deps);
    assert.ok(await ok(`Bearer ${body.session}`));
    assert.ok(await authenticate({ Authorization: `bearer ${body.session}` }, deps), 'insensible a mayúsculas');
    assert.equal(await ok(body.session), null, 'sin "Bearer"');
    assert.equal(await ok(`Basic ${body.session}`), null);
    assert.equal(await ok(`Bearer ${body.session} extra`), null);
    assert.equal(await authenticate({}, deps), null);
    assert.equal(await authenticate(undefined, deps), null);
    const otroTipo = signToken({ typ: 'login', uid: uidFor('a@b.mx'), exp: clock.now() / 1000 + 100 }, deps.config.sessionSecret);
    assert.equal(await ok(`Bearer ${otroTipo}`), null);
    await store.del(`user:${uidFor('a@b.mx')}`);
    assert.equal(await ok(`Bearer ${body.session}`), null, 'cuenta borrada');
    await store.set(`user:${uidFor('a@b.mx')}`, JSON.stringify({ email: 'a@b.mx', plan: 'free' }));
    clock.advance(SESSION_TTL_S * 1000 + 1);
    assert.equal(await ok(`Bearer ${body.session}`), null, 'sesión caducada a los 30 días');
  });
});

describe('plan y cuota diaria del tutor', () => {
  it('todayMx usa el horario de Ciudad de México, no UTC', () => {
    assert.equal(todayMx(Date.parse('2026-10-21T05:59:00Z')), '2026-10-20');
    assert.equal(todayMx(Date.parse('2026-10-21T06:01:00Z')), '2026-10-21');
    assert.equal(todayMx(Date.parse('2026-01-01T05:00:00Z')), '2025-12-31');
  });
  it('effectivePlan: Pro caduca cuando pasa proUntil', () => {
    const now = Date.parse('2026-10-20T00:00:00Z');
    assert.equal(effectivePlan({ plan: 'pro' }, now), 'pro');
    assert.equal(effectivePlan({ plan: 'pro', proUntil: '2026-10-21T00:00:00Z' }, now), 'pro');
    assert.equal(effectivePlan({ plan: 'pro', proUntil: '2026-10-19T00:00:00Z' }, now), 'free');
    assert.equal(effectivePlan({ plan: 'free' }, now), 'free');
    assert.equal(effectivePlan({ plan: 'vip' }, now), 'free');
    assert.equal(effectivePlan(null, now), 'free');
  });
  it('reserve: el plan gratis (límite 0) no consume nada', async () => {
    const { deps, store } = makeDeps();
    assert.deepEqual(await reserve('u1', 'free', deps), { ok: false, reason: 'plan' });
    assert.equal(store.m.size, 0, 'ni siquiera escribe en el almacén');
  });
  it('reserve: respeta el límite diario del Pro y se reinicia al cambiar de día', async () => {
    const { deps, clock } = makeDeps({ env: { TUTOR_PRO_DAILY: '3' }, clock: makeClock(Date.parse('2026-10-21T05:50:00Z')) });
    for (let i = 0; i < 3; i++) assert.equal((await reserve('u1', 'pro', deps)).ok, true);
    assert.deepEqual(await reserve('u1', 'pro', deps), { ok: false, reason: 'daily' });
    assert.deepEqual(await quotaStatus('u1', 'pro', deps), { used: 3, limit: 3, remaining: 0 });
    assert.equal((await reserve('u2', 'pro', deps)).ok, true, 'cada usuario tiene su propia cuota');
    clock.advance(11 * 60_000); // cruzó la medianoche de Ciudad de México
    assert.equal((await reserve('u1', 'pro', deps)).ok, true);
    assert.deepEqual(await quotaStatus('u1', 'pro', deps), { used: 1, limit: 3, remaining: 2 });
  });
  it('el intento rechazado no se queda contado y refund devuelve el mensaje', async () => {
    const { deps } = makeDeps({ env: { TUTOR_PRO_DAILY: '2' } });
    await reserve('u1', 'pro', deps);
    await reserve('u1', 'pro', deps);
    await reserve('u1', 'pro', deps); // rechazado
    assert.equal((await quotaStatus('u1', 'pro', deps)).used, 2);
    await refund('u1', deps);
    assert.equal((await quotaStatus('u1', 'pro', deps)).used, 1);
    assert.equal((await reserve('u1', 'pro', deps)).ok, true);
  });
  it('freno global: al llegar al tope del servicio nadie más pasa (sin cobrar la cuota personal)', async () => {
    const { deps } = makeDeps({ env: { TUTOR_GLOBAL_DAILY: '2', TUTOR_PRO_DAILY: '10' } });
    assert.equal((await reserve('a', 'pro', deps)).ok, true);
    assert.equal((await reserve('b', 'pro', deps)).ok, true);
    assert.deepEqual(await reserve('c', 'pro', deps), { ok: false, reason: 'capacity' });
    assert.equal((await quotaStatus('c', 'pro', deps)).used, 0);
    await refund('a', deps);
    assert.equal((await reserve('c', 'pro', deps)).ok, true, 'al devolverse un mensaje se libera capacidad');
  });
  it('el plan gratis puede tener cuota si se configura', async () => {
    const { deps } = makeDeps({ env: { TUTOR_FREE_DAILY: '1' } });
    assert.equal((await reserve('u', 'free', deps)).ok, true);
    assert.deepEqual(await reserve('u', 'free', deps), { ok: false, reason: 'daily' });
  });
});
