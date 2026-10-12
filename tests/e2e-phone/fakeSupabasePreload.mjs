// Loaded into the PHONE suite's dev server only (playwright.phone.config.ts,
// NODE_OPTIONS=--import). Routes every Node-side fetch to the fake Supabase origin
// through answer(), so SSR loaders render from fixtures. Anything else passes
// through untouched. Never loaded by the app build or by any other config.
import { answer, FAKE_ORIGIN } from './fakeSupabase.mjs';

const realFetch = globalThis.fetch;
globalThis.fetch = async function fakeSupabaseFetch(input, init) {
  const req = input instanceof Request ? input : null;
  const url = req ? req.url : String(input instanceof URL ? input.href : input);
  if (!url.startsWith(FAKE_ORIGIN)) return realFetch(input, init);
  const headers = Object.fromEntries(new Headers(init?.headers ?? req?.headers ?? {}).entries());
  const method = init?.method ?? req?.method ?? 'GET';
  const res = answer({ method, url, headers });
  if (process.env.FAKE_SUPABASE_LOG) console.log(`[fake-supabase] ssr ${method} ${url.slice(FAKE_ORIGIN.length)} -> ${res.status}`);
  return new Response(method === 'HEAD' ? null : res.body, { status: res.status, headers: res.headers });
};
