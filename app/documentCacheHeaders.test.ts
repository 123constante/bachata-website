import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { cacheHeaders, edgeCacheControl, staticShellCacheHeaders } from "./detailLoader";
import { finalizeDocumentCacheHeaders, isEdgeCacheable } from "./documentCacheHeaders";

// End-state of a live SSR document's cache headers: the route's headers()
// output (the real cacheHeaders / staticShellCacheHeaders), then the
// entry.server finaliser. Asserted on the composed result because that is what
// the edge sees.
const SKEW_ON = { enabled: true, deploymentId: "dpl_test" };
const SKEW_OFF = { enabled: false, deploymentId: "dpl_test" };

function document(routeHeaders: Record<string, string>, status: number, skew = SKEW_ON): Headers {
  const h = new Headers(routeHeaders);
  finalizeDocumentCacheHeaders(h, status, skew);
  return h;
}

const tagged = (extra: Record<string, string> = {}) =>
  cacheHeaders(new Headers({ "Vercel-Cache-Tag": "event-abc", ...extra }));
// A thrown 404/500 reaches headers() with no loader tag.
const untagged = () => cacheHeaders(new Headers());

describe("live SSR document cache headers", () => {
  it("anonymous 200 on a tagged public route: edge s-maxage, tag kept, NO Set-Cookie", () => {
    const h = document(tagged(), 200);
    expect(h.get("Vercel-CDN-Cache-Control")).toBe(edgeCacheControl());
    expect(h.get("Vercel-CDN-Cache-Control")).toMatch(/s-maxage=[1-9]\d*/);
    expect(h.get("Vercel-Cache-Tag")).toBe("event-abc");
    // Set-Cookie on the response makes Vercel's CDN skip storing it.
    expect(h.get("Set-Cookie")).toBeNull();
  });

  it("deployment-constant shell (catchall: /auth, /account, client 404) is cacheable and cookie-free", () => {
    const h = document(staticShellCacheHeaders(), 200);
    expect(isEdgeCacheable(h)).toBe(true);
    expect(h.get("Set-Cookie")).toBeNull();
  });

  it.each([404, 500])("a thrown %i (no tag) gets no edge directive and no-store", (status) => {
    const h = document(untagged(), status);
    expect(h.get("Vercel-CDN-Cache-Control")).toBeNull();
    expect(h.get("Vercel-Cache-Tag")).toBeNull();
    expect(h.get("Cache-Control")).toBe("no-store");
  });

  it.each([404, 500])("a %i after a TAGGED loader is stripped of the edge directive and tag", (status) => {
    const h = document(tagged(), status);
    expect(h.get("Vercel-CDN-Cache-Control")).toBeNull();
    expect(h.get("Vercel-Cache-Tag")).toBeNull();
    expect(h.get("Cache-Control")).toBe("no-store");
    expect(isEdgeCacheable(h)).toBe(false);
  });

  it("an uncacheable document keeps the skew cookie (skew protection still works there)", () => {
    expect(document(untagged(), 200).get("Set-Cookie")).toBe("__vdpl=dpl_test; HttpOnly");
    expect(document(tagged(), 500).get("Set-Cookie")).toBe("__vdpl=dpl_test; HttpOnly");
  });

  it("a bound of zero (s-maxage=0) is NOT cacheable, so it keeps the cookie", () => {
    const h = document(tagged({ "X-Edge-Ttl-Bound": "0" }), 200);
    expect(h.get("Vercel-CDN-Cache-Control")).toBe("public, s-maxage=0, must-revalidate");
    expect(isEdgeCacheable(h)).toBe(false);
    expect(h.get("Set-Cookie")).toBe("__vdpl=dpl_test; HttpOnly");
  });

  it("skew protection off: never a cookie, cache policy unchanged", () => {
    expect(document(untagged(), 200, SKEW_OFF).get("Set-Cookie")).toBeNull();
    expect(document(tagged(), 200, SKEW_OFF).get("Vercel-CDN-Cache-Control")).toBe(edgeCacheControl());
  });

  it("browser layer stays max-age=0 on a cacheable 200 (edge purge can reach every copy)", () => {
    expect(document(tagged(), 200).get("Cache-Control")).toBe("public, max-age=0, must-revalidate");
  });
});

// The edge stores ONE copy per URL for every visitor. That is only safe while
// no SSR page loader personalises its output -- sign-in is client-side today.
// A loader that starts reading the auth cookie or Authorization header turns
// a shared cached copy into a leak, so it must fail here first and move to
// private/no-store. Resource routes (api.*) are exempt: they return their own
// Response and never pass through cacheHeaders.
describe("SSR page loaders are anonymous", () => {
  const dir = join(__dirname, "routes");
  const pages = readdirSync(dir).filter((f) => f.endsWith(".tsx") && !f.startsWith("api."));

  it("found the page route modules", () => {
    expect(pages.length).toBeGreaterThan(10);
  });

  it.each(pages)("%s reads no Cookie / Authorization request header", (file) => {
    const src = readFileSync(join(dir, file), "utf8");
    expect(src).not.toMatch(/headers\.get\(\s*["'](cookie|authorization)["']/i);
    expect(src).not.toMatch(/sb-[a-z0-9]+-auth-token|getSession\(|auth\.getUser\(/);
  });
});
