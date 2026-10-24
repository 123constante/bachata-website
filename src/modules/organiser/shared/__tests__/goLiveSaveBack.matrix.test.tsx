// @vitest-environment jsdom
/**
 * W2 walk fix 10: every editor a "Before you go live" row opens (`?returnTo=` the
 * event, goLiveFixHref) comes back to the event after a successful Save. ONE rule:
 * the Done screen's primary button is "Back to <event name>" and goes to the
 * sanitised returnTo; "Back to Home" stays, second. Table-driven over EVERY code in
 * GO_LIVE_BLOCKERS: follow its link, save, land on the event. Without returnTo,
 * and with an unsafe one (an external URL, `//evil`), Done is unchanged.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import { Route, useParams } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { auth: {}, rpc, from: () => ({ select: () => ({ is: () => ({ order: async () => ({ data: [], error: null }) }) }) }) },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
const VENUE = { id: 'venue-2', name: 'The Loft', neighbourhood: 'Soho', city_name: 'London', address: null, postcode: null };
vi.mock('@/modules/organiser/shared/publicVenues', async (orig) => ({
  ...(await orig<typeof import('@/modules/organiser/shared/publicVenues')>()),
  useVenueOptions: () => ({ data: [VENUE], isError: false, isFetching: false, refetch: async () => undefined }),
}));
vi.mock('@/modules/organiser/shared/createCity', () => ({ resolveCreateCityId: async () => 'city-london' }));
vi.mock('@/modules/organiser/events/media', () => ({ uploadEventPicture: async () => 'https://cdn.example/c.jpg' }));

import Details from '@/modules/organiser/events/Details';
import AddFlow from '@/modules/organiser/flows/add';
import CoverFlow from '@/modules/organiser/flows/fix';
import Done from '@/modules/organiser/flows/Done';
import { GO_BACK_LABEL, readDoneState } from '@/modules/organiser/flows/doneState';
import { useEventSend } from '@/modules/organiser/flows/event';
import { detailEditPath } from '@/modules/organiser/flows/event/eventSteps';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { GO_LIVE_BLOCKERS, GO_LIVE_SECTIONS } from '../goLiveKeys';
import { goLiveFixHref, withReturnTo } from '../goLiveCheck';
import { A, answer, day, defaultWorld, flush, mount, type World } from '@/modules/organiser/flows/add/__tests__/fixtures';

const EVENT = ORG_PATHS.event(A);
const NAME = 'Friday Social';

let world: World;
const wsRaw = (id: string) => {
  const s = world.series.find((x) => x.id === id);
  return {
    series: {
      series: {
        id, name: s?.name ?? '', format: 'recurring', lifecycle_status: s?.lifecycle_status ?? 'live', version: world.seriesVersion,
        default_local_start_time: '20:00:00', default_start_date: '2026-01-02', default_venue_id: null, default_ticket_url: null,
        default_description: 'Open social', default_level: null, instagram_url: null, default_music_styles: ['Bachata'],
        default_cover_image_url: null, payment_methods: null,
        recurrence_rule: { mode: 'weekly', weekdays: [5], interval: 1, end: { kind: 'none' } }, removed_dates: [],
      },
      program: [],
    },
    occurrences: (world.occs[id] ?? []).map((o) => ({ id: o.id, occurrence_date: o.date, lifecycle_status: o.status, version: o.version, materialised_start_utc: `${o.date}T20:00:00Z` })),
    meta: { has_more: false },
  };
};

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-10-20T12:00:00Z'));
  rpc.mockReset();
  world = defaultWorld();
  answer(rpc, () => world);
  const base = rpc.getMockImplementation() as (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) =>
    fn === 'admin_event_workspace_p5' ? { data: wsRaw(String(args.p_series_id)), error: null } : base(fn, args));
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

/**
 * The programme and organisers screens save through the same send (useEventSend) as
 * every details editor; their sheets need a full people world, so this probe saves
 * through that send at their real link. The source check below pins that they do.
 */
function SendProbe() {
  const { seriesId = '' } = useParams();
  const { sendThenDone } = useEventSend(seriesId);
  return (
    <button type="button" data-testid="probe-save"
      onClick={() => void sendThenDone(world.seriesVersion, { kind: 'series.upsert', payload: { name: NAME } }, { title: 'Saved', message: 'Saved' })}>
      Save
    </button>
  );
}

const routes = (
  <>
    <Route path="/account/o/events/:seriesId" element={<p data-testid="event-page" />} />
    <Route path="/account/o/events/:seriesId/details" element={<Details />} />
    <Route path="/account/o/events/:seriesId/programme" element={<SendProbe />} />
    <Route path="/account/o/events/:seriesId/organisers" element={<SendProbe />} />
    <Route path="/account/o/add/:seriesId" element={<AddFlow step="day" />} />
    <Route path="/account/o/add/:seriesId/:date" element={<AddFlow step="time" />} />
    <Route path="/account/o/cover/:seriesId" element={<CoverFlow />} />
    <Route path="/account/o/done" element={<Done />} />
    <Route path="/account/o/events" element={<p data-testid="events-page" />} />
  </>
);

const type = async (value: string) => fireEvent.change(await screen.findByTestId('org-detail-input'), { target: { value } });
const save = async () => fireEvent.click(await screen.findByTestId('org-detail-save'));

/** How to save on the screen each section's link opens: one real change, one Save. */
const SAVE: Record<string, () => Promise<void>> = {
  venue: async () => {
    fireEvent.click(await screen.findByTestId('org-detail-venue'));
    fireEvent.click(await screen.findByTestId('org-venue-search-open'));
    fireEvent.click(await screen.findByTestId('org-venue-result'));
    fireEvent.click(await screen.findByTestId('org-sheet-done'));
  },
  basics: async () => {
    fireEvent.click(await screen.findByTestId('org-detail-name'));
    await type('Friday Social Club');
    await save();
  },
  about: async () => { await type('A friendly social with a class first.'); await save(); },
  tickets: async () => { await type('https://tickets.example/friday'); await save(); },
  payment: async () => {
    const cash = (await screen.findAllByTestId('org-payment-chip')).find((c) => c.textContent === 'Cash') as HTMLElement;
    fireEvent.click(cash);
    await save();
  },
  dates: async () => {
    const rows = await screen.findAllByTestId('add-day-row');
    fireEvent.click(rows.find((r) => r.textContent?.includes('Tuesday 27 October')) as HTMLElement);
    fireEvent.click(await screen.findByTestId('add-save'));
  },
  cover: async () => {
    fireEvent.change(await screen.findByTestId('cover-input'), { target: { files: [new File(['x'], 'cover.png', { type: 'image/png' })] } });
  },
  programme: async () => { fireEvent.click(await screen.findByTestId('probe-save')); },
  organisers: async () => { fireEvent.click(await screen.findByTestId('probe-save')); },
};

const doneButtons = () => within(screen.getByTestId('org-done')).getAllByRole('button').map((b) => b.textContent);

describe('every go-live row: follow its link, save, come back to the event (fix 10)', () => {
  it('every section a blocker names has a save path here', () => {
    expect(Object.keys(SAVE).sort()).toEqual([...GO_LIVE_SECTIONS].sort());
  });

  it.each(Object.entries(GO_LIVE_BLOCKERS).map(([code, d]) => [code, d.section]))('%s (%s)', async (_code, section) => {
    const href = goLiveFixHref(section, A);
    expect(href).not.toBeNull();
    mount(href as string, routes);
    await SAVE[section]();
    await flush();
    await screen.findByTestId('org-done', {}, { timeout: 3000 });
    const back = await screen.findByTestId('org-done-back');
    await waitFor(() => expect(back.textContent).toBe(`Back to ${NAME}`));
    // Primary first; Home stays, second; no second button to the same event.
    expect(doneButtons()[0]).toBe(`Back to ${NAME}`);
    expect(doneButtons()).toContain('Back to Home');
    expect(doneButtons().filter((t) => t === `Back to ${NAME}` || t === 'Back to the event')).toHaveLength(1);
    fireEvent.click(back);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(EVENT));
    expect(screen.getByTestId('event-page')).toBeTruthy();
  });
});

/** The screens a go-live link opens directly (programme and organisers: the source check below). */
const BACK_SECTIONS: [string, string][] = [
  ['venue', 'org-detail-venue'], ['basics', 'org-detail-name'], ['about', 'org-detail-save'], ['tickets', 'org-detail-save'],
  ['payment', 'org-detail-save'], ['dates', 'add-day-row'], ['cover', 'cover-input'],
];

describe('Back on the editor a go-live row opens keeps the way to the event (review fix)', () => {
  it.each(BACK_SECTIONS)('%s', async (section, loaded) => {
    mount(goLiveFixHref(section, A) as string, routes);
    // The screen itself, not its loading frame.
    await screen.findAllByTestId(loaded);
    const back = (await screen.findByTestId('org-back')).getAttribute('href') ?? '';
    expect(back === EVENT || back.includes(`returnTo=${encodeURIComponent(EVENT)}`)).toBe(true);
  });
});

describe('Done names only where its button goes', () => {
  it('a returnTo that is not an event reads "Go back" and goes there', async () => {
    mount(withReturnTo(detailEditPath(A, 'about'), ORG_PATHS.events), routes);
    await type('A friendly social with a class first.');
    await save();
    const back = await screen.findByTestId('org-done-back', {}, { timeout: 3000 });
    expect(back.textContent).toBe(GO_BACK_LABEL);
  });

  it('Done itself is never the way back', () => {
    expect(readDoneState({ title: 'Saved', message: 'Saved', seriesId: A, back: ORG_PATHS.done })).not.toHaveProperty('back');
  });
});

describe('without a returnTo, or with an unsafe one, Done is unchanged', () => {
  const UNSAFE: [string, string][] = [
    ['no returnTo', detailEditPath(A, 'about')],
    ['an external URL', withReturnTo(detailEditPath(A, 'about'), 'https://evil.example/x')],
    ['protocol-relative //evil', withReturnTo(detailEditPath(A, 'about'), '//evil.example')],
    ['backslash /\\evil', withReturnTo(detailEditPath(A, 'about'), '/\\evil.example')],
  ];
  it.each(UNSAFE)('%s: Back to Home is the only primary, no way to the returnTo', async (_n, path) => {
    mount(path, routes);
    await type('A friendly social with a class first.');
    await save();
    await screen.findByTestId('org-done', {}, { timeout: 3000 });
    expect(screen.queryByTestId('org-done-back')).toBeNull();
    expect(doneButtons()[0]).toBe('Back to Home');
  });

  it('a crafted router state with an unsafe back is dropped', () => {
    for (const back of ['//evil.example', 'https://evil.example', '/\\evil', 'javascript:alert(1)']) {
      expect(readDoneState({ title: 'Saved', message: 'Saved', seriesId: A, back })).not.toHaveProperty('back');
    }
    expect(readDoneState({ title: 'Saved', message: 'Saved', seriesId: A, back: EVENT })).toMatchObject({ back: EVENT });
  });

  it('the details list keeps the returnTo on the rows it opens', async () => {
    mount(withReturnTo(ORG_PATHS.eventDetails(A), EVENT), routes);
    expect((await screen.findByTestId('org-detail-name')).getAttribute('href')).toContain(`returnTo=${encodeURIComponent(EVENT)}`);
    expect(screen.getByTestId('org-detail-cover').getAttribute('href')).toContain(`returnTo=${encodeURIComponent(EVENT)}`);
  });

  it('the day list keeps the returnTo on the day it opens', async () => {
    mount(withReturnTo(ORG_PATHS.addEvent(A), EVENT), routes);
    const rows = await screen.findAllByTestId('add-day-row');
    fireEvent.click(rows.find((r) => r.textContent?.includes('Tuesday 27 October')) as HTMLElement);
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe(withReturnTo(ORG_PATHS.addDate(A, day(7)), EVENT)));
  });
});

describe('the programme and organisers screens save through the one send', () => {
  it.each(['src/modules/organiser/events/ProgrammeSeries.tsx', 'src/modules/organiser/events/SeriesOrganisers.tsx'])('%s', (file) => {
    const src = readFileSync(file, 'utf8');
    expect(src).toMatch(/useEventSend\(/);
    expect(src).not.toMatch(/goDone\(/);
    // Its Back keeps the returnTo too.
    expect(src).toMatch(/keepReturnTo\(ORG_PATHS\.eventDetails\(seriesId\), search\)/);
  });
});
