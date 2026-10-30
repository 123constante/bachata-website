/**
 * p3-prefix-a: every owner shape x the two screens that show "things left" (Home's grace banner, the You tab's
 * Organiser page row). Both read organiser_onboarding_status_v1 through ONE mapping, so they can never disagree,
 * and the banner never says "0 things left". Shapes from prod 2026-10-30: organiser_onboarding_progress has 0
 * rows, so contact_confirm is missing on every owner page; teach_answer / dj_answer are missing on most.
 */
import { describe, expect, it } from 'vitest';
import { graceShown, graceStatusFrom, onboardingLeft, thingsLeft } from '../graceModel';
import { youRows } from '../../you/youRows';

const page = (id: string, missing: unknown, complete = Array.isArray(missing) && missing.length === 0) =>
  ({ id, name: `Page ${id}`, role: 'owner', lifecycle: 'live', complete, missing, about: { done: true, skipped: false } });
const status = (person: unknown, organisers: unknown, extra: Record<string, unknown> = {}) => {
  const all = Array.isArray(organisers) ? (organisers as { complete: boolean }[]) : [];
  const personDone = Array.isArray(person) && person.length === 0;
  return { v: 1, gate_on: false, is_admin: false, person: { complete: personDone, missing: person }, organisers, complete: all.length ? all.every((o) => o.complete) : personDone, ...extra };
};

type Cell = { raw: unknown; you?: string; left: number };
const SHAPES: Record<string, Cell> = {
  // No progress row: the contact step was never confirmed, plus the two new role questions (the common prod shape).
  'no row, role questions + contact': { raw: status(['teach_answer', 'dj_answer'], [page('o1', ['contact_confirm'])]), left: 3 },
  'no row, only contact': { raw: status([], [page('o1', ['contact_confirm'])]), left: 1 },
  'no row, many person items': { raw: status(['languages', 'nationality', 'instagram', 'teach_answer', 'dj_answer'], [page('o1', ['contact_confirm'])]), left: 6 },
  'partial row (contact confirmed), person items left': { raw: status(['teach_answer'], [page('o1', [], false)]), left: 1 },
  complete: { raw: status([], [page('o1', [])]), left: 0 },
  'admin with items': { raw: status(['teach_answer'], [page('o1', ['contact_confirm'])], { is_admin: true }), left: 0 },
  // Server says not complete, but lists nothing: never "0 things left" with a Continue to nowhere.
  'incomplete with empty lists': { raw: status([], [page('o1', [], false)]), left: 0 },
  'malformed: missing not arrays': { raw: { v: 1, is_admin: false, complete: false, person: { missing: null }, organisers: [{ id: 'o1', missing: 'contact_confirm' }] }, left: 0 },
  'malformed: no organisers key': { raw: { v: 1, is_admin: false, complete: false, person: { missing: ['teach_answer'] } }, left: 0 },
  'malformed: string': { raw: 'oops', left: 0 },
  'no answer': { raw: null, left: 0 },
  'malformed: non-string codes dropped': { raw: status(['teach_answer', 7, null], [page('o1', ['contact_confirm', {}])]), left: 2 },
  // Two pages, the first finished: the count is the unfinished page's, not the finished one's.
  'two pages, first complete': { raw: status([], [page('o1', []), page('o2', ['org_logo', 'contact_confirm'])]), left: 2 },
  'no pages yet, person items': { raw: status(['teach_answer'], []), left: 1 },
};

describe('one "things left" mapping: banner and You agree for every owner shape', () => {
  it.each(Object.entries(SHAPES))('%s', (_name, { raw, left }) => {
    const banner = graceStatusFrom(raw);
    expect(onboardingLeft(banner)).toBe(left);
    expect(graceShown(banner, null, '2026-10-30')).toBe(left > 0);
    // You reads the same answer for its shown page (the first listed page).
    const firstId = (raw as { organisers?: { id?: string }[] } | null)?.organisers?.[0]?.id ?? null;
    const you = youRows({ pages: 1, teamCount: 1, requests: 0, requiredLeft: onboardingLeft(graceStatusFrom(raw, firstId)), addPage: '/add' })
      .find((r) => r.id === 'page')!.sub;
    if (firstId === 'o1' && !(_name.startsWith('two pages'))) {
      expect(you).toBe(left > 0 ? `To finish: ${thingsLeft(left)}` : 'Photo, about, links, contact');
    }
  });

  it('You counts its own page; the banner counts the first unfinished one', () => {
    const raw = SHAPES['two pages, first complete'].raw;
    expect(onboardingLeft(graceStatusFrom(raw, 'o1'))).toBe(0);
    expect(onboardingLeft(graceStatusFrom(raw, 'o2'))).toBe(2);
    expect(graceStatusFrom(raw)!.firstId).toBe('o2');
  });

  it('hidden for today hides it, the next day shows it again', () => {
    const s = graceStatusFrom(SHAPES['no row, only contact'].raw);
    expect(graceShown(s, '2026-10-30', '2026-10-30')).toBe(false);
    expect(graceShown(s, '2026-10-29', '2026-10-30')).toBe(true);
  });
});
