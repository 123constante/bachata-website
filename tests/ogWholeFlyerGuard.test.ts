/**
 * Guard mutation test (docs/briefs/whole-flyer-og-b1.md): feed
 * scripts/check-og-images.mjs fixtures with REAL JPEG/WebP bodies made by sharp
 * and assert every mutant FAILS and every healthy fixture PASSES. The guard is
 * a shebang'd node script vitest cannot import, so its exported pure rule
 * (wholeFlyerFailures) is run in a child node process; the --self-test canary
 * runs the same rules on header-only fixtures and is asserted green here too.
 */
import { describe, it, expect, beforeAll } from "vitest";
import sharp from "sharp";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const GUARD = resolve(__dirname, "../scripts/check-og-images.mjs");
const PROD = "https://www.bachatacalendar.co.uk";
const ID = "01173937-0000-4000-8000-46b1f42d630c";
const WF_LIVE = `${PROD}/api/og/card?kind=event&id=${ID}&v=x.jpg&l=wf1&s=960x1200`;
const LEGACY_LIVE = `${PROD}/api/og/card?kind=event&id=${ID}&v=x.jpg`;
const KEY = (tail: string) => `https://media.bachatacalendar.co.uk/events/og/event/${ID}-default-0123456789abcdef${tail}.jpg`;

type Fixture = {
  name: string;
  expect: "fail" | "pass";
  ogImage: string;
  declared: { width: number; height: number };
  body: "jpeg-960x1200" | "jpeg-1200x630" | "jpeg-1500x500" | "jpeg-960x1000" | "webp-960x1200" | "jpeg-no-sof";
  /** For the round-2 mutants: the failure must be the NAMED rule, not any rule. */
  failureIncludes?: string;
  cacheControl?: string | null;
  ogLayout?: string | null;
  expectedMode?: string;
};

const FIXTURES: Fixture[] = [
  { name: "declared 1200x630 over a 960x1200 body", expect: "fail", ogImage: WF_LIVE, declared: { width: 1200, height: 630 }, body: "jpeg-960x1200", cacheControl: "public, max-age=3600", ogLayout: "wf1" },
  { name: "the 1200x630 text fallback under l=wf1, X-OG-Fallback and X-OG-Layout stripped", expect: "fail", ogImage: WF_LIVE, declared: { width: 960, height: 1200 }, body: "jpeg-1200x630", cacheControl: "public, max-age=300", ogLayout: null },
  { name: "a WebP body (served as image/jpeg)", expect: "fail", ogImage: WF_LIVE, declared: { width: 960, height: 1200 }, body: "webp-960x1200", cacheControl: "public, max-age=3600", ogLayout: "wf1" },
  { name: "a 3:1 card", expect: "fail", ogImage: LEGACY_LIVE, declared: { width: 1500, height: 500 }, body: "jpeg-1500x500" },
  { name: "a whole-flyer key served while the expected mode is off", expect: "fail", ogImage: KEY("-wf1-960x1200"), declared: { width: 960, height: 1200 }, body: "jpeg-960x1200", expectedMode: "off" },
  { name: "l=wf1 URL with Cache-Control 14400", expect: "fail", ogImage: WF_LIVE, declared: { width: 960, height: 1200 }, body: "jpeg-960x1200", cacheControl: "public, max-age=14400", ogLayout: "wf1", expectedMode: "allowlist" },
  { name: "l=wf1 URL answered with X-OG-Layout: legacy", expect: "fail", ogImage: WF_LIVE, declared: { width: 960, height: 1200 }, body: "jpeg-960x1200", cacheControl: "public, max-age=3600", ogLayout: "legacy" },
  { name: "baked key size differs from the decoded size", expect: "fail", ogImage: KEY("-wf1-960x1200"), declared: { width: 960, height: 1000 }, body: "jpeg-960x1000", expectedMode: "on" },
  // Review-fix round (findings 2 and 3): both survived with ZERO failures before the fix.
  { name: "l=wf1&s=960x1200 answered with a 1200x630 JPEG, X-OG-Layout wf1, 1h cache, page declaring 1200x630", expect: "fail", ogImage: WF_LIVE, declared: { width: 1200, height: 630 }, body: "jpeg-1200x630", cacheControl: "public, max-age=3600", ogLayout: "wf1", failureIncludes: "decoded size differs from s=" },
  { name: "JPEG header plus EOI, no SOF (live legacy URL)", expect: "fail", ogImage: LEGACY_LIVE, declared: { width: 1200, height: 630 }, body: "jpeg-no-sof", failureIncludes: "cannot read decoded size" },
  { name: "JPEG header plus EOI, no SOF (live l=wf1 URL)", expect: "fail", ogImage: WF_LIVE, declared: { width: 960, height: 1200 }, body: "jpeg-no-sof", cacheControl: "public, max-age=3600", ogLayout: "wf1", failureIncludes: "cannot read decoded size" },
  { name: "JPEG header plus EOI, no SOF (baked legacy key)", expect: "fail", ogImage: KEY(""), declared: { width: 1200, height: 630 }, body: "jpeg-no-sof", failureIncludes: "cannot read decoded size" },
  { name: "JPEG header plus EOI, no SOF (baked wf1 key, mode on)", expect: "fail", ogImage: KEY("-wf1-960x1200"), declared: { width: 960, height: 1200 }, body: "jpeg-no-sof", expectedMode: "on", failureIncludes: "cannot read decoded size" },
  { name: "healthy: legacy plain key", expect: "pass", ogImage: KEY(""), declared: { width: 1200, height: 630 }, body: "jpeg-1200x630" },
  { name: "healthy: legacy facts key", expect: "pass", ogImage: KEY("-0123456789ab"), declared: { width: 1200, height: 630 }, body: "jpeg-1200x630" },
  { name: "healthy: wf1 key with the right size (mode on)", expect: "pass", ogImage: KEY("-wf1-960x1200"), declared: { width: 960, height: 1200 }, body: "jpeg-960x1200", expectedMode: "on" },
  { name: "healthy: wf1 key (mode allowlist)", expect: "pass", ogImage: KEY("-wf1-960x1200"), declared: { width: 960, height: 1200 }, body: "jpeg-960x1200", expectedMode: "allowlist" },
  { name: "healthy: live l=wf1 card", expect: "pass", ogImage: WF_LIVE, declared: { width: 960, height: 1200 }, body: "jpeg-960x1200", cacheControl: "public, max-age=3600", ogLayout: "wf1" },
  { name: "healthy: live legacy card keeps its year-long cache (l-less, not checked)", expect: "pass", ogImage: LEGACY_LIVE, declared: { width: 1200, height: 630 }, body: "jpeg-1200x630", cacheControl: "public, max-age=86400, s-maxage=31536000" },
];

let results: Record<string, string[]> = {};

beforeAll(async () => {
  const solid = (w: number, h: number) => sharp({ create: { width: w, height: h, channels: 3, background: { r: 30, g: 30, b: 40 } } });
  const bodies: Record<string, string> = {
    "jpeg-960x1200": (await solid(960, 1200).jpeg().toBuffer()).toString("base64"),
    "jpeg-1200x630": (await solid(1200, 630).jpeg().toBuffer()).toString("base64"),
    "jpeg-1500x500": (await solid(1500, 500).jpeg().toBuffer()).toString("base64"),
    "jpeg-960x1000": (await solid(960, 1000).jpeg().toBuffer()).toString("base64"),
    "webp-960x1200": (await solid(960, 1200).webp().toBuffer()).toString("base64"),
    // SOI + APP0 (JFIF) + EOI: JPEG magic bytes, no frame header to read a size from.
    "jpeg-no-sof": Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9]).toString("base64"),
  };
  const dir = mkdtempSync(join(tmpdir(), "og-wf-guard-"));
  const input = join(dir, "fixtures.json");
  writeFileSync(input, JSON.stringify({ fixtures: FIXTURES, bodies }));
  const script = `
    import { readFileSync } from 'node:fs';
    const { wholeFlyerFailures } = await import(${JSON.stringify(pathToFileURL(GUARD).href)});
    const { fixtures, bodies } = JSON.parse(readFileSync(process.argv[1], 'utf8'));
    const out = {};
    for (const f of fixtures) {
      out[f.name] = wholeFlyerFailures({
        ogImage: f.ogImage, declared: f.declared, expectedMode: f.expectedMode ?? 'off',
        img: { body: Buffer.from(bodies[f.body], 'base64'), cacheControl: f.cacheControl ?? null, ogLayout: f.ogLayout ?? null },
      });
    }
    process.stdout.write(JSON.stringify(out));
  `;
  results = JSON.parse(execFileSync(process.execPath, ["--input-type=module", "-e", script, input], { encoding: "utf8" }));
});

describe("check-og-images.mjs whole-flyer rules: every mutant fails, every healthy fixture passes", () => {
  it.each(FIXTURES)("$expect: $name", (f) => {
    const failures = results[f.name];
    expect(Array.isArray(failures)).toBe(true);
    if (f.expect === "fail") {
      expect(failures.length, "mutant survived").toBeGreaterThan(0);
      if (f.failureIncludes) expect(failures.some((x) => x.includes(f.failureIncludes!)), `no "${f.failureIncludes}" failure in ${JSON.stringify(failures)}`).toBe(true);
    }
    else expect(failures, "healthy fixture flagged").toEqual([]);
  });

  it("the guard's own --self-test is green and carries the whole-flyer cases", () => {
    const out = execFileSync(process.execPath, [GUARD, "--self-test"], { encoding: "utf8" });
    expect(out).toMatch(/PASS self-test/);
    // 10 mutants + 4 healthy fixtures, named "wf mutant: ..." / "wf healthy: ...".
    expect((out.match(/^ok\s+wf (mutant|healthy):/gm) ?? []).length).toBe(14);
    expect(out).toMatch(/^ok\s+wf mutant: .*decoded size differs from s=/m);
    expect(out).toMatch(/^ok\s+wf mutant: .*cannot read decoded size/m);
    expect(out).not.toMatch(/^FAIL/m);
  });
});
