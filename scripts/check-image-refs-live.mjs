#!/usr/bin/env node
/**
 * CI contract check #47 -- live image references (2026-07-29).
 *
 * Calls public.list_public_image_refs_v1() and HEAD-checks every URL it returns,
 * failing on any >= 400. The RPC scopes itself to surfaces a reader can actually
 * reach (live + slugged event series, their in-view occurrence overrides,
 * venue_is_public venues, cities), so a dead image on an archived or draft record
 * cannot red-light CI.
 *
 * WHY: on 2026-07-28 a per-occurrence cover override was pointed at an R2 object
 * that was never uploaded, and /event/bachata-night served a 404 image for ~14
 * hours. The only thing that noticed was Prod Smoke happening to open that one
 * page, and its report said "Failed to load resource: 404" with no URL -- so
 * locating it needed a bespoke Playwright probe. This turns that into a checked
 * invariant that names the row.
 *
 * Local:  node scripts/check-image-refs-live.mjs
 * CI:     same, env: VITE_SUPABASE_URL, VITE_SUPABASE_PUBLISHABLE_KEY
 */
import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';

function loadEnv() {
  const env = { ...process.env };
  if (fs.existsSync('.env')) {
    for (const raw of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const i = line.indexOf('=');
      if (i < 0) continue;
      const k = line.slice(0, i).trim();
      const v = line.slice(i + 1).replace(/^"|"$/g, '');
      if (env[k] === undefined) env[k] = v;
    }
  }
  return env;
}

const env = loadEnv();
const url = env.VITE_SUPABASE_URL || env.SUPABASE_URL;
const key =
  env.VITE_SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_PUBLISHABLE_KEY || env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(2);
}

const sb = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

const { data, error } = await sb.rpc('list_public_image_refs_v1');
if (error) {
  if (/function .* does not exist/i.test(error.message)) {
    console.error(`FAIL: list_public_image_refs_v1 not found (${error.message}) -- RPC missing, contract broken.`);
    process.exit(1);
  }
  console.error(`FAIL: list_public_image_refs_v1 errored: ${error.message}`);
  process.exit(1);
}

const rows = data ?? [];
if (rows.length === 0) {
  // An empty inventory means the RPC silently stopped seeing public content --
  // that is a broken check, not a clean bill of health. Fail loudly.
  console.error('FAIL: list_public_image_refs_v1 returned 0 rows. The site has public images, so this means the RPC or its predicates are broken.');
  process.exit(1);
}

// De-dupe: the same URL is often shared across rows (series default + gallery).
const byUrl = new Map();
for (const r of rows) {
  if (!byUrl.has(r.url)) byUrl.set(r.url, []);
  byUrl.get(r.url).push(`${r.source}#${r.ref_id}`);
}

const urls = [...byUrl.keys()];
const dead = [];
const CONCURRENCY = 10;
let cursor = 0;

async function probe(u) {
  // Some CDNs reject HEAD; fall back to GET before calling it dead.
  try {
    let res = await fetch(u, { method: 'HEAD', redirect: 'follow' });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(u, { method: 'GET', redirect: 'follow' });
    }
    return res.status >= 400 ? String(res.status) : null;
  } catch (e) {
    return `ERR ${e.cause?.code || e.message}`;
  }
}

async function worker() {
  while (cursor < urls.length) {
    const u = urls[cursor++];
    const bad = await probe(u);
    if (bad) dead.push({ url: u, status: bad, refs: byUrl.get(u) });
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));

console.log(
  JSON.stringify(
    {
      check: 'image_refs_live',
      status: dead.length === 0 ? 'ok' : 'dead_refs',
      rows_returned: rows.length,
      distinct_urls: urls.length,
      dead_count: dead.length,
      dead: dead.slice(0, 20),
    },
    null,
    2,
  ),
);

if (dead.length > 0) {
  console.error(
    `\nIMAGE REFS FAIL: ${dead.length} of ${urls.length} public image URL(s) are unreachable. ` +
      `Each is named with its table.column#id above -- fix the row (or re-upload the object), do not weaken this check.`,
  );
  process.exit(1);
}

console.log(`\nLive image refs: ok (${urls.length} distinct public URLs, all reachable).`);
