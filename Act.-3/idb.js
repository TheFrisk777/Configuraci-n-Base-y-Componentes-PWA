/**
 * ============================================================================
 * INDEXEDDB ASYNCHRONOUS STORAGE MANAGER — NOVAFLOW v3
 * ============================================================================
 * Proporciona persistencia de datos local, transaccional y asíncrona mediante
 * Promesas para permitir el funcionamiento de lectura/escritura en modo offline.
 */

const DB_NAME = 'NovaFlow_OfflineDB_v3';
const DB_VERSION = 1;

class IndexedDBManager {
  constructor() {
    this.db = null;
    this.initPromise = null;
  }

  /**
   * Inicializa la conexión a IndexedDB y crea los almacenes de objetos si no existen.
   */
  async init() {
    if (this.db) return this.db;
    if (this.initPromise) return this.initPromise;

    this.initPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        return reject(new Error('IndexedDB no es soportado por este navegador.'));
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = (event) => {
        const db = event.target.result;
        console.log('[IndexedDB] Creando o actualizando esquema v' + DB_VERSION);

        // 1. Almacén de Proyectos / Tareas principales
        if (!db.objectStoreNames.contains('projects')) {
          const projectStore = db.createObjectStore('projects', { keyPath: 'id' });
          projectStore.createIndex('category', 'category', { unique: false });
          projectStore.createIndex('status', 'status', { unique: false });
          projectStore.createIndex('priority', 'priority', { unique: false });
          projectStore.createIndex('syncStatus', 'syncStatus', { unique: false });
          projectStore.createIndex('updatedAt', 'updatedAt', { unique: false });
        }

        // 2. Cola de sincronización para mutaciones offline (Creaciones, Ediciones, Bajas)
        if (!db.objectStoreNames.contains('offline_queue')) {
          const queueStore = db.createObjectStore('offline_queue', { keyPath: 'queueId', autoIncrement: true });
          queueStore.createIndex('action', 'action', { unique: false });
          queueStore.createIndex('timestamp', 'timestamp', { unique: false });
        }

        // 3. Almacén de snapshots de métricas y analíticas offline
        if (!db.objectStoreNames.contains('analytics_snapshots')) {
          db.createObjectStore('analytics_snapshots', { keyPath: 'key' });
        }
      };

      request.onsuccess = (event) => {
        this.db = event.target.result;
        console.log('[IndexedDB] Conexión establecida con éxito:', DB_NAME);
        resolve(this.db);
      };

      request.onerror = (event) => {
        console.error('[IndexedDB] Error al abrir base de datos:', event.target.error);
        reject(event.target.error);
      };
    });

    return this.initPromise;
  }

  /**
   * Helper para ejecutar transacciones con Promesas
   */
  async getStore(storeName, mode = 'readonly') {
    const db = await this.init();
    const transaction = db.transaction(storeName, mode);
    return transaction.objectStore(storeName);
  }

  // =========================================================================
  // OPERACIONES CRUD PARA PROYECTOS (DATOS OFFLINE)
  // =========================================================================

  /**
   * Obtiene todos los proyectos almacenados localmente
   */
  async getAllProjects() {
    const store = await this.getStore('projects', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Obtiene un proyecto por su ID
   */
  async getProjectById(id) {
    const store = await this.getStore('projects', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Guarda o actualiza un proyecto en IndexedDB
   */
  async saveProject(project) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('projects', 'readwrite');
      const store = transaction.objectStore('projects');
      
      const record = {
        ...project,
        updatedAt: project.updatedAt || new Date().toISOString()
      };

      const request = store.put(record);
      request.onsuccess = () => resolve(record);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Elimina un proyecto de IndexedDB
   */
  async deleteProject(id) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('projects', 'readwrite');
      const store = transaction.objectStore('projects');
      const request = store.delete(id);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // =========================================================================
  // COLA ASÍNCRONA DE SINCRONIZACIÓN OFFLINE (OFFLINE MUTATION QUEUE)
  // =========================================================================

  /**
   * Agrega una operación pendiente a la cola offline
   * @param {'CREATE'|'UPDATE'|'DELETE'} action 
   * @param {Object} data 
   */
  async addToSyncQueue(action, data) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('offline_queue', 'readwrite');
      const store = transaction.objectStore('offline_queue');

      const queueItem = {
        action,
        data,
        timestamp: new Date().toISOString()
      };

      const request = store.add(queueItem);
      request.onsuccess = () => {
        console.log(`[IndexedDB] Operación '${action}' añadida a la cola offline:`, data.id);
        resolve(request.result);
      };
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Obtiene todos los elementos pendientes en la cola offline
   */
  async getSyncQueue() {
    const store = await this.getStore('offline_queue', 'readonly');
    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Elimina un ítem específico de la cola tras haber sido sincronizado con el servidor
   */
  async removeSyncQueueItem(queueId) {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('offline_queue', 'readwrite');
      const store = transaction.objectStore('offline_queue');
      const request = store.delete(queueId);
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  /**
   * Limpia toda la cola de sincronización
   */
  async clearSyncQueue() {
    const db = await this.init();
    return new Promise((resolve, reject) => {
      const transaction = db.transaction('offline_queue', 'readwrite');
      const store = transaction.objectStore('offline_queue');
      const request = store.clear();
      request.onsuccess = () => resolve(true);
      request.onerror = () => reject(request.error);
    });
  }

  // =========================================================================
  // SEMILLAS DE DATOS INICIALES (DEMOSTRACIÓN RICA INMEDIATA)
  // =========================================================================

  /**
   * Pre-carga proyectos representativos si la base de datos está vacía
   */
  async seedInitialDataIfEmpty() {
    const projects = await this.getAllProjects();
    if (projects.length > 0) {
      return projects;
    }

    console.log('[IndexedDB] Base de datos vacía. Sembrando registros iniciales para modo offline...');
    const seedRecords = [
      {
        id: 'proj-001',
        title: 'Dashboard de Resiliencia PWA',
        description: 'Implementación de arquitectura Offline-First con sincronización en segundo plano.',
        category: 'Frontend',
        priority: 'Alta',
        status: 'En Progreso',
        syncStatus: 'synced',
        updatedAt: new Date(Date.now() - 3600000 * 2).toISOString()
      },
      {
        id: 'proj-002',
        title: 'Estrategia de Caché Network-First',
        description: 'Garantizar que los datos frescos del servidor tengan prioridad con fallback local inmediato.',
        category: 'Service Worker',
        priority: 'Crítica',
        status: 'Completado',
        syncStatus: 'synced',
        updatedAt: new Date(Date.now() - 3600000 * 5).toISOString()
      },
      {
        id: 'proj-003',
        title: 'Almacén Transaccional IndexedDB',
        description: 'Estructuración de esquemas e índices para consultas rápidas sin depender de conexión.',
        category: 'Persistencia',
        priority: 'Media',
        status: 'Completado',
        syncStatus: 'synced',
        updatedAt: new Date(Date.now() - 3600000 * 12).toISOString()
      },
      {
        id: 'proj-004',
        title: 'Trimming Dinámico de Caché LRU',
        description: 'Control de cuota para mantener un máximo de 50 entradas en la memoria caché dinámica.',
        category: 'Rendimiento',
        priority: 'Baja',
        status: 'Pendiente',
        syncStatus: 'synced',
        updatedAt: new Date(Date.now() - 3600000 * 24).toISOString()
      }
    ];

    for (const record of seedRecords) {
      await this.saveProject(record);
    }

    return seedRecords;
  }

  // =========================================================================
  // DIAGNÓSTICO Y EXPORTACIÓN DE ESTADO
  // =========================================================================

  /**
   * Obtiene estadísticas de ocupación y cuota de almacenamiento
   */
  async getStorageStats() {
    const projects = await this.getAllProjects();
    const queue = await this.getSyncQueue();

    let storageEstimate = { usage: 0, quota: 0, percent: 0 };
    if (navigator.storage && navigator.storage.estimate) {
      try {
        const estimate = await navigator.storage.estimate();
        storageEstimate.usage = estimate.usage || 0;
        storageEstimate.quota = estimate.quota || 0;
        storageEstimate.percent = estimate.quota ? ((estimate.usage / estimate.quota) * 100).toFixed(2) : 0;
      } catch (e) {
        console.warn('[IndexedDB] No se pudo estimar cuota de almacenamiento:', e);
      }
    }

    return {
      dbName: DB_NAME,
      version: DB_VERSION,
      projectsCount: projects.length,
      pendingQueueCount: queue.length,
      storageEstimate
    };
  }

  /**
   * Exporta todo el contenido para el inspector visual en UI
   */
  async exportRawData() {
    const projects = await this.getAllProjects();
    const queue = await this.getSyncQueue();
    return {
      projects,
      offlineQueue: queue
    };
  }
}

// Instancia global exportada
const idbManager = new IndexedDBManager();
