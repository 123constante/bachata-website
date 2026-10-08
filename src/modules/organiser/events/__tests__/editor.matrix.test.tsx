// @vitest-environment jsdom
/**
 * F4 matrix: the events list and the event editor rendered with EVERY real
 * series shape (src/modules/organiser/__tests__/shapes/shapes.ts, from the prod
 * survey), through the real parsers. Each case asserts the consistency rules:
 * (1) one lifecycle word everywhere, (2) the Date card never contradicts the
 * data, (3) no copy points at a control that is not there, (4) controls that
 * cannot work are disabled WITH a reason and an untouched save sends nothing,
 * (5) long / empty / past-only / cancelled-only lists read sensibly, (6) styles
 * outside the chip list show once and survive a save.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import {
  LIFECYCLE_WORD, SHAPES, TODAY, VENUES, homeOf, pastOf, programmeOf, shapeByKey, upcomingOf, workspaceOf, type SeriesShape,
} from '../../__tests__/shapes/shapes';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c1' }) }));

import EventsPage from '../index';
import EventEditorPage from '../EventEditorPage';
import { draftFromWorkspace, parseEventWorkspace, savePlan } from '../eventModel';

type Env = { p_envelope: { command: { kind: string; payload: Record<string, unknown> } } };
const commands = () => rpc.mock.calls.filter(([fn]) => fn === 'series_command_p5').map(([, a]) => (a as Env).p_envelope.command);

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
      series_command_p5: { ok: true, new_version: 6 },
    };
    return fn in answers ? { data: answers[fn], error: null } : { data: null, error: { message: `unexpected ${fn}` } };
  });
});
afterEach(cleanup);

function Where() {
  return <span data-testid="where">{useLocation().pathname}</span>;
}
function mount(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/account/o/events" element={<EventsPage />} />
          <Route path="/account/o/events/:seriesId" element={<EventEditorPage />} />
          <Route path="/account/o/events/:seriesId/dates/:occurrenceId" element={<span data-testid="date-page" />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
async function openEditor(s: SeriesShape) {
  current = s;
  mount(`/account/o/events/${s.id}`);
  return screen.findByTestId('org-event-editor');
}

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayMonth = (iso: string) => `${Number(iso.slice(8, 10))} ${MON[Number(iso.slice(5, 7)) - 1]}`;
const closed = (s: SeriesShape) => s.lifecycle === 'ended' || s.lifecycle === 'archived';
/** The one rule the owner's screen can edit: weekly, every week, one weekday, on a recurring series. */
const editableWeekly = (s: SeriesShape) => {
  const r = s.rule as { mode?: string; interval?: number; weekdays?: number[] } | null;
  // G5: recurring with no rule and at most one date is the owner's one-date shape, which can go weekly.
  if (s.format === 'recurring' && !r && s.dates.length <= 1 && !closed(s)) return true;
  return s.format === 'recurring' && r?.mode === 'weekly' && (r.interval ?? 1) === 1 && (r.weekdays ?? []).length === 1;
};
const text = (el: Element) => el.textContent ?? '';
const isOff = (el: Element) => (el as HTMLButtonElement).disabled || el.getAttribute('aria-disabled') === 'true' || (el as HTMLTextAreaElement).readOnly === true;

describe.each(SHAPES.map((s) => [s.key, s] as const))('shape %s', (_key, s) => {
  it(`(1) the list tag and the editor tag both say "${LIFECYCLE_WORD[s.lifecycle]}"`, async () => {
    current = s;
    mount('/account/o/events');
    const row = await screen.findByTestId('org-event-row');
    expect(text(within(row).getByTestId('org-event-row-status'))).toBe(LIFECYCLE_WORD[s.lifecycle]);
    cleanup();
    await openEditor(s);
    expect(text(screen.getByTestId('org-event-status'))).toBe(LIFECYCLE_WORD[s.lifecycle]);
  });

  it('(2) the Date card never contradicts the data', async () => {
    await openEditor(s);
    const card = screen.getByTestId('org-date-card');
    if (s.format !== 'one_off' && s.dates.length >= 2) {
      expect(text(screen.getByTestId('org-row-repeats'))).not.toMatch(/One date/);
      expect(text(card)).not.toMatch(/No date listed yet/);
    }
    if (s.endedOn) expect(text(card)).toMatch(new RegExp(`Ended on .*${dayMonth(s.endedOn)}`));
    if (upcomingOf(s).length === 0) expect(text(card)).not.toMatch(/Listed until/);
  });

  it('(3) no copy points at a control that is not on screen; empty states say what you CAN do', async () => {
    const editor = await openEditor(s);
    const extend = screen.queryByTestId('org-extend');
    const words = text(editor).replace(extend ? text(extend) : '', '');
    if (/\bExtend\b/.test(words)) expect(extend).not.toBeNull();
    if (closed(s)) expect(text(editor)).not.toMatch(/once a date is listed|Extend to list more/);
    if (upcomingOf(s).length === 0) {
      const dates = screen.getByTestId('org-dates');
      expect(text(dates)).toMatch(/No upcoming dates/);
      // The empty state names something the person can do (or who can).
      expect(text(dates)).toMatch(/Extend|team|Starts on|new event/i);
    }
  });

  it('(4) controls that cannot work are disabled WITH a reason; untouched sends nothing', async () => {
    const editor = await openEditor(s);
    const ws = parseEventWorkspace(workspaceOf(s));
    const d = draftFromWorkspace(ws, TODAY);
    expect(savePlan(d, d, ws, TODAY)).toEqual([]);
    if (closed(s)) {
      // A closed event has no save bar at all (saveBarState): nothing reads as a dead 'Saved' button.
      expect(screen.queryByTestId('org-preview-bar-action')).toBeNull();
      expect(screen.queryByText('Read only')).toBeNull();
      expect(isOff(screen.getByTestId('org-event-name'))).toBe(true);
      for (const id of ['org-row-starts', 'org-row-repeats', 'org-row-venue', 'org-row-description', 'org-row-ticket', 'org-row-gallery', 'org-row-video']) {
        const el = screen.getByTestId(id);
        if (el.tagName === 'BUTTON') expect(isOff(el), id).toBe(true);
      }
      screen.queryAllByTestId('org-style-chip').forEach((c) => expect(isOff(c)).toBe(true));
      expect(text(editor)).toMatch(/Bachata Calendar team/);
      // Disabled rows promise nothing: no chevron on a row that cannot open.
      expect(editor.querySelectorAll('button:disabled svg.lucide-chevron-right').length).toBe(0);
      expect(commands()).toEqual([]);
      return;
    }
    expect((screen.getByTestId('org-preview-bar-action') as HTMLButtonElement).disabled).toBe(true);
    if (!editableWeekly(s)) {
      // Repeats cannot be switched to a weekly rule here (not recurring, or a rule this screen does not draw).
      const repeats = screen.getByTestId('org-row-repeats');
      if (repeats.tagName === 'BUTTON') expect(isOff(repeats)).toBe(true);
      expect(text(repeats).length).toBeGreaterThan(text(within(repeats).queryByTestId('org-row-repeats-value') ?? repeats).length - 1);
      expect(text(screen.getByTestId('org-date-card'))).toMatch(/team|one by one|Open a date/i);
    }
    // A name edit sends ONE series.upsert with the name, never a rule / format / lifecycle change.
    fireEvent.change(screen.getByTestId('org-event-name'), { target: { value: `${s.name} renamed` } });
    fireEvent.click(screen.getByTestId('org-preview-bar-action'));
    await waitFor(() => expect(commands().length).toBeGreaterThan(0));
    expect(commands()).toEqual([{ kind: 'series.upsert', payload: { name: `${s.name} renamed` } }]);
  });

  it('(4b) a live or paused repeating event does not offer "One date" as if it worked', async () => {
    if (closed(s) || !editableWeekly(s) || !['live', 'paused'].includes(s.lifecycle)) return;
    await openEditor(s);
    fireEvent.click(screen.getByTestId('org-row-repeats'));
    const single = await screen.findByTestId('org-shape-single');
    expect(isOff(single)).toBe(true);
    expect(text(single)).toMatch(/team/i);
  });

  it('(5) the dates lists: counts match, past rows show they open, truncation is said', async () => {
    await openEditor(s);
    const dates = screen.getByTestId('org-dates');
    const loaded = [...s.dates].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 100);
    const up = loaded.filter((d) => d.date >= TODAY);
    const past = loaded.filter((d) => d.date < TODAY);
    expect(text(dates)).toContain(`Upcoming dates (${up.length})`);
    if (s.dates.length > 100) expect(text(dates)).toMatch(/newest 100/i);
    if (past.length) {
      fireEvent.click(screen.getByTestId('org-dates-past-toggle'));
      const rows = within(screen.getByTestId('org-dates-past')).getAllByTestId('org-date-row');
      expect(rows).toHaveLength(past.length);
      rows.forEach((r) => expect(r.querySelector('.lucide-chevron-right')).not.toBeNull());
      fireEvent.click(rows[0]);
      expect(text(screen.getByTestId('where'))).toBe(`/account/o/events/${s.id}/dates/${past.sort((a, b) => b.date.localeCompare(a.date))[0].id}`);
    }
    if (up.length && up.every((d) => d.status === 'cancelled')) {
      within(dates).getAllByTestId('org-date-row').slice(0, up.length).forEach((r) => expect(text(r)).toMatch(/Cancelled/));
    }
    expect(pastOf(s).length + upcomingOf(s).length).toBe(s.dates.length);
  });

  it('(6) stored styles show once each, matched without case', async () => {
    await openEditor(s);
    const chips = screen.queryAllByTestId('org-style-chip');
    for (const style of s.styles) {
      const same = chips.filter((c) => text(c).trim().toLowerCase() === style.toLowerCase());
      expect(same, style).toHaveLength(1);
      expect(same[0].getAttribute('aria-pressed')).toBe('true');
    }
  });

  it('(bar) nothing unsaved: a slim bar, no preview card', async () => {
    await openEditor(s);
    expect(screen.queryByTestId('org-preview-bar-preview')).toBeNull();
  });
});

describe('styles outside the chip list survive edits and saves', () => {
  const s: SeriesShape = { ...shapeByKey('live-weekly-until'), styles: ['bachata', 'zouk'] };

  it('a lowercase stored style stays one chip after toggling it off and on, and a save keeps every stored style once', async () => {
    await openEditor(s);
    const zouk = () => screen.getAllByTestId('org-style-chip').filter((c) => text(c).trim().toLowerCase() === 'zouk');
    fireEvent.click(zouk()[0]);
    expect(zouk()).toHaveLength(1);
    expect(zouk()[0].getAttribute('aria-pressed')).toBe('false');
    fireEvent.click(zouk()[0]);
    expect(zouk()).toHaveLength(1);
    const reggaeton = screen.getAllByTestId('org-style-chip').find((c) => text(c).trim() === 'Reggaeton')!;
    fireEvent.click(reggaeton);
    expect(screen.getByTestId('org-preview-bar-preview')).toBeTruthy();
    fireEvent.click(screen.getByTestId('org-preview-bar-action'));
    await waitFor(() => expect(commands().length).toBe(1));
    const styles = commands()[0].payload.default_music_styles as string[];
    expect(styles.map((x) => x.toLowerCase()).sort()).toEqual(['bachata', 'reggaeton', 'zouk']);
  });
});
