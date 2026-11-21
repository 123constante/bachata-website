// key-proxy.mjs -- holds the Anthropic API key so the worker process never sees it.
// The agent talks to http://127.0.0.1:PORT with a dummy key; this process swaps in the real key
// and the workspace header, then streams the answer back. Run it as a DIFFERENT OS user than the
// agent (the workflow does: sudo -u nobody, then removes sudo from the runner user).
// Only /v1/ paths are forwarded. A request counter is a hard stop: the agent could call this
// proxy directly, so the CLI's own budget flag is not a cap.
import http from 'node:http';
import https from 'node:https';

const key = process.env.API_WORKER_KEY;
const workspace = process.env.API_WORKER_WORKSPACE;
const port = Number(process.env.API_WORKER_PROXY_PORT || 8787);
const maxRequests = Number(process.env.API_WORKER_MAX_REQUESTS || 400);
let served = 0;

if (!key || !workspace) {
  console.error('key-proxy: API_WORKER_KEY and API_WORKER_WORKSPACE are required');
  process.exit(2);
}

const HOP_BY_HOP = ['host', 'authorization', 'connection', 'keep-alive', 'proxy-connection', 'transfer-encoding', 'upgrade'];

function fail(res, status, message) {
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.writeHead(status);
  res.end(message);
}

const server = http.createServer((req, res) => {
  if (!String(req.url || '').startsWith('/v1/')) {
    fail(res, 404, 'only /v1/ is proxied');
    return;
  }
  served += 1;
  if (served > maxRequests) {
    fail(res, 429, `key-proxy: request cap of ${maxRequests} reached for this run`);
    return;
  }
  const headers = { ...req.headers };
  for (const name of HOP_BY_HOP) delete headers[name];
  headers['x-api-key'] = key;
  headers['anthropic-workspace-id'] = workspace;
  try {
    const upstream = https.request(
      { host: 'api.anthropic.com', path: req.url, method: req.method, headers },
      (answer) => {
        const out = { ...answer.headers };
        for (const name of HOP_BY_HOP) delete out[name];
        res.writeHead(answer.statusCode || 502, out);
        answer.pipe(res);
      },
    );
    upstream.on('error', (error) => fail(res, 502, `upstream error: ${error.message}`));
    res.on('close', () => upstream.destroy());
    req.on('error', () => upstream.destroy());
    req.pipe(upstream);
  } catch (error) {
    fail(res, 502, `proxy error: ${error.message}`);
  }
});

server.listen(port, '127.0.0.1', () => console.log(`key-proxy: listening on 127.0.0.1:${port}`));
