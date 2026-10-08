// @vitest-environment jsdom
/**
 * Owner, 2026-10-08: closing a link sheet (the X) with an INVALID entry throws the
 * typed text away and puts back the value the field had when it opened: no stuck
 * invalid draft, no dirty flag, Save stays off. Valid and blank entries behave as
 * before (Done keeps them; the X keeps a typed ticket link and leaves a typed,
 * not-added video in its box). One mapping for every link sheet:
 * shared/linkRules linkOnClose. This file: the pure mapping over every link kind
 * and the event editor's ticket and video sheets, field x valid/invalid/empty x
 * close/Done. The profile's Instagram, website and Facebook sheets:
 * profile/__tests__/linkSheetClose.matrix.test.tsx.
 *
 * Prod survey (2026-10-08, counts, read-only): event_series_p5 ticket_url set on
 * 72 of 742 series, video_urls on 16; every stored ticket and video passes the
 * public-link rule (0 refused), so a saved value restored on close is always one
 * Save accepts.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { VENUES, homeOf, shapeByKey, workspaceOf } from '../../__tests__/shapes/shapes';
import { linkOnClose, linkProblem, type LinkKind } from '@/modules/organiser/shared/linkRules';
import { LINK_ENTRIES } from '../../__tests__/shapes/linkEntries';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c1' }) }));

import EventEditorPage from '../EventEditorPage';

type Entry = 'valid' | 'invalid' | 'empty';
const ENTRIES: Entry[] = ['valid', 'invalid', 'empty'];
const typedOf = (kind: LinkKind, e: Entry) => (e === 'empty' ? '' : LINK_ENTRIES[kind][e]);

describe('linkOnClose: one mapping for every link sheet', () => {
  const kinds = Object.keys(LINK_ENTRIES) as LinkKind[];
  for (const kind of kinds) {
    it.each(ENTRIES)(`${kind}: %s entry`, (e) => {
      const { saved } = LINK_ENTRIES[kind];
      const typed = typedOf(kind, e);
      expect(linkProblem(kind, typed) !== null).toBe(e === 'invalid');
      expect(linkOnClose(kind, typed, saved)).toBe(e === 'invalid' ? saved : typed);
    });
  }
  it('an invalid entry over a blank field goes back to blank', () => {
    expect(linkOnClose('ticket', 'nope', '')).toBe('');
  });
});

let saved: { ticket: string; videos: string[] };
beforeEach(() => {
  saved = { ticket: LINK_ENTRIES.ticket.saved, videos: [LINK_ENTRIES.video.saved] };
  rpc.mockReset();
  rpc.mockImplementation(async (fn: string) => {
    const s = shapeByKey('draft-norule-one');
    const ws = workspaceOf(s);
    ws.series.series.default_ticket_url = saved.ticket as unknown as null;
    ws.series.series.video_urls = saved.videos as typeof ws.series.series.video_urls;
    const answers: Record<string, unknown> = {
      organiser_home_v1: homeOf([s]),
      admin_event_workspace_p5: ws,
      organiser_get_occurrence_programme_v1: null,
      get_organiser_venue_options_v1: VENUES,
      event_publish_readiness_v1: [],
      series_command_p5: { ok: true, new_version: 6 },
    };
    return fn in answers ? { data: answers[fn], error: null } : { data: null, error: { message: `unexpected ${fn}` } };
  });
});
afterEach(cleanup);

async function openEditor() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account/o/events/draft-norule-one']}>
        <Routes>
          <Route path="/account/o/events/:seriesId" element={<EventEditorPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  await screen.findByTestId('org-event-editor');
}

const saveOff = () => (screen.getByTestId('org-preview-bar-action') as HTMLButtonElement).disabled;
const done = () => screen.getByTestId('org-sheet-done') as HTMLButtonElement;

describe('event editor: the ticket link sheet', () => {
  for (const savedTicket of ['saved', 'blank'] as const) {
    for (const e of ENTRIES) {
      for (const how of ['close', 'done'] as const) {
        it(`saved ${savedTicket}, ${e} entry, ${how}`, async () => {
          if (savedTicket === 'blank') saved.ticket = '';
          await openEditor();
          const before = saved.ticket;
          const typed = typedOf('ticket', e);
          fireEvent.click(screen.getByTestId('org-row-ticket'));
          fireEvent.change(await screen.findByTestId('org-ticket-input'), { target: { value: typed } });
          if (how === 'done') {
            expect(done().disabled).toBe(e === 'invalid');
            if (e === 'invalid') return; // Done cannot be pressed: the sheet stays open with the reason.
            fireEvent.click(done());
          } else {
            fireEvent.click(screen.getByTestId('org-editor-sheet-close'));
          }
          const kept = e === 'invalid' ? before : typed;
          expect(screen.getByTestId('org-row-ticket').textContent).toContain(kept || 'Add');
          expect(saveOff()).toBe(kept === before);
          fireEvent.click(screen.getByTestId('org-row-ticket'));
          expect((await screen.findByTestId('org-ticket-input') as HTMLInputElement).value).toBe(kept);
          expect(screen.queryByTestId('org-ticket-problem')).toBeNull();
          expect(done().disabled).toBe(false);
        });
      }
    }
  }
});

describe('event editor: the video sheet', () => {
  for (const e of ENTRIES) {
    for (const how of ['close', 'done'] as const) {
      it(`${e} entry, ${how}`, async () => {
        await openEditor();
        const typed = typedOf('video', e);
        fireEvent.click(screen.getByTestId('org-row-video'));
        fireEvent.change(await screen.findByTestId('org-video-input'), { target: { value: typed } });
        if (how === 'done') {
          expect(done().disabled).toBe(e === 'invalid');
          if (e === 'invalid') return;
          fireEvent.click(done());
        } else {
          fireEvent.click(screen.getByTestId('org-editor-sheet-close'));
        }
        // Done adds a valid typed link; the X adds nothing.
        const added = how === 'done' && e === 'valid';
        expect(screen.getByTestId('org-row-video').textContent).toContain(added ? '2' : '1');
        expect(saveOff()).toBe(!added);
        fireEvent.click(screen.getByTestId('org-row-video'));
        // The box: an invalid entry is gone; a valid one closed with the X waits there, as before.
        const box = (await screen.findByTestId('org-video-input') as HTMLInputElement).value;
        expect(box).toBe(how === 'close' && e === 'valid' ? typed : '');
        expect(screen.queryByTestId('org-video-problem')).toBeNull();
        expect(done().disabled).toBe(false);
      });
    }
  }
});
