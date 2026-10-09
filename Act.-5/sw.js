/**
 * Service Worker - Actividad 6
 * Interceptor de Peticiones y Manejo de Estado Offline con Fallback
 * 
 * 1. Evento 'install': Precacheo del App Shell y de la plantilla personalizada 'offline.html'.
 * 2. Evento 'activate': Limpieza de versiones obsoletas y toma de control con clients.claim().
 * 3. Evento 'fetch': Intercepción de peticiones de red:
 *    - Búsqueda primero en la Cache API (Cache-First).
 *    - Si no existe en caché, consulta a la red externa mediante fetch().
 *    - Si la red falla (pérdida de conexión a Internet):
 *        * Captura del error en el bloque .catch().
 *        * Renderizado/despacho de la plantilla HTML personalizada 'offline.html' para peticiones de páginas.
 *        * Despacho de gráficos fallback o JSON según el tipo de recurso solicitado.
 */

const CACHE_NAME = 'act6-offline-fallback-v1';

// Recursos esenciales que se guardan en caché durante la instalación
const APP_SHELL_RESOURCES = [
  './',
  './index.html',
  './offline.html',
  './style.css',
  './app.js',
  './manifest.json',
  './images/logo.svg',
  './images/offline-illustration.svg',
  './images/offline-fallback.svg',
  './images/interceptor-diagram.svg'
];

/**
 * Evento 'install':
 * Abre la caché designada y almacena el App Shell junto con la plantilla de rescate 'offline.html'.
 */
self.addEventListener('install', (event) => {
  console.log('%c[Service Worker] Evento Install: Almacenando App Shell y plantilla offline.html', 'color: #38bdf8; font-weight: bold;');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log(`[Service Worker] Precargando ${APP_SHELL_RESOURCES.length} recursos en caché:`, CACHE_NAME);
        return cache.addAll(APP_SHELL_RESOURCES);
      })
      .then(() => {
        console.log('%c[Service Worker] Pre-cacheo completado exitosamente. Plantilla offline lista.', 'color: #10b981;');
        // Activación inmediata sin esperar a que se cierren las pestañas activas
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error('[Service Worker] Error al precachear recursos en install:', error);
      })
  );
});

/**
 * Evento 'activate':
 * Elimina memorias caché anteriores y toma el control inmediato de todos los clientes.
 */
self.addEventListener('activate', (event) => {
  console.log('%c[Service Worker] Evento Activate: Verificando integridad de memorias caché', 'color: #818cf8;');

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[Service Worker] Purgando caché obsoleta:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      console.log('%c[Service Worker] Control total asumido mediante clients.claim()', 'color: #10b981;');
      return self.clients.claim();
    })
  );
});

/**
 * Evento 'fetch':
 * Interceptor central de peticiones y gestor de contingencia Offline.
 */
self.addEventListener('fetch', (event) => {
  // Ignorar métodos distintos a GET (POST, PUT, DELETE, etc.)
  if (event.request.method !== 'GET') {
    return;
  }

  // Ignorar esquemas que no sean http/https (como chrome-extension://)
  if (!event.request.url.startsWith('http')) {
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then((cachedResponse) => {
        if (cachedResponse) {
          // [HIT EN CACHÉ] El recurso está disponible localmente
          console.log(`%c[SW Hit Cache] ${event.request.url}`, 'color: #10b981;');
          return cachedResponse;
        }

        // [MISS EN CACHÉ] No se encontró en caché. Se solicita a la red externa
        console.log(`%c[SW Miss Cache] Solicitando a la red: ${event.request.url}`, 'color: #38bdf8;');
        
        return fetch(event.request)
          .then((networkResponse) => {
            // Si la respuesta de red es válida, se devuelve al cliente
            if (networkResponse && networkResponse.status === 200) {
              console.log(`%c[SW Red Exitosa] Respuesta obtenida de red: ${event.request.url}`, 'color: #0ea5e9;');
            }
            return networkResponse;
          })
          .catch((networkError) => {
            /**
             * ====================================================================
             * MANEJO DE ESTADO OFFLINE Y RESPUESTA ALTERNATIVA (FALLBACK)
             * ====================================================================
             * Se detecta que no hay conexión a Internet o el servidor remoto falló,
             * y el recurso no existe en la memoria caché.
             */
            console.warn(`%c[SW Fallo de Red / Offline] ${event.request.url}`, 'color: #f43f5e; font-weight: bold;', networkError);

            const acceptHeader = event.request.headers.get('accept') || '';
            const requestMode = event.request.mode;
            const requestDestination = event.request.destination;

            // 1. FALLBACK PARA VISTAS / DOCUMENTOS HTML
            // Cuando el usuario navega a una página o solicita HTML y está sin conexión
            const isNavigationOrHtml = requestMode === 'navigate' || 
                                       acceptHeader.includes('text/html') || 
                                       event.request.url.endsWith('.html');

            if (isNavigationOrHtml) {
              console.log('%c[SW Fallback HTML] Despachando plantilla personalizada "offline.html"', 'color: #f59e0b; font-weight: bold;');
              
              // Devolver la plantilla personalizada 'offline.html' precacheada
              return caches.match('./offline.html').then((fallbackHtml) => {
                if (fallbackHtml) {
                  return fallbackHtml;
                }
                // Si la ruta relativa falla por profundidad de URL, intentar con la URL absoluta
                const fallbackUrl = new URL('./offline.html', self.location).href;
                return caches.match(fallbackUrl);
              });
            }

            // 2. FALLBACK PARA IMÁGENES
            // Si falla la descarga de una imagen externa o no cacheada
            const isImage = requestDestination === 'image' || 
                            acceptHeader.includes('image/') || 
                            /\.(png|jpg|jpeg|svg|webp|gif)$/i.test(event.request.url);

            if (isImage) {
              console.log('%c[SW Fallback Imagen] Despachando gráfico SVG de sustitución offline', 'color: #ec4899; font-weight: bold;');
              return caches.match('./images/offline-fallback.svg');
            }

            // 3. FALLBACK PARA PETICIONES DE DATOS / API JSON
            const isApiOrJson = acceptHeader.includes('application/json') || 
                                event.request.url.includes('/api/');

            if (isApiOrJson) {
              console.log('%c[SW Fallback JSON] Despachando objeto estructurado de contingencia', 'color: #8b5cf6; font-weight: bold;');
              const offlinePayload = {
                offline: true,
                status: 'network_failure',
                message: 'No hay conexión a Internet y este recurso no está en caché.',
                requestedUrl: event.request.url,
                timestamp: new Date().toISOString()
              };

              return new Response(JSON.stringify(offlinePayload), {
                status: 503,
                statusText: 'Service Unavailable (Offline Fallback)',
                headers: {
                  'Content-Type': 'application/json',
                  'X-SW-Fallback': 'true'
                }
              });
            }

            // Si no corresponde a ninguna categoría anterior, propagar el error de red
            throw networkError;
          });
      })
  );
});
