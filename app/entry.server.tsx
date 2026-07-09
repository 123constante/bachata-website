import { PassThrough, Transform } from "node:stream";
import { randomBytes } from "node:crypto";
import { createElement } from "react";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import { renderToPipeableStream, type RenderToPipeableStreamOptions } from "react-dom/server";
import { ServerRouter, type EntryContext } from "react-router";
import { NonceProvider } from "./nonce";
import { contentSecurityPolicy } from "./csp";
import { captureServerException } from "./sentry.server";

// Custom streaming server entry. Faithful to @vercel/react-router/entry.server
// (isbot onAllReady, skew-protection cookie, streamTimeout abort) with the CSP
// nonce grafted on: generate a per-request nonce, thread it to <ServerRouter>
// (RR's inline context script), renderToPipeableStream (React bootstrap), the
// NonceProvider (so <Scripts nonce> in root.tsx matches), and set the document's
// Content-Security-Policy header. The Vercel preset's build output is unaffected
// by replacing this render entry.
export const streamTimeout = 5_000;

// Streams `source` through, injecting a CSP <meta> immediately before the first
// </head>. The head is flushed whole in the shell chunk, so the marker is intact
// in a single chunk; once injected we pass everything else through untouched. The
// CSP contains only single quotes, safe inside the double-quoted content attr.
function injectCspMeta(source: PassThrough, csp: string): Transform {
  let done = false;
  const transform = new Transform({
    transform(chunk, _enc, cb) {
      if (done) return cb(null, chunk);
      const s = chunk.toString("utf8");
      const idx = s.indexOf("</head>");
      if (idx === -1) return cb(null, chunk);
      done = true;
      const meta = `<meta http-equiv="Content-Security-Policy" content="${csp}">`;
      cb(null, s.slice(0, idx) + meta + s.slice(idx));
    },
  });
  source.pipe(transform);
  return transform;
}

const vercelDeploymentId = process.env.VERCEL_DEPLOYMENT_ID;
const vercelSkewProtectionEnabled = process.env.VERCEL_SKEW_PROTECTION_ENABLED === "1";
const RELEASE_ID =
  process.env.VITE_VERCEL_GIT_COMMIT_SHA?.trim() ||
  process.env.VERCEL_GIT_COMMIT_SHA?.trim() ||
  process.env.VITE_RELEASE?.trim() ||
  "dev";

// RR7 server error hook: fires for every loader/action/render throw during SSR
// (e.g. the intentional fetchQuery gate in routes/home.tsx). Until now these
// were invisible — client Sentry only sees the browser, and there is no
// server-side Sentry. Emitting a single structured line routes them into Vercel
// function logs, keyed to the route + release, so a bad SSR path is diagnosable.
// Request-aborted errors (client navigated away / streamTimeout) are not bugs.
// NOTE: full Sentry ingestion of these is a follow-up — see plan R1b (needs a
// declared @sentry/node at a major matching @sentry/react, or @sentry/react-router).
export function handleError(
  error: unknown,
  { request }: { request: Request },
): void {
  if (request.signal.aborted) return;
  const err = error instanceof Error ? error : new Error(String(error));
  // Structured line → Vercel function logs (always, even without a Sentry DSN).
  console.error(
    JSON.stringify({
      tag: "ssr-error",
      release: RELEASE_ID,
      url: request.url,
      method: request.method,
      name: err.name,
      message: err.message,
      stack: err.stack,
    }),
  );
  // …and into Sentry proper (no-ops without a DSN).
  captureServerException(err, { url: request.url, method: request.method });
}

export default function handleRequest(
  request: Request,
  responseStatusCode: number,
  responseHeaders: Headers,
  routerContext: EntryContext,
  _loadContext: unknown,
  options?: RenderToPipeableStreamOptions,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    let shellRendered = false;
    const nonce = randomBytes(16).toString("base64");
    const userAgent = request.headers.get("user-agent");

    // Bots + SPA-mode renders wait for all content before responding.
    const readyOption: keyof RenderToPipeableStreamOptions =
      (userAgent && isbot(userAgent)) || (routerContext as { isSpaMode?: boolean }).isSpaMode
        ? "onAllReady"
        : "onShellReady";

    const { pipe, abort } = renderToPipeableStream(
      createElement(
        NonceProvider,
        { value: nonce },
        createElement(ServerRouter, { context: routerContext, url: request.url, nonce }),
      ),
      {
        ...options,
        nonce,
        [readyOption]() {
          shellRendered = true;
          const csp = contentSecurityPolicy(nonce);
          const body = new PassThrough();
          // The response reads from the CSP-injecting transform (fed by `body`),
          // NOT from `body` directly — see injectCspMeta. The meta form omits
          // frame-ancestors (ignored + console-warned in meta; covered by
          // X-Frame-Options), while the header above keeps it.
          const cspStream = injectCspMeta(body, contentSecurityPolicy(nonce, { forMeta: true }));
          const stream = createReadableStreamFromReadable(cspStream);

          responseHeaders.set("Content-Type", "text/html");
          // Per-request CSP header for LIVE SSR responses.
          responseHeaders.set("Content-Security-Policy", csp);
          // Keep error responses out of the index. A loader throwing a 404 (e.g.
          // throwDetailNotFound for an unresolvable slug) renders the ErrorBoundary
          // here, but RR drops the thrown Response's own headers, so set noindex
          // centrally on any >= 400. Prerendered routes are always 200, so this
          // only ever tags genuine live-SSR error responses.
          if (responseStatusCode >= 400) {
            responseHeaders.set("X-Robots-Tag", "noindex");
          }
          if (vercelSkewProtectionEnabled && vercelDeploymentId) {
            responseHeaders.append("Set-Cookie", `__vdpl=${vercelDeploymentId}; HttpOnly`);
          }

          resolve(new Response(stream, { headers: responseHeaders, status: responseStatusCode }));
          // Also bake the SAME policy into the HTML as a <meta http-equiv> so it
          // survives PRERENDER-to-static: a prerendered route is served straight
          // from the CDN, so the response header above never runs, but the meta
          // travels inside the document and carries the same build-time nonce the
          // scripts were stamped with. Injected into the raw stream (before
          // </head>, after all React-rendered head nodes) — NOT the React tree —
          // so client hydration never reconciles it (useNonce() is undefined
          // client-side, which would mismatch a nonce-bearing meta in the tree).
          pipe(body);
        },
        onShellError(error: unknown) {
          reject(error);
        },
        onError(error: unknown) {
          responseStatusCode = 500;
          if (shellRendered) console.error(error);
        },
      },
    );

    setTimeout(abort, streamTimeout + 1000);
  });
}
