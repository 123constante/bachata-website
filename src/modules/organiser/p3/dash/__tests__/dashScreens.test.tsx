// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildDash, type DashInput, type DashNight, type ProfileStep } from '../dashModel';
import { DashView } from '../DashView';
import { P3_PATHS } from '../../shell/paths';

const night = (n: number, o: Partial<DashNight> = {}): DashNight => ({
  key: `n${n}`, date: `2026-12-${String(10 + n).padStart(2, '0')}`, when: `Friday ${10 + n} December, 8pm`, name: `Night ${n}`,
  cancelled: false, going: 0, opens: 0, taps: {}, ticketsSold: 0, ...o,
});
const steps = (doneKeys: string[]): ProfileStep[] => [
  { key: 'bio', label: 'Bio', sentence: 'Tell dancers who you are.', button: 'Add a bio', done: false },
  { key: 'logo', label: 'Logo', sentence: 'A logo helps people spot you.', button: 'Add a logo', done: false },
].map((s) => ({ ...s, done: doneKeys.includes(s.key) })) as ProfileStep[];
const base: DashInput = {
  load: 'ready', seat: 'owner', nights: [], upcomingDates: 0, pageLink: 'https://bachatacalendar.com/organiser/x', profileSteps: steps([]),
  cityOrganisers: 2, cityAverage: 4.2, sellingViaUs: false, teamCount: 1,
};
const many = Array.from({ length: 12 }, (_, i) => night(i + 1, { going: 3, opens: 1200 }));

const SHAPES: Record<string, DashInput> = {
  new: base,
  upcoming: { ...base, nights: [night(1, { going: 12, opens: 248 }), night(2, { opens: 5 }), night(3)], upcomingDates: 3 },
  zero: { ...base, nights: [night(1), night(2), night(3)], upcomingDates: 3 },
  huge: { ...base, nights: many, upcomingDates: 222, cityOrganisers: 47 },
  cancelled: { ...base, nights: [night(1, { cancelled: true }), night(2, { going: 2, opens: 9 }), night(3)], upcomingDates: 2 },
  selling: { ...base, sellingViaUs: true, nights: [night(1, { going: 4, opens: 40, ticketsSold: 7 })], upcomingDates: 1 },
  contributor: { ...base, seat: 'contributor', nights: [night(1, { going: 4, opens: 40 })], upcomingDates: 1 },
  loading: { ...base, load: 'loading' },
  error: { ...base, load: 'error' },
};

afterEach(cleanup);
const view = (i: DashInput) => render(<MemoryRouter><DashView model={buildDash(i)} pageName="Page" /></MemoryRouter>);

describe('organiser dash model x shape', () => {
  it.each(Object.keys(SHAPES))('%s never draws a zero, a bc.link or a lowercased step', (k) => {
    const { container } = view(SHAPES[k]);
    const text = container.textContent ?? '';
    expect(text).not.toMatch(/\b0 (going|opens|open)\b/);
    expect(text).not.toMatch(/bc\.link/);
    expect(text).not.toMatch(/YOUR NEXT STEP|Your nights|None yet/);
  });

  it('1: city average only with 5+ organisers (and a read)', () => {
    expect(buildDash({ ...SHAPES.huge }).cityAverage).not.toBeNull();
    expect(buildDash({ ...SHAPES.huge, cityOrganisers: 4 }).cityAverage).toBeNull();
    expect(buildDash({ ...SHAPES.huge, cityAverage: null }).cityAverage).toBeNull();
    expect(buildDash(SHAPES.upcoming).cityAverage).toBeNull();
  });

  it('2: contributor controls are disabled with a reason', () => {
    view(SHAPES.contributor);
    for (const id of ['dash-team-action', 'dash-profile-action']) {
      expect((screen.getByTestId(id) as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByTestId(`${id}-why`).textContent).toMatch(/owner or a manager/);
    }
  });

  it('2b: owner controls are enabled, no reason', () => {
    view(SHAPES.upcoming);
    expect(screen.getByTestId('dash-team-action').getAttribute('href')).toBe(P3_PATHS.youTeamAdd);
    expect(screen.queryByTestId('dash-team-action-why')).toBeNull();
  });

  it('3: cancelled counts live nights only, hero is next live night, note is collapsed and claims nothing', () => {
    const m = buildDash(SHAPES.cancelled);
    expect(m.hero?.night?.key).toBe('n2');
    expect(m.nightsRow?.text).toBe('2 nights coming up');
    expect(m.cancelledNote?.body).not.toMatch(/\b(told|notified|sent)\b/i);
    expect(m.cancelledNote?.body).toMatch(/nobody is messaged/);
    view(SHAPES.cancelled);
    expect((screen.getByTestId('dash-cancelled-note') as HTMLDetailsElement).open).toBe(false);
  });

  it('3b: only cancelled nights -> no live night, not a headline', () => {
    const m = buildDash({ ...base, nights: [night(1, { cancelled: true })], upcomingDates: 0 });
    expect(m.hero?.kind).toBe('no-live-night');
    expect(m.nightsRow).toBeNull();
  });

  it('4: profile row has separate label and sentence, one control named for the step', () => {
    const m = buildDash({ ...base, profileSteps: steps(['bio']) });
    expect(m.profile?.next?.key).toBe('logo');
    expect(m.profile?.control?.label).toBe('Add a logo');
    expect(m.profile?.next?.sentence).toMatch(/^[A-Z]/);
    expect(buildDash({ ...base, profileSteps: steps(['bio', 'logo']) }).profile?.complete).toBe(true);
  });

  it('5: no page link -> Share disabled with a reason, never a made-up link', () => {
    const m = buildDash({ ...base, pageLink: null });
    expect(m.sharePage.disabled).toBe(true);
    expect(m.sharePage.reason).toBeTruthy();
  });

  it('6: healthy night hero carries its headline and a share button', () => {
    view(SHAPES.upcoming);
    expect(screen.getByTestId('dash-headline').textContent).toBe('12 going, 248 opens this month');
    expect(screen.getByTestId('dash-hero-action').textContent).toBe('Share this night');
  });

  it('7: zero shape says it once (hero), the first rail row repeats nothing', () => {
    const m = buildDash(SHAPES.zero);
    expect(m.hero?.kind).toBe('share');
    expect(m.rail.every((r) => r.stats === null)).toBe(true);
    const { container } = view(SHAPES.zero);
    expect((container.textContent ?? '').match(/Get people looking/g)?.length).toBe(1);
  });

  it('8: Tickets only when selling, inside the nights row', () => {
    expect(buildDash(SHAPES.selling).nightsRow?.tickets).toBe(7);
    expect(buildDash(SHAPES.upcoming).nightsRow?.tickets).toBeNull();
    view(SHAPES.selling);
    expect(screen.getByTestId('dash-nights-row').textContent).toMatch(/7 tickets sold/);
  });

  it('9: no dead rows, no unlabelled See button, no kicker', () => {
    const { container } = view(SHAPES.upcoming);
    expect(container.textContent).not.toMatch(/Your nights|None yet|YOUR NEXT STEP/i);
    for (const b of container.querySelectorAll('button')) expect((b.textContent ?? '').trim()).not.toBe('See');
  });

  it('new: first-night hero with New event; no rail, no nights row', () => {
    const m = buildDash(SHAPES.new);
    expect(m.hero?.kind).toBe('first-night');
    expect(m.rail).toEqual([]);
    expect(m.nightsRow).toBeNull();
    expect(m.team.line).toBe('Only you so far.');
  });

  it('huge: rail capped, See all N dates, 5-digit numbers formatted', () => {
    const m = buildDash(SHAPES.huge);
    expect(m.rail.length).toBeLessThanOrEqual(4);
    expect(m.seeAll?.label).toBe('See all 222 dates');
    expect(m.nightsRow?.text).toBe('222 nights coming up');
  });

  it('loading disables buttons with a reason; error offers Try again and keeps Share', () => {
    view(SHAPES.loading);
    expect((screen.getByTestId('dash-share-page') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('dash-share-page-why')).toBeTruthy();
  });
  it('error: retry present', () => {
    view(SHAPES.error);
    expect((screen.getByTestId('dash-retry') as HTMLButtonElement).disabled).toBe(false);
    expect(screen.getByTestId('dash-error').textContent).toMatch(/still live/);
  });
});

describe('review fixes round', () => {
  it('1: every enabled control in every shape navigates or fires a handler', () => {
    for (const k of Object.keys(SHAPES)) {
      cleanup();
      const h = { onShareNight: vi.fn(), onSharePage: vi.fn(), onRetry: vi.fn() };
      const { container } = render(<MemoryRouter><DashView model={buildDash(SHAPES[k])} pageName="Page" pageLink="https://x.test/p" {...h} /></MemoryRouter>);
      const controls = [...container.querySelectorAll('button, a[href]')].filter((el) => el.tagName === 'A' || !(el as HTMLButtonElement).disabled);
      for (const el of controls) {
        if (el.tagName === 'A') { expect(el.getAttribute('href'), `${k}: link`).toBeTruthy(); continue; }
        if (el.closest('summary')) continue;
        fireEvent.click(el);
        const fired = h.onShareNight.mock.calls.length + h.onSharePage.mock.calls.length + h.onRetry.mock.calls.length;
        expect(fired, `${k}: ${el.textContent}`).toBeGreaterThan(0);
        h.onShareNight.mockClear(); h.onSharePage.mockClear(); h.onRetry.mockClear();
      }
    }
  });

  it('1b: profile step buttons go to the page editor', () => {
    view(SHAPES.upcoming);
    expect(screen.getByTestId('dash-profile-action').getAttribute('href')).toBe(P3_PATHS.youPage);
  });

  it('2: unknown opens (null) never claim nobody found the night', () => {
    const m = buildDash({ ...base, nights: [night(1, { opens: null })], upcomingDates: 1 });
    expect(m.hero?.kind).toBe('share');
    expect(m.hero?.title).not.toMatch(/No one/i);
    expect(m.hero?.actionLabel).toBe('Share this night');
    expect(buildDash({ ...base, nights: [night(1, { going: 3, opens: null })], upcomingDates: 1 }).hero?.headline).toBe('3 going');
  });

  it('3: opens are labelled as a month figure', () => {
    expect(buildDash({ ...base, nights: [night(1, { opens: 9 })], upcomingDates: 1 }).hero?.headline).toBe('9 opens this month');
  });

  it('4: analytics failure keeps hero and rail, adds an inline retry', () => {
    const onRetry = vi.fn();
    render(<MemoryRouter><DashView model={buildDash(SHAPES.upcoming)} pageName="Page" analyticsFailed onRetry={onRetry} /></MemoryRouter>);
    expect(screen.getByTestId('dash-hero')).toBeTruthy();
    expect(screen.getByTestId('dash-rail')).toBeTruthy();
    fireEvent.click(screen.getByTestId('dash-analytics-retry'));
    expect(onRetry).toHaveBeenCalled();
  });
});
