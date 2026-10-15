// Loaded (NODE_OPTIONS / node --import) into: the PHONE suite's dev server
// (playwright.phone.config.ts), and the production-build smoke -- its
// `npm run build` (phone-qa.yml build-smoke, so prerender reads fixtures) and its
// server (playwright.build.config.ts). Routes every Node-side fetch to the fake
// Supabase origin through answer(), so SSR loaders render from fixtures. Anything
// else passes through untouched, which is what keeps it safe inside a build.
// Never loaded by a deploy build (Vercel) or by any other config.
import { answer, FAKE_ORIGIN } from './fakeSupabase.mjs';

const realFetch = globalThis.fetch;
globalThis.fetch = async function fakeSupabaseFetch(input, init) {
  const req = input instanceof Request ? input : null;
  const url = req ? req.url : String(input instanceof URL ? input.href : input);
  if (!url.startsWith(FAKE_ORIGIN)) return realFetch(input, init);
  const headers = Object.fromEntries(new Headers(init?.headers ?? req?.headers ?? {}).entries());
  const method = init?.method ?? req?.method ?? 'GET';
  // The RPC args (an arg-aware answer reads them); supabase-js sends a JSON string body.
  const rawBody = init?.body ?? (req ? await req.clone().text() : null);
  const body = typeof rawBody === 'string' ? rawBody : null;
  const res = answer({ method, url, headers, body });
  if (process.env.FAKE_SUPABASE_LOG) console.log(`[fake-supabase] ssr ${method} ${url.slice(FAKE_ORIGIN.length)} -> ${res.status}`);
  return new Response(method === 'HEAD' ? null : res.body, { status: res.status, headers: res.headers });
};
