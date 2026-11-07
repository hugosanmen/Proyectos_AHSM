// admin.js — panel de estadísticas. Lee /api/health?stats=1 con el ADMIN_TOKEN y lo dibuja sin librerías
// (la CSP solo permite scripts propios). Todo lo que llega del servidor se escribe como texto, nunca como HTML.

const $ = (id) => document.getElementById(id);
const SVG = 'http://www.w3.org/2000/svg';
const TOKEN_KEY = 'elamath:admin-token';
const nf = new Intl.NumberFormat('es-MX');
const pct = (x) => (x == null ? '—' : `${Math.round(x * 100)}%`);
const dayLabel = (d) => new Date(`${d}T12:00:00Z`).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', timeZone: 'UTC' });
const PLAN_NAMES = { open: 'Acceso completo (etapa de pruebas)', trial: 'Prueba gratis', pro: 'Pro', free: 'Gratis' };
const KIND_NAMES = { math_error: 'Resultado o enunciado', ui: 'Interfaz', other: 'Otro' };

function h(tag, props = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  return el;
}
function s(tag, attrs = {}, ...kids) {
  const el = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  el.append(...kids);
  return el;
}
const store = {
  get: () => {
    try {
      return sessionStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set: (v) => {
    try {
      if (v) sessionStorage.setItem(TOKEN_KEY, v);
      else sessionStorage.removeItem(TOKEN_KEY);
    } catch {
      /* sin almacenamiento: se pide el token cada vez */
    }
  },
};

/** Eje con valores redondos: 0, mitad y máximo "bonito". */
function niceMax(v) {
  if (v <= 4) return 4;
  const p = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
}

const tooltip = h('div', { class: 'chart-tip', role: 'status', hidden: true });

/** Dibuja las columnas al ancho real de la tarjeta, para que el texto de los ejes conserve su tamaño. */
function drawColumns(box) {
  const { values, days, title } = box._chart;
  const total = values.reduce((a, b) => a + b, 0);
  const W = Math.max(280, Math.round(box.clientWidth));
  const H = 190;
  const L = 36;
  const B = 24;
  const T = 10;
  const max = niceMax(Math.max(...values, 0));
  const slot = (W - L) / values.length;
  const bw = Math.min(24, slot * 0.62);
  const y = (v) => T + (H - T - B) * (1 - v / max);
  const svg = s('svg', { viewBox: `0 0 ${W} ${H}`, class: 'chart', role: 'img', 'aria-label': `${title}: ${nf.format(total)} en ${values.length} días` });
  for (const v of [0, max / 2, max]) {
    svg.append(s('line', { x1: L, x2: W, y1: y(v), y2: y(v), class: 'grid' }));
    svg.append(s('text', { x: L - 6, y: y(v) + 4, class: 'tick', 'text-anchor': 'end' }, nf.format(v)));
  }
  values.forEach((v, i) => {
    const x = L + i * slot + (slot - bw) / 2;
    const top = y(v);
    const base = y(0);
    const r = Math.min(4, (base - top) / 2, bw / 2);
    if (v > 0) {
      svg.append(s('path', { class: 'bar', d: `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + bw - r} Q${x + bw},${top} ${x + bw},${top + r} V${base} Z` }));
    }
    const hit = s('rect', { x: L + i * slot, y: T, width: slot, height: H - T - B, class: 'hit', tabindex: 0, 'aria-label': `${dayLabel(days[i])}: ${nf.format(v)}` });
    const show = (ev) => {
      tooltip.replaceChildren(h('strong', {}, nf.format(v)), ` · ${dayLabel(days[i])}`);
      tooltip.hidden = false;
      const box = (ev.currentTarget ?? hit).getBoundingClientRect();
      tooltip.style.left = `${box.left + box.width / 2 + window.scrollX}px`;
      tooltip.style.top = `${box.top + window.scrollY + ((top - T) / (H - T - B)) * box.height - 8}px`;
    };
    hit.addEventListener('pointerenter', show);
    hit.addEventListener('focus', show);
    hit.addEventListener('pointerleave', () => (tooltip.hidden = true));
    hit.addEventListener('blur', () => (tooltip.hidden = true));
    svg.append(hit);
  });
  for (const i of [0, Math.floor(values.length / 2), values.length - 1]) {
    const anchor = i === 0 ? 'start' : i === values.length - 1 ? 'end' : 'middle';
    const x = i === 0 ? L : i === values.length - 1 ? W : L + i * slot + slot / 2;
    svg.append(s('text', { x, y: H - 6, class: 'tick', 'text-anchor': anchor }, dayLabel(days[i])));
  }
  box.replaceChildren(svg);
}

/** Columnas de una sola serie, 30 días. Cada columna es su propia zona de hover y foco. */
function columnChart({ id, title, values, days, note }) {
  const total = values.reduce((a, b) => a + b, 0);
  const box = h('div', { class: 'chart-box' });
  box._chart = { values, days, title };
  const table = h(
    'details',
    { class: 'chart-table' },
    h('summary', {}, 'Ver tabla'),
    h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Día'), h('th', {}, 'Valor'))), h('tbody', {}, days.map((d, i) => h('tr', {}, h('td', {}, dayLabel(d)), h('td', {}, nf.format(values[i])))))),
  );
  return h(
    'section',
    { class: 'card chart-card', id, 'aria-labelledby': `${id}-title` },
    h('h2', { id: `${id}-title` }, title),
    h('p', { class: 'chart-total' }, h('strong', {}, nf.format(total)), ' en los últimos 30 días'),
    total ? box : h('p', { class: 'muted chart-empty' }, 'Sin datos todavía.'),
    note ? h('p', { class: 'muted small' }, note) : null,
    total ? table : null,
  );
}

function kpi(label, value, sub) {
  return h('div', { class: 'kpi' }, h('p', { class: 'kpi-label' }, label), h('p', { class: 'kpi-value' }, value), sub ? h('p', { class: 'kpi-sub muted small' }, sub) : null);
}

function render(st) {
  const today = (arr) => arr[arr.length - 1];
  const sr = st.series;
  const topicsHard = st.topics.filter((t) => t.attempts >= 10).sort((a, b) => a.accuracy - b.accuracy).slice(0, 10);
  const topicsTop = st.topics.slice(0, 8);
  const answeredPct = st.totals.answered ? st.totals.correct / st.totals.answered : null;

  const topicTable = (rows, caption) =>
    rows.length
      ? h(
          'table',
          { class: 'admin-table' },
          h('caption', { class: 'sr-only' }, caption),
          h('thead', {}, h('tr', {}, h('th', {}, 'Tema'), h('th', { class: 'num' }, 'Intentos'), h('th', { class: 'num' }, 'Aciertos'), h('th', { class: 'num' }, 'Alumnos'))),
          h('tbody', {}, rows.map((t) => h('tr', {}, h('td', {}, t.topic), h('td', { class: 'num' }, nf.format(t.attempts)), h('td', { class: 'num' }, pct(t.accuracy)), h('td', { class: 'num' }, nf.format(t.students))))),
        )
      : h('p', { class: 'muted' }, 'Todavía no hay suficientes intentos (se necesitan 10 por tema).');

  const dash = $('dash');
  dash.hidden = false;
  dash.replaceChildren(
    h('div', { class: 'admin-head' }, h('h1', {}, 'Estadísticas de ElaMath'), h('p', { class: 'muted small', id: 'generated' }, `Actualizado: ${new Date(st.generatedAt).toLocaleString('es-MX')}`)),
    h(
      'section',
      { class: 'kpis', id: 'kpis', 'aria-label': 'Resumen' },
      kpi('Cuentas', nf.format(st.accounts), `${nf.format(st.withProgress)} con progreso guardado`),
      kpi('Practicaron hoy', nf.format(today(sr.active)), 'alumnos con sesión'),
      kpi('Ejercicios hoy', nf.format(today(sr.answered)), `${nf.format(st.totals.answered)} en total · ${pct(answeredPct)} aciertos`),
      kpi('Mensajes del tutor hoy', nf.format(today(sr.tutor)), 'tutor y escáner'),
      kpi('Exámenes', nf.format(st.exams.total), st.exams.total ? `promedio ${st.exams.average.toFixed(1)} · ${pct(st.exams.passRate)} aprobados` : 'sin exámenes todavía'),
    ),
    h(
      'div',
      { class: 'chart-grid' },
      columnChart({ id: 'c-active', title: 'Alumnos que practicaron por día', values: sr.active, days: st.days, note: 'Solo alumnos con sesión. Se cuenta desde que se publicó el panel.' }),
      columnChart({ id: 'c-answered', title: 'Ejercicios respondidos por día', values: sr.answered, days: st.days, note: 'Solo alumnos con sesión. Se cuenta desde que se publicó el panel.' }),
      columnChart({ id: 'c-tutor', title: 'Mensajes del tutor por día', values: sr.tutor, days: st.days, note: 'Incluye el escáner. Antes del panel solo se guardaban los últimos dos días.' }),
      columnChart({ id: 'c-new', title: 'Cuentas nuevas por día', values: sr.newAccounts, days: st.days }),
      columnChart({ id: 'c-exams', title: 'Exámenes presentados por día', values: sr.exams, days: st.days, note: 'Según la fecha de cada alumno; cada cuenta guarda sus últimos 20.' }),
    ),
    h(
      'div',
      { class: 'chart-grid' },
      h('section', { class: 'card', 'aria-labelledby': 't-hard' }, h('h2', { id: 't-hard' }, 'Temas con menos aciertos'), h('p', { class: 'muted small' }, 'Con base en los últimos 10 intentos de cada alumno por tema.'), topicTable(topicsHard, 'Temas con menos aciertos')),
      h('section', { class: 'card', 'aria-labelledby': 't-top' }, h('h2', { id: 't-top' }, 'Temas más practicados'), topicTable(topicsTop, 'Temas más practicados')),
    ),
    h(
      'div',
      { class: 'chart-grid' },
      h(
        'section',
        { class: 'card', 'aria-labelledby': 'p-title' },
        h('h2', { id: 'p-title' }, 'Cuentas por plan'),
        Object.keys(st.plans).length
          ? h('table', { class: 'admin-table' }, h('tbody', {}, Object.entries(st.plans).sort((a, b) => b[1] - a[1]).map(([p, n]) => h('tr', {}, h('td', {}, PLAN_NAMES[p] ?? p), h('td', { class: 'num' }, nf.format(n))))))
          : h('p', { class: 'muted' }, 'Sin cuentas todavía.'),
      ),
      h(
        'section',
        { class: 'card', 'aria-labelledby': 'r-title' },
        h('h2', { id: 'r-title' }, 'Reportes recientes'),
        st.reports.length
          ? h('ul', { class: 'report-list' }, st.reports.map((r) => h('li', {}, h('p', { class: 'small muted' }, `${new Date(r.ts).toLocaleString('es-MX')} · ${KIND_NAMES[r.kind] ?? r.kind}${r.templateId ? ` · ${r.templateId}` : ''}`), r.note ? h('p', { class: 'report-note' }, r.note) : null)))
          : h('p', { class: 'muted' }, 'No hay reportes.'),
      ),
    ),
    h('p', { class: 'muted small admin-foot' }, 'Datos agregados, sin correos ni nombres. Los alumnos que usan ElaMath sin cuenta no aparecen.', st.truncated ? ' Hay muchas cuentas: algunos totales se calcularon con una parte de ellas.' : ''),
  );
  drawAll();
}

const drawAll = () => document.querySelectorAll('.chart-box').forEach(drawColumns);
let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(drawAll, 150);
});

async function load(token) {
  const err = $('login-error');
  $('login-btn').disabled = true;
  err.hidden = true;
  try {
    const res = await fetch('/api/health?stats=1', { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
    const data = await res.json().catch(() => null);
    if (!res.ok || !data?.stats) throw new Error(res.ok ? 'token' : 'server');
    store.set(token);
    render(data.stats);
    $('login').hidden = true;
    $('dash').hidden = false;
    $('refresh-btn').hidden = false;
    $('logout-btn').hidden = false;
  } catch (e) {
    store.set(null);
    $('dash').hidden = true;
    $('login').hidden = false;
    err.textContent = e.message === 'token' ? 'Ese token no es válido.' : 'No se pudieron cargar las estadísticas. Revisa tu conexión e intenta de nuevo.';
    err.hidden = false;
  } finally {
    $('login-btn').disabled = false;
  }
}

document.body.append(tooltip);
$('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  load($('token-input').value.trim());
});
$('refresh-btn').addEventListener('click', () => {
  const t = store.get();
  if (t) load(t);
});
$('logout-btn').addEventListener('click', () => {
  store.set(null);
  $('token-input').value = '';
  $('dash').hidden = true;
  $('dash').replaceChildren();
  $('login').hidden = false;
  $('refresh-btn').hidden = true;
  $('logout-btn').hidden = true;
});
const saved = store.get();
if (saved) load(saved);
