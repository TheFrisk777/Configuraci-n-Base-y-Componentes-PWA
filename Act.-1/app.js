// ==========================================================================
// NovaFlow PWA Controller & Diagnostic Engine
// ==========================================================================

let deferredPrompt = null;
const installBtn = document.getElementById('installBtn');
const installStatus = document.getElementById('installStatus');
const swStatusBadge = document.getElementById('swStatusBadge');
const displayModeText = document.getElementById('displayModeText');

// 1. Registro del Service Worker
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('[PWA] Service Worker registrado exitosamente con scope:', reg.scope);
        if (swStatusBadge) {
          swStatusBadge.textContent = 'Activo & Cache Ready';
          swStatusBadge.style.color = '#10b981';
          swStatusBadge.style.borderColor = 'rgba(16, 185, 129, 0.4)';
          swStatusBadge.style.background = 'rgba(16, 185, 129, 0.15)';
        }
      })
      .catch((err) => {
        console.error('[PWA] Error registrando Service Worker:', err);
        if (swStatusBadge) {
          swStatusBadge.textContent = 'Error en registro';
          swStatusBadge.style.color = '#ef4444';
        }
      });
  });
} else {
  if (swStatusBadge) {
    swStatusBadge.textContent = 'No soportado en este navegador';
    swStatusBadge.style.color = '#f59e0b';
  }
}

// 2. Manejo del evento de instalación nativa 'beforeinstallprompt'
window.addEventListener('beforeinstallprompt', (e) => {
  // Previene que Chromium muestre el mini-infobar automáticamente
  e.preventDefault();
  // Guarda el evento para invocarlo cuando el usuario presione el botón
  deferredPrompt = e;
  
  if (installBtn) {
    installBtn.style.display = 'inline-flex';
    installBtn.innerHTML = `
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      Instalar Aplicación
    `;
  }

  if (installStatus) {
    installStatus.textContent = '¡Listo para instalar como app de escritorio o móvil!';
  }
});

// Acción al hacer clic en instalar
if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
      // Mostrar el diálogo nativo de instalación
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      console.log(`[PWA] Respuesta del usuario: ${outcome}`);
      showToast(outcome === 'accepted' ? '¡Aplicación instalada con éxito!' : 'Instalación cancelada por el usuario');
      deferredPrompt = null;
    } else {
      // Instrucción si ya está instalada o el navegador no soporta beforeinstallprompt (ej. Safari / Firefox)
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
      if (isStandalone) {
        showToast('Ya estás ejecutando la aplicación en modo Standalone (instalada).');
      } else {
        showToast('En navegadores Chromium puedes usar el icono de instalación en la barra de URL o menú ⋮ > "Instalar". En iOS Safari usa "Compartir > Agregar a pantalla de inicio".');
      }
    }
  });
}

// 3. Detección cuando la app ya fue instalada
window.addEventListener('appinstalled', () => {
  console.log('[PWA] Aplicación instalada correctamente en el sistema');
  showToast('¡Felicidades! NovaFlow PWA se instaló correctamente en tu sistema.');
  if (installBtn) {
    installBtn.style.display = 'none';
  }
  if (installStatus) {
    installStatus.textContent = 'Aplicación instalada en el dispositivo.';
  }
});

// 4. Detección del modo de pantalla (Standalone vs Browser)
function checkDisplayMode() {
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  if (displayModeText) {
    displayModeText.textContent = isStandalone ? 'standalone (Modo Aplicación Nativa)' : 'browser (Pestaña del Navegador)';
    displayModeText.style.color = isStandalone ? '#10b981' : '#67e8f9';
  }
}
checkDisplayMode();
window.matchMedia('(display-mode: standalone)').addEventListener('change', checkDisplayMode);

// 5. Previsualizador de máscara (Maskable Previewer)
window.toggleIconMask = function(shape) {
  const icons = document.querySelectorAll('.icon-img');
  icons.forEach(img => {
    img.classList.remove('shape-circle', 'shape-squircle');
    if (shape === 'circle') {
      img.classList.add('shape-circle');
    } else if (shape === 'squircle') {
      img.classList.add('shape-squircle');
    }
  });
  showToast(`Vista previa de icono cambiada a: ${shape.toUpperCase()}`);
};

// 6. Utilidad para copiar el Manifest JSON
window.copyManifest = function() {
  const manifestText = document.getElementById('manifestCode').innerText;
  navigator.clipboard.writeText(manifestText).then(() => {
    showToast('¡Código de manifest.json copiado al portapapeles!');
  }).catch(() => {
    showToast('Error al copiar el texto.');
  });
};

// 7. Notificación Toast flotante
function showToast(message) {
  const toast = document.getElementById('toast');
  const toastMsg = document.getElementById('toastMsg');
  if (toast && toastMsg) {
    toastMsg.textContent = message;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 4000);
  }
}
