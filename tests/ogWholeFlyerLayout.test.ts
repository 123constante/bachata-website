/**
 * Pure helpers of the whole-flyer slice (app/lib/ogLayout.ts) and the backfill
 * script's batch mode (scripts/backfill-og-images.mjs, contract D7), including
 * the PARITY of the script's key classifier with the app's read rule -- the
 * script is plain node and keeps its own copy, so this test is what stops the
 * two drifting apart.
 */
import { describe, it, expect } from "vitest";
import { execFile } from "node:child_process";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { resolve } from "node:path";
import {
  acceptBakedKey,
  bakedOgPath,
  classifyBakedKey,
  isWholeFlyerCanvas,
  makeOgLayoutPolicy,
  parseCanvas,
  parseLiveLayout,
  wholeFlyerCanvas,
} from "../app/lib/ogLayout";
// @ts-expect-error -- plain .mjs script, no type declarations
import { keyLayout, missingConfig, parseBackfillArgs, planBackfill } from "../scripts/backfill-og-images.mjs";

const ID = "01173937-0000-4000-8000-46b1f42d630c";
const OCC = "5e0c0a43-0000-4000-8000-00000000000a";
const SERIES2 = "9a0b6c1d-0000-4000-8000-000000000001";
const K = (tail: string) => `https://media.bachatacalendar.co.uk/events/og/event/${ID}-default-0123456789abcdef${tail}`;

describe("canvas rule (D1)", () => {
  it.each([
    [560, 1000, 1200], [750, 1000, 1200], [800, 1000, 1200], [900, 1000, 1067], [1000, 1000, 960],
    [1200, 1000, 800], [1590, 1000, 604], [1820, 1000, 527], [1910, 1000, 503], [2280, 1000, 503], [3140, 1000, 503],
  ])("%ix%i -> 960x%i", (w, h, H) => {
    expect(wholeFlyerCanvas(w, h)).toEqual({ width: 960, height: H });
    expect(isWholeFlyerCanvas(960, H)).toBe(true);
  });
  it("unreadable sizes give no canvas", () => {
    expect(wholeFlyerCanvas(0, 100)).toBeNull();
    expect(wholeFlyerCanvas(NaN, 100)).toBeNull();
    expect(wholeFlyerCanvas(100, Infinity)).toBeNull();
  });
  it("only 960 x [503, 1200] is a whole-flyer canvas", () => {
    expect(isWholeFlyerCanvas(960, 502)).toBe(false);
    expect(isWholeFlyerCanvas(960, 1201)).toBe(false);
    expect(isWholeFlyerCanvas(1200, 630)).toBe(false);
  });
});

describe("mode switch (D3)", () => {
  it.each([
    ["off", ID, "legacy"], ["test", ID, "legacy"], ["on", ID, "wf1"], ["On", ID, "legacy"], ["ON", ID, "legacy"],
    ["allowlist", ID, "wf1"], ["allowlist", SERIES2, "legacy"], ["garbage", ID, "legacy"],
  ])("mode %s, entity %s -> %s", (mode, entity, want) => {
    expect(makeOgLayoutPolicy(mode, ` ${ID.toUpperCase()} , not-a-uuid`).layoutFor("event", entity)).toBe(want);
  });
  it("allowlist with no valid id behaves as off", () => {
    const p = makeOgLayoutPolicy("allowlist", "nope, ,");
    expect(p.mode).toBe("off");
    expect(p.layoutFor("event", ID)).toBe("legacy");
  });
  it("festivals are always legacy, even in mode on", () => {
    expect(makeOgLayoutPolicy("on", "").layoutFor("festival", ID)).toBe("legacy");
    expect(makeOgLayoutPolicy("allowlist", ID).layoutFor("festival", ID)).toBe("legacy");
  });
});

describe("live URL (D4 b, b2)", () => {
  const q = (s: string) => new URLSearchParams(s);
  it("l=wf1&s=960x1200 on an event", () => {
    expect(parseLiveLayout("event", q("l=wf1&s=960x1200"))).toEqual({ layout: "wf1", size: { width: 960, height: 1200 } });
  });
  it("no l, another l, or another kind is legacy", () => {
    expect(parseLiveLayout("event", q("v=1"))).toEqual({ layout: "legacy" });
    expect(parseLiveLayout("event", q("l=wf2&s=960x1200"))).toEqual({ layout: "legacy" });
    expect(parseLiveLayout("festival", q("l=wf1&s=960x1200"))).toEqual({ layout: "legacy" });
  });
  it.each(["960x1201", "960x500", "1200x630", "960x1200x1", "x", ""])("s=%j is invalid", (s) => {
    expect(parseLiveLayout("event", q(`l=wf1&s=${s}`)).layout).toBe("wf1-invalid");
  });
  it("parseCanvas is strict", () => {
    expect(parseCanvas("960x1200")).toEqual({ width: 960, height: 1200 });
    expect(parseCanvas(" 960x1200")).toBeNull();
  });
});

describe("baked key (D2, D4 a/c, D8)", () => {
  it("bakedOgPath: legacy shape unchanged, wf1 carries version and size and never the facts tag", () => {
    const base = { entityType: "event" as const, entityId: ID, occTag: OCC, coverTag: "0123456789abcdef" };
    expect(bakedOgPath({ ...base, layout: "legacy" })).toBe(`og/event/${ID}-${OCC}-0123456789abcdef.jpg`);
    expect(bakedOgPath({ ...base, layout: "legacy", factsTag: "0123456789ab" })).toBe(`og/event/${ID}-${OCC}-0123456789abcdef-0123456789ab.jpg`);
    expect(bakedOgPath({ ...base, layout: "wf1", size: { width: 960, height: 604 }, factsTag: "" })).toBe(`og/event/${ID}-${OCC}-0123456789abcdef-wf1-960x604.jpg`);
    expect(() => bakedOgPath({ ...base, layout: "wf1", size: { width: 1200, height: 630 } })).toThrow();
  });
  it("classify and accept", () => {
    expect(classifyBakedKey(K(".jpg"))).toEqual({ shape: "legacy" });
    expect(classifyBakedKey(K("-wf1-960x1200.jpg?x=1"))).toEqual({ shape: "wf", version: 1, width: 960, height: 1200 });
    expect(classifyBakedKey(K("-0123456789ab-wf1-960x1200.jpg"))).toEqual({ shape: "unknown" });
    expect(acceptBakedKey(K(".jpg"), "legacy")).toEqual({ width: 1200, height: 630 });
    expect(acceptBakedKey(K(".jpg"), "wf1")).toBeNull();
    expect(acceptBakedKey(K("-wf1-960x1200.jpg"), "legacy")).toBeNull();
    expect(acceptBakedKey(K("-wf2-960x1200.jpg"), "wf1")).toBeNull();
  });
});

const PARITY_KEYS = [
  K(".jpg"), K("-0123456789ab.jpg"), K(".jpg?v=2"), K("-wf1-960x1200.jpg"), K("-wf1-960x503.jpg"),
  K("-wf1-960x502.jpg"), K("-wf1-960x2000.jpg"), K("-wf2-960x1200.jpg"), K("-0123456789ab-wf1-960x1200.jpg"),
  `https://media.bachatacalendar.co.uk/events/og/event/${ID}.jpg`, "", "not a url",
];

describe("backfill script: key classifier parity with the app read rule", () => {
  it.each(PARITY_KEYS)("%s", (url) => {
    const app = acceptBakedKey(url, "wf1") ? "wf1" : acceptBakedKey(url, "legacy") ? "legacy" : null;
    expect(keyLayout(url)).toBe(app);
  });
});

describe("backfill script: flags", () => {
  it("no flags = today's run", () => {
    expect(parseBackfillArgs([])).toEqual({ batch: false, errors: [] });
  });
  it("--layout is required with any batch flag", () => {
    expect(parseBackfillArgs(["--limit", "25"]).errors.join()).toMatch(/--layout .* required/);
    expect(parseBackfillArgs(["--layout", "WF1"]).errors.join()).toMatch(/--layout must be/);
  });
  it("parses --layout, --ids, --limit, --dry-run (both spellings)", () => {
    const o = parseBackfillArgs(["--layout=wf1", "--ids", `${ID.toUpperCase()},${SERIES2}`, "--limit=25", "--dry-run"]);
    expect(o.errors).toEqual([]);
    expect(o.layout).toBe("wf1");
    expect([...o.ids]).toEqual([ID, SERIES2]);
    expect(o.limit).toBe(25);
    expect(o.dryRun).toBe(true);
  });
  it.each([["--limit", "0"], ["--limit", "x"], ["--ids", "nope"], ["--bogus", ""]])("rejects %s %s", (f, v) => {
    expect(parseBackfillArgs(["--layout", "wf1", f, v].filter(Boolean)).errors.length).toBeGreaterThan(0);
  });
});

describe("backfill script: OG_BAKE_SECRET only when a bake will be sent (review finding 6)", () => {
  const env = { SUPABASE_URL: "http://x", SERVICE_KEY: "k", BAKE_SECRET: "" };
  it.each([
    ["--dry-run batch", ["--layout", "wf1", "--dry-run"], []],
    ["real batch", ["--layout", "wf1", "--limit", "1"], ["OG_BAKE_SECRET"]],
    ["no-flag full run", [], ["OG_BAKE_SECRET"]],
  ])("%s without the secret -> missing %j", (_n, argv, want) => {
    expect(missingConfig(parseBackfillArgs(argv), env)).toEqual(want);
  });
  it("Supabase config is still required for a dry run", () => {
    expect(missingConfig(parseBackfillArgs(["--layout", "wf1", "--dry-run"]), { SUPABASE_URL: "", SERVICE_KEY: "", BAKE_SECRET: "s" }))
      .toEqual(["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"]);
  });

  // End to end against a local stand-in for PostgREST (read-only GETs and the
  // targets RPC); any request to a bake path would be recorded and fail the test.
  const SCRIPT = resolve(__dirname, "../scripts/backfill-og-images.mjs");
  async function runScript(argv: string[]) {
    const seen: string[] = [];
    const server = createServer((req, res) => {
      seen.push(`${req.method} ${req.url}`);
      res.setHeader("Content-Type", "application/json");
      if (req.url?.startsWith("/rest/v1/rpc/og_render_targets_v1")) {
        res.end(JSON.stringify([
          { entity_type: "event", entity_id: ID, occurrence_id: null },
          { entity_type: "event", entity_id: SERIES2, occurrence_id: null },
        ]));
      } else if (req.url?.startsWith("/rest/v1/og_render")) res.end("[]");
      else { res.statusCode = 404; res.end("{}"); }
    });
    await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
    const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const childEnv: NodeJS.ProcessEnv = { ...process.env, SUPABASE_URL: base, SUPABASE_SERVICE_ROLE_KEY: "test-key", OG_BAKE_URL: `${base}/api/og/bake`, NO_PROXY: "127.0.0.1" };
    delete childEnv.OG_BAKE_SECRET;
    try {
      return await new Promise<{ code: number; out: string; seen: string[] }>((r) => {
        execFile(process.execPath, [SCRIPT, ...argv], { env: childEnv, encoding: "utf8" }, (err, stdout, stderr) => {
          r({ code: err ? Number((err as { code?: number }).code ?? 1) : 0, out: `${stdout}${stderr}`, seen });
        });
      });
    } finally {
      await new Promise<void>((r) => server.close(() => r()));
    }
  }
  it("a dry run with OG_BAKE_SECRET unset exits 0, prints the target counts, POSTs no bake", async () => {
    const r = await runScript(["--layout", "wf1", "--dry-run"]);
    expect(r.code, r.out).toBe(0);
    expect(r.out).toMatch(/2 targets in scope; 0 already on wf1; 2 NOT yet on wf1; this run bakes 2/);
    expect(r.seen.some((s) => s.includes("/api/og/bake"))).toBe(false);
  });
  it("a real run with OG_BAKE_SECRET unset still refuses (exit 2) before any request", async () => {
    const r = await runScript(["--layout", "wf1", "--limit", "1"]);
    expect(r.code).toBe(2);
    expect(r.out).toMatch(/Missing OG_BAKE_SECRET/);
    expect(r.seen).toEqual([]);
  });
});

describe("backfill script: plan (skip filter, --ids expansion, --limit counts bakes)", () => {
  const OCC2 = "5e0c0a43-0000-4000-8000-00000000000b";
  const targets = [
    { entity_type: "event", entity_id: ID, occurrence_id: null },
    { entity_type: "event", entity_id: ID, occurrence_id: OCC },
    { entity_type: "event", entity_id: ID, occurrence_id: OCC2 },
    { entity_type: "event", entity_id: SERIES2, occurrence_id: null },
    { entity_type: "festival", entity_id: "f0000000-0000-4000-8000-000000000000", occurrence_id: null },
  ];
  const rows = [
    { entity_type: "event", entity_id: ID, occurrence_id: null, status: "ready", image_url: K("-wf1-960x1200.jpg") },
    { entity_type: "event", entity_id: ID, occurrence_id: OCC, status: "ready", image_url: K(".jpg") },
    { entity_type: "event", entity_id: ID, occurrence_id: OCC2, status: "error", image_url: K("-wf1-960x1200.jpg") },
    { entity_type: "event", entity_id: SERIES2, occurrence_id: null, status: "ready", image_url: K("-0123456789ab.jpg") },
  ];
  it("skips targets already on the layout; an error row is never 'on' it", () => {
    const p = planBackfill(targets, rows, { layout: "wf1" });
    expect(p.inScope).toHaveLength(5);
    expect(p.onLayout).toBe(1);
    expect(p.notOnLayout.map((t: { occurrence_id: string | null }) => t.occurrence_id)).toEqual([OCC, OCC2, null, null]);
  });
  it("--ids takes a series id and expands to its occurrence targets", () => {
    const p = planBackfill(targets, rows, { layout: "wf1", ids: new Set([ID]) });
    expect(p.inScope).toHaveLength(3);
    expect(p.notOnLayout).toHaveLength(2);
  });
  it("--limit counts bakes, not ids: one series id can give fewer bakes than its targets", () => {
    const p = planBackfill(targets, rows, { layout: "wf1", ids: new Set([ID]), limit: 1 });
    expect(p.toBake).toHaveLength(1);
    expect(p.notOnLayout).toHaveLength(2);
  });
  it("mode off rollback: --layout legacy re-bakes rows on a wf key", () => {
    const p = planBackfill(targets, rows, { layout: "legacy" });
    expect(p.onLayout).toBe(2);
    expect(p.notOnLayout.map((t: { entity_id: string; occurrence_id: string | null }) => t.occurrence_id ?? t.entity_id)).toEqual([
      null, OCC2, "f0000000-0000-4000-8000-000000000000",
    ].map((x) => x ?? ID));
  });
});
