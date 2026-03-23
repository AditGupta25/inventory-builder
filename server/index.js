import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';
import os from 'os';
import { fileURLToPath } from 'url';
import { detectFileType } from './utils/fileDetector.js';
import { runPipeline } from './pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3001;
const UPLOAD_PASSWORD = process.env.UPLOAD_PASSWORD || null;

app.use(cors());
app.use(express.json());

// --- Session Management ---
const sessions = new Map();
const SESSION_TTL = 30 * 60 * 1000; // 30 minutes

function createSession() {
  const id = uuidv4();
  const dir = path.join(os.tmpdir(), id);
  mkdirSync(dir, { recursive: true });
  sessions.set(id, {
    id,
    dir,
    createdAt: Date.now(),
    sseClients: [],
    status: 'created',
    result: null,
  });
  return id;
}

function getSession(id) {
  return sessions.get(id);
}

// Cleanup expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of sessions) {
    if (now - session.createdAt > SESSION_TTL) {
      try { rmSync(session.dir, { recursive: true, force: true }); } catch {}
      sessions.delete(id);
    }
  }
}, 60_000);

// --- Auth middleware (optional) ---
function authMiddleware(req, res, next) {
  if (!UPLOAD_PASSWORD) return next();
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (token !== UPLOAD_PASSWORD) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// --- Multer config ---
const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const session = getSession(req.query.session);
    if (!session) return cb(new Error('Invalid session'));
    cb(null, session.dir);
  },
  filename: (_req, file, cb) => {
    cb(null, `upload_${Date.now()}${path.extname(file.originalname)}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['.csv', '.tsv', '.xlsx', '.xls', '.pdf', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error(`File type ${ext} not supported. Allowed: ${allowed.join(', ')}`));
  },
});

// --- Routes ---

// Create session
app.post('/api/session', authMiddleware, (_req, res) => {
  const id = createSession();
  res.json({ sessionId: id });
});

// Upload file and start pipeline
app.post('/api/upload', authMiddleware, upload.single('file'), async (req, res) => {
  const sessionId = req.query.session;
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const filePath = req.file.path;

  try {
    const { type, delimiter } = await detectFileType(filePath);
    session.status = 'processing';
    session.fileName = req.file.originalname;

    res.json({
      sessionId,
      fileName: req.file.originalname,
      fileType: type,
      status: 'processing',
    });

    // Run pipeline asynchronously
    runPipeline(filePath, type, delimiter, sessionId, (event) => {
      // Emit to all SSE clients for this session
      for (const client of session.sseClients) {
        client.write(`data: ${JSON.stringify(event)}\n\n`);
      }

      if (event.status === 'pipeline_complete') {
        session.status = 'complete';
        session.result = event.result;
      } else if (event.status === 'pipeline_error') {
        session.status = 'error';
        session.error = event.message;
      }
    }).catch(err => {
      console.error('Pipeline error:', err);
      session.status = 'error';
      session.error = err.message;
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// SSE progress stream
app.get('/api/progress', (req, res) => {
  const sessionId = req.query.session;
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  // Send initial connection event
  res.write(`data: ${JSON.stringify({ status: 'connected', sessionId })}\n\n`);

  // If already complete, send result immediately
  if (session.status === 'complete' && session.result) {
    res.write(`data: ${JSON.stringify({ status: 'pipeline_complete', result: session.result })}\n\n`);
  }

  session.sseClients.push(res);

  req.on('close', () => {
    session.sseClients = session.sseClients.filter(c => c !== res);
  });
});

// Download clean XLSX
app.get('/api/download/:sessionId/clean', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session || session.status !== 'complete') {
    return res.status(404).json({ error: 'File not ready' });
  }
  const filePath = path.join(session.dir, 'inventory_clean.xlsx');
  if (!existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  const safeName = (session.fileName || 'inventory').replace(/\.[^.]+$/, '');
  res.download(filePath, `${safeName}_clean.xlsx`);
});

// Download flagged XLSX
app.get('/api/download/:sessionId/flagged', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session || session.status !== 'complete') {
    return res.status(404).json({ error: 'File not ready' });
  }
  const filePath = path.join(session.dir, 'inventory_flagged.xlsx');
  if (!existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  const safeName = (session.fileName || 'inventory').replace(/\.[^.]+$/, '');
  res.download(filePath, `${safeName}_flagged.xlsx`);
});

// Serve static files in production
const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`Inventory Builder server running on http://localhost:${PORT}`);
});
