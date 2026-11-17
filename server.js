// Serves the game files (this folder is flat), and three.js from node_modules, plus a small API the
// client uses to discover which bird models are installed.
// Stage 4 attaches Socket.IO and PostgreSQL to the same HTTP server.

import express from 'express';
import compression from 'compression';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = here;
const port = Number(process.env.PORT) || 3000;
const birdsDir = root;                         // .glb models sit next to this file

const threeDir = path.join(root, 'node_modules', 'three');
if (!fs.existsSync(threeDir)) {
  console.error('three.js is not installed. Run "npm install" first.');
  process.exit(1);
}

const app = express();
app.disable('x-powered-by');
app.set('trust proxy', 1);                       // Render terminates TLS in front of the app
app.use(compression());

app.get('/healthz', (_req, res) => res.json({ ok: true, uptime: Math.round(process.uptime()) }));

let modelCache = { at: 0, birds: [] };
app.get('/api/models', (_req, res) => {
  if (Date.now() - modelCache.at > 10_000) {
    let birds = [];
    try { birds = fs.readdirSync(birdsDir).filter((f) => f.toLowerCase().endsWith('.glb')); } catch { /* folder missing */ }
    modelCache = { at: Date.now(), birds };
  }
  res.set('Cache-Control', 'no-cache').json({ birds: modelCache.birds });
});

app.use('/vendor/three', express.static(threeDir, { maxAge: '7d', immutable: true }));

// The project is a single flat folder, so never serve server-side files or dependencies.
const PRIVATE = new Set(['server.js', 'package.json', 'package-lock.json', 'render.yaml', 'inspect-glb.mjs', 'README.md', '.gitignore']);
app.use((req, res, next) => {
  const base = path.basename(decodeURIComponent(req.path));
  if (PRIVATE.has(base) || req.path.startsWith('/node_modules') || base.startsWith('.')) return res.status(404).end();
  next();
});
app.use(express.static(root, { maxAge: '5m', index: 'index.html', dotfiles: 'ignore' }));

const server = http.createServer(app);
server.listen(port, '0.0.0.0', () => console.log(`Aerona running on port ${port}`));

const shutdown = () => server.close(() => process.exit(0));
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

export { app, server };
