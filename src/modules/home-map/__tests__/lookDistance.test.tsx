// @vitest-environment jsdom
/**
 * homeFeedLook distance (option M, owner pick 2026-11-19): big number, small "mi",
 * slow ping ring, no map pin. Motion cannot be shown in a still, so this test pins
 * the markup that carries it and the reduced-motion opt-out in the CSS.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { MapEvent } from '../mapTypes';
import { installJsdomPolyfills } from '../../../../tests/client/jsdomPolyfills';

const flagsMock = vi.hoisted(() => ({ value: {} as Record<string, boolean> }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const real = await orig<typeof import('@/lib/featureFlags')>();
  return { ...real, flags: new Proxy({}, { get: (_t, k: string) => flagsMock.value[k] ?? false }) };
});

afterEach(cleanup);

const event = {
  occurrence_id: 'o1', event_id: 'e1', name: 'Mix Night', cover_image_url: null, venue_name: 'The Venue', area: null,
  city_slug: 'london-gb', lat: 51.5, lng: -0.1, instance_date: '2026-10-26', start_time: '2026-10-26 19:00:00+00',
  end_time: '2026-10-26 23:30:00+00', type: 'standard', has_party: true, has_class: true,
  class_start: '2026-10-26 19:00:00+00', class_end: '2026-10-26 20:30:00+00',
  party_start: '2026-10-26 21:00:00+00', party_end: '2026-10-26 23:30:00+00',
  created_at: null, updated_at: null, freshness_kind: null, is_cancelled: false, cancellation_reason_label: null,
} as unknown as MapEvent;

async function renderRow(distanceMi: number | null) {
  installJsdomPolyfills();
  const { EventRow } = await import('../cards/cards');
  return render(
    <MemoryRouter>
      <EventRow event={event} selected={false} onSelect={() => {}} showFreshness={false} today="2026-10-26" distanceMi={distanceMi} />
    </MemoryRouter>,
  );
}

describe('homeFeedLook distance M', () => {
  it('shows number, "mi" and the ping ring when a distance is known', async () => {
    flagsMock.value = { homePolish: true, homeFeedLook: true };
    const { container } = await renderRow(2.34);
    const d = container.querySelector('[data-testid="look-distance"]');
    expect(d, 'look-distance present').not.toBeNull();
    expect(d!.querySelector('.hm-look-num')!.textContent).toBe('2.3');
    expect(d!.querySelector('.hm-look-mi')!.textContent).toBe('mi');
    expect(d!.querySelector('.hm-look-ping'), 'ping ring').not.toBeNull();
    expect(d!.getAttribute('aria-label')).toBe('2.3 miles away');
  });

  it('rounds to a whole number from 10 miles', async () => {
    flagsMock.value = { homePolish: true, homeFeedLook: true };
    const { container } = await renderRow(12.6);
    expect(container.querySelector('.hm-look-num')!.textContent).toBe('13');
  });

  it('shows no distance block when the distance is unknown', async () => {
    flagsMock.value = { homePolish: true, homeFeedLook: true };
    const { container } = await renderRow(null);
    expect(container.querySelector('[data-testid="look-distance"]')).toBeNull();
  });

  it('CSS animates the ping and switches it off under reduced motion', () => {
    const css = readFileSync(resolve(__dirname, '../homeMap.css'), 'utf8');
    expect(css).toMatch(/\.hm-look-ping\s*\{[^}]*animation:\s*hm-ping/);
    expect(css).toMatch(/@keyframes hm-ping/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce\)\s*\{[^}]*\.hm-look-ping[^}]*animation:\s*none/s);
  });
});
