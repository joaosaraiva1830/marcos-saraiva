/*
 * Servidor do site + API de Conversões da Meta (CAPI)
 *
 * - Serve os arquivos do site (pasta public/)
 * - POST /api/evento: recebe o evento do navegador e repassa para a Meta pelo servidor,
 *   com o mesmo event_id do Pixel (a Meta junta os dois e não conta duas vezes).
 *
 * Variáveis de ambiente (Easypanel > Ambiente):
 *   META_CAPI_TOKEN        obrigatório para a API funcionar (token gerado no Gerenciador de Eventos)
 *   META_PIXEL_ID          padrão: 3622083471297526
 *   META_TEST_EVENT_CODE   opcional: código da aba "Testar eventos" (remova depois de testar)
 *   META_API_VERSION       padrão: v23.0
 *   PORT                   padrão: 80
 */
'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const PORT = Number(process.env.PORT) || 80;
const PIXEL_ID = process.env.META_PIXEL_ID || '3622083471297526';
const TOKEN = process.env.META_CAPI_TOKEN || '';
const TEST_CODE = process.env.META_TEST_EVENT_CODE || '';
const API_VERSION = process.env.META_API_VERSION || 'v23.0';
const GRAPH_URL = process.env.META_GRAPH_URL || 'https://graph.facebook.com';
const PUBLIC_DIR = path.join(__dirname, 'public');

// Só estes eventos vão para a API (os de engajamento ficam só no Pixel)
const ALLOWED_EVENTS = new Set(['PageView', 'ViewContent', 'Lead', 'Contact']);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
};
const COMPRESSIBLE = new Set(['.html', '.txt', '.xml', '.svg']);

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
};

// Arquivos carregados na memória na inicialização (site pequeno, resposta rápida)
const files = new Map();
for (const name of fs.readdirSync(PUBLIC_DIR)) {
  const ext = path.extname(name).toLowerCase();
  if (!TYPES[ext]) continue;
  const body = fs.readFileSync(path.join(PUBLIC_DIR, name));
  files.set('/' + name, {
    body,
    gzip: COMPRESSIBLE.has(ext) ? zlib.gzipSync(body, { level: 9 }) : null,
    type: TYPES[ext],
    cache: ext === '.html' ? 'no-cache' : 'public, max-age=2592000',
  });
}

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

// ---------- Limite simples por IP (evita abuso do endpoint) ----------
const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const entry = hits.get(ip) || { count: 0, start: now };
  if (now - entry.start > 60000) { entry.count = 0; entry.start = now; }
  entry.count++;
  hits.set(ip, entry);
  return entry.count > 60;
}
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of hits) if (now - e.start > 60000) hits.delete(ip);
}, 60000).unref();

function clientIp(req) {
  const fwd = req.headers['x-forwarded-for'];
  if (fwd) return String(fwd).split(',')[0].trim();
  const real = req.headers['x-real-ip'];
  if (real) return String(real).trim();
  return (req.socket.remoteAddress || '').replace(/^::ffff:/, '');
}

function str(v, max) {
  return typeof v === 'string' && v.length > 0 ? v.slice(0, max) : undefined;
}

// Apenas números, textos curtos e booleanos simples em custom_data
function cleanCustomData(obj) {
  const out = {};
  if (!obj || typeof obj !== 'object') return out;
  for (const [k, v] of Object.entries(obj).slice(0, 15)) {
    if (!/^[a-zA-Z0-9_]{1,40}$/.test(k)) continue;
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v;
    else if (typeof v === 'string') out[k] = v.slice(0, 200);
    else if (typeof v === 'boolean') out[k] = v;
  }
  return out;
}

async function sendToMeta(evt, req) {
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '');
  let sourceUrl = str(evt.event_source_url, 1000);
  // Aceita só URLs do próprio site
  try {
    if (!sourceUrl || new URL(sourceUrl).host !== host) sourceUrl = 'https://' + host + '/';
  } catch (e) {
    sourceUrl = 'https://' + host + '/';
  }

  const userData = {
    client_ip_address: clientIp(req),
    client_user_agent: str(req.headers['user-agent'], 500),
  };
  const fbp = str(evt.fbp, 200);
  const fbc = str(evt.fbc, 500);
  if (fbp && /^fb\.\d\.\d+\.\d+$/.test(fbp)) userData.fbp = fbp;
  if (fbc && /^fb\.\d\.\d+\..+$/.test(fbc)) userData.fbc = fbc;

  const payload = {
    data: [{
      event_name: evt.event_name,
      event_time: Math.floor(Date.now() / 1000),
      event_id: str(evt.event_id, 100),
      event_source_url: sourceUrl,
      action_source: 'website',
      user_data: userData,
      custom_data: cleanCustomData(evt.custom_data),
    }],
  };
  if (TEST_CODE) payload.test_event_code = TEST_CODE;

  const url = `${GRAPH_URL}/${API_VERSION}/${PIXEL_ID}/events?access_token=${encodeURIComponent(TOKEN)}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  const text = await res.text();
  if (!res.ok) {
    log(`[CAPI] ERRO ${res.status} em ${evt.event_name}:`, text.slice(0, 500));
  } else {
    log(`[CAPI] ok ${evt.event_name} (${payload.data[0].event_id || 'sem id'})${TEST_CODE ? ' [teste]' : ''}`);
  }
}

function handleEvent(req, res) {
  let size = 0;
  const chunks = [];
  req.on('data', (c) => {
    size += c.length;
    if (size > 8192) { req.destroy(); return; }
    chunks.push(c);
  });
  req.on('end', () => {
    // Responde na hora; o envio para a Meta acontece em segundo plano
    res.writeHead(204, { 'Cache-Control': 'no-store' });
    res.end();

    if (rateLimited(clientIp(req))) return;
    let evt;
    try {
      evt = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    } catch (e) {
      return;
    }
    if (!evt || !ALLOWED_EVENTS.has(evt.event_name)) return;
    if (!TOKEN) return; // API desligada até o token ser configurado
    sendToMeta(evt, req).catch((e) => log('[CAPI] falha de rede:', e.message));
  });
}

function serveFile(req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  } catch (e) {
    pathname = '/';
  }
  if (pathname === '/') pathname = '/index.html';
  const file = files.get(pathname);
  if (!file) {
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', ...SECURITY_HEADERS });
    return res.end('Página não encontrada');
  }
  const useGzip = file.gzip && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  const body = useGzip ? file.gzip : file.body;
  const headers = {
    'Content-Type': file.type,
    'Content-Length': body.length,
    'Cache-Control': file.cache,
    Vary: 'Accept-Encoding',
    ...SECURITY_HEADERS,
  };
  if (useGzip) headers['Content-Encoding'] = 'gzip';
  res.writeHead(200, headers);
  res.end(req.method === 'HEAD' ? undefined : body);
}

const server = http.createServer((req, res) => {
  // www.dominio -> dominio
  const host = String(req.headers.host || '');
  if (/^www\./i.test(host)) {
    res.writeHead(301, { Location: 'https://' + host.replace(/^www\./i, '') + req.url });
    return res.end();
  }
  if (req.url.split('?')[0] === '/api/evento') {
    if (req.method !== 'POST') { res.writeHead(405); return res.end(); }
    return handleEvent(req, res);
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); return res.end(); }
  serveFile(req, res);
});

server.listen(PORT, () => {
  log(`Site no ar na porta ${PORT}. API de Conversões: ${TOKEN ? 'LIGADA' : 'DESLIGADA (falta META_CAPI_TOKEN)'}${TEST_CODE ? ' | modo teste ' + TEST_CODE : ''}`);
});

process.on('SIGTERM', () => server.close(() => process.exit(0)));
