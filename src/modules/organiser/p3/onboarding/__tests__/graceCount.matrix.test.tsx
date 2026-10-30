// @vitest-environment jsdom
/**
 * p3-prefix-a: every owner shape x the three screens that show "things left" (Home's grace banner, the You tab's
 * Organiser page row, and the page editor that row opens). Both read organiser_onboarding_status_v1 for the SHOWN page through ONE mapping, so they
 * agree, and the banner never says "0 things left". Shapes from prod 2026-10-30: organiser_onboarding_progress has 0
 * rows, so contact_confirm is missing on every owner page; teach_answer / dj_answer are missing on most.
 */
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { graceShown, graceStatusFrom, onboardingLeft, thingsLeft } from '../graceModel';
import { youRows } from '../../you/youRows';

const h = vi.hoisted(() => ({ raw: null as unknown }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'me' } }) }));
vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    // The old editor source answers a DIFFERENT number (4), so an editor still reading it fails every row.
    rpc: async (fn: string) => (fn === 'organiser_onboarding_status_v1'
      ? { data: h.raw, error: null }
      : { data: { percent: 50, required_left: 4, publish_ready: false, steps: [], declined: [] }, error: null }),
    from: () => ({}),
    auth: {},
  },
}));
const { RequiredLine } = await import('@/modules/organiser/page');
const { P3_SURFACE } = await import('../../you/surface');
const { OrgSurfaceProvider } = await import('@/modules/organiser/shell/surface');

/** The page editor's line under the P3 surface, for the shown page: its text and link, or null when it hides. */
async function editorLine(raw: unknown, shown: string): Promise<{ text: string; href: string | null } | null> {
  h.raw = raw;
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const wrap = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}><MemoryRouter><OrgSurfaceProvider value={P3_SURFACE}>{children}</OrgSurfaceProvider></MemoryRouter></QueryClientProvider>
  );
  render(<RequiredLine organiserId={shown} />, { wrapper: wrap });
  await waitFor(() => expect(qc.isFetching()).toBe(0));
  const el = screen.queryByTestId('page-required-line');
  const out = el ? { text: el.textContent ?? '', href: el.getAttribute('href') } : null;
  cleanup();
  return out;
}

const page = (id: string, missing: unknown, complete = Array.isArray(missing) && missing.length === 0) =>
  ({ id, name: `Page ${id}`, role: 'owner', lifecycle: 'live', complete, missing, about: { done: true, skipped: false } });
const status = (person: unknown, organisers: unknown, extra: Record<string, unknown> = {}) => {
  const all = Array.isArray(organisers) ? (organisers as { complete: boolean }[]) : [];
  const personDone = Array.isArray(person) && person.length === 0;
  return { v: 1, gate_on: false, is_admin: false, person: { complete: personDone, missing: person }, organisers, complete: all.length ? all.every((o) => o.complete) : personDone, ...extra };
};

type Cell = { raw: unknown; shown: string | null; left: number };
const SHAPES: Record<string, Cell> = {
  // No progress row: the contact step was never confirmed, plus the two new role questions (the common prod shape).
  'no row, role questions + contact': { raw: status(['teach_answer', 'dj_answer'], [page('o1', ['contact_confirm'], false)]), shown: 'o1', left: 3 },
  'no row, only contact': { raw: status([], [page('o1', ['contact_confirm'])]), shown: 'o1', left: 1 },
  'no row, many person items': { raw: status(['languages', 'nationality', 'instagram', 'teach_answer', 'dj_answer'], [page('o1', ['contact_confirm'], false)]), shown: 'o1', left: 6 },
  'partial row (contact confirmed), person items left': { raw: status(['teach_answer'], [page('o1', [], false)]), shown: 'o1', left: 1 },
  complete: { raw: status([], [page('o1', [])]), shown: 'o1', left: 0 },
  'admin with items': { raw: status(['teach_answer'], [page('o1', ['contact_confirm'], false)], { is_admin: true }), shown: 'o1', left: 0 },
  // Server says not complete, but lists nothing: never "0 things left" with a Continue to nowhere.
  'incomplete with empty lists': { raw: status([], [page('o1', [], false)]), shown: 'o1', left: 0 },
  'malformed: missing not arrays': { raw: { v: 1, is_admin: false, complete: false, person: { missing: null }, organisers: [{ id: 'o1', missing: 'contact_confirm' }] }, shown: 'o1', left: 0 },
  'malformed: no organisers key': { raw: { v: 1, is_admin: false, complete: false, person: { missing: ['teach_answer'] } }, shown: 'o1', left: 0 },
  'malformed: string': { raw: 'oops', shown: 'o1', left: 0 },
  'no answer': { raw: null, shown: 'o1', left: 0 },
  'malformed: non-string codes dropped': { raw: status(['teach_answer', 7, null], [page('o1', ['contact_confirm', {}], false)]), shown: 'o1', left: 2 },
  // Two pages: both screens count the SHOWN page, never the other one.
  'two pages, shown one complete': { raw: status([], [page('o1', []), page('o2', ['org_logo', 'contact_confirm'])]), shown: 'o1', left: 0 },
  'two pages, shown one unfinished': { raw: status([], [page('o1', []), page('o2', ['org_logo', 'contact_confirm'])]), shown: 'o2', left: 2 },
  'two pages, both unfinished, shown second': { raw: status([], [page('o1', ['org_logo', 'contact_confirm']), page('o2', ['contact_confirm'])]), shown: 'o2', left: 1 },
  // Shown page not in the answer (another role, or a stale pick): the person's codes only, never another page's.
  'shown page not listed': { raw: status(['teach_answer'], [page('o9', ['org_logo', 'contact_confirm'], false)]), shown: 'o1', left: 1 },
  // A code in both lists (the server strips these today) counts once.
  'code in both lists': { raw: status(['teach_answer'], [page('o1', ['teach_answer', 'contact_confirm'], false)]), shown: 'o1', left: 2 },
  // Optional-only (About not added): `about` is never a thing left.
  'optional only: about not added': { raw: { ...status([], [page('o1', [])]), organisers: [{ ...page('o1', []), about: { done: false, skipped: false } }] }, shown: 'o1', left: 0 },
  'no pages yet, person items': { raw: status(['teach_answer'], []), shown: null, left: 1 },
  'no shown page yet: first unfinished': { raw: status([], [page('o1', []), page('o2', ['contact_confirm'])]), shown: null, left: 1 },
};

const youSub = (left: number) =>
  youRows({ pages: 1, teamCount: 1, requests: 0, requiredLeft: left, addPage: '/add' }).find((r) => r.id === 'page')!.sub;

describe('one "things left" mapping: banner and You agree for every owner shape', () => {
  it.each(Object.entries(SHAPES))('%s', async (_name, { raw, shown, left }) => {
    // The banner, the You row and the editor each read the shared answer for the shown page through the same function.
    const n = onboardingLeft(graceStatusFrom(raw, shown));
    expect(n).toBe(left);
    expect(graceShown(graceStatusFrom(raw, shown), null, '2026-10-30')).toBe(left > 0);
    expect(youSub(n)).toBe(left > 0 ? `To finish: ${thingsLeft(left)}` : 'Photo, about, links, contact');
    if (shown === null) return; // no page: You has no page row and there is no editor to open
    expect(await editorLine(raw, shown)).toEqual(left > 0
      ? { text: `To finish: ${thingsLeft(left)}`, href: `/account/p3/start?o=${shown}&at=review` }
      : null);
  });

  it('Continue opens the shown page', () => {
    expect(graceStatusFrom(SHAPES['two pages, shown one unfinished'].raw, 'o2')!.firstId).toBe('o2');
    expect(graceStatusFrom(SHAPES['no shown page yet: first unfinished'].raw, null)!.firstId).toBe('o2');
  });

  it('hidden for today hides it, the next day shows it again', () => {
    const s = graceStatusFrom(SHAPES['no row, only contact'].raw, 'o1');
    expect(graceShown(s, '2026-10-30', '2026-10-30')).toBe(false);
    expect(graceShown(s, '2026-10-29', '2026-10-30')).toBe(true);
  });
});
