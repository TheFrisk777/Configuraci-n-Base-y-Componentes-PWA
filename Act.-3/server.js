const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 8080;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

// Almacén en memoria de proyectos del servidor
let serverProjects = [
  {
    id: 'proj-101',
    title: 'Migración a Service Workers v3',
    description: 'Implementación de ciclos de vida limpios y caché multi-estrategia.',
    category: 'Arquitectura',
    priority: 'Alta',
    status: 'En Progreso',
    syncStatus: 'synced',
    updatedAt: new Date(Date.now() - 3600000 * 2).toISOString()
  },
  {
    id: 'proj-102',
    title: 'Persistencia Offline con IndexedDB',
    description: 'Estructuración de almacén de objetos y cola transaccional asíncrona.',
    category: 'Base de Datos',
    priority: 'Crítica',
    status: 'Completado',
    syncStatus: 'synced',
    updatedAt: new Date(Date.now() - 3600000 * 6).toISOString()
  },
  {
    id: 'proj-103',
    title: 'Auditoría Lighthouse PWA & PWA Installability',
    description: 'Verificación de puntuación 100/100 en DevTools y modo standalone.',
    category: 'Optimización',
    priority: 'Media',
    status: 'Pendiente',
    syncStatus: 'synced',
    updatedAt: new Date(Date.now() - 3600000 * 24).toISOString()
  }
];

let feedCounter = 1;

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (err) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // Habilitar CORS para pruebas de desarrollo
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // =========================================================================
  // ENDPOINTS DE API DINÁMICA (Para demostrar Cache Strategies e IndexedDB Sync)
  // =========================================================================

  // 1. Estado del Servidor
  if (pathname === '/api/status' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' });
    res.end(JSON.stringify({ status: 'online', serverTime: new Date().toISOString() }));
    return;
  }

  // 2. Obtener Proyectos (Estrategia Network-First con Fallback)
  if (pathname === '/api/projects' && req.method === 'GET') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Served-By': 'Node-Mock-Server'
    });
    res.end(JSON.stringify({
      success: true,
      timestamp: new Date().toISOString(),
      source: 'server_network',
      count: serverProjects.length,
      data: serverProjects
    }));
    return;
  }

  // 3. Crear Proyecto Individual
  if (pathname === '/api/projects' && req.method === 'POST') {
    const body = await parseBody(req);
    const newProject = {
      id: body.id || `proj-${Date.now()}`,
      title: body.title || 'Proyecto sin título',
      description: body.description || '',
      category: body.category || 'General',
      priority: body.priority || 'Media',
      status: body.status || 'Pendiente',
      syncStatus: 'synced',
      updatedAt: new Date().toISOString()
    };
    serverProjects.unshift(newProject);

    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: 'Proyecto registrado en servidor central',
      project: newProject
    }));
    return;
  }

  // 4. Endpoint de Sincronización Masiva de Cola Offline (IndexedDB -> Server)
  if (pathname === '/api/sync' && req.method === 'POST') {
    const body = await parseBody(req);
    const queue = body.queue || [];
    let syncedCount = 0;

    for (const item of queue) {
      if (item.action === 'CREATE') {
        const existingIndex = serverProjects.findIndex(p => p.id === item.data.id);
        if (existingIndex >= 0) {
          serverProjects[existingIndex] = { ...item.data, syncStatus: 'synced' };
        } else {
          serverProjects.unshift({ ...item.data, syncStatus: 'synced' });
        }
        syncedCount++;
      } else if (item.action === 'UPDATE') {
        const idx = serverProjects.findIndex(p => p.id === item.data.id);
        if (idx >= 0) {
          serverProjects[idx] = { ...item.data, syncStatus: 'synced' };
        } else {
          serverProjects.unshift({ ...item.data, syncStatus: 'synced' });
        }
        syncedCount++;
      } else if (item.action === 'DELETE') {
        serverProjects = serverProjects.filter(p => p.id !== item.data.id);
        syncedCount++;
      }
    }

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      success: true,
      message: `Sincronización completada exitosamente. ${syncedCount} operaciones procesadas.`,
      syncedCount,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // 5. Endpoint de Feed Dinámico (Para demostrar Stale-While-Revalidate)
  if (pathname === '/api/feed' && req.method === 'GET') {
    feedCounter++;
    const now = new Date();
    const feed = {
      version: feedCounter,
      serverTime: now.toLocaleTimeString(),
      metrics: {
        activeWorkers: Math.floor(Math.random() * 8) + 12,
        throughput: `${(Math.random() * 5 + 95).toFixed(1)} req/s`,
        cacheHitRatio: '98.4%'
      },
      latestAlert: `Evento del sistema #${feedCounter}: Sincronización y estado saludable a las ${now.toLocaleTimeString()}`
    };

    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache'
    });
    res.end(JSON.stringify(feed));
    return;
  }

  // =========================================================================
  // SERVICIO DE ARCHIVOS ESTÁTICOS
  // =========================================================================
  let reqUrl = pathname;
  if (reqUrl === '/') reqUrl = '/index.html';

  const filePath = path.join(__dirname, reqUrl);
  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Recurso no encontrado');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end(`Error del Servidor: ${err.code}`);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Cache-Control': 'no-cache',
        'Service-Worker-Allowed': '/'
      });
      res.end(content);
    }
  });
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    const ALT_PORT = 8085;
    console.log(`[NovaFlow Server Act.-3] Puerto ${PORT} en uso. Reintentando automáticamente en http://localhost:${ALT_PORT}/`);
    server.listen(ALT_PORT, () => {
      console.log(`[NovaFlow Server Act.-3] Servidor activo en http://localhost:${ALT_PORT}/`);
      console.log(`[NovaFlow Server Act.-3] API REST disponible: /api/projects, /api/sync, /api/feed`);
    });
  } else {
    console.error('[NovaFlow Server Error]', err);
  }
});

server.listen(PORT, () => {
  console.log(`[NovaFlow Server Act.-3] Activo en http://localhost:${PORT}/`);
  console.log(`[NovaFlow Server Act.-3] API REST disponible: /api/projects, /api/sync, /api/feed`);
});

