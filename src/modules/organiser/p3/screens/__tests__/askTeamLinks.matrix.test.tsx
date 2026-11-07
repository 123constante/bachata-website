// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { SHAPES, type ShapeKey } from './wsFixtures';
import { P3_PATHS } from '../../shell/paths';
import { parseEventWorkspace, type EventDraft } from '../../../events/eventModel';
import { REPEAT_WHY } from '../../model/repeat';
import { L } from '../../model';
import type { VenueOption } from '../../../shared/publicVenues';

/*
 * Ask-the-team links (brief organiser-ask-us-links): every organiser screen whose words send the
 * person to the team carries a working WhatsApp link that names the event, so the words never point
 * at a control that is not there. Venue search (EditorSheet), the locked Repeat sheet, festival sessions.
 */

const wsQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(async () => ({ data: [], error: null })), auth: {}, from: vi.fn() } }));
vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
vi.mock('../../../shared/runCommands', () => ({
  useEventWorkspace: () => wsQ.value,
  useRunCommands: () => async () => 8,
  useSendOnce: () => async () => { throw new Error('not sent here'); },
}));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));
vi.mock('../../../shared/goLiveCheck', async (orig) => ({
  ...(await orig<typeof import('../../../shared/goLiveCheck')>()),
  useGoLiveCheck: () => ({ data: undefined, refetch: () => Promise.resolve() }),
}));

import { EventPage } from '../EventPage';
import { EditorSheet } from '../../../events/EditorSheet';
import { RepeatSheet } from '../RepeatSheet';

afterEach(cleanup);

const WA = /^https:\/\/(wa\.me|api\.whatsapp\.com)\//;
const said = (a: HTMLElement) => decodeURIComponent((a.getAttribute('href') ?? '').split('?text=')[1] ?? '');
/** A copy line that sends the person to the team ("Ask us", "ask the Bachata Calendar team", "Ask the team"). */
const ASKS = /\bask (us|the (bachata calendar )?team)\b/i;

function expectAskLink(a: HTMLElement, name: string) {
  expect(a.getAttribute('href')).toMatch(WA);
  expect(a.getAttribute('target')).toBe('_blank');
  expect(a.getAttribute('rel')).toBe('noopener noreferrer');
  expect(said(a)).toContain(name);
}

const wrap = (ui: ReactNode, path = '/') => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    <MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter>
  </QueryClientProvider>
);

function showEvent(raw: Record<string, unknown>) {
  wsQ.value = { isPending: false, isError: false, data: parseEventWorkspace(raw), error: null, refetch: vi.fn() };
  return render(wrap(<Routes><Route path="/account/p3/events/:seriesId" element={<EventPage />} /></Routes>, P3_PATHS.event('ser-1')));
}

/** The Repeat sheet itself (an archived event's page is a finished card, so its sheet is reached only by direct render). */
function showRepeat(raw: Record<string, unknown>) {
  const send = (async () => { throw new Error('not sent here'); }) as never;
  return render(wrap(<RepeatSheet ws={parseEventWorkspace(raw)} today="2026-10-25" send={send}
    preview={async () => { throw new Error('no preview here'); }} onDone={() => {}} onClose={() => {}} />));
}

const S = SHAPES as Record<ShapeKey, Record<string, unknown>>;
const withSeries = (k: ShapeKey, patch: Record<string, unknown>) => {
  const raw = structuredClone(S[k]) as { series: { series: Record<string, unknown> } };
  Object.assign(raw.series.series, patch);
  return raw as unknown as Record<string, unknown>;
};

/** Prod shapes (event_series_p5, 2026-11-07): 6 open monthly rules are nth_weekday (the owner can edit), 1 live is weekday_except_last (team only). */
const PROD_EXCEPT_LAST = { mode: 'monthly', interval: 1, monthly: { kind: 'weekday_except_last', weekday: 5 }, end: { kind: 'none' } };
const PROD_NTH = { mode: 'monthly', interval: 1, monthly: { kind: 'nth_weekday', nth: 1, weekday: 6 }, end: { kind: 'none' } };

const REPEAT_LOCKED: Array<[string, Record<string, unknown>, string, string]> = [
  ['adminOnly (a pattern only the team writes)', withSeries('weekly', { recurrence_rule: PROD_EXCEPT_LAST }), 'Sensual Fridays', REPEAT_WHY.adminOnly],
  ['review (the team is checking it)', withSeries('weekly', { lifecycle_status: 'pending_review' }), 'Sensual Fridays', REPEAT_WHY.review],
  ['ended', S.ended, 'Old Wednesdays', REPEAT_WHY.ended],
  ['archived', S.archived, 'Gone Nights', REPEAT_WHY.archived],
  ['festival (its own days)', S.festival, 'Winter Festival', REPEAT_WHY.festival],
];

describe('Repeat sheet: a locked pattern whose words say ask the team has the Ask link', () => {
  it.each(REPEAT_LOCKED)('%s', async (_label, raw, name, why) => {
    showRepeat(raw);
    expect((await screen.findByTestId('p3-repeat-why')).textContent).toBe(why);
    const a = screen.getByTestId('p3-repeat-ask-team');
    expect(a.textContent).toBe('Ask the team');
    expectAskLink(a, name);
    expect(said(a)).toContain(why);
    expect(a.className).toContain('p3-link');
  });

  it.each([['weekly', S.weekly], ['paused', S.paused], ['draftReady', S.draftReady], ['monthly nth_weekday (prod shape)', withSeries('monthly', { recurrence_rule: PROD_NTH })]] as const)('an editable %s pattern has no Ask link and no ask words', async (_k, raw) => {
    showRepeat(raw);
    await screen.findByTestId('p3-sheet');
    expect(screen.queryByTestId('p3-repeat-ask-team')).toBeNull();
    expect(screen.queryByTestId('p3-repeat-why')).toBeNull();
  });

  it.each([['course', REPEAT_WHY.course], ['custom', REPEAT_WHY.custom], ['oneoff', REPEAT_WHY.oneoff]] as const)(
    '%s: words that point at controls on the page, not the team, get no Ask link', async (k, why) => {
      expect(why).not.toMatch(ASKS);
      showRepeat(S[k]);
      expect((await screen.findByTestId('p3-repeat-why')).textContent).toBe(why);
      expect(screen.queryByTestId('p3-repeat-ask-team')).toBeNull();
    });

  it('every reason whose words send the person to the team is one that shows the link (no ask copy without a control)', () => {
    const asking = Object.entries(REPEAT_WHY).filter(([, t]) => ASKS.test(t)).map(([k]) => k).sort();
    expect(asking).toEqual(['adminOnly', 'archived', 'ended', 'festival', 'review']);
  });
});

describe('Festival sessions: the programme note has the Ask link', () => {
  it('festival: link present, names the event, sits under the unchanged note', async () => {
    showEvent(S.festival);
    expect((await screen.findByTestId('p3-sessions-ask')).textContent).toBe(L.festivalAsk);
    const a = screen.getByTestId('p3-sessions-ask-team');
    expect(a.textContent).toBe('Ask the team to change the programme');
    expectAskLink(a, 'Winter Festival');
  });

  it.each(['weekly', 'course', 'oneoff'] as const)('%s (not a festival): no Ask link, an Add session button instead', async (k) => {
    showEvent(S[k]);
    await screen.findByTestId('p3-sessions');
    expect(screen.queryByTestId('p3-sessions-ask-team')).toBeNull();
    expect(screen.getByTestId('p3-add-session')).toBeTruthy();
  });
});

const VENUES: VenueOption[] = [
  { id: 'v1', name: 'Salsa Rooms', neighbourhood: 'Soho', city_name: 'London' } as VenueOption,
  { id: 'v2', name: 'Latin Quarter', neighbourhood: 'Camden', city_name: 'London' } as VenueOption,
];

function showVenueSearch(name: string, venues: VenueOption[] = VENUES) {
  const draft: EventDraft = { name, description: '', venueId: null, ticketUrl: '', coverUrl: '', gallery: [], videos: [], styles: [], startDate: '2026-10-30', shape: 'weekly' as EventDraft['shape'], until: null };
  render(wrap(
      <EditorSheet sheet="venue-search" onSheet={() => {}} draft={draft} patch={() => {}} today="2026-10-25"
        cap={{ today: '2026-10-25', startDate: '2026-10-30' }} venues={venues} onUploadGallery={() => {}} uploading={false} uploadError={null} />,
  ));
}

describe('Event editor venue search: No venue matches has the Ask link', () => {
  it('no match: link present, carries the searched text and the event name', () => {
    showVenueSearch('Bachata Sundays');
    fireEvent.change(screen.getByTestId('org-venue-query'), { target: { value: 'Moon Club' } });
    expect(screen.getByText('No venue matches. Ask the team to add it.')).toBeTruthy();
    const a = screen.getByTestId('org-venue-ask-team');
    expect(a.textContent).toBe('Ask the team to add this venue');
    expectAskLink(a, 'Bachata Sundays');
    expect(said(a)).toContain('Moon Club');
  });

  it('no venues listed at all: the same link (the words still say ask the team)', () => {
    showVenueSearch('Bachata Sundays', []);
    expectAskLink(screen.getByTestId('org-venue-ask-team'), 'Bachata Sundays');
  });

  it('a venue matches: no Ask link and no ask words', () => {
    showVenueSearch('Bachata Sundays');
    fireEvent.change(screen.getByTestId('org-venue-query'), { target: { value: 'salsa' } });
    expect(screen.getAllByTestId('org-venue-result')).toHaveLength(1);
    expect(screen.queryByTestId('org-venue-ask-team')).toBeNull();
    expect(screen.queryByText(ASKS)).toBeNull();
  });
});

describe('the Repeat row on the page opens the same sheet (an end-to-end path for one locked shape)', () => {
  it('ended: page -> Repeats -> Ask the team', async () => {
    showEvent(S.ended);
    fireEvent.click(await screen.findByTestId('p3-open-repeat'));
    expectAskLink(await screen.findByTestId('p3-repeat-ask-team'), 'Old Wednesdays');
  });
});
