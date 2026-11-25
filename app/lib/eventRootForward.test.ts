import { describe, it, expect, vi, beforeEach } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const resolvePublicEventRef = vi.fn();
vi.mock("@/lib/seo/resolvePublicEventRef", () => ({ resolvePublicEventRef }));
vi.mock("./../detailLoader", () => ({ staticShellCacheHeaders: () => ({}) }));
vi.mock("../routes/catchall", () => ({ default: () => null }));
vi.mock("../routes/event", () => ({ default: () => null, headers: () => ({}), loader: vi.fn(), meta: () => [] }));

import { APP_PATHS, rootForwardCandidate } from "./eventRootForward";

const ON = { EVENT_SUBDOMAIN_LINKS: "true" };
const WWW = "www.bachatacalendar.co.uk";

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.(test|spec)\./.test(name)) out.push(p);
  }
  return out;
}

describe("APP_PATHS stays in sync with the route tables", () => {
  it("lists every single-segment route path in src/ and app/routes.ts", () => {
    const found = new Set<string>();
    const jsx = /path=["']\/([A-Za-z0-9_.-]+)["']/g;
    const obj = /path:\s*["']\/([A-Za-z0-9_.-]+)["']/g;
    const fw = /\broute\(\s*["']([A-Za-z0-9_.-]+)["']/g;
    for (const f of walk("src")) {
      const text = readFileSync(f, "utf8");
      for (const re of [jsx, obj]) for (const m of text.matchAll(re)) found.add(m[1].toLowerCase());
    }
    const routes = readFileSync("app/routes.ts", "utf8");
    for (const m of routes.matchAll(fw)) found.add(m[1].toLowerCase());
    expect(found.size).toBeGreaterThan(20);
    const missing = [...found].filter((p) => !APP_PATHS.has(p));
    expect(missing).toEqual([]);
  });
});

describe("rootForwardCandidate", () => {
  it.each([
    [WWW, "unidosflow", "unidosflow"],
    [WWW, "UnidosFlow", "unidosflow"],
    ["bachatacalendar.co.uk", "unidosflow", "unidosflow"],
  ])("%s /%s -> %s", (host, seg, want) => {
    expect(rootForwardCandidate(host, seg, ON)).toBe(want);
  });

  it.each(["tonight", "home", "account", "www", "admin", "19-dec", "uni-dos"])("/%s -> null", (seg) => {
    expect(rootForwardCandidate(WWW, seg, ON)).toBeNull();
  });

  it("flag off -> null", () => {
    expect(rootForwardCandidate(WWW, "unidosflow", {})).toBeNull();
  });

  it.each(["x.vercel.app", "localhost:3000", "unidosflow.bachatacalendar.co.uk", null])("host %s -> null", (host) => {
    expect(rootForwardCandidate(host, "unidosflow", ON)).toBeNull();
  });
});

describe("event-night loader: root forward", () => {
  beforeEach(() => {
    resolvePublicEventRef.mockReset();
    vi.stubEnv("EVENT_SUBDOMAIN_LINKS", "true");
  });

  async function run(path: string) {
    const { loader } = await import("../routes/event-night");
    const request = new Request(`https://${WWW}${path}`);
    const name = path.slice(1).split("?")[0];
    try {
      return { result: await loader({ request, params: { night: name } }) };
    } catch (thrown) {
      return { thrown };
    }
  }

  it("live event -> 301 to its subdomain", async () => {
    resolvePublicEventRef.mockResolvedValue({ id: "1", slug: "unidosflow" });
    const { thrown } = await run("/unidosflow");
    expect((thrown as Response).status).toBe(301);
    expect((thrown as Response).headers.get("Location")).toBe("https://unidosflow.bachatacalendar.co.uk/");
    expect(resolvePublicEventRef).toHaveBeenCalledWith("unidosflow", "swallow");
  });

  it("keeps the query string", async () => {
    resolvePublicEventRef.mockResolvedValue({ id: "1", slug: "unidosflow" });
    const { thrown } = await run("/unidosflow?ref=ig");
    expect((thrown as Response).headers.get("Location")).toBe("https://unidosflow.bachatacalendar.co.uk/?ref=ig");
  });

  it("old name -> 301 to the current slug", async () => {
    resolvePublicEventRef.mockResolvedValue({ id: "1", slug: "newname" });
    const { thrown } = await run("/oldname");
    expect((thrown as Response).headers.get("Location")).toBe("https://newname.bachatacalendar.co.uk/");
  });

  it("unknown name -> null (404 as today)", async () => {
    resolvePublicEventRef.mockResolvedValue(null);
    expect((await run("/nothing")).result).toBeNull();
  });

  it("current slug with a dash -> null", async () => {
    resolvePublicEventRef.mockResolvedValue({ id: "1", slug: "uni-dos" });
    expect((await run("/unidosflow")).result).toBeNull();
  });

  it("site page -> resolver never called", async () => {
    expect((await run("/tonight")).result).toBeNull();
    expect(resolvePublicEventRef).not.toHaveBeenCalled();
  });

  it("flag off -> resolver never called", async () => {
    vi.stubEnv("EVENT_SUBDOMAIN_LINKS", "false");
    expect((await run("/unidosflow")).result).toBeNull();
    expect(resolvePublicEventRef).not.toHaveBeenCalled();
  });
});
