#!/usr/bin/env node
// Live-now slice 1 post-deploy probe (docs/handover/live-now-s1.md, Not verified).
// Run from a network that reaches www.bachatacalendar.co.uk, right after saving a
// state change (cancel / move) on a TEST event. Polls the canonical event page
// and its .data twin every 5 s for 2 min and prints age, x-vercel-cache,
// cf-cache-status and whether the body shows the new state.
//
//   node scripts/probe-live-now-headers.mjs <event-slug> [expected-text]
//   e.g. node scripts/probe-live-now-headers.mjs bachateame-saturdays Cancelled
//
// Read-only GETs on the canonical URLs, NO query string (a query is a separate
// Cloudflare entry and would measure nothing). Exit 0 when the expected text
// appeared on both URLs, 1 when it never did, 2 on bad usage.
const [slug, expected] = process.argv.slice(2);
if (!slug || !/^[a-z0-9][a-z0-9-]{0,199}$/i.test(slug)) {
  console.error("usage: node scripts/probe-live-now-headers.mjs <event-slug> [expected-text]");
  process.exit(2);
}
const ORIGIN = "https://www.bachatacalendar.co.uk";
const urls = [`${ORIGIN}/event/${slug}`, `${ORIGIN}/event/${slug}.data`];
const STEP_MS = 5_000;
const STEPS = 24; // 2 min
const t0 = Date.now();
const seen = new Map(urls.map((u) => [u, null]));

for (let i = 0; i <= STEPS; i++) {
  for (const u of urls) {
    try {
      const r = await fetch(u, { headers: { "user-agent": "bachata-live-now-probe/1" }, redirect: "manual" });
      const body = await r.text();
      const hit = expected ? body.includes(expected) : null;
      if (hit && seen.get(u) === null) seen.set(u, Date.now() - t0);
      const h = (k) => r.headers.get(k) ?? "-";
      console.log(
        [`t+${String(Math.round((Date.now() - t0) / 1000)).padStart(3)}s`, r.status, `age=${h("age")}`,
          `vercel=${h("x-vercel-cache")}`, `cf=${h("cf-cache-status")}`, expected ? `new=${hit}` : "", u.slice(ORIGIN.length)].join("  "),
      );
    } catch (err) {
      console.log(`t+${Math.round((Date.now() - t0) / 1000)}s  ERROR ${err instanceof Error ? err.message : String(err)}  ${u}`);
    }
  }
  if (expected && [...seen.values()].every((v) => v !== null)) break;
  if (i < STEPS) await new Promise((r) => setTimeout(r, STEP_MS));
}
if (expected) {
  for (const [u, ms] of seen) console.log(`${u.slice(ORIGIN.length)}: ${ms === null ? "never showed the new state in 2 min" : `new state after ${Math.round(ms / 1000)} s`}`);
  process.exit([...seen.values()].every((v) => v !== null) ? 0 : 1);
}
