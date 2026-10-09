// @vitest-environment jsdom
/**
 * Owner, 2026-10-08: Send for review also needs a cover image (the series poster,
 * event_series_p5.default_cover_image_url), on top of the session rule (#681):
 * disabled with the reason 'Add a cover image first.'. The cover counted is the
 * SAVED one (the team reviews what is saved; unsaved edits already block).
 *
 * Prod survey (2026-10-08, counts, read-only): every live (61), ended (20) and
 * paused (1) series has a cover; archived 41 of 658; drafts 1 with and 1 without
 * (the case this closes). A blank-after-trim cover counts as none.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TODAY, VENUES, homeOf, shapeByKey, workspaceOf } from '../../__tests__/shapes/shapes';
import { draftFromWorkspace, parseEventWorkspace } from '../eventModel';
import { upcomingDates } from '@/modules/organiser/shared/seriesModel';
import { eventReviewView, sessionDates } from '../reviewModel';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c1' }) }));

import EventEditorPage from '../EventEditorPage';

const COVER_REASON = 'Add a cover image first.';
const SESSION_REASON = 'Add at least one session first.';
type Cover = 'cover' | 'none' | 'blank';
type Sessions = 'none' | 'series-item' | 'per-date';
const COVER_VALUE: Record<Cover, string | null> = { cover: 'https://cdn.example/poster.webp', none: null, blank: '   ' };

/** admin_event_workspace_p5 for the organiser draft shape with `cover` and `sessions`. */
function rawWorkspace(cover: Cover, sessions: Sessions) {
  const raw = workspaceOf(shapeByKey('draft-norule-one'));
  raw.series.series.default_cover_image_url = COVER_VALUE[cover] as string;
  if (sessions === 'series-item') {
    (raw.series as { program: unknown }).program = [
      { sections: [{ items: [{ item: { title: 'Class', start_time: '1970-01-01T20:00:00', end_time: '1970-01-01T21:00:00' } }] }] },
    ];
  }
  if (sessions === 'per-date') raw.occurrences[0].added_sessions_count = 1;
  return raw;
}

function review(status: 'draft' | 'rejected', cover: Cover, sessions: Sessions) {
  const ws = parseEventWorkspace(rawWorkspace(cover, sessions));
  const upcoming = upcomingDates(ws.dates, TODAY);
  return eventReviewView({
    status,
    missing: [],
    upcomingListed: upcoming.filter((d) => d.lifecycle_status !== 'cancelled').length,
    datesWithSessions: sessionDates(ws.hasSessions, upcoming),
    hasCover: draftFromWorkspace(ws, TODAY).coverUrl.trim() !== '',
    organisers: [{ name: 'Org', lifecycle_status: 'live' }],
    dirty: false,
  });
}

describe('Send for review needs a cover image and a session', () => {
  const covers: Cover[] = ['cover', 'none', 'blank'];
  const sessions: Sessions[] = ['none', 'series-item', 'per-date'];
  for (const status of ['draft', 'rejected'] as const) {
    for (const c of covers) {
      it.each(sessions)(`${status}: ${c}, sessions %s`, (s) => {
        const v = review(status, c, s);
        const expected = [...(s === 'none' ? [SESSION_REASON] : []), ...(c === 'cover' ? [] : [COVER_REASON])];
        expect(v.blockers).toEqual(expected);
        expect(v.canSend).toBe(expected.length === 0);
      });
    }
  }

  it('in review, live or ended: no cover reason (the card has no button there)', () => {
    for (const status of ['pending_review', 'live', 'ended']) {
      const v = eventReviewView({ status, missing: [], upcomingListed: 1, datesWithSessions: 1, hasCover: false, organisers: [], dirty: false });
      expect(v.blockers).not.toContain(COVER_REASON);
    }
  });
});

describe('the editor shows it: Send for review is off with the reason', () => {
  let raw: ReturnType<typeof rawWorkspace>;
  beforeEach(() => {
    rpc.mockReset();
    rpc.mockImplementation(async (fn: string) => {
      const answers: Record<string, unknown> = {
        organiser_home_v1: homeOf([shapeByKey('draft-norule-one')]),
        admin_event_workspace_p5: raw,
        organiser_get_occurrence_programme_v1: null,
        get_organiser_venue_options_v1: VENUES,
        event_publish_readiness_v1: { missing: [] },
      };
      return fn in answers ? { data: answers[fn], error: null } : { data: null, error: { message: `unexpected ${fn}` } };
    });
  });
  afterEach(cleanup);

  function mount() {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={['/account/o/events/draft-norule-one']}>
          <Routes><Route path="/account/o/events/:seriesId" element={<EventEditorPage />} /></Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );
  }

  it.each([['cover', true], ['none', false]] as const)('%s, a per-date session: can send %s', async (cover, can) => {
    raw = rawWorkspace(cover, 'per-date');
    mount();
    const send = (await screen.findByTestId('org-event-review-send')) as HTMLButtonElement;
    await vi.waitFor(() => expect(screen.queryByText('Checking what it still needs…')).toBeNull());
    expect(send.disabled).toBe(!can);
    if (can) expect(screen.queryByTestId('org-event-review-blocked')).toBeNull();
    else expect(screen.getByTestId('org-event-review-blocked').textContent).toBe(COVER_REASON);
  });
});
