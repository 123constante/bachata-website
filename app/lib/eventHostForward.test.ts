import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { eventHostForwardUrl } from "./eventHostForward";
import { eventHostServable, eventSubdomainTestLabels } from "./eventSubdomain";

type Cond = { type: string; value?: string };
const cfg = JSON.parse(readFileSync(new URL("../../vercel.json", import.meta.url), "utf8")) as {
  redirects: Array<{ source: string; has?: Cond[]; missing?: Cond[] }>;
  rewrites?: unknown;
};
const re = (v: string) => new RegExp("^(?:" + v + ")$");

describe("vercel.json host conditions", () => {
  it("has no host rewrites (they never changed the path React Router sees)", () => {
    expect(cfg.rewrites).toBeUndefined();
  });
  it("has no lookahead/lookbehind in any has/missing value", () => {
    for (const r of cfg.redirects) {
      for (const c of [...(r.has ?? []), ...(r.missing ?? [])]) expect(c.value ?? "").not.toMatch(/\(\?(?:!|=|<!)/);
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
  it("serves / and night paths on an event host; forwards everything else", () => {
    const h = "zzqq.bachatacalendar.co.uk";
    expect(eventHostForwardUrl(h, "/")).toBeNull();
    expect(eventHostForwardUrl(h, "/19-dec")).toBeNull();
    expect(eventHostForwardUrl(h, "/3-jan-2027")).toBeNull();
    expect(eventHostForwardUrl(h, "/19-xyz")).toBe("https://www.bachatacalendar.co.uk/19-xyz");
    expect(eventHostForwardUrl(h, "/event/zzqq")).not.toBeNull();
    expect(eventHostForwardUrl(h, "/event/other")).not.toBeNull();
    expect(eventHostForwardUrl(h, "/19-dec/extra")).not.toBeNull();
  });
  it("exempts assets, api, _vercel and .data", () => {
    const h = "zzqq.bachatacalendar.co.uk";
    expect(eventHostForwardUrl(h, "/assets/a.js")).toBeNull();
    expect(eventHostForwardUrl(h, "/api/og/card")).toBeNull();
    expect(eventHostForwardUrl(h, "/_vercel/insights/script.js")).toBeNull();
    expect(eventHostForwardUrl(h, "/_root.data")).toBeNull();
    expect(eventHostForwardUrl(h, "/city/london-gb.data")).toBeNull();
  });
});

describe("event host gate (flag OR EVENT_SUBDOMAIN_TEST_LABELS)", () => {
  it("is closed by default", () => {
    expect(eventHostServable("zzqq", {})).toBe(false);
    expect(eventSubdomainTestLabels({})).toEqual([]);
  });
  it("test-label list enables exactly that label", () => {
    const env = { EVENT_SUBDOMAIN_TEST_LABELS: " ZZQQ , other" };
    expect(eventHostServable("zzqq", env)).toBe(true);
    expect(eventHostServable("other", env)).toBe(true);
    expect(eventHostServable("third", env)).toBe(false);
  });
  it("the flag serves every label", () => {
    expect(eventHostServable("anything", { EVENT_SUBDOMAIN_LINKS: "true" })).toBe(true);
  });
});
