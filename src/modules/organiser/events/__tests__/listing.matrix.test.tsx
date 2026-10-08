// @vitest-environment jsdom
/**
 * The Date card's 'Listed until' row over every cap shape from the prod survey
 * (dateCapShapes.ts) plus the existing shapes. One rule decides it all, the
 * SERVER's (_cmd_series_add_date_p5 / _materialise_series_occurrences_p5_v1):
 * an organiser cannot add a new upcoming date while 30 or more upcoming
 * scheduled (not cancelled) dates are listed; a series already above 30 keeps
 * every date. A rule end is at most 12 months ahead (_owner_weekly_rule_problem_p5).
 * Asserted per shape: (a) the end date carries the year when it is not this
 * year, (b) Extend is on exactly when the server would add a date, (c) the
 * sentence never contradicts the count, (d) a disabled Extend shows its reason
 * on screen, (e) no sentence points at a control that is not there.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SHAPES, TODAY, VENUES, homeOf, programmeOf, upcomingOf, workspaceOf, type SeriesShape } from '../../__tests__/shapes/shapes';
import { CAP_SHAPES } from '../../__tests__/shapes/dateCapShapes';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c1' }) }));

import EventEditorPage from '../EventEditorPage';

let current: SeriesShape;
beforeEach(() => {
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    const s = current;
    const next = upcomingOf(s).find((d) => d.status !== 'cancelled') ?? upcomingOf(s)[0];
    const answers: Record<string, unknown> = {
      organiser_home_v1: homeOf([s]),
      admin_event_workspace_p5: workspaceOf(s),
      organiser_get_occurrence_programme_v1: next ? programmeOf(s, next) : null,
      get_organiser_venue_options_v1: VENUES,
    };
    return fn in answers ? { data: answers[fn], error: null } : { data: null, error: { message: `unexpected ${fn}` } };
  });
});
afterEach(cleanup);

async function openEditor(s: SeriesShape) {
  current = s;
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/account/o/events/${s.id}`]}>
        <Routes><Route path="/account/o/events/:seriesId" element={<EventEditorPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return screen.findByTestId('org-event-editor');
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const text = (el: Element | null) => el?.textContent ?? '';
const CAP = 30;
const BOUND = '2027-10-08';
/** What the server counts toward the cap. */
const listedOf = (s: SeriesShape) => upcomingOf(s).filter((d) => d.status !== 'cancelled').length;
const lastOf = (s: SeriesShape) => upcomingOf(s).slice(-1)[0]?.date ?? null;
const ruleEnd = (s: SeriesShape) => ((s.rule as { end?: { kind?: string; date?: string } } | null)?.end?.kind === 'until_date'
  ? (s.rule as { end: { date: string } }).end.date : null);

const CASES = [...CAP_SHAPES, ...SHAPES];

describe.each(CASES.map((s) => [s.key, s] as const))('shape %s', (_key, s) => {
  it('(a) the end date names its year when it is not this year', async () => {
    await openEditor(s);
    const row = screen.queryByTestId('org-row-until');
    const until = ruleEnd(s) ?? lastOf(s);
    if (!row || !until || until < TODAY || !/Listed until/.test(text(row))) return;
    const [y, m, d] = until.split('-').map(Number);
    const want = `${d} ${MON[m - 1]}${y === 2026 ? '' : ` ${y}`}`;
    expect(text(row)).toContain(`Listed until`);
    expect(text(row)).toMatch(new RegExp(`${want}(?! \\d{4})`));
  });

  it('(b-e) Extend works exactly when the server would add a date, and says why not', async () => {
    await openEditor(s);
    const extend = screen.queryByTestId('org-extend') as HTMLButtonElement | null;
    const row = screen.queryByTestId('org-row-until');
    // (c) no sentence says "N listed; the most is M" with N > M, or any count over the cap as if it were the cap.
    const all = text(screen.getByTestId('org-date-card'));
    for (const [, n, m] of all.matchAll(/(\d+) listed; the most is (\d+)/g)) expect(Number(n)).toBeLessThanOrEqual(Number(m));
    if (!extend) {
      // (e) nothing mentions Extend when it is not on screen.
      expect(all).not.toMatch(/\bExtend\b/);
      return;
    }
    const listed = listedOf(s);
    const end = ruleEnd(s) ?? lastOf(s);
    const serverWouldAdd = listed < CAP && (!end || end < TODAY || (() => {
      const [y, m, d] = end.split('-').map(Number);
      const next = new Date(Date.UTC(y, m - 1, d + 7)).toISOString().slice(0, 10);
      return next <= BOUND;
    })());
    expect(extend.disabled, `listed ${listed}`).toBe(!serverWouldAdd);
    const note = text(screen.getByTestId('org-extend-note'));
    if (extend.disabled) {
      // (d) the reason is ON SCREEN, says the true count, and does not call a number over 30 'the most'.
      expect(note).toMatch(/Extend is off/);
      if (listed >= CAP) {
        expect(note).toContain(`${listed} upcoming dates are listed`);
        expect(note).toMatch(/fewer than 30/);
      } else {
        expect(note).toMatch(/12 months/);
      }
    } else {
      expect(note).not.toMatch(/Extend is off/);
    }
    // The sheet behind the row never promises 'Extend later' when Extend is off.
    fireEvent.click(screen.getByTestId('org-row-until-open'));
    const sheetNote = text(await screen.findByTestId('org-cap-note'));
    if (extend.disabled) expect(sheetNote).not.toMatch(/Extend later/);
    if (listed >= CAP) expect(sheetNote).toContain(`${listed}`);
    expect(text(row)).toBeTruthy();
  });
});
