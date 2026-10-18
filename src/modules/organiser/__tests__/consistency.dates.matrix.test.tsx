// @vitest-environment jsdom
/**
 * P-DATES consistency matrix (extends S8): every prod shape x every date
 * screen reads the same fact the same way. One event's coming dates, Change
 * "which date" and "pick several" list the SAME dates, each with a Sessions
 * link to THAT date; "Take this date off" works exactly on weekly-repeat
 * dates and says why elsewhere; the past list counts the past dates the read
 * holds; Change time shows the sessions the session editor reads. A non-live
 * event is refused on Pick exactly as on "which date".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, from: () => ({ select: () => ({ is: () => ({ order: async () => ({ data: [], error: null }) }) }) }) },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));

import ChangeFlow from '@/modules/organiser/flows/change';
import OneEvent from '@/modules/organiser/events/OneEvent';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { isRuleDate, parseWorkspace } from '@/modules/organiser/shared/seriesModel';
import { OFF_ONLY_RULE } from '@/modules/organiser/flows/change/WhatChanges';
import { FESTIVAL_TIME, isFestival, seriesLock } from '@/modules/organiser/flows/change/changeModel';
import { SHAPES, TODAY, dateViewOf, homeOf, programmeOf, workspaceOf, type SeriesShape } from './shapes/shapes';

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${TODAY}T12:00:00Z`));
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    const byId = (id: string) => SHAPES.find((s) => s.id === id) as SeriesShape;
    const dateOf = (occ: string) => {
      for (const s of SHAPES) { const d = s.dates.find((x) => x.id === occ); if (d) return { s, d }; }
      return null;
    };
    if (fn === 'organiser_home_v1') return { data: homeOf(SHAPES), error: null };
    if (fn === 'admin_event_workspace_p5') return { data: workspaceOf(byId(String(args.p_series_id))), error: null };
    if (fn === 'event_view_p5') { const f = dateOf(String((args.p_target as { occurrence_id: string }).occurrence_id)); return { data: f && dateViewOf(f.s, f.d), error: null }; }
    if (fn === 'organiser_get_occurrence_programme_v1') { const f = dateOf(String(args.p_occurrence_id)); return { data: f && programmeOf(f.s, f.d), error: null }; }
    return { data: null, error: null };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account/o/change/:seriesId" element={<ChangeFlow step="date" />} />
          <Route path="/account/o/change/:seriesId/pick" element={<ChangeFlow step="pick" />} />
          <Route path="/account/o/change/:seriesId/:occurrenceId" element={<ChangeFlow step="what" />} />
          <Route path="/account/o/change/:seriesId/:occurrenceId/time" element={<ChangeFlow step="time" />} />
          <Route path="/account/o/events/:seriesId" element={<OneEvent />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** The dates the workspace read holds (newest 100), coming and scheduled, soonest first. */
const coming = (s: SeriesShape) =>
  workspaceOf(s).occurrences.filter((o) => o.occurrence_date >= TODAY && o.lifecycle_status === 'scheduled').sort((a, b) => a.occurrence_date.localeCompare(b.occurrence_date));
const pastHeld = (s: SeriesShape) => workspaceOf(s).occurrences.filter((o) => o.occurrence_date < TODAY).length;
const lineupHref = (s: SeriesShape) => (id: string) => ORG_PATHS.dateLineup(s.id, id);

const LIVE_WITH_DATES = SHAPES.filter((s) => s.lifecycle === 'live' && coming(s).length > 0);
const NOT_LIVE = SHAPES.filter((s) => s.lifecycle !== 'live');

describe('P-DATES matrix: the same coming dates, each with its own Sessions link', () => {
  it.each(LIVE_WITH_DATES.map((s) => [s.key, s] as const))('%s: Which date and One event link the same dates to their session editors', async (_k, s) => {
    mount(ORG_PATHS.changeEvent(s.id));
    const which = (await screen.findAllByTestId('change-date-sessions'));
    // Which date shows the first 14, then "N more".
    expect(which.length).toBe(Math.min(14, coming(s).length));
    cleanup();
    mount(ORG_PATHS.event(s.id));
    const links = (await screen.findAllByTestId('org-coming-sessions')).map((l) => l.getAttribute('href'));
    const rows = screen.getAllByTestId('org-coming-date').map((r) => r.getAttribute('href')!.split('/').pop());
    expect(links).toEqual(rows.map((id) => lineupHref(s)(decodeURIComponent(id!))));
    expect(links).toEqual(coming(s).slice(0, links.length).map((o) => lineupHref(s)(o.id)));
  });

  it.each(LIVE_WITH_DATES.map((s) => [s.key, s] as const))('%s: Pick lists every coming date the read holds', async (_k, s) => {
    mount(ORG_PATHS.changePick(s.id));
    expect(await screen.findAllByTestId('change-pick-date')).toHaveLength(coming(s).length);
  });

  it.each(NOT_LIVE.map((s) => [s.key, s] as const))('%s: Pick is refused exactly as Which date (same screen, same words)', async (_k, s) => {
    mount(ORG_PATHS.changeEvent(s.id));
    const which = await screen.findByTestId(/^change-(refusal|missing)$/);
    const expected = { id: which.getAttribute('data-testid'), text: which.textContent };
    if (expected.id === 'change-refusal') expect(expected.text).toContain(seriesLock(s.lifecycle) as string);
    cleanup();
    mount(ORG_PATHS.changePick(s.id));
    const pick = await screen.findByTestId(/^change-(refusal|missing)$/);
    expect({ id: pick.getAttribute('data-testid'), text: pick.textContent }).toEqual(expected);
    expect(screen.queryByTestId('change-pick-date')).toBeNull();
  });
});

describe('P-DATES matrix: one date’s Change screen', () => {
  it.each(LIVE_WITH_DATES.map((s) => [s.key, s] as const))('%s: Take this date off works exactly on weekly-repeat dates, else says why', async (_k, s) => {
    mount(ORG_PATHS.changeDate(s.id, coming(s)[0].id));
    const off = await screen.findByTestId('change-off');
    // The date page's own mapping for the same fact (dates/index.tsx "Break this week").
    const weekly = isRuleDate(coming(s)[0].occurrence_date, parseWorkspace(workspaceOf(s)).series);
    expect(off.hasAttribute('disabled')).toBe(!weekly);
    if (!weekly) expect(off.textContent).toContain(OFF_ONLY_RULE);
    expect(screen.getByTestId('change-lineup')).toBeTruthy();
    expect(screen.queryByTestId('change-day')).toBeNull();
    // F-PAR-final N2: set_time refuses a festival, so its row is off with the shared words.
    const time = screen.getByTestId('change-time');
    expect(time.hasAttribute('disabled')).toBe(isFestival(s));
    expect(time.textContent?.includes(FESTIVAL_TIME)).toBe(isFestival(s));
  });

  it.each(LIVE_WITH_DATES.map((s) => [s.key, s] as const))('%s: Change time shows the sessions the session editor reads', async (_k, s) => {
    mount(ORG_PATHS.changeTime(s.id, coming(s)[0].id));
    if (isFestival(s)) {
      // F-PAR-final N2: refused before the form (the server says "per-date time is not supported for festivals").
      expect((await screen.findByTestId('change-time-festival')).textContent).toContain(FESTIVAL_TIME);
      expect(screen.queryByTestId('change-time-input')).toBeNull();
      return;
    }
    await screen.findByTestId('change-time-screen');
    const many = s.sessionsOnNext;
    expect(!!screen.queryByTestId('change-time-sessions')).toBe(many);
    if (many) expect(within(screen.getByTestId('change-time-sessions')).getAllByTestId('change-time-session')).toHaveLength(2);
    // Every shape runs at the usual 20:00, so no shape offers a reset.
    expect(screen.queryByTestId('change-time-reset')).toBeNull();
  });
});

describe('P-DATES matrix: past dates on One event', () => {
  it.each(SHAPES.filter((s) => pastHeld(s) > 0 && s.lifecycle !== 'draft').map((s) => [s.key, s] as const))('%s: "Past dates (N)" counts the past dates the read holds', async (_k, s) => {
    mount(ORG_PATHS.event(s.id));
    const toggle = await screen.findByTestId('org-dates-past-toggle');
    expect(toggle.textContent).toContain(`Past dates (${pastHeld(s)})`);
    fireEvent.click(toggle);
    expect(within(await screen.findByTestId('org-dates-past')).getAllByTestId('org-date-row')).toHaveLength(pastHeld(s));
  });
});
