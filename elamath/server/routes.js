// routes.js — todas las rutas de la API como funciones puras: (ctx, deps) → { status, body }.
//   ctx  = { method, headers, body, ip }
//   deps = { config, store, storeKind, mailer, fetchFn, now }
// Los archivos de /api solo adaptan esto a Vercel (ver http.js), así se prueba sin servidor.

import { authenticate, getUser, normalizeEmail, requestLogin, uidFor, verifyLogin } from './auth.js';
import { safeEqual } from './crypto.js';
import { effectivePlan, quotaStatus, refund, reserve, trialInfo } from './quota.js';
import { createPromo, listPromos, redeemPromo } from './promo.js';
import { askScan, parseScanRequest } from './scan.js';
import { llmConfigured } from './llm.js';
import { listReports, submitReport } from './reports.js';
import { BadRequest, UpstreamError, askTutor, parseTutorRequest } from './tutor.js';

const json = (status, body) => ({ status, body });

function isAdmin(ctx, config) {
  const m = /^Bearer\s+(\S+)$/i.exec(ctx.headers?.authorization || '');
  return Boolean(config.adminToken && m && safeEqual(m[1], config.adminToken));
}

const billingInfo = (config) => ({ enabled: config.billing.enabled, priceMxn: config.billing.priceMxn, trialDays: config.billing.trialDays, instructions: config.billing.instructions });
const planOf = (user, { config, now }) => effectivePlan(user, now(), config.billing.trialDays, config.billing.enabled);

export const routes = {
  async health(_ctx, { config, storeKind }) {
    return json(200, {
      ok: true,
      store: storeKind,
      auth: Boolean(config.sessionSecret && config.appUrl),
      email: Boolean(config.email.resendKey && config.email.from) || config.devMode,
      tutor: llmConfigured(config),
      provider: config.llm.provider || null,
      scan: llmConfigured(config) && Boolean(config.llm.models.vision),
      billing: billingInfo(config),
      admin: Boolean(config.adminToken),
    });
  },

  async authRequest(ctx, deps) {
    return requestLogin({ email: ctx.body?.email, ip: ctx.ip }, deps);
  },

  async authVerify(ctx, deps) {
    return verifyLogin({ token: ctx.body?.token }, deps);
  },

  async me(ctx, deps) {
    const auth = await authenticate(ctx.headers, deps);
    if (!auth) return json(401, { code: 'unauthorized' });
    const plan = planOf(auth.user, deps);
    return json(200, {
      email: auth.user.email,
      plan,
      trial: trialInfo(auth.user, deps.now(), deps.config.billing.trialDays),
      proUntil: auth.user.plan === 'pro' ? auth.user.proUntil ?? null : null,
      billing: billingInfo(deps.config),
      tutor: await quotaStatus(auth.uid, plan, deps),
    });
  },

  async tutor(ctx, deps) {
    const { config, now } = deps;
    const auth = await authenticate(ctx.headers, deps);
    if (!auth) return json(401, { code: 'unauthorized' });

    let parsed;
    try {
      parsed = parseTutorRequest(ctx.body);
    } catch (err) {
      if (err instanceof BadRequest) return json(400, { code: err.code });
      throw err;
    }
    if (!llmConfigured(config)) return json(503, { code: 'tutor_not_configured' });

    const plan = planOf(auth.user, deps);
    const r = await reserve(auth.uid, plan, deps);
    if (!r.ok) {
      if (r.reason === 'plan') return json(402, { code: 'upgrade_required' });
      if (r.reason === 'capacity') return json(503, { code: 'capacity' });
      return json(429, { code: 'daily_limit', tutor: await quotaStatus(auth.uid, plan, deps) });
    }

    try {
      const { reply } = await askTutor(parsed, deps);
      return json(200, { reply, tutor: await quotaStatus(auth.uid, plan, deps) });
    } catch (err) {
      await refund(auth.uid, deps); // si falló la IA, no se le descuenta el mensaje al estudiante
      if (err instanceof UpstreamError) {
        console.error(`[tutor] upstream_error: ${err.message}`); // solo el motivo (p. ej. status_401), nunca claves
        return json(502, { code: 'upstream_error' });
      }
      if (err instanceof BadRequest) return json(400, { code: err.code });
      throw err;
    }
  },

  // Escáner de apuntes: comparte la cuota diaria del tutor (cada foto cuenta como un mensaje).
  async scan(ctx, deps) {
    const { config } = deps;
    const auth = await authenticate(ctx.headers, deps);
    if (!auth) return json(401, { code: 'unauthorized' });
    let parsed;
    try {
      parsed = parseScanRequest(ctx.body);
    } catch (err) {
      if (err instanceof BadRequest) return json(400, { code: err.code });
      throw err;
    }
    if (!llmConfigured(config) || !config.llm.models.vision) return json(503, { code: 'scan_not_configured' });

    const plan = planOf(auth.user, deps);
    const r = await reserve(auth.uid, plan, deps);
    if (!r.ok) {
      if (r.reason === 'plan') return json(402, { code: 'upgrade_required' });
      if (r.reason === 'capacity') return json(503, { code: 'capacity' });
      return json(429, { code: 'daily_limit', tutor: await quotaStatus(auth.uid, plan, deps) });
    }
    try {
      const { reply } = await askScan(parsed, deps);
      return json(200, { reply, tutor: await quotaStatus(auth.uid, plan, deps) });
    } catch (err) {
      await refund(auth.uid, deps);
      if (err instanceof UpstreamError) {
        console.error(`[scan] upstream_error: ${err.message}`);
        return json(502, { code: 'upstream_error' });
      }
      throw err;
    }
  },

  async promoRedeem(ctx, deps) {
    const auth = await authenticate(ctx.headers, deps);
    if (!auth) return json(401, { code: 'unauthorized' });
    const out = await redeemPromo({ uid: auth.uid, user: auth.user, code: ctx.body?.code }, deps);
    if (out.status !== 200) return out;
    const user = await getUser(deps.store, auth.uid);
    const plan = planOf(user, deps);
    return json(200, { ...out.body, plan, tutor: await quotaStatus(auth.uid, plan, deps) });
  },

  async report(ctx, deps) {
    const auth = await authenticate(ctx.headers, deps); // opcional: solo para saber quién reporta
    return submitReport({ body: ctx.body, ip: ctx.ip, uid: auth?.uid }, deps);
  },

  // ── Administración (solo con ADMIN_TOKEN) ─────────────────────
  async adminPlan(ctx, deps) {
    const { config, store, now } = deps;
    if (!config.adminToken) return json(503, { code: 'admin_disabled' });
    if (!isAdmin(ctx, config)) return json(401, { code: 'unauthorized' });
    const email = normalizeEmail(ctx.body?.email);
    const plan = ctx.body?.plan;
    if (!email || (plan !== 'pro' && plan !== 'free')) return json(400, { code: 'bad_request' });
    const days = ctx.body?.days;
    if (days !== undefined && !(Number.isInteger(days) && days > 0 && days <= 3650)) return json(400, { code: 'bad_days' });

    const uid = uidFor(email);
    const user = (await getUser(store, uid)) ?? { email, createdAt: new Date(now()).toISOString() };
    user.plan = plan;
    if (plan === 'pro' && days) user.proUntil = new Date(now() + days * 86_400_000).toISOString();
    else delete user.proUntil;
    if (plan === 'free') user.trialUntil = new Date(now()).toISOString(); // "free" desde el admin también termina la prueba
    else delete user.trialUntil;
    await store.set(`user:${uid}`, JSON.stringify(user));
    return json(200, { ok: true, email, plan, proUntil: user.proUntil ?? null });
  },

  async adminPromo(ctx, deps) {
    if (!deps.config.adminToken) return json(503, { code: 'admin_disabled' });
    if (!isAdmin(ctx, deps.config)) return json(401, { code: 'unauthorized' });
    if (ctx.method === 'GET') return json(200, { promos: await listPromos(deps) });
    return createPromo(ctx.body, deps);
  },

  async adminReports(ctx, deps) {
    if (!deps.config.adminToken) return json(503, { code: 'admin_disabled' });
    if (!isAdmin(ctx, deps.config)) return json(401, { code: 'unauthorized' });
    return json(200, { reports: await listReports(deps) });
  },
};
