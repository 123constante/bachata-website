/**
 * Unit tests for the /api/embed/calendar HTML renderer.
 *
 * Pure module — no Vercel runtime needed. Verifies HTML escaping (XSS guard),
 * date/time formatting under the wall-clock-as-Z convention, layout switching
 * (list vs cards), empty-state rendering, and title clamping.
 */

import { describe, expect, it } from 'vitest';
import {
  clampTitle,
  escapeHtml,
  eventDetailUrl,
  formatOccurrenceDate,
  formatStartTime,
  renderWidgetHtml,
  type WidgetEvent,
} from '../api/embed/_template';

const evt = (overrides: Partial<WidgetEvent> = {}): WidgetEvent => ({
  event_id: '00000000-0000-0000-0000-000000000001',
  occurrence_id: '00000000-0000-0000-0000-000000000010',
  name: 'El Grande',
  type: 'party',
  occurrence_date: '2026-06-13',
  starts_at: '2026-06-13T20:00:00Z',
  ends_at: '2026-06-14T02:00:00Z',
  city_slug: 'london',
  city_name: 'London',
  city_timezone: 'Europe/London',
  venue_id: '00000000-0000-0000-0000-000000000020',
  venue_name: 'Scala',
  venue_address: 'Kings Cross',
  organiser_id: null,
  organiser_name: null,
  cover_image_url: null,
  is_recurring: true,
  ...overrides,
});

describe('escapeHtml', () => {
  it('escapes the five HTML metacharacters', () => {
    expect(escapeHtml('<script>"a"&\'b\'</script>'))
      .toBe('&lt;script&gt;&quot;a&quot;&amp;&#39;b&#39;&lt;/script&gt;');
  });
  it('handles null/undefined as empty string', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('formatOccurrenceDate', () => {
  it('formats a Saturday correctly', () => {
    expect(formatOccurrenceDate('2026-06-13'))
      .toEqual({ day: '13', month: 'Jun', weekday: 'Sat' });
  });
  it('zero-pads the day', () => {
    expect(formatOccurrenceDate('2026-01-05').day).toBe('05');
  });
  it('returns en-dash placeholders on malformed input', () => {
    expect(formatOccurrenceDate('not-a-date')).toEqual({ day: '–', month: '', weekday: '' });
  });
});

describe('formatStartTime', () => {
  it('extracts HH:MM from a wall-clock-as-Z timestamp', () => {
    expect(formatStartTime('2026-06-13T20:30:00Z')).toBe('20:30');
  });
  it('returns empty on missing T-separated time', () => {
    expect(formatStartTime('2026-06-13')).toBe('');
  });
});

describe('eventDetailUrl', () => {
  it('uses the /event/:id (singular) path that matches the Website router', () => {
    expect(eventDetailUrl('https://bachatacalendar.co.uk', 'abc-123'))
      .toBe('https://bachatacalendar.co.uk/event/abc-123');
  });
  it('strips a trailing slash from the origin', () => {
    expect(eventDetailUrl('https://bachatacalendar.co.uk/', 'abc'))
      .toBe('https://bachatacalendar.co.uk/event/abc');
  });
});

describe('clampTitle', () => {
  it('returns null for empty / whitespace', () => {
    expect(clampTitle('')).toBeNull();
    expect(clampTitle('   ')).toBeNull();
    expect(clampTitle(null)).toBeNull();
  });
  it('truncates to the cap', () => {
    const longTitle = 'x'.repeat(200);
    expect(clampTitle(longTitle, 50)?.length).toBe(50);
  });
});

describe('renderWidgetHtml', () => {
  it('renders an empty-state message when there are no events', () => {
    const html = renderWidgetHtml({
      events: [],
      city_slug: 'london',
      organiser_name: null,
      title: null,
      theme: 'dark',
      layout: 'list',
      public_origin: 'https://bachatacalendar.co.uk',
    });
    expect(html).toContain('No upcoming events.');
    expect(html).toContain('<!DOCTYPE html>');
  });

  it('escapes event names containing HTML', () => {
    const html = renderWidgetHtml({
      events: [evt({ name: '<img src=x onerror=alert(1)>' })],
      city_slug: null,
      organiser_name: null,
      title: null,
      theme: 'dark',
      layout: 'list',
      public_origin: 'https://bachatacalendar.co.uk',
    });
    expect(html).not.toContain('<img src=x');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('renders the cards layout when requested', () => {
    const html = renderWidgetHtml({
      events: [evt()],
      city_slug: 'london',
      organiser_name: null,
      title: null,
      theme: 'light',
      layout: 'cards',
      public_origin: 'https://bachatacalendar.co.uk',
    });
    expect(html).toContain('class="cards"');
    expect(html).toContain('class="card"');
    expect(html).not.toContain('class="events"');
  });

  it('defaults the title to "Upcoming bachata events in {city}"', () => {
    const html = renderWidgetHtml({
      events: [evt()],
      city_slug: 'london',
      organiser_name: null,
      title: null,
      theme: 'dark',
      layout: 'list',
      public_origin: 'https://bachatacalendar.co.uk',
    });
    expect(html).toContain('Upcoming bachata events in london');
  });

  it('uses the organiser name in the title when set', () => {
    const html = renderWidgetHtml({
      events: [evt()],
      city_slug: null,
      organiser_name: 'Ritmo Latino',
      title: null,
      theme: 'dark',
      layout: 'list',
      public_origin: 'https://bachatacalendar.co.uk',
    });
    expect(html).toContain('Upcoming events from Ritmo Latino');
  });

  it('builds detail links pointing at the public site /event/:id', () => {
    const html = renderWidgetHtml({
      events: [evt({ event_id: 'series-xyz' })],
      city_slug: null,
      organiser_name: null,
      title: null,
      theme: 'dark',
      layout: 'list',
      public_origin: 'https://bachatacalendar.co.uk',
    });
    expect(html).toContain('href="https://bachatacalendar.co.uk/event/series-xyz"');
    expect(html).toContain('target="_top"');
  });

  it('applies the requested theme via data attribute', () => {
    const html = renderWidgetHtml({
      events: [],
      city_slug: null,
      organiser_name: null,
      title: null,
      theme: 'light',
      layout: 'list',
      public_origin: 'https://bachatacalendar.co.uk',
    });
    expect(html).toContain('data-theme="light"');
  });
});
