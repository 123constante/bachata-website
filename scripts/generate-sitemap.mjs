#!/usr/bin/env node
/**
 * Build-time sitemap generator for bachatacalendar.co.uk
 *
 * Queries Supabase for live events, venues, and teacher profiles,
 * then writes public/sitemap.xml.
 *
 * Local:  node scripts/generate-sitemap.mjs        (reads .env)
 * CI/CD:  same script, env vars supplied as Vercel / GH secrets:
 *           VITE_SUPABASE_URL
 *           VITE_SUPABASE_PUBLISHABLE_KEY
 *
 * Wired into build via package.json:
 *   "build": "node scripts/generate-sitemap.mjs && vite build"
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── env loading ───────────────────────────────────────────────────────────────
function loadEnv() {
  const env = { ...process.env };
  const envPath = path.join(ROOT, '.env');
  if (fs.existsSync(envPath)) {
    const file = fs.readFileSync(envPath, 'utf8');
    for (const raw of file.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line || line.startsWith('#')) continue;
      const idx = line.indexOf('=');
      if (idx < 0) continue;
      const k = line.slice(0, idx).trim();
      const v = line.slice(idx + 1).replace(/^"|"$/g, '');
      if (env[k] === undefined) env[k] = v;
    }
  }
  return env;
}

const env = loadEnv();
const SUPABASE_URL = env.VITE_SUPABASE_URL;
const SUPABASE_KEY = env.VITE_SUPABASE_PUBLISHABLE_KEY;
const BASE_URL = 'https://bachatacalendar.co.uk';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ── static routes ─────────────────────────────────────────────────────────────
const STATIC_ROUTES = [
  { path: '/',                   changefreq: 'daily',   priority: '1.0' },
  { path: '/parties',            changefreq: 'daily',   priority: '0.9' },
  { path: '/classes',            changefreq: 'daily',   priority: '0.9' },
  { path: '/festivals',          changefreq: 'weekly',  priority: '0.8' },
  { path: '/venues',             changefreq: 'weekly',  priority: '0.8' },
  { path: '/teachers',           changefreq: 'weekly',  priority: '0.7' },
  { path: '/dancers',            changefreq: 'weekly',  priority: '0.7' },
  { path: '/djs',                changefreq: 'weekly',  priority: '0.7' },
  { path: '/organisers',         changefreq: 'weekly',  priority: '0.7' },
  { path: '/tonight',            changefreq: 'daily',   priority: '0.8' },
  { path: '/discounts',          changefreq: 'weekly',  priority: '0.6' },
  { path: '/cities',             changefreq: 'monthly', priority: '0.6' },
  { path: '/videographers',      changefreq: 'weekly',  priority: '0.5' },
  { path: '/practice-partners',  changefreq: 'weekly',  priority: '0.5' },
];

// ── helpers ───────────────────────────────────────────────────────────────────
function escapeXml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function urlEntry({ loc, lastmod, changefreq, priority }) {
  const parts = [`  <url>\n    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  parts.push('  </url>');
  return parts.join('\n');
}

function toDate(ts) {
  if (!ts) return null;
  return new Date(ts).toISOString().split('T')[0];
}

// ── fetch dynamic URLs ────────────────────────────────────────────────────────

// events: lifecycle_status = 'published', up to 2000 most recently updated
async function fetchEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('id, updated_at')
    .eq('lifecycle_status', 'published')
    .order('updated_at', { ascending: false })
    .limit(2000);
  if (error) { console.warn('  events fetch error:', error.message); return []; }
  return (data || []).map(e => ({
    loc: `${BASE_URL}/event/${e.id}`,
    lastmod: toDate(e.updated_at),
    changefreq: 'daily',
    priority: '0.8',
  }));
}

// venues: publish_state = 'published'; URL uses entity_id
async function fetchVenues() {
  const { data, error } = await supabase
    .from('venues')
    .select('entity_id, created_at')
    .in("publish_state", ["published","dancer_ready"])
    .not('entity_id', 'is', null)
    .limit(500);
  if (error) { console.warn('  venues fetch error:', error.message); return []; }
  return (data || []).map(v => ({
    loc: `${BASE_URL}/venue-entity/${v.entity_id}`,
    lastmod: toDate(v.created_at),
    changefreq: 'weekly',
    priority: '0.7',
  }));
}

// dancer_profiles: used for /teachers/:id and /dancers/:id pages
async function fetchDancerProfiles() {
  const { data, error } = await supabase
    .from('dancer_profiles')
    .select('id, updated_at')
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) { console.warn('  dancer_profiles fetch error:', error.message); return []; }
  // Each profile appears on both /dancers/:id and /teachers/:id
  // (the front-end routes both to the same profile page)
  return (data || []).flatMap(d => [
    {
      loc: `${BASE_URL}/dancers/${d.id}`,
      lastmod: toDate(d.updated_at),
      changefreq: 'weekly',
      priority: '0.6',
    },
    {
      loc: `${BASE_URL}/teachers/${d.id}`,
      lastmod: toDate(d.updated_at),
      changefreq: 'weekly',
      priority: '0.6',
    },
  ]);
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Generating sitemap...');
  const today = new Date().toISOString().split('T')[0];

  const staticEntries = STATIC_ROUTES.map(r =>
    urlEntry({ loc: `${BASE_URL}${r.path}`, lastmod: today, changefreq: r.changefreq, priority: r.priority })
  );

  const [events, venues, profiles] = await Promise.all([
    fetchEvents(),
    fetchVenues(),
    fetchDancerProfiles(),
  ]);

  const dynamicEntries = [...events, ...venues, ...profiles].map(urlEntry);
  const totalUrls = staticEntries.length + dynamicEntries.length;

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...staticEntries,
    ...dynamicEntries,
    '</urlset>',
  ].join('\n');

  const outPath = path.join(ROOT, 'public', 'sitemap.xml');
  fs.writeFileSync(outPath, xml, 'utf8');
  console.log(`sitemap.xml written: ${totalUrls} URLs`);
  console.log(`  Static: ${staticEntries.length}, Events: ${events.length}, Venues: ${venues.length}, Profiles: ${profiles.length / 2} (x2 routes)`);
}

main().catch(err => { console.error(err); process.exit(1); });
