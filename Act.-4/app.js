/**
 * Aplicación Principal - Actividad 5
 * Registro del Service Worker e interacción con la Cache API
 */

const STATIC_CACHE_NAME = 'app-shell-v1';

const APP_SHELL_FILES = [
  { url: './index.html', label: 'index.html', type: 'HTML Document' },
  { url: './style.css', label: 'style.css', type: 'Stylesheet (CSS)' },
  { url: './app.js', label: 'app.js', type: 'JavaScript (Logic)' },
  { url: './images/logo.svg', label: 'images/logo.svg', type: 'SVG Image' },
  { url: './images/hero-illustration.svg', label: 'images/hero-illustration.svg', type: 'SVG Image' },
  { url: './manifest.json', label: 'manifest.json', type: 'Web App Manifest' }
];

// Elementos DOM
const networkStatusEl = document.getElementById('network-status');
const swStatusEl = document.getElementById('sw-status');
const cacheTableBodyEl = document.getElementById('cache-table-body');
const diagnosticLogEl = document.getElementById('diagnostic-log');
const btnRefreshCacheEl = document.getElementById('btn-refresh-cache');
const btnClearLogEl = document.getElementById('btn-clear-log');
const btnTestStyleEl = document.getElementById('btn-test-style');
const btnTestLogoEl = document.getElementById('btn-test-logo');
const cachedCountBadgeEl = document.getElementById('cached-count-badge');

/**
 * 1. Inicialización y Registro del Service Worker
 */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    updateSwStatus('No compatible', 'badge-offline');
    appendLog('El navegador no soporta Service Workers.', 'log-warn');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
    
    if (registration.installing) {
      updateSwStatus('SW: Instalando...', 'badge-pending');
      appendLog('[Registro] Service Worker en proceso de instalación...', 'log-info');
    } else if (registration.waiting) {
      updateSwStatus('SW: En espera', 'badge-pending');
      appendLog('[Registro] Service Worker instalado y en espera.', 'log-info');
    } else if (registration.active) {
      updateSwStatus('SW: Activo & Cache-First', 'badge-active');
      appendLog('[Registro] Service Worker Activo. Intercepción Cache-First lista.', 'log-success');
    }

    // Escuchar cambios de estado del Service Worker
    registration.onupdatefound = () => {
      const installingWorker = registration.installing;
      installingWorker.onstatechange = () => {
        if (installingWorker.state === 'installed') {
          if (navigator.serviceWorker.controller) {
            updateSwStatus('SW: Actualizado', 'badge-active');
            appendLog('[SW] Nueva versión de caché disponible.', 'log-info');
          } else {
            updateSwStatus('SW: Activo & Cache-First', 'badge-active');
            appendLog('[SW] App Shell precacheado con éxito.', 'log-success');
          }
          inspectCacheStorage();
        }
      };
    };

    // Verificar el estado de la caché una vez activado
    navigator.serviceWorker.ready.then(() => {
      updateSwStatus('SW: Activo & Cache-First', 'badge-active');
      inspectCacheStorage();
    });

  } catch (error) {
    console.error('Error al registrar Service Worker:', error);
    updateSwStatus('SW: Error', 'badge-offline');
    appendLog(`[Error] Falló registro del Service Worker: ${error.message}`, 'log-warn');
  }
}

/**
 * 2. Monitoreo del Estado de Red (Online / Offline)
 */
function setupNetworkMonitoring() {
  function updateNetworkBadge() {
    if (navigator.onLine) {
      networkStatusEl.className = 'badge badge-online';
      networkStatusEl.innerHTML = '<span class="badge-dot"></span><span class="badge-text">En Línea</span>';
      appendLog('[Red] Conexión a Internet detectada (Online).', 'log-info');
    } else {
      networkStatusEl.className = 'badge badge-offline';
      networkStatusEl.innerHTML = '<span class="badge-dot"></span><span class="badge-text">Sin Conexión (Offline)</span>';
      appendLog('[Red] Modo Sin Conexión activo. El App Shell responderá desde Caché.', 'log-warn');
    }
  }

  window.addEventListener('online', updateNetworkBadge);
  window.addEventListener('offline', updateNetworkBadge);
  updateNetworkBadge();
}

/**
 * 3. Inspección en vivo de la Cache API
 */
async function inspectCacheStorage() {
  if (!('caches' in window)) {
    cacheTableBodyEl.innerHTML = `<tr><td colspan="4" class="text-center py-4">Cache API no disponible en este navegador.</td></tr>`;
    return;
  }

  try {
    const hasCache = await caches.has(STATIC_CACHE_NAME);
    if (!hasCache) {
      cacheTableBodyEl.innerHTML = `<tr><td colspan="4" class="text-center py-4">Esperando evento <code>install</code> del Service Worker para crear <strong>${STATIC_CACHE_NAME}</strong>...</td></tr>`;
      return;
    }

    const cache = await caches.open(STATIC_CACHE_NAME);
    const cachedRequests = await cache.keys();
    
    // Normalizar URLs almacenadas para comparación
    const cachedUrls = cachedRequests.map(req => new URL(req.url).pathname);
    
    let cachedCount = 0;
    cacheTableBodyEl.innerHTML = '';

    for (const item of APP_SHELL_FILES) {
      const fullUrl = new URL(item.url, window.location.href).pathname;
      const isCached = cachedUrls.some(u => u === fullUrl || u.endsWith(item.url.replace('./', '')));

      if (isCached) cachedCount++;

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="resource-cell">${item.label}</td>
        <td><span class="type-pill">${item.type}</span></td>
        <td>
          ${isCached 
            ? '<span class="status-cached">● Almacenado en Caché</span>' 
            : '<span class="status-uncached">○ Pendiente / No en caché</span>'
          }
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="testFetch('${item.url}')">
            Probar Fetch
          </button>
        </td>
      `;
      cacheTableBodyEl.appendChild(tr);
    }

    if (cachedCountBadgeEl) {
      cachedCountBadgeEl.textContent = cachedCount;
    }

  } catch (error) {
    console.error('Error al inspeccionar la Cache API:', error);
  }
}

/**
 * 4. Prueba Interactiva de Solicitud con Estrategia Cache-First
 */
window.testFetch = async function(resourcePath) {
  const startTime = performance.now();
  appendLog(`[Fetch] Solicitando "${resourcePath}"...`, 'log-info');

  try {
    // Se ejecuta la petición fetch. El Service Worker la interceptará con caches.match()
    const response = await fetch(resourcePath);
    const duration = (performance.now() - startTime).toFixed(1);

    if (response.ok) {
      // Si la respuesta proviene de la caché, usualmente el tiempo es sumamente bajo (<15ms)
      appendLog(`[Fetch Exitoso] "${resourcePath}" obtenido en ${duration}ms (Status: ${response.status} OK)`, 'log-success');
    } else {
      appendLog(`[Fetch] Respuesta con estado ${response.status} para "${resourcePath}"`, 'log-warn');
    }
  } catch (error) {
    appendLog(`[Fetch Error] No se pudo obtener "${resourcePath}": ${error.message}`, 'log-warn');
  }
};

/**
 * Helpers UI
 */
function updateSwStatus(text, badgeClass) {
  if (!swStatusEl) return;
  swStatusEl.className = `badge ${badgeClass}`;
  swStatusEl.innerHTML = `<span class="badge-dot"></span><span class="badge-text">${text}</span>`;
}

function appendLog(message, className = 'log-info') {
  if (!diagnosticLogEl) return;
  const time = new Date().toLocaleTimeString();
  const entry = document.createElement('div');
  entry.className = `log-entry ${className}`;
  entry.textContent = `[${time}] ${message}`;
  diagnosticLogEl.appendChild(entry);
  diagnosticLogEl.scrollTop = diagnosticLogEl.scrollHeight;
}

// Event Listeners
if (btnRefreshCacheEl) {
  btnRefreshCacheEl.addEventListener('click', () => {
    appendLog('[Usuario] Actualizando lista de Cache API...', 'log-info');
    inspectCacheStorage();
  });
}

if (btnClearLogEl) {
  btnClearLogEl.addEventListener('click', () => {
    diagnosticLogEl.innerHTML = '';
  });
}

if (btnTestStyleEl) {
  btnTestStyleEl.addEventListener('click', () => window.testFetch('./style.css'));
}

if (btnTestLogoEl) {
  btnTestLogoEl.addEventListener('click', () => window.testFetch('./images/logo.svg'));
}

// Inicialización
window.addEventListener('DOMContentLoaded', () => {
  setupNetworkMonitoring();
  registerServiceWorker();
});
