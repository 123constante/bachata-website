// @vitest-environment jsdom
/**
 * CLIENT harness for FestivalDetail -- the half no test in this repo could
 * reach until now.
 *
 * WHY IT EXISTS. Every other festival test is SSR (renderToString) or pure
 * unit, so nothing MOUNTS this component. Three defects were therefore
 * recorded as "survives the whole suite with zero fail lines" rather than
 * fixed:
 *
 *   R1  the activeDayIdx clamp, which exists because pickedDayIdx outlives a
 *       client-side festival-to-festival navigation
 *   --  the OVERRIDE half of the seed/override split: tab clicks, and the
 *       post-mount clock correction
 *   --  per-festival state (pickedDayIdx, showAllDays, descExpanded,
 *       lightboxIndex) leaking across a warm navigation
 *
 * WHAT THIS CANNOT DO, stated up front so nobody quotes it for more than it
 * covers. jsdom does no layout and does not implement `:has()`. Every CSS
 * claim in this component -- the single-day hide rules, the all-days swipe
 * grid, the `:has()` gating -- is INVISIBLE here. This harness asserts STATE
 * and MARKUP: which cell carries data-open, which tab is active, what survives
 * a rerender. A green run here says nothing about how the page looks.
 *
 * WARM vs COLD, because only one of them reaches the defect. On a COLD
 * destination sniffIsFestival(undefined, undefined) is false, EventPage falls
 * through to BentoPage, and this component unmounts -- taking its state with
 * it. Only A -> B -> back inside the 60s staleTime keeps the route module
 * mounted, which is what `navigateTo` models here -- a real router navigation.
 * NOT a rerender: MemoryRouter reads `initialEntries` once, at mount, so
 * re-rendering the tree with a different one changes nothing and the
 * destination silently stays put. `rerender` is deliberately NOT returned from
 * mountFestival for that reason.
 */
import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useNavigate } from 'react-router';
import type { QueryClient } from '@tanstack/react-query';
import {
  EVENT_UUID,
  EVENT_UUID_B,
  SLUG_B,
  LOCAL_START,
  LOCAL_START_B,
  LOCAL_END_B,
  SCHEDULE,
  SCHEDULE_B,
  seedClient,
  installFixtureFetchGate,
  removeFixtureFetchGate,
} from '../fixtures/festivalFixture';
import { installJsdomPolyfills } from './jsdomPolyfills';

beforeAll(() => {
  installJsdomPolyfills();
  installFixtureFetchGate('client harness');
});
// afterEACH, not beforeEach. This project runs vitest with `globals: false`,
// so RTL never registers its own auto-cleanup -- and cleaning up BEFORE the
// next test leaves the LAST test's tree mounted for good. afterAll then
// restores the real fetch underneath a live AuthProvider and Supabase client
// whose teardown only runs on unmount, which is how a "pure" test file ends up
// holding a network client open into whatever the worker runs next.
afterEach(cleanup);
afterAll(removeFixtureFetchGate);

/**
 * Mount /festival/:id for real, and hand back a rerender that changes ONLY the
 * route param -- the warm navigation. The QueryClient is shared across both
 * festivals on purpose: that is what makes the destination warm.
 */
async function mountFestival(uuid: string, serverTodayKey?: string) {
  const { AppProviders } = await import('@/App');
  const { default: FestivalDetail } = await import('@/pages/FestivalDetail');

  const client: QueryClient = await seedClient(SCHEDULE, undefined, undefined);
  await seedClient(
    SCHEDULE_B,
    { start: LOCAL_START_B, end: LOCAL_END_B },
    { uuid: EVENT_UUID_B, slug: SLUG_B, name: 'Test Festival B' },
    client,
  );

  // Navigation has to go through the ROUTER, not through re-rendering the tree
  // with different `initialEntries` -- those are read once, at mount, so a
  // rerender changes nothing and the destination silently stays put. The first
  // draft of this harness did exactly that and its own "the destination really
  // is the smaller festival" guard caught it; without that guard the clamp case
  // would have passed against a navigation that never happened, which is the
  // same class of defect the clamp itself has.
  let navigate: ((to: string) => void) | null = null;
  const NavigationProbe = () => {
    navigate = useNavigate();
    return null;
  };

  const view = render(
    <AppProviders client={client}>
      <MemoryRouter initialEntries={[`/festival/${uuid}`]}>
        <NavigationProbe />
        <Routes>
          <Route
            path="/festival/:id"
            element={<FestivalDetail serverTodayKey={serverTodayKey} />}
          />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
  );

  // `rerender` is withheld on purpose -- see the WARM vs COLD note in the file
  // header. Spreading the whole view put a method here that looks like a
  // navigation and is not one.
  const { rerender: _unusedRerender, ...safeView } = view;

  return {
    ...safeView,
    navigateTo: (to: string) => {
      if (!navigate) throw new Error('navigateTo: the router never mounted the probe');
      act(() => navigate!(`/festival/${to}`));
    },
  };
}

/**
 * Which 0-based column carries data-open, and HOW MANY do -- the same
 * presence-not-value read the SSR gate uses, for the same reason: the CSS
 * matches on presence, so `data-open="false"` would open every column.
 */
function openColumns(container: HTMLElement): number[] {
  const body = container.querySelector('.tl-body');
  if (!body) throw new Error('openColumns: nothing rendered a .tl-body');
  const row = body.querySelector('.tl-row');
  if (!row) throw new Error('openColumns: .tl-body has no .tl-row');
  const slots = Array.from(row.querySelectorAll(':scope > .slot'));
  if (slots.length === 0) throw new Error('openColumns: .tl-row has no slots');
  return slots.flatMap((s, i) => (s.hasAttribute('data-open') ? [i] : []));
}

/** The day tabs, in render order. */
function dayTabs(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(container.querySelectorAll('button.day-tab'));
}

/** Which tabs carry `active` -- asserted as a COUNT, never as "the first one". */
function activeTabs(container: HTMLElement): number[] {
  return dayTabs(container).flatMap((b, i) => (b.classList.contains('active') ? [i] : []));
}

// 60s, not the SSR file's 20s. The first case in a cold worker pays the whole
// app's transform cost (~15s measured here) before it renders a thing, and a
// timeout tripped by compile time reads exactly like a hang in the component.
describe('client: FestivalDetail mounts at all', { timeout: 60_000 }, () => {
  it('renders the festival, not the not-found branch', async () => {
    // THE CONTROL FOR EVERY CASE BELOW. If the fixture stops resolving, the
    // page renders "Festival not found" -- which has no .tl-body, no tabs and
    // no data-open, so every assertion in this file would pass or throw for a
    // reason unrelated to what it claims to test.
    const { container } = await mountFestival(EVENT_UUID, LOCAL_START);
    expect(container.textContent).not.toContain('Festival not found');
    expect(container.querySelector('.tl-body')).not.toBeNull();
    expect(openColumns(container)).toHaveLength(1);
    expect(dayTabs(container)).toHaveLength(3);
  });
});

describe('client: the OVERRIDE half of the seed/override split', { timeout: 60_000 }, () => {
  it('opens the column whose tab was tapped', async () => {
    // THE MUTANT THIS EXISTS FOR: `activeDayIdx = seedDayIdx` -- the override
    // never read -- survived all 1149 tests before this harness, because
    // nothing mounted the component. The seed is pinned to LOCAL_START (day
    // 0), so tapping day 2 can only open column 2 through pickedDayIdx.
    const user = userEvent.setup();
    const { container } = await mountFestival(EVENT_UUID, LOCAL_START);
    expect(openColumns(container)).toEqual([0]);

    await user.click(dayTabs(container)[2]);

    expect(openColumns(container)).toEqual([2]);
    // Cardinality, not just position: an override that opened day 2 WITHOUT
    // closing day 0 satisfies a `toContain(2)` and breaks the view.
    expect(activeTabs(container)).toEqual([2]);
  });

  // DELETED, NOT WEAKENED: a case here claimed to catch an override written
  // only-when-different (which leaves pickedDayIdx null, so a later seed
  // recomputation moves the tab back under the reader). Review mutated exactly
  // that and the file stayed 4/4 GREEN with zero fail lines -- it clicked tab 0
  // (a no-op under the mutant) and then tab 1 (which differs), so it never
  // forced the seed recomputation that would expose the null.
  //
  // It was removed rather than repaired: a case that cannot fail is worse than
  // no case, because it reads as coverage. Writing the real one needs a way to
  // force a re-render without changing the picked value, which this harness
  // does not have yet. Queued with the mutation evidence.
});

describe('client: a WARM festival-to-festival navigation settles in range', { timeout: 60_000 }, () => {
  // THIS DOES NOT CLOSE R1, AND MUST NOT BE QUOTED AS DOING SO. Measured, not
  // assumed: with the clamp reverted to `pickedDayIdx ?? seedDayIdx` this file
  // is still 4/4 GREEN. The mutant survives.
  //
  // WHY, because the reason is the useful part. The defect is TRANSIENT --
  // defaultedForRef corrects the leaked index one effect later, so the
  // out-of-range render happens, paints nothing into data-open, and is gone
  // before act() returns. A settled-state assertion cannot see it.
  //
  // A MutationObserver over the container was tried and REVERTED: it fires
  // during DOM patching rather than at commit boundaries, so it reds against
  // UNMUTATED code -- a gate that fails on correct input is worse than none.
  // Closing R1 properly needs a render-boundary probe (a spy component inside
  // the tree recording what each commit saw), which is a bigger piece of work
  // than this harness.
  //
  // What the case below IS worth: it pins that the settled state after a warm
  // navigation is in range and opens exactly one column, and it drives the
  // whole warm path -- shared QueryClient, no remount, real router navigation
  // -- which is the machinery any future R1 probe will need.
  it('opens exactly one in-range column after navigating to a smaller festival', async () => {
    //
    // FestivalDetailInner renders with no key, so a param change keeps the
    // route module MOUNTED and pickedDayIdx outlives the navigation. Festival
    // A has three columns and we tap the third; festival B has two. Without
    // the clamp activeDayIdx is 2 against a 2-column grid, data-open lands on
    // nothing, and the hide-every-other-slot rule hides EVERY slot -- a blank
    // schedule, not a wrong one.
    //
    // Warm is the whole point: both festivals are seeded into ONE QueryClient,
    // so the destination resolves from cache and this component never
    // unmounts. On a cold destination it would unmount and take the state with
    // it, which is why no SSR case could ever reach this.
    const user = userEvent.setup();
    const { container, navigateTo } = await mountFestival(EVENT_UUID, LOCAL_START);

    await user.click(dayTabs(container)[2]);
    expect(openColumns(container)).toEqual([2]);

    navigateTo(EVENT_UUID_B);

    // The destination really is the smaller festival -- without this the case
    // could pass against a navigation that never happened.
    expect(dayTabs(container)).toHaveLength(2);

    const open = openColumns(container);
    expect(open).toHaveLength(1);
    expect(open[0]).toBeLessThanOrEqual(1);
  });
});
