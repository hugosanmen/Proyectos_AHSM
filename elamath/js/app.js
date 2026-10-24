// app.js — interfaz de ElaMath (JavaScript puro, sin framework).
// Depende de `katex` como global (se carga desde vendor/katex/katex.min.js) y del motor paramétrico.
// Toda la lógica de reglas vive en logic.js; aquí solo hay presentación y flujo.
//
// FASE 2: cuenta por correo, Peer Tutor con IA (a través de la API) y reporte de errores.
// Si no hay backend (p. ej. alojado en un hosting estático) la app sigue funcionando como la FASE 1.

import { generateExercise, toMultipleChoice, templates } from './engine/index.js';
import { CURRICULUM } from './curriculum.js';
import { createStore } from './db.js';
import { LocalCreditsService } from './credits.js';
import { createApi } from './api.js';
import { renderRichText } from './richtext.js';
import { prepareImage } from './image.js';
import * as X from './exam.js';
import * as L from './logic.js';

// Precio de referencia (el servidor manda el vigente en /api/health y /api/me). Cobro manual por ahora.
export const PLANS = { monthly: 50, currency: 'MXN' };

// ── Utilidades de DOM ───────────────────────────────────────────
function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props ?? {})) {
    if (v === false || v == null) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(typeof kid === 'object' && kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return el;
}

/** Renderiza LaTeX con KaTeX (salida HTML + MathML para lectores de pantalla). */
function math(latex, { display = false } = {}) {
  const span = h('span', { class: display ? 'math math-display' : 'math' });
  try {
    globalThis.katex.render(latex, span, { displayMode: display, throwOnError: false, output: 'htmlAndMathml', strict: 'ignore' });
  } catch {
    span.textContent = latex; // sin KaTeX, se muestra el LaTeX en texto plano
  }
  return span;
}

/** replaceChildren que ignora null/false (el DOM nativo los convertiría en el TEXTO «null»/«false»). */
function put(el, ...kids) {
  el.replaceChildren(...kids.flat(Infinity).filter((k) => k != null && k !== false));
}

function progressBar(ratio, label) {
  const pct = Math.round(Math.max(0, Math.min(1, ratio)) * 100);
  const fill = h('span');
  fill.style.width = `${pct}%`;
  return h('div', { class: 'bar', role: 'progressbar', 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': pct, 'aria-label': label }, fill);
}

const openDialog = (d) => {
  if (d.open) return;
  if (typeof d.showModal === 'function') d.showModal();
  else d.setAttribute('open', '');
};
const closeDialog = (d) => {
  if (typeof d.close === 'function') d.close();
  else d.removeAttribute('open');
};
const $ = (id) => document.getElementById(id);

const MODE_TEXT = {
  hint: 'Dame una pista para empezar, sin darme la respuesta.',
  why: '¿Por qué mi respuesta no es correcta?',
  deep: 'No me quedó claro. Explícamelo de otra forma.',
};

// ── Aplicación ──────────────────────────────────────────────────
export async function startApp(root, opts = {}) {
  const now = opts.now ?? (() => new Date());
  const rand = opts.random ?? Math.random;
  const store = opts.store ?? createStore();
  const api = opts.api ?? createApi();
  const today = () => L.localDateString(now());
  const online = () => globalThis.navigator?.onLine !== false;

  let state = await store.load();
  const persist = () => {
    Promise.resolve(store.save(state)).catch(() => {});
  };
  const credits = new LocalCreditsService({ get: () => state, set: (s) => (state = s), today, persist });

  let view = 'home';
  let practice = null;
  let backend = { available: false }; // ¿hay API? (se averigua al arrancar)
  let account = api.cachedAccount(); // { email, plan:'trial'|'pro'|'free', trial, billing, tutor:{used,limit,remaining} } | null
  let examView = null; // { exam, item, result } mientras hay un examen simulado
  let examTimer = null;
  const prepare = opts.prepareImage ?? prepareImage;
  const nowMs = () => now().getTime();
  const ui = {
    account: { busy: false, sent: false, status: '', email: '', devLink: null },
    report: { busy: false, done: false, status: '', offline: false },
    promo: { busy: false, status: '', ok: false, code: '' },
    scan: { busy: false, status: '', reply: '', image: null, preview: null, note: '' },
    proReason: 'info',
  };

  // Prueba gratis y Pro desbloquean todo; "free" conserva la práctica básica.
  const fullAccess = () => Boolean(account && (account.plan === 'pro' || account.plan === 'trial' || account.plan === 'open'));
  const billingOn = () => account?.billing?.enabled ?? backend.billing?.enabled ?? false; // ¿ya se cobra? (apagado en la etapa de pruebas)
  const billing = () => account?.billing ?? backend.billing ?? { priceMxn: PLANS.monthly, trialDays: 30, instructions: '' };
  const planName = () => (account?.plan === 'trial' ? 'Prueba gratis' : account?.plan === 'pro' ? 'Pro' : account?.plan === 'open' ? 'Acceso completo' : 'Gratis');
  const fmtDate = (iso) => new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' });

  let toastTimer;
  function toast(text, ms = 6000) {
    const t = $('toast');
    if (!t) return;
    t.replaceChildren(h('span', {}, text));
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      t.hidden = true;
    }, ms);
  }

  /** Con backend, el plan lo manda el servidor; sin backend queda el plan local de demostración. */
  function syncPlan() {
    if (!backend.available) return;
    const plan = fullAccess() ? 'pro' : 'free';
    if (state.plan !== plan) {
      state = { ...state, plan };
      persist();
    }
  }

  // ── HUD (nivel, racha, consultas, cuenta) ─────────────────────
  async function renderHud() {
    const hud = $('hud');
    if (!hud) return;
    const info = L.levelInfo(state.xp);
    const st = await credits.status();
    const streak = L.currentStreak(state.streak, today());
    const tag = account?.plan === 'trial' ? 'Prueba · ' : account?.plan === 'open' ? '' : 'Pro · ';
    const creditsText = st.plan === 'pro' ? `${tag}${st.remaining} consultas hoy` : `${st.remaining}/${st.limit} consultas hoy`;
    const accountText = !account ? '👤 Entrar' : account.plan === 'pro' ? '⭐ Pro' : account.plan === 'trial' ? `🎁 Prueba · ${account.trial?.daysLeft ?? 0} d` : '👤 Cuenta';
    put(
      hud,
      h('span', { class: 'chip', 'aria-label': `Nivel ${info.level}, ${info.title}` }, `Nv. ${info.level}`),
      h('span', { class: 'chip', 'aria-label': `Racha de ${streak} días` }, `🔥 ${streak}`),
      h('button', { class: 'chip chip-btn', type: 'button', id: 'credits-chip', onclick: () => openPro('info'), 'aria-label': `${creditsText}. Abrir planes` }, creditsText),
      backend.available &&
        h('button', { class: 'chip chip-btn', type: 'button', id: 'account-chip', onclick: openAccount, 'aria-label': account ? `Mi cuenta (${account.email})` : 'Iniciar sesión' }, accountText),
    );
  }

  // ── Navegación ────────────────────────────────────────────────
  function go(name) {
    view = name;
    render();
    window.scrollTo?.(0, 0);
    root.focus?.({ preventScroll: true });
  }

  function render() {
    if (view !== 'exam') stopExamTimer();
    if (view === 'exam' && examView) renderExam();
    else if (view === 'practice' && practice) renderPractice();
    else renderHome();
    renderHud();
  }

  // ── Inicio ────────────────────────────────────────────────────
  function renderHome() {
    const info = L.levelInfo(state.xp);
    const hero = h(
      'section',
      { class: 'card hero', 'aria-labelledby': 'hero-title' },
      h('p', { class: 'eyebrow' }, 'Tu avance'),
      h('h1', { id: 'hero-title' }, `Nivel ${info.level} · ${info.title}`),
      progressBar(info.progress, 'Progreso hacia el siguiente nivel'),
      h('p', { class: 'muted' }, info.isMax ? 'Nivel máximo alcanzado.' : `${info.xpInto} / ${info.xpNeeded} XP para el siguiente nivel`),
      h('p', { class: 'muted small' }, `${state.stats.correct} aciertos de ${state.stats.answered} intentos`),
      state.exams.length ? h('p', { class: 'muted small', id: 'last-exam' }, `Último examen simulado: ${state.exams.at(-1).score.toFixed(1)} / 10 (${state.exams.at(-1).label})`) : null,
    );

    const sections = CURRICULUM.map((lvl) => {
      const cards = lvl.subjects.map(subjectCard);
      const nTopics = lvl.subjects.filter((x) => x.available).length;
      return h(
        'details',
        { class: 'level', open: true },
        h('summary', {}, h('span', { class: 'level-title' }, `Nivel ${lvl.level} · ${lvl.name}`), h('span', { class: 'muted small' }, ` ${lvl.semesters} · ${nTopics} ${nTopics === 1 ? 'materia' : 'materias'}`)),
        h('div', { class: 'grid' }, cards),
      );
    });

    const planLabel = state.plan === 'pro' ? (backend.available ? `Mi plan: ${planName()}` : 'Mi plan: Pro (demo)') : 'Ver plan Pro';
    const showPlanBtn = !(backend.available && account && !billingOn()); // sin cobro no hay plan que mostrar
    const footer = h(
      'div',
      { class: 'home-actions' },
      backend.available && backend.scan !== false ? h('button', { class: 'btn btn-ghost', type: 'button', id: 'scan-open', onclick: openScan }, '📷 Escáner de apuntes') : null,
      showPlanBtn ? h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => openPro('info') }, planLabel) : null,
      h('button', { class: 'btn btn-ghost danger', type: 'button', onclick: resetProgress }, 'Reiniciar progreso'),
    );

    root.replaceChildren(hero, ...sections, footer);
  }

  function subjectCard(subject) {
    if (!subject.available) {
      return h('article', { class: 'card subject disabled' }, h('h3', {}, subject.name), h('p', { class: 'muted small' }, 'Próximamente'));
    }
    const rows = subject.topics.map((topic) => {
      const recent = state.topics[topic]?.recent ?? [];
      const ratio = L.masteryRatio(recent);
      const label = recent.length === 0 ? 'Sin intentos' : `Dominio ${Math.round(ratio * 100)}%${L.isMastered(recent) ? ' · ¡Dominado!' : ''}`;
      return h(
        'li',
        { class: 'topic' },
        h('div', { class: 'topic-main' }, h('span', { class: 'topic-name' }, topic), h('span', { class: 'muted small' }, label)),
        progressBar(ratio, `Dominio de ${topic}`),
        h('button', { class: 'btn', type: 'button', 'aria-label': `Practicar ${topic}`, onclick: () => startPractice([topic], topic, subject.minDifficulty) }, 'Practicar'),
      );
    });
    return h(
      'article',
      { class: 'card subject' },
      h('h3', {}, subject.name),
      h('p', { class: 'muted small' }, subject.mixed ? `Mezcla de temas de otras materias${subject.minDifficulty ? ' · solo ejercicios retadores' : ''}` : `${templates.filter((t) => subject.topics.includes(t.topic)).length} tipos de ejercicio, siempre con datos nuevos`),
      h('ul', { class: 'topics' }, rows),
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn btn-primary', type: 'button', onclick: () => startPractice(subject.topics, subject.name, subject.minDifficulty) }, 'Práctica mixta'),
        h('button', { class: 'btn', type: 'button', 'data-exam': subject.name, onclick: () => startExamFlow(subject.topics, subject.name, subject.minDifficulty) }, '📝 Examen simulado'),
      ),
    );
  }

  function resetProgress() {
    if (!globalThis.confirm?.('¿Seguro que quieres borrar todo tu progreso en este dispositivo? No se puede deshacer.')) return;
    state = L.defaultState();
    syncPlan();
    persist();
    go('home');
  }

  // ── Práctica ──────────────────────────────────────────────────
  function startPractice(topics, label, minDifficulty = 0) {
    practice = { topics, label, minDifficulty, recent: [], ex: null, answered: false, picked: null, explained: false, result: null, chat: null };
    nextExercise();
  }

  function nextExercise() {
    const inTopics = templates.filter((t) => practice.topics.includes(t.topic));
    const hard = inTopics.filter((t) => t.difficulty >= (practice.minDifficulty ?? 0));
    const pool = hard.length ? hard : inTopics;
    const fresh = pool.filter((t) => !practice.recent.slice(-2).includes(t.id));
    const list = fresh.length ? fresh : pool;
    const t = list[Math.floor(rand() * list.length)];
    const seed = 1 + Math.floor(rand() * (2 ** 31 - 2));
    practice.recent.push(t.id);
    practice.ex = toMultipleChoice(generateExercise(t.id, seed));
    Object.assign(practice, { answered: false, picked: null, explained: false, result: null, chat: null });
    go('practice');
  }

  function renderPractice() {
    const { ex, answered } = practice;
    const dots = '●'.repeat(ex.difficulty) + '○'.repeat(5 - ex.difficulty);

    const options = ex.options.map((o, i) => {
      const cls = ['option'];
      let mark = null;
      if (answered && o.correct) {
        cls.push('is-correct');
        mark = '✓ Correcta';
      } else if (answered && i === practice.picked) {
        cls.push('is-wrong');
        mark = '✗ Tu respuesta';
      }
      return h(
        'button',
        { class: cls.join(' '), type: 'button', disabled: answered, 'data-option': i, onclick: () => answer(i) },
        h('span', { class: 'letter', 'aria-hidden': 'true' }, 'ABCD'[i]),
        h('span', { class: 'opt-math' }, math(o.latex)),
        mark && h('span', { class: 'mark' }, mark),
      );
    });

    let feedback = null;
    if (answered) {
      const r = practice.result;
      const picked = ex.options[practice.picked];
      feedback = r.correct
        ? h('div', { class: 'feedback ok', id: 'feedback', role: 'status', tabindex: '-1' }, h('strong', {}, `¡Va! +${r.xpGained} XP`), r.helped ? h('span', {}, ' (con ayuda vale la mitad)') : null)
        : h('div', { class: 'feedback bad', id: 'feedback', role: 'status', tabindex: '-1' }, h('strong', {}, 'Mmm, esa no era. '), h('span', {}, picked.feedback), h('span', {}, ' La respuesta correcta quedó marcada.'));
    }

    const explainBtn = practice.explained
      ? null
      : h('button', { class: 'btn', type: 'button', id: 'explain-btn', onclick: explain }, 'Ver paso a paso (usa 1 consulta)');
    const tutorBtn = backend.available ? h('button', { class: 'btn', type: 'button', id: 'tutor-btn', onclick: openTutor }, '💬 Peer Tutor') : null;
    const scanBtn = backend.available && backend.scan !== false ? h('button', { class: 'btn', type: 'button', id: 'scan-btn', onclick: openScan }, '📷 Revisar mi procedimiento') : null;
    const nextBtn = h('button', { class: 'btn btn-primary', type: 'button', id: 'next-btn', onclick: nextExercise }, answered ? 'Siguiente ejercicio' : 'Saltar ejercicio');
    const reportBtn = h('button', { class: 'btn btn-ghost btn-small-ghost', type: 'button', id: 'report-btn', onclick: openReport }, '⚑ Reportar error');

    const explanation = practice.explained
      ? h(
          'section',
          { class: 'card explain', 'aria-labelledby': 'explain-title' },
          h('h3', { id: 'explain-title' }, 'Paso a paso'),
          h('p', { class: 'muted small' }, 'Explicación preparada, sin IA (modo básico).'),
          h('ol', { class: 'steps' }, ex.steps.map((s) => h('li', {}, h('div', { class: 'step-math' }, math(s.latex, { display: true })), h('p', { class: 'step-note' }, s.note)))),
        )
      : null;

    put(
      root,
      h('div', { class: 'practice-head' }, h('button', { class: 'btn btn-ghost', type: 'button', onclick: () => go('home') }, '← Materias'), h('p', { class: 'eyebrow' }, practice.label)),
      h(
        'section',
        { class: 'card question', 'aria-labelledby': 'q-title' },
        h('div', { class: 'q-meta' }, h('span', { class: 'tag' }, ex.topic), h('span', { class: 'dots', role: 'img', 'aria-label': `Dificultad ${ex.difficulty} de 5` }, dots)),
        h('h2', { id: 'q-title', class: 'q-text' }, ex.statement.text),
        ex.statement.latex ? h('div', { class: 'q-math' }, math(ex.statement.latex, { display: true })) : null,
      ),
      h('div', { class: 'options', role: 'group', 'aria-label': 'Opciones de respuesta (atajos: teclas 1 a 4)' }, options),
      feedback,
      h('div', { class: 'actions' }, explainBtn, tutorBtn, scanBtn, nextBtn, reportBtn),
      explanation,
    );
  }

  function answer(idx) {
    if (!practice || practice.answered) return;
    const opt = practice.ex.options[idx];
    if (!opt) return;
    const helped = practice.explained;
    const res = L.applyAnswer(state, { topic: practice.ex.topic, correct: opt.correct, difficulty: practice.ex.difficulty, helped, today: today() });
    state = res.state;
    persist();
    Object.assign(practice, { answered: true, picked: idx, result: { correct: opt.correct, xpGained: res.xpGained, helped } });
    render();
    root.querySelector('#feedback')?.focus({ preventScroll: true });
    if (res.leveledUp) showLevelUp(res.level);
  }

  async function explain() {
    if (!practice || practice.explained) return;
    const r = await credits.consume();
    if (!r.ok) {
      openPro('limit');
      return;
    }
    practice.explained = true;
    render();
  }

  // ── Plan Pro, prueba gratis y códigos de promoción ───────────
  function openPro(reason = 'info') {
    const dlg = $('pro-dialog');
    if (!dlg) return;
    ui.proReason = reason;
    renderPro();
    openDialog(dlg);
  }

  function renderPro() {
    const dlg = $('pro-dialog');
    if (!dlg) return;
    const reason = ui.proReason;
    const pro = state.plan === 'pro';
    const demo = !backend.available;
    const bill = billing();
    if (!demo && !billingOn()) {
      // Etapa de pruebas: sin precios, sin pagos. Solo se explica qué incluye.
      put(
        dlg,
        h(
          'div',
          { class: 'dialog-body' },
          h('h2', { id: 'pro-title' }, 'ElaMath en etapa de pruebas'),
          reason === 'limit' ? h('p', {}, `Llegaste al límite de consultas de paso a paso de hoy (${L.DAILY_LIMITS[state.plan]}). Se renuevan mañana.`) : null,
          h('p', {}, account ? 'Tienes acceso completo y gratis mientras dura la etapa de pruebas:' : 'Entra con tu correo para usar todo gratis mientras dura la etapa de pruebas:'),
          h('ul', { class: 'benefits' }, ['Peer Tutor con IA sobre cada ejercicio', 'Escáner: foto de tu procedimiento y retroalimentación', 'Exámenes simulados adaptativos', 'Reportar errores de ejercicios'].map((t) => h('li', {}, t))),
          h('p', { class: 'muted small' }, 'Avisaremos con tiempo antes de que algo empiece a tener costo.'),
          h('div', { class: 'actions' }, account ? null : h('button', { class: 'btn btn-primary', type: 'button', id: 'pro-login', onclick: () => { closeDialog(dlg); openAccount(); } }, 'Entrar con mi correo'), h('button', { class: 'btn btn-ghost', type: 'button', id: 'close-pro', onclick: () => closeDialog(dlg) }, 'Cerrar')),
        ),
      );
      dlg.setAttribute('aria-labelledby', 'pro-title');
      return;
    }
    const intro =
      reason === 'limit'
        ? `Llegaste al límite de consultas de hoy (${L.DAILY_LIMITS[state.plan]}). Se renuevan mañana, o pasa a Pro para seguir.`
        : reason === 'exam'
          ? 'Los exámenes simulados son parte de ElaMath Pro (y de tu prueba gratis).'
          : 'Más consultas, exámenes simulados y tutoría personalizada para llegar más lejos en tus materias.';

    let status = null;
    if (account) {
      if (account.plan === 'trial') status = `Tu prueba gratis termina el ${fmtDate(account.trial.endsAt)} (${account.trial.daysLeft} ${account.trial.daysLeft === 1 ? 'día' : 'días'}). Todo está desbloqueado.`;
      else if (account.plan === 'pro') status = account.proUntil ? `Tu Pro está activo hasta el ${fmtDate(account.proUntil)}.` : 'Tu Pro está activo.';
      else status = 'Tu prueba gratis terminó. La práctica básica sigue gratis; el Peer Tutor, los exámenes y el escáner requieren Pro.';
    }

    const note = demo
      ? 'Versión de demostración: todavía no hay cobros. Puedes activar Pro de prueba solo en este dispositivo.'
      : null;
    const primary = demo
      ? h('button', { class: 'btn btn-primary', type: 'button', id: 'toggle-plan', onclick: async () => { await credits.setPlan(pro ? 'free' : 'pro'); closeDialog(dlg); render(); } }, pro ? 'Volver al plan Gratis' : 'Activar Pro de prueba')
      : account
        ? null
        : h('button', { class: 'btn btn-primary', type: 'button', id: 'pro-login', onclick: () => { closeDialog(dlg); openAccount(); } }, `Entrar y empezar mis ${bill.trialDays} días gratis`);

    const pay = demo || account?.plan === 'pro'
      ? null
      : h(
          'div',
          { class: 'pay-box', id: 'pay-info' },
          h('strong', {}, 'Cómo activar Pro'),
          h('p', { class: 'small' }, bill.instructions || 'El cobro es manual por ahora: pregunta a quien te compartió ElaMath cómo pagar y activarán tu cuenta.'),
        );

    put(
      dlg,
      h(
        'div',
        { class: 'dialog-body' },
        h('h2', { id: 'pro-title' }, 'ElaMath Pro'),
        h('p', {}, intro),
        status ? h('p', { class: 'trial-status', id: 'trial-status' }, status) : null,
        h('ul', { class: 'benefits' }, [
          `Hasta ${L.DAILY_LIMITS.pro} consultas de paso a paso al día (uso justo)`,
          'Exámenes simulados adaptativos de 10 reactivos y 20 minutos',
          demo ? 'Escáner de apuntes manuscritos (próximamente)' : 'Escáner de apuntes: foto de tu procedimiento y retroalimentación',
          demo ? 'Peer Tutor con IA (próximamente)' : 'Peer Tutor con IA: tutoría personalizada sobre cada ejercicio',
        ].map((t) => h('li', {}, t))),
        h('p', { class: 'price' }, `$${bill.priceMxn} ${PLANS.currency} / mes`),
        demo ? null : h('p', { class: 'muted small' }, `Los primeros ${bill.trialDays} días desde tu registro son gratis y con todo desbloqueado. Después, la práctica básica sigue siendo gratis.`),
        note ? h('p', { class: 'muted small' }, note) : null,
        pay,
        !demo && account ? promoForm() : null,
        h('div', { class: 'actions' }, primary, h('button', { class: 'btn btn-ghost', type: 'button', id: 'close-pro', onclick: () => closeDialog(dlg) }, 'Cerrar')),
      ),
    );
    dlg.setAttribute('aria-labelledby', 'pro-title');
  }

  const PROMO_ERRORS = {
    invalid_code: 'Ese código no existe. Revisa que esté bien escrito.',
    already_used: 'Ya canjeaste este código en tu cuenta.',
    code_expired: 'Este código ya caducó.',
    code_exhausted: 'Este código ya se agotó.',
    rate_limited: 'Demasiados intentos. Espera un rato y vuelve a intentar.',
    network: 'Sin conexión. Conéctate a internet para canjear tu código.',
    unauthorized: 'Tu sesión venció. Entra de nuevo.',
  };

  function promoForm() {
    const p = ui.promo;
    const input = h('input', { type: 'text', id: 'promo-input', name: 'promo', autocomplete: 'off', autocapitalize: 'characters', spellcheck: 'false', maxlength: 24, placeholder: 'ELA-XXXX-XXXX', 'aria-label': 'Código de promoción' });
    input.value = p.code;
    input.addEventListener('input', () => {
      p.code = input.value;
    });
    return h(
      'form',
      { id: 'promo-form', class: 'form promo', onsubmit: (e) => { e.preventDefault(); redeemPromo(input.value); } },
      h('label', { for: 'promo-input' }, '¿Tienes un código de promoción?'),
      h('div', { class: 'row' }, input, h('button', { class: 'btn', type: 'submit', id: 'promo-send', disabled: p.busy }, p.busy ? 'Canjeando…' : 'Canjear')),
      p.status ? h('p', { class: p.ok ? 'form-ok' : 'form-error', id: 'promo-status', role: p.ok ? 'status' : 'alert' }, p.status) : null,
    );
  }

  function rerenderPlanDialogs() {
    if ($('pro-dialog')?.open) renderPro();
    if ($('account-dialog')?.open) renderAccount();
  }

  async function redeemPromo(code) {
    const p = ui.promo;
    if (p.busy) return;
    if (!String(code).trim()) {
      Object.assign(p, { ok: false, status: 'Escribe tu código.' });
      return rerenderPlanDialogs();
    }
    Object.assign(p, { busy: true, status: '', ok: false });
    rerenderPlanDialogs();
    try {
      const out = await api.redeemPromo(code.trim());
      account = { ...account, plan: out.plan, tutor: out.tutor, proUntil: out.proUntil };
      Object.assign(p, { ok: true, code: '', status: `¡Listo! Sumaste ${out.days} días de Pro (hasta el ${fmtDate(out.proUntil)}).` });
      syncPlan();
      render();
    } catch (err) {
      if (err.status === 401) {
        account = null;
        syncPlan();
      }
      p.status = PROMO_ERRORS[err.code] ?? 'No se pudo canjear. Intenta de nuevo.';
    }
    p.busy = false;
    rerenderPlanDialogs();
    renderHud();
  }

  function showLevelUp(level) {
    const dlg = $('levelup-dialog');
    if (!dlg) return;
    const info = L.levelInfo(L.LEVEL_THRESHOLDS[level - 1]);
    dlg.replaceChildren(
      h(
        'div',
        { class: 'dialog-body levelup' },
        h('p', { class: 'burst', 'aria-hidden': 'true' }, '★'),
        h('h2', { id: 'levelup-title' }, '¡Subiste de nivel!'),
        h('p', { class: 'big' }, `Nivel ${info.level} · ${info.title}`),
        h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary', type: 'button', id: 'close-levelup', onclick: () => closeDialog(dlg) }, 'Seguir practicando')),
      ),
    );
    dlg.setAttribute('aria-labelledby', 'levelup-title');
    openDialog(dlg);
  }

  // ── Cuenta (enlace por correo) ────────────────────────────────
  const LOGIN_ERRORS = {
    bad_email: 'Revisa tu correo: parece que le falta algo.',
    rate_limited: 'Demasiados intentos. Espera un rato y vuelve a intentarlo.',
    network: 'Sin conexión. Conéctate a internet para recibir tu enlace.',
    email_not_configured: 'El acceso por correo todavía no está disponible.',
    not_configured: 'El acceso por correo todavía no está disponible.',
    email_failed: 'No pudimos enviar el correo. Intenta de nuevo en unos minutos.',
  };

  async function submitEmail(email) {
    const u = ui.account;
    Object.assign(u, { busy: true, status: '', email });
    renderAccount();
    try {
      const out = await api.requestLogin(email);
      Object.assign(u, { sent: true, devLink: out?.devLink ?? null });
    } catch (err) {
      u.status = LOGIN_ERRORS[err.code] ?? 'Algo salió mal. Intenta de nuevo.';
    }
    u.busy = false;
    renderAccount();
  }

  function openAccount() {
    const dlg = $('account-dialog');
    if (!dlg) return;
    if (!account) Object.assign(ui.account, { sent: false, status: '', devLink: null, busy: false });
    renderAccount();
    openDialog(dlg);
  }

  function renderAccount() {
    const dlg = $('account-dialog');
    if (!dlg) return;
    const u = ui.account;
    let body;
    if (account) {
      const t = account.tutor;
      const tutorLine = t?.limit > 0 ? `Peer Tutor: ${t.remaining} de ${t.limit} mensajes disponibles hoy.` : 'El Peer Tutor es parte del plan Pro.';
      const planLine =
        account.plan === 'open'
          ? 'Acceso completo y gratis durante la etapa de pruebas'
          : account.plan === 'trial'
          ? `Plan: Prueba gratis · termina el ${fmtDate(account.trial.endsAt)} (${account.trial.daysLeft} d)`
          : account.plan === 'pro'
            ? `Plan: Pro${account.proUntil ? ` · hasta el ${fmtDate(account.proUntil)}` : ''}`
            : 'Plan: Gratis (tu prueba terminó)';
      body = [
        h('h2', { id: 'account-title' }, 'Mi cuenta'),
        h('p', {}, h('strong', {}, account.email)),
        h('p', { class: 'muted', id: 'plan-line' }, planLine),
        h('p', { class: 'muted' }, tutorLine),
        billingOn() ? promoForm() : null,
        h('p', { class: 'muted small' }, 'Tu progreso de práctica se guarda en este dispositivo.'),
        h(
          'div',
          { class: 'actions' },
          h('button', { class: 'btn', type: 'button', id: 'logout-btn', onclick: () => { api.logout(); account = null; syncPlan(); closeDialog(dlg); render(); toast('Cerraste sesión.'); } }, 'Cerrar sesión'),
          h('button', { class: 'btn btn-ghost', type: 'button', id: 'close-account', onclick: () => closeDialog(dlg) }, 'Cerrar'),
        ),
      ];
    } else if (u.sent) {
      body = [
        h('h2', { id: 'account-title' }, 'Revisa tu correo'),
        h('p', {}, `Te enviamos un enlace a ${u.email}. Ábrelo en este mismo dispositivo; vale 15 minutos y solo se puede usar una vez.`),
        h('p', { class: 'muted small' }, 'Si no llega, mira en spam o correo no deseado.'),
        u.devLink ? h('a', { class: 'btn btn-primary', id: 'dev-link', href: u.devLink }, 'Abrir enlace de desarrollo') : null,
        h('div', { class: 'actions' }, h('button', { class: 'btn btn-ghost', type: 'button', id: 'close-account', onclick: () => closeDialog(dlg) }, 'Cerrar')),
      ];
    } else {
      const input = h('input', { type: 'email', id: 'email-input', name: 'email', required: true, autocomplete: 'email', inputmode: 'email', maxlength: 254, placeholder: 'tu@correo.com', 'aria-describedby': 'email-help' });
      input.value = u.email || '';
      body = [
        h('h2', { id: 'account-title' }, 'Entra a ElaMath'),
        h('p', {}, 'Sin contraseña: te mandamos un enlace a tu correo.'),
        h(
          'form',
          {
            id: 'login-form',
            class: 'form',
            onsubmit: (e) => {
              e.preventDefault();
              if (!u.busy) submitEmail(input.value.trim());
            },
          },
          h('label', { for: 'email-input' }, 'Correo electrónico'),
          input,
          h('p', { class: 'muted small', id: 'email-help' }, 'Usamos tu correo solo para tu cuenta y para contar tus mensajes del tutor. No lo compartimos.'),
          u.status ? h('p', { class: 'form-error', id: 'login-status', role: 'alert' }, u.status) : null,
          h(
            'div',
            { class: 'actions' },
            h('button', { class: 'btn btn-primary', type: 'submit', id: 'send-link', disabled: u.busy }, u.busy ? 'Enviando…' : 'Enviar enlace'),
            h('button', { class: 'btn btn-ghost', type: 'button', id: 'close-account', onclick: () => closeDialog(dlg) }, 'Cerrar'),
          ),
        ),
      ];
    }
    dlg.replaceChildren(h('div', { class: 'dialog-body' }, body));
    dlg.setAttribute('aria-labelledby', 'account-title');
  }

  async function refreshAccount() {
    try {
      account = await api.me();
    } catch (err) {
      if (err.status === 401) account = null; // sesión vencida; sin red se conserva la última cuenta conocida
    }
    syncPlan();
  }

  // ── Peer Tutor ────────────────────────────────────────────────
  const tutorState = () => (!account ? 'login' : !(account.tutor?.limit > 0) ? 'upgrade' : 'ready');
  const chatOf = () => (practice.chat ??= { messages: [], busy: false, draft: '', notice: '' });

  const TUTOR_ERRORS = {
    network: 'Sin conexión: el Peer Tutor necesita internet.',
    daily_limit: 'Ya usaste tus mensajes de hoy. Se renuevan mañana.',
    capacity: 'El tutor está muy ocupado ahora. Intenta en unos minutos.',
    tutor_not_configured: 'El tutor todavía no está activado en este servidor.',
    upstream_error: 'El tutor no pudo responder. No se descontó tu mensaje; intenta de nuevo.',
    unauthorized: 'Tu sesión venció. Entra de nuevo.',
    upgrade_required: 'El Peer Tutor es parte del plan Pro.',
  };

  function openTutor() {
    if (!practice || !$('tutor-dialog')) return;
    renderTutor();
    openDialog($('tutor-dialog'));
    $('tutor-input')?.focus({ preventScroll: true });
  }

  async function sendToTutor(text, mode = 'explain') {
    const chat = chatOf();
    text = text.trim();
    if (!text || chat.busy) return;
    if (!online()) {
      chat.notice = TUTOR_ERRORS.network;
      chat.draft = text;
      renderTutor();
      return;
    }
    const history = chat.messages.map(({ role, content }) => ({ role, content }));
    const ex = practice.ex;
    chat.messages.push({ role: 'user', content: text });
    Object.assign(chat, { busy: true, notice: '', draft: '' });
    renderTutor();

    try {
      const out = await api.tutor({ message: text, mode, history, exercise: { templateId: ex.templateId, seed: ex.seed, pickedIndex: practice.answered ? practice.picked : null } });
      chat.messages.push({ role: 'assistant', content: out.reply });
      if (out.tutor && account) {
        account = { ...account, tutor: out.tutor };
        api.updateCachedAccount({ tutor: out.tutor });
      }
    } catch (err) {
      chat.messages.pop(); // el mensaje no se procesó: se devuelve al cuadro para reintentar
      chat.draft = text;
      chat.notice = TUTOR_ERRORS[err.code] ?? 'Algo salió mal. Intenta de nuevo.';
      if (err.status === 401) {
        account = null;
        syncPlan();
      }
      if (err.status === 402 && account) account = { ...account, plan: 'free' };
      if (err.data?.tutor && account) account = { ...account, tutor: err.data.tutor };
    }
    chat.busy = false;
    if (practice?.chat === chat) renderTutor(); // si ya cambió de ejercicio, no se redibuja
    renderHud();
  }

  function renderTutor() {
    const dlg = $('tutor-dialog');
    if (!dlg || !practice) return;
    const st = tutorState();
    const close = h('button', { class: 'btn btn-ghost', type: 'button', id: 'tutor-close', 'aria-label': 'Cerrar el Peer Tutor', onclick: () => closeDialog(dlg) }, '✕');
    const head = h('div', { class: 'tutor-head' }, h('h2', { id: 'tutor-title' }, 'Peer Tutor'), close);
    let body;

    if (st === 'login') {
      body = [
        head,
        h('p', {}, 'Entra con tu correo para platicar con el Peer Tutor sobre este ejercicio.'),
        h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary', type: 'button', id: 'tutor-login', onclick: () => { closeDialog(dlg); openAccount(); } }, 'Entrar con mi correo')),
      ];
    } else if (st === 'upgrade') {
      body = [
        head,
        h('p', {}, 'El Peer Tutor es parte de ElaMath Pro. Mientras tanto puedes usar el paso a paso de cada ejercicio.'),
        h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary', type: 'button', id: 'tutor-upgrade', onclick: () => { closeDialog(dlg); openPro('info'); } }, 'Ver plan Pro')),
      ];
    } else {
      const chat = chatOf();
      const t = account.tutor;
      const quota = t ? `${account.plan === 'pro' ? 'Pro · ' : account.plan === 'trial' ? 'Prueba · ' : ''}${t.remaining} de ${t.limit} mensajes disponibles hoy` : '';

      const log = h('div', { class: 'chat', id: 'chat-log', role: 'log', 'aria-live': 'polite', 'aria-label': 'Conversación con el Peer Tutor' });
      if (!chat.messages.length) {
        log.append(h('p', { class: 'muted small chat-empty' }, 'Pregúntame lo que quieras de este ejercicio, o usa un atajo. Te ayudo a pensarlo; no te regalo la respuesta.'));
      }
      for (const m of chat.messages) {
        if (m.role === 'user') log.append(h('div', { class: 'bubble me' }, m.content));
        else {
          const b = h('div', { class: 'bubble bot' });
          renderRichText(b, m.content, (latex, display) => math(latex, { display }));
          log.append(b);
        }
      }
      if (chat.busy) log.append(h('div', { class: 'bubble bot typing', id: 'tutor-typing' }, 'Pensando…'));

      const quick = [
        h('button', { class: 'chip-q', type: 'button', 'data-mode': 'hint', disabled: chat.busy, onclick: () => sendToTutor(MODE_TEXT.hint, 'hint') }, 'Dame una pista'),
        practice.answered && !practice.result.correct
          ? h('button', { class: 'chip-q', type: 'button', 'data-mode': 'why', disabled: chat.busy, onclick: () => sendToTutor(MODE_TEXT.why, 'explain') }, '¿Por qué me equivoqué?')
          : null,
        chat.messages.some((m) => m.role === 'assistant') || practice.answered
          ? h('button', { class: 'chip-q', type: 'button', 'data-mode': 'deep', disabled: chat.busy, onclick: () => sendToTutor(MODE_TEXT.deep, 'deep') }, 'Explícamelo de otra forma')
          : null,
      ];

      const ta = h('textarea', { id: 'tutor-input', rows: 2, maxlength: 1000, placeholder: 'Escribe tu duda…', 'aria-label': 'Escribe tu pregunta para el Peer Tutor', disabled: chat.busy });
      ta.value = chat.draft;
      ta.addEventListener('input', () => {
        chat.draft = ta.value;
      });
      ta.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          sendToTutor(ta.value);
        }
      });

      body = [
        head,
        h('p', { class: 'muted small', id: 'tutor-quota' }, quota),
        log,
        h('div', { class: 'quick' }, quick),
        chat.notice ? h('p', { class: 'form-error', id: 'tutor-notice', role: 'alert' }, chat.notice) : null,
        h(
          'form',
          { id: 'chat-form', class: 'chat-form', onsubmit: (e) => { e.preventDefault(); sendToTutor(ta.value); } },
          ta,
          h('button', { class: 'btn btn-primary', type: 'submit', id: 'tutor-send', disabled: chat.busy }, 'Enviar'),
        ),
        h('p', { class: 'muted small' }, 'El tutor es una IA y puede equivocarse: compara con el paso a paso verificado del ejercicio.'),
      ];
      dlg.replaceChildren(h('div', { class: 'dialog-body tutor' }, body));
      dlg.setAttribute('aria-labelledby', 'tutor-title');
      log.scrollTop = log.scrollHeight;
      if (dlg.open && !chat.busy) ta.focus({ preventScroll: true });
      return;
    }
    dlg.replaceChildren(h('div', { class: 'dialog-body tutor' }, body));
    dlg.setAttribute('aria-labelledby', 'tutor-title');
  }

  // ── Reportar error ────────────────────────────────────────────
  function openReport() {
    const dlg = $('report-dialog');
    if (!practice || !dlg) return;
    Object.assign(ui.report, { busy: false, done: false, status: '', offline: false });
    renderReport();
    openDialog(dlg);
  }

  async function submitReport(kind, note) {
    const r = ui.report;
    const ex = practice.ex;
    const payload = { kind, note, exercise: { templateId: ex.templateId, seed: ex.seed, pickedIndex: practice.answered ? practice.picked : null } };
    Object.assign(r, { busy: true, status: '' });
    renderReport();
    if (!backend.available) {
      Object.assign(r, { busy: false, done: true, offline: true });
      return renderReport();
    }
    try {
      await api.report(payload);
      r.done = true;
    } catch (err) {
      if (err.code === 'network') Object.assign(r, { done: true, offline: true });
      else r.status = err.code === 'rate_limited' ? 'Ya enviaste varios reportes. Intenta más tarde.' : 'No se pudo enviar. Intenta de nuevo.';
    }
    r.busy = false;
    renderReport();
  }

  function renderReport() {
    const dlg = $('report-dialog');
    if (!dlg || !practice) return;
    const r = ui.report;
    const code = `${practice.ex.templateId}#${practice.ex.seed}`;
    let body;
    if (r.done) {
      body = [
        h('h2', { id: 'report-title' }, r.offline ? 'No se pudo enviar' : '¡Gracias!'),
        h('p', {}, r.offline ? 'No hay conexión con el servidor. Anota este código del ejercicio y mándaselo a quien te dio la app:' : 'Revisaremos este ejercicio. Si quieres citarlo, su código es:'),
        h('p', {}, h('code', { id: 'report-code' }, code)),
        h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary', type: 'button', id: 'close-report', onclick: () => closeDialog(dlg) }, 'Cerrar')),
      ];
    } else {
      const radio = (id, value, label, checked) => h('label', { class: 'radio', for: id }, h('input', { type: 'radio', name: 'kind', id, value, checked }), ` ${label}`);
      const note = h('textarea', { id: 'report-note', name: 'note', rows: 3, maxlength: 500, placeholder: 'Cuéntanos qué viste (opcional)', 'aria-label': 'Describe el problema' });
      body = [
        h('h2', { id: 'report-title' }, 'Reportar un problema'),
        h('p', { class: 'muted small' }, `Ejercicio ${code}`),
        h(
          'form',
          {
            id: 'report-form',
            class: 'form',
            onsubmit: (e) => {
              e.preventDefault();
              if (r.busy) return;
              const kind = dlg.querySelector('input[name="kind"]:checked')?.value ?? 'other';
              submitReport(kind, note.value.trim());
            },
          },
          h('fieldset', { class: 'radios' }, h('legend', {}, '¿Qué pasó?'), radio('rk-math', 'math_error', 'Un resultado o enunciado está mal', true), radio('rk-ui', 'ui', 'Algo no se ve o no funciona bien', false), radio('rk-other', 'other', 'Otra cosa', false)),
          note,
          r.status ? h('p', { class: 'form-error', role: 'alert' }, r.status) : null,
          h(
            'div',
            { class: 'actions' },
            h('button', { class: 'btn btn-primary', type: 'submit', id: 'send-report', disabled: r.busy }, r.busy ? 'Enviando…' : 'Enviar reporte'),
            h('button', { class: 'btn btn-ghost', type: 'button', id: 'close-report', onclick: () => closeDialog(dlg) }, 'Cancelar'),
          ),
        ),
      ];
    }
    dlg.replaceChildren(h('div', { class: 'dialog-body' }, body));
    dlg.setAttribute('aria-labelledby', 'report-title');
  }

  // ── Escáner de apuntes ────────────────────────────────────────
  const SCAN_ERRORS = {
    network: 'Sin conexión: el escáner necesita internet.',
    daily_limit: 'Ya usaste tus mensajes de hoy (el escáner comparte la cuota del tutor). Se renuevan mañana.',
    capacity: 'El servicio está muy ocupado ahora. Intenta en unos minutos.',
    scan_not_configured: 'El escáner todavía no está activado en este servidor.',
    upstream_error: 'No pudimos leer la foto. No se descontó tu mensaje; intenta de nuevo.',
    unauthorized: 'Tu sesión venció. Entra de nuevo.',
    upgrade_required: 'El escáner es parte del plan Pro.',
    bad_image: 'La imagen no es válida. Prueba con otra foto (JPG, PNG o WebP).',
    not_image: 'Ese archivo no es una imagen.',
    too_big: 'La foto es demasiado pesada. Acércate o recórtala e intenta de nuevo.',
    decode: 'No pude abrir esa imagen. Prueba con otra foto.',
  };
  const scanState = () => (!account ? 'login' : !(account.tutor?.limit > 0) ? 'upgrade' : 'ready');

  function openScan() {
    const dlg = $('scan-dialog');
    if (!dlg) return;
    Object.assign(ui.scan, { busy: false, status: '', reply: '', image: null, preview: null });
    renderScan();
    openDialog(dlg);
  }

  async function onScanFile(file) {
    const sc = ui.scan;
    Object.assign(sc, { status: '', reply: '', image: null, preview: null });
    if (!file) return renderScan();
    sc.busy = true;
    renderScan();
    try {
      const img = await prepare(file);
      sc.image = { mediaType: img.mediaType, data: img.data };
      sc.preview = `data:${img.mediaType};base64,${img.data}`;
    } catch (err) {
      sc.status = SCAN_ERRORS[err.code] ?? 'No pude preparar la foto. Intenta con otra.';
    }
    sc.busy = false;
    renderScan();
  }

  async function sendScan() {
    const sc = ui.scan;
    if (sc.busy || !sc.image) return;
    if (!online()) {
      sc.status = SCAN_ERRORS.network;
      return renderScan();
    }
    Object.assign(sc, { busy: true, status: '', reply: '' });
    renderScan();
    try {
      const out = await api.scan({ image: sc.image, message: sc.note.trim() || undefined });
      sc.reply = out.reply;
      if (out.tutor && account) {
        account = { ...account, tutor: out.tutor };
        api.updateCachedAccount({ tutor: out.tutor });
      }
    } catch (err) {
      sc.status = SCAN_ERRORS[err.code] ?? 'Algo salió mal. Intenta de nuevo.';
      if (err.status === 401) {
        account = null;
        syncPlan();
      }
      if (err.status === 402 && account) account = { ...account, plan: 'free' };
      if (err.data?.tutor && account) account = { ...account, tutor: err.data.tutor };
    }
    sc.busy = false;
    renderScan();
    renderHud();
  }

  function renderScan() {
    const dlg = $('scan-dialog');
    if (!dlg) return;
    const sc = ui.scan;
    const st = scanState();
    const close = h('button', { class: 'btn btn-ghost', type: 'button', id: 'scan-close', 'aria-label': 'Cerrar el escáner', onclick: () => closeDialog(dlg) }, '✕');
    const head = h('div', { class: 'tutor-head' }, h('h2', { id: 'scan-title' }, 'Escáner de apuntes'), close);
    let body;
    if (st === 'login') {
      body = [head, h('p', {}, 'Entra con tu correo para que el Peer Tutor revise tu procedimiento a mano.'), h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary', type: 'button', id: 'scan-login', onclick: () => { closeDialog(dlg); openAccount(); } }, 'Entrar con mi correo'))];
    } else if (st === 'upgrade') {
      body = [head, h('p', {}, 'El escáner de apuntes es parte de ElaMath Pro.'), h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary', type: 'button', id: 'scan-upgrade', onclick: () => { closeDialog(dlg); openPro('info'); } }, 'Ver plan Pro'))];
    } else {
      const file = h('input', { type: 'file', id: 'scan-file', accept: 'image/*', capture: 'environment', 'aria-label': 'Foto de tu procedimiento', disabled: sc.busy });
      file.addEventListener('change', () => onScanFile(file.files?.[0] ?? null));
      const note = h('textarea', { id: 'scan-note', rows: 2, maxlength: 500, placeholder: 'Opcional: ¿qué te preocupa de este ejercicio?', 'aria-label': 'Nota opcional para el tutor', disabled: sc.busy });
      note.value = sc.note;
      note.addEventListener('input', () => {
        sc.note = note.value;
      });
      const t = account.tutor;
      const reply = h('div', { class: 'bubble bot', id: 'scan-reply' });
      if (sc.reply) renderRichText(reply, sc.reply, (latex, display) => math(latex, { display }));
      body = [
        head,
        h('p', { class: 'muted small', id: 'scan-quota' }, `Cada foto cuenta como un mensaje del tutor · ${t.remaining} de ${t.limit} disponibles hoy`),
        h('p', {}, 'Toma o sube una foto de tu procedimiento (con buena luz y bien enfocada). Te digo dónde está el primer error y una pista, sin regalarte la respuesta.'),
        file,
        sc.preview ? h('img', { class: 'scan-preview', id: 'scan-preview', src: sc.preview, alt: 'Vista previa de tu foto' }) : null,
        note,
        sc.status ? h('p', { class: 'form-error', id: 'scan-notice', role: 'alert' }, sc.status) : null,
        sc.busy ? h('div', { class: 'bubble bot typing', id: 'scan-busy' }, 'Revisando…') : null,
        sc.reply ? reply : null,
        h('div', { class: 'actions' }, h('button', { class: 'btn btn-primary', type: 'button', id: 'scan-send', disabled: sc.busy || !sc.image, onclick: sendScan }, 'Revisar mi procedimiento')),
        h('p', { class: 'muted small' }, 'La foto se reduce en tu dispositivo, se envía para revisarla y no se guarda. Es una IA: puede equivocarse al leer letra a mano.'),
      ];
    }
    put(dlg, h('div', { class: 'dialog-body tutor' }, body));
    dlg.setAttribute('aria-labelledby', 'scan-title');
  }

  // ── Exámenes simulados ────────────────────────────────────────
  function stopExamTimer() {
    if (examTimer) globalThis.clearInterval(examTimer);
    examTimer = null;
  }

  function startExamFlow(topics, label, minDifficulty = 0) {
    // Con servidor, el examen es de Pro/prueba. Sin servidor (demo) queda abierto.
    if (backend.available && state.plan !== 'pro') return openPro('exam');
    const pool = minDifficulty ? templates.filter((t) => t.difficulty >= minDifficulty) : templates;
    examView = { minDifficulty, exam: X.startExam({ topics, label, now: nowMs() }), item: null, result: null, pool: pool.some((t) => topics.includes(t.topic)) ? pool : templates };
    examNext();
    stopExamTimer();
    examTimer = globalThis.setInterval(tickExam, 1000);
    go('exam');
  }

  function examNext() {
    const v = examView;
    v.item = X.nextItem(v.exam, { templates: v.pool, make: (id, seed) => toMultipleChoice(generateExercise(id, seed)), rand });
    if (!v.item) finishExamNow();
  }

  function examPick(i) {
    const v = examView;
    if (!v || v.result || !v.item) return;
    v.exam = X.answerItem(v.exam, v.item, i);
    if (v.exam.items.length >= v.exam.questions) return finishExamNow();
    examNext();
    if (!v.result) render();
  }

  function finishExamNow(reason) {
    const v = examView;
    if (!v || v.result) return;
    stopExamTimer();
    v.exam = X.finishExam(v.exam, nowMs());
    const r = X.applyExam(state, v.exam, today());
    state = r.state;
    persist();
    v.result = { grade: X.gradeExam(v.exam), xpGained: r.xpGained };
    v.item = null;
    if (reason === 'time') toast('Se acabó el tiempo: tu examen se entregó automáticamente.');
    if (view === 'exam') render();
    if (r.leveledUp) showLevelUp(r.level);
  }

  function tickExam() {
    const v = examView;
    if (view !== 'exam' || !v || v.result) return stopExamTimer();
    const left = X.timeLeftMs(v.exam, nowMs());
    const el = $('exam-clock');
    if (el) el.textContent = X.formatClock(left);
    if (X.isExpired(v.exam, nowMs())) finishExamNow('time');
  }

  function leaveExam() {
    if (examView && !examView.result && !globalThis.confirm?.('¿Abandonar el examen? No se guardará ningún resultado.')) return;
    stopExamTimer();
    examView = null;
    go('home');
  }

  function renderExam() {
    const v = examView;
    if (v.result) return renderExamResult();
    const { exam, item } = v;
    const n = exam.items.length + 1;
    const ex = item.ex;
    const options = ex.options.map((o, i) =>
      h('button', { class: 'option', type: 'button', 'data-option': i, onclick: () => examPick(i) }, h('span', { class: 'letter', 'aria-hidden': 'true' }, 'ABCD'[i]), h('span', { class: 'opt-math' }, math(o.latex))),
    );
    put(
      root,
      h(
        'div',
        { class: 'practice-head' },
        h('button', { class: 'btn btn-ghost', type: 'button', id: 'exam-leave', onclick: leaveExam }, '← Abandonar'),
        h('p', { class: 'eyebrow' }, `Examen simulado · ${exam.label}`),
        h('span', { class: 'chip', id: 'exam-clock', role: 'timer', 'aria-label': 'Tiempo restante' }, X.formatClock(X.timeLeftMs(exam, nowMs()))),
      ),
      h(
        'section',
        { class: 'card question', 'aria-labelledby': 'q-title' },
        h('div', { class: 'q-meta' }, h('span', { class: 'tag' }, ex.topic), h('span', { class: 'muted small', id: 'exam-progress' }, `Pregunta ${n} de ${exam.questions}`)),
        progressBar((n - 1) / exam.questions, 'Avance del examen'),
        h('h2', { id: 'q-title', class: 'q-text' }, ex.statement.text),
        ex.statement.latex ? h('div', { class: 'q-math' }, math(ex.statement.latex, { display: true })) : null,
      ),
      h('div', { class: 'options', role: 'group', 'aria-label': 'Opciones de respuesta' }, options),
      h('p', { class: 'muted small' }, 'Sin retroalimentación hasta el final. Cada respuesta es definitiva.'),
      h('div', { class: 'actions' }, h('button', { class: 'btn', type: 'button', id: 'exam-finish', onclick: () => { if (globalThis.confirm?.('¿Entregar ahora? Las preguntas sin contestar cuentan como incorrectas.')) finishExamNow(); } }, 'Entregar examen')),
    );
  }

  function renderExamResult() {
    const { exam, result } = examView;
    const g = result.grade;
    const review = exam.items.map((it, idx) =>
      h(
        'details',
        { class: `review ${it.correct ? 'ok' : 'bad'}` },
        h('summary', {}, `${idx + 1}. ${it.correct ? '✓' : '✗'} ${it.ex.topic}`),
        h('p', {}, it.ex.statement.text),
        it.ex.statement.latex ? h('div', { class: 'q-math' }, math(it.ex.statement.latex, { display: true })) : null,
        h('p', { class: 'small' }, 'Tu respuesta: ', math(it.ex.options[it.picked].latex)),
        it.correct ? null : h('p', { class: 'small' }, 'Correcta: ', math(it.ex.options.find((o) => o.correct).latex)),
        h('ol', { class: 'steps' }, it.ex.steps.map((st) => h('li', {}, h('div', { class: 'step-math' }, math(st.latex, { display: true })), h('p', { class: 'step-note' }, st.note)))),
      ),
    );
    put(
      root,
      h(
        'section',
        { class: 'card hero exam-result', 'aria-labelledby': 'exam-score' },
        h('p', { class: 'eyebrow' }, `Resultado · ${exam.label}`),
        h('h1', { id: 'exam-score' }, `${g.score.toFixed(1)} / 10`),
        h('p', { id: 'exam-verdict', class: g.passed ? 'feedback ok' : 'feedback bad' }, g.passed ? '¡Aprobado!' : `Todavía no alcanza para aprobar (mínimo ${X.EXAM_PASS}). Repasa abajo y vuelve a intentarlo.`),
        h('p', { class: 'muted' }, `${g.correct} de ${g.total} correctas${g.answered < g.total ? ` · ${g.total - g.answered} sin contestar` : ''} · +${result.xpGained} XP`),
      ),
      h('h2', { class: 'section-title' }, 'Revisión'),
      review,
      h(
        'div',
        { class: 'actions' },
        h('button', { class: 'btn btn-primary', type: 'button', id: 'exam-again', onclick: () => startExamFlow(exam.topics, exam.label, examView.minDifficulty) }, 'Otro examen'),
        h('button', { class: 'btn btn-ghost', type: 'button', id: 'exam-home', onclick: () => { examView = null; go('home'); } }, '← Materias'),
      ),
    );
  }

  // ── Atajos de teclado: 1-4 / A-D responden, N pasa al siguiente ─
  function onKey(e) {
    if (e.ctrlKey || e.metaKey || e.altKey || view !== 'practice' || !practice) return;
    if (document.querySelector('dialog[open]')) return;
    if (/^(input|textarea|select)$/i.test(e.target?.tagName ?? '')) return;
    const k = e.key.toLowerCase();
    const idx = '1234'.includes(k) && k.length === 1 ? Number(k) - 1 : 'abcd'.indexOf(k);
    if (idx >= 0 && idx < 4 && k.length === 1) answer(idx);
    else if (k === 'n') nextExercise();
  }
  document.addEventListener('keydown', onKey);

  // ── Backend: disponibilidad, enlace de acceso y cuenta ────────
  async function initBackend() {
    try {
      backend = await api.health();
      if (!backend.available && backend.reason === 'network' && api.hasSession()) backend = { available: true, offline: true }; // sin red pero ya había cuenta
      const loc = globalThis.location;
      const params = new URLSearchParams(loc?.search ?? '');
      const token = params.get('login');
      let loggedNow = false;
      if (token && (backend.available || backend.reason === 'network')) {
        try {
          await api.verifyLogin(token);
          backend = backend.available ? backend : { available: true };
          loggedNow = true;
          toast('¡Listo! Ya entraste a tu cuenta.');
        } catch (err) {
          toast(err.code === 'network' ? 'Sin conexión: abre el enlace de nuevo cuando tengas internet.' : 'El enlace no es válido o ya caducó. Pide uno nuevo.');
        }
        params.delete('login');
        const qs = params.toString();
        try {
          globalThis.history?.replaceState(null, '', `${loc.pathname}${qs ? `?${qs}` : ''}${loc.hash ?? ''}`);
        } catch {
          /* no crítico */
        }
      }
      if (backend.available && api.hasSession()) await refreshAccount();
      else syncPlan();
      if (backend.available || loggedNow) render(); // sin backend no hay nada nuevo que dibujar
    } catch {
      /* la app sigue en modo sin servidor */
    }
  }
  const ready = initBackend();

  render();

  return {
    getState: () => state,
    go,
    ready,
    /** Solo para pruebas. */
    _practice: () => practice,
    _backend: () => backend,
    _account: () => account,
    _tick: tickExam,
    _exam: () => examView,
    destroy: () => {
      stopExamTimer();
      document.removeEventListener('keydown', onKey);
    },
  };
}
