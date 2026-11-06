// Pins the /city/:slug document cache decision end to end: home.tsx headers()
// -> entry.server's finalizeDocumentCacheHeaders. Verification slice of
// docs/ops/vercel-cpu-cuts-2026-11-04.md (slice 2): NO code change, only pins.
//
// Cookie / Authorization rows: headers() is never handed the request (React
// Router passes loaderHeaders, not the request, to the cache decision), and no
// SSR loader reads Cookie or Authorization (scanned in
// app/documentCacheHeaders.test.ts, "SSR page loaders are anonymous"). So a
// signed-in visitor's request yields the SAME headers as an anonymous one; the
// rows below pin that the finalised headers are identical either way.
import { describe, expect, it } from "vitest";
import { finalizeDocumentCacheHeaders } from "../documentCacheHeaders";
import { cityTag, HOME_FEED } from "../cacheTags";
import { headers as homeHeaders } from "./home";

const TAG = `${HOME_FEED},${cityTag("london-gb")}`;
const BROWSER = "public, max-age=0, must-revalidate";
const FAIL_CLOSED = "public, s-maxage=0, must-revalidate";
const SKEW_ON = { enabled: true, deploymentId: "dpl_test" };
const SKEW_OFF = { enabled: false, deploymentId: undefined };

type Loader = { tag?: string; bound?: string; degraded?: boolean };

function loaderHeadersFor(l: Loader): Headers {
  const h = new Headers();
  if (l.tag) h.set("Vercel-Cache-Tag", l.tag);
  if (l.bound !== undefined) h.set("X-Edge-Ttl-Bound", l.bound);
  if (l.degraded) h.set("X-Home-Degraded", "1");
  return h;
}

function routeHeaders(l: Loader, request?: Request): Headers {
  const args = { loaderHeaders: loaderHeadersFor(l), request } as unknown as Parameters<typeof homeHeaders>[0];
  return new Headers(homeHeaders(args) as Record<string, string>);
}

function finalised(l: Loader, status: number, skew: typeof SKEW_ON | typeof SKEW_OFF, request?: Request): Record<string, string> {
  const h = routeHeaders(l, request);
  finalizeDocumentCacheHeaders(h, status, skew);
  return Object.fromEntries(h.entries());
}

describe("/city/:slug headers() per loader shape", () => {
  it.each([
    { name: "tagged 200, no bound", l: { tag: TAG }, edge: "public, s-maxage=3600, stale-while-revalidate=86400" },
    { name: "tagged 200, bound 7200 s (on-now transition ahead)", l: { tag: TAG, bound: "7200" }, edge: "public, s-maxage=3600, stale-while-revalidate=3595" },
    { name: "tagged 200, bound 600 s (transition soon)", l: { tag: TAG, bound: "600" }, edge: "public, s-maxage=595" },
    { name: "tagged 200, bound text Infinity (corrupt, fail-closed)", l: { tag: TAG, bound: "Infinity" }, edge: FAIL_CLOSED },
    { name: "tagged 200, bound non-numeric (fail-closed)", l: { tag: TAG, bound: "abc" }, edge: FAIL_CLOSED },
    { name: "tagged 200, bound empty (fail-closed)", l: { tag: TAG, bound: "" }, edge: FAIL_CLOSED },
  ])("$name", ({ l, edge }) => {
    const h = routeHeaders(l);
    expect(h.get("Cache-Control")).toBe(BROWSER);
    expect(h.get("Vercel-CDN-Cache-Control")).toBe(edge);
    expect(h.get("Vercel-Cache-Tag")).toBe(TAG);
  });

  it("degraded shell: browser no-store, 30 s edge, untagged", () => {
    const h = routeHeaders({ tag: TAG, degraded: true });
    expect(h.get("Cache-Control")).toBe("no-store");
    expect(h.get("Vercel-CDN-Cache-Control")).toBe("public, s-maxage=30");
    expect(h.has("Vercel-Cache-Tag")).toBe(false);
  });

  it("untagged loader: browser header only, nothing for the edge", () => {
    const h = routeHeaders({});
    expect(h.get("Cache-Control")).toBe(BROWSER);
    expect(h.has("Vercel-CDN-Cache-Control")).toBe(false);
  });
});

describe("/city/:slug finalised document headers", () => {
  const skews = [
    ["skew on", SKEW_ON],
    ["skew off", SKEW_OFF],
  ] as const;

  it.each(skews)("cacheable 200 (%s): s-maxage > 0, tag kept, NO Set-Cookie", (_n, skew) => {
    const out = finalised({ tag: TAG }, 200, skew);
    expect(out["vercel-cdn-cache-control"]).toMatch(/s-maxage=([1-9]\d*)/);
    expect(out["vercel-cache-tag"]).toBe(TAG);
    expect(out["set-cookie"]).toBeUndefined();
  });

  it.each(
    [404, 500, 503].flatMap((status) => skews.map(([n, skew]) => ({ status, n, skew }))),
  )("$status after a tagged loader ($n): no-store, no edge directive, no tag", ({ status, skew }) => {
    const out = finalised({ tag: TAG }, status, skew);
    expect(out["cache-control"]).toBe("no-store");
    expect(out["vercel-cdn-cache-control"]).toBeUndefined();
    expect(out["vercel-cache-tag"]).toBeUndefined();
    expect(out["set-cookie"]).toBe(skew.enabled ? "__vdpl=dpl_test; HttpOnly" : undefined);
  });

  it.each(skews)("fail-closed bound (%s) is not edge-cacheable, so the skew cookie may ride", (_n, skew) => {
    const out = finalised({ tag: TAG, bound: "abc" }, 200, skew);
    expect(out["vercel-cdn-cache-control"]).toBe(FAIL_CLOSED);
    expect(out["set-cookie"]).toBe(skew.enabled ? "__vdpl=dpl_test; HttpOnly" : undefined);
  });

  const SIGNED_IN = [
    ["Cookie", { cookie: "sb-access-token=abc; __vdpl=dpl_old" }],
    ["Authorization", { authorization: "Bearer abc" }],
    ["Cookie + Authorization", { cookie: "sb=1", authorization: "Bearer abc" }],
  ] as const;

  it.each(
    SIGNED_IN.flatMap(([n, hdrs]) =>
      [200, 404, 500].flatMap((status) => skews.map(([sn, skew]) => ({ n, hdrs, status, sn, skew }))),
    ),
  )("request with $n, status $status, $sn: headers IDENTICAL to anonymous", ({ hdrs, status, skew }) => {
    const anon = finalised({ tag: TAG }, status, skew, new Request("https://x.test/city/london-gb"));
    const signed = finalised({ tag: TAG }, status, skew, new Request("https://x.test/city/london-gb", { headers: hdrs }));
    expect(signed).toEqual(anon);
  });
});
