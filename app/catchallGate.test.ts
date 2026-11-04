// Edge window for unknown-path 404 (docs/ops/vercel-cpu-cuts-2026-11-04.md,
// slice 3). The catchall gate's verdict travels to the document finaliser; ONLY
// the `unknown` verdict (a pure function of the path + build) earns the short
// edge window. Every other outcome keeps the exact headers it had before.
//
// `finalDocument` replays entry.server.tsx's two header steps for a live SSR
// document, in order: noindex on >= 400, then finalizeDocumentCacheHeaders.
import { describe, expect, it } from "vitest";
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
