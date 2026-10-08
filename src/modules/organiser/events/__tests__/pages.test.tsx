// @vitest-environment jsdom
/**
 * W2 screens: the events list, the name-only create, and the event editor
 * (every row's edit path, the 30-date cap UI, the preview bar, save failure).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TODAY, home, programme, rawWorkspace, venues } from './fixtures';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c-edinburgh' }) }));

import EventsPage from '../index';
import NewEventPage from '../NewEventPage';
import EventEditorPage from '../EventEditorPage';
import { LIVE_NOTE } from '../../ui';

type Handler = (args: Record<string, unknown>) => unknown;
let handlers: Record<string, Handler>;
const commands = () => rpc.mock.calls.filter(([fn]) => fn === 'series_command_p5').map(([, a]) => (a as { p_envelope: { command: { kind: string; payload: Record<string, unknown> }; expected_version?: number } }).p_envelope);

beforeEach(() => {
  let workspace = rawWorkspace();
  handlers = {
    organiser_home_v1: () => home(),
    admin_event_workspace_p5: () => workspace,
    organiser_get_occurrence_programme_v1: () => programme,
    get_organiser_venue_options_v1: () => venues,
    series_command_p5: () => ({ ok: true, new_version: 4 }),
  };
  (globalThis as { setWorkspace?: (w: ReturnType<typeof rawWorkspace>) => void }).setWorkspace = (w) => { workspace = w; };
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    const h = handlers[fn];
    if (!h) return { data: null, error: { message: `unexpected ${fn}` } };
    try { return { data: await h(args), error: null }; } catch (e) { return { data: null, error: e }; }
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
          <Route path="/account/o/events/new" element={<NewEventPage />} />
          <Route path="/account/o/events/:seriesId" element={<EventEditorPage />} />
          <Route path="*" element={<span />} />
        </Routes>
        <Where />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const editor = async () => {
  mount('/account/o/events/s1');
  return screen.findByTestId('org-event-editor');
};
const save = () => fireEvent.click(screen.getByTestId('org-preview-bar-action'));
const sheet = () => screen.getByTestId('org-editor-sheet');

describe('events list', () => {
  it('lists each series with Live/Draft, the next date and the venue', async () => {
    mount('/account/o/events');
    const rows = await screen.findAllByTestId('org-event-row');
    expect(rows.map((r) => r.getAttribute('data-series-id'))).toEqual(['s2', 's1']);
    const live = rows[1];
    expect(within(live).getByTestId('org-event-row-status').textContent).toBe('Live');
    expect(within(live).getByTestId('org-event-row-venue').textContent).toContain('Studio One');
    expect(within(rows[0]).getByTestId('org-event-row-status').textContent).toBe('Draft');
    expect(within(rows[0]).getByTestId('org-event-row-venue').textContent).toBe('No upcoming dates');
    expect(live.getAttribute('href')).toBe('/account/o/events/s1');
  });

  it('shows the empty state with the one New event button', async () => {
    handlers.organiser_home_v1 = () => home([]);
    mount('/account/o/events');
    expect(await screen.findByTestId('org-events-empty')).toBeTruthy();
    fireEvent.click(screen.getByTestId('org-events-new'));
    expect(screen.getByTestId('where').textContent).toBe('/account/o/events/new');
  });

  it('shows an error state with retry', async () => {
    handlers.organiser_home_v1 = () => { throw { message: 'boom' }; };
    mount('/account/o/events');
    expect(await screen.findByTestId('org-events-error')).toBeTruthy();
  });
});

describe('new event (name only)', () => {
  it('creates the draft with defaults at once, lists the first 8 dates, then opens the editor', async () => {
    mount('/account/o/events/new');
    const name = await screen.findByTestId('org-new-event-name');
    fireEvent.change(name, { target: { value: 'Tuesday Class' } });
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/^\/account\/o\/events\/[0-9a-f-]{36}$/));
    const [create, rule] = commands();
    expect(create.command.kind).toBe('series.upsert');
    expect(create.command.payload).toMatchObject({ name: 'Tuesday Class', format: 'recurring', default_start_date: '2026-10-15', timezone: 'Europe/London', default_city_id: 'c1' });
    expect(Object.keys(create.command.payload)).not.toContain('default_venue_id');
    expect(rule.command).toEqual({ kind: 'series.set_recurrence', payload: { mode: 'weekly', weekdays: [4], end: { kind: 'until_date', date: '2026-12-03' } } });
    expect(rule.expected_version).toBe(4);
  });

  it('asks for a name instead of sending a blank one', async () => {
    mount('/account/o/events/new');
    fireEvent.click(await screen.findByTestId('org-new-event-create'));
    expect((await screen.findByTestId('org-new-event-error')).textContent).toBe('Give your event a name.');
    expect(commands()).toHaveLength(0);
  });

  it('shows the plain server message when the create is refused', async () => {
    handlers.series_command_p5 = () => { throw { message: 'permission_denied: series.upsert (create) needs a live organiser', code: 'P0001' }; };
    mount('/account/o/events/new');
    fireEvent.change(await screen.findByTestId('org-new-event-name'), { target: { value: 'X' } });
    fireEvent.click(screen.getByTestId('org-new-event-create'));
    expect((await screen.findByTestId('org-new-event-error')).textContent).not.toMatch(/permission_denied/);
  });
});

describe('event editor', () => {
  it('shows only the owner-ticked rows, in order', async () => {
    const el = await editor();
    const text = el.textContent ?? '';
    for (const word of ['price', 'Price', 'capacity', 'Capacity', 'approval', 'Approval', 'Timezone', 'Instagram', 'Level', 'Start time', 'Duration']) {
      expect(text).not.toContain(word);
    }
    const ids = [...el.querySelectorAll('[data-testid^="org-row-"], [data-testid="org-event-name"], [data-testid="org-cover"], [data-testid="org-schedule"], [data-testid="org-styles"], [data-testid="org-dates"]')]
      .map((n) => n.getAttribute('data-testid'))
      .filter((id) => !id?.endsWith('-value') && !id?.endsWith('-open'));
    expect(ids).toEqual([
      'org-cover', 'org-row-gallery', 'org-row-video', 'org-event-name', 'org-row-starts', 'org-row-repeats', 'org-row-until',
      'org-schedule', 'org-row-venue', 'org-row-organisers', 'org-row-description', 'org-styles', 'org-row-ticket', 'org-dates',
    ]);
  });

  it('the schedule card shows the next date\u2019s sessions with their people, read-only, and opens the date', async () => {
    await editor();
    const rows = await screen.findAllByTestId('org-schedule-session');
    expect(rows[0].textContent).toContain('Class: Beginners');
    expect(rows[0].textContent).toContain('Ana Ruiz, Cleo Park');
    expect(rows[0].textContent).toContain('20:00\u201321:00');
    expect(rows[1].textContent).toContain('DJ Sol');
    fireEvent.click(rows[0]);
    expect(screen.getByTestId('where').textContent).toBe('/account/o/events/s1/dates/o1');
  });

  it('shows the organisers of the event', async () => {
    await editor();
    await waitFor(() => expect(screen.getByTestId('org-row-organisers-value').textContent).toBe('Latin Nights'));
  });

  it('lists upcoming dates and keeps past dates collapsed', async () => {
    await editor();
    const dates = screen.getAllByTestId('org-date-row').map((r) => r.getAttribute('data-date'));
    expect(dates).toEqual(['2026-10-09', '2026-10-16']);
    fireEvent.click(screen.getByTestId('org-dates-past-toggle'));
    expect(await screen.findByTestId('org-dates-past')).toBeTruthy();
    fireEvent.click(screen.getAllByTestId('org-date-row')[0]);
    expect(screen.getByTestId('where').textContent).toBe('/account/o/events/s1/dates/o1');
  });

  it('the preview bar shows the public card, ONE primary button and the live note', async () => {
    await editor();
    const bar = screen.getByTestId('org-preview-bar');
    expect(within(bar).getByTestId('org-card-preview').textContent).toContain('Friday Party');
    expect(within(bar).getByTestId('org-card-preview').textContent).toContain('Fri 9 Oct');
    expect(bar.textContent).toContain(LIVE_NOTE);
    expect((screen.getByTestId('org-preview-bar-action') as HTMLButtonElement).disabled).toBe(true);
    expect(document.querySelectorAll('.bg-\\[var\\(--btn\\)\\]:not([aria-label])').length).toBe(1);
  });

  it('a draft event shows no live note', async () => {
    handlers.admin_event_workspace_p5 = () => rawWorkspace({ lifecycle_status: 'draft' });
    await editor();
    expect(screen.getByTestId('org-preview-bar').textContent).not.toContain(LIVE_NOTE);
  });

  it('name: edits in the big title, previews, and saves only the name', async () => {
    await editor();
    fireEvent.change(screen.getByTestId('org-event-name'), { target: { value: 'Friday Fiesta' } });
    expect(screen.getByTestId('org-card-preview').textContent).toContain('Friday Fiesta');
    save();
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0]).toMatchObject({ expected_version: 3, command: { kind: 'series.upsert', payload: { name: 'Friday Fiesta' } } });
  });

  it('description and ticket link: edited in the sheet and saved', async () => {
    await editor();
    fireEvent.click(screen.getByTestId('org-row-description'));
    fireEvent.change(await screen.findByTestId('org-description-input'), { target: { value: 'Beginners welcome' } });
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    fireEvent.click(screen.getByTestId('org-row-ticket'));
    fireEvent.change(await screen.findByTestId('org-ticket-input'), { target: { value: 'https://tickets.example/x' } });
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    save();
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0].command.payload).toEqual({ name: 'Friday Party', default_description: 'Beginners welcome', default_ticket_url: 'https://tickets.example/x' });
  });

  it('place: the sheet has a search view; picking sets the venue and its city', async () => {
    await editor();
    await waitFor(() => expect(screen.getByTestId('org-row-venue-value').textContent).toBe('Studio One'));
    fireEvent.click(screen.getByTestId('org-row-venue'));
    fireEvent.click(await screen.findByTestId('org-venue-search-open'));
    fireEvent.change(await screen.findByTestId('org-venue-query'), { target: { value: 'salsa' } });
    const results = within(sheet()).getAllByTestId('org-venue-result');
    expect(results).toHaveLength(1);
    fireEvent.click(results[0]);
    expect(await screen.findByTestId('org-sheet-venue')).toBeTruthy();
    expect(document.querySelectorAll('[role="dialog"]')).toHaveLength(1);
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    save();
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0].command.payload).toEqual({ name: 'Friday Party', default_venue_id: 'v2', default_city_id: 'c-edinburgh' });
  });

  it('music styles: tap chips', async () => {
    await editor();
    const chips = screen.getAllByTestId('org-style-chip');
    const salsa = chips.find((c) => c.textContent?.includes('Salsa') && !c.textContent.includes('Bachata'))!;
    fireEvent.click(salsa);
    expect(salsa.getAttribute('aria-pressed')).toBe('true');
    save();
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0].command.payload).toEqual({ name: 'Friday Party', default_music_styles: ['Bachata', 'Salsa'] });
  });

  it('gallery and video: summary rows open the sheet; remove a photo, add a video', async () => {
    await editor();
    expect(screen.getByTestId('org-row-gallery-value').textContent).toBe('1 photo');
    fireEvent.click(screen.getByTestId('org-row-gallery'));
    fireEvent.click(await screen.findByTestId('org-gallery-remove'));
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    fireEvent.click(screen.getByTestId('org-row-video'));
    fireEvent.change(await screen.findByTestId('org-video-input'), { target: { value: 'https://youtu.be/abc' } });
    fireEvent.click(screen.getByTestId('org-video-add'));
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    save();
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0].command.payload).toEqual({ name: 'Friday Party', default_gallery: [], default_video_urls: ['https://youtu.be/abc'] });
  });

  it('dates: Listed until shows the cap, offers only choices within 30, and Extend adds the next 8', async () => {
    await editor();
    expect(screen.getByTestId('org-row-until').textContent).toContain('Listed until Fri 27 Nov');
    expect(screen.getByTestId('org-row-until').textContent).toContain('Up to 30 upcoming dates');
    fireEvent.click(screen.getByTestId('org-row-until-open'));
    const choices = within(await screen.findByTestId('org-sheet-until')).getAllByTestId('org-until-choice');
    expect(choices.map((c) => c.textContent?.match(/^\d+/)?.[0])).toEqual(['4', '8', '12', '16', '26', '30']);
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    fireEvent.click(screen.getByTestId('org-extend'));
    expect(screen.getByTestId('org-row-until').textContent).toContain('Listed until Fri 22 Jan');
    save();
    await waitFor(() => expect(commands()).toHaveLength(1));
    expect(commands()[0].command).toEqual({ kind: 'series.set_recurrence', payload: { mode: 'weekly', weekdays: [5], end: { kind: 'until_date', date: '2027-01-22' } } });
  });

  it('Extend is off at 30 upcoming dates', async () => {
    handlers.admin_event_workspace_p5 = () => rawWorkspace({ recurrence_rule: { mode: 'weekly', weekdays: [5], end: { kind: 'until_date', date: '2027-04-30' } } });
    await editor();
    expect((screen.getByTestId('org-extend') as HTMLButtonElement).disabled).toBe(true);
  });

  it('starts on + repeats: moving the start re-picks an end inside the cap; one date stops repeating', async () => {
    await editor();
    fireEvent.click(screen.getByTestId('org-row-starts'));
    fireEvent.change(await screen.findByTestId('org-starts-input'), { target: { value: '2026-10-13' } });
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    expect(screen.getByTestId('org-row-repeats-value').textContent).toBe('Every Tuesday');
    fireEvent.click(screen.getByTestId('org-row-repeats'));
    fireEvent.click(await screen.findByTestId('org-shape-single'));
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    expect(screen.getByTestId('org-row-repeats-value').textContent).toBe('One date');
    save();
    await waitFor(() => expect(commands().length).toBeGreaterThanOrEqual(2));
    expect(commands().map((c) => c.command.kind)).toEqual(['series.upsert', 'series.stop_repeating', 'series.add_date']);
    expect(commands()[0].command.payload).toEqual({ name: 'Friday Party', default_start_date: '2026-10-13' });
    expect(commands()[1].expected_version).toBe(4);
  });

  it('a failed save shakes and shows the plain message; the edit stays', async () => {
    handlers.series_command_p5 = () => { throw { message: 'version_conflict: stale', code: 'P0001' }; };
    await editor();
    fireEvent.change(screen.getByTestId('org-event-name'), { target: { value: 'Friday Fiesta' } });
    save();
    const msg = await screen.findByTestId('org-save-error');
    expect(msg.textContent).not.toMatch(/version_conflict/);
    expect(msg.textContent!.length).toBeGreaterThan(10);
    expect((screen.getByTestId('org-event-name') as HTMLInputElement).value).toBe('Friday Fiesta');
  });

  it('reads the current value before overwriting: a field changed elsewhere is not overwritten', async () => {
    await editor();
    fireEvent.click(screen.getByTestId('org-row-description'));
    fireEvent.change(await screen.findByTestId('org-description-input'), { target: { value: 'Mine' } });
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    (globalThis as { setWorkspace?: (w: ReturnType<typeof rawWorkspace>) => void }).setWorkspace!(rawWorkspace({ default_description: 'Theirs', version: 5 }));
    save();
    expect((await screen.findByTestId('org-save-error')).textContent).toMatch(/Someone else changed the description/);
    expect(commands()).toHaveLength(0);
  });

  it('asks before leaving with unsaved changes', async () => {
    await editor();
    fireEvent.change(screen.getByTestId('org-event-name'), { target: { value: 'Changed' } });
    const ev = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(ev);
    expect(ev.defaultPrevented).toBe(true);
  });

  it('loading shows skeleton rows; a load failure shows retry', async () => {
    handlers.admin_event_workspace_p5 = () => { throw { message: 'permission_denied' }; };
    mount('/account/o/events/s1');
    expect(screen.getByTestId('org-editor-loading')).toBeTruthy();
    expect(await screen.findByTestId('org-editor-error')).toBeTruthy();
  });
});

void TODAY;
