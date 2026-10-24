// Prueba gratis de 30 días, planes, códigos de promoción y escáner de apuntes (reglas del servidor).

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { effectivePlan, trialEnd, trialInfo } from '../server/quota.js';
import { generateCode, normalizeCode } from '../server/promo.js';
import { MAX_IMAGE_B64, parseScanRequest } from '../server/scan.js';
import { routes } from '../server/routes.js';
import { ADMIN, GROQ_ENV, TINY_JPEG_B64, loginAs, makeDeps } from './server.helpers.js';

const DAY = 86_400_000;
const admin = { authorization: `Bearer ${ADMIN}` };
const me = (deps, headers) => routes.me({ headers }, deps);
const mkPromo = (deps, body) => routes.adminPromo({ method: 'POST', headers: admin, body }, deps);
const redeem = (deps, headers, code) => routes.promoRedeem({ headers, body: { code }, ip: '4.4.4.4' }, deps);
const img = { mediaType: 'image/jpeg', data: TINY_JPEG_B64 };
const scan = (deps, headers, body = { image: img }) => routes.scan({ headers, body, ip: '5.5.5.5' }, deps);

describe('prueba gratis (effectivePlan)', () => {
  const t0 = Date.parse('2026-10-01T00:00:00Z');
  const user = (extra = {}) => ({ plan: 'free', createdAt: new Date(t0).toISOString(), ...extra });

  it('30 días completos desde createdAt → trial; al cumplirse → free', () => {
    assert.equal(effectivePlan(user(), t0), 'trial');
    assert.equal(effectivePlan(user(), t0 + 30 * DAY - 1), 'trial');
    assert.equal(effectivePlan(user(), t0 + 30 * DAY), 'free');
    assert.equal(effectivePlan(user(), t0 + 90 * DAY), 'free');
  });
  it('trialDays configurable; sin fecha de creación válida no hay prueba (nunca se regala por error)', () => {
    assert.equal(effectivePlan(user(), t0 + 10 * DAY, 7), 'free');
    assert.equal(effectivePlan(user(), t0 + 10 * DAY, 14), 'trial');
    for (const u of [{}, { createdAt: 'basura' }, null, undefined]) assert.equal(effectivePlan(u, t0), 'free');
  });
  it('Pro vigente gana a la prueba; Pro vencido con prueba vigente cae a trial, vencida a free', () => {
    assert.equal(effectivePlan(user({ plan: 'pro' }), t0), 'pro');
    assert.equal(effectivePlan(user({ plan: 'pro', proUntil: new Date(t0 + DAY).toISOString() }), t0 + 2 * DAY), 'trial');
    assert.equal(effectivePlan(user({ plan: 'pro', proUntil: new Date(t0 + DAY).toISOString() }), t0 + 40 * DAY), 'free');
  });
  it('trialUntil del admin manda sobre createdAt', () => {
    assert.equal(effectivePlan(user({ trialUntil: new Date(t0).toISOString() }), t0), 'free');
    assert.equal(effectivePlan(user({ trialUntil: new Date(t0 + 60 * DAY).toISOString() }), t0 + 45 * DAY), 'trial');
    assert.equal(trialEnd({ trialUntil: 'x' }), null);
  });
  it('trialInfo: días restantes redondeados hacia arriba', () => {
    assert.deepEqual(trialInfo(user(), t0), { endsAt: new Date(t0 + 30 * DAY).toISOString(), daysLeft: 30, active: true });
    assert.equal(trialInfo(user(), t0 + 29 * DAY + 1).daysLeft, 1);
    assert.deepEqual([trialInfo(user(), t0 + 31 * DAY).daysLeft, trialInfo(user(), t0 + 31 * DAY).active], [0, false]);
    assert.deepEqual(trialInfo(null, t0), { endsAt: null, daysLeft: 0, active: false });
  });
});

describe('prueba gratis por las rutas', () => {
  it('cuenta nueva: plan trial, 30 días, tutor con cupo, precio y datos de cobro', async () => {
    const { deps, sent } = makeDeps({ env: { PAY_INSTRUCTIONS: 'Transfiere $50 a la CLABE 000 y manda tu correo.' } });
    const { headers } = await loginAs(routes, deps, sent);
    const r = (await me(deps, headers)).body;
    assert.equal(r.plan, 'trial');
    assert.equal(r.trial.daysLeft, 30);
    assert.equal(r.trial.active, true);
    assert.deepEqual(r.tutor, { used: 0, limit: 40, remaining: 40 });
    assert.deepEqual(r.billing, { enabled: true, priceMxn: 50, trialDays: 30, instructions: 'Transfiere $50 a la CLABE 000 y manda tu correo.' });
  });
  it('la prueba cuenta desde el REGISTRO, no desde el último inicio de sesión', async () => {
    const { deps, sent, clock } = makeDeps();
    await loginAs(routes, deps, sent);
    clock.advance(20 * DAY);
    const again = await loginAs(routes, deps, sent);
    const r = (await me(deps, again.headers)).body;
    assert.equal(r.trial.daysLeft, 10);
  });
  it('a los 30 días: free, tutor 402 sin llamar a la IA, el cupo de prueba propio (TUTOR_TRIAL_DAILY) y precio por variable', async () => {
    const { deps, sent, clock, ai } = makeDeps({ env: { TUTOR_TRIAL_DAILY: '5', PRO_PRICE_MXN: '60' } });
    const { headers } = await loginAs(routes, deps, sent);
    assert.equal((await me(deps, headers)).body.tutor.limit, 5);
    assert.equal((await me(deps, headers)).body.billing.priceMxn, 60);
    clock.advance(30 * DAY);
    const again = await loginAs(routes, deps, sent);
    const r = (await me(deps, again.headers)).body;
    assert.deepEqual([r.plan, r.trial.active, r.tutor.limit], ['free', false, 0]);
    const t = await routes.tutor({ headers: again.headers, body: { message: 'hola' }, ip: '1' }, deps);
    assert.deepEqual([t.status, t.body.code], [402, 'upgrade_required']);
    assert.equal(ai.calls.length, 0);
  });
  it('el admin puede dar Pro a quien ya terminó la prueba (cobro manual) y quitarlo', async () => {
    const { deps, sent, clock } = makeDeps();
    await loginAs(routes, deps, sent);
    clock.advance(40 * DAY);
    const { headers } = await loginAs(routes, deps, sent);
    assert.equal((await me(deps, headers)).body.plan, 'free');
    await routes.adminPlan({ headers: admin, body: { email: 'ana@correo.com', plan: 'pro', days: 30 } }, deps);
    const pro = (await me(deps, headers)).body;
    assert.deepEqual([pro.plan, pro.tutor.limit], ['pro', 40]);
    assert.match(pro.proUntil, /^\d{4}-/);
    await routes.adminPlan({ headers: admin, body: { email: 'ana@correo.com', plan: 'free' } }, deps);
    assert.equal((await me(deps, headers)).body.plan, 'free');
  });
  it('health publica precio y días de prueba (sin secretos)', async () => {
    const { deps } = makeDeps();
    const h = (await routes.health({}, deps)).body;
    assert.deepEqual(h.billing, { enabled: true, priceMxn: 50, trialDays: 30, instructions: '' });
  });
});

describe('códigos de promoción', () => {
  it('normalizeCode y generateCode (alfabeto sin 0/O/1/I)', () => {
    assert.equal(normalizeCode(' ela-ab12 cd!'), 'ELA-AB12CD');
    for (let i = 0; i < 50; i++) assert.match(generateCode(), /^ELA-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
    assert.notEqual(generateCode(), generateCode());
  });
  it('solo el admin crea y lista; valida los datos', async () => {
    const { deps, sent } = makeDeps();
    const { headers } = await loginAs(routes, deps, sent);
    assert.equal((await routes.adminPromo({ method: 'POST', headers, body: { days: 5 } }, deps)).status, 401);
    assert.equal((await routes.adminPromo({ method: 'GET', headers }, deps)).status, 401);
    const noAdmin = makeDeps({ env: { ADMIN_TOKEN: '' } });
    assert.equal((await routes.adminPromo({ method: 'POST', headers: admin, body: { days: 5 } }, noAdmin.deps)).status, 503);
    for (const body of [undefined, {}, { days: 0 }, { days: 1.5 }, { days: 9999 }, { days: 5, maxUses: 0 }, { days: 5, maxUses: 'x' }, { days: 5, expiresInDays: 0 }, { days: 5, code: '!!' }]) {
      assert.equal((await mkPromo(deps, body)).status, 400, JSON.stringify(body));
    }
    const ok = await mkPromo(deps, { code: 'unam-2026', days: 15, maxUses: 3, expiresInDays: 10, note: 'Grupo de Cálculo' });
    assert.equal(ok.status, 200);
    assert.equal(ok.body.promo.code, 'UNAM-2026');
    assert.equal((await mkPromo(deps, { code: 'UNAM-2026', days: 1 })).status, 409, 'no se pisa un código existente');
    const list = (await routes.adminPromo({ method: 'GET', headers: admin }, deps)).body.promos;
    assert.deepEqual(list.map((p) => [p.code, p.days, p.maxUses, p.uses, p.note]), [['UNAM-2026', 15, 3, 0, 'Grupo de Cálculo']]);
    assert.equal((await mkPromo(deps, { days: 7 })).body.promo.code.startsWith('ELA-'), true, 'sin código, se genera uno');
  });
  it('canjear: suma días de Pro a la cuenta y sube el cupo; el código también sirve a quien ya terminó la prueba', async () => {
    const { deps, sent, clock } = makeDeps();
    await loginAs(routes, deps, sent);
    clock.advance(45 * DAY);
    const { headers } = await loginAs(routes, deps, sent);
    assert.equal((await me(deps, headers)).body.plan, 'free');
    await mkPromo(deps, { code: 'REGALO30', days: 30, maxUses: 10 });
    const r = await redeem(deps, headers, ' regalo30 ');
    assert.equal(r.status, 200);
    assert.deepEqual([r.body.days, r.body.plan, r.body.tutor.limit], [30, 'pro', 40]);
    assert.equal(r.body.proUntil, new Date(clock.now() + 30 * DAY).toISOString());
    const after = (await me(deps, headers)).body;
    assert.deepEqual([after.plan, after.proUntil], ['pro', r.body.proUntil]);
  });
  it('si ya tiene Pro, los días se suman al final del Pro actual (no se pierden)', async () => {
    const { deps, sent, clock } = makeDeps();
    const { headers } = await loginAs(routes, deps, sent);
    await routes.adminPlan({ headers: admin, body: { email: 'ana@correo.com', plan: 'pro', days: 10 } }, deps);
    await mkPromo(deps, { code: 'EXTRA20', days: 20 });
    const r = await redeem(deps, headers, 'EXTRA20');
    assert.equal(r.body.proUntil, new Date(clock.now() + 30 * DAY).toISOString());
  });
  it('un solo uso por cuenta (aunque lo intenten dos veces seguidas)', async () => {
    const { deps, sent } = makeDeps();
    const { headers } = await loginAs(routes, deps, sent);
    await mkPromo(deps, { code: 'UNAVEZ', days: 5, maxUses: 100 });
    const [a, b] = await Promise.all([redeem(deps, headers, 'UNAVEZ'), redeem(deps, headers, 'UNAVEZ')]);
    assert.deepEqual([a.status, b.status].sort(), [200, 409]);
    const c = await redeem(deps, headers, 'UNAVEZ');
    assert.deepEqual([c.status, c.body.code], [409, 'already_used']);
    assert.equal((await routes.adminPromo({ method: 'GET', headers: admin }, deps)).body.promos[0].uses, 1);
  });
  it('tope global de usos: el siguiente estudiante recibe 410 y no se le da Pro ni se gasta su intento', async () => {
    const { deps, sent, clock } = makeDeps();
    await mkPromo(deps, { code: 'DOSUSOS', days: 5, maxUses: 2 });
    const users = [];
    for (const email of ['a@x.mx', 'b@x.mx', 'c@x.mx']) users.push(await loginAs(routes, deps, sent, email));
    assert.equal((await redeem(deps, users[0].headers, 'DOSUSOS')).status, 200);
    assert.equal((await redeem(deps, users[1].headers, 'DOSUSOS')).status, 200);
    const third = await redeem(deps, users[2].headers, 'DOSUSOS');
    assert.deepEqual([third.status, third.body.code], [410, 'code_exhausted']);
    const retry = await redeem(deps, users[2].headers, 'DOSUSOS');
    assert.deepEqual([retry.status, retry.body.code], [410, 'code_exhausted'], 'el intento fallido no queda "gastado" en su cuenta');
    assert.equal((await routes.adminPromo({ method: 'GET', headers: admin }, deps)).body.promos[0].uses, 2, 'el contador no se pasa');
    clock.advance(0);
    assert.equal((await me(deps, users[2].headers)).body.plan, 'trial', 'sigue con su prueba, sin Pro');
    // si el administrador sube el tope creando otro código, esa persona aún puede canjear (su intento no quedó gastado)
    await mkPromo(deps, { code: 'MASUSOS', days: 5 });
    assert.equal((await redeem(deps, users[2].headers, 'MASUSOS')).status, 200);
  });
  it('código caducado → 410; inexistente → 404 (misma respuesta para cualquier código malo)', async () => {
    const { deps, sent, clock } = makeDeps();
    const { headers } = await loginAs(routes, deps, sent);
    await mkPromo(deps, { code: 'CADUCA', days: 5, expiresInDays: 2 });
    clock.advance(3 * DAY);
    const again = await loginAs(routes, deps, sent);
    const e = await redeem(deps, again.headers, 'CADUCA');
    assert.deepEqual([e.status, e.body.code], [410, 'code_expired']);
    for (const bad of ['NOEXISTE', '', '   ', '!!', 'x'.repeat(100), undefined, 42]) {
      const r = await redeem(deps, again.headers, bad);
      assert.deepEqual([r.status, r.body.code], [404, 'invalid_code'], String(bad));
    }
    assert.equal((await redeem(deps, { authorization: 'Bearer nope' }, 'CADUCA')).status, 401);
    void headers;
  });
  it('freno a la fuerza bruta: 10 intentos por hora por cuenta', async () => {
    const { deps, sent, clock } = makeDeps();
    const { headers } = await loginAs(routes, deps, sent);
    for (let i = 0; i < 10; i++) assert.equal((await redeem(deps, headers, `MALO${i}`)).status, 404);
    const r = await redeem(deps, headers, 'MALO11');
    assert.deepEqual([r.status, r.body.code], [429, 'rate_limited']);
    clock.advance(61 * 60 * 1000);
    assert.equal((await redeem(deps, headers, 'MALO12')).status, 404, 'pasada la hora vuelve a intentar');
  });
});

describe('escáner de apuntes', () => {
  it('parseScanRequest: tipos, tamaño, base64 y firma real del archivo', () => {
    assert.deepEqual(parseScanRequest({ image: img }), { mediaType: 'image/jpeg', data: TINY_JPEG_B64, message: '' });
    assert.equal(parseScanRequest({ image: img, message: '  revisa  ' }).message, 'revisa');
    const head = Buffer.from(TINY_JPEG_B64, 'base64');
    const jpegOf = (bytes) => Buffer.concat([head, Buffer.alloc(bytes - head.length)]).toString('base64');
    const png = Buffer.concat([Buffer.from([0x89]), Buffer.from('PNG\r\n'), Buffer.alloc(20)]).toString('base64');
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 '), Buffer.alloc(8)]).toString('base64');
    assert.equal(parseScanRequest({ image: { mediaType: 'image/png', data: png } }).mediaType, 'image/png');
    assert.equal(parseScanRequest({ image: { mediaType: 'image/webp', data: webp } }).mediaType, 'image/webp');
    assert.equal(parseScanRequest({ image: { mediaType: 'image/jpeg', data: jpegOf((MAX_IMAGE_B64 / 4) * 3) } }).data.length, MAX_IMAGE_B64, 'justo en el límite pasa');
    const bad = [
      { image: { mediaType: 'image/jpeg', data: jpegOf((MAX_IMAGE_B64 / 4) * 3 + 3) } }, // JPEG válido pero demasiado pesado
      { image: { mediaType: 'image/jpeg', data: `${TINY_JPEG_B64}@@@` } }, // cabecera buena, cola que no es base64
      { image: { mediaType: 'image/webp', data: png } }, // PNG disfrazado de WebP
      { image: { mediaType: 'image/webp', data: TINY_JPEG_B64 } },
      undefined, {}, { image: null }, { image: { mediaType: 'image/gif', data: TINY_JPEG_B64 } }, { image: { mediaType: 'image/jpeg', data: '' } },
      { image: { mediaType: 'image/jpeg', data: 'no es base64!' } }, { image: { mediaType: 'image/jpeg', data: 'A'.repeat(MAX_IMAGE_B64 + 4) } },
      { image: { mediaType: 'image/png', data: TINY_JPEG_B64 } }, // JPEG disfrazado de PNG
      { image: { mediaType: 'image/jpeg', data: Buffer.from('<html>hola</html>').toString('base64') } },
      { image: img, message: 12 },
    ];
    for (const b of bad) assert.throws(() => parseScanRequest(b), (e) => e.code === 'bad_image' || e.code === 'bad_message', JSON.stringify(b)?.slice(0, 60));
  });

  it('flujo: foto → visión de Groq (modelo de visión) → respuesta; descuenta 1 de la cuota compartida', async () => {
    const { deps, sent, ai } = makeDeps({ env: GROQ_ENV, anthropic: { reply: '**Lo que leí** $x^2$' } });
    const { headers } = await loginAs(routes, deps, sent);
    const r = await scan(deps, headers, { image: img, message: 'no sé si derivé bien' });
    assert.equal(r.status, 200);
    assert.equal(r.body.reply, '**Lo que leí** $x^2$');
    assert.deepEqual(r.body.tutor, { used: 1, limit: 40, remaining: 39 });
    const c = ai.calls[0];
    assert.match(c.url, /groq\.com/);
    assert.equal(c.body.model, 'qwen/qwen3.8-27b');
    const user = c.body.messages[1].content;
    assert.equal(user[0].image_url.url, `data:image/jpeg;base64,${TINY_JPEG_B64}`);
    assert.match(user[1].text, /no sé si derivé bien/);
    assert.match(c.body.messages[0].content, /nunca instrucciones/i, 'el prompt trata el texto de la foto como contenido, no como órdenes');
    assert.doesNotMatch(JSON.stringify(r.body), /gsk_|qwen/);
    assert.equal((await me(deps, headers)).body.tutor.used, 1, 'comparte cuota con el tutor');
  });
  it('si la IA falla se devuelve el mensaje (502, cuota intacta)', async () => {
    const { deps, sent } = makeDeps({ env: GROQ_ENV, anthropic: { status: 500 } });
    const { headers } = await loginAs(routes, deps, sent);
    const r = await scan(deps, headers);
    assert.deepEqual([r.status, r.body.code], [502, 'upstream_error']);
    assert.equal((await me(deps, headers)).body.tutor.used, 0);
  });
  it('sin sesión 401; imagen mala 400 sin gastar; sin IA 503; sin prueba ni Pro 402 sin llamar a la IA', async () => {
    const { deps, sent, ai, clock } = makeDeps({ env: GROQ_ENV });
    assert.equal((await scan(deps, {})).status, 401);
    const { headers } = await loginAs(routes, deps, sent);
    assert.equal((await scan(deps, headers, { image: { mediaType: 'image/jpeg', data: 'zzz!' } })).status, 400);
    assert.equal(ai.calls.length, 0);
    const none = makeDeps({ env: { ANTHROPIC_API_KEY: '' } });
    const l2 = await loginAs(routes, none.deps, none.sent);
    assert.deepEqual([(await scan(none.deps, l2.headers)).status, (await scan(none.deps, l2.headers)).body.code], [503, 'scan_not_configured']);
    clock.advance(31 * DAY);
    const old = await loginAs(routes, deps, sent);
    const r = await scan(deps, old.headers);
    assert.deepEqual([r.status, r.body.code], [402, 'upgrade_required']);
    assert.equal(ai.calls.length, 0);
  });
  it('el tope diario aplica al escáner igual que al tutor (429) y el global protege el presupuesto', async () => {
    const { deps, sent } = makeDeps({ env: { ...GROQ_ENV, TUTOR_TRIAL_DAILY: '2' } });
    const { headers } = await loginAs(routes, deps, sent);
    assert.equal((await scan(deps, headers)).status, 200);
    assert.equal((await routes.tutor({ headers, body: { message: 'x' }, ip: '1' }, deps)).status, 200);
    const r = await scan(deps, headers);
    assert.deepEqual([r.status, r.body.code], [429, 'daily_limit']);
    const cap = makeDeps({ env: { ...GROQ_ENV, TUTOR_GLOBAL_DAILY: '1' } });
    const a = await loginAs(routes, cap.deps, cap.sent, 'a@x.mx');
    const b = await loginAs(routes, cap.deps, cap.sent, 'b@x.mx');
    assert.equal((await scan(cap.deps, a.headers)).status, 200);
    assert.deepEqual([(await scan(cap.deps, b.headers)).status], [503]);
  });
});

describe('etapa de pruebas (cobro apagado, el valor por defecto)', () => {
  const open = { BILLING_ENABLED: '' };
  it('sin BILLING_ENABLED el cobro está apagado; con 1/true/sí se enciende', async () => {
    const { loadConfig } = await import('../server/config.js');
    const base = { SESSION_SECRET: 'x'.repeat(40) };
    assert.equal(loadConfig(base).billing.enabled, false);
    for (const v of ['1', 'true', 'TRUE', 'yes', 'si', 'sí']) assert.equal(loadConfig({ ...base, BILLING_ENABLED: v }).billing.enabled, true, v);
    for (const v of ['0', 'false', 'no', 'cualquier cosa']) assert.equal(loadConfig({ ...base, BILLING_ENABLED: v }).billing.enabled, false, v);
  });
  it('effectivePlan: cuenta → open aunque la prueba ya haya terminado; sin usuario → free', () => {
    const old = { plan: 'free', createdAt: '2020-01-01T00:00:00Z' };
    assert.equal(effectivePlan(old, Date.now(), 30, false), 'open');
    assert.equal(effectivePlan(old, Date.now(), 30, true), 'free');
    assert.equal(effectivePlan(null, Date.now(), 30, false), 'free');
  });
  it('tutor y escáner funcionan a cualquier fecha para cualquier cuenta, con cupo diario y sin 402', async () => {
    const { deps, sent, clock, ai } = makeDeps({ env: { ...open, ...GROQ_ENV } });
    await loginAs(routes, deps, sent);
    clock.advance(200 * DAY); // mucho después de lo que sería la prueba
    const { headers } = await loginAs(routes, deps, sent);
    const m = (await me(deps, headers)).body;
    assert.deepEqual([m.plan, m.billing.enabled, m.tutor.limit], ['open', false, 40]);
    assert.equal((await routes.tutor({ headers, body: { message: 'hola' }, ip: '1' }, deps)).status, 200);
    assert.equal((await scan(deps, headers)).status, 200);
    assert.equal(ai.calls.length, 2);
    assert.equal((await me(deps, headers)).body.tutor.used, 2);
  });
  it('sigue exigiendo cuenta, respeta el tope diario y el global', async () => {
    const { deps, sent } = makeDeps({ env: { ...open, ...GROQ_ENV, TUTOR_TRIAL_DAILY: '1' } });
    assert.equal((await routes.tutor({ headers: {}, body: { message: 'x' }, ip: '1' }, deps)).status, 401);
    assert.equal((await scan(deps, {})).status, 401);
    const { headers } = await loginAs(routes, deps, sent);
    assert.equal((await routes.tutor({ headers, body: { message: 'x' }, ip: '1' }, deps)).status, 200);
    assert.equal((await routes.tutor({ headers, body: { message: 'x' }, ip: '1' }, deps)).body.code, 'daily_limit');
  });
  it('health informa que no hay cobro', async () => {
    const { deps } = makeDeps({ env: open });
    assert.equal((await routes.health({}, deps)).body.billing.enabled, false);
  });
});
