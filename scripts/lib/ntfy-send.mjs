// ntfy publish. The token NAME is referenced; its VALUE is read from env at call time,
// goes only into the Authorization header of the one request, and is never logged or returned.

export const DEFAULT_TOKEN_ENV = 'NTFY_PUBLISH_TOKEN';
export const MAX_TITLE = 100;

/** -> { status:'sent', id } | { status:'refused', reason } | { status:'failed', httpStatus|reason } */
export async function sendNtfy({ url, topic, tokenEnvName = DEFAULT_TOKEN_ENV, title = '', body = '', fetch: fetchImpl = globalThis.fetch, env = process.env, timeoutMs = 10000 } = {}) {
  const token = env && env[tokenEnvName];
  if (!token) return { status: 'refused', reason: `no ${tokenEnvName} in env` };
  if (typeof url !== 'string' || !/^https:\/\//.test(url) || !/^[\w.-]+$/.test(String(topic ?? ''))) return { status: 'refused', reason: 'bad url or topic' };
  if (typeof fetchImpl !== 'function') return { status: 'refused', reason: 'no fetch' };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetchImpl(`${url.replace(/\/+$/, '')}/${topic}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, Title: String(title).replace(/[^\x20-\x7e]/g, '?').slice(0, MAX_TITLE) },
      body: String(body),
      signal: ac.signal,
    });
    if (!res || res.status !== 200) return { status: 'failed', httpStatus: res ? res.status : null };
    let id = null;
    try { id = JSON.parse(await res.text()).id; } catch { id = null; }
    if (typeof id !== 'string' || id === '') return { status: 'failed', httpStatus: 200, reason: 'no message id' };
    return { status: 'sent', id };
  } catch (e) {
    return { status: 'failed', reason: ac.signal.aborted ? 'timeout' : 'network error' };
  } finally {
    clearTimeout(timer);
  }
}
