// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

const fl = vi.hoisted(() => ({ on: false }));
vi.mock('@/lib/featureFlags', async (orig) => {
  const m = await orig<typeof import('@/lib/featureFlags')>();
  return { ...m, flags: new Proxy(m.flags, { get: (t, k) => (k === 'organiserEditorV2' ? fl.on : (t as never)[k]) }) };
});

import { EventRow } from '../EventList';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';

const mk = (o: Record<string, unknown> = {}) => ({
  id: 's1', name: 'Friday Social', lifecycle_status: 'live', format: 'recurring', upcoming_count: 3, next_dates: [],
  default_venue_name: 'The Hall', default_cover_image_url: 'https://x/y.jpg', ...o,
}) as never;
const show = (s = mk()) => render(<MemoryRouter><EventRow series={s} today="2026-11-19" /></MemoryRouter>);
afterEach(() => { cleanup(); fl.on = false; });

describe('EventRow, editor-v2 flag', () => {
  it('flag off: original link only, no dots or buttons', () => {
    show();
    const row = screen.getByTestId('org-event-row');
    expect(row.getAttribute('href')).toBe(ORG_PATHS.event('s1'));
    expect(row.getAttribute('data-series-id')).toBe('s1');
    expect(screen.getByTestId('org-event-chip')).toBeTruthy();
    expect(screen.queryByTestId('org-event-ready')).toBeNull();
    expect(screen.queryByTestId('org-event-edit')).toBeNull();
    expect(screen.queryByTestId('org-event-cancel')).toBeNull();
  });
  it('flag on, all ready: 3 filled dots, "3 of 3 ready", Edit and Cancel 44px, keep-list testids', () => {
    fl.on = true;
    const { container } = show();
    expect(screen.getByTestId('org-event-row').getAttribute('data-series-id')).toBe('s1');
    expect(screen.getByTestId('org-event-chip')).toBeTruthy();
    const dots = container.querySelectorAll('[data-filled]');
    expect(dots.length).toBe(3);
    expect([...dots].every((d) => d.getAttribute('data-filled') === 'true')).toBe(true);
    expect(screen.getByTestId('org-event-ready').textContent).toBe('3 of 3 ready');
    for (const id of ['org-event-edit', 'org-event-cancel']) {
      const a = screen.getByTestId(id);
      expect(a.className).toContain('h-[44px]');
      expect(a.getAttribute('href')).toBe(ORG_PATHS.event('s1'));
    }
    expect(screen.queryByText(/guest list/i)).toBeNull();
  });
  it('flag on, gaps: unfilled dots and the missing words', () => {
    fl.on = true;
    const { container } = show(mk({ default_venue_name: null, default_cover_image_url: null }));
    expect([...container.querySelectorAll('[data-filled]')].map((d) => d.getAttribute('data-filled'))).toEqual(['true', 'false', 'false']);
    expect(screen.getByTestId('org-event-ready').textContent).toMatch(/^1 of 3 ready/);
  });
});
