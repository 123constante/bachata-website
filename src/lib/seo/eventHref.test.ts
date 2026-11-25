import { describe, expect, it, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';

const mockFlags = vi.hoisted(() => ({ eventSubdomainLinks: false }));
vi.mock('@/lib/featureFlags', () => ({ flags: mockFlags }));

import { eventHref, EVENT_SUBDOMAIN_RESERVED_LABELS } from '@/lib/seo/eventHref';
import { buildNightHref } from '@/modules/event-page/bento/nextPublicNight';

const UUID = '3f2b8c1e-1111-4222-8333-444455556666';

describe('eventHref', () => {
  beforeEach(() => { mockFlags.eventSubdomainLinks = false; });

  it.each([
    [{ slug: 'luxlounge', event_id: UUID }, undefined, '/event/luxlounge'],
    [{ slug: 'luxlounge', event_id: UUID }, 'occ1', '/event/luxlounge?occurrenceId=occ1'],
    [{ slug: null, event_id: UUID }, undefined, `/event/${UUID}`],
    [{ event_id: UUID }, 'occ1', `/event/${UUID}?occurrenceId=occ1`],
    [{ slug: 'lux-lounge', event_id: UUID }, null, '/event/lux-lounge'],
    [{ slug: 'www', event_id: UUID }, '', '/event/www'],
  ])('flag OFF is today\'s output: %j %s', (ev, occ, want) => {
    expect(eventHref(ev, occ)).toBe(want);
  });

  it('flag ON: clean slug -> subdomain, with and without occurrenceId', () => {
    mockFlags.eventSubdomainLinks = true;
    expect(eventHref({ slug: 'luxlounge', event_id: UUID })).toBe('https://luxlounge.bachatacalendar.co.uk/');
    expect(eventHref({ slug: 'luxlounge', event_id: UUID }, 'occ1')).toBe(
      'https://luxlounge.bachatacalendar.co.uk/?occurrenceId=occ1',
    );
  });

  it.each(['lux-lounge', 'Lux', 'a.b', 'a_b', ''])('flag ON: unclean slug %j keeps /event path', (slug) => {
    mockFlags.eventSubdomainLinks = true;
    expect(eventHref({ slug, event_id: UUID })).toBe(`/event/${slug || UUID}`);
  });

  it.each(EVENT_SUBDOMAIN_RESERVED_LABELS)('flag ON: reserved %s keeps /event path', (slug) => {
    mockFlags.eventSubdomainLinks = true;
    expect(eventHref({ slug, event_id: UUID })).toBe(`/event/${slug}`);
  });

  it('flag ON: missing slug / uuid-only keeps /event path', () => {
    mockFlags.eventSubdomainLinks = true;
    expect(eventHref({ event_id: UUID }, 'o')).toBe(`/event/${UUID}?occurrenceId=o`);
  });

  it('buildNightHref delegates to eventHref (OFF = today, ON = subdomain)', () => {
    expect(buildNightHref('lux-lounge', 'd')).toBe('/event/lux-lounge?occurrenceId=d');
    expect(buildNightHref(UUID, 'd')).toBe(`/event/${UUID}?occurrenceId=d`);
    mockFlags.eventSubdomainLinks = true;
    expect(buildNightHref('luxlounge', 'd')).toBe('https://luxlounge.bachatacalendar.co.uk/?occurrenceId=d');
    expect(buildNightHref(UUID, 'd')).toBe(`/event/${UUID}?occurrenceId=d`);
  });

  it('client reserved list equals the server list (app/lib/eventSubdomain.ts)', () => {
    const src = readFileSync('app/lib/eventSubdomain.ts', 'utf8');
    const m = src.match(/RESERVED_LABELS: readonly string\[\] = \[([^\]]*)\]/);
    expect(m).toBeTruthy();
    const server = [...m![1].matchAll(/"([^"]+)"/g)].map((x) => x[1]);
    expect([...EVENT_SUBDOMAIN_RESERVED_LABELS]).toEqual(server);
  });
});
