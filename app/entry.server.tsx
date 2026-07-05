import { PassThrough } from "node:stream";
import { randomBytes } from "node:crypto";
import { createElement } from "react";
import { createReadableStreamFromReadable } from "@react-router/node";
import { isbot } from "isbot";
import { renderToPipeableStream, type RenderToPipeableStreamOptions } from "react-dom/server";
import { ServerRouter, type EntryContext } from "react-router";
import { NonceProvider } from "./nonce";
import { contentSecurityPolicy } from "./csp";

// Custom streaming server entry. Faithful to @vercel/react-router/entry.server
// (isbot onAllReady, skew-protection cookie, streamTimeout abort) with the CSP
// nonce grafted on: generate a per-request nonce, thread it to <ServerRouter>
// (RR's inline context script), renderToPipeableStream (React bootstrap), the
// NonceProvider (so <Scripts nonce> in root.tsx matches), and set the document's
// Content-Security-Policy header. The Vercel preset's build output is unaffected
// by replacing this render entry.
export const streamTimeout = 5_000;

const vercelDeploymentId = process.env.VERCEL_DEPLOYMENT_ID;
const vercelSkewProtectionEnabled = process.env.VERCEL_SKEW_PROTECTION_ENABLED === "1";

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
          const body = new PassThrough();
          const stream = createReadableStreamFromReadable(body);

          responseHeaders.set("Content-Type", "text/html");
          responseHeaders.set("Content-Security-Policy", contentSecurityPolicy(nonce));
          if (vercelSkewProtectionEnabled && vercelDeploymentId) {
            responseHeaders.append("Set-Cookie", `__vdpl=${vercelDeploymentId}; HttpOnly`);
          }

          resolve(new Response(stream, { headers: responseHeaders, status: responseStatusCode }));
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
