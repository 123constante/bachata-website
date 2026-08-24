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
 *       client-side festival-to-festival navigation      -- NOW GATED
 *   --  the OVERRIDE half of the seed/override split: tab clicks, and the
 *       post-mount clock correction                      -- NOW GATED
 *   --  per-festival state (pickedDayIdx, showAllDays, descExpanded,
 *       lightboxIndex) leaking across a warm navigation  -- STILL OPEN
 *
 * SETTLED STATE IS NOT ENOUGH, which is the thing to carry away from this
 * file. R1 survived the first version of this harness with zero fail lines
 * because its defect lasts ONE COMMIT: the leaked index renders, stamps
 * data-open on nothing, and defaultedForRef corrects it before act() returns.
 * So mountFestival now carries a render-boundary probe -- a <Profiler> inside
 * the tree recording what each COMMIT put in the DOM -- and the R1 case
 * asserts over that window rather than over the result. Any future defect of
 * the same shape (a wrong frame that self-corrects) needs the same treatment;
 * a settled-state assertion is blind to all of them.
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
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { Profiler } from 'react';
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
  SPAN_WITH_EARLY_DAY,
  SCHEDULE_WITH_EARLY_DAY,
  IDS_A,
  seedClient,
  installFixtureFetchGate,
  removeFixtureFetchGate,
} from '../fixtures/festivalFixture';
import { installJsdomPolyfills } from './jsdomPolyfills';

/**
 * THE CLOCK IS PINNED, and that is a defect fix rather than hygiene.
 *
 * Every case here depends on where the real wall-clock date falls relative to
 * the fixture's span, and until this existed the answer was a COINCIDENCE: the
 * fixture runs 2026-09-04..06 and the machine happened not to. On 2026-09-05
 * the mount-gated correction resolves index 1 instead of 0, and two cases red
 * against correct code -- proven by running this file against a fixture
 * shifted so that today is the middle day. Twelve days out when this was
 * written, against a festival with a 28 September deadline.
 *
 * Only Date is faked. setTimeout stays real because userEvent schedules its
 * pointer sequence through it.
 */
const OUTSIDE_THE_SPAN = new Date('2026-07-01T12:00:00Z');

beforeAll(() => {
  installJsdomPolyfills();
  installFixtureFetchGate('client harness');
  vi.useFakeTimers({ toFake: ['Date'] });
});

// This beforeEach is the CLOCK only -- it does not contradict the note below
// about cleanup, which still has to run after. Re-pinned per case so the one
// case that deliberately moves the clock cannot leak its date into the next.
beforeEach(() => {
  vi.setSystemTime(OUTSIDE_THE_SPAN);
});
// afterEACH, not beforeEach. This project runs vitest with `globals: false`,
// so RTL never registers its own auto-cleanup -- and cleaning up BEFORE the
// next test leaves the LAST test's tree mounted for good. afterAll then
// restores the real fetch underneath a live AuthProvider and Supabase client
// whose teardown only runs on unmount, which is how a "pure" test file ends up
// holding a network client open into whatever the worker runs next.
afterEach(cleanup);
afterAll(() => {
  removeFixtureFetchGate();
  vi.useRealTimers();
});

/**
 * Mount /festival/:id for real and hand back the three levers a case may pull:
 *
 *   navigateTo    a real router navigation to the other festival -- the WARM
 *                 path, because both are seeded into one QueryClient
 *   landRefetch   a fresh payload for a festival already on screen, which is
 *                 what a refetch does: no remount, all state survives
 *   commits       every frame the render-boundary probe recorded, newest last
 *
 * It deliberately hands back NO rerender. This JSDoc used to promise one and
 * the function has never returned it: MemoryRouter reads `initialEntries` once
 * at mount, so re-rendering the tree with a different one changes nothing and
 * the destination silently stays put. A reader who restored `rerender` to make
 * the old wording true would have reintroduced exactly that no-op navigation.
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

  // OWNED, not RTL's. The commit probe below reads this element from inside
  // React's commit phase -- including the mount commits, which happen before
  // `render` has returned anything to read.
  const container = document.body.appendChild(document.createElement('div'));

  // THE RENDER-BOUNDARY PROBE, and the whole reason this harness can now see a
  // TRANSIENT wrong render rather than only the state it settles into.
  //
  // <Profiler> is a spy component inside the tree: React marks the Profiler
  // fibre with an Update flag whenever there is work anywhere BELOW it, and
  // calls onRender in the commit's LAYOUT phase -- after every DOM mutation of
  // that commit is applied, exactly once per commit. So each entry here is one
  // complete frame the reader could have been shown.
  //
  // A MutationObserver was tried for this first and REVERTED. It reports each
  // individual DOM mutation, so between React removing data-open from one slot
  // and adding it to another it observes a document with ZERO open columns --
  // and it therefore reds against correct code. That is a DOM-patching
  // artefact, not a frame. The distinction between "a mutation happened" and
  // "a commit finished" is the entire difference between the two approaches.
  const commits: GridSnapshot[] = [];

  const mount = () => render(
    <AppProviders client={client}>
      <MemoryRouter initialEntries={[`/festival/${uuid}`]}>
        <NavigationProbe />
        <Routes>
          <Route
            path="/festival/:id"
            element={(
              <Profiler id="festival" onRender={() => commits.push(snapshotGrid(container))}>
                <FestivalDetail serverTodayKey={serverTodayKey} />
              </Profiler>
            )}
          />
        </Routes>
      </MemoryRouter>
    </AppProviders>,
    { container },
  );

  // try/catch, because RTL registers a container for cleanup only INSIDE
  // render(). If render throws -- and the fixture's throwing fetch gate makes
  // an unseeded query do exactly that, which is the likeliest way this harness
  // breaks -- the div would stay in document.body with a live tree under it
  // and afterEach(cleanup) would never see it. The file header spells out what
  // that costs: cleanup is what unmounts the AuthProvider and its Supabase
  // client, and one left open reddens unrelated timing-sensitive tests in
  // whatever the worker runs next.
  try {
    mount();
  } catch (err) {
    container.remove();
    throw err;
  }

  // NO `rerender` and NO `client`. rerender is withheld for the reason in the
  // WARM vs COLD note; the raw QueryClient is withheld for the same reason --
  // a case reaching for setQueryData directly would bypass landRefetch's
  // act() wrapper, which is the one thing making a refetch observable here.
  return {
    container,
    commits,
    /** Drop the mount commits so a case asserts only over its own window. */
    clearCommits: () => {
      commits.length = 0;
    },
    navigateTo: (to: string) => {
      if (!navigate) throw new Error('navigateTo: the router never mounted the probe');
      act(() => navigate!(`/festival/${to}`));
    },
    /**
     * Land a fresh payload into the SAME QueryClient -- what a refetch does.
     * Not a remount and not a navigation: the component stays mounted and
     * every piece of its state survives, which is the condition the
     * only-when-different case needs.
     *
     * ARGUMENT ORDER MIRRORS seedClient DELIBERATELY. `tests/` is in no
     * tsconfig, so npm run typecheck covers zero test files and a swapped
     * (schedule, span) pair would compile, then fail deep inside the parser
     * with an error naming the component rather than this call.
     *
     * `ids` is required rather than defaulted. Defaulted, this silently
     * rewrote festival A's cache even when called after navigating to B.
     */
    landRefetch: async (
      schedule: unknown[],
      span: { start: string; end: string },
      ids: { uuid: string; slug: string; name: string },
    ) => {
      await act(async () => {
        await seedClient(schedule, span, ids, client);
      });
    },
  };
}

/**
 * One commit's worth of grid state, as the reader would have seen that frame.
 *
 * The two absent kinds are kept apart deliberately. 'no-body' is the "Festival
 * not found" branch -- the fixture stopped resolving -- while 'no-row' is a
 * markup regression on a page that did render. One shared message made a
 * fixture failure and a component failure indistinguishable from the output.
 */
type GridSnapshot =
  | { grid: 'no-body' }
  | { grid: 'no-row' }
  | { grid: 'present'; rows: number; slots: number; open: number[]; openPerRow: number[] };

/**
 * THE ONE DOM READER in this file, so the settled-state assertions and the
 * commit-boundary probe below can never disagree about what "open" means.
 *
 * EVERY .tl-row, not the first. The grid renders one row per distinct hour and
 * stamps data-open per (row, day) CELL, so "which column is open" is a
 * whole-grid property. The fixture pins every session to 20:00 and so has
 * exactly one row -- which is precisely why reading only the first row would
 * have looked correct forever while a half-blank schedule walked past it.
 * `open` is the union across rows and `openPerRow` the per-row count, so rows
 * that DISAGREE are representable rather than silently flattened into one.
 *
 * Non-throwing, unlike openColumns: the probe calls it from inside React's
 * commit phase, where a throw surfaces as an unhandled error rather than as a
 * verdict, and where the grid legitimately may not exist yet.
 */
function snapshotGrid(container: HTMLElement): GridSnapshot {
  const body = container.querySelector('.tl-body');
  if (!body) return { grid: 'no-body' };
  const rows = Array.from(body.querySelectorAll('.tl-row'));
  if (rows.length === 0) return { grid: 'no-row' };

  const perRow = rows.map((r) => Array.from(r.querySelectorAll(':scope > .slot')));
  const union = new Set<number>();
  for (const slots of perRow) {
    slots.forEach((s, i) => {
      if (s.hasAttribute('data-open')) union.add(i);
    });
  }

  return {
    grid: 'present',
    rows: rows.length,
    slots: Math.max(...perRow.map((s) => s.length)),
    open: [...union].sort((a, b) => a - b),
    openPerRow: perRow.map((slots) => slots.filter((s) => s.hasAttribute('data-open')).length),
  };
}

/**
 * Which 0-based column carries data-open, and HOW MANY do -- the same
 * presence-not-value read the SSR gate uses, for the same reason: the CSS
 * matches on presence, so `data-open="false"` would open every column.
 *
 * THROWS on every shape a settled assertion must not quietly accept: no page,
 * no rows, no slots, and rows that disagree with each other. A case reading an
 * empty array off a page which rendered no timeline at all would pass for the
 * wrong reason, which is the failure the mount control at the top of this file
 * exists to prevent.
 */
function openColumns(container: HTMLElement): number[] {
  const snap = snapshotGrid(container);
  if (snap.grid === 'no-body') throw new Error('openColumns: nothing rendered a .tl-body');
  if (snap.grid === 'no-row') throw new Error('openColumns: .tl-body has no .tl-row');
  if (snap.slots === 0) throw new Error('openColumns: .tl-row has no slots');
  if (snap.openPerRow.some((n) => n !== snap.open.length)) {
    throw new Error(
      `openColumns: rows disagree -- union ${JSON.stringify(snap.open)}, ` +
        `per-row ${JSON.stringify(snap.openPerRow)}`,
    );
  }
  return snap.open;
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

  it('writes the picked VALUE, so a later seed recomputation cannot move the tab', async () => {
    // THE MUTANT THIS EXISTS FOR is a queued optimisation, not a current bug:
    // the effect writes `null -> 0` on every load where `0 -> 0` used to hit
    // React's bailout, so the obvious saving is to write only when the value
    // differs. That leaves `pickedDayIdx` NULL whenever the effect agrees with
    // the seed -- and then the seed, which is a live useMemo, keeps deciding.
    //
    //   setPickedDayIdx(prev => ((prev ?? seedDayIdx) === next ? prev : next))
    //
    // The tab then moves under a reader who never touched it. A previous
    // attempt at this case was DELETED in review for not being able to fail:
    // it clicked tabs, which is a no-op under that mutant, and never made the
    // seed recompute. This one does not click anything.
    const { container, landRefetch } = await mountFestival(EVENT_UUID, LOCAL_START);

    // The mount-gated effect has already run. It resolves against the pinned
    // clock (2026-07-01, outside the fixture's September span BY CONSTRUCTION
    // rather than by luck), so it answers 0 -- the value the seed already had.
    // That agreement is exactly the condition under which the mutant declines
    // to write.
    expect(openColumns(container)).toEqual([0]);
    const labelsBefore = dayTabs(container).map((b) => b.textContent);
    expect(labelsBefore).toHaveLength(3);

    // A refetch, not a remount and not a navigation: the component stays
    // mounted and pickedDayIdx survives. The payload adds a day to the FRONT,
    // which is production-reachable (an organiser adds an opening day) and is
    // the only way to make the seed disagree with a settled pick.
    await landRefetch(SCHEDULE_WITH_EARLY_DAY, SPAN_WITH_EARLY_DAY, IDS_A);

    // THE SEED REALLY MOVED, and this is the control the assertion below is
    // worthless without. Every previous column has shifted right by exactly
    // one, so the pinned key that was at index 0 is now at index 1 -- meaning
    // seedDayIdx is 1 and only a written pickedDayIdx can still say 0.
    // Asserted as a front-shift rather than against hard-coded labels so it
    // does not re-encode the date formatter.
    const labelsAfter = dayTabs(container).map((b) => b.textContent);
    expect(labelsAfter).toHaveLength(4);
    expect(labelsAfter.slice(1)).toEqual(labelsBefore);

    // The pin holds. NOTE WHAT THIS DOES AND DOES NOT SAY: the INDEX is
    // pinned, so the reader now sits on the newly-inserted day rather than on
    // the one they were shown. That staleness is real and separately queued --
    // the clamp bounds a stale pick, it does not drop one, and the same
    // staleness reaches showAllDays, descExpanded and lightboxIndex. What is
    // asserted here is only that the effect's pick is a VALUE and not a no-op.
    expect(openColumns(container)).toEqual([0]);
    expect(activeTabs(container)).toEqual([0]);
  });

  it('corrects the seeded day against the real clock after mount', async () => {
    // THE MUTANT THIS EXISTS FOR: delete the correction and latch the pinned
    // server key instead --
    //
    //   setPickedDayIdx(resolveFestivalDefaultDay(dayKeys, sessionDayKeys, serverTodayKey))
    //
    // Every other case in this file stays green under that, because they all
    // arrange for the pin and the clock to AGREE. Making them differ is the
    // only way to tell a correction from a seed, and until this case existed
    // the file's own header claimed the correction was gated when it was not.
    //
    // The pin says day 0 -- what an edge-cached document generated before the
    // festival's midnight carries. The pinned clock says day 2. The reader
    // must end on day 2: the pre-hydration document opens the pinned day, the
    // first mounted render opens the true one, never the reverse.
    vi.setSystemTime(new Date('2026-09-06T12:00:00Z'));

    const { container } = await mountFestival(EVENT_UUID, LOCAL_START);

    expect(dayTabs(container)).toHaveLength(3);
    expect(openColumns(container)).toEqual([2]);
    expect(activeTabs(container)).toEqual([2]);
  });
});

describe('client: a WARM festival-to-festival navigation settles in range', { timeout: 60_000 }, () => {
  // TWO CASES, AND THE SECOND IS THE ONE THAT GATES THE CLAMP. The settled
  // state after this navigation is correct WITH OR WITHOUT the clamp, because
  // the defect is TRANSIENT: defaultedForRef corrects the leaked index one
  // effect later, so the out-of-range render happens, paints nothing into
  // data-open, and is gone before act() returns. Measured -- reverting the
  // clamp to `pickedDayIdx ?? seedDayIdx` left this file 3/3 green until the
  // commit-boundary case below existed.
  //
  // The first case is still worth its runtime: it pins the settled result and
  // drives the whole warm path -- shared QueryClient, no remount, a real router
  // navigation -- and if IT reds, the second case's window is meaningless.
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

  it('opens exactly one in-range column on EVERY commit of that navigation', async () => {
    // R1. The clamp at FestivalDetail.tsx exists because pickedDayIdx outlives
    // a warm festival-to-festival navigation. Without it, the first commit
    // after the param change renders activeDayIdx = 2 against a 2-column grid
    // and data-open is stamped on NOTHING. Measured, both directions, here:
    //
    //   clamp present   [ {slots:2, open:[1]}, {slots:2, open:[0]} ]
    //   clamp reverted  [ {slots:2, open:[] }, {slots:2, open:[0]} ]
    //
    // so the assertion has to be over the WINDOW, not the settled state.
    //
    // WHICH VIEWPORT, because this case cannot be quoted for the consequence
    // without it. jsdom reports innerWidth 1024, so the mount effect sets
    // showAllDays and the body renders data-day="all" -- the DESKTOP state,
    // and the one jsdomPolyfills.ts pins ("no case in it may claim anything
    // about mobile breakpoint behaviour"). ASSERTED HERE: the state defect --
    // no column carries data-open. NOT ASSERTED: what a reader sees. The
    // blank schedule is the MOBILE rendering of this same state, produced by
    // `.tl-body:not([data-day="all"]) .tl-row > .slot:not([data-open])
    // {display:none}`, a rule that cannot match at this width. The state is
    // viewport-independent and is what the clamp fixes; the mobile render of
    // it is queued with the rest of the mobile re-point.
    const user = userEvent.setup();
    const { container, commits, clearCommits, navigateTo } = await mountFestival(
      EVENT_UUID,
      LOCAL_START,
    );

    await user.click(dayTabs(container)[2]);
    expect(openColumns(container)).toEqual([2]);

    clearCommits();
    navigateTo(EVENT_UUID_B);

    // FAIL-CLOSED, and this line is why the probe cannot go quietly blind.
    // <Profiler> only reports in a development React build; in a production
    // one it is inert, `commits` stays EMPTY, and every assertion below
    // passes vacuously over an empty array.
    //
    // PINNED EXACTLY, not as a floor. The frame that discriminates is
    // commits[0] -- the render between the param change and the correction --
    // and a floor cannot say which frame that is. A future change that both
    // added one benign commit AND stopped capturing the pre-correction one
    // (batching the param change with the correction, moving the correction
    // to useLayoutEffect, React's own scheduling) would leave two
    // post-correction frames: a floor of 2 holds, every frame has one open
    // in-range column, and the case gates nothing it claims to. Measured
    // 2026-08-24: exactly 2, with and without the clamp. If this reds on the
    // COUNT, re-measure and re-record it -- do not relax it to a floor.
    expect(commits.length).toBe(2);

    // The discriminating frame, named rather than inferred. With the clamp it
    // opens the destination's LAST column (the leaked index 2, clamped to 1);
    // without it, nothing. NOTE: the queued per-festival state reset would
    // legitimately change this to [0] -- that is a deliberate behaviour change
    // and re-recording this line is part of it, not a workaround.
    const first = commits[0];
    if (first.grid !== 'present') throw new Error(`commit 0 rendered ${first.grid}`);
    expect(first.open).toEqual([1]);

    // The probe saw the DESTINATION. Stated by inclusion (every commit has B's
    // two columns) rather than by excluding what we recognise: a probe reading
    // the wrong tree, or one that recorded only pre-navigation frames, would
    // otherwise satisfy the invariant below without ever having looked at the
    // render that carries the defect.
    expect(commits.map((c) => (c.grid === 'present' ? c.slots : c.grid))).toEqual(
      new Array(commits.length).fill(2),
    );

    // The invariant itself: no frame in this window may be blank or doubly
    // open, and no ROW within a frame may disagree with its siblings. Keyed by
    // commit index so a failure names WHICH frame.
    //
    // There is deliberately NO `open[k] < slots` assertion here. It reads like
    // a second edge and is definitionally true: snapshotGrid derives every
    // element of `open` as an index INTO the slot list it measures, so an
    // out-of-range value is unrepresentable and the line survives being
    // replaced by expect(true) with zero fail lines. The clamp's defect
    // reaches the DOM as an empty `open`, which the length check already
    // catches on its own.
    for (const [i, commit] of commits.entries()) {
      if (commit.grid !== 'present') throw new Error(`commit ${i} rendered ${commit.grid}`);
      expect({ commit: i, open: commit.open.length }).toEqual({ commit: i, open: 1 });
      expect({ commit: i, perRow: commit.openPerRow }).toEqual({
        commit: i,
        perRow: new Array(commit.rows).fill(1),
      });
    }
  });
});
