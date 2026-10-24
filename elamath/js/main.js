// main.js — arranque en el navegador: app, service worker, estado offline e instalación.

import { startApp } from './app.js';

const $ = (id) => document.getElementById(id);

startApp($('app'));

// ── Estado de conexión ──────────────────────────────────────────
const badge = $('offline-badge');
const syncOnline = () => {
  if (badge) badge.hidden = navigator.onLine;
};
window.addEventListener('online', syncOnline);
window.addEventListener('offline', syncOnline);
syncOnline();

// ── Instalación (Android/Chrome) y pista para iOS ───────────────
let deferredPrompt = null;
const installBtn = $('install-btn');
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  if (installBtn) installBtn.hidden = false;
});
installBtn?.addEventListener('click', async () => {
  if (!deferredPrompt) return;
  deferredPrompt.prompt();
  await deferredPrompt.userChoice;
  deferredPrompt = null;
  installBtn.hidden = true;
});
window.addEventListener('appinstalled', () => {
  if (installBtn) installBtn.hidden = true;
});

const isIos = /iphone|ipad|ipod/i.test(navigator.userAgent);
const standalone = window.matchMedia?.('(display-mode: standalone)').matches || navigator.standalone;
if (isIos && !standalone && $('ios-hint')) $('ios-hint').hidden = false;

// ── Service worker + aviso de nueva versión ─────────────────────
function showUpdateToast(worker) {
  const toast = $('toast');
  if (!toast) return;
  toast.replaceChildren();
  const msg = document.createElement('span');
  msg.textContent = 'Hay una versión nueva de ElaMath. ';
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'btn btn-primary';
  btn.textContent = 'Actualizar';
  btn.addEventListener('click', () => worker.postMessage({ type: 'SKIP_WAITING' }));
  toast.append(msg, btn);
  toast.hidden = false;
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      // Si no había service worker al abrir, es la primera instalación: tomar el control NO debe recargar la página.
      const hadController = Boolean(navigator.serviceWorker.controller);
      const reg = await navigator.serviceWorker.register('./sw.js');
      if (reg.waiting && navigator.serviceWorker.controller) showUpdateToast(reg.waiting);
      reg.addEventListener('updatefound', () => {
        const w = reg.installing;
        w?.addEventListener('statechange', () => {
          if (w.state === 'installed' && navigator.serviceWorker.controller) showUpdateToast(w);
        });
      });
      let reloading = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (reloading || !hadController) return;
        reloading = true;
        location.reload();
      });
    } catch (err) {
      console.warn('No se pudo registrar el service worker:', err);
    }
  });
}
