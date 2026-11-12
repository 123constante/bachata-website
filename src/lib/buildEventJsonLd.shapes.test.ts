import { describe, expect, it } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildEventJsonLd, type EventJsonLdInput } from './buildEventJsonLd';
import { EventPausedBanner } from '@/modules/event-page/bento/EventPausedBanner';

// Every event shape the /event/:id page can render, against the ONE rule the
// SEO guard (scripts/check-seo.mjs) enforces: a non-paused page carries a valid
// Event node (name, startDate, eventStatus), degrading missing OPTIONAL fields
// by omitting them; a paused page carries none (owner decision 2026-10-08,
// eventPageSeoPolicy (a)). Shapes from prod 2026-11-11 (read-only survey of
// event_series_p5.lifecycle_status: live 72, ended 24, paused 3).
const BASE: EventJsonLdInput = {
  name: 'Bachata Wednesday',
  url: 'https://www.bachatacalendar.co.uk/event/x',
  startDate: '2026-06-01T19:00:00+01:00',
  endDate: '2026-06-01T23:30:00+01:00',
  description: 'Weekly night',
  image: ['https://media.example.com/c.jpg'],
  venue: { name: 'The Hub', address: '1 High St', postcode: 'SW1A 1AA', city: 'london' },
  lifecycleStatus: 'live',
};

type Row = { shape: string; input: EventJsonLdInput; absent?: string[]; eventStatus?: string; offers?: boolean };
const SCHEMA = 'https://schema.org/';
const ROWS: Row[] = [
  { shape: 'full', input: BASE },
  { shape: 'no end date', input: { ...BASE, endDate: null }, absent: ['endDate'] },
  { shape: 'no venue', input: { ...BASE, venue: null }, absent: ['location'] },
  { shape: 'venue with every field empty', input: { ...BASE, venue: { name: '', address: null, postcode: null, city: null } }, absent: ['location'] },
  { shape: 'no image', input: { ...BASE, image: null }, absent: ['image'] },
  { shape: 'empty image list', input: { ...BASE, image: [] }, absent: ['image'] },
  { shape: 'no description', input: { ...BASE, description: '   ' }, absent: ['description'] },
  { shape: 'past date on a live series', input: { ...BASE, startDate: '2025-01-01T20:00:00+00:00', endDate: '2025-01-01T23:00:00+00:00' } },
  { shape: 'ended series (past, no offers)', input: { ...BASE, lifecycleStatus: 'ended', offers: [{ url: 'https://t.example.com', price: '10', currency: 'GBP' }] }, offers: false },
  { shape: 'recurring series, next date', input: { ...BASE, startDate: '2026-11-18T20:00:00+00:00' } },
  { shape: 'cancelled date', input: { ...BASE, isCancelled: true }, eventStatus: 'EventCancelled' },
  { shape: 'unknown lifecycle (null)', input: { ...BASE, lifecycleStatus: null } },
  { shape: 'bare minimum (name, url, startDate only)', input: { name: 'X', url: 'https://www.bachatacalendar.co.uk/event/y', startDate: '2026-06-01T19:00:00+01:00' }, absent: ['endDate', 'location', 'image', 'description', 'offers'] },
];

describe('buildEventJsonLd: a renderable non-paused page always gets a valid Event node', () => {
  it.each(ROWS)('$shape', ({ input, absent = [], eventStatus = 'EventScheduled', offers }) => {
    const node = buildEventJsonLd(input);
    expect(node).not.toBeNull();
    const n = node as Record<string, unknown>;
    expect(n['@type']).toBe('Event');
    // The guard's hard-required trio, never null on any shape.
    expect(n.name).toBeTruthy();
    expect(n.startDate).toBeTruthy();
    expect(n.eventStatus).toBe(`${SCHEMA}${eventStatus}`);
    for (const k of absent) expect(n, `${k} omitted, not invented`).not.toHaveProperty(k);
    if (offers === false) expect(n).not.toHaveProperty('offers');
    // Serialisable: it goes into a <script type="application/ld+json">.
    expect(JSON.parse(JSON.stringify(n))).toEqual(n);
  });
});

describe('paused series: no Event node, and the page says why', () => {
  it('a paused series emits no node, whatever else it carries', () => {
    expect(buildEventJsonLd({ ...BASE, lifecycleStatus: 'paused' })).toBeNull();
    expect(buildEventJsonLd({ ...BASE, lifecycleStatus: 'paused', isCancelled: true, venue: null, image: null })).toBeNull();
  });

  // Producer/consumer pin: check-seo.mjs takes its paused arm ONLY on this
  // banner's server-rendered marker. Rename the test id and this reds here,
  // at author time, instead of seo-preview redding on the next paused sample.
  it('the hiatus banner server-renders the marker the SEO guard keys on', () => {
    const html = renderToStaticMarkup(createElement(EventPausedBanner));
    expect(html).toMatch(/\bdata-testid=["']event-paused-banner["']/);
    expect(html).toContain('On hiatus');
  });
});
