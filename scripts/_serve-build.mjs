#!/usr/bin/env node
// scripts/_serve-build.mjs -- local production-build server for the perf A/B
// harness (PR 0.0 of the site-performance arc; successor to the PR #143 one).
//
// Serves the output of `npm run build` (react-router framework build) the way
// Vercel does, so Lighthouse can audit a real production bundle locally:
//
//   1. static files from build/client (hashed /assets get immutable cache)
//   2. prerendered documents (build/client/<path>/index.html)
//   3. everything else -> the SSR request handler from build/server
//
// Two fidelity fixes over a bare static server -- both distorted the PR #143
// localhost numbers (its comment: "uncompressed local assets distort the
// network model"):
//   - compression (brotli/gzip): Lighthouse `simulate` throttling derives
//     network time from transferSize, so uncompressed local JS reads ~3-4x
//     heavier than the same bundle on Vercel's CDN.
//   - /_vercel/image emulation via sharp (already a dependency): covers go
//     through the same-origin optimizer in prod; without it every cover 404s
//     locally and the LCP element differs from prod. The emulation enforces
//     vercel.json's images.sizes/qualities allow-lists exactly because prod
//     400s anything else (INVALID_IMAGE_OPTIMIZE_REQUEST) -- a permissive
//     local optimizer would bless w/q values that break on prod.
//
// Usage: node scripts/_serve-build.mjs [--port 4173] [--verbose]
// Or:    import { startServer } from './_serve-build.mjs'  (perf-ab.mjs does)

import { createReadStream, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { join, resolve, extname, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Readable, pipeline } from 'node:stream';
import zlib from 'node:zlib';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CLIENT_DIR = join(ROOT, 'build', 'client');
const SERVER_DIR = join(ROOT, 'build', 'server');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.webmanifest': 'application/manifest+json',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.map': 'application/json',
  '.wasm': 'application/wasm',
};
const COMPRESSIBLE = new Set([
  '.html', '.js', '.mjs', '.css', '.json', '.svg', '.txt', '.xml', '.webmanifest', '.map',
]);

// --- server build (SSR fallback) --------------------------------------------

function findServerIndex() {
  const direct = join(SERVER_DIR, 'index.js');
  if (existsSync(direct)) return direct;
  // vercelPreset emits build/server/nodejs_<base64>/index.js
  for (const entry of readdirSync(SERVER_DIR)) {
    const nested = join(SERVER_DIR, entry, 'index.js');
    if (entry.startsWith('nodejs_') && existsSync(nested)) return nested;
  }
  throw new Error('no server build found under build/server -- run `npm run build` first');
}

async function loadSsrHandler() {
  const [{ createRequestHandler }, build] = await Promise.all([
    import('react-router'),
    import(pathToFileURL(findServerIndex()).href),
  ]);
  return createRequestHandler(build, 'production');
}

// --- compression -------------------------------------------------------------

// Pre-compressed static cache keyed by path+mtime+encoding so repeated
// Lighthouse runs don't re-compress the same bundles 18 times.
const compressedCache = new Map();
const CACHE_MAX = 400;

function cachePut(cache, key, value) {
  if (cache.size >= CACHE_MAX) {
    cache.delete(cache.keys().next().value);
  }
  cache.set(key, value);
}

// Minimal q-value-aware Accept-Encoding negotiation: honours `br;q=0`-style
// refusals and the `*` wildcard (a bare substring test would serve br to a
// client that explicitly refused it). Prefers br over gzip like Vercel's CDN.
function pickEncoding(req) {
  const accepted = String(req.headers['accept-encoding'] ?? '')
    .toLowerCase()
    .split(',')
    .map((part) => {
      const [name, ...params] = part.trim().split(';');
      const qp = params.map((p) => p.trim()).find((p) => p.startsWith('q='));
      const q = qp ? Number.parseFloat(qp.slice(2)) : 1;
      return { name: name.trim(), q: Number.isFinite(q) ? q : 1 };
    })
    .filter((e) => e.name && e.q > 0);
  const ok = (n) => accepted.some((e) => e.name === n || e.name === '*');
  if (ok('br')) return 'br';
  if (ok('gzip')) return 'gzip';
  return null;
}

function compressBuffer(buf, encoding) {
  if (encoding === 'br') {
    // Quality 5: within a few % of Vercel's CDN brotli on JS/CSS, without the
    // multi-second quality-11 stall on the big vendor chunks.
    return zlib.brotliCompressSync(buf, {
      params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 5 },
    });
  }
  return zlib.gzipSync(buf, { level: 9 });
}

// --- static files ------------------------------------------------------------

function safeClientPath(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  const abs = resolve(CLIENT_DIR, '.' + decoded.replace(/\\/g, '/'));
  if (abs !== CLIENT_DIR && !abs.startsWith(CLIENT_DIR + '\\') && !abs.startsWith(CLIENT_DIR + '/')) {
    return null;
  }
  return abs;
}

function resolveStatic(pathname) {
  const base = safeClientPath(pathname);
  if (!base) return null;
  const candidates = pathname.endsWith('/')
    ? [join(base, 'index.html')]
    : [base, join(base, 'index.html')];
  for (const file of candidates) {
    try {
      const st = statSync(file);
      if (st.isFile()) return { file, mtimeMs: st.mtimeMs, size: st.size };
    } catch {
      /* try next candidate */
    }
  }
  return null;
}

function serveStatic(req, res, pathname, hit, verbose) {
  const ext = extname(hit.file).toLowerCase();
  const type = MIME[ext] ?? 'application/octet-stream';
  const headers = {
    'content-type': type,
    'cache-control': pathname.startsWith('/assets/')
      ? 'public, max-age=31536000, immutable'
      : 'public, max-age=0, must-revalidate',
  };
  const encoding = COMPRESSIBLE.has(ext) && hit.size > 1024 ? pickEncoding(req) : null;
  let body;
  if (encoding) {
    const key = `${hit.file}|${hit.mtimeMs}|${encoding}`;
    body = compressedCache.get(key);
    if (!body) {
      body = compressBuffer(readFileSync(hit.file), encoding);
      cachePut(compressedCache, key, body);
    }
    headers['content-encoding'] = encoding;
    headers['vary'] = 'Accept-Encoding';
    headers['content-length'] = body.length;
  } else {
    headers['content-length'] = hit.size;
  }
  if (verbose) console.log(`  static ${pathname}${encoding ? ` (${encoding})` : ''}`);
  res.writeHead(200, headers);
  if (req.method === 'HEAD') return res.end();
  if (body) return res.end(body);
  // pipeline (not .pipe) so an open/read failure after the 200 was written
  // (statSync-to-open race, AV lock, concurrent rebuild) surfaces here instead
  // of crashing the process -- perf-ab runs this server in-process, so an
  // uncaught 'error' would kill a sweep and lose every completed run.
  pipeline(createReadStream(hit.file), res, (err) => {
    if (err && err.code !== 'ERR_STREAM_PREMATURE_CLOSE') {
      console.error(`[_serve-build] static stream ${pathname} failed:`, err?.message ?? err);
      // Headers are gone already; abort the socket so the client sees a failed
      // transfer instead of hanging for the announced content-length.
      res.destroy();
    }
  });
}

// --- /_vercel/image emulation ------------------------------------------------

const IMAGES_CONF = (() => {
  try {
    const conf = JSON.parse(readFileSync(join(ROOT, 'vercel.json'), 'utf8'));
    return {
      hosts: new Set((conf.images?.remotePatterns ?? []).map((p) => p.hostname)),
      sizes: new Set(conf.images?.sizes ?? []),
      qualities: new Set(conf.images?.qualities ?? [70]),
      quality: conf.images?.qualities?.[0] ?? 70,
    };
  } catch {
    return { hosts: new Set(), sizes: new Set(), qualities: new Set(), quality: 70 };
  }
})();

let sharpPromise = null;
function getSharp() {
  sharpPromise ??= import('sharp')
    .then((m) => m.default)
    .catch((e) => {
      console.warn(`[_serve-build] sharp unavailable (${e?.message}) -- /_vercel/image degrades to redirect`);
      return null;
    });
  return sharpPromise;
}

const imageCache = new Map();

async function serveVercelImage(req, res, url) {
  const src = url.searchParams.get('url');
  const w = Number.parseInt(url.searchParams.get('w') ?? '', 10);
  const q = Number.parseInt(url.searchParams.get('q') ?? '', 10) || IMAGES_CONF.quality;
  if (!src || !Number.isFinite(w) || w <= 0) {
    res.writeHead(400, { 'content-type': 'text/plain' });
    return res.end('bad /_vercel/image params');
  }
  // Enforce the allow-lists like prod does: a w/q outside vercel.json's
  // images.sizes/qualities is a 400 INVALID_IMAGE_OPTIMIZE_REQUEST on Vercel,
  // so serving it here would bless a request that breaks in production.
  // (.size guards keep graceful degradation if vercel.json was unreadable.)
  if ((IMAGES_CONF.sizes.size && !IMAGES_CONF.sizes.has(w)) || (IMAGES_CONF.qualities.size && !IMAGES_CONF.qualities.has(q))) {
    res.writeHead(400, { 'content-type': 'text/plain' });
    return res.end('w/q not in vercel.json images.sizes/qualities (prod would 400 INVALID_IMAGE_OPTIMIZE_REQUEST)');
  }
  const remote = /^https:\/\//.test(src);
  const key = `${src}|${w}|${q}`;
  let out = imageCache.get(key);
  if (!out) {
    try {
      let input;
      if (remote) {
        const srcUrl = new URL(src);
        if (!IMAGES_CONF.hosts.has(srcUrl.hostname)) throw new Error(`host not allowed: ${srcUrl.hostname}`);
        const upstream = await fetch(srcUrl);
        if (!upstream.ok) throw new Error(`upstream ${upstream.status}`);
        input = Buffer.from(await upstream.arrayBuffer());
      } else {
        const abs = safeClientPath(src.split('?')[0]);
        if (!abs) throw new Error('bad local path');
        input = readFileSync(abs);
      }
      const sharp = await getSharp();
      if (!sharp) throw new Error('sharp unavailable');
      out = await sharp(input)
        .resize({ width: w, withoutEnlargement: true })
        .webp({ quality: q })
        .toBuffer();
      cachePut(imageCache, key, out);
    } catch (e) {
      // Graceful degradation: the page still renders (timing fidelity is lost
      // for this one image, correctness is not).
      console.warn(`[_serve-build] /_vercel/image failed for ${src}: ${e?.message}`);
      if (remote) {
        res.writeHead(302, { location: src });
        return res.end();
      }
      res.writeHead(404, { 'content-type': 'text/plain' });
      return res.end('image not found');
    }
  }
  res.writeHead(200, {
    'content-type': 'image/webp',
    'content-length': out.length,
    'cache-control': 'public, max-age=2678400',
  });
  res.end(req.method === 'HEAD' ? undefined : out);
}

// --- SSR fallback ------------------------------------------------------------

async function serveSsr(req, res, url, handler, verbose) {
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else if (v != null) headers.set(k, v);
  }
  // Propagate client disconnects into the SSR render (same pattern as
  // @react-router/express): without this, entry.server's request.signal.aborted
  // guard is dead code here and abandoned loads run to completion for a dead
  // socket, logging spurious ssr-error lines mid-sweep.
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });
  const init = { method: req.method, headers, signal: controller.signal };
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    init.body = Readable.toWeb(req);
    init.duplex = 'half';
  }
  const response = await handler(new Request(url, init));

  const outHeaders = {};
  for (const [k, v] of response.headers.entries()) {
    if (k !== 'set-cookie') outHeaders[k] = v;
  }
  const cookies = response.headers.getSetCookie?.() ?? [];
  if (cookies.length) outHeaders['set-cookie'] = cookies;

  const type = String(response.headers.get('content-type') ?? '');
  const wantCompress =
    response.body &&
    /text\/html|application\/json|text\/plain|application\/xml|text\/xml|text\/css|javascript|\+xml\b/.test(type);
  const encoding = wantCompress ? pickEncoding(req) : null;

  if (verbose) console.log(`  ssr    ${url.pathname} -> ${response.status}`);
  if (!response.body || req.method === 'HEAD') {
    res.writeHead(response.status, outHeaders);
    return res.end();
  }
  const nodeStream = Readable.fromWeb(response.body);
  if (encoding) {
    delete outHeaders['content-length'];
    outHeaders['content-encoding'] = encoding;
    outHeaders['vary'] = 'Accept-Encoding';
    res.writeHead(response.status, outHeaders);
    // Per-chunk flush (BROTLI_OPERATION_FLUSH / Z_SYNC_FLUSH): the default
    // Z_NO_FLUSH would buffer React's deliberate shell/suspense flush
    // boundaries inside the compressor window, serialising the stream that
    // entry.server.tsx deliberately streams.
    const compressor =
      encoding === 'br'
        ? zlib.createBrotliCompress({
            flush: zlib.constants.BROTLI_OPERATION_FLUSH,
            params: { [zlib.constants.BROTLI_PARAM_QUALITY]: 4 },
          })
        : zlib.createGzip({ level: 6, flush: zlib.constants.Z_SYNC_FLUSH });
    nodeStream.pipe(compressor).pipe(res);
  } else {
    res.writeHead(response.status, outHeaders);
    nodeStream.pipe(res);
  }
}

// --- server ------------------------------------------------------------------

export async function startServer({ port = 4173, verbose = false } = {}) {
  if (!existsSync(CLIENT_DIR)) {
    throw new Error('build/client not found -- run `npm run build` first');
  }
  // Prod parity for the SSR dependency graph. react/react-dom pick their
  // production CJS builds off NODE_ENV at first import; react-router resolves
  // dist/production/ only under the `production` export condition. Without
  // both, the "production build" renders through DEV React + DEV react-router
  // (slower, warning-spewing) and every SSR timing is skewed. The CLIs
  // re-exec with --conditions=production; an importer that didn't gets a loud
  // warning because we cannot add resolution conditions after process start.
  if (process.env.NODE_ENV !== 'production') {
    if (process.env.NODE_ENV) {
      console.warn(`[_serve-build] overriding NODE_ENV=${process.env.NODE_ENV} -> production (prod-parity harness)`);
    }
    process.env.NODE_ENV = 'production';
  }
  if (!process.execArgv.includes('--conditions=production')) {
    console.warn(
      '[_serve-build] WARNING: node started without --conditions=production; ' +
        'react-router resolves its development build and SSR timings will be skewed. ' +
        'Run via `npm run serve:build` / `npm run perf:ab` (they re-exec correctly).',
    );
  }
  const ssrHandler = await loadSsrHandler();

  // The URL base must use the port we actually BOUND, not the one requested:
  // the EADDRINUSE walk below may land on port+1.. while a stale server holds
  // the requested port, and absolute self-URLs the SSR derives from
  // request.url (canonical/og meta, sitemap <loc>) would then point at the
  // stale instance. Closure variable rather than Host-header parsing so a
  // malformed Host can't make `new URL` throw in the sync handler region.
  let boundPort = port;

  const server = createServer((req, res) => {
    const url = new URL(req.url ?? '/', `http://127.0.0.1:${boundPort}`);
    Promise.resolve()
      .then(() => {
        if (url.pathname === '/_vercel/image') return serveVercelImage(req, res, url);
        if (req.method === 'GET' || req.method === 'HEAD') {
          const hit = resolveStatic(url.pathname);
          if (hit) return serveStatic(req, res, url.pathname, hit, verbose);
        }
        return serveSsr(req, res, url, ssrHandler, verbose);
      })
      .catch((e) => {
        if (e?.name === 'AbortError') return; // client went away mid-render
        console.error(`[_serve-build] ${req.method} ${req.url} failed:`, e);
        if (!res.headersSent) res.writeHead(500, { 'content-type': 'text/plain' });
        res.end('internal error');
      });
  });

  // Walk forward from the requested port so a lingering server never blocks a run.
  await new Promise((resolvePort, rejectPort) => {
    let attempt = port;
    const tryListen = () => {
      server.once('error', (e) => {
        if (e.code === 'EADDRINUSE' && attempt < port + 10) {
          attempt += 1;
          tryListen();
        } else {
          rejectPort(e);
        }
      });
      server.listen(attempt, '127.0.0.1', () => {
        boundPort = attempt;
        resolvePort(attempt);
      });
    };
    tryListen();
  });

  return {
    port: boundPort,
    origin: `http://127.0.0.1:${boundPort}`,
    close: () =>
      new Promise((r) => {
        server.close(r);
        // Orphaned clients (e.g. a Chrome left behind by a Lighthouse timeout
        // kill) can hold in-flight sockets open forever; close() alone would
        // wait on them and hang perf-ab's finally block, swallowing the real
        // error. Nothing legitimate is in flight when the harness tears down.
        server.closeAllConnections();
      }),
  };
}

// --- CLI ---------------------------------------------------------------------

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  // Re-exec under the production export condition (see startServer's comment)
  // -- resolution conditions cannot be added to a running process.
  if (!process.execArgv.includes('--conditions=production')) {
    const { spawnSync } = await import('node:child_process');
    const r = spawnSync(
      process.execPath,
      ['--conditions=production', ...process.argv.slice(1)],
      { stdio: 'inherit', env: { ...process.env, NODE_ENV: 'production' } },
    );
    process.exit(r.status ?? 1);
  }
  const args = process.argv.slice(2);
  const portFlag = args.indexOf('--port');
  const port = portFlag !== -1 ? Number.parseInt(args[portFlag + 1], 10) : Number(process.env.PORT) || 4173;
  const verbose = args.includes('--verbose');
  startServer({ port, verbose })
    .then(({ origin }) => console.log(`serving production build at ${origin} (ctrl-c to stop)`))
    .catch((e) => {
      console.error(e.message ?? e);
      process.exit(1);
    });
}
