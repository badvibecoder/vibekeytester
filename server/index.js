// vibekeytester — server entrypoint
// Dependency-free (Node built-ins only): serves the static frontend plus a
// small JSON API:
//   GET  /api/health    -> liveness check
//   GET  /api/settings  -> persisted UI settings
//   POST /api/settings  -> merge + persist UI settings
//
// Static + media:
//   /          -> frontend (public/)
//   /thock/..  -> keyboard sound pack (config.json + audio)
//
// User data (settings) lives in ~/.vibekeytester/ (override with VIBE_DATA_DIR).
// Packaged single-file mode reads assets from server/embedded.mjs.

import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { EMBEDDED } from './embedded.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.VIBE_DATA_DIR || path.join(os.homedir(), '.vibekeytester');
const PUBLIC_DIR = path.join(ROOT, 'public');
const THOCK_DIR = path.join(ROOT, 'thock');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');

// Self-provision the user data folder on first run (no installer / manual step).
fs.mkdirSync(DATA_DIR, { recursive: true });

// Packaged mode: assets are embedded in the binary, so `public/` (and friends)
// don't exist next to the executable.
const PACKAGED = process.env.VIBE_PACKAGED === '1' || !fs.existsSync(PUBLIC_DIR);
const PORT = Number(process.env.PORT) || 8080;

const THEMES = new Set(['neondusk', 'outrun', 'vaporwave', 'cyberpunk', 'midnightgrid', 'chrome', 'toxicglow', 'retroarcade']);

// --- settings -----------------------------------------------------------
const DEFAULT_SETTINGS = {
  theme: 'neondusk',
  sound: 'on',
};

function readSettings() {
  let stored = {};
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      if (parsed && typeof parsed === 'object') stored = parsed;
    }
  } catch {}
  return normalizeSettings(stored);
}

function writeSettings(settings) {
  fs.writeFileSync(SETTINGS_FILE, JSON.stringify(normalizeSettings(settings)));
}

function normalizeSettings(input) {
  const s = input && typeof input === 'object' ? input : {};
  const out = { ...DEFAULT_SETTINGS };
  if (THEMES.has(String(s.theme))) out.theme = String(s.theme);
  if (s.sound === 'on' || s.sound === 'off') out.sound = s.sound;
  return out;
}

// --- embedded assets (packaged single-file mode) ------------------------
function embeddedBuffer(rel) {
  const data = EMBEDDED.files[rel];
  if (data === undefined) return null;
  return EMBEDDED.binary.includes(rel) ? Buffer.from(data, 'base64') : Buffer.from(data, 'utf8');
}

// --- server -------------------------------------------------------------
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const route = url.pathname;
  const method = req.method || 'GET';

  try {
    if (route.startsWith('/api/')) return handleApi(req, res, method, route);
    if (route.startsWith('/thock/')) return serveThock(res, route);
    return serveStatic(res, route);
  } catch (err) {
    sendJson(res, 500, { error: 'internal error', detail: String(err && err.message) });
  }
});

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE' && actualPort < PORT + 50) {
    actualPort += 1;
    setTimeout(() => server.listen(actualPort), 100);
  } else {
    console.error('[server] failed to listen:', err && err.message);
    process.exit(1);
  }
});

let actualPort = PORT;
server.listen(actualPort, () => {
  const url = `http://localhost:${actualPort}`;
  console.log(`\n  ⚡ vibekeytester running at ${url}\n`);
  openBrowser(url);
});

function openBrowser(url) {
  if (process.env.VIBE_NO_OPEN === '1') return;
  const cmd = process.platform === 'darwin' ? 'open'
    : process.platform === 'win32' ? 'start'
    : 'xdg-open';
  try {
    const child = spawn(cmd, [url], { detached: true, stdio: 'ignore' });
    child.on('error', () => {});
    child.unref();
  } catch {}
}

// --- API ----------------------------------------------------------------
function handleApi(req, res, method, route) {
  if (method === 'GET' && route === '/api/health') return sendJson(res, 200, { ok: true });

  if (method === 'GET' && route === '/api/settings') {
    return sendJson(res, 200, { settings: readSettings() });
  }

  if (method === 'POST' && route === '/api/settings') {
    return readJsonBody(req).then((body) => {
      const merged = normalizeSettings({ ...readSettings(), ...(body && body.settings) });
      writeSettings(merged);
      sendJson(res, 200, { settings: merged });
    });
  }

  sendJson(res, 404, { error: 'not found' });
}

// --- thock --------------------------------------------------------------
function serveThock(res, route) {
  const rel = decodeURIComponent(route).replace(/^\/thock\//, '');
  if (!rel || rel.includes('/') || rel.includes('..')) return sendJson(res, 403, { error: 'forbidden' });
  const ext = path.extname(rel).toLowerCase();
  const type = ext === '.ogg' ? 'audio/ogg'
    : ext === '.json' ? 'application/json; charset=utf-8'
    : ext === '.wav' ? 'audio/wav'
    : ext === '.mp3' ? 'audio/mpeg'
    : 'application/octet-stream';

  if (PACKAGED) {
    const buf = embeddedBuffer('thock/' + rel);
    if (!buf) return sendJson(res, 404, { error: 'not found' });
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    return res.end(buf);
  }

  fs.readFile(path.join(THOCK_DIR, rel), (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') return sendJson(res, 404, { error: 'not found' });
      return sendJson(res, 500, { error: 'read error' });
    }
    res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-cache' });
    res.end(data);
  });
}

// --- static serving -----------------------------------------------------
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
};

function serveStatic(res, pathname) {
  if (PACKAGED) {
    const rel = pathname === '/' ? 'public/index.html' : 'public' + decodeURIComponent(pathname);
    const buf = embeddedBuffer(rel);
    if (!buf) return sendJson(res, 404, { error: 'not found' });
    const ext = path.extname(rel).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream', 'Cache-Control': 'no-cache' });
    return res.end(buf);
  }

  let rel = pathname === '/' ? '/index.html' : decodeURIComponent(pathname);
  const filePath = path.join(PUBLIC_DIR, path.normalize(rel));
  if (!filePath.startsWith(PUBLIC_DIR + path.sep) && filePath !== path.join(PUBLIC_DIR, 'index.html')) {
    return sendJson(res, 403, { error: 'forbidden' });
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      if (err.code === 'ENOENT') return sendJson(res, 404, { error: 'not found' });
      return sendJson(res, 500, { error: 'read error' });
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      'Content-Type': MIME[ext] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
  });
}

// --- helpers ------------------------------------------------------------
function sendJson(res, status, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(body);
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
      if (raw.length > 256 * 1024) {
        reject(new Error('body too large'));
        req.destroy();
      }
    });
    req.on('end', () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        reject(new Error('invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

export default server;
