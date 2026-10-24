// config.js — lee la configuración desde variables de entorno (nada de secretos en el código).
// Todas las funciones del servidor reciben `config` como parámetro, así que se prueban sin tocar process.env.

const toInt = (v, d) => {
  const n = Number(v);
  return v !== undefined && v !== '' && Number.isFinite(n) && n >= 0 ? Math.floor(n) : d;
};

export function loadConfig(env = process.env) {
  // URL pública de la app: se usa en el enlace del correo. NUNCA se deduce de la cabecera Host
  // (un atacante podría falsearla y mandar a la víctima un enlace hacia su propio dominio).
  const vercelHost = env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${env.VERCEL_PROJECT_PRODUCTION_URL}` : '';
  const appUrl = (env.APP_URL || vercelHost).replace(/\/+$/, '');

  // Proveedor de IA: LLM_PROVIDER lo fija; si no, se usa el que tenga clave (Groq primero). Cambiar a Anthropic
  // es solo agregar ANTHROPIC_API_KEY (y LLM_PROVIDER=anthropic si conviven las dos claves).
  const groqKey = env.GROQ_API_KEY || '';
  const anthropicKey = env.ANTHROPIC_API_KEY || '';
  const wanted = (env.LLM_PROVIDER || '').toLowerCase();
  const provider = wanted === 'groq' || wanted === 'anthropic' ? wanted : groqKey ? 'groq' : anthropicKey ? 'anthropic' : '';
  const MODELS = {
    groq: {
      fast: env.GROQ_MODEL_FAST || 'llama-3.1-8b-instant', // pistas
      standard: env.GROQ_MODEL_STANDARD || 'llama-3.3-70b-versatile', // explicaciones
      deep: env.GROQ_MODEL_DEEP || 'openai/gpt-oss-120b', // "explícamelo de otra forma" (razonamiento)
      vision: env.GROQ_MODEL_VISION || 'qwen/qwen3.8-27b', // escáner de apuntes (modelo en vista previa en Groq)
    },
    anthropic: {
      fast: env.ANTHROPIC_MODEL_FAST || env.MODEL_FAST || 'claude-haiku-5-5',
      standard: env.ANTHROPIC_MODEL_STANDARD || env.MODEL_STANDARD || 'claude-sonnet-5-5',
      deep: env.ANTHROPIC_MODEL_DEEP || env.MODEL_DEEP || 'claude-opus-5-5',
      vision: env.ANTHROPIC_MODEL_VISION || env.MODEL_STANDARD || 'claude-sonnet-5-5',
    },
  };
  const llm = { provider, key: provider === 'groq' ? groqKey : provider === 'anthropic' ? anthropicKey : '', models: MODELS[provider] ?? MODELS.anthropic };

  return {
    llm,
    sessionSecret: env.SESSION_SECRET || '',
    adminToken: env.ADMIN_TOKEN || '',
    appUrl,
    anthropicKey, // (compatibilidad) clave de Anthropic, aunque el proveedor activo sea otro
    models: llm.models,
    billing: {
      // Cobro apagado por defecto: con cuenta, todos tienen tutor, escáner y exámenes. BILLING_ENABLED=1 activa prueba de 30 días + Pro.
      enabled: /^(1|true|yes|si|sí)$/i.test(env.BILLING_ENABLED || ''),
      trialDays: toInt(env.TRIAL_DAYS, 30), // prueba gratis con todo desbloqueado, contada desde el primer registro
      priceMxn: toInt(env.PRO_PRICE_MXN, 50), // precio de Pro por mes
      instructions: (env.PAY_INSTRUCTIONS || '').slice(0, 600), // cómo pagar mientras el cobro sea manual
    },
    limits: {
      tutorPro: toInt(env.TUTOR_PRO_DAILY, 40), // mensajes al Peer Tutor por día
      tutorTrial: toInt(env.TUTOR_TRIAL_DAILY, toInt(env.TUTOR_PRO_DAILY, 40)), // durante la prueba gratis
      tutorFree: toInt(env.TUTOR_FREE_DAILY, 0), // 0 = el tutor es solo Pro
      tutorGlobal: toInt(env.TUTOR_GLOBAL_DAILY, 2000), // freno de emergencia para todo el servicio
    },
    email: { resendKey: env.RESEND_API_KEY || '', from: env.EMAIL_FROM || '' },
    store: {
      url: env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL || '',
      token: env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN || '',
    },
    // Solo para desarrollo local: devuelve el enlace de acceso en la respuesta en vez de enviar correo.
    devMode: env.ELAMATH_DEV === '1',
  };
}

export class NotConfiguredError extends Error {
  constructor(what) {
    super(`not_configured:${what}`);
    this.what = what;
  }
}
