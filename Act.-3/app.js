/**
 * ============================================================================
 * NOVAFLOW v3 — APP CONTROLLER & SERVICE WORKER ORCHESTRATOR
 * ============================================================================
 * Gestión de:
 * 1. Registro, actualización y activación del Service Worker.
 * 2. Visualización y CRUD persistente en IndexedDB (Modo Offline-First).
 * 3. Sincronización automática de cola de cambios al reconectar.
 * 4. Laboratorio interactivo de Estrategias de Caché.
 * 5. Explorador en vivo de almacenamiento (Cache API & IndexedDB).
 */

class NovaFlowApp {
  constructor() {
    this.swRegistration = null;
    this.isSimulatingOffline = false;
    this.currentProjects = [];
    this.activeTab = 'tab-idb';

    // Elementos del DOM
    this.elements = {};
  }

  async init() {
    console.log('[NovaFlow App] Inicializando motor v3...');
    this.cacheDomElements();
    this.bindEvents();
    this.setupNetworkMonitoring();

    // 1. Inicializar almacenamiento IndexedDB y sembrar datos si es necesario
    try {
      await idbManager.init();
      await idbManager.seedInitialDataIfEmpty();
      await this.refreshProjectsList();
      await this.updateSyncQueueBadge();
      this.log('IndexedDB inicializado con almacenes de proyectos y cola offline.', 'success');
    } catch (err) {
      console.error('[App] Error al inicializar IndexedDB:', err);
      this.log(`Error en IndexedDB: ${err.message}`, 'error');
    }

    // 2. Registrar Service Worker con manejo completo de ciclo de vida
    await this.registerServiceWorker();

    // 3. Cargar diagnósticos iniciales de almacenamiento
    this.refreshStorageExplorer();
  }

  cacheDomElements() {
    this.elements = {
      // Indicadores de estado
      connectionStatusText: document.getElementById('connectionStatusText'),
      connectionStatusDot: document.getElementById('connectionStatusDot'),
      swVersionBadge: document.getElementById('swVersionBadge'),
      idbRecordsBadge: document.getElementById('idbRecordsBadge'),
      offlineAlertBanner: document.getElementById('offlineAlertBanner'),
      swUpdateBanner: document.getElementById('swUpdateBanner'),
      btnApplyUpdate: document.getElementById('btnApplyUpdate'),
      syncPendingBadge: document.getElementById('syncPendingBadge'),
      btnTriggerSync: document.getElementById('btnTriggerSync'),
      btnToggleOfflineSim: document.getElementById('btnToggleOfflineSim'),

      // Pestañas
      tabBtns: document.querySelectorAll('.tab-btn'),
      tabContents: document.querySelectorAll('.tab-content'),

      // Vista IndexedDB / Proyectos
      projectsGrid: document.getElementById('projectsGrid'),
      projectSearchInput: document.getElementById('projectSearchInput'),
      filterCategory: document.getElementById('filterCategory'),
      btnOpenCreateModal: document.getElementById('btnOpenCreateModal'),

      // Modal
      projectModal: document.getElementById('projectModal'),
      modalTitle: document.getElementById('modalTitle'),
      projectForm: document.getElementById('projectForm'),
      projectIdInput: document.getElementById('projectIdInput'),
      projectTitleInput: document.getElementById('projectTitleInput'),
      projectDescInput: document.getElementById('projectDescInput'),
      projectCategoryInput: document.getElementById('projectCategoryInput'),
      projectPriorityInput: document.getElementById('projectPriorityInput'),
      projectStatusInput: document.getElementById('projectStatusInput'),
      btnCloseModal: document.getElementById('btnCloseModal'),
      btnCancelModal: document.getElementById('btnCancelModal'),

      // Laboratorio de Estrategias de Caché
      btnTestCacheFirst: document.getElementById('btnTestCacheFirst'),
      btnTestNetworkFirst: document.getElementById('btnTestNetworkFirst'),
      btnTestSWR: document.getElementById('btnTestSWR'),
      btnTestOfflineFallback: document.getElementById('btnTestOfflineFallback'),
      cacheBenchmarkResult: document.getElementById('cacheBenchmarkResult'),

      // Diagnóstico del Service Worker
      swStatusVal: document.getElementById('swStatusVal'),
      swScopeVal: document.getElementById('swScopeVal'),
      swVersionVal: document.getElementById('swVersionVal'),
      swControllerVal: document.getElementById('swControllerVal'),
      btnCheckUpdates: document.getElementById('btnCheckUpdates'),
      btnClearAllCaches: document.getElementById('btnClearAllCaches'),
      btnUnregisterSW: document.getElementById('btnUnregisterSW'),
      btnReRegisterSW: document.getElementById('btnReRegisterSW'),

      // Explorador de Almacenamiento
      btnRefreshStorage: document.getElementById('btnRefreshStorage'),
      cacheListContainer: document.getElementById('cacheListContainer'),
      idbRawViewer: document.getElementById('idbRawViewer'),
      storageEstimateText: document.getElementById('storageEstimateText'),

      // Consola de eventos
      consoleLogBox: document.getElementById('consoleLogBox'),
      btnClearLog: document.getElementById('btnClearLog'),

      // Contenedor de Toast
      toastContainer: document.getElementById('toastContainer')
    };
  }

  bindEvents() {
    // Navegación por pestañas
    this.elements.tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        const targetTab = btn.getAttribute('data-tab');
        this.switchTab(targetTab);
      });
    });

    // Filtros y búsqueda en IndexedDB
    this.elements.projectSearchInput?.addEventListener('input', () => this.renderProjects());
    this.elements.filterCategory?.addEventListener('change', () => this.renderProjects());

    // Modal
    this.elements.btnOpenCreateModal?.addEventListener('click', () => this.openCreateModal());
    this.elements.btnCloseModal?.addEventListener('click', () => this.closeModal());
    this.elements.btnCancelModal?.addEventListener('click', () => this.closeModal());
    this.elements.projectForm?.addEventListener('submit', (e) => this.handleProjectFormSubmit(e));

    // Sincronización manual de cola
    this.elements.btnTriggerSync?.addEventListener('click', () => this.syncOfflineQueue());

    // Botón de alternar simulación offline
    this.elements.btnToggleOfflineSim?.addEventListener('click', () => this.toggleOfflineSimulation());

    // Laboratorio de Caché
    this.elements.btnTestCacheFirst?.addEventListener('click', () => this.testCacheFirstStrategy());
    this.elements.btnTestNetworkFirst?.addEventListener('click', () => this.testNetworkFirstStrategy());
    this.elements.btnTestSWR?.addEventListener('click', () => this.testSWRStrategy());
    this.elements.btnTestOfflineFallback?.addEventListener('click', () => this.testOfflineFallback());

    // Diagnósticos SW
    this.elements.btnCheckUpdates?.addEventListener('click', () => this.checkForSWUpdates());
    this.elements.btnClearAllCaches?.addEventListener('click', () => this.clearAllCaches());
    this.elements.btnUnregisterSW?.addEventListener('click', () => this.unregisterServiceWorker());
    this.elements.btnReRegisterSW?.addEventListener('click', () => this.registerServiceWorker(true));
    this.elements.btnApplyUpdate?.addEventListener('click', () => this.applyWaitingServiceWorker());

    // Explorador de almacenamiento
    this.elements.btnRefreshStorage?.addEventListener('click', () => this.refreshStorageExplorer());
    this.elements.btnClearLog?.addEventListener('click', () => {
      if (this.elements.consoleLogBox) this.elements.consoleLogBox.innerHTML = '';
    });
  }

  switchTab(tabId) {
    this.activeTab = tabId;
    this.elements.tabBtns.forEach(b => {
      b.classList.toggle('active', b.getAttribute('data-tab') === tabId);
    });
    this.elements.tabContents.forEach(c => {
      c.classList.toggle('active', c.id === tabId);
    });

    if (tabId === 'tab-storage') {
      this.refreshStorageExplorer();
    } else if (tabId === 'tab-idb') {
      this.refreshProjectsList();
    }
  }

  // =========================================================================
  // 1. REGISTRO, ACTUALIZACIÓN Y CICLO DE VIDA DEL SERVICE WORKER
  // =========================================================================
  async registerServiceWorker(forceReload = false) {
    if (!('serviceWorker' in navigator)) {
      this.log('Service Workers no soportados por este navegador.', 'error');
      this.updateSWDiagnosticInfo({ status: 'No soportado' });
      return;
    }

    try {
      this.log('Registrando Service Worker (./sw.js)...', 'info');
      const registration = await navigator.serviceWorker.register('./sw.js', { scope: './' });
      this.swRegistration = registration;

      this.log(`Service Worker registrado con éxito. Ámbito: ${registration.scope}`, 'success');

      // Escuchar eventos de actualización
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        this.log('Detectada nueva versión del Service Worker en instalación.', 'warn');
        this.updateTimelineStep('installing');

        newWorker.addEventListener('statechange', () => {
          this.log(`Nuevo Service Worker cambió su estado a: ${newWorker.state}`, 'info');

          if (newWorker.state === 'installed') {
            if (navigator.serviceWorker.controller) {
              // Hay una versión anterior activa y la nueva está en espera
              this.log('Nueva versión instalada y esperando activación (waiting).', 'warn');
              this.elements.swUpdateBanner?.classList.remove('hidden');
              this.showToast('Nueva versión del Service Worker disponible. Haz clic para actualizar.', 'info');
            } else {
              // Primera instalación completada
              this.log('Contenido precacheado para funcionamiento sin conexión.', 'success');
              this.showToast('App Shell precacheado. Lista para uso offline.', 'success');
            }
          } else if (newWorker.state === 'activated') {
            this.updateTimelineStep('activated');
          }
        });
      });

      // Escuchar cambios de controlador (cuando una nueva versión toma el mando)
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        this.log('Controlador del Service Worker actualizado.', 'success');
        if (forceReload) {
          window.location.reload();
        }
      });

      // Escuchar mensajes broadcast del Service Worker
      navigator.serviceWorker.addEventListener('message', (event) => {
        const data = event.data;
        if (data && data.type === 'SW_ACTIVATED') {
          this.log(`Notificación SW: Versión ${data.version} activada limpiamente.`, 'success');
          this.elements.swVersionBadge.textContent = data.version;
          this.updateSWDiagnosticInfo();
        }
      });

      this.updateSWDiagnosticInfo();
      this.updateTimelineStep(registration.active ? 'activated' : 'installed');

    } catch (err) {
      console.error('[SW Registration Error]', err);
      this.log(`Error al registrar Service Worker: ${err.message}`, 'error');
      this.updateSWDiagnosticInfo({ status: 'Error' });
    }
  }

  updateSWDiagnosticInfo() {
    const reg = this.swRegistration;
    if (!reg) return;

    let state = 'Inactivo';
    if (reg.installing) state = 'Instalando...';
    else if (reg.waiting) state = 'Esperando activación (Waiting)';
    else if (reg.active) state = 'Activo y en ejecución (Active)';

    if (this.elements.swStatusVal) this.elements.swStatusVal.textContent = state;
    if (this.elements.swScopeVal) this.elements.swScopeVal.textContent = reg.scope || './';
    if (this.elements.swVersionVal) this.elements.swVersionVal.textContent = 'v3.0.0 (novaflow)';
    if (this.elements.swControllerVal) {
      this.elements.swControllerVal.textContent = navigator.serviceWorker.controller ? 'Sí (Página controlada)' : 'No (Sin controlador directo)';
    }
  }

  updateTimelineStep(activeStep) {
    const steps = ['registered', 'installing', 'activated'];
    steps.forEach(step => {
      const el = document.getElementById(`step-${step}`);
      if (el) {
        if (step === activeStep || (activeStep === 'activated' && step !== 'installing')) {
          el.classList.add('active');
        } else if (activeStep === 'installing' && step === 'registered') {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      }
    });
  }

  async checkForSWUpdates() {
    if (!this.swRegistration) return;
    this.log('Comprobando actualizaciones del Service Worker en el servidor...', 'info');
    try {
      await this.swRegistration.update();
      this.showToast('Comprobación de actualización completada.', 'info');
      this.updateSWDiagnosticInfo();
    } catch (err) {
      this.log(`Error comprobando actualización: ${err.message}`, 'error');
    }
  }

  applyWaitingServiceWorker() {
    if (!this.swRegistration || !this.swRegistration.waiting) return;
    this.log('Enviando señal SKIP_WAITING al Service Worker en espera...', 'warn');
    this.swRegistration.waiting.postMessage({ type: 'SKIP_WAITING' });
    this.elements.swUpdateBanner?.classList.add('hidden');
    setTimeout(() => {
      window.location.reload();
    }, 400);
  }

  async unregisterServiceWorker() {
    if (!this.swRegistration) return;
    const ok = confirm('¿Deseas desregistrar el Service Worker actual?');
    if (!ok) return;

    const unregistered = await this.swRegistration.unregister();
    if (unregistered) {
      this.log('Service Worker desregistrado correctamente.', 'warn');
      this.showToast('Service Worker desregistrado.', 'warn');
      this.swRegistration = null;
      this.updateSWDiagnosticInfo();
      this.updateTimelineStep('');
    }
  }

  async clearAllCaches() {
    const ok = confirm('¿Deseas eliminar todas las cachés locales creadas por la aplicación?');
    if (!ok) return;

    this.log('Eliminando almacenes de Cache API...', 'warn');
    const keys = await caches.keys();
    await Promise.all(keys.map(k => caches.delete(k)));
    this.log(`Eliminadas ${keys.length} cachés: ${keys.join(', ')}`, 'success');
    this.showToast('Todas las cachés han sido eliminadas.', 'success');
    this.refreshStorageExplorer();
  }

  // =========================================================================
  // 2. MONITOREO DE RED Y MODO OFFLINE
  // =========================================================================
  setupNetworkMonitoring() {
    const updateStatus = () => {
      const isOnline = navigator.onLine && !this.isSimulatingOffline;
      if (isOnline) {
        this.elements.connectionStatusText.textContent = 'En Línea';
        this.elements.connectionStatusDot.className = 'status-dot online';
        this.elements.offlineAlertBanner?.classList.add('hidden');
        this.log('Conexión de red disponible.', 'success');

        // Al reconectar, disparar sincronización automática de cola pendiente
        this.syncOfflineQueue();
      } else {
        const text = this.isSimulatingOffline ? 'Offline (Simulado)' : 'Sin Conexión';
        this.elements.connectionStatusText.textContent = text;
        this.elements.connectionStatusDot.className = 'status-dot offline';
        this.elements.offlineAlertBanner?.classList.remove('hidden');
        this.log('Dispositivo sin conexión a la red. Operando en modo Offline-First con IndexedDB.', 'warn');
      }
    };

    window.addEventListener('online', updateStatus);
    window.addEventListener('offline', updateStatus);
    updateStatus();
  }

  async toggleOfflineSimulation() {
    this.isSimulatingOffline = !this.isSimulatingOffline;

    // Enviar comando al Service Worker
    if (navigator.serviceWorker.controller) {
      const channel = new MessageChannel();
      channel.port1.onmessage = (event) => {
        console.log('[App] Confirmación SW simulación offline:', event.data);
      };
      navigator.serviceWorker.controller.postMessage({
        type: 'SIMULATE_OFFLINE',
        enabled: this.isSimulatingOffline
      }, [channel.port2]);
    }

    if (this.isSimulatingOffline) {
      this.elements.btnToggleOfflineSim.textContent = 'Restaurar Red (Modo Online)';
      this.elements.btnToggleOfflineSim.classList.replace('btn-secondary', 'btn-outline-danger');
      this.showToast('Modo Offline simulado activado.', 'warn');
      this.log('Modo offline simulado activado para pruebas de resiliencia.', 'warn');
    } else {
      this.elements.btnToggleOfflineSim.textContent = 'Simular Modo Offline';
      this.elements.btnToggleOfflineSim.classList.replace('btn-outline-danger', 'btn-secondary');
      this.showToast('Conexión restaurada.', 'success');
      this.log('Modo offline simulado desactivado.', 'success');
    }

    // Disparar evento de red
    window.dispatchEvent(new Event(this.isSimulatingOffline ? 'offline' : 'online'));
  }

  // =========================================================================
  // 3. PERSISTENCIA ASÍNCRONA EN INDEXEDDB (CRUD & COLA OFFLINE)
  // =========================================================================
  async refreshProjectsList() {
    this.currentProjects = await idbManager.getAllProjects();
    this.renderProjects();
    if (this.elements.idbRecordsBadge) {
      this.elements.idbRecordsBadge.textContent = `${this.currentProjects.length} registros`;
    }
  }

  renderProjects() {
    const grid = this.elements.projectsGrid;
    if (!grid) return;

    const query = (this.elements.projectSearchInput?.value || '').toLowerCase().trim();
    const filterCat = this.elements.filterCategory?.value || 'ALL';

    const filtered = this.currentProjects.filter(p => {
      const matchesSearch = p.title.toLowerCase().includes(query) || p.description.toLowerCase().includes(query);
      const matchesCat = (filterCat === 'ALL') || (p.category === filterCat);
      return matchesSearch && matchesCat;
    });

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 3rem 1rem; color: var(--text-dim);">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" style="margin: 0 auto 1rem; opacity: 0.6;">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <p style="font-size: 1rem; font-weight: 600;">No se encontraron registros en IndexedDB</p>
          <p style="font-size: 0.85rem; margin-top: 0.25rem;">Crea un nuevo proyecto con el botón superior para persistirlo localmente.</p>
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(p => {
      const isSynced = p.syncStatus === 'synced';
      const formattedDate = new Date(p.updatedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

      return `
        <div class="project-card" data-id="${p.id}">
          <div class="project-card-header">
            <h3 class="project-title">${this.escapeHtml(p.title)}</h3>
            <span class="sync-status-badge ${isSynced ? 'synced' : 'pending'}">
              <span class="status-dot ${isSynced ? 'online' : 'syncing'}"></span>
              ${isSynced ? 'Sincronizado' : 'Pendiente (Offline)'}
            </span>
          </div>

          <p class="project-desc">${this.escapeHtml(p.description || 'Sin descripción detallada.')}</p>

          <div class="project-meta">
            <div class="meta-tags">
              <span class="meta-tag">${this.escapeHtml(p.category)}</span>
              <span class="meta-tag">${this.escapeHtml(p.priority)}</span>
            </div>
            <span>${formattedDate}</span>
          </div>

          <div class="project-actions" style="margin-top: 0.85rem; justify-content: flex-end;">
            <button class="btn btn-secondary btn-sm" onclick="app.openEditModal('${p.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"></path></svg>
              Editar
            </button>
            <button class="btn btn-outline-danger btn-sm" onclick="app.deleteProject('${p.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              Eliminar
            </button>
          </div>
        </div>
      `;
    }).join('');
  }

  openCreateModal() {
    this.elements.modalTitle.textContent = 'Nuevo Proyecto (Persistencia Offline)';
    this.elements.projectIdInput.value = '';
    this.elements.projectForm.reset();
    this.elements.projectModal.classList.remove('hidden');
    this.elements.projectTitleInput.focus();
  }

  openEditModal(id) {
    const project = this.currentProjects.find(p => p.id === id);
    if (!project) return;

    this.elements.modalTitle.textContent = 'Editar Proyecto';
    this.elements.projectIdInput.value = project.id;
    this.elements.projectTitleInput.value = project.title;
    this.elements.projectDescInput.value = project.description || '';
    this.elements.projectCategoryInput.value = project.category;
    this.elements.projectPriorityInput.value = project.priority;
    this.elements.projectStatusInput.value = project.status;
    this.elements.projectModal.classList.remove('hidden');
  }

  closeModal() {
    this.elements.projectModal?.classList.add('hidden');
  }

  async handleProjectFormSubmit(e) {
    e.preventDefault();
    const id = this.elements.projectIdInput.value || `proj-${Date.now()}`;
    const isEditing = !!this.elements.projectIdInput.value;
    const isOnline = navigator.onLine && !this.isSimulatingOffline;

    const projectData = {
      id,
      title: this.elements.projectTitleInput.value.trim(),
      description: this.elements.projectDescInput.value.trim(),
      category: this.elements.projectCategoryInput.value,
      priority: this.elements.projectPriorityInput.value,
      status: this.elements.projectStatusInput.value,
      syncStatus: isOnline ? 'synced' : 'pending',
      updatedAt: new Date().toISOString()
    };

    // 1. Guardar de inmediato en IndexedDB (Arquitectura Offline-First)
    await idbManager.saveProject(projectData);
    this.log(`Proyecto '${projectData.title}' guardado localmente en IndexedDB.`, 'success');

    // 2. Si no hay conexión o está simulada, registrar en la cola offline
    if (!isOnline) {
      await idbManager.addToSyncQueue(isEditing ? 'UPDATE' : 'CREATE', projectData);
      this.showToast('Guardado en IndexedDB (Pendiente de sincronizar)', 'warn');
      this.log(`Operación registrada en la cola offline para sincronización posterior.`, 'warn');
    } else {
      // Si está en línea, notificar al servidor y mantener consistencia
      try {
        await fetch('/api/projects', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(projectData)
        });
        this.showToast('Proyecto guardado y sincronizado con el servidor.', 'success');
      } catch (err) {
        console.warn('[Sync fallback] Servidor inalcanzable, encolando operación...');
        projectData.syncStatus = 'pending';
        await idbManager.saveProject(projectData);
        await idbManager.addToSyncQueue(isEditing ? 'UPDATE' : 'CREATE', projectData);
        this.showToast('Guardado en IndexedDB localmente.', 'info');
      }
    }

    this.closeModal();
    await this.refreshProjectsList();
    await this.updateSyncQueueBadge();
  }

  async deleteProject(id) {
    const isOnline = navigator.onLine && !this.isSimulatingOffline;
    const project = this.currentProjects.find(p => p.id === id);
    if (!confirm(`¿Eliminar proyecto "${project?.title || id}"?`)) return;

    // Eliminar de IndexedDB
    await idbManager.deleteProject(id);
    this.log(`Proyecto ${id} eliminado de IndexedDB.`, 'warn');

    if (!isOnline) {
      await idbManager.addToSyncQueue('DELETE', { id });
      this.showToast('Eliminado localmente. Sincronización pendiente.', 'warn');
    } else {
      this.showToast('Proyecto eliminado localmente y sincronizado.', 'info');
    }

    await this.refreshProjectsList();
    await this.updateSyncQueueBadge();
  }

  async updateSyncQueueBadge() {
    const queue = await idbManager.getSyncQueue();
    const count = queue.length;
    if (this.elements.syncPendingBadge) {
      this.elements.syncPendingBadge.textContent = count;
      this.elements.syncPendingBadge.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  }

  async syncOfflineQueue() {
    const isOnline = navigator.onLine && !this.isSimulatingOffline;
    if (!isOnline) {
      this.showToast('No se puede sincronizar: El dispositivo está sin conexión.', 'warn');
      this.log('Intento de sincronización cancelado: Sin conexión.', 'warn');
      return;
    }

    const queue = await idbManager.getSyncQueue();
    if (queue.length === 0) {
      this.showToast('Todos los datos están sincronizados.', 'info');
      this.log('Cola offline vacía. Todo está al día.', 'info');
      return;
    }

    this.log(`Iniciando sincronización de ${queue.length} operaciones offline...`, 'info');
    try {
      const response = await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queue })
      });

      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const result = await response.json();
      this.log(`Sincronización completada en el servidor: ${result.syncedCount} cambios procesados.`, 'success');

      // Actualizar estado en IndexedDB a 'synced'
      const projects = await idbManager.getAllProjects();
      for (const p of projects) {
        if (p.syncStatus === 'pending') {
          p.syncStatus = 'synced';
          await idbManager.saveProject(p);
        }
      }

      // Limpiar cola offline
      await idbManager.clearSyncQueue();
      await this.updateSyncQueueBadge();
      await this.refreshProjectsList();
      this.showToast(`Sincronización exitosa (${result.syncedCount} elementos)`, 'success');
    } catch (err) {
      this.log(`Error al sincronizar con el servidor: ${err.message}`, 'error');
      this.showToast('Fallo en sincronización. Se reintentará luego.', 'error');
    }
  }

  // =========================================================================
  // 4. LABORATORIO INTERACTIVO DE ESTRATEGIAS DE CACHÉ
  // =========================================================================

  /**
   * Prueba de Estrategia: Cache-First
   */
  async testCacheFirstStrategy() {
    const targetUrl = './styles.css';
    this.log(`[Cache-First Test] Solicitando recurso estático: ${targetUrl}`, 'info');

    const start = performance.now();
    try {
      const response = await fetch(targetUrl);
      const elapsed = (performance.now() - start).toFixed(1);
      const isFromCache = elapsed < 15; // Tiempos menores a 15ms evidencian servicio inmediato desde caché

      this.log(`[Cache-First] Completado en ${elapsed}ms | Estado HTTP: ${response.status}`, 'success');
      this.updateBenchmarkDisplay('Cache-First (styles.css)', `${elapsed} ms`, isFromCache ? 'Hit (Caché local)' : 'Red (Guardado en caché)');
    } catch (err) {
      this.log(`[Cache-First] Error: ${err.message}`, 'error');
    }
  }

  /**
   * Prueba de Estrategia: Network-First con Fallback a Caché
   */
  async testNetworkFirstStrategy() {
    const targetUrl = '/api/projects';
    this.log(`[Network-First Test] Solicitando API fresca: ${targetUrl}`, 'info');

    const start = performance.now();
    try {
      const response = await fetch(targetUrl);
      const elapsed = (performance.now() - start).toFixed(1);
      const data = await response.json();
      const servedFrom = response.headers.get('X-NovaFlow-Served-From') || (data.source === 'service_worker_offline_fallback' ? 'Offline Fallback' : 'Red Servidor');

      this.log(`[Network-First] Respuesta recibida en ${elapsed}ms. Origen: ${servedFrom}`, 'success');
      this.updateBenchmarkDisplay('Network-First (/api/projects)', `${elapsed} ms`, servedFrom);
    } catch (err) {
      this.log(`[Network-First] Excepción capturada: ${err.message}`, 'warn');
    }
  }

  /**
   * Prueba de Estrategia: Stale-While-Revalidate
   */
  async testSWRStrategy() {
    const targetUrl = '/api/feed';
    this.log(`[Stale-While-Revalidate] Solicitando feed: ${targetUrl}`, 'info');

    const start = performance.now();
    try {
      const response = await fetch(targetUrl);
      const elapsed = (performance.now() - start).toFixed(1);
      const data = await response.json();

      this.log(`[SWR] Respuesta inmediata entregada (${elapsed}ms). Versión de feed: ${data.version || 'Local'}. Revalidando en segundo plano...`, 'success');
      this.updateBenchmarkDisplay('Stale-While-Revalidate (/api/feed)', `${elapsed} ms`, `Feed #${data.version || 1} (Revalidando)`);
    } catch (err) {
      this.log(`[SWR] Error en feed: ${err.message}`, 'warn');
    }
  }

  /**
   * Prueba de Fallback Offline de Navegación
   */
  testOfflineFallback() {
    this.log('[Offline Fallback] Abriendo ruta no precacheada en nueva pestaña para observar fallback...', 'info');
    window.open('./offline-test-route-' + Date.now(), '_blank');
  }

  updateBenchmarkDisplay(strategy, time, source) {
    if (!this.elements.cacheBenchmarkResult) return;
    this.elements.cacheBenchmarkResult.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.5rem; background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(14, 165, 233, 0.3); border-radius: 8px;">
        <span style="font-weight: 600; color: #38bdf8;">${strategy}</span>
        <span style="font-family: var(--font-mono); color: #f8fafc;">${time} &bull; <strong style="color: #34d399;">${source}</strong></span>
      </div>
    `;
  }

  // =========================================================================
  // 5. EXPLORADOR EN VIVO DE ALMACENAMIENTO (CACHE API & INDEXEDDB)
  // =========================================================================
  async refreshStorageExplorer() {
    // 1. Explorar Cache API
    if (this.elements.cacheListContainer) {
      try {
        const cacheKeys = await caches.keys();
        if (cacheKeys.length === 0) {
          this.elements.cacheListContainer.innerHTML = '<p style="color: var(--text-dim); font-size: 0.85rem;">No hay almacenes de caché registrados.</p>';
        } else {
          let html = '';
          for (const key of cacheKeys) {
            const cache = await caches.open(key);
            const requests = await cache.keys();
            html += `
              <div style="background: rgba(15, 23, 42, 0.6); border: 1px solid var(--border-glass); border-radius: 8px; padding: 0.85rem; margin-bottom: 0.75rem;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                  <strong style="color: #38bdf8; font-family: var(--font-mono); font-size: 0.85rem;">${key}</strong>
                  <span style="font-size: 0.75rem; background: rgba(56, 189, 248, 0.15); color: #38bdf8; padding: 0.15rem 0.5rem; border-radius: 999px;">
                    ${requests.length} recursos
                  </span>
                </div>
                <div style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); max-height: 90px; overflow-y: auto;">
                  ${requests.slice(0, 10).map(r => `<div>&bull; ${new URL(r.url).pathname}</div>`).join('')}
                  ${requests.length > 10 ? `<div style="color: var(--text-dim);">... y ${requests.length - 10} más</div>` : ''}
                </div>
              </div>
            `;
          }
          this.elements.cacheListContainer.innerHTML = html;
        }
      } catch (e) {
        this.elements.cacheListContainer.innerHTML = `<p style="color: #f87171;">Error al leer Cache API: ${e.message}</p>`;
      }
    }

    // 2. Explorar IndexedDB (Snapshot Crudo)
    if (this.elements.idbRawViewer) {
      try {
        const rawData = await idbManager.exportRawData();
        this.elements.idbRawViewer.textContent = JSON.stringify(rawData, null, 2);
      } catch (e) {
        this.elements.idbRawViewer.textContent = `Error al inspeccionar IndexedDB: ${e.message}`;
      }
    }

    // 3. Estimar Cuota
    if (this.elements.storageEstimateText) {
      const stats = await idbManager.getStorageStats();
      const estimate = stats.storageEstimate;
      const usedMB = (estimate.usage / (1024 * 1024)).toFixed(2);
      const totalMB = (estimate.quota / (1024 * 1024)).toFixed(0);
      this.elements.storageEstimateText.textContent = `Uso: ${usedMB} MB / Cuota: ${totalMB} MB (${estimate.percent}%)`;
    }
  }

  // =========================================================================
  // REGISTRO DE CONSOLA Y TOASTS
  // =========================================================================
  log(message, type = 'info') {
    const box = this.elements.consoleLogBox;
    if (!box) return;

    const time = new Date().toLocaleTimeString();
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.innerHTML = `
      <span class="log-time">[${time}]</span>
      <span class="log-${type}">${this.escapeHtml(message)}</span>
    `;

    box.appendChild(entry);
    box.scrollTop = box.scrollHeight;
  }

  showToast(message, type = 'info') {
    const container = this.elements.toastContainer;
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `
      <span class="status-dot ${type === 'success' ? 'online' : type === 'warn' ? 'syncing' : 'online'}"></span>
      <span>${this.escapeHtml(message)}</span>
    `;

    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }
}

// Instanciar globalmente
let app;
window.addEventListener('DOMContentLoaded', () => {
  app = new NovaFlowApp();
  app.init();
});
