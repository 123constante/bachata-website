// /advertising-stop -- RESOURCE ROUTE (loader + action, no component).
// Thin same-origin PROXY to the admin repo's `advertising-stop` edge function.
//
// Why it exists: Supabase serves text/html from *.supabase.co edge functions
// as text/plain, so the "Stop advertising X?" confirm page linked from the
// owner's daily email showed as raw code on a phone. Served from here it is a
// real page.
//
// Contract (edge handler, admin PR #1781): GET with a valid token renders the
// confirm page and NEVER changes state; POST with a valid token stops the
// event; an invalid/expired token renders a friendly page and changes nothing.
// The page's `<form method="post">` has no action, so it posts back to this
// same URL and lands in `action` below.
//
// Only the `t` value is ever forwarded -- no other query param, header, cookie
// or body field from the incoming request reaches upstream. The upstream URL
// is fixed. Not in the sitemap (that is DB-built), not linked from anywhere,
// noindex, no-store.
import type { Route } from "./+types/advertising-stop";

export const UPSTREAM_URL =
  "https://stsdtacfauprzrdebmzg.supabase.co/functions/v1/advertising-stop";
export const MAX_TOKEN_BYTES = 1024;
export const UPSTREAM_TIMEOUT_MS = 5000;
// A urlencoded body holding one <=1 KB token is well under this; anything
// bigger is not our form and is refused without being parsed.
const MAX_BODY_BYTES = 4096;

// Same CSP the edge handler sets. Resource routes bypass entry.server, so the
// site-wide nonce CSP is NOT applied here -- this is the only CSP on the page.
export const PAGE_CSP =
  "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'";

export function pageHeaders(): Headers {
  return new Headers({
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Robots-Tag": "noindex, nofollow",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": PAGE_CSP,
  });
}

function friendlyPage(title: string, message: string, status: number): Response {
  const body = `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>${title}</title>
<style>
body{margin:0;padding:0 16px;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f6f7;color:#18181b}
main{max-width:420px;margin:48px auto;padding:20px 16px;background:#fff;border-radius:12px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
h1{font-size:20px;margin:0 0 8px}
p{font-size:16px;line-height:1.45;margin:0}
</style></head>
<body><main><h1>${title}</h1><p>${message}</p></main></body></html>`;
  return new Response(body, { status, headers: pageHeaders() });
}

export const invalidLinkPage = () =>
  friendlyPage(
    "Link not valid",
    "This link is not valid or is incomplete. Nothing was changed.",
    400,
  );

export const upstreamErrorPage = (method: "GET" | "POST" = "GET") =>
  method === "GET"
    ? friendlyPage(
        "Something went wrong",
        "We could not reach the server. Nothing was changed. Please try the link again in a minute.",
        502,
      )
    : // A POST that timed out may still have been committed upstream, so this
      // copy must not claim "nothing was changed". Re-opening the link is safe:
      // GET never changes state and shows the current status.
      friendlyPage(
        "Could not confirm",
        "We could not confirm whether advertising was stopped. Open the link from the email again to check.",
        502,
      );

const methodNotAllowed = () => {
  const headers = pageHeaders();
  headers.set("Allow", "GET, POST");
  return new Response(
    "<!doctype html><title>Method not allowed</title><p>Method not allowed.</p>",
    { status: 405, headers },
  );
};

function validToken(t: string | null): t is string {
  if (!t) return false;
  return new TextEncoder().encode(t).length <= MAX_TOKEN_BYTES;
}

async function forward(init: { method: "GET" | "POST"; token: string }): Promise<Response> {
  const url = new URL(UPSTREAM_URL);
  let reqInit: RequestInit;
  if (init.method === "GET") {
    url.searchParams.set("t", init.token);
    reqInit = { method: "GET" };
  } else {
    reqInit = {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ t: init.token }).toString(),
    };
  }
  try {
    const upstream = await fetch(url.toString(), {
      ...reqInit,
      redirect: "error",
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
    const body = await upstream.text();
    // Gateway failures (boot error, WORKER_LIMIT, 5xx) come back as JSON or a
    // bare error, not the handler's page: show the friendly page instead of
    // raw text. The handler's own pages (incl. 4xx invalid-token) pass through.
    if (upstream.status >= 500 || body.trimStart().startsWith("{")) {
      console.error("[advertising-stop] upstream error status", upstream.status);
      return upstreamErrorPage(init.method);
    }
    return new Response(body, { status: upstream.status, headers: pageHeaders() });
  } catch (err) {
    console.error("[advertising-stop] upstream failed", err instanceof Error ? err.message : String(err));
    return upstreamErrorPage(init.method);
  }
}

export async function loader({ request }: Route.LoaderArgs): Promise<Response> {
  if (request.method !== "GET") return methodNotAllowed();
  const t = new URL(request.url).searchParams.get("t");
  if (!validToken(t)) return invalidLinkPage();
  return forward({ method: "GET", token: t });
}

export async function action({ request }: Route.ActionArgs): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed();
  const contentType = (request.headers.get("content-type") ?? "").toLowerCase();
  if (!contentType.startsWith("application/x-www-form-urlencoded")) return invalidLinkPage();
  // Browsers always send Content-Length for a urlencoded form. Requiring it
  // means a chunked or unbounded body is refused before anything is buffered.
  const declared = Number(request.headers.get("content-length"));
  if (!Number.isInteger(declared) || declared <= 0 || declared > MAX_BODY_BYTES) {
    return invalidLinkPage();
  }
  let raw: string;
  try {
    raw = await request.text();
  } catch {
    return invalidLinkPage();
  }
  if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) return invalidLinkPage();
  const t = new URLSearchParams(raw).get("t");
  if (!validToken(t)) return invalidLinkPage();
  return forward({ method: "POST", token: t });
}
