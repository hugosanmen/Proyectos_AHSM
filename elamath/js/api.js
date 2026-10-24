// api.js — cliente de la API de ElaMath (FASE 2).
//
// - La sesión viaja en la cabecera `Authorization: Bearer ...` (no en cookies).
// - Nunca lanza errores "sueltos": todo falla con ApiError { status, code }.
//   status 0 / code 'network' = sin conexión o servidor inalcanzable.
// - `health()` jamás lanza: si no hay backend (p. ej. alojado en GitHub Pages) devuelve { available:false }.

export class ApiError extends Error {
  constructor(status, code, data = null) {
    super(code);
    this.status = status;
    this.code = code;
    this.data = data;
  }
}

const SESSION_KEY = 'elamath:session';
const ACCOUNT_KEY = 'elamath:account';

function safeStorage() {
  try {
    const s = globalThis.localStorage;
    s.setItem('__elamath_probe', '1');
    s.removeItem('__elamath_probe');
    return s;
  } catch {
    return null;
  }
}

export function createApi({ fetchFn, storage, base = '' } = {}) {
  const doFetch = fetchFn ?? ((...a) => globalThis.fetch(...a));
  const store = storage === undefined ? safeStorage() : storage;
  const mem = {}; // respaldo si localStorage no está disponible (modo privado, bloqueado)

  const read = (key) => {
    try {
      const v = store?.getItem(key);
      if (v) return v;
    } catch {
      /* se usa memoria */
    }
    return mem[key] ?? null;
  };
  const write = (key, value) => {
    if (value == null) delete mem[key];
    else mem[key] = value;
    try {
      if (value == null) store?.removeItem(key);
      else store?.setItem(key, value);
    } catch {
      /* solo memoria */
    }
  };

  async function request(path, { method = 'GET', body, auth = false } = {}) {
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const token = read(SESSION_KEY);
    if (auth || token) {
      if (token) headers.Authorization = `Bearer ${token}`;
      else if (auth) throw new ApiError(401, 'unauthorized');
    }
    let res;
    try {
      res = await doFetch(base + path, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    } catch {
      throw new ApiError(0, 'network');
    }
    let data = null;
    try {
      data = await res.json();
    } catch {
      /* cuerpo no JSON */
    }
    if (!res.ok) {
      if (res.status === 401 && auth) clearSession(); // sesión vencida o inválida
      throw new ApiError(res.status, data?.code ?? 'error', data);
    }
    return data;
  }

  function clearSession() {
    write(SESSION_KEY, null);
    write(ACCOUNT_KEY, null);
  }

  return {
    hasSession: () => Boolean(read(SESSION_KEY)),

    /** { available:true, ... } si hay backend; { available:false, reason:'network'|'absent' } si no. */
    async health() {
      try {
        const res = await doFetch(`${base}/api/health`, { headers: { Accept: 'application/json' } });
        const data = await res.json();
        if (res.ok && data && data.ok === true) return { available: true, ...data };
        return { available: false, reason: 'absent' };
      } catch (err) {
        // fetch lanza → sin red; res.json() lanza → respondió algo que no es la API (hosting estático)
        return { available: false, reason: err instanceof SyntaxError ? 'absent' : 'network' };
      }
    },

    requestLogin: (email) => request('/api/auth/request', { method: 'POST', body: { email } }),

    async verifyLogin(token) {
      const out = await request('/api/auth/verify', { method: 'POST', body: { token } });
      write(SESSION_KEY, out.session);
      return out.user;
    },

    async me() {
      const out = await request('/api/me', { auth: true });
      write(ACCOUNT_KEY, JSON.stringify(out));
      return out;
    },

    /** Última cuenta conocida (para mostrar la interfaz sin conexión). */
    cachedAccount() {
      try {
        return JSON.parse(read(ACCOUNT_KEY));
      } catch {
        return null;
      }
    },
    updateCachedAccount(patch) {
      const cur = this.cachedAccount();
      if (cur) write(ACCOUNT_KEY, JSON.stringify({ ...cur, ...patch }));
    },

    tutor: (payload) => request('/api/tutor', { method: 'POST', body: payload, auth: true }),
    /** Canjea un código de promoción; actualiza la cuenta guardada con el plan nuevo. */
    async redeemPromo(code) {
      const out = await request('/api/promo/redeem', { method: 'POST', body: { code }, auth: true });
      this.updateCachedAccount({ plan: out.plan, tutor: out.tutor, proUntil: out.proUntil });
      return out;
    },
    /** Escáner de apuntes: { image:{mediaType,data}, message? } → { reply, tutor }. */
    scan: (payload) => request('/api/scan', { method: 'POST', body: payload, auth: true }),
    report: (payload) => request('/api/report', { method: 'POST', body: payload }),
    logout: clearSession,
  };
}
