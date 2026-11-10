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
  body: "jpeg-960x1200" | "jpeg-1200x630" | "jpeg-1500x500" | "jpeg-960x1000" | "webp-960x1200";
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
    if (f.expect === "fail") expect(failures.length, "mutant survived").toBeGreaterThan(0);
    else expect(failures, "healthy fixture flagged").toEqual([]);
  });

  it("the guard's own --self-test is green and carries the whole-flyer cases", () => {
    const out = execFileSync(process.execPath, [GUARD, "--self-test"], { encoding: "utf8" });
    expect(out).toMatch(/PASS self-test/);
    // 8 mutants + 4 healthy fixtures, named "wf mutant: ..." / "wf healthy: ...".
    expect((out.match(/^ok\s+wf (mutant|healthy):/gm) ?? []).length).toBe(12);
    expect(out).not.toMatch(/^FAIL/m);
  });
});
