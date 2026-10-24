// db.js — persistencia del estado. IndexedDB primero; si falla (modo privado, cuota, navegador
// antiguo) cae a localStorage y, en último caso, a memoria. Nunca lanza errores a la app.

import { normalizeState } from './logic.js';

const DB_NAME = 'elamath';
const STORE = 'kv';
const KEY = 'state';
const LS_KEY = 'elamath:state';

const openDb = () =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

async function idbGet() {
  const db = await openDb();
  try {
    return await new Promise((resolve, reject) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(KEY);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  } finally {
    db.close();
  }
}

async function idbSet(value) {
  const db = await openDb();
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(value, KEY);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

/** Crea el almacén de estado. `load()` siempre devuelve un estado válido. */
export function createStore() {
  let memory = null;
  return {
    async load() {
      try {
        const v = await idbGet();
        if (v !== undefined) return normalizeState(v);
      } catch {
        /* se intenta el respaldo */
      }
      try {
        const raw = globalThis.localStorage?.getItem(LS_KEY);
        if (raw) return normalizeState(JSON.parse(raw));
      } catch {
        /* se usa memoria */
      }
      return normalizeState(memory);
    },
    async save(state) {
      memory = state;
      try {
        await idbSet(state);
        return;
      } catch {
        /* respaldo */
      }
      try {
        globalThis.localStorage?.setItem(LS_KEY, JSON.stringify(state));
      } catch {
        /* solo memoria */
      }
    },
  };
}
