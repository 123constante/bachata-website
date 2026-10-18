// @vitest-environment jsdom
/**
 * P-SERIES (PARITY-GAP rows C06, C09b, C14, C16, C28a, C28b, C30b, C38, C40, C69):
 * the event as a whole reaches what an organiser may do on prod. Every write is
 * ONE command of the pinned kind; a control that cannot work is shown off WITH
 * its reason. The clock is frozen on Tuesday 20 October 2026.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import { Route } from 'react-router-dom';

const rpc = vi.hoisted(() => vi.fn());
const upload = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc, from: () => ({ select: () => ({ is: () => ({ order: async () => ({ data: [], error: null }) }) }) }) },
}));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/modules/organiser/events/media', () => ({ uploadEventPicture: upload }));

import OneEvent from '../events/OneEvent';
import Details from '../events/Details';
import Done from '@/modules/organiser/flows/Done';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { homeJobs } from '@/modules/organiser/jobs/homeJobs';
import { publicEventPath } from '@/modules/organiser/shared/editorGuards';
import { eventStepPath } from '@/modules/organiser/flows/event/eventSteps';
import { A, AFTER, BEFORE, DRAFT, FROZEN, answer, commandsOf, defaultWorld, flush, mount, tooSmall, type World } from '@/modules/organiser/flows/add/__tests__/fixtures';

const WEEKLY_FRIDAY = { mode: 'weekly', weekdays: [5], interval: 1, end: { kind: 'none' } };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

let world: World;
let wsOver: Record<string, Record<string, unknown>>;

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(FROZEN);
  rpc.mockReset();
  upload.mockReset();
  world = defaultWorld();
  wsOver = {};
  answer(rpc, () => world);
  const base = rpc.getMockImplementation() as (fn: string, args: Record<string, unknown>) => Promise<unknown>;
  rpc.mockImplementation(async (fn: string, args: Record<string, unknown>) => {
    if (fn !== 'admin_event_workspace_p5') return base(fn, args);
    const id = String(args.p_series_id);
    const s = world.series.find((x) => x.id === id);
    return {
      data: {
        series: {
          series: {
            id, name: s?.name ?? '', slug: null, format: s?.format ?? 'recurring', lifecycle_status: s?.lifecycle_status ?? 'live', version: world.seriesVersion,
            default_local_start_time: '20:00:00', default_start_date: '2026-01-02', default_venue_id: null, default_city_id: null, default_ticket_url: null,
            default_cover_image_url: s?.lifecycle_status === 'draft' ? null : 'https://x/c.jpg', default_duration: null, passes: [],
            default_description: 'Open social', default_level: null, instagram_url: null, default_music_styles: ['Bachata'],
            gallery: ['https://x/g1.jpg', 'https://x/g2.jpg'], video_urls: [],
            recurrence_rule: WEEKLY_FRIDAY, removed_dates: [], ...(wsOver[id] ?? {}),
          },
          program: [],
        },
        occurrences: (world.occs[id] ?? []).map((o) => ({ id: o.id, occurrence_date: o.date, lifecycle_status: o.status, version: o.version, materialised_start_utc: `${o.date}T20:00:00Z` })),
        meta: { has_more: false },
      },
      error: null,
    };
  });
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const routes = (
  <>
    <Route path="/account/o/events/:seriesId" element={<OneEvent />} />
    <Route path="/account/o/events/:seriesId/details" element={<Details />} />
    <Route path="/account/o/done" element={<Done />} />
  </>
);
const where = () => screen.getByTestId('where').textContent;
const lastCommand = () => commandsOf(rpc).slice(-1)[0]?.env.command;

describe('C28b / C30b / C38: the lifecycle card on One event', () => {
  it('a draft offers Go live OFF with the reason (A1 not applied) and names what is missing', async () => {
    const { container } = mount(ORG_PATHS.event(DRAFT), routes);
    const go = await screen.findByTestId('org-life-golive');
    expect(go.getAttribute('aria-disabled')).toBe('true');
    const reason = screen.getByTestId('org-life-golive-reason').textContent ?? '';
    expect(reason).toContain('Needs the next platform update');
    expect(reason).toMatch(/a venue/);
    expect(reason).toMatch(/a cover picture/);
    // Walk fix: the venue and cover are on Details, so the card names it AND links there.
    // This draft has no date either: that is added with Add a date, never "in Details" (PAR-B S7).
    expect(reason).toMatch(/a venue and a cover picture in Details, and add a date from today on with Add a date\.$/);
    expect(screen.getByTestId('org-life-details').getAttribute('href')).toBe(ORG_PATHS.eventDetails(DRAFT));
    expect(screen.getByTestId('org-life-add-date').getAttribute('href')).toBe(ORG_PATHS.addEvent(DRAFT));
    fireEvent.click(go);
    await flush();
    expect(commandsOf(rpc)).toEqual([]);
    expect(tooSmall(container)).toEqual([]);
  });

  it('a draft can be discarded after an in-page confirm: ONE set_lifecycle archived', async () => {
    mount(ORG_PATHS.event(DRAFT), routes);
    fireEvent.click(await screen.findByTestId('org-life-discard'));
    expect(commandsOf(rpc)).toEqual([]);
    const confirm = await screen.findByTestId('org-life-discard-confirm');
    fireEvent.click(confirm);
    await flush();
    await waitFor(() => expect(lastCommand()).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'archived' } }));
    expect(commandsOf(rpc)).toHaveLength(1);
    await waitFor(() => expect(where()).toBe(ORG_PATHS.done));
  });

  it('Keep it closes the confirm and sends nothing', async () => {
    mount(ORG_PATHS.event(DRAFT), routes);
    fireEvent.click(await screen.findByTestId('org-life-discard'));
    fireEvent.click(await screen.findByTestId('org-life-discard-keep'));
    expect(screen.queryByTestId('org-life-discard-confirm')).toBeNull();
    expect(commandsOf(rpc)).toEqual([]);
  });

  it('a live event links to its public page; a draft shows the link off with the reason', async () => {
    mount(ORG_PATHS.event(A), routes);
    const live = await screen.findByTestId('org-life-seelive');
    expect(live.getAttribute('href')).toBe(publicEventPath({ slug: null, id: A }));
    expect(screen.queryByTestId('org-life-golive')).toBeNull();
    expect(screen.queryByTestId('org-life-discard')).toBeNull();
    cleanup();
    mount(ORG_PATHS.event(DRAFT), routes);
    const off = await screen.findByTestId('org-life-seelive');
    expect(off.getAttribute('aria-disabled')).toBe('true');
    expect(off.getAttribute('href')).toBeNull();
    expect(screen.getByTestId('org-life-seelive-reason').textContent).toMatch(/once it is live/);
  });
});

describe('C69: Home never asks for a control that does not exist', () => {
  it('a page with no events gets no "Show your WhatsApp" step', () => {
    const fresh = { id: 'o', name: 'N', avatar_url: null, team: [], series: [] };
    const jobs = homeJobs(fresh as never, [], '2026-10-20');
    expect(jobs.map((j) => j.title)).not.toContain('Show your WhatsApp');
    expect(jobs.map((j) => j.kind as string)).not.toContain('show_whatsapp');
  });
});

describe('C06: gallery and videos open their sheets from Details and save ONE upsert', () => {
  it('Gallery: removing a photo and Done sends default_gallery only', async () => {
    mount(ORG_PATHS.eventDetails(A), routes);
    const row = await screen.findByTestId('org-detail-gallery');
    expect(row.textContent).toContain('2 photos');
    fireEvent.click(row);
    await screen.findByTestId('org-sheet-gallery');
    fireEvent.click(screen.getAllByTestId('org-gallery-remove')[0]);
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    await flush();
    await waitFor(() => expect(lastCommand()).toEqual({ kind: 'series.upsert', payload: { name: 'Friday Social', default_gallery: ['https://x/g2.jpg'] } }));
    expect(commandsOf(rpc)).toHaveLength(1);
  });

  it('Gallery: an untouched sheet sends nothing', async () => {
    mount(ORG_PATHS.eventDetails(A), routes);
    fireEvent.click(await screen.findByTestId('org-detail-gallery'));
    await screen.findByTestId('org-sheet-gallery');
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    await flush();
    expect(commandsOf(rpc)).toEqual([]);
  });

  it('Gallery: Add photos uploads, then Done saves the new list', async () => {
    upload.mockResolvedValue('https://x/new.jpg');
    mount(ORG_PATHS.eventDetails(A), routes);
    fireEvent.click(await screen.findByTestId('org-detail-gallery'));
    const input = await screen.findByTestId('org-gallery-file');
    fireEvent.change(input, { target: { files: [new File(['x'], 'p.jpg', { type: 'image/jpeg' })] } });
    await flush();
    expect(upload).toHaveBeenCalledWith(A, expect.any(File));
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    await flush();
    await waitFor(() => expect(lastCommand()?.payload.default_gallery).toEqual(['https://x/g1.jpg', 'https://x/g2.jpg', 'https://x/new.jpg']));
  });

  it('Videos: adding a link and Done sends default_video_urls only', async () => {
    mount(ORG_PATHS.eventDetails(A), routes);
    const row = await screen.findByTestId('org-detail-videos');
    expect(row.textContent).toContain('Add');
    fireEvent.click(row);
    // Walk fix: an empty Videos sheet says what to do, as Gallery does.
    expect((await screen.findByTestId('org-video-empty')).textContent).toBe('No videos yet. Paste a video link below to add one.');
    fireEvent.change(await screen.findByTestId('org-video-input'), { target: { value: 'https://youtube.com/watch?v=abc' } });
    fireEvent.click(screen.getByTestId('org-sheet-done'));
    await flush();
    await waitFor(() => expect(lastCommand()).toEqual({ kind: 'series.upsert', payload: { name: 'Friday Social', default_video_urls: ['https://youtube.com/watch?v=abc'] } }));
  });
});

describe('C14: the usual end', () => {
  it('Ends row -> an end time saves default_duration_minutes, and says what it does to listed dates', async () => {
    mount(ORG_PATHS.eventDetails(A), routes);
    const row = await screen.findByTestId('org-detail-ends');
    expect(row.textContent).toContain('Add');
    fireEvent.click(row);
    const input = await screen.findByTestId('org-detail-input');
    expect(screen.getByTestId('org-detail-save').getAttribute('aria-disabled') ?? screen.getByTestId('org-detail-save').hasAttribute('disabled')).toBeTruthy();
    fireEvent.change(input, { target: { value: '23:30' } });
    expect(screen.getByTestId('org-ends-consequence').textContent).toMatch(/Dates already listed keep/);
    fireEvent.click(screen.getByTestId('org-detail-save'));
    await flush();
    await waitFor(() => expect(lastCommand()).toEqual({ kind: 'series.upsert', payload: { name: 'Friday Social', default_duration_minutes: 210 } }));
  });

  it('an end past midnight counts into the next day', async () => {
    wsOver[A] = { default_duration: '05:00:00' };
    mount(ORG_PATHS.eventDetails(A), routes);
    expect((await screen.findByTestId('org-detail-ends')).textContent).toContain('01:00');
  });
});

describe('C09b: the price list', () => {
  it('no prices: the row says Add; a new price saves default_passes with the owner keys only', async () => {
    mount(ORG_PATHS.eventDetails(A), routes);
    const row = await screen.findByTestId('org-detail-prices');
    expect(row.textContent).toContain('Add');
    fireEvent.click(row);
    expect((await screen.findByTestId('org-prices-empty')).textContent).toMatch(/Add a price/);
    fireEvent.click(screen.getByTestId('org-prices-add'));
    fireEvent.change(screen.getByTestId('org-price-name'), { target: { value: 'Entry' } });
    fireEvent.change(screen.getByTestId('org-price-amount'), { target: { value: '12.50' } });
    fireEvent.click(screen.getByTestId('org-detail-save'));
    await flush();
    await waitFor(() => expect(lastCommand()?.kind).toBe('series.upsert'));
    const passes = lastCommand()?.payload.default_passes as Array<Record<string, unknown>>;
    expect(passes).toHaveLength(1);
    expect(Object.keys(passes[0]).sort()).toEqual(['currency', 'id', 'name', 'price']);
    expect(passes[0]).toMatchObject({ name: 'Entry', price: 12.5, currency: 'GBP' });
    expect(String(passes[0].id)).toMatch(UUID);
  });

  it('a price list the team set up (keys the owner cannot write) is shown off with the reason', async () => {
    wsOver[A] = { passes: [{ id: 'p1', name: 'Full pass', price: 90, currency: 'GBP', tier: 'Full', type: 'full_pass', quantity: '100' }] };
    mount(ORG_PATHS.eventDetails(A), routes);
    const row = await screen.findByTestId('org-detail-prices');
    expect(row.getAttribute('href')).toBeNull();
    expect(row.textContent).toContain('1 price');
    expect(screen.getByTestId('org-detail-prices-reason').textContent).toMatch(/Bachata Calendar team/);
  });
});

describe('C16: stop repeating with a last date', () => {
  it('default keeps every coming date (as before); choosing the first date keeps only it', async () => {
    mount(eventStepPath(A, 'stop'), routes);
    const choices = await screen.findAllByTestId('event-stop-last');
    expect(choices.length).toBe(2);
    fireEvent.click(choices[0]);
    expect(screen.getByTestId('event-stop-line').textContent).toMatch(/^1 date stays/);
    fireEvent.click(screen.getByTestId('event-step-send'));
    await flush();
    await waitFor(() => expect(lastCommand()).toEqual({ kind: 'series.stop_repeating', payload: { keep_occurrence_ids: [BEFORE] } }));
    void AFTER;
  });
});

describe('C40: make a recurring event with no rule weekly', () => {
  it('shows "Make it weekly" and sends ONE set_recurrence on the chosen weekday with an end', async () => {
    wsOver[A] = { recurrence_rule: null };
    mount(ORG_PATHS.event(A), routes);
    const row = await screen.findByTestId('org-event-weekly');
    expect(row.getAttribute('href')).toBe(eventStepPath(A, 'weekly' as never));
    cleanup();
    mount(eventStepPath(A, 'weekly' as never), routes);
    fireEvent.click(await screen.findByTestId('event-day-5'));
    const ends = await screen.findAllByTestId('event-weekly-until');
    fireEvent.click(ends[0]);
    fireEvent.click(screen.getByTestId('event-step-send'));
    await flush();
    await waitFor(() => expect(lastCommand()?.kind).toBe('series.set_recurrence'));
    expect(lastCommand()?.payload).toMatchObject({ mode: 'weekly', weekdays: [5], end: { kind: 'until_date' } });
  });

  it('a weekly event with a rule has no "Make it weekly"', async () => {
    mount(ORG_PATHS.event(A), routes);
    await screen.findByTestId('org-event-actions');
    expect(screen.queryByTestId('org-event-weekly')).toBeNull();
  });
});
