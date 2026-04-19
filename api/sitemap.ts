import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const SITE_URL = process.env.SITE_URL ?? 'https://www.bachatacommunity.space';
const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY ?? '';

const STATIC_PAGES: Array<{ path: string; changefreq: string; priority?: string }> = [
  { path: '/', changefreq: 'daily', priority: '1.0' },
  { path: '/festivals', changefreq: 'daily', priority: '0.9' },
  { path: '/classes', changefreq: 'daily', priority: '0.8' },
  { path: '/parties', changefreq: 'daily', priority: '0.8' },
  { path: '/teachers', changefreq: 'weekly', priority: '0.7' },
  { path: '/djs', changefreq: 'weekly', priority: '0.7' },
  { path: '/dancers', changefreq: 'weekly', priority: '0.7' },
  { path: '/organisers', changefreq: 'weekly', priority: '0.7' },
  { path: '/venues', changefreq: 'weekly', priority: '0.6' },
];

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function toLastmod(date: string | null): string {
  if (!date) return new Date().toISOString().slice(0, 10);
  return date.slice(0, 10);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    res.status(503).send('Sitemap unavailable: server configuration missing');
    return;
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // Fetch published events (id, type, updated_at)
  const { data: events, error: eventsError } = await supabase
    .from('events')
    .select('id, type, updated_at')
    .eq('lifecycle_status', 'published')
    .eq('is_published', true)
    .order('updated_at', { ascending: false })
    .limit(50000);

  if (eventsError) {
    console.error('[sitemap] events query error:', eventsError.message);
  }

  // Fetch all city slugs that have at least one published event
  const { data: cities, error: citiesError } = await supabase
    .from('cities')
    .select('slug');

  if (citiesError) {
    console.error('[sitemap] cities query error:', citiesError.message);
  }

  const lines: string[] = ['<?xml version="1.0" encoding="UTF-8"?>'];
  lines.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');

  // Static pages
  for (const page of STATIC_PAGES) {
    lines.push('  <url>');
    lines.push(`    <loc>${escapeXml(SITE_URL + page.path)}</loc>`);
    lines.push(`    <changefreq>${page.changefreq}</changefreq>`);
    if (page.priority) lines.push(`    <priority>${page.priority}</priority>`);
    lines.push('  </url>');
  }

  // City pages
  for (const city of cities ?? []) {
    if (!city.slug) continue;
    lines.push('  <url>');
    lines.push(`    <loc>${escapeXml(`${SITE_URL}/city/${city.slug}`)}</loc>`);
    lines.push('    <changefreq>daily</changefreq>');
    lines.push('    <priority>0.8</priority>');
    lines.push('  </url>');
  }

  // Event and festival pages
  for (const event of events ?? []) {
    const isFestival = event.type === 'festival';
    const path = isFestival ? `/festival/${event.id}` : `/event/${event.id}`;
    lines.push('  <url>');
    lines.push(`    <loc>${escapeXml(SITE_URL + path)}</loc>`);
    lines.push(`    <lastmod>${toLastmod(event.updated_at)}</lastmod>`);
    lines.push(`    <changefreq>${isFestival ? 'weekly' : 'weekly'}</changefreq>`);
    lines.push(`    <priority>${isFestival ? '0.9' : '0.8'}</priority>`);
    lines.push('  </url>');
  }

  lines.push('</urlset>');

  const xml = lines.join('\n');

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=3600, s-maxage=3600');
  res.status(200).send(xml);
}
