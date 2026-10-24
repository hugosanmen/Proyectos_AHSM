// app.test.js — pruebas de integración de la interfaz (jsdom + KaTeX real + motor real).
// No hay navegador: se simula el DOM, pero el código de la app corre tal cual.

import { describe, it, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import katex from 'katex';
import 'fake-indexeddb/auto';
import { createRng } from '../js/engine/utils.js';
import * as L from '../js/logic.js';

const html = readFileSync(fileURLToPath(new URL('../index.html', import.meta.url)), 'utf8');
const NOW = new Date(2026, 9, 20, 10, 0, 0); // martes 20-oct-2026
const TODAY = '2026-10-20';

const define = (k, v) => Object.defineProperty(globalThis, k, { value: v, configurable: true, writable: true });
const tick = () => new Promise((r) => setTimeout(r, 0));

/** Almacén en memoria con el mismo contrato que db.js. */
function memStore(initial = null) {
  let saved = initial;
  return {
    saves: 0,
    async load() {
      return L.normalizeState(saved);
    },
    async save(s) {
      saved = structuredClone(s);
      this.saves++;
    },
    get saved() {
      return saved;
    },
  };
}

let current = null;
afterEach(() => {
  current?.api?.destroy();
  current?.w?.close();
  current = null;
});

/** Monta la app sobre una copia limpia de index.html. */
async function mount({ store = memStore(), seed = 7, confirm = true } = {}) {
  const dom = new JSDOM(html, { url: 'https://elamath.test/', pretendToBeVisual: true });
  const w = dom.window;
  w.scrollTo = () => {};
  w.HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  w.HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  define('window', w);
  define('document', w.document);
  define('katex', katex);
  define('confirm', () => confirm);

  const { startApp } = await import('../js/app.js');
  const doc = w.document;
  const root = doc.getElementById('app');
  const rng = createRng(seed);
  const api = await startApp(root, { store, now: () => NOW, random: () => rng.next() });
  await tick();
  const q = (sel, scope = doc) => scope.querySelector(sel);
  const qa = (sel, scope = doc) => [...scope.querySelectorAll(sel)];
  const byText = (sel, text) => qa(sel).find((el) => el.textContent.includes(text));
  const click = async (el) => {
    assert.ok(el, 'elemento a pulsar no encontrado');
    el.click();
    await tick();
  };
  const key = async (k) => {
    doc.dispatchEvent(new w.KeyboardEvent('keydown', { key: k, bubbles: true }));
    await tick();
  };
  current = { api, w };
  return { api, w, doc, root, store, q, qa, byText, click, key };
}

/** Inicia la práctica mixta de Cálculo Diferencial y devuelve el ejercicio actual. */
/** Inicia la práctica mixta de una materia (por defecto Cálculo Diferencial). */
async function startMixed(ctx, materia = 'Cálculo Diferencial') {
  const card = ctx.qa('article.subject').find((a) => a.querySelector('h3')?.textContent === materia);
  assert.ok(card, `no hay tarjeta de ${materia}`);
  await ctx.click(card.querySelector('.btn-primary'));
  return ctx.api._practice();
}
const correctIdx = (p) => p.ex.options.findIndex((o) => o.correct);
const wrongIdx = (p) => p.ex.options.findIndex((o) => !o.correct);

describe('inicio', () => {
  it('muestra nivel, las 16 materias de los 5 niveles y contador de consultas', async () => {
    const c = await mount();
    assert.match(c.q('h1').textContent, /Nivel 1 · Aspirante/);
    assert.equal(c.qa('details.level').length, 5, 'cinco niveles');
    assert.equal(c.qa('details.level[open]').length, 5, 'todos los niveles visibles');
    assert.equal(c.qa('article.subject').length, 16);
    assert.equal(c.qa('.subject.disabled').length, 0, 'ninguna materia queda como «próximamente»');
    assert.match(c.q('#hud').textContent, /10\/10 consultas hoy/);
    assert.match(c.q('#hud').textContent, /Nv\. 1/);
    for (const topic of ['Límites', 'Derivadas', 'Aplicaciones de la derivada', 'Ecuaciones y sistemas', 'Matrices', 'Transformada de Laplace', 'Sistemas dinámicos']) {
      assert.ok(c.q(`button[aria-label="Practicar ${topic}"]`), topic);
    }
    assert.ok(!/Próximamente/.test(c.root.textContent));
    assert.match(c.root.textContent, /Exámenes de Preparación/);
    assert.match(c.root.textContent, /Retos de Grado/);
  });

  it('el progreso guardado se refleja al abrir de nuevo (persistencia)', async () => {
    const store = memStore({ ...L.defaultState(), xp: 55, topics: { Límites: { recent: Array(10).fill(true) } } });
    const c = await mount({ store });
    assert.match(c.q('h1').textContent, /Nivel 2 · Principiante/);
    assert.match(c.root.textContent, /Dominio 100% · ¡Dominado!/);
    assert.match(c.q('.hero').textContent, /15 \/ 60 XP/);
  });
});

describe('práctica', () => {
  it('muestra enunciado con KaTeX renderizado y 4 opciones', async () => {
    const c = await mount();
    const p = await startMixed(c);
    assert.equal(c.qa('button.option').length, 4);
    assert.ok(c.qa('button.option').every((b) => b.querySelector('.katex')), 'cada opción renderiza LaTeX');
    assert.ok(c.q('.question h2').textContent.length > 10);
    assert.equal(c.q('.katex-error'), null);
    assert.ok(p.ex.templateId);
    assert.match(c.q('.dots').getAttribute('aria-label'), /Dificultad \d de 5/);
  });

  it('respuesta correcta: marca, da XP, guarda y deshabilita las opciones', async () => {
    const c = await mount();
    const p = await startMixed(c);
    const esperado = L.xpForAnswer({ correct: true, difficulty: p.ex.difficulty });
    await c.click(c.qa('button.option')[correctIdx(p)]);
    assert.ok(c.q('.feedback.ok'));
    assert.match(c.q('.feedback').textContent, new RegExp(`\\+${esperado} XP`));
    assert.equal(c.qa('button.option:disabled').length, 4);
    assert.equal(c.qa('.option.is-correct').length, 1);
    assert.equal(c.api.getState().xp, esperado);
    assert.ok(c.store.saves >= 1);
    assert.equal(c.store.saved.xp, esperado);
    assert.deepEqual(c.store.saved.stats, { answered: 1, correct: 1 });
    assert.equal(c.doc.activeElement.id, 'feedback', 'el foco pasa al resultado para lectores de pantalla');
  });

  it('respuesta incorrecta: explica el error, marca la correcta y no da XP', async () => {
    const c = await mount();
    const p = await startMixed(c);
    const w = wrongIdx(p);
    await c.click(c.qa('button.option')[w]);
    assert.ok(c.q('.feedback.bad'));
    assert.ok(c.q('.feedback').textContent.includes(p.ex.options[w].feedback));
    assert.equal(c.qa('.option.is-wrong').length, 1);
    assert.equal(c.qa('.option.is-correct').length, 1);
    assert.match(c.q('.is-wrong .mark').textContent, /✗/, 'no depende solo del color');
    assert.match(c.q('.is-correct .mark').textContent, /✓/);
    assert.equal(c.api.getState().xp, 0);
    assert.deepEqual(c.api.getState().stats, { answered: 1, correct: 0 });
  });

  it('no permite responder dos veces el mismo ejercicio', async () => {
    const c = await mount();
    const p = await startMixed(c);
    await c.click(c.qa('button.option')[correctIdx(p)]);
    const xp = c.api.getState().xp;
    await c.key('1');
    await c.key('2');
    assert.equal(c.api.getState().xp, xp);
    assert.equal(c.api.getState().stats.answered, 1);
  });

  it('«Siguiente» cambia de ejercicio y reinicia el estado', async () => {
    const c = await mount();
    const p1 = await startMixed(c);
    const id1 = p1.ex.templateId;
    await c.click(c.q('#next-btn'));
    const p2 = c.api._practice();
    assert.equal(p2.answered, false);
    assert.equal(c.qa('button.option:disabled').length, 0);
    assert.notEqual(p2.ex.templateId, id1, 'no repite la misma plantilla dos veces seguidas');
  });

  it('práctica por tema solo usa ejercicios de ese tema', async () => {
    const c = await mount();
    await c.click(c.q('button[aria-label="Practicar Límites"]'));
    for (let i = 0; i < 12; i++) {
      assert.equal(c.api._practice().ex.topic, 'Límites');
      await c.click(c.q('#next-btn'));
    }
  });

  it('atajos de teclado: 1-4 responden y N pasa al siguiente', async () => {
    const c = await mount();
    const p = await startMixed(c);
    await c.key('3');
    assert.equal(c.api._practice().picked, 2);
    assert.equal(c.api._practice().answered, true);
    const antes = p.ex.seed;
    await c.key('n');
    assert.notEqual(c.api._practice().ex.seed, antes);
    await c.key('b');
    assert.equal(c.api._practice().picked, 1, 'las letras A-D también funcionan');
  });

  it('volver a Materias regresa al inicio', async () => {
    const c = await mount();
    await startMixed(c);
    await c.click(c.byText('button', '← Materias'));
    assert.match(c.q('h1').textContent, /Nivel 1/);
  });
});

describe('paso a paso y créditos', () => {
  it('gasta 1 consulta, muestra los pasos con KaTeX y no se cobra dos veces', async () => {
    const c = await mount();
    const p = await startMixed(c);
    await c.click(c.q('#explain-btn'));
    assert.equal(c.qa('.steps li').length, p.ex.steps.length);
    assert.ok(c.qa('.steps li').every((li) => li.querySelector('.katex')));
    assert.equal(c.q('.katex-error'), null);
    assert.match(c.q('#hud').textContent, /9\/10 consultas hoy/);
    assert.equal(c.q('#explain-btn'), null, 'el botón desaparece: no se vuelve a cobrar');
    assert.equal(c.api.getState().credits.used, 1);
    assert.equal(c.store.saved.credits.used, 1);
  });

  it('pedir ayuda antes de responder reduce el XP a la mitad y lo avisa', async () => {
    const c = await mount();
    const p = await startMixed(c);
    await c.click(c.q('#explain-btn'));
    await c.click(c.qa('button.option')[correctIdx(p)]);
    const mitad = L.xpForAnswer({ correct: true, difficulty: p.ex.difficulty, helped: true });
    assert.equal(c.api.getState().xp, mitad);
    assert.match(c.q('.feedback').textContent, /con ayuda vale la mitad/);
  });

  it('consultar el paso a paso DESPUÉS de responder no resta XP', async () => {
    const c = await mount();
    const p = await startMixed(c);
    await c.click(c.qa('button.option')[correctIdx(p)]);
    const xp = c.api.getState().xp;
    await c.click(c.q('#explain-btn'));
    assert.equal(c.api.getState().xp, xp);
    assert.equal(c.qa('.steps li').length, p.ex.steps.length);
  });

  it('sin consultas: abre el modal Pro, no muestra pasos y no gasta nada', async () => {
    const store = memStore({ ...L.defaultState(), credits: { date: TODAY, used: 10 } });
    const c = await mount({ store });
    await startMixed(c);
    assert.match(c.q('#hud').textContent, /0\/10 consultas hoy/);
    await c.click(c.q('#explain-btn'));
    assert.ok(c.q('#pro-dialog').hasAttribute('open'));
    assert.match(c.q('#pro-dialog').textContent, /límite de consultas de hoy/);
    assert.equal(c.qa('.steps li').length, 0);
    assert.equal(c.api.getState().credits.used, 10);
  });

  it('las consultas se renuevan al día siguiente', async () => {
    const store = memStore({ ...L.defaultState(), credits: { date: '2026-10-19', used: 10 } });
    const c = await mount({ store });
    assert.match(c.q('#hud').textContent, /10\/10 consultas hoy/);
  });

  it('activar Pro de prueba sube el tope y permite seguir; se puede revertir', async () => {
    const store = memStore({ ...L.defaultState(), credits: { date: TODAY, used: 10 } });
    const c = await mount({ store });
    await startMixed(c);
    await c.click(c.q('#explain-btn'));
    await c.click(c.q('#toggle-plan'));
    assert.equal(c.q('#pro-dialog').hasAttribute('open'), false);
    assert.equal(c.store.saved.plan, 'pro');
    assert.match(c.q('#hud').textContent, /Pro · 140 consultas hoy/);
    await c.click(c.q('#explain-btn'));
    assert.equal(c.qa('.steps li').length > 0, true, 'ahora sí puede ver el paso a paso');
    await c.click(c.q('#credits-chip'));
    await c.click(c.q('#toggle-plan'));
    assert.equal(c.store.saved.plan, 'free');
  });

  it('el modal Pro muestra precios y aclara que es una demostración', async () => {
    const c = await mount();
    await c.click(c.q('#credits-chip'));
    const t = c.q('#pro-dialog').textContent;
    assert.match(t, /\$50 MXN \/ mes/);
    assert.doesNotMatch(t, /semestre/);
    assert.match(t, /demostración/);
    assert.match(t, /próximamente/);
  });
});

describe('niveles', () => {
  it('subir de nivel muestra el diálogo de celebración', async () => {
    const store = memStore({ ...L.defaultState(), xp: 38 });
    const c = await mount({ store });
    const p = await startMixed(c);
    await c.click(c.qa('button.option')[correctIdx(p)]);
    assert.ok(c.q('#levelup-dialog').hasAttribute('open'));
    assert.match(c.q('#levelup-dialog').textContent, /Nivel 2 · Principiante/);
    await c.click(c.q('#close-levelup'));
    assert.equal(c.q('#levelup-dialog').hasAttribute('open'), false);
  });

  it('no hay celebración si no cambia de nivel', async () => {
    const c = await mount();
    const p = await startMixed(c);
    await c.click(c.qa('button.option')[wrongIdx(p)]);
    assert.equal(c.q('#levelup-dialog').hasAttribute('open'), false);
  });

  it('la racha sube con el uso y se muestra en el HUD', async () => {
    const store = memStore({ ...L.defaultState(), streak: { count: 3, last: '2026-10-19' } });
    const c = await mount({ store });
    assert.match(c.q('#hud').textContent, /🔥 3/);
    const p = await startMixed(c);
    await c.click(c.qa('button.option')[correctIdx(p)]);
    assert.match(c.q('#hud').textContent, /🔥 4/);
  });
});

describe('reinicio de progreso', () => {
  it('con confirmación borra todo', async () => {
    const store = memStore({ ...L.defaultState(), xp: 200, stats: { answered: 9, correct: 7 } });
    const c = await mount({ store, confirm: true });
    await c.click(c.byText('button', 'Reiniciar progreso'));
    assert.equal(c.api.getState().xp, 0);
    assert.equal(c.store.saved.xp, 0);
  });

  it('si el estudiante cancela, no se borra nada', async () => {
    const store = memStore({ ...L.defaultState(), xp: 200 });
    const c = await mount({ store, confirm: false });
    await c.click(c.byText('button', 'Reiniciar progreso'));
    assert.equal(c.api.getState().xp, 200);
  });
});

describe('robustez de renderizado', () => {
  it('60 ejercicios consecutivos con paso a paso: sin errores de KaTeX ni valores inválidos', async () => {
    const store = memStore({ ...L.defaultState(), plan: 'pro' });
    const c = await mount({ store, seed: 2026 });
    await startMixed(c);
    const vistos = new Set();
    for (let i = 0; i < 60; i++) {
      const p = c.api._practice();
      vistos.add(p.ex.templateId);
      await c.click(c.q('#explain-btn'));
      await c.click(c.qa('button.option')[i % 4]);
      assert.equal(c.q('.katex-error'), null, `error de KaTeX en ${p.ex.templateId} seed=${p.ex.seed}`);
      assert.ok(!/NaN|undefined|null|Infinity/.test(c.root.textContent), `texto inválido en ${p.ex.templateId} seed=${p.ex.seed}`);
      assert.equal(c.qa('.steps li').length, p.ex.steps.length);
      assert.equal(c.qa('button.option').length, 4);
      await c.click(c.q('#next-btn'));
    }
    assert.equal(vistos.size, 10, 'se vieron las 10 plantillas');
  });
});

describe('todas las materias son practicables', () => {
  it('cada materia: ejercicios y paso a paso sin errores de KaTeX ni valores inválidos', async () => {
    const { CURRICULUM } = await import('../js/curriculum.js');
    const store = memStore({ ...L.defaultState(), plan: 'pro' });
    const c = await mount({ store, seed: 77 });
    const materias = CURRICULUM.flatMap((l) => l.subjects.map((x) => x.name));
    const vistos = new Set();
    for (const materia of materias) {
      await startMixed(c, materia);
      for (let i = 0; i < 25; i++) {
        const p = c.api._practice();
        vistos.add(p.ex.templateId);
        if (c.q('#explain-btn')) await c.click(c.q('#explain-btn'));
        await c.click(c.qa('button.option')[i % 4]);
        assert.equal(c.q('.katex-error'), null, `${materia}: error de KaTeX en ${p.ex.templateId} seed=${p.ex.seed}`);
        assert.ok(!/NaN|undefined|null|Infinity/.test(c.root.textContent), `${materia} [${c.root.textContent.match(/.{0,25}(NaN|undefined|null|Infinity).{0,25}/)?.[0]}]: texto inválido en ${p.ex.templateId} seed=${p.ex.seed}`);
        assert.equal(c.qa('button.option').length, 4);
        assert.ok(!/null|false|undefined/.test(c.q('#hud').textContent), `HUD con texto inválido: ${c.q('#hud').textContent}`);
        await c.click(c.q('#next-btn'));
      }
      await c.click(c.byText('button', '← Materias'));
    }
    const { templates } = await import('../js/engine/index.js');
    const faltan = templates.filter((t) => !vistos.has(t.id)).map((t) => t.id);
    assert.ok(faltan.length <= 6, `plantillas que nunca salieron: ${faltan.join(', ')}`);
  });

  it('Retos de Grado solo sortea ejercicios de dificultad 3 o más; Preparación mezcla temas', async () => {
    const c = await mount({ seed: 5 });
    await startMixed(c, 'Retos de Grado');
    for (let i = 0; i < 25; i++) {
      assert.ok(c.api._practice().ex.difficulty >= 3, `dificultad ${c.api._practice().ex.difficulty}`);
      await c.click(c.q('#next-btn'));
    }
    await c.click(c.byText('button', '← Materias'));
    await startMixed(c, 'Exámenes de Preparación');
    const temas = new Set();
    for (let i = 0; i < 40; i++) {
      temas.add(c.api._practice().ex.topic);
      await c.click(c.q('#next-btn'));
    }
    assert.ok(temas.size >= 4, `solo ${temas.size} temas distintos`);
  });
});

describe('almacenamiento (db.js)', () => {
  it('guarda y recupera con IndexedDB', async () => {
    const { createStore } = await import('../js/db.js');
    const s = createStore();
    const estado = { ...L.defaultState(), xp: 123, topics: { Límites: { recent: [true, false] } } };
    await s.save(estado);
    const otra = createStore(); // instancia nueva: debe leer de IndexedDB, no de memoria
    assert.deepEqual(await otra.load(), estado);
  });

  it('si IndexedDB no está disponible, cae a localStorage', async () => {
    const { createStore } = await import('../js/db.js');
    const idb = globalThis.indexedDB;
    const mem = new Map();
    define('localStorage', { getItem: (k) => mem.get(k) ?? null, setItem: (k, v) => mem.set(k, v) });
    define('indexedDB', undefined);
    try {
      const estado = { ...L.defaultState(), xp: 77 };
      await createStore().save(estado);
      assert.ok(mem.get('elamath:state'));
      assert.equal((await createStore().load()).xp, 77);
    } finally {
      define('indexedDB', idb);
      define('localStorage', undefined);
    }
  });

  it('si no hay nada disponible, no lanza y devuelve estado por defecto', async () => {
    const { createStore } = await import('../js/db.js');
    const idb = globalThis.indexedDB;
    define('indexedDB', undefined);
    define('localStorage', { getItem() { throw new Error('bloqueado'); }, setItem() { throw new Error('cuota'); } });
    try {
      const s = createStore();
      assert.deepEqual(await s.load(), L.defaultState());
      await s.save({ ...L.defaultState(), xp: 9 });
      assert.equal((await s.load()).xp, 9, 'al menos en memoria durante la sesión');
    } finally {
      define('indexedDB', idb);
      define('localStorage', undefined);
    }
  });

  it('datos corruptos o de otra versión no rompen el arranque', async () => {
    assert.deepEqual(L.normalizeState({ version: 0, xp: 'mucho' }), L.defaultState());
  });
});
