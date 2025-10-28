// Unified Express server for dev & prod. Provides:
//  - Static serving of project root & /pointclouds with no-store caching
//  - /api/projects list & deletion endpoints
//  - /upload-chunk for (chunked) file uploads assembling into pointclouds
// Exported startServer(options) so gulp or direct node execution can reuse the same instance.

const express = require('express');
const multer = require('multer');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');

// عدل هذا الرقم فقط لتغيير المنفذ الافتراضي (يمكن تجاوزه عبر env PORT أو تمرير startServer({port}))
// تم تغييره بناءً على طلب المستخدم من 4000 إلى 3000
const DEFAULT_PORT = 3000; // مثال: 8080 أو 5000

function startServer(userOptions = {}) {
  const envPort = (() => {
    const candidates = [process.env.PORT, process.env.APP_PORT];
    for (const p of candidates) {
      if (!p) continue;
      const s = String(p).trim();
      if (!s) continue;
      const n = Number(s);
      if (Number.isFinite(n) && n > 0) return n;
    }
    return null;
  })();
  const options = {
    port: envPort || DEFAULT_PORT,
    basePath: '/',
    jsonLimit: '2gb',
    chunkTTLHours: 24,
    cleanupIntervalMin: 180,
    root: __dirname,
    ...userOptions // يسمح لك بالتمرير يدوياً إن احتجت (مثلاً startServer({port: 5000}))
  };

  if (!options.basePath.endsWith('/')) options.basePath += '/';

  const app = express();
  app.set('trust proxy', true);

  const ROOT = options.root;
  const POINTCLOUDS_DIR = path.join(ROOT, 'pointclouds');
  const UPLOAD_CHUNKS_DIR = path.join(ROOT, 'uploads', 'chunks');

  for (const d of [POINTCLOUDS_DIR, UPLOAD_CHUNKS_DIR]) {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
  }

  app.disable('x-powered-by');
  app.use(express.json({ limit: options.jsonLimit }));
  app.use(express.urlencoded({ limit: options.jsonLimit, extended: true }));

  // Make root land on the login page
  app.get(options.basePath, (req, res) => {
    res.redirect(options.basePath + 'page/login/login.html');
  });

  app.use(options.basePath + 'pointclouds', express.static(POINTCLOUDS_DIR, {
    etag: false,
    cacheControl: false,
    lastModified: true,
    setHeaders: (res) => {
      res.set('Cache-Control', 'no-store');
      res.set('Accept-Ranges', 'bytes');
    }
  }));

  app.use(options.basePath, express.static(ROOT));

  // Health check for uptime and proxy testing
  app.get(options.basePath + 'api/health', (req, res) => {
    res.json({ ok: true, port: options.port, time: Date.now() });
  });

  // مراقبة الطلبات التي تبدأ بـ /api لأي تشخيص
  app.use((req, res, next) => {
    if (req.path.startsWith('/api/')) {
      console.log('[API-IN]', req.method, req.path);
    }
    next();
  });

  function safeProjectName(raw) {
    if (!raw) return null;
    if (raw.includes('..') || raw.includes('/') || raw.includes('\\')) return null;
    return raw;
  }

  function getDirSizeSync(dirPath) {
    let total = 0;
    const stack = [dirPath];
    while (stack.length) {
      const current = stack.pop();
      let entries = [];
      try { entries = fs.readdirSync(current, { withFileTypes: true }); } catch { continue; }
      for (const ent of entries) {
        const full = path.join(current, ent.name);
        try {
          const st = fs.statSync(full);
          if (st.isDirectory()) stack.push(full); else total += st.size;
        } catch { }
      }
    }
    return total;
  }

  app.get(options.basePath + 'api/projects', async (req, res) => {
    console.log('[API] listing projects');
    try {
      if (!fs.existsSync(POINTCLOUDS_DIR)) return res.json({ items: [] });
      const dirs = fs.readdirSync(POINTCLOUDS_DIR, { withFileTypes: true })
        .filter(d => d.isDirectory())
        .map(d => d.name);
      const items = [];
      for (const name of dirs) {
        const full = path.join(POINTCLOUDS_DIR, name);
        let mtime = Date.now();
        try { mtime = fs.statSync(full).mtimeMs; } catch {}
        const sizeBytes = getDirSizeSync(full);
        items.push({ name, sizeBytes, mtime });
      }
      items.sort((a, b) => (b.mtime || 0) - (a.mtime || 0));
      res.json({ items });
    } catch (e) {
      console.error('projects list error:', e);
      res.status(500).json({ error: 'failed to read projects' });
    }
  });

  app.delete(options.basePath + 'api/projects/:name', (req, res) => {
    try {
      const name = safeProjectName(req.params.name || '');
      if (!name) return res.status(400).json({ error: 'invalid project name' });
      const dirPath = path.join(POINTCLOUDS_DIR, name);
      if (!fs.existsSync(dirPath)) return res.status(404).json({ error: 'not found' });
      fs.rmSync(dirPath, { recursive: true, force: true });
      res.json({ status: 'deleted', name });
    } catch (e) {
      console.error('delete project error:', e);
      res.status(500).json({ error: 'failed to delete' });
    }
  });

  app.post(options.basePath + 'api/projects/:name/delete', (req, res) => {
    try {
      const name = safeProjectName(req.params.name || '');
      if (!name) return res.status(400).json({ error: 'invalid project name' });
      const dirPath = path.join(POINTCLOUDS_DIR, name);
      if (!fs.existsSync(dirPath)) return res.status(404).json({ error: 'not found' });
      fs.rmSync(dirPath, { recursive: true, force: true });
      res.json({ status: 'deleted', name });
    } catch (e) {
      console.error('delete project (POST) error:', e);
      res.status(500).json({ error: 'failed to delete' });
    }
  });

  const uploadAny = multer({ dest: UPLOAD_CHUNKS_DIR });

  app.post(options.basePath + 'upload-chunk', uploadAny.any(), (req, res) => {
    try {
      const uploadedFile = Array.isArray(req.files) && req.files.length > 0 ? req.files[0] : null;
      if (!uploadedFile) return res.status(400).json({ error: 'no file received' });

      const filename = (req.body.fileName || req.body.filename || uploadedFile.originalname).toString();
      const folderName = (req.body.customName || req.body.folderName || 'uploads').toString();
      const rawChunkIndex = req.body.chunkIndex;
      const rawTotalChunks = req.body.totalChunks;
      const isChunked = rawChunkIndex !== undefined && rawTotalChunks !== undefined;

      if (!isChunked) {
        const targetDir = path.join(POINTCLOUDS_DIR, folderName);
        const targetPath = path.join(targetDir, filename);
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });
        fs.renameSync(uploadedFile.path, targetPath);
        return res.json({ status: 'uploaded', name: filename, url: `${options.basePath}pointclouds/${encodeURIComponent(folderName)}/${encodeURIComponent(filename)}` });
      }

      const chunkIndex = parseInt(rawChunkIndex, 10);
      const totalChunks = parseInt(rawTotalChunks, 10);
      if (Number.isNaN(chunkIndex) || Number.isNaN(totalChunks)) {
        return res.status(400).json({ error: 'invalid chunk indices' });
      }

      const chunkDir = path.join(UPLOAD_CHUNKS_DIR, filename + '_' + folderName);
      fs.mkdirSync(chunkDir, { recursive: true });
      const destPath = path.join(chunkDir, `chunk_${chunkIndex}`);
      fs.renameSync(uploadedFile.path, destPath);

      if (chunkIndex + 1 < totalChunks) {
        return res.json({ status: 'chunk received', chunkIndex });
      }

      if (chunkIndex + 1 === totalChunks) {
        const targetDir = path.join(POINTCLOUDS_DIR, folderName);
        const targetPath = path.join(targetDir, filename);
        const tempPath = targetPath + '.tmp';
        fs.mkdirSync(path.dirname(targetPath), { recursive: true });

        let missing = null;
        for (let i = 0; i < totalChunks; i++) {
          const partPath = path.join(chunkDir, `chunk_${i}`);
          if (!fs.existsSync(partPath)) { missing = partPath; break; }
        }
        if (missing) {
          return res.status(409).json({ error: 'missing chunk', path: missing });
        }

        const writeStream = fs.createWriteStream(tempPath);
        for (let i = 0; i < totalChunks; i++) {
          const partPath = path.join(chunkDir, `chunk_${i}`);
          const data = fs.readFileSync(partPath);
          writeStream.write(data);
          fs.unlinkSync(partPath);
        }
        writeStream.end(() => {
          try { fs.renameSync(tempPath, targetPath); } catch (e) { console.error('rename temp failed:', e); }
          try { fs.rmSync(chunkDir, { recursive: true, force: true }); } catch {}
          return res.json({ status: 'assembled', file: filename, dir: folderName });
        });
      }
    } catch (e) {
      console.error('Upload error:', e);
      return res.status(500).json({ error: 'upload failed' });
    }
  });

  const server = app.listen(options.port, () => {
    console.log(`Server running on http://localhost:${options.port}${options.basePath}`);
    console.log('POINTCLOUDS_DIR:', POINTCLOUDS_DIR);
    if (options.chunkTTLHours > 0) {
      const runCleanup = async () => {
        const now = Date.now();
        const ttlMs = options.chunkTTLHours * 3600 * 1000;
        let removed = 0;
        try {
          const entries = await fsp.readdir(UPLOAD_CHUNKS_DIR, { withFileTypes: true });
          for (const ent of entries) {
            if (!ent.isDirectory()) continue;
            const full = path.join(UPLOAD_CHUNKS_DIR, ent.name);
            try {
              const st = await fsp.stat(full);
              if (now - st.mtimeMs > ttlMs) {
                await fsp.rm(full, { recursive: true, force: true });
                removed++;
              }
            } catch {}
          }
          if (removed > 0) {
            console.log(`[cleanup] Removed ${removed} stale chunk folders (> ${options.chunkTTLHours}h old)`);
          }
        } catch (e) {
          console.warn('[cleanup] error:', e.message);
        }
      };
      setTimeout(runCleanup, 30 * 1000);
      setInterval(runCleanup, options.cleanupIntervalMin * 60 * 1000);
      console.log(`[cleanup] Scheduled: every ${options.cleanupIntervalMin} min, TTL=${options.chunkTTLHours}h`);
    }
  });

  return { app, server, options };
}

module.exports = { startServer };

if (require.main === module) {
  startServer();
}
