// Oráculos del Nivel 5.
import assert from 'node:assert/strict';
import { assertClose } from './common.js';

export const ORACLES_N5 = {
  'mo-poblacion'(ex) {
    const { P0, T, m } = ex.params;
    // simular duplicaciones una a una
    let P = P0;
    for (let t = 0; t < m * T; t += T) P *= 2;
    assert.equal(P, ex.answer.value);
    assert.ok(ex.statement.text.includes(`${m * T} horas`));
  },

  'mo-enfriamiento'(ex) {
    const { Ta, T0, tau, m } = ex.params;
    // ley de enfriamiento con k = ln2 / τ
    const T = Ta + (T0 - Ta) * Math.exp((-Math.LN2 / tau) * (m * tau));
    assertClose(T, ex.answer.value, 'T(t) con exponencial', 1e-9);
    assert.ok(Number.isInteger(ex.answer.value));
  },

  'mo-tanque'(ex) {
    const { V, r, c } = ex.params;
    // simulación de Euler de S' = c r − (r/V) S
    let S = 0;
    const h = V / r / 2000;
    for (let t = 0; t < (20 * V) / r; t += h) S += h * (c * r - (r / V) * S);
    assertClose(S, ex.answer.value, 'equilibrio simulado', 1e-3);
  },

  'mo-rc'(ex) {
    const { variant, R, C } = ex.params;
    const tau = R * C;
    assert.equal(variant === 'tau' ? tau : variant === 'C' ? tau / R : tau / C, ex.answer.value);
  },

  'mo-interes'(ex) {
    const { P, r, n } = ex.params;
    let A = P;
    for (let i = 0; i < n; i++) A = A + (A * r) / 100; // año por año
    assertClose(A, ex.answer.value, 'capitalización año por año', 1e-9);
    assert.ok(Number.isInteger(ex.answer.value));
  },
};
