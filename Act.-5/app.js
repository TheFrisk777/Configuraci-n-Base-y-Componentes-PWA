/**
 * Aplicación Principal - Actividad 6
 * Interceptor de Peticiones y Manejo de Estado Offline con Fallback
 * 
 * Funcionalidades:
 * 1. Registro y control del Service Worker.
 * 2. Monitoreo reactivo de la conectividad (Online / Offline).
 * 3. Inspección en tiempo real de la Cache API (incluyendo offline.html).
 * 4. Banco de pruebas interactivo:
 *    - Fallback HTML (plantilla personalizada de rescate)
 *    - Fallback de Imagen (gráfico SVG de contingencia)
 *    - Fallback de API (JSON estructurado offline)
 * 5. Consola diagnóstica con trazabilidad de peticiones interceptadas.
 */

const CACHE_NAME = 'act6-offline-fallback-v1';

// Recursos de control inspeccionados
const AUDIT_RESOURCES = [
  { url: './index.html', label: 'index.html', type: 'App Shell HTML', isFallback: false },
  { url: './offline.html', label: 'offline.html', type: 'Plantilla Fallback HTML', isFallback: true },
  { url: './style.css', label: 'style.css', type: 'Estilos CSS', isFallback: false },
  { url: './app.js', label: 'app.js', type: 'Lógica JS', isFallback: false },
  { url: './images/logo.svg', label: 'images/logo.svg', type: 'Logo Principal SVG', isFallback: false },
  { url: './images/offline-illustration.svg', label: 'images/offline-illustration.svg', type: 'Ilustración Offline', isFallback: true },
  { url: './images/offline-fallback.svg', label: 'images/offline-fallback.svg', type: 'Fallback Imagen SVG', isFallback: true },
  { url: './images/interceptor-diagram.svg', label: 'images/interceptor-diagram.svg', type: 'Diagrama Arquitectura', isFallback: false },
  { url: './manifest.json', label: 'manifest.json', type: 'Web App Manifest', isFallback: false }
];

// Elementos del DOM
const networkStatusEl = document.getElementById('network-status');
const swStatusEl = document.getElementById('sw-status');
const cacheTableBodyEl = document.getElementById('cache-table-body');
const diagnosticLogEl = document.getElementById('diagnostic-log');
const cachedCountBadgeEl = document.getElementById('cached-count-badge');
const fallbackCountBadgeEl = document.getElementById('fallback-count-badge');

// Elementos del Banco de Pruebas
const btnTestHtmlEl = document.getElementById('btn-test-html');
const btnOpenUncachedEl = document.getElementById('btn-open-uncached');
const btnTestImageEl = document.getElementById('btn-test-image');
const btnTestApiEl = document.getElementById('btn-test-api');
const btnPreviewOfflineModalEl = document.getElementById('btn-preview-offline-modal');
const btnClearLogEl = document.getElementById('btn-clear-log');
const btnRefreshCacheEl = document.getElementById('btn-refresh-cache');

// Modal Elements
const modalBackdropEl = document.getElementById('modal-backdrop');
const modalCloseBtnEl = document.getElementById('modal-close-btn');
const modalIframeEl = document.getElementById('modal-iframe');

// Resultados visuales
const imageDemoBoxEl = document.getElementById('image-demo-box');
const apiDemoBoxEl = document.getElementById('api-demo-box');

/**
 * 1. Inicialización y Registro del Service Worker
 */
async function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    updateSwBadge('No soportado', 'badge-offline');
    appendLog('[Error] El navegador no es compatible con Service Workers.', 'log-error');
    return;
  }

  try {
    const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });

    if (registration.installing) {
      updateSwBadge('Instalando...', 'badge-pending');
      appendLog('[SW] Instalando Service Worker y precacheando offline.html...', 'log-info');
    } else if (registration.waiting) {
      updateSwBadge('En espera', 'badge-pending');
      appendLog('[SW] Service Worker instalado en espera de activación.', 'log-info');
    } else if (registration.active) {
      updateSwBadge('Activo & Fallback Listo', 'badge-active');
      appendLog('[SW] Service Worker Activo. Interceptor y plantilla offline.html armados.', 'log-success');
    }

    // Escuchar actualizaciones
    registration.onupdatefound = () => {
      const installingWorker = registration.installing;
      installingWorker.onstatechange = () => {
        if (installingWorker.state === 'installed') {
          updateSwBadge('Activo & Fallback Listo', 'badge-active');
          appendLog('[SW] App Shell y plantilla "offline.html" precacheados con éxito.', 'log-success');
          inspectCacheStorage();
        }
      };
    };

    navigator.serviceWorker.ready.then(() => {
      updateSwBadge('Activo & Fallback Listo', 'badge-active');
      inspectCacheStorage();
    });

  } catch (error) {
    console.error('Error al registrar Service Worker:', error);
    updateSwBadge('Error de Registro', 'badge-offline');
    appendLog(`[SW Error] Falló el registro: ${error.message}`, 'log-error');
  }
}

/**
 * 2. Monitoreo reactivo de la Conectividad de Red
 */
function setupNetworkMonitoring() {
  function updateNetworkBadge() {
    const isOnline = navigator.onLine;
    if (isOnline) {
      networkStatusEl.className = 'badge badge-online';
      networkStatusEl.innerHTML = '<span class="badge-dot"></span><span class="badge-text">En Línea (Online)</span>';
      appendLog('[Red] Conexión activa a Internet detectada.', 'log-info');
    } else {
      networkStatusEl.className = 'badge badge-offline';
      networkStatusEl.innerHTML = '<span class="badge-dot"></span><span class="badge-text">Sin Conexión (Offline)</span>';
      appendLog('[Red Alerta] Se perdió la conexión a Internet. Las peticiones no cacheadas activarán la plantilla Fallback.', 'log-fallback');
    }
  }

  window.addEventListener('online', updateNetworkBadge);
  window.addEventListener('offline', updateNetworkBadge);
  updateNetworkBadge();
}

/**
 * 3. Inspección en tiempo real de la Cache API
 */
async function inspectCacheStorage() {
  if (!('caches' in window)) {
    cacheTableBodyEl.innerHTML = `<tr><td colspan="4" class="text-center py-4">Cache API no disponible en este navegador.</td></tr>`;
    return;
  }

  try {
    const hasCache = await caches.has(CACHE_NAME);
    if (!hasCache) {
      cacheTableBodyEl.innerHTML = `<tr><td colspan="4" class="text-center py-4">Esperando instalación del Service Worker para crear <strong>${CACHE_NAME}</strong>...</td></tr>`;
      return;
    }

    const cache = await caches.open(CACHE_NAME);
    const cachedRequests = await cache.keys();
    const cachedUrls = cachedRequests.map(req => new URL(req.url).pathname);

    let cachedCount = 0;
    let fallbackCount = 0;
    cacheTableBodyEl.innerHTML = '';

    for (const item of AUDIT_RESOURCES) {
      const fullUrl = new URL(item.url, window.location.href).pathname;
      const isCached = cachedUrls.some(u => u === fullUrl || u.endsWith(item.url.replace('./', '')));

      if (isCached) {
        cachedCount++;
        if (item.isFallback) fallbackCount++;
      }

      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td class="resource-cell">
          ${item.label}
          ${item.isFallback ? '<span class="badge-fallback-row">Recurso Fallback</span>' : ''}
        </td>
        <td><span class="type-pill">${item.type}</span></td>
        <td>
          ${isCached 
            ? '<span class="status-cached">● Disponible en Cache API</span>' 
            : '<span class="status-uncached">○ No encontrado en caché</span>'
          }
        </td>
        <td>
          <button class="btn btn-secondary btn-sm" onclick="testResourceFetch('${item.url}')">
            Probar Petición
          </button>
        </td>
      `;
      cacheTableBodyEl.appendChild(tr);
    }

    if (cachedCountBadgeEl) cachedCountBadgeEl.textContent = cachedCount;
    if (fallbackCountBadgeEl) fallbackCountBadgeEl.textContent = fallbackCount;

  } catch (error) {
    console.error('Error al inspeccionar Cache API:', error);
  }
}

/**
 * 4. Banco de Pruebas: Prueba de Fallback HTML Personalizado
 * Intenta solicitar un archivo HTML que NO está en caché (ej. pagina-no-cacheada.html).
 * - En modo offline: el interceptor .catch() en sw.js devuelve el HTML de offline.html
 */
async function testHtmlFallback() {
  const targetUrl = './pagina-no-cacheada.html';
  appendLog(`[Prueba HTML] Solicitando recurso HTML no precacheado: "${targetUrl}"...`, 'log-info');

  const startTime = performance.now();

  try {
    const response = await fetch(targetUrl, {
      headers: { 'Accept': 'text/html' }
    });
    const duration = (performance.now() - startTime).toFixed(1);
    const htmlText = await response.text();

    // Verificamos si el contenido retornado es la plantilla offline
    const isOfflineFallback = htmlText.includes('Modo Sin Conexión') || htmlText.includes('offline-card');

    if (isOfflineFallback) {
      appendLog(`[Interceptor Fallback Exitoso] Se recibió la plantilla personalizada "offline.html" en ${duration}ms (Status: ${response.status})`, 'log-fallback');
      openModalWithContent(htmlText);
    } else if (response.ok) {
      appendLog(`[Respuesta de Red] Recibido desde la red externa en ${duration}ms (Status: ${response.status})`, 'log-success');
    } else {
      appendLog(`[Respuesta HTTP] Código recibido: ${response.status}`, 'log-warn');
    }
  } catch (error) {
    appendLog(`[Error de Fetch] Falló la petición sin fallback interceptado: ${error.message}`, 'log-error');
  }
}

/**
 * 5. Banco de Pruebas: Prueba de Fallback de Imagen
 * Intenta solicitar una imagen que no existe ni está en caché.
 * - En modo offline: sw.js captura el error y responde con images/offline-fallback.svg
 */
async function testImageFallback() {
  const targetImageUrl = './images/foto-no-guardada-en-cache.png';
  appendLog(`[Prueba Imagen] Solicitando imagen no precacheada: "${targetImageUrl}"...`, 'log-info');

  imageDemoBoxEl.innerHTML = '<span class="text-muted text-sm">Interceptando petición de imagen...</span>';

  try {
    const response = await fetch(targetImageUrl, {
      headers: { 'Accept': 'image/*' }
    });

    if (response.ok) {
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);

      appendLog(`[Interceptor Imagen] Recibido fallback gráfico SVG para "${targetImageUrl}" (Status: ${response.status})`, 'log-success');
      imageDemoBoxEl.innerHTML = `
        <div style="text-align: center;">
          <img src="${objectUrl}" alt="Imagen Fallback Recuperada">
          <p style="font-size: 0.75rem; color: #fda4af; margin-top: 6px;">Gráfico devuelto por el interceptor offline del Service Worker</p>
        </div>
      `;
    } else {
      imageDemoBoxEl.innerHTML = `<span style="color: var(--amber); font-size: 0.8rem;">Respuesta HTTP: ${response.status}</span>`;
      appendLog(`[Imagen] Servidor respondió con código ${response.status}`, 'log-warn');
    }
  } catch (error) {
    imageDemoBoxEl.innerHTML = `<span style="color: var(--rose); font-size: 0.8rem;">Error: ${error.message}</span>`;
    appendLog(`[Imagen Error] ${error.message}`, 'log-error');
  }
}

/**
 * 6. Banco de Pruebas: Prueba de Fallback de Datos / API JSON
 */
async function testApiFallback() {
  const targetApiUrl = './api/datos-en-tiempo-real';
  appendLog(`[Prueba API] Solicitando endpoint JSON no precacheado: "${targetApiUrl}"...`, 'log-info');

  apiDemoBoxEl.innerHTML = '<span class="text-muted text-sm">Enviando petición fetch JSON...</span>';

  try {
    const response = await fetch(targetApiUrl, {
      headers: { 'Accept': 'application/json' }
    });

    const data = await response.json();
    appendLog(`[Interceptor API] Respuesta recibida (Status: ${response.status} ${response.statusText})`, 'log-info');

    if (data.offline) {
      appendLog(`[API Fallback Exitoso] JSON estructurado de contingencia offline recibido.`, 'log-fallback');
    }

    apiDemoBoxEl.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;

  } catch (error) {
    apiDemoBoxEl.innerHTML = `<span style="color: var(--rose); font-size: 0.8rem;">Error de conexión: ${error.message}</span>`;
    appendLog(`[API Error] ${error.message}`, 'log-error');
  }
}

/**
 * 7. Prueba individual desde la tabla de caché
 */
window.testResourceFetch = async function(resourcePath) {
  const startTime = performance.now();
  appendLog(`[Fetch Individual] Solicitando "${resourcePath}"...`, 'log-info');

  try {
    const response = await fetch(resourcePath);
    const duration = (performance.now() - startTime).toFixed(1);

    if (response.ok) {
      appendLog(`[Fetch Exitoso] "${resourcePath}" despachado en ${duration}ms (Status: ${response.status} OK)`, 'log-success');
    } else {
      appendLog(`[Fetch] Código de estado ${response.status} para "${resourcePath}"`, 'log-warn');
    }
  } catch (error) {
    appendLog(`[Fetch Falló] No se pudo obtener "${resourcePath}": ${error.message}`, 'log-error');
  }
};

/**
 * Helpers UI & Modal
 */
function updateSwBadge(text, badgeClass) {
  if (!swStatusEl) return;
  swStatusEl.className = `badge ${badgeClass}`;
  swStatusEl.innerHTML = `<span class="badge-dot"></span><span class="badge-text">SW: ${text}</span>`;
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

function openModalWithUrl(url) {
  if (!modalIframeEl || !modalBackdropEl) return;
  modalIframeEl.src = url;
  modalBackdropEl.classList.add('open');
}

function openModalWithContent(htmlContent) {
  if (!modalIframeEl || !modalBackdropEl) return;
  modalIframeEl.srcdoc = htmlContent;
  modalBackdropEl.classList.add('open');
}

function closeModal() {
  if (!modalBackdropEl) return;
  modalBackdropEl.classList.remove('open');
  if (modalIframeEl) modalIframeEl.srcdoc = '';
}

/**
 * Event Listeners
 */
document.addEventListener('DOMContentLoaded', () => {
  registerServiceWorker();
  setupNetworkMonitoring();

  if (btnRefreshCacheEl) {
    btnRefreshCacheEl.addEventListener('click', () => {
      appendLog('[Inspector] Refrescando estado de Cache API...', 'log-info');
      inspectCacheStorage();
    });
  }

  if (btnClearLogEl) {
    btnClearLogEl.addEventListener('click', () => {
      diagnosticLogEl.innerHTML = '<div class="log-entry log-info">[Sistema] Registro limpiado. Listo para nuevas pruebas.</div>';
    });
  }

  if (btnTestHtmlEl) {
    btnTestHtmlEl.addEventListener('click', testHtmlFallback);
  }

  if (btnOpenUncachedEl) {
    btnOpenUncachedEl.addEventListener('click', () => {
      window.open('./pagina-no-cacheada.html', '_blank');
      appendLog('[Navegación] Abriendo "./pagina-no-cacheada.html" en nueva pestaña para probar el renderizado fallback.', 'log-info');
    });
  }

  if (btnTestImageEl) {
    btnTestImageEl.addEventListener('click', testImageFallback);
  }

  if (btnTestApiEl) {
    btnTestApiEl.addEventListener('click', testApiFallback);
  }

  if (btnPreviewOfflineModalEl) {
    btnPreviewOfflineModalEl.addEventListener('click', () => {
      appendLog('[Vista Previa] Visualizando plantilla "offline.html" en visor modal interactivo.', 'log-info');
      openModalWithUrl('./offline.html');
    });
  }

  if (modalCloseBtnEl) {
    modalCloseBtnEl.addEventListener('click', closeModal);
  }

  if (modalBackdropEl) {
    modalBackdropEl.addEventListener('click', (e) => {
      if (e.target === modalBackdropEl) closeModal();
    });
  }
});
