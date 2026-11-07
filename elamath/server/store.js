// store.js — almacén clave-valor con dos implementaciones de la MISMA interfaz:
//   MemoryStore  → pruebas y desarrollo local (en Vercel NO persiste entre invocaciones)
//   UpstashStore → Redis por REST (gratis desde el Marketplace de Vercel), sin dependencias
//
// Interfaz (todo async, valores siempre cadenas como en Redis):
//   get, set(key, val, {ex}), del, getdel, incr(key, {ex}), incrby(key, n, {ex}), decr, lpush(key, val, {max}),
//   lrange(key, a, b), scan(prefix, {limit}), mget(keys)

export class MemoryStore {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.m = new Map();
  }

  _live(key) {
    const e = this.m.get(key);
    if (!e) return null;
    if (e.exp !== null && e.exp <= this.now()) {
      this.m.delete(key);
      return null;
    }
    return e;
  }

  async get(key) {
    const e = this._live(key);
    return e && typeof e.v === 'string' ? e.v : null;
  }

  async set(key, val, { ex } = {}) {
    this.m.set(key, { v: String(val), exp: ex ? this.now() + ex * 1000 : null });
  }

  async del(key) {
    this.m.delete(key);
  }

  async getdel(key) {
    const v = await this.get(key);
    this.m.delete(key);
    return v;
  }

  async incr(key, { ex } = {}) {
    const e = this._live(key);
    const n = (e ? parseInt(e.v, 10) || 0 : 0) + 1;
    this.m.set(key, { v: String(n), exp: e ? e.exp : ex ? this.now() + ex * 1000 : null });
    return n;
  }

  async incrby(key, n, { ex } = {}) {
    const e = this._live(key);
    const v = (e ? parseInt(e.v, 10) || 0 : 0) + n;
    this.m.set(key, { v: String(v), exp: e ? e.exp : ex ? this.now() + ex * 1000 : null });
    return v;
  }

  async scan(prefix, { limit = 10_000 } = {}) {
    return [...this.m.keys()].filter((k) => k.startsWith(prefix) && this._live(k)).slice(0, limit);
  }

  async mget(keys) {
    return Promise.all(keys.map((k) => this.get(k)));
  }

  async decr(key) {
    const e = this._live(key);
    const n = (e ? parseInt(e.v, 10) || 0 : 0) - 1;
    this.m.set(key, { v: String(n), exp: e ? e.exp : null });
    return n;
  }

  async lpush(key, val, { max } = {}) {
    const e = this._live(key);
    const list = e && Array.isArray(e.v) ? e.v : [];
    list.unshift(String(val));
    if (max) list.length = Math.min(list.length, max);
    this.m.set(key, { v: list, exp: null });
  }

  async lrange(key, start, stop) {
    const e = this._live(key);
    const list = e && Array.isArray(e.v) ? e.v : [];
    return list.slice(start, stop === -1 ? undefined : stop + 1);
  }
}

export class UpstashStore {
  constructor({ url, token, fetchFn = (...a) => globalThis.fetch(...a) }) {
    this.url = url.replace(/\/+$/, '');
    this.token = token;
    this.fetchFn = fetchFn;
  }

  async _cmd(...args) {
    const res = await this.fetchFn(this.url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${this.token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(args),
    });
    if (!res.ok) throw new Error(`store_http_${res.status}`);
    const data = await res.json();
    if (data.error) throw new Error('store_error');
    return data.result;
  }

  get(key) {
    return this._cmd('GET', key);
  }

  async set(key, val, { ex } = {}) {
    await (ex ? this._cmd('SET', key, String(val), 'EX', ex) : this._cmd('SET', key, String(val)));
  }

  async del(key) {
    await this._cmd('DEL', key);
  }

  getdel(key) {
    return this._cmd('GETDEL', key);
  }

  async incr(key, { ex } = {}) {
    const n = await this._cmd('INCR', key);
    if (n === 1 && ex) await this._cmd('EXPIRE', key, ex);
    return n;
  }

  decr(key) {
    return this._cmd('DECR', key);
  }

  async incrby(key, n, { ex } = {}) {
    const v = await this._cmd('INCRBY', key, n);
    if (v === n && ex) await this._cmd('EXPIRE', key, ex);
    return v;
  }

  /** Claves con el prefijo, recorriendo SCAN por tandas (no bloquea Redis como KEYS). */
  async scan(prefix, { limit = 10_000 } = {}) {
    const out = [];
    let cursor = '0';
    do {
      const [next, keys] = await this._cmd('SCAN', cursor, 'MATCH', `${prefix}*`, 'COUNT', 1000);
      cursor = String(next);
      out.push(...keys);
    } while (cursor !== '0' && out.length < limit);
    return out.slice(0, limit);
  }

  async mget(keys) {
    const out = [];
    for (let i = 0; i < keys.length; i += 200) out.push(...(await this._cmd('MGET', ...keys.slice(i, i + 200))));
    return out;
  }

  async lpush(key, val, { max } = {}) {
    await this._cmd('LPUSH', key, String(val));
    if (max) await this._cmd('LTRIM', key, 0, max - 1);
  }

  async lrange(key, start, stop) {
    return (await this._cmd('LRANGE', key, start, stop)) ?? [];
  }
}

export function createStore(config, fetchFn) {
  if (config.store.url && config.store.token) {
    return { kind: 'upstash', store: new UpstashStore({ url: config.store.url, token: config.store.token, fetchFn }) };
  }
  return { kind: 'memory', store: new MemoryStore() };
}
