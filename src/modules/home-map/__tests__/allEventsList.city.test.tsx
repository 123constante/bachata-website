// @vitest-environment jsdom
/**
 * Home feed per city (Bristol polish): a city with nothing of its own shows
 * the empty-city note with "Tell us"; London and Budapest festivals that the
 * city query returns go under "Festivals elsewhere", never in "What's on".
 * London keeps "Festivals further afield" and its own empty copy.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AllEventsList } from '../cards/AllEventsList';
import type { UseMapListResult } from '../useMapList';
import type { MapEvent } from '../mapTypes';
import { installJsdomPolyfills } from '../../../../tests/client/jsdomPolyfills';

const ev = (o: Partial<MapEvent>): MapEvent => ({
  occurrence_id: 'o', event_id: 'e', name: 'Row', cover_image_url: null, venue_name: 'V', area: null,
  city_slug: 'london-gb', lat: 51.5, lng: -0.1, instance_date: '2026-10-26', start_time: '2026-10-26 20:00:00+00',
  end_time: '2026-10-26 23:00:00+00', type: 'standard', has_party: true, has_class: false, class_start: null,
  class_end: null, party_start: null, party_end: null, created_at: null, updated_at: null, freshness_kind: null,
  is_cancelled: false, cancellation_reason_label: null, ...o,
} as MapEvent);

const stateFor = (citySlug: string | null, listEvents: MapEvent[]) =>
  ({
    citySlug,
    listEvents,
    today: '2026-10-26',
    q: '',
    selected: null,
    geo: { status: 'denied', coords: null, request: () => {} },
    fromCard: () => {},
    setHovered: () => {},
    listRef: { current: null },
  }) as unknown as UseMapListResult;

const show = (citySlug: string | null, rows: MapEvent[]) => {
  installJsdomPolyfills();
  render(<MemoryRouter><AllEventsList state={stateFor(citySlug, rows)} /></MemoryRouter>);
};
afterEach(cleanup);

const londonFest = ev({ occurrence_id: 'f1', event_id: 'f1', name: 'London Fest', type: 'festival', city_slug: 'london-gb', instance_date: '2026-11-20' });
const budaFest = ev({ occurrence_id: 'f2', event_id: 'f2', name: 'Budapest Fest', type: 'festival', city_slug: 'budapest-hu', instance_date: '2026-12-04' });
const bristolSocial = ev({ occurrence_id: 's1', event_id: 's1', name: 'Bristol Social', city_slug: 'bristol-gb' });
const londonSocial = ev({ occurrence_id: 's2', event_id: 's2', name: 'London Social' });

describe('home feed x city x shape', () => {
  it.each([
    { label: 'Bristol, 0 rows', city: 'bristol-gb', rows: [], note: true, heading: null },
    { label: 'Bristol, festivals elsewhere only', city: 'bristol-gb', rows: [londonFest, budaFest], note: true, heading: 'Festivals elsewhere' },
    { label: 'Bristol, 1 local + festivals', city: 'bristol-gb', rows: [bristolSocial, londonFest, budaFest], note: false, heading: 'Festivals elsewhere' },
    { label: 'London, 0 rows', city: 'london-gb', rows: [], note: false, heading: null },
    { label: 'London, many', city: 'london-gb', rows: [londonSocial, londonFest, budaFest], note: false, heading: null },
    { label: 'no city, many', city: null, rows: [londonSocial, londonFest], note: false, heading: null },
  ])('$label', ({ city, rows, note, heading }) => {
    show(city, rows);
    const n = screen.queryByTestId('empty-city-note');
    expect(!!n).toBe(note);
    if (n) {
      expect(n.textContent).toContain('Nothing listed in Bristol yet');
      expect(screen.getByRole('button', { name: 'Tell us' })).toBeTruthy();
    }
    if (heading) expect(screen.getByRole('heading', { name: heading })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Festivals elsewhere' }) !== null).toBe(heading === 'Festivals elsewhere');
    if (city === 'london-gb' && rows.length === 0) expect(screen.getByText('Nothing on right now.')).toBeTruthy();
  });
});
