#!/usr/bin/env node
/**
 * One-shot SEO re-check (SEO ranking arc, owner 2026-11-27).
 *
 * Option C shipped 2026-11-27 (#2484 Two doors /classes, #2488 /classes sole
 * owner of "bachata classes in London"). Baseline (GSC, 2026-08-27..11-25) for
 * the query "bachata classes london": homepage pos 8.5, /learn-bachata-london
 * pos 47, /classes pos 76. Goal: /classes top 10; below 20 = rethink.
 *
 * Pulls Search Console for the post-change window (2026-11-28 .. today-3, GSC
 * lags ~3 days), read-only, and writes a markdown report to the path given.
 *
 * SEO_RECHECK_START=YYYY-MM-DD overrides the window start (local dry run only).
 * Usage: GSC_SERVICE_ACCOUNT_KEY='<json>' node scripts/seo-recheck.mjs out.md
 *    or: GSC_SERVICE_ACCOUNT_KEY_FILE=key.json node scripts/seo-recheck.mjs out.md
 */
import fs from 'node:fs';
import crypto from 'node:crypto';

const out = process.argv[2];
if (!out) { console.error('usage: seo-recheck.mjs <out.md>'); process.exit(2); }
const raw = process.env.GSC_SERVICE_ACCOUNT_KEY
  || (process.env.GSC_SERVICE_ACCOUNT_KEY_FILE && fs.readFileSync(process.env.GSC_SERVICE_ACCOUNT_KEY_FILE, 'utf8'));
if (!raw) { console.error('no GSC key (GSC_SERVICE_ACCOUNT_KEY or GSC_SERVICE_ACCOUNT_KEY_FILE)'); process.exit(2); }
const key = JSON.parse(raw);

const b64 = (s) => Buffer.from(s).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const now = Math.floor(Date.now() / 1000);
const si = b64(JSON.stringify({ alg: 'RS256', typ: 'JWT' })) + '.' + b64(JSON.stringify({
  iss: key.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly',
  aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600,
}));
const jwt = si + '.' + b64(crypto.createSign('RSA-SHA256').update(si).sign(key.private_key));
const tokRes = await (await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: jwt }),
})).json();
if (!tokRes.access_token) { console.error('token failed:', tokRes.error); process.exit(1); }

const site = encodeURIComponent('sc-domain:bachatacalendar.co.uk');
async function q(body) {
  const r = await fetch(`https://www.googleapis.com/webmasters/v3/sites/${site}/searchAnalytics/query`, {
    method: 'POST', headers: { authorization: `Bearer ${tokRes.access_token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await r.json();
  if (!r.ok) throw new Error(JSON.stringify(j.error));
  return j.rows || [];
}

const day = (d) => d.toISOString().slice(0, 10);
const range = { startDate: process.env.SEO_RECHECK_START || '2026-11-28', endDate: day(new Date(Date.now() - 3 * 864e5)) };
const QUERIES = ['bachata classes london', 'bachata classes in london', 'bachata class london', 'learn bachata london', 'bachata london'];
const BASE = { 'bachata classes london': '/ 8.5, /learn-bachata-london 47, /classes 76' };

const path = (u) => u.replace(/^https?:\/\/(www\.)?bachatacalendar\.co\.uk/, '') || '/';
const f = (r) => `${r.clicks} clicks, ${r.impressions} impr, pos ${r.position.toFixed(1)}`;
const lines = [`Window: ${range.startDate} to ${range.endDate} (after option C shipped 2026-11-27).`, ''];
let classesPos = null;
for (const query of QUERIES) {
  const rows = await q({ ...range, dimensions: ['page'], rowLimit: 25,
    dimensionFilterGroups: [{ filters: [{ dimension: 'query', operator: 'equals', expression: query }] }] });
  lines.push(`### "${query}"`);
  if (BASE[query]) lines.push(`Baseline (Aug-Nov): ${BASE[query]}`);
  if (!rows.length) lines.push('- no impressions in the window');
  for (const r of rows.sort((a, b) => b.impressions - a.impressions).slice(0, 6)) {
    lines.push(`- ${path(r.keys[0])}: ${f(r)}`);
    if (query === 'bachata classes london' && path(r.keys[0]) === '/classes') classesPos = r.position;
  }
  lines.push('');
}
const verdict = classesPos == null
  ? 'NO DATA: /classes had no impressions for "bachata classes london" in the window.'
  : classesPos <= 10 ? `ON TARGET: /classes at pos ${classesPos.toFixed(1)} (goal top 10).`
  : classesPos <= 20 ? `CLIMBING: /classes at pos ${classesPos.toFixed(1)} (was 76; goal top 10).`
  : `BELOW 20: /classes at pos ${classesPos.toFixed(1)} (was 76). Option C has not worked yet; plan the next step.`;
fs.writeFileSync(out, [`**${verdict}**`, '', ...lines,
  'Next on the arc: reuse the Two doors layout for /parties and /tonight.',
  'Claude: read this issue, update plans/LIVE-claude-seo-classes-ssr.md, carry on the arc.'].join('\n'));
console.log(verdict);
