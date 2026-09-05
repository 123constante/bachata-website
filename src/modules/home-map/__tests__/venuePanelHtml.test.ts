import { describe, it, expect } from 'vitest';
import type { VenueNight } from '../venueNights';
import { venuePanelHtml, dateLabel, esc } from '../venuePanelHtml';

const night = (o: Partial<VenueNight> = {}): VenueNight => ({
  eventId: 'ev-1',
  name: 'Bachata Fridays',
  category: 'party',
  pattern: 'Fridays',
  isWeekly: true,
  nextDate: '2026-09-11',
  nextOccId: 'occ-1',
  time: '9:00pm',
  dateCount: 12,
  isCancelled: false,
  ...o,
});

const panel = (o: Partial<Parameters<typeof venuePanelHtml>[0]> = {}) =>
  venuePanelHtml({
    venueName: 'Sway Bar',
    area: 'Holborn',
    nights: [night()],
    venueHref: '/venue-entity/sway-bar',
    ...o,
  });

describe('esc', () => {
  it('neutralises the five HTML-significant characters', () => {
    expect(esc(`<img src=x onerror="alert('x')">&`)).toBe(
      '&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;&amp;',
    );
  });

  it('renders null and undefined as empty, not as the words', () => {
    expect(esc(null)).toBe('');
    expect(esc(undefined)).toBe('');
  });
});

describe('dateLabel', () => {
  it('gives day and short month, with the full weekday when asked', () => {
    expect(dateLabel('2026-09-11', false)).toBe('11 Sep');
    expect(dateLabel('2026-09-11', true)).toBe('Friday 11 Sep');
  });

  it('spells the weekday in full, never abbreviated', () => {
    expect(dateLabel('2026-09-12', true)).toBe('Saturday 12 Sep');
    expect(dateLabel('2026-09-13', true)).toBe('Sunday 13 Sep');
  });

  it('does not zero-pad the day', () => {
    expect(dateLabel('2026-09-01', false)).toBe('1 Sep');
  });

  it('returns empty for a malformed key rather than NaN', () => {
    expect(dateLabel('not-a-date', true)).toBe('');
    expect(dateLabel('', false)).toBe('');
  });
});

describe('venuePanelHtml -- the venue heading', () => {
  it('is a real link carrying both href and data-href when the venue resolves', () => {
    const h = panel();
    expect(h).toContain('<a class="vhead" href="/venue-entity/sway-bar" data-href="/venue-entity/sway-bar">');
  });

  it('is plain text, NOT a link or a button, when there is nowhere to go', () => {
    const h = panel({ venueHref: null });
    expect(h).toContain('vhead--static');
    expect(h).not.toContain('<a class="vhead"');
    // Nothing focusable may be left behind pointing at nothing.
    expect(h).not.toContain('<button');
    expect(h).not.toContain('href=""');
  });

  it('names the venue and counts its nights, singular and plural', () => {
    expect(panel()).toContain('Sway Bar');
    expect(panel()).toContain('1 regular night<');
    expect(panel({ nights: [night(), night({ eventId: 'ev-2', name: 'Two' })] })).toContain(
      '2 regular nights',
    );
  });

  it('falls back to a neutral heading for an unnamed venue', () => {
    expect(panel({ venueName: null })).toContain('This location');
  });

  it('omits the area separator when there is no area', () => {
    expect(panel({ area: null })).not.toContain('&middot; 1 regular night');
  });
});

describe('venuePanelHtml -- night rows', () => {
  it('links each night to its event AND its occurrence', () => {
    expect(panel()).toContain('href="/event/ev-1?occurrenceId=occ-1"');
    expect(panel()).toContain('data-href="/event/ev-1?occurrenceId=occ-1"');
  });

  it('drops the weekday from the date when the pattern already names it', () => {
    expect(panel()).toContain('Fridays &middot; next 11 Sep &middot; 9:00pm');
  });

  it('keeps the weekday when the pattern does not name one', () => {
    const h = panel({ nights: [night({ pattern: 'Monthly', isWeekly: false })] });
    expect(h).toContain('Monthly &middot; next Friday 11 Sep &middot; 9:00pm');
  });

  it('omits a missing time rather than printing an empty separator', () => {
    const h = panel({ nights: [night({ time: null })] });
    expect(h).toContain('Fridays &middot; next 11 Sep<');
    expect(h).not.toContain('&middot; &middot;');
  });

  it('marks a cancelled night', () => {
    expect(panel({ nights: [night({ isCancelled: true })] })).toContain('Cancelled');
    expect(panel()).not.toContain('Cancelled');
  });

  it('labels the category', () => {
    expect(panel({ nights: [night({ category: 'mix' })] })).toContain('Class &amp; Party');
  });
});

describe('venuePanelHtml -- the empty panel and escaping', () => {
  it('says why it is empty instead of rendering a bare heading', () => {
    const h = panel({ nights: [] });
    expect(h).toContain('vempty');
    expect(h).toContain('Nothing listed here under the current filter.');
    expect(h).not.toContain('<ul class="vnights">');
  });

  it('still shows the venue heading and its link when there are no nights', () => {
    const h = panel({ nights: [] });
    expect(h).toContain('Sway Bar');
    expect(h).toContain('href="/venue-entity/sway-bar"');
    expect(h).not.toContain('regular night');
  });

  it('escapes a venue name that carries markup', () => {
    const h = panel({ venueName: '<script>alert(1)</script>' });
    expect(h).not.toContain('<script>');
    expect(h).toContain('&lt;script&gt;');
  });

  it('escapes an event name that carries markup', () => {
    const h = panel({ nights: [night({ name: '"><img src=x onerror=alert(1)>' })] });
    expect(h).not.toContain('<img');
    expect(h).toContain('&lt;img');
  });

  it('escapes an id that would otherwise break out of the href attribute', () => {
    const h = panel({ nights: [night({ eventId: 'a" onmouseover="alert(1)' })] });
    expect(h).not.toContain('onmouseover="alert(1)"');
    // encodeURIComponent runs first, so the quote never reaches the attribute.
    expect(h).toContain('href="/event/a%22%20onmouseover%3D%22alert(1)?occurrenceId=occ-1"');
  });

  it('escapes a venue href supplied from data', () => {
    const h = panel({ venueHref: '/venue-entity/x" onclick="alert(1)' });
    expect(h).not.toContain('onclick="alert(1)"');
    expect(h).toContain('&quot;');
  });
});
