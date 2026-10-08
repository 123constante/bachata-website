// @vitest-environment jsdom
/**
 * Owner-approved editor order (2026-10-08), rendered with EVERY real series shape
 * (shapes.ts, from the prod survey) through the real parsers:
 *   What it is -> When -> Where -> What people see -> Programme -> Tickets and links
 *   -> Who runs it -> Status (Send for review LAST).
 * Each case asserts: (1) the same order for every shape, (2) every group heading
 * sits over something (never an empty box), (3) what shows and what is hidden,
 * and every reason / lock sentence, is exactly what the editor showed BEFORE the
 * reorder (the snapshot was written against the unfixed code; the one sentence
 * that changed is the Programme card's pointer to the past dates, 'below' ->
 * 'above', because the dates now sit above it), (4) an untouched record sends
 * nothing on Save, (5) copy that points up or down points at a control that is
 * really there.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SHAPES, VENUES, homeOf, programmeOf, upcomingOf, workspaceOf, type SeriesShape } from '../../__tests__/shapes/shapes';

const rpc = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc, from: vi.fn(), storage: { from: vi.fn() } } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1' } }) }));
vi.mock('@/hooks/useLondonToday', () => ({ useLondonToday: () => '2026-10-08' }));
vi.mock('@/lib/city-canonical', () => ({ resolveCanonicalCity: async () => ({ cityId: 'c1' }) }));

import EventEditorPage from '../EventEditorPage';

/** Every shape, plus the one lifecycle prod holds none of today: changes needed (rejected). */
const CASES: SeriesShape[] = [
  ...SHAPES,
  ...SHAPES.filter((s) => s.lifecycle === 'draft').map((s) => ({ ...s, key: `${s.key}-rejected`, lifecycle: 'rejected' })),
];

/** The groups top to bottom, with the testids that belong to each (in order). */
const GROUPS: [group: string, heading: string, ids: string[]][] = [
  // Cover and gallery sit together (owner decision 2026-10-08, matching admin editor-v2's
  // 'Cover & gallery' in section 1); the gallery is no longer under What people see.
  ['what', 'What it is', ['org-event-name', 'org-cover', 'org-row-gallery', 'org-row-type']],
  ['when', 'When', ['org-date-card', 'org-dates', 'org-taken-off']],
  ['where', 'Where', ['org-row-venue']],
  ['see', 'What people see', ['org-row-description', 'org-styles', 'org-row-video']],
  ['programme', 'Programme', ['org-schedule']],
  ['links', 'Tickets and links', ['org-row-ticket']],
  ['who', 'Who runs it', ['org-row-organisers']],
  // Shown only while the review card has something to say (a heading never sits over nothing).
  ['status', 'Status', ['org-event-review']],
];
const ORDER = GROUPS.flatMap(([, , ids]) => ids);
/** Reason and lock sentences: each must read exactly as before the reorder. */
const REASONS = [
  'org-event-locked', 'org-schedule-reason', 'org-taken-off-reason', 'org-event-review-sentence', 'org-event-review-blocked',
  'org-dates-none', 'org-schedule-none', 'org-row-type', 'org-row-organisers', 'org-row-until', 'org-row-ended',
];

beforeEach(() => rpc.mockReset());
afterEach(cleanup);

async function openEditor(s: SeriesShape) {
  const raw = workspaceOf(s);
  rpc.mockImplementation(async (fn: string) => {
    const next = upcomingOf(s).find((d) => d.status !== 'cancelled') ?? upcomingOf(s)[0];
    const answers: Record<string, unknown> = {
      organiser_home_v1: homeOf([s]),
      admin_event_workspace_p5: raw,
      organiser_get_occurrence_programme_v1: next ? programmeOf(s, next) : null,
      get_organiser_venue_options_v1: VENUES,
      event_publish_readiness_v1: { missing: [] },
      series_command_p5: { ok: true, new_version: 6 },
    };
    return fn in answers ? { data: answers[fn], error: null } : { data: null, error: { message: `unexpected ${fn}` } };
  });
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[`/account/o/events/${s.id}`]}>
        <Routes><Route path="/account/o/events/:seriesId" element={<EventEditorPage />} /></Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  const editor = await screen.findByTestId('org-event-editor');
  // Settle every read the editor makes (organisers, venues, schedule, readiness).
  await vi.waitFor(() => {
    const called = rpc.mock.calls.map(([fn]) => fn);
    expect(called).toContain('organiser_home_v1');
    expect(called).toContain('get_organiser_venue_options_v1');
    expect(screen.queryByText(/Loading the schedule|Checking what it still needs/)).toBeNull();
  });
  await new Promise((r) => setTimeout(r, 0));
  return editor;
}

const present = (editor: HTMLElement) => ORDER.filter((id) => editor.querySelector(`[data-testid="${id}"]`));
const before = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING);

describe.each(CASES.map((s) => [s.key, s] as const))('shape %s', (_key, s) => {
  it('(1) the sections run in the approved order; Send for review is last', async () => {
    const editor = await openEditor(s);
    const els = present(editor).map((id) => editor.querySelector(`[data-testid="${id}"]`) as Element);
    for (let i = 1; i < els.length; i += 1) {
      expect(before(els[i - 1], els[i]), `${present(editor)[i - 1]} before ${present(editor)[i]}`).toBe(true);
    }
    const review = editor.querySelector('[data-testid="org-event-review"]');
    if (review) {
      const all = editor.querySelectorAll('[data-testid]');
      const afterReview = [...all].filter((el) => before(review, el) && !review.contains(el)
        && el.closest('[data-testid="org-event-review"]') === null && !el.matches('[data-testid^="org-sheet"],[data-testid^="org-announce"]'));
      expect(afterReview.map((el) => el.getAttribute('data-testid')).filter((id) => ORDER.includes(id ?? ''))).toEqual([]);
    }
  });

  it('(2) each group has its heading over the right fields, in order, and never an empty box', async () => {
    const editor = await openEditor(s);
    const groups = [...editor.querySelectorAll('[data-testid^="org-group-"]')];
    const shown = GROUPS.filter(([g]) => g !== 'status' || editor.querySelector('[data-testid="org-event-review"]'));
    expect(groups.map((g) => g.getAttribute('data-testid'))).toEqual(shown.map(([g]) => `org-group-${g}`));
    shown.forEach(([g, heading, ids], i) => {
      const el = groups[i];
      expect(el.querySelector('h2')?.textContent, g).toBe(heading);
      // The group holds its own fields and only those.
      for (const id of ids) {
        const field = editor.querySelector(`[data-testid="${id}"]`);
        if (field) expect(el.contains(field), `${id} in ${g}`).toBe(true);
      }
      expect(ids.some((id) => el.querySelector(`[data-testid="${id}"]`)), `${g} is not empty`).toBe(true);
    });
  });

  it('(3) same sections shown and hidden, same reasons and lock text as before the reorder', async () => {
    const editor = await openEditor(s);
    const reasons = Object.fromEntries(REASONS.flatMap((id) => {
      const el = editor.querySelector(`[data-testid="${id}"]`);
      return el ? [[id, el.textContent]] : [];
    }));
    expect({ present: present(editor), reasons }).toMatchSnapshot();
  });

  it('(4) an untouched record sends nothing on Save', async () => {
    await openEditor(s);
    const action = screen.queryByTestId('org-preview-bar-action') as HTMLButtonElement | null;
    if (action) {
      expect(action.disabled).toBe(true);
      action.click();
    }
    expect(rpc.mock.calls.filter(([fn]) => fn === 'series_command_p5')).toEqual([]);
  });

  it('(6) cover and gallery sit together under one "Cover & gallery" label; the add-later hint only when editable', async () => {
    const editor = await openEditor(s);
    const region = editor.querySelector('[data-testid="org-cover-gallery"]') as HTMLElement;
    expect(region).not.toBeNull();
    expect(editor.querySelector('[data-testid="org-group-what"]')?.contains(region)).toBe(true);
    expect(region.getAttribute('aria-labelledby') && document.getElementById(region.getAttribute('aria-labelledby')!)?.textContent).toBe('Cover & gallery');
    expect(region.querySelector('[data-testid="org-cover"]')).not.toBeNull();
    expect(region.querySelector('[data-testid="org-row-gallery"]')).not.toBeNull();
    expect(editor.querySelector('[data-testid="org-group-see"] [data-testid="org-row-gallery"]')).toBeNull();
    const locked = !!editor.querySelector('[data-testid="org-event-locked"]');
    const hint = region.querySelector('[data-testid="org-cover-gallery-hint"]');
    // "add later" would point at a control a locked event cannot use.
    expect(!!hint).toBe(!locked);
  });

  it('(5) "above" / "below" copy points the right way', async () => {
    const editor = await openEditor(s);
    const none = editor.querySelector('[data-testid="org-schedule-none"]');
    if (none?.textContent?.includes('past date above')) {
      expect(before(editor.querySelector('[data-testid="org-dates-past-toggle"]') as Element, none)).toBe(true);
    }
    expect(none?.textContent ?? '').not.toMatch(/below/);
    const reason = editor.querySelector('[data-testid="org-schedule-reason"]');
    if (reason?.textContent?.match(/Open a (date|day) below/)) {
      expect(before(reason, editor.querySelector('[data-testid="org-dates"]') as Element)).toBe(true);
    }
    const taken = editor.querySelector('[data-testid="org-taken-off-reason"]');
    if (taken?.textContent?.includes('Date card above')) {
      expect(before(editor.querySelector('[data-testid="org-date-card"]') as Element, taken)).toBe(true);
    }
  });
});
