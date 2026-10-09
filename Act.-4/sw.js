/**
 * Service Worker - Actividad 5
 * Estrategia de Caché Estática: Cache-First
 * 
 * 1. Creación de memoria caché mediante Cache API en el evento 'install'.
 * 2. Almacenamiento de recursos estáticos del App Shell (HTML, CSS, JS, imágenes).
 * 3. Intercepción del evento 'fetch' para servir primero desde caché antes de consultar a la red.
 */

const STATIC_CACHE_NAME = 'app-shell-v1';

// Recursos estáticos mínimos indispensables que conforman el App Shell
const APP_SHELL_RESOURCES = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './images/logo.svg',
  './images/hero-illustration.svg'
];

/**
 * Evento 'install':
 * Se abre la caché designada y se agregan todos los recursos del App Shell.
 */
self.addEventListener('install', (event) => {
  console.log('[Service Worker] Evento Install: Creando caché y precacheando App Shell');
  
  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log('[Service Worker] Guardando recursos del App Shell en caché:', STATIC_CACHE_NAME);
        return cache.addAll(APP_SHELL_RESOURCES);
      })
      .then(() => {
        console.log('[Service Worker] Recursos del App Shell almacenados exitosamente');
        // Forzar al Service Worker a activarse inmediatamente
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Falló el almacenamiento en caché durante install:', error);
      })
  );
});

/**
 * Evento 'activate':
 * Limpia memorias caché obsoletas y toma el control inmediato de los clientes.
 */
self.addEventListener('activate', (event) => {
  console.log('[Service Worker] Evento Activate: Verificando versiones de caché');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== STATIC_CACHE_NAME) {
            console.log('[Service Worker] Eliminando caché antigua:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('[Service Worker] Tomando control inmediato de las páginas activas');
      return self.clients.claim();
    })
  );
});

/**
 * Evento 'fetch':
 * Estrategia Cache-First (Caché primero).
 * 1. Busca el recurso en la Cache API.
 * 2. Si existe en la caché, se devuelve inmediatamente (ahorrando datos y funcionando offline).
 * 3. Si no existe en la caché, acude a la red mediante fetch().
 */
self.addEventListener('fetch', (event) => {
  // Solo interceptamos peticiones GET (evitar interceptar llamadas no cacheables)
  if (event.request.method !== 'GET') {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // [HIT EN CACHÉ] Servir primero desde la memoria caché
          console.log(`%c[Cache-First] Servido desde CACHÉ: ${event.request.url}`, 'color: #10b981; font-weight: bold;');
          return cachedResponse;
        }

        // [MISS EN CACHÉ] Consultar a la red si no se encuentra en la caché
        console.log(`%c[Cache-First] Recurso no encontrado en caché. Solicitando a RED: ${event.request.url}`, 'color: #38bdf8;');
        return fetch(event.request)
          .then((networkResponse) => {
            // Retorna la respuesta obtenida directamente desde la red
            return networkResponse;
          })
          .catch((error) => {
            console.warn('[Service Worker] Error al consultar recurso en red:', event.request.url, error);
            // Podría devolverse una página o recurso fallback offline si correspondiera
            throw error;
          });
      })
  );
});
