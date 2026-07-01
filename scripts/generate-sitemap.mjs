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
const BASE_URL = 'https://www.bachatacalendar.co.uk';

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_PUBLISHABLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// Feature flags (same source of truth as the app). Gated directory + detail
// surfaces render noindex in prod, so keep their URLs OUT of the sitemap until
// the flag is on, else Google logs "submitted URL marked noindex".
const ENABLE_VENUE_DETAIL = env.VITE_ENABLE_VENUE_DETAIL === 'true';
const ENABLE_TEACHERS = env.VITE_ENABLE_TEACHERS_DIRECTORY === 'true';
const ENABLE_TEACHER_DETAIL = env.VITE_ENABLE_TEACHER_DETAIL === 'true';
const ENABLE_ORGANISERS = env.VITE_ENABLE_ORGANISERS_DIRECTORY === 'true';
const ENABLE_ORGANISER_DETAIL = env.VITE_ENABLE_ORGANISER_DETAIL === 'true';

// ── static routes ─────────────────────────────────────────────────────────────
const STATIC_ROUTES = [
  { path: '/',                                 changefreq: 'daily',   priority: '1.0' },
  { path: '/parties',                          changefreq: 'daily',   priority: '0.9' },
  { path: '/classes',                          changefreq: 'daily',   priority: '0.9' },
  { path: '/tonight',                          changefreq: 'daily',   priority: '0.8' },
  { path: '/festivals',                        changefreq: 'weekly',  priority: '0.8' },
  { path: '/venues',                           changefreq: 'weekly',  priority: '0.7' },
  { path: '/djs',                              changefreq: 'weekly',  priority: '0.6' },
  { path: '/dancers',                          changefreq: 'weekly',  priority: '0.6' },
  { path: '/discounts',                        changefreq: 'weekly',  priority: '0.5' },
  { path: '/practice-partners',                changefreq: 'weekly',  priority: '0.5' },
  { path: '/choreography',                     changefreq: 'weekly',  priority: '0.5' },
  { path: '/videographers',                    changefreq: 'weekly',  priority: '0.5' },
  { path: '/cities',                           changefreq: 'monthly', priority: '0.5' },
  { path: '/london-bachata-guide',             changefreq: 'monthly', priority: '0.9' },
  { path: '/learn-bachata-london',             changefreq: 'monthly', priority: '0.9' },
  { path: '/bachata-parties-london',           changefreq: 'weekly',  priority: '0.8' },
  { path: '/bachata-london-sensual-parties',   changefreq: 'weekly',  priority: '0.7' },
  { path: '/bachata-london-dominican-parties', changefreq: 'weekly',  priority: '0.7' },
  { path: '/faq',                              changefreq: 'monthly', priority: '0.8' },
  { path: '/bachata-london-monday',            changefreq: 'weekly',  priority: '0.8' },
  { path: '/bachata-london-tuesday',           changefreq: 'weekly',  priority: '0.8' },
  { path: '/bachata-london-wednesday',         changefreq: 'weekly',  priority: '0.8' },
  { path: '/bachata-london-thursday',          changefreq: 'weekly',  priority: '0.8' },
  { path: '/bachata-london-friday',            changefreq: 'weekly',  priority: '0.9' },
  { path: '/bachata-london-saturday',          changefreq: 'weekly',  priority: '0.9' },
  { path: '/bachata-london-sunday',            changefreq: 'weekly',  priority: '0.8' },
];
// Feature-gated directory listings: only sitemap them once their flag is on.
if (ENABLE_TEACHERS) STATIC_ROUTES.push({ path: '/teachers', changefreq: 'weekly', priority: '0.7' });
if (ENABLE_ORGANISERS) STATIC_ROUTES.push({ path: '/organisers', changefreq: 'weekly', priority: '0.7' });

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

// events: lifecycle_status = 'published', up to 2000 most recently updated.
// Emits slug URLs (post-2026-05-28 slug migration). Falls back to id for any
// row missing slug, but post-migration backfill that should be empty.
async function fetchEvents() {
  const { data, error } = await supabase
    .from('events')
    .select('id, slug, updated_at')
    .eq('lifecycle_status', 'published')
    .order('updated_at', { ascending: false })
    .limit(2000);
  if (error) { console.warn('  events fetch error:', error.message); return []; }
  return (data || []).map(e => ({
    loc: `${BASE_URL}/event/${e.slug || e.id}`,
    lastmod: toDate(e.updated_at),
    changefreq: 'daily',
    priority: '0.8',
  }));
}

// venues: any non-draft venue (matches public.venue_is_public). Emits slug URLs (post-2026-05-28
// slug migration). The route is /venue-entity/:slugOrId so older entity_id
// URLs still work; the sitemap prefers the slug for new indexing.
async function fetchVenues() {
  const { data, error } = await supabase
    .from('venues')
    .select('id, slug, created_at')
    .neq("publish_state", "draft")  // = public.venue_is_public(): any non-draft (dancer_ready | published)
    .limit(500);
  if (error) { console.warn('  venues fetch error:', error.message); return []; }
  return (data || []).map(v => ({
    loc: `${BASE_URL}/venue-entity/${v.slug || v.id}`,
    lastmod: toDate(v.created_at),
    changefreq: 'weekly',
    priority: '0.7',
  }));
}

// dancer_profiles: used for /teachers/:id and /dancers/:id pages.
// Slug column was already in place pre-2026-05-28; use it for SEO URLs.
async function fetchDancerProfiles() {
  const { data, error } = await supabase
    .from('dancer_profiles')
    .select('id, slug, updated_at')
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) { console.warn('  dancer_profiles fetch error:', error.message); return []; }
  return (data || []).map(d => ({ id: d.id, slug: d.slug, updated_at: d.updated_at }));
}

// organiser_profiles: used for /organisers/:id pages.
// Slug column added 2026-05-28; use it for SEO URLs.
async function fetchOrganiserProfiles() {
  const { data, error } = await supabase
    .from('organiser_profiles')
    .select('id, slug, updated_at')
    .order('updated_at', { ascending: false })
    .limit(500);
  if (error) { console.warn('  organiser_profiles fetch error:', error.message); return []; }
  return (data || []).map(o => ({
    loc: `${BASE_URL}/organisers/${o.slug || o.id}`,
    lastmod: toDate(o.updated_at),
    changefreq: 'weekly',
    priority: '0.7',
  }));
}

// ── main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('Generating sitemap...');
  const today = new Date().toISOString().split('T')[0];

  const staticEntries = STATIC_ROUTES.map(r =>
    urlEntry({ loc: `${BASE_URL}${r.path}`, lastmod: today, changefreq: r.changefreq, priority: r.priority })
  );

  const [events, venueUrls, dancerRows, organiserUrls] = await Promise.all([
    fetchEvents(),
    ENABLE_VENUE_DETAIL ? fetchVenues() : Promise.resolve([]),
    fetchDancerProfiles(),
    ENABLE_ORGANISER_DETAIL ? fetchOrganiserProfiles() : Promise.resolve([]),
  ]);

  // Dancer detail pages are public; teacher detail pages are feature-gated.
  const dancerUrls = dancerRows.map(d => ({
    loc: `${BASE_URL}/dancers/${d.slug || d.id}`,
    lastmod: toDate(d.updated_at), changefreq: 'weekly', priority: '0.6',
  }));
  const teacherUrls = ENABLE_TEACHER_DETAIL
    ? dancerRows.map(d => ({
        loc: `${BASE_URL}/teachers/${d.slug || d.id}`,
        lastmod: toDate(d.updated_at), changefreq: 'weekly', priority: '0.6',
      }))
    : [];

  const dynamicEntries = [...events, ...venueUrls, ...dancerUrls, ...teacherUrls, ...organiserUrls].map(urlEntry);
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
  console.log(`  Static: ${staticEntries.length}, Events: ${events.length}, Venues: ${venueUrls.length}, Dancers: ${dancerUrls.length}, Teachers: ${teacherUrls.length}, Organisers: ${organiserUrls.length}`);
}

main().catch(err => { console.error(err); process.exit(1); });
