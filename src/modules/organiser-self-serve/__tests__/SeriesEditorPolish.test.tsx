// @vitest-environment jsdom
/**
 * The series editor's polish pass: saved feedback in the sticky bar, controls
 * that name their date, focus that follows the pause / archive / remove
 * questions instead of dropping to the page, and review strip wording.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn() } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));
vi.mock('../components/VenuePicker', () => ({ VenuePicker: () => null }));
vi.mock('../components/publicVenues', () => ({ useVenueOptions: () => ({ data: [] }), venueName: () => null }));

import { SeriesEditor } from '../components/SeriesEditor';
import { TeamPanel } from '../components/TeamPanel';
import type { HomeOrganiser } from '../selfServeApi';
import type { SeriesWorkspace, WorkspaceSeries } from '../seriesModel';

const series = (status: string, venue: string | null = 'v1') => ({
  id: 's1', name: 'Thursday Party', slug: 'thursday-party', format: 'recurring', category: 'party',
  lifecycle_status: status, version: 3, default_venue_id: venue, default_local_start_time: '20:00:00',
  default_duration: '02:00:00', default_level: null, default_ticket_url: null, default_description: null,
  default_cover_image_url: null, default_start_date: null, instagram_url: null, passes: null, created_at: null,
  recurrence_rule: null, removed_dates: [],
}) as WorkspaceSeries;
const date = { id: 'o1', occurrence_date: '2026-10-08', lifecycle_status: 'scheduled', version: 1, has_override: false, session_overrides_count: 0, added_sessions_count: 0, materialised_start_utc: '2026-10-08T20:00:00Z' };
const workspace = (status = 'live', venue: string | null = 'v1'): SeriesWorkspace => ({ series: series(status, venue), hasSessions: false, dates: [date] });

let client: QueryClient;
const tree = (ui: ReactNode) => <QueryClientProvider client={client}><MemoryRouter>{ui}</MemoryRouter></QueryClientProvider>;
const wrap = (ui: ReactNode) => {
  client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(tree(ui));
};
const mount = (status = 'live', venue: string | null = 'v1') => wrap(<SeriesEditor workspace={workspace(status, venue)} today="2026-10-07" />);
const focused = () => document.activeElement?.getAttribute('data-testid');

beforeEach(() => {
  rpc.mockReset();
  rpc.mockResolvedValue({ data: { ok: true, new_version: 4 }, error: null });
});
afterEach(cleanup);

describe('SeriesEditor polish', () => {
  it('after a save and the reload, the form is clean: Saved in the bar, no leave warning', async () => {
    const view = mount();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Thursday Bachata Party' } });
    fireEvent.click(screen.getByTestId('basics-save'));
    await screen.findByTestId('series-confirmation');
    await waitFor(() => expect(screen.getByTestId('basics-save').textContent).toBe('Save for every date'));
    // The page reloads the workspace after a save; the form then matches it.
    const saved = workspace();
    saved.series = { ...saved.series, name: 'Thursday Bachata Party', version: 4 };
    view.rerender(tree(<SeriesEditor workspace={saved} today="2026-10-07" />));
    await screen.findByTestId('basics-saved');
    expect(screen.queryByTestId('basics-unsaved')).toBeNull();
    expect((screen.getByTestId('basics-save') as HTMLButtonElement).disabled).toBe(true);
    const leave = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leave);
    expect(leave.defaultPrevented).toBe(false);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Thursday Bachata' } });
    expect(screen.queryByTestId('basics-saved')).toBeNull();
    expect(screen.getByTestId('basics-unsaved')).toBeTruthy();
  });

  it('text fields are a literal 16px (the fluid root makes text-base 13.5px, and landscape phones pass md)', () => {
    mount();
    for (const id of ['series-name', 'series-start', 'series-end', 'series-description', 'series-ticket', 'series-cover', 'add-date']) {
      const cls = document.getElementById(id)?.className ?? '';
      expect(cls).toContain('text-[16px]');
      expect(cls).not.toContain('md:text-sm');
      expect(cls).not.toMatch(/(^|\s)text-sm(\s|$)/);
    }
  });

  it('a save makes the form clean at once, before the reload lands', async () => {
    mount();
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Thursday Bachata Party' } });
    fireEvent.click(screen.getByTestId('basics-save'));
    await screen.findByTestId('basics-saved');
    expect(screen.queryByTestId('basics-unsaved')).toBeNull();
    expect((screen.getByTestId('basics-save') as HTMLButtonElement).disabled).toBe(true);
  });

  it('each Change button names its date, and the add button says what it adds', () => {
    mount();
    expect(screen.getByTestId('date-open').getAttribute('aria-label')).toBe('Change Thu 8 Oct');
    expect(screen.getByTestId('add-date-submit').textContent).toContain('Add date');
  });

  it('focus moves into the archive question and back to Archive on "No, keep it"', async () => {
    mount();
    fireEvent.click(screen.getByTestId('lifecycle-archived'));
    await waitFor(() => expect(focused()).toBe('confirm-keep'));
    fireEvent.click(screen.getByTestId('confirm-keep'));
    await waitFor(() => expect(focused()).toBe('lifecycle-archived'));
  });

  it('after a pause the result at the top takes focus', async () => {
    mount();
    fireEvent.click(screen.getByTestId('lifecycle-paused'));
    fireEvent.click(await screen.findByTestId('confirm-go'));
    await waitFor(() => expect(focused()).toBe('series-confirmation'));
  });

  it('the status heading names only what this event offers', () => {
    mount('draft');
    expect(screen.getByTestId('series-status').querySelector('h2')?.textContent).toBe('Archive');
    cleanup();
    mount('paused');
    expect(screen.getByTestId('series-status').querySelector('h2')?.textContent).toBe('Resume or archive');
  });

  it('a draft with no venue explains the off button right under it, and the button points at it', () => {
    mount('draft', null);
    const submit = screen.getByTestId('review-submit');
    expect(submit.getAttribute('aria-describedby')).toBe('review-missing');
    expect(document.getElementById('review-missing')?.textContent).toMatch(/add a venue/);
  });

  it('the review steps say their state in words', () => {
    mount('live');
    const live = screen.getAllByTestId('review-step').find((s) => s.dataset.step === 'live')!;
    expect(live.getAttribute('aria-current')).toBe('step');
    expect(live.textContent).toContain('you are here');
  });

  it('an archived event has no "once it is live" note', () => {
    mount('archived');
    expect(screen.queryByTestId('review-preview-note')).toBeNull();
    expect(screen.getByTestId('review-strip').textContent).toMatch(/Ask the Bachata Calendar team/);
  });
});

describe('TeamPanel remove question', () => {
  const organiser = {
    id: 'org1', name: 'Ritmo', role: 'owner',
    team: [
      { user_id: 'u1', member_role: 'owner', is_primary: true, is_self: true, email: 'me@example.com', display_name: 'Me' },
      { user_id: 'u2', member_role: 'manager', is_primary: false, is_self: false, email: 'ana@example.com', display_name: 'Ana' },
    ],
  } as unknown as HomeOrganiser;

  it('moves focus to "No, keep them" and back to Remove, with the red button saying what it does', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    wrap(<TeamPanel organiser={organiser} />);
    fireEvent.click(screen.getByTestId('member-remove'));
    await waitFor(() => expect(focused()).toBe('member-confirm-no'));
    expect(screen.getByTestId('member-confirm-no').textContent).toBe('No, keep them');
    expect(screen.getByTestId('member-confirm-yes').textContent).toContain('Yes, remove');
    fireEvent.click(screen.getByTestId('member-confirm-no'));
    await waitFor(() => expect(focused()).toBe('member-remove'));
  });
});

describe('an archived event', () => {
  it('is shown but cannot be changed: no Change, Add date or save; dates still listed', () => {
    mount('archived');
    expect((screen.getByTestId('series-edit-area') as HTMLFieldSetElement).disabled).toBe(true);
    expect(screen.getByTestId('archived-note').textContent).toMatch(/cannot be changed/);
    expect(screen.queryByTestId('scope-note')).toBeNull();
    expect(screen.getAllByTestId('series-date-row')).toHaveLength(1);
    expect(screen.queryByTestId('date-open')).toBeNull();
    expect(screen.queryByTestId('add-date-submit')).toBeNull();
    expect(screen.getByTestId('series-dates').textContent).not.toMatch(/tap Change/);
  });

  it('archiving drops typing not saved: the saved name shows, and leaving never asks', () => {
    const view = mount('live');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Typed but not saved' } });
    view.rerender(tree(<SeriesEditor workspace={workspace('archived')} today="2026-10-07" />));
    expect((screen.getByLabelText('Name') as HTMLInputElement).value).toBe('Thursday Party');
    const leave = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(leave);
    expect(leave.defaultPrevented).toBe(false);
  });

  it('a live event stays editable', () => {
    mount('live');
    expect((screen.getByTestId('series-edit-area') as HTMLFieldSetElement).disabled).toBe(false);
  });
});

describe('the form and a reload', () => {
  it('keeps a cleared end time when the workspace reloads unchanged', () => {
    const view = mount('live');
    fireEvent.change(screen.getByLabelText('Ends'), { target: { value: '' } });
    view.rerender(tree(<SeriesEditor workspace={{ ...workspace('live'), series: { ...series('live') } }} today="2026-10-07" />));
    expect((screen.getByLabelText('Ends') as HTMLInputElement).value).toBe('');
  });
});
