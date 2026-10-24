// tools/e2e.mjs — prueba de extremo a extremo en un Chromium REAL (CSP, service worker, offline, cuenta, tutor).
// Uso: npm run e2e   (usa el Chromium de PLAYWRIGHT_BROWSERS_PATH o el instalado por Playwright)

import { chromium } from 'playwright-core';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { startDevServer } from './dev-server.mjs';

function findChromium() {
  if (process.env.CHROMIUM_PATH) return process.env.CHROMIUM_PATH;
  const base = process.env.PLAYWRIGHT_BROWSERS_PATH || '/opt/pw-browsers';
  for (const c of ['chromium/chrome-linux/chrome', ...(existsSync(base) ? readdirSync(base).filter((d) => d.startsWith('chromium')).flatMap((d) => [`${d}/chrome-linux/chrome`, `${d}/chrome-linux/headless_shell`]) : [])]) {
    if (existsSync(join(base, c))) return join(base, c);
  }
  return undefined; // Playwright usará su propio navegador
}

let failed = 0;
const step = async (name, fn) => {
  try {
    await fn();
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failed++;
    console.log(`  ✗ ${name}\n      ${String(e.message).split("\n").slice(0, 4).join(" | ")}`);
  }
};
const ok = (cond, msg) => { if (!cond) throw new Error(msg); };

const srv = await startDevServer({ port: 0, quiet: true, env: { ...process.env, BILLING_ENABLED: '1' } }); // recorrido con cobro encendido
const browser = await chromium.launch({ executablePath: findChromium(), args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 420, height: 900 } });
const page = await ctx.newPage();
const problems = [];
let offline = false;
page.on('console', (m) => { if (offline && /ERR_INTERNET_DISCONNECTED/.test(m.text())) return; if (m.type() === 'error' || /Content Security Policy|Refused to/i.test(m.text())) problems.push(m.text()); });
page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));

console.log(`E2E contra ${srv.url}`);
try {
  await step('carga la app sin violaciones de CSP ni errores de consola', async () => {
    await page.goto(srv.url);
    await page.waitForSelector('#account-chip');
    ok(problems.length === 0, `consola: ${problems.join(' | ')}`);
  });

  await step('el service worker se registra y precachea', async () => {
    await page.waitForFunction(async () => (await navigator.serviceWorker.getRegistration())?.active?.state === 'activated', null, { timeout: 15000 });
    await page.waitForFunction(async () => (await caches.keys()).length >= 1, null, { timeout: 15000 });
  });

  await step('practica: KaTeX renderiza el enunciado y las opciones', async () => {
    await page.click('button[aria-label^="Practicar"]');
    await page.waitForSelector('.question .katex');
    ok((await page.locator('.option .katex').count()) === 4, 'faltan opciones renderizadas');
  });

  await step('responder da retroalimentación', async () => {
    await page.click('.option >> nth=0');
    await page.waitForSelector('#feedback');
  });

  await step('reportar error llega al servidor', async () => {
    await page.click('#report-btn');
    await page.fill('#report-note', 'prueba e2e');
    await page.click('#send-report');
    await page.waitForSelector('#report-code');
    const r = await (await fetch(`${srv.url}/api/admin/reports`, { headers: { Authorization: `Bearer ${srv.adminToken}` } })).json();
    ok(r.reports?.length === 1, 'el reporte no se guardó');
    await page.click('#close-report');
  });

  const admin = (path, body) => fetch(`${srv.url}/api/admin/${path}`, { method: 'POST', headers: { Authorization: `Bearer ${srv.adminToken}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  // PNG de 1×1 válido: el navegador real lo decodifica y lo reduce con canvas.
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');

  await step('login por enlace de desarrollo (sin contraseña) → empieza la prueba gratis de 30 días', async () => {
    await page.click('#account-chip');
    await page.fill('#email-input', 'ana@correo.com');
    await page.click('#send-link');
    await page.waitForSelector('#dev-link');
    await page.click('#dev-link');
    await page.waitForSelector('#account-chip:has-text("Prueba · 30 d")');
    ok(!page.url().includes('login='), 'el token sigue en la URL');
  });

  await step('en la prueba el tutor responde con fórmulas y descuenta la cuota', async () => {
    await page.click('button[aria-label^="Practicar"]');
    await page.click('#tutor-btn');
    await page.click('[data-mode="hint"]');
    await page.waitForSelector('.bubble.bot:not(.typing) .katex');
    ok(await page.locator('.bubble.bot strong').count() > 0, 'sin negritas');
    ok(/39 de 40/.test(await page.textContent('#tutor-quota')), 'cuota no descontada');
    await page.click('#tutor-close');
  });

  await step('escáner: una foto real se reduce en el navegador (canvas) y el servidor responde', async () => {
    await page.click('#scan-btn');
    await page.setInputFiles('#scan-file', { name: 'apunte.png', mimeType: 'image/png', buffer: PNG });
    await page.waitForSelector('#scan-preview');
    ok((await page.getAttribute('#scan-preview', 'src')).startsWith('data:image/jpeg;base64,'), 'no se convirtió a JPEG');
    await page.click('#scan-send');
    await page.waitForSelector('#scan-reply .katex');
    ok(/38 de 40/.test(await page.textContent('#scan-quota')), 'la foto no descontó 1 mensaje');
    await page.click('#scan-close');
  });

  await step('examen simulado: 10 preguntas sin retroalimentación y resultado', async () => {
    await page.click('text=← Materias');
    await page.click('[data-exam] >> nth=0');
    await page.waitForSelector('#exam-clock');
    ok(/^\d\d:\d\d$/.test((await page.textContent('#exam-clock')).trim()), 'reloj mal formado');
    for (let i = 1; i <= 10; i++) {
      await page.waitForFunction((n) => document.querySelector('#exam-progress')?.textContent.includes(`Pregunta ${n} de 10`), i);
      ok((await page.locator('#feedback').count()) === 0, 'hubo retroalimentación durante el examen');
      await page.click('.option >> nth=0');
    }
    await page.waitForSelector('#exam-score');
    ok(/^\d+\.\d \/ 10$/.test((await page.textContent('#exam-score')).trim()), 'calificación mal formada');
    ok((await page.locator('details.review').count()) === 10, 'falta la revisión');
    if (await page.locator('#close-levelup').count()) await page.click('#close-levelup'); // el examen puede subir de nivel
    await page.click('#exam-home');
    await page.waitForSelector('#last-exam');
  });

  await step('al terminar la prueba: el tutor pide Pro; un código de promoción lo activa', async () => {
    ok((await admin('plan', { email: 'ana@correo.com', plan: 'free' })).ok, 'admin/plan falló');
    ok((await admin('promo', { code: 'E2E-PROMO', days: 30, maxUses: 5 })).ok, 'admin/promo falló');
    await page.reload();
    await page.waitForSelector('#account-chip:has-text("Cuenta")');
    await page.click('button[aria-label^="Practicar"]');
    await page.click('#tutor-btn');
    await page.waitForSelector('#tutor-upgrade');
    await page.click('#tutor-upgrade');
    ok(/prueba gratis terminó/.test(await page.textContent('#trial-status')), 'no explica que terminó la prueba');
    ok(/\$50 MXN \/ mes/.test(await page.textContent('#pro-dialog')), 'precio incorrecto');
    await page.fill('#promo-input', 'e2e-promo');
    await page.click('#promo-send');
    await page.waitForSelector('#promo-status:has-text("Sumaste 30 días")');
    await page.waitForSelector('#account-chip:has-text("Pro")');
    await page.click('#close-pro'); // sigue en la práctica
    await page.click('#tutor-btn');
    await page.waitForSelector('#tutor-input');
  });

  await step('sin conexión la app sigue funcionando (service worker)', async () => {
    offline = true;
    await ctx.setOffline(true);
    await page.reload();
    await page.waitForSelector('button[aria-label^="Practicar"]');
    await page.click('button[aria-label^="Practicar"]');
    await page.waitForSelector('.question .katex');
    await ctx.setOffline(false);
    offline = false;
  });

  await step('ninguna violación de CSP durante todo el recorrido', async () => {
    ok(problems.length === 0, `consola: ${problems.slice(0, 3).join(' | ')}`);
  });

  // ── Etapa de pruebas (valor por defecto): sin cobro, todo abierto con cuenta ──
  console.log('E2E con el cobro apagado (como se publica hoy)');
  const open = await startDevServer({ port: 0, quiet: true, env: { ...process.env, BILLING_ENABLED: '' } });
  const p2 = await (await browser.newContext({ viewport: { width: 420, height: 900 } })).newPage();
  p2.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  try {
    await step('sin cobro: entra y ve "Cuenta", sin prueba ni precios', async () => {
      await p2.goto(open.url);
      await p2.click('#account-chip');
      await p2.fill('#email-input', 'luis@correo.com');
      await p2.click('#send-link');
      await p2.waitForSelector('#dev-link');
      await p2.click('#dev-link');
      await p2.waitForSelector('#account-chip:has-text("Cuenta")');
      await p2.click('#credits-chip');
      const t = await p2.textContent('#pro-dialog');
      ok(/etapa de pruebas/.test(t) && !/\$|MXN/.test(t), 'el modal habla de precios');
      await p2.click('#close-pro');
    });
    await step('sin cobro: Peer Tutor, revisión de procedimiento y reporte funcionan', async () => {
      await p2.click('button[aria-label^="Practicar"]');
      await p2.click('#tutor-btn');
      await p2.click('[data-mode="hint"]');
      await p2.waitForSelector('.bubble.bot:not(.typing) .katex');
      await p2.click('#tutor-close');
      await p2.click('#scan-btn');
      await p2.setInputFiles('#scan-file', { name: 'a.png', mimeType: 'image/png', buffer: PNG });
      await p2.waitForSelector('#scan-preview');
      await p2.click('#scan-send');
      await p2.waitForSelector('#scan-reply .katex');
      await p2.click('#scan-close');
      await p2.click('#report-btn');
      await p2.fill('#report-note', 'prueba sin cobro');
      await p2.click('#send-report');
      await p2.waitForSelector('#report-code');
    });
  } finally {
    await open.close();
  }
} finally {
  await browser.close();
  await srv.close();
}
console.log(failed ? `\n${failed} paso(s) fallaron` : '\nE2E completo: todo bien');
process.exit(failed ? 1 : 0);
