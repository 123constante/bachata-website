// Server half of the walk's fake (cf. tests/e2e-phone/fakeSupabasePreload.mjs), with walkAnswer.
import { FAKE_ORIGIN } from '../e2e-phone/fakeSupabase.mjs';
import { walkAnswer } from './states.mjs';

const realFetch = globalThis.fetch;
globalThis.fetch = async function walkFetch(input, init) {
  const req = input instanceof Request ? input : null;
  const url = req ? req.url : String(input instanceof URL ? input.href : input);
  if (!url.startsWith(FAKE_ORIGIN)) return realFetch(input, init);
  const headers = Object.fromEntries(new Headers(init?.headers ?? req?.headers ?? {}).entries());
  const method = init?.method ?? req?.method ?? 'GET';
  const rawBody = init?.body ?? (req ? await req.clone().text() : null);
  const res = walkAnswer({ method, url, headers, body: typeof rawBody === 'string' ? rawBody : null }, false);
  return new Response(method === 'HEAD' ? null : res.body, { status: res.status, headers: res.headers });
};
