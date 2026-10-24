// credits.js — CreditsService
//
// ⚠️  ESTA IMPLEMENTACIÓN ES SOLO DE DEMOSTRACIÓN Y NO ES SEGURA.
// Los créditos y el plan viven en el navegador del estudiante: cualquiera puede borrarlos o
// activarse "Pro" desde la consola. Sirve para validar la experiencia de uso (FASE 1).
//
// En la FASE 2 se reemplaza por una implementación que llame al backend, con la misma interfaz:
//
//   interface CreditsService {
//     status():  Promise<{ used, limit, remaining, plan }>
//     consume(): Promise<{ ok: boolean, status }>      // el SERVIDOR decide si hay saldo
//     setPlan(plan): Promise<void>                     // en producción lo fija el pago, no el cliente
//   }
//
// La UI solo depende de esta interfaz, así que el cambio no toca la interfaz de usuario.

import { creditsStatus, consumeCredit } from './logic.js';

export class LocalCreditsService {
  /**
   * @param {{ get: () => object, set: (s: object) => void, today: () => string, persist: () => void }} io
   */
  constructor(io) {
    this.io = io;
  }

  async status() {
    const s = this.io.get();
    return creditsStatus(s.credits, this.io.today(), s.plan);
  }

  async consume() {
    const s = this.io.get();
    const today = this.io.today();
    const r = consumeCredit(s.credits, today, s.plan);
    if (r.ok) {
      this.io.set({ ...s, credits: r.credits });
      this.io.persist();
    }
    return { ok: r.ok, status: creditsStatus(r.credits, today, s.plan) };
  }

  async setPlan(plan) {
    const s = this.io.get();
    this.io.set({ ...s, plan: plan === 'pro' ? 'pro' : 'free' });
    this.io.persist();
  }
}
