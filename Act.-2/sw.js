/**
 * ============================================================================
 * SERVICE WORKER — CACHEO DEL APP SHELL & OFFLINE RESILIENCE
 * ============================================================================
 * El App Shell comprende el HTML mínimo, CSS base, JavaScript central y assets
 * que estructuran la interfaz (Header, Navegación, Layout). Al almacenarse en
 * caché, la aplicación se abre de forma instantánea y muestra la Splash Screen
 * nativa mientras el shell se recupera del caché local.
 */

const CACHE_NAME = 'novaflow-appshell-v2';

// Recursos críticos que componen el App Shell
const APP_SHELL_ASSETS = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './manifest.json',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// 1. INSTALACIÓN: Almacenar en caché el App Shell estático
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Instalando y precacheando App Shell...');
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] App Shell precacheado exitosamente.');
        return cache.addAll(APP_SHELL_ASSETS);
      })
      .then(() => self.skipWaiting())
  );
});

// 2. ACTIVACIÓN: Limpiar versiones antiguas del App Shell y tomar control
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Activando nueva versión del App Shell...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('[Service Worker] Eliminando caché obsoleta:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Clientes reclamados. App Shell listo.');
      return self.clients.claim();
    })
  );
});

// 3. ESTRATEGIA FETCH: Cache First para App Shell con Network Fallback
self.addEventListener('fetch', (event) => {
  // Ignorar peticiones que no sean GET o esquemas no soportados (chrome-extension, etc)
  if (event.request.method !== 'GET' || !event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Recurso del App Shell servido inmediatamente desde caché (0ms de latencia de red)
        return cachedResponse;
      }

      // Si no está en el App Shell precacheado, buscar en la red
      return fetch(event.request).then((networkResponse) => {
        // Opcional: Clonar y cachear recursos dinámicos
        return networkResponse;
      }).catch((error) => {
        console.warn('[Service Worker] Fallo de red para:', event.request.url, error);
        
        // Si el usuario navega a otra ruta mientras está offline, servir el index.html del App Shell
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
