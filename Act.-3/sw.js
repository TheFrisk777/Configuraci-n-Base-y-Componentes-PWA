/**
 * ============================================================================
 * SERVICE WORKER — NOVAFLOW DATA HUB & CACHE ENGINE v3.0.0
 * ============================================================================
 * Arquitectura de Service Worker con:
 * - Ciclo de vida limpio: Instalación, Activación y Limpieza de versiones obsoletas.
 * - Estrategias de caché avanzadas:
 *   1. Cache-First (Recursos estáticos, App Shell, CSS, JS, Fuentes, Iconos)
 *   2. Network-First con Cache Fallback (Recursos dinámicos y API de proyectos)
 *   3. Stale-While-Revalidate (Feeds en vivo, métricas y datos periódicos)
 *   4. Fallback Offline para Navegación (offline.html)
 * - Control de cuota de caché mediante Dynamic Cache Trimming (LRU).
 * - Simulación de modo offline por mensajería bidireccional.
 */

const VERSION = 'v3.0.0';
const STATIC_CACHE_NAME = `novaflow-static-${VERSION}`;
const DYNAMIC_CACHE_NAME = `novaflow-dynamic-${VERSION}`;
const API_CACHE_NAME = `novaflow-api-${VERSION}`;

// Lista de cachés activas válidas para este ciclo de vida
const CURRENT_CACHES = [
  STATIC_CACHE_NAME,
  DYNAMIC_CACHE_NAME,
  API_CACHE_NAME
];

// Límite de entradas para la caché dinámica (estrategia de poda LRU)
const DYNAMIC_CACHE_LIMIT = 40;

// Recursos estáticos nucleares que componen el App Shell y soporte offline
const STATIC_APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './app.js',
  './idb.js',
  './manifest.json',
  './offline.html',
  './icons/icon-192x192.png',
  './icons/icon-512x512.png'
];

// Estado de simulación offline bajo demanda para pruebas
let isSimulatingOffline = false;

// ============================================================================
// 1. INSTALACIÓN LIMPIA DEL SERVICE WORKER
// ============================================================================
self.addEventListener('install', (event) => {
  console.log(`[SW ${VERSION}] Fase de Instalación iniciada. Precacheando App Shell...`);

  event.waitUntil(
    caches.open(STATIC_CACHE_NAME)
      .then((cache) => {
        console.log(`[SW ${VERSION}] Guardando recursos nucleares en ${STATIC_CACHE_NAME}`);
        return cache.addAll(STATIC_APP_SHELL);
      })
      .then(() => {
        console.log(`[SW ${VERSION}] App Shell instalado con éxito.`);
        // Notificar a las pestañas activas
        return self.skipWaiting();
      })
      .catch((err) => {
        console.error(`[SW ${VERSION}] Error durante la instalación:`, err);
      })
  );
});

// ============================================================================
// 2. ACTIVACIÓN LIMPIA Y DEPURACIÓN DE CACHÉS OBSOLETAS
// ============================================================================
self.addEventListener('activate', (event) => {
  console.log(`[SW ${VERSION}] Fase de Activación iniciada. Limpiando cachés anteriores...`);

  event.waitUntil(
    caches.keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            // Si el nombre de la caché no pertenece a las de la versión actual, purgar
            if (!CURRENT_CACHES.includes(cacheName)) {
              console.log(`[SW ${VERSION}] Eliminando caché obsoleta: ${cacheName}`);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log(`[SW ${VERSION}] Cachés limpiadas. Tomando control de clientes (claim)...`);
        return self.clients.claim();
      })
      .then(() => {
        return broadcastToClients({
          type: 'SW_ACTIVATED',
          version: VERSION,
          timestamp: new Date().toISOString()
        });
      })
  );
});

// ============================================================================
// 3. ESTRATEGIAS DE CACHÉ EN EL EVENTO FETCH
// ============================================================================
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Ignorar métodos no GET o esquemas ajenos (chrome-extension, etc.)
  if (request.method !== 'GET' || !url.protocol.startsWith('http')) {
    return;
  }

  // Si está activada la simulación offline interna, interceptar
  if (isSimulatingOffline && !url.pathname.includes('sw.js')) {
    event.respondWith(handleSimulatedOffline(request));
    return;
  }

  // --- ESTRATEGIA A: Navegación de páginas (HTML) ---
  if (request.mode === 'navigate') {
    event.respondWith(handleNavigationRequest(request));
    return;
  }

  // --- ESTRATEGIA B: API de Proyectos y Datos Críticos (/api/projects, /api/status) -> Network First ---
  if (url.pathname.startsWith('/api/projects') || url.pathname.startsWith('/api/status')) {
    event.respondWith(handleNetworkFirstWithCacheFallback(request, API_CACHE_NAME));
    return;
  }

  // --- ESTRATEGIA C: API de Feed Dinámico (/api/feed) -> Stale-While-Revalidate ---
  if (url.pathname.startsWith('/api/feed')) {
    event.respondWith(handleStaleWhileRevalidate(request, API_CACHE_NAME));
    return;
  }

  // --- ESTRATEGIA D: Recursos Estáticos (CSS, JS, Imágenes, Fuentes, JSON) -> Cache First ---
  event.respondWith(handleCacheFirst(request, DYNAMIC_CACHE_NAME));
});

// ============================================================================
// IMPLEMENTACIÓN DETALLADA DE ESTRATEGIAS
// ============================================================================

/**
 * Estrategia 1: Cache-First con Network Fallback y Cache Dinámica
 * Óptimo para App Shell, estilos, scripts e imágenes.
 */
async function handleCacheFirst(request, dynamicCacheName) {
  // 1. Buscar coincidencia en cualquiera de las cachés abiertas
  const cachedResponse = await caches.match(request);
  if (cachedResponse) {
    return cachedResponse;
  }

  // 2. Si no está en caché, solicitar a la red
  try {
    const networkResponse = await fetch(request);

    // Solo almacenar en caché respuestas válidas
    if (networkResponse && networkResponse.status === 200) {
      const responseClone = networkResponse.clone();
      caches.open(dynamicCacheName).then((cache) => {
        cache.put(request, responseClone);
        trimCache(dynamicCacheName, DYNAMIC_CACHE_LIMIT);
      });
    }

    return networkResponse;
  } catch (error) {
    console.warn(`[SW Fetch] Fallo al recuperar recurso estático: ${request.url}`);
    // Si falla un recurso de imagen estático, podríamos devolver un placeholder SVG si se requiere
    return new Response('Recurso no disponible sin conexión', {
      status: 503,
      statusText: 'Service Unavailable (Offline)'
    });
  }
}

/**
 * Estrategia 2: Network-First con Fallback a Caché
 * Óptimo para API de proyectos y datos que requieren frescura.
 */
async function handleNetworkFirstWithCacheFallback(request, cacheName) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse && networkResponse.status === 200) {
      const responseClone = networkResponse.clone();
      caches.open(cacheName).then((cache) => {
        cache.put(request, responseClone);
      });
    }

    return networkResponse;
  } catch (error) {
    console.warn(`[SW Fetch Network-First] Red inalcanzable para ${request.url}. Consultando caché...`);
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      // Agregar cabecera informativa de que la respuesta proviene de caché offline
      const modifiedHeaders = new Headers(cachedResponse.headers);
      modifiedHeaders.set('X-NovaFlow-Served-From', 'offline-cache');
      return new Response(cachedResponse.body, {
        status: cachedResponse.status,
        statusText: cachedResponse.statusText,
        headers: modifiedHeaders
      });
    }

    // Fallback JSON si ni la red ni la caché disponen de los datos
    return new Response(JSON.stringify({
      offline: true,
      error: 'Conexión de red no disponible y sin caché previa para esta consulta.',
      source: 'service_worker_offline_fallback'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Estrategia 3: Stale-While-Revalidate
 * Devuelve instantáneamente la respuesta de caché y consulta a la red en segundo plano para actualizarla.
 */
async function handleStaleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cachedResponse = await cache.match(request);

  // Consulta en segundo plano (revalidación)
  const fetchPromise = fetch(request).then((networkResponse) => {
    if (networkResponse && networkResponse.status === 200) {
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  }).catch((err) => {
    console.warn(`[SW SWR] Fallo al revalidar en segundo plano: ${request.url}`);
    return null;
  });

  // Si existe en caché, retornarlo inmediatamente mientras la promesa de red continúa
  if (cachedResponse) {
    return cachedResponse;
  }

  // Si no está en caché, esperar la respuesta de la red
  const freshResponse = await fetchPromise;
  if (freshResponse) return freshResponse;

  return new Response(JSON.stringify({
    offline: true,
    message: 'Datos no disponibles en modo offline.'
  }), {
    status: 503,
    headers: { 'Content-Type': 'application/json' }
  });
}

/**
 * Manejador de Navegación HTML:
 * Intenta servir desde la red o caché el App Shell; si falla, entrega offline.html.
 */
async function handleNavigationRequest(request) {
  try {
    // Intentar primero red para obtener versiones recientes
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch (error) {
    console.warn(`[SW Navigate] Fallo de red para navegación: ${request.url}. Buscando App Shell o fallback...`);
    
    // Buscar index.html en caché
    const cachedShell = await caches.match('./index.html') || await caches.match('./');
    if (cachedShell) {
      return cachedShell;
    }

    // Fallback a offline.html
    const fallbackOffline = await caches.match('./offline.html');
    if (fallbackOffline) {
      return fallbackOffline;
    }

    return new Response('<h1>NovaFlow Offline</h1><p>No se pudo conectar a la red.</p>', {
      headers: { 'Content-Type': 'text/html; charset=utf-8' }
    });
  }
}

/**
 * Manejador de simulación offline para pruebas en la interfaz
 */
async function handleSimulatedOffline(request) {
  console.log(`[SW Simulación Offline] Interceptando petición a: ${request.url}`);
  const cached = await caches.match(request);
  if (cached) {
    return cached;
  }

  if (request.mode === 'navigate') {
    const offlinePage = await caches.match('./offline.html') || await caches.match('./index.html');
    if (offlinePage) return offlinePage;
  }

  return new Response('Error simulado: Dispositivo sin conexión', {
    status: 503,
    statusText: 'Simulated Offline Mode'
  });
}

// ============================================================================
// UTILIDADES: TRIMMING DE CACHÉ Y COMUNICACIÓN
// ============================================================================

/**
 * Limita el número de elementos en una caché para evitar saturación de almacenamiento (LRU)
 */
async function trimCache(cacheName, maxItems) {
  try {
    const cache = await caches.open(cacheName);
    const keys = await cache.keys();
    if (keys.length > maxItems) {
      // Elimina las entradas más antiguas
      await cache.delete(keys[0]);
      trimCache(cacheName, maxItems);
    }
  } catch (e) {
    console.warn('[SW Trim] Error al podar caché:', e);
  }
}

/**
 * Envía un mensaje broadcast a todos los clientes / pestañas controladas
 */
async function broadcastToClients(message) {
  const clients = await self.clients.matchAll({ includeUncontrolled: true, type: 'window' });
  for (const client of clients) {
    client.postMessage(message);
  }
}

// ============================================================================
// 4. CONTROLADOR DE MENSAJES RECIBIDOS DESDE EL CLIENTE
// ============================================================================
self.addEventListener('message', async (event) => {
  const data = event.data;
  if (!data) return;

  console.log(`[SW Mensaje Recibido] Acción:`, data.type);

  if (data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  } else if (data.type === 'SIMULATE_OFFLINE') {
    isSimulatingOffline = !!data.enabled;
    console.log(`[SW] Simulación de modo offline establecida en:`, isSimulatingOffline);
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true, isSimulatingOffline });
    }
  } else if (data.type === 'CLEAR_CACHES') {
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    console.log('[SW] Todas las cachés fueron purgadas.');
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ success: true, cleared: keys });
    }
  } else if (data.type === 'GET_DIAGNOSTICS') {
    const keys = await caches.keys();
    const details = [];
    for (const key of keys) {
      const c = await caches.open(key);
      const reqs = await c.keys();
      details.push({ name: key, count: reqs.length });
    }

    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({
        version: VERSION,
        activeCaches: details,
        isSimulatingOffline
      });
    }
  }
});
