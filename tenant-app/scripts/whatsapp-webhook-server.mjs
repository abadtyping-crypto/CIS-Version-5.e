import { createServer } from 'node:http';
import { appendFileSync, existsSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT_DIR = resolve(__dirname, '..');
const ENV_PATH = resolve(ROOT_DIR, '.env');
const LOG_DIR = resolve(ROOT_DIR, 'logs');
const EVENT_LOG_PATH = resolve(LOG_DIR, 'whatsapp-webhook-events.jsonl');

const readEnvFile = () => {
  if (!existsSync(ENV_PATH)) return {};
  const raw = readFileSync(ENV_PATH, 'utf8');
  const env = {};
  raw.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx <= 0) return;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    env[key] = value;
  });
  return env;
};

const envFromFile = readEnvFile();
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || envFromFile.WHATSAPP_VERIFY_TOKEN || '';
const PORT = Number(process.env.WHATSAPP_WEBHOOK_PORT || envFromFile.WHATSAPP_WEBHOOK_PORT || 8081);

if (!VERIFY_TOKEN) {
  console.error('[whatsapp-webhook] Missing WHATSAPP_VERIFY_TOKEN in .env');
  process.exit(1);
}

if (!existsSync(LOG_DIR)) mkdirSync(LOG_DIR, { recursive: true });

const sendJson = (res, statusCode, payload) => {
  res.writeHead(statusCode, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(payload));
};

const server = createServer((req, res) => {
  const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

  if (url.pathname !== '/webhooks/whatsapp') {
    return sendJson(res, 404, { ok: false, error: 'Not Found' });
  }

  if (req.method === 'GET') {
    const mode = url.searchParams.get('hub.mode');
    const token = url.searchParams.get('hub.verify_token');
    const challenge = url.searchParams.get('hub.challenge') || '';

    if (mode === 'subscribe' && token === VERIFY_TOKEN) {
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(challenge);
      return;
    }
    return sendJson(res, 403, { ok: false, error: 'Verification failed' });
  }

  if (req.method === 'POST') {
    let body = '';
    req.on('data', (chunk) => {
      body += String(chunk);
    });
    req.on('end', () => {
      let payload = {};
      try {
        payload = body ? JSON.parse(body) : {};
      } catch {
        return sendJson(res, 400, { ok: false, error: 'Invalid JSON payload' });
      }

      const record = {
        receivedAt: new Date().toISOString(),
        headers: req.headers,
        payload,
      };
      appendFileSync(EVENT_LOG_PATH, `${JSON.stringify(record)}\n`, 'utf8');
      return sendJson(res, 200, { ok: true });
    });
    return;
  }

  return sendJson(res, 405, { ok: false, error: 'Method not allowed' });
});

server.listen(PORT, () => {
  console.log(`[whatsapp-webhook] Running on http://localhost:${PORT}/webhooks/whatsapp`);
  console.log(`[whatsapp-webhook] Verify token loaded: ${VERIFY_TOKEN.slice(0, 8)}...`);
  console.log(`[whatsapp-webhook] Event log: ${EVENT_LOG_PATH}`);
});
