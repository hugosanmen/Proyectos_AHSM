// Primeros correos registrados = fundadores: Pro permanente, también con el cobro encendido.

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { routes } from '../server/routes.js';
import { ADMIN, loginAs, makeDeps } from './server.helpers.js';

const DAY = 86_400_000;
const admin = { authorization: `Bearer ${ADMIN}` };
const me = async (deps, headers) => (await routes.me({ headers }, deps)).body;

describe('fundadores (primeros correos con acceso completo)', () => {
  it('los primeros N correos son Pro permanente; el siguiente entra a la prueba normal', async () => {
    const { deps, sent, clock } = makeDeps({ env: { FOUNDERS_LIMIT: '2', TRIAL_DAYS: '7' } });
    const a = await loginAs(routes, deps, sent, 'a@correo.com');
    const b = await loginAs(routes, deps, sent, 'b@correo.com');
    const c = await loginAs(routes, deps, sent, 'c@correo.com');
    clock.advance(20 * DAY); // ya pasó la prueba gratis (y la sesión sigue viva)
    for (const h of [a, b]) {
      const r = await me(deps, h.headers);
      assert.equal(r.plan, 'pro');
      assert.equal(r.founder, true);
      assert.equal(r.proUntil, null);
      assert.equal(r.tutor.limit, 40);
    }
    const rc = await me(deps, c.headers);
    assert.equal(rc.plan, 'free');
    assert.equal(rc.founder, false);
  });

  it('volver a entrar no ocupa otro lugar', async () => {
    const { deps, sent, store } = makeDeps({ env: { FOUNDERS_LIMIT: '2' } });
    await loginAs(routes, deps, sent, 'a@correo.com');
    await loginAs(routes, deps, sent, 'a@correo.com');
    const b = await loginAs(routes, deps, sent, 'b@correo.com');
    assert.equal((await me(deps, b.headers)).founder, true);
    assert.equal(await store.get('founders:n'), '2');
  });

  it('las cuentas que ya existían toman los lugares por fecha de registro, aunque no vuelvan a entrar por enlace', async () => {
    const { deps, sent, store, clock } = makeDeps({ env: { FOUNDERS_LIMIT: '0' } });
    const old1 = await loginAs(routes, deps, sent, 'vieja1@correo.com');
    clock.advance(DAY);
    const old2 = await loginAs(routes, deps, sent, 'vieja2@correo.com');
    clock.advance(DAY);
    const old3 = await loginAs(routes, deps, sent, 'vieja3@correo.com');
    await store.del('founders:n'); // como antes de existir la función
    await store.del('founders:init');
    deps.config.foundersLimit = 2;
    assert.equal((await me(deps, old2.headers)).founder, true, 'el backfill corre en /me');
    assert.equal((await me(deps, old1.headers)).founder, true);
    assert.equal((await me(deps, old3.headers)).founder, false);
    const nueva = await loginAs(routes, deps, sent, 'nueva@correo.com');
    assert.equal((await me(deps, nueva.headers)).founder, false, 'ya no quedan lugares');
    assert.equal(await store.get('founders:n'), '2');
  });

  it('con el cobro apagado el fundador sigue viéndose como Pro', async () => {
    const { deps, sent } = makeDeps({ env: { FOUNDERS_LIMIT: '1', BILLING_ENABLED: '' } });
    const a = await loginAs(routes, deps, sent, 'a@correo.com');
    const b = await loginAs(routes, deps, sent, 'b@correo.com');
    assert.equal((await me(deps, a.headers)).plan, 'pro');
    assert.equal((await me(deps, b.headers)).plan, 'open');
  });

  it('el admin puede quitar el acceso de fundador', async () => {
    const { deps, sent } = makeDeps({ env: { FOUNDERS_LIMIT: '1' } });
    const a = await loginAs(routes, deps, sent, 'a@correo.com');
    const out = await routes.adminPlan({ method: 'POST', headers: admin, body: { email: 'a@correo.com', plan: 'free' } }, deps);
    assert.equal(out.status, 200);
    const r = await me(deps, a.headers);
    assert.equal(r.plan, 'free');
    assert.equal(r.founder, false);
  });
});
