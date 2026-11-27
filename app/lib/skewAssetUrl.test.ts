// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { pinAssetUrl, pinManifest, STYLESHEET_RELOAD_SCRIPT } from "./skewAssetUrl";

const make = () => ({
  url: "/assets/manifest-x.js",
  entry: { module: "/assets/entry.js", imports: ["/assets/a.js"], css: [] as string[] },
  routes: { root: { module: "/assets/root.js", imports: ["/assets/a.js"], css: ["/assets/root-abc.css"] } },
});

describe("pinManifest", () => {
  it("adds ?dpl= to stylesheets only when enabled and an id is set", () => {
    const p = pinManifest(make(), { enabled: true, deploymentId: "dpl_1" });
    expect(p.routes.root.css).toEqual(["/assets/root-abc.css?dpl=dpl_1"]);
    // JS stays plain: chunks import each other by plain URL, so a pinned
    // modulepreload would never match the real import.
    expect(p.routes.root.module).toBe("/assets/root.js");
    expect(p.routes.root.imports).toEqual(["/assets/a.js"]);
    expect(p.entry.module).toBe("/assets/entry.js");
    expect(p.entry.imports).toEqual(["/assets/a.js"]);
    expect(p.url).toBe("/assets/manifest-x.js");
  });
  it("leaves URLs unchanged without the flag or the id", () => {
    const m = make();
    expect(pinManifest(m, { enabled: false, deploymentId: "dpl_1" })).toBe(m);
    expect(pinManifest(m, { enabled: true, deploymentId: undefined })).toBe(m);
    expect(pinManifest(m, { enabled: true, deploymentId: "" })).toBe(m);
  });
  it("does not mutate the shared manifest and is idempotent", () => {
    const m = make();
    const a = pinManifest(m, { enabled: true, deploymentId: "dpl_1" });
    expect(pinManifest(m, { enabled: true, deploymentId: "dpl_1" })).toBe(a);
    expect(m.routes.root.css).toEqual(["/assets/root-abc.css"]);
  });
  it("only pins /assets/ urls, once", () => {
    expect(pinAssetUrl("https://x.test/a.css", "d")).toBe("https://x.test/a.css");
    expect(pinAssetUrl("/assets/a.css?dpl=d", "d")).toBe("/assets/a.css?dpl=d");
  });
  it("puts the pin before RR's trailing '#' dynamic-css marker", () => {
    expect(pinAssetUrl("/assets/homeMap-x.css#", "dpl_1")).toBe("/assets/homeMap-x.css?dpl=dpl_1#");
    expect(pinAssetUrl("/assets/homeMap-x.css?dpl=dpl_1#", "dpl_1")).toBe("/assets/homeMap-x.css?dpl=dpl_1#");
    const p = pinManifest(
      { url: "/m.js", entry: { css: [] }, routes: { home: { css: ["/assets/homeMap-x.css#"] } } },
      { enabled: true, deploymentId: "dpl_1" },
    );
    expect(p.routes.home.css).toEqual(["/assets/homeMap-x.css?dpl=dpl_1#"]);
  });
});

describe("STYLESHEET_RELOAD_SCRIPT", () => {
  function run(stored: Record<string, string>, link: Record<string, unknown>) {
    let handler: (e: unknown) => void = () => {};
    const reload = vi.fn();
    const sessionStorage = {
      getItem: (k: string) => stored[k] ?? null,
      setItem: (k: string, v: string) => void (stored[k] = v),
    };
    const document = { addEventListener: (_t: string, h: typeof handler) => (handler = h) };
    new Function("document", "sessionStorage", "location", STYLESHEET_RELOAD_SCRIPT)(document, sessionStorage, { reload });
    handler({ target: { tagName: "LINK", rel: "stylesheet", getAttribute: () => "/assets/root-abc.css", ...link } });
    return reload;
  }
  it("reloads once, then not again in the same session", () => {
    const stored: Record<string, string> = {};
    expect(run(stored, {})).toHaveBeenCalledTimes(1);
    expect(stored["chunk-reload-attempted"]).toBe("1");
    expect(run(stored, {})).not.toHaveBeenCalled();
  });
  it("ignores non-stylesheet and non-asset errors", () => {
    expect(run({}, { rel: "icon" })).not.toHaveBeenCalled();
    expect(run({}, { getAttribute: () => "/x.css" })).not.toHaveBeenCalled();
  });
});
