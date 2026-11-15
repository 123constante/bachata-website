// key-proxy.mjs -- holds the Anthropic API key so the worker process never sees it.
// The agent talks to http://127.0.0.1:PORT with a dummy key; this process swaps in the real key
// and the workspace header, then streams the answer back. Run it as a DIFFERENT OS user than the
// agent (the workflow does: sudo -u nobody) so /proc/<pid>/environ is unreadable to the agent.
// Only /v1/ paths are forwarded; anything else is refused.
import http from 'node:http';
import https from 'node:https';

const key = process.env.API_WORKER_KEY;
const workspace = process.env.API_WORKER_WORKSPACE;
const port = Number(process.env.API_WORKER_PROXY_PORT || 8787);

if (!key || !workspace) {
  console.error('key-proxy: API_WORKER_KEY and API_WORKER_WORKSPACE are required');
  process.exit(2);
}

const server = http.createServer((req, res) => {
  if (!String(req.url || '').startsWith('/v1/')) {
    res.writeHead(404);
    res.end('only /v1/ is proxied');
    return;
  }
  const headers = { ...req.headers };
  delete headers.host;
  delete headers.authorization;
  headers['x-api-key'] = key;
  headers['anthropic-workspace-id'] = workspace;
  const upstream = https.request(
    { host: 'api.anthropic.com', path: req.url, method: req.method, headers },
    (answer) => {
      res.writeHead(answer.statusCode || 502, answer.headers);
      answer.pipe(res);
    },
  );
  upstream.on('error', (error) => {
    res.writeHead(502);
    res.end(`upstream error: ${error.message}`);
  });
  req.pipe(upstream);
});

server.listen(port, '127.0.0.1', () => console.log(`key-proxy: listening on 127.0.0.1:${port}`));
