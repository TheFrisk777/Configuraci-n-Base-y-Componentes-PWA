/**
 * ============================================================================
 * NOVAFLOW PWA — APP SHELL & SPLASH SCREEN NATIVA
 * ARCHITECTURE CONTROLLER & DEVTOOLS VERIFIER
 * ============================================================================
 */

document.addEventListener('DOMContentLoaded', () => {

  // --- REFERENCIAS A ELEMENTOS DEL DOM ---
  const appSidebar = document.getElementById('appSidebar');
  const menuToggleBtn = document.getElementById('menuToggleBtn');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  
  const navItems = document.querySelectorAll('.nav-item');
  const mobileNavBtns = document.querySelectorAll('.mobile-nav-btn');
  const viewPanels = document.querySelectorAll('.view-panel');
  
  const networkChip = document.getElementById('networkChip');
  const networkText = document.getElementById('networkText');
  const diagNetworkStatus = document.getElementById('diagNetworkStatus');
  
  const installAppBtn = document.getElementById('installAppBtn');
  const triggerInstallPrompt = document.getElementById('triggerInstallPrompt');
  const triggerSplashBtn = document.getElementById('triggerSplashBtn');
  const nativeSplashOverlay = document.getElementById('nativeSplashOverlay');
  const splashClock = document.getElementById('splashClock');
  
  const contentGrid = document.getElementById('contentGrid');
  const simulateFetchBtn = document.getElementById('simulateFetchBtn');
  
  const runPhoneSimBtn = document.getElementById('runPhoneSimBtn');
  const toggleSimScreenBtn = document.getElementById('toggleSimScreenBtn');
  const phoneSplashLayer = document.getElementById('phoneSplashLayer');
  const phoneClock = document.getElementById('phoneClock');
  const goToSimulatorBtn = document.getElementById('goToSimulatorBtn');
  
  const clearCacheBtn = document.getElementById('clearCacheBtn');
  const refreshSwBtn = document.getElementById('refreshSwBtn');
  const eventLogContainer = document.getElementById('eventLogContainer');
  const clearLogsBtn = document.getElementById('clearLogsBtn');
  
  const swBadgeState = document.getElementById('swBadgeState');
  const swCheckIcon = document.getElementById('swCheckIcon');
  const diagInstallability = document.getElementById('diagInstallability');

  // Variable para almacenar el evento de instalación de Chrome
  let deferredPrompt = null;
  let isPhoneSplashLocked = false;

  // --- SISTEMA DE LOGGING EN TIEMPO REAL ---
  function addLog(category, message) {
    const time = new Date().toLocaleTimeString('es-ES', { hour12: false });
    const entry = document.createElement('div');
    entry.className = 'log-entry';

    let tagClass = 'sw';
    if (category === 'MANIFEST') tagClass = 'manifest';
    if (category === 'NET') tagClass = 'net';
    if (category === 'PWA' || category === 'INSTALL') tagClass = 'install';

    entry.innerHTML = `
      <span class="log-time">[${time}]</span>
      <span class="log-tag ${tagClass}">[${category}]</span>
      <span class="log-msg">${message}</span>
    `;

    if (eventLogContainer) {
      eventLogContainer.appendChild(entry);
      eventLogContainer.scrollTop = eventLogContainer.scrollHeight;
    }
    console.log(`[${category}] ${message}`);
  }

  // Actualizar relojes de simulación
  function updateClocks() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (splashClock) splashClock.textContent = timeStr;
    if (phoneClock) phoneClock.textContent = timeStr;
  }
  updateClocks();
  setInterval(updateClocks, 10000);

  // --- 1. GESTIÓN DEL MENÚ RESPONSIVO (DRAWER Y SIDEBAR) ---
  function toggleMobileMenu(open) {
    const shouldOpen = open !== undefined ? open : !appSidebar.classList.contains('open');
    if (shouldOpen) {
      appSidebar.classList.add('open');
      sidebarBackdrop.classList.add('active');
    } else {
      appSidebar.classList.remove('open');
      sidebarBackdrop.classList.remove('active');
    }
  }

  if (menuToggleBtn) {
    menuToggleBtn.addEventListener('click', () => toggleMobileMenu());
  }

  if (sidebarBackdrop) {
    sidebarBackdrop.addEventListener('click', () => toggleMobileMenu(false));
  }

  // --- 2. SISTEMA DE NAVEGACIÓN ENTRE VISTAS DEL SHELL ---
  function switchView(targetViewId) {
    // Actualizar paneles principales
    viewPanels.forEach(panel => {
      if (panel.id === targetViewId) {
        panel.classList.add('active');
      } else {
        panel.classList.remove('active');
      }
    });

    // Sincronizar botones de la barra lateral (Sidebar)
    navItems.forEach(btn => {
      if (btn.getAttribute('data-view') === targetViewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Sincronizar botones de navegación móvil inferior
    mobileNavBtns.forEach(btn => {
      if (btn.getAttribute('data-view') === targetViewId) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

    // Cerrar menú móvil al seleccionar
    toggleMobileMenu(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    addLog('SHELL', `Navegación del contenedor principal activada: #${targetViewId}`);
  }

  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = btn.getAttribute('data-view');
      switchView(viewId);
    });
  });

  mobileNavBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const viewId = btn.getAttribute('data-view');
      switchView(viewId);
    });
  });

  if (goToSimulatorBtn) {
    goToSimulatorBtn.addEventListener('click', () => switchView('view-simulator'));
  }

  // --- 3. REGISTRO Y GESTIÓN DEL SERVICE WORKER (APP SHELL CACHING) ---
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js')
        .then((reg) => {
          addLog('SW', `Service Worker registrado con éxito en el ámbito: ${reg.scope}`);
          
          if (swBadgeState) {
            swBadgeState.textContent = 'Activo';
            swBadgeState.className = 'badge-status-pass';
          }

          // Escuchar cambios de estado
          reg.onupdatefound = () => {
            const installingWorker = reg.installing;
            installingWorker.onstatechange = () => {
              if (installingWorker.state === 'installed') {
                if (navigator.serviceWorker.controller) {
                  addLog('SW', 'Nueva versión del App Shell disponible en caché.');
                } else {
                  addLog('SW', 'App Shell precacheado completamente para modo offline.');
                }
              }
            };
          };
        })
        .catch((err) => {
          addLog('SW', `Error al registrar Service Worker: ${err.message}`);
          if (swBadgeState) {
            swBadgeState.textContent = 'Error';
            swBadgeState.className = 'badge-status-pass';
            swBadgeState.style.background = 'rgba(239, 68, 68, 0.2)';
            swBadgeState.style.color = '#ef4444';
          }
        });
    });
  } else {
    addLog('SW', 'Service Worker no soportado por este navegador.');
  }

  // --- 4. VERIFICACIÓN DEL WEB APP MANIFEST EN TIEMPO REAL ---
  fetch('./manifest.json')
    .then(res => res.json())
    .then(data => {
      addLog('MANIFEST', `manifest.json cargado correctamente: ${data.name}`);
      addLog('MANIFEST', `Splash Screen Color: ${data.background_color} | Theme: ${data.theme_color}`);
      addLog('MANIFEST', `Iconos definidos: ${data.icons.map(i => i.sizes).join(', ')}`);
    })
    .catch(err => {
      addLog('MANIFEST', `Aviso al inspeccionar manifest.json: ${err.message}`);
    });

  // --- 5. MONITOREO DE CONECTIVIDAD DE RED (ONLINE / OFFLINE) ---
  function updateNetworkStatus() {
    const isOnline = navigator.onLine;
    if (isOnline) {
      networkChip.className = 'status-chip';
      networkChip.querySelector('.dot').className = 'dot dot-online';
      networkText.textContent = 'Online';
      if (diagNetworkStatus) {
        diagNetworkStatus.textContent = 'Online';
        diagNetworkStatus.style.color = '#34d399';
      }
      addLog('NET', 'Conectividad reestablecida. Red disponible.');
    } else {
      networkChip.className = 'status-chip offline';
      networkChip.querySelector('.dot').className = 'dot dot-offline';
      networkText.textContent = 'Offline (Caché Shell)';
      if (diagNetworkStatus) {
        diagNetworkStatus.textContent = 'Offline';
        diagNetworkStatus.style.color = '#f87171';
      }
      addLog('NET', 'Sin conexión de red. El App Shell continúa funcionando desde caché.');
    }
  }

  window.addEventListener('online', updateNetworkStatus);
  window.addEventListener('offline', updateNetworkStatus);
  updateNetworkStatus();

  // --- 6. GESTIÓN DEL EVENTO BEFOREINSTALLPROMPT & INSTALACIÓN NATIVA ---
  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevenir el banner automático inicial para controlarlo desde el App Shell
    e.preventDefault();
    deferredPrompt = e;
    
    // Mostrar botones de instalación en la interfaz
    if (installAppBtn) installAppBtn.style.display = 'inline-flex';
    if (diagInstallability) {
      diagInstallability.textContent = 'Listo para instalar';
      diagInstallability.style.color = '#60a5fa';
    }

    addLog('INSTALL', 'Evento beforeinstallprompt detectado. Criterios de Splash Screen cumplidos.');
  });

  async function triggerNativeInstall() {
    if (deferredPrompt) {
      addLog('INSTALL', 'Disparando diálogo nativo de instalación...');
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      addLog('INSTALL', `Respuesta del usuario a la instalación: ${outcome}`);
      deferredPrompt = null;
      if (installAppBtn) installAppBtn.style.display = 'none';
    } else {
      addLog('INSTALL', 'Simulando instalación: Abre Chrome DevTools > Application > Manifest y pulsa "Install".');
      alert('Para simular la instalación:\n\n1. Abre Chrome DevTools (F12 o Ctrl+Shift+I)\n2. Ve a la pestaña "Application" > "Manifest"\n3. Haz clic en "Install" o activa la emulación móvil (Ctrl+Shift+M).\n\n¡La Splash Screen nativa se desplegará al ejecutar la app instalada!');
    }
  }

  if (installAppBtn) {
    installAppBtn.addEventListener('click', triggerNativeInstall);
  }

  if (triggerInstallPrompt) {
    triggerInstallPrompt.addEventListener('click', triggerNativeInstall);
  }

  window.addEventListener('appinstalled', () => {
    addLog('INSTALL', '¡PWA instalada exitosamente como aplicación nativa!');
    if (installAppBtn) installAppBtn.style.display = 'none';
  });

  // --- 7. SIMULADOR DE SPLASH SCREEN NATIVA (PANTALLA COMPLETA) ---
  function runFullScreenSplashSimulation() {
    if (!nativeSplashOverlay) return;
    
    addLog('SHELL', 'Simulando arranque con Splash Screen Nativa Chromium...');
    nativeSplashOverlay.classList.add('active');

    // Simular el tiempo de inicio de la PWA (1.8 segundos) y transición suave al App Shell
    setTimeout(() => {
      nativeSplashOverlay.classList.remove('active');
      addLog('SHELL', 'Splash Screen finalizada. App Shell visible y renderizado.');
    }, 1800);
  }

  if (triggerSplashBtn) {
    triggerSplashBtn.addEventListener('click', runFullScreenSplashSimulation);
  }

  // --- 8. SIMULADOR INTERACTIVO DENTRO DEL TELÉFONO MÓVIL ---
  function runPhoneSimulator() {
    if (!phoneSplashLayer) return;
    isPhoneSplashLocked = false;
    phoneSplashLayer.classList.remove('fade-out');

    addLog('SHELL', 'Lanzando simulación de Splash Screen en el dispositivo emulado...');

    setTimeout(() => {
      if (!isPhoneSplashLocked) {
        phoneSplashLayer.classList.add('fade-out');
        addLog('SHELL', 'Desvanecimiento de Splash Screen nativa completado en emulador.');
      }
    }, 1600);
  }

  if (runPhoneSimBtn) {
    runPhoneSimBtn.addEventListener('click', runPhoneSimulator);
  }

  if (toggleSimScreenBtn) {
    toggleSimScreenBtn.addEventListener('click', () => {
      if (!phoneSplashLayer) return;
      isPhoneSplashLocked = !isPhoneSplashLocked;

      if (isPhoneSplashLocked) {
        phoneSplashLayer.classList.remove('fade-out');
        toggleSimScreenBtn.textContent = 'Reanudar Ciclo Normal';
        toggleSimScreenBtn.style.borderColor = 'var(--warning)';
        addLog('SHELL', 'Splash Screen congelada en emulador para inspección visual.');
      } else {
        phoneSplashLayer.classList.add('fade-out');
        toggleSimScreenBtn.textContent = 'Pausar en Splash Screen';
        toggleSimScreenBtn.style.borderColor = '';
        addLog('SHELL', 'Reanudando transición a la interfaz del App Shell.');
      }
    });
  }

  // Ejecutar animación inicial del simulador de teléfono
  setTimeout(() => {
    if (phoneSplashLayer) {
      phoneSplashLayer.classList.add('fade-out');
    }
  }, 1200);

  // --- 9. SIMULACIÓN DE CARGA DINÁMICA CON SKELETON SCREENS ---
  if (simulateFetchBtn && contentGrid) {
    simulateFetchBtn.addEventListener('click', () => {
      addLog('SHELL', 'Simulando petición de datos dinámicos. Mostrando Skeleton Screens...');

      // Renderizar temporalmente Skeletons en el contenedor principal
      contentGrid.innerHTML = `
        <div class="skeleton-card-pulse">
          <div class="skeleton-shimmer sk-pill"></div>
          <div class="skeleton-shimmer sk-title"></div>
          <div class="skeleton-shimmer sk-line-1"></div>
          <div class="skeleton-shimmer sk-line-2"></div>
          <div class="skeleton-shimmer sk-box"></div>
        </div>
        <div class="skeleton-card-pulse">
          <div class="skeleton-shimmer sk-pill"></div>
          <div class="skeleton-shimmer sk-title"></div>
          <div class="skeleton-shimmer sk-line-1"></div>
          <div class="skeleton-shimmer sk-line-2"></div>
          <div class="skeleton-shimmer sk-box"></div>
        </div>
        <div class="skeleton-card-pulse">
          <div class="skeleton-shimmer sk-pill"></div>
          <div class="skeleton-shimmer sk-title"></div>
          <div class="skeleton-shimmer sk-line-1"></div>
          <div class="skeleton-shimmer sk-line-2"></div>
          <div class="skeleton-shimmer sk-box"></div>
        </div>
      `;

      simulateFetchBtn.disabled = true;
      simulateFetchBtn.style.opacity = '0.6';

      // Simular latencia de red y restauración del contenido
      setTimeout(() => {
        contentGrid.innerHTML = `
          <article class="content-card">
            <div class="card-badge-row">
              <span class="component-tag">Componente 01</span>
              <span class="status-badge-ok">En Shell</span>
            </div>
            <div class="card-body-content">
              <h4 class="card-title">Header Responsivo</h4>
              <p class="card-text">
                Diseñado con flexbox adaptativo, integra el botón hamburguesa para pantallas móviles, indicador visual de conectividad en tiempo real (Online/Offline) y botón nativo de instalación.
              </p>
              <div class="metric-box">
                <span class="metric-val">100%</span>
                <span class="metric-lbl">Disponibilidad en Caché</span>
              </div>
            </div>
          </article>

          <article class="content-card">
            <div class="card-badge-row">
              <span class="component-tag">Componente 02</span>
              <span class="status-badge-ok">En Shell</span>
            </div>
            <div class="card-body-content">
              <h4 class="card-title">Navegación Híbrida</h4>
              <p class="card-text">
                Ofrece una barra lateral (Sidebar) expandible en escritorio y se transforma automáticamente en un Drawer deslizable y una <em>Bottom Navigation Bar</em> en dispositivos móviles.
              </p>
              <div class="metric-box">
                <span class="metric-val">&lt; 768px</span>
                <span class="metric-lbl">Punto de Quiebre Responsivo</span>
              </div>
            </div>
          </article>

          <article class="content-card">
            <div class="card-badge-row">
              <span class="component-tag">Componente 03</span>
              <span class="status-badge-ok">Nativo Chromium</span>
            </div>
            <div class="card-body-content">
              <h4 class="card-title">Splash Screen del SO</h4>
              <p class="card-text">
                Configurada en el <code>manifest.json</code> mediante <code>background_color</code>, <code>theme_color</code>, nombre de app e iconos de 192px y 512px. Chromium la ensambla y despliega de manera automática.
              </p>
              <div class="metric-box">
                <span class="metric-val">Automático</span>
                <span class="metric-lbl">Generación por el Sistema</span>
              </div>
            </div>
          </article>
        `;

        simulateFetchBtn.disabled = false;
        simulateFetchBtn.style.opacity = '1';
        addLog('SHELL', 'Datos inyectados en el contenedor principal sin recargar el App Shell.');
      }, 1200);
    });
  }

  // --- 10. LIMPIEZA DE CACHÉ Y DIAGNÓSTICO ---
  if (clearCacheBtn) {
    clearCacheBtn.addEventListener('click', async () => {
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map(k => caches.delete(k)));
        addLog('SW', `Caché limpiada: ${keys.join(', ')}.`);
        alert('Cachés del App Shell eliminadas con éxito. Al recargar, se generará una nueva versión.');
      }
    });
  }

  if (refreshSwBtn) {
    refreshSwBtn.addEventListener('click', async () => {
      if ('serviceWorker' in navigator) {
        const reg = await navigator.serviceWorker.getRegistration();
        if (reg) {
          await reg.update();
          addLog('SW', 'Comprobación de actualización del Service Worker completada.');
          alert('Service Worker actualizado y verificado.');
        } else {
          addLog('SW', 'No hay Service Worker registrado.');
        }
      }
    });
  }

  if (clearLogsBtn && eventLogContainer) {
    clearLogsBtn.addEventListener('click', () => {
      eventLogContainer.innerHTML = '';
      addLog('SHELL', 'Registro de eventos reiniciado.');
    });
  }

  // Log inicial de arranque del App Shell
  addLog('SHELL', 'App Shell inicializado correctamente.');
  addLog('SHELL', 'Header, Navegación lateral y Contenedor principal listos.');
});
