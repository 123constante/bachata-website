// @vitest-environment jsdom
/**
 * CLIENT harness for FestivalDetail -- the half no test in this repo could
 * reach until now.
 *
 * WHY IT EXISTS. Every other festival test is SSR (renderToString) or pure
 * unit, so nothing MOUNTS this component. Three defects were therefore
 * recorded as "survives the whole suite with zero fail lines" rather than
 * fixed:
 *   R1  the activeDayIdx clamp, recorded as existing because pickedDayIdx
 *       outlives a festival-to-festival navigation       -- PREMISE WRONG,
 *       see the navigation describe; the clamp is now UNGATED
 *   --  the OVERRIDE half of the seed/override split: tab clicks, and the
 *       post-mount clock correction                      -- NOW GATED
 *   --  per-festival state (pickedDayIdx, showAllDays, descExpanded,
 *       lightboxIndex) leaking across a navigation       -- NOT A DEFECT:
 *       both routes key on params.id and remount. NOW GATED, at the key.
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
 * MOUNT THE ROUTE, NOT JUST THE PAGE. The navigation cases pass
 * `{ throughRoute: true }`, which mounts app/routes/festival.tsx's own
 * component rather than FestivalDetail directly. That file holds
 * `key={params.id}`, so it -- not this harness -- decides whether a param
 * change remounts. A keyed wrapper written HERE would prove only that React
 * remounts on a key change and would stay green with the production key
 * deleted. Direct-mount cases keep the old shape: nothing about a key matters
 * to a case that never navigates.
 *
 * An earlier version of this header argued warm-vs-cold reachability at
 * length -- COLD destinations unmount via EventPage's festival sniff, WARM
 * ones survive inside the 60s staleTime. All true of `/event/:id` in the
 * abstract, and beside the point: both routes key on the param, so the
 * subtree remounts either way and no per-festival state crosses a navigation.
 * The distinction cost two review rounds before anyone read the route file.
 *
 * `navigateTo` is a real router navigation and is AWAITED -- a remount can
 * suspend on the PageTransition chunk, and a synchronous act() returns on the
 * suspended commit. NOT a rerender: MemoryRouter reads `initialEntries` once,
 * at mount, so re-rendering the tree with a different one changes nothing and
 * the destination silently stays put. `rerender` is deliberately NOT returned
 * from mountFestival for that reason.
 */
import { describe, it, expect, beforeAll, beforeEach, afterAll, afterEach, vi } from 'vitest';
import { Profiler } from 'react';
import { render, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route, useNavigate, useParams } from 'react-router';
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
  SPAN_SHRUNK,
  SCHEDULE_SHRUNK,
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
async function mountFestival(
  uuid: string,
  serverTodayKey?: string,
  opts?: { throughRoute?: boolean },
) {
  const { AppProviders } = await import('@/App');
  const { default: FestivalDetail } = await import('@/pages/FestivalDetail');

  // THROUGH-ROUTE MODE mounts the REAL route component from
  // app/routes/festival.tsx rather than FestivalDetail directly, and the
  // distinction is the whole value of the navigation cases below.
  //
  // `key={params.id}` lives in that file, not here, and the key is what is
  // under test. A keyed wrapper written INSIDE this harness would assert only
  // that React remounts when a key changes -- it would stay green with the
  // production key deleted, and read as coverage while gating nothing. That is
  // the same shape as the defect this harness was built to expose.
  //
  // The adapter reproduces exactly what the framework does and nothing more:
  // compute params from the URL, hand them to the route component as a prop.
  // HydrationBoundary, InitialVisiblePageTransition and the key are all the
  // shipped file's own.
  //
  // CALLED, not rendered as JSX, and that form is measured rather than chosen:
  // FestivalRoute holds no hooks, so inlining its render into the adapter is
  // equivalent, and the key it returns still sits on an element whose parent
  // re-renders on a param change -- which is what makes the remount happen.
  const { default: FestivalRoute } = await import('../../app/routes/festival');
  const RouteAdapter = () => {
    const params = useParams();
    return (FestivalRoute as unknown as (p: unknown) => JSX.Element)({
      loaderData: { todayKey: serverTodayKey, dehydratedState: undefined },
      params,
      matches: [],
    });
  };

  const client: QueryClient = await seedClient(SCHEDULE, undefined, IDS_A);
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
                {opts?.throughRoute
                  ? <RouteAdapter />
                  : <FestivalDetail serverTodayKey={serverTodayKey} />}
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

  // SETTLE THE TREE BEFORE HANDING IT BACK, and this is not defensive padding.
  //
  // InitialVisiblePageTransition renders PageTransition -- a lazy chunk --
  // inside a Suspense boundary once its module-scoped `clientNavigated` flag
  // is set, which any EARLIER case in this file may have done. A mount landing
  // in that state returns while the boundary is still showing its fallback,
  // and a click delivered to that tree can be discarded when the chunk
  // resolves and the real subtree takes over -- the picked day silently
  // reverts to the seed.
  //
  // That is not hypothetical: it made a key-deletion mutant red on the SETUP
  // click of a later case rather than on the window it was written to gate.
  // The mutant died either way, which is precisely the danger -- a green/red
  // verdict driven by cross-test module state instead of by the thing under
  // test. Draining here makes each case start from a settled tree, so the
  // verdict comes from its own assertions.
  //
  // UNCONDITIONAL. This was briefly narrowed to throughRoute mounts because
  // applying it everywhere red the landRefetch case 3 runs out of 3 -- but the
  // cause was landRefetch missing its own second flush (see it below), not
  // anything about direct mounts. With that fixed the drain is safe for both
  // modes, and keeping it narrowed would have left a rule whose stated reason
  // had stopped being true.
  await act(async () => {});

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
    /**
     * AWAITED, and the await is load-bearing in throughRoute mode.
     *
     * A remount re-enters InitialVisiblePageTransition, which after the first
     * client navigation renders PageTransition -- a lazy chunk -- inside a
     * Suspense boundary. The commit that starts that import is the SUSPENDED
     * one: a synchronous act() returns on it, and the commit window a case
     * then reads is a single frame with an empty grid rather than the
     * destination. Measured: 1 commit, slots=0, against the 8 the resolved
     * navigation produces.
     *
     * An async act() drains the microtask queue the lazy import resolves on,
     * so the window covers the whole navigation. Direct-mount cases are
     * unaffected -- nothing suspends there -- so this is safe for both modes.
     */
    navigateTo: async (to: string) => {
      if (!navigate) throw new Error('navigateTo: the router never mounted the probe');
      await act(async () => {
        navigate!(`/festival/${to}`);
      });
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
      // A SECOND FLUSH, and it is the difference between this lever working and
      // silently doing nothing.
      //
      // The act() above returns once seedClient's own promise settles. React
      // Query's observer notification is scheduled on the notifyManager, so the
      // re-render it triggers lands in a LATER task -- outside that act(). With
      // one flush the cache holds the new payload and the tree still renders the
      // old one: measured as 3 day tabs where the refetch supplies 4, and as
      // ZERO <Profiler> commits during the refetch.
      //
      // That symptom was first diagnosed here as "the query observer stops being
      // notified after any interaction that sets component state", and a drain
      // was narrowed to the throughRoute path to work around it. Both were
      // wrong: an extra flush BEFORE landRefetch changes nothing (which is what
      // the wrong diagnosis tested), an extra flush AFTER it recovers the update
      // every time. Recorded because the wrong cause is what manufactured the
      // narrowing, and the narrowing looked like a fix.
      //
      // A TASK, not a microtask. `await act(async () => {})` drains microtasks
      // only, and React Query's notifyManager schedules its batched observer
      // notification on a macrotask -- so an empty act() is not enough on its
      // own (measured: still 3 tabs where 4 are supplied). Crossing a real
      // timer boundary is what makes the notification land inside act(), and
      // therefore inside the case's assertions. setTimeout is REAL here: the
      // file pins `vi.useFakeTimers({ toFake: ['Date'] })`, Date only.
      await act(async () => {
        await new Promise((resolve) => { setTimeout(resolve, 0); });
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


describe('client: a refetch that SHORTENS the schedule', { timeout: 60_000 }, () => {
  // THE CLAMP'S GATE, and until this case the clamp had none.
  //
  // It was justified -- in its own comment, and in the case that covered it --
  // as protection against pickedDayIdx outliving a festival-to-festival
  // NAVIGATION. It cannot: both routes remount on a param change, so every
  // destination starts from a null pick. Measured: with the navigation cases
  // below pointed at the real route, reverting the clamp to
  // `pickedDayIdx ?? seedDayIdx` left this file 6/6 GREEN.
  //
  // What the clamp actually guards is this: the same festival, still mounted,
  // whose schedule gets shorter underneath a pick already made. No remount, no
  // navigation, and defaultedForRef.current === eventId so the default-day
  // effect will not re-pick either.
  it('keeps the open column in range when the closing day is deleted', async () => {
    const user = userEvent.setup();
    const { container, landRefetch } = await mountFestival(EVENT_UUID, LOCAL_START);

    await user.click(dayTabs(container)[2]);
    expect(openColumns(container)).toEqual([2]);

    await landRefetch(SCHEDULE_SHRUNK, SPAN_SHRUNK, IDS_A);

    // The grid really did shrink -- without this the case could pass against a
    // refetch that changed nothing, which is precisely how the navigation cases
    // this file used to carry went two rounds asserting an unreachable tree.
    expect(dayTabs(container)).toHaveLength(2);

    // Reverting the clamp leaves activeDayIdx at 2 against a 2-column grid:
    // data-open is stamped on NOTHING, the hide-every-other-slot rule hides
    // every slot, and the reader gets a BLANK schedule rather than a wrong one.
    // That mutant reds this line with an empty array.
    //
    // PINNED TO THE LAST COLUMN, not merely "in range". The clamp BOUNDS the
    // stale pick without dropping it, so the view silently moves to column 1
    // while pickedDayIdx stays 2. The queued write-back would legitimately
    // change this to [0]; re-recording this line is part of that change rather
    // than a workaround for it.
    expect(openColumns(container)).toEqual([1]);
  });
});

describe('client: a festival-to-festival navigation, through the REAL route', { timeout: 60_000 }, () => {
  // WHAT CHANGED HERE, AND WHY, because the previous version of this block
  // asserted the opposite of what the app does.
  //
  // These cases used to mount FestivalDetail directly, with no key -- an
  // arrangement the app does not ship. app/routes/festival.tsx renders it as
  // `<InitialVisiblePageTransition key={params.id}>`, and app/routes/event.tsx
  // does the same for /event/:id, so a param change REMOUNTS the subtree and
  // every piece of per-festival state -- pickedDayIdx, lightboxIndex,
  // descExpanded, showAllDays -- is destroyed with it. Both keys have been in
  // place since the RR7 framework-mode migration (2567376, 0729ecc).
  //
  // The old R1 case therefore pinned `commits[0].open` to [1] -- the leaked
  // index, clamped -- as the expected contract. It was measuring the defect
  // and recording it as correct.
  //
  // MEASURED 2026-08-24, through the real route component, both directions:
  //
  //   key present (shipped)   8 commits, every one open=[0]
  //   key deleted (mutant)    3 commits: open=[1], open=[0], open=[0]
  //
  // so the window assertion below kills a deletion of the production key. The
  // SETTLED state cannot: it is [0] either way, because defaultedForRef
  // re-picks on an eventId change one effect later. That is the entire reason
  // the second case exists, and why the first is labelled a control.
  //
  // ONE FIDELITY GAP, stated rather than hidden: the adapter hands BOTH
  // festivals the same `todayKey` (festival A's start), where the real loader
  // recomputes it per navigation. That key is absent from B's dayKeys, so
  // resolveFestivalDefaultDay falls back to day 0 -- exactly what a real load
  // of B on a day outside its span does. It is the destination's own seed
  // either way, which is all these cases read.
  it('reaches the destination festival', async () => {
    // THE CONTROL, and labelled honestly: this case PASSES with the production
    // key deleted. It gates nothing about the remount. Its job is to prove the
    // navigation happened at all, so that a green window case below cannot be
    // green over a navigation that never ran.
    const user = userEvent.setup();
    const { container, navigateTo } = await mountFestival(EVENT_UUID, LOCAL_START, {
      throughRoute: true,
    });

    await user.click(dayTabs(container)[2]);
    expect(openColumns(container)).toEqual([2]);

    await navigateTo(EVENT_UUID_B);

    expect(dayTabs(container)).toHaveLength(2);
    expect(openColumns(container)).toEqual([0]);
  });

  it('shows no frame carrying the previous festival day', async () => {
    // THE GATE ON `key={params.id}`. Delete it from app/routes/festival.tsx
    // and the first commit after the param change opens column 1 -- festival
    // A's day 2, clamped to B's last column -- a frame showing the wrong day
    // of the wrong festival. Restore it and no such frame exists.
    const user = userEvent.setup();
    const { container, commits, clearCommits, navigateTo } = await mountFestival(
      EVENT_UUID,
      LOCAL_START,
      { throughRoute: true },
    );

    await user.click(dayTabs(container)[2]);
    expect(openColumns(container)).toEqual([2]);

    clearCommits();
    await navigateTo(EVENT_UUID_B);

    // WHAT THE MOUNT DRAIN DOES TO THIS CASE, measured in all four
    // combinations, because review read it as a fail-open and it is not:
    //
    //   drain   key      result
    //   -----   ------   ---------------------------------------------------
    //   yes     yes      7/7 green
    //   yes     no       reds HERE, at {commit: 0, open: [1]} -- intended
    //   no      yes      7/7 green
    //   no      no       reds, but at the slots line below ([0] vs [2]) -- 3/3
    //
    // So the verdict tracks the key in both drain states: this case has no
    // configuration in which it stays green against its own mutant. What the
    // drain changes is WHICH assertion reds. Without it the navigation window
    // is a single Suspense-fallback frame with an empty grid, and the
    // "probe saw the DESTINATION" assertion below rejects that before the
    // discriminating line is reached -- fail-closed, with a confusing message.
    //
    // The fallback frame is caught by that slots assertion, NOT by the length
    // check immediately below: snapshotGrid cannot tell a fallback frame from a
    // resolved one, so `commits.length > 0` would accept a fallback-only
    // window on its own. The two assertions are load-bearing together.
    //
    // FAIL-CLOSED. <Profiler> only reports in a development React build; in a
    // production one it is inert, `commits` stays EMPTY, and every assertion
    // below passes vacuously over an empty array.
    expect(commits.length).toBeGreaterThan(0);

    // NO COUNT PIN, and that is a deliberate difference from the version this
    // replaces. The remount produces 8 commits and the mutant 3, so a pinned
    // count would encode WHICH ARRANGEMENT is in place rather than whether the
    // reader was ever shown the wrong column -- it would red on any benign
    // scheduling change and pass on none of the real ones. The invariant below
    // runs over the WHOLE window instead, so a wrong frame anywhere kills it
    // and no single frame has to be named as the discriminating one.

    // The probe saw the DESTINATION. Stated by inclusion (every commit carries
    // B's two columns) rather than by excluding what we recognise: a probe
    // reading the wrong tree, or one that recorded only pre-navigation frames,
    // would otherwise satisfy the invariant below without ever having looked
    // at the render that carries the defect.
    expect(commits.map((c) => (c.grid === 'present' ? c.slots : c.grid))).toEqual(
      new Array(commits.length).fill(2),
    );

    for (const [i, commit] of commits.entries()) {
      if (commit.grid !== 'present') throw new Error(`commit ${i} rendered ${commit.grid}`);
      // The destination's OWN seed, not the origin's leaked pick. Keyed by
      // commit index so a failure names WHICH frame was wrong.
      expect({ commit: i, open: commit.open }).toEqual({ commit: i, open: [0] });
      expect({ commit: i, perRow: commit.openPerRow }).toEqual({
        commit: i,
        perRow: new Array(commit.rows).fill(1),
      });
    }
  });
});
