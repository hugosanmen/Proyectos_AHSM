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
import { makeSeek, openSubject } from './nav.helpers.js';

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
async function mount({ store = memStore(), seed = 7, confirm = true, url = 'https://elamath.test/' } = {}) {
  const dom = new JSDOM(html, { url, pretendToBeVisual: true });
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
  const seek = makeSeek(doc, (v) => api.go(v));
  const q = (sel, scope) => (scope ? scope.querySelector(sel) : seek(sel));
  const qa = (sel, scope) => {
    if (!scope) seek(sel);
    return [...(scope ?? doc).querySelectorAll(sel)];
  };
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
  assert.ok(openSubject(ctx.doc, (v) => ctx.api.go(v), materia), `no hay tarjeta de ${materia}`);
  await ctx.click(ctx.doc.querySelector('#mixed-btn'));
  return ctx.api._practice();
}
const correctIdx = (p) => p.ex.options.findIndex((o) => o.correct);
const wrongIdx = (p) => p.ex.options.findIndex((o) => !o.correct);

describe('inicio', () => {
  it('muestra nivel, las 16 materias de los 5 niveles y acceso a planes', async () => {
    const c = await mount();
    assert.match(c.q('h1').textContent, /Bienvenido a ElaMath/);
    assert.equal(c.qa('details.level').length, 5, 'cinco niveles');
    assert.equal(c.qa('details.level[open]').length, 1, 'solo el nivel del alumno abierto');
    assert.equal(c.qa('article.subject').length, 16);
    assert.equal(c.qa('.subject.disabled').length, 0, 'ninguna materia queda como «próximamente»');
    assert.match(c.q('#plans-chip').textContent, /Ver planes/);
    assert.doesNotMatch(c.q('#hud').textContent, /consultas/);
    assert.match(c.q('#hud').textContent, /Nivel 1/);
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
    assert.match(c.q('.hero').textContent, /15 \/ 60 XP/);
    assert.ok(openSubject(c.doc, (v) => c.api.go(v), 'Cálculo Diferencial'));
    assert.match(c.root.textContent, /Dominio 100% · ¡Dominado!/);
  });
});

describe('práctica', () => {
  it('muestra enunciado con KaTeX renderizado y 4 opciones', async () => {
    const c = await mount();
    const p = await startMixed(c);
    assert.equal(c.qa('button.option').length, 4);
    assert.ok(c.qa('button.option').every((b) => b.querySelector('.katex')), 'cada opción renderiza LaTeX');
    assert.ok(c.q('.question h1').textContent.length > 10);
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

  it('volver desde la práctica regresa a la pantalla de la materia', async () => {
    const c = await mount();
    await startMixed(c);
    await c.click(c.q('#practice-back'));
    assert.match(c.q('h1').textContent, /Cálculo Diferencial/);
    assert.equal(c.w.location.hash, '#/materias/calculo-diferencial');
    assert.ok(c.doc.querySelector('button[aria-label="Practicar Límites"]'));
  });
});

describe('paso a paso', () => {
  it('muestra los pasos con KaTeX, sin límite ni aviso de consumo', async () => {
    const c = await mount();
    const p = await startMixed(c);
    await c.click(c.q('#explain-btn'));
    assert.equal(c.qa('.steps li').length, p.ex.steps.length);
    assert.ok(c.qa('.steps li').every((li) => li.querySelector('.katex')));
    assert.equal(c.q('.katex-error'), null);
    assert.equal(c.q('#explain-btn'), null, 'ya está visible: el botón desaparece');
    assert.equal(c.q('#pro-dialog').hasAttribute('open'), false);
  });

  it('se puede usar en más de 150 ejercicios seguidos', async () => {
    const c = await mount();
    await startMixed(c);
    for (let i = 0; i < 160; i++) {
      await c.click(c.q('#explain-btn'));
      assert.ok(c.qa('.steps li').length > 0);
      await c.click(c.q('#next-btn'));
    }
    assert.equal(c.q('#pro-dialog').hasAttribute('open'), false);
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

  it('activar Pro de prueba funciona y se puede revertir', async () => {
    const c = await mount();
    await c.click(c.q('#plans-chip'));
    await c.click(c.q('#toggle-plan'));
    assert.equal(c.q('#pro-dialog').hasAttribute('open'), false);
    assert.equal(c.store.saved.plan, 'pro');
    await c.click(c.q('#plans-chip'));
    await c.click(c.q('#toggle-plan'));
    assert.equal(c.store.saved.plan, 'free');
  });

  it('el modal Pro muestra precios y aclara que es una demostración', async () => {
    const c = await mount();
    await c.click(c.q('#plans-chip'));
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
    await c.click(c.q('#reset-btn'));
    assert.equal(c.api.getState().xp, 0);
    assert.equal(c.store.saved.xp, 0);
  });

  it('si el estudiante cancela, no se borra nada', async () => {
    const store = memStore({ ...L.defaultState(), xp: 200 });
    const c = await mount({ store, confirm: false });
    await c.click(c.q('#reset-btn'));
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
    assert.equal(vistos.size, 12, 'se vieron las 12 plantillas de la materia');
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
      for (let i = 0; i < 70; i++) {
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
      await c.click(c.q('#practice-back'));
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
    await c.click(c.q('#practice-back'));
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

describe('rutas', () => {
  const back = async (c) => {
    c.w.history.back();
    await new Promise((r) => c.w.addEventListener('popstate', () => setTimeout(r, 5), { once: true }));
  };

  it('cada vista tiene URL y Atrás/Adelante funcionan dentro de la app', async () => {
    const c = await mount();
    await startMixed(c);
    assert.equal(c.w.location.hash, '#/practica/calculo-diferencial');
    assert.match(c.doc.title, /Cálculo Diferencial/);
    await back(c);
    assert.ok(c.doc.querySelector('#mixed-btn'), 'volvió a la materia');
    assert.equal(c.w.location.hash, '#/materias/calculo-diferencial');
    c.w.history.forward();
    await new Promise((r) => c.w.addEventListener('popstate', () => setTimeout(r, 5), { once: true }));
    assert.ok(c.q('#q-title'), 'regresó al ejercicio');
  });

  it('un enlace directo abre el tema; uno inválido cae al inicio', async () => {
    const c = await mount({ url: 'https://elamath.test/#/practica/calculo-diferencial/limites' });
    assert.equal(c.api._practice().ex.topic, 'Límites');
    const mal = await mount({ url: 'https://elamath.test/#/practica/no-existe' });
    assert.ok(mal.q('#home-search'));
    assert.equal(mal.w.location.hash, '');
    const examen = await mount({ url: 'https://elamath.test/#/examen' });
    assert.ok(examen.q('#home-search'));
  });

  it('Atrás durante un examen pide confirmar: cancelar lo mantiene, aceptar lo descarta', async () => {
    const c = await mount({ confirm: false });
    await c.click(c.q('[data-exam]'));
    assert.equal(c.w.location.hash, '#/examen');
    await back(c);
    assert.ok(c.q('#exam-clock'), 'sigue en el examen');
    assert.equal(c.w.location.hash, '#/examen');
    assert.ok(c.api.getState().activeExam);
    globalThis.confirm = () => true;
    await back(c);
    assert.equal(c.q('#exam-clock'), null);
    assert.equal(c.api.getState().activeExam, null);
  });
});

describe('bienvenida e inicio corto', () => {
  it('elegir semestre lleva al primer ejercicio y luego abre ese nivel', async () => {
    const c = await mount();
    await c.click(c.q('#welcome-level-3'));
    assert.ok(c.q('#q-title'));
    assert.equal(c.w.location.hash, '#/practica/metodos-numericos');
    const st = c.api.getState();
    assert.deepEqual([st.welcomed, st.homeLevel], [true, 3]);
    await c.click(c.q('#practice-back'));
    assert.equal(c.q('#welcome-skip'), null, 'la bienvenida no se repite');
    assert.deepEqual(c.qa('details.level[open]').map((d) => d.dataset.level), ['3']);
    assert.match(c.q('#continue-btn').textContent, /Continuar: Métodos Numéricos/);
    await c.click(c.q('#continue-btn'));
    assert.equal(c.api._practice().label, 'Métodos Numéricos');
  });

  it('se puede saltar y cambiar de semestre; quien ya tiene progreso no la ve', async () => {
    const c = await mount();
    await c.click(c.q('#welcome-skip'));
    assert.match(c.q('h1').textContent, /Materias/);
    assert.equal(c.w.location.hash, '#/materias');
    const sel = c.q('#home-level');
    sel.value = '4';
    sel.dispatchEvent(new c.w.Event('change', { bubbles: true }));
    assert.deepEqual(c.qa('details.level[open]').map((d) => d.dataset.level), ['4']);
    const viejo = await mount({ store: memStore({ ...L.defaultState(), xp: 50, stats: { answered: 5, correct: 3 } }) });
    assert.equal(viejo.q('#welcome-skip'), null);
  });

  it('el buscador ignora acentos, abre coincidencias y avisa si no hay', async () => {
    const c = await mount();
    const search = c.q('#home-search');
    const type = (v) => {
      search.value = v;
      search.dispatchEvent(new c.w.Event('input', { bubbles: true }));
    };
    type('calculo vec');
    assert.deepEqual(c.qa('article.subject:not([hidden]) h3').map((e) => e.textContent), ['Cálculo Vectorial']);
    assert.deepEqual(c.qa('details.level[open]').map((d) => d.dataset.level), ['2']);
    type('laplace');
    assert.ok(c.qa('.topic:not([hidden])').every((li) => /Laplace/.test(li.textContent)));
    type('zzz');
    assert.equal(c.q('#search-empty').hidden, false);
    type('');
    assert.equal(c.qa('article.subject[hidden]').length, 0);
    assert.deepEqual(c.qa('details.level[open]').map((d) => d.dataset.level), ['1']);
  });
});

describe('repaso inteligente', () => {
  const debil = (recent) => ({ recent });
  it('sugiere los temas débiles y lleva a practicarlos', async () => {
    const store = memStore({ ...L.defaultState(), xp: 20, stats: { answered: 9, correct: 2 }, topics: { Límites: debil([false, false, true]), Derivadas: debil([true, true, true]), Series: debil([false]) } });
    const c = await mount({ store });
    assert.match(c.q('#review-card').textContent, /Límites/);
    assert.match(c.q('#review-card').textContent, /33% de aciertos en tus últimos 3 intentos/);
    assert.doesNotMatch(c.q('#review-card').textContent, /Derivadas|Series/);
    await c.click(c.q('button[aria-label="Repasar Límites"]'));
    assert.equal(c.api._practice().label, 'Límites');
  });
  it('sin temas débiles no aparece', async () => {
    const c = await mount({ store: memStore({ ...L.defaultState(), xp: 20, stats: { answered: 3, correct: 3 }, topics: { Límites: debil([true, true, true]) } }) });
    assert.equal(c.q('#review-card'), null);
  });
});

describe('idea clave', () => {
  it('aparece solo después de responder, acierte o no', async () => {
    const c = await mount();
    const p = await startMixed(c);
    assert.equal(c.q('.idea'), null);
    await c.click(c.qa('button.option')[correctIdx(p)]);
    assert.match(c.q('#feedback .idea').textContent, /Idea clave: /);
    await c.click(c.q('#next-btn'));
    const q = c.api._practice();
    await c.click(c.qa('button.option')[wrongIdx(q)]);
    assert.ok(c.q('#feedback .idea').textContent.includes(q.ex.idea));
  });
});

describe('inicio sin textos inválidos', () => {
  it('ni la bienvenida ni el inicio con progreso muestran null o undefined', async () => {
    const nuevo = await mount();
    assert.doesNotMatch(nuevo.root.textContent, /null|undefined/);
    const conProgreso = await mount({ store: memStore({ ...L.defaultState(), welcomed: true, xp: 20, stats: { answered: 3, correct: 3 } }) });
    assert.equal(conProgreso.q('#review-card'), null);
    assert.doesNotMatch(conProgreso.root.textContent, /null|undefined/);
  });
});

describe('secciones y barra inferior', () => {
  const welcomed = () => memStore({ ...L.defaultState(), welcomed: true, xp: 20, stats: { answered: 3, correct: 2 } });

  it('la barra lleva a las cuatro secciones, marca la actual y cada una tiene URL', async () => {
    const c = await mount({ store: welcomed() });
    const tabs = c.qa('#tabbar .tab');
    assert.deepEqual(tabs.map((t) => t.textContent), ['Inicio', 'Materias', 'Exámenes', 'Cuenta']);
    assert.equal(c.doc.querySelector('#tabbar [aria-current="page"]').id, 'tab-home');
    for (const [id, hash, h1] of [['tab-subjects', '#/materias', /Materias/], ['tab-exams', '#/examenes', /Exámenes/], ['tab-account', '#/cuenta', /Cuenta/], ['tab-home', '', /Nivel 1/]]) {
      await c.click(c.doc.getElementById(id));
      assert.equal(c.w.location.hash, hash);
      assert.match(c.doc.querySelector('main h1').textContent, h1);
      assert.equal(c.doc.querySelector('#tabbar [aria-current="page"]').id, id);
      assert.equal(c.doc.querySelectorAll('main h1').length, 1, 'un solo h1 por pantalla');
    }
  });

  it('enlaces directos abren cada sección y la pantalla de una materia; una materia inexistente cae en Materias', async () => {
    assert.match((await mount({ url: 'https://elamath.test/#/examenes' })).doc.querySelector('h1').textContent, /Exámenes/);
    assert.match((await mount({ url: 'https://elamath.test/#/cuenta' })).doc.querySelector('h1').textContent, /Cuenta/);
    const materia = await mount({ url: 'https://elamath.test/#/materias/algebra' });
    assert.match(materia.doc.querySelector('h1').textContent, /Álgebra/);
    assert.equal(materia.doc.querySelector('#tabbar [aria-current="page"]').id, 'tab-subjects');
    const mal = await mount({ url: 'https://elamath.test/#/materias/no-existe' });
    assert.match(mal.doc.querySelector('h1').textContent, /Materias/);
    assert.equal(mal.w.location.hash, '#/materias');
  });

  it('Inicio es corto: avance, accesos directos y nada de la lista de materias', async () => {
    const c = await mount({ store: welcomed() });
    assert.equal(c.doc.querySelectorAll('article.subject').length, 0);
    assert.ok(c.doc.querySelector('#start-btn'), 'sin práctica previa invita a elegir materia');
    await c.click(c.doc.querySelector('#home-exams'));
    assert.equal(c.w.location.hash, '#/examenes');
    c.api.go('home');
    await c.click(c.doc.querySelector('#home-subjects'));
    assert.equal(c.w.location.hash, '#/materias');
  });

  it('la lista de materias es compacta y la pantalla de la materia tiene temas, práctica mixta y exámenes', async () => {
    const c = await mount({ store: welcomed() });
    c.api.go('subjects');
    assert.equal(c.doc.querySelectorAll('article.subject .topics:not([hidden])').length, 0, 'los temas no se listan hasta buscar');
    assert.ok(openSubject(c.doc, (v) => c.api.go(v), 'Álgebra'));
    assert.equal(c.w.location.hash, '#/materias/algebra');
    assert.equal(c.doc.querySelectorAll('.topic').length, 8);
    assert.ok(c.doc.querySelector('#mixed-btn') && c.doc.querySelector('[data-exam="Álgebra"]') && c.doc.querySelector('[data-final="Álgebra"]'));
    await c.click(c.doc.querySelector('#subject-back'));
    assert.equal(c.w.location.hash, '#/materias');
  });

  it('en práctica la barra se oculta y al responder aparece el resultado fijo con «Siguiente»', async () => {
    const c = await mount({ store: welcomed() });
    const p = await startMixed(c);
    assert.equal(c.doc.getElementById('tabbar').hidden, true);
    assert.equal(c.doc.querySelector('#answer-bar'), null);
    assert.ok(c.doc.querySelector('.help #explain-btn'), 'las ayudas van agrupadas');
    assert.ok(c.doc.querySelector('.minor-actions #next-btn'), '«Saltar» es un enlace discreto');
    await c.click(c.qa('button.option')[wrongIdx(p)]);
    const bar = c.doc.querySelector('#answer-bar');
    assert.match(bar.textContent, /Incorrecto/);
    assert.ok(bar.querySelector('#next-btn.btn-primary'));
    assert.equal(c.doc.querySelectorAll('#next-btn').length, 1);
    await c.click(bar.querySelector('#next-btn'));
    assert.equal(c.doc.querySelector('#answer-bar'), null);
    await c.click(c.doc.querySelector('#practice-back'));
    assert.equal(c.doc.getElementById('tabbar').hidden, false);
  });

  it('Exámenes lista las materias y muestra el historial de calificaciones', async () => {
    const vacio = await mount({ store: welcomed() });
    vacio.api.go('exams');
    assert.ok(vacio.doc.querySelector('#exam-history-empty'));
    assert.equal(vacio.doc.querySelectorAll('[data-exam]').length, 16);
    const store = memStore({ ...L.defaultState(), welcomed: true, exams: [{ at: '2026-10-18', label: 'Álgebra', score: 4, correct: 4, total: 10, seconds: 600 }, { at: '2026-10-19', label: 'Cálculo Integral', score: 8, correct: 8, total: 10, seconds: 500 }] });
    const c = await mount({ store });
    c.api.go('exams');
    const rows = [...c.doc.querySelectorAll('#exam-history li')];
    assert.equal(rows.length, 2);
    assert.match(rows[0].textContent, /Cálculo Integral.*8\.0 \/ 10/, 'el más reciente primero');
    assert.ok(rows[0].querySelector('.score.ok') && rows[1].querySelector('.score.bad'));
  });
});
