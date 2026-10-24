// sw.js — service worker de ElaMath (offline-first).
//
// VERSION y PRECACHE los reescribe `npm run build` (tools/build.mjs): la versión es un hash del
// contenido, así que cualquier cambio en la app invalida la caché antigua automáticamente.
// NO edites el bloque entre los marcadores a mano.

// <build:version>
const VERSION = 'bc9090abe823';
// </build:version>

// <build:precache>
const PRECACHE = [
  "./",
  "./.env.example",
  "./icons/apple-touch-icon.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-512.png",
  "./icons/icon.svg",
  "./index.html",
  "./js/api.js",
  "./js/app.js",
  "./js/credits.js",
  "./js/curriculum.js",
  "./js/db.js",
  "./js/engine/helpers.js",
  "./js/engine/index.js",
  "./js/engine/templates-n1.js",
  "./js/engine/templates-n2.js",
  "./js/engine/templates-n3.js",
  "./js/engine/templates-n4.js",
  "./js/engine/templates-n5.js",
  "./js/engine/templates.js",
  "./js/engine/utils.js",
  "./js/exam.js",
  "./js/image.js",
  "./js/logic.js",
  "./js/main.js",
  "./js/richtext.js",
  "./manifest.json",
  "./styles.css",
  "./vendor/katex/LICENSE",
  "./vendor/katex/fonts/KaTeX_AMS-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2",
  "./vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2",
  "./vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Main-Bold.woff2",
  "./vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2",
  "./vendor/katex/fonts/KaTeX_Main-Italic.woff2",
  "./vendor/katex/fonts/KaTeX_Main-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2",
  "./vendor/katex/fonts/KaTeX_Math-Italic.woff2",
  "./vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2",
  "./vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2",
  "./vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Script-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Size1-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Size2-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Size3-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Size4-Regular.woff2",
  "./vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2",
  "./vendor/katex/katex.min.css",
  "./vendor/katex/katex.min.js"
];
// </build:precache>

const CACHE = `elamath-${VERSION}`;

self.addEventListener('install', (event) => {
  // No se llama skipWaiting aquí: la versión nueva espera a que el estudiante pulse «Actualizar»,
  // para no cambiar el código a media práctica.
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('elamath-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return; // todo lo de la app es del mismo origen
  // La API (/api/*) NUNCA se cachea ni se intercepta: cada respuesta debe venir fresca del servidor
  // (cuenta, cuota del tutor...). Sin conexión, la app lo maneja con un error claro.
  if (url.pathname.startsWith('/api/') || url.pathname === '/api') return;

  // Navegación: siempre se sirve la app desde la caché (funciona sin conexión).
  if (req.mode === 'navigate') {
    event.respondWith(caches.match('./index.html', { ignoreSearch: true }).then((hit) => hit || fetch(req)));
    return;
  }

  // Recursos: caché primero; si no está, red y se guarda para la próxima.
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
