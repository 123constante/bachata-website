// Edge window for unknown-path 404 (docs/ops/vercel-cpu-cuts-2026-11-04.md,
// slice 3). The catchall gate's verdict travels to the document finaliser; ONLY
// the `unknown` verdict (a pure function of the path + build) earns the short
// edge window. Every other outcome keeps the exact headers it had before.
//
// `finalDocument` replays entry.server.tsx's two header steps for a live SSR
// document, in order: noindex on >= 400, then finalizeDocumentCacheHeaders.
// The "real handleRequest wiring" block below drives the REAL entry.server
// default export instead (review 1362-r1 finding 1: the replay above cannot see
// the glue in entry.server, so mutants of that glue survived it).
import { readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { matchRoutes } from "react-router";
import type { EntryContext } from "react-router";

// The city lookup handleRequest calls (via gateCatchallOutcome). Per-test value.
const cityLookup = vi.hoisted(() => ({ impl: async (_slug: string): Promise<boolean> => false }));
vi.mock("@/lib/cityValidity", () => ({ isRealCitySlug: (slug: string) => cityLookup.impl(slug) }));
// React rendering is not under test: the shell is "ready" at once with a stub
// body, so handleRequest reaches its header code with no router tree.
vi.mock("react-dom/server", () => ({
  renderToPipeableStream: (_el: unknown, opts: Record<string, () => void>) => {
    queueMicrotask(() => (opts.onShellReady ?? opts.onAllReady)());
    return { pipe: (w: NodeJS.WritableStream) => w.end("<html><head></head><body></body></html>"), abort: () => {} };
  },
}));
// Pass-through spy: the real finaliser runs; the test also reads the options
// handleRequest handed it (a 503 with edge404 true is invisible in the final
// header -- the finaliser also requires 404 -- but not in the argument).
vi.mock("./documentCacheHeaders", async (importOriginal) => {
  const real = await importOriginal<typeof import("./documentCacheHeaders")>();
  return { ...real, finalizeDocumentCacheHeaders: vi.fn(real.finalizeDocumentCacheHeaders) };
});
import { classifyCatchallPath, resolveCatchallOutcome } from "./catchallGate";
import { cacheHeaders, edgeCacheControl, staticShellCacheHeaders } from "./detailLoader";
import { EDGE_404, finalizeDocumentCacheHeaders } from "./documentCacheHeaders";

const BROWSER = "public, max-age=0, must-revalidate";
const SHELL_EDGE = edgeCacheControl();
const COOKIE = "__vdpl=dpl_test; HttpOnly";
const real = async () => true;
const notReal = async () => false;
const broken = async (): Promise<boolean> => {
  throw new Error("db down");
};

type Headers5 = { cache: string | null; edge: string | null; tag: string | null; robots: string | null; cookie: string | null };
type Doc = Headers5 & { status: number };

type Expected = {
  status: number;
  cache: string;
  edge: string | null;
  tag: string | null;
  robots: string | null;
  /** Set-Cookie when skew protection is ON (always null when off). */
  cookieWhenSkewOn: string | null;
};

function finalDocument(
  route: Record<string, string>,
  status: number,
  skewOn: boolean,
  edge404 = false,
): Headers5 {
  const h = new Headers(route);
  if (status >= 400) h.set("X-Robots-Tag", "noindex");
  finalizeDocumentCacheHeaders(h, status, { enabled: skewOn, deploymentId: "dpl_test" }, { edge404 });
  return {
    cache: h.get("Cache-Control"),
    edge: h.get("Vercel-CDN-Cache-Control"),
    tag: h.get("Vercel-Cache-Tag"),
    robots: h.get("X-Robots-Tag"),
    cookie: h.get("Set-Cookie"),
  };
}

/** A catchall document: gate first (as entry.server does), then render. */
async function catchallDocument(
  path: string,
  isRealCity: (slug: string) => Promise<boolean>,
  skewOn: boolean,
  renderFailsWith500 = false,
): Promise<Doc> {
  const outcome = await resolveCatchallOutcome(new URL(`https://x.test${path}`), isRealCity, 50);
  if (outcome.status === 308) {
    const h = new Headers({ Location: outcome.location, ...staticShellCacheHeaders() });
    return { status: 308, cache: h.get("Cache-Control"), edge: h.get("Vercel-CDN-Cache-Control"), tag: null, robots: null, cookie: null };
  }
  const edge404 = outcome.status === 404 ? outcome.edge404 : false;
  const status = renderFailsWith500 ? 500 : outcome.status;
  return { status, ...finalDocument(staticShellCacheHeaders(), status, skewOn, edge404) };
}

const NO_STORE_ERROR = { cache: "no-store", edge: null, tag: null, robots: "noindex", cookieWhenSkewOn: COOKIE };

type Row = { name: string; run: (skewOn: boolean) => Promise<Doc>; expect: Expected };

const ROWS: Row[] = [
  {
    name: "unknown-path 404 (catchall `unknown` verdict)",
    run: (s) => catchallDocument("/zz-probe-123", notReal, s),
    expect: { status: 404, cache: "no-store", edge: "public, s-maxage=300", tag: null, robots: "noindex", cookieWhenSkewOn: null },
  },
  {
    name: "unknown-path 404 whose render then fails (500)",
    run: (s) => catchallDocument("/zz-probe-123", notReal, s, true),
    expect: { status: 500, ...NO_STORE_ERROR },
  },
  {
    name: "loader-thrown 404 (throwDetailNotFound, untagged)",
    run: async (s) => ({ status: 404, ...finalDocument(cacheHeaders(new Headers()), 404, s) }),
    expect: { status: 404, ...NO_STORE_ERROR },
  },
  {
    name: "city-subpath 404 (city lookup said no)",
    run: (s) => catchallDocument("/city/zzzz-not-a-place-qqq/parties", notReal, s),
    expect: { status: 404, ...NO_STORE_ERROR },
  },
  {
    name: "legacy-city 404 (city lookup said no)",
    run: (s) => catchallDocument("/zzzz-not-a-place-qq", notReal, s),
    expect: { status: 404, ...NO_STORE_ERROR },
  },
  {
    name: "503 (city lookup failed)",
    run: (s) => catchallDocument("/zzzz-not-a-place-qq", broken, s),
    expect: { status: 503, ...NO_STORE_ERROR },
  },
  {
    name: "500 thrown by a loader (untagged)",
    run: async (s) => ({ status: 500, ...finalDocument(cacheHeaders(new Headers()), 500, s) }),
    expect: { status: 500, ...NO_STORE_ERROR },
  },
  {
    name: "render error after a TAGGED loader (500)",
    run: async (s) => ({ status: 500, ...finalDocument(cacheHeaders(new Headers({ "Vercel-Cache-Tag": "event-abc" })), 500, s) }),
    expect: { status: 500, ...NO_STORE_ERROR },
  },
  {
    name: "200 client shell (/venues)",
    run: (s) => catchallDocument("/venues", notReal, s),
    expect: { status: 200, cache: BROWSER, edge: SHELL_EDGE, tag: null, robots: null, cookieWhenSkewOn: null },
  },
  {
    name: "308 legacy /<city> redirect",
    run: (s) => catchallDocument("/london-gb", real, s),
    expect: { status: 308, cache: BROWSER, edge: SHELL_EDGE, tag: null, robots: null, cookieWhenSkewOn: null },
  },
];

describe("catchall verdict -> document cache headers", () => {
  it("only the `unknown` verdict carries edge404", async () => {
    expect(classifyCatchallPath("/zz-probe-123")).toEqual({ kind: "unknown" });
    expect(await resolveCatchallOutcome(new URL("https://x.test/zz-probe-123"), notReal)).toEqual({ status: 404, edge404: true });
    expect(await resolveCatchallOutcome(new URL("https://x.test/a/b/c/d"), notReal)).toEqual({ status: 404, edge404: true });
    expect(await resolveCatchallOutcome(new URL("https://x.test/city/zzzz-not-a-place-qqq/parties"), notReal)).toEqual({ status: 404, edge404: false });
    expect(await resolveCatchallOutcome(new URL("https://x.test/zzzz-not-a-place-qq"), notReal)).toEqual({ status: 404, edge404: false });
  });

  it("the unknown verdict needs no city lookup", async () => {
    let called = 0;
    await resolveCatchallOutcome(new URL("https://x.test/zz-probe-123"), async () => {
      called += 1;
      return false;
    });
    expect(called).toBe(0);
  });

  it.each(ROWS.flatMap((row) => [true, false].map((skewOn) => ({ ...row, skewOn }))))(
    "$name, skew $skewOn",
    async ({ run, expect: want, skewOn }) => {
      const got = await run(skewOn);
      expect(got.status).toBe(want.status);
      expect(got.cache).toBe(want.cache);
      expect(got.edge).toBe(want.edge);
      expect(got.tag).toBe(want.tag);
      expect(got.robots).toBe(want.robots);
      expect(got.cookie).toBe(skewOn ? want.cookieWhenSkewOn : null);
    },
  );

  it("an edge-cached 404 never carries Set-Cookie (Vercel would not store it)", () => {
    const got = finalDocument(staticShellCacheHeaders(), 404, true, true);
    expect(got.edge).toBe(EDGE_404);
    expect(got.cookie).toBeNull();
  });

  it.each([200, 308, 500, 503])("edge404 passed with status %i is ignored", (status) => {
    const withFlag = finalDocument(staticShellCacheHeaders(), status, true, true);
    const without = finalDocument(staticShellCacheHeaders(), status, true, false);
    expect(withFlag).toEqual(without);
  });

  it("EDGE_404: no stale window, short, positive", () => {
    expect(EDGE_404).toBe("public, s-maxage=300");
    expect(EDGE_404).not.toMatch(/stale/);
  });
});

// Must NOT change: sign-in / account pages stay on the plain 200 shell, byte
// for byte, whatever the request carries (the magic-link credential lives in
// the URL fragment, which no server sees).
describe("sign-in and account shell headers are unchanged", () => {
  const SHELL = { status: 200, cache: BROWSER, edge: SHELL_EDGE, tag: null, robots: null, cookie: null };
  // (/profile and /onboarding are not app paths at all: they are unknown 404s.)
  it.each(["/auth", "/auth/callback", "/account", "/account/settings", "/account/continue", "/finish-profile"])(
    "%s -> the 200 shell, cookie-free",
    async (path) => {
      expect(classifyCatchallPath(path)).toEqual({ kind: "client" });
      expect(await catchallDocument(path, notReal, true)).toEqual(SHELL);
      expect(await catchallDocument(path, notReal, false)).toEqual(SHELL);
    },
  );
});

// Scanner / probe / near-miss paths: the same `unknown` code path as
// /zz-probe-123, pinned by name (review 1362-r1, real-data shapes table).
describe("probe and near-miss paths are unknown edge-cached 404s", () => {
  it.each(["/wp-login.php", "/.env", "/.well-known/security.txt", "/ads.txt", "/api/nope", "/event", "/event/"])(
    "%s -> unknown 404 + edge window, no tag, no cookie",
    async (path) => {
      expect(classifyCatchallPath(path)).toEqual({ kind: "unknown" });
      for (const skewOn of [true, false]) {
        expect(await catchallDocument(path, notReal, skewOn)).toEqual({
          status: 404,
          cache: "no-store",
          edge: EDGE_404,
          tag: null,
          robots: "noindex",
          cookie: null,
        });
      }
    },
  );
});

// Real files and the sitemap never reach the catchall gate as `unknown` 404s.
//
// public/ files: the gate WOULD call every one of them `unknown` (asserted
// below, so this is not a vacuous guard). They never get there because Vercel's
// routing serves the static build output (public/ is copied into build/client)
// before any function -- the filesystem-first ordering of the @vercel/react-router
// preset's Build Output. That ordering is platform behaviour no unit test can
// drive, so this block PINS the contract instead of proving it: the full list of
// public/ files is fixed here, robots.txt and favicon.ico by name, and adding a
// file to public/ fails this test until someone confirms it is served statically
// (curl the preview: 200 with no `x-vercel-cache: MISS` from the function) and
// adds it to the list.
describe("public/ files and the sitemap are not catchall 404s", () => {
  const PUBLIC = join(process.cwd(), "public");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = join(dir, name);
      return statSync(p).isDirectory() ? walk(p) : ["/" + relative(PUBLIC, p).split("\\").join("/")];
    });
  const STATIC_FILES = [
    "/android-chrome-192x192.png",
    "/android-chrome-512x512.png",
    "/apple-touch-icon.png",
    "/favicon-16x16.png",
    "/favicon-32x32.png",
    "/favicon.ico",
    "/map-placeholder/london-gb-desktop.webp",
    "/map-placeholder/london-gb-mobile.webp",
    "/og-image.jpg",
    "/placeholder.svg",
    "/robots.txt",
    "/site.webmanifest",
  ];

  it("robots.txt and favicon.ico are real static files", () => {
    expect(statSync(join(PUBLIC, "robots.txt")).isFile()).toBe(true);
    expect(statSync(join(PUBLIC, "favicon.ico")).isFile()).toBe(true);
  });

  it("public/ holds exactly the pinned static files (new file = confirm it is served statically, then pin it)", () => {
    expect(walk(PUBLIC).sort()).toEqual([...STATIC_FILES].sort());
  });

  it("every pinned file is one the gate would call unknown (why filesystem-first matters)", () => {
    for (const path of STATIC_FILES) expect(classifyCatchallPath(path)).toEqual({ kind: "unknown" });
  });

  it("/sitemap.xml matches the sitemap route, not the catchall", async () => {
    const { default: routes } = await import("./routes");
    const toObjects = (rs: typeof routes): Parameters<typeof matchRoutes>[0] =>
      rs.map((r) => ({ path: r.path, index: r.index, id: r.file, children: r.children ? toObjects(r.children) : undefined })) as Parameters<typeof matchRoutes>[0];
    const matched = matchRoutes(toObjects(routes), "/sitemap.xml");
    expect(matched?.[matched.length - 1].route.id).toBe("routes/sitemap.tsx");
    const probe = matchRoutes(toObjects(routes), "/zz-probe-123");
    expect(probe?.[probe.length - 1].route.id).toBe("routes/catchall.tsx");
  });
});

// The REAL entry.server default export, with a catchall router context. Kills
// the wiring mutants of review 1362-r1 finding 1 (E1 edge404 true for any 404,
// E2 `{}` options, E3 assignment deleted, E4 true for 503, E5 gate result
// without edge404): each changes the final header or the finaliser argument.
describe("real handleRequest wiring: edge window only for the unknown verdict", () => {
  const catchallContext = { staticHandlerContext: { matches: [{ route: { id: "routes/catchall" } }] } } as unknown as EntryContext;

  async function serve(path: string, lookup: (slug: string) => Promise<boolean>) {
    cityLookup.impl = lookup;
    const { default: handleRequest } = await import("./entry.server");
    const { finalizeDocumentCacheHeaders: spy } = await import("./documentCacheHeaders");
    vi.mocked(spy).mockClear();
    const res = await handleRequest(new Request(`https://x.test${path}`), 200, new Headers(staticShellCacheHeaders()), catchallContext, {});
    await res.text();
    const calls = vi.mocked(spy).mock.calls;
    return { res, calls };
  }

  const CASES = [
    { path: "/zz-probe", lookup: notReal, status: 404, edge: EDGE_404, edge404: true },
    { path: "/city/zz-x/parties", lookup: notReal, status: 404, edge: null, edge404: false },
    { path: "/zz-x-qq", lookup: notReal, status: 404, edge: null, edge404: false },
    { path: "/zz-x-qq", lookup: broken, status: 503, edge: null, edge404: false },
  ];

  it.each(CASES)("$path (status $status) -> Vercel-CDN-Cache-Control $edge", async ({ path, lookup, status, edge, edge404 }) => {
    const { res, calls } = await serve(path, lookup);
    expect(res.status).toBe(status);
    expect(res.headers.get("Vercel-CDN-Cache-Control")).toBe(edge);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    expect(res.headers.get("Vercel-Cache-Tag")).toBeNull();
    expect(res.headers.get("Set-Cookie")).toBeNull();
    expect(calls).toHaveLength(1);
    expect(calls[0][1]).toBe(status);
    expect(calls[0][3]).toEqual({ edge404 });
  });
});
