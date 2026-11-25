import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { eventHostForwardUrl } from "./eventHostForward";

type Cond = { type: string; value?: string };
const cfg = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as {
  redirects: Array<{ source: string; has?: Cond[]; missing?: Cond[] }>;
  rewrites: Array<{ source: string; has?: Cond[]; destination: string }>;
};
const conds = (r: { has?: Cond[]; missing?: Cond[] }) => [...(r.has ?? []), ...(r.missing ?? [])];
const re = (v: string) => new RegExp("^(?:" + v + ")$");

describe("vercel.json host conditions", () => {
  it("has no lookahead/lookbehind in any has/missing value", () => {
    for (const r of [...cfg.redirects, ...cfg.rewrites]) {
      for (const c of conds(r)) expect(c.value ?? "").not.toMatch(/\(\?(?:!|=|<!)/);
    }
  });

  const root = cfg.redirects.find((r) => r.source === "/")!;
  const rootHost = re(root.has![0].value!);
  it("root redirect host matches www, apex and previews only", () => {
    for (const h of ["www.bachatacalendar.co.uk", "bachatacalendar.co.uk", "x.vercel.app"]) {
      expect(rootHost.test(h)).toBe(true);
    }
    for (const h of ["zzqqrandom.bachatacalendar.co.uk", "www.zzqq.bachatacalendar.co.uk"]) {
      expect(rootHost.test(h)).toBe(false);
    }
  });

  it("rewrite host regexes capture the label and never match www itself", () => {
    const plain = cfg.rewrites.filter((r) => r.source === "/" && !r.has![0].value!.startsWith("www"));
    const www = cfg.rewrites.filter((r) => r.source === "/" && r.has![0].value!.startsWith("www"));
    const m = re(plain[0].has![0].value!).exec("bachatalounge.bachatacalendar.co.uk");
    expect(m?.groups?.label).toBe("bachatalounge");
    expect(re(plain[0].has![0].value!).test("www.bachatacalendar.co.uk")).toBe(false);
    expect(re(plain[0].has![0].value!).test("wwwx.bachatacalendar.co.uk")).toBe(true);
    expect(re(plain[0].has![0].value!).test("w.bachatacalendar.co.uk")).toBe(true);
    expect(re(www[0].has![0].value!).exec("www.zzqq.bachatacalendar.co.uk")?.groups?.label).toBe("zzqq");
  });
});

describe("eventHostForwardUrl", () => {
  it("forwards other paths on an event host to www, keeping the query", () => {
    expect(eventHostForwardUrl("zzqq.bachatacalendar.co.uk", "/city/london-gb", "?x=1")).toBe(
      "https://www.bachatacalendar.co.uk/city/london-gb?x=1",
    );
  });
  it("does not forward www / apex / previews", () => {
    expect(eventHostForwardUrl("www.bachatacalendar.co.uk", "/city/london-gb")).toBeNull();
    expect(eventHostForwardUrl("bachatacalendar.co.uk", "/festivals")).toBeNull();
    expect(eventHostForwardUrl("foo.vercel.app", "/festivals")).toBeNull();
  });
  it("exempts the rewritten event path, assets, api and _vercel", () => {
    const h = "zzqq.bachatacalendar.co.uk";
    expect(eventHostForwardUrl(h, "/event/zzqq")).toBeNull();
    expect(eventHostForwardUrl(h, "/event/other")).not.toBeNull();
    expect(eventHostForwardUrl(h, "/assets/a.js")).toBeNull();
    expect(eventHostForwardUrl(h, "/api/og/card")).toBeNull();
    expect(eventHostForwardUrl(h, "/_vercel/insights/script.js")).toBeNull();
    expect(eventHostForwardUrl(h, "/_root.data")).toBeNull();
    expect(eventHostForwardUrl(h, "/city/london-gb.data")).toBeNull();
  });
});
