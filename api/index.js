// Vercel serverless adapter — wraps the Express app
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { mkdirSync, existsSync, rmSync } from 'fs';
import os from 'os';
import { detectFileType } from '../server/utils/fileDetector.js';
import { runPipeline } from '../server/pipeline.js';

const app = express();
app.use(cors());
app.use(express.json());

// --- Session Management ---
const sessions = new Map();
const SESSION_TTL = 30 * 60 * 1000;

function createSession() {
  const id = uuidv4();
  const dir = path.join(os.tmpdir(), id);
  mkdirSync(dir, { recursive: true });
  sessions.set(id, {
    id, dir, createdAt: Date.now(), sseClients: [],
    status: 'created', result: null,
  });
  return id;
}

function getSession(id) { return sessions.get(id); }

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

// --- Multer ---
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
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['.csv', '.tsv', '.xlsx', '.xls', '.pdf', '.txt'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) return cb(null, true);
    cb(new Error(`File type ${ext} not supported.`));
  },
});

// --- Routes ---
app.post('/api/session', (_req, res) => {
  res.json({ sessionId: createSession() });
});

app.post('/api/upload', upload.single('file'), async (req, res) => {
  const sessionId = req.query.session;
  const session = getSession(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const filePath = req.file.path;
  try {
    const { type, delimiter } = await detectFileType(filePath);
    session.status = 'processing';
    session.fileName = req.file.originalname;

    res.json({ sessionId, fileName: req.file.originalname, fileType: type, status: 'processing' });

    runPipeline(filePath, type, delimiter, sessionId, (event) => {
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

  res.write(`data: ${JSON.stringify({ status: 'connected', sessionId })}\n\n`);
  if (session.status === 'complete' && session.result) {
    res.write(`data: ${JSON.stringify({ status: 'pipeline_complete', result: session.result })}\n\n`);
  }

  session.sseClients.push(res);
  req.on('close', () => {
    session.sseClients = session.sseClients.filter(c => c !== res);
  });
});

app.get('/api/download/:sessionId/clean', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session || session.status !== 'complete') return res.status(404).json({ error: 'File not ready' });
  const filePath = path.join(session.dir, 'inventory_clean.xlsx');
  if (!existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  const safeName = (session.fileName || 'inventory').replace(/\.[^.]+$/, '');
  res.download(filePath, `${safeName}_clean.xlsx`);
});

app.get('/api/download/:sessionId/flagged', (req, res) => {
  const session = getSession(req.params.sessionId);
  if (!session || session.status !== 'complete') return res.status(404).json({ error: 'File not ready' });
  const filePath = path.join(session.dir, 'inventory_flagged.xlsx');
  if (!existsSync(filePath)) return res.status(404).json({ error: 'File not found' });
  const safeName = (session.fileName || 'inventory').replace(/\.[^.]+$/, '');
  res.download(filePath, `${safeName}_flagged.xlsx`);
});

export default app;
